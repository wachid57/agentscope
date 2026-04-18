package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/agentscope/web-backend/internal/db"
	"github.com/gofiber/fiber/v2"
)

type SettingsHandler struct{}

func NewSettingsHandler() *SettingsHandler { return &SettingsHandler{} }

// GET /api/settings
func (h *SettingsHandler) GetSettings(c *fiber.Ctx) error {
	settings, err := db.GetAllSettings()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to load settings"})
	}
	return c.JSON(fiber.Map{"data": settings})
}

// PUT /api/settings
func (h *SettingsHandler) UpdateSettings(c *fiber.Ctx) error {
	var body map[string]string
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}

	for key, value := range body {
		if err := db.SetSetting(key, value); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "failed to save setting: " + key})
		}
	}

	settings, _ := db.GetAllSettings()
	return c.JSON(fiber.Map{"data": settings})
}

// POST /api/settings/test-gws
// Test koneksi ke priva-gws dari server side (tidak kena CORS/PNA browser)
func (h *SettingsHandler) TestGWS(c *fiber.Ctx) error {
	settings, err := db.GetAllSettings()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"ok": false, "message": "failed to load settings"})
	}

	baseURL := strings.TrimRight(settings["gws_base_url"], "/")
	apiKey := settings["gws_api_key"]

	if baseURL == "" {
		return c.Status(400).JSON(fiber.Map{"ok": false, "message": "GWS Base URL belum dikonfigurasi"})
	}

	client := &http.Client{Timeout: 8 * time.Second}
	req, err := http.NewRequest("GET", fmt.Sprintf("%s/api/v1.0/schedulers", baseURL), nil)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"ok": false, "message": "invalid URL: " + err.Error()})
	}
	req.Header.Set("Content-Type", "application/json")
	if apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}

	resp, err := client.Do(req)
	if err != nil {
		return c.JSON(fiber.Map{"ok": false, "message": "Tidak dapat terhubung: " + err.Error()})
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)

	if resp.StatusCode == http.StatusUnauthorized {
		return c.JSON(fiber.Map{"ok": false, "message": "Unauthorized — API Key salah atau tidak valid"})
	}
	if resp.StatusCode != http.StatusOK {
		return c.JSON(fiber.Map{"ok": false, "message": fmt.Sprintf("HTTP %d dari GWS server", resp.StatusCode)})
	}

	var gwsResp struct {
		Data []json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(bodyBytes, &gwsResp); err != nil {
		return c.JSON(fiber.Map{"ok": false, "message": "Response tidak valid dari GWS"})
	}

	return c.JSON(fiber.Map{
		"ok":      true,
		"message": fmt.Sprintf("Terhubung — %d scheduler ditemukan", len(gwsResp.Data)),
	})
}
