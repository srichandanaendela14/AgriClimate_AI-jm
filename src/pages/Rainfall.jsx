import { CloudRain, Droplets } from 'lucide-react'
import { useApi } from '../lib/api.js'
import { dayName, num, shortDate, weatherInfo } from '../lib/format.js'
import { Card, CardTitle, DataSource, ErrorState, Loading, Page, PageHeader, Stat } from '../components/ui.jsx'
import RainChart from '../components/RainChart.jsx'

function rainLabel(mm) {
  if (mm < 1) return 'Dry'
  if (mm < 5) return 'Light rain'
  if (mm < 20) return 'Moderate rain'
  return 'Heavy rain'
}

export default function Rainfall() {
  const { data, error, isLoading, mutate } = useApi('/api/rainfall')

  return (
    <Page>
      <PageHeader
        title="Rainfall Prediction"
        description="7-day rainfall forecast for your farm location."
        meta={data}
      />
      {isLoading && <Loading />}
      {error && <ErrorState error={error} onRetry={() => mutate()} />}
      {data && (
        <>
          <DataSource meta={data} />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Expected rain (7 days)" value={data.summary.total_mm} unit="mm" />
            <Stat label="Rainy days" value={data.summary.rainy_days} unit="days" hint="1 mm or more" />
            <Stat label="Average rain chance" value={data.summary.average_probability ?? '–'} unit="%" />
            <Stat
              label="Wettest day"
              value={data.summary.wettest_day ? dayName(data.summary.wettest_day.date) : '–'}
              hint={data.summary.wettest_day ? `${num(data.summary.wettest_day.rain_mm, 1)} mm` : undefined}
            />
          </div>

          <Card className="mt-4">
            <CardTitle icon={CloudRain}>Expected rainfall</CardTitle>
            <RainChart days={data.days} />
          </Card>

          <h2 className="mt-8 mb-3 text-lg font-semibold text-slate-900">Day by day</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.days.map((day) => {
              const info = weatherInfo(day.weather_code)
              const Icon = info.icon
              return (
                <li key={day.date} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{dayName(day.date, false)}</p>
                      <p className="text-xs text-slate-500">{shortDate(day.date)}</p>
                    </div>
                    <Icon className="size-8 text-brand-700" aria-label={info.label} />
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{info.label}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="flex items-center gap-1 text-lg font-bold text-brand-900">
                      <Droplets className="size-4 text-sky-600" aria-hidden="true" />
                      {num(day.rain_mm, 1)} mm
                    </p>
                    <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-800">
                      {day.rain_probability ?? '–'}% chance
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                    <div className="h-full rounded-full bg-sky-500" style={{ width: `${day.rain_probability ?? 0}%` }} />
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    {rainLabel(day.rain_mm)} · {num(day.temp_min)}° / {num(day.temp_max)}°C
                  </p>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Page>
  )
}
