import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, X, ImagePlus, Armchair, Trash2, List, Filter, Users } from 'lucide-react'
import { api } from '../api'
import { confirmDelete, toastOk, alertErr } from '../alerts'
import { compressImage } from '../lib/imageCompress'
import Spinner from './Spinner'
import CoverCropper from './CoverCropper'

const MAX_MB = 10

/** Starting suggestions for a company that hasn't created any categories yet. */
const SUGGESTED = ['VIP', 'Family', 'Couple']

/**
 * Table manager for the business dashboard. The company groups its tables into
 * categories (VIP / Family / Couple / …), each table having a number, seat
 * count, optional note and photo. Each table has an on/off switch — turn it off
 * (e.g. under repair) and customers stop seeing it in the reservation picker,
 * without deleting it or losing its booking history.
 */
export default function TableManager() {
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    api.myTables().then((d) => setTables(d.tables)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const categories = useMemo(
    () => [...new Set(tables.map((t) => t.category))].sort((a, b) => a.localeCompare(b)),
    [tables]
  )

  const grouped = useMemo(() => {
    const g = {}
    for (const t of tables) {
      if (filter !== 'all' && t.category !== filter) continue
      (g[t.category] ||= []).push(t)
    }
    return g
  }, [tables, filter])

  const toggle = async (t) => {
    setBusyId(t.id)
    try {
      const d = await api.updateTable(t.id, { is_active: !t.is_active })
      setTables(d.tables)
    } catch (err) {
      alertErr(err)
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (t) => {
    if (!(await confirmDelete({
      title: `Delete table ${t.table_no}?`,
      text: 'Customers will no longer be able to book it. Past reservations keep their record of this table.',
    }))) return
    try {
      const d = await api.deleteTable(t.id)
      setTables(d.tables)
      toastOk('Table deleted')
    } catch (err) {
      alertErr(err)
    }
  }

  return (
    <div className="card mt-6 p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-brand-navy">
            <Armchair size={18} className="text-brand-green" /> Tables
          </h2>
          <p className="text-sm text-slate-500">
            Group your tables by category (VIP, Family, Couple…). Customers pick a category and then a table
            when they reserve. Turn a table's switch off to hide it without deleting it.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {categories.length > 0 && (
            <label className="flex items-center gap-1.5 text-sm">
              <Filter size={15} className="text-slate-400" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 focus:border-brand-blue focus:outline-none"
              >
                <option value="all">All categories ({tables.length})</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c} ({tables.filter((t) => t.category === c).length})
                  </option>
                ))}
              </select>
            </label>
          )}
          <button onClick={() => setAdding(true)} className="btn-blue py-2 text-sm">
            <Plus size={16} /> Add table
          </button>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : tables.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          No tables yet. Click <span className="font-semibold text-slate-500">Add table</span> to let customers
          reserve a specific table.
        </p>
      ) : (
        <div className="max-h-[460px] space-y-6 overflow-y-auto pr-1.5">
          {Object.entries(grouped).map(([cat, list]) => (
            <div key={cat}>
              <h3 className="sticky top-0 z-10 mb-2 bg-white py-1 text-xs font-bold uppercase tracking-wide text-slate-400">
                {cat}
              </h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {list.map((t) => (
                  <li
                    key={t.id}
                    className={`flex items-center gap-3 rounded-xl border p-2.5 transition ${
                      t.is_active ? 'border-slate-200' : 'border-slate-200 bg-slate-50 opacity-70'
                    }`}
                  >
                    {t.image_url ? (
                      <img src={t.image_url} alt={t.table_no} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-brand-silver text-slate-300">
                        <Armchair size={20} />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-brand-navy">Table {t.table_no}</p>
                      <p className="flex items-center gap-1 text-sm text-slate-500">
                        <Users size={13} className="text-slate-400" /> {t.seats} {t.seats === 1 ? 'seat' : 'seats'}
                      </p>
                      {t.note && <p className="truncate text-xs text-slate-400">{t.note}</p>}
                    </div>
                    <Switch on={t.is_active} busy={busyId === t.id} onClick={() => toggle(t)} />
                    <button
                      onClick={() => remove(t)}
                      title="Delete table"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <AddTableModal
          categories={categories}
          onClose={() => setAdding(false)}
          onAdded={(list) => { setTables(list); setAdding(false) }}
        />
      )}
    </div>
  )
}

/** Small on/off toggle with a "Bookable / Off" label. */
function Switch({ on, busy, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={on ? 'Bookable — click to hide from customers' : 'Hidden — click to make bookable'}
      className="flex shrink-0 items-center gap-2 disabled:opacity-50"
    >
      <span className="hidden text-xs font-semibold sm:inline" style={{ color: on ? '#16a34a' : '#94a3b8' }}>
        {on ? 'Bookable' : 'Off'}
      </span>
      <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${on ? 'bg-green-500' : 'bg-slate-300'}`}>
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </span>
    </button>
  )
}

function AddTableModal({ categories, onClose, onAdded }) {
  const [category, setCategory] = useState('')
  const [tableNo, setTableNo] = useState('')
  const [seats, setSeats] = useState('2')
  const [note, setNote] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [toCrop, setToCrop] = useState(null)
  const [busy, setBusy] = useState(false)
  // Start in free-text mode when there's nothing to pick from yet.
  const [newCat, setNewCat] = useState(categories.length === 0)
  const ref = useRef(null)

  const pick = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) return alertErr('Please choose an image file.')
    const small = await compressImage(f, { maxDim: 1600 })
    if (small.size > MAX_MB * 1024 * 1024) return alertErr(`Image must be ${MAX_MB} MB or smaller.`)
    setToCrop(small)
  }

  const onCropped = (cropped) => {
    setFile(cropped)
    setToCrop(null)
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result)
    reader.readAsDataURL(cropped)
  }

  const save = async (e) => {
    e.preventDefault()
    if (!category.trim()) return alertErr('Please choose or enter a category (e.g. VIP, Family, Couple).')
    if (!tableNo.trim()) return alertErr('Please enter the table number.')
    if (Number(seats) < 1) return alertErr('A table needs at least 1 seat.')
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('category', category.trim())
      fd.append('table_no', tableNo.trim())
      fd.append('seats', String(Number(seats)))
      fd.append('note', note.trim())
      if (file) fd.append('image', file)
      const d = await api.addTable(fd)
      toastOk('Table added')
      onAdded(d.tables)
    } catch (err) {
      alertErr(err)
      setBusy(false)
    }
  }

  // Offer the standard categories alongside any the company already made.
  const options = [...new Set([...categories, ...SUGGESTED])]

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
        <form
          onSubmit={save}
          onClick={(e) => e.stopPropagation()}
          className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-cardHover"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-extrabold text-brand-navy">Add table</h3>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
          </div>

          <div className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Category</span>
            {newCat ? (
              <div className="flex gap-1.5">
                <input
                  className="input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  maxLength={60}
                  placeholder="e.g. VIP, Family, Couple"
                  autoFocus
                />
                {options.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { setNewCat(false); setCategory('') }}
                    title="Pick from existing categories"
                    className="flex shrink-0 items-center justify-center rounded-xl border border-slate-300 px-2.5 text-slate-500 hover:bg-slate-50"
                  >
                    <List size={16} />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex gap-1.5">
                <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="" disabled>Select a category</option>
                  {options.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => { setNewCat(true); setCategory('') }}
                  title="Add a new category"
                  className="flex shrink-0 items-center justify-center rounded-xl border border-brand-blue px-2.5 font-bold text-brand-blue hover:bg-brand-blue hover:text-white"
                >
                  <Plus size={18} />
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Table number</span>
              <input
                className="input"
                value={tableNo}
                onChange={(e) => setTableNo(e.target.value)}
                maxLength={30}
                placeholder="e.g. T-12"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Seats</span>
              <input
                className="input"
                type="number"
                min="1"
                max="99"
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
                required
              />
            </label>
          </div>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">
              Note <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="e.g. Window side, 2nd floor"
            />
          </label>

          <div className="mt-4">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">
              Photo <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <button
              type="button"
              onClick={() => ref.current?.click()}
              className="flex h-32 w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 border-dashed border-slate-300 text-slate-400 transition hover:border-brand-blue hover:text-brand-blue"
            >
              {preview ? (
                <img src={preview} alt="" className="h-full w-full object-cover" />
              ) : (
                <>
                  <ImagePlus size={22} />
                  <span className="text-xs font-medium">Upload &amp; crop a photo of the table</span>
                </>
              )}
            </button>
            <input ref={ref} type="file" accept="image/*" className="hidden" onChange={pick} />
          </div>

          <button type="submit" disabled={busy} className="btn-blue mt-5 w-full py-2.5">
            {busy ? 'Adding…' : 'Add table'}
          </button>
        </form>
      </div>

      {toCrop && (
        <CoverCropper
          file={toCrop}
          aspect={4 / 3}
          outputW={900}
          title="Crop the table photo"
          hint="Drag to reposition and zoom. Customers see this photo when they pick the table."
          onCancel={() => setToCrop(null)}
          onDone={onCropped}
        />
      )}
    </>
  )
}
