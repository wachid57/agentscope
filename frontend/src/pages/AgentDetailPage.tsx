import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Play, Square, MessageSquare, Edit2, Activity,
  Layers, Terminal, RefreshCw, Clock,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import { agentsApi } from '../api/agents'
import StatusBadge from '../components/StatusBadge'
import AgentFormModal from '../components/AgentFormModal'

type Tab = 'overview' | 'sessions' | 'logs'

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('overview')
  const [showEdit, setShowEdit] = useState(false)

  const { data: agent, isLoading } = useQuery({
    queryKey: ['agent', id],
    queryFn: () => agentsApi.get(id!),
    enabled: !!id,
    refetchInterval: 5_000,
  })
  const { data: stats } = useQuery({
    queryKey: ['agent-stats', id],
    queryFn: () => agentsApi.stats(id!),
    enabled: !!id,
  })
  const { data: logsData, refetch: refetchLogs } = useQuery({
    queryKey: ['agent-logs', id],
    queryFn: () => agentsApi.logs(id!),
    enabled: !!id && tab === 'logs',
  })
  const { data: sessionsData } = useQuery({
    queryKey: ['agent-sessions', id],
    queryFn: () => agentsApi.listSessions(id!),
    enabled: !!id && tab === 'sessions',
  })

  const startMut = useMutation({
    mutationFn: () => agentsApi.start(id!),
    onSuccess: () => { toast.success('Agent started'); qc.invalidateQueries({ queryKey: ['agent', id] }) },
  })
  const stopMut = useMutation({
    mutationFn: () => agentsApi.stop(id!),
    onSuccess: () => { toast.success('Agent stopped'); qc.invalidateQueries({ queryKey: ['agent', id] }) },
  })

  if (isLoading) return <div className="p-8 text-slate-500">Loading...</div>
  if (!agent) return <div className="p-8 text-red-400">Agent not found</div>

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Layers size={14} /> },
    { id: 'sessions', label: 'Sessions', icon: <MessageSquare size={14} /> },
    { id: 'logs', label: 'Logs', icon: <Terminal size={14} /> },
  ]

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="relative group">
        <div className="absolute -inset-4 bg-gradient-to-r from-brand-600/20 to-purple-600/20 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition duration-1000"></div>
        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6 glass-card border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-5">
            <button 
              className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700/50 text-slate-500 dark:text-slate-300 transition-all active:scale-95 border border-slate-200 dark:border-slate-700/50"
              onClick={() => navigate('/agents')}
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">
                  {agent.name}
                </h1>
                <StatusBadge status={agent.status} />
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                {agent.description || agent.type}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button className="flex-1 md:flex-none btn-secondary px-6" onClick={() => setShowEdit(true)}>
              <Edit2 size={16} /> Edit
            </button>
            {agent.status === 'running' ? (
              <>
                <button
                  className="flex-1 md:flex-none px-6 py-2.5 rounded-xl bg-brand-500/10 border border-brand-500/30 text-brand-400 hover:bg-brand-500/20 transition-all font-semibold flex items-center justify-center gap-2"
                  onClick={() => navigate(`/agents/${id}/chat`)}
                >
                  <MessageSquare size={16} /> Chat
                </button>
                <button className="flex-1 md:flex-none btn-danger px-6" onClick={() => stopMut.mutate()} disabled={stopMut.isPending}>
                  <Square size={16} /> Stop
                </button>
              </>
            ) : (
              <button className="flex-1 md:flex-none btn-primary px-8" onClick={() => startMut.mutate()} disabled={startMut.isPending}>
                <Play size={16} /> Start Agent
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Sessions', value: stats?.total_sessions ?? 0, icon: <MessageSquare size={18} />, color: 'blue' },
          { label: 'Active Sessions', value: stats?.active_sessions ?? 0, icon: <Activity size={18} />, color: 'emerald' },
          { label: 'Total Messages', value: stats?.total_messages ?? 0, icon: <Layers size={18} />, color: 'purple' },
          { label: 'Tools Active', value: agent.tools?.filter(t => t.enabled).length ?? 0, icon: <Terminal size={18} />, color: 'orange' },
        ].map(s => (
          <div key={s.label} className="stat-card p-6 border-slate-200 dark:border-slate-800 group overflow-hidden">
            <div className={`absolute top-0 right-0 p-8 -mr-4 -mt-4 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-500 text-${s.color}-500`}>
              {s.icon}
            </div>
            <div className={`w-10 h-10 rounded-xl bg-${s.color}-50 dark:bg-${s.color}-500/10 flex items-center justify-center text-${s.color}-600 dark:text-${s.color}-400 mb-4`}>
              {s.icon}
            </div>
            <div className="text-center md:text-left w-full">
              <p className="text-2xl font-bold text-slate-800 dark:text-white mb-1">{s.value}</p>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1.5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2.5 px-6 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 ${
              tab === t.id
                ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                : 'text-slate-500 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="card border-slate-200 dark:border-slate-800/50 bg-white dark:bg-slate-900/40">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 rounded-lg bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400">
                  <Activity size={16} />
                </div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200">Configuration</h3>
              </div>
              <div className="space-y-4">
                {[
                  { label: 'Type', value: agent.type, icon: <Layers size={14} /> },
                  { label: 'Provider', value: agent.model.provider, icon: <Terminal size={14} /> },
                  { label: 'Model', value: agent.model.model_name || '—', mono: true },
                  { label: 'Streaming', value: agent.model.stream ? 'Yes' : 'No' },
                  { label: 'Memory', value: agent.memory.type },
                  { label: 'Created', value: `${formatDistanceToNow(new Date(agent.created_at))} ago` },
                ].map((item, idx) => (
                  <div key={idx} className="flex flex-col gap-1 py-1 border-b border-slate-100 dark:border-slate-800/50 last:border-0">
                    <dt className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold">{item.label}</dt>
                    <dd className={`text-sm text-slate-700 dark:text-slate-300 ${item.mono ? 'font-mono text-xs' : ''}`}>{item.value}</dd>
                  </div>
                ))}
              </div>
            </div>

            {agent.tags?.length > 0 && (
              <div className="card border-slate-800/50 bg-slate-900/40">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {agent.tags.map(t => (
                    <span key={t} className="px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-[11px] font-bold">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="card border-slate-200 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-950/40 min-h-[300px] flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <Terminal size={16} />
                  </div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-200">System Prompt</h3>
                </div>
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400 dark:bg-red-500/40"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 dark:bg-yellow-500/40"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 dark:bg-emerald-500/40"></div>
                </div>
              </div>
              <div className="relative flex-1 bg-white dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-inner">
                <pre className="p-5 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono leading-relaxed max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-800">
                  {agent.sys_prompt}
                </pre>
              </div>
            </div>
          </div>

          {agent.tools?.length > 0 && (
            <div className="col-span-full card border-slate-800/50 bg-slate-900/30">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400">
                  <Layers size={16} />
                </div>
                <h3 className="font-bold text-slate-200">Tools & Capabilities</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {agent.tools.map(tool => (
                  <div key={tool.name} className={`group p-4 rounded-2xl border transition-all duration-300 ${
                    tool.enabled 
                      ? 'border-brand-500/20 bg-brand-500/5 hover:bg-brand-500/10' 
                      : 'border-slate-800 bg-slate-900/50 opacity-60'
                  }`}>
                    <div className="flex items-start justify-between mb-2">
                      <p className={`font-bold text-sm ${tool.enabled ? 'text-brand-300' : 'text-slate-400'}`}>
                        {tool.name}
                      </p>
                      <div className={`w-2 h-2 rounded-full ${tool.enabled ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-700'}`}></div>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-4">
                      {tool.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold uppercase tracking-tighter ${tool.enabled ? 'text-emerald-400' : 'text-slate-600'}`}>
                        {tool.enabled ? 'Status: Active' : 'Status: Inactive'}
                      </span>
                      {tool.enabled && <div className="text-brand-500/40 group-hover:text-brand-500 transition-colors"><Terminal size={12} /></div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'sessions' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-300">
              Sessions ({sessionsData?.total ?? 0})
            </h3>
            <button
              className="btn-primary text-sm"
              onClick={() => navigate(`/agents/${id}/chat`)}
              disabled={agent.status !== 'running'}
            >
              <MessageSquare size={14} /> New Chat
            </button>
          </div>
          <div className="space-y-2">
            {(sessionsData?.data ?? []).map(sess => (
              <div
                key={sess.id}
                className="flex items-center justify-between p-4 card hover:border-slate-700 cursor-pointer"
                onClick={() => navigate(`/agents/${id}/chat?session=${sess.id}`)}
              >
                <div>
                  <p className="text-sm font-medium text-slate-200">
                    Session {sess.id.slice(0, 8)}...
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {sess.messages?.length ?? 0} messages · User: {sess.user_id}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <Clock size={12} />
                  {formatDistanceToNow(new Date(sess.updated_at))} ago
                </div>
              </div>
            ))}
            {!sessionsData?.data?.length && (
              <p className="text-center py-10 text-slate-600">No sessions yet</p>
            )}
          </div>
        </div>
      )}

      {tab === 'logs' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-300">Logs ({logsData?.total ?? 0})</h3>
            <button className="btn-ghost text-sm" onClick={() => refetchLogs()}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
          <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 font-mono text-xs space-y-1 max-h-96 overflow-y-auto">
            {(logsData?.data ?? []).slice().reverse().map(log => (
              <div key={log.id} className="flex gap-3">
                <span className="text-slate-600 shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={`shrink-0 w-14 ${
                  log.level === 'error' ? 'text-red-400' :
                  log.level === 'warning' ? 'text-yellow-400' :
                  'text-emerald-400'
                }`}>
                  [{log.level}]
                </span>
                <span className="text-slate-300 break-all">{log.message}</span>
              </div>
            ))}
            {!logsData?.data?.length && (
              <p className="text-slate-600 text-center py-4">No logs yet</p>
            )}
          </div>
        </div>
      )}

      {showEdit && <AgentFormModal agent={agent} onClose={() => setShowEdit(false)} />}
    </div>
  )
}
