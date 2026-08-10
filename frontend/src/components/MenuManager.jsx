import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, X, ImagePlus, UtensilsCrossed, Trash2, List, Filter } from 'lucide-react'
import { api } from '../api'
import { confirmDelete, toastOk, alertErr } from '../alerts'
import { compressImage } from '../lib/imageCompress'
import Spinner from './Spinner'
import CoverCropper from './CoverCropper'

const MAX_MB = 10

/** Sri Lankan rupee formatting for prices. */
const money = (n) => 'Rs ' + Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 0 })

/**
 * Menu manager for the business dashboard. The company adds food/drink items one
 * by one (name, category, price, optional photo). Each item has an availability
 * switch — turn it off when it's not available and customers stop seeing it in
 * their pre-order menu, without deleting it.
 */
export default function MenuManager() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [filter, setFilter] = useState('all') // 'all' | category name

  useEffect(() => {
    api.myMenu().then((d) => setItems(d.items)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  // Existing category names, for the datalist suggestions in the add form.
  const categories = useMemo(
    () => [...new Set(items.map((i) => i.category))].sort((a, b) => a.localeCompare(b)),
    [items]
  )

  // Group items by category for display, honoring the category filter.
  const grouped = useMemo(() => {
    const g = {}
    for (const it of items) {
      if (filter !== 'all' && it.category !== filter) continue
      (g[it.category] ||= []).push(it)
    }
    return g
  }, [items, filter])

  const toggle = async (it) => {
    setBusyId(it.id)
    try {
      const d = await api.updateMenuItem(it.id, { is_available: !it.is_available })
      setItems(d.items)
    } catch (err) {
      alertErr(err)
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (it) => {
    if (!(await confirmDelete({ title: `Delete "${it.name}"?`, text: 'This item will be removed from your menu.' }))) return
    try {
      const d = await api.deleteMenuItem(it.id)
      setItems(d.items)
      toastOk('Item deleted')
    } catch (err) {
      alertErr(err)
    }
  }

  return (
    <div className="card mt-6 p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-brand-navy">
            <UtensilsCrossed size={18} className="text-brand-green" /> Menu
          </h2>
          <p className="text-sm text-slate-500">
            Add your dishes one by one. Turn an item's switch off when it's unavailable — customers won't see it
            in their pre-order menu until you turn it back on.
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
                <option value="all">All categories ({items.length})</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c} ({items.filter((i) => i.category === c).length})
                  </option>
                ))}
              </select>
            </label>
          )}
          <button onClick={() => setAdding(true)} className="btn-blue py-2 text-sm">
            <Plus size={16} /> Add item
          </button>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          No menu items yet. Click <span className="font-semibold text-slate-500">Add item</span> to build your menu.
        </p>
      ) : (
        // Fixed-height, internally scrollable so a long menu never stretches the page.
        <div className="max-h-[460px] space-y-6 overflow-y-auto pr-1.5">
          {Object.entries(grouped).map(([cat, list]) => (
            <div key={cat}>
              <h3 className="sticky top-0 z-10 mb-2 bg-white py-1 text-xs font-bold uppercase tracking-wide text-slate-400">{cat}</h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {list.map((it) => (
                  <li
                    key={it.id}
                    className={`flex items-center gap-3 rounded-xl border p-2.5 transition ${
                      it.is_available ? 'border-slate-200' : 'border-slate-200 bg-slate-50 opacity-70'
                    }`}
                  >
                    {it.image_url ? (
                      <img src={it.image_url} alt={it.name} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-brand-silver text-slate-300">
                        <UtensilsCrossed size={20} />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-brand-navy">{it.name}</p>
                      <p className="text-sm font-bold text-brand-green">{money(it.price)}</p>
                    </div>
                    {/* Availability switch */}
                    <Switch on={it.is_available} busy={busyId === it.id} onClick={() => toggle(it)} />
                    <button
                      onClick={() => remove(it)}
                      title="Delete item"
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
        <AddItemModal
          categories={categories}
          onClose={() => setAdding(false)}
          onAdded={(list) => { setItems(list); setAdding(false) }}
        />
      )}
    </div>
  )
}

/** Small on/off toggle with an "Available / Off" label. */
function Switch({ on, busy, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={on ? 'Available — click to turn off' : 'Unavailable — click to turn on'}
      className="flex shrink-0 items-center gap-2 disabled:opacity-50"
    >
      <span className="hidden text-xs font-semibold sm:inline" style={{ color: on ? '#16a34a' : '#94a3b8' }}>
        {on ? 'Available' : 'Off'}
      </span>
      <span
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${on ? 'bg-green-500' : 'bg-slate-300'}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </span>
    </button>
  )
}

function AddItemModal({ categories, onClose, onAdded }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [price, setPrice] = useState('')
  const [file, setFile] = useState(null)       // cropped File ready to upload
  const [preview, setPreview] = useState(null)
  const [toCrop, setToCrop] = useState(null)    // File waiting in the crop modal
  const [busy, setBusy] = useState(false)
  // Category: pick from existing ones, or "+" to type a new category. Start in
  // "new" mode when the company has no categories yet (nothing to pick from).
  const [newCat, setNewCat] = useState(categories.length === 0)
  const ref = useRef(null)

  const pick = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) return alertErr('Please choose an image file.')
    const small = await compressImage(f, { maxDim: 1600 })
    if (small.size > MAX_MB * 1024 * 1024) return alertErr(`Image must be ${MAX_MB} MB or smaller.`)
    setToCrop(small) // open the square cropper
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
    if (!name.trim()) return alertErr('Please enter the item name.')
    if (!category.trim()) return alertErr('Please choose or enter a category (e.g. Kottu, Rice).')
    if (price === '' || Number(price) < 0) return alertErr('Please enter a valid price.')
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('name', name.trim())
      fd.append('category', category.trim())
      fd.append('price', String(Number(price)))
      if (file) fd.append('image', file)
      const d = await api.addMenuItem(fd)
      toastOk('Item added')
      onAdded(d.items)
    } catch (err) {
      alertErr(err)
      setBusy(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
        <form
          onSubmit={save}
          onClick={(e) => e.stopPropagation()}
          className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-cardHover"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-extrabold text-brand-navy">Add menu item</h3>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Item name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="e.g. Cheese Kottu" required />
          </label>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Category</span>
              {newCat ? (
                <div className="flex gap-1.5">
                  <input
                    className="input"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    maxLength={80}
                    placeholder="New category e.g. Kottu"
                    autoFocus
                  />
                  {categories.length > 0 && (
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
                  <select
                    className="input"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="" disabled>Select a category</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
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
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Price (Rs)</span>
              <input className="input" type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" required />
            </label>
          </div>

          <div className="mt-4">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Photo <span className="font-normal text-slate-400">(optional)</span></span>
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
                  <span className="text-xs font-medium">Upload &amp; crop a square photo</span>
                </>
              )}
            </button>
            <input ref={ref} type="file" accept="image/*" className="hidden" onChange={pick} />
          </div>

          <button type="submit" disabled={busy} className="btn-blue mt-5 w-full py-2.5">
            {busy ? 'Adding…' : 'Add item'}
          </button>
        </form>
      </div>

      {toCrop && (
        <CoverCropper
          file={toCrop}
          aspect={1}
          outputW={800}
          title="Crop the photo"
          hint="Drag to reposition and zoom. The photo is cropped to a square so all menu items look consistent."
          onCancel={() => setToCrop(null)}
          onDone={onCropped}
        />
      )}
    </>
  )
}
