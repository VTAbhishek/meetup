import { useEffect, useState } from 'react'
import { Clock, CalendarClock, RotateCcw } from 'lucide-react'
import { api } from '../api'
import { toastOk, alertErr, confirmAction } from '../alerts'
import Spinner from './Spinner'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] // Monday-first

const defaultWeek = () =>
  DISPLAY_ORDER.map((d) => ({
    weekday: d,
    is_open: d >= 1 && d <= 5,
    open_time: '09:00',
    close_time: '17:00',
  }))

/**
 * Opening-hours manager for the business dashboard:
 *  - weekly schedule (open days + from/to per weekday)
 *  - a "today only" override: special hours or closed; other dates keep
 *    following the saved weekly schedule.
 */
export default function HoursEditor() {
  const [week, setWeek] = useState(defaultWeek())
  const [status, setStatus] = useState(null)
  const [override, setOverride] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => new Date())

  // Today-override form
  const [mode, setMode] = useState('special') // 'special' | 'closed'
  const [tFrom, setTFrom] = useState('09:00')
  const [tTo, setTTo] = useState('17:00')

  const applyPayload = (d) => {
    if (d.hours?.length) {
      const byDay = Object.fromEntries(d.hours.map((h) => [h.weekday, h]))
      setWeek(
        DISPLAY_ORDER.map(
          (day) =>
            byDay[day] ?? { weekday: day, is_open: false, open_time: '09:00', close_time: '17:00' }
        ).map((h) => ({
          ...h,
          open_time: h.open_time || '09:00',
          close_time: h.close_time || '17:00',
        }))
      )
    }
    setOverride(d.today_override ?? null)
    setStatus(d.status ?? null)
    if (d.today_override) {
      setMode(d.today_override.is_open ? 'special' : 'closed')
      if (d.today_override.open_time) setTFrom(d.today_override.open_time)
      if (d.today_override.close_time) setTTo(d.today_override.close_time)
    }
  }

  useEffect(() => {
    api.myHours().then(applyPayload).catch(() => {}).finally(() => setLoading(false))
  }, [])

  // Live clock — ticks every second and drives both the header clock and the
  // open/closed badge (computed from the viewer's local time, so it no longer
  // depends on the server's timezone).
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const setDay = (weekday, patch) =>
    setWeek((w) => w.map((h) => (h.weekday === weekday ? { ...h, ...patch } : h)))

  const saveWeek = async () => {
    setBusy(true)
    try {
      const d = await api.saveMyHours(week)
      applyPayload(d)
      toastOk('Weekly opening hours saved')
    } catch (err) {
      alertErr(err)
    } finally {
      setBusy(false)
    }
  }

  const applyToday = async () => {
    setBusy(true)
    try {
      const d = await api.setTodayHours(
        mode === 'closed'
          ? { is_open: false }
          : { is_open: true, open_time: tFrom, close_time: tTo }
      )
      applyPayload(d)
      toastOk("Today's hours updated (today only)")
    } catch (err) {
      alertErr(err)
    } finally {
      setBusy(false)
    }
  }

  const removeOverride = async () => {
    if (!(await confirmAction({ title: 'Back to weekly schedule?', text: "Remove today's special hours and use the regular schedule.", confirmText: 'Yes, revert' }))) return
    setBusy(true)
    try {
      const d = await api.clearTodayHours()
      applyPayload(d)
      toastOk('Back to the weekly schedule')
    } catch (err) {
      alertErr(err)
    } finally {
      setBusy(false)
    }
  }

  const todayName = DAY_NAMES[now.getDay()]

  // Compute open/closed from the local clock instead of the server's `open_now`
  // (which used the server timezone, e.g. UTC, and mis-reported the status).
  const nowHM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const today = status?.today
  const open = (() => {
    if (!status?.configured) return null
    if (!today?.is_open || !today.open_time || !today.close_time) return false
    const { open_time: o, close_time: c } = today
    if (o === c) return true // same time = open 24h
    if (c > o) return nowHM >= o && nowHM < c
    return nowHM >= o || nowHM < c // overnight schedule, e.g. 18:00–02:00
  })()

  return (
    <div className="card mt-6 p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-brand-navy">
            <Clock size={18} className="text-brand-green" /> Opening hours
          </h2>
          <p className="text-sm text-slate-500">Set your regular weekly hours; use "Today" for a one-day change.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Live local clock */}
          <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
            <Clock size={14} className="text-brand-blue" />
            <span className="tabular-nums">
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          {status?.configured && (
            <span className={`rounded-full px-3 py-1 text-sm font-bold ${open ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {open ? 'Open now' : 'Closed now'}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* Weekly schedule */}
          <div>
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-400">Weekly schedule</h3>
            <div className="space-y-1.5">
              {week.map((h) => (
                <div key={h.weekday} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                  <label className="flex w-32 items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={h.is_open}
                      onChange={(e) => setDay(h.weekday, { is_open: e.target.checked })}
                      className="h-4 w-4 accent-brand-blue"
                    />
                    {DAY_NAMES[h.weekday]}
                  </label>
                  {h.is_open ? (
                    <div className="flex items-center gap-2 text-sm">
                      <input type="time" value={h.open_time} onChange={(e) => setDay(h.weekday, { open_time: e.target.value })} className="rounded-lg border border-slate-300 px-2 py-1.5 focus:border-brand-blue focus:outline-none" />
                      <span className="text-slate-400">to</span>
                      <input type="time" value={h.close_time} onChange={(e) => setDay(h.weekday, { close_time: e.target.value })} className="rounded-lg border border-slate-300 px-2 py-1.5 focus:border-brand-blue focus:outline-none" />
                    </div>
                  ) : (
                    <span className="text-sm font-medium text-slate-400">Closed</span>
                  )}
                </div>
              ))}
            </div>
            <button onClick={saveWeek} disabled={busy} className="btn-blue mt-3 py-2 text-sm">
              {busy ? 'Saving…' : 'Save weekly hours'}
            </button>
          </div>

          {/* Today only */}
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-slate-400">
              <CalendarClock size={14} /> Today ({todayName}) only
            </h3>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              {override && (
                <p className="mb-3 rounded-lg bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-800">
                  A special schedule is active for today. Tomorrow returns to the weekly hours automatically.
                </p>
              )}

              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input type="radio" name="todayMode" checked={mode === 'special'} onChange={() => setMode('special')} className="accent-brand-blue" />
                Special hours today
              </label>
              {mode === 'special' && (
                <div className="mt-2 flex items-center gap-2 pl-6 text-sm">
                  <input type="time" value={tFrom} onChange={(e) => setTFrom(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 focus:border-brand-blue focus:outline-none" />
                  <span className="text-slate-400">to</span>
                  <input type="time" value={tTo} onChange={(e) => setTTo(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 focus:border-brand-blue focus:outline-none" />
                </div>
              )}

              <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input type="radio" name="todayMode" checked={mode === 'closed'} onChange={() => setMode('closed')} className="accent-brand-blue" />
                Closed today
              </label>

              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={applyToday} disabled={busy} className="btn-green py-2 text-sm">
                  Apply to today
                </button>
                {override && (
                  <button onClick={removeOverride} disabled={busy} className="btn-ghost py-2 text-sm">
                    <RotateCcw size={14} /> Use weekly hours
                  </button>
                )}
              </div>
              <p className="mt-3 text-xs text-slate-400">
                This changes today's status only — all other days keep the saved weekly schedule.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
