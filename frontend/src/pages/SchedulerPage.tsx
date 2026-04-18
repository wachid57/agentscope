import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock, Plus, Trash2, ToggleLeft, ToggleRight, AlertCircle, CheckCircle2, Link, Pencil, Play, X, Save, Loader2, XCircle, ExternalLink, Copy, Check, CalendarDays, RefreshCw, Zap, Sheet } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { schedulerApi, Scheduler, CreateSchedulerPayload } from '../api/gws'
import { systemApi } from '../api/system'
import toast from 'react-hot-toast'

function isApiDisabledError(msg: string) {
  return msg.includes('SERVICE_DISABLED') || msg.includes('accessNotConfigured') || msg.includes('has not been used in project')
}

function isFailedPreconditionError(msg: string) {
  return msg.includes('failedPrecondition') || msg.includes('is not supported for this document') || msg.includes('Spreadsheet ID tidak valid')
}

function extractEnableUrl(msg: string): string {
  const match = msg.match(/https:\/\/console\.developers\.google\.com\/apis\/api\/sheets\.googleapis\.com\/overview\?project=(\d+)/)
  if (match) return match[0]
  const projectMatch = msg.match(/project[=\s]+(\d+)/)
  if (projectMatch) return `https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=${projectMatch[1]}`
  return 'https://console.developers.google.com/apis/api/sheets.googleapis.com'
}

function formatInterval(secs: number) {
  if (secs < 60) return `${secs}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}m`
  return `${Math.floor(secs / 3600)}h`
}

function formatDate(val: string | null) {
  if (!val) return '—'
  return new Date(val).toLocaleString()
}

const emptyForm: CreateSchedulerPayload = {
  name: '', spreadsheet_id: '', sheet_range: '',
  check_mode: 'sheets', drive_file_id: '',
  interval_seconds: 300, webhook_url: '', webhook_secret: '', is_active: true,
}

// ── API Disabled Badge ────────────────────────────────────────────────────────
function ApiDisabledBadge({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
      <AlertCircle size={11} className="shrink-0" />
      Google Sheets API belum diaktifkan.{' '}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline font-medium flex items-center gap-0.5 hover:text-amber-700"
      >
        Aktifkan <ExternalLink size={10} />
      </a>
      <button
        onClick={handleCopy}
        title="Copy URL"
        className="flex items-center gap-0.5 hover:text-amber-700 transition-colors"
      >
        {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
      </button>
    </span>
  )
}

// ── Modal Form (create & edit) ────────────────────────────────────────────────
type TestResult = { ok: boolean; message: string } | null

function SchedulerModal({ initial, onClose, onSave, saving }: {
  initial: CreateSchedulerPayload & { id?: string }
  onClose: () => void
  onSave: (id: string | undefined, data: CreateSchedulerPayload) => void
  saving: boolean
}) {
  const [form, setForm] = useState<CreateSchedulerPayload>(initial)
  const [testResult, setTestResult] = useState<TestResult>(null)
  const [testing, setTesting] = useState(false)
  const set = (k: keyof CreateSchedulerPayload, v: unknown) => setForm(f => ({ ...f, [k]: v }))
  const isEdit = !!initial.id

  const runTest = async () => {
    if (!initial.id) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(`/api/settings/test-scheduler/${initial.id}`, { method: 'POST' })
      const json = await res.json()
      setTestResult(json)
    } catch {
      setTestResult({ ok: false, message: 'Gagal menghubungi backend' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-dropdown border animate-in"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 z-10"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {isEdit ? 'Edit Scheduler' : 'New Scheduler'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
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

            {/* Sheets fields */}
            {form.check_mode === 'sheets' && <>
              <div>
                <label className="label">Spreadsheet ID</label>
                <input className="input" value={form.spreadsheet_id} onChange={e => set('spreadsheet_id', e.target.value)} placeholder="1BxiMVsSrn..." />
              </div>
              <div>
                <label className="label">Sheet Range</label>
                <input className="input" value={form.sheet_range} onChange={e => set('sheet_range', e.target.value)} placeholder="Sheet1!A1:Z" />
              </div>
            </>}

            {/* Drive fields */}
            {form.check_mode === 'drive' && <>
              <div className="md:col-span-2">
                <label className="label">Drive File ID</label>
                <input className="input" value={form.drive_file_id} onChange={e => set('drive_file_id', e.target.value)} placeholder="1BxiMVsSrn..." />
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>ID file Google Drive yang akan dipantau perubahannya</p>
              </div>
            </>}

            <div>
              <label className="label">Interval (seconds)</label>
              <input className="input" type="number" value={form.interval_seconds} onChange={e => set('interval_seconds', Number(e.target.value))} min={30} />
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Min. 30 detik</p>
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
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t space-y-3" style={{ borderColor: 'var(--border)' }}>
          {/* Test result */}
          {testResult && (
            <div className={`flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs font-medium ${
              testResult.ok
                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                : 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400'
            }`}>
              {testResult.ok
                ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
                : <XCircle size={13} className="shrink-0 mt-0.5" />}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            {/* Test button — hanya saat edit */}
            {isEdit ? (
              <button
                type="button"
                onClick={runTest}
                disabled={testing}
                className="btn-outline flex items-center gap-2 text-sm"
              >
                {testing
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Play size={13} />}
                {testing ? 'Testing…' : 'Test / Run Now'}
              </button>
            ) : <div />}

            <div className="flex gap-2">
              <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
              <button
                onClick={() => onSave(initial.id, form)}
                disabled={saving || !form.name}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <Save size={13} /> {saving ? 'Saving…' : (isEdit ? 'Update' : 'Create')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SchedulerPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [modal, setModal] = useState<(CreateSchedulerPayload & { id?: string }) | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)

  const { data: appSettings } = useQuery({ queryKey: ['settings'], queryFn: systemApi.getSettings })
  const gwsUrl = appSettings?.['gws_base_url'] || localStorage.getItem('gws_base_url') || ''

  const { data, isLoading } = useQuery({ queryKey: ['schedulers'], queryFn: schedulerApi.list })
  const schedulers: Scheduler[] = data?.data ?? []

  const createMut = useMutation({
    mutationFn: schedulerApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedulers'] }); setModal(null); toast.success('Scheduler created') },
    onError: () => toast.error('Failed to create scheduler'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateSchedulerPayload> }) => schedulerApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedulers'] }); setModal(null); toast.success('Scheduler updated') },
    onError: () => toast.error('Failed to update scheduler'),
  })

  const deleteMut = useMutation({
    mutationFn: schedulerApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedulers'] }); toast.success('Scheduler deleted') },
  })

  const toggleMut = useMutation({
    mutationFn: schedulerApi.toggle,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedulers'] }),
  })

  const handleSave = (id: string | undefined, formData: CreateSchedulerPayload) => {
    if (id) updateMut.mutate({ id, data: formData })
    else createMut.mutate(formData)
  }

  const handleTest = async (s: Scheduler) => {
    setTestingId(s.id)
    try {
      // Aktifkan jika inactive, tunggu sebentar, lalu kembalikan
      if (!s.is_active) {
        await schedulerApi.toggle(s.id)
        await new Promise(r => setTimeout(r, 1500))
        await schedulerApi.toggle(s.id)
      } else {
        // Sudah aktif — toggle off lalu on
        await schedulerApi.toggle(s.id)
        await new Promise(r => setTimeout(r, 500))
        await schedulerApi.toggle(s.id)
      }
      qc.invalidateQueries({ queryKey: ['schedulers'] })
      toast.success(`Scheduler "${s.name}" triggered`)
    } catch {
      toast.error('Gagal menjalankan scheduler')
    } finally {
      setTestingId(null)
    }
  }

  const saving = createMut.isPending || updateMut.isPending

  return (
    <div className="p-6 w-full">
      {!gwsUrl && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
          <AlertCircle size={15} className="text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400 flex-1">
            GWS Base URL belum dikonfigurasi. Scheduler tidak akan bisa terhubung ke priva-gws.
          </p>
          <button onClick={() => navigate('/settings')}
            className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline shrink-0">
            <Link size={12} /> Atur di Settings
          </button>
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
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Klik tombol + untuk membuat scheduler baru.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {schedulers.map(s => (
            <div key={s.id} className="card-hover transition-all">
              {/* Top row: icon + name + badges + actions */}
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.is_active ? 'bg-brand-50 dark:bg-brand-950/30' : ''}`}
                  style={s.is_active ? { border: '1px solid var(--brand-200, #c7d2fe)' } : { background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                  <Clock size={16} className={s.is_active ? 'text-brand-500' : 'text-slate-400'} />
                </div>

                {/* Name + badges */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${s.is_active ? 'badge-green' : 'badge-gray'}`}>
                      {s.is_active ? '● Active' : '○ Inactive'}
                    </span>
                    {s.running && <span className="badge-blue text-[10px] px-2 py-0.5 rounded-full font-semibold animate-pulse">⚡ Running</span>}
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      <RefreshCw size={10} /> Every {formatInterval(s.interval_seconds)}
                    </span>
                    <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      <Sheet size={10} /> {s.check_mode === 'sheets' ? 'Google Sheets' : 'Google Drive'}
                    </span>
                    {s.trigger_count > 0 && (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                        <Zap size={10} /> {s.trigger_count} triggers
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => handleTest(s)}
                    disabled={testingId === s.id}
                    className="p-2 rounded-lg transition hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-slate-400 hover:text-emerald-600"
                    title="Run now"
                  >
                    <Play size={14} className={testingId === s.id ? 'animate-pulse text-emerald-500' : ''} />
                  </button>
                  <button
                    onClick={() => setModal({ ...s })}
                    className="p-2 rounded-lg transition hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
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

              {/* Divider */}
              <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Timestamps */}
                  <span className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    <CalendarDays size={10} />
                    Created {formatDate(s.created_at)}
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    <Pencil size={9} />
                    Updated {formatDate(s.updated_at)}
                  </span>
                  {s.last_triggered_at && (
                    <span className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={10} />
                      Last triggered {formatDate(s.last_triggered_at)}
                    </span>
                  )}

                  {/* Error */}
                  {s.error_msg && (
                    isApiDisabledError(s.error_msg) ? (
                      <ApiDisabledBadge url={extractEnableUrl(s.error_msg)} />
                    ) : isFailedPreconditionError(s.error_msg) ? (
                      <span className="flex items-center gap-1.5 text-[11px] text-orange-600 dark:text-orange-400">
                        <AlertCircle size={10} className="shrink-0" />
                        File Excel tidak didukung — konversi ke Google Sheets lalu update ID-nya.
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-[11px] text-red-500">
                        <AlertCircle size={10} className="shrink-0" /> {s.error_msg}
                      </span>
                    )
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setModal({ ...emptyForm })}
        className="fixed bottom-8 right-8 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95 z-40"
        style={{ background: 'var(--brand-600, #4f46e5)', color: 'white' }}
        title="New Scheduler"
      >
        <Plus size={22} />
      </button>

      {/* Modal */}
      {modal && (
        <SchedulerModal
          initial={modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  )
}
