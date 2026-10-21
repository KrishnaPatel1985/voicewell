import type { HTMLInputTypeAttribute, MouseEvent, ReactNode } from 'react'
import { getStrings } from './i18n'
import { navigate } from './router'
import { load } from './storage'
import type { SessionConfig, User } from './types'

export type IconName =
  | 'arrow'
  | 'back'
  | 'book'
  | 'calendar'
  | 'check'
  | 'chevron'
  | 'close'
  | 'edit'
  | 'globe'
  | 'heart'
  | 'home'
  | 'info'
  | 'journal'
  | 'mic'
  | 'micoff'
  | 'pause'
  | 'person'
  | 'play'
  | 'search'
  | 'send'
  | 'shield'
  | 'spark'
  | 'text'
  | 'trash'
  | 'volume'

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    arrow: <><path d="M5 12h14" /><path d="m14 7 5 5-5 5" /></>,
    back: <path d="m15 18-6-6 6-6" />,
    book: <><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H20v16H7.5A3.5 3.5 0 0 0 4 21.5z" /><path d="M4 5.5v16" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3.6 9h16.8M3.6 15h16.8" /><path d="M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" />,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
    journal: <><path d="M5 3h14v18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M8 7h7M8 11h7M8 15h4" /></>,
    mic: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8" /></>,
    micoff: <><path d="m3 3 18 18" /><path d="M9 9v2a3 3 0 0 0 5 2.2M15 9.3V5a3 3 0 0 0-5.7-1.3" /><path d="M5 10a7 7 0 0 0 11 5.7M19 10a7 7 0 0 1-.6 2.8M12 17v4M8 21h8" /></>,
    pause: <path d="M9 5v14M15 5v14" />,
    person: <><circle cx="12" cy="8" r="4" /><path d="M4 22a8 8 0 0 1 16 0" /></>,
    play: <path d="m8 5 11 7-11 7z" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    send: <><path d="m22 2-11 11" /><path d="m22 2-7 20-4-9-9-4z" /></>,
    shield: <path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6z" />,
    spark: <><path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z" /></>,
    text: <path d="M4 6V3h16v3M12 3v18M8 21h8" />,
    trash: <><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7M14 10v7" /></>,
    volume: <><path d="M11 5 6 9H2v6h4l5 4z" /><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12" /></>,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

// Wello, the coral speech-bubble guide. `check` adds the small green tick used on the welcome card.
export function Mascot({ size = 48, check = false, className = '' }: { size?: number; check?: boolean; className?: string }) {
  return (
    <svg className={`mascot ${className}`} width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <path d="M60 14c27 0 48 17 48 39S87 92 60 92c-6 0-11-1-16-2l-20 13 6-21C17 75 12 65 12 53c0-22 21-39 48-39z" fill="#e08c6d" />
      <circle cx="33" cy="62" r="7" fill="#f0a98f" />
      <circle cx="87" cy="62" r="7" fill="#f0a98f" />
      <path d="M40 50q7-8 14 0M66 50q7-8 14 0M50 64q10 9 20 0" fill="none" stroke="#2b1d17" strokeWidth="4" strokeLinecap="round" />
      {check && (
        <>
          <circle cx="100" cy="22" r="14" fill="#7fb99a" stroke="#fffdf8" strokeWidth="3" />
          <path d="m93 22 5 5 9-10" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  )
}

export function Brand() {
  return (
    <div className="web-brand">
      <Mascot size={34} />
      <strong>Voicewell</strong>
    </div>
  )
}

export function VoiceOrb({ listening = false }: { listening?: boolean }) {
  return <div className={`web-orb ${listening ? 'listening' : ''}`}><i /><i /><i /><i /><i /></div>
}

export function Link({ to, className, title, children }: { to: string; className?: string; title?: string; children: ReactNode }) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate(to)
  }
  return <a href={to} className={className} title={title} onClick={onClick}>{children}</a>
}

const LANG_NAMES: Record<string, string> = { en: 'English', es: 'Español', 'zh-CN': '简体中文' }

const HOME_PATHS = ['/', '/age', '/home', '/topic', '/lesson', '/practice', '/feedback']

export function Header({
  path,
  user,
  config,
  onLogout,
}: {
  path: string
  user: User | null
  config?: SessionConfig | null
  onLogout: () => void
}) {
  const activeLang = config?.language ?? load('vw.language') ?? 'en'
  const t = getStrings(activeLang)
  const homeTarget = config ? '/home' : '/'
  const isHomeActive = HOME_PATHS.includes(path)
  const activeAge = config?.age ?? (load('vw.age') ? Number(load('vw.age')) : null)
  const activeJur = config?.jurisdiction ?? load('vw.jurisdiction') ?? load('vw.country')
  const groupBadge =
    config?.ageGroup === 'kids'
      ? 'Kids 6–12'
      : config?.ageGroup === 'teens'
        ? 'Teens 13–17'
        : config?.ageGroup === 'adults'
          ? 'Adults 18+'
          : activeAge
            ? `Age ${activeAge}`
            : null

  return (
    <header className="web-header">
      <Link to={homeTarget} className="brand-button"><Brand /></Link>
      {!user && (
        <Link to="/age" className="lang-pill" title="Switch age, country, or language">
          <Icon name="globe" size={17} /> {LANG_NAMES[activeLang] ?? 'English'}
        </Link>
      )}
      {user && (
        <>
          <nav aria-label="Primary navigation" className="primary-nav">
            <Link to={homeTarget} className={isHomeActive ? 'active' : ''}>
              <Icon name="home" size={18} /> <span className="nav-label">{t.navHome}</span>
            </Link>
            <Link to="/journal" className={path === '/journal' ? 'active' : ''}>
              <Icon name="journal" size={18} /> <span className="nav-label">{t.navJournal}</span>
            </Link>
            <Link to="/specialists" className={path === '/specialists' ? 'active' : ''}>
              <Icon name="search" size={18} /> <span className="nav-label">{t.navSpecialists}</span>
            </Link>
          </nav>
          <div className="header-right">
            {groupBadge && (
              <Link to="/age" className="context-pill" title="Switch age, country, or language">
                <strong>{groupBadge}</strong>
                {activeJur && <span>· {activeJur}</span>}
                <span>· {activeLang.toUpperCase()}</span>
              </Link>
            )}
            <Link to="/settings" className={`settings-pill ${path === '/settings' ? 'active' : ''}`} title={t.navPermissions}>
              <Icon name="shield" size={17} /> <span className="nav-label">{t.navPermissions}</span>
            </Link>
            <span className="nav-user" title={user.displayName}>{user.displayName}</span>
            <button type="button" className="nav-logout" onClick={onLogout}>{t.navLogout}</button>
          </div>
        </>
      )}
    </header>
  )
}

export function Footer() {
  return (
    <footer className="web-footer">
      <Brand />
      <p>Conversation practice, not diagnosis or medical advice.</p>
      <span><a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a> · <Link to="/caregiver">Caregiver Portal</Link></span>
    </footer>
  )
}

export function Note({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  return (
    <div className={`note ${tone}`} role="status">
      <Icon name="info" size={18} />
      <span>{children}</span>
    </div>
  )
}

export function FlowHeader({
  current,
  total = 4,
  title,
  copy,
  onBack,
  backLabel = 'Back',
}: {
  current: number
  total?: number
  title: string
  copy: string
  onBack: () => void
  backLabel?: string
}) {
  return (
    <>
      <button className="text-back" onClick={onBack}><Icon name="back" /> {backLabel}</button>
      <div className="flow-progress">
        <span>Step {current} of {total}</span>
        <div style={{ gridTemplateColumns: `repeat(${total}, 1fr)` }}>
          {Array.from({ length: total }).map((_, i) => (
            <i key={i} className={current >= i + 1 ? 'done' : ''} />
          ))}
        </div>
      </div>
      <div className="flow-heading"><h1>{title}</h1><p>{copy}</p></div>
    </>
  )
}

export function Field({ id, label, hint, type = 'text', value, onChange, autoComplete, maxLength, disabled }: {
  id: string
  label: string
  hint?: string
  type?: HTMLInputTypeAttribute
  value: string
  onChange: (value: string) => void
  autoComplete?: string
  maxLength?: number
  disabled?: boolean
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} maxLength={maxLength} disabled={disabled} aria-describedby={hint ? `${id}-hint` : undefined} />
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  )
}
