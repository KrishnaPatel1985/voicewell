import { useEffect, useState, type FormEvent } from 'react'
import { api, errorMessage } from '../api'
import { SUPPORTED_LANGUAGES, t } from '../i18n'
import { useSession } from '../session'
import type { CaregiverInvite, CaregiverLesson } from '../types'
import { Icon, Link, Note } from '../ui'

export default function CaregiverPortal() {
  const { config } = useSession()
  const params = new URLSearchParams(window.location.search)
  const initialCode = params.get('code') ?? ''

  const [codeInput, setCodeInput] = useState(initialCode)
  const [activeCode, setActiveCode] = useState(initialCode)
  const [lang, setLang] = useState(params.get('lang') ?? config?.language ?? 'en')
  const [status, setStatus] = useState<string>('')
  const [invite, setInvite] = useState<CaregiverInvite | null>(null)
  const [lesson, setLesson] = useState<CaregiverLesson | null>(null)
  const [loading, setLoading] = useState(Boolean(initialCode))
  const [error, setError] = useState('')
  const [selectedAction, setSelectedAction] = useState('')
  const [actionSaved, setActionSaved] = useState(false)

  // Isolated Caregiver AI Practice state
  const [practiceOpen, setPracticeOpen] = useState(false)
  const [practiceInput, setPracticeInput] = useState('')
  const [practiceTurns, setPracticeTurns] = useState<{ caregiver: string; reply: string; tip: string }[]>([])
  const [practiceBusy, setPracticeBusy] = useState(false)

  useEffect(() => {
    if (!activeCode.trim()) return
    let live = true
    api
      .caregiverPortal(activeCode.trim(), lang)
      .then((res) => {
        if (!live) return
        setStatus(res.status)
        setInvite(res.invite)
        setLesson(res.lesson)
        setError('')
        if (res.invite?.supportActionChosen) {
          setSelectedAction(res.invite.supportActionChosen)
          setActionSaved(true)
        }
      })
      .catch((err) => {
        if (!live) return
        setError(errorMessage(err))
        setInvite(null)
        setLesson(null)
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [activeCode, lang])

  const submitAction = async () => {
    if (!activeCode || !selectedAction) return
    setError('')
    try {
      const res = await api.caregiverPortalAction(activeCode, selectedAction)
      setInvite(res.invite)
      setStatus(res.invite.status)
      setActionSaved(true)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const sendPractice = async (e: FormEvent) => {
    e.preventDefault()
    if (!activeCode || !practiceInput.trim() || practiceBusy) return
    const text = practiceInput.trim()
    setPracticeBusy(true)
    setPracticeInput('')
    try {
      const res = await api.caregiverPortalPractice(activeCode, text, lang)
      setPracticeTurns((prev) => [...prev, { caregiver: text, reply: res.reply, tip: res.coachTip }])
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPracticeBusy(false)
    }
  }

  return (
    <section className="caregiver-portal-shell">
      <div className="cp-top-bar">
        <div>
          <span className="web-kicker">Child-Initiated Support Portal</span>
          <h1>{t(lang, 'caregiver.portalTitle')}</h1>
          <p>{t(lang, 'caregiver.portalSubtitle')}</p>
        </div>
        <div className="cp-lang-picker">
          <label>
            <span>Language:</span>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
            >
              {SUPPORTED_LANGUAGES.filter((l) => l.enabled).map((l) => (
                <option key={l.code} value={l.code}>
                  {l.nativeName}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Code lookup bar if no code or switching code */}
      <form
        className="cp-code-lookup"
        onSubmit={(e) => {
          e.preventDefault()
          setActiveCode(codeInput.trim())
        }}
      >
        <input
          type="text"
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value)}
          placeholder="Enter Caregiver Invitation Code (e.g. CG-AB12CD)"
        />
        <button type="submit" className="web-primary">
          Open Card
        </button>
        <Link to="/journal?share=1" className="web-secondary">
          Back to My Invitations
        </Link>
      </form>

      {error && <Note tone="warn">{error}</Note>}
      {loading && <p className="screen-loading">Loading support card…</p>}

      {!loading && (status === 'revoked' || status === 'expired') && (
        <div className="centered-card">
          <Note tone="warn">
            This support invitation is <strong>{status}</strong> and is no longer active.
          </Note>
        </div>
      )}

      {!loading && invite && lesson && (
        <div className="cp-content-grid">
          {/* 1. Approved Support Card ONLY */}
          <div className="cp-approved-card">
            <div className="cp-card-header">
              <span className="pc-badge">Approved Support Card · {invite.caregiverRole}</span>
              <span className={`invite-status-pill ${invite.status}`}>Status: {invite.status.toUpperCase()}</span>
            </div>
            <h2>{invite.topic}</h2>

            <div className="cp-section">
              <small>What they want you to understand:</small>
              <p className="cp-highlight">{invite.whatToUnderstand}</p>
            </div>

            <div className="cp-section">
              <small>What kind of support helps most:</small>
              <p className="cp-highlight">{invite.whatSupportHelps}</p>
            </div>

            <div className="cp-section">
              <small>The phrase they practised saying:</small>
              <blockquote>&ldquo;{invite.usefulPhrase}&rdquo;</blockquote>
            </div>

            <p className="cp-privacy-note">
              🔒 Only this approved card was shared with you. Their private journal entries and practice sessions remain completely private.
            </p>
          </div>

          {/* 2. Short Listening Lesson + Phrases to Try / Avoid */}
          <div className="cp-lesson-card">
            <span className="web-kicker">{t(lang, 'caregiver.listeningLesson')}</span>
            <h2>{lesson.lessonTitle}</h2>
            <p>{lesson.lessonSummary}</p>

            <ol className="cp-steps-list">
              {lesson.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>

            <div className="cp-phrases-columns">
              <div className="cp-try-box">
                <h3>✓ {t(lang, 'caregiver.phrasesToTry')}</h3>
                <ul>
                  {lesson.phrasesToTry.map((p, i) => (
                    <li key={i}>&ldquo;{p}&rdquo;</li>
                  ))}
                </ul>
              </div>
              <div className="cp-avoid-box">
                <h3>✕ {t(lang, 'caregiver.phrasesToAvoid')}</h3>
                <ul>
                  {lesson.phrasesToAvoid.map((p, i) => (
                    <li key={i}>&ldquo;{p}&rdquo;</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* 3. Optional Isolated AI Practice for Caregiver */}
          <div className="cp-practice-card">
            <div className="cp-card-header">
              <div>
                <span className="web-kicker">Isolated Caregiver Sandbox</span>
                <h3>{t(lang, 'caregiver.isolatedPractice')}</h3>
              </div>
              <button
                type="button"
                className="web-secondary"
                onClick={() => setPracticeOpen((o) => !o)}
              >
                {practiceOpen ? 'Hide practice' : 'Try saying a supportive reply'}
              </button>
            </div>
            <p>
              Rehearse how you will respond before you talk in person. This sandbox is completely isolated and never modifies or views the young person’s private account.
            </p>

            {practiceOpen && (
              <div className="cp-sandbox">
                <div className="cp-sandbox-turns">
                  {practiceTurns.length === 0 && (
                    <p className="chat-empty">
                      Try typing one of the &ldquo;Phrases to try&rdquo; above to see how it lands.
                    </p>
                  )}
                  {practiceTurns.map((turn, idx) => (
                    <div key={idx} className="cp-turn-pair">
                      <div className="bubble user">
                        <small>You ({invite.caregiverRole})</small>
                        <p>{turn.caregiver}</p>
                      </div>
                      <div className="bubble assistant">
                        <small>Simulated Youth Perspective</small>
                        <p>{turn.reply}</p>
                        <span className="cp-coach-tip">💡 {turn.tip}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <form className="chat-input" onSubmit={sendPractice}>
                  <input
                    type="text"
                    value={practiceInput}
                    onChange={(e) => setPracticeInput(e.target.value)}
                    placeholder="Type a calm, validating response to practise…"
                    disabled={practiceBusy}
                  />
                  <button type="submit" disabled={practiceBusy || !practiceInput.trim()}>
                    <Icon name="send" />
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* 4. Commit to 1 Concrete Support Action */}
          <div className="cp-action-card">
            <span className="web-kicker">Complete the Support Loop</span>
            <h3>{t(lang, 'caregiver.chooseAction')}</h3>
            <p>Choose one concrete commitment so the sender knows you read their card and how you plan to support them:</p>
            <div className="cp-action-options">
              {lesson.supportActions.map((act) => (
                <label key={act} className={`cp-action-radio ${selectedAction === act ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="supportAction"
                    checked={selectedAction === act}
                    onChange={() => {
                      setSelectedAction(act)
                      setActionSaved(false)
                    }}
                  />
                  <span>{act}</span>
                </label>
              ))}
            </div>
            <div className="jb-actions">
              <button
                type="button"
                className="web-primary"
                disabled={!selectedAction}
                onClick={() => void submitAction()}
              >
                <Icon name="check" /> {actionSaved ? 'Commitment Saved (Completed)' : 'Confirm My Support Action'}
              </button>
            </div>
            {actionSaved && (
              <Note>
                Thank you! The invitation status is now marked as <strong>COMPLETED</strong> with your commitment: &ldquo;{selectedAction}&rdquo;.
              </Note>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
