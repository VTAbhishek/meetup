import { useEffect, useRef, useState } from 'react'
import { ShieldCheck, RefreshCw } from 'lucide-react'
import { api } from '../api'

/**
 * OTP verification step.
 *
 * Props:
 *  - userId        : id returned by register.php
 *  - mobileMasked  : e.g. "******4567"
 *  - dialCode      : e.g. "+94"
 *  - resendIn      : initial cooldown seconds (30)
 *  - debugCode     : the code, present only in simulate/dev mode
 *  - accent        : 'blue' (customer) | 'green' (company) -> button style
 *  - onVerified    : (result) => void  called after a successful verify
 */
export default function OtpVerify({
  userId,
  mobileMasked,
  dialCode = '+94',
  resendIn = 30,
  debugCode = '',
  accent = 'blue',
  onVerified,
}) {
  const LEN = 6
  const [digits, setDigits] = useState(Array(LEN).fill(''))
  const [seconds, setSeconds] = useState(resendIn) // countdown to auto-enable resend
  const [busy, setBusy] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')
  const [hint, setHint] = useState(debugCode) // dev-mode current code
  const inputs = useRef([])

  // Countdown: tick every second down to 0. At 0 the Resend button auto-enables.
  useEffect(() => {
    if (seconds <= 0) return
    const id = setInterval(() => setSeconds((s) => (s <= 1 ? 0 : s - 1)), 1000)
    return () => clearInterval(id)
  }, [seconds])

  useEffect(() => {
    inputs.current[0]?.focus()
  }, [])

  const code = digits.join('')

  const setAt = (i, val) => {
    setDigits((d) => {
      const next = [...d]
      next[i] = val
      return next
    })
  }

  const onChange = (i) => (e) => {
    const v = e.target.value.replace(/\D/g, '')
    if (v === '') { setAt(i, ''); return }
    // Support fast typing / multi-char (e.g. autofill of one box).
    const chars = v.split('')
    setDigits((d) => {
      const next = [...d]
      let idx = i
      for (const c of chars) {
        if (idx >= LEN) break
        next[idx] = c
        idx++
      }
      return next
    })
    const nextIdx = Math.min(i + chars.length, LEN - 1)
    inputs.current[nextIdx]?.focus()
    setError('')
  }

  const onKeyDown = (i) => (e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus()
      setAt(i - 1, '')
    } else if (e.key === 'ArrowLeft' && i > 0) {
      inputs.current[i - 1]?.focus()
    } else if (e.key === 'ArrowRight' && i < LEN - 1) {
      inputs.current[i + 1]?.focus()
    }
  }

  const onPaste = (e) => {
    e.preventDefault()
    const text = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, LEN)
    if (!text) return
    const next = Array(LEN).fill('')
    text.split('').forEach((c, idx) => (next[idx] = c))
    setDigits(next)
    inputs.current[Math.min(text.length, LEN - 1)]?.focus()
  }

  const verify = async (e) => {
    e?.preventDefault()
    if (code.length !== LEN) {
      setError('Enter the 6-digit code.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await api.verifyOtp({ user_id: userId, code })
      onVerified?.(result)
    } catch (err) {
      setError(err.data?.error || err.message || 'Verification failed.')
      setDigits(Array(LEN).fill(''))
      inputs.current[0]?.focus()
      setBusy(false)
    }
  }

  const resend = async () => {
    if (seconds > 0 || resending) return
    setResending(true)
    setError('')
    try {
      const d = await api.sendOtp({ user_id: userId })
      setSeconds(d.resend_in || resendIn) // restart the 30s timer
      setDigits(Array(LEN).fill(''))
      if (d.otp_debug) setHint(d.otp_debug)
      inputs.current[0]?.focus()
    } catch (err) {
      // Server-side cooldown guard: honour retry_after if we somehow raced it.
      if (err.status === 429 && err.data?.retry_after) {
        setSeconds(err.data.retry_after)
      } else {
        setError(err.data?.error || 'Could not resend the code.')
      }
    } finally {
      setResending(false)
    }
  }

  const btn = accent === 'green' ? 'btn-green' : 'btn-blue'

  return (
    <div>
      <div className="mb-6 flex items-center gap-3 rounded-xl bg-brand-blueLight/10 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue">
          <ShieldCheck size={22} />
        </span>
        <p className="text-sm text-slate-600">
          We sent a 6-digit code to <strong className="text-brand-navy">{dialCode} {mobileMasked}</strong>.
          Enter it below to verify your mobile number.
        </p>
      </div>

      {hint && (
        <div className="mb-4 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-center text-sm text-amber-800">
          Dev/simulate mode — your code is <strong className="tracking-widest">{hint}</strong>
        </div>
      )}

      <form onSubmit={verify}>
        <div className="flex justify-center gap-2 sm:gap-3" onPaste={onPaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (inputs.current[i] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={onChange(i)}
              onKeyDown={onKeyDown(i)}
              className="h-12 w-11 rounded-xl border border-slate-300 text-center text-xl font-bold text-brand-navy focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20 sm:h-14 sm:w-12"
            />
          ))}
        </div>

        {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={busy || code.length !== LEN} className={`${btn} mt-6 w-full py-3`}>
          {busy ? 'Verifying…' : 'Verify & continue'}
        </button>
      </form>

      <div className="mt-5 text-center text-sm">
        {seconds > 0 ? (
          <p className="text-slate-500">
            Resend code in <span className="font-semibold text-brand-navy tabular-nums">{seconds}s</span>
          </p>
        ) : (
          <button
            type="button"
            onClick={resend}
            disabled={resending}
            className="inline-flex items-center gap-1.5 font-semibold text-brand-blue hover:underline disabled:opacity-60"
          >
            <RefreshCw size={15} className={resending ? 'animate-spin' : ''} />
            {resending ? 'Sending…' : 'Resend code'}
          </button>
        )}
      </div>
    </div>
  )
}
