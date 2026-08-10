import { useEffect, useRef, useState } from 'react'
import { X, ZoomIn, Check } from 'lucide-react'

/**
 * Cover-image crop modal. Lets the business owner frame an uploaded image to the
 * cover banner's aspect ratio (drag to reposition, slider to zoom) before it is
 * saved, so the picture is never awkwardly cut off by `object-cover` on display.
 *
 * Props:
 *  - file     : the selected File (image)
 *  - onCancel : () => void
 *  - onDone   : (croppedFile: File) => void   // JPEG cropped to the given ratio
 *  - aspect   : crop ratio (default 8/3 = cover banner). e.g. 1 for a square.
 *  - outputW  : exported width in px (default 1600)
 *  - title/hint : optional modal copy overrides
 */
const DEFAULT_ASPECT = 8 / 3 // cover banner ratio (~2.67:1), matches the public page
const FRAME_W = 520          // on-screen crop-frame width in px

export default function CoverCropper({
  file,
  onCancel,
  onDone,
  aspect = DEFAULT_ASPECT,
  outputW = 1600,
  title = 'Position your cover',
  hint = 'Drag to reposition and zoom to frame the image. It will be cropped to the cover size.',
}) {
  const ASPECT = aspect
  const OUTPUT_W = outputW
  const [src, setSrc] = useState('')
  const [img, setImg] = useState(null) // loaded HTMLImageElement (natural size)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 }) // image top-left within the frame
  const [busy, setBusy] = useState(false)
  const drag = useRef(null)

  const frameW = FRAME_W
  const frameH = Math.round(FRAME_W / ASPECT)

  // Load the file so we can read its natural dimensions.
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    const image = new Image()
    image.onload = () => setImg(image)
    image.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  // "Cover" base scale: the image always fills the frame with no gaps.
  const baseScale = img ? Math.max(frameW / img.naturalWidth, frameH / img.naturalHeight) : 1
  const scale = baseScale * zoom
  const dispW = img ? img.naturalWidth * scale : 0
  const dispH = img ? img.naturalHeight * scale : 0

  // Keep the image covering the frame (edges never move inside it).
  const clampAt = (s, p) => {
    if (!img) return p
    const w = img.naturalWidth * s
    const h = img.naturalHeight * s
    return {
      x: Math.min(0, Math.max(frameW - w, p.x)),
      y: Math.min(0, Math.max(frameH - h, p.y)),
    }
  }

  // Center the image once it loads.
  useEffect(() => {
    if (!img) return
    const s = baseScale // zoom is 1 here
    setPos({ x: (frameW - img.naturalWidth * s) / 2, y: (frameH - img.naturalHeight * s) / 2 })
  }, [img]) // eslint-disable-line react-hooks/exhaustive-deps

  const onZoom = (nextZoom) => {
    const prevScale = baseScale * zoom
    const nextScale = baseScale * nextZoom
    const cx = frameW / 2
    const cy = frameH / 2
    setPos((p) =>
      clampAt(nextScale, {
        x: cx - (cx - p.x) * (nextScale / prevScale),
        y: cy - (cy - p.y) * (nextScale / prevScale),
      })
    )
    setZoom(nextZoom)
  }

  const onPointerDown = (e) => {
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e) => {
    if (!drag.current) return
    setPos(
      clampAt(scale, {
        x: drag.current.ox + (e.clientX - drag.current.sx),
        y: drag.current.oy + (e.clientY - drag.current.sy),
      })
    )
  }
  const onPointerUp = () => {
    drag.current = null
  }

  const apply = async () => {
    if (!img) return
    setBusy(true)
    try {
      const outW = OUTPUT_W
      const outH = Math.round(OUTPUT_W / ASPECT)
      const canvas = document.createElement('canvas')
      canvas.width = outW
      canvas.height = outH
      const ctx = canvas.getContext('2d')
      // The frame maps onto this source rectangle in natural image coordinates.
      const sx = -pos.x / scale
      const sy = -pos.y / scale
      ctx.drawImage(img, sx, sy, frameW / scale, frameH / scale, 0, 0, outW, outH)
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.9))
      const base = (file.name || 'cover').replace(/\.[^.]+$/, '')
      onDone(new File([blob], `${base}-cover.jpg`, { type: 'image/jpeg' }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onPointerUp={onPointerUp}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-brand-navy">{title}</h3>
          <button onClick={onCancel} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <p className="mb-3 text-sm text-slate-500">{hint}</p>

        <div className="flex justify-center">
          <div
            className="relative touch-none select-none overflow-hidden rounded-lg bg-slate-900 ring-1 ring-slate-200"
            style={{ width: frameW, height: frameH, cursor: drag.current ? 'grabbing' : 'grab' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
          >
            {src && (
              <img
                src={src}
                alt=""
                draggable={false}
                style={{ position: 'absolute', left: pos.x, top: pos.y, width: dispW, height: dispH, maxWidth: 'none' }}
              />
            )}
            {/* subtle framing guides */}
            <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/30" />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <ZoomIn size={16} className="shrink-0 text-slate-400" />
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(e) => onZoom(Number(e.target.value))}
            className="w-full accent-brand-blue"
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="btn-ghost py-2 text-sm">Cancel</button>
          <button onClick={apply} disabled={!img || busy} className="btn-green py-2 text-sm">
            {busy ? 'Saving…' : (<><Check size={15} /> Use this crop</>)}
          </button>
        </div>
      </div>
    </div>
  )
}
