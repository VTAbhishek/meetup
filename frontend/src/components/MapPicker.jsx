import { useEffect, useRef, useState } from 'react'
import { MapPin, Search, Crosshair, Trash2, Save, AlertTriangle } from 'lucide-react'
import { api } from '../api'
import { toastOk, alertErr } from '../alerts'
import { loadGoogleMaps, DEFAULT_CENTER, DEFAULT_ZOOM, round7 } from '../lib/googleMaps'

/**
 * Business dashboard map picker. The company searches for its venue (Places
 * autocomplete), drags the pin to the exact spot, and saves. The saved pin is
 * what customers see on the public company page.
 *
 * `company` is the row from api.myCompany(); `onSaved` gets the new
 * { latitude, longitude, map_zoom } so the dashboard can update without a refetch.
 */
export default function MapPicker({ company, onSaved }) {
  const boxRef = useRef(null)     // the div Google draws the map into
  const searchRef = useRef(null)  // the autocomplete <input>
  const mapRef = useRef(null)     // google.maps.Map
  const markerRef = useRef(null)  // google.maps.Marker

  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [pos, setPos] = useState(
    company.latitude != null && company.longitude != null
      ? { lat: Number(company.latitude), lng: Number(company.longitude) }
      : null
  )
  const [busy, setBusy] = useState(false)

  // Keep the latest position in a ref so the Google event listeners — which are
  // attached once on mount — always read the current value instead of closing
  // over the first render's state.
  const posRef = useRef(pos)
  posRef.current = pos

  useEffect(() => {
    let cancelled = false

    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !boxRef.current) return

        const start = posRef.current || DEFAULT_CENTER
        const map = new google.maps.Map(boxRef.current, {
          center: start,
          zoom: posRef.current ? company.map_zoom || DEFAULT_ZOOM : 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        })
        mapRef.current = map

        const marker = new google.maps.Marker({
          map,
          position: start,
          draggable: true,
          visible: !!posRef.current, // hidden until the company drops a pin
        })
        markerRef.current = marker

        const place = (latLng) => {
          const next = { lat: round7(latLng.lat()), lng: round7(latLng.lng()) }
          marker.setPosition(next)
          marker.setVisible(true)
          setPos(next)
        }

        marker.addListener('dragend', (e) => place(e.latLng))
        map.addListener('click', (e) => place(e.latLng))

        // Places autocomplete on the search box, wired to move the pin.
        if (searchRef.current) {
          const ac = new google.maps.places.Autocomplete(searchRef.current, {
            fields: ['geometry', 'name'],
          })
          ac.bindTo('bounds', map)
          ac.addListener('place_changed', () => {
            const p = ac.getPlace()
            if (!p.geometry?.location) return
            map.panTo(p.geometry.location)
            map.setZoom(17)
            place(p.geometry.location)
          })
        }

        setReady(true)
      })
      .catch((err) => !cancelled && setLoadError(err.message))

    return () => { cancelled = true }
    // Mount-only: the map is imperative and manages its own updates afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Centre on the device's current location and drop the pin there. */
  const useMyLocation = () => {
    if (!navigator.geolocation) return alertErr('Your browser does not support location lookup.')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const next = { lat: round7(coords.latitude), lng: round7(coords.longitude) }
        setPos(next)
        markerRef.current?.setPosition(next)
        markerRef.current?.setVisible(true)
        mapRef.current?.panTo(next)
        mapRef.current?.setZoom(17)
      },
      () => alertErr('Could not read your location. Please allow location access, or drag the pin instead.')
    )
  }

  const save = async () => {
    if (!pos) return alertErr('Drop a pin on the map first — search for your venue or click the map.')
    setBusy(true)
    try {
      const zoom = mapRef.current?.getZoom() || DEFAULT_ZOOM
      // The update endpoint rewrites the whole profile row, so resend the
      // fields it also owns or they'd be blanked out.
      await api.updateMyCompany({
        company_name: company.company_name,
        website: company.website || '',
        category: company.category || '',
        phone: company.phone || '',
        address: company.address || '',
        description: company.description || '',
        latitude: pos.lat,
        longitude: pos.lng,
        map_zoom: zoom,
      })
      toastOk('Location saved')
      onSaved?.({ latitude: pos.lat, longitude: pos.lng, map_zoom: zoom })
    } catch (err) {
      alertErr(err)
    } finally {
      setBusy(false)
    }
  }

  const clear = async () => {
    setBusy(true)
    try {
      await api.updateMyCompany({
        company_name: company.company_name,
        website: company.website || '',
        category: company.category || '',
        phone: company.phone || '',
        address: company.address || '',
        description: company.description || '',
        latitude: null,
        longitude: null,
      })
      setPos(null)
      markerRef.current?.setVisible(false)
      toastOk('Location removed')
      onSaved?.({ latitude: null, longitude: null, map_zoom: DEFAULT_ZOOM })
    } catch (err) {
      alertErr(err)
    } finally {
      setBusy(false)
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
            Search for your venue or click the map, then drag the pin to the exact spot. Customers see this map
            on your public page with a directions link.
          </p>
        </div>
        {pos && (
          <button onClick={clear} disabled={busy} className="btn-ghost py-2 text-sm text-red-600 hover:bg-red-50">
            <Trash2 size={15} /> Remove pin
          </button>
        )}
      </div>

      {loadError ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Map unavailable</p>
            <p className="mt-0.5">{loadError}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                className="input pl-9"
                placeholder="Search your venue, street or city…"
                // Enter would submit any wrapping form before Places responds.
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              />
            </div>
            <button type="button" onClick={useMyLocation} className="btn-ghost shrink-0 py-2 text-sm">
              <Crosshair size={15} /> Use my location
            </button>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-slate-200">
            <div ref={boxRef} className="h-[340px] w-full bg-slate-100" />
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-100 text-sm text-slate-400">
                Loading map…
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              {pos ? (
                <>
                  Pin at <span className="font-semibold tabular-nums text-slate-700">{pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}</span>
                </>
              ) : (
                'No pin yet — search or click the map to drop one.'
              )}
            </p>
            <button onClick={save} disabled={busy || !pos} className="btn-blue py-2 text-sm disabled:opacity-50">
              <Save size={15} /> {busy ? 'Saving…' : 'Save location'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
