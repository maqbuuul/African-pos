import { ApiError } from '@hospitality-os/api-client'
import { useEffect, useState } from 'react'

import { api, type MenuResponse } from '../../lib/api-client.js'

export interface ProductWithPrice {
  id: string
  name: string
  localName: string | null
  description: string | null
  isAvailable: boolean
  categoryId: string
  imageUrl: string | null
  price: number
  currency: string
}

export interface ModifierWithGroup {
  id: string
  name: string
  priceDelta: number
  modifierGroupId: string
  groupName: string
  minSelect: number
  maxSelect: number
}

interface MenuState {
  products: ProductWithPrice[]
  categories: MenuResponse['categories']
  modifiersByProduct: Map<string, ModifierWithGroup[]>
  loading: boolean
  error: string | null
}

export function useMenu(token: string | null) {
  const [state, setState] = useState<MenuState>({
    products: [],
    categories: [],
    modifiersByProduct: new Map(),
    loading: true,
    error: null,
  })

  useEffect(() => {
    if (!token) return
    let cancelled = false

    api
      .getMenu(token)
      .then((data) => {
        if (cancelled) return

        const priceMap = new Map(data.productPrices.map((p) => [p.productId, p]))
        const modGroupMap = new Map(data.modifierGroups.map((g) => [g.id, g]))

        // Group links per product, then resolve to full modifier objects —
        // the previous implementation returned every modifier for every
        // product regardless of its actual group links (a known, commented
        // shortcut). This is the real join.
        const modifiersByProduct = new Map<string, ModifierWithGroup[]>()
        for (const link of data.productModifierGroups) {
          const group = modGroupMap.get(link.modifierGroupId)
          const groupModifiers = data.modifiers
            .filter((m) => m.modifierGroupId === link.modifierGroupId)
            .map((m) => ({
              ...m,
              groupName: group?.name ?? '',
              minSelect: group?.minSelect ?? link.minSelect,
              maxSelect: group?.maxSelect ?? link.maxSelect,
            }))
          const existing = modifiersByProduct.get(link.productId) ?? []
          modifiersByProduct.set(link.productId, [...existing, ...groupModifiers])
        }

        setState({
          products: data.products.map((p) => ({
            ...p,
            price: priceMap.get(p.id)?.priceAmount ?? 0,
            currency: priceMap.get(p.id)?.currency ?? 'KES',
          })),
          categories: data.categories,
          modifiersByProduct,
          loading: false,
          error: null,
        })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = ApiError.isApiError(err) ? err.message : 'Could not load the menu — check your connection and try again.'
        setState((s) => ({ ...s, loading: false, error: message }))
      })

    return () => {
      cancelled = true
    }
  }, [token])

  return state
}
