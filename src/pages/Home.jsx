import { Link } from 'react-router-dom'
import { ArrowRight, Bell, CloudRain, Droplets, Sun } from 'lucide-react'

const FEATURES = [
  {
    to: '/rainfall',
    icon: CloudRain,
    title: 'Rainfall Prediction',
    text: '7-day rainfall forecast for your farm with rain chance and expected millimetres.',
  },
  {
    to: '/irrigation',
    icon: Droplets,
    title: 'Smart Irrigation',
    text: 'Know if you should water today based on weather, crop type and soil moisture.',
  },
  {
    to: '/drought',
    icon: Sun,
    title: 'Drought Warning',
    text: 'Clear Low, Moderate, High and Severe drought levels with practical advice.',
  },
  {
    to: '/alerts',
    icon: Bell,
    title: 'Weather Alerts',
    text: 'Phone notifications 2–3 hours before heavy rain, storms, strong wind or extreme heat.',
  },
]

const STEPS = [
  { n: '1', title: 'Set your farm', text: 'Add your location, crop and soil in Farmer Profile.' },
  { n: '2', title: 'Check your dashboard', text: 'See today’s weather, irrigation advice and drought risk.' },
  { n: '3', title: 'Turn on alerts', text: 'Get warnings on your phone before bad weather arrives.' },
]

export default function Home() {
  return (
    <>
      <section className="relative isolate overflow-hidden">
        <img
          src="/images/farm-hero.jpg"
          alt=""
          className="absolute inset-0 -z-10 size-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-brand-900/90 via-brand-900/70 to-brand-900/30" />
        <div className="mx-auto max-w-6xl px-4 py-20 md:py-32">
          <p className="mb-3 inline-block rounded-full bg-white/15 px-3 py-1 text-sm font-medium text-white">
            Live weather from Open-Meteo
          </p>
          <h1 className="max-w-2xl text-4xl font-extrabold tracking-tight text-white md:text-5xl text-balance">
            Simple weather advice for better farming
          </h1>
          <p className="mt-4 max-w-xl text-lg text-brand-50 text-pretty">
            AgriClimate AI turns weather forecasts into clear advice: when it will rain, when to irrigate, how
            serious the drought risk is, and when to protect your crops.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-brand-800 hover:bg-brand-50"
            >
              Open Dashboard <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              to="/profile"
              className="inline-flex items-center gap-2 rounded-lg border border-white/50 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              Set up my farm
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-bold text-brand-900">Four tools in one app</h2>
        <p className="mt-1 text-slate-600">Tap any feature to open it.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ to, icon: Icon, title, text }) => (
            <Link
              key={to}
              to={to}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-500 hover:shadow-md"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                <Icon className="size-6" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-semibold text-slate-900 group-hover:text-brand-800">{title}</h3>
              <p className="mt-1 text-sm text-slate-600">{text}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-brand-50">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-bold text-brand-900">How it works</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.n} className="flex gap-4 rounded-2xl bg-white p-5 shadow-sm">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-700 font-bold text-white">
                  {step.n}
                </span>
                <div>
                  <h3 className="font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm text-slate-600">
            Tip: install AgriClimate AI on your phone. In your browser menu choose <strong>Add to Home screen</strong>.
          </p>
        </div>
      </section>
    </>
  )
}
