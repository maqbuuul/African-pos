import { Controller, Get, HttpCode, Inject, Ip, Post, Req, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { Request } from 'express'

import { RequirePermission } from '../permissions/require-permission.decorator.js'
import { ValidatedBody } from '../validation/validated-body.decorator.js'
import { AuthService } from './auth.service.js'
import { DeviceActivateDto } from './dto/device-activate.dto.js'
import { OwnerLoginDto } from './dto/owner-login.dto.js'
import { RefreshTokenDto } from './dto/refresh-token.dto.js'
import { StaffPinLoginDto } from './dto/staff-pin-login.dto.js'
import { JwtAuthGuard } from './jwt-auth.guard.js'

// Tighter than the global default (300/60s, see app.module.ts) — login
// endpoints are the highest-value brute-force target in the system.
const LOGIN_THROTTLE = { default: { limit: 10, ttl: 60_000 } }

@Controller('api/v1/auth')
export class AuthController {
  // Explicit @Inject rather than bare constructor-param inference: under
  // tsx/esbuild, emitDecoratorMetadata's `design:paramtypes` isn't reliably
  // emitted for undecorated params, and Nest silently injects `undefined`
  // instead of failing loudly — see the same fix on PermissionsGuard.
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('owner/login')
  @HttpCode(200)
  @Throttle(LOGIN_THROTTLE)
  ownerLogin(@ValidatedBody(OwnerLoginDto) dto: OwnerLoginDto, @Ip() ip: string) {
    return this.authService.ownerLogin(dto.email, dto.password, ip)
  }

  @Post('staff/pin-login')
  @HttpCode(200)
  @Throttle(LOGIN_THROTTLE)
  staffPinLogin(@ValidatedBody(StaffPinLoginDto) dto: StaffPinLoginDto, @Ip() ip: string) {
    return this.authService.staffPinLogin(dto, ip)
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request) {
    // JwtAuthGuard guarantees authContext is set before this runs.
    return this.authService.me(req.authContext!)
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle(LOGIN_THROTTLE)
  refresh(@ValidatedBody(RefreshTokenDto) dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken)
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  logout(@ValidatedBody(RefreshTokenDto) dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken)
  }

  @Post('device/activate')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @RequirePermission('devices:activate')
  activateDevice(@ValidatedBody(DeviceActivateDto) dto: DeviceActivateDto, @Req() req: Request) {
    return this.authService.activateDevice(req.authContext!, dto)
  }
}
