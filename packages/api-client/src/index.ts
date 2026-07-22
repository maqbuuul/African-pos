export type ApiEnvelope<T> = {
  data: T
  meta: {
    request_id?: string
    timestamp: string
  }
}

