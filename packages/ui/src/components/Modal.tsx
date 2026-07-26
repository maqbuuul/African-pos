import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '../lib/cn.js'

export interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string | undefined
  children: ReactNode
  className?: string
}

// Generic overlay dialog — frontend-design-system.md's Component Library
// (Medium priority). ConfirmDialog stays the narrow confirm/cancel variant
// for destructive actions; this is for arbitrary content (product detail,
// forms, …).
export function Modal({ open, onOpenChange, title, description, children, className }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 max-h-[85vh] w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-surface p-5 shadow-lg',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="text-base font-semibold text-ink">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" aria-label="Close" className="text-ink-faint hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>
          {description ? <Dialog.Description className="mt-1 text-sm text-ink-soft">{description}</Dialog.Description> : null}
          <div className="mt-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
