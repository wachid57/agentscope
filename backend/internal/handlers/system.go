package handlers

import (
	"runtime"

	"github.com/agentscope/web-backend/internal/models"
	"github.com/agentscope/web-backend/internal/store"
	"github.com/gofiber/fiber/v2"
)

// SystemHandler handles system-level requests
type SystemHandler struct {
	store *store.Store
}

// NewSystemHandler creates a new SystemHandler
func NewSystemHandler(s *store.Store) *SystemHandler {
	return &SystemHandler{store: s}
}

// Health GET /health
func (h *SystemHandler) Health(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"status":  "ok",
		"version": "1.0.0",
	})
}

// Overview GET /api/overview
func (h *SystemHandler) Overview(c *fiber.Ctx) error {
	agents := h.store.ListAgents()

	var running, stopped, errored int
	for _, a := range agents {
		switch a.Status {
		case models.AgentStatusRunning:
			running++
		case models.AgentStatusStopped:
			stopped++
		case models.AgentStatusError:
			errored++
		}
	}

	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

	return c.JSON(fiber.Map{
		"agents": fiber.Map{
			"total":   len(agents),
			"running": running,
			"stopped": stopped,
			"errored": errored,
		},
		"system": fiber.Map{
			"go_version":  runtime.Version(),
			"goroutines":  runtime.NumGoroutine(),
			"mem_alloc_mb": memStats.Alloc / 1024 / 1024,
		},
	})
}

// ListModelProviders GET /api/providers
func (h *SystemHandler) ListModelProviders(c *fiber.Ctx) error {
	providers := []fiber.Map{
		{
			"id":          "openai",
			"name":        "OpenAI",
			"models":      []string{"gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"},
			"env_key":     "OPENAI_API_KEY",
			"description": "OpenAI GPT models",
		},
		{
			"id":          "anthropic",
			"name":        "Anthropic",
			"models":      []string{"claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"},
			"env_key":     "ANTHROPIC_API_KEY",
			"description": "Claude models by Anthropic",
		},
		{
			"id":          "dashscope",
			"name":        "DashScope (Qwen)",
			"models":      []string{"qwen-max", "qwen3-max", "qwen-turbo", "qwen-plus"},
			"env_key":     "DASHSCOPE_API_KEY",
			"description": "Alibaba Qwen models via DashScope",
		},
		{
			"id":          "gemini",
			"name":        "Google Gemini",
			"models":      []string{"gemini-2.0-flash-exp", "gemini-1.5-pro", "gemini-1.5-flash"},
			"env_key":     "GEMINI_API_KEY",
			"description": "Google Gemini models",
		},
		{
			"id":          "deepseek",
			"name":        "DeepSeek",
			"models":      []string{"deepseek-chat", "deepseek-reasoner"},
			"env_key":     "DEEPSEEK_API_KEY",
			"description": "DeepSeek models",
		},
		{
			"id":          "openrouter",
			"name":        "OpenRouter",
			"models":      []string{"meta-llama/llama-3.3-70b-instruct", "mistralai/mixtral-8x7b-instruct"},
			"env_key":     "OPENROUTER_API_KEY",
			"description": "200+ models via OpenRouter",
			"base_url":    "https://openrouter.ai/api/v1",
		},
		{
			"id":          "ollama",
			"name":        "Ollama (Local)",
			"models":      []string{"llama3.2", "mistral", "phi3", "gemma2"},
			"env_key":     "",
			"description": "Local models via Ollama",
			"base_url":    "http://localhost:11434",
		},
	}
	return c.JSON(fiber.Map{"data": providers})
}

// ListBuiltinTools GET /api/tools
func (h *SystemHandler) ListBuiltinTools(c *fiber.Ctx) error {
	tools := []fiber.Map{
		{
			"name":        "execute_python_code",
			"type":        "builtin",
			"description": "Execute Python code in a sandboxed environment",
			"tags":        []string{"code", "python"},
		},
		{
			"name":        "execute_shell_command",
			"type":        "builtin",
			"description": "Execute shell commands",
			"tags":        []string{"shell", "system"},
		},
		{
			"name":        "view_text_file",
			"type":        "builtin",
			"description": "Read and view text files from the filesystem",
			"tags":        []string{"file", "read"},
		},
		{
			"name":        "write_text_file",
			"type":        "builtin",
			"description": "Write content to text files",
			"tags":        []string{"file", "write"},
		},
		{
			"name":        "insert_text_file",
			"type":        "builtin",
			"description": "Insert text into a file at a specific line",
			"tags":        []string{"file", "edit"},
		},
		{
			"name":        "image_to_text",
			"type":        "builtin",
			"description": "Convert images to text descriptions using vision models",
			"tags":        []string{"multimodal", "vision"},
		},
		{
			"name":        "text_to_image",
			"type":        "builtin",
			"description": "Generate images from text descriptions",
			"tags":        []string{"multimodal", "generation"},
		},
		{
			"name":        "audio_to_text",
			"type":        "builtin",
			"description": "Transcribe audio to text",
			"tags":        []string{"multimodal", "audio"},
		},
		{
			"name":        "web_search",
			"type":        "builtin",
			"description": "Search the web for information",
			"tags":        []string{"web", "search"},
		},
	}
	return c.JSON(fiber.Map{"data": tools})
}
