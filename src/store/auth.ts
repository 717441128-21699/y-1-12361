import { create } from 'zustand'
import { auth as api } from '@/utils/api'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  fetchMe: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  loading: false,

  login: async (username: string, password: string) => {
    set({ loading: true })
    try {
      const data = await api.login(username, password)
      localStorage.setItem('token', data.token)
      set({
        user: data.user,
        token: data.token,
        isAuthenticated: true,
        loading: false,
      })
    } catch (err) {
      set({ loading: false })
      throw err
    }
  },

  logout: () => {
    localStorage.removeItem('token')
    set({ user: null, token: null, isAuthenticated: false })
  },

  fetchMe: async () => {
    try {
      const user = await api.getMe()
      set({ user, isAuthenticated: true })
    } catch {
      localStorage.removeItem('token')
      set({ user: null, token: null, isAuthenticated: false })
    }
  },
}))
