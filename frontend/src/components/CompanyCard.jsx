import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MapPin } from 'lucide-react'
import { Stars } from './Stars'
import { MoodIcon } from '../lib/moodIcons'
import { colorFor, initials, ratingLabel } from '../lib'

export default function CompanyCard({ company }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="h-full"
    >
      <Link
        to={`/review/${company.slug}`}
        className="card block h-full overflow-hidden transition-shadow hover:shadow-cardHover"
      >
        {/* Top part — cover image (falls back to a brand gradient) */}
        {company.cover_url ? (
          <img src={company.cover_url} alt="" className="h-36 w-full object-cover" />
        ) : (
          <div className="h-36 w-full bg-gradient-to-br from-brand-blueDark via-brand-blue to-brand-green" />
        )}

        {/* Bottom part — logo + details */}
        <div className="p-4 pt-0">
          {/* Logo overlaps the cover */}
          {company.logo_url ? (
            <img
              src={company.logo_url}
              alt={company.company_name}
              className="-mt-8 h-16 w-16 rounded-xl object-cover ring-4 ring-white"
            />
          ) : (
            <span
              className="-mt-8 flex h-16 w-16 items-center justify-center rounded-xl text-lg font-extrabold text-white ring-4 ring-white"
              style={{ backgroundColor: colorFor(company.company_name) }}
            >
              {initials(company.company_name)}
            </span>
          )}

          <div className="mt-2 flex items-center justify-between gap-2">
            <h3 className="truncate font-bold text-brand-navy">{company.company_name}</h3>
            {company.open_now !== null && company.open_now !== undefined && (
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${company.open_now ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                {company.open_now ? 'Open now' : 'Closed'}
              </span>
            )}
          </div>
          <p className="truncate text-sm text-slate-500">{company.website}</p>
          {company.city_name && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
              <MapPin size={12} className="shrink-0 text-brand-green" />
              {company.city_name}, {company.district_name}
            </p>
          )}

          <div className="mt-3 flex items-center gap-2">
            <Stars value={company.avg_rating} size={18} />
            <span className="text-sm font-semibold text-slate-700">
              {company.avg_rating > 0 ? company.avg_rating.toFixed(1) : '—'}
            </span>
            <span className="text-sm text-slate-400">({company.review_count.toLocaleString()})</span>
          </div>
          <p className="mt-1 text-xs font-semibold text-brand-green">{ratingLabel(company.avg_rating)}</p>

          {/* Mood tags — capped at two so cards keep a consistent height */}
          {company.moods?.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1">
              {company.moods.slice(0, 2).map((m) => (
                <span
                  key={m.slug}
                  className="flex items-center gap-1 rounded-full bg-brand-silver px-2 py-0.5 text-[11px] font-semibold text-slate-600"
                >
                  <MoodIcon icon={m.icon} size={11} className="text-brand-green" />
                  {m.name}
                </span>
              ))}
              {company.moods.length > 2 && (
                <span className="rounded-full bg-brand-silver px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                  +{company.moods.length - 2}
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  )
}
