import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { Star, PenLine, LayoutGrid, ChevronDown, User, Settings, LogOut, Building2, Menu, X } from 'lucide-react'
import { useAuth } from '../auth'
import { useLang } from '../i18n'
import { colorFor, initials } from '../lib'
import { homeFor } from './AuthShell'
import SearchBar from './SearchBar'
import DistrictCityPicker from './DistrictCityPicker'
import CustomerBell from './CustomerBell'
import { useLocationCtx } from '../location'

export default function Navbar() {
  const { user, logout } = useAuth()
  const { t } = useLang()
  const { districts, districtId, cityId, setDistrict, setCity } = useLocationCtx()

  // Picking a location from the navbar takes you to the filtered results.
  const goDistrict = (id) => { setDistrict(id); navigate('/search') }
  const goCity = (id) => { setCity(id); navigate('/search') }
  const [menu, setMenu] = useState(false)      // desktop avatar dropdown
  const [mobile, setMobile] = useState(false)  // mobile slide-down panel
  const navigate = useNavigate()
  const location = useLocation()
  const onHome = location.pathname === '/'

  // Close menus on route change.
  useEffect(() => {
    setMenu(false)
    setMobile(false)
  }, [location.pathname])

  const doLogout = async () => {
    await logout()
    setMenu(false)
    setMobile(false)
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
      <div className="container-page flex h-16 items-center gap-3 sm:gap-4">
        {/* A signed-in company's home is its dashboard, an admin's is the panel */}
        <Link to={homeFor(user)} className="flex shrink-0 items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-green">
            <Star size={20} color="white" fill="white" strokeWidth={0} />
          </span>
          <span className="text-lg font-extrabold text-brand-navy sm:text-xl">
            Meet<span className="text-brand-blue">up</span>
          </span>
        </Link>

        {!onHome && (
          <div className="hidden md:block w-full max-w-md">
            <SearchBar size="sm" placeholder="Search for a company or category..." />
          </div>
        )}

        {/* Desktop nav */}
        <nav className="ml-auto hidden items-center gap-2 sm:flex">
          <NavLink to="/write-review" className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            <PenLine size={16} /> {t('writeReview')}
          </NavLink>
          <NavLink to="/categories" className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            <LayoutGrid size={16} /> {t('categories')}
          </NavLink>

          {user?.user_type === 'customer' && <CustomerBell />}

          {user ? (
            <div className="relative">
              <button
                onClick={() => setMenu((m) => !m)}
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-slate-100"
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: colorFor(user.full_name) }}>
                    {initials(user.full_name)}
                  </span>
                )}
                <ChevronDown size={16} className="text-slate-500" />
              </button>
              {menu && (
                <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-cardHover" onMouseLeave={() => setMenu(false)}>
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="font-semibold text-brand-navy">{user.full_name}</p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                  </div>
                  <MenuItem to="/dashboard" icon={User} label={t('myReviews')} onClick={() => setMenu(false)} />
                  <MenuItem to="/settings" icon={Settings} label={t('accountSettings')} onClick={() => setMenu(false)} />
                  <button onClick={doLogout} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50">
                    <LogOut size={16} /> {t('logout')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              {t('login')}
            </Link>
          )}

          <Link to="/business/login" className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-brand-blueLight/15 px-4 py-2 text-sm font-bold text-brand-blue hover:bg-brand-blueLight/25">
            <Building2 size={16} /> {t('forBusinesses')}
          </Link>

          <div className="w-56">
            <DistrictCityPicker
              districts={districts}
              districtId={districtId}
              cityId={cityId}
              onDistrict={goDistrict}
              onCity={goCity}
              selectClass="w-full rounded-full border border-slate-300 bg-white py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:border-brand-blue focus:outline-none"
            />
          </div>
        </nav>

        {/* Mobile: bell (customers) + hamburger */}
        <div className="ml-auto flex items-center gap-1 sm:hidden">
          {user?.user_type === 'customer' && <CustomerBell />}
          <button
            onClick={() => setMobile((o) => !o)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
            aria-label="Toggle menu"
          >
            {mobile ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      {mobile && (
        <div className="space-y-1 border-t border-slate-200 bg-white px-4 py-4 sm:hidden">
          <div className="pb-2">
            <SearchBar size="sm" placeholder="Search company or category..." />
          </div>

          {user && (
            <div className="mb-1 flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: colorFor(user.full_name) }}>
                  {initials(user.full_name)}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate font-semibold text-brand-navy">{user.full_name}</p>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
              </div>
            </div>
          )}

          <MobileLink to="/write-review" icon={PenLine}>{t('writeReview')}</MobileLink>
          <MobileLink to="/categories" icon={LayoutGrid}>{t('categories')}</MobileLink>
          <MobileLink to="/business/login" icon={Building2}>{t('forBusinesses')}</MobileLink>

          <div className="px-1 pt-2">
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Location</p>
            <DistrictCityPicker
              districts={districts}
              districtId={districtId}
              cityId={cityId}
              onDistrict={goDistrict}
              onCity={goCity}
            />
          </div>

          <hr className="my-2 border-slate-100" />

          {user ? (
            <>
              <MobileLink to="/dashboard" icon={User}>{t('myReviews')}</MobileLink>
              <MobileLink to="/settings" icon={Settings}>{t('accountSettings')}</MobileLink>
              <button onClick={doLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50">
                <LogOut size={18} /> {t('logout')}
              </button>
            </>
          ) : (
            <MobileLink to="/login" icon={User}>{t('login')}</MobileLink>
          )}
        </div>
      )}
    </header>
  )
}

function MenuItem({ to, icon: Icon, label, onClick }) {
  return (
    <Link to={to} onClick={onClick} className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
      <Icon size={16} /> {label}
    </Link>
  )
}

function MobileLink({ to, icon: Icon, children }) {
  return (
    <Link to={to} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">
      <Icon size={18} /> {children}
    </Link>
  )
}
