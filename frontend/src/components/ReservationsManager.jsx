import { useEffect, useState } from 'react'
import { CalendarClock, Users, Phone, Check, Clock, Trash2, CornerDownRight, Send, Filter, UtensilsCrossed, Armchair } from 'lucide-react'
import { api } from '../api'
import { toastOk, alertErr, confirmDelete } from '../alerts'
import { timeAgo } from '../lib'
import Spinner from './Spinner'

/**
 * Company-side reservations inbox. Lists the bookings customers have made, with
 * per-reservation actions: confirm, move back to pending, reply, or delete —
 * each of which notifies the customer.
 */
export default function ReservationsManager() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // 'all' | 'pending' | 'confirmed'

  const load = () =>
    api
      .myReservations()
      .then((d) => setItems(d.reservations || []))
      .catch(() => {})
      .finally(() => setLoading(false))

  useEffect(() => {
    load()
  }, [])

  const pending = items.filter((r) => r.status === 'pending').length
  const confirmed = items.filter((r) => r.status === 'confirmed').length
  const shown = filter === 'all' ? items : items.filter((r) => r.status === filter)

  return (
    <div className="card mt-6 p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-brand-navy">
            <CalendarClock size={18} className="text-brand-green" /> Reservations
          </h2>
          <p className="text-sm text-slate-500">Bookings customers have requested. Confirm, reply or decline — they'll be notified.</p>
        </div>
        <div className="flex items-center gap-3">
          {pending > 0 && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700">{pending} pending</span>
          )}
          <label className="flex items-center gap-2 text-sm">
            <Filter size={15} className="text-slate-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 focus:border-brand-blue focus:outline-none"
            >
              <option value="all">All ({items.length})</option>
              <option value="pending">Pending ({pending})</option>
              <option value="confirmed">Confirmed ({confirmed})</option>
            </select>
          </label>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          No reservations yet.
        </p>
      ) : shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          No {filter} reservations.
        </p>
      ) : (
        <ul className="space-y-3">
          {shown.map((r) => (
            <ReservationRow key={r.id} r={r} onChanged={load} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ReservationRow({ r, onChanged }) {
  const [busy, setBusy] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)
  const [reply, setReply] = useState(r.reply || '')

  const act = async (fn, okMsg) => {
    setBusy(true)
    try {
      await fn()
      if (okMsg) toastOk(okMsg)
      onChanged()
    } catch (e) {
      alertErr(e)
    } finally {
      setBusy(false)
    }
  }

  const confirmed = r.status === 'confirmed'
  const dateLabel = new Date(r.res_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <li className={`rounded-xl border p-4 ${confirmed ? 'border-green-200 bg-green-50/40' : 'border-slate-200'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-brand-navy">{r.name}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                confirmed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              {confirmed ? 'Confirmed' : 'Pending'}
            </span>
            <span className="text-xs text-slate-400">· {timeAgo(r.created_at)}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
            <span className="flex items-center gap-1.5"><CalendarClock size={14} className="text-slate-400" /> {dateLabel}, {r.time_from}–{r.time_to}</span>
            <span className="flex items-center gap-1.5"><Users size={14} className="text-slate-400" /> {r.person_count} {r.person_count === 1 ? 'person' : 'people'}</span>
            <a href={`tel:${r.mobile}`} className="flex items-center gap-1.5 hover:text-brand-blue"><Phone size={14} className="text-slate-400" /> {r.mobile}</a>
            {/* table_label is snapshotted, so it survives the table being deleted */}
            {r.table_label && (
              <span className="flex items-center gap-1.5 font-semibold text-brand-navy">
                <Armchair size={14} className="text-brand-green" /> {r.table_label}
              </span>
            )}
          </div>
          {r.description && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{r.description}</p>}
          {r.items?.length > 0 && (
            <div className="mt-2 rounded-lg border border-brand-green/30 bg-brand-silver px-3 py-2 text-sm">
              <p className="flex items-center gap-1.5 font-semibold text-brand-navy">
                <UtensilsCrossed size={14} className="text-brand-green" /> Pre-ordered food
              </p>
              <ul className="mt-1 space-y-0.5">
                {r.items.map((it, i) => (
                  <li key={i} className="flex justify-between text-slate-600">
                    <span>{it.qty} × {it.name}</span>
                    <span className="tabular-nums text-slate-500">Rs {(it.price * it.qty).toLocaleString('en-LK')}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 flex justify-between border-t border-brand-green/20 pt-1 font-bold text-brand-navy">
                <span>Total</span>
                <span className="tabular-nums">Rs {Number(r.items_total || 0).toLocaleString('en-LK')}</span>
              </p>
            </div>
          )}
          {r.reply && (
            <p className="mt-2 flex items-start gap-1.5 text-sm text-slate-500">
              <CornerDownRight size={14} className="mt-0.5 shrink-0 text-brand-green" />
              <span>Your reply: <span className="text-slate-700">{r.reply}</span></span>
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {/* Status toggle — both options always shown, current one active. */}
          <div className="inline-flex overflow-hidden rounded-full border border-slate-300 text-xs font-semibold">
            <button
              onClick={() => !confirmed || act(() => api.updateReservation(r.id, { status: 'pending' }), 'Moved to pending')}
              disabled={busy || !confirmed}
              className={`inline-flex items-center gap-1 px-3 py-1.5 transition ${
                !confirmed ? 'bg-amber-500 text-white' : 'text-slate-600 hover:bg-slate-50 disabled:opacity-60'
              }`}
            >
              <Clock size={14} /> Pending
            </button>
            <button
              onClick={() => confirmed || act(() => api.updateReservation(r.id, { status: 'confirmed' }), 'Reservation confirmed')}
              disabled={busy || confirmed}
              className={`inline-flex items-center gap-1 border-l border-slate-300 px-3 py-1.5 transition ${
                confirmed ? 'bg-green-600 text-white' : 'text-slate-600 hover:bg-slate-50 disabled:opacity-60'
              }`}
            >
              <Check size={14} /> Confirmed
            </button>
          </div>
          <button onClick={() => setReplyOpen((o) => !o)} disabled={busy} className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            <CornerDownRight size={14} /> Reply
          </button>
          <button
            onClick={async () => {
              if (!(await confirmDelete({ title: 'Delete this reservation?', text: 'The customer will be notified it was declined.' }))) return
              act(() => api.deleteReservation(r.id), 'Reservation deleted')
            }}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      {replyOpen && (
        <div className="mt-3 flex items-start gap-2">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={2}
            placeholder="Write a message to the customer…"
            className="flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
          />
          <button
            onClick={() =>
              act(async () => {
                await api.updateReservation(r.id, { reply })
                setReplyOpen(false)
              }, 'Reply sent')
            }
            disabled={busy || !reply.trim()}
            className="btn-green shrink-0 py-2 text-sm"
          >
            <Send size={14} /> Send
          </button>
        </div>
      )}
    </li>
  )
}
