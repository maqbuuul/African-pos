const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export function getStoredToken(): string | null {
  return localStorage.getItem('qr_session_token')
}

export function storeSession(token: string, data: { table: unknown }) {
  localStorage.setItem('qr_session_token', token)
  localStorage.setItem('qr_session_data', JSON.stringify(data))
}

export function clearSession() {
  localStorage.removeItem('qr_session_token')
  localStorage.removeItem('qr_session_data')
}

export function getStoredSession(): { token: string; table: { id: string; label: string; section: string | null } } | null {
  try {
    const token = localStorage.getItem('qr_session_token')
    const raw = localStorage.getItem('qr_session_data')
    if (!token || !raw) return null
    const data = JSON.parse(raw)
    return { token, table: data.table }
  } catch {
    return null
  }
}

async function request<T>(path: string, options?: { method?: string; body?: unknown; token?: string }): Promise<T> {
  const token = options?.token ?? getStoredToken()
  const res = await fetch(`${API_BASE}${path}`, {
    method: options?.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(options?.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  })
  const text = await res.text()
  const payload = text ? JSON.parse(text) : null
  if (!res.ok) {
    const msg = payload?.message ?? payload?.error ?? `Request failed (${res.status})`
    throw new Error(msg)
  }
  return payload as T
}

export interface CreateSessionResponse {
  token: string
  table: {
    id: string
    label: string
    section: string | null
    capacity: number
    qrSlug: string
    status: string
    organizationId: string
    locationId: string
  }
}

export interface MenuResponse {
  menus: Array<{ id: string; name: string }>
  categories: Array<{ id: string; name: string; menuId: string }>
  products: Array<{
    id: string
    name: string
    localName: string | null
    description: string | null
    status: string
    isAvailable: boolean
    categoryId: string
    imageUrl: string | null
  }>
  productPrices: Array<{ id: string; productId: string; priceAmount: number; currency: string }>
  productModifierGroups: Array<{ id: string; productId: string; modifierGroupId: string; minSelect: number; maxSelect: number }>
  modifierGroups: Array<{ id: string; name: string; minSelect: number; maxSelect: number }>
  modifiers: Array<{ id: string; name: string; priceDelta: number; modifierGroupId: string }>
}

export interface OrderResponse {
  order: { id: string; status: string; totalAmount: number; currency: string }
  items: Array<{ id: string; productId: string; nameSnapshot: string; quantity: number; unitPriceAmount: number; modifiersPriceAmount: number; totalAmount: number; kitchenNote: string | null; status: string }>
  bill: { id: string; billNumber: number; status: string; totalAmount: number }
}

export const api = {
  createSession: (qrSlug: string) =>
    request<CreateSessionResponse>('/public/table-sessions', { method: 'POST', body: { qrSlug } }),

  getMenu: (token: string) =>
    request<MenuResponse>(`/public/table-sessions/${token}/menu`, { token }),

  submitOrder: (token: string, items: Array<{ productId: string; quantity: number; modifierIds?: string[]; notes?: string }>) =>
    request<OrderResponse>(`/public/table-sessions/${token}/orders`, { method: 'POST', body: { items }, token }),

  getOrder: (token: string, orderId: string) =>
    request<{ order: { id: string; status: string; totalAmount: number; subtotalAmount: number; currency: string }; items: any[]; bills: any[] }>(
      `/public/table-sessions/${token}/order?orderId=${orderId}`, { token }
    ),

  requestWaiter: (token: string, reason?: string) =>
    request<{ message: string }>(`/public/table-sessions/${token}/request-waiter`, { method: 'POST', body: { reason }, token }),

  submitFeedback: (token: string, orderItemId: string, rating: number, comment?: string) =>
    request<{ message: string }>(`/public/table-sessions/${token}/feedback`, { method: 'POST', body: { orderItemId, rating, comment }, token }),

  payMpesa: (token: string, orderId: string, phone: string, idempotencyKey: string) =>
    request<{ id: string; status: string }>(`/public/table-sessions/${token}/payments/mobile-money`, { method: 'POST', body: { orderId, phone, idempotencyKey }, token }),

  fireCourse: (token: string, orderId: string, courseName: string) =>
    request<{ message: string; firedItemIds: string[] }>(`/public/table-sessions/${token}/fire-course`, { method: 'POST', body: { orderId, courseName }, token }),

  rateDish: (token: string, orderItemId: string, rating: number, comment?: string) =>
    request<{ message: string }>(`/public/table-sessions/${token}/rate-dish`, { method: 'POST', body: { orderItemId, rating, comment }, token }),
}
