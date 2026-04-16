package handlers

import (
	"github.com/agentscope/web-backend/internal/models"
	"github.com/agentscope/web-backend/internal/store"
	"github.com/gofiber/fiber/v2"
)

// AgentHandler handles agent-related HTTP requests
type AgentHandler struct {
	store *store.Store
}

// NewAgentHandler creates a new AgentHandler
func NewAgentHandler(s *store.Store) *AgentHandler {
	return &AgentHandler{store: s}
}

// ListAgents GET /api/agents
func (h *AgentHandler) ListAgents(c *fiber.Ctx) error {
	agents := h.store.ListAgents()
	return c.JSON(fiber.Map{
		"data":  agents,
		"total": len(agents),
	})
}

// GetAgent GET /api/agents/:id
func (h *AgentHandler) GetAgent(c *fiber.Ctx) error {
	id := c.Params("id")
	agent, err := h.store.GetAgent(id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(agent)
}

// CreateAgent POST /api/agents
func (h *AgentHandler) CreateAgent(c *fiber.Ctx) error {
	var req models.CreateAgentRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	if req.Name == "" || string(req.Type) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name and type are required"})
	}

	// Set defaults
	if string(req.Type) == "" {
		req.Type = models.AgentTypeReAct
	}
	if req.Memory.Type == "" {
		req.Memory.Type = models.MemoryInMemory
	}

	agent, err := h.store.CreateAgent(&req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(agent)
}

// UpdateAgent PUT /api/agents/:id
func (h *AgentHandler) UpdateAgent(c *fiber.Ctx) error {
	id := c.Params("id")
	var req models.UpdateAgentRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	agent, err := h.store.UpdateAgent(id, &req)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(agent)
}

// DeleteAgent DELETE /api/agents/:id
func (h *AgentHandler) DeleteAgent(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := h.store.DeleteAgent(id); err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusNoContent).Send(nil)
}

// StartAgent POST /api/agents/:id/start
func (h *AgentHandler) StartAgent(c *fiber.Ctx) error {
	id := c.Params("id")
	agent, err := h.store.GetAgent(id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}
	if agent.Status == models.AgentStatusRunning {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "agent is already running"})
	}
	if err := h.store.SetAgentStatus(id, models.AgentStatusRunning); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	h.store.AddLog(id, "", "info", "Agent started")
	agent.Status = models.AgentStatusRunning
	return c.JSON(agent)
}

// StopAgent POST /api/agents/:id/stop
func (h *AgentHandler) StopAgent(c *fiber.Ctx) error {
	id := c.Params("id")
	agent, err := h.store.GetAgent(id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}
	if agent.Status == models.AgentStatusStopped {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "agent is already stopped"})
	}
	if err := h.store.SetAgentStatus(id, models.AgentStatusStopped); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	h.store.AddLog(id, "", "info", "Agent stopped")
	agent.Status = models.AgentStatusStopped
	return c.JSON(agent)
}

// GetAgentStats GET /api/agents/:id/stats
func (h *AgentHandler) GetAgentStats(c *fiber.Ctx) error {
	id := c.Params("id")
	if _, err := h.store.GetAgent(id); err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}
	stats := h.store.GetStats(id)
	return c.JSON(stats)
}

// GetAgentLogs GET /api/agents/:id/logs
func (h *AgentHandler) GetAgentLogs(c *fiber.Ctx) error {
	id := c.Params("id")
	if _, err := h.store.GetAgent(id); err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}
	logs := h.store.GetLogs(id)
	return c.JSON(fiber.Map{
		"data":  logs,
		"total": len(logs),
	})
}

// DuplicateAgent POST /api/agents/:id/duplicate
func (h *AgentHandler) DuplicateAgent(c *fiber.Ctx) error {
	id := c.Params("id")
	src, err := h.store.GetAgent(id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}

	req := &models.CreateAgentRequest{
		Name:        src.Name + " (copy)",
		Description: src.Description,
		Type:        src.Type,
		SysPrompt:   src.SysPrompt,
		Model:       src.Model,
		Tools:       src.Tools,
		Memory:      src.Memory,
		Tags:        src.Tags,
	}
	agent, err := h.store.CreateAgent(req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(agent)
}
