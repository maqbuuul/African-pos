// African timezone map — used for locale-aware date formatting without a network lookup
export const COUNTRY_TIMEZONE: Record<string, string> = {
  KE: 'Africa/Nairobi',
  NG: 'Africa/Lagos',
  GH: 'Africa/Accra',
  UG: 'Africa/Kampala',
  TZ: 'Africa/Dar_es_Salaam',
  ZA: 'Africa/Johannesburg',
  SN: 'Africa/Dakar',
  ET: 'Africa/Addis_Ababa',
  CM: 'Africa/Douala',
  CI: 'Africa/Abidjan',
}

export const COUNTRY_CURRENCY: Record<string, string> = {
  KE: 'KES',
  NG: 'NGN',
  GH: 'GHS',
  UG: 'UGX',
  TZ: 'TZS',
  ZA: 'ZAR',
  SN: 'XOF',
  ET: 'ETB',
}

export const LOYALTY_TIERS = ['bronze', 'silver', 'gold', 'platinum'] as const
export type LoyaltyTier = (typeof LOYALTY_TIERS)[number]

export const LOYALTY_TIER_THRESHOLDS: Record<LoyaltyTier, number> = {
  bronze: 0,
  silver: 5_000,   // KES 5,000 total spend
  gold: 25_000,    // KES 25,000 total spend
  platinum: 100_000,
}

// Audit action codes — exhaustive list, never use free-form strings
export const AUDIT_ACTIONS = [
  'order_void',
  'order_discount',
  'payment_refund',
  'price_change',
  'stock_adjust',
  'stock_receive',
  'cash_drawer_open',
  'login_failed',
  'pin_changed',
  'staff_deactivated',
  'settings_change',
  'credit_limit_change',
  'receipt_reprint',
] as const

export type AuditAction = (typeof AUDIT_ACTIONS)[number]
