export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: Record<string, string[]>

  constructor(status: number, code: string, message: string, details?: Record<string, string[]>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    if (details !== undefined) this.details = details
  }

  static isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError
  }
}