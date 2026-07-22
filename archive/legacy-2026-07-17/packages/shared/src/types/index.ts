import { z } from 'zod'

// ─── MONEY ───────────────────────────────────────────────────────────────────
// All money is stored as integer cents (KES * 100). Never use floats.
export const MoneySchema = z.number().int().nonnegative()
export type Money = z.infer<typeof MoneySchema>

// ─── API RESPONSE ENVELOPE ───────────────────────────────────────────────────
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    meta: z.object({
      timestamp: z.string(),
      request_id: z.string().optional(),
    }),
  })

export const ApiErrorSchema = z.object({
  type: z.string(),
  title: z.string(),
  detail: z.string(),
  status: z.number(),
  instance: z.string().optional(),
})

// ─── PAGINATION ──────────────────────────────────────────────────────────────
export const PaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
})

// ─── BUSINESS TYPES ──────────────────────────────────────────────────────────
export const BusinessTypeSchema = z.enum(['restaurant', 'retail', 'hybrid', 'salon'])
export type BusinessType = z.infer<typeof BusinessTypeSchema>

export const CountrySchema = z.enum(['KE', 'NG', 'GH', 'UG', 'TZ', 'ZA', 'SN', 'ET'])
export type Country = z.infer<typeof CountrySchema>

export const CurrencySchema = z.enum(['KES', 'NGN', 'GHS', 'UGX', 'TZS', 'ZAR', 'XOF', 'ETB'])
export type Currency = z.infer<typeof CurrencySchema>

// ─── STAFF ROLES ─────────────────────────────────────────────────────────────
export const StaffRoleSchema = z.enum(['owner', 'manager', 'cashier', 'server', 'kitchen', 'host'])
export type StaffRole = z.infer<typeof StaffRoleSchema>

// ─── ORDER STATUS ─────────────────────────────────────────────────────────────
export const OrderStatusSchema = z.enum(['open', 'in_progress', 'ready', 'served', 'paid', 'voided'])
export type OrderStatus = z.infer<typeof OrderStatusSchema>

export const OrderChannelSchema = z.enum(['pos', 'qr', 'whatsapp', 'online', 'delivery', 'kiosk'])
export type OrderChannel = z.infer<typeof OrderChannelSchema>

// ─── PAYMENT ─────────────────────────────────────────────────────────────────
export const PaymentMethodSchema = z.enum(['mpesa', 'cash', 'card', 'loyalty', 'credit', 'airtel', 'mtn'])
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>
