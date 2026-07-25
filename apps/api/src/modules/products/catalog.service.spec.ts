import { Test, type TestingModule } from '@nestjs/testing'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { withTenantContext, type Db } from '@hospitality-os/database'
import type { Pool } from 'pg'

import { AppModule } from '../../app.module.js'
import { APP_POOL } from '../../core/tenant/tenant.constants.js'
import {
  closeFixturePool,
  createLocationFixture,
  createProductFixture,
  deleteLocationFixture,
  deleteProductFixture,
  testActorContext,
  type LocationFixture,
  type ProductFixture,
} from '../../test/fixtures.js'
import { CategoriesService } from './categories.service.js'
import { MenusService } from './menus.service.js'
import { ModifierGroupsService } from './modifier-groups.service.js'

describe('MenusService (integration)', () => {
  let moduleRef: TestingModule
  let menusService: MenusService
  let location: LocationFixture

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    await moduleRef.init()
    menusService = moduleRef.get(MenusService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  beforeEach(async () => {
    location = await createLocationFixture()
  })

  afterEach(async () => {
    await deleteLocationFixture(location)
  })

  it('creates, updates, and deletes a menu', async () => {
    const authContext = testActorContext(location)
    const created = await menusService.create(authContext, { locationId: location.locationId, name: 'Lunch Menu' })
    expect(created.isDefault).toBe(false)

    const updated = await menusService.update(authContext, created.id, { isDefault: true })
    expect(updated.isDefault).toBe(true)

    await menusService.delete(authContext, created.id)
    await expect(menusService.getById(authContext, created.id)).rejects.toThrow('menu not found')
  })

  it('rejects updating a menu that belongs to a different organization', async () => {
    const other = await createLocationFixture()
    const created = await menusService.create(testActorContext(other), { locationId: other.locationId, name: 'Other Org Menu' })

    await expect(menusService.update(testActorContext(location), created.id, { name: 'stolen' })).rejects.toThrow('menu not found')

    await menusService.delete(testActorContext(other), created.id)
    await deleteLocationFixture(other)
  })
})

describe('CategoriesService (integration)', () => {
  let moduleRef: TestingModule
  let categoriesService: CategoriesService
  let menusService: MenusService
  let location: LocationFixture

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    await moduleRef.init()
    categoriesService = moduleRef.get(CategoriesService)
    menusService = moduleRef.get(MenusService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  beforeEach(async () => {
    location = await createLocationFixture()
  })

  afterEach(async () => {
    await deleteLocationFixture(location)
  })

  it('creates a category under a menu and can list it back sorted by sortOrder', async () => {
    const authContext = testActorContext(location)
    const menu = await menusService.create(authContext, { locationId: location.locationId, name: 'Menu' })
    const second = await categoriesService.create(authContext, { menuId: menu.id, locationId: location.locationId, name: 'Desserts', sortOrder: 2 })
    const first = await categoriesService.create(authContext, { menuId: menu.id, locationId: location.locationId, name: 'Starters', sortOrder: 1 })

    const list = await categoriesService.list(authContext, location.locationId)
    const ids = list.map((c) => c.id)
    expect(ids.indexOf(first.id)).toBeLessThan(ids.indexOf(second.id))
  })

  it('rejects creating a category against a menu from a different organization (RLS-invisible)', async () => {
    const other = await createLocationFixture()
    const otherMenu = await menusService.create(testActorContext(other), { locationId: other.locationId, name: 'Other Menu' })

    await expect(
      categoriesService.create(testActorContext(location), { menuId: otherMenu.id, locationId: location.locationId, name: 'Stolen Category' }),
    ).rejects.toThrow('menu not found')

    await deleteLocationFixture(other)
  })
})

describe('ModifierGroupsService (integration)', () => {
  let moduleRef: TestingModule
  let modifierGroupsService: ModifierGroupsService
  let location: LocationFixture

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    await moduleRef.init()
    modifierGroupsService = moduleRef.get(ModifierGroupsService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  beforeEach(async () => {
    location = await createLocationFixture()
  })

  afterEach(async () => {
    await deleteLocationFixture(location)
  })

  it('creates a modifier group with its options atomically', async () => {
    const authContext = testActorContext(location)
    const created = await modifierGroupsService.create(authContext, {
      locationId: location.locationId,
      name: 'Extras',
      minSelect: 0,
      maxSelect: 3,
      modifiers: [
        { name: 'Extra cheese', priceDelta: 100, currency: 'KES' },
        { name: 'No onions', priceDelta: 0, currency: 'KES' },
      ],
    })
    expect(created.modifiers).toHaveLength(2)

    const fetched = await modifierGroupsService.getById(authContext, created.id)
    expect(fetched.modifiers.map((m) => m.name).sort()).toEqual(['Extra cheese', 'No onions'])
  })

  it('delete removes the group and its modifiers together', async () => {
    const authContext = testActorContext(location)
    const created = await modifierGroupsService.create(authContext, {
      locationId: location.locationId,
      name: 'Sizes',
      modifiers: [{ name: 'Large', priceDelta: 200, currency: 'KES' }],
    })
    await modifierGroupsService.delete(authContext, created.id)
    await expect(modifierGroupsService.getById(authContext, created.id)).rejects.toThrow('modifier group not found')
  })
})

describe('Products <-> modifier groups link (create-time attach)', () => {
  let moduleRef: TestingModule
  let pool: Pool
  let modifierGroupsService: ModifierGroupsService
  let location: LocationFixture
  let product: ProductFixture

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    await moduleRef.init()
    pool = moduleRef.get(APP_POOL)
    modifierGroupsService = moduleRef.get(ModifierGroupsService)
  })

  afterAll(async () => {
    await moduleRef.close()
    await closeFixturePool()
  })

  beforeEach(async () => {
    location = await createLocationFixture()
    product = await createProductFixture(location)
  })

  afterEach(async () => {
    await deleteProductFixture(product)
    await deleteLocationFixture(location)
  })

  it('getModifiersByIds (db-first, used by OrdersService.addItem) resolves only ids belonging to the caller\'s organization', async () => {
    const authContext = testActorContext(location)
    const group = await modifierGroupsService.create(authContext, {
      locationId: location.locationId,
      name: 'Toppings',
      modifiers: [{ name: 'Extra sauce', priceDelta: 50, currency: 'KES' }],
    })
    const modifierId = group.modifiers[0]!.id

    const other = await createLocationFixture()
    const otherGroup = await modifierGroupsService.create(testActorContext(other), {
      locationId: other.locationId,
      name: 'Other Org Toppings',
      modifiers: [{ name: 'Cross-tenant', priceDelta: 999, currency: 'KES' }],
    })

    const resolved = await withTenantContext(pool, location.organizationId, (db: Db) =>
      modifierGroupsService.getModifiersByIds(db, location.organizationId, [modifierId, otherGroup.modifiers[0]!.id]),
    )
    expect(resolved).toHaveLength(1)
    expect(resolved[0]?.id).toBe(modifierId)

    await deleteLocationFixture(other)
  })
})
