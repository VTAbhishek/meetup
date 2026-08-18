import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Star, LogOut, Bell, Check, ChevronDown, Globe, Phone, MapPin, Building2, Mail, ExternalLink, ClipboardList, ChefHat, ArrowRight } from 'lucide-react'
import { useAuth } from '../auth'
import { colorFor, initials, timeAgo } from '../lib'

/**
 * How each kind of notification is dressed. Keyed by an order's status first,
 * then by the notification's `tone`, so a waiting order stands out from one the
 * kitchen has already started, and both stand out from a review.
 */
const LOOK = {
  placed:    { icon: ClipboardList, label: 'New order', chip: 'bg-amber-100 text-amber-700', row: 'bg-amber-50/40' },
  preparing: { icon: ChefHat,       label: 'Preparing', chip: 'bg-blue-100 text-blue-700',   row: '' },
  order:     { icon: ClipboardList, label: 'Order',     chip: 'bg-amber-100 text-amber-700', row: '' },
  review:    { icon: Bell,          label: '',          chip: 'bg-amber-100 text-amber-600', row: '' },
}

export default function DashboardHeader({ badge, accent = 'bg-brand-blue', notifications = [], onDismiss, company = null, posOnly = false }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const doLogout = async () => {
    await logout()
    // In the POS-only shell there is nowhere else to go — send them to the
    // POS sign-in rather than the public website home.
    navigate(posOnly ? '/business/login' : '/')
  }

  // The brand mark links home on the website, but in the POS-only shell it must
  // NOT be a way out into the public site — render it as a plain badge there.
  const brand = (
    <span className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-green">
        <Star size={20} color="white" fill="white" strokeWidth={0} />
      </span>
      <span className="text-xl font-extrabold text-brand-navy">Meetup</span>
    </span>
  )

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="container-page flex h-16 items-center gap-3">
        {posOnly ? brand : <Link to="/" className="flex items-center gap-2">{brand}</Link>}
        {badge && (
          <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide text-white ${accent}`}>
            {badge}
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          {onDismiss && <NotificationBell notifications={notifications} onDismiss={onDismiss} />}
          {company ? (
            <CompanyChip user={user} company={company} posOnly={posOnly} />
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: colorFor(user?.full_name || '') }}
              >
                {initials(user?.full_name || '')}
              </span>
              <span className="text-sm font-semibold text-slate-700">{user?.full_name}</span>
            </div>
          )}
          {!posOnly && (
            <button onClick={doLogout} className="btn-ghost py-2 text-sm">
              <LogOut size={16} /> Log out
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

/** Clickable profile chip that reveals the company's key details. */
function CompanyChip({ user, company, posOnly = false }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const location = [company.city_name, company.district_name].filter(Boolean).join(', ') + (company.district_name ? ' District' : '')

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-slate-100">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ backgroundColor: colorFor(user?.full_name || '') }}
        >
          {initials(user?.full_name || '')}
        </span>
        <span className="hidden text-sm font-semibold text-slate-700 sm:block">{user?.full_name}</span>
        <ChevronDown size={16} className="text-slate-500" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-cardHover">
          {/* Company identity */}
          <div className="flex items-center gap-3 border-b border-slate-100 p-4">
            {company.logo_url ? (
              <img src={company.logo_url} alt="" className="h-12 w-12 rounded-xl object-cover ring-1 ring-slate-200" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-extrabold text-white" style={{ backgroundColor: colorFor(company.company_name) }}>
                {initials(company.company_name)}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate font-extrabold text-brand-navy">{company.company_name}</p>
              {company.category && <p className="truncate text-xs font-semibold text-brand-green">{company.category}</p>}
            </div>
          </div>

          {/* Key details */}
          <div className="space-y-2.5 p-4">
            <DetailRow icon={Globe} value={company.website} href={company.website ? `https://${company.website}` : null} />
            <DetailRow icon={Phone} value={company.phone} />
            <DetailRow icon={MapPin} value={location || null} />
            <DetailRow icon={Building2} value={company.address} />
            <DetailRow icon={Mail} value={user?.email} />
          </div>

          {!posOnly && company.slug && (
            <Link to={`/review/${company.slug}`} className="flex items-center justify-center gap-1.5 border-t border-slate-100 py-3 text-sm font-semibold text-brand-blue hover:bg-slate-50">
              View public page <ExternalLink size={14} />
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

function DetailRow({ icon: Icon, value, href }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2.5 text-sm text-slate-600">
      <Icon size={15} className="mt-0.5 shrink-0 text-slate-400" />
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="min-w-0 break-words hover:text-brand-blue">{value}</a>
      ) : (
        <span className="min-w-0 break-words">{value}</span>
      )}
    </div>
  )
}

function NotificationBell({ notifications, onDismiss }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const count = notifications.length

  // Swing the bell when the count goes up — a badge quietly changing from 2 to
  // 3 is easy to miss on a screen nobody is staring at.
  const [ring, setRing] = useState(false)
  const prevCount = useRef(count)
  useEffect(() => {
    if (count > prevCount.current) {
      setRing(true)
      const t = setTimeout(() => setRing(false), 900)
      prevCount.current = count
      return () => clearTimeout(t)
    }
    prevCount.current = count
  }, [count])

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const urgent = notifications.some((n) => n.status === 'placed')

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
        aria-label={count ? `Notifications (${count})` : 'Notifications'}
      >
        <motion.span
          animate={ring ? { rotate: [0, -18, 15, -12, 9, -5, 0] } : { rotate: 0 }}
          transition={{ duration: 0.85, ease: 'easeInOut' }}
          style={{ transformOrigin: 'top center' }}
        >
          <Bell size={20} />
        </motion.span>
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
            {count}
            {/* A waiting order pings until it's picked up */}
            {urgent && (
              <span className="absolute inset-0 animate-ping rounded-full bg-red-500 opacity-60" />
            )}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-cardHover">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="font-bold text-brand-navy">Notifications</span>
            {/* Not "new": an order stays here while it's being prepared too. */}
            <span className="text-xs text-slate-400">{count} waiting</span>
          </div>
          {count === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">You're all caught up 🎉</p>
          ) : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {notifications.map((n) => {
                const look = LOOK[n.status] || LOOK[n.tone] || LOOK.review
                // Orders opt out of dismissal — they leave the bell only when
                // the kitchen marks them served.
                const canDismiss = n.dismissible !== false

                const click = () => {
                  if (n.target) {
                    document.getElementById(n.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    setOpen(false)
                  }
                  if (canDismiss) onDismiss(n.id)
                }

                return (
                  <li key={n.id}>
                    <button
                      onClick={click}
                      className={`group flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 ${look.row}`}
                      title={canDismiss ? 'Click to dismiss' : 'Go to the order — it clears once served'}
                    >
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${look.chip}`}>
                        <look.icon size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-slate-700">{n.text}</span>
                        <span className="mt-0.5 flex items-center gap-1.5">
                          {look.label && (
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${look.chip}`}>
                              {look.label}
                            </span>
                          )}
                          {n.time && <span className="text-xs text-slate-400">{timeAgo(n.time)}</span>}
                        </span>
                      </span>
                      {/* A tick would promise the click clears it; for an order
                          it only takes you there. */}
                      {canDismiss ? (
                        <Check size={16} className="mt-1 shrink-0 text-slate-300 group-hover:text-brand-green" />
                      ) : (
                        <ArrowRight size={16} className="mt-1 shrink-0 text-slate-300 group-hover:text-brand-blue" />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
