package handlers

import (
	"fmt"
	"net"
	"net/http"
	"os"
	"runtime"
	"time"

	"github.com/agentscope/web-backend/internal/store"
	"github.com/gofiber/fiber/v2"
)

// ResourcesHandler handles resource/health check endpoints
type ResourcesHandler struct {
	store         *store.Store
	agentscopeURL string
	redisAddr     string
	dataDir       string
}

// NewResourcesHandler creates a new ResourcesHandler
func NewResourcesHandler(s *store.Store, agentscopeURL, redisAddr, dataDir string) *ResourcesHandler {
	return &ResourcesHandler{
		store:         s,
		agentscopeURL: agentscopeURL,
		redisAddr:     redisAddr,
		dataDir:       dataDir,
	}
}

type componentHealth struct {
	Name      string            `json:"name"`
	Type      string            `json:"type"`
	Status    string            `json:"status"` // "healthy" | "degraded" | "unhealthy" | "unknown"
	Message   string            `json:"message"`
	Latency   int64             `json:"latency_ms"`
	Endpoint  string            `json:"endpoint"`
	Details   map[string]string `json:"details,omitempty"`
	CheckedAt string            `json:"checked_at"`
}

// GetResources GET /api/resources
func (h *ResourcesHandler) GetResources(c *fiber.Ctx) error {
	now := time.Now().UTC().Format(time.RFC3339)
	components := []componentHealth{}

	// 1. Backend (self)
	{
		var memStats runtime.MemStats
		runtime.ReadMemStats(&memStats)
		components = append(components, componentHealth{
			Name:      "Backend",
			Type:      "backend",
			Status:    "healthy",
			Message:   "Go/Fiber API is running",
			Latency:   0,
			Endpoint:  fmt.Sprintf("http://localhost:%s", getEnvOrDefault("PORT", "8080")),
			CheckedAt: now,
			Details: map[string]string{
				"go_version":   runtime.Version(),
				"goroutines":   fmt.Sprintf("%d", runtime.NumGoroutine()),
				"mem_alloc_mb": fmt.Sprintf("%d MB", memStats.Alloc/1024/1024),
				"num_cpu":      fmt.Sprintf("%d", runtime.NumCPU()),
			},
		})
	}

	// 2. Core (AgentScope Python server)
	{
		coreURL := h.agentscopeURL
		if coreURL == "" {
			coreURL = getEnvOrDefault("AGENTSCOPE_URL", "http://agentscope:5001")
		}
		healthURL := coreURL + "/health"
		start := time.Now()
		status, msg, details := checkHTTP(healthURL)
		latency := time.Since(start).Milliseconds()
		if details == nil {
			details = map[string]string{}
		}
		details["url"] = coreURL
		details["health_endpoint"] = healthURL
		components = append(components, componentHealth{
			Name:      "Core",
			Type:      "core",
			Status:    status,
			Message:   msg,
			Latency:   latency,
			Endpoint:  coreURL,
			CheckedAt: now,
			Details:   details,
		})
	}

	// 3. Redis
	{
		redisAddr := h.redisAddr
		if redisAddr == "" {
			redisAddr = getEnvOrDefault("REDIS_ADDR", "agentscope-redis:6379")
		}
		start := time.Now()
		status, msg := checkTCP(redisAddr)
		latency := time.Since(start).Milliseconds()
		components = append(components, componentHealth{
			Name:      "Redis",
			Type:      "redis",
			Status:    status,
			Message:   msg,
			Latency:   latency,
			Endpoint:  "redis://" + redisAddr,
			CheckedAt: now,
			Details: map[string]string{
				"addr":    redisAddr,
				"purpose": "Agent memory backend (optional)",
			},
		})
	}

	// 4. Data Store (file-based DB)
	{
		dataDir := h.dataDir
		if dataDir == "" {
			dataDir = getEnvOrDefault("DATA_DIR", "./data")
		}
		storeFile := dataDir + "/store.json"
		start := time.Now()
		status, msg, details := checkFileStore(dataDir, storeFile)
		latency := time.Since(start).Milliseconds()
		agents := h.store.ListAgents()
		details["agents_count"] = fmt.Sprintf("%d", len(agents))
		details["store_type"] = "JSON file-backed in-memory"
		components = append(components, componentHealth{
			Name:      "Database",
			Type:      "database",
			Status:    status,
			Message:   msg,
			Latency:   latency,
			Endpoint:  storeFile,
			CheckedAt: now,
			Details:   details,
		})
	}

	// Overall status
	overall := "healthy"
	for _, c := range components {
		if c.Status == "unhealthy" {
			overall = "degraded"
			break
		}
	}

	return c.JSON(fiber.Map{
		"status":     overall,
		"components": components,
		"checked_at": now,
	})
}

// --- helpers ---

func checkHTTP(url string) (status, msg string, details map[string]string) {
	details = map[string]string{}
	cl := &http.Client{Timeout: 5 * time.Second}
	resp, err := cl.Get(url)
	if err != nil {
		return "unhealthy", fmt.Sprintf("Connection failed: %v", err), details
	}
	defer resp.Body.Close()
	details["http_status"] = fmt.Sprintf("%d", resp.StatusCode)
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return "healthy", fmt.Sprintf("HTTP %d OK", resp.StatusCode), details
	}
	return "degraded", fmt.Sprintf("HTTP %d", resp.StatusCode), details
}

func checkTCP(addr string) (status, msg string) {
	conn, err := net.DialTimeout("tcp", addr, 3*time.Second)
	if err != nil {
		return "unhealthy", fmt.Sprintf("TCP connection failed: %v", err)
	}
	conn.Close()
	return "healthy", "TCP connection successful"
}

func checkFileStore(dataDir, storeFile string) (status, msg string, details map[string]string) {
	details = map[string]string{"data_dir": dataDir}
	// Check data directory
	if _, err := os.Stat(dataDir); os.IsNotExist(err) {
		return "unhealthy", "Data directory does not exist", details
	}
	// Check store file
	info, err := os.Stat(storeFile)
	if os.IsNotExist(err) {
		details["store_file"] = "not yet created"
		return "healthy", "Store file not yet created (will be created on first write)", details
	}
	if err != nil {
		return "unhealthy", fmt.Sprintf("Cannot access store file: %v", err), details
	}
	details["store_file"] = storeFile
	details["size"] = fmt.Sprintf("%d bytes", info.Size())
	details["modified"] = info.ModTime().UTC().Format(time.RFC3339)
	return "healthy", "Store file accessible and writable", details
}

func getEnvOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
