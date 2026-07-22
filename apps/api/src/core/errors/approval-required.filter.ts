import { Catch, HttpStatus, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common'
import type { Response } from 'express'

import { ApprovalRequiredException } from './approval-required.exception.js'

// No global {data, meta} response envelope exists yet anywhere in the API
// (master plan section 26 describes it, but every current endpoint —
// ownerLogin, staffPinLogin, me — still returns its raw shape). This matches
// that existing convention rather than introducing the envelope for one
// endpoint only; adopting it API-wide is a separate, cross-cutting change.
@Catch(ApprovalRequiredException)
export class ApprovalRequiredFilter implements ExceptionFilter {
  catch(exception: ApprovalRequiredException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>()
    response.status(HttpStatus.ACCEPTED).json({
      status: 'pending',
      approvalRequestId: exception.approvalRequestId,
    })
  }
}
