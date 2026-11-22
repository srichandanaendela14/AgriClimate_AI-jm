import { useState } from 'react'
import { CheckCircle2, ClipboardList, Droplets, Lightbulb } from 'lucide-react'
import useSWR, { useSWRConfig } from 'swr'
import { api, useApi } from '../lib/api.js'
import { IRRIGATION_STYLES } from '../lib/format.js'
import {
  Card,
  CardTitle,
  DataSource,
  ErrorState,
  Loading,
  Page,
  PageHeader,
  Stat,
  buttonPrimary,
  inputClass,
} from '../components/ui.jsx'

export default function Irrigation() {
  const { data: options } = useApi('/api/options')
  const { data: profile } = useApi('/api/profile')
  const [query, setQuery] = useState(null)
  const path = query ? `/api/irrigation?${new URLSearchParams({ ...query, save: '1' })}` : '/api/irrigation'
  const { mutate: globalMutate } = useSWRConfig()
  const { data, error, isLoading, mutate } = useSWR(path, api, {
    revalidateOnFocus: false,
    onSuccess: () => query && globalMutate('/api/irrigation/history'),
  })

  return (
    <Page>
      <PageHeader
        title="Irrigation Advisor"
        description="Find out if your crop needs water, based on the forecast and your soil moisture."
        meta={data}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardTitle icon={ClipboardList}>Your field</CardTitle>
          {options && profile ? (
            <IrrigationForm
              key={profile.updated_at}
              options={options}
              profile={profile}
              modelMoisture={data?.model_soil_moisture}
              onSubmit={setQuery}
              busy={isLoading}
            />
          ) : (
            <Loading label="Loading form…" />
          )}
        </Card>

        <div className="lg:col-span-2">
          {isLoading && !data && <Loading />}
          {error && <ErrorState error={error} onRetry={() => mutate()} />}
          {data && (
            <>
              <DataSource meta={data} />
              <Result advice={data.advice} />
            </>
          )}
          <History />
        </div>
      </div>
    </Page>
  )
}

function IrrigationForm({ options, profile, modelMoisture, onSubmit, busy }) {
  const [crop, setCrop] = useState(profile.crop_type)
  const [soil, setSoil] = useState(profile.soil_type)
  const [moisture, setMoisture] = useState(Math.round(profile.soil_moisture ?? modelMoisture ?? 30))

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ crop, soil, moisture: String(moisture) })
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
        Crop type
        <select className={inputClass} value={crop} onChange={(e) => setCrop(e.target.value)}>
          {options.crops.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
        Soil type
        <select className={inputClass} value={soil} onChange={(e) => setSoil(e.target.value)}>
          {options.soils.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="moisture" className="flex justify-between text-sm font-medium text-slate-700">
          Soil moisture <span className="font-bold text-brand-800">{moisture}%</span>
        </label>
        <input
          id="moisture"
          type="range"
          min="0"
          max="100"
          value={moisture}
          onChange={(e) => setMoisture(Number(e.target.value))}
          className="w-full accent-brand-700"
        />
        <div className="flex justify-between text-xs text-slate-500">
          <span>Dry</span>
          <span>Wet</span>
        </div>
        {modelMoisture != null && (
          <button
            type="button"
            className="self-start text-xs font-medium text-brand-700 underline"
            onClick={() => setMoisture(Math.round(modelMoisture))}
          >
            Use satellite/model estimate ({Math.round(modelMoisture)}%)
          </button>
        )}
        <p className="text-xs text-slate-500">
          No sensor? Squeeze a handful of soil: crumbles = about 20%, holds shape = about 40%, sticky = 60%+.
        </p>
      </div>

      <button type="submit" className={buttonPrimary} disabled={busy}>
        <Droplets className="size-4" aria-hidden="true" />
        {busy ? 'Checking…' : 'Check irrigation need'}
      </button>
    </form>
  )
}

function Result({ advice }) {
  const style = IRRIGATION_STYLES[advice.status]
  return (
    <div className="flex flex-col gap-4">
      <section className={`rounded-2xl border p-6 ${style.bg} ${style.border}`} aria-live="polite">
        <p className="text-sm font-medium text-slate-600">
          Recommendation for {advice.crop.toLowerCase()} on {advice.soil.toLowerCase()} soil
        </p>
        <p className={`mt-1 text-3xl font-bold ${style.text}`}>{advice.decision}</p>
        <p className="mt-2 text-slate-700">{advice.reason}</p>
        {advice.water_mm > 0 && (
          <p className="mt-4 rounded-xl bg-white/70 p-3 font-medium text-slate-900">
            Apply about <strong>{advice.water_mm} mm</strong> ({advice.water_mm} litres per m²) – roughly{' '}
            <strong>{advice.water_liters_total.toLocaleString('en-US')} litres</strong> for your whole farm.
          </p>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Soil moisture" value={Math.round(advice.soil_moisture)} unit="%" hint={`Stress below ${advice.stress_threshold}%`} />
        <Stat label="Rain next 48 h" value={advice.rain_next_48h_mm} unit="mm" hint={`${advice.rain_probability_48h}% max chance`} />
        <Stat label="Crop water use" value={advice.crop_water_use_3d_mm} unit="mm" hint="Next 3 days" />
        <Stat label="Target moisture" value={advice.target_moisture} unit="%" />
      </div>

      <Card>
        <CardTitle icon={Lightbulb}>Tips</CardTitle>
        <ul className="flex flex-col gap-2">
          {advice.tips.map((tip) => (
            <li key={tip} className="flex gap-2 text-sm text-slate-700">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden="true" />
              {tip}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

function History() {
  const { data } = useApi('/api/irrigation/history')
  if (!data?.length) return null
  return (
    <Card className="mt-4">
      <CardTitle icon={ClipboardList}>Recent checks</CardTitle>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="py-2 pr-4 font-medium">Date</th>
              <th className="py-2 pr-4 font-medium">Crop</th>
              <th className="py-2 pr-4 font-medium">Moisture</th>
              <th className="py-2 pr-4 font-medium">Decision</th>
              <th className="py-2 font-medium">Water</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((row) => (
              <tr key={row.id}>
                <td className="py-2 pr-4 text-slate-600">{new Date(`${row.created_at}Z`).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                <td className="py-2 pr-4 capitalize">{row.crop_type}</td>
                <td className="py-2 pr-4">{Math.round(row.soil_moisture)}%</td>
                <td className="py-2 pr-4 font-medium">
                  {row.decision}
                  {row.is_demo ? <span className="ml-1 rounded bg-yellow-100 px-1 text-xs text-yellow-800">demo</span> : null}
                </td>
                <td className="py-2">{row.water_mm} mm</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
