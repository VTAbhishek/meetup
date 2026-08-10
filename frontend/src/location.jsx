import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api'

/**
 * Site-wide location state (district + city). Powers the navbar picker and the
 * Search page filters, and caches the district/city catalogue for the whole app
 * (registration form included) so it's fetched only once.
 */
const LocationContext = createContext(null)

export function LocationProvider({ children }) {
  const [districts, setDistricts] = useState([])
  const [loading, setLoading] = useState(true)
  const [districtId, setDistrictId] = useState(() => localStorage.getItem('loc_district') || '')
  const [cityId, setCityId] = useState(() => localStorage.getItem('loc_city') || '')

  useEffect(() => {
    api.locations()
      .then((d) => setDistricts(d.districts || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const persist = (key, val) => {
    if (val) localStorage.setItem(key, val)
    else localStorage.removeItem(key)
  }

  const setDistrict = (id) => {
    const v = id ? String(id) : ''
    setDistrictId(v)
    setCityId('')            // a district change always resets the city
    persist('loc_district', v)
    persist('loc_city', '')
  }

  const setCity = (id) => {
    const v = id ? String(id) : ''
    setCityId(v)
    persist('loc_city', v)
  }

  const clear = () => setDistrict('')

  const citiesFor = (id) => districts.find((d) => String(d.id) === String(id))?.cities || []
  const nameOfDistrict = (id) => districts.find((d) => String(d.id) === String(id))?.name || ''
  const nameOfCity = (id) => citiesFor(districtId).find((c) => String(c.id) === String(id))?.name || ''

  return (
    <LocationContext.Provider
      value={{ districts, loading, districtId, cityId, setDistrict, setCity, clear, citiesFor, nameOfDistrict, nameOfCity }}
    >
      {children}
    </LocationContext.Provider>
  )
}

export const useLocationCtx = () => useContext(LocationContext)
