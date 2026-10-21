import { useEffect, useState } from 'react'
import { api, errorMessage, redirectIfNoSession } from '../api'
import { t } from '../i18n'
import { offNote } from '../reasons'
import { navigate } from '../router'
import { useConfig } from '../session'
import type { Feedback as FeedbackData } from '../types'
import { Icon, Link, Mascot, Note } from '../ui'

const LEVEL_CLASS: Record<string, string> = { Strong: 'strong', Growing: 'growing', 'Try next': 'try-next' }

function normalize(raw: Partial<FeedbackData>): FeedbackData {
  return {
    summary: raw.summary ?? '',
    skills: raw.skills ?? [],
    strengths: raw.strengths ?? [],
    improvements: raw.improvements ?? [],
    missingQuestions: raw.missingQuestions ?? [],
    suggestedPhrases: raw.suggestedPhrases ?? [],
    tone: raw.tone,
    turnsPracticed: raw.turnsPracticed ?? 0,
  }
}

export default function Feedback() {
  const config = useConfig()
  const lang = config.language ?? 'en'
  const ageGroup = config.ageGroup ?? (config.age && config.age <= 12 ? 'kids' : config.age && config.age <= 17 ? 'teens' : 'adults')

  const [data, setData] = useState<FeedbackData | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editableTakeaway, setEditableTakeaway] = useState('')
  const [editablePhrase, setEditablePhrase] = useState('')
  const [editableNextStep, setEditableNextStep] = useState('')

  useEffect(() => {
    let live = true
    api
      .feedback()
      .then((result) => {
        if (!live) return
        const norm = normalize(result)
        setData(norm)
        setEditableTakeaway(norm.strengths[0]?.point ?? norm.summary)
        setEditablePhrase(norm.suggestedPhrases[0]?.try ?? 'I want to explain how I feel and what would help right now.')
        setEditableNextStep(norm.improvements[0]?.point ?? 'Pick a calm time to share this with the other person.')
      })
      .catch((e: unknown) => {
        if (live && !redirectIfNoSession(e)) setError(errorMessage(e))
      })
    return () => {
      live = false
    }
  }, [])

  const again = async () => {
    setBusy(true)
    try {
      await api.practiceReset()
      navigate('/practice')
    } catch (e) {
      if (!redirectIfNoSession(e)) setError(errorMessage(e))
      setBusy(false)
    }
  }

  if (error && !data) {
    return (
      <section className="feedback-web">
        <Note tone="warn">{error}</Note>
        <div className="feedback-actions">
          <Link to="/home" className="web-secondary">Back to Home</Link>
        </div>
      </section>
    )
  }
  if (!data) return <p className="screen-loading" role="status">Thinking about how that went…</p>

  const toneNote = !data.tone ? offNote(config.capabilities.toneFeedback) : null
  const queryParams = new URLSearchParams({
    topic: config.topicTitle ?? config.topic ?? 'Conversation Practice',
    reflection: editableTakeaway,
    phrase: editablePhrase,
    nextStep: editableNextStep,
  }).toString()

  return (
    <section className="feedback-web">
      <div className="feedback-hero">
        <span><Icon name="check" size={28} /></span>
        <small>Practice complete{config.topicTitle ? ` · ${config.topicTitle}` : ''}</small>
        <h1>Here’s what went well.</h1>
        <p className="hero-summary">{data.summary}</p>
        <p className="hero-disclaimer">
          This is feedback on how you communicated, not a score and not a medical assessment. Coaching moments are excluded.
        </p>
      </div>

      {/* Age-Adapted Reflection Card */}
      <div className={`age-reflection-card reflection-${ageGroup}`}>
        {ageGroup === 'kids' && (
          <>
            <div className="reflection-badge">🌟 Wello’s Illustrated Takeaway (Ages 6–12)</div>
            <div className="kids-takeaway-row">
              <span className="takeaway-illus" aria-hidden="true"><Mascot size={56} /></span>
              <div>
                <strong>What you practised:</strong>
                <p>{editableTakeaway}</p>
                <blockquote>&ldquo;{editablePhrase}&rdquo;</blockquote>
              </div>
            </div>
          </>
        )}

        {ageGroup === 'teens' && (
          <>
            <div className="reflection-badge">✨ Your Takeaway (Editable · Ages 13–17)</div>
            <label className="reflection-field">
              <span>Put your takeaway in your own words before saving or sharing:</span>
              <textarea
                rows={2}
                value={editableTakeaway}
                onChange={(e) => setEditableTakeaway(e.target.value)}
              />
            </label>
            <label className="reflection-field">
              <span>Phrase to keep handy:</span>
              <input
                type="text"
                value={editablePhrase}
                onChange={(e) => setEditablePhrase(e.target.value)}
              />
            </label>
          </>
        )}

        {ageGroup === 'adults' && (
          <>
            <div className="reflection-badge">📋 Structured Reflection (Adults 18+)</div>
            <div className="adult-reflection-grid">
              <label className="reflection-field">
                <span>Key takeaway</span>
                <textarea rows={2} value={editableTakeaway} onChange={(e) => setEditableTakeaway(e.target.value)} />
              </label>
              <label className="reflection-field">
                <span>Useful phrase</span>
                <textarea rows={2} value={editablePhrase} onChange={(e) => setEditablePhrase(e.target.value)} />
              </label>
              <label className="reflection-field">
                <span>Concrete next step</span>
                <textarea rows={2} value={editableNextStep} onChange={(e) => setEditableNextStep(e.target.value)} />
              </label>
            </div>
          </>
        )}
      </div>

      {/* Post-Practice Next Steps: Create a journal card · Help someone understand · Find a specialist */}
      <div className="post-practice-next-steps">
        <h2>What would you like to do next?</h2>
        <div className="next-steps-grid">
          <Link to={`/journal?draft=1&${queryParams}`} className="next-step-card">
            <span className="ns-icon"><Icon name="book" /></span>
            <strong>{t(lang, 'feedback.createJournal')}</strong>
            <p>Preview and save a private reflection card to your account journal. Raw transcripts are never saved automatically.</p>
          </Link>

          <Link to={`/journal?share=1&${queryParams}`} className="next-step-card highlight">
            <span className="ns-icon"><Icon name="heart" /></span>
            <strong>
              {ageGroup === 'kids'
                ? t(lang, 'feedback.kidsShare')
                : ageGroup === 'teens'
                  ? t(lang, 'feedback.teensShare')
                  : t(lang, 'feedback.helpUnderstand')}
            </strong>
            <p>Create an approved support card and share a private link or QR code with a parent, guardian, or trusted person.</p>
          </Link>

          <Link to="/specialists" className="next-step-card">
            <span className="ns-icon"><Icon name="calendar" /></span>
            <strong>{t(lang, 'feedback.findSpecialist')}</strong>
            <p>Browse verified communication, youth, and family specialists or request an appointment.</p>
          </Link>
        </div>
      </div>

      <div className="skill-row" role="list" aria-label="Your conversation skills">
        {data.skills.map((skill) => (
          <div key={skill.name} className="skill-chip" role="listitem">
            <div>
              <strong>{skill.name}</strong>
              <span className={`level-badge ${LEVEL_CLASS[skill.level] ?? ''}`}>{skill.level}</span>
            </div>
            <p>{skill.note}</p>
          </div>
        ))}
      </div>

      {data.strengths.length > 0 && (
        <div className="fb-section">
          <h2>1. Specific strength</h2>
          <div className="feedback-grid">
            {data.strengths.map((item, i) => (
              <article key={i}>
                <span><Icon name="check" /></span>
                <div><strong>{item.point}</strong>{item.quote && <blockquote className="fb-quote">“{item.quote}”</blockquote>}</div>
              </article>
            ))}
          </div>
        </div>
      )}

      {data.improvements.length > 0 && (
        <div className="fb-section">
          <h2>2. One thing to try next</h2>
          <div className="feedback-grid">
            {data.improvements.map((item, i) => (
              <article key={i} className="try-next">
                <span><Icon name="spark" /></span>
                <div><strong>{item.point}</strong>{item.quote && <blockquote className="fb-quote">“{item.quote}”</blockquote>}</div>
              </article>
            ))}
          </div>
        </div>
      )}

      {data.suggestedPhrases.length > 0 && (
        <div className="fb-section">
          <h2>3. Phrase to try</h2>
          <div className="phrases">
            {data.suggestedPhrases.map((phrase, i) => (
              <div key={i} className="swap">
                {phrase.instead && <p className="swap-instead"><span className="sr-only">Instead of: </span>“{phrase.instead}”</p>}
                <blockquote>“{phrase.try}”</blockquote>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.missingQuestions.length > 0 && (
        <div className="fb-section">
          <h2>Questions you could ask</h2>
          <div className="feedback-grid">
            {data.missingQuestions.map((question, i) => (
              <article key={i} className="try-next"><span><Icon name="info" /></span><div><strong>{question}</strong></div></article>
            ))}
          </div>
        </div>
      )}

      {data.tone && (
        <div className="feedback-grid">
          <article className="tone"><span><Icon name="volume" /></span><div><small>Your tone</small><strong>{data.tone}</strong></div></article>
        </div>
      )}
      {toneNote && <Note>{toneNote}</Note>}

      <div className="feedback-actions">
        <button className="web-primary" disabled={busy} onClick={again}><Icon name="play" /> Practise again</button>
        <Link to="/home" className="web-secondary">Back to Home</Link>
        <Link to="/lesson" className="web-secondary">Back to lessons</Link>
      </div>
      {error && <Note tone="warn">{error}</Note>}
    </section>
  )
}
