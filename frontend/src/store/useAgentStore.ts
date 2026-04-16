import { create } from 'zustand'
import type { Agent } from '../types'

interface AgentStore {
  selectedAgentId: string | null
  setSelectedAgent: (id: string | null) => void
  agentCache: Record<string, Agent>
  setAgentCache: (agents: Agent[]) => void
  updateAgentInCache: (agent: Agent) => void
  removeFromCache: (id: string) => void
}

export const useAgentStore = create<AgentStore>((set) => ({
  selectedAgentId: null,
  setSelectedAgent: (id) => set({ selectedAgentId: id }),
  agentCache: {},
  setAgentCache: (agents) =>
    set({ agentCache: Object.fromEntries(agents.map((a) => [a.id, a])) }),
  updateAgentInCache: (agent) =>
    set((state) => ({ agentCache: { ...state.agentCache, [agent.id]: agent } })),
  removeFromCache: (id) =>
    set((state) => {
      const cache = { ...state.agentCache }
      delete cache[id]
      return { agentCache: cache }
    }),
}))
