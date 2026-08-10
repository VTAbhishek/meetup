import { useEffect, useState } from 'react'
import { Plus, Trash2, Tag } from 'lucide-react'
import { api } from '../../api'
import { confirmDelete, toastOk, alertErr } from '../../alerts'
import { categoryIcon } from '../../lib'
import Spinner from '../../components/Spinner'

export default function Categories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => {
    setLoading(true)
    api.adminCategories().then((d) => setCategories(d.categories)).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const add = async (e) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) return
    setBusy(true)
    try {
      await api.createCategory(name.trim())
      setName('')
      load()
      toastOk('Category added')
    } catch (err) {
      setError(err.message)
      alertErr(err)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (c) => {
    if (!(await confirmDelete({ title: `Delete "${c.name}"?`, text: 'Companies keep their label; the category is removed.' }))) return
    try {
      await api.deleteCategory(c.id)
      load()
      toastOk('Category deleted')
    } catch (e) {
      alertErr(e)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0">
        <h1 className="text-2xl font-extrabold text-brand-navy">Categories</h1>
        <p className="text-sm text-slate-500">Create and manage the industries companies are listed under.</p>
      </div>

      {/* Add new category */}
      <form onSubmit={add} className="card mt-6 flex shrink-0 flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Tag size={16} className="absolute left-3 top-3 text-slate-400" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New category name (e.g. Restaurants)"
            className="input pl-9"
          />
        </div>
        <button type="submit" disabled={busy} className="btn-blue shrink-0">
          <Plus size={18} /> {busy ? 'Adding…' : 'Add category'}
        </button>
      </form>
      {error && <p className="mt-2 shrink-0 text-sm text-red-600">{error}</p>}

      {/* List */}
      {loading ? (
        <Spinner />
      ) : (
        <div className="mt-6 grid min-h-0 flex-1 auto-rows-min content-start gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => {
            const Icon = categoryIcon(c.name)
            return (
              <div key={c.id} className="card flex items-center gap-3 p-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-silver text-brand-blue">
                  <Icon size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-brand-navy">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.company_count} companies</p>
                </div>
                <button
                  onClick={() => remove(c)}
                  className="rounded-lg border border-slate-300 p-2 text-red-600 hover:bg-red-50"
                  title="Delete category"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
