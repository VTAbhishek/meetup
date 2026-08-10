import { Link } from 'react-router-dom'
import { Star } from 'lucide-react'

const VARIANTS = {
  customer: {
    badge: 'Customer',
    gradient: 'from-brand-blueDark via-brand-blue to-brand-blueLight',
    blob: 'bg-brand-green/40',
    headline: 'Find a company you can trust.',
    blurb: 'Join thousands of people sharing honest reviews and helping others choose with confidence.',
  },
  company: {
    badge: 'For businesses',
    gradient: 'from-purple-800 via-brand-green to-pink-400',
    blob: 'bg-brand-blue/40',
    headline: 'Grow with customer trust.',
    blurb: 'Claim your profile, reply to reviews, and turn feedback into your competitive advantage.',
  },
  admin: {
    badge: 'Administrator',
    gradient: 'from-slate-900 via-brand-navy to-slate-700',
    blob: 'bg-brand-blue/30',
    headline: 'Platform control center.',
    blurb: 'Manage users, companies, reviews and payments across the platform.',
  },
}

/** Redirect destination after a successful auth, by role. */
export function homeFor(user, fallback = '/') {
  if (user?.user_type === 'company') return '/business'
  if (user?.user_type === 'admin') return '/admin'
  return fallback
}

export function AuthShell({ variant = 'customer', title, subtitle, wide = false, children }) {
  const v = VARIANTS[variant] || VARIANTS.customer
  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className={`relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br ${v.gradient} p-12 text-white lg:flex`}>
        <div className={`absolute -bottom-24 -left-24 h-80 w-80 rounded-full ${v.blob} blur-3xl`} />
        <div className="absolute -top-20 -right-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <Link to="/" className="relative flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white/20">
            <Star size={22} color="white" fill="white" strokeWidth={0} />
          </span>
          <span className="text-2xl font-extrabold">Meetup</span>
        </Link>
        <div className="relative">
          <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
            {v.badge}
          </span>
          <h2 className="mt-4 text-4xl font-extrabold leading-tight">{v.headline}</h2>
          <p className="mt-4 max-w-sm text-white/80">{v.blurb}</p>
        </div>
        <p className="relative text-sm text-white/70">© {new Date().getFullYear()} Meetup</p>
      </div>

      {/* Form panel */}
      <div className="flex w-full items-center justify-center bg-brand-silver p-6 lg:w-1/2">
        <div className={`card w-full ${wide ? 'max-w-xl' : 'max-w-md'} p-8`}>
          <div className="mb-6 lg:hidden">
            <Link to="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-green">
                <Star size={20} color="white" fill="white" strokeWidth={0} />
              </span>
              <span className="text-xl font-extrabold text-brand-navy">Meetup</span>
            </Link>
          </div>
          <h1 className="text-2xl font-extrabold text-brand-navy">{title}</h1>
          <p className="mt-1 mb-6 text-slate-500">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  )
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  )
}
