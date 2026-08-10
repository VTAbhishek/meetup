import { MapPin, ChevronDown } from 'lucide-react'

/**
 * Presentational two-step location picker: District -> City (city depends on the
 * chosen district). Controlled — the parent owns the values.
 *
 * Props:
 *  - districts      : [{ id, name, cities:[{id,name}] }]
 *  - districtId, cityId
 *  - onDistrict(id), onCity(id)
 *  - mode           : 'filter' (All districts / All cities) | 'form' (required selects)
 *  - selectClass    : classes for each <select>
 *  - dark           : true to style for a dark background
 */
export default function DistrictCityPicker({
  districts = [],
  districtId = '',
  cityId = '',
  onDistrict,
  onCity,
  mode = 'filter',
  selectClass = 'input',
  dark = false,
}) {
  const cities = districts.find((d) => String(d.id) === String(districtId))?.cities || []
  const districtPlaceholder = mode === 'form' ? 'Select district…' : 'All districts'
  const cityPlaceholder = mode === 'form' ? 'Select city…' : 'All cities'

  const base =
    selectClass === 'input'
      ? `input ${dark ? 'border-white/20 bg-white/10 text-white' : ''}`
      : selectClass

  // The <select> text is white on the dark hero, but the dropdown list renders
  // on a white popup — force the options themselves to dark text so they stay
  // readable when opened.
  const opt = 'bg-white text-slate-900'

  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="relative block">
        <MapPin size={15} className={`pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 ${dark ? 'text-white/70' : 'text-slate-400'}`} />
        <select
          value={districtId}
          onChange={(e) => onDistrict?.(e.target.value)}
          className={`${base} appearance-none pl-8 pr-7`}
        >
          <option className={opt} value="">{districtPlaceholder}</option>
          {districts.map((d) => (
            <option className={opt} key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <ChevronDown size={15} className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 ${dark ? 'text-white/70' : 'text-slate-400'}`} />
      </label>

      <label className="relative block">
        <select
          value={cityId}
          onChange={(e) => onCity?.(e.target.value)}
          disabled={!districtId}
          className={`${base} appearance-none pl-3 pr-7 disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <option className={opt} value="">{districtId ? cityPlaceholder : 'City'}</option>
          {cities.map((c) => (
            <option className={opt} key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <ChevronDown size={15} className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 ${dark ? 'text-white/70' : 'text-slate-400'}`} />
      </label>
    </div>
  )
}
