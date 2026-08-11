import { useEffect, useRef, useState } from 'react'
import { MapPin, Search, Crosshair, Trash2, Save, Loader2 } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { api } from '../api'
import { toastOk, alertErr } from '../alerts'
import { DEFAULT_CENTER, DEFAULT_ZOOM, round7, searchPlaces } from '../lib/maps'

/**
 * Business dashboard map picker, drawn with Leaflet over OpenStreetMap tiles —
 * no API key, no billing account. The company searches for its venue, clicks
 * the map or drags the pin, and saves. The saved pin is what customers see on
 * the public company page.
 *
 * `company` is the row from api.myCompany(); `onSaved` gets the new
 * { latitude, longitude, map_zoom } so the dashboard updates without a refetch.
 */
export default function MapPicker({ company, onSaved }) {
  const boxRef = useRef(null)      // the div Leaflet draws into
  const mapRef = useRef(null)      // L.Map
  const markerRef = useRef(null)   // L.Marker

  const [pos, setPos] = useState(
    company.latitude != null && company.longitude != null
      ? { lat: Number(company.latitude), lng: Number(company.longitude) }
      : null
  )
  const [busy, setBusy] = useState(false)

  // ---- Place search ----
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)

  // Leaflet listeners are attached once, so they read the pin through a ref
  // rather than closing over the first render's state.
  const posRef = useRef(pos)
  posRef.current = pos

  useEffect(() => {
    if (!boxRef.current || mapRef.current) return

    const start = posRef.current || DEFAULT_CENTER
    const map = L.map(boxRef.current).setView(
      [start.lat, start.lng],
      posRef.current ? company.map_zoom || DEFAULT_ZOOM : 12
    )
    mapRef.current = map

    // OpenStreetMap requires visible attribution — do not remove.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    // A div icon avoids Leaflet's bundler-hostile default marker images and
    // lets the pin match the app's colours.
    const icon = L.divIcon({
      className: '',
      html: `<svg width="30" height="42" viewBox="0 0 24 34" xmlns="http://www.w3.org/2000/svg">
               <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 22 12 22s12-13 12-22c0-6.6-5.4-12-12-12z" fill="#16a34a"/>
               <circle cx="12" cy="12" r="5" fill="#fff"/>
             </svg>`,
      iconSize: [30, 42],
      iconAnchor: [15, 42],
    })

    const marker = L.marker([start.lat, start.lng], { draggable: true, icon })
    if (posRef.current) marker.addTo(map)
    markerRef.current = marker

    const place = (latlng) => {
      const next = { lat: round7(latlng.lat), lng: round7(latlng.lng) }
      marker.setLatLng(next)
      if (!map.hasLayer(marker)) marker.addTo(map)
      setPos(next)
    }

    marker.on('dragend', () => place(marker.getLatLng()))
    map.on('click', (e) => place(e.latlng))

    // The dashboard renders this card inside a growing page; Leaflet needs a
    // nudge once the container has settled at its real height.
    setTimeout(() => map.invalidateSize(), 0)

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // Mount-only: the map is imperative and manages itself afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Move the pin and recentre the map. */
  const moveTo = (lat, lng, zoom = 17) => {
    const next = { lat: round7(lat), lng: round7(lng) }
    setPos(next)
    const m = markerRef.current
    const map = mapRef.current
    if (m && map) {
      m.setLatLng(next)
      if (!map.hasLayer(m)) m.addTo(map)
      map.setView([next.lat, next.lng], zoom)
    }
  }

  const runSearch = async (e) => {
    e?.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setSearched(true)
    try {
      setResults(await searchPlaces(query))
    } catch (err) {
      alertErr(err)
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  const useMyLocation = () => {
    if (!navigator.geolocation) return alertErr('Your browser does not support location lookup.')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => moveTo(coords.latitude, coords.longitude),
      () => alertErr('Could not read your location. Please allow location access, or drag the pin instead.')
    )
  }

  /**
   * The update endpoint rewrites the whole profile row, so every field it owns
   * has to be resent or it would be blanked out.
   */
  const saveWith = async (extra, okMsg) => {
    setBusy(true)
    try {
      await api.updateMyCompany({
        company_name: company.company_name,
        website: company.website || '',
        category: company.category || '',
        phone: company.phone || '',
        address: company.address || '',
        description: company.description || '',
        ...extra,
      })
      toastOk(okMsg)
      return true
    } catch (err) {
      alertErr(err)
      return false
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!pos) return alertErr('Drop a pin on the map first — search for your venue or click the map.')
    const zoom = mapRef.current?.getZoom() || DEFAULT_ZOOM
    if (await saveWith({ latitude: pos.lat, longitude: pos.lng, map_zoom: zoom }, 'Location saved')) {
      onSaved?.({ latitude: pos.lat, longitude: pos.lng, map_zoom: zoom })
    }
  }

  const clear = async () => {
    if (await saveWith({ latitude: null, longitude: null }, 'Location removed')) {
      setPos(null)
      const m = markerRef.current
      if (m && mapRef.current?.hasLayer(m)) mapRef.current.removeLayer(m)
      onSaved?.({ latitude: null, longitude: null, map_zoom: DEFAULT_ZOOM })
    }
  }

  return (
    <div className="card mt-6 p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-brand-navy">
            <MapPin size={18} className="text-brand-green" /> Location on the map
          </h2>
          <p className="text-sm text-slate-500">
            Search for your venue, or click the map and drag the pin to the exact spot. Customers see this
            location on your public page with a directions link.
          </p>
        </div>
        {pos && (
          <button onClick={clear} disabled={busy} className="btn-ghost py-2 text-sm text-red-600 hover:bg-red-50">
            <Trash2 size={15} /> Remove pin
          </button>
        )}
      </div>

      {/* Search — runs on Enter or the button, never per keystroke, to stay
          inside OpenStreetMap's one-request-per-second policy. */}
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your venue, street or city…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault() // never submit a surrounding form
                runSearch()
              }
            }}
          />
        </div>
        <button type="button" onClick={runSearch} disabled={searching} className="btn-blue shrink-0 py-2 text-sm">
          {searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Search
        </button>
        <button type="button" onClick={useMyLocation} className="btn-ghost shrink-0 py-2 text-sm">
          <Crosshair size={15} /> Use my location
        </button>
      </div>

      {results.length > 0 && (
        <ul className="mb-3 max-h-40 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => { moveTo(r.lat, r.lng); setResults([]); setQuery(r.label) }}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-slate-600 hover:bg-brand-silver/60"
              >
                <MapPin size={14} className="mt-0.5 shrink-0 text-brand-green" />
                <span>{r.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {searched && !searching && results.length === 0 && (
        <p className="mb-3 text-sm text-slate-400">No places matched. Try a broader search, or click the map directly.</p>
      )}

      <div ref={boxRef} className="h-[340px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100" />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {pos ? (
            <>Pin at <span className="font-semibold tabular-nums text-slate-700">{pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}</span></>
          ) : (
            'No pin yet — search or click the map to drop one.'
          )}
        </p>
        <button onClick={save} disabled={busy || !pos} className="btn-blue py-2 text-sm disabled:opacity-50">
          <Save size={15} /> {busy ? 'Saving…' : 'Save location'}
        </button>
      </div>
    </div>
  )
}
