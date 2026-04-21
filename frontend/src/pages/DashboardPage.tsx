import { useQuery } from '@tanstack/react-query'
import { Bot, Play, Square, AlertCircle, Cpu, GitBranch, MemoryStick, ArrowRight, Activity, Layers, Wrench } from 'lucide-react'
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
    <div className="p-8 max-w-screen-2xl mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map(({ label, value, icon: Icon, color, trend }) => {
          const colorMap: Record<string, string> = {
            'text-brand-600': 'blue',
            'text-emerald-600': 'emerald',
            'text-slate-500': 'slate',
            'text-red-500': 'red'
          };
          const c = colorMap[color] || 'blue';
          
          return (
            <div key={label} className="stat-card p-6 border-slate-800 group relative overflow-hidden">
              <div className={`absolute top-0 right-0 p-8 -mr-6 -mt-6 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-500 text-${c}-500`}>
                <Icon size={64} />
              </div>
              <div className="flex items-center gap-5 w-full">
                <div className={`w-12 h-12 rounded-2xl bg-${c}-500/10 flex items-center justify-center text-${c}-400 shrink-0 border border-${c}-500/20`}>
                  <Icon size={22} />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-black text-white tracking-tight">{value}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
                  <p className={`text-[10px] mt-1 font-medium text-${c}-500/80`}>{trend}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

        {/* Agents list — takes 2 cols */}
        <div className="xl:col-span-2 glass-card flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-400">
                <Bot size={20} />
              </div>
              <div>
                <h2 className="font-bold text-lg text-white">Recent Agents</h2>
                <p className="text-xs text-slate-500 font-medium">
                  {agents.length} agent{agents.length !== 1 ? 's' : ''} currently configured
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/agents')}
              className="px-4 py-2 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 text-xs font-bold transition-all flex items-center gap-2 border border-slate-700/50"
            >
              View Repository <ArrowRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents.slice(0, 6).map(a => (
              <div
                key={a.id}
                onClick={() => navigate(`/agents/${a.id}`)}
                className="group flex items-center justify-between p-4 rounded-2xl border border-slate-800 hover:border-brand-500/30 hover:bg-brand-500/5 cursor-pointer transition-all duration-300"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-800/50 flex items-center justify-center shrink-0 group-hover:bg-brand-500/10 transition-colors">
                    <Bot size={18} className="text-slate-500 group-hover:text-brand-400 transition-colors" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors truncate">
                      {a.name}
                    </p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter mt-0.5">
                      {a.type} · {a.model.provider}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <StatusBadge status={a.status} />
                </div>
              </div>
            ))}

            {agents.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-3xl bg-slate-800/30 flex items-center justify-center mb-5 border border-slate-800">
                  <Bot size={28} className="text-slate-600" />
                </div>
                <p className="text-base font-bold text-slate-300 mb-1">No agents found</p>
                <p className="text-xs text-slate-500 mb-6">Start by creating your first intelligent agent</p>
                <button className="btn-primary" onClick={() => navigate('/agents')}>
                  <Bot size={16} /> Create Your First Agent
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-8">

          {/* System Info */}
          <div className="glass-card">
            <div className="flex items-center gap-2 mb-6 text-brand-400">
              <Activity size={18} />
              <h2 className="font-bold text-slate-200">System Monitoring</h2>
            </div>
            <div className="space-y-4">
              {[
                { icon: GitBranch, label: 'Go Runtime', value: overview?.system.go_version ?? '—', color: 'blue' },
                { icon: Cpu,       label: 'Goroutines', value: overview?.system.goroutines ?? '—', color: 'emerald' },
                { icon: MemoryStick, label: 'Mem Usage',   value: overview?.system.mem_alloc_mb ? `${overview.system.mem_alloc_mb} MB` : '—', color: 'purple' },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-slate-800/50">
                  <span className="flex items-center gap-2.5 text-xs font-bold text-slate-500 uppercase tracking-widest">
                    <Icon size={14} className={`text-${color}-500`} /> {label}
                  </span>
                  <span className="text-xs font-black text-slate-200 font-mono">
                    {String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="glass-card bg-gradient-to-br from-brand-600/10 to-purple-600/10">
            <h2 className="font-bold text-slate-200 mb-6 flex items-center gap-2">
              <Layers size={18} className="text-purple-400" />
              Quick Operations
            </h2>
            <div className="space-y-3">
              <button className="btn-primary w-full shadow-brand-500/20" onClick={() => navigate('/agents')}>
                <Bot size={16} /> Manage Agents
              </button>
              <button className="btn-secondary w-full" onClick={() => navigate('/tools')}>
                <Wrench size={16} className="text-slate-500" /> Infrastructure Tools
              </button>
              <button className="btn-ghost w-full bg-slate-800/30 border border-slate-700/30" onClick={() => navigate('/system/resources')}>
                <Activity size={16} /> Resource Monitoring
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
