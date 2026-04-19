import client from './client'
import type { Agent, CreateAgentRequest, UpdateAgentRequest, AgentStats, AgentLog, Session } from '../types'

export const agentsApi = {
  list: () => client.get<{ data: Agent[]; total: number }>('/agents').then(r => r.data),

  get: (id: string) => client.get<Agent>(`/agents/${id}`).then(r => r.data),

  create: (req: CreateAgentRequest) => client.post<Agent>('/agents', req).then(r => r.data),

  update: (id: string, req: UpdateAgentRequest) =>
    client.put<Agent>(`/agents/${id}`, req).then(r => r.data),

  delete: (id: string) => client.delete(`/agents/${id}`),

  start: (id: string) => client.post<Agent>(`/agents/${id}/start`).then(r => r.data),

  stop: (id: string) => client.post<Agent>(`/agents/${id}/stop`).then(r => r.data),

  duplicate: (id: string) => client.post<Agent>(`/agents/${id}/duplicate`).then(r => r.data),

  stats: (id: string) => client.get<AgentStats>(`/agents/${id}/stats`).then(r => r.data),

  logs: (id: string) =>
    client.get<{ data: AgentLog[]; total: number }>(`/agents/${id}/logs`).then(r => r.data),

  listSessions: (id: string) =>
    client.get<{ data: Session[]; total: number }>(`/agents/${id}/sessions`).then(r => r.data),

  createSession: (id: string, userID?: string) =>
    client.post<Session>(`/agents/${id}/sessions`, { user_id: userID }).then(r => r.data),

  deleteSession: (sessionId: string) => client.delete(`/sessions/${sessionId}`),
}
