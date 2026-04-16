import clsx from 'clsx'
import type { AgentStatus } from '../types'

interface Props {
  status: AgentStatus
}

const cfg: Record<AgentStatus, { label: string; className: string; dot: string }> = {
  running: {
    label: 'Running',
    className: 'badge-green',
    dot: 'bg-emerald-400',
  },
  stopped: {
    label: 'Stopped',
    className: 'badge-slate',
    dot: 'bg-slate-500',
  },
  error: {
    label: 'Error',
    className: 'badge-red',
    dot: 'bg-red-400',
  },
}

export default function StatusBadge({ status }: Props) {
  const c = cfg[status] ?? cfg.stopped
  return (
    <span className={clsx('badge gap-1.5', c.className)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', c.dot, status === 'running' && 'animate-pulse')} />
      {c.label}
    </span>
  )
}
