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

// POST /api/settings/test-invoice
func (h *SettingsHandler) TestInvoice(c *fiber.Ctx) error {
	settings, err := db.GetAllSettings()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"ok": false, "message": "failed to load settings"})
	}

	baseURL := strings.TrimRight(settings["invoice_base_url"], "/")
	apiKey := settings["invoice_api_key"]

	if baseURL == "" {
		return c.Status(400).JSON(fiber.Map{"ok": false, "message": "Invoice Base URL belum dikonfigurasi"})
	}

	client := &http.Client{Timeout: 8 * time.Second}
	req, err := http.NewRequest("GET", fmt.Sprintf("%s/api/v1.0/invoices", baseURL), nil)
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

	if resp.StatusCode == http.StatusUnauthorized {
		return c.JSON(fiber.Map{"ok": false, "message": "Unauthorized — API Key salah atau tidak valid"})
	}
	if resp.StatusCode >= 500 {
		return c.JSON(fiber.Map{"ok": false, "message": fmt.Sprintf("HTTP %d dari Invoice server", resp.StatusCode)})
	}

	return c.JSON(fiber.Map{"ok": true, "message": "Terhubung ke priva-invoice ✓"})
}

// POST /api/settings/test-scheduler/:id
// Toggle scheduler on→off dari server side untuk trigger sekali jalan
func (h *SettingsHandler) TestScheduler(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return c.Status(400).JSON(fiber.Map{"ok": false, "message": "scheduler id required"})
	}

	settings, err := db.GetAllSettings()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"ok": false, "message": "failed to load settings"})
	}

	baseURL := strings.TrimRight(settings["gws_base_url"], "/")
	apiKey := settings["gws_api_key"]
	if baseURL == "" {
		return c.Status(400).JSON(fiber.Map{"ok": false, "message": "GWS Base URL belum dikonfigurasi"})
	}

	httpClient := &http.Client{Timeout: 10 * time.Second}

	doToggle := func() (map[string]interface{}, error) {
		req, err := http.NewRequest("POST", fmt.Sprintf("%s/api/v1.0/schedulers/%s/toggle", baseURL, id), nil)
		if err != nil {
			return nil, err
		}
		if apiKey != "" {
			req.Header.Set("Authorization", "Bearer "+apiKey)
		}
		resp, err := httpClient.Do(req)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		var result map[string]interface{}
		json.Unmarshal(body, &result)
		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
		}
		return result, nil
	}

	// Toggle on
	res1, err := doToggle()
	if err != nil {
		return c.JSON(fiber.Map{"ok": false, "message": "Gagal toggle ON: " + err.Error()})
	}

	// Cek apakah sekarang aktif, kalau tidak toggle lagi
	isActive := false
	if data, ok := res1["data"].(map[string]interface{}); ok {
		isActive, _ = data["is_active"].(bool)
	}
	status := "active"
	if !isActive {
		status = "inactive"
	}

	return c.JSON(fiber.Map{
		"ok":        true,
		"message":   fmt.Sprintf("Scheduler berhasil di-trigger (status: %s)", status),
		"is_active": isActive,
	})
}
