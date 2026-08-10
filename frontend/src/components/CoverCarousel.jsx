import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion'

/**
 * Auto-playing cinematic cover — turns the company's cover images into a
 * self-running "video" montage (no manual slider). Each image is shown in turn
 * with a *different* editing cut, a continuous gentle glide (constant scale —
 * no zooming), cursor parallax and film-style overlays, plus a video-like
 * progress bar. All via
 * framer-motion + CSS — no real video file and no extra plugin.
 *
 * Props:
 *  - images      : [url, …]
 *  - interval    : ms each image plays (default 3000)
 *  - heightClass : Tailwind height classes for the banner
 */

// Glides — constant scale (no zoom in/out), the image only drifts gently.
const KEN_BURNS = [
  { from: { scale: 1.12, x: '-2.5%', y: '-1.5%' }, to: { scale: 1.12, x: '2.5%', y: '1.5%' } },
  { from: { scale: 1.12, x: '2.5%', y: '1.5%' }, to: { scale: 1.12, x: '-2.5%', y: '-1.5%' } },
  { from: { scale: 1.12, x: '2.5%', y: '-1.5%' }, to: { scale: 1.12, x: '-2.5%', y: '1.5%' } },
  { from: { scale: 1.12, x: '-2.5%', y: '1.5%' }, to: { scale: 1.12, x: '2.5%', y: '-1.5%' } },
]

// Editing "cuts" — the transition each image enters/leaves with (no zooming).
// Cycled so the montage never repeats the same move twice in a row.
const CUTS = [
  { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, d: 0.9 }, // crossfade
  { initial: { opacity: 0, x: '35%' }, animate: { opacity: 1, x: '0%' }, exit: { opacity: 0, x: '-22%' }, d: 0.8 }, // slide
  { initial: { opacity: 0, y: '18%' }, animate: { opacity: 1, y: '0%' }, exit: { opacity: 0, y: '-12%' }, d: 0.8 }, // rise
  { initial: { opacity: 0, x: '16%', filter: 'blur(16px)' }, animate: { opacity: 1, x: '0%', filter: 'blur(0px)' }, exit: { opacity: 0, x: '-16%', filter: 'blur(16px)' }, d: 0.7 }, // whip/blur
  { initial: { opacity: 0, y: '10%', rotate: 2 }, animate: { opacity: 1, y: '0%', rotate: 0 }, exit: { opacity: 0, y: '-6%', rotate: -2 }, d: 0.9 }, // swing
]

// Tiny fractal-noise SVG used as an animated film-grain texture.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

export default function CoverCarousel({ images = [], interval = 3000, heightClass = 'h-72 sm:h-96' }) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduce = useReducedMotion()
  const boxRef = useRef(null)

  // Cursor-driven 3D parallax (springed for smoothness).
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const sx = useSpring(mx, { stiffness: 120, damping: 18, mass: 0.4 })
  const sy = useSpring(my, { stiffness: 120, damping: 18, mass: 0.4 })
  const rotateY = useTransform(sx, [-0.5, 0.5], [5, -5])
  const rotateX = useTransform(sy, [-0.5, 0.5], [-5, 5])
  const tx = useTransform(sx, [-0.5, 0.5], ['14px', '-14px'])
  const ty = useTransform(sy, [-0.5, 0.5], ['14px', '-14px'])

  const onMove = (e) => {
    if (reduce || !boxRef.current) return
    const r = boxRef.current.getBoundingClientRect()
    mx.set((e.clientX - r.left) / r.width - 0.5)
    my.set((e.clientY - r.top) / r.height - 0.5)
  }
  const resetTilt = () => {
    mx.set(0)
    my.set(0)
  }

  useEffect(() => {
    if (images.length <= 1 || paused) return
    const id = setInterval(() => setI((p) => (p + 1) % images.length), interval)
    return () => clearInterval(id)
  }, [images.length, interval, paused])

  if (!images.length) return null

  const kb = KEN_BURNS[i % KEN_BURNS.length]
  const cut = reduce ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, d: 0.5 } : CUTS[i % CUTS.length]
  const kbDuration = Math.max(7, interval / 1000 + 1.2)

  return (
    <div
      ref={boxRef}
      className={`group relative isolate w-full overflow-hidden bg-slate-900 ${heightClass}`}
      style={{ perspective: 1200 }}
      onMouseEnter={() => setPaused(true)}
      onMouseMove={onMove}
      onMouseLeave={() => {
        setPaused(false)
        resetTilt()
      }}
    >
      {/* Parallax tilt layer — enlarged so the tilt never exposes edges. */}
      <motion.div
        className="absolute inset-0"
        style={reduce ? undefined : { rotateX, rotateY, x: tx, y: ty, scale: 1.06, transformStyle: 'preserve-3d' }}
      >
        <AnimatePresence>
          {/* Cut layer — the transition between images. */}
          <motion.div
            key={i}
            className="absolute inset-0"
            initial={cut.initial}
            animate={cut.animate}
            exit={cut.exit}
            transition={{ duration: cut.d, ease: 'easeInOut' }}
          >
            {/* Ken Burns layer — continuous motion while the image plays. */}
            <motion.img
              src={images[i]}
              alt=""
              className="absolute inset-0 h-full w-full object-cover will-change-transform"
              initial={reduce ? false : kb.from}
              animate={reduce ? undefined : kb.to}
              transition={reduce ? undefined : { duration: kbDuration, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' }}
            />
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* --- Cinematic "video-like" overlays (skipped for reduced-motion) --- */}
      {!reduce && (
        <>
          {/* Slow-shifting color wash */}
          <motion.div
            className="pointer-events-none absolute inset-0 z-[2] opacity-40 mix-blend-soft-light"
            style={{ backgroundImage: 'linear-gradient(120deg, #4f7cff, #a855f7, #22c55e, #4f7cff)', backgroundSize: '300% 300%' }}
            animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
            transition={{ duration: 18, ease: 'easeInOut', repeat: Infinity }}
          />
          {/* Warm light-leak glow drifting across, like a lens flare */}
          <motion.div
            className="pointer-events-none absolute z-[3] mix-blend-screen"
            style={{ inset: '-25%', background: 'radial-gradient(closest-side, rgba(255,196,140,0.55), rgba(255,120,80,0.18), transparent 72%)' }}
            initial={{ x: '-30%', y: '-10%' }}
            animate={{ x: ['-30%', '40%', '5%', '-30%'], y: ['-10%', '20%', '45%', '-10%'], opacity: [0.35, 0.65, 0.4, 0.35] }}
            transition={{ duration: 15, ease: 'easeInOut', repeat: Infinity }}
          />
          {/* Animated film grain */}
          <motion.div
            className="pointer-events-none absolute inset-0 z-[4] opacity-[0.13] mix-blend-overlay"
            style={{ backgroundImage: GRAIN, backgroundSize: '150px 150px' }}
            animate={{ backgroundPosition: ['0px 0px', '30px -20px', '-24px 26px', '16px 12px', '0px 0px'] }}
            transition={{ duration: 0.5, ease: 'linear', repeat: Infinity }}
          />
        </>
      )}

      {/* Soft vignette so overlaid controls/text stay legible. */}
      <div className="pointer-events-none absolute inset-0 z-[6] bg-gradient-to-t from-black/30 via-transparent to-transparent" />

      {/* Video-style playhead: one segment per image (fills as it plays). */}
      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 z-10 flex w-[min(70%,440px)] -translate-x-1/2 gap-1.5">
          {images.map((_, idx) => (
            <div key={idx} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
              <motion.div
                className="h-full rounded-full bg-white"
                initial={false}
                animate={{ width: idx < i ? '100%' : idx === i ? '100%' : '0%' }}
                transition={{ duration: idx === i && !paused ? interval / 1000 : 0.25, ease: idx === i ? 'linear' : 'easeOut' }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
