import { Inject, Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable, map } from 'rxjs'

import { SKIP_ENVELOPE_KEY } from './skip-envelope.decorator.js'

export interface ResponseEnvelope<T = unknown> {
  data: T
  meta: {
    timestamp: string
    requestId?: string
  }
}

@Injectable()
export class ResponseEnvelopeInterceptor<T = unknown> implements NestInterceptor<T, ResponseEnvelope<T>> {
  // Explicit @Inject — plain constructor-param DI relies on `design:paramtypes`
  // reflection metadata, which esbuild/tsx never emits (see
  // core/validation/validated-body.decorator.ts's comment for the full
  // explanation). Without it this.reflector is undefined at runtime.
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ResponseEnvelope<T>> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_ENVELOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (skip) return next.handle() as Observable<ResponseEnvelope<T>>

    const request = context.switchToHttp().getRequest()
    const requestId = request.id

    return next.handle().pipe(
      map((data) => ({
        data,
        meta: {
          timestamp: new Date().toISOString(),
          ...(requestId ? { requestId } : {}),
        },
      })),
    )
  }
}
