import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  UtensilsCrossed, Plus, Minus, ShoppingBag, X, Armchair, Check, ChefHat,
  BellRing, MapPin, Phone, ArrowLeft, Search, Sparkles, Soup,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { alertErr } from '../alerts'

const money = (n) => 'Rs ' + Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 0 })

/** How often the placed-order screen re-checks the kitchen's progress. */
const STATUS_POLL_MS = 8000

/** Where an order sits, and what the guest should understand by it. */
const STEPS = [
  { key: 'placed',    label: 'Order sent', icon: Check,    hint: 'The kitchen has your order.' },
  { key: 'preparing', label: 'Preparing',  icon: ChefHat,  hint: 'Your food is being cooked.' },
  { key: 'served',    label: 'Served',     icon: BellRing, hint: 'Enjoy your meal!' },
]

/**
 * Palette for this page only.
 *
 * The dashboard's cold slate greys make food look grey too, so the surface here
 * is a warm cream and the deep plum→pink gradient carries the brand. Prices sit
 * in the brand pink and actions in the violet, which keeps "what it costs" and
 * "what to tap" visually separate.
 */
const C = {
  surface: '#FFF8F4',
  ink:     '#3B0764',
  muted:   '#8A7A9B',
  price:   '#DB2777',
  primary: '#7C3AED',
}

/* Shared motion presets — one place, so the whole page moves in the same way. */
const spring = { type: 'spring', stiffness: 420, damping: 32 }
const softSpring = { type: 'spring', stiffness: 260, damping: 28 }

/**
 * The page a guest lands on after scanning the QR card on their table.
 *
 * Everything about *where they are* comes from the token in the URL — company,
 * table number, category — so the guest never picks a restaurant or types a
 * table number. They see only the dishes the company currently has switched on,
 * build a cart, and send the order without needing an account.
 */
export default function TableOrder() {
  const { token } = useParams()
  const { user } = useAuth()
  const reduce = useReducedMotion()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [cart, setCart] = useState({})        // { [itemId]: qty }
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')
  const [sheet, setSheet] = useState(false)   // cart sheet open
  const [placing, setPlacing] = useState(false)
  const [order, setOrder] = useState(null)    // set once the order is away

  const [form, setForm] = useState({ name: '', mobile: '', people: 1, note: '' })

  useEffect(() => {
    let alive = true
    api
      .tableMenu(token)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message || 'That QR code is not valid.'))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [token])

  // Prefill the guest's own details when they happen to be signed in.
  useEffect(() => {
    if (user?.full_name) setForm((f) => (f.name ? f : { ...f, name: user.full_name }))
  }, [user])

  // Default the party size to the table's seats — usually right, always editable.
  useEffect(() => {
    if (data?.table?.seats) setForm((f) => ({ ...f, people: data.table.seats }))
  }, [data])

  // The cart sheet owns the scroll while it is open.
  useEffect(() => {
    document.body.style.overflow = sheet ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [sheet])

  const items = data?.items || []
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return items.filter(
      (i) => (cat === 'all' || i.category === cat) && (!needle || i.name.toLowerCase().includes(needle))
    )
  }, [items, cat, q])

  const grouped = useMemo(() => {
    const g = {}
    for (const i of shown) (g[i.category] ||= []).push(i)
    return g
  }, [shown])

  const lines = useMemo(
    () => Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ item: items.find((i) => i.id === Number(id)), qty }))
      .filter((l) => l.item),
    [cart, items]
  )
  const total = lines.reduce((s, l) => s + l.item.price * l.qty, 0)
  const count = lines.reduce((s, l) => s + l.qty, 0)

  const setQty = (id, qty) => setCart((c) => ({ ...c, [id]: Math.max(0, Math.min(99, qty)) }))

  const send = async () => {
    setPlacing(true)
    try {
      const d = await api.placeOrder({
        token,
        items: lines.map((l) => ({ menu_item_id: l.item.id, qty: l.qty })),
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        people: Number(form.people) || 1,
        note: form.note.trim(),
      })
      setOrder(d)
      setSheet(false)
      setCart({})
    } catch (err) {
      alertErr(err, 'Could not send your order')
    } finally {
      setPlacing(false)
    }
  }

  if (loading) return <Skeleton />

  if (error || data?.closed) {
    return (
      <Shell>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto mt-24 max-w-sm rounded-3xl bg-white p-9 text-center shadow-[0_20px_60px_-25px_rgba(59,7,100,.35)]"
        >
          <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
            <Armchair size={28} />
          </span>
          <h1 className="text-lg font-extrabold" style={{ color: C.ink }}>
            {data?.closed ? data.company?.company_name : 'QR code not recognised'}
          </h1>
          <p className="mt-2 text-sm" style={{ color: C.muted }}>{data?.closed ? data.message : error}</p>
        </motion.div>
      </Shell>
    )
  }

  if (order) return <Placed order={order} company={data.company} onAgain={() => setOrder(null)} />

  const { company, table } = data

  return (
    <Shell>
      <Header company={company} table={table} reduce={reduce} />

      <div className="relative z-10 mx-auto -mt-8 max-w-2xl px-4 pb-44">
        {/* Search + categories, pinned so the menu is always one tap away */}
        <div className="sticky top-3 z-30">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...softSpring, delay: 0.05 }}
            className="rounded-[22px] border border-white/70 bg-white/85 p-3 shadow-[0_18px_45px_-22px_rgba(59,7,100,.45)] backdrop-blur-xl"
          >
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-3.5" style={{ color: C.muted }} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search the menu"
                className="w-full rounded-2xl border border-transparent bg-[#F7F1FB] py-3 pl-10 pr-3 text-sm font-medium outline-none transition focus:border-violet-300 focus:bg-white"
                style={{ color: C.ink }}
              />
            </div>

            {data.categories.length > 0 && (
              <CategoryRail categories={data.categories} value={cat} onChange={setCat} />
            )}
          </motion.div>
        </div>

        {items.length === 0 ? (
          <Empty icon={Soup} title="The menu is empty" text="Please ask a member of staff." />
        ) : shown.length === 0 ? (
          <Empty icon={Search} title="Nothing found" text="No dishes match your search." />
        ) : (
          <AnimatePresence mode="popLayout">
            {Object.entries(grouped).map(([group, list]) => (
              <motion.section
                key={group}
                layout
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={softSpring}
                className="mt-8"
              >
                <div className="mb-3 flex items-center gap-2.5 px-1">
                  <span className="h-px flex-1 bg-gradient-to-r from-transparent via-violet-200 to-violet-200" />
                  <h2 className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: C.muted }}>
                    {group}
                  </h2>
                  <span className="h-px flex-1 bg-gradient-to-l from-transparent via-violet-200 to-violet-200" />
                </div>

                <ul className="space-y-3">
                  {list.map((i, idx) => (
                    <Dish
                      key={i.id}
                      item={i}
                      index={idx}
                      qty={cart[i.id] || 0}
                      onSet={(v) => setQty(i.id, v)}
                      reduce={reduce}
                    />
                  ))}
                </ul>
              </motion.section>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Floating cart bar */}
      <AnimatePresence>
        {count > 0 && !sheet && (
          <motion.div
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 90, opacity: 0 }}
            transition={spring}
            className="fixed inset-x-0 bottom-0 z-40 px-4 pb-5"
          >
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setSheet(true)}
              className="mx-auto flex w-full max-w-2xl items-center justify-between rounded-[22px] px-5 py-4 font-bold text-white shadow-[0_18px_40px_-12px_rgba(124,58,237,.7)]"
              style={{ background: 'linear-gradient(100deg,#7C3AED 0%,#9333EA 55%,#DB2777 100%)' }}
            >
              <span className="flex items-center gap-2.5">
                <CountBadge count={count} />
                View cart
              </span>
              <motion.span key={total} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
                {money(total)}
              </motion.span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sheet && (
          <CartSheet
            lines={lines}
            total={total}
            form={form}
            setForm={setForm}
            placing={placing}
            onSet={setQty}
            onClose={() => setSheet(false)}
            onSend={send}
          />
        )}
      </AnimatePresence>
    </Shell>
  )
}

/* ---------------------------------------------------------------- pieces */

/** Full-height page frame — this flow has no site navbar by design. */
function Shell({ children }) {
  return (
    <div className="min-h-screen antialiased" style={{ background: C.surface, color: C.ink }}>
      {children}
    </div>
  )
}

/**
 * Who and where, read straight off the QR code.
 *
 * The drifting blobs are the only decoration that moves on its own; they run
 * slowly and are dropped entirely when the guest prefers reduced motion.
 */
function Header({ company, table, reduce }) {
  return (
    <header
      className="relative overflow-hidden px-5 pb-16 pt-8"
      style={{ background: 'linear-gradient(150deg,#2A0A4A 0%,#5B21B6 55%,#9D174D 100%)' }}
    >
      {!reduce && (
        <>
          <motion.span
            aria-hidden
            className="pointer-events-none absolute -left-16 -top-20 h-64 w-64 rounded-full bg-fuchsia-500/25 blur-3xl"
            animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.span
            aria-hidden
            className="pointer-events-none absolute -right-20 top-4 h-72 w-72 rounded-full bg-violet-400/20 blur-3xl"
            animate={{ x: [0, -26, 0], y: [0, 26, 0] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          />
        </>
      )}

      <div className="relative mx-auto max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={softSpring}
          className="flex items-center gap-3.5"
        >
          {company.logo_url ? (
            <img
              src={company.logo_url}
              alt=""
              className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/30"
            />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/25">
              <UtensilsCrossed size={24} />
            </span>
          )}
          <div className="min-w-0 text-white">
            <h1 className="truncate text-[22px] font-black leading-tight tracking-tight">{company.company_name}</h1>
            {company.address && (
              <p className="flex items-center gap-1 truncate text-xs text-white/65">
                <MapPin size={12} /> {company.address}
              </p>
            )}
          </div>
        </motion.div>

        {/* The table, stated once and clearly — the guest never types it */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...softSpring, delay: 0.08 }}
          className="mt-6 flex flex-wrap items-center gap-2"
        >
          <span className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-black shadow-lg" style={{ color: C.ink }}>
            <Armchair size={16} style={{ color: C.price }} /> Table {table.table_no}
          </span>
          <Pill>{table.category}</Pill>
          <Pill>{table.seats} {table.seats === 1 ? 'seat' : 'seats'}</Pill>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.22 }}
          className="mt-4 flex items-center gap-1.5 text-sm text-white/75"
        >
          <Sparkles size={14} className="text-amber-300" />
          Order straight from your table — no app, no account needed.
        </motion.p>
      </div>

      {/* Curved join into the menu below */}
      <svg viewBox="0 0 100 6" preserveAspectRatio="none" className="absolute inset-x-0 -bottom-px h-6 w-full" aria-hidden>
        <path d="M0 6 Q50 0 100 6 L100 6 L0 6 Z" fill={C.surface} />
      </svg>
    </header>
  )
}

function Pill({ children }) {
  return (
    <span className="rounded-2xl bg-white/12 px-3.5 py-2.5 text-sm font-bold text-white/85 ring-1 ring-white/15 backdrop-blur">
      {children}
    </span>
  )
}

/**
 * The category strip.
 *
 * A restaurant with a dozen categories overflows the row, and a plain
 * `overflow-x-auto` gives no hint that there is more to the right — on a
 * desktop, with no scrollbar and nothing to swipe, the rest is simply
 * invisible. So the ends fade out and an arrow appears on whichever side still
 * has categories hidden, disappearing again once that end is reached.
 */
function CategoryRail({ categories, value, onChange }) {
  const railRef = useRef(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  const measure = () => {
    const el = railRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 })
  }

  useEffect(() => {
    const el = railRef.current
    if (!el) return
    measure()
    // The row also overflows when the window narrows, not only when it scrolls.
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [categories])

  // Keep the selected chip visible — picking one from the far right and having
  // it scroll out of sight on the next render is disorienting.
  useEffect(() => {
    const el = railRef.current?.querySelector('[data-active="true"]')
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [value])

  /** Move by most of a screenful, keeping a chip or two for context. */
  const nudge = (dir) => {
    const el = railRef.current
    if (!el) return
    el.scrollBy({ left: dir * Math.max(120, el.clientWidth * 0.7), behavior: 'smooth' })
  }

  // Fading is done with a mask rather than a white gradient overlay: this strip
  // sits in a translucent panel that scrolls over the purple header, so any
  // painted fade would show up as a pale smear against it.
  const FADE = '34px'
  const mask =
    edges.left && edges.right
      ? `linear-gradient(to right, transparent, #000 ${FADE}, #000 calc(100% - ${FADE}), transparent)`
      : edges.left
        ? `linear-gradient(to right, transparent, #000 ${FADE})`
        : edges.right
          ? `linear-gradient(to right, #000 calc(100% - ${FADE}), transparent)`
          : 'none'

  return (
    <div className="relative mt-2.5">
      <div
        ref={railRef}
        onScroll={measure}
        style={{ maskImage: mask, WebkitMaskImage: mask }}
        className="no-scrollbar flex gap-1.5 overflow-x-auto scroll-smooth pb-0.5"
      >
        <Chip on={value === 'all'} onClick={() => onChange('all')}>All</Chip>
        {categories.map((c) => (
          <Chip key={c} on={value === c} onClick={() => onChange(c)}>{c}</Chip>
        ))}
      </div>

      <AnimatePresence>
        {edges.left && <Edge key="l" side="left" onClick={() => nudge(-1)} />}
        {edges.right && <Edge key="r" side="right" onClick={() => nudge(1)} />}
      </AnimatePresence>
    </div>
  )
}

/** The arrow that scrolls past one faded end of the category rail. */
function Edge({ side, onClick }) {
  const left = side === 'left'
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={spring}
      whileTap={{ scale: 0.85 }}
      onClick={onClick}
      aria-label={left ? 'Show earlier categories' : 'Show more categories'}
      className={`absolute top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white text-violet-500 shadow-[0_4px_12px_-2px_rgba(59,7,100,.35)] ring-1 ring-violet-100 transition hover:text-violet-700 ${
        left ? '-left-1' : '-right-1'
      }`}
    >
      {left ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
    </motion.button>
  )
}

/** Category chip; the active pill slides between chips rather than blinking. */
function Chip({ on, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={on}
      className="relative shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors"
      style={{ color: on ? '#fff' : C.muted }}
    >
      {on && (
        <motion.span
          layoutId="cat-pill"
          transition={spring}
          className="absolute inset-0 rounded-full"
          style={{ background: 'linear-gradient(100deg,#7C3AED,#DB2777)' }}
        />
      )}
      <span className="relative">{children}</span>
    </button>
  )
}

/** The cart count, popping each time it changes so the change is noticed. */
function CountBadge({ count }) {
  return (
    <span className="relative flex h-7 min-w-[28px] items-center justify-center rounded-full bg-white/25 px-2">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={count}
          initial={{ y: -14, opacity: 0, scale: 0.6 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 14, opacity: 0, scale: 0.6 }}
          transition={spring}
          className="text-sm font-black"
        >
          {count}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

/** One dish. The Add button morphs into a stepper once it's in the cart. */
function Dish({ item, index, qty, onSet, reduce }) {
  const inCart = qty > 0
  return (
    <motion.li
      layout
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...softSpring, delay: Math.min(index * 0.045, 0.3) }}
      whileHover={reduce ? undefined : { y: -2 }}
      className={`group flex items-center gap-3.5 rounded-3xl bg-white p-3 transition-shadow ${
        inCart
          ? 'shadow-[0_10px_30px_-14px_rgba(219,39,119,.55)] ring-2 ring-pink-200'
          : 'shadow-[0_8px_24px_-18px_rgba(59,7,100,.55)] hover:shadow-[0_16px_38px_-20px_rgba(59,7,100,.6)]'
      }`}
    >
      <div className="relative h-[68px] w-[68px] shrink-0 overflow-hidden rounded-2xl bg-[#F7F1FB]">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-violet-200">
            <UtensilsCrossed size={24} />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-extrabold leading-snug tracking-tight">{item.name}</p>
        <p className="mt-0.5 text-[15px] font-black" style={{ color: C.price }}>{money(item.price)}</p>
      </div>

      <AnimatePresence mode="popLayout" initial={false}>
        {inCart ? (
          <motion.div
            key="stepper"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={spring}
            className="flex shrink-0 items-center gap-1 rounded-full bg-[#F7F1FB] p-1"
          >
            <Round onClick={() => onSet(qty - 1)} label={`One less ${item.name}`}><Minus size={15} /></Round>
            <span className="relative flex min-w-[24px] justify-center overflow-hidden">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={qty}
                  initial={{ y: -16, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 16, opacity: 0 }}
                  transition={spring}
                  className="text-sm font-black"
                >
                  {qty}
                </motion.span>
              </AnimatePresence>
            </span>
            <Round onClick={() => onSet(qty + 1)} label={`One more ${item.name}`} solid><Plus size={15} /></Round>
          </motion.div>
        ) : (
          <motion.button
            key="add"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={spring}
            whileTap={{ scale: 0.9 }}
            onClick={() => onSet(1)}
            className="flex shrink-0 items-center gap-1 rounded-full px-4 py-2.5 text-sm font-black text-white shadow-[0_8px_20px_-8px_rgba(124,58,237,.8)]"
            style={{ background: 'linear-gradient(100deg,#7C3AED,#9333EA)' }}
          >
            <Plus size={15} /> Add
          </motion.button>
        )}
      </AnimatePresence>
    </motion.li>
  )
}

function Round({ onClick, children, label, solid }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.82 }}
      onClick={onClick}
      aria-label={label}
      className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
        solid ? 'text-white shadow-md' : 'bg-white text-violet-500 hover:text-violet-700'
      }`}
      style={solid ? { background: 'linear-gradient(100deg,#7C3AED,#DB2777)' } : undefined}
    >
      {children}
    </motion.button>
  )
}

function Empty({ icon: Icon, title, text }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-10 rounded-3xl border border-dashed border-violet-200 bg-white/60 py-14 text-center"
    >
      <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F7F1FB] text-violet-300">
        <Icon size={24} />
      </span>
      <p className="font-extrabold">{title}</p>
      <p className="mt-1 text-sm" style={{ color: C.muted }}>{text}</p>
    </motion.div>
  )
}

/** Shown while the menu loads — the page's shape, not a spinner in a void. */
function Skeleton() {
  return (
    <Shell>
      <div className="h-56 animate-pulse" style={{ background: 'linear-gradient(150deg,#2A0A4A,#5B21B6,#9D174D)' }} />
      <div className="mx-auto -mt-8 max-w-2xl px-4">
        <div className="h-[86px] animate-pulse rounded-[22px] bg-white/80" />
        <div className="mt-8 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3.5 rounded-3xl bg-white p-3">
              <div className="h-[68px] w-[68px] animate-pulse rounded-2xl bg-violet-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-2/5 animate-pulse rounded-full bg-violet-100" />
                <div className="h-3 w-1/4 animate-pulse rounded-full bg-pink-100" />
              </div>
              <div className="h-10 w-20 animate-pulse rounded-full bg-violet-100" />
            </div>
          ))}
        </div>
      </div>
    </Shell>
  )
}

/** The cart, the few details worth asking for, and the send button. */
function CartSheet({ lines, total, form, setForm, placing, onSet, onClose, onSend }) {
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#2A0A4A]/55 backdrop-blur-sm"
      />

      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={softSpring}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.4 }}
        onDragEnd={(_, info) => info.offset.y > 130 && onClose()}
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-[28px] bg-white sm:rounded-[28px]"
      >
        {/* Drag handle — the sheet can be flicked away on a phone */}
        <div className="flex shrink-0 justify-center pt-3 sm:hidden">
          <span className="h-1.5 w-10 rounded-full bg-violet-200" />
        </div>

        <div className="flex shrink-0 items-center justify-between px-6 pb-4 pt-4">
          <h2 className="flex items-center gap-2 text-lg font-black tracking-tight">
            <ShoppingBag size={18} style={{ color: C.price }} /> Your order
          </h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-violet-300 transition hover:bg-violet-50 hover:text-violet-600">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-2">
          <ul className="space-y-3">
            <AnimatePresence initial={false}>
              {lines.map((l) => (
                <motion.li
                  key={l.item.id}
                  layout
                  initial={{ opacity: 0, x: -18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 24, height: 0, marginBottom: 0 }}
                  transition={softSpring}
                  className="flex items-center gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{l.item.name}</p>
                    <p className="text-xs" style={{ color: C.muted }}>{money(l.item.price)} each</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-[#F7F1FB] p-1">
                    <Round onClick={() => onSet(l.item.id, l.qty - 1)} label="One less"><Minus size={14} /></Round>
                    <span className="min-w-[20px] text-center text-sm font-black">{l.qty}</span>
                    <Round onClick={() => onSet(l.item.id, l.qty + 1)} label="One more" solid><Plus size={14} /></Round>
                  </div>
                  <span className="w-[74px] shrink-0 text-right font-black">{money(l.item.price * l.qty)}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>

          <div className="mt-6 grid gap-3 border-t border-violet-100 pt-5 sm:grid-cols-2">
            <Field label="Your name" hint="optional">
              <input value={form.name} onChange={set('name')} maxLength={150} placeholder="So staff can find you" className="sheet-input" />
            </Field>
            <Field label="Mobile" hint="optional">
              <input value={form.mobile} onChange={set('mobile')} inputMode="tel" maxLength={15} placeholder="07XXXXXXXX" className="sheet-input" />
            </Field>
            <Field label="People at the table">
              <input value={form.people} onChange={set('people')} type="number" min="1" max="99" className="sheet-input" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Note for the kitchen" hint="optional">
                <input value={form.note} onChange={set('note')} maxLength={300} placeholder="e.g. less spicy, no onion" className="sheet-input" />
              </Field>
            </div>
          </div>
        </div>

        <div className="shrink-0 rounded-b-[28px] border-t border-violet-100 bg-white p-6">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="font-bold" style={{ color: C.muted }}>Total</span>
            <motion.span key={total} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="text-[26px] font-black tracking-tight">
              {money(total)}
            </motion.span>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onSend}
            disabled={placing || lines.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-black text-white shadow-[0_16px_36px_-14px_rgba(124,58,237,.85)] disabled:opacity-50"
            style={{ background: 'linear-gradient(100deg,#7C3AED 0%,#9333EA 55%,#DB2777 100%)' }}
          >
            {placing ? <Spinner /> : <Check size={18} />}
            {placing ? 'Sending…' : 'Place order'}
          </motion.button>
          <p className="mt-2.5 text-center text-xs" style={{ color: C.muted }}>You pay at the table as usual.</p>
        </div>
      </motion.div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wider" style={{ color: C.muted }}>
        {label} {hint && <span className="font-bold normal-case tracking-normal opacity-60">({hint})</span>}
      </span>
      {children}
    </label>
  )
}

function Spinner() {
  return (
    <motion.span
      className="h-[18px] w-[18px] rounded-full border-2 border-white/40 border-t-white"
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
    />
  )
}

/**
 * After sending: the order's reference, its lines, and where the kitchen has
 * got to. The status is polled, so the guest sees "Preparing" appear without
 * touching anything.
 */
function Placed({ order, company, onAgain }) {
  const [live, setLive] = useState(order)
  const tokenRef = useRef(order.track_token)

  useEffect(() => {
    const tick = () =>
      api
        .orderStatus(tokenRef.current)
        .then((d) => setLive((o) => ({ ...o, ...d })))
        .catch(() => {})
    const id = setInterval(tick, STATUS_POLL_MS)
    tick()
    return () => clearInterval(id)
  }, [])

  const cancelled = live.status === 'cancelled'
  const stepIndex = STEPS.findIndex((s) => s.key === live.status)

  return (
    <Shell>
      <div className="mx-auto max-w-lg px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 22, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={softSpring}
          className="overflow-hidden rounded-[28px] bg-white text-center shadow-[0_24px_70px_-30px_rgba(59,7,100,.5)]"
        >
          <div
            className="px-7 pb-8 pt-9"
            style={{
              background: cancelled
                ? 'linear-gradient(160deg,#FEF2F2,#fff)'
                : 'linear-gradient(160deg,#F5F0FF,#FFF5F9 60%,#fff)',
            }}
          >
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ ...spring, delay: 0.1 }}
              className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${
                cancelled ? 'bg-red-100 text-red-500' : 'text-white'
              }`}
              style={cancelled ? undefined : { background: 'linear-gradient(140deg,#7C3AED,#DB2777)' }}
            >
              {cancelled ? <X size={34} /> : <DrawnCheck />}
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="mt-5 text-xl font-black tracking-tight"
            >
              {cancelled ? 'Order cancelled' : 'Order sent to the kitchen'}
            </motion.h1>
            <p className="mt-1 text-sm" style={{ color: C.muted }}>
              {company.company_name} · {live.table_label}
            </p>

            {/* The code the guest reads out to staff */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...spring, delay: 0.35 }}
              className="mx-auto mt-6 inline-flex items-center gap-3 rounded-2xl bg-white px-6 py-3.5 shadow-[0_10px_30px_-14px_rgba(59,7,100,.5)]"
            >
              <span className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: C.muted }}>Order</span>
              <span className="flex gap-1">
                {String(live.ref).split('').map((ch, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 + i * 0.06, ...spring }}
                    className="text-2xl font-black tracking-tight"
                    style={{ color: C.ink }}
                  >
                    {ch}
                  </motion.span>
                ))}
              </span>
            </motion.div>
            <p className="mt-2 text-xs" style={{ color: C.muted }}>Quote this number to the staff.</p>
          </div>
        </motion.div>

        {/* Progress the guest can watch without asking anyone */}
        {!cancelled && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, ...softSpring }}
            className="relative mt-4 rounded-[28px] bg-white p-7 shadow-[0_16px_50px_-30px_rgba(59,7,100,.5)]"
          >
            <ol className="relative space-y-6">
              {/* Rail behind the nodes, filled as far as the kitchen has got */}
              <span className="absolute left-[19px] top-3 h-[calc(100%-24px)] w-0.5 rounded bg-violet-100" />
              <motion.span
                className="absolute left-[19px] top-3 w-0.5 rounded"
                style={{ background: 'linear-gradient(#7C3AED,#DB2777)' }}
                initial={{ height: 0 }}
                animate={{ height: `${(Math.max(stepIndex, 0) / (STEPS.length - 1)) * 100}%` }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />

              {STEPS.map((s, i) => {
                const done = i <= stepIndex
                const now = i === stepIndex
                return (
                  <li key={s.key} className="relative flex items-start gap-4">
                    <motion.span
                      animate={now ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                      transition={now ? { duration: 1.6, repeat: Infinity } : {}}
                      className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        done ? 'text-white shadow-lg' : 'bg-violet-50 text-violet-200'
                      }`}
                      style={done ? { background: 'linear-gradient(140deg,#7C3AED,#DB2777)' } : undefined}
                    >
                      <s.icon size={18} />
                    </motion.span>
                    <div className="min-w-0 flex-1 pt-1.5">
                      <p className={`font-black leading-none ${done ? '' : 'text-violet-300'}`}>
                        {s.label}
                        {now && (
                          <motion.span
                            animate={{ opacity: [1, 0.35, 1] }}
                            transition={{ duration: 1.6, repeat: Infinity }}
                            className="ml-2 text-[11px] font-black uppercase tracking-wider"
                            style={{ color: C.price }}
                          >
                            now
                          </motion.span>
                        )}
                      </p>
                      {done && <p className="mt-1.5 text-xs" style={{ color: C.muted }}>{s.hint}</p>}
                    </div>
                  </li>
                )
              })}
            </ol>
          </motion.div>
        )}

        {/* What was ordered */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38, ...softSpring }}
          className="mt-4 rounded-[28px] bg-white p-7 shadow-[0_16px_50px_-30px_rgba(59,7,100,.5)]"
        >
          <ul className="space-y-2.5">
            {(live.items || []).map((l, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className="flex h-6 min-w-[26px] items-center justify-center rounded-lg bg-[#F7F1FB] px-1 text-xs font-black text-violet-600">
                  {l.qty}
                </span>
                <span className="min-w-0 flex-1 truncate font-bold">{l.name}</span>
                <span className="font-bold" style={{ color: C.muted }}>{money(l.price * l.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-baseline justify-between border-t border-violet-100 pt-4">
            <span className="font-bold" style={{ color: C.muted }}>Total</span>
            <span className="text-xl font-black tracking-tight">{money(live.total)}</span>
          </div>
        </motion.div>

        {company.phone && (
          <motion.a
            whileTap={{ scale: 0.97 }}
            href={`tel:${company.phone}`}
            className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-sm font-black shadow-[0_10px_30px_-20px_rgba(59,7,100,.6)]"
          >
            <Phone size={15} style={{ color: C.price }} /> Call the restaurant
          </motion.a>
        )}

        <button
          onClick={onAgain}
          className="mt-3 flex w-full items-center justify-center gap-2 py-3 text-sm font-bold transition hover:opacity-70"
          style={{ color: C.muted }}
        >
          <ArrowLeft size={15} /> Order something else
        </button>
      </div>
    </Shell>
  )
}

/** A tick that draws itself, rather than simply appearing. */
function DrawnCheck() {
  return (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
      <motion.path
        d="M4 12.5 L9.5 18 L20 6.5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.55, delay: 0.25, ease: 'easeOut' }}
      />
    </svg>
  )
}
