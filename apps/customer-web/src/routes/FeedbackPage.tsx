import { Button, Card, CardBody } from '@hospitality-os/ui'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'

import { StarRating } from '../components/StarRating.js'
import { useOrderStore } from '../features/order/order-store.js'
import { useSessionStore } from '../features/session/session-store.js'
import { api } from '../lib/api-client.js'

export function FeedbackPage() {
  const token = useSessionStore((s) => s.token)
  const items = useOrderStore((s) => s.items)
  const navigate = useNavigate()

  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (!token) return <Navigate to="/" replace />

  const handleSubmit = async () => {
    if (rating === 0 || items.length === 0) return
    setSubmitting(true)
    try {
      // The backend rates individual order items, not the order as a whole
      // — "how was your meal" applies that one rating to every item ordered.
      await Promise.all(items.map((item) => api.submitFeedback(token, item.id, rating, comment || undefined)))
      setSent(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardBody className="text-center">
        {sent ? (
          <>
            <h2 className="text-lg font-semibold text-ink">Thank you!</h2>
            <p className="mt-1 text-sm text-ink-soft">Your feedback helps us improve.</p>
            <Button className="mt-4" onClick={() => navigate('/')}>
              Back to menu
            </Button>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-ink">How was your meal?</h2>
            <p className="mt-1 text-sm text-ink-soft">Tap a star to rate</p>

            <div className="my-4">
              <StarRating value={rating} onChange={setRating} />
            </div>

            <label className="mb-4 block text-left text-sm font-medium text-ink">
              Comment (optional)
              <input
                type="text"
                placeholder="Tell us about your experience…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </label>

            <Button className="w-full" onClick={handleSubmit} disabled={rating === 0} loading={submitting}>
              Submit feedback
            </Button>
          </>
        )}
      </CardBody>
    </Card>
  )
}
