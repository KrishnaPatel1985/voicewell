import { useEffect, useState } from 'react'
import { KidSettings, KidSettingsProvider } from '@k-id/core'
import { api, errorMessage } from '../api'
import { SUPPORTED_COUNTRIES, SUPPORTED_LANGUAGES } from '../i18n'
import { navigate } from '../router'
import { useSession } from '../session'
import { load, save } from '../storage'
import { Icon, Link, Note } from '../ui'

export default function Settings() {
  const { config, setConfig } = useSession()
  const sessionId = load('kid.sessionId')

  const [country, setCountry] = useState(config?.country ?? load('vw.country') ?? 'US')
  const [language, setLanguage] = useState(config?.language ?? load('vw.language') ?? 'en')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api
      .getLocale()
      .then((loc) => {
        if (loc.country) setCountry(loc.country)
        if (loc.language) setLanguage(loc.language)
      })
      .catch(() => {})
  }, [])

  const handleLanguageChange = async (nextLang: string) => {
    setLanguage(nextLang)
    save('vw.language', nextLang)
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await api.updateLocale({ language: nextLang })
      if (res.config) setConfig(res.config)
      setNotice('Language updated. Your session and progress were preserved.')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleCountryChange = async (nextCountry: string) => {
    setCountry(nextCountry)
    save('vw.country', nextCountry)
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await api.updateLocale({ country: nextCountry, jurisdiction: nextCountry, language })
      if (res.config) setConfig(res.config)
      if (res.requiresKidCheck) {
        setNotice(
          `Country changed to ${nextCountry}. Because digital consent and AI permissions vary by jurisdiction, run a fresh k-ID check to load ${nextCountry} rules.`,
        )
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="settings-web">
      <div className="page-heading">
        <span className="web-kicker">Settings, Locale &amp; Permissions</span>
        <h1>What Voicewell can do</h1>
        <p>
          Change your language at any time without losing progress, switch countries to run a fresh jurisdiction check, or manage k-ID permissions below.
        </p>
      </div>

      {notice && <Note>{notice}</Note>}
      {error && <Note tone="warn">{error}</Note>}

      <div className="settings-locale-card">
        <div className="jb-row-2">
          <label>
            <span><strong>Language</strong> (changes immediately, preserves progress)</span>
            <select
              value={language}
              disabled={busy}
              onChange={(e) => void handleLanguageChange(e.target.value)}
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} disabled={!l.enabled}>
                  {l.nativeName} ({l.englishName}) {!l.enabled ? '— Unavailable' : ''}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span><strong>Country / Jurisdiction</strong> (changing country triggers a fresh k-ID check)</span>
            <select
              value={country}
              disabled={busy}
              onChange={(e) => void handleCountryChange(e.target.value)}
            >
              {SUPPORTED_COUNTRIES.filter((c) => c.supported).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name} ({c.code})
                </option>
              ))}
            </select>
            {SUPPORTED_COUNTRIES.find((c) => c.code === country)?.kidHighlight && (
              <small className="settings-hint">{SUPPORTED_COUNTRIES.find((c) => c.code === country)?.kidHighlight}</small>
            )}
          </label>
        </div>

        <div className="settings-locale-actions">
          <button
            type="button"
            className="web-secondary"
            onClick={() => navigate('/age')}
          >
            Run fresh Age &amp; Country k-ID Check <Icon name="arrow" />
          </button>
        </div>
      </div>

      {sessionId ? (
        <div className="kid-wrap wide">
          <KidSettingsProvider sessionId={sessionId}>
            <KidSettings />
          </KidSettingsProvider>
        </div>
      ) : (
        <div className="centered-card">
          <Note>Complete the age and country check to view live k-ID permission toggles here.</Note>
          <Link to="/age" className="web-primary">Start Age &amp; Country Check <Icon name="arrow" /></Link>
        </div>
      )}

      <Link to="/home" className="text-back"><Icon name="back" /> Back to Home</Link>
    </section>
  )
}
