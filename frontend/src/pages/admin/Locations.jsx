import { useEffect, useState } from 'react'
import { Plus, Trash2, MapPin, Building } from 'lucide-react'
import { api } from '../../api'
import { confirmDelete, toastOk, alertErr } from '../../alerts'
import Spinner from '../../components/Spinner'

export default function Locations() {
  const [districts, setDistricts] = useState([])
  const [districtId, setDistrictId] = useState('')
  const [cities, setCities] = useState([])
  const [loadingD, setLoadingD] = useState(true)
  const [loadingC, setLoadingC] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Load the district list once.
  const loadDistricts = () =>
    api.adminDistricts().then((d) => setDistricts(d.districts)).finally(() => setLoadingD(false))
  useEffect(() => { loadDistricts() }, [])

  // Load cities whenever the chosen district changes.
  const loadCities = (id) => {
    if (!id) { setCities([]); return }
    setLoadingC(true)
    api.adminCities(id).then((d) => setCities(d.cities)).finally(() => setLoadingC(false))
  }
  useEffect(() => { loadCities(districtId) }, [districtId])

  const selectedDistrict = districts.find((d) => String(d.id) === String(districtId))

  const add = async (e) => {
    e.preventDefault()
    setError('')
    if (!districtId) { setError('Choose a district first.'); return }
    if (!name.trim()) return
    setBusy(true)
    try {
      await api.createCity(districtId, name.trim())
      setName('')
      loadCities(districtId)
      loadDistricts() // refresh the per-district city counts
      toastOk(`“${name.trim()}” added to ${selectedDistrict?.name}`)
    } catch (err) {
      setError(err.message)
      alertErr(err)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (c) => {
    if (!(await confirmDelete({ title: `Delete "${c.name}"?`, text: `Remove this city from ${selectedDistrict?.name}?` }))) return
    try {
      await api.deleteCity(c.id)
      loadCities(districtId)
      loadDistricts()
      toastOk('City deleted')
    } catch (e) {
      alertErr(e)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0">
        <h1 className="text-2xl font-extrabold text-brand-navy">Districts &amp; Cities</h1>
        <p className="text-sm text-slate-500">Pick a district, then add the cities that belong to it.</p>
      </div>

      {loadingD ? (
        <Spinner />
      ) : (
        <>
          {/* Step 1 — choose district, then add a city */}
          <div className="card mt-6 shrink-0 p-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-end">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">District</span>
                <div className="relative">
                  <MapPin size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
                  <select
                    value={districtId}
                    onChange={(e) => setDistrictId(e.target.value)}
                    className="input pl-9"
                  >
                    <option value="">Select a district…</option>
                    {districts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.city_count})
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">New city</span>
                <div className="relative">
                  <Building size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!districtId}
                    placeholder={districtId ? `Add a city in ${selectedDistrict?.name}` : 'Choose a district first'}
                    className="input pl-9 disabled:cursor-not-allowed disabled:bg-slate-50"
                  />
                </div>
              </label>

              <form onSubmit={add}>
                <button type="submit" disabled={busy || !districtId} className="btn-blue w-full shrink-0 sm:w-auto">
                  <Plus size={18} /> {busy ? 'Adding…' : 'Add city'}
                </button>
              </form>
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>

          {/* Step 2 — cities in the chosen district */}
          <div className="mt-6 min-h-0 flex-1 overflow-y-auto pr-1">
            {!districtId ? (
              <div className="grid h-full place-items-center rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center">
                <div>
                  <MapPin size={28} className="mx-auto text-slate-300" />
                  <p className="mt-2 text-sm text-slate-500">Select a district above to view and add its cities.</p>
                </div>
              </div>
            ) : loadingC ? (
              <Spinner />
            ) : cities.length === 0 ? (
              <div className="grid h-full place-items-center rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center">
                <div>
                  <Building size={28} className="mx-auto text-slate-300" />
                  <p className="mt-2 text-sm text-slate-500">
                    No cities in <strong className="text-brand-navy">{selectedDistrict?.name}</strong> yet. Add the first one above.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <p className="mb-3 text-sm font-semibold text-slate-500">
                  {cities.length} {cities.length === 1 ? 'city' : 'cities'} in {selectedDistrict?.name}
                </p>
                <div className="grid auto-rows-min content-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {cities.map((c) => (
                    <div key={c.id} className="card flex items-center gap-3 p-4">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-silver text-brand-blue">
                        <Building size={20} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-brand-navy">{c.name}</p>
                        <p className="text-xs text-slate-500">{selectedDistrict?.name} District</p>
                      </div>
                      <button
                        onClick={() => remove(c)}
                        className="rounded-lg border border-slate-300 p-2 text-red-600 hover:bg-red-50"
                        title="Delete city"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
