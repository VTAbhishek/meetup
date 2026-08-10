import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Building2, Star, FileText } from 'lucide-react'
import { api } from '../../api'
import Spinner from '../../components/Spinner'

export default function Overview() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.adminStats().then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0">
        <h1 className="text-2xl font-extrabold text-brand-navy">Overview</h1>
        <p className="text-sm text-slate-500">Platform activity at a glance.</p>
      </div>

      <div className="mt-6 grid shrink-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Customers" value={data.counts.customers} icon={Users} color="bg-purple-100 text-brand-blue" />
        <Stat label="Companies" value={data.counts.companies} icon={Building2} color="bg-pink-100 text-brand-green" />
        <Stat label="Reviews" value={data.counts.reviews} icon={Star} color="bg-amber-100 text-amber-600" />
        <Stat label="Profiles" value={data.counts.profiles} icon={FileText} color="bg-purple-100 text-purple-600" />
      </div>

      <div className="mt-8 grid min-h-0 flex-1 gap-6 lg:grid-cols-2">
        <div className="card flex min-h-0 flex-col p-5">
          <div className="mb-3 flex shrink-0 items-center justify-between">
            <h2 className="font-bold text-brand-navy">Recent reviews</h2>
            <Link to="/admin/reviews" className="text-sm font-semibold text-brand-blue hover:underline">View all</Link>
          </div>
          <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto pr-1">
            {data.recentReviews.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-brand-navy">{r.title || r.body.slice(0, 40)}</p>
                  <p className="truncate text-xs text-slate-500">{r.customer_name} → {r.company_name}</p>
                </div>
                <span className="shrink-0 rounded-full bg-pink-100 px-2 py-0.5 text-xs font-bold text-pink-700">{r.rating}★</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card self-start p-5">
          <h2 className="mb-3 font-bold text-brand-navy">Manage</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link to="/admin/companies" className="rounded-xl border border-slate-200 p-4 hover:border-brand-blue/40 hover:shadow-card">
              <Building2 className="text-brand-green" />
              <p className="mt-2 font-semibold text-brand-navy">Companies</p>
              <p className="text-xs text-slate-500">Review registered businesses</p>
            </Link>
            <Link to="/admin/customers" className="rounded-xl border border-slate-200 p-4 hover:border-brand-blue/40 hover:shadow-card">
              <Users className="text-brand-blue" />
              <p className="mt-2 font-semibold text-brand-navy">Customers</p>
              <p className="text-xs text-slate-500">Activate or deactivate accounts</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, icon: Icon, color }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}>
        <Icon size={22} />
      </span>
      <div>
        <p className="text-2xl font-extrabold text-brand-navy">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  )
}
