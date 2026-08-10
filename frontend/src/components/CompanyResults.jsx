import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import CompanyCard from './CompanyCard'

/**
 * Shared results view: rating chips + "Open now" tick + sort dropdown, then a
 * responsive grid of company cards. Used by the Search page and category pages.
 */
export default function CompanyResults({ companies, emptyHint }) {
  const [stars, setStars] = useState(0)       // 0 = all, 1..5 = rounded rating
  const [openOnly, setOpenOnly] = useState(false)
  const [sortBy, setSortBy] = useState('top') // top | reviews | name

  const filtered = useMemo(() => {
    let list = companies
    if (stars > 0) list = list.filter((c) => Math.round(c.avg_rating) === stars)
    if (openOnly) list = list.filter((c) => c.open_now === true)
    const sorted = [...list]
    if (sortBy === 'top') sorted.sort((a, b) => b.avg_rating - a.avg_rating || b.review_count - a.review_count)
    if (sortBy === 'reviews') sorted.sort((a, b) => b.review_count - a.review_count || b.avg_rating - a.avg_rating)
    if (sortBy === 'name') sorted.sort((a, b) => a.company_name.localeCompare(b.company_name))
    return sorted
  }, [companies, stars, openOnly, sortBy])

  return (
    <>
      {/* Rating chips · Open-now tick · sort */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Chip active={stars === 0} onClick={() => setStars(0)}>All</Chip>
          {[5, 4, 3, 2, 1].map((r) => (
            <Chip key={r} active={stars === r} onClick={() => setStars(stars === r ? 0 : r)}>{r}★</Chip>
          ))}
        </div>

        <button
          onClick={() => setOpenOnly((o) => !o)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
            openOnly ? 'border-green-600 bg-green-600 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <span className={`flex h-4 w-4 items-center justify-center rounded border ${openOnly ? 'border-white bg-white' : 'border-slate-400'}`}>
            {openOnly && <Check size={12} className="text-green-600" strokeWidth={3.5} />}
          </span>
          Open now
        </button>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="ml-auto rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 focus:border-brand-blue focus:outline-none"
        >
          <option value="top">Top rated</option>
          <option value="reviews">Most reviews</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-slate-500">
          <p className="text-lg font-semibold text-slate-700">No companies found</p>
          <p className="mt-1">
            {companies.length > 0
              ? 'No companies match these filters — try clearing the star or "Open now" filter.'
              : emptyHint || 'Nothing here yet.'}
          </p>
        </div>
      ) : (
        <>
          <p className="mb-6 text-sm text-slate-500">
            {filtered.length} {filtered.length === 1 ? 'company' : 'companies'}
            {filtered.length !== companies.length ? ` (of ${companies.length})` : ''}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {filtered.map((c) => (
              <CompanyCard key={c.id} company={c} />
            ))}
          </div>
        </>
      )}
    </>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
        active ? 'bg-brand-blue text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )
}
