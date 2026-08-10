import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { api } from '../api'
import { AuthShell, Field } from '../components/AuthShell'
import MobileField from '../components/MobileField'
import OtpVerify from '../components/OtpVerify'
import { DEFAULT_DIAL } from '../countryCodes'

export default function Register() {
  const [form, setForm] = useState({
    full_name: '', username: '', email: '', password: '', confirm: '',
    dial_code: DEFAULT_DIAL, mobile: '',
  })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState('form') // 'form' | 'otp' | 'done'
  const [otp, setOtp] = useState(null)      // payload from register.php

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setErrors({})
    if (form.password !== form.confirm) {
      setErrors({ confirm: 'Passwords do not match.' })
      return
    }
    if (!/^\d{10}$/.test(form.mobile)) {
      setErrors({ mobile: 'Mobile number must be exactly 10 digits.' })
      return
    }
    setBusy(true)
    try {
      const res = await api.register({
        role: 'customer',
        full_name: form.full_name,
        username: form.username,
        email: form.email,
        password: form.password,
        dial_code: form.dial_code,
        mobile: form.mobile,
      })
      setOtp(res)
      setStep('otp')
    } catch (err) {
      setErrors(err.data?.errors || { full_name: err.message })
    } finally {
      setBusy(false)
    }
  }

  if (step === 'otp' && otp) {
    return (
      <AuthShell variant="customer" title="Verify your mobile" subtitle="One quick step to secure your account.">
        <OtpVerify
          userId={otp.user_id}
          mobileMasked={otp.mobile_masked}
          dialCode={otp.dial_code}
          resendIn={otp.resend_in}
          debugCode={otp.otp_debug}
          accent="blue"
          onVerified={() => setStep('done')}
        />
        <p className="mt-6 text-center text-sm">
          <button onClick={() => setStep('form')} className="text-slate-400 hover:underline">← Edit details</button>
        </p>
      </AuthShell>
    )
  }

  if (step === 'done') {
    return (
      <AuthShell variant="customer" title="Mobile verified" subtitle="You're all set!">
        <div className="flex items-start gap-3 rounded-xl bg-green-50 p-4 text-sm text-green-800">
          <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
          <span>
            Your mobile number is verified. Your account is now <strong>pending admin approval</strong> —
            you'll be able to log in once an administrator activates it.
          </span>
        </div>
        <Link to="/login" className="btn-blue mt-6 w-full py-3">Go to login</Link>
        <p className="mt-3 text-center text-sm"><Link to="/" className="text-slate-400 hover:underline">← Back to home</Link></p>
      </AuthShell>
    )
  }

  return (
    <AuthShell variant="customer" title="Create your account" subtitle="Review the companies you trust.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name">
          <input className="input" value={form.full_name} onChange={set('full_name')} required />
          {errors.full_name && <Err>{errors.full_name}</Err>}
        </Field>
        <Field label="Username">
          <input className="input" value={form.username} onChange={set('username')} placeholder="Used to log in" required />
          {errors.username && <Err>{errors.username}</Err>}
        </Field>
        <Field label="Email">
          <input type="email" className="input" value={form.email} onChange={set('email')} required />
          {errors.email && <Err>{errors.email}</Err>}
        </Field>
        <Field label="Mobile number">
          <MobileField
            dial={form.dial_code}
            mobile={form.mobile}
            onDial={(d) => setForm((f) => ({ ...f, dial_code: d }))}
            onMobile={(m) => setForm((f) => ({ ...f, mobile: m }))}
            error={errors.mobile || errors.dial_code}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Password">
            <input type="password" className="input" value={form.password} onChange={set('password')} required />
            {errors.password && <Err>{errors.password}</Err>}
          </Field>
          <Field label="Confirm">
            <input type="password" className="input" value={form.confirm} onChange={set('confirm')} required />
            {errors.confirm && <Err>{errors.confirm}</Err>}
          </Field>
        </div>
        <button type="submit" disabled={busy} className="btn-blue w-full py-3">
          {busy ? 'Sending code…' : 'Create account'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-brand-blue hover:underline">Log in</Link>
      </p>
      <p className="mt-2 text-center text-sm">
        <Link to="/" className="text-slate-400 hover:underline">← Back to home</Link>
      </p>
    </AuthShell>
  )
}

function Err({ children }) {
  return <p className="mt-1 text-sm text-red-600">{children}</p>
}
