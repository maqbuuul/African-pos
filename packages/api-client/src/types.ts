export type ApiEnvelope<T> = {
  data: T
  meta: {
    requestId?: string
    timestamp: string
  }
}

export type PaginatedResponse<T> = {
  data: T[]
  meta: {
    total: number
    page: number
    pageSize: number
    request_id?: string
    timestamp: string
  }
}

export type IdResponse = {
  id: string
}