import { useEffect, useRef, useState } from 'react'
import { MapPin, Navigation } from 'lucide-react'
import { loadGoogleMaps, directionsUrl, DEFAULT_ZOOM } from '../lib/googleMaps'

/**
 * Read-only Google map with the company's pin, shown on the public company
 * page. Renders nothing at all when the company hasn't set a location, so
 * profiles without a pin simply don't get a map section.
 */
export default function MapView({ lat, lng, zoom = DEFAULT_ZOOM, name, address, height = 300 }) {
  const boxRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  const hasPin = lat != null && lng != null

  useEffect(() => {
    if (!hasPin) return
    let cancelled = false

    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !boxRef.current) return
        const center = { lat: Number(lat), lng: Number(lng) }
        const map = new google.maps.Map(boxRef.current, {
          center,
          zoom: zoom || DEFAULT_ZOOM,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        })
        const marker = new google.maps.Marker({ map, position: center, title: name })

        if (name) {
          const info = new google.maps.InfoWindow({
            content: `<div style="font-weight:700;color:#0f172a">${escapeHtml(name)}</div>${
              address ? `<div style="color:#64748b;font-size:12px;margin-top:2px">${escapeHtml(address)}</div>` : ''
            }`,
          })
          marker.addListener('click', () => info.open({ map, anchor: marker }))
        }
        setReady(true)
      })
      .catch(() => !cancelled && setFailed(true))

    return () => { cancelled = true }
  }, [lat, lng, zoom, name, address, hasPin])

  if (!hasPin) return null

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl border border-slate-200">
        <div ref={boxRef} style={{ height }} className="w-full bg-slate-100" />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100 text-sm text-slate-400">
            {failed ? 'Map could not be loaded.' : 'Loading map…'}
          </div>
        )}
      </div>
      <a
        href={directionsUrl(lat, lng)}
        target="_blank"
        rel="noreferrer"
        className="btn-ghost mt-3 w-full justify-center py-2.5 text-sm"
      >
        <Navigation size={15} /> Get directions
      </a>
      {address && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
          <MapPin size={13} className="mt-0.5 shrink-0 text-slate-400" /> {address}
        </p>
      )}
    </div>
  )
}

/** InfoWindow takes an HTML string, so company-supplied text must be escaped. */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}
