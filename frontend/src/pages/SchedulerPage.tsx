import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock, Plus, Trash2, ToggleLeft, ToggleRight, AlertCircle, CheckCircle2, Link } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { schedulerApi, Scheduler, CreateSchedulerPayload } from '../api/gws'
import { systemApi } from '../api/system'

function formatInterval(secs: number) {
  if (secs < 60) return `${secs}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}m`
  return `${Math.floor(secs / 3600)}h`
}

function formatDate(val: string | null) {
  if (!val) return '—'
  return new Date(val).toLocaleString()
}

const defaultForm: CreateSchedulerPayload = {
  name: '',
  spreadsheet_id: '',
  sheet_range: '',
  check_mode: 'sheets',
  drive_file_id: '',
  interval_seconds: 300,
  webhook_url: '',
  webhook_secret: '',
  is_active: true,
}

export default function SchedulerPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreateSchedulerPayload>(defaultForm)

  const { data: appSettings } = useQuery({ queryKey: ['settings'], queryFn: systemApi.getSettings })
  const gwsUrl = appSettings?.['gws_base_url'] || localStorage.getItem('gws_base_url') || ''

  const { data, isLoading } = useQuery({
    queryKey: ['schedulers'],
    queryFn: schedulerApi.list,
  })
  const schedulers: Scheduler[] = data?.data ?? []

  const createMut = useMutation({
    mutationFn: schedulerApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedulers'] }); setShowForm(false); setForm(defaultForm) },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
      console.error('Create scheduler error:', err)
      if (msg) console.error('GWS error:', msg)
    },
  })

  const deleteMut = useMutation({
    mutationFn: schedulerApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedulers'] }),
  })

  const toggleMut = useMutation({
    mutationFn: schedulerApi.toggle,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedulers'] }),
  })

  function set(key: keyof CreateSchedulerPayload, val: unknown) {
    setForm(f => ({ ...f, [key]: val }))
  }

  return (
    <div className="p-6 w-full">
      {!gwsUrl && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
          <AlertCircle size={15} className="text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400 flex-1">
            GWS Base URL belum dikonfigurasi. Scheduler tidak akan bisa terhubung ke priva-gws.
          </p>
          <button
            onClick={() => navigate('/settings')}
            className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline shrink-0"
          >
            <Link size={12} /> Atur di Settings
          </button>
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <div />
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Plus size={14} /> New Scheduler
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card mb-6 space-y-4">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>New Scheduler</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Name</label>
              <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="My Scheduler" />
            </div>
            <div>
              <label className="label">Check Mode</label>
              <select className="input" value={form.check_mode} onChange={e => set('check_mode', e.target.value as 'sheets' | 'drive')}>
                <option value="sheets">Google Sheets</option>
                <option value="drive">Google Drive</option>
              </select>
            </div>
            <div>
              <label className="label">Spreadsheet ID</label>
              <input className="input" value={form.spreadsheet_id} onChange={e => set('spreadsheet_id', e.target.value)} placeholder="1BxiMV..." />
            </div>
            <div>
              <label className="label">Sheet Range</label>
              <input className="input" value={form.sheet_range} onChange={e => set('sheet_range', e.target.value)} placeholder="Sheet1!A1:Z" />
            </div>
            <div>
              <label className="label">Drive File ID</label>
              <input className="input" value={form.drive_file_id} onChange={e => set('drive_file_id', e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label className="label">Interval (seconds)</label>
              <input className="input" type="number" value={form.interval_seconds} onChange={e => set('interval_seconds', Number(e.target.value))} min={30} />
            </div>
            <div>
              <label className="label">Webhook URL</label>
              <input className="input" value={form.webhook_url} onChange={e => set('webhook_url', e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <label className="label">Webhook Secret</label>
              <input className="input" value={form.webhook_secret} onChange={e => set('webhook_secret', e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
            <button
              onClick={() => createMut.mutate(form)}
              disabled={createMut.isPending || !form.name}
              className="btn-primary text-sm"
            >
              {createMut.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
          {createMut.isError && (
            <div className="text-xs text-red-500 space-y-1">
              <p>Failed to create scheduler.</p>
              {(() => {
                const err = createMut.error as { response?: { data?: { error?: { message?: string } }; status?: number }; message?: string }
                const gwsMsg = err?.response?.data?.error?.message
                const status = err?.response?.status
                const noUrl = !err?.response && err?.message?.includes('Network')
                if (noUrl) return <p>GWS Base URL belum dikonfigurasi. Atur di <strong>Settings → GWS Integration</strong>.</p>
                if (gwsMsg) return <p>GWS: {gwsMsg}</p>
                if (status) return <p>HTTP {status} dari GWS server.</p>
                return null
              })()}
            </div>
          )}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card animate-pulse h-20" style={{ background: 'var(--bg-elevated)' }} />
          ))}
        </div>
      ) : schedulers.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <Clock size={32} className="mb-3 text-slate-300" />
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No schedulers yet</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Create one to start automating your workflows.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {schedulers.map(s => (
            <div key={s.id} className="card-hover flex items-center gap-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <Clock size={15} className="text-brand-500" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${s.is_active ? 'badge-green' : 'badge-gray'}`}>
                    {s.is_active ? 'Active' : 'Inactive'}
                  </span>
                  {s.running && <span className="badge-blue text-[10px]">Running</span>}
                </div>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Every {formatInterval(s.interval_seconds)}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Mode: {s.check_mode}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Last triggered: {formatDate(s.last_triggered_at)}
                  </span>
                  {s.error_msg && (
                    <span className="flex items-center gap-1 text-xs text-red-500">
                      <AlertCircle size={11} /> {s.error_msg}
                    </span>
                  )}
                  {!s.error_msg && s.trigger_count > 0 && (
                    <span className="flex items-center gap-1 text-xs text-emerald-500">
                      <CheckCircle2 size={11} /> {s.trigger_count} triggers
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggleMut.mutate(s.id)}
                  disabled={toggleMut.isPending}
                  className="p-2 rounded-lg transition hover:bg-slate-100 dark:hover:bg-slate-800"
                  title={s.is_active ? 'Deactivate' : 'Activate'}
                >
                  {s.is_active
                    ? <ToggleRight size={18} className="text-brand-500" />
                    : <ToggleLeft size={18} className="text-slate-400" />}
                </button>
                <button
                  onClick={() => { if (confirm(`Delete "${s.name}"?`)) deleteMut.mutate(s.id) }}
                  disabled={deleteMut.isPending}
                  className="p-2 rounded-lg transition hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-400 hover:text-red-500"
                  title="Delete"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
