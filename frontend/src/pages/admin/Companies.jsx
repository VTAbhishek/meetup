import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, BadgeCheck, ExternalLink, Trash2, X, Globe, Mail, User, Tag, Phone, MapPin, Calendar, KeyRound, Eye, EyeOff } from 'lucide-react'
import { api } from '../../api'
import { confirmDelete, toastOk, alertErr } from '../../alerts'
import { useLocationCtx } from '../../location'
import { Stars } from '../../components/Stars'
import Spinner from '../../components/Spinner'
import { colorFor, initials, timeAgo, ratingLabel } from '../../lib'

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Deactivated' },
]

export default function Companies() {
  const [companies, setCompanies] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [fDistrict, setFDistrict] = useState('')
  const [fCity, setFCity] = useState('')
  const [status, setStatus] = useState('all')
  const [viewId, setViewId] = useState(null)
  const { districts } = useLocationCtx()
  const filterCities = districts.find((d) => String(d.id) === String(fDistrict))?.cities || []

  const load = () => {
    setLoading(true)
    api.adminCompanies().then((d) => setCompanies(d.companies)).finally(() => setLoading(false))
  }
  useEffect(load, [])
  useEffect(() => {
    api.adminCategories().then((d) => setCategories(d.categories)).catch(() => {})
  }, [])

  const changeStatus = async (c, value) => {
    try {
      await api.setCompanyStatus(c.id, value)
      setCompanies((list) => list.map((x) => (x.id === c.id ? { ...x, status: value } : x)))
      toastOk(`${c.company_name} · ${value}`)
    } catch (e) {
      alertErr(e)
    }
  }

  const changeCategory = async (c, value) => {
    try {
      await api.updateCompanyAdmin(c.id, { category: value })
      setCompanies((list) => list.map((x) => (x.id === c.id ? { ...x, category: value } : x)))
      toastOk('Category updated')
    } catch (e) {
      alertErr(e)
    }
  }

  const remove = async (c) => {
    const text = c.claimed
      ? 'This permanently removes the company, its owner account and all its reviews.'
      : 'This permanently removes the company and all its reviews.'
    if (!(await confirmDelete({ title: `Delete "${c.company_name}"?`, text }))) return
    try {
      await api.deleteCompanyAdmin(c.id)
      load()
      toastOk('Company deleted')
    } catch (e) {
      alertErr(e)
    }
  }

  const counts = useMemo(() => {
    const c = { all: companies.length, pending: 0, active: 0, inactive: 0 }
    companies.forEach((x) => { c[x.status] = (c[x.status] || 0) + 1 })
    return c
  }, [companies])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return companies.filter((c) => {
      if (status !== 'all' && c.status !== status) return false
      if (cat && c.category !== cat) return false
      if (fDistrict && String(c.district_id) !== String(fDistrict)) return false
      if (fCity && String(c.city_id) !== String(fCity)) return false
      if (!term) return true
      return c.company_name.toLowerCase().includes(term) || (c.email || '').toLowerCase().includes(term)
    })
  }, [companies, q, cat, fDistrict, fCity, status])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-brand-navy">Companies</h1>
          <p className="text-sm text-slate-500">
            {companies.length} profiles · <span className="font-semibold text-amber-600">{counts.pending} pending</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-lg border border-slate-300 py-2 pl-3 pr-8 text-sm font-medium text-slate-700 focus:border-brand-blue focus:outline-none">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <select
            value={fDistrict}
            onChange={(e) => { setFDistrict(e.target.value); setFCity('') }}
            className="rounded-lg border border-slate-300 py-2 pl-3 pr-8 text-sm font-medium text-slate-700 focus:border-brand-blue focus:outline-none"
          >
            <option value="">All districts</option>
            {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select
            value={fCity}
            onChange={(e) => setFCity(e.target.value)}
            disabled={!fDistrict}
            className="rounded-lg border border-slate-300 py-2 pl-3 pr-8 text-sm font-medium text-slate-700 focus:border-brand-blue focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">{fDistrict ? 'All cities' : 'City'}</option>
            {filterCities.map((ci) => <option key={ci.id} value={ci.id}>{ci.name}</option>)}
          </select>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-40 rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-brand-blue focus:outline-none" />
          </div>
        </div>
      </div>

      {/* Status tabs */}
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

      {/* Table */}
      {loading ? (
        <Spinner />
      ) : (
        <div className="card mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Reviews</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">No companies in this view.</td></tr>
                ) : filtered.map((c) => (
                  <tr key={c.id} className="align-middle">
                    <td className="px-4 py-3">
                      <button onClick={() => setViewId(c.id)} className="group flex items-center gap-3 text-left" title="View details">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ backgroundColor: colorFor(c.company_name) }}>
                          {initials(c.company_name)}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-brand-navy group-hover:text-brand-blue group-hover:underline">{c.company_name}</span>
                            {c.claimed
                              ? <BadgeCheck size={14} className="text-brand-green" title="Registered" />
                              : null}
                          </div>
                          <p className="truncate text-xs text-slate-500">{c.website || '—'}{c.email ? ` · ${c.email}` : ''}</p>
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Stars value={c.avg_rating} size={14} />
                        <span className="text-xs text-slate-500">({c.review_count})</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={c.category || ''}
                        onChange={(e) => changeCategory(c, e.target.value)}
                        className="max-w-[160px] rounded-lg border border-slate-300 py-1.5 pl-2 pr-6 text-xs font-medium text-slate-700 focus:border-brand-blue focus:outline-none"
                      >
                        <option value="">— None —</option>
                        {categories.map((x) => <option key={x.id} value={x.name}>{x.name}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <select
                          value={c.status}
                          onChange={(e) => changeStatus(c, e.target.value)}
                          className="rounded-lg border border-slate-300 py-1.5 pl-2 pr-6 text-xs font-semibold text-slate-700 focus:border-brand-blue focus:outline-none"
                          title="Change status"
                        >
                          <option value="pending">Pending</option>
                          <option value="active">Active</option>
                          <option value="inactive">Deactivated</option>
                        </select>
                        {c.slug && (
                          <Link to={`/review/${c.slug}`} className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50" title="View public page">
                            <ExternalLink size={15} />
                          </Link>
                        )}
                        <button onClick={() => remove(c)} className="rounded-lg border border-red-300 p-1.5 text-red-600 hover:bg-red-50" title="Delete">
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
      )}

      {viewId && <CompanyDetailModal id={viewId} onClose={() => setViewId(null)} />}
    </div>
  )
}

function CompanyDetailModal({ id, onClose }) {
  const [data, setData] = useState(null)
  useEffect(() => { api.adminCompanyDetail(id).then(setData) }, [id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-cardHover" onClick={(e) => e.stopPropagation()}>
        {!data ? (
          <div className="p-10"><Spinner /></div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start gap-4 border-b border-slate-100 p-6">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-extrabold text-white" style={{ backgroundColor: colorFor(data.company.company_name) }}>
                {initials(data.company.company_name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-extrabold text-brand-navy">{data.company.company_name}</h3>
                  <StatusBadge status={data.company.status} />
                  {data.company.claimed && (
                    <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700"><BadgeCheck size={12} /> Registered</span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2 text-sm">
                  <Stars value={data.company.avg_rating} size={16} />
                  <span className="font-semibold text-slate-700">{data.company.avg_rating > 0 ? data.company.avg_rating.toFixed(1) : '—'}</span>
                  <span className="text-slate-400">· {data.company.review_count} reviews · {ratingLabel(data.company.avg_rating)}</span>
                </div>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={22} /></button>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <Detail icon={Globe} label="Website" value={data.company.website || '—'} />
                <Detail icon={Tag} label="Category" value={data.company.category || '—'} />
                <Detail icon={User} label="Contact" value={data.company.contact || '—'} />
                <Detail icon={Mail} label="Email" value={data.company.email || '—'} />
                <Detail icon={User} label="Username" value={data.company.username || '—'} />
                <Detail icon={Phone} label="Phone" value={data.company.phone || '—'} />
                <Detail
                  icon={MapPin}
                  label="District & City"
                  value={
                    (data.company.city_name || data.company.district_name)
                      ? `${[data.company.city_name, data.company.district_name].filter(Boolean).join(', ')}${data.company.district_name ? ' District' : ''}`
                      : '—'
                  }
                />
                <Detail icon={MapPin} label="Address" value={data.company.address || '—'} />
                <Detail icon={Calendar} label="Registered" value={data.company.registered_at ? new Date(data.company.registered_at).toLocaleString() : '—'} />
              </dl>

              {data.company.description && (
                <div className="mt-4">
                  <p className="text-xs text-slate-400">Description</p>
                  <p className="mt-1 text-sm text-slate-600">{data.company.description}</p>
                </div>
              )}

              <h4 className="mb-3 mt-6 font-bold text-brand-navy">Reviews ({data.reviews.length})</h4>
              {data.reviews.length === 0 ? (
                <p className="text-sm text-slate-400">No reviews yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.reviews.map((r) => (
                    <div key={r.id} className="rounded-xl border border-slate-100 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-brand-navy">{r.customer_name}</span>
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

            {/* Footer */}
            {(data.company.slug || data.company.user_id) && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4">
                {data.company.user_id ? <PasswordReset userId={data.company.user_id} /> : <span />}
                {data.company.slug && (
                  <Link to={`/review/${data.company.slug}`} className="btn-ghost py-2 text-sm">
                    View public page <ExternalLink size={14} />
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export function PasswordReset({ userId }) {
  const [open, setOpen] = useState(false)
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.resetUserPassword(userId, pw)
      setPw('')
      setOpen(false)
      toastOk('Password updated')
    } catch (ex) {
      alertErr(ex)
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-ghost py-2 text-sm"><KeyRound size={15} /> Reset password</button>
    )
  }
  return (
    <form onSubmit={save} className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="New password"
          className="input w-48 py-2 pr-9 text-sm"
          autoFocus
        />
        <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600">
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <button type="submit" disabled={busy} className="btn-blue py-2 text-sm">{busy ? 'Saving…' : 'Save'}</button>
      <button type="button" onClick={() => setOpen(false)} className="btn-ghost py-2 text-sm">Cancel</button>
    </form>
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

export function StatusBadge({ status }) {
  const map = {
    pending:  'bg-amber-100 text-amber-700',
    active:   'bg-green-100 text-green-700',
    inactive: 'bg-red-100 text-red-700',
  }
  const label = { pending: 'Pending', active: 'Active', inactive: 'Deactivated' }[status] || status
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${map[status] || 'bg-slate-100 text-slate-600'}`}>{label}</span>
}
