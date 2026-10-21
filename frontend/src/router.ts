import { useSyncExternalStore } from 'react'

// A tiny pushState router: one path string, no library.

const EVENT = 'vw:navigate'

export function navigate(path: string, replace = false): void {
  if (window.location.pathname + window.location.search === path) {
    window.scrollTo({ top: 0 })
    return
  }
  if (replace) window.history.replaceState(null, '', path)
  else window.history.pushState(null, '', path)
  window.dispatchEvent(new Event(EVENT))
  window.scrollTo({ top: 0 })
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange)
  window.addEventListener(EVENT, onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener(EVENT, onChange)
  }
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, () => window.location.pathname, () => '/')
}

// The `next` query parameter on /login and /signup: only a same-site path, never a login screen itself.
export function nextPath(): string {
  const next = new URLSearchParams(window.location.search).get('next')
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/'
  const pathname = next.split(/[?#]/)[0]
  return pathname === '/login' || pathname === '/signup' ? '/' : next
}

// "/login?next=<where the person was>" (plain "/login" from the home page).
export function loginUrl(from: string): string {
  return from === '/' || from === '' ? '/login' : `/login?next=${encodeURIComponent(from)}`
}
