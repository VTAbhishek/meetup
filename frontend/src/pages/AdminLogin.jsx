import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '../auth'
import { AuthShell, Field, homeFor } from '../components/AuthShell'
import { toastOk, alertErr } from '../alerts'

export default function AdminLogin() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const user = await login({ username, password, role: 'admin' })
      toastOk('Signed in')
      navigate(homeFor(user, '/admin'), { replace: true })
    } catch (err) {
      alertErr(err, 'Login failed')
      setBusy(false)
    }
  }

  return (
    <AuthShell variant="admin" title="Control Panel" subtitle="Authorized personnel only.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Admin username">
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </Field>
        <Field label="Password">
          <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <button type="submit" disabled={busy} className="btn w-full bg-brand-navy py-3 text-white hover:bg-slate-700 focus:ring-brand-navy">
          {busy ? 'Signing in…' : (<><ShieldCheck size={18} /> Sign in</>)}
        </button>
      </form>
      <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
        <ShieldCheck size={14} /> Admin accounts are created by the system, not self-registered.
      </p>
      <p className="mt-2 text-center text-sm">
        <Link to="/" className="text-slate-400 hover:underline">← Back to home</Link>
      </p>
    </AuthShell>
  )
}
