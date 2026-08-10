/**
 * Build a short animated cover "video" from the company's cover images entirely
 * in the browser, recorded from a <canvas> with MediaRecorder into a
 * seamless-looping WebM Blob.
 *
 * Template: "Luxe Glide" — no zooming. Images keep a constant framing and
 * glide gently across the frame; slides change with a soft diagonal light-sweep
 * wipe; floating bokeh light particles, a soft colour grade, film grain and a
 * vignette sit on top for a premium, cinematic feel.
 *
 * Runs in real time (a 10s clip takes ~10s), reporting progress via onProgress.
 * Cover images must be CORS-readable (uploads/.htaccess enables this) or the
 * canvas would taint and recording would fail.
 */

const SCALE = 1.08 // constant framing — images glide, never zoom

// Glide directions (fractions of the spare margin), cycled per image.
const PANS = [
  { fx: -0.8, fy: -0.25, tx: 0.8, ty: 0.25 },
  { fx: 0.8, fy: 0.25, tx: -0.8, ty: -0.25 },
  { fx: -0.8, fy: 0.3, tx: 0.8, ty: -0.3 },
  { fx: 0.8, fy: -0.3, tx: -0.8, ty: 0.3 },
]

// Wipe directions (start → end, in unit coords), cycled per cut.
const WIPES = [
  { x0: 0, y0: 0, x1: 1, y1: 1 }, // top-left → bottom-right
  { x0: 1, y0: 0, x1: 0, y1: 1 }, // top-right → bottom-left
  { x0: 0, y0: 0.5, x1: 1, y1: 0.5 }, // left → right
  { x0: 0.5, y0: 1, x1: 0.5, y1: 0 }, // bottom → top
]

const TWO_PI = Math.PI * 2
const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2)
const c01 = (v) => Math.max(0, Math.min(1, v))

function loadImage(url) {
  return new Promise((res, rej) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => res(img)
    img.onerror = () => rej(new Error('Could not load a cover image for the video.'))
    // Cache-buster: a plain <img> elsewhere may have cached this file WITHOUT
    // CORS headers; a fresh URL forces a proper cross-origin fetch so the canvas
    // stays untainted.
    img.src = url + (url.includes('?') ? '&' : '?') + 'cors=' + Date.now()
  })
}

function makeNoiseCanvas(size = 220) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const cx = c.getContext('2d')
  const id = cx.createImageData(size, size)
  for (let i = 0; i < id.data.length; i += 4) {
    const v = (Math.random() * 255) | 0
    id.data[i] = id.data[i + 1] = id.data[i + 2] = v
    id.data[i + 3] = 255
  }
  cx.putImageData(id, 0, 0)
  return c
}

/** Floating bokeh orbs whose motion is periodic over the clip, so the loop stays seamless. */
function makeOrbs(count = 16) {
  return Array.from({ length: count }, () => ({
    bx: Math.random(),
    by: Math.random(),
    r: 14 + Math.random() * 54,
    ax: 0.04 + Math.random() * 0.08,
    ay: 0.05 + Math.random() * 0.1,
    kx: 1 + Math.floor(Math.random() * 2),
    ky: 1 + Math.floor(Math.random() * 2),
    ka: 1 + Math.floor(Math.random() * 3),
    phx: Math.random() * TWO_PI,
    phy: Math.random() * TWO_PI,
    pha: Math.random() * TWO_PI,
    warm: Math.random() < 0.65,
    a: 0.1 + Math.random() * 0.16,
  }))
}

function pickMime() {
  const opts = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  if (typeof MediaRecorder === 'undefined') return null
  return opts.find((m) => MediaRecorder.isTypeSupported(m)) || null
}

export async function generateCoverVideo(imageUrls, opts = {}) {
  const {
    width = 1600,
    height = 600, // 8:3, matches the cover banner
    fps = 30,
    perImage = 3.5, // seconds each image is featured
    fade = 1.1, // wipe seconds
    onProgress,
  } = opts

  const urls = (imageUrls || []).filter(Boolean)
  if (!urls.length) throw new Error('Add at least one cover image first.')

  const mime = pickMime()
  if (!mime) throw new Error('This browser cannot record video (WebM/MediaRecorder unsupported). Try Chrome.')

  const imgs = await Promise.all(urls.map(loadImage))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  const off = document.createElement('canvas')
  off.width = width
  off.height = height
  const octx = off.getContext('2d')
  const noise = makeNoiseCanvas()
  const orbs = makeOrbs()

  const total = perImage * imgs.length // clip loops back into the first image
  const stream = canvas.captureStream(fps)
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 })
  const chunks = []
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data)
  }

  // Draw one image at constant scale, glided along its pan path (no zoom).
  const drawSlide = (tctx, img, idx, p, alpha = 1) => {
    const pan = PANS[idx % PANS.length]
    const e = easeInOut(c01(p))
    const base = Math.max(width / img.naturalWidth, height / img.naturalHeight)
    const s = base * SCALE
    const dw = img.naturalWidth * s
    const dh = img.naturalHeight * s
    const mx = (dw - width) / 2
    const my = (dh - height) / 2
    const px = pan.fx + (pan.tx - pan.fx) * e
    const py = pan.fy + (pan.ty - pan.fy) * e
    let dx = (width - dw) / 2 + px * mx
    let dy = (height - dh) / 2 + py * my
    dx = Math.min(0, Math.max(width - dw, dx))
    dy = Math.min(0, Math.max(height - dh, dy))
    tctx.globalAlpha = alpha
    tctx.drawImage(img, dx, dy, dw, dh)
    tctx.globalAlpha = 1
  }

  // Reveal the next image behind a soft diagonal wipe with a light streak edge.
  const drawWipe = (nextImg, nextIdx, a, wipeIdx) => {
    const w = WIPES[wipeIdx % WIPES.length]
    const gx0 = w.x0 * width
    const gy0 = w.y0 * height
    const gx1 = w.x1 * width
    const gy1 = w.y1 * height
    const soft = 0.18
    const lead = a * (1 + soft)

    // Masked copy of the incoming image.
    octx.clearRect(0, 0, width, height)
    octx.globalCompositeOperation = 'source-over'
    drawSlide(octx, nextImg, nextIdx, 0)
    const mask = octx.createLinearGradient(gx0, gy0, gx1, gy1)
    let s1 = c01(lead - soft)
    let s2 = c01(lead)
    if (s2 <= s1) s2 = Math.min(1, s1 + 0.001)
    mask.addColorStop(0, 'rgba(0,0,0,1)')
    if (s1 > 0) mask.addColorStop(s1, 'rgba(0,0,0,1)')
    mask.addColorStop(s2, 'rgba(0,0,0,0)')
    mask.addColorStop(1, 'rgba(0,0,0,0)')
    octx.globalCompositeOperation = 'destination-in'
    octx.fillStyle = mask
    octx.fillRect(0, 0, width, height)
    ctx.drawImage(off, 0, 0)

    // Bright streak riding the wipe edge.
    if (a > 0.02 && a < 0.98) {
      const mid = c01(lead - soft / 2)
      const streak = ctx.createLinearGradient(gx0, gy0, gx1, gy1)
      streak.addColorStop(c01(mid - 0.05), 'rgba(255,255,255,0)')
      streak.addColorStop(mid, 'rgba(255,240,220,0.45)')
      streak.addColorStop(c01(mid + 0.05), 'rgba(255,255,255,0)')
      ctx.globalCompositeOperation = 'screen'
      ctx.fillStyle = streak
      ctx.fillRect(0, 0, width, height)
      ctx.globalCompositeOperation = 'source-over'
    }
  }

  const drawOverlays = (t) => {
    // Soft colour grade.
    const gg = ctx.createLinearGradient(0, 0, width, height)
    gg.addColorStop(0, 'rgba(79,124,255,0.20)')
    gg.addColorStop(0.5, 'rgba(168,85,247,0.10)')
    gg.addColorStop(1, 'rgba(34,197,94,0.16)')
    ctx.globalCompositeOperation = 'soft-light'
    ctx.fillStyle = gg
    ctx.fillRect(0, 0, width, height)

    // Floating bokeh particles (periodic over the clip → seamless loop).
    ctx.globalCompositeOperation = 'screen'
    for (const o of orbs) {
      const x = (o.bx + o.ax * Math.sin(TWO_PI * o.kx * (t / total) + o.phx)) * width
      const y = (o.by + o.ay * Math.sin(TWO_PI * o.ky * (t / total) + o.phy)) * height
      const al = o.a * (0.55 + 0.45 * Math.sin(TWO_PI * o.ka * (t / total) + o.pha))
      const g = ctx.createRadialGradient(x, y, 0, x, y, o.r)
      const c = o.warm ? '255,214,170' : '170,200,255'
      g.addColorStop(0, `rgba(${c},${al.toFixed(3)})`)
      g.addColorStop(1, `rgba(${c},0)`)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, o.r, 0, TWO_PI)
      ctx.fill()
    }

    // Film grain (kept subtle).
    ctx.globalCompositeOperation = 'overlay'
    ctx.globalAlpha = 0.05
    ctx.drawImage(noise, -((Math.random() * 100) | 0), -((Math.random() * 100) | 0), width + 200, height + 200)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'

    // Vignette.
    const vg = ctx.createRadialGradient(width / 2, height / 2, height * 0.3, width / 2, height / 2, width * 0.72)
    vg.addColorStop(0, 'rgba(0,0,0,0)')
    vg.addColorStop(1, 'rgba(0,0,0,0.35)')
    ctx.fillStyle = vg
    ctx.fillRect(0, 0, width, height)
  }

  const drawFrame = (t) => {
    const tt = ((t % total) + total) % total
    const k = Math.floor(tt / perImage) % imgs.length
    const p = (tt - k * perImage) / perImage
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, width, height)
    drawSlide(ctx, imgs[k], k, p)
    // Wipe in the next image (loops into the first) during the tail.
    const tailStart = 1 - fade / perImage
    if (p > tailStart && imgs.length > 1) {
      const a = (p - tailStart) / (fade / perImage)
      drawWipe(imgs[(k + 1) % imgs.length], (k + 1) % imgs.length, easeInOut(a), k)
    }
    drawOverlays(t)
  }

  return await new Promise((resolve, reject) => {
    recorder.onerror = (e) => reject(e.error || new Error('Recording failed.'))
    recorder.onstop = () => {
      stream.getTracks().forEach((tr) => tr.stop())
      resolve(new Blob(chunks, { type: mime.split(';')[0] }))
    }

    let start = null
    const frame = (now) => {
      if (start === null) start = now
      const t = (now - start) / 1000
      drawFrame(t)
      if (onProgress) onProgress(Math.min(0.99, t / total))
      if (t >= total) {
        recorder.stop()
        return
      }
      requestAnimationFrame(frame)
    }

    recorder.start()
    requestAnimationFrame(frame)
  })
}
