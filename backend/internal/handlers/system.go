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
			"models": []string{
					// ── Anthropic
					"anthropic/claude-opus-4-7",
					"anthropic/claude-opus-4-6",
					"anthropic/claude-opus-4-6-fast",
					"anthropic/claude-sonnet-4-6",
					// ── OpenAI
					"openai/gpt-5-4-pro",
					"openai/gpt-5-4",
					"openai/gpt-5-4-mini",
					"openai/gpt-5-4-nano",
					"openai/gpt-oss-120b:free",
					"openai/gpt-oss-20b:free",
					// ── Google
					"google/gemini-3-1-pro-preview",
					"google/gemini-3-1-flash-lite-preview",
					"google/gemini-3-flash-preview",
					"google/gemma-4-31b-it:free",
					"google/gemma-4-26b-a4b-it:free",
					"google/gemma-3-27b-it:free",
					"google/gemma-3-12b-it:free",
					"google/gemma-3-4b-it:free",
					"google/gemma-3n-e4b-it:free",
					"google/gemma-3n-e2b-it:free",
					// ── Meta Llama
					"meta-llama/llama-3.3-70b-instruct:free",
					"meta-llama/llama-3.2-3b-instruct:free",
					// ── Qwen
					"qwen/qwen3-6-plus",
					"qwen/qwen3-5-122b-a10b",
					"qwen/qwen3-5-35b-a3b",
					"qwen/qwen3-5-27b",
					"qwen/qwen3-coder:free",
					"qwen/qwen3-next-80b-a3b-instruct:free",
					// ── Mistral
					"mistralai/mistral-small-2603",
					"mistralai/devstral-2512",
					// ── xAI
					"x-ai/grok-4-20",
					// ── Nvidia
					"nvidia/nemotron-3-super-120b-a12b:free",
					"nvidia/nemotron-3-nano-30b-a3b:free",
					"nvidia/nemotron-nano-12b-v2-vl:free",
					"nvidia/nemotron-nano-9b-v2:free",
					// ── Others (free)
					"minimax/minimax-m2.5:free",
					"nousresearch/hermes-3-llama-3.1-405b:free",
					"z-ai/glm-4.5-air:free",
					"z-ai/glm-5-1",
					"z-ai/glm-5-turbo",
					"cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
					"liquid/lfm-2.5-1.2b-thinking:free",
					"liquid/lfm-2.5-1.2b-instruct:free",
					"arcee-ai/trinity-large-preview:free",
				},
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
		// ── Invoice Agent tools ───────────────────────────────────────────────
		{
			"name":        "check_sheet_changed",
			"type":        "builtin",
			"description": "Cek apakah Google Sheets berubah sejak pengecekan terakhir (via priva-gws, hemat token)",
			"tags":        []string{"invoice", "google-sheets", "scheduler"},
		},
		{
			"name":        "read_gws_sheet",
			"type":        "builtin",
			"description": "Baca data invoice dari Google Sheets melalui priva-gws MCP",
			"tags":        []string{"invoice", "google-sheets", "gws"},
		},
		{
			"name":        "read_excel_invoice",
			"type":        "builtin",
			"description": "Baca data invoice dari file Excel (.xlsx) lokal",
			"tags":        []string{"invoice", "excel", "file"},
		},
		{
			"name":        "create_invoice",
			"type":        "builtin",
			"description": "Buat invoice dan generate PDF melalui priva-invoice",
			"tags":        []string{"invoice", "pdf", "priva-invoice"},
		},
		{
			"name":        "send_telegram_message",
			"type":        "builtin",
			"description": "Kirim pesan ke Telegram melalui priva-telegram",
			"tags":        []string{"invoice", "telegram", "notification"},
		},
	}
	return c.JSON(fiber.Map{"data": tools})
}
