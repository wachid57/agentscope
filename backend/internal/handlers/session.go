package handlers

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/agentscope/web-backend/internal/models"
	"github.com/agentscope/web-backend/internal/store"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// SessionHandler handles session-related requests
type SessionHandler struct {
	store         *store.Store
	agentscopeURL string // e.g. http://agentscope-core:5001
}

// NewSessionHandler creates a new SessionHandler
func NewSessionHandler(s *store.Store, agentscopeURL string) *SessionHandler {
	return &SessionHandler{store: s, agentscopeURL: agentscopeURL}
}

// ListSessions GET /api/agents/:id/sessions
func (h *SessionHandler) ListSessions(c *fiber.Ctx) error {
	agentID := c.Params("id")
	if _, err := h.store.GetAgent(agentID); err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}
	sessions := h.store.ListSessions(agentID)
	return c.JSON(fiber.Map{"data": sessions, "total": len(sessions)})
}

// GetSession GET /api/sessions/:session_id
func (h *SessionHandler) GetSession(c *fiber.Ctx) error {
	sessionID := c.Params("session_id")
	sess, err := h.store.GetSession(sessionID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(sess)
}

// CreateSession POST /api/agents/:id/sessions
func (h *SessionHandler) CreateSession(c *fiber.Ctx) error {
	agentID := c.Params("id")
	if _, err := h.store.GetAgent(agentID); err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}
	type Body struct {
		UserID string `json:"user_id"`
	}
	var body Body
	_ = c.BodyParser(&body)
	if body.UserID == "" {
		body.UserID = "anonymous"
	}
	sess, err := h.store.CreateSession(agentID, body.UserID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(sess)
}

// DeleteSession DELETE /api/sessions/:session_id
func (h *SessionHandler) DeleteSession(c *fiber.Ctx) error {
	sessionID := c.Params("session_id")
	if err := h.store.DeleteSession(sessionID); err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusNoContent).Send(nil)
}

// Chat POST /api/agents/:id/chat
// Proxies to Python agent_server.py with full agent config for real AI responses,
// or falls back to simulation when Python core is unavailable.
func (h *SessionHandler) Chat(c *fiber.Ctx) error {
	agentID := c.Params("id")
	agent, err := h.store.GetAgent(agentID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}

	var req models.ChatRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if req.UserInput == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "user_input is required"})
	}
	if req.UserID == "" {
		req.UserID = "anonymous"
	}

	// Get or create session
	var sess *models.Session
	if req.SessionID != "" {
		sess, err = h.store.GetSession(req.SessionID)
		if err != nil {
			sess, err = h.store.CreateSession(agentID, req.UserID)
		}
	} else {
		sess, err = h.store.CreateSession(agentID, req.UserID)
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// Save user message
	_ = h.store.AddMessage(sess.ID, models.ChatMessage{
		Role:    "user",
		Name:    req.UserID,
		Content: req.UserInput,
	})
	h.store.AddLog(agentID, sess.ID, "info", "User: "+req.UserInput)

	// SSE headers
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("Transfer-Encoding", "chunked")

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		var assistantContent strings.Builder

		coreURL := h.agentscopeURL
		coreAvailable := coreURL != "" && h.pingCore(coreURL)

		if coreAvailable {
			// ── Real AI: proxy to Python agent_server.py ──────────────────
			payload := map[string]any{
				"agent_config": agent, // full agent config including model, tools, etc.
				"user_input":   req.UserInput,
				"user_id":      req.UserID,
				"session_id":   sess.ID,
			}
			b, _ := json.Marshal(payload)

			resp, err := http.Post(coreURL+"/chat", "application/json", bytes.NewReader(b))
			if err != nil {
				h.store.AddLog(agentID, sess.ID, "error", "Python core error: "+err.Error())
				writeSimulated(w, agent.Name, req.UserInput, sess.ID, "Python core unreachable: "+err.Error(), &assistantContent)
			} else {
				defer resp.Body.Close()

				// Stream SSE lines from Python → client
				scanner := bufio.NewScanner(resp.Body)
				scanner.Buffer(make([]byte, 1024*1024), 1024*1024)
				for scanner.Scan() {
					line := scanner.Text()
					if !strings.HasPrefix(line, "data: ") {
						continue
					}
					raw := strings.TrimPrefix(line, "data: ")

					// Try to parse as Msg dict from AgentScope
					var msgMap map[string]any
					if json.Unmarshal([]byte(raw), &msgMap) == nil {
						if content, ok := msgMap["content"].(string); ok {
							assistantContent.WriteString(content)
						}
						// Check for error from Python
						if errMsg, ok := msgMap["error"].(string); ok {
							h.store.AddLog(agentID, sess.ID, "error", errMsg)
						}
					}

					fmt.Fprintf(w, "data: %s\n\n", raw)
					w.Flush()
				}
				if err := scanner.Err(); err != nil {
					h.store.AddLog(agentID, sess.ID, "error", "Stream read error: "+err.Error())
				}
			}
		} else {
			// ── Simulation mode ───────────────────────────────────────────
			reason := "Python AgentScope core is not available"
			if agent.Status != models.AgentStatusRunning {
				reason = "Agent is not in running state"
			}
			writeSimulated(w, agent.Name, req.UserInput, sess.ID, reason, &assistantContent)
		}

		// Save assistant message
		assistantMsg := models.ChatMessage{
			ID:        uuid.NewString(),
			Role:      "assistant",
			Name:      agent.Name,
			Content:   assistantContent.String(),
			Timestamp: time.Now(),
		}
		_ = h.store.AddMessage(sess.ID, assistantMsg)
		h.store.AddLog(agentID, sess.ID, "info", "Assistant: "+assistantContent.String())

		// Final done event
		doneData, _ := json.Marshal(map[string]any{
			"done":       true,
			"session_id": sess.ID,
			"message":    assistantMsg,
		})
		fmt.Fprintf(w, "data: %s\n\n", string(doneData))
		w.Flush()
		io.WriteString(w, "data: [DONE]\n\n")
		w.Flush()
	})

	return nil
}

// pingCore checks if the Python core server is reachable
func (h *SessionHandler) pingCore(url string) bool {
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(url + "/health")
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == 200
}

// writeSimulated writes simulated SSE chunks when Python core is not available
func writeSimulated(w *bufio.Writer, agentName, userInput, sessionID, reason string, content *strings.Builder) {
	chunks := []string{
		fmt.Sprintf("Hi! I am **%s**. ", agentName),
		fmt.Sprintf("You said: *\"%s\"*\n\n", userInput),
		fmt.Sprintf("⚠️ **Simulation mode** — %s.\n\n", reason),
		"To get real AI responses:\n1. Ensure the `agentscope` Python container is running\n2. Set agent status to **Running**\n3. Verify your API key is set correctly in the agent config.",
	}
	for _, chunk := range chunks {
		content.WriteString(chunk)
		data, _ := json.Marshal(map[string]string{
			"content":    chunk,
			"session_id": sessionID,
		})
		fmt.Fprintf(w, "data: %s\n\n", string(data))
		w.Flush()
		time.Sleep(60 * time.Millisecond)
	}
}
