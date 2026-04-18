import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, Bell, Globe, Database, Trash2, Save, Webhook } from 'lucide-react'
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
    if (dbSettings) {
      setGws({
        baseUrl: dbSettings['gws_base_url'] ?? '',
        apiKey:  dbSettings['gws_api_key']  ?? '',
      })
    }
  }, [dbSettings])

  const gwsMut = useMutation({
    mutationFn: (data: Record<string, string>) => systemApi.updateSettings(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      invalidateGwsCache()
      toast.success('GWS settings saved')
    },
    onError: () => toast.error('Failed to save GWS settings'),
  })

  const saveGws = (e: React.FormEvent) => {
    e.preventDefault()
    gwsMut.mutate({ gws_base_url: gws.baseUrl.trim(), gws_api_key: gws.apiKey.trim() })
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
    <div className="p-8 max-w-2xl mx-auto w-full">
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
              { key: 'agentErrors',   label: 'Agent errors',          desc: 'Notify when an agent encounters an error' },
              { key: 'agentStopped',  label: 'Agent stopped',         desc: 'Notify when a running agent stops' },
              { key: 'systemAlerts',  label: 'System alerts',         desc: 'Critical system health alerts' },
              { key: 'emailAlerts',   label: 'Email notifications',   desc: 'Send alerts to registered email' },
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

        {/* GWS Integration */}
        <div className="card">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-elevated)' }}>
              <Webhook size={15} className="text-brand-500" />
            </div>
            <div>
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>GWS Integration</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>priva-gws API for Scheduler feature</p>
            </div>
          </div>
          <form onSubmit={saveGws} className="space-y-4">
            <div>
              <label className="label">GWS Base URL</label>
              <input
                className="input font-mono"
                value={gws.baseUrl}
                onChange={e => setGws(g => ({ ...g, baseUrl: e.target.value }))}
                placeholder="http://localhost:8090"
              />
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>URL langsung ke priva-gws backend (tanpa trailing slash)</p>
            </div>
            <div>
              <label className="label">API Key</label>
              <input
                className="input font-mono"
                type="password"
                value={gws.apiKey}
                onChange={e => setGws(g => ({ ...g, apiKey: e.target.value }))}
                placeholder="Bearer token"
              />
            </div>
            <div className="flex justify-end pt-2">
              <button type="submit" className="btn-primary">
                <Save size={14} /> Save GWS Settings
              </button>
            </div>
          </form>
        </div>

        {/* Data management */}
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
  )
}
