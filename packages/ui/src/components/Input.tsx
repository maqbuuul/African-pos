import { type InputHTMLAttributes, forwardRef, useId } from 'react'

import { cn } from '../lib/cn.js'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string | undefined
  error?: string | undefined
  hint?: string | undefined
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const generatedId = useId()
    const inputId = id ?? generatedId
    const hintId = hint ? `${inputId}-hint` : undefined
    const errorId = error ? `${inputId}-error` : undefined

    return (
      <div className="flex flex-col gap-1.5">
        {label ? (
          <label htmlFor={inputId} className="text-sm font-medium text-ink">
            {label}
          </label>
        ) : null}
        <input
          id={inputId}
          ref={ref}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={cn(hintId, errorId) || undefined}
          className={cn(
            'h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-faint',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-status-critical focus-visible:ring-status-critical',
            className,
          )}
          {...props}
        />
        {error ? (
          <p id={errorId} className="text-sm text-status-critical">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="text-sm text-ink-faint">
            {hint}
          </p>
        ) : null}
      </div>
    )
  },
)
Input.displayName = 'Input'
