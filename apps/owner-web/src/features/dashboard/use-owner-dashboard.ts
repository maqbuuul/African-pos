import { ApiError } from '@hospitality-os/api-client'
import { useEffect, useState } from 'react'

import { apiClient } from '../../lib/api-client.js'

export interface OwnerDashboardData {
  locationCount: number
  totalMonthRevenue: number
  locationBreakdown: Array<{
    locationId: string
    locationName: string
    monthRevenue: number
    orderCount: number
  }>
  benchmark:
    | { available: false; minimumRequired: number; currentCount: number }
    | { available: true; percentile: number; currentValue: number }
}

interface State {
  data: OwnerDashboardData | null
  loading: boolean
  error: string | null
}

export function useOwnerDashboard() {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    apiClient
      .get<OwnerDashboardData>('/api/v1/dashboards/owner')
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = ApiError.isApiError(err) ? err.message : 'Could not load the dashboard — check your connection and try again.'
        setState({ data: null, loading: false, error: message })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
