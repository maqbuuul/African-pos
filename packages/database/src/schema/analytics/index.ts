import { date, index, integer, jsonb, pgTable, real, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'

import { locations, organizations, staff } from '../shared/index.js'
import { products } from '../restaurant/index.js'
import { primaryId, timestamps } from '../shared/columns.js'

export const events = pgTable('events', {
  ...primaryId,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  locationId: uuid('location_id')
    .notNull()
    .references(() => locations.id, { onDelete: 'restrict' }),
  eventType: text('event_type').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  data: jsonb('data'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('events_organization_id_idx').on(table.organizationId),
  index('events_location_id_idx').on(table.locationId),
  index('events_entity_type_idx').on(table.entityType, table.entityId),
  index('events_occurred_at_idx').on(table.occurredAt),
])

export const reportSnapshots = pgTable('report_snapshots', {
  ...primaryId,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  locationId: uuid('location_id').references(() => locations.id, { onDelete: 'set null' }),
  reportType: text('report_type').notNull(),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('report_snapshots_organization_id_idx').on(table.organizationId),
  index('report_snapshots_type_period_idx').on(table.reportType, table.periodStart),
])

export const dailyLocationMetrics = pgTable('daily_location_metrics', {
  ...primaryId,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  locationId: uuid('location_id')
    .notNull()
    .references(() => locations.id, { onDelete: 'restrict' }),
  date: date('date').notNull(),
  revenue: integer('revenue').notNull().default(0),
  orderCount: integer('order_count').notNull().default(0),
  avgTicket: integer('avg_ticket').notNull().default(0),
  totalCovers: integer('total_covers').notNull().default(0),
  totalVoids: integer('total_voids').notNull().default(0),
  voidAmount: integer('void_amount').notNull().default(0),
  totalDiscounts: integer('total_discounts').notNull().default(0),
  discountAmount: integer('discount_amount').notNull().default(0),
  laborCost: integer('labor_cost').notNull().default(0),
  foodCost: integer('food_cost').notNull().default(0),
  grossProfit: integer('gross_profit').notNull().default(0),
  ...timestamps,
}, (table) => [
  unique('daily_location_metrics_date_key').on(table.organizationId, table.locationId, table.date),
])

export const productSalesMetrics = pgTable('product_sales_metrics', {
  ...primaryId,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  locationId: uuid('location_id')
    .notNull()
    .references(() => locations.id, { onDelete: 'restrict' }),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'restrict' }),
  date: date('date').notNull(),
  quantitySold: integer('quantity_sold').notNull().default(0),
  revenue: integer('revenue').notNull().default(0),
  orderCount: integer('order_count').notNull().default(0),
  ...timestamps,
}, (table) => [
  unique('product_sales_metrics_date_key').on(table.organizationId, table.locationId, table.productId, table.date),
])

export const staffPerformanceMetrics = pgTable('staff_performance_metrics', {
  ...primaryId,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  locationId: uuid('location_id')
    .notNull()
    .references(() => locations.id, { onDelete: 'restrict' }),
  staffId: uuid('staff_id')
    .notNull()
    .references(() => staff.id, { onDelete: 'restrict' }),
  date: date('date').notNull(),
  totalSales: integer('total_sales').notNull().default(0),
  orderCount: integer('order_count').notNull().default(0),
  avgTicket: integer('avg_ticket').notNull().default(0),
  totalTips: integer('total_tips').notNull().default(0),
  voidCount: integer('void_count').notNull().default(0),
  voidAmount: integer('void_amount').notNull().default(0),
  hoursWorked: real('hours_worked').notNull().default(0),
  ...timestamps,
}, (table) => [
  unique('staff_performance_metrics_date_key').on(table.organizationId, table.locationId, table.staffId, table.date),
])

export const analyticsSchemaPlan = [
  'events',
  'report_snapshots',
  'daily_location_metrics',
  'product_sales_metrics',
  'staff_performance_metrics',
  'forecast_runs',
  'predictions',
  'recommendation_events',
  'anomaly_events',
  'ai_briefings',
] as const
