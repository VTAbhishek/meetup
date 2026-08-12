import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import { X, Printer, Download, QrCode as QrIcon } from 'lucide-react'
import { alertErr } from '../alerts'
import Spinner from './Spinner'

/**
 * The link a table's printed QR code carries: the guest ordering page for that
 * exact table.
 *
 * Built from the address the dashboard is actually being served from, so the
 * same code works on localhost, on a LAN IP and in production without any
 * configuration. The hash is deliberate — the app routes on it.
 */
export function tableQrUrl(token) {
  const { origin, pathname } = window.location
  return `${origin}${pathname}#/t/${token}`
}

/** Rendered at 1000px so the printed 55mm square stays crisp (~460 dpi). */
const qrPng = (text) =>
  QRCode.toDataURL(text, { width: 1000, margin: 0, errorCorrectionLevel: 'Q', color: { dark: '#1e1b4b', light: '#ffffff' } })

/**
 * One 10 × 10 cm card: hotel name, the table's QR code, and the table number.
 *
 * Every dimension is in millimetres rather than pixels, so what the preview
 * shows and what leaves the printer are the same size.
 */
function QrCard({ companyName, table, dataUrl }) {
  return (
    <div className="qr-card">
      <div className="qr-card-inner">
        <p className="qr-card-hotel">{companyName}</p>
        <div className="qr-card-qr">
          {dataUrl ? <img src={dataUrl} alt={`QR code for table ${table.table_no}`} /> : null}
        </div>
        <p className="qr-card-table">Table {table.table_no}</p>
        <p className="qr-card-meta">
          {table.category} · {table.seats} {table.seats === 1 ? 'seat' : 'seats'}
        </p>
        <p className="qr-card-hint">Scan to reserve this table</p>
      </div>
    </div>
  )
}

/**
 * Preview-and-print dialog for table QR cards.
 *
 * Printing goes through the browser's own dialog rather than a PDF library: the
 * page is already laid out in millimetres, and "Save as PDF" there produces a
 * true 100 × 100 mm file while also allowing a direct print. Pass one table or
 * many — many prints one card per page.
 */
export default function TableQrModal({ company, tables, onClose }) {
  const [codes, setCodes] = useState(null)   // { [tableId]: dataUrl }
  const many = tables.length > 1

  useEffect(() => {
    let alive = true
    Promise.all(tables.map((t) => qrPng(tableQrUrl(t.qr_token))))
      .then((urls) => {
        if (!alive) return
        setCodes(Object.fromEntries(tables.map((t, i) => [t.id, urls[i]])))
      })
      .catch((e) => { if (alive) alertErr(e, 'Could not build the QR code.') })
    return () => { alive = false }
  }, [tables])

  // A stray Escape shouldn't leave the print-only markup in the document.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  /** Save a single card's QR as a PNG, for menus, table talkers and the like. */
  const download = (t) => {
    const a = document.createElement('a')
    a.href = codes[t.id]
    a.download = `qr-table-${t.table_no}.png`.replace(/\s+/g, '-')
    a.click()
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-cardHover"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-extrabold text-brand-navy">
                <QrIcon size={18} className="text-brand-green" />
                {many ? `QR cards (${tables.length})` : `Table ${tables[0].table_no} QR`}
              </h3>
              <p className="text-xs text-slate-500">
                Prints at 10 × 10 cm{many ? ', one card per page' : ''}. Choose “Save as PDF” in the print dialog for a PDF.
              </p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-brand-silver p-6">
            {!codes ? (
              <Spinner />
            ) : (
              <div className="flex flex-col items-center gap-4">
                {tables.map((t) => (
                  <QrCard key={t.id} companyName={company.company_name} table={t} dataUrl={codes[t.id]} />
                ))}
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
            {!many && (
              <button onClick={() => download(tables[0])} disabled={!codes} className="btn-ghost py-2 text-sm disabled:opacity-50">
                <Download size={16} /> PNG
              </button>
            )}
            <button onClick={() => window.print()} disabled={!codes} className="btn-blue py-2 text-sm disabled:opacity-50">
              <Printer size={16} /> Print {many ? `${tables.length} cards` : 'card'}
            </button>
          </div>
        </div>
      </div>

      {/* The only thing the printer sees — a direct child of <body>, which is
          what the print stylesheet keys off to hide the rest of the page. */}
      {codes &&
        createPortal(
          <div className="qr-print-root">
            {tables.map((t) => (
              <QrCard key={t.id} companyName={company.company_name} table={t} dataUrl={codes[t.id]} />
            ))}
          </div>,
          document.body
        )}
    </>
  )
}
