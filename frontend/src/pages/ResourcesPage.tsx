import { useQuery } from '@tanstack/react-query'
import {
  Server,
  Database,
  Cpu,
  Layers,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Clock,
  ExternalLink,
  Activity,
} from 'lucide-react'
import { systemApi } from '../api/system'
import type { ComponentHealth, ComponentStatus } from '../types'
import clsx from 'clsx'

// ─── Status helpers ──────────────────────────────────────────────────────────

function statusColor(s: ComponentStatus) {
  switch (s) {
    case 'healthy':   return 'text-emerald-400'
    case 'degraded':  return 'text-amber-400'
    case 'unhealthy': return 'text-red-400'
    default:          return 'text-slate-400'
  }
}

function statusBg(s: ComponentStatus) {
  switch (s) {
    case 'healthy':   return 'bg-emerald-900/30 border-emerald-800/50'
    case 'degraded':  return 'bg-amber-900/30 border-amber-800/50'
    case 'unhealthy': return 'bg-red-900/30 border-red-800/50'
    default:          return 'bg-slate-800 border-slate-700'
  }
}

function statusDot(s: ComponentStatus) {
  switch (s) {
    case 'healthy':   return 'bg-emerald-400 shadow-emerald-500/50'
    case 'degraded':  return 'bg-amber-400 shadow-amber-500/50'
    case 'unhealthy': return 'bg-red-400 shadow-red-500/50'
    default:          return 'bg-slate-500'
  }
}

function StatusIcon({ status, size = 18 }: { status: ComponentStatus; size?: number }) {
  switch (status) {
    case 'healthy':   return <CheckCircle2 size={size} className="text-emerald-400" />
    case 'degraded':  return <AlertTriangle size={size} className="text-amber-400" />
    case 'unhealthy': return <XCircle size={size} className="text-red-400" />
    default:          return <HelpCircle size={size} className="text-slate-400" />
  }
}

function StatusLabel({ status }: { status: ComponentStatus }) {
  const map: Record<ComponentStatus, string> = {
    healthy:   'Healthy',
    degraded:  'Degraded',
    unhealthy: 'Unhealthy',
    unknown:   'Unknown',
  }
  return (
    <span className={clsx('text-xs font-semibold uppercase tracking-wider', statusColor(status))}>
      {map[status]}
    </span>
  )
}

// ─── Component icon ───────────────────────────────────────────────────────────

function ComponentIcon({ type, size = 20 }: { type: ComponentHealth['type']; size?: number }) {
  switch (type) {
    case 'backend':  return <Server size={size} />
    case 'core':     return <Cpu size={size} />
    case 'redis':    return <Layers size={size} />
    case 'database': return <Database size={size} />
    default:         return <Activity size={size} />
  }
}

function componentAccent(type: ComponentHealth['type']) {
  switch (type) {
    case 'backend':  return 'text-brand-400 bg-brand-900/30 border-brand-800/50'
    case 'core':     return 'text-violet-400 bg-violet-900/30 border-violet-800/50'
    case 'redis':    return 'text-orange-400 bg-orange-900/30 border-orange-800/50'
    case 'database': return 'text-teal-400 bg-teal-900/30 border-teal-800/50'
    default:         return 'text-slate-400 bg-slate-800 border-slate-700'
  }
}

// ─── Latency badge ────────────────────────────────────────────────────────────

function LatencyBadge({ ms }: { ms: number }) {
  const color = ms === 0 ? 'text-slate-500' : ms < 100 ? 'text-emerald-400' : ms < 500 ? 'text-amber-400' : 'text-red-400'
  return (
    <span className={clsx('flex items-center gap-1 text-xs font-mono', color)}>
      <Clock size={11} />
      {ms === 0 ? '—' : `${ms} ms`}
    </span>
  )
}

// ─── Overall status banner ────────────────────────────────────────────────────

function OverallBanner({ status, checkedAt }: { status: ComponentStatus; checkedAt: string }) {
  const date = new Date(checkedAt)
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  const bannerBg = {
    healthy:   'from-emerald-900/40 to-emerald-950/20 border-emerald-800/40',
    degraded:  'from-amber-900/40 to-amber-950/20 border-amber-800/40',
    unhealthy: 'from-red-900/40 to-red-950/20 border-red-800/40',
    unknown:   'from-slate-800 to-slate-900 border-slate-700',
  }[status]

  const label = {
    healthy:   'All systems operational',
    degraded:  'Some systems are degraded',
    unhealthy: 'One or more systems are down',
    unknown:   'Status unknown',
  }[status]

  return (
    <div className={clsx('rounded-xl border bg-gradient-to-r px-5 py-4 flex items-center justify-between', bannerBg)}>
      <div className="flex items-center gap-3">
        <div className={clsx('w-2.5 h-2.5 rounded-full shadow-lg animate-pulse', statusDot(status))} />
        <div>
          <p className={clsx('font-semibold text-sm', statusColor(status))}>{label}</p>
          <p className="text-xs text-slate-500 mt-0.5">Last checked at {timeStr}</p>
        </div>
      </div>
      <StatusIcon status={status} size={22} />
    </div>
  )
}

// ─── Component card ───────────────────────────────────────────────────────────

function ComponentCard({ comp }: { comp: ComponentHealth }) {
  return (
    <div className={clsx('rounded-xl border bg-slate-900 overflow-hidden transition-all hover:border-slate-700', statusBg(comp.status).includes('border') ? '' : '')}>
      {/* Card header */}
      <div className="px-5 py-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Type icon */}
          <div className={clsx('w-10 h-10 rounded-xl border flex items-center justify-center shrink-0', componentAccent(comp.type))}>
            <ComponentIcon type={comp.type} size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-slate-100">{comp.name}</h3>
              <StatusLabel status={comp.status} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{comp.message}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <StatusIcon status={comp.status} size={16} />
          <LatencyBadge ms={comp.latency_ms} />
        </div>
      </div>

      {/* Endpoint */}
      <div className="px-5 pb-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-800/60 rounded-lg px-3 py-2 font-mono min-w-0">
          <ExternalLink size={10} className="shrink-0" />
          <span className="truncate">{comp.endpoint}</span>
        </div>
      </div>

      {/* Details */}
      {comp.details && Object.keys(comp.details).length > 0 && (
        <div className="px-5 pb-4">
          <div className="rounded-lg bg-slate-800/40 border border-slate-800 divide-y divide-slate-800">
            {Object.entries(comp.details).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between px-3 py-1.5 text-xs">
                <span className="text-slate-500 capitalize">{key.replace(/_/g, ' ')}</span>
                <span className="text-slate-300 font-mono text-right max-w-[60%] truncate">{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status bar at bottom */}
      <div className={clsx('h-0.5 w-full', {
        'bg-emerald-500/50': comp.status === 'healthy',
        'bg-amber-500/50':   comp.status === 'degraded',
        'bg-red-500/50':     comp.status === 'unhealthy',
        'bg-slate-700':      comp.status === 'unknown',
      })} />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResourcesPage() {
  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['resources'],
    queryFn: systemApi.resources,
    refetchInterval: 15_000,
  })

  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Resources</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Connection status and health of system components
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-600">Updated {lastUpdate}</span>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
              'bg-slate-800 border-slate-700 text-slate-300 hover:text-slate-100 hover:border-slate-600',
              isFetching && 'opacity-50 cursor-not-allowed',
            )}
          >
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-4">
          <div className="h-16 rounded-xl bg-slate-800 animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-52 rounded-xl bg-slate-800 animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {/* Data loaded */}
      {data && (
        <div className="space-y-6">
          {/* Overall banner */}
          <OverallBanner status={data.status} checkedAt={data.checked_at} />

          {/* Summary row */}
          <div className="grid grid-cols-3 gap-3">
            {(['healthy', 'degraded', 'unhealthy'] as ComponentStatus[]).map(s => {
              const count = data.components.filter(c => c.status === s).length
              return (
                <div key={s} className={clsx('rounded-xl border px-4 py-3 flex items-center gap-3', statusBg(s))}>
                  <div className={clsx('w-2 h-2 rounded-full', statusDot(s))} />
                  <div>
                    <p className={clsx('text-xl font-bold', statusColor(s))}>{count}</p>
                    <p className="text-xs text-slate-500 capitalize">{s}</p>
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

          {/* Auto-refresh note */}
          <p className="text-center text-xs text-slate-700">
            Auto-refreshes every 15 seconds
          </p>
        </div>
      )}
    </div>
  )
}
