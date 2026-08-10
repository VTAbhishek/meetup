import { useState } from 'react'
import { Star } from 'lucide-react'

/** Read-only star rating: pink tiles. */
export function Stars({ value = 0, size = 20, gap = 2 }) {
  const rounded = Math.round(value)
  return (
    <div className="flex" style={{ gap }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="inline-flex items-center justify-center rounded-[3px]"
          style={{
            width: size,
            height: size,
            backgroundColor: i <= rounded ? '#DB2777' : '#e9d5ff',
          }}
        >
          <Star size={size * 0.66} color="white" fill="white" strokeWidth={0} />
        </span>
      ))}
    </div>
  )
}

/** Interactive star picker for the Write-a-review flow. */
export function StarPicker({ value = 0, onChange, size = 48 }) {
  const [hover, setHover] = useState(0)
  const active = hover || value
  const labels = ['Bad', 'Poor', 'Average', 'Great', 'Excellent']
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-2" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            type="button"
            key={i}
            onMouseEnter={() => setHover(i)}
            onClick={() => onChange(i)}
            className="rounded-md transition-transform hover:scale-110 focus:outline-none"
            aria-label={`${i} star${i > 1 ? 's' : ''}`}
          >
            <span
              className="inline-flex items-center justify-center rounded-[5px]"
              style={{
                width: size,
                height: size,
                backgroundColor: i <= active ? '#DB2777' : '#f3e8ff',
              }}
            >
              <Star size={size * 0.6} color="white" fill="white" strokeWidth={0} />
            </span>
          </button>
        ))}
      </div>
      <span className="text-sm font-semibold text-slate-600 h-5">
        {active ? labels[active - 1] : 'Select a rating'}
      </span>
    </div>
  )
}
