import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { apiClient } from '../../lib/api-client.js'

export interface AuthUser {
  id: string
  name: string
  email: string
  organizationId: string
}

interface OwnerLoginResponse {
  token: string
  refreshToken: string
  user: AuthUser
}

interface AuthState {
  token: string | null
  refreshToken: string | null
  user: AuthUser | null
  hydrated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      hydrated: false,
      login: async (email, password) => {
        const res = await apiClient.post<OwnerLoginResponse>('/api/v1/auth/owner/login', { email, password })
        apiClient.setToken(res.token)
        set({ token: res.token, refreshToken: res.refreshToken, user: res.user })
      },
      logout: () => {
        apiClient.setToken(null)
        set({ token: null, refreshToken: null, user: null })
      },
    }),
    {
      name: 'owner-web-auth',
      onRehydrateStorage: () => (state) => {
        if (state) {
          apiClient.setToken(state.token)
          state.hydrated = true
        }
      },
    },
  ),
)
