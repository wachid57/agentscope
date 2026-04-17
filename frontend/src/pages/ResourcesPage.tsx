import { useQuery } from '@tanstack/react-query'
import {
  Server, Database, Cpu, Layers, RefreshCw,
  CheckCircle2, XCircle, AlertTriangle, HelpCircle,
  Clock, ExternalLink, Activity,
} from 'lucide-react'
import { systemApi } from '../api/system'
import type { ComponentHealth, ComponentStatus } from '../types'
import clsx from 'clsx'
import { useSetNavSubtitle } from '../context/NavSubtitle'
import { useNavActions } from '../context/NavActions'
import { useEffect } from 'react'

// ── Status helpers ────────────────────────────────────────────────────────────

function statusColor(s: ComponentStatus) {
  switch (s) {
    case 'healthy':   return 'text-emerald-600 dark:text-emerald-400'
    case 'degraded':  return 'text-amber-600 dark:text-amber-400'
    case 'unhealthy': return 'text-red-600 dark:text-red-400'
    default:          return 'text-slate-500'
  }
}

function statusDot(s: ComponentStatus) {
  switch (s) {
    case 'healthy':   return 'bg-emerald-500'
    case 'degraded':  return 'bg-amber-500'
    case 'unhealthy': return 'bg-red-500'
    default:          return 'bg-slate-400'
  }
}

function StatusIcon({ status, size = 18 }: { status: ComponentStatus; size?: number }) {
  switch (status) {
    case 'healthy':   return <CheckCircle2 size={size} className="text-emerald-500" />
    case 'degraded':  return <AlertTriangle size={size} className="text-amber-500" />
    case 'unhealthy': return <XCircle size={size} className="text-red-500" />
    default:          return <HelpCircle size={size} className="text-slate-400" />
  }
}

function componentAccentClass(type: ComponentHealth['type']) {
  switch (type) {
    case 'backend':  return { bg: '#eff6ff', border: '#bfdbfe', color: '#2563eb' }
    case 'core':     return { bg: '#f5f3ff', border: '#ddd6fe', color: '#7c3aed' }
    case 'redis':    return { bg: '#fff7ed', border: '#fed7aa', color: '#ea580c' }
    case 'database': return { bg: '#f0fdfa', border: '#99f6e4', color: '#0d9488' }
    default:         return { bg: 'var(--bg-elevated)', border: 'var(--border)', color: 'var(--text-muted)' }
  }
}

function ComponentIcon({ type, size = 18 }: { type: ComponentHealth['type']; size?: number }) {
  switch (type) {
    case 'backend':  return <Server size={size} />
    case 'core':     return <Cpu size={size} />
    case 'redis':    return <Layers size={size} />
    case 'database': return <Database size={size} />
    default:         return <Activity size={size} />
  }
}

function LatencyBadge({ ms }: { ms: number }) {
  const color = ms === 0 ? 'var(--text-muted)' : ms < 100 ? '#16a34a' : ms < 500 ? '#d97706' : '#dc2626'
  return (
    <span className="flex items-center gap-1 text-xs font-mono" style={{ color }}>
      <Clock size={11} />
      {ms === 0 ? '—' : `${ms} ms`}
    </span>
  )
}

// ── Overall banner ────────────────────────────────────────────────────────────

function OverallBanner({ status, checkedAt }: { status: ComponentStatus; checkedAt: string }) {
  const timeStr = new Date(checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  const styles: Record<ComponentStatus, { bg: string; border: string; text: string }> = {
    healthy:   { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
    degraded:  { bg: '#fffbeb', border: '#fde68a', text: '#b45309' },
    unhealthy: { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' },
    unknown:   { bg: 'var(--bg-elevated)', border: 'var(--border)', text: 'var(--text-muted)' },
  }
  const label: Record<ComponentStatus, string> = {
    healthy:   'All systems operational',
    degraded:  'Some systems are degraded',
    unhealthy: 'One or more systems are down',
    unknown:   'Status unknown',
  }

  const s = styles[status]
  return (
    <div className="rounded-xl border px-5 py-4 flex items-center justify-between"
      style={{ background: s.bg, borderColor: s.border }}>
      <div className="flex items-center gap-3">
        <div className={clsx('w-2.5 h-2.5 rounded-full animate-pulse', statusDot(status))} />
        <div>
          <p className="font-semibold text-sm" style={{ color: s.text }}>{label[status]}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Last checked at {timeStr}</p>
        </div>
      </div>
      <StatusIcon status={status} size={20} />
    </div>
  )
}

// ── Component card ────────────────────────────────────────────────────────────

function ComponentCard({ comp }: { comp: ComponentHealth }) {
  const accent = componentAccentClass(comp.type)
  return (
    <div className="card overflow-hidden flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
            style={{ background: accent.bg, borderColor: accent.border, color: accent.color }}>
            <ComponentIcon type={comp.type} size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{comp.name}</h3>
              <span className={clsx('text-xs font-semibold uppercase tracking-wider', statusColor(comp.status))}>
                {comp.status}
              </span>
            </div>
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{comp.message}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <StatusIcon status={comp.status} size={16} />
          <LatencyBadge ms={comp.latency_ms} />
        </div>
      </div>

      {/* Endpoint */}
      <div className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-mono mb-3"
        style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
        <ExternalLink size={10} className="shrink-0" />
        <span className="truncate">{comp.endpoint}</span>
      </div>

      {/* Details */}
      {comp.details && Object.keys(comp.details).length > 0 && (
        <div className="rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
          {Object.entries(comp.details).map(([key, val], i) => (
            <div key={key} className="flex items-center justify-between px-3 py-1.5 text-xs"
              style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined, background: i % 2 === 0 ? 'var(--bg-elevated)' : 'var(--bg-surface)' }}>
              <span style={{ color: 'var(--text-muted)' }} className="capitalize">{key.replace(/_/g, ' ')}</span>
              <span className="font-mono text-right max-w-[60%] truncate" style={{ color: 'var(--text-secondary)' }}>{val}</span>
            </div>
          ))}
        </div>
      )}

      {/* Status bar */}
      <div className={clsx('h-0.5 w-full -mx-5 mt-4', {
        'bg-emerald-400': comp.status === 'healthy',
        'bg-amber-400':   comp.status === 'degraded',
        'bg-red-400':     comp.status === 'unhealthy',
        'bg-slate-300':   comp.status === 'unknown',
      })} style={{ marginBottom: -20, width: 'calc(100% + 40px)' }} />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ResourcesPage() {
  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['resources'],
    queryFn: systemApi.resources,
    refetchInterval: 15_000,
  })

  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—'

  const total = data?.components.length ?? 0
  useSetNavSubtitle(`${total} component${total !== 1 ? 's' : ''} monitored`)

  const { setActions } = useNavActions()
  useEffect(() => {
    setActions(
      <>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Updated {lastUpdate}</span>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn-outline text-xs py-1.5"
        >
          <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </>
    )
    return () => setActions(null)
  }, [lastUpdate, isFetching, refetch, setActions])

  return (
    <div className="p-8 max-w-screen-2xl mx-auto w-full">

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-4">
          <div className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--bg-elevated)' }} />
          <div className="grid grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--bg-elevated)' }} />)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-52 rounded-xl animate-pulse" style={{ background: 'var(--bg-elevated)' }} />)}
          </div>
        </div>
      )}

      {/* Data loaded */}
      {data && (
        <div className="space-y-5">
          <OverallBanner status={data.status} checkedAt={data.checked_at} />

          {/* Summary row */}
          <div className="grid grid-cols-3 gap-3">
            {(['healthy', 'degraded', 'unhealthy'] as const).map(s => {
              const count = data.components.filter(c => c.status === s).length
              const bgMap = {
                healthy:   { bg: '#f0fdf4', border: '#bbf7d0' },
                degraded:  { bg: '#fffbeb', border: '#fde68a' },
                unhealthy: { bg: '#fef2f2', border: '#fecaca' },
              }[s]
              return (
                <div key={s} className="rounded-xl border px-4 py-3 flex items-center gap-3"
                  style={{ background: bgMap.bg, borderColor: bgMap.border }}>
                  <div className={clsx('w-2 h-2 rounded-full', statusDot(s))} />
                  <div>
                    <p className={clsx('text-xl font-bold', statusColor(s))}>{count}</p>
                    <p className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>{s}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Component cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.components.map(comp => (
              <ComponentCard key={comp.name} comp={comp} />
            ))}
          </div>

          <p className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            Auto-refreshes every 15 seconds
          </p>
        </div>
      )}
    </div>
  )
}
