import { useNavigate } from 'react-router-dom'
import { Play, Square, MessageSquare, Copy, Trash2, MoreVertical, Bot } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import StatusBadge from './StatusBadge'
import { agentsApi } from '../api/agents'
import type { Agent } from '../types'

interface Props {
  agent: Agent
}

export default function AgentCard({ agent }: Props) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [menuOpen, setMenuOpen] = useState(false)

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

  return (
    <div className="card hover:border-slate-700 transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-900/50 border border-brand-800/50 flex items-center justify-center">
            <Bot size={18} className="text-brand-400" />
          </div>
          <div>
            <h3
              className="font-semibold text-slate-100 text-sm cursor-pointer hover:text-brand-400 transition"
              onClick={() => navigate(`/agents/${agent.id}`)}
            >
              {agent.name}
            </h3>
            <p className="text-xs text-slate-500">{agent.type}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={agent.status} />
          <div className="relative">
            <button
              className="btn-ghost p-1.5 opacity-0 group-hover:opacity-100 transition"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <MoreVertical size={14} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 z-20 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 text-sm">
                  <button
                    className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-2 text-slate-300"
                    onClick={() => { dupMut.mutate(); setMenuOpen(false) }}
                  >
                    <Copy size={13} /> Duplicate
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-2 text-red-400"
                    onClick={() => { if (confirm('Delete this agent?')) delMut.mutate(); setMenuOpen(false) }}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {agent.description && (
        <p className="text-xs text-slate-500 mb-3 line-clamp-2">{agent.description}</p>
      )}

      <div className="flex flex-wrap gap-1 mb-4">
        {agent.tags?.map(t => (
          <span key={t} className="badge-blue text-[10px] px-1.5">{t}</span>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4 text-xs text-slate-500">
        <div>
          <span className="text-slate-600">Model:</span>{' '}
          <span className="text-slate-400">{agent.model.provider}</span>
        </div>
        <div>
          <span className="text-slate-600">Memory:</span>{' '}
          <span className="text-slate-400">{agent.memory.type}</span>
        </div>
        <div>
          <span className="text-slate-600">Tools:</span>{' '}
          <span className="text-slate-400">{agent.tools?.filter(t => t.enabled).length ?? 0} active</span>
        </div>
      </div>

      <div className="flex gap-2 pt-3 border-t border-slate-800">
        {agent.status === 'running' ? (
          <button
            className="btn-danger flex-1 text-xs py-1.5 justify-center"
            onClick={() => stopMut.mutate()}
            disabled={stopMut.isPending}
          >
            <Square size={12} />
            {stopMut.isPending ? 'Stopping...' : 'Stop'}
          </button>
        ) : (
          <button
            className="btn-primary flex-1 text-xs py-1.5 justify-center"
            onClick={() => startMut.mutate()}
            disabled={startMut.isPending}
          >
            <Play size={12} />
            {startMut.isPending ? 'Starting...' : 'Start'}
          </button>
        )}
        <button
          className={clsx(
            'btn flex-1 text-xs py-1.5 justify-center border',
            agent.status === 'running'
              ? 'border-brand-700 text-brand-400 hover:bg-brand-900/30'
              : 'border-slate-700 text-slate-500 cursor-not-allowed',
          )}
          onClick={() => navigate(`/agents/${agent.id}/chat`)}
          disabled={agent.status !== 'running'}
        >
          <MessageSquare size={12} />
          Chat
        </button>
      </div>
    </div>
  )
}
