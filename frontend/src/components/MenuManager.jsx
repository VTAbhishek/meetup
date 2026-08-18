import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, X, ImagePlus, UtensilsCrossed, Trash2, List, Filter, Pencil, Search } from 'lucide-react'
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
 * by one (name, category, price, optional photo), and can edit any of them
 * afterwards — a misspelled dish or a price change shouldn't mean deleting and
 * re-adding. Each item has an availability switch — turn it off when it's not
 * available and customers stop seeing it in their pre-order menu, without
 * deleting it.
 */
export default function MenuManager() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)  // the item open in the edit form
  const [busyId, setBusyId] = useState(null)
  const [filter, setFilter] = useState('all') // 'all' | category name
  const [searchQuery, setSearchQuery] = useState('')

  const [allCategories, setAllCategories] = useState([])

  useEffect(() => {
    api.myMenu().then((d) => setItems(d.items)).catch(() => {}).finally(() => setLoading(false))
    api.menuCategories()
      .then((d) => setAllCategories(d.categories.map((c) => c.name).sort((a, b) => a.localeCompare(b))))
      .catch(() => {})
  }, [])

  // Existing category names, for the datalist suggestions in the add form.
  const categories = useMemo(
    () => [...new Set(items.map((i) => i.category))].sort((a, b) => a.localeCompare(b)),
    [items]
  )

  // Group items by category for display, honoring the category filter and search query.
  const grouped = useMemo(() => {
    const g = {}
    const query = searchQuery.trim().toLowerCase()
    for (const it of items) {
      if (filter !== 'all' && it.category !== filter) continue
      if (query && !it.name?.toLowerCase().includes(query) && !it.category?.toLowerCase().includes(query)) continue
      (g[it.category] ||= []).push(it)
    }
    return g
  }, [items, filter, searchQuery])

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
            Add your dishes one by one, and use the pencil to edit a name, price, category or photo later. Turn
            an item's switch off when it's unavailable — customers won't see it in their pre-order menu until
            you turn it back on.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-48">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-400">
              <Search size={14} />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items..."
              className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-7 text-xs font-semibold text-slate-700 placeholder-slate-400 focus:border-brand-blue focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 flex items-center pr-2 text-slate-400 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            )}
          </div>
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
      ) : Object.keys(grouped).length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          No matching menu items found.
        </p>
      ) : (
        /* Two columns of category blocks on a wide screen.
           CSS columns rather than a grid: categories hold wildly different
           numbers of dishes, and a grid would leave a hole under every short
           one to keep its row aligned. Columns pack each block against the
           last, so both halves of the card stay full.

           The columns live on an inner div, never on the scrolling element
           itself: a multi-column box with a capped height spills into extra
           columns to the *right*, which would turn this into a sideways
           scroller. With the height cap outside, the columns balance to the
           content and the card scrolls down as before. */
        <div className="card-scroll">
          <div className="sm:columns-2 sm:gap-5">
            {Object.entries(grouped).map(([cat, list]) => (
              <div key={cat} className="mb-5 break-inside-avoid">
                <h3 className="mb-2 py-1 text-xs font-bold uppercase tracking-wide text-slate-400">{cat}</h3>
                {/* One dish per row — the two columns come from the layout above */}
                <ul className="space-y-2">
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
                        onClick={() => setEditing(it)}
                        title="Edit item"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-brand-silver hover:text-brand-blue"
                      >
                        <Pencil size={16} />
                      </button>
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
        </div>
      )}

      {adding && (
        <ItemModal
          categories={allCategories}
          onClose={() => setAdding(false)}
          onSaved={(list) => { setItems(list); setAdding(false) }}
        />
      )}

      {editing && (
        <ItemModal
          item={editing}
          categories={allCategories}
          onClose={() => setEditing(null)}
          onSaved={(list) => { setItems(list); setEditing(null) }}
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

/**
 * Add or edit one menu item.
 *
 * The same form serves both: pass `item` to edit it, leave it out to add. They
 * ask for exactly the same fields, and keeping one component means an edit can
 * never drift out of step with what adding allows.
 */
function ItemModal({ item, categories, onClose, onSaved }) {
  const editing = Boolean(item)

  const [name, setName] = useState(item?.name ?? '')
  const [category, setCategory] = useState(item?.category ?? '')
  const [price, setPrice] = useState(item ? String(item.price) : '')
  const [file, setFile] = useState(null)       // cropped File ready to upload
  const [preview, setPreview] = useState(item?.image_url ?? null)
  const [dropImage, setDropImage] = useState(false) // clear the existing photo
  const [toCrop, setToCrop] = useState(null)    // File waiting in the crop modal
  const [busy, setBusy] = useState(false)
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
    setDropImage(false)
    setToCrop(null)
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result)
    reader.readAsDataURL(cropped)
  }

  /** Take the photo off the item — a new one can still be chosen after this. */
  const clearPhoto = () => {
    setFile(null)
    setPreview(null)
    setDropImage(true)
  }

  const save = async (e) => {
    e.preventDefault()
    if (!name.trim()) return alertErr('Please enter the item name.')
    if (!category) return alertErr('Please select a category.')
    if (price === '' || Number(price) < 0) return alertErr('Please enter a valid price.')
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('name', name.trim())
      fd.append('category', category.trim())
      fd.append('price', String(Number(price)))
      if (file) fd.append('image', file)
      // Only meaningful on an edit, and only when no replacement was chosen.
      else if (editing && dropImage) fd.append('remove_image', '1')

      const d = editing ? await api.updateMenuItem(item.id, fd) : await api.addMenuItem(fd)
      toastOk(editing ? 'Item updated' : 'Item added')
      onSaved(d.items)
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
          className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-cardHover"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-extrabold text-brand-navy">{editing ? 'Edit menu item' : 'Add menu item'}</h3>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Item name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="e.g. Cheese Kottu" required />
          </label>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Category</span>
              <select
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              >
                <option value="" disabled>Select a category</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Price (Rs)</span>
              <input className="input" type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" required />
            </label>
          </div>

          <div className="mt-4">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Photo <span className="font-normal text-slate-400">(optional)</span></span>
            <div className="relative">
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
                    <span className="text-xs font-medium">
                      Upload &amp; crop a square photo
                    </span>
                  </>
                )}
              </button>
              {preview && (
                <button
                  type="button"
                  onClick={clearPhoto}
                  title="Remove the photo"
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75"
                >
                  <X size={15} />
                </button>
              )}
            </div>
            {preview && (
              <p className="mt-1.5 text-xs text-slate-400">Click the photo to replace it.</p>
            )}
            <input ref={ref} type="file" accept="image/*" className="hidden" onChange={pick} />
          </div>

          <button type="submit" disabled={busy} className="btn-blue mt-5 w-full py-2.5">
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Add item'}
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
