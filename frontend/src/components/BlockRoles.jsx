import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { homeFor } from './AuthShell'

/**
 * Keeps certain roles out of a route by redirecting them to their own home.
 * e.g. company users are confined to the business interface, so they can't open
 * the public home page or the write-a-review flow.
 */
export default function BlockRoles({ roles = [], children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user && roles.includes(user.user_type)) {
    return <Navigate to={homeFor(user)} replace />
  }
  return children
}
