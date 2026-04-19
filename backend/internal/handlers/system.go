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
			"models":      []string{"qwen3.5-max", "qwen3.5-plus", "qwen3.5-turbo", "qwen-max", "qwen-turbo"},
			"env_key":     "DASHSCOPE_API_KEY",
			"description": "Alibaba Qwen models via DashScope",
		},
		{
			"id":          "gemini",
			"name":        "Google Gemini",
			"models":      []string{"gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"},
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
					// ── Anthropic Claude (paid, reliable)
					"anthropic/claude-opus-4.7",           // ✅ Tested working
					"anthropic/claude-opus-4-6",           // ✅ Should work (same series)
					"anthropic/claude-sonnet-4-6",         // ✅ Should work
					"anthropic/claude-haiku-4-5-20251001", // ✅ Should work
					// ── OpenAI (paid)
					"openai/gpt-4o",         // ✅ Should work
					"openai/gpt-4-turbo",    // ✅ Should work
					"openai/gpt-4",          // ✅ Should work
					"openai/gpt-4o-mini",    // ✅ Should work (cheaper)
					// ── Google Gemini (paid)
					"google/gemini-2.0-flash-exp", // ✅ Should work
					"google/gemini-1.5-pro",       // ✅ Should work
					"google/gemini-1.5-flash",     // ✅ Should work
					// ── Alibaba Qwen (free & paid)
					"qwen/qwen3-coder:free",    // ✅ TESTED WORKING (rate-limit sometimes)
					"qwen/qwen3-6-plus",        // ✅ Paid, should work
					"qwen/qwen3-5-122b-a10b",   // ✅ Paid, should work
					// ── NVIDIA Nemotron (free)
					"nvidia/nemotron-3-super-120b-a12b:free", // ✅ TESTED WORKING
					"nvidia/nemotron-3-nano-30b-a3b:free",    // ✅ Free, reliable
					"nvidia/nemotron-nano-9b-v2:free",        // ✅ Free, reliable
					// ── Mistral (paid)
					"mistralai/mistral-large-2411", // ✅ Should work
					"mistralai/mistral-small-2603", // ✅ Should work (cheaper)
					// ── Other Free Models
					"z-ai/glm-4.5-air:free",           // ⏸️ May have rate-limit
					"arcee-ai/trinity-large-preview:free", // ⏸️ May have rate-limit
					"minimax/minimax-m2.5:free",      // ⏸️ May have rate-limit
					"liquid/lfm-2.5-1.2b-instruct:free", // ⏸️ May have rate-limit
					// ── DeepSeek (paid)
					"deepseek/deepseek-chat", // ✅ Should work
					// ── xAI Grok (paid)
					"x-ai/grok-3", // ✅ Should work
					// ── Cohere (paid)
					"cohere/command-r-plus", // ✅ Should work
					// ── Others (paid)
					"01-ai/yi-large-turbo", // ✅ Should work
				},
			"env_key":     "OPENROUTER_API_KEY",
			"description": "200+ models via OpenRouter (✅=tested/expected working, ⏸️=free/may rate-limit)",
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
			"params": []fiber.Map{
				{"name": "spreadsheet_id", "label": "Google Sheet ID", "required": true, "placeholder": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"},
			},
		},
		{
			"name":        "read_gws_sheet",
			"type":        "builtin",
			"description": "Baca data invoice dari Google Sheets melalui priva-gws MCP",
			"tags":        []string{"invoice", "google-sheets", "gws"},
			"params": []fiber.Map{
				{"name": "spreadsheet_id", "label": "Google Sheet ID", "required": true, "placeholder": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"},
				{"name": "range_", "label": "Range (opsional)", "required": false, "placeholder": "Sheet1!A1:Z1000"},
			},
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
			"description": "Kirim pesan ke Telegram melalui priva-telegram (autentikasi API key)",
			"tags":        []string{"invoice", "telegram", "notification"},
			"params": []fiber.Map{
				{"name": "telegram_api_key", "label": "API Key (X-API-KEY)", "required": true, "placeholder": "your-api-key"},
				{"name": "chat_id", "label": "Default Chat ID", "required": false, "placeholder": "123456789"},
				{"name": "telegram_api_url", "label": "Telegram API URL", "required": false, "placeholder": "http://172.22.0.1:8080"},
			},
		},
		{
			"name":        "send_telegram_file",
			"type":        "builtin",
			"description": "Kirim file/dokumen (PDF, dll) ke Telegram melalui priva-telegram",
			"tags":        []string{"invoice", "telegram", "file"},
			"params": []fiber.Map{
				{"name": "telegram_api_key", "label": "API Key (X-API-KEY)", "required": true, "placeholder": "your-api-key"},
				{"name": "chat_id", "label": "Default Chat ID", "required": false, "placeholder": "123456789"},
				{"name": "telegram_api_url", "label": "Telegram API URL", "required": false, "placeholder": "http://172.22.0.1:8080"},
			},
		},
	}
	return c.JSON(fiber.Map{"data": tools})
}
