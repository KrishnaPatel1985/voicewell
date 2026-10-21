import { useEffect, useRef, useState } from 'react'
import { api, errorMessage, redirectIfNoSession } from '../api'
import { offNote } from '../reasons'
import { navigate } from '../router'
import { useConfig } from '../session'
import type { CheckResult, Depth, LessonCard, LessonStep } from '../types'
import { Icon, Link, Note, type IconName } from '../ui'

// Pace setting from SessionConfig.learner.pace: how long Next stays locked after cards appear.
const PACE_DELAY_MS = { slow: 4000, guided: 2000, self: 0 } as const

const CARD_ICONS: IconName[] = ['heart', 'spark', 'book', 'calendar']

const DEPTH_ORDER: Depth[] = ['simple', 'standard', 'deep']

interface Answer {
  choice: number
  busy: boolean
  result?: CheckResult
  error?: string
}

export default function Lesson() {
  const config = useConfig()
  // Lesson calls are per topic (/api/lesson/{topic}/next), so onboarding must have chosen one.
  if (!config.topic) {
    return (
      <section className="flow-shell centered-card">
        <h1>Let’s pick a topic first</h1>
        <p>Your lesson is built around a topic.</p>
        <Link to="/topic" className="web-primary">Choose a topic</Link>
      </section>
    )
  }
  return <LessonStage topic={config.topic} />
}

function LessonStage({ topic }: { topic: string }) {
  const config = useConfig()
  const [step, setStep] = useState<LessonStep | null>(null)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [readyStep, setReadyStep] = useState<LessonStep | null>(null)
  const started = useRef(false)

  const fetchNext = () => api.lessonNext(topic)
  const fetchSimpler = () => api.lessonSimpler(topic)

  const run = async (fetchStep: () => Promise<LessonStep>) => {
    setLoading(true)
    setError('')
    try {
      const next = await fetchStep()
      setStep(next)
      setAnswers({})
    } catch (e) {
      if (!redirectIfNoSession(e)) setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  // GET /next advances the server's position, so make sure React StrictMode does not call it twice.
  useEffect(() => {
    if (started.current) return
    started.current = true
    void run(() => api.lessonNext(topic))
  }, [topic])

  // Slow / guided pace: Next stays disabled for a few seconds after new cards appear.
  const delay = PACE_DELAY_MS[config.learner.pace]
  useEffect(() => {
    if (!step || step.done || delay === 0) return
    const timer = setTimeout(() => setReadyStep(step), delay)
    return () => clearTimeout(timer)
  }, [step, delay])
  const unlocked = !step || step.done || delay === 0 || readyStep === step

  const answer = async (card: LessonCard, choice: number) => {
    setAnswers((prev) => ({ ...prev, [card.conceptId]: { choice, busy: true } }))
    try {
      const result = await api.lessonCheck(card.conceptId, choice)
      setAnswers((prev) => ({ ...prev, [card.conceptId]: { choice, busy: false, result } }))
    } catch (e) {
      if (redirectIfNoSession(e)) return
      setAnswers((prev) => ({ ...prev, [card.conceptId]: { choice, busy: false, error: errorMessage(e) } }))
    }
  }

  const practiceNote = offNote(config.capabilities.textPractice)
  const canPractise = config.capabilities.textPractice.on || config.capabilities.voicePractice.on

  if (error && !step) {
    return (
      <section className="lesson-web">
        <Note tone="warn">{error}</Note>
        <button className="web-primary" onClick={() => void run(fetchNext)}>Try again</button>
        <Link to="/topic" className="text-back">Pick a topic</Link>
      </section>
    )
  }

  if (!step) return <p className="screen-loading" role="status">Loading your lesson…</p>

  if (step.done) {
    return (
      <section className="lesson-web lesson-done">
        <span className="done-badge"><Icon name="check" size={30} /></span>
        <span className="web-kicker">Lesson complete{config.topicTitle ? ` · ${config.topicTitle}` : ''}</span>
        <h1>{canPractise ? 'Ready to practise' : 'Nice work'}</h1>
        <p>
          {canPractise
            ? 'You have the basics. Now say it out loud or type it, with a friendly practice partner. No score, no judgment.'
            : 'You finished the lesson. You can come back to it any time.'}
        </p>
        {practiceNote && <Note>{practiceNote}</Note>}
        {canPractise ? (
          <button className="web-primary" onClick={() => navigate('/practice')}>Ready to practise <Icon name="mic" /></button>
        ) : (
          <Link to="/topic" className="web-secondary">Back to topics</Link>
        )}
      </section>
    )
  }

  const first = step.index + 1
  const last = Math.min(step.index + step.cards.length, step.total)
  const progressLabel = last > first ? `Cards ${first}–${last} of ${step.total}` : `Card ${Math.min(first, step.total)} of ${step.total}`
  const allAnswered = step.cards.every((card) => !card.check || answers[card.conceptId]?.result)
  const atSimplest = step.cards.every((card) => DEPTH_ORDER.indexOf(card.depth) === 0)
  const paceHint = !unlocked && !loading

  return (
    <section className="lesson-web">
      <div className="lesson-top">
        <Link to="/topic" className="text-back"><Icon name="back" /> Change topic</Link>
        <Link to="/practice" className="skip-link">Skip to practice <Icon name="arrow" size={18} /></Link>
      </div>
      {config.topicTitle && <span className="web-kicker lesson-topic">{config.topicTitle}</span>}

      <div className="lesson-progress">
        <span>{progressLabel}</span>
        <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={step.total} aria-valuenow={last} aria-label="Lesson progress">
          <i style={{ width: `${(last / step.total) * 100}%` }} />
        </div>
      </div>

      <div className={`lesson-cards cols-${step.cards.length}`}>
        {step.cards.map((card, i) => {
          const a = answers[card.conceptId]
          return (
            <article key={card.conceptId} className="lesson-card">
              <header>
                <span className="card-number">{String(step.index + i + 1).padStart(2, '0')}</span>
                <span className="card-icon"><Icon name={CARD_ICONS[(step.index + i) % CARD_ICONS.length]} size={26} /></span>
              </header>
              <h2>{card.title}</h2>
              <p className="card-body">{card.body}</p>

              {card.check && (
                <div className="quick-check">
                  <small>Quick check</small>
                  <strong>{card.check.question}</strong>
                  <div className="options" role="group" aria-label={card.check.question}>
                    {card.check.options.map((option, optionIndex) => {
                      const chosen = a?.choice === optionIndex
                      const state = a?.result && chosen ? (a.result.correct ? 'right' : 'wrong') : chosen ? 'chosen' : ''
                      return (
                        <button key={option} className={state} disabled={!!a?.result || a?.busy} aria-pressed={chosen} onClick={() => void answer(card, optionIndex)}>
                          {option}
                        </button>
                      )
                    })}
                  </div>
                  {a?.error && <Note tone="warn">{a.error}</Note>}
                  {a?.result && (
                    <div className={`explain ${a.result.correct ? 'right' : 'wrong'}`} role="status">
                      <strong>{a.result.correct ? 'Yes, that’s it.' : 'Not quite, and that’s okay.'}</strong>
                      <p>{a.result.explanation}</p>
                      {a.result.nextDepth !== card.depth && (
                        <small>{DEPTH_ORDER.indexOf(a.result.nextDepth) < DEPTH_ORDER.indexOf(card.depth) ? 'We’ll keep the next cards simpler.' : 'We’ll go a little deeper next.'}</small>
                      )}
                    </div>
                  )}
                </div>
              )}
            </article>
          )
        })}
      </div>

      {error && <Note tone="warn">{error}</Note>}
      {practiceNote && step.index === 0 && <Note>{practiceNote}</Note>}
      {paceHint && <p className="pace-hint" role="status">Take a moment to read. Next opens in a few seconds.</p>}

      <div className="lesson-actions">
        <button className="web-secondary" disabled={loading || atSimplest} onClick={() => void run(fetchSimpler)} title={atSimplest ? 'Already as simple as it gets' : undefined}>
          Say it simpler
        </button>
        <button className="web-primary" disabled={loading || !unlocked || !allAnswered} onClick={() => void run(fetchNext)}>
          Next <Icon name="arrow" />
        </button>
      </div>
      {!allAnswered && <p className="pace-hint">Answer the quick check to continue.</p>}
    </section>
  )
}
