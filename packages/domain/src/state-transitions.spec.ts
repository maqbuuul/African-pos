import { describe, expect, it } from 'vitest'
import {
  BILL_STATUS_TRANSITIONS,
  type BillStatus,
  computeChangeDenominations,
  KDS_TICKET_ITEM_STATUS_TRANSITIONS,
  KDS_TICKET_STATUS_TRANSITIONS,
  type KdsTicketItemStatus,
  type KdsTicketStatus,
  ORDER_ITEM_PRE_SEND_STATUSES,
  ORDER_ITEM_STATUS_TRANSITIONS,
  ORDER_STATUS_TRANSITIONS,
  ORDER_VOIDABLE_PRE_PAYMENT,
  type OrderItemStatus,
  type OrderStatus,
  PAYMENT_INTENT_STATUS_TRANSITIONS,
  type PaymentIntentStatus,
  SHIFT_STATUS_TRANSITIONS,
  type ShiftStatus,
  TABLE_REOPEN_TRANSITIONS,
  TABLE_STATE_TRANSITIONS,
  type TableStatus,
} from './index.js'

// A state machine with a state that has no outgoing edges and isn't reachable
// from anywhere is either dead code or a modeling bug — this is the class of
// error these tests exist to catch cheaply, without booting a database.
function assertNoDanglingStates<T extends string>(transitions: Readonly<Record<T, readonly T[]>>): void {
  const allStates = Object.keys(transitions) as T[]
  for (const state of allStates) {
    for (const target of transitions[state]) {
      expect(allStates, `unknown target state "${target}" reachable from "${state}"`).toContain(target)
    }
  }
}

describe('state machine structural integrity', () => {
  it('every transition table only points at states it itself defines', () => {
    assertNoDanglingStates<TableStatus>(TABLE_STATE_TRANSITIONS)
    assertNoDanglingStates<OrderStatus>(ORDER_STATUS_TRANSITIONS)
    assertNoDanglingStates<OrderItemStatus>(ORDER_ITEM_STATUS_TRANSITIONS)
    assertNoDanglingStates<KdsTicketStatus>(KDS_TICKET_STATUS_TRANSITIONS)
    assertNoDanglingStates<KdsTicketItemStatus>(KDS_TICKET_ITEM_STATUS_TRANSITIONS)
    assertNoDanglingStates<BillStatus>(BILL_STATUS_TRANSITIONS)
    assertNoDanglingStates<ShiftStatus>(SHIFT_STATUS_TRANSITIONS)
    assertNoDanglingStates<PaymentIntentStatus>(PAYMENT_INTENT_STATUS_TRANSITIONS)
  })
})

describe('TABLE_STATE_TRANSITIONS (PRD 04)', () => {
  it('allows the full happy-path service loop', () => {
    expect(TABLE_STATE_TRANSITIONS.available).toContain('seated')
    expect(TABLE_STATE_TRANSITIONS.seated).toContain('ordered')
    expect(TABLE_STATE_TRANSITIONS.ordered).toContain('food_ready')
    expect(TABLE_STATE_TRANSITIONS.food_ready).toContain('eating')
    expect(TABLE_STATE_TRANSITIONS.eating).toContain('bill_requested')
    expect(TABLE_STATE_TRANSITIONS.bill_requested).toContain('payment_pending')
    expect(TABLE_STATE_TRANSITIONS.payment_pending).toContain('paid')
    expect(TABLE_STATE_TRANSITIONS.paid).toContain('cleaning')
    expect(TABLE_STATE_TRANSITIONS.cleaning).toContain('available')
  })

  it('reserved/blocked are reachable from every active state (manager pull-out-of-rotation)', () => {
    const active: TableStatus[] = ['available', 'seated', 'ordered', 'food_ready', 'eating', 'bill_requested', 'payment_pending', 'paid', 'cleaning']
    for (const state of active) {
      expect(TABLE_STATE_TRANSITIONS[state]).toContain('reserved')
      expect(TABLE_STATE_TRANSITIONS[state]).toContain('blocked')
    }
  })

  it('rejects skipping straight from available to eating', () => {
    expect(TABLE_STATE_TRANSITIONS.available).not.toContain('eating')
  })

  it('rejects going backward from paid to seated', () => {
    expect(TABLE_STATE_TRANSITIONS.paid).not.toContain('seated')
  })

  it('flags exactly bill_requested->eating and payment_pending->eating as reopen transitions', () => {
    expect(TABLE_REOPEN_TRANSITIONS.has('bill_requested->eating')).toBe(true)
    expect(TABLE_REOPEN_TRANSITIONS.has('payment_pending->eating')).toBe(true)
    expect(TABLE_REOPEN_TRANSITIONS.has('seated->available')).toBe(false)
    expect(TABLE_REOPEN_TRANSITIONS.size).toBe(2)
  })

  it('terminal-looking blocked/reserved states can only return to available/seated', () => {
    expect(TABLE_STATE_TRANSITIONS.blocked).toEqual(['available'])
    expect(TABLE_STATE_TRANSITIONS.reserved).toEqual(['available', 'seated', 'blocked'])
  })
})

describe('ORDER_STATUS_TRANSITIONS (PRD 05)', () => {
  it('allows the QR-ordering path straight from draft to sent_to_kitchen, bypassing open', () => {
    expect(ORDER_STATUS_TRANSITIONS.draft).toContain('sent_to_kitchen')
  })

  it('allows the staff-POS path from open to sent_to_kitchen', () => {
    expect(ORDER_STATUS_TRANSITIONS.open).toContain('sent_to_kitchen')
  })

  it('paid is a dead end except for refunded', () => {
    expect(ORDER_STATUS_TRANSITIONS.paid).toEqual(['refunded'])
  })

  it('voided and refunded are true terminal states', () => {
    expect(ORDER_STATUS_TRANSITIONS.voided).toEqual([])
    expect(ORDER_STATUS_TRANSITIONS.refunded).toEqual([])
  })

  it('every pre-payment status in ORDER_VOIDABLE_PRE_PAYMENT can actually reach voided', () => {
    for (const status of ORDER_VOIDABLE_PRE_PAYMENT) {
      expect(ORDER_STATUS_TRANSITIONS[status]).toContain('voided')
    }
  })

  it('paid and beyond are excluded from ORDER_VOIDABLE_PRE_PAYMENT', () => {
    expect(ORDER_VOIDABLE_PRE_PAYMENT).not.toContain('paid')
    expect(ORDER_VOIDABLE_PRE_PAYMENT).not.toContain('voided')
    expect(ORDER_VOIDABLE_PRE_PAYMENT).not.toContain('refunded')
  })

  it('sent_to_kitchen/partially_ready/ready can each jump directly to bill_requested (split-without-full-serve path)', () => {
    expect(ORDER_STATUS_TRANSITIONS.sent_to_kitchen).toContain('bill_requested')
    expect(ORDER_STATUS_TRANSITIONS.partially_ready).toContain('bill_requested')
    expect(ORDER_STATUS_TRANSITIONS.ready).toContain('bill_requested')
  })
})

describe('ORDER_ITEM_STATUS_TRANSITIONS (PRD 05/06)', () => {
  it('only draft items are pre-send (immediate void, no approval)', () => {
    expect(ORDER_ITEM_PRE_SEND_STATUSES.has('draft')).toBe(true)
    expect(ORDER_ITEM_PRE_SEND_STATUSES.has('sent')).toBe(false)
    expect(ORDER_ITEM_PRE_SEND_STATUSES.size).toBe(1)
  })

  it('served items can only be voided or comped, never re-enter kitchen states', () => {
    expect(ORDER_ITEM_STATUS_TRANSITIONS.served).toEqual(['voided', 'comped'])
  })

  it('void_requested can only resolve to voided, not silently vanish elsewhere', () => {
    expect(ORDER_ITEM_STATUS_TRANSITIONS.void_requested).toEqual(['voided'])
  })

  it('ready items can be recalled back to in_progress by the kitchen', () => {
    expect(ORDER_ITEM_STATUS_TRANSITIONS.ready).toContain('in_progress')
  })
})

describe('KDS ticket-item state machine (PRD 06)', () => {
  it('ready items support a bounded recall back to in_progress, not a separate status', () => {
    expect(KDS_TICKET_ITEM_STATUS_TRANSITIONS.ready).toEqual(['in_progress', 'void_requested'])
  })

  it('voided is terminal', () => {
    expect(KDS_TICKET_ITEM_STATUS_TRANSITIONS.voided).toEqual([])
  })
})

describe('BILL_STATUS_TRANSITIONS (PRD 07)', () => {
  it('payment_pending can revert to open if a payment attempt fails', () => {
    expect(BILL_STATUS_TRANSITIONS.payment_pending).toContain('open')
  })

  it('paid bills can only move into a refund state, never back to open', () => {
    expect(BILL_STATUS_TRANSITIONS.paid).toEqual(['refunded', 'partially_refunded'])
  })
})

describe('SHIFT_STATUS_TRANSITIONS (PRD 08)', () => {
  it('closing can revert to open if the variance check fails', () => {
    expect(SHIFT_STATUS_TRANSITIONS.closing).toContain('open')
  })

  it('closed shifts can be reopened by a manager (rare, audited) as well as reconciled', () => {
    expect(SHIFT_STATUS_TRANSITIONS.closed).toEqual(['reconciled', 'open'])
  })

  it('reconciled is a true terminal state', () => {
    expect(SHIFT_STATUS_TRANSITIONS.reconciled).toEqual([])
  })
})

describe('PAYMENT_INTENT_STATUS_TRANSITIONS (PRD 07)', () => {
  it('a failed intent can only be retried via a fresh pending intent', () => {
    expect(PAYMENT_INTENT_STATUS_TRANSITIONS.failed).toEqual(['pending'])
  })

  it('confirmed, cancelled, and expired are terminal — no path back into the flow', () => {
    expect(PAYMENT_INTENT_STATUS_TRANSITIONS.confirmed).toEqual([])
    expect(PAYMENT_INTENT_STATUS_TRANSITIONS.cancelled).toEqual([])
    expect(PAYMENT_INTENT_STATUS_TRANSITIONS.expired).toEqual([])
  })

  it('held (manual-review hold) can resolve to confirmed, cancelled, failed, or expired', () => {
    expect(PAYMENT_INTENT_STATUS_TRANSITIONS.held).toEqual(['confirmed', 'cancelled', 'failed', 'expired'])
  })
})

describe('computeChangeDenominations', () => {
  it('breaks KES 1780 down into the fewest largest-first notes/coins with zero remainder', () => {
    const { breakdown, remainder } = computeChangeDenominations(1780, 'KES')
    expect(remainder).toBe(0)
    expect(breakdown).toEqual({ 1000: 1, 500: 1, 200: 1, 50: 1, 20: 1, 10: 1 })
  })

  it('handles an amount smaller than the smallest denomination as a clean 1-coin breakdown', () => {
    const { breakdown, remainder } = computeChangeDenominations(1, 'KES')
    expect(remainder).toBe(0)
    expect(breakdown).toEqual({ 1: 1 })
  })

  it('returns zero remainder for zero change', () => {
    const { breakdown, remainder } = computeChangeDenominations(0, 'KES')
    expect(remainder).toBe(0)
    expect(breakdown).toEqual({})
  })

  it('returns the full amount as remainder for a currency with no denomination table', () => {
    const { breakdown, remainder } = computeChangeDenominations(500, 'NGN')
    expect(breakdown).toEqual({})
    expect(remainder).toBe(500)
  })
})
