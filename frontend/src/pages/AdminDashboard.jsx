import { useEffect, useState } from 'react'
import { Users, Building2, Star, FileText } from 'lucide-react'
import { api } from '../api'
import DashboardHeader from '../components/DashboardHeader'
import Spinner from '../components/Spinner'

export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('customers')

  const load = () => {
    setLoading(true)
    api.adminStats().then(setData).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const toggle = async (u) => {
    const next = u.status === 'active' ? 'inactive' : 'active'
    await api.setUserStatus({ user_id: u.id, status: next })
    load()
  }

  return (
    <div className="min-h-screen bg-brand-silver">
      <DashboardHeader badge="Admin" accent="bg-brand-navy" />
      <div className="container-page py-8">
        <h1 className="text-2xl font-extrabold text-brand-navy">Control Panel</h1>
        <p className="text-sm text-slate-500">Manage users, companies and reviews.</p>

        {loading ? (
          <Spinner />
        ) : (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Customers" value={data.counts.customers} icon={Users} color="bg-purple-100 text-brand-blue" />
              <Stat label="Companies" value={data.counts.companies} icon={Building2} color="bg-pink-100 text-brand-green" />
              <Stat label="Reviews" value={data.counts.reviews} icon={Star} color="bg-amber-100 text-amber-600" />
              <Stat label="Profiles" value={data.counts.profiles} icon={FileText} color="bg-purple-100 text-purple-600" />
            </div>

            <div className="mt-8 card overflow-hidden">
              <div className="no-scrollbar flex overflow-x-auto border-b border-slate-200">
                <Tab active={tab === 'customers'} onClick={() => setTab('customers')}>Customers ({data.customers.length})</Tab>
                <Tab active={tab === 'companies'} onClick={() => setTab('companies')}>Companies ({data.companies.length})</Tab>
                <Tab active={tab === 'reviews'} onClick={() => setTab('reviews')}>Recent reviews</Tab>
              </div>

              {tab === 'reviews' ? (
                <ul className="divide-y divide-slate-100">
                  {data.recentReviews.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-4 px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-brand-navy">{r.title || r.body.slice(0, 40)}</p>
                        <p className="truncate text-xs text-slate-500">{r.customer_name} → {r.company_name}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-pink-100 px-2 py-0.5 text-xs font-bold text-pink-700">{r.rating}★</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">{tab === 'companies' ? 'Company' : 'Name'}</th>
                      <th className="px-5 py-3">Username</th>
                      <th className="hidden px-5 py-3 sm:table-cell">Email</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(tab === 'companies' ? data.companies : data.customers).map((u) => (
                      <tr key={u.id}>
                        <td className="px-5 py-3 font-semibold text-brand-navy">
                          {tab === 'companies' ? (u.company_name || u.full_name) : u.full_name}
                        </td>
                        <td className="px-5 py-3 text-slate-600">{u.username}</td>
                        <td className="hidden px-5 py-3 text-slate-500 sm:table-cell">{u.email}</td>
                        <td className="px-5 py-3">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {u.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => toggle(u)}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                              u.status === 'active'
                                ? 'border-red-300 text-red-600 hover:bg-red-50'
                                : 'border-green-300 text-green-600 hover:bg-green-50'
                            }`}
                          >
                            {u.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </>
        )}
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

function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-3 text-sm font-semibold transition ${
        active ? 'border-b-2 border-brand-blue text-brand-blue' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  )
}
