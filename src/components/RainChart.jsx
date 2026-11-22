import { dayName, num } from '../lib/format.js'

export default function RainChart({ days }) {
  const max = Math.max(5, ...days.map((d) => d.rain_mm))
  return (
    <figure>
      <div className="flex h-48 items-end gap-2 md:gap-4" role="img" aria-label="Expected rainfall for the next 7 days">
        {days.map((d) => (
          <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-xs font-semibold text-brand-900">{num(d.rain_mm, 1)}</span>
            <div
              className="w-full max-w-12 rounded-t-md bg-brand-600"
              style={{ height: `${Math.max(2, (d.rain_mm / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2 md:gap-4">
        {days.map((d) => (
          <div key={d.date} className="flex-1 text-center">
            <p className="text-xs font-medium text-slate-700">{dayName(d.date)}</p>
            <p className="text-xs text-sky-700">{d.rain_probability ?? '–'}%</p>
          </div>
        ))}
      </div>
      <figcaption className="mt-3 text-xs text-slate-500">Bars show expected rainfall (mm). Blue numbers show rain probability.</figcaption>
    </figure>
  )
}
