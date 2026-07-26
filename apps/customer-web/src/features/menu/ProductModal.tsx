import { Button, Modal } from '@hospitality-os/ui'
import { useState } from 'react'

import { formatMoney } from '../../lib/format.js'
import type { ModifierWithGroup, ProductWithPrice } from './use-menu.js'

export interface ProductModalProps {
  product: ProductWithPrice
  modifiers: ModifierWithGroup[]
  onClose: () => void
  onAddToCart: (input: { quantity: number; modifierIds: string[]; notes: string }) => void
}

export function ProductModal({ product, modifiers, onClose, onAddToCart }: ProductModalProps) {
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')
  const [selectedModifierIds, setSelectedModifierIds] = useState<string[]>([])

  const toggleModifier = (id: string) => {
    setSelectedModifierIds((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]))
  }

  const modifiersPrice = modifiers
    .filter((m) => selectedModifierIds.includes(m.id))
    .reduce((sum, m) => sum + m.priceDelta, 0)
  const lineTotal = (product.price + modifiersPrice) * quantity

  const groupedModifiers = new Map<string, ModifierWithGroup[]>()
  for (const mod of modifiers) {
    const arr = groupedModifiers.get(mod.groupName) ?? []
    arr.push(mod)
    groupedModifiers.set(mod.groupName, arr)
  }

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title={product.name} description={product.description ?? undefined}>
      <p className="text-lg font-semibold text-ink">{formatMoney(product.price, product.currency)}</p>

      {[...groupedModifiers.entries()].map(([groupName, groupMods]) => (
        <div key={groupName} className="mt-4">
          <p className="text-sm font-medium text-ink">{groupName}</p>
          <div className="mt-2 flex flex-col gap-2">
            {groupMods.map((mod) => (
              <label key={mod.id} className="flex items-center justify-between gap-2 text-sm text-ink-soft">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedModifierIds.includes(mod.id)}
                    onChange={() => toggleModifier(mod.id)}
                    className="h-4 w-4 rounded border-border-strong"
                  />
                  {mod.name}
                </span>
                {mod.priceDelta > 0 ? <span>+{formatMoney(mod.priceDelta, product.currency)}</span> : null}
              </label>
            ))}
          </div>
        </div>
      ))}

      <label className="mt-4 block text-sm font-medium text-ink">
        Special instructions
        <input
          type="text"
          placeholder="e.g. No onions, extra sauce…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1.5 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </label>

      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-ink-soft hover:bg-surface-2"
        >
          −
        </button>
        <span className="min-w-[2rem] text-center text-sm text-ink">{quantity}</span>
        <button
          type="button"
          onClick={() => setQuantity((q) => q + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-ink-soft hover:bg-surface-2"
        >
          +
        </button>
      </div>

      <Button
        size="lg"
        className="mt-4 w-full"
        onClick={() => onAddToCart({ quantity, modifierIds: selectedModifierIds, notes })}
      >
        Add to cart — {formatMoney(lineTotal, product.currency)}
      </Button>
    </Modal>
  )
}
