import useSWR from 'swr'

const API_BASE = import.meta.env.VITE_API_URL || ''

export async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`)
    error.fields = data.fields
    throw error
  }
  return data
}

const swrOptions = { revalidateOnFocus: false, dedupingInterval: 60_000 }

export const useApi = (path) => useSWR(path, api, swrOptions)
