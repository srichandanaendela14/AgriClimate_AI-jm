import { Link } from 'react-router-dom'
import { ArrowRight, Bell, CloudRain, Droplets, Sun, Thermometer, Wind } from 'lucide-react'
import { useApi } from '../lib/api.js'
import { DROUGHT_STYLES, IRRIGATION_STYLES, dateTime, num, weatherInfo } from '../lib/format.js'
import { Card, CardTitle, DataSource, ErrorState, Loading, Page, PageHeader, Stat } from '../components/ui.jsx'
import RainChart from '../components/RainChart.jsx'

export default function Dashboard() {
  const { data, error, isLoading, mutate } = useApi('/api/dashboard')

  return (
    <Page>
      <PageHeader
        title={data ? `Hello, ${data.farmer.name}` : 'Dashboard'}
        description="Your farm weather summary for today."
        meta={data}
      />
      {isLoading && <Loading />}
      {error && <ErrorState error={error} onRetry={() => mutate()} />}
      {data && <DashboardContent data={data} />}
    </Page>
  )
}

function DashboardContent({ data }) {
  const { current, today, irrigation, drought, hazards, rainfall } = data
  const info = weatherInfo(current.weather_code)
  const WeatherIcon = info.icon
  const irrigationStyle = IRRIGATION_STYLES[irrigation.status]
  const droughtStyle = DROUGHT_STYLES[drought.level]

  return (
    <>
      <DataSource meta={data} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="bg-gradient-to-br from-brand-700 to-brand-800 text-white lg:col-span-1 border-0">
          <p className="text-sm text-brand-100">Right now</p>
          <div className="mt-2 flex items-center gap-4">
            <WeatherIcon className="size-14" aria-hidden="true" />
            <div>
              <p className="text-4xl font-bold">{num(current.temperature_2m)}°C</p>
              <p className="text-brand-100">{info.label}</p>
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-brand-100">Humidity</dt>
              <dd className="font-semibold">{num(current.relative_humidity_2m)}%</dd>
            </div>
            <div>
              <dt className="text-brand-100">Wind</dt>
              <dd className="font-semibold">{num(current.wind_speed_10m)} km/h</dd>
            </div>
            <div>
              <dt className="text-brand-100">Today</dt>
              <dd className="font-semibold">
                {num(today?.temp_min)}° / {num(today?.temp_max)}°
              </dd>
            </div>
          </dl>
        </Card>

        <Card className={`${irrigationStyle.bg} ${irrigationStyle.border}`}>
          <CardTitle icon={Droplets}>Irrigation today</CardTitle>
          <p className={`text-2xl font-bold ${irrigationStyle.text}`}>{irrigation.decision}</p>
          <p className="mt-2 text-sm text-slate-700">{irrigation.reason}</p>
          {irrigation.water_mm > 0 && (
            <p className="mt-3 text-sm font-medium text-slate-900">Apply about {irrigation.water_mm} mm of water</p>
          )}
          <Link to="/irrigation" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
            Open advisor <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Card>

        <Card>
          <CardTitle icon={Sun}>Drought risk</CardTitle>
          <span className={`inline-block rounded-full px-4 py-1.5 text-lg font-bold ${droughtStyle.bg} ${droughtStyle.text}`}>
            {drought.level}
          </span>
          <p className="mt-3 text-sm text-slate-700">
            {drought.rain_30d_mm} mm of rain in the last 30 days · {drought.dry_days} dry days in a row
          </p>
          <Link to="/drought" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
            View details <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle icon={CloudRain}>Rainfall – next 7 days</CardTitle>
          <div className="mb-5 grid grid-cols-3 gap-3">
            <Stat label="Total rain" value={rainfall.total_mm} unit="mm" />
            <Stat label="Rainy days" value={rainfall.rainy_days} unit="/ 7" />
            <Stat label="Avg. chance" value={rainfall.average_probability ?? '–'} unit="%" />
          </div>
          <RainChart days={data.days} />
        </Card>

        <Card>
          <CardTitle icon={Bell}>Weather alerts (48 h)</CardTitle>
          {hazards.length === 0 ? (
            <p className="rounded-xl bg-brand-50 p-4 text-sm text-brand-900">
              No severe weather expected in the next 48 hours.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {hazards.slice(0, 4).map((h) => (
                <li key={`${h.type}-${h.start}`} className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                  <p className="flex items-center gap-2 font-semibold text-orange-900">
                    <HazardIcon type={h.type} /> {h.title}
                  </p>
                  <p className="mt-1 text-xs text-orange-800">{dateTime(h.start)}</p>
                </li>
              ))}
            </ul>
          )}
          <Link to="/alerts" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
            Manage alerts <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Card>
      </div>
    </>
  )
}

export function HazardIcon({ type }) {
  const Icon = type === 'strong_wind' ? Wind : type.startsWith('extreme') ? Thermometer : CloudRain
  return <Icon className="size-4 shrink-0" aria-hidden="true" />
}
