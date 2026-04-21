export type AgentType = 'priva-agent-react' | 'priva-agent-user' | 'priva-agent-realtime' | 'priva-agent-a2a'
export type AgentStatus = 'stopped' | 'running' | 'error'
export type ModelProvider = 'openai' | 'anthropic' | 'dashscope' | 'gemini' | 'deepseek' | 'ollama' | 'openrouter'
export type MemoryType = 'in_memory' | 'redis' | 'sql'

export interface ModelConfig {
  provider: ModelProvider
  model_name: string
  api_key?: string
  base_url?: string
  stream: boolean
  max_tokens?: number
  temperature?: number
}

export interface ToolConfig {
  name: string
  type: 'builtin' | 'mcp' | 'custom'
  description: string
  enabled: boolean
  config?: unknown
  tags?: string[]
}

export interface MemoryConfig {
  type: MemoryType
  redis_url?: string
  sql_dsn?: string
  max_items?: number
}

export interface Agent {
  id: string
  name: string
  description: string
  type: AgentType
  sys_prompt: string
  model: ModelConfig
  tools: ToolConfig[]
  memory: MemoryConfig
  status: AgentStatus
  tags: string[]
  created_at: string
  updated_at: string
}

export interface CreateAgentRequest {
  name: string
  description: string
  type: AgentType
  sys_prompt: string
  model: ModelConfig
  tools: ToolConfig[]
  memory: MemoryConfig
  tags: string[]
}

export interface UpdateAgentRequest {
  name?: string
  description?: string
  sys_prompt?: string
  model?: ModelConfig
  tools?: ToolConfig[]
  memory?: MemoryConfig
  tags?: string[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  name: string
  content: string
  timestamp: string
  metadata?: unknown
}

export interface Session {
  id: string
  agent_id: string
  user_id: string
  status: 'active' | 'inactive'
  messages: ChatMessage[]
  created_at: string
  updated_at: string
}

export interface AgentStats {
  agent_id: string
  total_sessions: number
  active_sessions: number
  total_messages: number
  avg_response_ms: number
  last_active_at: string
}

export interface AgentLog {
  id: string
  agent_id: string
  session_id: string
  level: 'info' | 'warning' | 'error'
  message: string
  timestamp: string
}

export interface ModelProvider_Info {
  id: string
  name: string
  models: string[]
  env_key: string
  description: string
  base_url?: string
}

export interface ToolParam {
  name: string
  label: string
  required: boolean
  placeholder?: string
}

export interface BuiltinTool {
  name: string
  type: string
  description: string
  tags: string[]
  params?: ToolParam[]
}

export interface Overview {
  agents: {
    total: number
    running: number
    stopped: number
    errored: number
  }
  system: {
    go_version: string
    goroutines: number
    mem_alloc_mb: number
  }
}

export type ComponentStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown'

export interface ComponentHealth {
  name: string
  type: 'backend' | 'core' | 'redis' | 'database'
  status: ComponentStatus
  message: string
  latency_ms: number
  endpoint: string
  details?: Record<string, string>
  checked_at: string
}

export interface ResourcesResponse {
  status: ComponentStatus
  components: ComponentHealth[]
  checked_at: string
}
