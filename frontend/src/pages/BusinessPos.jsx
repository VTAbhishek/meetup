import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ShoppingCart, BarChart3, Search, Plus, Minus, Trash2,
  Receipt, Printer, ArrowLeft, RefreshCw, UtensilsCrossed,
} from 'lucide-react'
import { api } from '../api'
import { toastOk, alertErr } from '../alerts'
import DashboardHeader from '../components/DashboardHeader'
import Spinner from '../components/Spinner'

const money = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Open a clean printable receipt in a new window and fire the print dialog. */
function printReceipt(companyName, invoice) {
  const rows = invoice.items.map((it) => `
    <tr>
      <td>${escapeHtml(it.product_name)}</td>
      <td class="r">${it.qty}</td>
      <td class="r">${Number(it.price).toFixed(2)}</td>
      <td class="r">${Number(it.line_total).toFixed(2)}</td>
    </tr>`).join('')
  const change = Number(invoice.paid || 0) - Number(invoice.total || 0)
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(invoice.invoice_no)}</title>
    <style>
      body{font-family:'Courier New',monospace;margin:0;padding:12px;color:#000}
      .receipt{width:300px;margin:0 auto}
      h1{font-size:18px;text-align:center;margin:0 0 2px}
      .center{text-align:center}.muted{color:#333;font-size:12px}
      hr{border:none;border-top:1px dashed #000;margin:8px 0}
      table{width:100%;border-collapse:collapse;font-size:12px}
      td{padding:2px 0;vertical-align:top}.r{text-align:right}
      .grand td{font-size:15px;font-weight:bold;padding-top:4px}
      @media print{body{padding:0}}
    </style></head>
    <body>
      <div class="receipt">
        <h1>${escapeHtml(companyName)}</h1>
        <div class="center muted">Sales Invoice</div><hr>
        <div class="muted">Invoice: <b>${escapeHtml(invoice.invoice_no)}</b><br>
          Date: ${escapeHtml(invoice.created_at || '')}<br>
          Customer: ${escapeHtml(invoice.customer_name || 'Walk-in')}</div><hr>
        <table>
          <tr class="muted"><td>Item</td><td class="r">Qty</td><td class="r">Price</td><td class="r">Total</td></tr>
          ${rows}
        </table><hr>
        <table>
          <tr><td>Subtotal</td><td class="r">${Number(invoice.subtotal).toFixed(2)}</td></tr>
          <tr><td>Discount</td><td class="r">-${Number(invoice.discount).toFixed(2)}</td></tr>
          <tr class="grand"><td>TOTAL</td><td class="r">Rs. ${Number(invoice.total).toFixed(2)}</td></tr>
          <tr><td>Paid</td><td class="r">${Number(invoice.paid || 0).toFixed(2)}</td></tr>
          <tr><td>Change</td><td class="r">${(change < 0 ? 0 : change).toFixed(2)}</td></tr>
        </table><hr>
        <div class="center muted">Thank you! Come again.</div>
      </div>
    </body></html>`
  const w = window.open('', '_blank', 'width=380,height=640')
  if (!w) { alertErr(null, 'Please allow pop-ups to print the bill.'); return }
  w.document.write(html)
  w.document.close()
  // Print once the receipt has rendered. Driving it from here (rather than a
  // body onload) is reliable in both the browser and the desktop app, where the
  // blank popup has already fired its load event by the time we write into it.
  w.focus()
  setTimeout(() => { try { w.print() } catch { /* user closed it */ } }, 400)
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

// True when running inside the Meetup POS desktop shell (Electron passes
// ?desktop=1). In that mode we hide the link back into the web dashboard so the
// app stays POS-only.
const isDesktopApp = /[?&]desktop=1/.test(window.location.hash)

export default function BusinessPos() {
  const [company, setCompany] = useState(null)
  const [tab, setTab] = useState('sell')
  const [menu, setMenu] = useState([])
  const [loading, setLoading] = useState(true)

  const loadMenu = () => api.myMenu().then((d) => setMenu(d.items || []))

  useEffect(() => {
    Promise.all([api.myCompany().then((d) => setCompany(d.company)), loadMenu()])
      .catch((e) => alertErr(e))
      .finally(() => setLoading(false))
  }, [])

  const tabs = [
    { key: 'sell', label: 'Sell', icon: ShoppingCart },
    { key: 'reports', label: 'Reports', icon: BarChart3 },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <DashboardHeader badge="POS" company={company} />
      <div className="container-page py-5">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          {!isDesktopApp && (
            <Link to="/business" className="btn-ghost py-2.5 text-sm">
              <ArrowLeft size={18} /> Dashboard
            </Link>
          )}
          <h1 className="text-2xl font-extrabold text-brand-navy">Point of Sale</h1>
          <div className="ml-auto inline-flex rounded-full bg-white p-1 shadow-card">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-semibold transition ${
                  tab === t.key ? 'bg-brand-blue text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <t.icon size={18} /> {t.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid place-items-center py-24"><Spinner /></div>
        ) : tab === 'sell' ? (
          <SellTab company={company} menu={menu} reloadMenu={loadMenu} />
        ) : (
          <ReportsTab company={company} />
        )}
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- Sell tab */

function SellTab({ company, menu }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [cart, setCart] = useState([]) // [{item, qty}]
  const [customer, setCustomer] = useState('Walk-in')
  const [discount, setDiscount] = useState('0')
  const [paid, setPaid] = useState('0')
  const [saving, setSaving] = useState(false)

  const available = useMemo(() => menu.filter((m) => m.is_available), [menu])
  const categories = useMemo(
    () => ['All', ...Array.from(new Set(available.map((m) => m.category).filter(Boolean)))],
    [available],
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return available.filter(
      (m) =>
        (category === 'All' || m.category === category) &&
        m.name.toLowerCase().includes(q),
    )
  }, [available, search, category])

  const add = (m) =>
    setCart((c) => {
      const found = c.find((i) => i.item.id === m.id)
      if (found) return c.map((i) => (i.item.id === m.id ? { ...i, qty: i.qty + 1 } : i))
      return [...c, { item: m, qty: 1 }]
    })
  const changeQty = (id, delta) =>
    setCart((c) => c.map((i) => (i.item.id === id ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0))
  const removeLine = (id) => setCart((c) => c.filter((i) => i.item.id !== id))

  const subtotal = cart.reduce((s, i) => s + i.item.price * i.qty, 0)
  const discountVal = Math.max(0, Math.min(parseFloat(discount) || 0, subtotal))
  const total = subtotal - discountVal

  const checkout = async () => {
    if (cart.length === 0) return alertErr(null, 'Tap items on the menu to add them to the bill.')
    setSaving(true)
    try {
      const res = await api.createPosInvoice({
        customer_name: customer.trim() || 'Walk-in',
        discount: discountVal,
        paid: parseFloat(paid) || 0,
        items: cart.map((i) => ({ product_id: i.item.id, qty: i.qty })),
      })
      toastOk(`Invoice ${res.invoice_no} saved`)
      printReceipt(company?.company_name || 'POS', {
        invoice_no: res.invoice_no,
        created_at: new Date().toLocaleString(),
        customer_name: customer.trim() || 'Walk-in',
        subtotal: res.subtotal,
        discount: res.discount,
        total: res.total,
        paid: parseFloat(paid) || 0,
        items: cart.map((i) => ({
          product_name: i.item.name,
          price: i.item.price,
          qty: i.qty,
          line_total: i.item.price * i.qty,
        })),
      })
      setCart([]); setCustomer('Walk-in'); setDiscount('0'); setPaid('0')
    } catch (e) {
      alertErr(e)
    } finally {
      setSaving(false)
    }
  }

  if (available.length === 0) {
    return (
      <div className="card grid place-items-center gap-3 p-16 text-center">
        <UtensilsCrossed size={40} className="text-slate-300" />
        <p className="text-slate-500">No available menu items yet.</p>
        <Link to="/business" className="btn-blue py-2.5 text-sm">Manage your menu</Link>
      </div>
    )
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
      {/* Menu */}
      <div className="card p-4">
        <div className="relative mb-3">
          <Search size={20} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input py-3.5 pl-11 text-base"
            placeholder="Search the menu…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Category chips — big, scrollable, touch-friendly */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                category === c ? 'bg-brand-navy text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="py-16 text-center text-slate-400">No items match.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {filtered.map((m) => (
              <button
                key={m.id}
                onClick={() => add(m)}
                className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 text-left transition active:scale-[0.97] hover:border-brand-blue hover:shadow-card"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
                  {m.image_url ? (
                    <img src={m.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-slate-300">
                      <UtensilsCrossed size={28} />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col justify-between p-3">
                  <span className="font-bold leading-tight text-brand-navy line-clamp-2">{m.name}</span>
                  <span className="mt-2 text-lg font-extrabold text-brand-blue">{money(m.price)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cart — sticky on wide screens */}
      <div className="card flex h-fit flex-col p-4 lg:sticky lg:top-4">
        <h2 className="mb-3 text-lg font-extrabold text-brand-navy">Current Bill</h2>
        <input
          className="input mb-3 py-3 text-base"
          placeholder="Customer name"
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
        />
        <div className="min-h-[120px] max-h-[42vh] divide-y divide-slate-100 overflow-y-auto">
          {cart.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">Tap a menu item to add it.</p>
          ) : (
            cart.map((i) => (
              <div key={i.item.id} className="flex items-center gap-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-brand-navy">{i.item.name}</p>
                  <p className="text-xs text-slate-500">{money(i.item.price)} × {i.qty}</p>
                </div>
                <button onClick={() => changeQty(i.item.id, -1)} className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-700 active:scale-90 hover:bg-slate-200"><Minus size={18} /></button>
                <span className="w-7 text-center text-lg font-bold">{i.qty}</span>
                <button onClick={() => changeQty(i.item.id, 1)} className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-700 active:scale-90 hover:bg-slate-200"><Plus size={18} /></button>
                <span className="w-24 text-right font-bold text-brand-navy">{money(i.item.price * i.qty)}</span>
                <button onClick={() => removeLine(i.item.id)} className="grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={16} /></button>
              </div>
            ))
          )}
        </div>

        <div className="mt-3 space-y-2.5 border-t border-slate-100 pt-3 text-base">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Subtotal</span>
            <span className="font-semibold text-brand-navy">{money(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Discount</span>
            <input className="input w-32 py-2 text-right text-base" type="number" min="0" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Paid</span>
            <input className="input w-32 py-2 text-right text-base" type="number" min="0" inputMode="decimal" value={paid} onChange={(e) => setPaid(e.target.value)} />
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
            <span className="text-xl font-extrabold text-brand-navy">TOTAL</span>
            <span className="text-2xl font-extrabold text-brand-blue">{money(total)}</span>
          </div>
        </div>

        <button onClick={checkout} disabled={saving} className="btn-blue mt-4 w-full py-4 text-lg">
          {saving ? <RefreshCw size={20} className="animate-spin" /> : <Receipt size={20} />}
          {saving ? 'Saving…' : 'Generate Invoice'}
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ Reports tab */

function ReportsTab({ company }) {
  const [date, setDate] = useState(todayStr())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = (d) => {
    setLoading(true)
    api.posReport(d).then(setData).catch((e) => alertErr(e)).finally(() => setLoading(false))
  }
  useEffect(() => { load(date) }, [date])

  const reprint = async (id) => {
    try {
      const { invoice } = await api.posInvoice(id)
      printReceipt(company?.company_name || 'POS', invoice)
    } catch (e) {
      alertErr(e)
    }
  }

  if (loading) return <div className="grid place-items-center py-24"><Spinner /></div>
  const s = data?.summary || {}

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-extrabold text-brand-navy">Daily Sales</h2>
        <input className="input w-auto py-2.5" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Invoices" value={s.invoice_count ?? 0} />
        <Stat label="Total Sales" value={money(s.total)} accent />
        <Stat label="Discounts" value={money(s.discount)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-3 font-bold text-brand-navy">Top Items</h3>
          {(data?.top_products || []).length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No sales.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.top_products.map((t, i) => (
                <li key={i} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-slate-700">{t.product_name}</span>
                  <span className="text-slate-500">Qty {t.qty} · {money(t.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-4">
          <h3 className="mb-3 font-bold text-brand-navy">Invoices</h3>
          {(data?.invoices || []).length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No invoices.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.invoices.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-semibold text-brand-navy">{inv.invoice_no}</p>
                    <p className="text-xs text-slate-500">{inv.customer_name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-brand-navy">{money(inv.total)}</span>
                    <button onClick={() => reprint(inv.id)} className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100" title="Print"><Printer size={18} /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold ${accent ? 'text-brand-green' : 'text-brand-navy'}`}>{value}</p>
    </div>
  )
}
