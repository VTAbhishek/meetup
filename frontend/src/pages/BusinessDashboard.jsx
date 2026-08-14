import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Star, MessageSquare, ExternalLink, CornerDownRight, X, Pencil, Flag, Check, EyeOff, Globe, MapPin, Building2, Phone, ThumbsUp, Clock, GripVertical, Trash2, Camera, Film, CalendarClock } from 'lucide-react'
import { api } from '../api'
import { confirmDelete, toastOk, toastInfo, alertErr } from '../alerts'
import { useLiveOrders } from '../lib/useLiveOrders'
import { armChime, playChime } from '../lib/chime'
import { Stars } from '../components/Stars'
import CoverCarousel from '../components/CoverCarousel'
import CoverCropper from '../components/CoverCropper'
import { generateCoverVideo } from '../lib/coverVideo'
import { compressImage } from '../lib/imageCompress'
import RichTextEditor from '../components/RichTextEditor'
import HoursEditor from '../components/HoursEditor'
import ShowcaseCards from '../components/ShowcaseCards'
import MenuManager from '../components/MenuManager'
import TableManager from '../components/TableManager'
import OrdersManager from '../components/OrdersManager'
import MapPicker from '../components/MapPicker'
import MoodPicker from '../components/MoodPicker'
import ReservationsManager from '../components/ReservationsManager'
import DashboardHeader from '../components/DashboardHeader'
import Spinner from '../components/Spinner'
import { colorFor, initials, ratingLabel, timeAgo } from '../lib'

/**
 * The dashboard's cards, each built on demand.
 *
 * Defined once and stacked in whichever order the current view asks for, so the
 * two views can't drift apart the way two copies of the same JSX would. Every
 * card carries a stable key: reordering then moves the mounted components
 * instead of tearing them down and refetching.
 */
const SECTIONS = {
  about: ({ data, setData }) => (
    // Keyed on the saved html as well, so a save re-mounts the editor with the
    // new content rather than leaving the old draft in the box.
    <AboutEditor
      key={`about-${data.company.about_html || 'empty'}`}
      company={data.company}
      onSaved={() => api.myCompany().then(setData)}
    />
  ),
  hours: () => <HoursEditor key="hours" />,
  map: ({ data, setData }) => (
    <MapPicker
      key="map"
      company={data.company}
      onSaved={(loc) => setData((d) => ({ ...d, company: { ...d.company, ...loc } }))}
    />
  ),
  moods: () => <MoodPicker key="moods" />,
  showcase: () => <ShowcaseCards key="showcase" />,
  menu: () => <MenuManager key="menu" />,
  tables: ({ data }) => <TableManager key="tables" company={data.company} />,
  orders: ({ liveOrders, soundOn, toggleSound }) => (
    // The id is what an order notification scrolls to.
    <div key="orders" id="orders-card" className="scroll-mt-20">
      <OrdersManager {...liveOrders} soundOn={soundOn} onToggleSound={toggleSound} />
    </div>
  ),
  reservations: () => <ReservationsManager key="reservations" />,
}

/**
 * 'company' builds the public profile; 'reservation' runs the day.
 *
 * Neither view hides anything — whichever cards aren't the point of the view
 * simply sit further down, so nothing a company set up can go missing because
 * of which button is pressed.
 */
const SECTION_ORDER = {
  company:     ['about', 'hours', 'map', 'moods', 'showcase', 'menu', 'tables', 'orders', 'reservations'],
  reservation: ['reservations', 'orders', 'tables', 'menu', 'hours', 'about', 'map', 'moods', 'showcase'],
}

/** One of the two small buttons that pick the stacking order. */
function ViewTab({ on, onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition ${
        on
          ? 'bg-brand-blue text-white shadow-sm'
          : 'border border-slate-300 bg-white text-slate-600 hover:border-brand-blue hover:text-brand-blue'
      }`}
    >
      <Icon size={15} /> {children}
    </button>
  )
}

export default function BusinessDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [replyTo, setReplyTo] = useState(null)
  const [editing, setEditing] = useState(false)
  const [viewReview, setViewReview] = useState(null)

  // Which way round the dashboard cards are stacked. 'company' is the default:
  // the profile-building cards first. 'reservation' puts the day-to-day work —
  // reservations, then the orders coming off the table QR codes — at the top.
  // Nothing is hidden either way; the order just follows what you came to do.
  const [view, setView] = useState('company')

  const load = () => {
    setLoading(true)
    api.myCompany().then(setData).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const setApproval = async (review, approved) => {
    try {
      await api.approveReview(review.id, approved)
      setData((d) => ({
        ...d,
        reviews: d.reviews.map((r) => (r.id === review.id ? { ...r, is_approved: approved } : r)),
      }))
      toastOk(approved ? 'Review published' : 'Review hidden')
    } catch (e) {
      alertErr(e)
    }
  }

  const removeReview = async (review) => {
    if (!(await confirmDelete({ text: 'Delete this review permanently? This cannot be undone.' }))) return
    try {
      await api.deleteMyReview(review.id)
      setData((d) => ({ ...d, reviews: d.reviews.filter((r) => r.id !== review.id) }))
      setViewReview(null)
      toastOk('Review deleted')
    } catch (e) {
      alertErr(e)
    }
  }

  // --- Dine-in orders, polled once and shared with the notification bell ---
  const liveOrders = useLiveOrders()

  const [soundOn, setSoundOn] = useState(() => localStorage.getItem('biz_order_sound') !== 'off')
  const toggleSound = () => {
    setSoundOn((on) => {
      localStorage.setItem('biz_order_sound', on ? 'off' : 'on')
      // Ring once when switching it on, so "on" is proven rather than promised.
      if (!on) playChime()
      return !on
    })
  }

  // Let the browser make noise later without a click at that exact moment.
  useEffect(armChime, [])

  /**
   * Ring the bell when an order appears that wasn't there a moment ago.
   *
   * The first poll only records what already exists — a dashboard opened at
   * 8pm must not chime once for every order taken during the day.
   */
  const knownOrdersRef = useRef(null)
  useEffect(() => {
    const waiting = liveOrders.orders.filter((o) => o.status === 'placed')
    const ids = new Set(waiting.map((o) => o.id))

    if (knownOrdersRef.current === null) {
      knownOrdersRef.current = ids
      return
    }
    const fresh = waiting.filter((o) => !knownOrdersRef.current.has(o.id))
    knownOrdersRef.current = ids

    if (fresh.length) {
      if (soundOn) playChime()
      toastInfo(
        fresh.length === 1
          ? `New order ${fresh[0].ref} · ${fresh[0].table_label}`
          : `${fresh.length} new orders`
      )
    }
  }, [liveOrders.orders, soundOn])

  // --- Notifications: reviews awaiting attention, and orders still in progress ---
  const [seen, setSeen] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('biz_seen_reviews') || '[]')) } catch { return new Set() }
  })
  const dismissNotif = (id) => {
    setSeen((prev) => {
      const next = new Set(prev).add(id)
      localStorage.setItem('biz_seen_reviews', JSON.stringify([...next]))
      return next
    })
  }

  /**
   * Only orders that still need something doing appear here.
   *
   * These cannot be clicked away: a guest is sitting at a table waiting for
   * food, and a notification dismissed by a stray click is an order nobody
   * cooks. The only way one leaves the bell is the kitchen marking it served
   * (or cancelling it), at which point it drops out of this list on the next
   * poll and the notification clears itself. Clicking one jumps to the order
   * instead, which is what the click was probably for.
   */
  const orderNotifications = liveOrders.orders
    .filter((o) => o.status === 'placed' || o.status === 'preparing')
    .map((o) => ({
      id: `order-${o.id}`,
      time: o.created_at,
      tone: 'order',
      status: o.status,
      dismissible: false,
      target: 'orders-card',
      text:
        o.status === 'placed'
          ? `New order ${o.ref} · ${o.table_label} — ${o.items.length} ${o.items.length === 1 ? 'dish' : 'dishes'}`
          : `Order ${o.ref} · ${o.table_label} — being prepared`,
    }))

  const reviewNotifications = (data?.reviews || [])
    .filter((r) => !seen.has(r.id))
    .map((r) => ({
      id: r.id,
      time: r.created_at,
      tone: 'review',
      text: r.is_approved
        ? `New ${r.rating}★ review from ${r.customer_name}`
        : `${r.customer_name} left a ${r.rating}★ review awaiting your approval`,
    }))

  // Orders first: a customer is sitting at a table waiting for food.
  const notifications = [...orderNotifications, ...reviewNotifications]

  const published = (data?.reviews || [])
    .filter((r) => r.is_approved)
    .sort((a, b) => (a.sort_order || 1e9) - (b.sort_order || 1e9) || new Date(b.created_at) - new Date(a.created_at))

  return (
    <div className="min-h-screen bg-brand-silver">
      <DashboardHeader badge="Business" accent="bg-brand-green" notifications={notifications} onDismiss={dismissNotif} company={data?.company} />
      <div className="container-page py-8">
        {loading ? (
          <Spinner />
        ) : !data?.company ? (
          <div className="card p-12 text-center text-slate-500">No company profile found.</div>
        ) : (
          <>
            {/* Company header */}
            <div className="card overflow-hidden">
              {/* Cover banner (top part) */}
              <CoverBanner company={data.company} onChange={() => api.myCompany().then(setData)} />

              {/* Details (bottom part) — logo overlaps the cover */}
              <div className="flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="-mt-12 shrink-0 rounded-2xl ring-4 ring-white sm:-mt-14">
                    <LogoAvatar company={data.company} onChange={() => api.myCompany().then(setData)} />
                  </div>
                  <div className="pt-3">
                    <h1 className="text-2xl font-extrabold text-brand-navy">{data.company.company_name}</h1>
                    <p className="text-sm text-slate-500">
                      {data.company.website || 'No website set'}
                      {data.company.category ? ` · ${data.company.category}` : ''}
                    </p>
                    {(data.company.city_name || data.company.district_name) && (
                      <p className="mt-1 flex items-center gap-1 text-sm font-medium text-slate-600">
                        <MapPin size={14} className="text-brand-green" />
                        {[data.company.city_name, data.company.district_name].filter(Boolean).join(', ')}
                        {data.company.district_name ? ' District' : ''}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-3">
                  <button onClick={() => setEditing(true)} className="btn-green py-2 text-sm">
                    <Pencil size={15} /> Edit profile
                  </button>
                  {data.company.slug && (
                    <Link to={`/review/${data.company.slug}`} className="btn-ghost py-2 text-sm">
                      View public page <ExternalLink size={15} />
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Which order to stack the cards in */}
            <div className="mt-4 flex gap-2">
              <ViewTab on={view === 'company'} onClick={() => setView('company')} icon={Building2}>
                Company
              </ViewTab>
              <ViewTab on={view === 'reservation'} onClick={() => setView('reservation')} icon={CalendarClock}>
                Reservation
              </ViewTab>
            </div>

            {/* The cards themselves. Each is keyed, so switching the order moves
                the existing components rather than rebuilding them — a menu or
                a table list already loaded doesn't refetch on every toggle. */}
            {SECTION_ORDER[view].map((name) => SECTIONS[name]({
              data,
              setData,
              liveOrders,
              soundOn,
              toggleSound,
            }))}

            {/* Stats */}
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <StatCard label="Average rating" value={data.stats.avg_rating > 0 ? data.stats.avg_rating.toFixed(1) : '—'} sub={ratingLabel(data.stats.avg_rating)} icon={Star} />
              <StatCard label="Published reviews" value={data.stats.review_count} sub="visible on site" icon={MessageSquare} />
              <StatCard label="Pending approval" value={data.stats.pending} sub="awaiting access" icon={Flag} accent={data.stats.pending > 0} />
            </div>

            {/* Company page snapshot — 3 cards in one row */}
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {/* Rating breakdown */}
              <div className="card p-6">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-4xl font-extrabold text-brand-navy">{data.stats.avg_rating > 0 ? data.stats.avg_rating.toFixed(1) : '—'}</p>
                    <p className="text-sm font-semibold text-brand-green">{ratingLabel(data.stats.avg_rating)}</p>
                    <p className="text-xs text-slate-400">{data.stats.review_count} reviews</p>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const n = data.breakdown[star] || 0
                      const pct = data.stats.review_count ? Math.round((n / data.stats.review_count) * 100) : 0
                      return (
                        <div key={star} className="flex items-center gap-2 text-xs">
                          <span className="w-12 shrink-0 whitespace-nowrap text-slate-500">{star}-star</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                            <div className="h-full rounded-full bg-brand-green" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-8 text-right text-slate-400">{pct}%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* About */}
              <div className="card p-6">
                <h3 className="font-bold text-brand-navy">About {data.company.company_name}</h3>
                {data.company.description && <p className="mt-2 text-sm text-slate-600">{data.company.description}</p>}
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between"><dt className="text-slate-400">Category</dt><dd className="font-medium text-slate-700">{data.company.category || '—'}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-400">Status</dt><dd className="font-medium text-slate-700 capitalize">{data.company.status}</dd></div>
                </dl>
              </div>

              {/* Contact info */}
              <div className="card p-6">
                <h3 className="font-bold text-brand-navy">Contact info</h3>
                <ul className="mt-3 space-y-3 text-sm">
                  <li className="flex items-start gap-2.5"><MapPin size={16} className="mt-0.5 shrink-0 text-slate-400" /><span className="text-slate-700">{data.company.address || '—'}</span></li>
                  <li className="flex items-center gap-2.5">
                    <Building2 size={16} className="shrink-0 text-slate-400" />
                    <span className="text-slate-700">
                      {(data.company.city_name || data.company.district_name)
                        ? `${[data.company.city_name, data.company.district_name].filter(Boolean).join(', ')}${data.company.district_name ? ' District' : ''}`
                        : '—'}
                    </span>
                  </li>
                  <li className="flex items-center gap-2.5"><Phone size={16} className="shrink-0 text-slate-400" /><span className="text-slate-700">{data.company.phone || '—'}</span></li>
                  <li className="flex items-center gap-2.5"><Globe size={16} className="shrink-0 text-slate-400" /><span className="text-slate-700">{data.company.website || '—'}</span></li>
                </ul>
              </div>
            </div>

            {/* Reviews (full width) */}
            <div className="mt-8">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-extrabold text-brand-navy">Customer reviews</h2>
                <span className="text-sm text-slate-500">{data.reviews.length} total</span>
              </div>

              {data.stats.pending > 0 && (
                <div className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <Flag size={16} /> {data.stats.pending} review{data.stats.pending > 1 ? 's' : ''} awaiting your access — approve to show them on your public page.
                </div>
              )}

              {data.reviews.length === 0 ? (
                <div className="card p-10 text-center text-slate-500">No reviews yet.</div>
              ) : (
                <div className="card overflow-hidden">
                  {/* Scrolls both ways: the table is wider than a phone, and a
                      busy company's review list is longer than the screen. */}
                  <div className="card-scroll-lg overflow-x-auto pr-0">
                    <table className="w-full min-w-[680px] text-sm">
                      {/* Pinned so the columns stay labelled while scrolling */}
                      <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Reviewer</th>
                          <th className="px-4 py-3">Rating</th>
                          <th className="px-4 py-3">Review</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.reviews.map((r) => (
                          <tr
                            key={r.id}
                            onClick={() => setViewReview(r)}
                            className={`cursor-pointer transition hover:bg-slate-50 ${!r.is_approved ? 'bg-amber-50/50' : ''}`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 font-semibold text-brand-navy">
                                <span className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: colorFor(r.customer_name) }}>
                                  {initials(r.customer_name)}
                                </span>
                                {r.customer_name}
                              </div>
                            </td>
                            <td className="px-4 py-3"><Stars value={r.rating} size={14} /></td>
                            <td className="max-w-xs truncate px-4 py-3 text-slate-600">{r.title || r.body}</td>
                            <td className="px-4 py-3">
                              {r.is_approved
                                ? <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700"><Check size={12} /> Published</span>
                                : <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700"><Clock size={12} /> Pending</span>}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">{timeAgo(r.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Drag-to-reorder published reviews (controls order on the public page) */}
            {published.length > 1 && <ReviewOrderTable reviews={published} />}
          </>
        )}
      </div>

      {viewReview && (
        <ReviewDetailModal
          review={viewReview}
          onClose={() => setViewReview(null)}
          onApprove={(approved) => {
            setApproval(viewReview, approved)
            setViewReview((v) => ({ ...v, is_approved: approved }))
          }}
          onReply={() => { setReplyTo(viewReview); setViewReview(null) }}
          onDelete={() => removeReview(viewReview)}
        />
      )}

      {replyTo && (
        <ReplyModal
          review={replyTo}
          onClose={() => setReplyTo(null)}
          onSaved={() => {
            setReplyTo(null)
            load()
          }}
        />
      )}

      {editing && data?.company && (
        <EditProfileModal
          company={data.company}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            load()
          }}
        />
      )}
    </div>
  )
}

function EditProfileModal({ company, onClose, onSaved }) {
  const [form, setForm] = useState({
    company_name: company.company_name || '',
    website: company.website || '',
    category: company.category || '',
    phone: company.phone || '',
    address: company.address || '',
    description: company.description || '',
  })
  const [categories, setCategories] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    api.categories().then((d) => setCategories(d.categories)).catch(() => {})
  }, [])

  const save = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api.updateMyCompany(form)
      toastOk('Profile updated')
      onSaved()
    } catch (ex) {
      setError(ex.message)
      alertErr(ex)
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={save} className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-cardHover" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <h3 className="text-lg font-extrabold text-brand-navy">Edit company profile</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Company name</span>
            <input className="input" value={form.company_name} onChange={set('company_name')} required />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Website</span>
              <input className="input" value={form.website} onChange={set('website')} placeholder="example.com" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Category</span>
              <select className="input" value={form.category} onChange={set('category')} required>
                <option value="">Select a category</option>
                {categories.map((c) => <option key={c.category} value={c.category}>{c.category}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Phone</span>
              <input className="input" value={form.phone} onChange={set('phone')} placeholder="+1 555 000 0000" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Address</span>
              <input className="input" value={form.address} onChange={set('address')} placeholder="Street, city, country" />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Description</span>
            <textarea className="input resize-y" rows={4} value={form.description} onChange={set('description')} placeholder="Tell customers about your company…" />
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 p-4">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={busy} className="btn-green">{busy ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </div>
  )
}

function ReviewDetailModal({ review: r, onClose, onApprove, onReply, onDelete }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-cardHover" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 border-b border-slate-100 p-6">
          <span className="flex h-12 w-12 items-center justify-center rounded-full text-base font-bold text-white" style={{ backgroundColor: colorFor(r.customer_name) }}>
            {initials(r.customer_name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold text-brand-navy">{r.customer_name}</p>
              {r.is_approved
                ? <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700"><Check size={12} /> Published</span>
                : <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700"><Clock size={12} /> Pending</span>}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <Stars value={r.rating} size={16} />
              <span className="text-xs text-slate-400">{timeAgo(r.created_at)}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>

        <div className="p-6">
          {r.title && <h4 className="font-bold text-brand-navy">{r.title}</h4>}
          <p className="mt-1 text-slate-600">{r.body}</p>
          <p className="mt-3 flex items-center gap-1 text-xs text-slate-400"><ThumbsUp size={13} /> {r.useful_count} useful</p>

          {r.reply && (
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
              <p className="flex items-center gap-1 font-semibold text-slate-700"><CornerDownRight size={14} /> Your reply</p>
              <p className="mt-1 text-slate-600">{r.reply.body}</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 p-4">
          {r.is_approved ? (
            <button onClick={() => onApprove(false)} className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              <EyeOff size={15} /> Hide from site
            </button>
          ) : (
            <button onClick={() => onApprove(true)} className="btn-green py-2 text-sm">
              <Check size={15} /> Give access
            </button>
          )}
          <button onClick={onReply} className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            <CornerDownRight size={15} /> {r.reply ? 'Edit reply' : 'Reply'}
          </button>
          <button onClick={onDelete} className="flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
            <Trash2 size={15} /> Delete
          </button>
          <button onClick={onClose} className="btn-ghost ml-auto py-2 text-sm">Close</button>
        </div>
      </div>
    </div>
  )
}

function ReviewOrderTable({ reviews }) {
  const [items, setItems] = useState(reviews)
  const [saved, setSaved] = useState(false)
  const dragIdx = useRef(null)

  useEffect(() => { setItems(reviews) }, [reviews])

  const move = (from, to) => {
    setItems((list) => {
      const next = [...list]
      const [m] = next.splice(from, 1)
      next.splice(to, 0, m)
      return next
    })
  }

  const onDragOver = (i) => (e) => {
    e.preventDefault()
    if (dragIdx.current === null || dragIdx.current === i) return
    move(dragIdx.current, i)
    dragIdx.current = i
  }

  const onDrop = async () => {
    dragIdx.current = null
    try {
      await api.saveReviewOrder(items.map((r) => r.id))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      toastOk('Review order saved')
    } catch (e) { alertErr(e) }
  }

  return (
    <div className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-brand-navy">Display order</h2>
          <p className="text-sm text-slate-500">Drag rows to set the order reviews appear on your public page.</p>
        </div>
        {saved && <span className="flex items-center gap-1 text-sm font-semibold text-brand-green"><Check size={16} /> Order saved</span>}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="w-10 px-3 py-3"></th>
              <th className="w-12 px-2 py-3">#</th>
              <th className="px-4 py-3">Reviewer</th>
              <th className="px-4 py-3">Rating</th>
              <th className="px-4 py-3">Review</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((r, i) => (
              <tr
                key={r.id}
                draggable
                onDragStart={() => { dragIdx.current = i }}
                onDragOver={onDragOver(i)}
                onDragEnd={onDrop}
                className="cursor-grab bg-white transition hover:bg-slate-50 active:cursor-grabbing"
              >
                <td className="px-3 py-3 text-slate-400"><GripVertical size={16} /></td>
                <td className="px-2 py-3 font-bold text-slate-400">{i + 1}</td>
                <td className="px-4 py-3 font-semibold text-brand-navy">{r.customer_name}</td>
                <td className="px-4 py-3"><Stars value={r.rating} size={14} /></td>
                <td className="max-w-xs truncate px-4 py-3 text-slate-600">{r.title || r.body}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, icon: Icon, accent = false }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${accent ? 'bg-amber-100 text-amber-600' : 'bg-pink-100 text-brand-green'}`}>
        <Icon size={22} />
      </span>
      <div>
        <p className="text-2xl font-extrabold text-brand-navy">{value}</p>
        <p className="text-sm text-slate-500">{label} · {sub}</p>
      </div>
    </div>
  )
}

function ReplyModal({ review, onClose, onSaved }) {
  const [body, setBody] = useState(review.reply?.body || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.reply({ review_id: review.id, body: body.trim() })
      toastOk('Reply posted')
      onSaved()
    } catch (err) {
      setError(err.message)
      alertErr(err)
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-brand-navy">Reply to {review.customer_name}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>
        <form onSubmit={save} className="mt-4 space-y-4">
          {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
          <textarea className="input resize-y" rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a professional, helpful reply…" required />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={busy} className="btn-green">{busy ? 'Posting…' : 'Post reply'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

/**
 * "About us" editor — Word-style rich text (font, size, colour, lists …)
 * saved to the company profile and shown on the public page.
 */
function AboutEditor({ company, onSaved }) {
  const htmlRef = useRef(company.about_html || '')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      await api.updateCompanyAbout(htmlRef.current)
      toastOk('About us saved')
      setDirty(false)
      onSaved?.()
    } catch (err) {
      alertErr(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card mt-6 p-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-brand-navy">About us</h2>
          <p className="text-sm text-slate-500">Tell customers your story — this appears on your public page. Use the toolbar to style text (font, size, colour…).</p>
        </div>
        <button onClick={save} disabled={busy || !dirty} className="btn-green py-2 text-sm">
          {busy ? 'Saving…' : 'Save About us'}
        </button>
      </div>
      <RichTextEditor
        initialHtml={company.about_html || ''}
        onChange={(html) => { htmlRef.current = html; setDirty(true) }}
      />
    </div>
  )
}

/**
 * Cover gallery manager: an auto-sliding preview of all cover images, an
 * "Add images" button (multi-select) top-right, and a thumbnail strip top-left
 * where each cover can be deleted. Falls back to a brand gradient when empty.
 */
function CoverBanner({ company, onChange }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [cropFile, setCropFile] = useState(null) // image awaiting crop before upload
  const [genPct, setGenPct] = useState(null) // 0..100 while building the video, else null
  const MAX = 5
  const covers = company.covers || []
  const urls = covers.map((c) => c.url)
  const full = covers.length >= MAX
  const videoUrl = company.cover_video_url || null

  // Pick one image, then open the cropper so it can be framed to the cover size.
  const onPick = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return
    if (!file.type.startsWith('image/')) return alertErr('Please choose an image file.')
    if (file.size > 20 * 1024 * 1024) return alertErr('Image must be 20 MB or smaller.')
    if (covers.length >= MAX) return alertErr(`You can add up to ${MAX} cover images.`)
    setCropFile(file)
  }

  const uploadCropped = async (croppedFile) => {
    setCropFile(null)
    setBusy(true)
    try {
      await api.addCompanyCovers([croppedFile])
      toastOk('Cover image added')
      onChange?.()
    } catch (err) {
      alertErr(err)
    } finally {
      setBusy(false)
    }
  }

  const removeCover = async (id) => {
    if (!(await confirmDelete({ title: 'Remove this cover image?', text: 'It will be deleted from your slideshow.' }))) return
    setBusy(true)
    try {
      await api.removeCompanyCover(id)
      toastOk('Cover image removed')
      onChange?.()
    } catch (err) {
      alertErr(err)
    } finally {
      setBusy(false)
    }
  }

  // Build an animated video from the cover images (in the browser) and save it
  // as the company's cover.
  const makeVideo = async () => {
    if (!urls.length) return alertErr('Add at least one cover image first.')
    setGenPct(0)
    try {
      const blob = await generateCoverVideo(urls, { onProgress: (p) => setGenPct(Math.round(p * 100)) })
      setGenPct(100)
      await api.uploadCoverVideo(blob)
      toastOk('Cover video created')
      onChange?.()
    } catch (err) {
      alertErr(err)
    } finally {
      setGenPct(null)
    }
  }

  const removeVideo = async () => {
    if (!(await confirmDelete({ title: 'Remove cover video?', text: 'Your cover will go back to the image slideshow.' }))) return
    setBusy(true)
    try {
      await api.removeCoverVideo()
      toastOk('Cover video removed')
      onChange?.()
    } catch (err) {
      alertErr(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative">
      {videoUrl ? (
        <video
          src={videoUrl}
          className="h-56 w-full object-cover sm:h-72"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
        />
      ) : urls.length > 0 ? (
        <CoverCarousel images={urls} interval={3000} heightClass="h-56 sm:h-72" />
      ) : (
        <div className="h-56 w-full bg-gradient-to-br from-brand-blueDark via-brand-blue to-brand-green sm:h-72" />
      )}

      {/* Generating overlay */}
      {genPct !== null && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/60 text-white">
          <Film size={28} className="animate-pulse" />
          <p className="text-sm font-semibold">Creating cover video… {genPct}%</p>
          <div className="h-1.5 w-56 overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white transition-all" style={{ width: `${genPct}%` }} />
          </div>
          <p className="text-xs text-white/70">Keep this tab open — this runs in real time.</p>
        </div>
      )}

      {/* Top-right controls */}
      <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
        {/* Create / regenerate the cover video */}
        {urls.length > 0 && (
          <button
            type="button"
            onClick={makeVideo}
            disabled={busy || genPct !== null}
            title="Build an animated video from your cover images"
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-navy/90 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-navy disabled:opacity-60"
          >
            <Film size={15} />
            {videoUrl ? 'Regenerate video' : 'Create video'}
          </button>
        )}
        {videoUrl && (
          <button
            type="button"
            onClick={removeVideo}
            disabled={busy || genPct !== null}
            title="Remove cover video"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-sm font-semibold text-red-600 shadow-sm hover:bg-white disabled:opacity-60"
          >
            <X size={15} /> Video
          </button>
        )}
        {/* Add image — hidden once the 3-image limit is reached */}
        {full ? (
          <span className="inline-flex items-center rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-500 shadow-sm">
            Max {MAX} images
          </span>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy || genPct !== null}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-sm font-semibold text-brand-navy shadow-sm hover:bg-white disabled:opacity-60"
          >
            {busy ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-blue/40 border-t-brand-blue" />
            ) : (
              <Camera size={15} />
            )}
            Add image
          </button>
        )}
      </div>

      {/* Thumbnail strip with per-image delete (top-left) */}
      {covers.length > 0 && (
        <div className="absolute left-3 top-3 z-20 flex max-w-[70%] flex-wrap gap-2">
          {covers.map((c) => (
            <div key={c.id} className="relative">
              <img src={c.url} alt="" className="h-11 w-16 rounded object-cover ring-2 ring-white/90" />
              <button
                type="button"
                onClick={() => removeCover(c.id)}
                title="Remove"
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white shadow hover:bg-red-700"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onPick} />

      {cropFile && (
        <CoverCropper file={cropFile} onCancel={() => setCropFile(null)} onDone={uploadCropped} />
      )}
    </div>
  )
}

/**
 * Company logo with hover controls: upload/change (camera) and delete (trash).
 * Falls back to the coloured initials tile when there's no logo.
 */
function LogoAvatar({ company, onChange }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return
    if (!file.type.startsWith('image/')) return alertErr('Please choose an image file.')
    setBusy(true)
    try {
      // Auto-shrink the file size (not the visible quality) before uploading.
      const small = await compressImage(file, { maxDim: 1200 })
      if (small.size > 5 * 1024 * 1024) return alertErr('Image must be 5 MB or smaller.')
      await api.uploadCompanyLogo(small)
      toastOk('Profile picture updated')
      onChange?.()
    } catch (err) {
      alertErr(err)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!(await confirmDelete({ title: 'Remove profile picture?', text: 'Your logo will be deleted.' }))) return
    setBusy(true)
    try {
      await api.deleteCompanyLogo()
      toastOk('Profile picture removed')
      onChange?.()
    } catch (err) {
      alertErr(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="group relative h-16 w-16 shrink-0">
      {company.logo_url ? (
        <img src={company.logo_url} alt={company.company_name} className="h-16 w-16 rounded-2xl object-cover ring-1 ring-slate-200" />
      ) : (
        <span
          className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-extrabold text-white"
          style={{ backgroundColor: colorFor(company.company_name) }}
        >
          {initials(company.company_name)}
        </span>
      )}

      {/* Hover overlay with actions */}
      <div className="absolute inset-0 flex items-center justify-center gap-1.5 rounded-2xl bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
        {busy ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        ) : (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              title={company.logo_url ? 'Change picture' : 'Upload picture'}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-brand-navy hover:bg-brand-silver"
            >
              <Camera size={15} />
            </button>
            {company.logo_url && (
              <button
                type="button"
                onClick={remove}
                title="Remove picture"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-red-600 hover:bg-red-50"
              >
                <Trash2 size={15} />
              </button>
            )}
          </>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </div>
  )
}
