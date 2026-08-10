import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PenLine, Pencil, Trash2, X } from 'lucide-react'
import { api } from '../api'
import { confirmDelete, toastOk, alertErr } from '../alerts'
import { useAuth } from '../auth'
import { StarPicker, Stars } from '../components/Stars'
import Spinner from '../components/Spinner'
import { colorFor, initials, timeAgo } from '../lib'

export default function Dashboard() {
  const { user } = useAuth()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)

  const load = () => {
    setLoading(true)
    api.myReviews().then((d) => setReviews(d.reviews)).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const remove = async (id) => {
    if (!(await confirmDelete({ text: 'Delete this review? This cannot be undone.' }))) return
    try {
      await api.deleteReview(id)
      setReviews((rs) => rs.filter((r) => r.id !== id))
      toastOk('Review deleted')
    } catch (e) {
      alertErr(e)
    }
  }

  return (
    <div className="container-page py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white"
            style={{ backgroundColor: colorFor(user.full_name) }}
          >
            {initials(user.full_name)}
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-brand-navy">My reviews</h1>
            <p className="text-sm text-slate-500">{reviews.length} review{reviews.length !== 1 && 's'}</p>
          </div>
        </div>
        <Link to="/write-review" className="btn-blue self-start">
          <PenLine size={18} /> Write a review
        </Link>
      </div>

      {loading ? (
        <Spinner />
      ) : reviews.length === 0 ? (
        <div className="card mt-8 p-12 text-center text-slate-500">
          <p className="text-lg font-semibold text-slate-700">You haven’t written any reviews yet</p>
          <Link to="/write-review" className="btn-blue mt-4">Write your first review</Link>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {reviews.map((r) => (
            <div key={r.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <Link to={`/review/${r.slug}`} className="flex items-center gap-3 hover:text-brand-blue">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
                    style={{ backgroundColor: colorFor(r.company_name) }}
                  >
                    {initials(r.company_name)}
                  </span>
                  <div>
                    <p className="font-bold text-brand-navy">{r.company_name}</p>
                    <p className="text-xs text-slate-400">{timeAgo(r.created_at)}</p>
                  </div>
                </Link>
                <div className="flex gap-2">
                  <button onClick={() => setEditing(r)} className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50" title="Edit">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => remove(r.id)} className="rounded-lg border border-slate-300 p-2 text-red-600 hover:bg-red-50" title="Delete">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="mt-3"><Stars value={r.rating} size={18} /></div>
              {r.title && <h4 className="mt-2 font-bold text-brand-navy">{r.title}</h4>}
              <p className="mt-1 text-sm text-slate-600">{r.body}</p>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditModal
          review={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function EditModal({ review, onClose, onSaved }) {
  const [rating, setRating] = useState(review.rating)
  const [title, setTitle] = useState(review.title || '')
  const [body, setBody] = useState(review.body || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.updateReview(review.id, { rating, title: title.trim(), body: body.trim() })
      onSaved()
    } catch (err) {
      setError(err.data?.errors?.body || err.message)
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-brand-navy">Edit your review</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>
        <p className="mt-1 text-sm text-slate-500">{review.company_name}</p>
        <form onSubmit={save} className="mt-4 space-y-4">
          {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
          <StarPicker value={rating} onChange={setRating} size={40} />
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Review title" />
          <textarea className="input resize-y" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={busy} className="btn-blue">{busy ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
