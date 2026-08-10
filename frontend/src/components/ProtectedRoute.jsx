import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth'
import Spinner from './Spinner'

const LOGIN_FOR = {
  customer: '/login',
  company: '/business/login',
  admin: '/admin/login',
}

export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Spinner />

  if (!user) {
    return <Navigate to={LOGIN_FOR[role] || '/login'} state={{ from: location.pathname }} replace />
  }

  // Logged in but wrong role for this area.
  if (role && user.user_type !== role) {
    return <Navigate to={LOGIN_FOR[role]} replace />
  }

  return children
}
