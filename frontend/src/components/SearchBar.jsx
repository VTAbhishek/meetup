import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { api } from '../api'
import { colorFor, initials } from '../lib'

/** Search box with live auto-suggest of companies. */
export default function SearchBar({ size = 'lg', placeholder = 'Search company or category' }) {
  const [q, setQ] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const boxRef = useRef(null)

  useEffect(() => {
    if (q.trim().length < 2) {
      setSuggestions([])
      return
    }
    const t = setTimeout(() => {
      api
        .companies(`?q=${encodeURIComponent(q)}&limit=6`)
        .then((d) => {
          setSuggestions(d.companies)
          setOpen(true)
        })
        .catch(() => {})
    }, 200)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const submit = (e) => {
    e.preventDefault()
    // Navigate even with an empty keyword so a location-only search still works
    // (the Search page applies the district/city filters from context).
    const query = q.trim()
    navigate(query ? `/search?q=${encodeURIComponent(query)}` : '/search')
    setOpen(false)
  }

  const big = size === 'lg'

  return (
    <div ref={boxRef} className="relative w-full">
      <form onSubmit={submit}>
        <div
          className={`flex items-center rounded-full bg-white shadow-card border border-slate-200 ${
            big ? 'pl-6 pr-2 py-2' : 'pl-4 pr-1.5 py-1.5'
          }`}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => suggestions.length && setOpen(true)}
            placeholder={placeholder}
            className={`flex-1 bg-transparent outline-none text-slate-800 placeholder:text-slate-400 ${
              big ? 'text-lg' : 'text-sm'
            }`}
          />
          <button
            type="submit"
            className={`flex items-center justify-center rounded-full bg-brand-blue text-white hover:bg-brand-blueDark transition ${
              big ? 'h-11 w-11' : 'h-9 w-9'
            }`}
            aria-label="Search"
          >
            <Search size={big ? 22 : 18} />
          </button>
        </div>
      </form>

      {open && suggestions.length > 0 && (
        <div className="absolute z-30 mt-2 w-full rounded-2xl border border-slate-200 bg-white shadow-cardHover overflow-hidden">
          {suggestions.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                navigate(`/review/${c.slug}`)
                setOpen(false)
                setQ('')
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white"
                style={{ backgroundColor: colorFor(c.company_name) }}
              >
                {initials(c.company_name)}
              </span>
              <span className="flex-1">
                <span className="block font-semibold text-slate-800">{c.company_name}</span>
                <span className="block text-xs text-slate-500">{c.website} · {c.category}</span>
              </span>
              <span className="text-xs font-semibold text-brand-green">
                {c.avg_rating > 0 ? c.avg_rating.toFixed(1) : '—'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
