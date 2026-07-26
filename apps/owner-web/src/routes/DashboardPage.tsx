import { Card, CardBody, CardHeader, EmptyState, MetricTile, StatusBadge } from '@hospitality-os/ui'

import { useOwnerDashboard } from '../features/dashboard/use-owner-dashboard.js'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(amount)
}

export function DashboardPage() {
  const { data, loading, error } = useOwnerDashboard()
  const benchmark = data?.benchmark

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
        <h1 className="text-2xl font-semibold text-ink">Executive dashboard</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <MetricTile
          label="Revenue this month"
          value={data ? formatCurrency(data.totalMonthRevenue) : ''}
          loading={loading}
          emphasized
        />
        <MetricTile label="Locations" value={data ? String(data.locationCount) : ''} loading={loading} />
        {benchmark?.available ? (
          <MetricTile label="Peer percentile" value={`${benchmark.percentile}th`} loading={loading} />
        ) : (
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-sm text-ink-faint">Peer benchmark</p>
            <p className="mt-1 text-sm text-ink-soft">
              Needs at least {benchmark?.minimumRequired ?? 10} organizations on the platform to compare against — not
              enough data yet.
            </p>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm font-semibold text-ink">Branch comparison</p>
          <StatusBadge tone="neutral" label="This month" />
        </CardHeader>
        <CardBody>
          {data && data.locationBreakdown.length === 0 ? (
            <EmptyState
              title="No locations yet"
              description="Branch revenue will show up here once a location has paid bills this month."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-faint">
                    <th className="pb-2 pr-4 font-medium">Location</th>
                    <th className="pb-2 pr-4 font-medium">Revenue (month)</th>
                    <th className="pb-2 font-medium">Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.locationBreakdown.map((loc) => (
                    <tr key={loc.locationId} className="border-b border-border last:border-0">
                      <td className="py-2 pr-4 text-ink">{loc.locationName}</td>
                      <td className="py-2 pr-4 text-ink-soft">{formatCurrency(loc.monthRevenue)}</td>
                      <td className="py-2 text-ink-soft">{loc.orderCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
