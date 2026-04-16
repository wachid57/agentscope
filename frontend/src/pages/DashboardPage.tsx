import { useQuery } from '@tanstack/react-query'
import { Bot, Play, AlertCircle, Cpu, GitBranch, MemoryStick } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { systemApi } from '../api/system'
import { agentsApi } from '../api/agents'
import StatusBadge from '../components/StatusBadge'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { data: overview } = useQuery({ queryKey: ['overview'], queryFn: systemApi.overview, refetchInterval: 10_000 })
  const { data: agentsData } = useQuery({ queryKey: ['agents'], queryFn: agentsApi.list, refetchInterval: 10_000 })

  const agents = agentsData?.data ?? []

  const stat = (label: string, value: string | number, icon: React.ReactNode, color: string) => (
    <div className="card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-100">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  )

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
        <p className="text-slate-500 mt-1">Overview of your AgentScope deployment</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stat('Total Agents', overview?.agents.total ?? agents.length, <Bot size={20} className="text-brand-400" />, 'bg-brand-900/30 border border-brand-800/50')}
        {stat('Running', overview?.agents.running ?? agents.filter(a => a.status === 'running').length, <Play size={20} className="text-emerald-400" />, 'bg-emerald-900/30 border border-emerald-800/50')}
        {stat('Stopped', overview?.agents.stopped ?? agents.filter(a => a.status === 'stopped').length, <Cpu size={20} className="text-slate-400" />, 'bg-slate-800 border border-slate-700')}
        {stat('Errors', overview?.agents.errored ?? agents.filter(a => a.status === 'error').length, <AlertCircle size={20} className="text-red-400" />, 'bg-red-900/30 border border-red-800/50')}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Recent Agents */}
        <div className="col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-200">Agents</h2>
            <button className="text-xs text-brand-400 hover:underline" onClick={() => navigate('/agents')}>
              View all
            </button>
          </div>
          <div className="space-y-2">
            {agents.slice(0, 6).map(a => (
              <div
                key={a.id}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 cursor-pointer transition"
                onClick={() => navigate(`/agents/${a.id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-900/50 border border-brand-800/30 flex items-center justify-center">
                    <Bot size={14} className="text-brand-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-200">{a.name}</p>
                    <p className="text-[11px] text-slate-500">{a.type} · {a.model.provider}/{a.model.model_name || '—'}</p>
                  </div>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
            {agents.length === 0 && (
              <p className="text-center text-slate-600 py-6 text-sm">
                No agents yet.{' '}
                <button className="text-brand-400 hover:underline" onClick={() => navigate('/agents')}>
                  Create one
                </button>
              </p>
            )}
          </div>
        </div>

        {/* System Info */}
        <div className="space-y-4">
          <div className="card">
            <h2 className="font-semibold text-slate-200 mb-4">System Info</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-500"><GitBranch size={13} />Go Version</span>
                <span className="text-slate-300 font-mono text-xs">{overview?.system.go_version ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-500"><Cpu size={13} />Goroutines</span>
                <span className="text-slate-300">{overview?.system.goroutines ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-500"><MemoryStick size={13} />Memory</span>
                <span className="text-slate-300">{overview?.system.mem_alloc_mb ?? '—'} MB</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold text-slate-200 mb-3">Quick Actions</h2>
            <div className="space-y-2">
              <button
                className="btn-primary w-full justify-center text-sm"
                onClick={() => navigate('/agents')}
              >
                <Bot size={14} /> Manage Agents
              </button>
              <button
                className="btn-ghost w-full justify-center text-sm border border-slate-700"
                onClick={() => navigate('/tools')}
              >
                View Tools
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
