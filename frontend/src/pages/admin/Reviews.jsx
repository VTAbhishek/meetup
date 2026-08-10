import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { api } from '../../api'
import { confirmDelete, toastOk, alertErr } from '../../alerts'
import { Stars } from '../../components/Stars'
import Spinner from '../../components/Spinner'
import { colorFor, initials, timeAgo } from '../../lib'

export default function Reviews() {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    api.adminStats().then((d) => setReviews(d.recentReviews)).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const remove = async (r) => {
    if (!(await confirmDelete({ text: 'Delete this review permanently?' }))) return
    try {
      await api.deleteReviewAdmin(r.id)
      setReviews((rs) => rs.filter((x) => x.id !== r.id))
      toastOk('Review deleted')
    } catch (e) {
      alertErr(e)
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0">
        <h1 className="text-2xl font-extrabold text-brand-navy">Reviews</h1>
        <p className="text-sm text-slate-500">Latest reviews across the platform.</p>
      </div>

      <div className="mt-6 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {reviews.map((r) => (
          <div key={r.id} className="card p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: colorFor(r.customer_name) }}>
                {initials(r.customer_name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-brand-navy">{r.customer_name}</p>
                <p className="text-xs text-slate-400">{timeAgo(r.created_at)}</p>
              </div>
              <Stars value={r.rating} size={15} />
              <Link to={`/review/${r.slug}`} className="ml-2 shrink-0 text-sm font-semibold text-brand-blue hover:underline">
                {r.company_name}
              </Link>
              <button
                onClick={() => remove(r)}
                className="shrink-0 rounded-lg border border-red-300 p-1.5 text-red-600 hover:bg-red-50"
                title="Delete review"
              >
                <Trash2 size={15} />
              </button>
            </div>
            {r.title && <h4 className="mt-2 font-bold text-brand-navy">{r.title}</h4>}
            <p className="mt-1 text-sm text-slate-600">{r.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
