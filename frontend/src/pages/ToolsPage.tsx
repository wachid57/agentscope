import { useQuery } from '@tanstack/react-query'
import { Wrench, Tag } from 'lucide-react'
import { systemApi } from '../api/system'

const TAG_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  code:    { bg: '#ede9fe', color: '#7c3aed', border: '#c4b5fd' },
  python:  { bg: '#fef9c3', color: '#a16207', border: '#fde047' },
  shell:   { bg: '#ffedd5', color: '#c2410c', border: '#fed7aa' },
  system:  { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
  file:    { bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' },
  read:    { bg: '#dcfce7', color: '#15803d', border: '#86efac' },
  write:   { bg: '#fce7f3', color: '#be185d', border: '#f9a8d4' },
  network: { bg: '#cffafe', color: '#0e7490', border: '#67e8f9' },
  ai:      { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
  db:      { bg: '#fdf4ff', color: '#a21caf', border: '#e879f9' },
}

function tagStyle(tag: string) {
  const palette = TAG_COLORS[tag.toLowerCase()]
  if (palette) return { background: palette.bg, color: palette.color, boxShadow: `0 0 0 1px ${palette.border}` }
  const hue = [...tag].reduce((n, c) => n + c.charCodeAt(0), 0) % 360
  return { background: `hsl(${hue},70%,92%)`, color: `hsl(${hue},60%,35%)`, boxShadow: `0 0 0 1px hsl(${hue},60%,80%)` }
}

export default function ToolsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['builtin-tools'], queryFn: systemApi.tools })
  const tools = data?.data ?? []

  return (
    <div className="p-8 max-w-screen-2xl mx-auto w-full">
      {isLoading ? (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <div key={i} className="card animate-pulse h-28" style={{ background: 'var(--bg-elevated)' }} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tools.map(tool => (
            <div key={tool.name} className="card-hover transition">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                  <Wrench size={15} className="text-brand-500" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold font-mono truncate" style={{ color: 'var(--text-primary)' }}>{tool.name}</h3>
                  <span className="badge-blue text-[10px] mt-1">{tool.type}</span>
                </div>
              </div>
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{tool.description}</p>
              {tool.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tool.tags.map(t => (
                    <span key={t} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md"
                      style={tagStyle(t)}>
                      <Tag size={8} />{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
