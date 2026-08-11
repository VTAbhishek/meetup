import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { api } from '../api'
import { useLocationCtx } from '../location'
import SearchBar from '../components/SearchBar'
import DistrictCityPicker from '../components/DistrictCityPicker'
import MoodFilter from '../components/MoodFilter'
import CompanyResults from '../components/CompanyResults'
import Spinner from '../components/Spinner'

export default function Search() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  // The mood lives in the URL so a filtered search can be shared or bookmarked,
  // and the back button steps through mood changes.
  const mood = params.get('mood') || ''

  const { districts, districtId, cityId, setDistrict, setCity, clear, nameOfDistrict, nameOfCity } = useLocationCtx()
  const [companies, setCompanies] = useState([])
  const [moods, setMoods] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.moods().then((d) => setMoods(d.moods)).catch(() => setMoods([]))
  }, [])

  useEffect(() => {
    setLoading(true)
    const qs = new URLSearchParams({ limit: '48' })
    if (q) qs.set('q', q)
    if (districtId) qs.set('district_id', districtId)
    if (cityId) qs.set('city_id', cityId)
    if (mood) qs.set('mood', mood)
    api
      .companies(`?${qs.toString()}`)
      .then((d) => setCompanies(d.companies))
      .finally(() => setLoading(false))
  }, [q, districtId, cityId, mood])

  /** Keep `q` when the mood changes; drop `mood` entirely when cleared. */
  const setMood = (slug) => {
    const next = new URLSearchParams(params)
    if (slug) next.set('mood', slug)
    else next.delete('mood')
    setParams(next, { replace: false })
  }

  const districtName = nameOfDistrict(districtId)
  const cityName = nameOfCity(cityId)
  const moodName = moods.find((m) => m.slug === mood)?.name || ''
  const hasFilters = q || districtId || cityId || mood

  return (
    <div className="container-page py-10">
      {/* Search + location + mood filters */}
      <div className="mx-auto mb-6 max-w-2xl space-y-3">
        <SearchBar />
        <DistrictCityPicker
          districts={districts}
          districtId={districtId}
          cityId={cityId}
          onDistrict={setDistrict}
          onCity={setCity}
        />
        <MoodFilter moods={moods} value={mood} onChange={setMood} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-extrabold text-brand-navy">
          {q ? <>Results for “{q}”</> : 'Companies'}
        </h1>
        {(districtId || cityId) && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-blueLight/15 px-3 py-1 text-sm font-semibold text-brand-blue">
            {cityName ? `${cityName}, ${districtName}` : districtName}
          </span>
        )}
        {moodName && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-green/10 px-3 py-1 text-sm font-semibold text-brand-green">
            {moodName}
            <button onClick={() => setMood('')} title="Remove mood filter" className="hover:text-red-600">
              <X size={13} />
            </button>
          </span>
        )}
        {hasFilters && (
          <button
            onClick={() => { clear(); setMood('') }}
            className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-red-600"
          >
            <X size={14} /> Clear filters
          </button>
        )}
      </div>

      {/* CompanyResults owns the count, the star/open filters and the sort
          dropdown — which already defaults to "Top rated". */}
      {loading ? (
        <Spinner />
      ) : (
        <CompanyResults
          companies={companies}
          emptyHint={
            mood
              ? 'No place here matches that mood yet. Try another mood, or a wider area.'
              : 'Try a different name, category, district, or city.'
          }
        />
      )}
    </div>
  )
}
