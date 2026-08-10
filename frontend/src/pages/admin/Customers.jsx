import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Trash2, X, Mail, User, Calendar } from 'lucide-react'
import { api } from '../../api'
import { confirmDelete, toastOk, alertErr } from '../../alerts'
import { Stars } from '../../components/Stars'
import Spinner from '../../components/Spinner'
import { colorFor, initials, timeAgo } from '../../lib'
import { StatusBadge, PasswordReset } from './Companies'

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Deactivated' },
]

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [viewId, setViewId] = useState(null)

  const load = () => {
    setLoading(true)
    api.adminStats().then((d) => setCustomers(d.customers)).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const changeStatus = async (u, value) => {
    try {
      await api.setUserStatus({ user_id: u.id, status: value })
      setCustomers((list) => list.map((x) => (x.id === u.id ? { ...x, status: value } : x)))
      toastOk(`Status set to ${value}`)
    } catch (e) {
      alertErr(e)
    }
  }

  const remove = async (u) => {
    if (!(await confirmDelete({ title: `Delete ${u.full_name}?`, text: 'This permanently removes the account and all its reviews.' }))) return
    try {
      await api.deleteUser(u.id)
      load()
      toastOk('Customer deleted')
    } catch (e) {
      alertErr(e)
    }
  }

  const counts = useMemo(() => {
    const c = { all: customers.length, pending: 0, active: 0, inactive: 0 }
    customers.forEach((x) => { c[x.status] = (c[x.status] || 0) + 1 })
    return c
  }, [customers])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    return customers.filter((u) => {
      if (status !== 'all' && u.status !== status) return false
      return !t || u.full_name.toLowerCase().includes(t) || u.username.toLowerCase().includes(t) || u.email.toLowerCase().includes(t)
    })
  }, [customers, q, status])

  if (loading) return <Spinner />

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-brand-navy">Customers</h1>
          <p className="text-sm text-slate-500">
            {customers.length} customers · <span className="font-semibold text-amber-600">{counts.pending} pending</span>
          </p>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-52 rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-brand-blue focus:outline-none" />
        </div>
      </div>

      <div className="no-scrollbar mt-4 flex shrink-0 gap-1 overflow-x-auto">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatus(t.key)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              status === t.key ? 'bg-brand-navy text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.label} <span className="opacity-70">({counts[t.key] ?? 0})</span>
          </button>
        ))}
      </div>

      <div className="card mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Customer</th>
                <th className="hidden px-5 py-3 sm:table-cell">Email</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-12 text-center text-slate-400">No customers in this view.</td></tr>
              ) : filtered.map((u) => (
                <tr key={u.id}>
                  <td className="px-5 py-3">
                    <button onClick={() => setViewId(u.id)} className="group flex items-center gap-2 text-left font-semibold text-brand-navy" title="View details">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: colorFor(u.full_name) }}>
                        {initials(u.full_name)}
                      </span>
                      <div>
                        <p className="group-hover:text-brand-blue group-hover:underline">{u.full_name}</p>
                        <p className="text-xs font-normal text-slate-400">@{u.username}</p>
                      </div>
                    </button>
                  </td>
                  <td className="hidden px-5 py-3 text-slate-500 sm:table-cell">{u.email}</td>
                  <td className="px-5 py-3"><StatusBadge status={u.status} /></td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <select
                        value={u.status}
                        onChange={(e) => changeStatus(u, e.target.value)}
                        className="rounded-lg border border-slate-300 py-1.5 pl-2 pr-6 text-xs font-semibold text-slate-700 focus:border-brand-blue focus:outline-none"
                      >
                        <option value="pending">Pending</option>
                        <option value="active">Active</option>
                        <option value="inactive">Deactivated</option>
                      </select>
                      <button onClick={() => remove(u)} className="rounded-lg border border-red-300 p-1.5 text-red-600 hover:bg-red-50" title="Delete account">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {viewId && <CustomerDetailModal id={viewId} onClose={() => setViewId(null)} />}
    </div>
  )
}

function CustomerDetailModal({ id, onClose }) {
  const [data, setData] = useState(null)
  useEffect(() => { api.adminCustomerDetail(id).then(setData) }, [id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[86vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-cardHover" onClick={(e) => e.stopPropagation()}>
        {!data ? (
          <div className="p-10"><Spinner /></div>
        ) : (
          <>
            <div className="flex items-start gap-4 border-b border-slate-100 p-6">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-extrabold text-white" style={{ backgroundColor: colorFor(data.customer.full_name) }}>
                {initials(data.customer.full_name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-extrabold text-brand-navy">{data.customer.full_name}</h3>
                  <StatusBadge status={data.customer.status} />
                </div>
                <p className="text-sm text-slate-400">@{data.customer.username}</p>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={22} /></button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <Detail icon={Mail} label="Email" value={data.customer.email} />
                <Detail icon={User} label="Username" value={data.customer.username} />
                <Detail icon={Calendar} label="Joined" value={new Date(data.customer.created_at).toLocaleString()} />
              </dl>

              <h4 className="mb-3 mt-6 font-bold text-brand-navy">Reviews written ({data.reviews.length})</h4>
              {data.reviews.length === 0 ? (
                <p className="text-sm text-slate-400">No reviews yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.reviews.map((r) => (
                    <div key={r.id} className="rounded-xl border border-slate-100 p-3">
                      <div className="flex items-center justify-between">
                        <Link to={`/review/${r.slug}`} className="text-sm font-semibold text-brand-blue hover:underline">{r.company_name}</Link>
                        <Stars value={r.rating} size={14} />
                      </div>
                      {r.title && <p className="mt-1 text-sm font-semibold text-slate-700">{r.title}</p>}
                      <p className="text-sm text-slate-600">{r.body}</p>
                      <p className="mt-1 text-xs text-slate-400">{timeAgo(r.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 p-4">
              <PasswordReset userId={data.customer.id} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Detail({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={15} className="mt-0.5 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <dt className="text-xs text-slate-400">{label}</dt>
        <dd className="break-words font-medium text-slate-700">{value}</dd>
      </div>
    </div>
  )
}
