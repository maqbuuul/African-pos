// Thrown by PermissionsGuard when a staff member lacks a permission but the
// route allows a manager override — caught by ApprovalRequiredFilter and
// turned into a 202, never allowed to fall through to Nest's default 500
// handling (it isn't an error, it's a valid "pending" outcome).
export class ApprovalRequiredException extends Error {
  constructor(public readonly approvalRequestId: string) {
    super('approval required')
    this.name = 'ApprovalRequiredException'
  }
}
