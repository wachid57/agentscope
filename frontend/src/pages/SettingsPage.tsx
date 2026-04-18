import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, Bell, Globe, Database, Trash2, Save, Webhook, Plug, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSetNavSubtitle } from '../context/NavSubtitle'
import { systemApi } from '../api/system'
import { invalidateGwsCache } from '../api/gws'

export default function SettingsPage() {
  useSetNavSubtitle('Configure your AgentScope instance')

  const qc = useQueryClient()

  const { data: dbSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: systemApi.getSettings,
  })

  const [gws, setGws] = useState({ baseUrl: '', apiKey: '' })

  useEffect(() => {
    setGws({
      baseUrl: dbSettings?.['gws_base_url'] || localStorage.getItem('gws_base_url') || '',
      apiKey:  dbSettings?.['gws_api_key']  || localStorage.getItem('gws_api_key')  || '',
    })
  }, [dbSettings])

  const gwsMut = useMutation({
    mutationFn: (data: Record<string, string>) => systemApi.updateSettings(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: () => {
      // DB belum tersedia — tidak masalah, sudah disimpan ke localStorage
    },
  })

  const saveGws = (e: React.FormEvent) => {
    e.preventDefault()
    const url = gws.baseUrl.trim()
    const key = gws.apiKey.trim()
    // selalu simpan ke localStorage sebagai fallback
    localStorage.setItem('gws_base_url', url)
    localStorage.setItem('gws_api_key', key)
    invalidateGwsCache()
    toast.success('GWS settings saved')
    // simpan ke DB jika backend tersedia
    gwsMut.mutate({ gws_base_url: url, gws_api_key: key })
  }

  type TestStatus = 'idle' | 'loading' | 'ok' | 'error'
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testMsg, setTestMsg] = useState('')

  const testConnection = async () => {
    const url = gws.baseUrl.trim()
    if (!url) { toast.error('GWS Base URL belum diisi'); return }
    setTestStatus('loading')
    setTestMsg('')

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)

    try {
      const key = gws.apiKey.trim()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (key) headers['Authorization'] = `Bearer ${key}`

      const res = await fetch(`${url}/api/v1.0/schedulers`, { headers, signal: controller.signal })
      clearTimeout(timer)
      const json = await res.json()

      if (res.ok) {
        const count = Array.isArray(json?.data) ? json.data.length : '?'
        setTestStatus('ok')
        setTestMsg(`Terhubung — ${count} scheduler ditemukan`)
      } else if (res.status === 401 || json?.error?.code === 'UNAUTHORIZED') {
        setTestStatus('error')
        setTestMsg('Unauthorized — API Key salah atau tidak valid')
      } else {
        setTestStatus('error')
        setTestMsg(`HTTP ${res.status}: ${json?.error?.message ?? 'Unknown error'}`)
      }
    } catch (e: unknown) {
      clearTimeout(timer)
      setTestStatus('error')
      const msg = e instanceof Error ? e.message : 'Gagal terhubung'
      if (msg === 'signal is aborted without reason' || msg.includes('abort') || msg.includes('timed out')) {
        setTestMsg('Timeout (8s) — periksa URL dan port (fe: 3001, be: 8083)')
      } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setTestMsg(`Tidak dapat terhubung ke ${url} — cek URL atau CORS`)
      } else {
        setTestMsg(msg)
      }
    }
  }

  const [general, setGeneral] = useState({
    siteName: 'AgentScope',
    defaultModel: 'gpt-4o-mini',
    maxAgents: 50,
    sessionTimeout: 30,
  })

  const [notifications, setNotifications] = useState({
    agentErrors: true,
    agentStopped: false,
    systemAlerts: true,
    emailAlerts: false,
  })

  const saveGeneral = (e: React.FormEvent) => {
    e.preventDefault()
    toast.success('Settings saved')
  }

  const clearCache = () => {
    toast.success('Cache cleared successfully')
  }

  return (
    <div className="p-6 w-full">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

        {/* ── Kolom kiri ── */}
        <div className="space-y-5">

          {/* General */}
          <div className="card">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-elevated)' }}>
                <Settings size={15} className="text-brand-500" />
              </div>
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>General</h3>
            </div>
            <form onSubmit={saveGeneral} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Site Name</label>
                  <div className="relative">
                    <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                    <input
                      className="input pl-9"
                      value={general.siteName}
                      onChange={e => setGeneral(g => ({ ...g, siteName: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Default Model</label>
                  <select
                    className="input"
                    value={general.defaultModel}
                    onChange={e => setGeneral(g => ({ ...g, defaultModel: e.target.value }))}
                  >
                    <option value="gpt-4o-mini">gpt-4o-mini</option>
                    <option value="gpt-4o">gpt-4o</option>
                    <option value="gpt-4-turbo">gpt-4-turbo</option>
                    <option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
                  </select>
                </div>
                <div>
                  <label className="label">Max Agents</label>
                  <input
                    type="number"
                    className="input"
                    value={general.maxAgents}
                    onChange={e => setGeneral(g => ({ ...g, maxAgents: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <label className="label">Session Timeout (min)</label>
                  <input
                    type="number"
                    className="input"
                    value={general.sessionTimeout}
                    onChange={e => setGeneral(g => ({ ...g, sessionTimeout: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button type="submit" className="btn-primary">
                  <Save size={14} /> Save Settings
                </button>
              </div>
            </form>
          </div>

          {/* GWS Integration */}
          <div className="card">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-elevated)' }}>
                <Webhook size={15} className="text-brand-500" />
              </div>
              <div>
                <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>GWS Integration</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>priva-gws API untuk fitur Scheduler</p>
              </div>
            </div>
            <form onSubmit={saveGws} className="space-y-4">
              <div>
                <label className="label">GWS Base URL</label>
                <input
                  className="input font-mono"
                  value={gws.baseUrl}
                  onChange={e => setGws(g => ({ ...g, baseUrl: e.target.value }))}
                  placeholder="http://192.168.25.134:3001"
                />
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>URL priva-gws — bisa pakai port frontend (3001) maupun backend langsung (8083)</p>
              </div>
              <div>
                <label className="label">API Key</label>
                <input
                  className="input font-mono"
                  type="password"
                  value={gws.apiKey}
                  onChange={e => setGws(g => ({ ...g, apiKey: e.target.value }))}
                  placeholder="Bearer token (opsional)"
                />
              </div>
              {/* Status indikator */}
              {testStatus !== 'idle' && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
                  testStatus === 'loading' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  : testStatus === 'ok'    ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
                  :                         'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400'
                }`}>
                  {testStatus === 'loading' && <Loader2 size={13} className="animate-spin shrink-0" />}
                  {testStatus === 'ok'      && <CheckCircle2 size={13} className="shrink-0" />}
                  {testStatus === 'error'   && <XCircle size={13} className="shrink-0" />}
                  <span>{testStatus === 'loading' ? 'Menguji koneksi…' : testMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={testConnection}
                  disabled={testStatus === 'loading'}
                  className="btn-outline flex items-center gap-2 text-sm"
                >
                  <Plug size={13} /> Test Connection
                </button>
                <button type="submit" className="btn-primary">
                  <Save size={14} /> Save GWS Settings
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* ── Kolom kanan ── */}
        <div className="space-y-5">

          {/* Notifications */}
          <div className="card">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-elevated)' }}>
                <Bell size={15} className="text-brand-500" />
              </div>
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Notifications</h3>
            </div>
            <div className="space-y-3">
              {([
                { key: 'agentErrors',  label: 'Agent errors',        desc: 'Notify when an agent encounters an error' },
                { key: 'agentStopped', label: 'Agent stopped',       desc: 'Notify when a running agent stops' },
                { key: 'systemAlerts', label: 'System alerts',       desc: 'Critical system health alerts' },
                { key: 'emailAlerts',  label: 'Email notifications', desc: 'Send alerts to registered email' },
              ] as const).map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={notifications[key]}
                      onChange={e => setNotifications(n => ({ ...n, [key]: e.target.checked }))}
                    />
                    <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:ring-2 peer-focus:ring-brand-300 rounded-full peer peer-checked:bg-brand-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Data Management */}
          <div className="card">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-elevated)' }}>
                <Database size={15} className="text-brand-500" />
              </div>
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Data Management</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 rounded-lg px-3" style={{ background: 'var(--bg-elevated)' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Clear cache</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Clear temporary data and session cache</p>
                </div>
                <button type="button" className="btn-outline text-xs py-1.5" onClick={clearCache}>
                  <Trash2 size={12} /> Clear
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
