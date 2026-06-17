import type {
  User,
  Field,
  FieldDetail,
  Sensor,
  Valve,
  Pump,
  IrrigationPlan,
  IrrigationRecommendation,
  WorkOrder,
  WaterUsage,
  DashboardData,
  SettingsRules,
} from '@/types'

const BASE_URL = '/api'

function getToken(): string | null {
  return localStorage.getItem('token')
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error || `请求失败 (${res.status})`)
  }

  const json = await res.json()
  if (!json.success) {
    throw new Error(json.error || '请求失败')
  }
  return json.data as T
}

export const auth = {
  login: (username: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  getMe: () => request<User>('/auth/me'),
}

export const fields = {
  list: () => request<Field[]>('/fields'),

  get: (id: number) => request<FieldDetail>(`/fields/${id}`),

  create: (data: Partial<Field>) =>
    request<{ id: number }>('/fields', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, data: Partial<Field>) =>
    request<void>(`/fields/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    request<void>(`/fields/${id}`, { method: 'DELETE' }),
}

export const devices = {
  listSensors: (fieldId?: number) => {
    const params = fieldId ? `?fieldId=${fieldId}` : ''
    return request<Sensor[]>(`/devices/sensors${params}`)
  },

  listValves: (fieldId?: number) => {
    const params = fieldId ? `?fieldId=${fieldId}` : ''
    return request<Valve[]>(`/devices/valves${params}`)
  },

  listPumps: (fieldId?: number) => {
    const params = fieldId ? `?fieldId=${fieldId}` : ''
    return request<Pump[]>(`/devices/pumps${params}`)
  },

  toggleValve: (id: number, action?: 'open' | 'closed') =>
    request<{ id: number; status: string }>(`/devices/valves/${id}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),
}

export const irrigation = {
  listPlans: (params?: { date?: string; fieldId?: number }) => {
    const qs = new URLSearchParams()
    if (params?.date) qs.set('date', params.date)
    if (params?.fieldId) qs.set('fieldId', String(params.fieldId))
    const query = qs.toString()
    return request<IrrigationPlan[]>(`/irrigation/plans${query ? `?${query}` : ''}`)
  },

  generatePlans: (date?: string) =>
    request<{ id: number; fieldId: number; fieldName: string; waterAmount: number }[]>(
      '/irrigation/plans/generate',
      {
        method: 'POST',
        body: JSON.stringify({ date }),
      }
    ),

  updatePlan: (id: number, data: Partial<IrrigationPlan>) =>
    request<void>(`/irrigation/plans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getRecommendations: (date?: string) => {
    const params = date ? `?date=${date}` : ''
    return request<IrrigationRecommendation[]>(`/irrigation/recommendations${params}`)
  },
}

export const workorders = {
  list: (params?: { status?: string; assignedTo?: number }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.assignedTo) qs.set('assignedTo', String(params.assignedTo))
    const query = qs.toString()
    return request<WorkOrder[]>(`/workorders${query ? `?${query}` : ''}`)
  },

  create: (data: Partial<WorkOrder>) =>
    request<{ id: number }>('/workorders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  accept: (id: number) =>
    request<void>(`/workorders/${id}/accept`, { method: 'PUT' }),

  complete: (id: number, photos?: string[]) =>
    request<void>(`/workorders/${id}/complete`, {
      method: 'PUT',
      body: JSON.stringify({ photos }),
    }),

  escalate: (id: number) =>
    request<void>(`/workorders/${id}/escalate`, { method: 'PUT' }),
}

export const water = {
  getUsage: (params?: { fieldId?: number; cropType?: string; month?: string }) => {
    const qs = new URLSearchParams()
    if (params?.fieldId) qs.set('fieldId', String(params.fieldId))
    if (params?.cropType) qs.set('cropType', params.cropType)
    if (params?.month) qs.set('month', params.month)
    const query = qs.toString()
    return request<WaterUsage[]>(`/water/usage${query ? `?${query}` : ''}`)
  },

  updateQuota: (fieldId: number, monthlyQuota: number) =>
    request<void>(`/water/quota/${fieldId}`, {
      method: 'PUT',
      body: JSON.stringify({ monthlyQuota }),
    }),

  approve: (fieldId: number) =>
    request<void>(`/water/approve/${fieldId}`, { method: 'POST' }),

  exportReport: (month?: string) => {
    const params = month ? `?month=${month}` : ''
    return request<{ month: string; records: any[] }>(`/water/export${params}`)
  },
}

export const dashboard = {
  getRealtime: () => request<DashboardData>('/dashboard/realtime'),
}

export const settings = {
  listUsers: () => request<User[]>('/settings/users'),

  createUser: (data: { username: string; password: string; role: string; fieldIds?: number[] }) =>
    request<{ id: number }>('/settings/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateUser: (id: number, data: { role?: string; fieldIds?: number[]; status?: string }) =>
    request<void>(`/settings/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getRules: () => request<SettingsRules>('/settings/rules'),

  updateRules: (data: Partial<SettingsRules>) =>
    request<void>('/settings/rules', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
}
