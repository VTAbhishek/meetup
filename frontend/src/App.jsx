import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import BlockRoles from './components/BlockRoles'
import Home from './pages/Home'
import Search from './pages/Search'
import CompanyProfile from './pages/CompanyProfile'
import ReserveBooking from './pages/ReserveBooking'
import WriteReview from './pages/WriteReview'
import Categories from './pages/Categories'
import CategoryDetail from './pages/CategoryDetail'
import Login from './pages/Login'
import Register from './pages/Register'
import BusinessLogin from './pages/BusinessLogin'
import BusinessRegister from './pages/BusinessRegister'
import AdminLogin from './pages/AdminLogin'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import BusinessDashboard from './pages/BusinessDashboard'
import AdminLayout from './components/AdminLayout'
import AdminOverview from './pages/admin/Overview'
import AdminCompanies from './pages/admin/Companies'
import AdminCategories from './pages/admin/Categories'
import AdminLocations from './pages/admin/Locations'
import AdminCustomers from './pages/admin/Customers'
import AdminReviews from './pages/admin/Reviews'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <Routes>
      {/* Public + customer site (with navbar/footer) */}
      <Route element={<Layout />}>
        <Route path="/" element={<BlockRoles roles={['company']}><Home /></BlockRoles>} />
        <Route path="/search" element={<Search />} />
        <Route path="/review/:slug" element={<CompanyProfile />} />
        <Route
          path="/reserve/:slug"
          element={
            <ProtectedRoute role="customer">
              <ReserveBooking />
            </ProtectedRoute>
          }
        />
        <Route path="/categories" element={<Categories />} />
        <Route path="/category/:name" element={<CategoryDetail />} />
        <Route path="/write-review" element={<BlockRoles roles={['company']}><WriteReview /></BlockRoles>} />
        <Route path="/write-review/:slug" element={<BlockRoles roles={['company']}><WriteReview /></BlockRoles>} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute role="customer">
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute role="customer">
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Auth pages (full-screen, no navbar) */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/business/login" element={<BusinessLogin />} />
      <Route path="/business/register" element={<BusinessRegister />} />
      <Route path="/admin/login" element={<AdminLogin />} />

      {/* Role dashboards (own header) */}
      <Route
        path="/business"
        element={
          <ProtectedRoute role="company">
            <BusinessDashboard />
          </ProtectedRoute>
        }
      />
      {/* Admin panel (sidebar layout + nested pages) */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute role="admin">
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminOverview />} />
        <Route path="companies" element={<AdminCompanies />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="locations" element={<AdminLocations />} />
        <Route path="customers" element={<AdminCustomers />} />
        <Route path="reviews" element={<AdminReviews />} />
      </Route>
    </Routes>
  )
}
