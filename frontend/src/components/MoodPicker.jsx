import { useEffect, useState } from 'react'
import { Sparkles, Check, Save } from 'lucide-react'
import { api } from '../api'
import { toastOk, alertErr } from '../alerts'
import { MoodIcon } from '../lib/moodIcons'
import Spinner from './Spinner'

/**
 * Mood tags for the business dashboard, sitting with the location settings.
 *
 * The company ticks every mood its venue suits — a place can be both a family
 * outing and a late night spot. Customers filter on these after choosing a
 * district and city, so an untagged venue simply never appears under a mood.
 */
export default function MoodPicker({ onSaved }) {
  const [moods, setMoods] = useState([])
  const [selected, setSelected] = useState([])   // mood ids, the working copy
  const [saved, setSaved] = useState([])         // what the server currently holds
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api
      .myMoods()
      .then((d) => {
        setMoods(d.moods)
        setSelected(d.selected)
        setSaved(d.selected)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggle = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  // Compare as sets — tick order must not count as a change.
  const dirty =
    selected.length !== saved.length || selected.some((id) => !saved.includes(id))

  const save = async () => {
    setBusy(true)
    try {
      const d = await api.saveMyMoods(selected)
      setMoods(d.moods)
      setSelected(d.selected)
      setSaved(d.selected)
      toastOk('Moods saved')
      onSaved?.(d.selected)
    } catch (err) {
      alertErr(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card mt-6 p-6">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-brand-navy">
          <Sparkles size={18} className="text-brand-green" /> What is your place good for?
        </h2>
        <p className="text-sm text-slate-500">
          Tick every mood that fits. Customers pick a district and city, then filter by mood — so these tags
          are how they find you. Places with the best ratings show first.
        </p>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <>
          {/* Scrolls once an admin has added enough moods to outgrow the card */}
          <div className="card-scroll grid gap-2.5 sm:grid-cols-2">
            {moods.map((m) => {
              const on = selected.includes(m.id)
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m.id)}
                  aria-pressed={on}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                    on
                      ? 'border-brand-green bg-brand-green/5 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                      on ? 'border-brand-green bg-brand-green text-white' : 'border-slate-300 bg-white'
                    }`}
                  >
                    {on && <Check size={13} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 font-semibold text-brand-navy">
                      <MoodIcon icon={m.icon} size={15} className="text-brand-green" />
                      {m.name}
                    </span>
                    {m.hint && <span className="mt-0.5 block text-xs text-slate-500">{m.hint}</span>}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              {selected.length === 0
                ? "None ticked — you won't show up under any mood filter."
                : `${selected.length} mood${selected.length === 1 ? '' : 's'} ticked`}
            </p>
            <button onClick={save} disabled={busy || !dirty} className="btn-blue py-2 text-sm disabled:opacity-50">
              <Save size={15} /> {busy ? 'Saving…' : dirty ? 'Save moods' : 'Saved'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
