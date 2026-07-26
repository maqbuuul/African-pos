import { CartReview, MenuCategoryTabs, Modal, ProductGrid } from '@hospitality-os/ui'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import { cartCount, cartTotal, useCartStore } from '../features/cart/cart-store.js'
import { ProductModal } from '../features/menu/ProductModal.js'
import { useMenu } from '../features/menu/use-menu.js'
import { useOrderStore } from '../features/order/order-store.js'
import { useSessionStore } from '../features/session/session-store.js'
import { formatMoney } from '../lib/format.js'

export function MenuPage() {
  const token = useSessionStore((s) => s.token)
  const { products, categories, modifiersByProduct, loading, error } = useMenu(token)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [showCart, setShowCart] = useState(false)
  const [placingOrder, setPlacingOrder] = useState(false)
  const [orderError, setOrderError] = useState<string | null>(null)

  const items = useCartStore((s) => s.items)
  const addItem = useCartStore((s) => s.addItem)
  const removeItem = useCartStore((s) => s.removeItem)
  const incrementItem = useCartStore((s) => s.incrementItem)
  const decrementItem = useCartStore((s) => s.decrementItem)
  const clearCart = useCartStore((s) => s.clear)
  const placeOrder = useOrderStore((s) => s.placeOrder)
  const navigate = useNavigate()

  useEffect(() => {
    if (!activeCategory && categories.length > 0) {
      setActiveCategory(categories[0]?.id ?? null)
    }
  }, [categories, activeCategory])

  const filteredProducts = activeCategory ? products.filter((p) => p.categoryId === activeCategory) : products
  const selectedProduct = products.find((p) => p.id === selectedProductId) ?? null
  const count = cartCount(items)

  const handleAddToCart = (product: NonNullable<typeof selectedProduct>, input: { quantity: number; modifierIds: string[]; notes: string }) => {
    const productModifiers = modifiersByProduct.get(product.id) ?? []
    const chosen = productModifiers.filter((m) => input.modifierIds.includes(m.id))
    addItem({
      productId: product.id,
      name: product.name,
      quantity: input.quantity,
      unitPrice: product.price,
      modifierIds: input.modifierIds,
      modifierNames: chosen.map((m) => m.name),
      modifiersPrice: chosen.reduce((sum, m) => sum + m.priceDelta, 0),
      notes: input.notes,
    })
    setSelectedProductId(null)
  }

  const handleCheckout = async () => {
    if (!token || items.length === 0) return
    setPlacingOrder(true)
    setOrderError(null)
    try {
      await placeOrder(
        token,
        items.map((item) => {
          const body: { productId: string; quantity: number; modifierIds?: string[]; notes?: string } = {
            productId: item.productId,
            quantity: item.quantity,
          }
          if (item.modifierIds.length > 0) body.modifierIds = item.modifierIds
          if (item.notes) body.notes = item.notes
          return body
        }),
      )
      clearCart()
      setShowCart(false)
      navigate('/order')
    } catch {
      setOrderError('Could not place your order — check your connection and try again.')
    } finally {
      setPlacingOrder(false)
    }
  }

  if (error) {
    return <p className="text-sm text-status-critical">{error}</p>
  }

  return (
    <div className="space-y-4 pb-20">
      <MenuCategoryTabs categories={categories} activeId={activeCategory} onSelect={setActiveCategory} />

      <ProductGrid
        products={filteredProducts.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          priceLabel: formatMoney(p.price, p.currency),
          isAvailable: p.isAvailable,
        }))}
        loading={loading}
        onSelect={setSelectedProductId}
      />

      {count > 0 ? (
        <button
          type="button"
          onClick={() => setShowCart(true)}
          className="fixed bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-ink shadow-lg"
        >
          View cart · {count} item{count === 1 ? '' : 's'} · {formatMoney(cartTotal(items))}
        </button>
      ) : null}

      {selectedProduct ? (
        <ProductModal
          product={selectedProduct}
          modifiers={modifiersByProduct.get(selectedProduct.id) ?? []}
          onClose={() => setSelectedProductId(null)}
          onAddToCart={(input) => handleAddToCart(selectedProduct, input)}
        />
      ) : null}

      <Modal open={showCart} onOpenChange={setShowCart} title="Your cart">
        {orderError ? <p className="mb-3 text-sm text-status-critical">{orderError}</p> : null}
        <CartReview
          items={items.map((item) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            lineTotalLabel: formatMoney((item.unitPrice + item.modifiersPrice) * item.quantity),
            modifierSummary: item.modifierNames.length > 0 ? item.modifierNames.join(', ') : null,
            notes: item.notes || null,
          }))}
          totalLabel={formatMoney(cartTotal(items))}
          onIncrement={incrementItem}
          onDecrement={decrementItem}
          onRemove={removeItem}
          onCheckout={handleCheckout}
          checkoutLoading={placingOrder}
        />
      </Modal>
    </div>
  )
}
