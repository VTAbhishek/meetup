import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { api } from '../api'
import { AuthShell, Field } from '../components/AuthShell'
import MobileField from '../components/MobileField'
import OtpVerify from '../components/OtpVerify'
import DistrictCityPicker from '../components/DistrictCityPicker'
import { useLocationCtx } from '../location'
import { DEFAULT_DIAL } from '../countryCodes'

export default function BusinessRegister() {
  const { districts } = useLocationCtx()
  const [form, setForm] = useState({
    company_name: '', website: '', category: '', address: '',
    district_id: '', city_id: '',
    dial_code: DEFAULT_DIAL, mobile: '',
    full_name: '', username: '', email: '', password: '', confirm: '',
  })
  const [categories, setCategories] = useState([])
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState('form') // 'form' | 'otp' | 'done'
  const [otp, setOtp] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    api.categories().then((d) => setCategories(d.categories)).catch(() => {})
  }, [])

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
    if (!form.district_id) { setErrors({ district_id: 'Please select a district.' }); return }
    if (!form.city_id)     { setErrors({ city_id: 'Please select a city.' }); return }
    setBusy(true)
    try {
      const res = await api.register({
        role: 'company',
        company_name: form.company_name,
        website: form.website,
        category: form.category,
        address: form.address,
        district_id: Number(form.district_id),
        city_id: Number(form.city_id),
        dial_code: form.dial_code,
        mobile: form.mobile,
        full_name: form.full_name,
        username: form.username,
        email: form.email,
        password: form.password,
      })
      setOtp(res)
      setStep('otp')
    } catch (err) {
      setErrors(err.data?.errors || { company_name: err.message })
    } finally {
      setBusy(false)
    }
  }

  if (step === 'otp' && otp) {
    return (
      <AuthShell variant="company" title="Verify your mobile" subtitle="One quick step to secure your account.">
        <OtpVerify
          userId={otp.user_id}
          mobileMasked={otp.mobile_masked}
          dialCode={otp.dial_code}
          resendIn={otp.resend_in}
          debugCode={otp.otp_debug}
          accent="green"
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
      <AuthShell variant="company" title="Mobile verified" subtitle="You're all set!">
        <div className="flex items-start gap-3 rounded-xl bg-green-50 p-4 text-sm text-green-800">
          <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
          <span>
            Your mobile number is verified. Your company is now <strong>pending admin approval</strong>.
            Once an administrator activates it, you can log in and your profile becomes visible.
          </span>
        </div>
        <Link to="/business/login" className="btn-green mt-6 w-full py-3">Go to business login</Link>
        <p className="mt-3 text-center text-sm"><Link to="/" className="text-slate-400 hover:underline">← Back to home</Link></p>
      </AuthShell>
    )
  }

  return (
    <AuthShell variant="company" wide title="Register your company" subtitle="Claim your profile and respond to reviews.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Company name">
          <input className="input" value={form.company_name} onChange={set('company_name')} required />
          {errors.company_name && <Err>{errors.company_name}</Err>}
        </Field>
        <Field label="Website (optional)">
          <input className="input" value={form.website} onChange={set('website')} placeholder="example.com" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <select className="input" value={form.category} onChange={set('category')}>
              <option value="">Select a category</option>
              {categories.map((c) => (
                <option key={c.category} value={c.category}>{c.category}</option>
              ))}
            </select>
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
        </div>
        <Field label="District & City">
          <DistrictCityPicker
            districts={districts}
            districtId={form.district_id}
            cityId={form.city_id}
            onDistrict={(id) => setForm((f) => ({ ...f, district_id: id, city_id: '' }))}
            onCity={(id) => setForm((f) => ({ ...f, city_id: id }))}
            mode="form"
          />
          {(errors.district_id || errors.city_id) && <Err>{errors.district_id || errors.city_id}</Err>}
        </Field>
        <Field label="Address (optional)">
          <input className="input" value={form.address} onChange={set('address')} placeholder="Street, city, country" />
        </Field>
        <Field label="Contact person">
          <input className="input" value={form.full_name} onChange={set('full_name')} required />
          {errors.full_name && <Err>{errors.full_name}</Err>}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Username">
            <input className="input" value={form.username} onChange={set('username')} required />
            {errors.username && <Err>{errors.username}</Err>}
          </Field>
          <Field label="Business email">
            <input type="email" className="input" value={form.email} onChange={set('email')} required />
            {errors.email && <Err>{errors.email}</Err>}
          </Field>
        </div>
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
        <button type="submit" disabled={busy} className="btn-green w-full py-3">
          {busy ? 'Sending code…' : 'Register company'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Already registered?{' '}
        <Link to="/business/login" className="font-semibold text-brand-green hover:underline">Log in</Link>
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
