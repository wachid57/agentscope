import { useState, useEffect, useRef } from 'react'
import { X, Plus, Trash2, Search, ChevronDown } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { agentsApi } from '../api/agents'
import { systemApi } from '../api/system'
import type { Agent, CreateAgentRequest, UpdateAgentRequest, ToolConfig } from '../types'

interface Props {
  agent?: Agent | null
  onClose: () => void
}

const AGENT_TYPES = ['ReActAgent', 'UserAgent', 'RealtimeAgent', 'A2AAgent'] as const
const MEMORY_TYPES = ['in_memory', 'redis', 'sql'] as const

const defaultForm: CreateAgentRequest = {
  name: '',
  description: '',
  type: 'ReActAgent',
  sys_prompt: 'You are a helpful AI assistant.',
  model: { provider: 'openai', model_name: 'gpt-4o-mini', stream: true },
  tools: [],
  memory: { type: 'in_memory' },
  tags: [],
}

export default function AgentFormModal({ agent, onClose }: Props) {
  const qc = useQueryClient()
  const isEdit = !!agent

  const [form, setForm] = useState<CreateAgentRequest>(defaultForm)
  const [tagInput, setTagInput] = useState('')
  const [modelSearch, setModelSearch] = useState('')
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)
  const modelDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const { data: provData } = useQuery({ queryKey: ['providers'], queryFn: systemApi.providers })
  const { data: toolData } = useQuery({ queryKey: ['builtin-tools'], queryFn: systemApi.tools })
  const providers = provData?.data ?? []
  const builtinTools = toolData?.data ?? []

  useEffect(() => {
    if (agent) {
      setForm({
        name: agent.name,
        description: agent.description,
        type: agent.type,
        sys_prompt: agent.sys_prompt,
        model: agent.model,
        tools: agent.tools ?? [],
        memory: agent.memory,
        tags: agent.tags ?? [],
      })
    }
  }, [agent])

  const selectedProvider = providers.find(p => p.id === form.model.provider)

  const createMut = useMutation({
    mutationFn: () => agentsApi.create(form),
    onSuccess: () => {
      toast.success('Agent created successfully')
      qc.invalidateQueries({ queryKey: ['agents'] })
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed to create agent'),
  })

  const updateMut = useMutation({
    mutationFn: () => {
      const req: UpdateAgentRequest = {
        name: form.name,
        description: form.description,
        sys_prompt: form.sys_prompt,
        model: form.model,
        tools: form.tools,
        memory: form.memory,
        tags: form.tags,
      }
      return agentsApi.update(agent!.id, req)
    },
    onSuccess: () => {
      toast.success('Agent updated')
      qc.invalidateQueries({ queryKey: ['agents'] })
      qc.invalidateQueries({ queryKey: ['agent', agent?.id] })
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed to update agent'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Name is required')
    if (!form.sys_prompt.trim()) return toast.error('System prompt is required')
    isEdit ? updateMut.mutate() : createMut.mutate()
  }

  const toggleTool = (toolName: string, desc: string, tags: string[]) => {
    setForm(f => {
      const exists = f.tools.find(t => t.name === toolName)
      if (exists) {
        return { ...f, tools: f.tools.filter(t => t.name !== toolName) }
      }
      const newTool: ToolConfig = {
        name: toolName, type: 'builtin', description: desc, enabled: true, tags,
      }
      return { ...f, tools: [...f.tools, newTool] }
    })
  }

  const addTag = () => {
    const t = tagInput.trim()
    if (t && !form.tags.includes(t)) {
      setForm(f => ({ ...f, tags: [...f.tags, t] }))
    }
    setTagInput('')
  }

  const isPending = createMut.isPending || updateMut.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-dropdown border animate-in"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 z-10"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{isEdit ? 'Edit Agent' : 'Create Agent'}</h2>
          <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition" style={{ color: 'var(--text-muted)' }} onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <section>
            <h3 className="section-title mb-3">Basic Info</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Name *</label>
                <input
                  className="input"
                  placeholder="My Assistant"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="col-span-2">
                <label className="label">Description</label>
                <input
                  className="input"
                  placeholder="What does this agent do?"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Agent Type</label>
                <select
                  className="input"
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}
                >
                  {AGENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* System Prompt */}
          <section>
            <h3 className="section-title mb-3">System Prompt</h3>
            <textarea
              className="input min-h-[120px] resize-y font-mono text-xs"
              placeholder="You are a helpful AI assistant..."
              value={form.sys_prompt}
              onChange={e => setForm(f => ({ ...f, sys_prompt: e.target.value }))}
            />
          </section>

          {/* Model */}
          <section>
            <h3 className="section-title mb-3">Model</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Provider</label>
                <select
                  className="input"
                  value={form.model.provider}
                  onChange={e => setForm(f => ({
                    ...f,
                    model: { ...f.model, provider: e.target.value as any, model_name: '' },
                  }))}
                >
                  {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  {providers.length === 0 && <option value="openai">OpenAI</option>}
                </select>
              </div>
              <div>
                <label className="label">Model Name</label>
                {selectedProvider ? (
                  <div className="relative" ref={modelDropdownRef}>
                    <button
                      type="button"
                      className="input flex items-center justify-between w-full text-left"
                      onClick={() => setModelDropdownOpen(o => !o)}
                    >
                      <span className={form.model.model_name ? '' : 'opacity-40'} style={{ color: 'var(--text-primary)' }}>
                        {form.model.model_name || 'Select model...'}
                      </span>
                      <ChevronDown size={14} className={`flex-shrink-0 ml-2 transition-transform ${modelDropdownOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
                    </button>
                    {modelDropdownOpen && (
                      <div className="absolute z-50 w-full mt-1 rounded-xl border shadow-dropdown overflow-hidden"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                        <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
                          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'var(--bg-base)' }}>
                            <Search size={13} style={{ color: 'var(--text-muted)' }} />
                            <input
                              autoFocus
                              className="flex-1 bg-transparent text-xs outline-none"
                              style={{ color: 'var(--text-primary)' }}
                              placeholder="Search model..."
                              value={modelSearch}
                              onChange={e => setModelSearch(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="overflow-y-auto max-h-48">
                          {selectedProvider.models
                            .filter(m => m.toLowerCase().includes(modelSearch.toLowerCase()))
                            .map(m => (
                              <button
                                key={m}
                                type="button"
                                className="w-full text-left px-3 py-2 text-xs transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                                style={{
                                  color: form.model.model_name === m ? 'var(--brand)' : 'var(--text-primary)',
                                  fontWeight: form.model.model_name === m ? 600 : 400,
                                }}
                                onClick={() => {
                                  setForm(f => ({ ...f, model: { ...f.model, model_name: m } }))
                                  setModelDropdownOpen(false)
                                  setModelSearch('')
                                }}
                              >
                                {m}
                              </button>
                            ))}
                          {selectedProvider.models.filter(m => m.toLowerCase().includes(modelSearch.toLowerCase())).length === 0 && (
                            <p className="text-xs px-3 py-4 text-center" style={{ color: 'var(--text-muted)' }}>No models found</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <input
                    className="input"
                    placeholder="gpt-4o-mini"
                    value={form.model.model_name}
                    onChange={e => setForm(f => ({ ...f, model: { ...f.model, model_name: e.target.value } }))}
                  />
                )}
              </div>
              <div className="col-span-2">
                <label className="label">API Key (leave blank to use environment variable)</label>
                <input
                  type="password"
                  className="input"
                  placeholder="sk-..."
                  value={form.model.api_key ?? ''}
                  onChange={e => setForm(f => ({ ...f, model: { ...f.model, api_key: e.target.value } }))}
                />
              </div>
              <div>
                <label className="label">Max Tokens</label>
                <input
                  type="number"
                  className="input"
                  placeholder="4096"
                  value={form.model.max_tokens ?? ''}
                  onChange={e => setForm(f => ({ ...f, model: { ...f.model, max_tokens: parseInt(e.target.value) || undefined } }))}
                />
              </div>
              <div>
                <label className="label">Temperature</label>
                <input
                  type="number"
                  className="input"
                  step="0.1"
                  min="0"
                  max="2"
                  placeholder="0.7"
                  value={form.model.temp ?? ''}
                  onChange={e => setForm(f => ({ ...f, model: { ...f.model, temp: parseFloat(e.target.value) || undefined } as any }))}
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="stream"
                  className="w-4 h-4 accent-brand-500"
                  checked={form.model.stream}
                  onChange={e => setForm(f => ({ ...f, model: { ...f.model, stream: e.target.checked } }))}
                />
                <label htmlFor="stream" className="text-sm text-slate-400">Enable streaming</label>
              </div>
            </div>
          </section>

          {/* Memory */}
          <section>
            <h3 className="section-title mb-3">Memory</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Memory Backend</label>
                <select
                  className="input"
                  value={form.memory.type}
                  onChange={e => setForm(f => ({ ...f, memory: { ...f.memory, type: e.target.value as any } }))}
                >
                  {MEMORY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {form.memory.type === 'redis' && (
                <div>
                  <label className="label">Redis URL</label>
                  <input
                    className="input"
                    placeholder="redis://localhost:6379"
                    value={form.memory.redis_url ?? ''}
                    onChange={e => setForm(f => ({ ...f, memory: { ...f.memory, redis_url: e.target.value } }))}
                  />
                </div>
              )}
              <div>
                <label className="label">Max Items</label>
                <input
                  type="number"
                  className="input"
                  placeholder="100"
                  value={form.memory.max_items ?? ''}
                  onChange={e => setForm(f => ({ ...f, memory: { ...f.memory, max_items: parseInt(e.target.value) || undefined } }))}
                />
              </div>
            </div>
          </section>

          {/* Tools */}
          <section>
            <h3 className="section-title mb-3">Builtin Tools</h3>
            <div className="grid grid-cols-2 gap-2">
              {builtinTools.map(tool => {
                const enabled = form.tools.some(t => t.name === tool.name)
                return (
                  <label
                    key={tool.name}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150 ${
                      enabled
                        ? 'border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-900/20'
                        : 'hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                    style={!enabled ? { borderColor: 'var(--border)' } : {}}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-brand-500"
                      checked={enabled}
                      onChange={() => toggleTool(tool.name, tool.description, tool.tags)}
                    />
                    <div>
                      <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{tool.name}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{tool.description}</p>
                    </div>
                  </label>
                )
              })}
            </div>
          </section>

          {/* Tags */}
          <section>
            <h3 className="section-title mb-3">Tags</h3>
            <div className="flex gap-2 mb-2">
              <input
                className="input flex-1"
                placeholder="Add tag..."
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
              />
              <button type="button" className="btn-primary px-3" onClick={addTag}>
                <Plus size={14} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {form.tags.map(t => (
                <span key={t} className="badge-blue gap-1">
                  {t}
                  <button type="button" onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }))}>
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          </section>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isPending}>
              {isPending ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save Changes' : 'Create Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
