import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ThumbsUp, CornerDownRight } from 'lucide-react'
import { Stars } from './Stars'
import { api } from '../api'
import { colorFor, initials, timeAgo } from '../lib'

/**
 * A single review.
 * - `showCompany`: render the company footer (used in feeds/dashboards)
 * - `actions`: extra nodes rendered on the right of the footer (edit/delete)
 */
export default function ReviewCard({ review, showCompany = false, actions = null }) {
  const [useful, setUseful] = useState(review.useful_count ?? 0)
  const [voted, setVoted] = useState(false)

  const vote = async () => {
    if (voted) return
    try {
      const d = await api.markUseful(review.id)
      setUseful(d.useful_count)
      setVoted(true)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="card flex h-full flex-col p-5">
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ backgroundColor: colorFor(review.customer_name) }}
        >
          {initials(review.customer_name)}
        </span>
        <div>
          <p className="font-semibold text-brand-navy leading-tight">{review.customer_name}</p>
          <p className="text-xs text-slate-400">{timeAgo(review.created_at)}</p>
        </div>
      </div>

      <div className="mt-3">
        <Stars value={review.rating} size={18} />
      </div>

      {review.title && <h4 className="mt-3 font-bold text-brand-navy">{review.title}</h4>}
      <p className="mt-1 text-sm text-slate-600 line-clamp-4">{review.body}</p>

      {review.experience_date && (
        <p className="mt-2 text-xs text-slate-400">
          Date of experience: {new Date(review.experience_date).toLocaleDateString()}
        </p>
      )}

      {review.reply && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-1.5 font-semibold text-slate-700">
            <CornerDownRight size={14} />
            <span>Reply from the company</span>
            {review.reply.rating > 0 && (
              <span className="ml-1 flex items-center">
                <Stars value={review.reply.rating} size={12} />
              </span>
            )}
          </div>
          <p className="mt-1 text-slate-600">{review.reply.body}</p>
        </div>
      )}

      <div className="mt-auto flex items-center justify-between pt-4">
        {showCompany && review.company_name ? (
          <Link
            to={`/review/${review.slug}`}
            className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-brand-blue"
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white"
              style={{ backgroundColor: colorFor(review.company_name) }}
            >
              {initials(review.company_name)}
            </span>
            {review.company_name}
          </Link>
        ) : (
          <button
            onClick={vote}
            className={`flex items-center gap-1.5 text-sm font-medium transition ${
              voted ? 'text-brand-green' : 'text-slate-500 hover:text-brand-blue'
            }`}
          >
            <ThumbsUp size={15} /> Useful {useful > 0 && `(${useful})`}
          </button>
        )}
        {actions}
      </div>
    </div>
  )
}
