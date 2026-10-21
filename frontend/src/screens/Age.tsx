import { useState } from 'react'
import { COUNTRIES, LANGUAGES, getStrings, type CountryOption } from '../i18n'
import AgeGateFlow from '../kid/AgeGateFlow'
import { navigate } from '../router'
import { forget, load, persist } from '../storage'
import { FlowHeader, Icon, Note } from '../ui'

const MIN_AGE = 3
const MAX_AGE = 100
const START_AGE = 15

export const LOCALE_CHANGE_EVENT = 'vw:locale-change'

function savedAge(): number | null {
  const n = Number(load('vw.age'))
  return Number.isInteger(n) && n >= MIN_AGE && n <= MAX_AGE ? n : null
}

type OnboardingStep = 'age' | 'country' | 'language' | 'gate'

export default function Age() {
  const [age, setAge] = useState<number>(() => savedAge() ?? START_AGE)
  const [chosen, setChosen] = useState<boolean>(() => savedAge() !== null)
  const [countryCode, setCountryCode] = useState<string>(() => load('vw.country') ?? 'US')
  const [jurisdictionCode, setJurisdictionCode] = useState<string>(() => load('vw.jurisdiction') ?? 'US')
  const [language, setLanguage] = useState<string>(() => load('vw.language') ?? 'en')
  const [countrySearch, setCountrySearch] = useState('')
  const [langSearch, setLangSearch] = useState('')
  const [step, setStep] = useState<OnboardingStep>('age')

  const t = getStrings(language)
  const langKey = (language === 'es' || language === 'zh-CN' ? language : 'en') as 'en' | 'es' | 'zh-CN'

  const pickAge = (next: number) => {
    setChosen(true)
    setAge(Math.min(MAX_AGE, Math.max(MIN_AGE, next)))
  }

  const selectedCountry: CountryOption =
    COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES[0]

  const pickCountry = (c: CountryOption) => {
    setCountryCode(c.code)
    setJurisdictionCode(c.subdivisions?.[0]?.code ?? c.code)
  }

  const pickLanguage = (code: string) => {
    setLanguage(code)
    persist('vw.language', code)
    window.dispatchEvent(new Event(LOCALE_CHANGE_EVENT))
  }

  const confirmAge = () => {
    if (!chosen || age < 6) return
    if (savedAge() !== age) forget('kid.sessionId', 'kid.challengeId')
    persist('vw.age', String(age))
    setStep('country')
  }

  const confirmCountry = () => {
    if (!selectedCountry.supported) return
    if (load('vw.jurisdiction') !== jurisdictionCode) {
      forget('kid.sessionId', 'kid.challengeId')
    }
    persist('vw.country', countryCode)
    persist('vw.jurisdiction', jurisdictionCode)
    window.dispatchEvent(new Event(LOCALE_CHANGE_EVENT))
    setStep('language')
  }

  const confirmLanguage = () => {
    persist('vw.language', language)
    window.dispatchEvent(new Event(LOCALE_CHANGE_EVENT))
    setStep('gate')
  }

  // Step 4: Required k-ID Permission Steps
  if (step === 'gate') {
    return (
      <section className="flow-shell">
        <FlowHeader
          current={4}
          total={4}
          title={t.gateTitle}
          copy={t.gateCopy}
          backLabel={t.back}
          onBack={() => setStep('language')}
        />
        <AgeGateFlow
          age={age}
          jurisdiction={jurisdictionCode}
          language={language}
          onStartOver={() => setStep('age')}
        />
      </section>
    )
  }

  // Step 3: Searchable Language Picker
  if (step === 'language') {
    const q = langSearch.trim().toLowerCase()
    const filteredLangs = LANGUAGES.filter(
      (l) =>
        !q ||
        l.nativeName.toLowerCase().includes(q) ||
        l.englishName.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q),
    )
    const activeLangObj = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0]

    return (
      <section className="flow-shell">
        <FlowHeader
          current={3}
          total={4}
          title={t.languageTitle}
          copy={t.languageCopy}
          backLabel={t.back}
          onBack={() => setStep('country')}
        />

        <div className="picker-card">
          <div className="search-input-wrap">
            <Icon name="search" size={18} />
            <input
              type="search"
              value={langSearch}
              onChange={(e) => setLangSearch(e.target.value)}
              placeholder={t.searchLanguagePlaceholder}
              aria-label={t.searchLanguagePlaceholder}
            />
          </div>

          <div className="picker-list" role="listbox" aria-label={t.languageTitle}>
            {filteredLangs.map((lang) => {
              const isSelected = lang.code === language
              return (
                <button
                  key={lang.code}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={!lang.enabled}
                  className={`picker-option ${isSelected ? 'selected' : ''} ${!lang.enabled ? 'unavailable' : ''}`}
                  onClick={() => lang.enabled && pickLanguage(lang.code)}
                >
                  <div>
                    <strong>{lang.nativeName}</strong>
                    <small>{lang.englishName} · {lang.voiceNote[langKey]}</small>
                  </div>
                  <span className={`status-pill ${lang.enabled ? 'supported' : 'disabled'}`}>
                    {lang.enabled ? (isSelected ? '✓ ' + t.langEnabledBadge : t.langEnabledBadge) : t.langUnavailableBadge}
                  </span>
                </button>
              )
            })}
          </div>

          <Note>
            <strong>Selected: {activeLangObj.nativeName}</strong> — {activeLangObj.voiceNote[langKey]}
          </Note>
        </div>

        <button className="web-primary flow-next" onClick={confirmLanguage}>
          {t.continueBtn} <Icon name="arrow" />
        </button>
      </section>
    )
  }

  // Step 2: Searchable Country Picker
  if (step === 'country') {
    const q = countrySearch.trim().toLowerCase()
    const filteredCountries = COUNTRIES.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.nativeName.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q),
    )

    return (
      <section className="flow-shell">
        <FlowHeader
          current={2}
          total={4}
          title={t.countryTitle}
          copy={t.countryCopy}
          backLabel={t.back}
          onBack={() => setStep('age')}
        />

        <div className="picker-card">
          <div className="search-input-wrap">
            <Icon name="search" size={18} />
            <input
              type="search"
              value={countrySearch}
              onChange={(e) => setCountrySearch(e.target.value)}
              placeholder={t.searchCountryPlaceholder}
              aria-label={t.searchCountryPlaceholder}
            />
          </div>

          <div className="picker-list" role="listbox" aria-label={t.countryTitle}>
            {filteredCountries.map((c) => {
              const isSelected = c.code === countryCode
              return (
                <button
                  key={c.code}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`picker-option ${isSelected ? 'selected' : ''} ${!c.supported ? 'unsupported-opt' : ''}`}
                  onClick={() => pickCountry(c)}
                >
                  <div>
                    <strong>
                      {c.name} {c.nativeName !== c.name ? `(${c.nativeName})` : ''} · <code>{c.code}</code>
                    </strong>
                    <small>{c.kidSummary[langKey]}</small>
                  </div>
                  <span className={`status-pill ${c.supported ? (c.featured ? 'featured' : 'supported') : 'disabled'}`}>
                    {!c.supported ? 'Unsupported' : c.featured ? '★ Integrated Demo' : 'Supported'}
                  </span>
                </button>
              )
            })}
          </div>

          {selectedCountry.supported && selectedCountry.subdivisions && selectedCountry.subdivisions.length > 0 && (
            <div className="subdivision-box">
              <label htmlFor="subdivision-select">
                <span>{t.regionLabel}</span>
                <select
                  id="subdivision-select"
                  value={jurisdictionCode}
                  onChange={(e) => setJurisdictionCode(e.target.value)}
                >
                  {selectedCountry.subdivisions.map((sub) => (
                    <option key={sub.code} value={sub.code}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {!selectedCountry.supported ? (
            <Note tone="warn">
              <strong>{t.unsupportedCountryTitle} ({selectedCountry.name})</strong> — {t.unsupportedCountryBody}
            </Note>
          ) : (
            <Note>
              <strong>k-ID Jurisdiction `{jurisdictionCode}`:</strong> {selectedCountry.kidSummary[langKey]}
            </Note>
          )}
        </div>

        <button className="web-primary flow-next" onClick={confirmCountry} disabled={!selectedCountry.supported}>
          {t.continueBtn} <Icon name="arrow" />
        </button>
      </section>
    )
  }

  // Step 1: Individual-Age Roller + Dropdown
  const isUnderSix = chosen && age < 6
  const presetLabel =
    !chosen
      ? ''
      : age < 6
        ? 'Under 6 (Unsupported)'
        : age <= 12
          ? 'Kids preset (Ages 6–12 · Illustrated Activity Board)'
          : age <= 17
            ? 'Teens preset (Ages 13–17 · Conversation Space with Starters)'
            : 'Adults preset (Ages 18+ · Open Conversation Workspace)'

  return (
    <section className="flow-shell">
      <FlowHeader
        current={1}
        total={4}
        title={t.ageTitle}
        copy={t.ageCopy}
        backLabel={t.back}
        onBack={() => navigate('/')}
      />

      <div className="judge-presets" aria-label="Quick age presets for testing">
        <span>Quick select:</span>
        <button type="button" className={chosen && age === 10 ? 'active' : ''} onClick={() => pickAge(10)}>
          Child · 10
        </button>
        <button type="button" className={chosen && age === 12 ? 'active' : ''} onClick={() => pickAge(12)}>
          Child · 12 (BR pass)
        </button>
        <button type="button" className={chosen && age === 15 ? 'active' : ''} onClick={() => pickAge(15)}>
          Teen · 15 (US/AU/ES/CN diff)
        </button>
        <button type="button" className={chosen && age === 28 ? 'active' : ''} onClick={() => pickAge(28)}>
          Adult · 28
        </button>
      </div>

      <AgeRoller value={age} chosen={chosen} presetLabel={presetLabel} onChange={pickAge} />

      {isUnderSix && (
        <div className="flow-shell" style={{ maxWidth: 700, marginTop: 18 }}>
          <Note tone="warn">
            <strong>{t.underSixTitle}:</strong> {t.underSixBody}
          </Note>
        </div>
      )}

      <button className="web-primary flow-next" onClick={confirmAge} disabled={!chosen || isUnderSix}>
        {t.continueBtn} <Icon name="arrow" />
      </button>
    </section>
  )
}

function AgeRoller({
  value,
  chosen,
  presetLabel,
  onChange,
}: {
  value: number
  chosen: boolean
  presetLabel: string
  onChange: (age: number) => void
}) {
  const change = (next: number) => onChange(Math.min(MAX_AGE, Math.max(MIN_AGE, next)))
  const visible = [-2, -1, 0, 1, 2].map((offset) => {
    const a = value + offset
    return a >= MIN_AGE && a <= MAX_AGE ? a : null
  })

  return (
    <div className="age-roller-card">
      <div className="roller-intro">
        <span className="web-kicker">Age roller & dropdown</span>
        {chosen ? (
          <h2>
            You are <strong>{value === MAX_AGE ? '100+' : value}</strong>
          </h2>
        ) : (
          <h2>Choose your age</h2>
        )}
        <p>{chosen ? presetLabel : 'Scroll, use the arrow keys, drag the slider, or use the dropdown below.'}</p>
      </div>
      <div className="roller-control">
        <button aria-label="Decrease age" onClick={() => change(value - 1)} disabled={value <= MIN_AGE}>
          <Icon name="chevron" />
        </button>
        <div
          className="number-wheel"
          role="slider"
          aria-label="Age"
          aria-valuemin={MIN_AGE}
          aria-valuemax={MAX_AGE}
          aria-valuenow={value}
          tabIndex={0}
          onWheel={(event) => change(value + (event.deltaY > 0 ? 1 : -1))}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') change(value - 1)
            if (event.key === 'ArrowDown' || event.key === 'ArrowRight') change(value + 1)
            if (event.key === 'Home') change(MIN_AGE)
            if (event.key === 'End') change(MAX_AGE)
          }}
        >
          <i className="wheel-highlight" />
          {visible.map((a, index) => (
            <button
              key={`${a}-${index}`}
              className={index === 2 ? 'selected' : ''}
              disabled={a === null}
              onClick={() => a && change(a)}
            >
              {a === null ? '' : a === MAX_AGE ? '100+' : a}
            </button>
          ))}
        </div>
        <button aria-label="Increase age" onClick={() => change(value + 1)} disabled={value >= MAX_AGE}>
          <Icon name="chevron" />
        </button>
      </div>
      <div className="roller-range">
        <span>{MIN_AGE}</span>
        <input
          aria-label="Age slider"
          type="range"
          min={MIN_AGE}
          max={MAX_AGE}
          value={value}
          onChange={(event) => change(Number(event.target.value))}
        />
        <span>100+</span>
      </div>
      <div className="age-dropdown-row">
        <label htmlFor="age-direct-select">Or pick from dropdown:</label>
        <select
          id="age-direct-select"
          value={value}
          onChange={(e) => change(Number(e.target.value))}
        >
          {Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, i) => MIN_AGE + i).map((a) => (
            <option key={a} value={a}>
              {a === MAX_AGE ? '100+' : `${a} years old`}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
