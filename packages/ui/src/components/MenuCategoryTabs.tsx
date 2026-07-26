import { cn } from '../lib/cn.js'

export interface MenuCategoryTabsProps {
  categories: Array<{ id: string; name: string }>
  activeId: string | null
  onSelect: (id: string) => void
  className?: string
}

// Horizontal scrollable category row — frontend-plan.md's Critical/High
// tier component list, shared by pos-mobile (native) and customer-web
// (this implementation).
export function MenuCategoryTabs({ categories, activeId, onSelect, className }: MenuCategoryTabsProps) {
  if (categories.length === 0) return null

  return (
    <nav className={cn('flex gap-2 overflow-x-auto pb-1', className)}>
      {categories.map((cat) => {
        const isActive = cat.id === activeId
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.id)}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium whitespace-nowrap',
              isActive
                ? 'border-primary bg-primary text-primary-ink'
                : 'border-border bg-surface text-ink-soft hover:bg-surface-2',
            )}
          >
            {cat.name}
          </button>
        )
      })}
    </nav>
  )
}
