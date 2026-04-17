import { useQuery } from '@tanstack/react-query'
import { Bot, Play, Square, AlertCircle, Cpu, GitBranch, MemoryStick, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { systemApi } from '../api/system'
import { agentsApi } from '../api/agents'
import StatusBadge from '../components/StatusBadge'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { data: overview } = useQuery({ queryKey: ['overview'], queryFn: systemApi.overview, refetchInterval: 10_000 })
  const { data: agentsData } = useQuery({ queryKey: ['agents'], queryFn: agentsApi.list, refetchInterval: 10_000 })

  const agents = agentsData?.data ?? []

  const stats = [
    {
      label: 'Total Agents',
      value: overview?.agents.total ?? agents.length,
      icon: Bot,
      color: 'text-brand-600',
      bg: 'bg-brand-50 dark:bg-brand-900/20',
      trend: '+2 this week',
    },
    {
      label: 'Running',
      value: overview?.agents.running ?? agents.filter(a => a.status === 'running').length,
      icon: Play,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      trend: 'Active now',
    },
    {
      label: 'Stopped',
      value: overview?.agents.stopped ?? agents.filter(a => a.status === 'stopped').length,
      icon: Square,
      color: 'text-slate-500',
      bg: 'bg-slate-100 dark:bg-slate-800',
      trend: 'Idle',
    },
    {
      label: 'Errors',
      value: overview?.agents.errored ?? agents.filter(a => a.status === 'error').length,
      icon: AlertCircle,
      color: 'text-red-500',
      bg: 'bg-red-50 dark:bg-red-900/20',
      trend: 'Needs attention',
    },
  ]

  return (
    <div className="p-8 max-w-screen-2xl mx-auto w-full">

      {/* Stats row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color, bg, trend }) => (
          <div key={label} className="card-hover flex items-center gap-4">
            <div className={`stat-icon ${bg}`}>
              <Icon size={18} className={color} />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-none" style={{ color: 'var(--text-primary)' }}>{value}</p>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{label}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{trend}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Agents list — takes 2 cols */}
        <div className="xl:col-span-2 card">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>Recent Agents</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {agents.length} agent{agents.length !== 1 ? 's' : ''} configured
              </p>
            </div>
            <button
              onClick={() => navigate('/agents')}
              className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors"
            >
              View all <ArrowRight size={12} />
            </button>
          </div>

          <div className="space-y-1">
            {agents.slice(0, 8).map(a => (
              <div
                key={a.id}
                onClick={() => navigate(`/agents/${a.id}`)}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 hover:bg-slate-50 dark:hover:bg-slate-800/50 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center shrink-0">
                    <Bot size={13} className="text-brand-600 dark:text-brand-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-brand-600 transition-colors" style={{ color: 'var(--text-primary)' }}>
                      {a.name}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {a.type} · {a.model.provider}/{a.model.model_name || '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className="text-xs hidden sm:block" style={{ color: 'var(--text-muted)' }}>
                    {a.tools?.filter(t => t.enabled).length ?? 0} tools
                  </span>
                  <StatusBadge status={a.status} />
                </div>
              </div>
            ))}

            {agents.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                  <Bot size={20} className="text-slate-400" />
                </div>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>No agents yet</p>
                <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Create your first agent to get started</p>
                <button className="btn-primary text-xs px-3 py-1.5" onClick={() => navigate('/agents')}>
                  Create Agent
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">

          {/* System Info */}
          <div className="card">
            <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>System Info</h2>
            <div className="space-y-3">
              {[
                { icon: GitBranch, label: 'Go Version', value: overview?.system.go_version ?? '—', mono: true },
                { icon: Cpu,       label: 'Goroutines', value: overview?.system.goroutines ?? '—' },
                { icon: MemoryStick, label: 'Memory',   value: overview?.system.mem_alloc_mb ? `${overview.system.mem_alloc_mb} MB` : '—' },
              ].map(({ icon: Icon, label, value, mono }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <Icon size={13} /> {label}
                  </span>
                  <span className={`text-xs font-medium ${mono ? 'font-mono' : ''}`} style={{ color: 'var(--text-primary)' }}>
                    {String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>Quick Actions</h2>
            <div className="space-y-2">
              <button className="btn-primary w-full justify-center text-sm" onClick={() => navigate('/agents')}>
                <Bot size={14} /> Manage Agents
              </button>
              <button className="btn-outline w-full justify-center text-sm" onClick={() => navigate('/tools')}>
                View Tools
              </button>
              <button className="btn-outline w-full justify-center text-sm" onClick={() => navigate('/system/resources')}>
                System Resources
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
