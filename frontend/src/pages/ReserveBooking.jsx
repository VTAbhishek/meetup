import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { CalendarClock, ArrowLeft, Users, Phone, User, ClipboardList, Check, UtensilsCrossed, Plus, Minus, ShoppingCart, Trash2, X, Armchair, Info, RefreshCw, AlertTriangle } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { toastOk, toastInfo, alertErr } from '../alerts'
import Spinner from '../components/Spinner'

const money = (n) => 'Rs ' + Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 0 })

/** How often the table availability re-checks itself while the form is open. */
const TABLE_POLL_MS = 10000

/**
 * Reservation / booking form. A logged-in customer picks a date, time range,
 * party size and leaves their contact details, and can optionally pre-order food
 * from the company's menu (browse by category, add to cart with quantities). The
 * company then confirms, keeps pending, replies or declines from its dashboard.
 */
export default function ReserveBooking() {
  const { slug } = useParams()
  const [search] = useSearchParams()
  const { user } = useAuth()

  // Set when the customer arrived by scanning the QR card standing on a table.
  const qrToken = search.get('table')

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

  // ---- Tables ----
  const [tableData, setTableData] = useState({ categories: [], tables: [] })
  const [tableCat, setTableCat] = useState('')   // chosen category, '' = none yet
  const [tableId, setTableId] = useState(0)      // chosen table, 0 = none
  const [tableDetail, setTableDetail] = useState(null) // table shown in the pop-up card
  const [tablesBusy, setTablesBusy] = useState(false)  // a refresh is in flight
  const [tablesAt, setTablesAt] = useState(null)       // when availability last refreshed
  const [takenNote, setTakenNote] = useState('')       // "someone just booked your table"
  const [refreshKey, setRefreshKey] = useState(0)      // bump to force a re-check
  const [qrTable, setQrTable] = useState(null)         // table resolved from a scanned QR
  const [qrNote, setQrNote] = useState('')             // why a scanned table couldn't be used
  // The QR preselects once. Without this the availability poll would keep
  // re-selecting it every few seconds, fighting anyone who picks another table.
  const qrAppliedRef = useRef(false)

  // The poll runs on a timer and can't close over the latest state, so mirror
  // the current selection into refs it can read.
  const tableIdRef = useRef(0)
  const tableLabelRef = useRef('')
  tableIdRef.current = tableId

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

  /**
   * Keep table availability live. Two customers can have this form open at the
   * same time, so a one-off fetch goes stale the moment one of them books —
   * the other would pick a table that is already gone. We re-poll the slot on a
   * timer, and immediately whenever the tab regains focus (a customer coming
   * back to a form left open for ten minutes must not act on old data).
   *
   * The backend re-checks inside the insert transaction regardless; this is
   * what makes the clash *visible* instead of a surprise on submit.
   */
  useEffect(() => {
    let stale = false
    let timer = null

    const load = () => {
      // Don't poll a tab nobody is looking at — it resumes on focus below.
      if (document.hidden) return
      setTablesBusy(true)
      api
        .tables(slug, { date: form.res_date, from: form.time_from, to: form.time_to })
        .then((d) => {
          if (stale) return
          setTableData(d)
          setTablesAt(new Date())
          // If the table this customer picked was just taken by someone else
          // (or switched off by the company), clear it and say so out loud —
          // silently dropping the selection is how people submit the wrong thing.
          const mine = tableIdRef.current
          if (mine && !d.tables.some((t) => t.id === mine && !t.booked)) {
            setTableId(0)
            setTakenNote(
              tableLabelRef.current
                ? `Table ${tableLabelRef.current} was just booked by someone else. Please pick another.`
                : 'The table you picked is no longer available. Please pick another.'
            )
            toastInfo('That table was just taken')
          }
        })
        .catch(() => !stale && setTableData({ categories: [], tables: [] }))
        .finally(() => !stale && setTablesBusy(false))
    }

    load()
    timer = setInterval(load, TABLE_POLL_MS)
    // Re-check the moment the tab becomes visible again.
    const onVisible = () => !document.hidden && load()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      stale = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [slug, form.res_date, form.time_from, form.time_to, refreshKey])

  // ---- Arriving from a table's QR card ----
  // The card carries a token rather than the table id, so resolve it once.
  useEffect(() => {
    if (!qrToken) return
    let alive = true
    api
      .tableByToken(qrToken)
      .then((d) => alive && setQrTable(d.table))
      .catch(() => alive && setQrNote('That QR code was not recognised — please pick a table below.'))
    return () => { alive = false }
  }, [qrToken])

  // Apply it as soon as the picker has loaded, so the customer lands with their
  // own table already chosen. It still has to be free right now: a code stuck to
  // a table someone else has already booked for this slot must not silently win.
  useEffect(() => {
    if (!qrTable || qrAppliedRef.current || tableData.tables.length === 0) return
    const live = tableData.tables.find((t) => t.id === qrTable.id)
    qrAppliedRef.current = true

    if (!live) {
      setQrNote(`Table ${qrTable.table_no} is not open for booking right now — please pick another below.`)
      return
    }
    if (live.booked) {
      setQrNote(`Table ${qrTable.table_no} is already taken for this time — pick another time or table.`)
      setTableCat(live.category)
      return
    }
    setTableCat(live.category)
    setTableId(live.id)
    setQrNote('')
    toastInfo(`Table ${live.table_no} selected from the QR code`)
  }, [qrTable, tableData])

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

  // Tables in the chosen category, and the one currently selected.
  const catTables = useMemo(
    () => (tableCat ? tableData.tables.filter((t) => t.category === tableCat) : []),
    [tableData, tableCat]
  )
  const selectedTable = useMemo(
    () => tableData.tables.find((t) => t.id === tableId) || null,
    [tableData, tableId]
  )
  const hasTables = tableData.tables.length > 0
  // Remembered so the "just taken" message can still name the table after the
  // selection has been cleared.
  if (selectedTable) tableLabelRef.current = selectedTable.table_no

  const submit = async (e) => {
    e.preventDefault()
    if (!company) return
    setErrors({})
    setBusy(true)
    try {
      const items = cartLines.map((l) => ({ menu_item_id: l.item.id, qty: l.qty }))
      await api.createReservation({
        company_id: company.id,
        ...form,
        person_count: Number(form.person_count),
        table_id: tableId || null,
        items,
      })
      toastOk('Reservation sent')
      setDone(true)
    } catch (err) {
      if (err?.status === 422 && err.data?.errors) {
        setErrors(err.data.errors)
        // Losing the table on submit means our view of the slot is out of date —
        // re-check straight away so the picker shows the real state.
        if (err.data.errors.table_id) {
          setTableId(0)
          setRefreshKey((k) => k + 1)
        }
      } else alertErr(err)
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
        {selectedTable && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-silver px-3 py-1 text-sm font-semibold text-brand-navy">
            <Armchair size={15} className="text-brand-green" />
            Table {selectedTable.table_no} · {selectedTable.category}
          </p>
        )}
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

          {/* Table picker — pick a category, then a table. Only shown when the
              company has set tables up; picking one stays optional. */}
          {hasTables && (
            <div className="card mt-6 p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="flex items-center gap-2 text-lg font-extrabold text-brand-navy">
                  <Armchair size={20} className="text-brand-green" /> Choose your table
                  <span className="text-sm font-normal text-slate-400">(optional)</span>
                </h2>
                {/* Live availability indicator — availability re-checks itself
                    every few seconds, so a table booked by someone else while
                    this form is open turns unavailable on its own. */}
                <button
                  type="button"
                  onClick={() => setRefreshKey((k) => k + 1)}
                  disabled={tablesBusy}
                  title="Check availability again now"
                  className="flex items-center gap-1.5 rounded-full bg-brand-silver/70 px-2.5 py-1 text-xs font-semibold text-slate-500 transition hover:bg-brand-silver hover:text-brand-navy disabled:opacity-60"
                >
                  <RefreshCw size={12} className={`text-brand-green ${tablesBusy ? 'animate-spin' : ''}`} />
                  {tablesBusy ? 'Checking…' : tablesAt ? `Live · updated ${tablesAt.toLocaleTimeString()}` : 'Live'}
                </button>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Availability updates automatically. Tables already booked for your date and time are shown as
                unavailable.
              </p>

              {/* Why the table on the scanned QR card couldn't be selected */}
              {qrNote && (
                <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span className="flex-1">{qrNote}</span>
                  <button type="button" onClick={() => setQrNote('')} className="shrink-0 text-amber-400 hover:text-amber-700">
                    <X size={15} />
                  </button>
                </div>
              )}

              {/* Shown when someone else books the table this customer had picked */}
              {takenNote && (
                <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span className="flex-1">{takenNote}</span>
                  <button
                    type="button"
                    onClick={() => setTakenNote('')}
                    className="shrink-0 text-amber-400 hover:text-amber-700"
                  >
                    <X size={15} />
                  </button>
                </div>
              )}

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Table category" icon={Armchair}>
                  <select
                    value={tableCat}
                    onChange={(e) => { setTableCat(e.target.value); setTableId(0); setTakenNote('') }}
                    className="input"
                  >
                    <option value="">Select a category</option>
                    {tableData.categories.map((c) => {
                      const free = tableData.tables.filter((t) => t.category === c && !t.booked).length
                      return (
                        <option key={c} value={c}>
                          {c} ({free} free)
                        </option>
                      )
                    })}
                  </select>
                </Field>

                <Field label="Table" error={errors.table_id}>
                  <select
                    value={tableId}
                    disabled={!tableCat}
                    onChange={(e) => { setTableId(Number(e.target.value)); setTakenNote('') }}
                    className="input disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value={0}>{tableCat ? 'Select a table' : 'Choose a category first'}</option>
                    {catTables.map((t) => (
                      <option key={t.id} value={t.id} disabled={t.booked}>
                        Table {t.table_no} · {t.seats} {t.seats === 1 ? 'seat' : 'seats'}
                        {t.booked ? ' — already booked' : ''}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* Preview card for the picked table — click for the full photo */}
              {selectedTable ? (
                <button
                  type="button"
                  onClick={() => setTableDetail(selectedTable)}
                  title="Click to view this table"
                  className="mt-4 flex w-full items-center gap-3 rounded-xl border border-brand-blue/40 bg-brand-silver/40 p-3 text-left transition hover:border-brand-blue hover:shadow-sm"
                >
                  {selectedTable.image_url ? (
                    <img
                      src={selectedTable.image_url}
                      alt={`Table ${selectedTable.table_no}`}
                      className="h-16 w-20 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="flex h-16 w-20 shrink-0 items-center justify-center rounded-lg bg-white text-slate-300">
                      <Armchair size={22} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-brand-navy">Table {selectedTable.table_no}</p>
                    <p className="text-sm text-slate-500">
                      {selectedTable.category} · {selectedTable.seats} {selectedTable.seats === 1 ? 'seat' : 'seats'}
                    </p>
                    {selectedTable.note && <p className="truncate text-xs text-slate-400">{selectedTable.note}</p>}
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-brand-blue">
                    <Info size={14} /> View
                  </span>
                </button>
              ) : (
                tableCat && catTables.every((t) => t.booked) && (
                  <p className="mt-4 rounded-xl border border-dashed border-slate-200 py-4 text-center text-sm text-slate-400">
                    Every {tableCat} table is booked for this time. Try another category or a different time.
                  </p>
                )
              )}
            </div>
          )}

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

            {/* The picked table, echoed here so it's visible next to the submit button */}
            {selectedTable && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-brand-silver/60 px-3 py-2 text-sm">
                <Armchair size={15} className="shrink-0 text-brand-green" />
                <span className="font-semibold text-brand-navy">Table {selectedTable.table_no}</span>
                <span className="text-slate-500">· {selectedTable.category}</span>
                <button
                  type="button"
                  onClick={() => { setTableId(0); setTableCat('') }}
                  title="Remove table"
                  className="ml-auto shrink-0 text-slate-300 hover:text-red-500"
                >
                  <X size={15} />
                </button>
              </div>
            )}

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

      {tableDetail && <TableDetailCard table={tableDetail} onClose={() => setTableDetail(null)} />}
    </div>
  )
}

/** Pop-up card showing one table's photo, number, seats and note. */
function TableDetailCard({ table, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-cardHover"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          {table.image_url ? (
            <img src={table.image_url} alt={`Table ${table.table_no}`} className="h-52 w-full object-cover" />
          ) : (
            <div className="flex h-52 w-full items-center justify-center bg-brand-silver text-slate-300">
              <Armchair size={48} />
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
            {table.category}
          </span>
          <h3 className="mt-2 text-xl font-extrabold text-brand-navy">Table {table.table_no}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-500">
            <Users size={15} className="text-slate-400" />
            {table.seats} {table.seats === 1 ? 'seat' : 'seats'}
          </p>
          {table.note && <p className="mt-2 text-sm text-slate-600">{table.note}</p>}

          <button type="button" onClick={onClose} className="btn-blue mt-5 w-full py-2.5 text-sm">
            <Check size={16} /> Keep this table
          </button>
        </div>
      </div>
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
