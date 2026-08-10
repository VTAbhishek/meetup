import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { DIAL_CODES, DEFAULT_DIAL } from '../countryCodes'

/**
 * Mobile number input with a country dial-code selector.
 * - Dial code defaults to +94 (Sri Lanka).
 * - The number is forced to digits only and capped at exactly 10 characters.
 *
 * Controlled: parent owns `dial` and `mobile`; we call onDial / onMobile.
 */
export default function MobileField({ dial = DEFAULT_DIAL, mobile = '', onDial, onMobile, error }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Match the current dial back to a country row for the flag (first match wins).
  const current = DIAL_CODES.find((c) => c.dial === dial) || DIAL_CODES[0]

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const pick = (c) => {
    onDial?.(c.dial)
    setOpen(false)
  }

  const onNumber = (e) => {
    // Digits only, hard cap at 10.
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
    onMobile?.(digits)
  }

  return (
    <div>
      <div
        className={`flex items-stretch rounded-lg border bg-white focus-within:ring-2 focus-within:ring-brand-blue/20 ${
          error ? 'border-red-400' : 'border-slate-300 focus-within:border-brand-blue'
        }`}
      >
        {/* Dial-code dropdown */}
        <div ref={ref} className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex h-full items-center gap-2 rounded-l-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <img src={`${import.meta.env.BASE_URL}flags/${current.code}.png`} alt="" className="h-4 w-6 rounded-sm object-cover ring-1 ring-black/5" />
            <span>{dial}</span>
            <ChevronDown size={15} className={`opacity-70 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="absolute left-0 z-50 mt-2 max-h-72 w-64 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-cardHover">
              {DIAL_CODES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => pick(c)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <img src={`${import.meta.env.BASE_URL}flags/${c.code}.png`} alt="" className="h-4 w-6 rounded-sm object-cover ring-1 ring-black/5" />
                  <span className="flex-1">{c.name}</span>
                  <span className="text-slate-400">{c.dial}</span>
                  {c.dial === dial && c.code === current.code && <Check size={16} className="text-brand-green" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="w-px self-stretch bg-slate-200" />

        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={mobile}
          onChange={onNumber}
          placeholder="10-digit mobile"
          className="w-full rounded-r-lg bg-transparent px-3 py-2.5 text-slate-800 outline-none"
          aria-label="Mobile number"
        />
      </div>

      <div className="mt-1 flex items-center justify-between">
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <p className="text-xs text-slate-400">Enter exactly 10 digits (no spaces).</p>
        )}
        <span className={`text-xs ${mobile.length === 10 ? 'text-brand-green' : 'text-slate-400'}`}>
          {mobile.length}/10
        </span>
      </div>
    </div>
  )
}
