import {
  Landmark, Plane, Laptop, Shirt, Sofa, Car, Gem, Dumbbell, Store,
} from 'lucide-react'

/** Map a category name to a lucide icon component. */
export function categoryIcon(category) {
  const map = {
    Bank: Landmark,
    'Travel Insurance': Plane,
    'Travel Insurance Company': Plane,
    'Electronics & Technology': Laptop,
    'Clothing Store': Shirt,
    'Furniture Store': Sofa,
    'Car Dealer': Car,
    'Jewelry Store': Gem,
    'Fitness and Nutrition Service': Dumbbell,
  }
  return map[category] || Store
}

/** Deterministic brand-ish colour for an avatar/logo letter. */
export function colorFor(str = '') {
  const palette = ['#7C3AED', '#DB2777', '#A855F7', '#9333EA', '#EC4899', '#C026D3', '#8B5CF6']
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return palette[Math.abs(h) % palette.length]
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

/** "3 days ago" style relative time. */
export function timeAgo(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr.replace(' ', 'T'))
  const sec = Math.floor((Date.now() - d.getTime()) / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hour${hr > 1 ? 's' : ''} ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day} day${day > 1 ? 's' : ''} ago`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo} month${mo > 1 ? 's' : ''} ago`
  return `${Math.floor(mo / 12)} year(s) ago`
}

export function ratingLabel(value) {
  if (value >= 4.5) return 'Excellent'
  if (value >= 3.5) return 'Great'
  if (value >= 2.5) return 'Average'
  if (value >= 1.5) return 'Poor'
  if (value > 0) return 'Bad'
  return 'No reviews'
}
