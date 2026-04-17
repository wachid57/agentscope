import { useQuery } from '@tanstack/react-query'
import { Wrench, Tag } from 'lucide-react'
import { systemApi } from '../api/system'

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
                      style={{ color: 'var(--text-muted)', background: 'var(--bg-elevated)', boxShadow: '0 0 0 1px var(--border)' }}>
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
