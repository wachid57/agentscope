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
	store          *store.Store
	agentscopeURL  string
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
	return c.JSON(fiber.Map{
		"data":  sessions,
		"total": len(sessions),
	})
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

// Chat POST /api/agents/:id/chat - proxies to AgentScope Python service or simulates
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

	// Create or get session
	var sess *models.Session
	if req.SessionID != "" {
		sess, err = h.store.GetSession(req.SessionID)
		if err != nil {
			sess, err = h.store.CreateSession(agentID, req.UserID)
			if err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
			}
		}
	} else {
		sess, err = h.store.CreateSession(agentID, req.UserID)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
	}

	// Save user message
	userMsg := models.ChatMessage{
		Role:    "user",
		Name:    req.UserID,
		Content: req.UserInput,
	}
	_ = h.store.AddMessage(sess.ID, userMsg)
	h.store.AddLog(agentID, sess.ID, "info", fmt.Sprintf("User: %s", req.UserInput))

	// Set SSE headers
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("Transfer-Encoding", "chunked")

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		var assistantContent strings.Builder

		if h.agentscopeURL != "" && agent.Status == models.AgentStatusRunning {
			// Proxy to AgentScope Python service
			payload := map[string]any{
				"user_input": req.UserInput,
				"user_id":    req.UserID,
				"session_id": sess.ID,
			}
			b, _ := json.Marshal(payload)
			resp, err := http.Post(
				h.agentscopeURL+"/chat_endpoint",
				"application/json",
				bytes.NewReader(b),
			)
			if err == nil {
				defer resp.Body.Close()
				scanner := bufio.NewScanner(resp.Body)
				for scanner.Scan() {
					line := scanner.Text()
					if strings.HasPrefix(line, "data: ") {
						chunk := strings.TrimPrefix(line, "data: ")
						assistantContent.WriteString(chunk)
						fmt.Fprintf(w, "data: %s\n\n", chunk)
						w.Flush()
					}
				}
			}
		} else {
			// Simulate response when agent is stopped / no Python backend
			simResponses := []string{
				fmt.Sprintf("Hello! I am %s. ", agent.Name),
				"I received your message: \"" + req.UserInput + "\". ",
				"This is a simulated response since the agent is not connected to a running Python AgentScope instance. ",
				"To get real AI responses, start the Python AgentScope backend and set the agent status to running.",
			}
			for _, chunk := range simResponses {
				assistantContent.WriteString(chunk)
				data, _ := json.Marshal(map[string]string{
					"content":    chunk,
					"session_id": sess.ID,
				})
				fmt.Fprintf(w, "data: %s\n\n", string(data))
				w.Flush()
				time.Sleep(50 * time.Millisecond)
			}
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
		h.store.AddLog(agentID, sess.ID, "info", fmt.Sprintf("Assistant: %s", assistantContent.String()))

		// Send done event
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
