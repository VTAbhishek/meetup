import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'

/** New orders arrive on their own, so the dashboard re-checks without being asked. */
const POLL_MS = 15000

/**
 * The company's dine-in orders, kept fresh.
 *
 * Lives here rather than inside the orders card because two things need the
 * same list — the card itself and the header's notification bell — and polling
 * the server twice for one answer would be wasteful and could leave the two
 * showing different states a few seconds apart.
 */
export function useLiveOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [at, setAt] = useState(null)

  const reload = useCallback(async () => {
    try {
      const d = await api.myOrders()
      setOrders(d.orders || [])
      setAt(new Date())
    } catch {
      // Keep the last good list: a dropped poll shouldn't blank the screen.
    }
  }, [])

  useEffect(() => {
    let alive = true
    reload().finally(() => alive && setLoading(false))

    // Don't poll a tab nobody is looking at; catch up the moment it returns.
    const id = setInterval(() => { if (!document.hidden) reload() }, POLL_MS)
    const onVisible = () => !document.hidden && reload()
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      alive = false
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [reload])

  return { orders, setOrders, loading, at, reload }
}
