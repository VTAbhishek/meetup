/**
 * Loads the Google Maps JavaScript API once per page and hands back the global
 * `google` object. Several components (the business picker, the customer map)
 * can call this freely — the script tag is only ever injected once and every
 * caller shares the same promise.
 *
 * Needs VITE_GOOGLE_MAPS_KEY in frontend/.env. Without it we reject with a
 * readable message so the UI can explain the setup step instead of rendering a
 * blank grey box.
 */
export const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || ''

/** Default map centre when a company has no pin yet: Colombo, Sri Lanka. */
export const DEFAULT_CENTER = { lat: 6.9271, lng: 79.8612 }
export const DEFAULT_ZOOM = 16

let promise = null

export function loadGoogleMaps() {
  if (window.google?.maps?.places) return Promise.resolve(window.google)
  if (promise) return promise

  if (!MAPS_KEY) {
    return Promise.reject(
      new Error('Google Maps is not configured. Add VITE_GOOGLE_MAPS_KEY to frontend/.env and restart the dev server.')
    )
  }

  promise = new Promise((resolve, reject) => {
    // The callback name is what Google invokes once the library is parsed.
    const cb = '__meetupMapsReady'
    window[cb] = () => {
      delete window[cb]
      resolve(window.google)
    }

    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(MAPS_KEY)}&libraries=places&callback=${cb}&loading=async`
    s.async = true
    s.onerror = () => {
      // Let a later mount retry — a failed load is usually a bad key or an
      // offline dev machine, both of which can be fixed without a reload.
      promise = null
      delete window[cb]
      reject(new Error('Could not load Google Maps. Check your API key and internet connection.'))
    }
    document.head.appendChild(s)
  })

  return promise
}

/** Round to ~1 cm precision — matches the DECIMAL(10,7) columns in the database. */
export const round7 = (n) => Math.round(Number(n) * 1e7) / 1e7

/** Directions link that works on both desktop and mobile Google Maps. */
export const directionsUrl = (lat, lng) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
