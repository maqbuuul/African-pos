import { Button, Card, CardBody, CardHeader, EmptyState, Modal, StatusBadge } from '@hospitality-os/ui'
import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'

import { StarRating } from '../components/StarRating.js'
import { useOrderStore } from '../features/order/order-store.js'
import { useSessionStore } from '../features/session/session-store.js'
import { api } from '../lib/api-client.js'
import { formatMoney } from '../lib/format.js'

const ORDER_STATUS_STEPS = [
  { key: 'draft', label: 'Order placed' },
  { key: 'sent_to_kitchen', label: 'Sent to kitchen' },
  { key: 'ready', label: 'Ready' },
  { key: 'served', label: 'Served' },
  { key: 'bill_requested', label: 'Bill requested' },
]

export function OrderStatusPage() {
  const token = useSessionStore((s) => s.token)
  const order = useOrderStore((s) => s.order)
  const items = useOrderStore((s) => s.items)
  const bill = useOrderStore((s) => s.bill)
  const fireCourse = useOrderStore((s) => s.fireCourse)
  const requestBill = useOrderStore((s) => s.requestBill)
  const refresh = useOrderStore((s) => s.refresh)
  const navigate = useNavigate()

  const [refreshing, setRefreshing] = useState(false)
  const [firingCourse, setFiringCourse] = useState<string | null>(null)
  const [requestingBill, setRequestingBill] = useState(false)
  const [billError, setBillError] = useState<string | null>(null)
  const [waiterReason, setWaiterReason] = useState('')
  const [waiterSent, setWaiterSent] = useState(false)
  const [ratingItemId, setRatingItemId] = useState<string | null>(null)
  const [ratingValue, setRatingValue] = useState(0)
  const [ratedItemIds, setRatedItemIds] = useState<Record<string, boolean>>({})

  if (!order) return <Navigate to="/" replace />

  const statusIndex = ORDER_STATUS_STEPS.findIndex((s) => s.key === order.status)
  const futureCourses = [...new Set(items.filter((item) => item.course && item.status === 'draft').map((item) => item.course!))]

  const handleRefresh = async () => {
    if (!token) return
    setRefreshing(true)
    try {
      await refresh(token)
    } finally {
      setRefreshing(false)
    }
  }

  const handleFireCourse = async (courseName: string) => {
    if (!token) return
    setFiringCourse(courseName)
    try {
      await fireCourse(token, courseName)
    } finally {
      setFiringCourse(null)
    }
  }

  const handleRequestBill = async () => {
    if (!token) return
    setRequestingBill(true)
    setBillError(null)
    try {
      await requestBill(token)
    } catch {
      setBillError('Could not request the bill — check your connection and try again.')
    } finally {
      setRequestingBill(false)
    }
  }

  const handleRequestWaiter = async () => {
    if (!token) return
    await api.requestWaiter(token, waiterReason || undefined)
    setWaiterSent(true)
    setTimeout(() => setWaiterSent(false), 3000)
  }

  const handleRateDish = async () => {
    if (!token || !ratingItemId || ratingValue === 0) return
    await api.rateDish(token, ratingItemId, ratingValue)
    setRatedItemIds((prev) => ({ ...prev, [ratingItemId]: true }))
    setRatingItemId(null)
    setRatingValue(0)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <p className="text-sm font-semibold text-ink">Order status</p>
          <div className="flex items-center gap-2">
            <StatusBadge tone={order.status === 'paid' ? 'healthy' : 'active'} label={order.status.replace(/_/g, ' ')} />
            <button
              type="button"
              onClick={handleRefresh}
              aria-label="Refresh order status"
              disabled={refreshing}
              className="text-ink-faint hover:text-ink disabled:opacity-50"
            >
              <RefreshCw className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            </button>
          </div>
        </CardHeader>
        <CardBody>
          <ol className="flex flex-wrap gap-3">
            {ORDER_STATUS_STEPS.map((step, idx) => (
              <li key={step.key} className="flex items-center gap-2 text-sm">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    idx <= statusIndex ? 'bg-primary text-primary-ink' : 'bg-surface-2 text-ink-faint'
                  }`}
                >
                  {idx < statusIndex ? '✓' : idx + 1}
                </span>
                <span className={idx <= statusIndex ? 'text-ink' : 'text-ink-faint'}>{step.label}</span>
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm font-semibold text-ink">Order items</p>
          <span className="text-sm text-ink-soft">{formatMoney(order.totalAmount, order.currency)}</span>
        </CardHeader>
        <CardBody className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0">
              <div>
                <p className="text-sm text-ink">
                  {item.quantity}x {item.nameSnapshot}
                </p>
                <p className="text-xs text-ink-faint">{formatMoney(item.totalAmount, order.currency)}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge tone={item.status === 'served' ? 'healthy' : 'active'} label={item.status.replace(/_/g, ' ')} />
                {item.status === 'served' && !ratedItemIds[item.id] ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRatingItemId(item.id)
                      setRatingValue(0)
                    }}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Rate
                  </button>
                ) : ratedItemIds[item.id] ? (
                  <span className="text-xs text-status-healthy">Rated</span>
                ) : null}
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      {futureCourses.length > 0 ? (
        <Card>
          <CardHeader>
            <p className="text-sm font-semibold text-ink">Courses</p>
          </CardHeader>
          <CardBody className="flex flex-col gap-2">
            {futureCourses.map((courseName) => (
              <Button key={courseName} onClick={() => handleFireCourse(courseName)} loading={firingCourse === courseName}>
                Fire {courseName}
              </Button>
            ))}
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <p className="text-sm font-semibold text-ink">Payment</p>
        </CardHeader>
        <CardBody>
          {billError ? <p className="mb-3 text-sm text-status-critical">{billError}</p> : null}
          {bill ? (
            <>
              <p className="mb-3 text-sm text-ink-soft">
                Total due: <span className="font-semibold text-ink">{formatMoney(bill.totalAmount, order.currency)}</span>
              </p>
              <Button className="w-full" onClick={() => navigate('/payment')}>
                Pay with M-Pesa
              </Button>
            </>
          ) : order.status === 'draft' ? (
            <p className="text-sm text-ink-soft">Your order has been received — staff will confirm it with the kitchen shortly.</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-ink-soft">Ready to pay? Request your bill to see the total due.</p>
              <Button className="w-full" onClick={handleRequestBill} loading={requestingBill}>
                Request bill
              </Button>
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm font-semibold text-ink">Need assistance?</p>
        </CardHeader>
        <CardBody className="flex gap-2">
          <input
            type="text"
            placeholder="Reason (optional)"
            value={waiterReason}
            onChange={(e) => setWaiterReason(e.target.value)}
            className="h-11 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          <Button variant="secondary" onClick={handleRequestWaiter}>
            {waiterSent ? 'Notified!' : 'Call waiter'}
          </Button>
        </CardBody>
      </Card>

      {items.length === 0 ? <EmptyState title="No items" description="This order has no items yet." /> : null}

      <Modal
        open={ratingItemId !== null}
        onOpenChange={(open) => !open && setRatingItemId(null)}
        title="Rate this dish"
        description="Tap a star to rate"
      >
        <StarRating value={ratingValue} onChange={setRatingValue} />
        <Button className="mt-4 w-full" onClick={handleRateDish} disabled={ratingValue === 0}>
          Submit rating
        </Button>
      </Modal>
    </div>
  )
}
