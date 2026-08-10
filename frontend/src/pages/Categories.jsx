import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api } from '../api'
import { categoryIcon } from '../lib'
import Spinner from '../components/Spinner'

export default function Categories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.categories().then((d) => setCategories(d.categories)).finally(() => setLoading(false))
  }, [])

  return (
    <div className="container-page py-10">
      <h1 className="text-3xl font-extrabold text-brand-navy">Browse by category</h1>
      <p className="mt-1 text-slate-500">Find and compare companies across every industry.</p>

      {loading ? (
        <Spinner />
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c, i) => {
            const Icon = categoryIcon(c.category)
            return (
              <motion.div
                key={c.category}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link
                  to={`/category/${encodeURIComponent(c.category)}`}
                  className="card flex items-center gap-4 p-5 hover:shadow-cardHover hover:border-brand-blue/30 transition"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-silver text-brand-blue">
                    <Icon size={24} />
                  </span>
                  <div>
                    <h3 className="font-bold text-brand-navy">{c.category}</h3>
                    <p className="text-sm text-slate-500">
                      {c.company_count} companies · {c.review_count} reviews
                    </p>
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
