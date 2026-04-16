import { useQuery } from '@tanstack/react-query'
import { HardDrive, RefreshCw, CheckCircle2, AlertTriangle, XCircle, HelpCircle } from 'lucide-react'
import { systemApi } from '../api/system'
import type { ComponentStatus } from '../types'
import clsx from 'clsx'

// ─── Status helpers ──────────────────────────────────────────────────────────

function statusColor(s: ComponentStatus) {
    switch (s) {
        case 'healthy': return 'text-emerald-400'
        case 'degraded': return 'text-amber-400'
        case 'unhealthy': return 'text-red-400'
        default: return 'text-slate-400'
    }
}

function statusDot(s: ComponentStatus) {
    switch (s) {
        case 'healthy': return 'bg-emerald-400 shadow-emerald-500/50'
        case 'degraded': return 'bg-amber-400 shadow-amber-500/50'
        case 'unhealthy': return 'bg-red-400 shadow-red-500/50'
        default: return 'bg-slate-500'
    }
}

function StatusIcon({ status, size = 14 }: { status: ComponentStatus; size?: number }) {
    switch (status) {
        case 'healthy': return <CheckCircle2 size={size} className="text-emerald-400" />
        case 'degraded': return <AlertTriangle size={size} className="text-amber-400" />
        case 'unhealthy': return <XCircle size={size} className="text-red-400" />
        default: return <HelpCircle size={size} className="text-slate-400" />
    }
}

// ─── System Status Indicator ─────────────────────────────────────────────────

export default function SystemStatusIndicator() {
    const { data, isFetching, refetch } = useQuery({
        queryKey: ['resources'],
        queryFn: systemApi.resources,
        refetchInterval: 15_000,
        staleTime: 10_000,
    })

    const lastUpdate = data?.checked_at
        ? new Date(data.checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '—'

    const status = data?.status || 'unknown'

    return (
        <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
                <span>Resources:</span>
                <span className={clsx('font-medium', statusColor(status))}>
                    {status === 'healthy' && 'Operational'}
                    {status === 'degraded' && 'Degraded'}
                    {status === 'unhealthy' && 'Issues'}
                    {status === 'unknown' && 'Unknown'}
                </span>
                <span className="text-slate-700">•</span>
                <span>Updated {lastUpdate}</span>
            </div>

            <div className="flex items-center gap-1.5">
                <div className={clsx('w-2 h-2 rounded-full shadow-lg', statusDot(status))} />
                <button
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                    title="Refresh system status"
                >
                    <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
                </button>
            </div>
        </div>
    )
}