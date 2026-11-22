import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
} from 'lucide-react'

const CODES = [
  { codes: [0], label: 'Clear sky', icon: Sun },
  { codes: [1, 2], label: 'Partly cloudy', icon: CloudSun },
  { codes: [3], label: 'Cloudy', icon: Cloud },
  { codes: [45, 48], label: 'Fog', icon: CloudFog },
  { codes: [51, 53, 55, 56, 57], label: 'Drizzle', icon: CloudDrizzle },
  { codes: [61, 63, 65, 66, 67, 80, 81, 82], label: 'Rain', icon: CloudRain },
  { codes: [71, 73, 75, 77, 85, 86], label: 'Snow', icon: CloudSnow },
  { codes: [95, 96, 99], label: 'Thunderstorm', icon: CloudLightning },
]

export function weatherInfo(code) {
  return CODES.find((c) => c.codes.includes(code)) || { label: 'Unknown', icon: Cloud }
}

export function dayName(isoDate, short = true) {
  const date = new Date(`${isoDate}T12:00:00`)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) return 'Today'
  return date.toLocaleDateString('en-US', { weekday: short ? 'short' : 'long' })
}

export function shortDate(isoDate) {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function dateTime(iso) {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function num(value, digits = 0) {
  if (value === null || value === undefined) return '–'
  return Number(value).toFixed(digits)
}

export const DROUGHT_STYLES = {
  Low: { text: 'text-brand-800', bg: 'bg-brand-100', bar: 'bg-brand-600', ring: 'ring-brand-600' },
  Moderate: { text: 'text-yellow-800', bg: 'bg-yellow-100', bar: 'bg-yellow-500', ring: 'ring-yellow-500' },
  High: { text: 'text-orange-800', bg: 'bg-orange-100', bar: 'bg-orange-500', ring: 'ring-orange-500' },
  Severe: { text: 'text-red-800', bg: 'bg-red-100', bar: 'bg-red-600', ring: 'ring-red-600' },
}

export const IRRIGATION_STYLES = {
  ok: { text: 'text-brand-800', bg: 'bg-brand-50', border: 'border-brand-200' },
  wait: { text: 'text-sky-800', bg: 'bg-sky-50', border: 'border-sky-200' },
  light: { text: 'text-yellow-800', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  urgent: { text: 'text-red-800', bg: 'bg-red-50', border: 'border-red-200' },
}
