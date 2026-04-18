import axios from 'axios'

// Client ke priva-gws via nginx proxy /gws/
const gwsClient = axios.create({
  baseURL: '/gws',
  headers: { 'Content-Type': 'application/json' },
})

// Inject API key from env or localStorage
gwsClient.interceptors.request.use(cfg => {
  const key = localStorage.getItem('gws_api_key') || import.meta.env.VITE_GWS_API_KEY || ''
  if (key) cfg.headers['Authorization'] = `Bearer ${key}`
  return cfg
})

export interface Scheduler {
  id: string
  tenant_id: string
  user_id: string
  name: string
  spreadsheet_id: string
  sheet_range: string
  check_mode: 'sheets' | 'drive'
  drive_file_id: string
  interval_seconds: number
  webhook_url: string
  webhook_secret: string
  is_active: boolean
  last_triggered_at: string | null
  last_checked_at: string | null
  trigger_count: number
  error_msg: string
  created_at: string
  updated_at: string
  running: boolean
}

export interface CreateSchedulerPayload {
  name: string
  spreadsheet_id: string
  sheet_range: string
  check_mode: 'sheets' | 'drive'
  drive_file_id: string
  interval_seconds: number
  webhook_url: string
  webhook_secret: string
  is_active: boolean
}

interface GWSResponse<T> {
  status: string
  data: T
  error?: { code: string; message: string }
}

export const schedulerApi = {
  list: () =>
    gwsClient.get<GWSResponse<Scheduler[]>>('/api/v1.0/schedulers').then(r => r.data),

  create: (payload: CreateSchedulerPayload) =>
    gwsClient.post<GWSResponse<Scheduler>>('/api/v1.0/schedulers', payload).then(r => r.data),

  update: (id: string, payload: Partial<CreateSchedulerPayload>) =>
    gwsClient.put<GWSResponse<Scheduler>>(`/api/v1.0/schedulers/${id}`, payload).then(r => r.data),

  delete: (id: string) =>
    gwsClient.delete<GWSResponse<{ deleted: boolean; id: string }>>(`/api/v1.0/schedulers/${id}`).then(r => r.data),

  toggle: (id: string) =>
    gwsClient.post<GWSResponse<{ id: string; is_active: boolean }>>(`/api/v1.0/schedulers/${id}/toggle`).then(r => r.data),
}
