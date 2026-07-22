// ─── MONEY FORMATTING ────────────────────────────────────────────────────────

export function formatMoney(amountCents: number, currency: string = 'KES'): string {
  const amount = amountCents / 100
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

// ─── PHONE NORMALIZATION ─────────────────────────────────────────────────────
// Kenya: 0722... → +254722..., +254722... → unchanged
export function normalizeKenyanPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('254') && digits.length === 12) return `+${digits}`
  if (digits.startsWith('0') && digits.length === 10) return `+254${digits.slice(1)}`
  if (digits.startsWith('7') && digits.length === 9) return `+254${digits}`
  return phone
}

// ─── ORDER NUMBER GENERATION ──────────────────────────────────────────────────
// Human-readable: "0042" — 4-digit, zero-padded, wraps at 9999
export function generateOrderNumber(sequence: number): string {
  return String(sequence % 10_000).padStart(4, '0')
}

// ─── IDEMPOTENCY KEY ─────────────────────────────────────────────────────────
export function generateIdempotencyKey(deviceId: string, orderId: string): string {
  return `${deviceId}_${orderId}_${Date.now()}`
}
