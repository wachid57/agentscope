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
      className="card-hover flex flex-col group"
      style={{ minHeight: 200 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={clsx(
            'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors',
            isRunning
              ? 'bg-emerald-50 dark:bg-emerald-900/20'
              : 'bg-slate-100 dark:bg-slate-800',
          )}>
            <Bot size={16} className={isRunning ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'} />
          </div>
          <div className="min-w-0">
            <h3
              className="font-semibold text-sm truncate cursor-pointer hover:text-brand-600 transition-colors"
              style={{ color: 'var(--text-primary)' }}
              onClick={() => navigate(`/agents/${agent.id}`)}
            >
              {agent.name}
            </h3>
            <div className="mt-0.5">
              <AgentTypeBadge type={agent.type} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <StatusBadge status={agent.status} />
          <div className="relative">
            <button
              className="p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-slate-100 dark:hover:bg-slate-800"
              style={{ color: 'var(--text-muted)' }}
              onClick={() => setMenuOpen(m => !m)}
            >
              <MoreHorizontal size={14} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div
                  className="absolute right-0 top-7 z-20 w-40 rounded-xl shadow-dropdown border py-1.5 text-sm animate-in"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                >
                  <button
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    onClick={() => { setEditOpen(true); setMenuOpen(false) }}
                  >
                    <Pencil size={12} /> Edit
                  </button>
                  <button
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    onClick={() => { dupMut.mutate(); setMenuOpen(false) }}
                  >
                    <Copy size={12} /> Duplicate
                  </button>
                  <button
                    className="w-full text-left px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2.5 text-red-500 transition-colors"
                    onClick={() => { if (confirm('Delete this agent?')) { delMut.mutate(); setMenuOpen(false) } }}
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {agent.description && (
        <p className="text-xs line-clamp-2 mb-3" style={{ color: 'var(--text-muted)' }}>
          {agent.description}
        </p>
      )}

      {/* Tags */}
      {agent.tags && agent.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {agent.tags.map(t => (
            <span key={t} className="badge-blue text-[10px] px-1.5 py-0.5">{t}</span>
          ))}
        </div>
      )}

      {/* Meta */}
      <div className="mt-auto">
        <div
          className="grid grid-cols-3 gap-2 py-3 mb-3 border-t border-b text-xs"
          style={{ borderColor: 'var(--border)' }}
        >
          {[
            { label: 'Provider', value: agent.model.provider },
            { label: 'Memory',   value: agent.memory.type },
            { label: 'Tools',    value: `${activeTools} active`, icon: Wrench },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wide font-medium" style={{ color: 'var(--text-muted)' }}>
                {label}
              </span>
              <span className="flex items-center gap-1 font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
                {Icon && <Icon size={10} />}
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {isRunning ? (
            <button
              className="btn-danger flex-1 text-xs py-1.5 justify-center"
              onClick={() => stopMut.mutate()}
              disabled={stopMut.isPending}
            >
              <Square size={11} />
              {stopMut.isPending ? 'Stopping…' : 'Stop'}
            </button>
          ) : (
            <button
              className="btn-primary flex-1 text-xs py-1.5 justify-center"
              onClick={() => startMut.mutate()}
              disabled={startMut.isPending}
            >
              <Play size={11} />
              {startMut.isPending ? 'Starting…' : 'Start'}
            </button>
          )}
          <button
            className={clsx(
              'btn flex-1 text-xs py-1.5 justify-center border',
              isRunning
                ? 'border-brand-300 text-brand-600 hover:bg-brand-50 dark:border-brand-700 dark:text-brand-400 dark:hover:bg-brand-900/20'
                : 'border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-50',
            )}
            style={{ background: 'transparent' }}
            onClick={() => navigate(`/agents/${agent.id}/chat`)}
            disabled={!isRunning}
          >
            <MessageSquare size={11} /> Chat
          </button>
        </div>
      </div>
    </div>

    {editOpen && <AgentFormModal agent={agent} onClose={() => setEditOpen(false)} />}
    </>
  )
}
