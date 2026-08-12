/**
 * The bell that rings when an order arrives.
 *
 * Synthesised with the Web Audio API rather than shipped as an mp3: it is a few
 * hundred bytes of code instead of an asset to download, it can't 404, and it
 * works offline on a till behind the counter.
 */

let ctx = null
let armed = false

function audio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  if (!ctx) ctx = new Ctx()
  return ctx
}

/**
 * Browsers refuse to make noise until the page has been interacted with, and a
 * dashboard left open on a counter may sit untouched for hours. Resuming the
 * context on the first click or keypress means the first real order is heard,
 * rather than being the interaction that unlocks the sound.
 */
export function armChime() {
  if (armed) return
  armed = true
  const wake = () => {
    audio()?.resume?.().catch(() => {})
    window.removeEventListener('pointerdown', wake)
    window.removeEventListener('keydown', wake)
  }
  window.addEventListener('pointerdown', wake, { once: true })
  window.addEventListener('keydown', wake, { once: true })
}

/** One strike of the bell: a struck tone plus its fifth, decaying together. */
function strike(ac, at, freq, gain) {
  const osc = ac.createOscillator()
  const vol = ac.createGain()

  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, at)

  // A real bell is loud immediately and fades; a linear ramp sounds like a
  // buzzer, so the decay is exponential.
  vol.gain.setValueAtTime(0.0001, at)
  vol.gain.exponentialRampToValueAtTime(gain, at + 0.008)
  vol.gain.exponentialRampToValueAtTime(0.0001, at + 1.1)

  osc.connect(vol).connect(ac.destination)
  osc.start(at)
  osc.stop(at + 1.2)
}

/**
 * Ring twice, a beat apart — a single ding is easy to mistake for a system
 * sound, two reads as "someone is calling you".
 */
export function playChime(volume = 0.35) {
  const ac = audio()
  if (!ac) return
  // Still blocked (no interaction yet): stay silent rather than throwing.
  if (ac.state === 'suspended') ac.resume().catch(() => {})
  if (ac.state !== 'running') return

  const t = ac.currentTime
  for (const offset of [0, 0.18]) {
    strike(ac, t + offset, 880, volume)        // A5
    strike(ac, t + offset, 1318.5, volume * 0.5) // E6, the fifth above
  }
}
