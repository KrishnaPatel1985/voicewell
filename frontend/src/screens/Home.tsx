import { useEffect, useState } from 'react'
import { api, errorMessage, redirectIfNoSession } from '../api'
import { useSpeaker } from '../audio/speak'
import SpeakButton from '../kid/SpeakButton'
import { SUPPORTED_COUNTRIES, t } from '../i18n'
import { offNote } from '../reasons'
import { navigate } from '../router'
import { useConfig, useSession } from '../session'
import type { Intent, PracticeMode, Preferences, SupportTarget, TopicInfo } from '../types'
import { ActivityIcon, FeelingFace } from '../kid/Art'
import { Icon, Link, Mascot, Note, VoiceOrb } from '../ui'

interface FeelingOption {
  id: string
  labelKey: string
  topic: string
  starter: Record<string, string>
}

const KID_FEELINGS: FeelingOption[] = [
  {
    id: 'happy',
    labelKey: 'kids.feel.happy',
    topic: 'need-help',
    starter: {
      en: 'I want to practise how to explain what I need clearly.',
      es: 'Quiero practicar cómo explicar lo que necesito con claridad.',
      'zh-CN': '我想练习怎样清楚地表达自己的需要。',
    },
  },
  {
    id: 'calm',
    labelKey: 'kids.feel.calm',
    topic: 'need-help',
    starter: {
      en: 'I feel calm and I want to practise saying what I need.',
      es: 'Me siento tranquilo y quiero practicar cómo decir lo que necesito.',
      'zh-CN': '我觉得很平静，想练习说出自己的需要。',
    },
  },
  {
    id: 'worried',
    labelKey: 'kids.feel.worried',
    topic: 'body-feelings',
    starter: {
      en: 'I feel worried because my stomach feels fluttery and I do not know what will happen.',
      es: 'Me siento preocupado porque siento mariposas en el estómago.',
      'zh-CN': '我觉得很担心，因为肚子里乱糟糟的，不知道会发生什么。',
    },
  },
  {
    id: 'sad',
    labelKey: 'kids.feel.sad',
    topic: 'hard-day',
    starter: {
      en: 'I feel sad because today was really hard and nobody listened yet.',
      es: 'Me siento triste porque hoy fue un día difícil.',
      'zh-CN': '我觉得很难过，因为今天很难熬，还没有人听我说。',
    },
  },
  {
    id: 'cross',
    labelKey: 'kids.feel.cross',
    topic: 'hard-day',
    starter: {
      en: 'I feel cross because something felt unfair and I want to explain.',
      es: 'Me siento enfadado porque algo me pareció injusto y quiero explicarlo.',
      'zh-CN': '我觉得很生气，因为有件事不公平，我想说清楚。',
    },
  },
  {
    id: 'tired',
    labelKey: 'kids.feel.tired',
    topic: 'hard-day',
    starter: {
      en: 'I feel tired and I need a little help today.',
      es: 'Me siento cansado y necesito un poco de ayuda hoy.',
      'zh-CN': '我觉得很累，今天需要一点帮助。',
    },
  },
  {
    id: 'unsure',
    labelKey: 'kids.notSure',
    topic: 'hard-day',
    starter: {
      en: "I'm not sure what this feeling is called, and I want help figuring it out.",
      es: 'No estoy seguro de cómo se llama lo que siento y quiero ayuda.',
      'zh-CN': '我不知道这种感觉叫什么，想请人帮我理一理。',
    },
  },
]

const DETECTIVE_CASES = [
  {
    id: 'lunch',
    character: 'Leo (Age 9)',
    emoji: '🥪',
    story: {
      en: 'At lunch, Leo saw his best friends sitting at a full table. Nobody waved him over, so he ate quietly by himself.',
      es: 'En el almuerzo, Leo vio a sus amigos en una mesa llena. Nadie lo llamó, así que comió solo.',
      'zh-CN': '午餐时，Leo 看到好朋友们坐在一张满员的桌子旁，没人招呼他，他只好一个人安静地吃饭。',
    },
    clues: ['Left out', 'Sad', 'Confused', 'A little angry', "Maybe they didn't see me"],
  },
  {
    id: 'doctor',
    character: 'Maya (Age 10)',
    emoji: '🩺',
    story: {
      en: 'Maya has a check-up after school. She wants to ask what will happen, but the nurse is talking fast to her mum.',
      es: 'Maya tiene consulta médica después de clases. Quiere preguntar qué pasará, pero hablan muy rápido.',
      'zh-CN': 'Maya 放学后要去看医生。她想问问会做什么检查，但护士正语速很快地和妈妈说话。',
    },
    clues: ['Nervous', 'Curious', 'Wants to be brave', 'Shy', 'Needs a pause'],
  },
]

const EXPLAIN_ANOTHER_WAY: Record<string, string[]> = {
  en: [
    'Step 1: Tap a picture for how your body or heart feels right now. Step 2: Pick one game below to build your words!',
    'Think of Wello as your practice buddy. Nothing you pick can be wrong — you can skip anything or try a sentence builder.',
    'If you do not know what you feel, tap "I\'m not sure" and we will figure it out together one small piece at a time.',
  ],
  es: [
    'Paso 1: Toca un dibujo de cómo te sientes. Paso 2: Elige una actividad para construir tus palabras.',
    'Wello es tu compañero de práctica. Ninguna respuesta es incorrecta y puedes saltar cualquier paso.',
  ],
  'zh-CN': [
    '第一步：点一点代表你现在心情的图标。第二步：选一个小活动，把你想说的话拼出来！',
    'Wello 是你的练习小伙伴。这里没有标准答案，任何感觉都是可以的，随时可以跳过。',
  ],
}

const TEEN_PROMPTS = [
  "Something has been building up all week",
  "I don't know how to bring it up",
  "Everyone expects an answer right now",
  "I want to say no without it being awkward",
  "I just need space to think",
]

export default function Home() {
  const config = useConfig()
  const { setConfig } = useSession()
  const lang = config.language ?? 'en'
  const ageGroup = config.ageGroup ?? (config.age && config.age <= 12 ? 'kids' : config.age && config.age <= 17 ? 'teens' : 'adults')

  const [topics, setTopics] = useState<TopicInfo[]>([])
  const [prefs, setPrefs] = useState<Preferences>(config.preferences)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [coachExplain, setCoachExplain] = useState<string | null>(null)

  // Kids state
  const [selectedFeeling, setSelectedFeeling] = useState<string>('unsure')
  const [kidActivity, setKidActivity] = useState<'none' | 'detective' | 'builder' | 'ask'>('none')
  const [explainIndex, setExplainIndex] = useState(0)
  const speaker = useSpeaker(lang)
  const [detectiveCaseIdx, setDetectiveCaseIdx] = useState(0)
  const [detectivePicks, setDetectivePicks] = useState<string[]>([])
  const pipLines = EXPLAIN_ANOTHER_WAY[lang] ?? EXPLAIN_ANOTHER_WAY.en
  const pipLine = pipLines[explainIndex % pipLines.length]
  const [feelWord, setFeelWord] = useState('worried')
  const [becauseWord, setBecauseWord] = useState('it feels like too much at once')
  const [needWord, setNeedWord] = useState('someone to listen without rushing me')
  const [trustedAdult, setTrustedAdult] = useState<'parent' | 'teacher' | 'doctor'>('parent')

  // Teens state
  const [teenInput, setTeenInput] = useState('')
  const [teenMode, setTeenMode] = useState<PracticeMode>(config.mode ?? 'practice')
  const [openTeenCard, setOpenTeenCard] = useState<'overwhelmed' | 'explain' | 'practice' | null>('overwhelmed')

  // Adults state
  const [adultInput, setAdultInput] = useState('')
  const [adultMode, setAdultMode] = useState<PracticeMode>(config.mode ?? 'practice')
  const [adultGuidanceOpen, setAdultGuidanceOpen] = useState(false)
  const [adultShortcut, setAdultShortcut] = useState<'feelings' | 'conversation' | 'appointment' | 'support'>('conversation')
  const [supportTarget, setSupportTarget] = useState<SupportTarget>(config.supportTarget ?? 'child')
  const [supportAge, setSupportAge] = useState<string>(config.supportAge ? String(config.supportAge) : '10')

  useEffect(() => {
    let live = true
    api
      .topics()
      .then((r) => {
        if (live) setTopics(r.topics)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  const launchFlow = async (opts: {
    topicId: string
    intent?: Intent
    mode?: PracticeMode
    destination: '/lesson' | '/practice'
    customGoal?: string
    supportTarget?: SupportTarget | null
    supportAge?: number | null
  }) => {
    setBusy(true)
    setError('')
    try {
      const updated = await api.onboarding(opts.intent ?? 'myself', opts.topicId, prefs, {
        mode: opts.mode ?? 'practice',
        customGoal: opts.customGoal,
        supportTarget: opts.supportTarget ?? null,
        supportAge: opts.supportAge ?? null,
        language: lang,
      })
      setConfig(updated)
      navigate(opts.destination)
    } catch (e) {
      if (!redirectIfNoSession(e)) setError(errorMessage(e))
      setBusy(false)
    }
  }

  const togglePref = async (key: keyof Preferences) => {
    const nextPrefs = { ...prefs, [key]: !prefs[key] }
    setPrefs(nextPrefs)
    try {
      const updated = await api.onboarding(config.intent ?? 'myself', config.topic ?? 'hard-day', nextPrefs, {
        mode: config.mode ?? 'practice',
        language: lang,
      })
      setConfig(updated)
    } catch {
      // keep local state
    }
  }

  const countryInfo = SUPPORTED_COUNTRIES.find((c) => c.code === config.country)
  const textNote = offNote(config.capabilities.textPractice)
  const voiceNote = offNote(config.capabilities.voicePractice)
  const chatRaw = config.rawPermissions?.['ai-chat']
  const voiceRaw = config.rawPermissions?.['ai-voice-mode']

  return (
    <section className={`home-shell home-${ageGroup}`}>
      {/* Live k-ID Jurisdiction & Multi-Country Status Banner */}
      <div className="jurisdiction-banner" role="region" aria-label="Active age and country configuration">
        <div className="jb-left">
          <span className="jb-badge">
            {countryInfo?.name ?? config.country ?? 'Global'} ({config.jurisdiction ?? config.country ?? 'US'})
          </span>
          <span className="jb-badge age-pill">
            {ageGroup === 'kids' ? 'Kids (6–12)' : ageGroup === 'teens' ? 'Teens (13–17)' : 'Adults (18+)'} · Age {config.age}
          </span>
          <span className="jb-perm">
            AI Chat:{' '}
            <strong>
              {config.status === 'pending'
                ? 'Awaiting Guardian'
                : config.capabilities.textPractice.on
                  ? 'ON'
                  : `OFF (${chatRaw?.managedBy ?? config.capabilities.textPractice.reason ?? 'restricted'})`}
            </strong>
          </span>
          <span className="jb-perm">
            AI Voice:{' '}
            <strong>
              {config.status === 'pending'
                ? 'Awaiting Guardian'
                : config.capabilities.voicePractice.on
                  ? 'ON'
                  : `OFF (${voiceRaw?.managedBy ?? config.capabilities.voicePractice.reason ?? 'restricted'})`}
            </strong>
          </span>
        </div>
        <div className="jb-actions">
          <Link to="/age" className="jb-switch">
            Switch Age / Country / Language
          </Link>
          <Link to="/settings" className="jb-switch secondary">
            k-ID Permissions
          </Link>
        </div>
      </div>

      {config.status === 'pending' && (
        <Note>
          <strong>Guardian approval pending ({config.jurisdiction ?? config.country}):</strong> You can explore guided activities and lessons right now. Live AI chat and voice open once a parent or guardian approves.
        </Note>
      )}
      {config.status !== 'pending' && textNote && <Note>Typed AI: {textNote}</Note>}
      {config.status !== 'pending' && !textNote && voiceNote && <Note>Voice AI: {voiceNote}</Note>}
      {error && <Note tone="warn">{error}</Note>}

      {/* =====================================================================
          1. KIDS (6-12): "How are you feeling today?" Illustrated Activity Board
         ===================================================================== */}
      {ageGroup === 'kids' && (
        <div className="kids-home">
          <div className="kids-header-card">
            <Mascot size={104} className="kids-mascot" />
            <div className="kids-greeting">
              <span className="kids-hi">{t(lang, 'kids.hiWello')}</span>
              <h1>{t(lang, 'kids.heading')}</h1>
              <button
                type="button"
                className="talk-wello"
                disabled={busy}
                onClick={() =>
                  void launchFlow({
                    topicId: KID_FEELINGS.find((f) => f.id === selectedFeeling)?.topic ?? 'hard-day',
                    mode: 'practice',
                    destination: config.capabilities.textPractice.on || config.capabilities.voicePractice.on ? '/practice' : '/lesson',
                  })
                }
              >
                <Icon name="mic" size={20} /> {t(lang, 'kids.talkToWello')}
              </button>
              {!config.capabilities.voicePractice.on && (
                <small className="talk-wello-note">
                  {t(lang, 'kids.voiceOffHome')} {offNote(config.capabilities.voicePractice)}
                </small>
              )}
              <p className="pip-speech">
                <span>{pipLine}</span>
                {speaker.supported && (
                  <SpeakButton
                    lang={lang}
                    playing={speaker.activeKey === 'wello'}
                    onClick={() => (speaker.activeKey === 'wello' ? speaker.stop() : speaker.speak('wello', pipLine))}
                  />
                )}
              </p>
              <div className="kids-helper-bar">
                <button
                  type="button"
                  className="kid-pill-btn"
                  onClick={() => {
                    speaker.stop()
                    setExplainIndex((i) => i + 1)
                  }}
                >
                  <Icon name="spark" size={16} /> {t(lang, 'kids.explainAnotherWay')}
                </button>
                <button
                  type="button"
                  className="kid-pill-btn help-highlight"
                  onClick={() =>
                    setCoachExplain(
                      'Hi! I am Wello. Pick any picture below for how you feel, or tap "I\'m not sure". Then pick one activity box. There are no wrong answers and no grades!',
                    )
                  }
                >
                  <Icon name="heart" size={16} /> {config.helpLabel ?? t(lang, 'help.kids')}
                </button>
                <button
                  type="button"
                  className="kid-pill-btn"
                  onClick={() =>
                    void launchFlow({
                      topicId: 'need-help',
                      destination: '/lesson',
                    })
                  }
                >
                  {t(lang, 'kids.skip')} <Icon name="arrow" size={16} />
                </button>
              </div>
            </div>
          </div>

          {coachExplain && (
            <div className="coach-inline-banner" role="status">
              <div>
                <strong>{config.helpLabel ?? 'Help me understand'}</strong>
                <p>
                  {coachExplain}
                  {speaker.supported && (
                    <SpeakButton
                      lang={lang}
                      playing={speaker.activeKey === 'coach'}
                      onClick={() => (speaker.activeKey === 'coach' ? speaker.stop() : speaker.speak('coach', coachExplain))}
                    />
                  )}
                </p>
              </div>
              <button type="button" className="web-secondary" onClick={() => setCoachExplain(null)}>
                Got it!
              </button>
            </div>
          )}

          {/* Feeling pictures */}
          <div className="kids-feelings-grid" role="group" aria-label={t(lang, 'kids.heading')}>
            {KID_FEELINGS.map((f) => {
              const active = selectedFeeling === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  className={`kid-feeling-tile ${active ? 'selected' : ''}`}
                  aria-pressed={active}
                  onClick={() => setSelectedFeeling(f.id)}
                >
                  <FeelingFace id={f.id} />
                  <strong>{t(lang, f.labelKey)}</strong>
                </button>
              )
            })}
          </div>

          {/* Things to do */}
          <h2 className="kids-things-title">{t(lang, 'kids.thingsToDo')}</h2>
          <div className="kids-activities-grid">
            {([
              ['detective', 'kids.feelingDetective', 'kids.feelingDetectiveDesc'],
              ['builder', 'kids.buildMyWords', 'kids.buildMyWordsDesc'],
              ['ask', 'kids.askForHelp', 'kids.askForHelpDesc'],
            ] as const).map(([id, title, desc]) => (
              <button
                key={id}
                type="button"
                className={`kid-activity-card ${id} ${kidActivity === id ? 'selected' : ''}`}
                aria-pressed={kidActivity === id}
                onClick={() => setKidActivity(id)}
              >
                <ActivityIcon kind={id} />
                <strong>{t(lang, title)}</strong>
                <p>{t(lang, desc)}</p>
              </button>
            ))}
          </div>

          {/* Interactive Activity Panel: Feeling Detective */}
          {kidActivity === 'detective' && (
            <div className="kid-interactive-panel">
              <div className="panel-top">
                <h3>🔍 {t(lang, 'kids.feelingDetective')}</h3>
                <span className="no-wrong-badge">All feelings fit · Never scored wrong</span>
              </div>
              <p className="detective-story">
                <span className="story-emoji">{DETECTIVE_CASES[detectiveCaseIdx].emoji}</span>{' '}
                <strong>{DETECTIVE_CASES[detectiveCaseIdx].character}:</strong>{' '}
                {DETECTIVE_CASES[detectiveCaseIdx].story[lang as 'en' | 'es' | 'zh-CN'] ??
                  DETECTIVE_CASES[detectiveCaseIdx].story.en}
              </p>
              <p className="detective-prompt">What feelings could fit here? Tap as many as you want:</p>
              <div className="detective-clues">
                {DETECTIVE_CASES[detectiveCaseIdx].clues.map((clue) => {
                  const active = detectivePicks.includes(clue)
                  return (
                    <button
                      key={clue}
                      type="button"
                      className={`clue-chip ${active ? 'selected' : ''}`}
                      onClick={() =>
                        setDetectivePicks((prev) =>
                          prev.includes(clue) ? prev.filter((c) => c !== clue) : [...prev, clue],
                        )
                      }
                    >
                      {active ? '✓ ' : '+ '}
                      {clue}
                    </button>
                  )
                })}
              </div>
              {detectivePicks.length > 0 && (
                <div className="detective-affirmation" role="status">
                  <strong>Great detective work!</strong> Having {detectivePicks.join(' and ')} all makes sense. People can feel more than one emotion at the same time!
                </div>
              )}
              <div className="kid-panel-actions">
                <button
                  type="button"
                  className="web-secondary"
                  onClick={() => {
                    setDetectiveCaseIdx((i) => (i + 1) % DETECTIVE_CASES.length)
                    setDetectivePicks([])
                  }}
                >
                  Try another story
                </button>
                <button
                  type="button"
                  className="web-primary"
                  disabled={busy}
                  onClick={() =>
                    void launchFlow({
                      topicId: KID_FEELINGS.find((f) => f.id === selectedFeeling)?.topic ?? 'hard-day',
                      mode: 'talk',
                      destination: config.capabilities.textPractice.on ? '/practice' : '/lesson',
                    })
                  }
                >
                  Talk through my feelings <Icon name="arrow" />
                </button>
              </div>
            </div>
          )}

          {/* Interactive Activity Panel: Build My Words */}
          {kidActivity === 'builder' && (
            <div className="kid-interactive-panel">
              <div className="panel-top">
                <h3>🧩 {t(lang, 'kids.buildMyWords')}</h3>
                <span className="no-wrong-badge">Sentence Builder</span>
              </div>
              <div className="word-builder-grid">
                <label>
                  <span>I feel…</span>
                  <select value={feelWord} onChange={(e) => setFeelWord(e.target.value)}>
                    <option value="worried">worried</option>
                    <option value="upset">upset</option>
                    <option value="overwhelmed">like it is too much</option>
                    <option value="unsure">not sure how to explain it</option>
                    <option value="scared">a little scared</option>
                  </select>
                </label>
                <label>
                  <span>because…</span>
                  <select value={becauseWord} onChange={(e) => setBecauseWord(e.target.value)}>
                    <option value="it feels like too much at once">it feels like too much at once</option>
                    <option value="my stomach hurts and I feel nervous">my stomach hurts and I feel nervous</option>
                    <option value="something hard happened today">something hard happened today</option>
                    <option value="I don't know what will happen next">I don't know what will happen next</option>
                  </select>
                </label>
                <label>
                  <span>I need…</span>
                  <select value={needWord} onChange={(e) => setNeedWord(e.target.value)}>
                    <option value="someone to listen without rushing me">someone to listen without rushing me</option>
                    <option value="help asking a grown-up">help asking a grown-up</option>
                    <option value="a quiet break first">a quiet break first</option>
                    <option value="you to explain what will happen">you to explain what will happen</option>
                  </select>
                </label>
              </div>
              <blockquote className="built-sentence-preview">
                &ldquo;I feel <strong>{feelWord}</strong> because <strong>{becauseWord}</strong>. I need <strong>{needWord}</strong>.&rdquo;
              </blockquote>
              <div className="kid-panel-actions">
                <button
                  type="button"
                  className="web-primary"
                  disabled={busy}
                  onClick={() =>
                    void launchFlow({
                      topicId: KID_FEELINGS.find((f) => f.id === selectedFeeling)?.topic ?? 'need-help',
                      mode: 'practice',
                      customGoal: `I feel ${feelWord} because ${becauseWord}. I need ${needWord}.`,
                      destination: config.capabilities.textPractice.on || config.capabilities.voicePractice.on ? '/practice' : '/lesson',
                    })
                  }
                >
                  Practise saying my sentence <Icon name="mic" />
                </button>
                <Link
                  to={`/journal?share=1&phrase=${encodeURIComponent(`I feel ${feelWord} because ${becauseWord}. I need ${needWord}.`)}`}
                  className="web-secondary"
                >
                  {t(lang, 'feedback.kidsShare')}
                </Link>
              </div>
            </div>
          )}

          {/* Interactive Activity Panel: Ask for Help */}
          {kidActivity === 'ask' && (
            <div className="kid-interactive-panel">
              <div className="panel-top">
                <h3>🤝 {t(lang, 'kids.askForHelp')}</h3>
                <span className="no-wrong-badge">Safe rehearsal</span>
              </div>
              <p>Who would you like to practise talking to?</p>
              <div className="trusted-adult-row">
                {[
                  { id: 'parent', label: '🏠 Parent or Caregiver', topic: 'hard-day' },
                  { id: 'teacher', label: '🏫 Teacher or Counselor', topic: 'need-help' },
                  { id: 'doctor', label: '🩺 Doctor or Nurse', topic: 'doctor-visit' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`clue-chip ${trustedAdult === item.id ? 'selected' : ''}`}
                    onClick={() => setTrustedAdult(item.id as 'parent' | 'teacher' | 'doctor')}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="kid-panel-actions">
                <button
                  type="button"
                  className="web-secondary"
                  disabled={busy}
                  onClick={() =>
                    void launchFlow({
                      topicId: trustedAdult === 'doctor' ? 'doctor-visit' : trustedAdult === 'teacher' ? 'need-help' : 'hard-day',
                      mode: 'talk',
                      destination: '/lesson',
                    })
                  }
                >
                  See picture cards first
                </button>
                <button
                  type="button"
                  className="web-primary"
                  disabled={busy}
                  onClick={() =>
                    void launchFlow({
                      topicId: trustedAdult === 'doctor' ? 'doctor-visit' : trustedAdult === 'teacher' ? 'need-help' : 'hard-day',
                      mode: 'practice',
                      destination: config.capabilities.textPractice.on || config.capabilities.voicePractice.on ? '/practice' : '/lesson',
                    })
                  }
                >
                  Practise talking now <Icon name="arrow" />
                </button>
              </div>
            </div>
          )}

          {kidActivity === 'none' && (
            <div className="kids-bottom-cta">
              <button
                type="button"
                className="web-primary"
                disabled={busy}
                onClick={() =>
                  void launchFlow({
                    topicId: KID_FEELINGS.find((f) => f.id === selectedFeeling)?.topic ?? 'hard-day',
                    mode: 'practice',
                    destination: '/lesson',
                  })
                }
              >
                Start with {t(lang, KID_FEELINGS.find((f) => f.id === selectedFeeling)?.labelKey ?? 'kids.notSure')} <Icon name="arrow" />
              </button>
            </div>
          )}
          <div className="kids-bottom-pills">
            <Link to="/journal?share=1" className="kid-pill-btn">{t(lang, 'feedback.helpUnderstand')}</Link>
            <Link to="/journal" className="kid-pill-btn">{t(lang, 'kids.myCards')}</Link>
          </div>
        </div>
      )}

      {/* =====================================================================
          2. TEENS (13-17): "What's on your mind?" Mature Conversation Space
         ===================================================================== */}
      {ageGroup === 'teens' && (
        <div className="teens-home">
          <div className="teens-hero">
            <span className="web-kicker">Teen Space (13–17)</span>
            <h1>{t(lang, 'teens.heading')}</h1>
            <p>
              Sort out what you want to say in private, or rehearse how a real conversation might go before you have it.
            </p>

            {/* Mode selector: Talk it through vs Practise the conversation */}
            <div className="mode-pill-toggle" role="group" aria-label="Conversation mode">
              <button
                type="button"
                className={teenMode === 'talk' ? 'active' : ''}
                onClick={() => setTeenMode('talk')}
              >
                💬 {t(lang, 'practice.talkMode')}
              </button>
              <button
                type="button"
                className={teenMode === 'practice' ? 'active' : ''}
                onClick={() => setTeenMode('practice')}
              >
                🎭 {t(lang, 'practice.practiceMode')}
              </button>
            </div>

            {/* Voice agent: floating prompts above the orb */}
            <div className="teen-voice-stage">
              <div className="floating-prompts" role="group" aria-label="Things you could say">
                {TEEN_PROMPTS.map((prompt, i) => (
                  <button
                    key={prompt}
                    type="button"
                    className={`floating-prompt ${teenInput === prompt ? 'selected' : ''}`}
                    style={{ animationDelay: `${i * -1.3}s` }}
                    aria-pressed={teenInput === prompt}
                    onClick={() => setTeenInput(teenInput === prompt ? '' : prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              <VoiceOrb />
              <button
                type="button"
                className="web-primary teen-talk-btn"
                disabled={busy}
                onClick={() =>
                  void launchFlow({
                    topicId: 'hard-day',
                    mode: teenMode,
                    customGoal: teenInput.trim() || undefined,
                    destination: config.capabilities.textPractice.on || config.capabilities.voicePractice.on ? '/practice' : '/lesson',
                  })
                }
              >
                <Icon name="mic" /> {t(lang, 'teens.startTalking')}
              </button>
              {!config.capabilities.voicePractice.on && (
                <small className="talk-wello-note">{voiceNote ?? 'Voice is off right now.'}</small>
              )}
              <div className="teen-context-actions">
                <button
                  type="button"
                  className="context-chip"
                  onClick={() =>
                    setCoachExplain(
                      'In "Talk it through" mode, Voicewell helps you organize your thoughts and pick phrases. In "Practise the conversation" mode, Voicewell role-plays the other person so you can test how it sounds.',
                    )
                  }
                >
                  <Icon name="info" size={15} /> {config.helpLabel ?? t(lang, 'teens.explainThis')}
                </button>
                <button
                  type="button"
                  className="context-chip"
                  disabled={busy}
                  onClick={() =>
                    void launchFlow({
                      topicId: 'hard-day',
                      mode: teenMode,
                      customGoal: teenInput.trim() || undefined,
                      destination: '/lesson',
                    })
                  }
                >
                  Quick prep cards
                </button>
              </div>
            </div>
          </div>

          {coachExplain && (
            <div className="coach-inline-banner" role="status">
              <div>
                <strong>{config.helpLabel ?? 'Explain this'}</strong>
                <p>{coachExplain}</p>
              </div>
              <button type="button" className="web-secondary" onClick={() => setCoachExplain(null)}>
                Close
              </button>
            </div>
          )}

          {/* 3 Collapsible Starter Cards */}
          <div className="teen-collapsible-list">
            {[
              {
                id: 'overwhelmed' as const,
                title: t(lang, 'teens.card1'),
                subtitle: 'Unpack stress, burnout, or feeling pulled in too many directions',
                topicId: 'hard-day',
                prompts: [
                  "Everyone expects an answer right now and I just need space to think.",
                  "School and home both feel heavy this week and I don't want a lecture.",
                ],
              },
              {
                id: 'explain' as const,
                title: t(lang, 'teens.card2'),
                subtitle: 'Find clear words for a parent, teacher, friend, or doctor',
                topicId: 'body-feelings',
                prompts: [
                  "Something feels off in my body or mood, and I want to explain it clearly.",
                  "I want my parent to listen first before jumping straight into fixing it.",
                ],
              },
              {
                id: 'practice' as const,
                title: t(lang, 'teens.card3'),
                subtitle: 'Rehearse asking for support, setting a boundary, or an appointment',
                topicId: 'need-help',
                prompts: [
                  "I need to ask a teacher or counselor for extensions or extra support.",
                  "I want to rehearse questions for my next doctor or mental health appointment.",
                ],
              },
            ].map((card) => {
              const isOpen = openTeenCard === card.id
              return (
                <div key={card.id} className={`teen-starter-card ${isOpen ? 'open' : ''}`}>
                  <button
                    type="button"
                    className="teen-card-header"
                    aria-expanded={isOpen}
                    onClick={() => setOpenTeenCard(isOpen ? null : card.id)}
                  >
                    <div>
                      <strong>{card.title}</strong>
                      <small>{card.subtitle}</small>
                    </div>
                    <span>{isOpen ? '−' : '+'}</span>
                  </button>
                  {isOpen && (
                    <div className="teen-card-body">
                      <div className="teen-prompt-chips">
                        {card.prompts.map((p) => (
                          <button
                            key={p}
                            type="button"
                            className="teen-prompt-chip"
                            onClick={() => setTeenInput(p)}
                          >
                            &ldquo;{p}&rdquo;
                          </button>
                        ))}
                      </div>
                      <div className="teen-card-footer">
                        <button
                          type="button"
                          className="web-secondary"
                          disabled={busy}
                          onClick={() =>
                            void launchFlow({
                              topicId: card.topicId,
                              mode: 'talk',
                              customGoal: teenInput || card.prompts[0],
                              destination: config.capabilities.textPractice.on ? '/practice' : '/lesson',
                            })
                          }
                        >
                          {t(lang, 'practice.talkMode')}
                        </button>
                        <button
                          type="button"
                          className="web-primary"
                          disabled={busy}
                          onClick={() =>
                            void launchFlow({
                              topicId: card.topicId,
                              mode: 'practice',
                              customGoal: teenInput || card.prompts[0],
                              destination: config.capabilities.textPractice.on || config.capabilities.voicePractice.on ? '/practice' : '/lesson',
                            })
                          }
                        >
                          {t(lang, 'teens.practiceSaying')} <Icon name="arrow" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          3. ADULTS (18+): "What would you like to work through?" Open Workspace
         ===================================================================== */}
      {ageGroup === 'adults' && (
        <div className="adults-home">
          <div className="adults-workspace-card">
            <div className="adults-top-row">
              <div>
                <span className="web-kicker">Adult Workspace (18+)</span>
                <h1>{t(lang, 'adults.heading')}</h1>
              </div>
              <div className="adults-top-controls">
                <button
                  type="button"
                  className="web-secondary"
                  onClick={() => setAdultGuidanceOpen((o) => !o)}
                  aria-expanded={adultGuidanceOpen}
                >
                  {adultGuidanceOpen ? 'Hide guidance' : 'Show guidance'}
                </button>
                <button
                  type="button"
                  className="web-secondary"
                  onClick={() =>
                    setCoachExplain(
                      'Pause & Coach is available at any point during a session. You can switch between "Talk it through" (reflective coaching) and "Practise the conversation" (realistic role-play) at any time.',
                    )
                  }
                >
                  {config.helpLabel ?? t(lang, 'help.adults')}
                </button>
              </div>
            </div>

            {adultGuidanceOpen && (
              <div className="adults-collapsed-guidance">
                <strong>Structuring a high-stakes conversation:</strong>
                <ul>
                  <li><strong>Lead with the headline:</strong> State what you want the other person to understand in your first two sentences.</li>
                  <li><strong>Name the impact:</strong> Describe concrete examples or how long it has been happening.</li>
                  <li><strong>Make one clear ask:</strong> End with a specific question or next step.</li>
                </ul>
              </div>
            )}

            {coachExplain && (
              <div className="coach-inline-banner" role="status">
                <div>
                  <strong>{config.helpLabel ?? 'Pause & Coach'}</strong>
                  <p>{coachExplain}</p>
                </div>
                <button type="button" className="web-secondary" onClick={() => setCoachExplain(null)}>
                  Dismiss
                </button>
              </div>
            )}

            {/* 4 Direct Shortcuts */}
            <div className="adults-shortcuts-grid" role="group" aria-label="Direct shortcuts">
              {[
                {
                  id: 'feelings' as const,
                  icon: 'heart' as const,
                  title: t(lang, 'adults.shortcut1'),
                  desc: 'Clarify what you are feeling and distill it into calm, accurate words.',
                  topicId: 'body-feelings',
                  mode: 'talk' as PracticeMode,
                },
                {
                  id: 'conversation' as const,
                  icon: 'spark' as const,
                  title: t(lang, 'adults.shortcut2'),
                  desc: 'Rehearse a difficult family, relationship, or workplace conversation.',
                  topicId: 'hard-day',
                  mode: 'practice' as PracticeMode,
                },
                {
                  id: 'appointment' as const,
                  icon: 'calendar' as const,
                  title: t(lang, 'adults.shortcut3'),
                  desc: 'Organize symptoms, timeline, and questions before seeing a clinician.',
                  topicId: 'doctor-visit',
                  mode: 'practice' as PracticeMode,
                },
                {
                  id: 'support' as const,
                  icon: 'book' as const,
                  title: t(lang, 'adults.shortcut4'),
                  desc: 'Practise listening to and supporting your child, partner, or friend.',
                  topicId: 'need-help',
                  mode: 'practice' as PracticeMode,
                },
              ].map((s) => {
                const active = adultShortcut === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`adult-shortcut-tile ${active ? 'selected' : ''}`}
                    aria-pressed={active}
                    onClick={() => {
                      setAdultShortcut(s.id)
                      setAdultMode(s.mode)
                    }}
                  >
                    <span className="sc-icon"><Icon name={s.icon} /></span>
                    <strong>{s.title}</strong>
                    <p>{s.desc}</p>
                  </button>
                )
              })}
            </div>

            {/* Support someone else sub-selector: My child / Partner / Friend / Someone else */}
            {adultShortcut === 'support' && (
              <div className="adult-support-panel">
                <div className="support-targets">
                  <span>Who are you supporting?</span>
                  <div className="support-target-chips">
                    {(
                      [
                        { id: 'child', label: t(lang, 'adults.myChild') },
                        { id: 'partner', label: t(lang, 'adults.partner') },
                        { id: 'friend', label: t(lang, 'adults.friend') },
                        { id: 'other', label: t(lang, 'adults.someoneElse') },
                      ] as const
                    ).map((target) => (
                      <button
                        key={target.id}
                        type="button"
                        className={`clue-chip ${supportTarget === target.id ? 'selected' : ''}`}
                        onClick={() => setSupportTarget(target.id)}
                      >
                        {target.label}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="support-age-field">
                  <span>Their age (optional, adapts coaching):</span>
                  <input
                    type="number"
                    min={4}
                    max={100}
                    value={supportAge}
                    onChange={(e) => setSupportAge(e.target.value)}
                    placeholder="e.g. 10"
                  />
                </label>
              </div>
            )}

            {/* Prominent Open Text Input + Voice Action */}
            <div className="adult-composer">
              <textarea
                rows={3}
                value={adultInput}
                onChange={(e) => setAdultInput(e.target.value)}
                placeholder={t(lang, 'adults.placeholder')}
              />
              <div className="adult-composer-footer">
                <div className="mode-pill-toggle compact">
                  <button
                    type="button"
                    className={adultMode === 'talk' ? 'active' : ''}
                    onClick={() => setAdultMode('talk')}
                  >
                    {t(lang, 'practice.talkMode')}
                  </button>
                  <button
                    type="button"
                    className={adultMode === 'practice' ? 'active' : ''}
                    onClick={() => setAdultMode('practice')}
                  >
                    {t(lang, 'practice.practiceMode')}
                  </button>
                </div>

                <div className="adult-cta-group">
                  <button
                    type="button"
                    className="web-secondary"
                    disabled={busy}
                    onClick={() =>
                      void launchFlow({
                        topicId:
                          adultShortcut === 'appointment'
                            ? 'doctor-visit'
                            : adultShortcut === 'feelings'
                              ? 'body-feelings'
                              : adultShortcut === 'support'
                                ? 'need-help'
                                : 'hard-day',
                        intent: adultShortcut === 'support' ? 'someone-else' : 'myself',
                        mode: adultMode,
                        supportTarget: adultShortcut === 'support' ? supportTarget : null,
                        supportAge: adultShortcut === 'support' && supportAge ? Number(supportAge) : null,
                        customGoal: adultInput.trim() || undefined,
                        destination: '/lesson',
                      })
                    }
                  >
                    Review strategy cards
                  </button>
                  <button
                    type="button"
                    className="web-primary"
                    disabled={busy}
                    onClick={() =>
                      void launchFlow({
                        topicId:
                          adultShortcut === 'appointment'
                            ? 'doctor-visit'
                            : adultShortcut === 'feelings'
                              ? 'body-feelings'
                              : adultShortcut === 'support'
                                ? 'need-help'
                                : 'hard-day',
                        intent: adultShortcut === 'support' ? 'someone-else' : 'myself',
                        mode: adultMode,
                        supportTarget: adultShortcut === 'support' ? supportTarget : null,
                        supportAge: adultShortcut === 'support' && supportAge ? Number(supportAge) : null,
                        customGoal: adultInput.trim() || undefined,
                        destination: config.capabilities.textPractice.on || config.capabilities.voicePractice.on ? '/practice' : '/lesson',
                      })
                    }
                  >
                    <Icon name="mic" /> Start {adultMode === 'talk' ? 'coaching' : 'practice'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Comfort & Accessibility Bar across all age views */}
      <div className="home-comfort-bar">
        <span>Comfort &amp; Accessibility:</span>
        <div className="comfort-pills">
          <button
            type="button"
            className={`comfort-pill ${prefs.largeText ? 'on' : ''}`}
            onClick={() => void togglePref('largeText')}
          >
            Larger text: {prefs.largeText ? 'On' : 'Off'}
          </button>
          <button
            type="button"
            className={`comfort-pill ${prefs.captions ? 'on' : ''}`}
            onClick={() => void togglePref('captions')}
          >
            Captions: {prefs.captions ? 'On' : 'Off'}
          </button>
          <button
            type="button"
            className={`comfort-pill ${prefs.slowerPace ? 'on' : ''}`}
            onClick={() => void togglePref('slowerPace')}
          >
            Slower pace: {prefs.slowerPace ? 'On' : 'Off'}
          </button>
          <button
            type="button"
            className={`comfort-pill ${prefs.starters ? 'on' : ''}`}
            onClick={() => void togglePref('starters')}
          >
            Sentence starters: {prefs.starters ? 'On' : 'Off'}
          </button>
        </div>
        {topics.length > 0 && (
          <div className="home-quick-links">
            <Link to="/journal" className="inline-link">My Journal</Link>
            <span>·</span>
            <Link to="/specialists" className="inline-link">Find a Specialist</Link>
          </div>
        )}
      </div>
    </section>
  )
}

