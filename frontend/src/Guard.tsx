import { useEffect, useState, type ReactNode } from 'react'
import { api, ApiError, redirectIfNoSession } from './api'
import { useSession } from './session'
import { Link, Note } from './ui'

// Spec section 3: on entering a guarded path, call GET /api/session. 401 goes to /age.
// Render with a `key` of the path so each entry re-checks.
export default function Guard({ children }: { children: ReactNode }) {
  const { setConfig } = useSession()
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let live = true
    api
      .session(true)
      .then((config) => {
        if (!live) return
        setConfig(config)
        setState('ready')
      })
      .catch((error: unknown) => {
        if (!live || redirectIfNoSession(error)) return
        setMessage(
          error instanceof ApiError && error.code === 'kid_unavailable'
            ? "We couldn't reach the age check service, so nothing is unlocked right now. Please try again in a moment."
            : "We couldn't load your session. Please try again.",
        )
        setState('error')
      })
    return () => {
      live = false
    }
  }, [setConfig])

  if (state === 'loading') return <p className="screen-loading" role="status">Loading…</p>
  if (state === 'error') {
    return (
      <section className="flow-shell centered-card">
        <Note tone="warn">{message}</Note>
        <button className="web-primary" onClick={() => window.location.reload()}>Try again</button>
        <Link to="/age" className="text-back">Start the age check again</Link>
      </section>
    )
  }
  return <>{children}</>
}
