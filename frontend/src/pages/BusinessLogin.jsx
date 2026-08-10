import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { AuthShell, Field, homeFor } from '../components/AuthShell'
import { toastOk, alertErr } from '../alerts'

export default function BusinessLogin() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const user = await login({ username, password, role: 'company' })
      toastOk(`Welcome back, ${user.full_name.split(' ')[0]}!`)
      navigate(homeFor(user, '/business'), { replace: true })
    } catch (err) {
      alertErr(err, 'Login failed')
      setBusy(false)
    }
  }

  return (
    <AuthShell variant="company" title="Business sign in" subtitle="Manage your profile, reviews and payments.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Username or email">
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </Field>
        <Field label="Password">
          <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <button type="submit" disabled={busy} className="btn-green w-full py-3">
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        New to Meetup?{' '}
        <Link to="/business/register" className="font-semibold text-brand-green hover:underline">
          Register your company
        </Link>
      </p>
      <p className="mt-3 text-center text-sm text-slate-500">
        Looking to write reviews?{' '}
        <Link to="/login" className="font-semibold text-brand-blue hover:underline">Customer login</Link>
      </p>
      <p className="mt-2 text-center text-sm">
        <Link to="/" className="text-slate-400 hover:underline">← Back to home</Link>
      </p>
    </AuthShell>
  )
}
