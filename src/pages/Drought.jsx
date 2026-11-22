import { BarChart3, CheckCircle2, ListChecks, Sun } from 'lucide-react'
import { useApi } from '../lib/api.js'
import { DROUGHT_STYLES, shortDate } from '../lib/format.js'
import { Card, CardTitle, DataSource, ErrorState, Loading, Page, PageHeader, Stat } from '../components/ui.jsx'

const LEVELS = ['Low', 'Moderate', 'High', 'Severe']

export default function Drought() {
  const { data, error, isLoading, mutate } = useApi('/api/drought')

  return (
    <Page>
      <PageHeader
        title="Drought Monitor"
        description="Drought risk based on recent rainfall, evaporation, dry spells and soil moisture."
        meta={data}
      />
      {isLoading && <Loading />}
      {error && <ErrorState error={error} onRetry={() => mutate()} />}
      {data && <DroughtContent data={data} />}
    </Page>
  )
}

function DroughtContent({ data }) {
  const style = DROUGHT_STYLES[data.level]
  return (
    <>
      <DataSource meta={data} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardTitle icon={Sun}>Current warning level</CardTitle>
          <p className={`rounded-xl px-4 py-5 text-center text-3xl font-extrabold ${style.bg} ${style.text}`}>
            {data.level}
          </p>
          <ol className="mt-4 grid grid-cols-4 gap-1" aria-label="Warning scale">
            {LEVELS.map((level) => {
              const s = DROUGHT_STYLES[level]
              const active = level === data.level
              return (
                <li key={level} className="flex flex-col items-center gap-1">
                  <span className={`h-2.5 w-full rounded-full ${s.bar} ${active ? '' : 'opacity-30'}`} />
                  <span className={`text-xs ${active ? 'font-bold text-slate-900' : 'text-slate-500'}`}>{level}</span>
                </li>
              )
            })}
          </ol>
          <p className="mt-4 text-sm text-slate-600">
            Risk score: <strong>{data.score}</strong> of {data.max_score}
          </p>
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle icon={ListChecks}>What you should do</CardTitle>
          <ul className="flex flex-col gap-2">
            {data.advice.map((tip) => (
              <li key={tip} className="flex gap-2 text-slate-700">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden="true" />
                {tip}
              </li>
            ))}
          </ul>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Rain (30 days)" value={data.rain_30d_mm} unit="mm" />
            <Stat label="Evaporation (30 days)" value={data.et0_30d_mm} unit="mm" />
            <Stat label="Dry days in a row" value={data.dry_days} />
            <Stat label="Rain next 7 days" value={data.rain_7d_forecast_mm} unit="mm" />
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle icon={ListChecks}>How the level is calculated</CardTitle>
        <ul className="divide-y divide-slate-100">
          {data.factors.map((f) => (
            <li key={f.name} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="font-medium text-slate-900">{f.name}</p>
                <p className="text-sm text-slate-600">
                  {f.value} – {f.note}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${
                  f.points === 0 ? 'bg-brand-100 text-brand-800' : 'bg-orange-100 text-orange-800'
                }`}
              >
                +{f.points}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          Score 0–2 = Low, 3–4 = Moderate, 5–7 = High, 8+ = Severe.
        </p>
      </Card>

      <Card className="mt-4">
        <CardTitle icon={BarChart3}>Last 30 days: rain vs evaporation</CardTitle>
        <WaterBalanceChart history={data.history} />
      </Card>
    </>
  )
}

function WaterBalanceChart({ history }) {
  const max = Math.max(5, ...history.map((d) => Math.max(d.rain_mm, d.et0_mm)))
  return (
    <figure>
      <div className="flex h-40 items-end gap-0.5 md:gap-1" role="img" aria-label="Daily rainfall compared with evaporation for the last 30 days">
        {history.map((d) => (
          <div key={d.date} className="flex h-full flex-1 items-end gap-px" title={`${shortDate(d.date)}: ${d.rain_mm} mm rain, ${d.et0_mm} mm evaporation`}>
            <div className="flex-1 rounded-t-sm bg-sky-500" style={{ height: `${(d.rain_mm / max) * 100}%` }} />
            <div className="flex-1 rounded-t-sm bg-orange-400" style={{ height: `${(d.et0_mm / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-500">
        <span>{history[0] && shortDate(history[0].date)}</span>
        <span>{history.at(-1) && shortDate(history.at(-1).date)}</span>
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-sky-500" /> Rainfall (mm)</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-orange-400" /> Evaporation / crop water demand (mm)</span>
      </figcaption>
    </figure>
  )
}
