import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLang } from '../i18n'

/**
 * Horizontal scrolling row with a title, left/right arrow controls and an
 * optional "See more" pill — matching the Trustpilot carousel header.
 */
export default function Carousel({ title, seeMoreTo, children }) {
  const { t } = useLang()
  const ref = useRef(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  const update = () => {
    const el = ref.current
    if (!el) return
    setAtStart(el.scrollLeft <= 2)
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2)
  }

  useEffect(() => {
    update()
    const el = ref.current
    el?.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      el?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [children])

  const scroll = (dir) => {
    const el = ref.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' })
  }

  return (
    <section className="container-page py-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-2xl font-extrabold text-brand-navy">{title}</h2>
        <div className="flex items-center gap-2">
          <ArrowButton dir="left" disabled={atStart} onClick={() => scroll(-1)} />
          <ArrowButton dir="right" disabled={atEnd} onClick={() => scroll(1)} />
          {seeMoreTo && (
            <Link
              to={seeMoreTo}
              className="ml-1 rounded-full border border-brand-blue/40 px-4 py-1.5 text-sm font-semibold text-brand-blue transition hover:bg-brand-blue/5"
            >
              {t('seeMore')}
            </Link>
          )}
        </div>
      </div>

      <div ref={ref} className="no-scrollbar flex gap-4 overflow-x-auto scroll-smooth pb-2">
        {children}
      </div>
    </section>
  )
}

function ArrowButton({ dir, disabled, onClick }) {
  const Icon = dir === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'left' ? 'Scroll left' : 'Scroll right'}
      className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
        disabled
          ? 'cursor-default border-transparent bg-slate-200 text-slate-400'
          : 'border-brand-blue/40 text-brand-blue hover:bg-brand-blue/5'
      }`}
    >
      <Icon size={18} />
    </button>
  )
}
