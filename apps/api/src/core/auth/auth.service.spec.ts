import { Test, type TestingModule } from '@nestjs/testing'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { AppModule } from '../../app.module.js'
import {
  closeFixturePool,
  createLocationFixture,
  createOwnerUserFixture,
  createStaffFixture,
  deleteLocationFixture,
  deleteOwnerUserFixture,
  deleteStaffFixture,
  type LocationFixture,
  type OwnerUserFixture,
  type StaffFixture,
} from '../../test/fixtures.js'
import { AuthService } from './auth.service.js'

// Runs against the real local Postgres, same pattern as
// payments.service.spec.ts — auth is exactly the kind of "mocked-dependency
// unit test doesn't satisfy the gate" surface ENGINEERING_HANDBOOK.md calls
// out: password/PIN hashing, RLS-scoped lookups, and session issuance all
// need a real database round-trip to mean anything.
describe('AuthService (integration)', () => {
  let authService: AuthService
  let moduleRef: TestingModule
  let location: LocationFixture

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    await moduleRef.init()
    authService = moduleRef.get(AuthService)
  })

  afterAll(async () => {
    await moduleRef.close()
    await closeFixturePool()
  })

  beforeEach(async () => {
    location = await createLocationFixture()
  })

  afterEach(async () => {
    await deleteLocationFixture(location)
  })

  describe('ownerLogin', () => {
    let owner: OwnerUserFixture

    beforeEach(async () => {
      owner = await createOwnerUserFixture(location.organizationId)
    })

    afterEach(async () => {
      await deleteOwnerUserFixture(owner)
    })

    it('issues token + refreshToken for a correct email/password', async () => {
      const result = await authService.ownerLogin(owner.email, owner.password)
      expect(result.token).toBeTruthy()
      expect(result.refreshToken).toBeTruthy()
      expect(result.user.email).toBe(owner.email)
      expect(result.user.organizationId).toBe(location.organizationId)
    })

    it('login is case-insensitive on email', async () => {
      const result = await authService.ownerLogin(owner.email.toUpperCase(), owner.password)
      expect(result.user.email).toBe(owner.email)
    })

    it('rejects a wrong password with the same generic message as an unknown email (no enumeration)', async () => {
      await expect(authService.ownerLogin(owner.email, 'wrong password')).rejects.toMatchObject({
        message: 'Invalid email or password',
      })
      await expect(authService.ownerLogin('nobody@nowhere.test', 'whatever')).rejects.toMatchObject({
        message: 'Invalid email or password',
      })
    })

    it('rejects login for a non-active account even with the correct password', async () => {
      const suspended = await createOwnerUserFixture(location.organizationId, { status: 'suspended' })
      await expect(authService.ownerLogin(suspended.email, suspended.password)).rejects.toMatchObject({
        message: 'Invalid email or password',
      })
      await deleteOwnerUserFixture(suspended)
    })
  })

  describe('staffPinLogin', () => {
    let waiter: StaffFixture

    beforeEach(async () => {
      waiter = await createStaffFixture(location, 'waiter')
    })

    afterEach(async () => {
      await deleteStaffFixture(waiter)
    })

    it('issues tokens for a correct PIN at the right org/location', async () => {
      const result = await authService.staffPinLogin({
        organizationId: location.organizationId,
        locationId: location.locationId,
        pin: waiter.pin,
      })
      expect(result.token).toBeTruthy()
      expect(result.staff.id).toBe(waiter.staffId)
    })

    it('rejects an incorrect PIN', async () => {
      await expect(
        authService.staffPinLogin({
          organizationId: location.organizationId,
          locationId: location.locationId,
          pin: '9999',
        }),
      ).rejects.toMatchObject({ message: 'Invalid PIN' })
    })

    it('does not match a staff member from a different location, even with the right org and correct PIN value', async () => {
      const otherLocation = await createLocationFixture()
      await expect(
        authService.staffPinLogin({
          organizationId: location.organizationId,
          locationId: otherLocation.locationId,
          pin: waiter.pin,
        }),
      ).rejects.toMatchObject({ message: 'Invalid PIN' })
      await deleteLocationFixture(otherLocation)
    })
  })

  describe('refresh + logout (session lifecycle)', () => {
    it('refresh rotates the session and the old refresh token can no longer be used', async () => {
      const owner = await createOwnerUserFixture(location.organizationId)
      const { refreshToken } = await authService.ownerLogin(owner.email, owner.password)

      const rotated = await authService.refresh(refreshToken)
      expect(rotated.token).toBeTruthy()
      expect(rotated.refreshToken).not.toBe(refreshToken)

      // The pre-rotation token is single-use — reusing it must fail, per
      // SessionsService.refresh's revoke-then-reissue design.
      await expect(authService.refresh(refreshToken)).rejects.toThrow()

      await deleteOwnerUserFixture(owner)
    })

    it('logout revokes the session so its refresh token can no longer be used', async () => {
      const owner = await createOwnerUserFixture(location.organizationId)
      const { refreshToken } = await authService.ownerLogin(owner.email, owner.password)

      await authService.logout(refreshToken)

      await expect(authService.refresh(refreshToken)).rejects.toThrow()

      await deleteOwnerUserFixture(owner)
    })

    it('rejects a garbage refresh token', async () => {
      await expect(authService.refresh('not.a.jwt')).rejects.toThrow()
    })
  })

  describe('me', () => {
    it("returns the owner's full permission set for a 'user' actor", async () => {
      const owner = await createOwnerUserFixture(location.organizationId)
      const result = await authService.me({
        actorType: 'user',
        actorId: owner.userId,
        organizationId: location.organizationId,
      })
      expect(result.permissions.length).toBeGreaterThan(0)
      expect(result.permissions).toContain('payments:refund')
      await deleteOwnerUserFixture(owner)
    })

    it("returns only the waiter role's narrower permission set for a 'staff' actor", async () => {
      const waiter = await createStaffFixture(location, 'waiter')
      const result = await authService.me({
        actorType: 'staff',
        actorId: waiter.staffId,
        organizationId: location.organizationId,
        locationId: location.locationId,
      })
      expect(result.permissions).toContain('orders:create')
      // Waiters are not granted refund authority (SYSTEM_ROLES in the seed).
      expect(result.permissions).not.toContain('payments:refund')
      await deleteStaffFixture(waiter)
    })
  })

  describe('activateDevice', () => {
    it('creates a new device on first activation and reactivates the same device on a second call', async () => {
      const owner = await createOwnerUserFixture(location.organizationId)
      const authContext = {
        actorType: 'user' as const,
        actorId: owner.userId,
        organizationId: location.organizationId,
      }

      const first = await authService.activateDevice(authContext, {
        locationId: location.locationId,
        name: 'POS Terminal 1',
        deviceType: 'pos',
      })
      expect(first.status).toBe('active')

      const second = await authService.activateDevice(authContext, {
        locationId: location.locationId,
        name: 'POS Terminal 1',
        deviceType: 'pos',
      })
      expect(second.id).toBe(first.id)

      await deleteOwnerUserFixture(owner)
    })

    it('rejects activating a device against a location from a different organization', async () => {
      const owner = await createOwnerUserFixture(location.organizationId)
      const otherLocation = await createLocationFixture()

      await expect(
        authService.activateDevice(
          { actorType: 'user', actorId: owner.userId, organizationId: location.organizationId },
          { locationId: otherLocation.locationId, name: 'Rogue Terminal', deviceType: 'pos' },
        ),
      ).rejects.toThrow()

      await deleteLocationFixture(otherLocation)
      await deleteOwnerUserFixture(owner)
    })
  })
})
