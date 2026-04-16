package store

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/agentscope/web-backend/internal/models"
	"github.com/google/uuid"
)

// Store is an in-memory + file-backed store for agents and sessions
type Store struct {
	mu       sync.RWMutex
	agents   map[string]*models.Agent
	sessions map[string]*models.Session
	logs     map[string][]*models.AgentLog
	dataDir  string
}

// New creates a new Store with the given data directory
func New(dataDir string) (*Store, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}

	s := &Store{
		agents:   make(map[string]*models.Agent),
		sessions: make(map[string]*models.Session),
		logs:     make(map[string][]*models.AgentLog),
		dataDir:  dataDir,
	}

	if err := s.load(); err != nil {
		return nil, err
	}

	return s, nil
}

// ---------- Agent CRUD ----------

func (s *Store) ListAgents() []*models.Agent {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*models.Agent, 0, len(s.agents))
	for _, a := range s.agents {
		out = append(out, a)
	}
	return out
}

func (s *Store) GetAgent(id string) (*models.Agent, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	a, ok := s.agents[id]
	if !ok {
		return nil, fmt.Errorf("agent %q not found", id)
	}
	return a, nil
}

func (s *Store) CreateAgent(req *models.CreateAgentRequest) (*models.Agent, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	a := &models.Agent{
		ID:          uuid.NewString(),
		Name:        req.Name,
		Description: req.Description,
		Type:        req.Type,
		SysPrompt:   req.SysPrompt,
		Model:       req.Model,
		Tools:       req.Tools,
		Memory:      req.Memory,
		Tags:        req.Tags,
		Status:      models.AgentStatusStopped,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	if a.Tools == nil {
		a.Tools = []models.ToolConfig{}
	}
	if a.Tags == nil {
		a.Tags = []string{}
	}

	s.agents[a.ID] = a
	return a, s.persist()
}

func (s *Store) UpdateAgent(id string, req *models.UpdateAgentRequest) (*models.Agent, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	a, ok := s.agents[id]
	if !ok {
		return nil, fmt.Errorf("agent %q not found", id)
	}

	if req.Name != nil {
		a.Name = *req.Name
	}
	if req.Description != nil {
		a.Description = *req.Description
	}
	if req.SysPrompt != nil {
		a.SysPrompt = *req.SysPrompt
	}
	if req.Model != nil {
		a.Model = *req.Model
	}
	if req.Tools != nil {
		a.Tools = req.Tools
	}
	if req.Memory != nil {
		a.Memory = *req.Memory
	}
	if req.Tags != nil {
		a.Tags = req.Tags
	}
	a.UpdatedAt = time.Now()

	return a, s.persist()
}

func (s *Store) DeleteAgent(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.agents[id]; !ok {
		return fmt.Errorf("agent %q not found", id)
	}
	delete(s.agents, id)
	return s.persist()
}

func (s *Store) SetAgentStatus(id string, status models.AgentStatus) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	a, ok := s.agents[id]
	if !ok {
		return fmt.Errorf("agent %q not found", id)
	}
	a.Status = status
	a.UpdatedAt = time.Now()
	return s.persist()
}

// ---------- Session CRUD ----------

func (s *Store) ListSessions(agentID string) []*models.Session {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var out []*models.Session
	for _, sess := range s.sessions {
		if sess.AgentID == agentID {
			out = append(out, sess)
		}
	}
	return out
}

func (s *Store) GetSession(id string) (*models.Session, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	sess, ok := s.sessions[id]
	if !ok {
		return nil, fmt.Errorf("session %q not found", id)
	}
	return sess, nil
}

func (s *Store) CreateSession(agentID, userID string) (*models.Session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	sess := &models.Session{
		ID:        uuid.NewString(),
		AgentID:   agentID,
		UserID:    userID,
		Status:    models.SessionStatusActive,
		Messages:  []models.ChatMessage{},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	s.sessions[sess.ID] = sess
	return sess, s.persist()
}

func (s *Store) AddMessage(sessionID string, msg models.ChatMessage) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	sess, ok := s.sessions[sessionID]
	if !ok {
		return fmt.Errorf("session %q not found", sessionID)
	}
	msg.ID = uuid.NewString()
	msg.Timestamp = time.Now()
	sess.Messages = append(sess.Messages, msg)
	sess.UpdatedAt = time.Now()
	return s.persist()
}

func (s *Store) DeleteSession(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.sessions[id]; !ok {
		return fmt.Errorf("session %q not found", id)
	}
	delete(s.sessions, id)
	return s.persist()
}

// ---------- Logs ----------

func (s *Store) AddLog(agentID, sessionID, level, message string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	log := &models.AgentLog{
		ID:        uuid.NewString(),
		AgentID:   agentID,
		SessionID: sessionID,
		Level:     level,
		Message:   message,
		Timestamp: time.Now(),
	}
	s.logs[agentID] = append(s.logs[agentID], log)
	// Keep last 500 logs per agent
	if len(s.logs[agentID]) > 500 {
		s.logs[agentID] = s.logs[agentID][len(s.logs[agentID])-500:]
	}
}

func (s *Store) GetLogs(agentID string) []*models.AgentLog {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.logs[agentID]
}

// ---------- Stats ----------

func (s *Store) GetStats(agentID string) *models.AgentStats {
	s.mu.RLock()
	defer s.mu.RUnlock()

	stats := &models.AgentStats{
		AgentID: agentID,
	}
	for _, sess := range s.sessions {
		if sess.AgentID != agentID {
			continue
		}
		stats.TotalSessions++
		stats.TotalMessages += len(sess.Messages)
		if sess.Status == models.SessionStatusActive {
			stats.ActiveSessions++
		}
		if sess.UpdatedAt.After(stats.LastActiveAt) {
			stats.LastActiveAt = sess.UpdatedAt
		}
	}
	return stats
}

// ---------- Persistence ----------

type persistData struct {
	Agents   map[string]*models.Agent   `json:"agents"`
	Sessions map[string]*models.Session `json:"sessions"`
}

func (s *Store) persist() error {
	data := persistData{
		Agents:   s.agents,
		Sessions: s.sessions,
	}
	b, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(s.dataDir, "store.json"), b, 0644)
}

func (s *Store) load() error {
	path := filepath.Join(s.dataDir, "store.json")
	b, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	var data persistData
	if err := json.Unmarshal(b, &data); err != nil {
		return err
	}
	if data.Agents != nil {
		s.agents = data.Agents
	}
	if data.Sessions != nil {
		s.sessions = data.Sessions
	}
	return nil
}
