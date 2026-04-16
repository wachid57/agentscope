import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, Bot } from 'lucide-react'
import AgentCard from '../components/AgentCard'
import AgentFormModal from '../components/AgentFormModal'
import { agentsApi } from '../api/agents'
import type { AgentStatus } from '../types'

const STATUS_FILTERS: { label: string; value: AgentStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Running', value: 'running' },
  { label: 'Stopped', value: 'stopped' },
  { label: 'Error', value: 'error' },
]

export default function AgentsPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<AgentStatus | 'all'>('all')

  const { data, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: agentsApi.list,
    refetchInterval: 10_000,
  })

  const agents = (data?.data ?? []).filter(a => {
    const matchSearch =
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.description?.toLowerCase().includes(search.toLowerCase()) ||
      a.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
    const matchStatus = statusFilter === 'all' || a.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Agents</h1>
          <p className="text-slate-500 mt-1">
            {data?.total ?? 0} agents total
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} />
          New Agent
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="input pl-9"
            placeholder="Search agents..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition ${
                statusFilter === f.value
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Agent Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card animate-pulse h-52 bg-slate-800" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-4">
            <Bot size={28} className="text-slate-600" />
          </div>
          <h3 className="text-slate-300 font-semibold mb-2">
            {search || statusFilter !== 'all' ? 'No agents match your filters' : 'No agents yet'}
          </h3>
          <p className="text-slate-600 text-sm mb-6">
            {search || statusFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Create your first agent to get started'}
          </p>
          {!search && statusFilter === 'all' && (
            <button className="btn-primary" onClick={() => setShowCreate(true)}>
              <Plus size={16} />
              Create Agent
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map(a => <AgentCard key={a.id} agent={a} />)}
        </div>
      )}

      {showCreate && <AgentFormModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
