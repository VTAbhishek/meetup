import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { api } from '../api'
import { categoryIcon } from '../lib'
import { useLang } from '../i18n'
import { useLocationCtx } from '../location'
import SearchBar from '../components/SearchBar'
import DistrictCityPicker from '../components/DistrictCityPicker'
import CompanyCard from '../components/CompanyCard'
import ReviewCard from '../components/ReviewCard'
import Carousel from '../components/Carousel'
import Spinner from '../components/Spinner'

export default function Home() {
  const { t } = useLang()
  const { districts, districtId, cityId, setDistrict, setCity } = useLocationCtx()
  const [categories, setCategories] = useState([])
  const [companies, setCompanies] = useState([])
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.categories(), api.companies('?limit=8'), api.recentReviews(8)])
      .then(([c, co, r]) => {
        setCategories(c.categories)
        setCompanies(co.companies)
        setReviews(r.reviews)
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* High-res background photo */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('${import.meta.env.BASE_URL}images/hero-bg.jpg')` }}
        />
        {/* Brand gradient overlay keeps the white text readable */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-blueDark/95 via-brand-blue/90 to-brand-blueLight/80" />
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-brand-green/30 blur-3xl" />
        <div className="absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="container-page relative z-10 py-20 text-center text-white sm:py-28">
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-4xl font-extrabold sm:text-6xl"
          >
            {t('heroTitle')}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mx-auto mt-4 max-w-xl text-lg text-purple-100"
          >
            {t('heroSubtitle')}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mx-auto mt-8 max-w-2xl space-y-3"
          >
            <SearchBar placeholder={t('searchPlaceholder')} />
            <div className="rounded-2xl bg-white/10 p-2 backdrop-blur-sm">
              <DistrictCityPicker
                districts={districts}
                districtId={districtId}
                cityId={cityId}
                onDistrict={setDistrict}
                onCity={setCity}
                dark
              />
            </div>
          </motion.div>
        </div>
      </section>

      {loading ? (
        <Spinner />
      ) : (
        <>
          {/* Categories */}
          <div className="pt-6" />
          <Carousel title={t('whatLookingFor')} seeMoreTo="/categories">
            {categories.map((c) => {
              const Icon = categoryIcon(c.category)
              return (
                <Link
                  key={c.category}
                  to={`/category/${encodeURIComponent(c.category)}`}
                  className="card flex w-36 shrink-0 flex-col items-center gap-2 p-4 text-center transition hover:border-brand-blue/30 hover:shadow-cardHover"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-silver text-brand-blue">
                    <Icon size={22} />
                  </span>
                  <span className="text-xs font-semibold leading-tight text-slate-700">{c.category}</span>
                </Link>
              )
            })}
          </Carousel>

          {/* Featured companies */}
          <Carousel title={t('topRated')} seeMoreTo="/search?q=">
            {companies.map((c) => (
              <div key={c.id} className="w-72 shrink-0">
                <CompanyCard company={c} />
              </div>
            ))}
          </Carousel>

          {/* Brand banner */}
          <section className="container-page py-10">
            <div className="grid items-center gap-6 overflow-hidden rounded-3xl bg-purple-100 p-8 sm:grid-cols-2 sm:p-12">
              <div>
                <h2 className="text-3xl font-extrabold text-brand-navy">{t('helpTitle')}</h2>
                <p className="mt-3 text-slate-600">{t('helpText')}</p>
                <Link to="/write-review" className="btn-green mt-6">
                  {t('writeReview')} <ArrowRight size={18} />
                </Link>
              </div>
              <div className="hidden justify-end sm:flex">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { src: `${import.meta.env.BASE_URL}images/banner1.jpg`, alt: 'Customer shopping' },
                    { src: `${import.meta.env.BASE_URL}images/banner2.jpg`, alt: 'People comparing reviews' },
                    { src: `${import.meta.env.BASE_URL}images/banner3.jpg`, alt: 'Happy reviewer' },
                  ].map((img, i) => (
                    <motion.img
                      key={i}
                      src={img.src}
                      alt={img.alt}
                      loading="lazy"
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                      className={`h-44 w-28 rounded-2xl object-cover shadow-card ${i === 1 ? 'mt-6' : ''}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Recent reviews */}
          <Carousel title={t('recentReviews')}>
            {reviews.map((r) => (
              <div key={r.id} className="w-80 shrink-0">
                <ReviewCard review={r} showCompany />
              </div>
            ))}
          </Carousel>
        </>
      )}
    </div>
  )
}
