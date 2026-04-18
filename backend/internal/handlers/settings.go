package handlers

import (
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
