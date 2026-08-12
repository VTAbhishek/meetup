import { useEffect, useState } from 'react'
import { Plus, Trash2, Pencil, Sparkles, X, Check, ArrowUp, ArrowDown } from 'lucide-react'
import { api } from '../../api'
import { confirmDelete, toastOk, alertErr } from '../../alerts'
import { MoodIcon, MOOD_ICON_NAMES } from '../../lib/moodIcons'
import Spinner from '../../components/Spinner'

const BLANK = { name: '', hint: '', icon: 'Sparkles' }

/**
 * The mood vocabulary, managed by an admin.
 *
 * Companies tick these on their dashboard and customers filter by them, so the
 * list has to stay curated: adding one here is what makes it appear in both
 * places. Order matters — it is the order the chips are shown in.
 */
export default function Moods() {
  const [moods, setMoods] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(BLANK)
  const [editing, setEditing] = useState(null)   // mood id, or null while adding
  const [busy, setBusy] = useState(false)

  const load = () => api.adminMoods().then((d) => setMoods(d.moods)).catch(alertErr)

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const startEdit = (m) => {
    setEditing(m.id)
    setForm({ name: m.name, hint: m.hint || '', icon: m.icon || 'Sparkles' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelEdit = () => {
    setEditing(null)
    setForm(BLANK)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setBusy(true)
    try {
      if (editing) {
        const current = moods.find((m) => m.id === editing)
        await api.updateMood(editing, { ...form, sort_order: current?.sort_order ?? 0 })
        toastOk('Mood updated')
      } else {
        await api.createMood(form)
        toastOk('Mood added')
      }
      cancelEdit()
      await load()
    } catch (err) {
      alertErr(err)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (m) => {
    const used = m.company_count > 0
    const ok = await confirmDelete({
      title: `Delete "${m.name}"?`,
      text: used
        ? `${m.company_count} ${m.company_count === 1 ? 'company has' : 'companies have'} ticked this mood — it will be removed from them and from the customer filter.`
        : 'It will disappear from the customer filter and the business dashboard.',
    })
    if (!ok) return
    try {
      await api.deleteMood(m.id)
      if (editing === m.id) cancelEdit()
      await load()
      toastOk('Mood deleted')
    } catch (err) {
      alertErr(err)
    }
  }

  /** Swap sort_order with the neighbour so admins never type order numbers. */
  const move = async (index, delta) => {
    const a = moods[index]
    const b = moods[index + delta]
    if (!a || !b) return
    setBusy(true)
    try {
      await api.updateMood(a.id, { name: a.name, hint: a.hint || '', icon: a.icon || '', sort_order: b.sort_order })
      await api.updateMood(b.id, { name: b.name, hint: b.hint || '', icon: b.icon || '', sort_order: a.sort_order })
      await load()
    } catch (err) {
      alertErr(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0">
        <h1 className="text-2xl font-extrabold text-brand-navy">Moods</h1>
        <p className="text-sm text-slate-500">
          The tags companies tick on their dashboard and customers filter by. Anything you add here shows up in
          both places straight away.
        </p>
      </div>

      {/* Add / edit form */}
      <form onSubmit={submit} className="card mt-6 shrink-0 space-y-4 p-5">
        <div className="flex items-center gap-2">
          <Sparkles size={17} className="text-brand-green" />
          <h2 className="font-extrabold text-brand-navy">{editing ? 'Edit mood' : 'Add a mood'}</h2>
          {editing && (
            <button type="button" onClick={cancelEdit} className="ml-auto flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-700">
              <X size={15} /> Cancel
            </button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Name</span>
            <input
              value={form.name}
              onChange={set('name')}
              maxLength={80}
              placeholder="e.g. Rainy day indoors"
              className="input"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">
              Hint <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <input
              value={form.hint}
              onChange={set('hint')}
              maxLength={160}
              placeholder="One line explaining when it fits"
              className="input"
            />
          </label>
        </div>

        {/* Icon picker */}
        <div>
          <span className="mb-1 block text-sm font-semibold text-slate-700">Icon</span>
          <div className="no-scrollbar flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2.5">
            {MOOD_ICON_NAMES.map((name) => (
              <button
                key={name}
                type="button"
                title={name}
                aria-label={name}
                aria-pressed={form.icon === name}
                onClick={() => setForm((f) => ({ ...f, icon: name }))}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                  form.icon === name
                    ? 'border-brand-green bg-brand-green text-white'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-brand-navy'
                }`}
              >
                <MoodIcon icon={name} size={17} />
              </button>
            ))}
          </div>
        </div>

        {/* Live preview of the chip a company will see */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 px-3 py-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-brand-green bg-brand-green text-white">
              <Check size={13} strokeWidth={3} />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-brand-navy">
                <MoodIcon icon={form.icon} size={15} className="text-brand-green" />
                {form.name.trim() || 'Preview'}
              </span>
              {form.hint.trim() && <span className="mt-0.5 block text-xs text-slate-500">{form.hint}</span>}
            </span>
          </div>
          <button type="submit" disabled={busy || !form.name.trim()} className="btn-blue shrink-0 disabled:opacity-50">
            {editing ? <Check size={18} /> : <Plus size={18} />}
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Add mood'}
          </button>
        </div>
      </form>

      {/* List */}
      {loading ? (
        <Spinner />
      ) : (
        <div className="mt-6 grid min-h-0 flex-1 auto-rows-min content-start gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
          {moods.map((m, i) => (
            <div
              key={m.id}
              className={`card flex items-start gap-3 p-4 ${editing === m.id ? 'ring-2 ring-brand-green' : ''}`}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-silver text-brand-green">
                <MoodIcon icon={m.icon} size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-brand-navy">{m.name}</p>
                {m.hint && <p className="line-clamp-2 text-xs text-slate-500">{m.hint}</p>}
                <p className="mt-1 text-xs font-semibold text-slate-400">
                  {m.company_count} {m.company_count === 1 ? 'company' : 'companies'}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <div className="flex gap-1">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0 || busy}
                    className="rounded-lg border border-slate-300 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
                    title="Move up"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === moods.length - 1 || busy}
                    className="rounded-lg border border-slate-300 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
                    title="Move down"
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => startEdit(m)}
                    className="rounded-lg border border-slate-300 p-1.5 text-brand-blue hover:bg-slate-50"
                    title="Edit mood"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => remove(m)}
                    className="rounded-lg border border-slate-300 p-1.5 text-red-600 hover:bg-red-50"
                    title="Delete mood"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {moods.length === 0 && (
            <p className="text-sm text-slate-500">No moods yet — add the first one above.</p>
          )}
        </div>
      )}
    </div>
  )
}
