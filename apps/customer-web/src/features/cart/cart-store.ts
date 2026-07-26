import { create } from 'zustand'

export interface CartItem {
  id: string
  productId: string
  name: string
  quantity: number
  unitPrice: number
  modifierIds: string[]
  modifierNames: string[]
  modifiersPrice: number
  notes: string
}

interface CartState {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'id'>) => void
  removeItem: (id: string) => void
  incrementItem: (id: string) => void
  decrementItem: (id: string) => void
  clear: () => void
}

export const useCartStore = create<CartState>()((set) => ({
  items: [],
  addItem: (item) => set((s) => ({ items: [...s.items, { ...item, id: crypto.randomUUID() }] })),
  removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  incrementItem: (id) =>
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, quantity: i.quantity + 1 } : i)) })),
  decrementItem: (id) =>
    set((s) => ({
      items: s.items
        .map((i) => (i.id === id ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0),
    })),
  clear: () => set({ items: [] }),
}))

export function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + (item.unitPrice + item.modifiersPrice) * item.quantity, 0)
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0)
}
