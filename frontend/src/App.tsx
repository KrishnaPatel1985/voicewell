import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { KidCoreProvider } from '@k-id/core'
import { getKidLocalization } from '@k-id/core/localizations'
import { api, ApiError, SIGNED_OUT_EVENT } from './api'
import Guard from './Guard'
import { loginUrl, navigate, nextPath, usePath } from './router'
import { SessionContext } from './session'
import { forgetAll, load } from './storage'
import type { SessionConfig, User } from './types'
import { Footer, Header, Note } from './ui'
import Age from './screens/Age'
import CaregiverPortal from './screens/CaregiverPortal'
import Feedback from './screens/Feedback'
import Home from './screens/Home'
import Journal from './screens/Journal'
import Lesson from './screens/Lesson'
import Login from './screens/Login'
import Practice from './screens/Practice'
import Settings from './screens/Settings'
import Signup from './screens/Signup'
import Specialists from './screens/Specialists'
import Topic from './screens/Topic'
import Welcome from './screens/Welcome'

const PUBLIC_PATHS = ['/login', '/signup', '/caregiver']
const KNOWN_PATHS = [
  '/',
  '/age',
  '/home',
  '/topic',
  '/lesson',
  '/practice',
  '/feedback',
  '/journal',
  '/caregiver',
  '/specialists',
  '/settings',
  ...PUBLIC_PATHS,
]

type Auth = 'checking' | 'in' | 'out' | 'error'

export default function App() {
  const path = usePath()
  const [config, setConfig] = useState<SessionConfig | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [auth, setAuth] = useState<Auth>('checking')
  const loggedOut = useRef(false)

  const signIn = useCallback((next: User) => {
    setUser(next)
    setAuth('in')
  }, [])
  const signOut = useCallback(() => {
    setUser(null)
    setConfig(null)
    setAuth('out')
  }, [])
  const value = useMemo(() => ({ config, setConfig, user, signIn, signOut }), [config, user, signIn, signOut])

  const known = KNOWN_PATHS.includes(path)
  const isPublic = PUBLIC_PATHS.includes(path)
  const isAuthScreen = path === '/login' || path === '/signup'

  useEffect(() => {
    if (!known) navigate('/', true)
  }, [known])

  const fetchMe = useCallback(() => {
    api
      .me()
      .then(({ user: me }) => signIn(me))
      .catch((error: unknown) => setAuth(error instanceof ApiError && error.status === 401 ? 'out' : 'error'))
  }, [signIn])
  useEffect(fetchMe, [fetchMe])

  const checkAuth = () => {
    setAuth('checking')
    fetchMe()
  }

  useEffect(() => {
    window.addEventListener(SIGNED_OUT_EVENT, signOut)
    return () => window.removeEventListener(SIGNED_OUT_EVENT, signOut)
  }, [signOut])

  useEffect(() => {
    if (!known) return
    if (auth === 'in') loggedOut.current = false
    if (auth === 'out' && !isPublic) {
      navigate(loggedOut.current ? '/login' : loginUrl(window.location.pathname + window.location.search), true)
    }
    if (auth === 'in' && isAuthScreen) navigate(nextPath(), true)
  }, [auth, isPublic, isAuthScreen, known, path])

  const logout = async () => {
    try {
      await api.logout()
    } catch {
      // ignore network error on logout
    }
    forgetAll()
    loggedOut.current = true
    signOut()
  }

  const activeLanguage = config?.language ?? load('vw.language') ?? 'en'
  const kidLocalization = useMemo(() => getKidLocalization(activeLanguage), [activeLanguage])

  const large = config?.textSize === 'large'
  const rootClass = ['web-app', large ? 'large-text' : '', config?.preferences.moreVisuals ? 'more-visuals' : '']
    .filter(Boolean)
    .join(' ')

  let screen
  if (auth === 'checking' || (auth === 'out' && !isPublic) || (auth === 'in' && isAuthScreen)) {
    screen = <p className="screen-loading" role="status">Loading…</p>
  } else if (auth === 'error') {
    screen = (
      <section className="flow-shell centered-card">
        <Note tone="warn">We couldn’t reach Voicewell. Check your connection and try again.</Note>
        <button className="web-primary" onClick={checkAuth}>Try again</button>
      </section>
    )
  } else {
    screen = renderScreen(path)
  }

  return (
    <KidCoreProvider
      publishableKey={import.meta.env.VITE_KID_PUBLISHABLE_KEY}
      baseUrl={import.meta.env.VITE_KID_BASE_URL}
      localization={kidLocalization}
      declare={{
        permissions: [{ name: 'ai-chat' }, { name: 'ai-voice-mode' }],
        privacyPolicyUrl: `${window.location.origin}/privacy.html`,
        termsOfServiceUrl: `${window.location.origin}/terms.html`,
        iconUrl: '/icon.png',
        supportEmail: 'support@example.com',
      }}
      appearance={{ variables: { colorPrimary: '#176b62', fontFamily: '"DM Sans", sans-serif', radius: '14px' } }}
    >
      <SessionContext.Provider value={value}>
        <div className={rootClass}>
          <Header path={path} user={user} config={config} onLogout={() => void logout()} />
          <main className="web-main">{screen}</main>
          <Footer />
        </div>
      </SessionContext.Provider>
    </KidCoreProvider>
  )
}

function renderScreen(path: string) {
  switch (path) {
    case '/login':
      return <Login />
    case '/signup':
      return <Signup />
    case '/age':
      return <Age />
    case '/home':
      return <Guard key={path}><Home /></Guard>
    case '/topic':
      return <Guard key={path}><Topic /></Guard>
    case '/lesson':
      return <Guard key={path}><Lesson /></Guard>
    case '/practice':
      return <Guard key={path}><Practice /></Guard>
    case '/feedback':
      return <Guard key={path}><Feedback /></Guard>
    case '/journal':
      return <Journal />
    case '/caregiver':
      return <CaregiverPortal />
    case '/specialists':
      return <Specialists />
    case '/settings':
      return <Settings />
    default:
      return <Welcome />
  }
}
