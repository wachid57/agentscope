import { useNavigate } from 'react-router-dom'
import { Play, Square, MessageSquare, Copy, Trash2, MoreHorizontal, Bot, Wrench, Pencil } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import StatusBadge from './StatusBadge'
import AgentFormModal from './AgentFormModal'
import { agentsApi } from '../api/agents'
import type { Agent } from '../types'

const AGENT_TYPE_META: Record<string, { label: string; bg: string; color: string }> = {
  'priva-agent-react': { label: 'ReAct',     bg: '#f5f3ff', color: '#7c3aed' },
  'priva-agent-user':  { label: 'User',      bg: '#eff6ff', color: '#2563eb' },
  'priva-agent-realtime': { label: 'Realtime', bg: '#fff7ed', color: '#ea580c' },
  'priva-agent-a2a':   { label: 'A2A',       bg: '#f0fdf4', color: '#16a34a' },
  // legacy names
  'ReActAgent':        { label: 'ReAct',     bg: '#f5f3ff', color: '#7c3aed' },
  'UserAgent':         { label: 'User',      bg: '#eff6ff', color: '#2563eb' },
  'RealtimeAgent':     { label: 'Realtime',  bg: '#fff7ed', color: '#ea580c' },
  'A2AAgent':          { label: 'A2A',       bg: '#f0fdf4', color: '#16a34a' },
}

function AgentTypeBadge({ type }: { type: string }) {
  const meta = AGENT_TYPE_META[type] ?? { label: type, bg: 'var(--bg-elevated)', color: 'var(--text-muted)' }
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold tracking-wide"
      style={{ background: meta.bg, color: meta.color }}
    >
      {meta.label}
    </span>
  )
}

export default function AgentCard({ agent }: { agent: Agent }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['agents'] })

  const startMut = useMutation({
    mutationFn: () => agentsApi.start(agent.id),
    onSuccess: () => { toast.success('Agent started'); invalidate() },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed to start'),
  })
  const stopMut = useMutation({
    mutationFn: () => agentsApi.stop(agent.id),
    onSuccess: () => { toast.success('Agent stopped'); invalidate() },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed to stop'),
  })
  const dupMut = useMutation({
    mutationFn: () => agentsApi.duplicate(agent.id),
    onSuccess: () => { toast.success('Agent duplicated'); invalidate() },
  })
  const delMut = useMutation({
    mutationFn: () => agentsApi.delete(agent.id),
    onSuccess: () => { toast.success('Agent deleted'); invalidate() },
    onError: () => toast.error('Failed to delete agent'),
  })

  const activeTools = agent.tools?.filter(t => t.enabled).length ?? 0
  const isRunning = agent.status === 'running'

  return (
    <>
    <div
      className="glass-card flex flex-col group relative overflow-hidden transition-all duration-500 hover:shadow-2xl hover:shadow-brand-500/10 border-white/5 hover:border-brand-500/30"
      style={{ minHeight: 220 }}
    >
      <div className="absolute top-0 right-0 p-8 -mr-6 -mt-6 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-500 text-brand-500">
        <Bot size={80} />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className={clsx(
            'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-300 shadow-inner',
            isRunning
              ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30'
              : 'bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 ring-1 ring-slate-200 dark:ring-slate-700/50',
          )}>
            <Bot size={22} className={clsx(isRunning && 'animate-pulse')} />
          </div>
          <div className="min-w-0">
            <h3
              className="font-bold text-base truncate cursor-pointer text-slate-800 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
              onClick={() => navigate(`/agents/${agent.id}`)}
            >
              {agent.name}
            </h3>
            <div className="mt-1 flex items-center gap-2">
              <AgentTypeBadge type={agent.type} />
              <div className={clsx('w-1.5 h-1.5 rounded-full', isRunning ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-300 dark:bg-slate-600')}></div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <div className="relative">
            <button
              className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all border border-slate-200 dark:border-slate-700/30"
              onClick={() => setMenuOpen(m => !m)}
            >
              <MoreHorizontal size={16} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div
                  className="absolute right-0 top-10 z-20 w-44 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl py-2 text-sm animate-in fade-in zoom-in-95 duration-200"
                >
                  <button
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center gap-3 transition-colors text-slate-700 dark:text-slate-300"
                    onClick={() => { setEditOpen(true); setMenuOpen(false) }}
                  >
                    <Pencil size={14} className="text-slate-400 dark:text-slate-500" /> Edit Agent
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center gap-3 transition-colors text-slate-700 dark:text-slate-300"
                    onClick={() => { dupMut.mutate(); setMenuOpen(false) }}
                  >
                    <Copy size={14} className="text-slate-400 dark:text-slate-500" /> Duplicate
                  </button>
                  <div className="my-1 border-t border-slate-100 dark:border-slate-800/50" />
                  <button
                    className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-3 text-red-500 dark:text-red-400 transition-colors"
                    onClick={() => { if (confirm('Delete this agent?')) { delMut.mutate(); setMenuOpen(false) } }}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {agent.description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed italic">
          "{agent.description}"
        </p>
      )}

      {/* Tags */}
      {agent.tags && agent.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {agent.tags.map(t => (
            <span key={t} className="px-2 py-0.5 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-400 text-[10px] font-bold uppercase tracking-wider">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Meta */}
      <div className="mt-auto space-y-5">
        <div
          className="grid grid-cols-3 gap-3 py-4 border-t border-slate-200 dark:border-slate-800/50"
        >
          {[
            { label: 'Provider', value: agent.model.provider },
            { label: 'Memory',   value: agent.memory.type },
            { label: 'Tools',    value: activeTools, icon: Wrench },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex flex-col gap-1">
              <span className="text-[9px] uppercase tracking-widest font-black text-slate-400 dark:text-slate-600">
                {label}
              </span>
              <span className="flex items-center gap-1.5 font-bold text-[11px] text-slate-700 dark:text-slate-300 truncate">
                {Icon && <Icon size={10} className="text-brand-500/70" />}
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {isRunning ? (
            <button
              className="btn-danger flex-1 text-xs py-2 justify-center shadow-lg shadow-red-500/10"
              onClick={() => stopMut.mutate()}
              disabled={stopMut.isPending}
            >
              <Square size={12} fill="currentColor" />
              {stopMut.isPending ? 'Stopping…' : 'Stop'}
            </button>
          ) : (
            <button
              className="btn-primary flex-1 text-xs py-2 justify-center shadow-lg shadow-brand-500/10"
              onClick={() => startMut.mutate()}
              disabled={startMut.isPending}
            >
              <Play size={12} fill="currentColor" />
              {startMut.isPending ? 'Starting…' : 'Start'}
            </button>
          )}
          <button
            className={clsx(
              'flex-1 text-xs py-2 rounded-xl flex items-center justify-center gap-2 transition-all font-bold',
              isRunning
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/50'
                : 'bg-slate-50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-700 border border-slate-200 dark:border-slate-800 cursor-not-allowed',
            )}
            onClick={() => navigate(`/agents/${agent.id}/chat`)}
            disabled={!isRunning}
          >
            <MessageSquare size={12} /> Chat
          </button>
        </div>
      </div>
    </div>

    {editOpen && <AgentFormModal agent={agent} onClose={() => setEditOpen(false)} />}
    </>
  )
}
