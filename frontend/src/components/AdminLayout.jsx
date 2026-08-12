import { useEffect, useState } from 'react'
import { NavLink, Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { Star, LayoutDashboard, Building2, Users, MessageSquare, Tag, Sparkles, MapPin, LogOut, ExternalLink } from 'lucide-react'
import { useAuth } from '../auth'
import { api } from '../api'
import { colorFor, initials } from '../lib'

const NAV = [
  { to: '/admin', end: true, icon: LayoutDashboard, label: 'Overview' },
  { to: '/admin/companies', icon: Building2, label: 'Companies', badge: 'companies' },
  { to: '/admin/categories', icon: Tag, label: 'Categories' },
  { to: '/admin/moods', icon: Sparkles, label: 'Moods' },
  { to: '/admin/locations', icon: MapPin, label: 'Locations' },
  { to: '/admin/customers', icon: Users, label: 'Customers', badge: 'customers' },
  { to: '/admin/reviews', icon: MessageSquare, label: 'Reviews' },
]

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [pending, setPending] = useState({ companies: 0, customers: 0 })

  // Refresh pending counts on navigation and every 15s.
  useEffect(() => {
    const fetchCounts = () => api.pendingCounts().then(setPending).catch(() => {})
    fetchCounts()
    const id = setInterval(fetchCounts, 15000)
    return () => clearInterval(id)
  }, [location.pathname])

  const doLogout = async () => {
    await logout()
    navigate('/admin/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-brand-silver">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-60 shrink-0 flex-col bg-brand-navy text-slate-300 md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-white/10 px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-green">
            <Star size={18} color="white" fill="white" strokeWidth={0} />
          </span>
          <span className="font-extrabold text-white">Admin Panel</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                  isActive ? 'bg-white/10 text-white' : 'hover:bg-white/5'
                }`
              }
            >
              <n.icon size={18} />
              <span>{n.label}</span>
              {n.badge && pending[n.badge] > 0 && (
                <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-bold text-black">
                  {pending[n.badge]}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <Link to="/" className="mb-1 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-white/5">
            <ExternalLink size={18} /> View site
          </Link>
          <button onClick={doLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/10">
            <LogOut size={18} /> Log out
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
          <span className="font-extrabold text-brand-navy md:hidden">Admin Panel</span>
          <div className="ml-auto flex items-center gap-3">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: colorFor(user?.full_name || '') }}
            >
              {initials(user?.full_name || '')}
            </span>
            <span className="hidden text-sm font-semibold text-slate-700 sm:inline">{user?.full_name}</span>
            <button onClick={doLogout} className="btn-ghost py-2 text-sm">
              <LogOut size={16} /> <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </header>

        {/* Mobile nav */}
        <nav className="no-scrollbar flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 md:hidden">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold ${
                  isActive ? 'bg-brand-navy text-white' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {n.label}
              {n.badge && pending[n.badge] > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-bold text-black">
                  {pending[n.badge]}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
