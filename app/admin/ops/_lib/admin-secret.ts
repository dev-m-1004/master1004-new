const STORAGE_KEY = 'master1004_admin_backfill_secret'

export function loadAdminSecret(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(STORAGE_KEY) || ''
}

export function saveAdminSecret(secret: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, secret)
}

export function clearAdminSecret() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
}