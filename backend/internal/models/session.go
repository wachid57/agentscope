package models

import "time"

// SessionStatus represents session status
type SessionStatus string

const (
	SessionStatusActive   SessionStatus = "active"
	SessionStatusInactive SessionStatus = "inactive"
)

// ChatMessage represents a single message in a session
type ChatMessage struct {
	ID        string    `json:"id"`
	Role      string    `json:"role"` // user | assistant | system
	Name      string    `json:"name"`
	Content   string    `json:"content"`
	Timestamp time.Time `json:"timestamp"`
	Metadata  any       `json:"metadata,omitempty"`
}

// Session represents a conversation session with an agent
type Session struct {
	ID        string        `json:"id"`
	AgentID   string        `json:"agent_id"`
	UserID    string        `json:"user_id"`
	Status    SessionStatus `json:"status"`
	Messages  []ChatMessage `json:"messages"`
	CreatedAt time.Time     `json:"created_at"`
	UpdatedAt time.Time     `json:"updated_at"`
}

// ChatRequest is the request for chatting with an agent
type ChatRequest struct {
	UserInput string `json:"user_input" validate:"required"`
	UserID    string `json:"user_id"`
	SessionID string `json:"session_id"`
}

// ChatResponse wraps streaming chunk data
type ChatResponse struct {
	SessionID string      `json:"session_id"`
	Message   ChatMessage `json:"message"`
	Done      bool        `json:"done"`
	Error     string      `json:"error,omitempty"`
}

// AgentLog represents a log entry from agent execution
type AgentLog struct {
	ID        string    `json:"id"`
	AgentID   string    `json:"agent_id"`
	SessionID string    `json:"session_id"`
	Level     string    `json:"level"` // info | warning | error
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
}

// AgentStats represents statistics for an agent
type AgentStats struct {
	AgentID        string    `json:"agent_id"`
	TotalSessions  int       `json:"total_sessions"`
	ActiveSessions int       `json:"active_sessions"`
	TotalMessages  int       `json:"total_messages"`
	AvgResponseMs  float64   `json:"avg_response_ms"`
	LastActiveAt   time.Time `json:"last_active_at"`
}
