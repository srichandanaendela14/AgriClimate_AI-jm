import { api } from './api.js'

export function pushSupport() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return { supported: false, reason: 'This browser does not support push notifications.' }
  }
  if (!window.isSecureContext) {
    return { supported: false, reason: 'Push notifications need a secure (HTTPS) connection.' }
  }
  return { supported: true }
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export async function getSubscription() {
  if (!pushSupport().supported) return null
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

export async function enablePush() {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted. Allow notifications in your browser settings.')
  }
  const registration = await navigator.serviceWorker.ready
  const { publicKey } = await api('/api/push/public-key')
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
  }
  await api('/api/push/subscribe', { method: 'POST', body: JSON.stringify(subscription.toJSON()) })
  return subscription
}

export async function disablePush() {
  const subscription = await getSubscription()
  if (!subscription) return
  await api('/api/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint: subscription.endpoint }) })
  await subscription.unsubscribe()
}
