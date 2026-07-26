import { Button, Card, CardBody, CardHeader, Input } from '@hospitality-os/ui'
import { type FormEvent, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'

import { useOrderStore } from '../features/order/order-store.js'
import { useSessionStore } from '../features/session/session-store.js'
import { api } from '../lib/api-client.js'
import { formatMoney } from '../lib/format.js'

const MPESA_PHONE_PATTERN = /^(\+?254|0)7\d{8}$/

export function PaymentPage() {
  const token = useSessionStore((s) => s.token)
  const order = useOrderStore((s) => s.order)
  const bill = useOrderStore((s) => s.bill)
  const navigate = useNavigate()

  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!order || !bill) return <Navigate to="/" replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!token) return
    if (!MPESA_PHONE_PATTERN.test(phone)) {
      setError('That doesn\'t look like an M-Pesa number — use a format like 0712345678.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await api.payMpesa(token, order.id, phone, crypto.randomUUID())
      navigate('/feedback')
    } catch {
      setError('Could not start the M-Pesa payment — check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <p className="text-sm font-semibold text-ink">Pay with M-Pesa</p>
      </CardHeader>
      <CardBody>
        <p className="mb-4 text-sm text-ink-soft">
          Total: <span className="font-semibold text-ink">{formatMoney(bill.totalAmount, order.currency)}</span>
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="M-Pesa phone number"
            type="tel"
            placeholder="e.g. 0712345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={error ?? undefined}
          />
          <Button type="submit" className="w-full" loading={loading}>
            Pay {formatMoney(bill.totalAmount, order.currency)}
          </Button>
        </form>
        <p className="mt-3 text-xs text-ink-faint">You will receive an M-Pesa prompt on your phone. Enter your PIN to confirm.</p>
      </CardBody>
    </Card>
  )
}
