import { useState } from 'react'
import { MapPin, Navigation, Map as MapIcon, PersonStanding, ExternalLink } from 'lucide-react'
import { directionsUrl, embedUrl, streetViewEmbedUrl, streetViewUrl, DEFAULT_ZOOM } from '../lib/maps'

/**
 * The company's location on the public page: a map, a Street View look at the
 * frontage, and a directions hand-off to Google Maps.
 *
 * Both views are Google's keyless embeds, so this needs no API key. Renders
 * nothing when the company hasn't pinned itself.
 */
export default function MapView({ lat, lng, zoom = DEFAULT_ZOOM, name, address, height = 300 }) {
  const [tab, setTab] = useState('map')

  if (lat == null || lng == null) return null

  const isMap = tab === 'map'

  return (
    <div>
      {/* Map / Street View switch */}
      <div className="mb-2.5 inline-flex rounded-full border border-slate-200 bg-white p-0.5 text-sm font-semibold">
        <Tab active={isMap} onClick={() => setTab('map')} icon={MapIcon}>Map</Tab>
        <Tab active={!isMap} onClick={() => setTab('street')} icon={PersonStanding}>Street View</Tab>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        {/* Keyed so switching tabs swaps the document instead of reusing the
            previous panorama's iframe. */}
        <iframe
          key={tab}
          title={isMap ? `Map showing ${name || 'this place'}` : `Street View of ${name || 'this place'}`}
          src={isMap ? embedUrl(lat, lng, zoom) : streetViewEmbedUrl(lat, lng)}
          width="100%"
          height={height}
          style={{ border: 0, display: 'block' }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>

      {!isMap && (
        <p className="mt-2 text-xs text-slate-400">
          Street View isn't available everywhere. If this looks empty, open it in Google Maps.
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2">
        <a href={directionsUrl(lat, lng)} target="_blank" rel="noreferrer" className="btn-blue justify-center py-2.5 text-sm">
          <Navigation size={15} /> Get directions
        </a>
        <a
          href={isMap ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : streetViewUrl(lat, lng)}
          target="_blank"
          rel="noreferrer"
          className="btn-ghost justify-center py-2.5 text-sm"
        >
          <ExternalLink size={15} /> Open in Google Maps
        </a>
      </div>

      {address && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
          <MapPin size={13} className="mt-0.5 shrink-0 text-slate-400" /> {address}
        </p>
      )}
    </div>
  )
}

function Tab({ active, onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition ${
        active ? 'bg-brand-blue text-white' : 'text-slate-500 hover:text-brand-navy'
      }`}
    >
      <Icon size={14} /> {children}
    </button>
  )
}
