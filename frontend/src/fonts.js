/**
 * Per-country typography. Selecting a country swaps the whole page font to one
 * that evokes that country. Fonts are loaded from Google Fonts on demand.
 */
export const COUNTRY_FONTS = {
  us: { family: 'Inter',            google: 'Inter:wght@400;500;600;700;800;900' },
  gb: { family: 'Lora',             google: 'Lora:wght@400;500;600;700' },
  ca: { family: 'Nunito',           google: 'Nunito:wght@400;600;700;800' },
  au: { family: 'Poppins',          google: 'Poppins:wght@400;500;600;700;800' },
  de: { family: 'Roboto',           google: 'Roboto:wght@400;500;700;900' },
  fr: { family: 'Playfair Display', google: 'Playfair+Display:wght@400;500;600;700;800' },
  in: { family: 'Mukta',            google: 'Mukta:wght@400;500;600;700;800' },
  lk: { family: 'Noto Sans Sinhala',google: 'Noto+Sans+Sinhala:wght@400;500;600;700;800' },
  sg: { family: 'Noto Sans',        google: 'Noto+Sans:wght@400;500;600;700;800' },
  ae: { family: 'Cairo',            google: 'Cairo:wght@400;500;600;700;800' },
}

const loaded = new Set()

function loadFont(google) {
  if (!google || loaded.has(google)) return
  loaded.add(google)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${google}&display=swap`
  document.head.appendChild(link)
}

/** Load (if needed) and apply the font for a country code across the whole app. */
export function applyCountryFont(code) {
  const f = COUNTRY_FONTS[code] || COUNTRY_FONTS.us
  loadFont(f.google)
  document.body.style.fontFamily = `'${f.family}', 'Inter', system-ui, sans-serif`
}
