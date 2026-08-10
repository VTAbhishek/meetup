import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Search, Check, X, Calendar } from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { api } from '../api'
import { toastOk, alertErr } from '../alerts'
import { useAuth } from '../auth'
import { StarPicker } from '../components/Stars'
import Spinner from '../components/Spinner'
import { colorFor, initials } from '../lib'

export default function WriteReview() {
  const { slug } = useParams()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [company, setCompany] = useState(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [rating, setRating] = useState(0)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [expDate, setExpDate] = useState('')
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(null) // { pending: bool }

  // Preload company from the URL slug
  useEffect(() => {
    if (slug) api.company(slug).then((d) => setCompany(d.company)).catch(() => {})
  }, [slug])

  // Company search
  useEffect(() => {
    if (company || query.trim().length < 2) {
      setResults([])
      return
    }
    const t = setTimeout(() => {
      api.companies(`?q=${encodeURIComponent(query)}&limit=6`).then((d) => setResults(d.companies))
    }, 200)
    return () => clearTimeout(t)
  }, [query, company])

  if (authLoading) return <Spinner />

  if (!user) {
    return (
      <div className="container-page py-20">
        <div className="card mx-auto max-w-md p-8 text-center">
          <h1 className="text-2xl font-extrabold text-brand-navy">Log in to write a review</h1>
          <p className="mt-2 text-slate-500">You need a free account to share your experience.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/login" state={{ from: slug ? `/write-review/${slug}` : '/write-review' }} className="btn-blue">
              Log in
            </Link>
            <Link to="/register" className="btn-ghost">Sign up</Link>
          </div>
        </div>
      </div>
    )
  }

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!company) errs.company = 'Please choose a company.'
    if (!rating) errs.rating = 'Please select a rating.'
    if (!body.trim()) errs.body = 'Please describe your experience.'
    setErrors(errs)
    if (Object.keys(errs).length) return

    setSubmitting(true)
    try {
      const res = await api.createReview({
        company_id: company.id,
        rating,
        title: title.trim(),
        body: body.trim(),
        experience_date: expDate || null,
      })
      if (res.pending) {
        setDone({ pending: true })
      } else {
        toastOk('Review published')
        navigate(`/review/${company.slug}`)
      }
    } catch (err) {
      if (err.data?.errors) setErrors(err.data.errors)
      else alertErr(err)
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="container-page max-w-lg py-20">
        <div className="card p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-pink-100 text-brand-green">
            <Check size={28} />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold text-brand-navy">Thanks for your review!</h1>
          <p className="mt-2 text-slate-500">
            Your review has been submitted and is <strong>awaiting the company's approval</strong>.
            It will appear on their page once they grant access.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to={`/review/${company.slug}`} className="btn-blue">View company</Link>
            <Link to="/dashboard" className="btn-ghost">My reviews</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container-page max-w-2xl py-10">
      <h1 className="text-3xl font-extrabold text-brand-navy">Write a review</h1>
      <p className="mt-1 text-slate-500">Your honest feedback helps others choose with confidence.</p>

      <form onSubmit={submit} className="mt-8 space-y-8">
        {/* Step 1: company */}
        <section className="card p-6">
          <h2 className="font-bold text-brand-navy">1. Which company?</h2>
          {company ? (
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
              <span
                className="flex h-11 w-11 items-center justify-center rounded-lg font-bold text-white"
                style={{ backgroundColor: colorFor(company.company_name) }}
              >
                {initials(company.company_name)}
              </span>
              <div className="flex-1">
                <p className="font-semibold text-brand-navy">{company.company_name}</p>
                <p className="text-xs text-slate-500">{company.website}</p>
              </div>
              {!slug && (
                <button type="button" onClick={() => setCompany(null)} className="text-slate-400 hover:text-red-500">
                  <X size={18} />
                </button>
              )}
            </div>
          ) : (
            <div className="relative mt-4">
              <Search size={18} className="absolute left-3 top-3 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for a company..."
                className="input pl-10"
              />
              {results.length > 0 && (
                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-cardHover">
                  {results.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => {
                        setCompany(c)
                        setResults([])
                        setQuery('')
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                    >
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold text-white"
                        style={{ backgroundColor: colorFor(c.company_name) }}
                      >
                        {initials(c.company_name)}
                      </span>
                      <span className="font-medium text-slate-700">{c.company_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {errors.company && <p className="mt-2 text-sm text-red-600">{errors.company}</p>}
        </section>

        {/* Step 2: rating + text */}
        <section className="card p-6">
          <h2 className="font-bold text-brand-navy">2. Rate your experience</h2>
          <div className="mt-5">
            <StarPicker value={rating} onChange={setRating} />
          </div>
          {errors.rating && <p className="mt-2 text-center text-sm text-red-600">{errors.rating}</p>}

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Review title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Summarize your experience"
                className="input"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Tell us about your experience
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="What happened? What went well or could be improved?"
                className="input resize-y"
              />
              {errors.body && <p className="mt-1 text-sm text-red-600">{errors.body}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Date of experience <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <div className="relative">
                <Calendar size={18} className="pointer-events-none absolute left-3 top-3 z-10 text-slate-400" />
                <DatePicker
                  selected={expDate ? new Date(expDate) : null}
                  onChange={(date) => setExpDate(date ? date.toLocaleDateString('en-CA') : '')}
                  maxDate={new Date()}
                  dateFormat="MMMM d, yyyy"
                  placeholderText="Select a date"
                  isClearable
                  showPopperArrow={false}
                  className="input pl-10"
                  wrapperClassName="w-full"
                />
              </div>
            </div>
          </div>
        </section>

        <button type="submit" disabled={submitting} className="btn-blue w-full py-3 text-base">
          {submitting ? 'Submitting…' : (<><Check size={18} /> Submit review</>)}
        </button>
      </form>
    </div>
  )
}
