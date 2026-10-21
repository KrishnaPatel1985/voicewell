import { useState, type FormEvent } from 'react'
import { api, errorMessage } from '../api'
import { nextPath } from '../router'
import { useSession } from '../session'
import { Brand, Field, Icon, Link } from '../ui'

export default function Login() {
  const { signIn } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (!email.trim() || !password) {
      setError('Please enter your email and password.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const { user } = await api.login(email.trim(), password)
      // App sees the signed-in user on a public screen and moves on to `next` (or home).
      signIn(user)
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  const switchTo = `/signup${nextPath() === '/' ? '' : `?next=${encodeURIComponent(nextPath())}`}`

  return (
    <section className="flow-shell auth-card">
      <div className="auth-brand"><Brand /></div>
      <h1>Welcome back</h1>
      <p className="auth-copy">Log in to keep practising.</p>
      <form onSubmit={submit} noValidate>
        <Field id="login-email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" disabled={busy} />
        <Field id="login-password" label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" disabled={busy} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="web-primary auth-submit" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'} {!busy && <Icon name="arrow" />}
        </button>
      </form>
      <p className="auth-switch">New to Voicewell? <Link to={switchTo}>Create an account</Link></p>
      <p className="auth-note">We only keep your email and name. Your practice is never saved to your account.</p>
    </section>
  )
}
