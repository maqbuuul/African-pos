import { Star } from 'lucide-react'

export interface StarRatingProps {
  value: number
  onChange: (value: number) => void
}

export function StarRating({ value, onChange }: StarRatingProps) {
  return (
    <div className="flex justify-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(value === star ? 0 : star)}
          aria-label={`Rate ${star} star${star === 1 ? '' : 's'}`}
        >
          <Star
            className={star <= value ? 'h-8 w-8 fill-status-attention text-status-attention' : 'h-8 w-8 text-border-strong'}
          />
        </button>
      ))}
    </div>
  )
}
