import { ApiError } from './errors.js'
import type { ApiEnvelope } from './types.js'

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

// Shape NestJS's default exception handling actually produces today
// (apps/api has no global exception filter implementing the `error.type`
// taxonomy documented in docs/architecture/api-specification.md yet —
// this parses the real runtime shape, not the aspirational one).
interface NestErrorBody {
  statusCode: number
  message: string | string[]
  error?: string
}

export class ApiClient {
  private baseUrl: string
  private token: string | null

  constructor(baseUrl: string, token?: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.token = token ?? null
  }

  setToken(token: string | null): void {
    this.token = token
  }

  private async request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })

    const text = await res.text()
    const payload = text ? JSON.parse(text) : null

    if (!res.ok) {
      const errorBody = payload as NestErrorBody | null
      const message = Array.isArray(errorBody?.message)
        ? errorBody.message.join(', ')
        : (errorBody?.message ?? `Request failed (${res.status})`)
      const details = Array.isArray(errorBody?.message) ? { general: errorBody.message } : undefined
      throw new ApiError(res.status, errorBody?.error ?? 'error', message, details)
    }

    const envelope = payload as ApiEnvelope<T>
    return envelope.data
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path)
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body)
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body)
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path)
  }
}
