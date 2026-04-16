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
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <button className="btn-ghost p-2" onClick={() => navigate('/agents')}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-100">{agent.name}</h1>
              <StatusBadge status={agent.status} />
            </div>
            <p className="text-slate-500 text-sm mt-1">{agent.description || agent.type}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setShowEdit(true)}>
            <Edit2 size={14} /> Edit
          </button>
          {agent.status === 'running' ? (
            <>
              <button
                className="btn-ghost border border-brand-700 text-brand-400 hover:bg-brand-900/30"
                onClick={() => navigate(`/agents/${id}/chat`)}
              >
                <MessageSquare size={14} /> Chat
              </button>
              <button className="btn-danger" onClick={() => stopMut.mutate()} disabled={stopMut.isPending}>
                <Square size={14} /> Stop
              </button>
            </>
          ) : (
            <button className="btn-primary" onClick={() => startMut.mutate()} disabled={startMut.isPending}>
              <Play size={14} /> Start Agent
            </button>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Sessions', value: stats?.total_sessions ?? 0, icon: <MessageSquare size={14} /> },
          { label: 'Active Sessions', value: stats?.active_sessions ?? 0, icon: <Activity size={14} /> },
          { label: 'Total Messages', value: stats?.total_messages ?? 0, icon: <Layers size={14} /> },
          { label: 'Tools Active', value: agent.tools?.filter(t => t.enabled).length ?? 0, icon: <Terminal size={14} /> },
        ].map(s => (
          <div key={s.label} className="card text-center">
            <div className="flex justify-center text-brand-400 mb-1">{s.icon}</div>
            <p className="text-xl font-bold text-slate-100">{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-800 mb-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
              tab === t.id
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && (
        <div className="grid grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-semibold text-slate-300 mb-4">Configuration</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Type</dt>
                <dd className="text-slate-300">{agent.type}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Provider</dt>
                <dd className="text-slate-300">{agent.model.provider}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Model</dt>
                <dd className="text-slate-300 font-mono text-xs">{agent.model.model_name || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Streaming</dt>
                <dd className="text-slate-300">{agent.model.stream ? 'Yes' : 'No'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Memory</dt>
                <dd className="text-slate-300">{agent.memory.type}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Created</dt>
                <dd className="text-slate-300 text-xs">{formatDistanceToNow(new Date(agent.created_at))} ago</dd>
              </div>
            </dl>
          </div>

          <div className="card">
            <h3 className="font-semibold text-slate-300 mb-3">System Prompt</h3>
            <pre className="text-xs text-slate-400 whitespace-pre-wrap font-mono bg-slate-800/50 rounded-lg p-3 max-h-40 overflow-y-auto">
              {agent.sys_prompt}
            </pre>
            {agent.tags?.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs text-slate-500 mb-2">Tags</h4>
                <div className="flex flex-wrap gap-1">
                  {agent.tags.map(t => <span key={t} className="badge-blue">{t}</span>)}
                </div>
              </div>
            )}
          </div>

          {agent.tools?.length > 0 && (
            <div className="col-span-2 card">
              <h3 className="font-semibold text-slate-300 mb-3">Tools ({agent.tools.length})</h3>
              <div className="grid grid-cols-3 gap-2">
                {agent.tools.map(tool => (
                  <div key={tool.name} className={`p-3 rounded-lg border text-xs ${tool.enabled ? 'border-brand-800/50 bg-brand-900/10' : 'border-slate-700 opacity-50'}`}>
                    <p className="font-medium text-slate-300">{tool.name}</p>
                    <p className="text-slate-500 mt-0.5">{tool.description}</p>
                    <span className={`mt-1 inline-block ${tool.enabled ? 'text-emerald-400' : 'text-slate-600'}`}>
                      {tool.enabled ? 'Enabled' : 'Disabled'}
                    </span>
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
