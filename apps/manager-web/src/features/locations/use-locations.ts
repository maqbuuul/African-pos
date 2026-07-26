import { ApiError } from '@hospitality-os/api-client'
import { useEffect, useState } from 'react'

import { apiClient } from '../../lib/api-client.js'

export interface Location {
  id: string
  name: string
  code: string
  status: string
}

interface State {
  locations: Location[]
  loading: boolean
  error: string | null
}

export function useLocations(organizationId: string | null) {
  const [state, setState] = useState<State>({ locations: [], loading: true, error: null })

  useEffect(() => {
    if (!organizationId) return
    let cancelled = false
    apiClient
      .get<Location[]>(`/api/v1/organizations/${organizationId}/locations`)
      .then((locations) => {
        if (!cancelled) setState({ locations, loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = ApiError.isApiError(err) ? err.message : 'Could not load locations for this organization.'
        setState({ locations: [], loading: false, error: message })
      })
    return () => {
      cancelled = true
    }
  }, [organizationId])

  return state
}
