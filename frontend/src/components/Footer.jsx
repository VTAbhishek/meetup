import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Star, Facebook, Twitter, Instagram, Linkedin, Youtube } from 'lucide-react'

export default function Footer() {
  const cols = [
    { title: 'About', links: ['About us', 'Jobs', 'Contact', 'Blog', 'How it works'] },
    { title: 'Community', links: ['Trust in reviews', 'Help Center', 'Log in', 'Sign up'] },
    { title: 'Businesses', links: ['Meetup Business', 'Products', 'Plans & Pricing', 'Business Login'] },
  ]
  const socials = [Facebook, Twitter, Instagram, Linkedin, Youtube]

  return (
    <footer className="footer-animated relative mt-20 overflow-hidden text-slate-200">
      {/* animated blue→green accent strip */}
      <div className="accent-flow h-1 w-full" />

      {/* floating blurred blobs */}
      <div className="float-slow pointer-events-none absolute -top-16 left-10 h-56 w-56 rounded-full bg-brand-green/20 blur-3xl" />
      <div className="float-slow delayed pointer-events-none absolute -bottom-20 right-16 h-64 w-64 rounded-full bg-brand-blue/25 blur-3xl" />

      <div className="container-page relative py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Link to="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-green shadow-lg shadow-brand-green/30">
                <Star size={20} color="white" fill="white" strokeWidth={0} />
              </span>
              <span className="text-xl font-extrabold text-white">
                Meet<span className="text-brand-greenLight">up</span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-slate-300/90">
              A review platform open to everyone. Helping people shop with confidence and
              companies improve.
            </p>
            <div className="mt-5 flex gap-3">
              {socials.map((Icon, i) => (
                <motion.a
                  key={i}
                  href="#"
                  whileHover={{ scale: 1.18, y: -3 }}
                  whileTap={{ scale: 0.92 }}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-slate-200 transition-colors hover:bg-brand-green hover:text-white"
                >
                  <Icon size={18} />
                </motion.a>
              ))}
            </div>
          </motion.div>

          {/* Link columns */}
          {cols.map((c, ci) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 * (ci + 1) }}
            >
              <h4 className="font-bold text-white">{c.title}</h4>
              <ul className="mt-4 space-y-2.5 text-sm">
                {c.links.map((l) => (
                  <li key={l}>
                    <a
                      href="#"
                      className="group inline-flex items-center gap-1.5 text-slate-300 transition-all hover:translate-x-1 hover:text-brand-greenLight"
                    >
                      <span className="h-1 w-0 rounded-full bg-brand-greenLight transition-all duration-300 group-hover:w-3" />
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Meetup. All rights reserved.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {['Legal', 'Privacy Policy', 'Terms & Conditions', 'Guidelines for Reviewers'].map((l) => (
              <a key={l} href="#" className="transition-colors hover:text-brand-greenLight">{l}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
