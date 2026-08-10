import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CalendarClock, ArrowLeft, Users, Phone, User, ClipboardList, Check, UtensilsCrossed, Plus, Minus, ShoppingCart, Trash2, X } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { toastOk, alertErr } from '../alerts'
import Spinner from '../components/Spinner'

const money = (n) => 'Rs ' + Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 0 })

/**
 * Reservation / booking form. A logged-in customer picks a date, time range,
 * party size and leaves their contact details, and can optionally pre-order food
 * from the company's menu (browse by category, add to cart with quantities). The
 * company then confirms, keeps pending, replies or declines from its dashboard.
 */
export default function ReserveBooking() {
  const { slug } = useParams()
  const { user } = useAuth()

  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [errors, setErrors] = useState({})

  // ---- Menu + cart ----
  const [menu, setMenu] = useState({ categories: [], items: [] })
  const [cat, setCat] = useState('all')
  const [cart, setCart] = useState({}) // { [itemId]: qty }
  const [detail, setDetail] = useState(null) // menu item shown in the detail card

  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    name: user?.full_name || '',
    mobile: '',
    res_date: today,
    time_from: '10:00',
    time_to: '11:00',
    person_count: 1,
    description: '',
  })
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const [hotel, setHotel] = useState(false) // reveal the members-count field

  useEffect(() => {
    api
      .company(slug)
      .then((d) => setCompany(d.company))
      .catch(() => setCompany(null))
      .finally(() => setLoading(false))
    api.menu(slug).then(setMenu).catch(() => setMenu({ categories: [], items: [] }))
  }, [slug])

  const itemsById = useMemo(() => Object.fromEntries(menu.items.map((i) => [i.id, i])), [menu])
  const shownItems = useMemo(
    () => (cat === 'all' ? menu.items : menu.items.filter((i) => i.category === cat)),
    [menu, cat]
  )
  const cartLines = useMemo(
    () => Object.entries(cart).filter(([, q]) => q > 0).map(([id, q]) => ({ item: itemsById[id], qty: q })).filter((l) => l.item),
    [cart, itemsById]
  )
  const cartTotal = cartLines.reduce((s, l) => s + l.item.price * l.qty, 0)
  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0)

  const setQty = (id, q) => setCart((c) => ({ ...c, [id]: Math.max(0, Math.min(99, q)) }))
  const add = (id) => setQty(id, (cart[id] || 0) + 1)

  const submit = async (e) => {
    e.preventDefault()
    if (!company) return
    setErrors({})
    setBusy(true)
    try {
      const items = cartLines.map((l) => ({ menu_item_id: l.item.id, qty: l.qty }))
      await api.createReservation({ company_id: company.id, ...form, person_count: Number(form.person_count), items })
      toastOk('Reservation sent')
      setDone(true)
    } catch (err) {
      if (err?.status === 422 && err.data?.errors) setErrors(err.data.errors)
      else alertErr(err)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="container-page py-16"><Spinner /></div>
  if (!company) return <div className="container-page py-16 text-center text-slate-500">Company not found.</div>

  const backTo = `/review/${company.slug}`

  if (done) {
    return (
      <div className="container-page max-w-lg py-16 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
          <Check size={30} />
        </div>
        <h1 className="text-2xl font-extrabold text-brand-navy">Reservation sent!</h1>
        <p className="mt-2 text-slate-500">
          <span className="font-semibold">{company.company_name}</span> will review your booking
          {cartCount > 0 ? ' and pre-order' : ''} and reply.
          You'll get a notification (🔔) when they respond.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link to="/" className="btn-blue py-2.5 text-sm">Go to home page</Link>
          <Link to={backTo} className="btn-ghost py-2.5 text-sm">Back to company</Link>
        </div>
      </div>
    )
  }

  const hasMenu = menu.items.length > 0

  return (
    <div className="container-page max-w-5xl py-8">
      <Link to={backTo} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-blue">
        <ArrowLeft size={16} /> Back to {company.company_name}
      </Link>

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-5">
        {/* Left: reservation details */}
        <div className="lg:col-span-3">
          <div className="card p-6 sm:p-8">
            <h1 className="flex items-center gap-2 text-2xl font-extrabold text-brand-navy">
              <CalendarClock size={24} className="text-brand-green" /> Make a reservation
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Booking with <span className="font-semibold text-slate-700">{company.company_name}</span>
            </p>

            <div className="mt-6 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Your name" icon={User} error={errors.name}>
                  <input value={form.name} onChange={(e) => set('name', e.target.value)} className="input" placeholder="Full name" />
                </Field>
                <Field label="Mobile number" icon={Phone} error={errors.mobile}>
                  <input value={form.mobile} onChange={(e) => set('mobile', e.target.value)} className="input" placeholder="07XXXXXXXX" inputMode="tel" />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Date" icon={CalendarClock} error={errors.res_date}>
                  <input type="date" min={today} value={form.res_date} onChange={(e) => set('res_date', e.target.value)} className="input" />
                </Field>
                <div>
                  <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={hotel}
                      onChange={(e) => setHotel(e.target.checked)}
                      className="h-4 w-4 accent-brand-green"
                    />
                    <Users size={14} className="text-slate-400" /> Hotel
                  </label>
                  {hotel && (
                    <>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={form.person_count}
                        onChange={(e) => set('person_count', e.target.value)}
                        className="input"
                        placeholder="Members"
                      />
                      {errors.person_count && <span className="mt-1 block text-xs font-medium text-red-500">{errors.person_count}</span>}
                    </>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Time from" error={errors.time_from}>
                  <input type="time" value={form.time_from} onChange={(e) => set('time_from', e.target.value)} className="input" />
                </Field>
                <Field label="Time to" error={errors.time_to}>
                  <input type="time" value={form.time_to} onChange={(e) => set('time_to', e.target.value)} className="input" />
                </Field>
              </div>

              <Field label="Notes (optional)" icon={ClipboardList} error={errors.description}>
                <textarea
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  rows={3}
                  className="input resize-none"
                  placeholder="Anything the company should know…"
                />
              </Field>
            </div>
          </div>

          {/* Menu — browse by category, add to cart */}
          {hasMenu && (
            <div className="card mt-6 p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-lg font-extrabold text-brand-navy">
                  <UtensilsCrossed size={20} className="text-brand-green" /> Pre-order food
                  <span className="text-sm font-normal text-slate-400">(optional)</span>
                </h2>
                <label className="flex items-center gap-2 text-sm">
                  <span className="font-semibold text-slate-500">Category</span>
                  <select
                    value={cat}
                    onChange={(e) => setCat(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 focus:border-brand-blue focus:outline-none"
                  >
                    <option value="all">All items</option>
                    {menu.categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              </div>

              {/* Cap the list at ~5 rows tall; more items scroll inside the card. */}
              <div className="mt-4 grid max-h-[470px] gap-3 overflow-y-auto pr-1.5 sm:grid-cols-2">
                {shownItems.map((it) => {
                  const qty = cart[it.id] || 0
                  return (
                    <div
                      key={it.id}
                      onClick={() => setDetail(it)}
                      title="Click for details"
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-2.5 transition hover:border-brand-blue/60 hover:shadow-sm"
                    >
                      {it.image_url ? (
                        <img src={it.image_url} alt={it.name} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-brand-silver text-slate-300">
                          <UtensilsCrossed size={22} />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-brand-navy">{it.name}</p>
                        <p className="text-xs text-slate-400">{it.category}</p>
                        <p className="text-sm font-bold text-brand-green">{money(it.price)}</p>
                      </div>
                      {/* Cart controls — don't let clicks bubble up to open the detail card. */}
                      <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                        {qty === 0 ? (
                          <button type="button" onClick={() => add(it.id)} className="btn-ghost px-3 py-1.5 text-sm">
                            <Plus size={15} /> Add
                          </button>
                        ) : (
                          <Stepper qty={qty} onDec={() => setQty(it.id, qty - 1)} onInc={() => setQty(it.id, qty + 1)} />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: cart + submit (sticky on desktop) */}
        <div className="lg:col-span-2">
          <div className="card sticky top-24 p-6">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-brand-navy">
              <ShoppingCart size={18} className="text-brand-green" /> Your cart
              {cartCount > 0 && (
                <span className="rounded-full bg-brand-green px-2 py-0.5 text-xs font-bold text-white">{cartCount}</span>
              )}
            </h2>

            {cartLines.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">
                {hasMenu ? 'No food added yet. Pre-ordering is optional — you can still just book a table.' : 'This company has no menu to pre-order from. You can still book a table.'}
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {cartLines.map((l) => (
                  <li key={l.item.id} className="flex items-center gap-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-brand-navy">{l.item.name}</p>
                      <p className="text-xs text-slate-400">{money(l.item.price)} each</p>
                    </div>
                    <Stepper qty={l.qty} onDec={() => setQty(l.item.id, l.qty - 1)} onInc={() => setQty(l.item.id, l.qty + 1)} small />
                    <span className="w-20 shrink-0 text-right font-bold tabular-nums text-brand-navy">{money(l.item.price * l.qty)}</span>
                    <button type="button" onClick={() => setQty(l.item.id, 0)} title="Remove" className="text-slate-300 hover:text-red-500">
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {cartLines.length > 0 && (
              <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                <span className="font-semibold text-slate-600">Food total</span>
                <span className="text-lg font-extrabold text-brand-navy tabular-nums">{money(cartTotal)}</span>
              </div>
            )}

            <button type="submit" disabled={busy} className="btn-blue mt-5 w-full py-3 text-sm">
              {busy ? 'Sending…' : cartCount > 0 ? `Reserve table + pre-order (${cartCount})` : 'Send reservation'}
            </button>
            <p className="mt-2 text-center text-xs text-slate-400">
              You pay at the venue. Pre-ordering just lets the company prepare ahead.
            </p>
          </div>
        </div>
      </form>

      {detail && (
        <ItemDetailCard
          item={detail}
          qty={cart[detail.id] || 0}
          onClose={() => setDetail(null)}
          onAdd={() => add(detail.id)}
          onDec={() => setQty(detail.id, (cart[detail.id] || 0) - 1)}
          onInc={() => setQty(detail.id, (cart[detail.id] || 0) + 1)}
        />
      )}
    </div>
  )
}

/** Small pop-up card showing one dish's full details, with add-to-cart controls. */
function ItemDetailCard({ item, qty, onClose, onAdd, onDec, onInc }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-cardHover"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Photo (or placeholder), with a close button overlaid */}
        <div className="relative">
          {item.image_url ? (
            <img src={item.image_url} alt={item.name} className="h-52 w-full object-cover" />
          ) : (
            <div className="flex h-52 w-full items-center justify-center bg-brand-silver text-slate-300">
              <UtensilsCrossed size={48} />
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow hover:bg-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          <span className="inline-block rounded-full bg-brand-silver px-2.5 py-0.5 text-xs font-semibold text-brand-blue">
            {item.category}
          </span>
          <h3 className="mt-2 text-xl font-extrabold text-brand-navy">{item.name}</h3>
          <p className="mt-1 text-lg font-bold text-brand-green">{money(item.price)}</p>

          <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
            {qty === 0 ? (
              <button type="button" onClick={onAdd} className="btn-blue w-full py-2.5 text-sm">
                <Plus size={16} /> Add to cart
              </button>
            ) : (
              <>
                <span className="text-sm font-semibold text-slate-500">
                  In cart · <span className="text-brand-navy">{money(item.price * qty)}</span>
                </span>
                <Stepper qty={qty} onDec={onDec} onInc={onInc} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Stepper({ qty, onDec, onInc, small = false }) {
  const s = small ? 'h-7 w-7' : 'h-8 w-8'
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button type="button" onClick={onDec} className={`flex ${s} items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:bg-slate-50`}>
        <Minus size={14} />
      </button>
      <span className="w-6 text-center text-sm font-bold tabular-nums text-brand-navy">{qty}</span>
      <button type="button" onClick={onInc} className={`flex ${s} items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:bg-slate-50`}>
        <Plus size={14} />
      </button>
    </div>
  )
}

function Field({ label, icon: Icon, error, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
        {Icon && <Icon size={14} className="text-slate-400" />} {label}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs font-medium text-red-500">{error}</span>}
    </label>
  )
}
