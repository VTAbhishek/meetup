import { useEffect, useState } from 'react'
import { CalendarClock, Users, Armchair, ChevronLeft, ChevronRight, UtensilsCrossed, Building2 } from 'lucide-react'
import { api } from '../api'
import { alertErr } from '../alerts'
import Spinner from '../components/Spinner'
import { colorFor, initials, timeAgo } from '../lib'

const money = (n) => 'Rs ' + Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 0 })

export default function MyReservations() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)

  const load = () => {
    setLoading(true)
    api.myReservationsCustomer(page, status)
      .then((d) => {
        setItems(d.reservations || [])
        setTotalItems(d.total || 0)
        setTotalPages(d.pages || 1)
      })
      .catch((err) => alertErr(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [page, status])

  // Reset page when switching status filter
  const handleStatusChange = (newStatus) => {
    setStatus(newStatus)
    setPage(1)
  }

  return (
    <div className="container-page py-10 max-w-4xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-100 text-brand-green">
            <CalendarClock size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-brand-navy">Reservation Details</h1>
            <p className="text-sm text-slate-500">{totalItems} reservation{totalItems !== 1 && 's'} placed</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <label className="text-sm font-semibold text-slate-500">Status:</label>
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 focus:border-brand-blue focus:outline-none"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
          </select>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <div className="card mt-8 p-12 text-center text-slate-500">
          <p className="text-lg font-semibold text-slate-700">No reservations found</p>
          {status !== 'all' ? (
            <button onClick={() => handleStatusChange('all')} className="btn-blue mt-4">Show all reservations</button>
          ) : (
            <p className="mt-2 text-sm text-slate-400">Any restaurant table bookings you make will appear here.</p>
          )}
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {items.map((r) => {
            const confirmed = r.status === 'confirmed'
            const dateLabel = new Date(r.res_date + 'T00:00:00').toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })
            return (
              <div
                key={r.id}
                className={`card p-5 border-l-4 ${confirmed ? 'border-l-green-500' : 'border-l-amber-500'}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {r.company_logo_url ? (
                      <img src={r.company_logo_url} alt="" className="h-11 w-11 rounded-lg object-cover" />
                    ) : (
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-base font-bold text-white"
                        style={{ backgroundColor: colorFor(r.company_name) }}
                      >
                        {initials(r.company_name)}
                      </span>
                    )}
                    <div>
                      <h3 className="font-bold text-brand-navy">{r.company_name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-semibold bg-brand-silver px-2 py-0.5 rounded text-brand-navy">
                          #{r.ref}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            confirmed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {confirmed ? 'Confirmed' : 'Pending'}
                        </span>
                        <span className="text-xs text-slate-400">· {timeAgo(r.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-x-4 gap-y-2 text-sm text-slate-600 sm:grid-cols-3">
                  <div className="flex items-center gap-2">
                    <CalendarClock size={16} className="text-slate-400" />
                    <span>{dateLabel}, {r.time_from}–{r.time_to}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-slate-400" />
                    <span>{r.person_count} {r.person_count === 1 ? 'person' : 'people'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Armchair size={16} className={r.table_label ? 'text-brand-green' : 'text-slate-400'} />
                    <span className={r.table_label ? 'font-semibold text-brand-navy' : ''}>
                      {r.table_label ? r.table_label : 'No table reserved'}
                    </span>
                  </div>
                </div>

                {r.description && (
                  <div className="mt-3 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-600">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Your notes</p>
                    <p>{r.description}</p>
                  </div>
                )}

                {r.reply && (
                  <div className="mt-3 bg-brand-silver/40 rounded-lg px-3 py-2 text-sm border border-brand-blue/10">
                    <p className="text-xs font-semibold text-brand-blue uppercase tracking-wider mb-1">Reply from business</p>
                    <p className="text-slate-700">{r.reply}</p>
                  </div>
                )}

                {r.items?.length > 0 && (
                  <div className="mt-4 rounded-lg border border-brand-green/20 bg-brand-silver/20 px-3.5 py-2.5 text-sm">
                    <p className="flex items-center gap-1.5 font-bold text-brand-navy mb-2">
                      <UtensilsCrossed size={14} className="text-brand-green" /> Pre-ordered Food Cart
                    </p>
                    <ul className="space-y-1 divide-y divide-slate-100">
                      {r.items.map((it, i) => (
                        <div key={i} className="flex justify-between text-slate-600 pt-1 first:pt-0">
                          <span>{it.qty} × {it.name}</span>
                          <span className="tabular-nums text-slate-500">{money(it.price * it.qty)}</span>
                        </div>
                      ))}
                    </ul>
                    <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-extrabold text-brand-navy">
                      <span>Total food cost</span>
                      <span className="tabular-nums">{money(r.items_total)}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <ChevronLeft size={16} /> Prev
          </button>
          <span className="text-sm font-semibold text-slate-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
