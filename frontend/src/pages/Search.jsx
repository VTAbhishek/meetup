import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { api } from '../api'
import { useLocationCtx } from '../location'
import SearchBar from '../components/SearchBar'
import DistrictCityPicker from '../components/DistrictCityPicker'
import CompanyResults from '../components/CompanyResults'
import Spinner from '../components/Spinner'

export default function Search() {
  const [params] = useSearchParams()
  const q = params.get('q') || ''
  const { districts, districtId, cityId, setDistrict, setCity, clear, nameOfDistrict, nameOfCity } = useLocationCtx()
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const qs = new URLSearchParams({ limit: '48' })
    if (q) qs.set('q', q)
    if (districtId) qs.set('district_id', districtId)
    if (cityId) qs.set('city_id', cityId)
    api
      .companies(`?${qs.toString()}`)
      .then((d) => setCompanies(d.companies))
      .finally(() => setLoading(false))
  }, [q, districtId, cityId])

  const districtName = nameOfDistrict(districtId)
  const cityName = nameOfCity(cityId)
  const hasFilters = q || districtId || cityId

  return (
    <div className="container-page py-10">
      {/* Search + location filters */}
      <div className="mx-auto mb-6 max-w-2xl space-y-3">
        <SearchBar />
        <DistrictCityPicker
          districts={districts}
          districtId={districtId}
          cityId={cityId}
          onDistrict={setDistrict}
          onCity={setCity}
        />
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
        {hasFilters && (
          <button onClick={clear} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-red-600">
            <X size={14} /> Clear location
          </button>
        )}
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <CompanyResults companies={companies} emptyHint="Try a different name, category, district, or city." />
      )}
    </div>
  )
}
