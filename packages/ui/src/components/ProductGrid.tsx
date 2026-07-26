import { Skeleton } from './Skeleton.js'
import { EmptyState } from './EmptyState.js'
import { cn } from '../lib/cn.js'

export interface ProductGridItem {
  id: string
  name: string
  description?: string | null
  imageUrl?: string | null
  priceLabel: string
  isAvailable: boolean
}

export interface ProductGridProps {
  products: ProductGridItem[]
  onSelect: (id: string) => void
  loading?: boolean
  className?: string
}

// Touch-friendly item grid — frontend-plan.md's Critical tier, shared by
// pos-mobile (native) and customer-web (this implementation).
export function ProductGrid({ products, onSelect, loading = false, className }: ProductGridProps) {
  if (loading) {
    return (
      <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3', className)}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
    )
  }

  if (products.length === 0) {
    return <EmptyState title="No items here" description="Nothing in this category yet — try another one." />
  }

  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3', className)}>
      {products.map((product) => (
        <button
          key={product.id}
          type="button"
          disabled={!product.isAvailable}
          onClick={() => onSelect(product.id)}
          className={cn(
            'flex min-h-[8rem] flex-col justify-between rounded-lg border border-border bg-surface p-3 text-left',
            product.isAvailable ? 'hover:border-border-strong' : 'opacity-50',
          )}
        >
          <div>
            <p className="text-sm font-medium text-ink">{product.name}</p>
            {product.description ? <p className="mt-0.5 line-clamp-2 text-xs text-ink-faint">{product.description}</p> : null}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-ink">{product.priceLabel}</span>
            {!product.isAvailable ? <span className="text-xs text-status-critical">Unavailable</span> : null}
          </div>
        </button>
      ))}
    </div>
  )
}
