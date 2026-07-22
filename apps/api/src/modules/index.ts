import { Controller, Get, Module } from '@nestjs/common'

import { auditModule, AuditModule } from './audit/index.js'
import { crmModule, CrmModule } from './crm/index.js'
import { financeModule, FinanceModule } from './finance/index.js'
import { hotelModule, HotelModule } from './hotel/index.js'
import { inventoryModule, InventoryModule } from './inventory/index.js'
import { notificationsModule, NotificationsModule } from './notifications/index.js'
import { organizationModule, OrganizationModule } from './organization/index.js'
import { ordersModule, OrdersModule } from './orders/index.js'
import { paymentsModule, PaymentsModule } from './payments/index.js'
import { productsModule, ProductsModule } from './products/index.js'
import { qrOrderModule, QrOrderModule } from './qr-order/qr-order.module.js'
import { reportsModule, ReportsModule } from './reports/index.js'
import { restaurantModule, RestaurantModule } from './restaurant/index.js'
import { retailModule, RetailModule } from './retail/index.js'
import { staffModule, StaffModule } from './staff/index.js'
import { syncModule, SyncModule } from './sync/index.js'

const plannedModules = [
  auditModule,
  crmModule,
  financeModule,
  hotelModule,
  inventoryModule,
  notificationsModule,
  organizationModule,
  ordersModule,
  paymentsModule,
  productsModule,
  qrOrderModule,
  reportsModule,
  restaurantModule,
  retailModule,
  staffModule,
  syncModule,
] as const

@Controller('api/v1/modules')
class ModulesController {
  @Get()
  list() {
    return {
      data: plannedModules.map((m) => ({ name: m.name, status: 'planned' })),
      meta: { timestamp: new Date().toISOString() },
    }
  }
}

@Module({
  imports: [
    AuditModule,
    CrmModule,
    FinanceModule,
    HotelModule,
    InventoryModule,
    NotificationsModule,
    OrganizationModule,
    OrdersModule,
    PaymentsModule,
    ProductsModule,
    QrOrderModule,
    ReportsModule,
    RestaurantModule,
    RetailModule,
    StaffModule,
    SyncModule,
  ],
  controllers: [ModulesController],
})
export class DomainModulesModule {}
