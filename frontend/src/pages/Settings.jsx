import { useRef, useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { confirmDelete, toastOk, alertErr } from '../alerts'
import { colorFor, initials } from '../lib'
import { compressImage } from '../lib/imageCompress'

export default function Settings() {
  const { user, updateUser } = useAuth()
  const [fullName, setFullName] = useState(user.full_name)
  const [email, setEmail] = useState(user.email)
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    setErrors({})
    setBusy(true)
    try {
      const d = await api.updateMe({ full_name: fullName, email, password: password || undefined })
      updateUser(d.user)
      setPassword('')
      toastOk('Your changes have been saved')
    } catch (err) {
      // Field-level validation stays inline; anything else pops an alert.
      if (err.data?.errors) setErrors(err.data.errors)
      else alertErr(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container-page max-w-xl py-10">
      <h1 className="text-2xl font-extrabold text-brand-navy">Account settings</h1>
      <p className="mt-1 text-slate-500">Update your profile information.</p>

      <form onSubmit={save} className="card mt-8 space-y-5 p-6">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Profile picture</label>
          <AvatarPicker user={user} onChange={(url) => updateUser({ ...user, avatar_url: url })} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Username</label>
          <input className="input bg-slate-50 text-slate-500" value={user.username} disabled />
          <p className="mt-1 text-xs text-slate-400">Username can’t be changed.</p>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Full name</label>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          {errors.full_name && <p className="mt-1 text-sm text-red-600">{errors.full_name}</p>}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Email</label>
          <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">
            New password <span className="font-normal text-slate-400">(leave blank to keep current)</span>
          </label>
          <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
        </div>
        <button type="submit" disabled={busy} className="btn-blue">{busy ? 'Saving…' : 'Save changes'}</button>
      </form>
    </div>
  )
}

/** Profile-picture control: upload / change / remove. */
function AvatarPicker({ user, onChange }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return alertErr('Please choose an image file.')
    setBusy(true)
    try {
      // Auto-shrink the file size (not the visible quality) before uploading.
      const small = await compressImage(file, { maxDim: 1200 })
      if (small.size > 5 * 1024 * 1024) return alertErr('Image must be 5 MB or smaller.')
      const d = await api.uploadAvatar(small)
      onChange(d.avatar_url)
      toastOk('Profile picture updated')
    } catch (err) {
      alertErr(err)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!(await confirmDelete({ title: 'Remove profile picture?', text: 'Your picture will be deleted.' }))) return
    setBusy(true)
    try {
      await api.deleteAvatar()
      onChange(null)
      toastOk('Profile picture removed')
    } catch (err) {
      alertErr(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-20 w-20 shrink-0">
        {user.avatar_url ? (
          <img src={user.avatar_url} alt={user.full_name} className="h-20 w-20 rounded-full object-cover ring-1 ring-slate-200" />
        ) : (
          <span
            className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white"
            style={{ backgroundColor: colorFor(user.full_name) }}
          >
            {initials(user.full_name)}
          </span>
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/50 border-t-white" />
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => inputRef.current?.click()} className="btn-ghost py-2 text-sm">
          <Camera size={15} /> {user.avatar_url ? 'Change photo' : 'Upload photo'}
        </button>
        {user.avatar_url && (
          <button type="button" onClick={remove} className="btn-ghost py-2 text-sm text-red-600">
            <Trash2 size={15} /> Remove
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </div>
  )
}
