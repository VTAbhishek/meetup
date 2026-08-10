import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { COUNTRY_FONTS } from '../fonts'
import { useLang } from '../i18n'

const COUNTRIES = [
  { code: 'us', name: 'United States' },
  { code: 'gb', name: 'United Kingdom' },
  { code: 'ca', name: 'Canada' },
  { code: 'au', name: 'Australia' },
  { code: 'de', name: 'Germany' },
  { code: 'fr', name: 'France' },
  { code: 'in', name: 'India' },
  { code: 'lk', name: 'Sri Lanka' },
  { code: 'sg', name: 'Singapore' },
  { code: 'ae', name: 'United Arab Emirates' },
]

/**
 * Country picker. `variant`: "light" (white navbar) | "dark" (footer).
 * `full`: always show the country name (used in the mobile menu).
 */
export default function CountrySelect({ variant = 'light', full = false }) {
  const { country: code, setCountry, t } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = COUNTRIES.find((c) => c.code === code) || COUNTRIES[0]

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const select = (c) => {
    setCountry(c.code) // updates language + font + text direction app-wide
    setOpen(false)
  }

  const btnCls =
    variant === 'dark'
      ? 'border-white/20 text-white hover:bg-white/10'
      : 'border-slate-300 text-slate-700 hover:bg-slate-50'

  return (
    <div ref={ref} className={`relative ${full ? 'w-full' : ''}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-2 text-sm font-semibold transition ${btnCls} ${full ? 'w-full justify-between' : ''}`}
        aria-label="Choose country"
      >
        <span className="flex items-center gap-2">
          <img src={`${import.meta.env.BASE_URL}flags/${current.code}.png`} alt="" className="h-4 w-6 rounded-sm object-cover ring-1 ring-black/5" />
          <span className={full ? 'inline' : 'hidden lg:inline'}>{current.name}</span>
        </span>
        <ChevronDown size={16} className={`opacity-70 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={`absolute z-50 mt-2 max-h-80 w-60 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-cardHover ${full ? 'left-0' : 'right-0'}`}>
          <p className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-400">{t('chooseCountry')}</p>
          {COUNTRIES.map((c) => (
            <button
              key={c.code}
              onClick={() => select(c)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <img src={`${import.meta.env.BASE_URL}flags/${c.code}.png`} alt="" className="h-4 w-6 rounded-sm object-cover ring-1 ring-black/5" />
              <span className="flex-1">
                <span className="block">{c.name}</span>
                <span className="block text-xs text-slate-400">Font: {COUNTRY_FONTS[c.code]?.family}</span>
              </span>
              {c.code === code && <Check size={16} className="text-brand-green" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
