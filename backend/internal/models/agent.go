package models

import "time"

// AgentType represents the type of agent
type AgentType string

const (
	AgentTypeReAct    AgentType = "ReActAgent"
	AgentTypeUser     AgentType = "UserAgent"
	AgentTypeRealtime AgentType = "RealtimeAgent"
	AgentTypeA2A      AgentType = "A2AAgent"
)

// ModelProvider represents supported LLM providers
type ModelProvider string

const (
	ProviderOpenAI     ModelProvider = "openai"
	ProviderAnthropic  ModelProvider = "anthropic"
	ProviderDashScope  ModelProvider = "dashscope"
	ProviderGemini     ModelProvider = "gemini"
	ProviderDeepSeek   ModelProvider = "deepseek"
	ProviderOllama     ModelProvider = "ollama"
	ProviderOpenRouter ModelProvider = "openrouter"
)

// MemoryType represents memory backend types
type MemoryType string

const (
	MemoryInMemory MemoryType = "in_memory"
	MemoryRedis    MemoryType = "redis"
	MemorySQL      MemoryType = "sql"
)

// AgentStatus represents the current status of an agent
type AgentStatus string

const (
	AgentStatusStopped AgentStatus = "stopped"
	AgentStatusRunning AgentStatus = "running"
	AgentStatusError   AgentStatus = "error"
)

// ModelConfig holds the configuration for a model
type ModelConfig struct {
	Provider  ModelProvider `json:"provider"`
	ModelName string        `json:"model_name"`
	APIKey    string        `json:"api_key,omitempty"`
	BaseURL   string        `json:"base_url,omitempty"`
	Stream    bool          `json:"stream"`
	MaxTokens int           `json:"max_tokens,omitempty"`
	Temp      float64       `json:"temperature,omitempty"`
}

// ToolConfig holds tool configuration for an agent
type ToolConfig struct {
	Name        string   `json:"name"`
	Type        string   `json:"type"` // "builtin" | "mcp" | "custom"
	Description string   `json:"description"`
	Enabled     bool     `json:"enabled"`
	Config      any      `json:"config,omitempty"`
	Tags        []string `json:"tags,omitempty"`
}

// MemoryConfig holds memory backend configuration
type MemoryConfig struct {
	Type     MemoryType `json:"type"`
	RedisURL string     `json:"redis_url,omitempty"`
	SQLDSN   string     `json:"sql_dsn,omitempty"`
	MaxItems int        `json:"max_items,omitempty"`
}

// Agent represents an AgentScope agent definition
type Agent struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	Description string        `json:"description"`
	Type        AgentType     `json:"type"`
	SysPrompt   string        `json:"sys_prompt"`
	Model       ModelConfig   `json:"model"`
	Tools       []ToolConfig  `json:"tools"`
	Memory      MemoryConfig  `json:"memory"`
	Status      AgentStatus   `json:"status"`
	Tags        []string      `json:"tags"`
	CreatedAt   time.Time     `json:"created_at"`
	UpdatedAt   time.Time     `json:"updated_at"`
}

// CreateAgentRequest is the request body for creating an agent
type CreateAgentRequest struct {
	Name        string       `json:"name" validate:"required,min=1,max=100"`
	Description string       `json:"description"`
	Type        AgentType    `json:"type" validate:"required"`
	SysPrompt   string       `json:"sys_prompt" validate:"required"`
	Model       ModelConfig  `json:"model" validate:"required"`
	Tools       []ToolConfig `json:"tools"`
	Memory      MemoryConfig `json:"memory"`
	Tags        []string     `json:"tags"`
}

// UpdateAgentRequest is the request body for updating an agent
type UpdateAgentRequest struct {
	Name        *string      `json:"name,omitempty"`
	Description *string      `json:"description,omitempty"`
	SysPrompt   *string      `json:"sys_prompt,omitempty"`
	Model       *ModelConfig `json:"model,omitempty"`
	Tools       []ToolConfig `json:"tools,omitempty"`
	Memory      *MemoryConfig `json:"memory,omitempty"`
	Tags        []string     `json:"tags,omitempty"`
}
