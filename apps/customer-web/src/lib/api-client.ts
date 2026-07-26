import { ApiClient } from '@hospitality-os/api-client'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export const apiClient = new ApiClient(API_BASE)

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

export interface OrderItemResponse {
  id: string
  productId: string
  nameSnapshot: string
  quantity: number
  unitPriceAmount: number
  modifiersPriceAmount: number
  totalAmount: number
  kitchenNote: string | null
  status: string
  course: string | null
}

export interface OrderResponse {
  order: { id: string; status: string; totalAmount: number; currency: string }
  items: OrderItemResponse[]
  bill: { id: string; billNumber: number; status: string; totalAmount: number }
}

export const api = {
  createSession: (qrSlug: string) => apiClient.post<CreateSessionResponse>('/public/table-sessions', { qrSlug }),

  getMenu: (token: string) => {
    apiClient.setToken(token)
    return apiClient.get<MenuResponse>(`/public/table-sessions/${token}/menu`)
  },

  submitOrder: (token: string, items: Array<{ productId: string; quantity: number; modifierIds?: string[]; notes?: string }>) => {
    apiClient.setToken(token)
    return apiClient.post<OrderResponse>(`/public/table-sessions/${token}/orders`, { items })
  },

  getOrder: (token: string, orderId: string) => {
    apiClient.setToken(token)
    return apiClient.get<{ order: OrderResponse['order']; items: OrderItemResponse[]; bills: OrderResponse['bill'][] }>(
      `/public/table-sessions/${token}/order?orderId=${orderId}`,
    )
  },

  requestBill: (token: string, orderId: string) => {
    apiClient.setToken(token)
    return apiClient.post<{ message: string }>(`/public/table-sessions/${token}/request-bill`, { orderId })
  },

  requestWaiter: (token: string, reason?: string) => {
    apiClient.setToken(token)
    return apiClient.post<{ message: string }>(`/public/table-sessions/${token}/request-waiter`, { reason })
  },

  submitFeedback: (token: string, orderItemId: string, rating: number, comment?: string) => {
    apiClient.setToken(token)
    return apiClient.post<{ message: string }>(`/public/table-sessions/${token}/feedback`, { orderItemId, rating, comment })
  },

  payMpesa: (token: string, orderId: string, phone: string, idempotencyKey: string) => {
    apiClient.setToken(token)
    return apiClient.post<{ id: string; status: string }>(`/public/table-sessions/${token}/payments/mobile-money`, {
      orderId,
      phone,
      idempotencyKey,
    })
  },

  fireCourse: (token: string, orderId: string, courseName: string) => {
    apiClient.setToken(token)
    return apiClient.post<{ message: string; firedItemIds: string[] }>(`/public/table-sessions/${token}/fire-course`, {
      orderId,
      courseName,
    })
  },

  rateDish: (token: string, orderItemId: string, rating: number, comment?: string) => {
    apiClient.setToken(token)
    return apiClient.post<{ message: string }>(`/public/table-sessions/${token}/rate-dish`, { orderItemId, rating, comment })
  },
}
