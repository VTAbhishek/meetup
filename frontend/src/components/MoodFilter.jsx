import { Sparkles, X } from 'lucide-react'
import { MoodIcon } from '../lib/moodIcons'

/**
 * Mood filter chips for the customer search. One mood at a time — clicking the
 * active chip clears it. Controlled: the parent owns `value` (a mood slug).
 */
export default function MoodFilter({ moods = [], value = '', onChange }) {
  if (moods.length === 0) return null

  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-600">
        <Sparkles size={14} className="text-brand-green" /> What are you in the mood for?
        {value && (
          <button
            type="button"
            onClick={() => onChange?.('')}
            className="ml-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-red-600"
          >
            <X size={12} /> clear
          </button>
        )}
      </p>

      <div className="flex flex-wrap gap-2">
        {moods.map((m) => {
          const on = value === m.slug
          return (
            <button
              key={m.slug}
              type="button"
              onClick={() => onChange?.(on ? '' : m.slug)}
              aria-pressed={on}
              title={m.hint || m.name}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                on
                  ? 'border-brand-green bg-brand-green text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-brand-green/50 hover:text-brand-navy'
              }`}
            >
              <MoodIcon icon={m.icon} size={14} className={on ? 'text-white' : 'text-brand-green'} />
              {m.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
