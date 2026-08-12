import { useMemo, useState } from 'react'
import {
  ClipboardList, Armchair, ChefHat, BellRing, Check, X, Trash2, Users, Phone,
  MessageSquare, RefreshCw, Volume2, VolumeX,
} from 'lucide-react'
import { api } from '../api'
import { confirmDelete, toastOk, alertErr } from '../alerts'
import { timeAgo } from '../lib'
import Spinner from './Spinner'

const money = (n) => 'Rs ' + Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 0 })

const STATUS = {
  placed:    { label: 'New',       cls: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500' },
  preparing: { label: 'Preparing', cls: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500' },
  served:    { label: 'Served',    cls: 'bg-green-100 text-green-700',   dot: 'bg-green-500' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-200 text-slate-600',   dot: 'bg-slate-400' },
}

/**
 * Company-side screen for orders guests send by scanning the QR card on their
 * table. Unlike reservations there is nothing to schedule — the guest is
 * already sitting down — so the only thing that matters is moving each order
 * from New to Preparing to Served.
 *
 * The order list is polled by the dashboard and handed down, because the
 * header's notification bell shows the same orders and the two must not
 * disagree.
 */
export default function OrdersManager({ orders, setOrders, loading, at, reload, soundOn, onToggleSound }) {
  const [busyId, setBusyId] = useState(null)
  const [filter, setFilter] = useState('live')  // live | all | one status

  const counts = useMemo(() => {
    const c = { placed: 0, preparing: 0, served: 0, cancelled: 0 }
    orders.forEach((o) => { c[o.status] = (c[o.status] || 0) + 1 })
    return c
  }, [orders])

  const shown = useMemo(() => {
    if (filter === 'all') return orders
    if (filter === 'live') return orders.filter((o) => o.status === 'placed' || o.status === 'preparing')
    return orders.filter((o) => o.status === filter)
  }, [orders, filter])

  const move = async (o, status) => {
    setBusyId(o.id)
    // Moved locally first — a kitchen tapping "Preparing" shouldn't wait for a
    // round-trip to see it happen. The reload right after is the source of truth.
    setOrders((list) => list.map((x) => (x.id === o.id ? { ...x, status } : x)))
    try {
      await api.setOrderStatus(o.id, status)
      await reload()
    } catch (err) {
      alertErr(err)
      await reload()
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (o) => {
    if (!(await confirmDelete({ title: `Delete order ${o.ref}?`, text: 'It disappears from this screen for good.' }))) return
    try {
      await api.deleteOrder(o.id)
      await reload()
      toastOk('Order deleted')
    } catch (err) {
      alertErr(err)
    }
  }

  const live = counts.placed + counts.preparing

  return (
    <div className="card mt-6 p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-brand-navy">
            <ClipboardList size={18} className="text-brand-green" /> Table orders
          </h2>
          <p className="text-sm text-slate-500">
            Orders guests send by scanning the QR card on their table. Move each one along as the kitchen works.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {counts.placed > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
              {counts.placed} new
            </span>
          )}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 focus:border-brand-blue focus:outline-none"
          >
            <option value="live">Live ({live})</option>
            <option value="all">All ({orders.length})</option>
            <option value="placed">New ({counts.placed})</option>
            <option value="preparing">Preparing ({counts.preparing})</option>
            <option value="served">Served ({counts.served})</option>
            <option value="cancelled">Cancelled ({counts.cancelled})</option>
          </select>
          <button
            onClick={onToggleSound}
            title={soundOn ? 'Bell is on for new orders — click to mute' : 'Bell is muted — click to turn it on'}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
              soundOn ? 'border-brand-green/40 bg-brand-green/10 text-brand-green' : 'border-slate-300 text-slate-400'
            }`}
          >
            {soundOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
          <button
            onClick={reload}
            title={at ? `Updated ${at.toLocaleTimeString()}` : 'Refresh'}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-50"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          {orders.length === 0
            ? 'No table orders yet. Print your tables’ QR cards and guests can order straight from their seat.'
            : 'Nothing here — try a different filter.'}
        </p>
      ) : (
        <div className="card-scroll-lg space-y-3">
          {shown.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              busy={busyId === o.id}
              onMove={(s) => move(o, s)}
              onDelete={() => remove(o)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function OrderCard({ order, busy, onMove, onDelete }) {
  const s = STATUS[order.status] || STATUS.placed

  return (
    <div
      className={`rounded-xl border p-4 transition ${
        order.status === 'placed' ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-brand-navy px-2 py-1 text-sm font-extrabold tracking-widest text-white">
              {order.ref}
            </span>
            <span className="flex items-center gap-1 text-sm font-bold text-brand-navy">
              <Armchair size={14} className="text-slate-400" /> {order.table_label}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${s.cls}`}>{s.label}</span>
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>{timeAgo(order.created_at)}</span>
            <span className="flex items-center gap-1"><Users size={12} /> {order.people}</span>
            {order.name && <span>{order.name}</span>}
            {order.mobile && (
              <a href={`tel:${order.mobile}`} className="flex items-center gap-1 font-semibold text-brand-blue hover:underline">
                <Phone size={12} /> {order.mobile}
              </a>
            )}
          </p>
        </div>
        <span className="text-lg font-extrabold text-brand-navy">{money(order.total)}</span>
      </div>

      <ul className="mt-3 space-y-1 border-t border-slate-200/70 pt-3">
        {order.items.map((l, i) => (
          <li key={i} className="flex items-center gap-2.5 text-sm">
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded bg-brand-silver px-1 text-xs font-extrabold text-brand-navy">
              {l.qty}
            </span>
            <span className="min-w-0 flex-1 truncate font-semibold text-slate-700">{l.name}</span>
            <span className="text-slate-400">{money(l.price * l.qty)}</span>
          </li>
        ))}
      </ul>

      {order.note && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-brand-silver px-3 py-2 text-sm text-slate-600">
          <MessageSquare size={14} className="mt-0.5 shrink-0 text-slate-400" />
          <span>{order.note}</span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {order.status === 'placed' && (
          <Action onClick={() => onMove('preparing')} busy={busy} icon={ChefHat} tone="blue">Start preparing</Action>
        )}
        {order.status === 'preparing' && (
          <Action onClick={() => onMove('served')} busy={busy} icon={BellRing} tone="green">Mark served</Action>
        )}
        {order.status === 'served' && (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-green-600">
            <Check size={15} /> Served
          </span>
        )}
        {(order.status === 'placed' || order.status === 'preparing') && (
          <Action onClick={() => onMove('cancelled')} busy={busy} icon={X} tone="ghost">Cancel</Action>
        )}
        <button
          onClick={onDelete}
          title="Delete order"
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}

function Action({ onClick, busy, icon: Icon, tone, children }) {
  const cls = {
    blue:  'bg-brand-blue text-white hover:bg-brand-navy',
    green: 'bg-green-600 text-white hover:bg-green-700',
    ghost: 'border border-slate-300 text-slate-600 hover:bg-slate-50',
  }[tone]
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold transition disabled:opacity-50 ${cls}`}
    >
      <Icon size={15} /> {children}
    </button>
  )
}
