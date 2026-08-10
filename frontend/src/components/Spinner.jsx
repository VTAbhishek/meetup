export default function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-400">
      <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-brand-blue" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
