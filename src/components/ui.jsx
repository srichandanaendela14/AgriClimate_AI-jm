import { Link } from 'react-router-dom'
import { AlertTriangle, Loader2, MapPin, RefreshCw } from 'lucide-react'

export function Page({ children }) {
  return <div className="mx-auto w-full max-w-6xl px-4 py-6 md:py-10">{children}</div>
}

export function PageHeader({ title, description, meta }) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-900 md:text-3xl text-balance">{title}</h1>
        {description && <p className="mt-1 text-slate-600 text-pretty">{description}</p>}
      </div>
      {meta && <LocationTag meta={meta} />}
    </div>
  )
}

export function LocationTag({ meta }) {
  return (
    <Link
      to="/profile"
      className="inline-flex items-center gap-1.5 self-start rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-800 hover:bg-brand-100"
    >
      <MapPin className="size-4" aria-hidden="true" />
      {meta.location.name}
    </Link>
  )
}

export function Card({ children, className = '' }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</section>
}

export function CardTitle({ children, icon: Icon }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
      {Icon && <Icon className="size-5 text-brand-700" aria-hidden="true" />}
      {children}
    </h2>
  )
}

export function Stat({ label, value, unit, hint }) {
  return (
    <div className="rounded-xl bg-brand-50 p-4">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-bold text-brand-900">
        {value}
        {unit && <span className="ml-1 text-base font-medium text-slate-600">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

export function DataSource({ meta }) {
  if (!meta) return null
  if (meta.is_demo) {
    return (
      <div role="status" className="mb-6 flex items-start gap-3 rounded-xl border border-yellow-300 bg-yellow-50 p-4 text-yellow-900">
        <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">DEMO DATA – live weather is unavailable</p>
          <p className="text-sm">
            We could not reach Open-Meteo. The numbers below are sample values for demonstration only. Do not use
            them for farm decisions. Push alerts are paused until live data returns.
          </p>
        </div>
      </div>
    )
  }
  return (
    <p className="mb-6 text-xs text-slate-500">
      Source: {meta.source} · Updated {new Date(meta.fetched_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
    </p>
  )
}

export function Loading({ label = 'Loading weather data…' }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-20 text-slate-600">
      <Loader2 className="size-5 animate-spin text-brand-700" aria-hidden="true" />
      {label}
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-12 text-center">
      <AlertTriangle className="size-8 text-red-600" aria-hidden="true" />
      <p className="font-semibold text-red-900">Could not load data</p>
      <p className="max-w-md text-sm text-red-800">
        {error?.message || 'The server is not responding.'} Make sure the Flask backend is running on port 5000.
      </p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100">
          <RefreshCw className="size-4" aria-hidden="true" /> Try again
        </button>
      )}
    </div>
  )
}

export const buttonPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:opacity-60'

export const buttonSecondary =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-brand-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-800 hover:bg-brand-50 disabled:opacity-60'

export const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200'
