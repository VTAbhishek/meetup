import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { PenLine, ExternalLink, BadgeCheck, MapPin, Phone, Globe, CalendarClock, Building2, Tag, Sparkles } from 'lucide-react'
import { api } from '../api'
import { Stars } from '../components/Stars'
import ReviewCard from '../components/ReviewCard'
import Spinner from '../components/Spinner'
import Lightbox from '../components/Lightbox'
import CoverCarousel from '../components/CoverCarousel'
import MapView from '../components/MapView'
import { colorFor, initials, ratingLabel } from '../lib'

export default function CompanyProfile() {
  const { slug } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(0)
  const [sort, setSort] = useState('featured')
  const [zoom, setZoom] = useState(false)
  const [cardView, setCardView] = useState(null) // showcase card whose image is open

  useEffect(() => {
    setLoading(true)
    const qs = `&sort=${sort}${rating ? `&rating=${rating}` : ''}`
    api
      .company(slug, qs)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [slug, rating, sort])

  if (loading && !data) return <Spinner />
  if (!data) return <div className="container-page py-24 text-center text-slate-500">Company not found.</div>

  const { company, reviews } = data
  const total = company.review_count || 1

  return (
    <div>
      {zoom && <Lightbox src={company.logo_url} alt={company.company_name} onClose={() => setZoom(false)} />}
      {cardView && <Lightbox src={cardView.image_url} alt={cardView.title} onClose={() => setCardView(null)} />}
      {/* Header */}
      <section className="border-b border-slate-200 bg-white">
        {/* Cover — an auto-generated animated video takes precedence, otherwise
            the cinematic image slideshow. */}
        {company.cover_video_url ? (
          <video
            src={company.cover_video_url}
            className="h-96 w-full object-cover sm:h-[36rem]"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
          />
        ) : company.covers?.length > 0 ? (
          <CoverCarousel images={company.covers} interval={3000} heightClass="h-96 sm:h-[36rem]" />
        ) : null}
        <div className="container-page py-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              {company.logo_url ? (
                <button
                  type="button"
                  onClick={() => setZoom(true)}
                  className="shrink-0 cursor-zoom-in rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-blue"
                  title="Click to view"
                >
                  <img
                    src={company.logo_url}
                    alt={company.company_name}
                    className="h-20 w-20 rounded-2xl object-cover ring-1 ring-slate-200 transition hover:opacity-90"
                  />
                </button>
              ) : (
                <span
                  className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-3xl font-extrabold text-white"
                  style={{ backgroundColor: colorFor(company.company_name) }}
                >
                  {initials(company.company_name)}
                </span>
              )}
              <div>
                {company.claimed && (
                  <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                    <BadgeCheck size={14} /> Claimed profile
                  </span>
                )}
                <h1 className="text-3xl font-extrabold text-brand-navy">{company.company_name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                  <span className="flex items-center gap-1.5">
                    <Stars value={company.avg_rating} size={18} />
                    <span className="font-bold text-slate-700">
                      {company.avg_rating > 0 ? company.avg_rating.toFixed(1) : '—'}
                    </span>
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500">{company.review_count.toLocaleString()} reviews</span>
                  <Link to={`/category/${encodeURIComponent(company.category)}`} className="text-brand-blue hover:underline">
                    {company.category}
                  </Link>
                  {company.open_status?.configured && (
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${company.open_status.open_now ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {company.open_status.open_now ? 'Open now' : 'Closed'}
                      {company.open_status.today?.is_open && company.open_status.today.open_time
                        ? ` · ${company.open_status.today.open_time} – ${company.open_status.today.close_time}`
                        : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-3">
              <Link to={`/reserve/${company.slug}`} className="btn-green flex-1 sm:flex-none">
                <CalendarClock size={18} /> Reserve
              </Link>
              <Link to={`/write-review/${company.slug}`} className="btn-blue flex-1 sm:flex-none">
                <PenLine size={18} /> Write a review
              </Link>
              <a
                href={`https://${company.website}`}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost flex-1 sm:flex-none"
              >
                Visit website <ExternalLink size={16} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* About us — rich text written by the company */}
      {company.about_html && (
        <section className="border-b border-slate-200 bg-white">
          <div className="container-page py-8">
            <h2 className="mb-3 text-xl font-extrabold text-brand-navy">About us</h2>
            <div
              className="rich-content max-w-3xl text-slate-700"
              dangerouslySetInnerHTML={{ __html: company.about_html }}
            />
          </div>
        </section>
      )}

      {/* Showcase cards — 5 per row; click a card to view its full image */}
      {company.cards?.length > 0 && (
        <section className="border-b border-slate-200 bg-white">
          <div className="container-page py-8">
            <h2 className="mb-4 text-xl font-extrabold text-brand-navy">Highlights</h2>
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              {company.cards.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCardView(c)}
                  title="Click to view"
                  className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-card transition hover:-translate-y-1 hover:shadow-cardHover"
                >
                  <img src={c.thumb_url} alt={c.title} className="h-28 w-full object-cover transition group-hover:opacity-90" />
                  <div className="p-3">
                    <p className="truncate text-sm font-bold text-brand-navy">{c.title}</p>
                    {c.intro && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{c.intro}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="container-page grid gap-8 py-8 lg:grid-cols-3">
        {/* Main: reviews */}
        <div className="lg:col-span-2">
          {/* Filter / sort bar */}
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-1.5">
              <FilterChip active={rating === 0} onClick={() => setRating(0)}>All</FilterChip>
              {[5, 4, 3, 2, 1].map((r) => (
                <FilterChip key={r} active={rating === r} onClick={() => setRating(r)}>
                  {r}★
                </FilterChip>
              ))}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="ml-auto rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 focus:border-brand-blue focus:outline-none"
            >
              <option value="featured">Featured (company order)</option>
              <option value="recent">Most recent</option>
              <option value="highest">Highest rated</option>
              <option value="lowest">Lowest rated</option>
              <option value="useful">Most useful</option>
            </select>
          </div>

          {reviews.length === 0 ? (
            <div className="card p-10 text-center text-slate-500">
              No reviews {rating ? `with ${rating} stars` : 'yet'}. Be the first to write one!
            </div>
          ) : (
            <div className="grid gap-4">
              {reviews.map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar: trust score */}
        <aside className="space-y-4">
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-5xl font-extrabold text-brand-navy">
                  {company.avg_rating > 0 ? company.avg_rating.toFixed(1) : '—'}
                </p>
                <p className="mt-1 font-semibold text-brand-green">{ratingLabel(company.avg_rating)}</p>
                <p className="text-xs text-slate-400">{company.review_count.toLocaleString()} reviews</p>
              </div>
              <div className="flex-1 space-y-1.5">
                {[5, 4, 3, 2, 1].map((star) => {
                  const n = company.breakdown[star] || 0
                  const pct = Math.round((n / total) * 100)
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

          <div className="card p-6">
            <h3 className="font-bold text-brand-navy">About {company.company_name}</h3>
            {company.description && <p className="mt-2 text-sm text-slate-600">{company.description}</p>}
            <ul className="mt-4 space-y-3 text-sm">
              <InfoRow icon={MapPin} value={company.address} />
              <InfoRow
                icon={Building2}
                value={[company.city_name, company.district_name].filter(Boolean).join(', ') + (company.district_name ? ' District' : '')}
              />
              <InfoRow icon={Phone} value={company.phone} href={company.phone ? `tel:${company.phone}` : null} />
              <InfoRow
                icon={Globe}
                value={company.website}
                href={company.website ? `https://${company.website}` : null}
              />
              <InfoRow icon={Tag} value={company.category} />
              <li className="flex items-center gap-2.5">
                <BadgeCheck size={16} className="shrink-0 text-slate-400" />
                <span className="text-slate-700">{company.claimed ? 'Claimed' : 'Unclaimed'}</span>
              </li>
            </ul>
          </div>

          {/* Mood tags — each links to the same mood filter on search */}
          {company.moods?.length > 0 && (
            <div className="card p-6">
              <h3 className="mb-3 flex items-center gap-2 font-bold text-brand-navy">
                <Sparkles size={16} className="text-brand-green" /> Good for
              </h3>
              <div className="flex flex-wrap gap-2">
                {company.moods.map((m) => (
                  <Link
                    key={m.slug}
                    to={`/search?mood=${encodeURIComponent(m.slug)}`}
                    title={m.hint || `Find more places for ${m.name}`}
                    className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:border-brand-green/50 hover:text-brand-navy"
                  >
                    <MoodIcon icon={m.icon} size={14} className="text-brand-green" />
                    {m.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Map — renders only when the company has pinned itself */}
          {company.latitude != null && company.longitude != null && (
            <div className="card p-6">
              <h3 className="mb-3 flex items-center gap-2 font-bold text-brand-navy">
                <MapPin size={16} className="text-brand-green" /> Find us
              </h3>
              <MapView
                lat={company.latitude}
                lng={company.longitude}
                zoom={company.map_zoom}
                name={company.company_name}
                address={company.address}
              />
            </div>
          )}

          {company.hours?.length > 0 && (
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-brand-navy">Opening hours</h3>
                {company.open_status?.configured && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${company.open_status.open_now ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {company.open_status.open_now ? 'Open now' : 'Closed'}
                  </span>
                )}
              </div>
              {company.open_status?.is_override && (
                <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700">
                  Special hours today
                </p>
              )}
              <ul className="mt-3 space-y-1.5 text-sm">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
                  const row = company.hours.find((h) => h.weekday === d)
                  const isToday = new Date().getDay() === d
                  const effective = isToday && company.open_status?.today ? company.open_status.today : row
                  return (
                    <li key={d} className={`flex justify-between rounded px-1.5 py-0.5 ${isToday ? 'bg-brand-silver font-semibold text-brand-navy' : 'text-slate-600'}`}>
                      <span>{names[d]}{isToday ? ' (today)' : ''}</span>
                      <span>
                        {effective?.is_open && effective.open_time
                          ? `${effective.open_time} – ${effective.close_time}`
                          : 'Closed'}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

        </aside>
      </div>
    </div>
  )
}

/** Icon + value row for the About/contact card. Shows a dash when empty. */
function InfoRow({ icon: Icon, value, href }) {
  const empty = !value
  return (
    <li className="flex items-start gap-2.5">
      <Icon size={16} className="mt-0.5 shrink-0 text-slate-400" />
      {empty ? (
        <span className="text-slate-400">—</span>
      ) : href ? (
        <a href={href} target="_blank" rel="noreferrer" className="break-words text-brand-blue hover:underline">{value}</a>
      ) : (
        <span className="break-words text-slate-700">{value}</span>
      )}
    </li>
  )
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
        active ? 'bg-brand-blue text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )
}
