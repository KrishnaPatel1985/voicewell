import { useState, type FormEvent } from 'react'
import { api, errorMessage } from '../api'
import { nextPath } from '../router'
import { useSession } from '../session'
import { Brand, Field, Icon, Link } from '../ui'

const MIN_PASSWORD = 8

export default function Signup() {
  const { signIn } = useSession()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (!email.trim()) {
      setError('Please enter your email.')
      return
    }
    if (password.length < MIN_PASSWORD) {
      setError(`Your password needs at least ${MIN_PASSWORD} characters.`)
      return
    }
    setBusy(true)
    setError('')
    try {
      const name = displayName.trim()
      const { user } = await api.signup(email.trim(), password, name || undefined)
      signIn(user)
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  const switchTo = `/login${nextPath() === '/' ? '' : `?next=${encodeURIComponent(nextPath())}`}`

  return (
    <section className="flow-shell auth-card">
      <div className="auth-brand"><Brand /></div>
      <h1>Create your account</h1>
      <p className="auth-copy">It takes a minute. Then you can start practising.</p>
      <form onSubmit={submit} noValidate>
        <Field id="signup-name" label="Display name" hint="Optional. We use the start of your email if you leave it blank." value={displayName} onChange={setDisplayName} autoComplete="nickname" maxLength={40} disabled={busy} />
        <Field id="signup-email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" disabled={busy} />
        <Field id="signup-password" label="Password" type="password" hint={`At least ${MIN_PASSWORD} characters.`} value={password} onChange={setPassword} autoComplete="new-password" maxLength={128} disabled={busy} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="web-primary auth-submit" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'} {!busy && <Icon name="arrow" />}
        </button>
      </form>
      <p className="auth-switch">Already have an account? <Link to={switchTo}>Log in</Link></p>
      <p className="auth-note">We only keep your email and name. Your practice is never saved to your account.</p>
    </section>
  )
}
