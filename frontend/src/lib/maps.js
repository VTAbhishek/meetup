/**
 * Map helpers. Nothing here needs an API key.
 *
 * The business picker draws an interactive Leaflet map over OpenStreetMap
 * tiles; the public company page embeds Google Maps through its keyless iframe
 * so customers get the map (and the app) they already know.
 */

/** Default map centre when a company has no pin yet: Colombo, Sri Lanka. */
export const DEFAULT_CENTER = { lat: 6.9271, lng: 79.8612 }
export const DEFAULT_ZOOM = 16

/** Round to ~1 cm precision — matches the DECIMAL(10,7) columns in the database. */
export const round7 = (n) => Math.round(Number(n) * 1e7) / 1e7

/** Directions link that works on both desktop and mobile Google Maps. */
export const directionsUrl = (lat, lng) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`

/** Keyless Google Maps iframe source, used for the read-only customer map. */
export const embedUrl = (lat, lng, zoom = DEFAULT_ZOOM) =>
  `https://maps.google.com/maps?q=${lat},${lng}&z=${zoom}&hl=en&output=embed`

/**
 * Look a place up through OpenStreetMap's Nominatim geocoder.
 *
 * Nominatim's usage policy caps this at one request per second, so callers must
 * search on an explicit action (a button or Enter) rather than on every
 * keystroke. `signal` lets a component drop a search it no longer cares about.
 */
export async function searchPlaces(query, { signal, limit = 6 } = {}) {
  const q = query.trim()
  if (!q) return []

  const url =
    'https://nominatim.openstreetmap.org/search' +
    `?format=jsonv2&limit=${limit}&addressdetails=1&q=${encodeURIComponent(q)}`

  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('Place search is unavailable right now.')

  const rows = await res.json()
  return rows.map((r) => ({
    label: r.display_name,
    lat: round7(r.lat),
    lng: round7(r.lon),
  }))
}
