import { create } from 'zustand'

import { api, type OrderResponse } from '../../lib/api-client.js'

interface OrderState {
  order: OrderResponse['order'] | null
  items: OrderResponse['items']
  bill: OrderResponse['bill'] | null
  placeOrder: (
    token: string,
    items: Array<{ productId: string; quantity: number; modifierIds?: string[]; notes?: string }>,
  ) => Promise<void>
  fireCourse: (token: string, courseName: string) => Promise<void>
  requestBill: (token: string) => Promise<void>
  refresh: (token: string) => Promise<void>
  clearOrder: () => void
}

export const useOrderStore = create<OrderState>()((set, get) => ({
  order: null,
  items: [],
  bill: null,
  placeOrder: async (token, items) => {
    const res = await api.submitOrder(token, items)
    // The order-creation response never includes a bill — bills are only
    // created via requestBill, once the customer is ready to pay.
    set({ order: res.order, items: res.items, bill: null })
  },
  requestBill: async (token) => {
    const { order } = get()
    if (!order) return
    await api.requestBill(token, order.id)
    const res = await api.getOrder(token, order.id)
    set({ bill: res.bills.at(-1) ?? null })
  },
  fireCourse: async (token, courseName) => {
    const { order } = get()
    if (!order) return
    await api.fireCourse(token, order.id, courseName)
    set((s) => ({
      order: s.order && (s.order.status === 'draft' || s.order.status === 'open') ? { ...s.order, status: 'sent_to_kitchen' } : s.order,
      items: s.items.map((item) => (item.course === courseName && item.status === 'draft' ? { ...item, status: 'sent' } : item)),
    }))
  },
  // No live sync yet (websocket/polling is a later phase) — this is the
  // manual pull, e.g. after a customer expects staff to have sent their
  // order to the kitchen and wants to check before requesting the bill.
  refresh: async (token) => {
    const { order } = get()
    if (!order) return
    const res = await api.getOrder(token, order.id)
    set({ order: res.order, items: res.items, bill: res.bills.at(-1) ?? null })
  },
  clearOrder: () => set({ order: null, items: [], bill: null }),
}))
