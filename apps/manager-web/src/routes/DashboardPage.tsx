import { Card, CardBody, EmptyState, MetricTile } from '@hospitality-os/ui'
import { useEffect } from 'react'

import { useAuthStore } from '../features/auth/auth-store.js'
import { useManagerDashboard } from '../features/dashboard/use-manager-dashboard.js'
import { useLocations } from '../features/locations/use-locations.js'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(amount)
}

function LocationPicker({ organizationId }: { organizationId: string }) {
  const { locations, loading, error } = useLocations(organizationId)
  const setLocationId = useAuthStore((s) => s.setLocationId)
  const soleLocationId = locations.length === 1 ? locations[0]?.id : undefined

  useEffect(() => {
    if (soleLocationId) setLocationId(soleLocationId)
  }, [soleLocationId, setLocationId])

  if (loading) return <p className="text-sm text-ink-faint">Loading locations…</p>
  if (error) return <p className="text-sm text-status-critical">{error}</p>
  if (locations.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No locations yet"
          description="This organization has no active locations — add one before dashboards have data to show."
        />
      </Card>
    )
  }
  if (soleLocationId) {
    return <p className="text-sm text-ink-faint">Loading dashboard…</p>
  }

  return (
    <Card>
      <CardBody>
        <p className="mb-3 text-sm font-medium text-ink">Choose a location</p>
        <div className="flex flex-wrap gap-2">
          {locations.map((loc) => (
            <button
              key={loc.id}
              type="button"
              onClick={() => setLocationId(loc.id)}
              className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm font-medium text-ink hover:bg-border"
            >
              {loc.name}
            </button>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const locationId = useAuthStore((s) => s.locationId)

  if (!locationId) {
    return user ? <LocationPicker organizationId={user.organizationId} /> : null
  }

  return <DashboardContent locationId={locationId} />
}

function DashboardContent({ locationId }: { locationId: string }) {
  const { data, loading, error } = useManagerDashboard(locationId)

  if (error) {
    return (
      <Card>
        <EmptyState title="Couldn't load the dashboard" description={error} />
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-ink-faint">African POS</p>
        <h1 className="text-2xl font-semibold text-ink">Today</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricTile
          label="Revenue today"
          value={data ? formatCurrency(data.today.revenueToday) : ''}
          trend={data?.today.changeVsYesterday}
          loading={loading}
          emphasized
        />
        <MetricTile label="Open orders" value={data ? String(data.today.openOrders) : ''} loading={loading} />
        <MetricTile label="Low stock alerts" value={data ? String(data.today.lowStockAlerts) : ''} loading={loading} />
        <MetricTile
          label="Staff shifts today"
          value={data ? String(data.staffToday.attendance.length) : ''}
          loading={loading}
        />
      </div>

      {data && data.inventory.lowStock.length > 0 ? (
        <Card>
          <CardBody>
            <p className="mb-3 text-sm font-semibold text-ink">Low stock</p>
            <ul className="space-y-1.5">
              {data.inventory.lowStock.slice(0, 8).map((item) => (
                <li key={item.itemId} className="flex items-center justify-between text-sm">
                  <span className="text-ink-soft">{item.itemName}</span>
                  <span className="text-status-attention">
                    {item.currentStock ?? 0} / {item.reorderPoint}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}
