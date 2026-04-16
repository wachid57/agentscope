package main

import (
	"log"
	"os"

	"github.com/agentscope/web-backend/internal/handlers"
	"github.com/agentscope/web-backend/internal/store"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

func main() {
	// Config from env
	port := getEnv("PORT", "8080")
	dataDir := getEnv("DATA_DIR", "./data")
	agentscopeURL := getEnv("AGENTSCOPE_URL", "") // e.g. http://agentscope:5000

	// Init store
	s, err := store.New(dataDir)
	if err != nil {
		log.Fatalf("failed to init store: %v", err)
	}

	// Init Fiber app
	app := fiber.New(fiber.Config{
		AppName:      "AgentScope Manager API",
		ReadTimeout:  0, // no timeout for SSE streaming
		WriteTimeout: 0,
	})

	// Middleware
	app.Use(recover.New())
	app.Use(logger.New(logger.Config{
		Format: "[${time}] ${status} ${method} ${path} (${latency})\n",
	}))
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "*",
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization",
		AllowCredentials: false,
	}))

	// Handlers
	agentH := handlers.NewAgentHandler(s)
	sessionH := handlers.NewSessionHandler(s, agentscopeURL)
	systemH := handlers.NewSystemHandler(s)

	// Routes
	app.Get("/health", systemH.Health)

	api := app.Group("/api")

	// System
	api.Get("/overview", systemH.Overview)
	api.Get("/providers", systemH.ListModelProviders)
	api.Get("/tools", systemH.ListBuiltinTools)

	// Agents
	agents := api.Group("/agents")
	agents.Get("/", agentH.ListAgents)
	agents.Post("/", agentH.CreateAgent)
	agents.Get("/:id", agentH.GetAgent)
	agents.Put("/:id", agentH.UpdateAgent)
	agents.Delete("/:id", agentH.DeleteAgent)
	agents.Post("/:id/start", agentH.StartAgent)
	agents.Post("/:id/stop", agentH.StopAgent)
	agents.Post("/:id/duplicate", agentH.DuplicateAgent)
	agents.Get("/:id/stats", agentH.GetAgentStats)
	agents.Get("/:id/logs", agentH.GetAgentLogs)

	// Sessions
	agents.Get("/:id/sessions", sessionH.ListSessions)
	agents.Post("/:id/sessions", sessionH.CreateSession)
	agents.Post("/:id/chat", sessionH.Chat)

	sessions := api.Group("/sessions")
	sessions.Get("/:session_id", sessionH.GetSession)
	sessions.Delete("/:session_id", sessionH.DeleteSession)

	log.Printf("AgentScope Manager API starting on :%s", port)
	if err := app.Listen(":" + port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
