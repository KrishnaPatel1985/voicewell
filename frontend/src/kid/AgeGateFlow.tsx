import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  KidAgeGate,
  KidAgeGatePass,
  KidAgeGatePending,
  KidAgeGateProhibited,
  KidAgeGateFail,
  KidAgeGateError,
  KidSessionProvider,
} from '@k-id/core'
import { api } from '../api'
import { findCountry } from '../i18n'
import { navigate } from '../router'
import { useSession } from '../session'
import { forget, load, persist } from '../storage'
import { Icon, Note, type IconName } from '../ui'

type Claim =
  | { state: 'idle' }
  | { state: 'claiming' }
  | { state: 'ok'; status: 'pass' | 'pending' }
  | { state: 'error' }

function GateCard({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <div className="gate-card" role="status">
      <span className="gate-icon"><Icon name={icon} size={28} /></span>
      <h2>{title}</h2>
      {children}
    </div>
  )
}

function ResumeProbe({ idle, onValid }: { idle: boolean; onValid: (status: 'pass' | 'pending') => void }) {
  const { setConfig } = useSession()
  const latest = useRef(onValid)
  useEffect(() => {
    latest.current = onValid
  })
  useEffect(() => {
    if (!idle) return
    let live = true
    const timer = setTimeout(() => {
      api
        .session()
        .then((config) => {
          if (!live) return
          setConfig(config)
          latest.current(config.status)
        })
        .catch(() => {})
    }, 2500)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [idle, setConfig])
  return null
}

export default function AgeGateFlow({
  age,
  jurisdiction = 'US',
  language = 'en',
  onStartOver,
}: {
  age: number
  jurisdiction?: string
  language?: string
  onStartOver: () => void
}) {
  const { setConfig } = useSession()
  const [attempt, setAttempt] = useState(0)
  const [claim, setClaim] = useState<Claim>({ state: 'idle' })
  const [pendingBusy, setPendingBusy] = useState(false)
  const lastToken = useRef<string | null>(null)

  const sessionId = load('kid.sessionId') ?? undefined
  const challengeId = load('kid.challengeId') ?? undefined
  const countryInfo = findCountry(jurisdiction)
  const langKey = (language === 'es' || language === 'zh-CN' ? language : 'en') as 'en' | 'es' | 'zh-CN'

  const handleClaim = (token: string) => {
    if (lastToken.current === token) return
    lastToken.current = token
    setClaim({ state: 'claiming' })
    api
      .claim(token, age, jurisdiction, language)
      .then((result) => {
        setConfig(result.config)
        setClaim({ state: 'ok', status: result.status })
      })
      .catch(() => setClaim({ state: 'error' }))
  }

  const continueWhilePending = async () => {
    setPendingBusy(true)
    try {
      const result = await api.claimPending(age, jurisdiction, language)
      setConfig(result.config)
      navigate('/home')
    } catch {
      setClaim({ state: 'error' })
    } finally {
      setPendingBusy(false)
    }
  }

  const retry = () => {
    lastToken.current = null
    setClaim({ state: 'idle' })
    setAttempt((n) => n + 1)
  }

  const startOver = () => {
    forget('kid.sessionId', 'kid.challengeId')
    onStartOver()
  }

  const onProbeValid = (status: 'pass' | 'pending') =>
    setClaim((c) => (c.state === 'idle' ? { state: 'ok', status } : c))

  const continueButton = (label: string) =>
    claim.state === 'error' ? (
      <>
        <p className="gate-note">We couldn’t save your age check just now.</p>
        <button className="web-primary" onClick={retry}>Try again</button>
      </>
    ) : (
      <>
        <ResumeProbe idle={claim.state === 'idle'} onValid={onProbeValid} />
        <button className="web-primary" disabled={claim.state !== 'ok'} onClick={() => navigate('/home')}>
          {claim.state === 'ok' ? label : 'Saving…'} {claim.state === 'ok' && <Icon name="arrow" />}
        </button>
        {claim.state !== 'ok' && (
          <button className="text-back" onClick={startOver}>Taking a while? Start over</button>
        )}
      </>
    )

  return (
    <div className="kid-wrap wide">
      <div className="jurisdiction-banner" role="region" aria-label="Selected jurisdiction and language">
        <div>
          <span className="web-kicker"><Icon name="globe" size={14} /> Active k-ID Jurisdiction: {jurisdiction} ({countryInfo.name})</span>
          <p>{countryInfo.kidSummary[langKey]}</p>
        </div>
        {language !== 'en' && (
          <small className="locale-notice">
            {language === 'es'
              ? 'Aviso de idioma: Los textos de permisos de k-ID se muestran en Español donde están aprobados; el significado legal de la jurisdicción seleccionada no cambia.'
              : '语言说明：k-ID 权限通知已切换为简体中文（部分法律条款保留英文原文以确保法律含义准确无误）。'}
          </small>
        )}
      </div>

      <KidSessionProvider
        key={`${attempt}-${jurisdiction}-${age}`}
        jurisdiction={jurisdiction}
        age={{ age }}
        sessionId={sessionId}
        challengeId={challengeId}
        onSession={(id) => persist('kid.sessionId', id)}
        onChallenge={(id) => persist('kid.challengeId', id)}
        onClaim={handleClaim}
      >
        <KidAgeGate>
          <KidAgeGatePass>
            <GateCard icon="check" title={language === 'es' ? 'Todo listo' : language === 'zh-CN' ? '验证已完成' : "You're all set"}>
              <p>
                {language === 'es'
                  ? `Voicewell se ha adaptado para tu edad (${age}) y jurisdicción (${jurisdiction}).`
                  : language === 'zh-CN'
                    ? `Voicewell 已根据你的年龄（${age} 岁）和所在管辖区（${jurisdiction}）完成个性化配置。`
                    : `Voicewell has adjusted its workspace and permissions for age ${age} in ${jurisdiction}.`}
              </p>
              {continueButton(
                language === 'es'
                  ? 'Ir a mi espacio personalizado'
                  : language === 'zh-CN'
                    ? '进入我的专属首页'
                    : 'Continue to personalized home',
              )}
            </GateCard>
          </KidAgeGatePass>
          <KidAgeGatePending>
            <GateCard icon="heart" title="Waiting for a grown-up">
              <p>We’ve asked a grown-up to approve. You can start with non-AI activities and lessons right now — AI chat and voice open once they approve.</p>
              <button className="web-primary" disabled={pendingBusy} onClick={() => void continueWhilePending()}>
                {pendingBusy ? 'Opening…' : 'Continue to activities & lessons'} <Icon name="arrow" />
              </button>
              <p className="gate-note">If they approve while you wait, come back to Permissions and it will update.</p>
            </GateCard>
          </KidAgeGatePending>
          <KidAgeGateProhibited>
            <GateCard icon="info" title="Not available">
              <p>Voicewell isn’t available for your age in {jurisdiction}.</p>
              <button className="web-secondary" onClick={startOver}>Go back</button>
            </GateCard>
          </KidAgeGateProhibited>
          <KidAgeGateFail>
            <GateCard icon="info" title="No approval this time">
              <p>Your grown-up didn’t approve this time.</p>
              <button className="web-secondary" onClick={startOver}>Start over</button>
            </GateCard>
          </KidAgeGateFail>
          <KidAgeGateError>
            <GateCard icon="info" title="Something went wrong">
              <p>We couldn’t reach the age check.</p>
              <button className="web-primary" onClick={retry}>Try again</button>
              <button className="text-back" onClick={startOver}>Start over</button>
            </GateCard>
          </KidAgeGateError>
        </KidAgeGate>
      </KidSessionProvider>

      {claim.state === 'idle' && (
        <div className="pending-fallback-box">
          <Note>
            <strong>Parental consent required by {jurisdiction} law for age {age}?</strong>{' '}
            You can send a parent email above via k-ID, or preview the non-AI experience immediately while consent is pending:
          </Note>
          <button className="web-secondary" disabled={pendingBusy} onClick={() => void continueWhilePending()}>
            {pendingBusy ? 'Loading…' : `Enter non-AI workspace while waiting (Pending mode · Age ${age} · ${jurisdiction})`} <Icon name="arrow" />
          </button>
        </div>
      )}
    </div>
  )
}
