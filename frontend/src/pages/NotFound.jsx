import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="container-page py-24 text-center">
      <p className="text-7xl font-extrabold text-brand-blue">404</p>
      <h1 className="mt-4 text-2xl font-bold text-brand-navy">Page not found</h1>
      <p className="mt-2 text-slate-500">The page you’re looking for doesn’t exist.</p>
      <Link to="/" className="btn-blue mt-6">Back to home</Link>
    </div>
  )
}
