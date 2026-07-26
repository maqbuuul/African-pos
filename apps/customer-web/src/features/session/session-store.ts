import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { api, apiClient, type CreateSessionResponse } from '../../lib/api-client.js'

interface SessionState {
  token: string | null
  table: CreateSessionResponse['table'] | null
  hydrated: boolean
  startSession: (qrSlug: string) => Promise<void>
  clearSession: () => void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      table: null,
      hydrated: false,
      startSession: async (qrSlug) => {
        const res = await api.createSession(qrSlug)
        apiClient.setToken(res.token)
        set({ token: res.token, table: res.table })
      },
      clearSession: () => {
        apiClient.setToken(null)
        set({ token: null, table: null })
      },
    }),
    {
      name: 'customer-web-session',
      onRehydrateStorage: () => (state) => {
        if (state) {
          apiClient.setToken(state.token)
          state.hydrated = true
        }
      },
    },
  ),
)
