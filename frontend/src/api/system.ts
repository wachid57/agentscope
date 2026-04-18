import client from './client'
import type { Overview, ModelProvider_Info, BuiltinTool, ResourcesResponse } from '../types'

export const systemApi = {
  overview: () => client.get<Overview>('/overview').then(r => r.data),
  providers: () => client.get<{ data: ModelProvider_Info[] }>('/providers').then(r => r.data),
  tools: () => client.get<{ data: BuiltinTool[] }>('/tools').then(r => r.data),
  resources: () => client.get<ResourcesResponse>('/resources').then(r => r.data),
  getSettings: () => client.get<{ data: Record<string, string> }>('/settings').then(r => r.data.data),
  updateSettings: (data: Record<string, string>) => client.put<{ data: Record<string, string> }>('/settings', data).then(r => r.data.data),
}
