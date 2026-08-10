import { useEffect, useRef, useState } from 'react'
import { Plus, X, ImagePlus, LayoutGrid } from 'lucide-react'
import { api } from '../api'
import { confirmDelete, toastOk, alertErr } from '../alerts'
import { compressImage } from '../lib/imageCompress'
import Spinner from './Spinner'

const MAX_CARDS = 10
const MAX_MB = 10

/**
 * Showcase-cards manager for the business dashboard.
 * Each card = card image (thumb) + topic + short intro, and an optional second
 * image that visitors see when they click the card on the public page.
 */
export default function ShowcaseCards() {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    api.myCards().then((d) => setCards(d.cards)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const remove = async (c) => {
    if (!(await confirmDelete({ title: `Delete "${c.title}"?`, text: 'This card will be removed from your public page.' }))) return
    try {
      const d = await api.deleteCard(c.id)
      setCards(d.cards)
      toastOk('Card deleted')
    } catch (err) {
      alertErr(err)
    }
  }

  return (
    <div className="card mt-6 p-6">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-brand-navy">
          <LayoutGrid size={18} className="text-brand-green" /> Showcase cards
        </h2>
        <p className="text-sm text-slate-500">
          Small cards shown on your public page (5 per row): a card image, a topic and a short introduction.
          Visitors who click a card see your second image full-screen. Up to {MAX_CARDS} cards.
        </p>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {cards.map((c) => (
            <div key={c.id} className="relative overflow-hidden rounded-xl border border-slate-200">
              <img src={c.thumb_url} alt={c.title} className="h-24 w-full object-cover" />
              <div className="p-2.5">
                <p className="truncate text-sm font-bold text-brand-navy">{c.title}</p>
                {c.intro && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{c.intro}</p>}
              </div>
              <button
                onClick={() => remove(c)}
                title="Delete card"
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white shadow hover:bg-red-700"
              >
                <X size={13} />
              </button>
            </div>
          ))}

          {/* + tile */}
          {cards.length < MAX_CARDS && (
            <button
              onClick={() => setAdding(true)}
              className="flex min-h-[150px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 transition hover:border-brand-blue hover:text-brand-blue"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-blueLight/15">
                <Plus size={22} />
              </span>
              <span className="text-sm font-semibold">Add card</span>
            </button>
          )}
        </div>
      )}

      {adding && (
        <AddCardModal
          onClose={() => setAdding(false)}
          onAdded={(list) => { setCards(list); setAdding(false) }}
        />
      )}
    </div>
  )
}

function AddCardModal({ onClose, onAdded }) {
  const [title, setTitle] = useState('')
  const [intro, setIntro] = useState('')
  const [thumb, setThumb] = useState(null)   // file for the card itself
  const [image, setImage] = useState(null)   // file shown when clicked
  const [busy, setBusy] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    if (!title.trim()) return alertErr('Please enter a topic for the card.')
    if (!thumb) return alertErr('Please choose the card image.')
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('title', title.trim())
      fd.append('intro', intro.trim())
      fd.append('thumb', thumb)
      if (image) fd.append('image', image)
      const d = await api.addCard(fd)
      toastOk('Card added')
      onAdded(d.cards)
    } catch (err) {
      alertErr(err)
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-cardHover"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-brand-navy">Add showcase card</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Topic</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="e.g. Fast loans" required />
        </label>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Small introduction <span className="font-normal text-slate-400">(optional)</span></span>
          <textarea className="input" rows={2} value={intro} onChange={(e) => setIntro(e.target.value)} maxLength={300} placeholder="One or two short sentences…" />
        </label>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ImagePick label="Card image" hint="shown on the card" file={thumb} onFile={setThumb} required />
          <ImagePick label="Click image" hint="shown when the card is clicked" file={image} onFile={setImage} />
        </div>

        <button type="submit" disabled={busy} className="btn-blue mt-5 w-full py-2.5">
          {busy ? 'Adding…' : 'Add card'}
        </button>
      </form>
    </div>
  )
}

function ImagePick({ label, hint, file, onFile, required = false }) {
  const ref = useRef(null)
  const [preview, setPreview] = useState(null)

  const pick = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) return alertErr('Please choose an image file.')
    // Auto-shrink the file size (not the visible quality) before uploading.
    const small = await compressImage(f, { maxDim: 2000 })
    if (small.size > MAX_MB * 1024 * 1024) return alertErr(`Image must be ${MAX_MB} MB or smaller.`)
    onFile(small)
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result)
    reader.readAsDataURL(small)
  }

  return (
    <div>
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </span>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="flex h-28 w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 border-dashed border-slate-300 text-slate-400 transition hover:border-brand-blue hover:text-brand-blue"
      >
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <>
            <ImagePlus size={20} />
            <span className="px-2 text-center text-xs font-medium">{hint}</span>
          </>
        )}
      </button>
      {file && <p className="mt-1 truncate text-xs text-slate-400">{file.name}</p>}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={pick} />
    </div>
  )
}
