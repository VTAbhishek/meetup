import { Sparkles, ChevronDown } from 'lucide-react'

/**
 * Mood dropdown, styled to line up with DistrictCityPicker's selects so the
 * hero reads as one row of filters. Controlled — the parent owns `value`
 * (a mood slug, '' for none).
 *
 * Props:
 *  - moods       : [{ slug, name, hint }]
 *  - value       : selected slug
 *  - onChange(slug)
 *  - dark        : true to style for a dark background
 *  - selectClass : classes for the <select>
 */
export default function MoodSelect({
  moods = [],
  value = '',
  onChange,
  dark = false,
  selectClass = 'input',
}) {
  // Nothing to choose from (or the moods table is unreachable) — render nothing
  // rather than an empty dropdown.
  if (moods.length === 0) return null

  const base =
    selectClass === 'input'
      ? `input ${dark ? 'border-white/20 bg-white/10 text-white' : ''}`
      : selectClass

  // The select's own text is white on the dark hero, but the dropdown list
  // renders on a white popup — force dark option text so it stays readable.
  const opt = 'bg-white text-slate-900'

  return (
    <label className="relative block">
      <Sparkles
        size={15}
        className={`pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 ${dark ? 'text-white/70' : 'text-slate-400'}`}
      />
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        aria-label="Filter by mood"
        className={`${base} w-full appearance-none pl-8 pr-7`}
      >
        <option className={opt} value="">What are you in the mood for?</option>
        {moods.map((m) => (
          <option className={opt} key={m.slug} value={m.slug}>{m.name}</option>
        ))}
      </select>
      <ChevronDown
        size={15}
        className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 ${dark ? 'text-white/70' : 'text-slate-400'}`}
      />
    </label>
  )
}
