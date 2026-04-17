import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, Bot, SlidersHorizontal } from 'lucide-react'
import AgentCard from '../components/AgentCard'
import AgentFormModal from '../components/AgentFormModal'
import { agentsApi } from '../api/agents'
import type { AgentStatus } from '../types'
import { useSetNavSubtitle } from '../context/NavSubtitle'
import { useNavActions } from '../context/NavActions'

const STATUS_FILTERS: { label: string; value: AgentStatus | 'all'; dot?: string }[] = [
  { label: 'All',     value: 'all' },
  { label: 'Running', value: 'running', dot: 'bg-emerald-500' },
  { label: 'Stopped', value: 'stopped', dot: 'bg-slate-400'   },
  { label: 'Error',   value: 'error',   dot: 'bg-red-500'     },
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

  const total = data?.total ?? 0
  useSetNavSubtitle(`${total} agent${total !== 1 ? 's' : ''} configured`)

  // stable refs so useEffect deps don't trigger infinite loops
  const searchRef = useRef(search)
  const statusRef = useRef(statusFilter)
  const setSearchStable = useCallback((v: string) => { searchRef.current = v; setSearch(v) }, [])
  const setStatusStable = useCallback((v: AgentStatus | 'all') => { statusRef.current = v; setStatusFilter(v) }, [])
  const openCreate = useCallback(() => setShowCreate(true), [])

  const { setActions } = useNavActions()
  useEffect(() => {
    setActions(
      <AgentNavActions
        search={search}
        statusFilter={statusFilter}
        onSearch={setSearchStable}
        onStatus={setStatusStable}
        onCreate={openCreate}
      />
    )
    return () => setActions(null)
  }, [search, statusFilter, setSearchStable, setStatusStable, openCreate, setActions])

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
    <div className="p-8 max-w-screen-2xl mx-auto w-full">
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="card animate-pulse" style={{ height: 200, background: 'var(--bg-elevated)' }} />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-28 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 shadow-card"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
            {search || statusFilter !== 'all'
              ? <SlidersHorizontal size={24} className="text-slate-400" />
              : <Bot size={24} className="text-slate-400" />}
          </div>
          <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            {search || statusFilter !== 'all' ? 'No agents match' : 'No agents yet'}
          </h3>
          <p className="text-sm mb-6 max-w-xs" style={{ color: 'var(--text-muted)' }}>
            {search || statusFilter !== 'all'
              ? 'Try adjusting your search or filter criteria'
              : 'Create your first agent to start automating tasks'}
          </p>
          {!search && statusFilter === 'all' && (
            <button className="btn-primary" onClick={openCreate}>
              <Plus size={15} /> Create Agent
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {agents.map(a => <AgentCard key={a.id} agent={a} />)}
        </div>
      )}

      {showCreate && <AgentFormModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}

// ── Navbar actions component ──────────────────────────────────────────────────

function AgentNavActions({
  search, statusFilter, onSearch, onStatus, onCreate,
}: {
  search: string
  statusFilter: AgentStatus | 'all'
  onSearch: (v: string) => void
  onStatus: (v: AgentStatus | 'all') => void
  onCreate: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          className="input pl-9 text-sm h-8 w-52"
          placeholder="Search agents…"
          value={search}
          onChange={e => onSearch(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-0.5 p-0.5 rounded-lg border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => onStatus(f.value)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 ${
              statusFilter === f.value
                ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-slate-100'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {f.dot && <span className={`w-1.5 h-1.5 rounded-full ${f.dot}`} />}
            {f.label}
          </button>
        ))}
      </div>

      <div className="w-px h-5" style={{ background: 'var(--border-strong)' }} />

      <button className="btn-primary text-xs py-1.5" onClick={onCreate}>
        <Plus size={13} /> New Agent
      </button>
    </div>
  )
}
