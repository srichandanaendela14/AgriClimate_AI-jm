import { useState } from 'react'
import { Crosshair, Loader2, MapPin, Save, Search, User } from 'lucide-react'
import { useSWRConfig } from 'swr'
import { api, useApi } from '../lib/api.js'
import { Card, CardTitle, ErrorState, Loading, Page, PageHeader, buttonPrimary, buttonSecondary, inputClass } from '../components/ui.jsx'

export default function Profile() {
  const { data: profile, error, isLoading, mutate } = useApi('/api/profile')
  const { data: options } = useApi('/api/options')

  return (
    <Page>
      <PageHeader title="Farmer Profile" description="Your farm details are used for every forecast and recommendation." />
      {isLoading && <Loading label="Loading profile…" />}
      {error && <ErrorState error={error} onRetry={() => mutate()} />}
      {profile && options && <ProfileForm key={profile.id} profile={profile} options={options} />}
    </Page>
  )
}

function Field({ label, error, children, hint }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
      {label}
      {children}
      {hint && <span className="text-xs font-normal text-slate-500">{hint}</span>}
      {error && <span className="text-xs font-medium text-red-700">{error}</span>}
    </label>
  )
}

function ProfileForm({ profile, options }) {
  const { mutate } = useSWRConfig()
  const [form, setForm] = useState({
    name: profile.name,
    phone: profile.phone || '',
    location_name: profile.location_name,
    latitude: profile.latitude,
    longitude: profile.longitude,
    crop_type: profile.crop_type,
    soil_type: profile.soil_type,
    farm_size_ha: profile.farm_size_ha,
    soil_moisture: profile.soil_moisture ?? '',
  })
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState(null)
  const [saving, setSaving] = useState(false)

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setStatus(null)
    setErrors({})
    try {
      await api('/api/profile', { method: 'PUT', body: JSON.stringify(form) })
      await mutate(() => true)
      setStatus({ type: 'ok', text: 'Profile saved. All forecasts now use your updated farm details.' })
    } catch (err) {
      setErrors(err.fields || {})
      setStatus({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="grid gap-4 lg:grid-cols-2" noValidate>
      <Card>
        <CardTitle icon={User}>Farmer details</CardTitle>
        <div className="flex flex-col gap-4">
          <Field label="Full name" error={errors.name}>
            <input className={inputClass} value={form.name} onChange={update('name')} required autoComplete="name" />
          </Field>
          <Field label="Phone number (optional)">
            <input className={inputClass} value={form.phone} onChange={update('phone')} type="tel" autoComplete="tel" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Main crop" error={errors.crop_type}>
              <select className={inputClass} value={form.crop_type} onChange={update('crop_type')}>
                {options.crops.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Soil type" error={errors.soil_type}>
              <select className={inputClass} value={form.soil_type} onChange={update('soil_type')}>
                {options.soils.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Farm size (hectares)" error={errors.farm_size_ha}>
              <input className={inputClass} type="number" min="0.01" step="0.01" value={form.farm_size_ha} onChange={update('farm_size_ha')} />
            </Field>
            <Field label="Soil moisture (%)" error={errors.soil_moisture} hint="Leave empty to use the weather model estimate">
              <input className={inputClass} type="number" min="0" max="100" value={form.soil_moisture} onChange={update('soil_moisture')} />
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle icon={MapPin}>Farm location</CardTitle>
        <LocationPicker
          value={form}
          error={errors.location_name || errors.latitude}
          onSelect={(loc) =>
            setForm((f) => ({ ...f, location_name: loc.name, latitude: loc.latitude, longitude: loc.longitude }))
          }
        />
      </Card>

      <div className="flex flex-col gap-3 lg:col-span-2 sm:flex-row sm:items-center">
        <button type="submit" className={buttonPrimary} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
          Save profile
        </button>
        {status && (
          <p role="status" className={`text-sm font-medium ${status.type === 'ok' ? 'text-brand-800' : 'text-red-700'}`}>
            {status.text}
          </p>
        )}
      </div>
    </form>
  )
}

function LocationPicker({ value, onSelect, error }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  async function search() {
    if (query.trim().length < 2) return
    setBusy(true)
    setMessage(null)
    try {
      const found = await api(`/api/geocode?q=${encodeURIComponent(query.trim())}`)
      setResults(found)
      if (!found.length) setMessage('No places found. Try a nearby town or city.')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  function useGps() {
    if (!navigator.geolocation) {
      setMessage('Your browser does not support location detection.')
      return
    }
    setBusy(true)
    setMessage(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(4))
        const lon = Number(pos.coords.longitude.toFixed(4))
        onSelect({ name: `My farm (${lat}, ${lon})`, latitude: lat, longitude: lon })
        setBusy(false)
      },
      () => {
        setMessage('Could not get your location. Please search for your village or town instead.')
        setBusy(false)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-brand-50 p-4">
        <p className="text-sm text-slate-600">Selected location</p>
        <p className="font-semibold text-brand-900">{value.location_name}</p>
        <p className="text-xs text-slate-500">
          {Number(value.latitude).toFixed(4)}, {Number(value.longitude).toFixed(4)}
        </p>
        {error && <p className="mt-1 text-xs font-medium text-red-700">{error}</p>}
      </div>

      <div>
        <label htmlFor="place-search" className="text-sm font-medium text-slate-700">
          Search village, town or city
        </label>
        <div className="mt-1.5 flex gap-2">
          <input
            id="place-search"
            className={inputClass}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                e.preventDefault()
                search()
              }
            }}
            placeholder="e.g. Nashik"
          />
          <button type="button" className={buttonSecondary} onClick={search} disabled={busy} aria-label="Search location">
            <Search className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <ul className="flex flex-col gap-1" aria-label="Search results">
          {results.map((r) => (
            <li key={`${r.latitude},${r.longitude}`}>
              <button
                type="button"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:border-brand-500 hover:bg-brand-50"
                onClick={() => {
                  onSelect(r)
                  setResults([])
                  setQuery('')
                }}
              >
                {r.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className={buttonSecondary} onClick={useGps} disabled={busy}>
        <Crosshair className="size-4" aria-hidden="true" /> Use my current location
      </button>
      {message && <p role="status" className="text-sm text-slate-600">{message}</p>}
      <p className="text-xs text-slate-500">Remember to press Save profile after choosing a location.</p>
    </div>
  )
}
