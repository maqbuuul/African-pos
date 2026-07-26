import { Minus, Plus, X } from 'lucide-react'

import { cn } from '../lib/cn.js'
import { Button } from './Button.js'
import { EmptyState } from './EmptyState.js'

export interface CartReviewItem {
  id: string
  name: string
  quantity: number
  lineTotalLabel: string
  modifierSummary?: string | null
  notes?: string | null
}

export interface CartReviewProps {
  items: CartReviewItem[]
  totalLabel: string
  onIncrement: (id: string) => void
  onDecrement: (id: string) => void
  onRemove: (id: string) => void
  onCheckout: () => void
  checkoutLabel?: string
  checkoutLoading?: boolean
  className?: string
}

// Order summary with edit, notes, seat labels — frontend-plan.md's High
// Priority tier, shared by pos-mobile (native) and customer-web (this
// implementation).
export function CartReview({
  items,
  totalLabel,
  onIncrement,
  onDecrement,
  onRemove,
  onCheckout,
  checkoutLabel = 'Place order',
  checkoutLoading = false,
  className,
}: CartReviewProps) {
  if (items.length === 0) {
    return <EmptyState title="Your cart is empty" description="Add items from the menu to start an order." />
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{item.name}</p>
              {item.modifierSummary ? <p className="text-xs text-ink-faint">+ {item.modifierSummary}</p> : null}
              {item.notes ? <p className="text-xs text-ink-faint">Note: {item.notes}</p> : null}
              <div className="mt-1.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onDecrement(item.id)}
                  aria-label={`Decrease quantity of ${item.name}`}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-ink-soft hover:bg-surface-2"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-[1.5rem] text-center text-sm text-ink">{item.quantity}</span>
                <button
                  type="button"
                  onClick={() => onIncrement(item.id)}
                  aria-label={`Increase quantity of ${item.name}`}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-ink-soft hover:bg-surface-2"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className="text-sm font-semibold text-ink">{item.lineTotalLabel}</span>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                aria-label={`Remove ${item.name}`}
                className="text-ink-faint hover:text-status-critical"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="text-sm text-ink-soft">Total</span>
        <span className="text-lg font-semibold text-ink">{totalLabel}</span>
      </div>

      <Button size="lg" className="w-full" onClick={onCheckout} loading={checkoutLoading}>
        {checkoutLabel}
      </Button>
    </div>
  )
}
