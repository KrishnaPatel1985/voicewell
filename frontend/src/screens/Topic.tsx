import { useEffect, useState } from 'react'
import { api, errorMessage, redirectIfNoSession } from '../api'
import { offNote } from '../reasons'
import { navigate } from '../router'
import { useConfig, useSession } from '../session'
import { load } from '../storage'
import type { Intent, Preferences, TopicInfo } from '../types'
import { FlowHeader, Icon, Note, type IconName } from '../ui'

const ICON_NAMES: Partial<Record<IconName, true>> = { calendar: true, heart: true, book: true, spark: true }

const PREFERENCE_LABELS: { key: keyof Preferences; label: string; help: string }[] = [
  { key: 'largeText', label: 'Larger text', help: 'Easier to read' },
  { key: 'slowerPace', label: 'Slower pace', help: 'More time with each card' },
  { key: 'starters', label: 'Sentence starters', help: 'Ideas for what to say' },
  { key: 'captions', label: 'Captions', help: 'See the words as they are spoken' },
  { key: 'moreVisuals', label: 'More visuals', help: 'Icons on lesson cards' },
]

// An icon name the server sends that this build does not know falls back to a spark.
function topicIcon(topic: TopicInfo): IconName {
  return topic.icon in ICON_NAMES ? topic.icon : 'spark'
}

function savedIntent(fallback: Intent | null): Intent {
  const stored = load('vw.intent')
  if (stored === 'myself' || stored === 'someone-else') return stored
  return fallback ?? 'myself'
}

export default function Topic() {
  const config = useConfig()
  const { setConfig } = useSession()
  const [prefs, setPrefs] = useState<Preferences>(config.preferences)
  const [intent, setIntent] = useState<Intent>(() => savedIntent(config.intent))
  const [topics, setTopics] = useState<TopicInfo[] | null>(null)
  const [topicId, setTopicId] = useState<string | null>(config.topic)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [attempt, setAttempt] = useState(0)

  const textNote = offNote(config.capabilities.textPractice)
  const voiceNote = offNote(config.capabilities.voicePractice)

  // The topic cards come from the server (GET /api/topics), so a new topic file appears here by itself.
  useEffect(() => {
    let live = true
    api
      .topics()
      .then((r) => {
        if (!live) return
        setTopics(r.topics)
        setTopicId((current) => (current && r.topics.some((t) => t.id === current) ? current : (r.topics[0]?.id ?? null)))
      })
      .catch((e: unknown) => {
        if (live && !redirectIfNoSession(e)) setLoadError(errorMessage(e))
      })
    return () => {
      live = false
    }
  }, [attempt])

  const start = async () => {
    if (!topicId) return
    setBusy(true)
    setError('')
    try {
      setConfig(await api.onboarding(intent, topicId, prefs))
      navigate('/lesson')
    } catch (e) {
      if (!redirectIfNoSession(e)) setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <section className="flow-shell">
      <FlowHeader
        current={2}
        title="What would you like to practise?"
        copy="Pick a topic, then choose who you are preparing for."
        onBack={() => navigate('/age')}
      />

      <div className="intent-switch" role="group" aria-label="Who are you preparing for?">
        <button className={intent === 'myself' ? 'selected' : ''} aria-pressed={intent === 'myself'} onClick={() => setIntent('myself')}>For myself</button>
        <button className={intent === 'someone-else' ? 'selected' : ''} aria-pressed={intent === 'someone-else'} onClick={() => setIntent('someone-else')}>For someone else</button>
      </div>

      {!topics && !loadError && <p className="screen-loading" role="status">Loading topics…</p>}
      {loadError && (
        <div className="centered-card">
          <Note tone="warn">{loadError}</Note>
          <button className="web-secondary" onClick={() => { setLoadError(''); setAttempt((n) => n + 1) }}>Try again</button>
        </div>
      )}
      {topics && (
        <div className="topic-grid" role="group" aria-label="Topic">
          {topics.map((topic) => {
            const selected = topic.id === topicId
            return (
              <button key={topic.id} className={selected ? 'selected' : ''} aria-pressed={selected} onClick={() => setTopicId(topic.id)}>
                <span><Icon name={selected ? 'check' : topicIcon(topic)} /></span>
                <strong>{topic.title}</strong>
                <p>{topic.summary}</p>
              </button>
            )
          })}
        </div>
      )}

      <div className="prefs-panel">
        <h2>Make it comfortable</h2>
        <div className="prefs-grid">
          {PREFERENCE_LABELS.map(({ key, label, help }) => (
            <label key={key} className="pref-toggle">
              <input type="checkbox" checked={prefs[key]} onChange={(event) => setPrefs({ ...prefs, [key]: event.target.checked })} />
              <span><strong>{label}</strong><small>{help}</small></span>
            </label>
          ))}
        </div>
      </div>

      {config.status === 'pending' && (
        <Note>You can start the lessons now. {textNote ?? 'Practice opens once your grown-up approves.'}</Note>
      )}
      {config.status !== 'pending' && textNote && <Note>Typed practice: {textNote}</Note>}
      {config.status !== 'pending' && !textNote && voiceNote && <Note>Voice practice: {voiceNote} You can still practise by typing.</Note>}
      {error && <Note tone="warn">{error}</Note>}

      <button className="web-primary flow-next" disabled={busy || !topicId} onClick={start}>
        {busy ? 'Building…' : 'Build my practice'} <Icon name="arrow" />
      </button>
    </section>
  )
}
