import { useEffect, useRef, useState } from 'react'
import { Bell, Check, X, ChevronRight } from 'lucide-react'
import { api } from '../api'
import { timeAgo } from '../lib'

/**
 * Notification bell for logged-in customers. Polls for in-app notifications
 * (e.g. a company's reply to a reservation). Clicking one opens it in a reading
 * card; closing that card dismisses the notification. The badge shows how many
 * are unread.
 */
export default function CustomerBell() {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [viewing, setViewing] = useState(null) // notification opened in the reading card
  const ref = useRef(null)

  const load = () =>
    api
      .notifications()
      .then((d) => setItems(d.notifications || []))
      .catch(() => {})

  useEffect(() => {
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const dismiss = async (id) => {
    setItems((xs) => xs.filter((n) => n.id !== id)) // optimistic
    try {
      await api.dismissNotification(id)
    } catch {
      load()
    }
  }

  // Open a notification in the reading card (does not remove it yet).
  const openNotif = (n) => {
    setViewing(n)
    setOpen(false)
  }

  // Closing the reading card dismisses (removes) the notification.
  const closeReader = () => {
    if (viewing) dismiss(viewing.id)
    setViewing(null)
  }

  const clearAll = async () => {
    setItems([])
    try {
      await api.clearNotifications()
    } catch {
      load()
    }
  }

  const count = items.length

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o)
          load()
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-cardHover">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="font-bold text-brand-navy">Notifications</span>
            {count > 0 && (
              <button onClick={clearAll} className="text-xs font-semibold text-slate-400 hover:text-red-500">
                Clear all
              </button>
            )}
          </div>
          {count === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">You're all caught up 🎉</p>
          ) : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => openNotif(n)}
                    className="group flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
                    title="Click to read"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-blueLight/20 text-brand-blue">
                      <Bell size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-700">{n.title}</span>
                      {n.body && <span className="block truncate text-xs text-slate-500">{n.body}</span>}
                      <span className="block text-xs text-slate-400">{timeAgo(n.created_at)}</span>
                    </span>
                    <ChevronRight size={16} className="mt-1 shrink-0 text-slate-300 group-hover:text-brand-blue" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Reading card — opens the clicked notification; closing it removes it. */}
      {viewing && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onClick={closeReader}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-blueLight/20 text-brand-blue">
                <Bell size={20} />
              </span>
              <button
                onClick={closeReader}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <h3 className="mt-3 text-lg font-extrabold text-brand-navy">{viewing.title}</h3>
            {viewing.body && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">{viewing.body}</p>}
            <p className="mt-3 text-xs text-slate-400">{timeAgo(viewing.created_at)}</p>

            <div className="mt-5 flex justify-end">
              <button onClick={closeReader} className="btn-blue py-2 text-sm">
                <Check size={15} /> Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
