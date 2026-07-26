import { ApiError } from '@hospitality-os/api-client'
import { useEffect, useState } from 'react'

import { apiClient } from '../../lib/api-client.js'

export interface ManagerDashboardData {
  today: {
    revenueToday: number
    revenueYesterday: number
    changeVsYesterday: number
    openOrders: number
    lowStockAlerts: number
  }
  staffToday: {
    attendance: Array<{ staffId: string; staffName: string | null; totalShifts: number; closedShifts: number; totalRevenue: number }>
    performance: Array<{ staffId: string; staffName: string | null; totalOrders: number; totalRevenue: number }>
  }
  inventory: {
    stockValue: Array<{ category: string | null; totalItems: number; totalStock: number; totalValue: number }>
    lowStock: Array<{ itemId: string; itemName: string; currentStock: number | null; reorderPoint: number }>
  }
}

interface State {
  data: ManagerDashboardData | null
  loading: boolean
  error: string | null
}

export function useManagerDashboard(locationId: string | null) {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null })

  useEffect(() => {
    if (!locationId) return
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))

    apiClient
      .get<ManagerDashboardData>(`/api/v1/dashboards/manager?locationId=${locationId}`)
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
  }, [locationId])

  return state
}
