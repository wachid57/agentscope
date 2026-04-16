import { useQuery } from '@tanstack/react-query'
import { Wrench, Tag } from 'lucide-react'
import { systemApi } from '../api/system'

export default function ToolsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['builtin-tools'], queryFn: systemApi.tools })
  const tools = data?.data ?? []

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Tools</h1>
        <p className="text-slate-500 mt-1">Builtin tools available for agents</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="card animate-pulse h-28 bg-slate-800" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map(tool => (
            <div key={tool.name} className="card hover:border-slate-700 transition">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                  <Wrench size={15} className="text-brand-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 font-mono">{tool.name}</h3>
                  <span className="badge-blue text-[10px] mt-1">{tool.type}</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mb-3">{tool.description}</p>
              {tool.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tool.tags.map(t => (
                    <span key={t} className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
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
