import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api'
import { categoryIcon } from '../lib'
import CompanyResults from '../components/CompanyResults'
import Spinner from '../components/Spinner'

export default function CategoryDetail() {
  const { name } = useParams()
  const category = decodeURIComponent(name)
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const Icon = categoryIcon(category)

  useEffect(() => {
    setLoading(true)
    api
      .companies(`?category=${encodeURIComponent(category)}&limit=48`)
      .then((d) => setCompanies(d.companies))
      .finally(() => setLoading(false))
  }, [category])

  return (
    <div className="container-page py-10">
      <div className="mb-6 flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-silver text-brand-blue">
          <Icon size={28} />
        </span>
        <div>
          <h1 className="text-3xl font-extrabold text-brand-navy">Best in {category}</h1>
          <p className="text-slate-500">Ranked by customer rating</p>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <CompanyResults companies={companies} emptyHint={`No companies in ${category} yet.`} />
      )}
    </div>
  )
}
