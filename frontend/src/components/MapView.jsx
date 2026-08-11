import { MapPin, Navigation } from 'lucide-react'
import { directionsUrl, embedUrl, DEFAULT_ZOOM } from '../lib/maps'

/**
 * Read-only map with the company's pin, shown on the public company page.
 *
 * Uses Google Maps' keyless embed so customers get the map they know without
 * the project needing an API key or a billing account. Renders nothing when the
 * company hasn't set a location, so profiles without a pin get no map section.
 */
export default function MapView({ lat, lng, zoom = DEFAULT_ZOOM, name, address, height = 300 }) {
  if (lat == null || lng == null) return null

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <iframe
          title={name ? `Map showing ${name}` : 'Map'}
          src={embedUrl(lat, lng, zoom)}
          width="100%"
          height={height}
          style={{ border: 0, display: 'block' }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
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
