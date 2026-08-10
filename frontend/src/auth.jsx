import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api'
import { toastInfo } from './alerts'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = localStorage.getItem('token')
    if (!t) {
      setLoading(false)
      return
    }
    api
      .me()
      .then((d) => setUser(d.user))
      // Only drop the token if it's genuinely rejected (401); keep it through
      // transient network/server errors so the user isn't logged out by a blip.
      .catch((e) => { if (e?.status === 401) localStorage.removeItem('token') })
      .finally(() => setLoading(false))
  }, [])

  const login = async (creds) => {
    const d = await api.login(creds)
    localStorage.setItem('token', d.token)
    setUser(d.user)
    return d.user
  }

  const register = async (form) => {
    const d = await api.register(form)
    // New accounts are pending approval and are NOT auto-logged-in.
    if (d.token) {
      localStorage.setItem('token', d.token)
      setUser(d.user)
      return d.user
    }
    return null
  }

  const logout = async () => {
    try {
      await api.logout()
    } catch {
      /* ignore */
    }
    localStorage.removeItem('token')
    setUser(null)
    toastInfo('You have been logged out')
  }

  const updateUser = (u) => setUser(u)

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
