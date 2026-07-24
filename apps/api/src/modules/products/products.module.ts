import { Module } from '@nestjs/common'

import { AuditModule } from '../../core/audit/audit.module.js'
import { PermissionsModule } from '../../core/permissions/permissions.module.js'
import { CategoriesController } from './categories.controller.js'
import { CategoriesService } from './categories.service.js'
import { MenusController } from './menus.controller.js'
import { MenusService } from './menus.service.js'
import { ModifierGroupsController } from './modifier-groups.controller.js'
import { ModifierGroupsService } from './modifier-groups.service.js'
import { ProductsController } from './products.controller.js'
import { ProductsService } from './products.service.js'

export const productsModule = {
  name: 'products',
  phase: 'restaurant-mvp',
  owns: ['menus', 'menu_categories', 'products', 'product_prices', 'modifier_groups', 'modifiers'],
} as const

@Module({
  imports: [AuditModule, PermissionsModule],
  controllers: [MenusController, CategoriesController, ModifierGroupsController, ProductsController],
  providers: [MenusService, CategoriesService, ModifierGroupsService, ProductsService],
  exports: [ProductsService, CategoriesService, ModifierGroupsService],
})
export class ProductsModule {}
