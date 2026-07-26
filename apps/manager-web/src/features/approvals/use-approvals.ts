import { ApiError } from '@hospitality-os/api-client'
import type { ApprovalRequestItem } from '@hospitality-os/ui'
import { useCallback, useEffect, useState } from 'react'

import { apiClient } from '../../lib/api-client.js'

interface State {
  items: ApprovalRequestItem[]
  loading: boolean
  error: string | null
  resolvingId: string | null
}

export function useApprovals() {
  const [state, setState] = useState<State>({ items: [], loading: true, error: null, resolvingId: null })

  const refetch = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }))
    return apiClient
      .get<ApprovalRequestItem[]>('/api/v1/approvals')
      .then((items) => setState((s) => ({ ...s, items, loading: false })))
      .catch((err: unknown) => {
        const message = ApiError.isApiError(err) ? err.message : 'Could not load approvals — check your connection and try again.'
        setState((s) => ({ ...s, loading: false, error: message }))
      })
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  const resolve = useCallback(
    async (id: string, outcome: 'approve' | 'reject') => {
      setState((s) => ({ ...s, resolvingId: id }))
      try {
        await apiClient.post(`/api/v1/approvals/${id}/${outcome}`)
        setState((s) => ({ ...s, items: s.items.filter((item) => item.id !== id), resolvingId: null }))
      } catch (err) {
        const message = ApiError.isApiError(err) ? err.message : `Could not ${outcome} this request — try again.`
        setState((s) => ({ ...s, resolvingId: null, error: message }))
      }
    },
    [],
  )

  return {
    ...state,
    approve: (id: string) => resolve(id, 'approve'),
    reject: (id: string) => resolve(id, 'reject'),
  }
}
