import { useEffect, useState } from 'react'
import { Bell, BellOff, BellRing, Clock, History, Info, RefreshCw, Send, ShieldAlert } from 'lucide-react'
import { api, useApi } from '../lib/api.js'
import { dateTime } from '../lib/format.js'
import { disablePush, enablePush, getSubscription, pushSupport } from '../lib/push.js'
import { HazardIcon } from './Dashboard.jsx'
import {
  Card,
  CardTitle,
  DataSource,
  ErrorState,
  Loading,
  Page,
  PageHeader,
  buttonPrimary,
  buttonSecondary,
} from '../components/ui.jsx'

const THRESHOLDS = [
  ['Heavy rainfall', '7.5 mm or more in one hour'],
  ['Thunderstorm', 'Thunderstorm forecast by the weather model'],
  ['Strong wind', 'Wind 40 km/h or gusts 60 km/h and above'],
  ['Extreme heat', '40°C or hotter'],
  ['Frost / extreme cold', '2°C or colder'],
]

export default function Alerts() {
  const { data, error, isLoading, mutate } = useApi('/api/alerts')

  return (
    <Page>
      <PageHeader
        title="Weather Alerts"
        description="Get a phone notification about 2–3 hours before dangerous weather reaches your farm."
        meta={data}
      />
      <NotificationPanel onChange={() => mutate()} />
      {isLoading && <Loading />}
      {error && <ErrorState error={error} onRetry={() => mutate()} />}
      {data && <AlertsContent data={data} onRefresh={() => mutate()} />}
    </Page>
  )
}

function NotificationPanel({ onChange }) {
  const support = pushSupport()
  const inIframe = typeof window !== 'undefined' && window.self !== window.top
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    getSubscription().then((sub) => setSubscribed(Boolean(sub))).catch(() => {})
  }, [])

  async function run(action, success) {
    setBusy(true)
    setMessage(null)
    try {
      await action()
      setMessage({ type: 'ok', text: success })
      onChange()
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mb-6 border-brand-200 bg-brand-50">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white">
            {subscribed ? <BellRing className="size-6" aria-hidden="true" /> : <Bell className="size-6" aria-hidden="true" />}
          </span>
          <div>
            <h2 className="font-semibold text-slate-900">
              Phone notifications are {subscribed ? 'ON for this device' : 'OFF'}
            </h2>
            <p className="text-sm text-slate-600">
              {support.supported
                ? 'Works on Android, desktop browsers, and iPhone (iOS 16.4+) after adding the app to your Home Screen.'
                : support.reason}
            </p>
            {inIframe && (
              <p className="mt-1 text-sm font-medium text-yellow-800">
                You are viewing the app inside a frame. Open it in its own browser tab to allow notifications.
              </p>
            )}
          </div>
        </div>

        {support.supported && (
          <div className="flex flex-wrap gap-2">
            {subscribed ? (
              <>
                <button
                  type="button"
                  className={buttonPrimary}
                  disabled={busy}
                  onClick={() => run(() => api('/api/push/test', { method: 'POST' }), 'Test notification sent. Check your device.')}
                >
                  <Send className="size-4" aria-hidden="true" /> Send test
                </button>
                <button
                  type="button"
                  className={buttonSecondary}
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await disablePush()
                      setSubscribed(false)
                    }, 'Notifications turned off for this device.')
                  }
                >
                  <BellOff className="size-4" aria-hidden="true" /> Turn off
                </button>
              </>
            ) : (
              <button
                type="button"
                className={buttonPrimary}
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await enablePush()
                    setSubscribed(true)
                  }, 'Notifications enabled. You will be alerted before severe weather.')
                }
              >
                <Bell className="size-4" aria-hidden="true" /> {busy ? 'Enabling…' : 'Enable notifications'}
              </button>
            )}
          </div>
        )}
      </div>
      {message && (
        <p
          role="status"
          className={`mt-4 rounded-lg px-3 py-2 text-sm ${
            message.type === 'ok' ? 'bg-white text-brand-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </p>
      )}
    </Card>
  )
}

function AlertsContent({ data, onRefresh }) {
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState(null)

  async function checkNow() {
    setChecking(true)
    try {
      const result = await api('/api/alerts/check', { method: 'POST' })
      setCheckResult(
        result.sent.length
          ? `${result.sent.length} new alert(s) sent.`
          : 'Checked. No new alerts are due in the next 3 hours.',
      )
      onRefresh()
    } catch (err) {
      setCheckResult(err.message)
    } finally {
      setChecking(false)
    }
  }

  return (
    <>
      <DataSource meta={data} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-2">
            <CardTitle icon={ShieldAlert}>Upcoming hazards (next 48 hours)</CardTitle>
            <button type="button" className={`${buttonSecondary} mb-3 shrink-0 whitespace-nowrap px-3 py-1.5`} onClick={checkNow} disabled={checking}>
              <RefreshCw className={`size-4 ${checking ? 'animate-spin' : ''}`} aria-hidden="true" />
              Check now
            </button>
          </div>
          {checkResult && <p role="status" className="mb-3 text-sm text-slate-600">{checkResult}</p>}

          {data.upcoming.length === 0 ? (
            <p className="rounded-xl bg-brand-50 p-4 text-brand-900">
              Good news: no heavy rain, thunderstorms, strong winds or extreme temperatures are forecast for the next 48
              hours.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.upcoming.map((h) => (
                <li
                  key={`${h.type}-${h.start}`}
                  className={`rounded-xl border p-4 ${
                    h.severity === 'severe' ? 'border-red-200 bg-red-50' : 'border-orange-200 bg-orange-50'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-2 font-semibold text-slate-900">
                      <HazardIcon type={h.type} /> {h.title}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${
                        h.severity === 'severe' ? 'bg-red-600 text-white' : 'bg-orange-500 text-white'
                      }`}
                    >
                      {h.severity}
                    </span>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-sm text-slate-600">
                    <Clock className="size-4" aria-hidden="true" />
                    {dateTime(h.start)} · {h.lead_hours > 0 ? `in ${h.lead_hours} h` : 'now'}
                  </p>
                  <p className="mt-2 text-sm text-slate-800">{h.message}</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{h.advice}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardTitle icon={Info}>How alerts work</CardTitle>
            <p className="text-sm text-slate-600">
              The server checks the hourly forecast every {data.check_interval_minutes} minutes. When a hazard is due
              within 3 hours, a notification is sent to your {data.push_devices} subscribed device(s). Each event is
              only sent once.
            </p>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {THRESHOLDS.map(([name, rule]) => (
                <li key={name}>
                  <span className="font-medium text-slate-900">{name}:</span>{' '}
                  <span className="text-slate-600">{rule}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardTitle icon={History}>Sent alerts</CardTitle>
            {data.history.length === 0 ? (
              <p className="text-sm text-slate-600">No alerts sent yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-slate-100">
                {data.history.map((a) => (
                  <li key={a.id} className="py-2">
                    <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                    <p className="text-xs text-slate-500">
                      Event {dateTime(a.event_time)} · delivered to {a.sent_count} device(s)
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
