import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, ApiError, errorMessage, redirectIfNoSession } from '../api'
import { MicError } from '../audio/mic'
import { useSpeaker } from '../audio/speak'
import { VoiceSession, type FallbackKind } from '../audio/voice'
import KidPractice from '../kid/KidPractice'
import VoiceCoachCard from '../kid/VoiceCoachCard'
import { t } from '../i18n'
import { offNote, REASON_COPY, reasonCopy } from '../reasons'
import { navigate } from '../router'
import { useConfig, useSession } from '../session'
import type { CoachReply, OffReason, Persona, PracticeMode, Turn } from '../types'
import { Icon, Link, Mascot, Note } from '../ui'

type Caption = { who: 'user' | 'assistant'; text: string; final: boolean }

const MAX_TURNS = 8

export default function Practice() {
  const config = useConfig()
  const { textPractice, voicePractice } = config.capabilities

  if (!textPractice.on && !voicePractice.on) {
    return <PracticeClosed />
  }

  const persona: Persona = config.persona ?? {
    id: 'alex',
    name: 'Alex',
    description: 'A calm, patient listener who gives you space to find your words',
  }

  return <PracticeStage persona={persona} />
}

function PracticeClosed() {
  const config = useConfig()
  const { setConfig } = useSession()
  const [checking, setChecking] = useState(false)
  const [checkedOff, setCheckedOff] = useState(false)
  const { textPractice, voicePractice } = config.capabilities
  const reason = textPractice.reason ?? voicePractice.reason
  const grownUpManaged = reason === 'needs-grown-up' || reason === 'consent-pending'

  // Permissions are changed in k-ID's own screen, so re-read them on demand and whenever the tab regains focus.
  const recheck = async () => {
    setChecking(true)
    try {
      setConfig(await api.session(true))
      setCheckedOff(true)
    } catch (error) {
      redirectIfNoSession(error)
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    const onFocus = () => void recheck()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  return (
    <section className="flow-shell centered-card">
      <span className="web-kicker">Practice</span>
      <h1>Practice isn’t open yet</h1>
      <Note>{offNote(textPractice) ?? offNote(voicePractice)}</Note>
      {checkedOff && !checking && <small role="status">Still switched off. Turn on AI chat and AI voice mode, then check again.</small>}
      <div className="feedback-actions">
        {!grownUpManaged && reason !== 'not-permitted' && (
          <Link to="/settings" className="web-primary">Open Permissions</Link>
        )}
        <button type="button" className={grownUpManaged || reason === 'not-permitted' ? 'web-primary' : 'web-secondary'} disabled={checking} onClick={() => void recheck()}>
          {checking ? 'Checking…' : 'I turned it on, check again'}
        </button>
      </div>
      <div className="feedback-actions">
        <Link to="/lesson" className="web-secondary">Open guided cards</Link>
        <Link to="/home" className="web-secondary">Back to Home</Link>
      </div>
    </section>
  )
}

function PracticeStage({ persona }: { persona: Persona }) {
  const config = useConfig()
  const { setConfig } = useSession()
  const { preferences, capabilities } = config
  const lang = config.language ?? 'en'
  const helpLabel = config.helpLabel ?? t(lang, 'help.adults')
  const voiceOn = capabilities.voicePractice.on
  const textOn = capabilities.textPractice.on
  const voiceOffNote = offNote(capabilities.voicePractice)
  const voiceOffReason = voiceOn ? undefined : capabilities.voicePractice.reason

  const [mode, setMode] = useState<PracticeMode>(config.mode ?? 'practice')
  const [typed, setTyped] = useState(!voiceOn)
  const [phase, setPhase] = useState<'idle' | 'connecting' | 'live'>('idle')
  const [turns, setTurns] = useState<Turn[]>([])
  const [caption, setCaption] = useState<Caption | null>(null)
  const [speaking, setSpeaking] = useState(false)
  const [userTalking, setUserTalking] = useState(false)
  const [captionsOn, setCaptionsOn] = useState(preferences.captions)
  const [notice, setNotice] = useState<string | null>(null)
  const [ended, setEnded] = useState<'done' | 'safety' | null>(null)
  const [safetyMessage, setSafetyMessage] = useState('')
  const [starters, setStarters] = useState<string[]>([])
  const [input, setInput] = useState(config.customGoal ?? '')
  const [sending, setSending] = useState(false)
  const [turnCount, setTurnCount] = useState(0)
  const [typedError, setTypedError] = useState('')
  const [showConversation, setShowConversation] = useState(false)
  const [tipsOpen, setTipsOpen] = useState(false)
  const speaker = useSpeaker(lang)

  // Pause & Coach state
  const [coachPromptBanner, setCoachPromptBanner] = useState<string | null>(null)
  const [coachState, setCoachState] = useState<CoachReply | null>(null)
  const [coachBusy, setCoachBusy] = useState(false)

  const voiceRef = useRef<VoiceSession | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!preferences.starters) return
    let live = true
    api
      .starters()
      .then((r) => live && setStarters(r.starters))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [preferences.starters])

  const stopSpeechSynthesis = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }

  useEffect(
    () => () => {
      voiceRef.current?.close()
      voiceRef.current = null
      stopSpeechSynthesis()
    },
    [],
  )

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [turns, caption, sending, coachState, coachPromptBanner])

  const switchMode = async (nextMode: PracticeMode) => {
    setMode(nextMode)
    try {
      const updated = await api.setPracticeMode(nextMode)
      setConfig(updated)
    } catch {
      // keep local mode
    }
  }

  // ---- voice -------------------------------------------------------------------------------

  const stopVoice = () => {
    voiceRef.current?.close()
    voiceRef.current = null
    setPhase('idle')
    setSpeaking(false)
    setUserTalking(false)
  }

  const fallbackToTyping = (kind: FallbackKind, reason?: string) => {
    stopVoice()
    setTyped(true)
    if (kind === 'not-permitted') {
      const copy = reason && reason in REASON_COPY ? reasonCopy(reason as OffReason) : reasonCopy('not-permitted')
      setNotice(`Voice isn’t available right now. ${copy} You can keep going by typing.`)
    } else if (kind === 'connection') {
      setNotice(`The voice connection dropped, so we switched to typing. ${persona.name} is still here.`)
    } else {
      setNotice(`Voice isn’t working right now, so we switched to typing. ${persona.name} is still here.`)
    }
  }

  const addToCaption = (who: Caption['who'], text: string, final: boolean) =>
    setCaption((c) => {
      if (final) return { who, text, final: true }
      const base = c && c.who === who && !c.final ? c.text : ''
      return { who, text: base + text, final: false }
    })

  const startVoice = () => {
    if (voiceRef.current) return
    stopSpeechSynthesis()
    setCoachState(null)
    setCoachPromptBanner(null)
    setNotice(null)
    setTyped(false)
    setPhase('connecting')
    const session = new VoiceSession({
      onReady: () => setPhase('live'),
      onUserSpeechStarted: () => {
        setUserTalking(true)
        setSpeaking(false)
        setCaption((c) => (c && c.who === 'assistant' ? { ...c, final: true } : c))
      },
      onUserTranscript: (text, final) => {
        addToCaption('user', text, final)
        if (final) {
          setUserTalking(false)
          if (text.trim()) setTurns((t) => [...t, { role: 'user', text }])
        }
      },
      onAssistantTranscript: (text, final) => {
        addToCaption('assistant', text, final)
        if (final && text.trim()) setTurns((t) => [...t, { role: 'assistant', text }])
      },
      onCancelled: () => setCaption((c) => (c && c.who === 'assistant' ? { ...c, final: true } : c)),
      onPlaying: setSpeaking,
      onSafetyStop: (message) => {
        stopVoice()
        setSafetyMessage(message)
        setEnded('safety')
      },
      onDone: () => {
        setPhase('idle')
        setUserTalking(false)
        setEnded('done')
      },
      onFallback: fallbackToTyping,
    })
    voiceRef.current = session
    session.start().catch((error: unknown) => {
      if (voiceRef.current === session) voiceRef.current = null
      session.close()
      setPhase('idle')
      setTyped(true)
      setNotice(
        error instanceof MicError && error.message.includes('not allowed')
          ? `We couldn’t use your microphone, so we switched to typing. ${persona.name} is still here, and you can allow the microphone later to use voice.`
          : `We couldn’t start the microphone, so we switched to typing. ${persona.name} is still here.`,
      )
    })
  }

  const typeInstead = () => {
    stopVoice()
    setTyped(true)
    setNotice(null)
  }

  const finish = () => {
    stopSpeechSynthesis()
    voiceRef.current?.end()
    voiceRef.current = null
    navigate('/feedback')
  }

  // ---- Pause & Coach -----------------------------------------------------------------------

  const triggerCoachPrompt = () => {
    // Pause any active voice stream cleanly without starting the mic
    if (phase === 'live') {
      stopVoice()
      setTyped(true)
    }
    stopSpeechSynthesis()
    setCoachPromptBanner(t(lang, 'practice.pausePrompt'))
  }

  const runCoach = async (action: 'explain' | 'more_help' | 'retry_moment', format: 'text' | 'audio') => {
    setCoachBusy(true)
    stopVoice()
    stopSpeechSynthesis()
    try {
      const res = await api.practiceCoach(action, format)
      setCoachPromptBanner(null)
      setCoachState(res)
      if (action === 'retry_moment') {
        // Remove the last user/assistant exchange from local display if retrying that moment
        setTurns((prev) => (prev.length >= 2 ? prev.slice(0, -2) : prev))
        setTurnCount(res.turn)
      }
      if (format === 'audio' && voiceOn && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const utter = new SpeechSynthesisUtterance(`${res.explanation} ${res.examplePhrase}`)
        utter.lang = lang === 'es' ? 'es-ES' : lang === 'zh-CN' ? 'zh-CN' : 'en-US'
        window.speechSynthesis.speak(utter)
      }
    } catch (error) {
      if (!redirectIfNoSession(error)) setTypedError(errorMessage(error))
    } finally {
      setCoachBusy(false)
    }
  }

  const resumeFromCoach = async () => {
    stopSpeechSynthesis()
    setCoachBusy(true)
    try {
      const res = await api.practiceResume()
      setTurnCount(res.turn)
      setCoachState(null)
      setCoachPromptBanner(null)
    } catch (error) {
      if (!redirectIfNoSession(error)) setTypedError(errorMessage(error))
    } finally {
      setCoachBusy(false)
    }
  }

  // ---- typed -------------------------------------------------------------------------------

  const send = async (event: FormEvent) => {
    event.preventDefault()
    const text = input.trim()
    if (!text || sending || ended) return
    setSending(true)
    setTypedError('')
    setInput('')
    setTurns((tList) => [...tList, { role: 'user', text }])
    try {
      const reply = await api.practiceText(text, mode)
      if (reply.safety) {
        setSafetyMessage(reply.safety.message)
        setEnded('safety')
        return
      }
      setTurns((tList) => [...tList, { role: 'assistant', text: reply.reply }])
      setTurnCount(reply.turn)
      if (reply.coachPrompt) {
        setCoachPromptBanner(reply.coachPrompt)
      }
      if (reply.done) setEnded('done')
    } catch (error) {
      if (redirectIfNoSession(error)) return
      setTurns((tList) => tList.slice(0, -1))
      setInput(text)
      setTypedError(
        error instanceof ApiError && error.status === 403
          ? reasonCopy(error.reason)
          : errorMessage(error),
      )
    } finally {
      setSending(false)
    }
  }

  // ---- render ------------------------------------------------------------------------------

  if (ended === 'safety') {
    return (
      <section className="support-wrap">
        <div className="support-card" role="alert">
          <span className="gate-icon"><Icon name="heart" size={28} /></span>
          <h1>Let’s pause the practice</h1>
          <p>{safetyMessage}</p>
          <Link to="/home" className="web-primary">Back to Home</Link>
        </div>
      </section>
    )
  }

  // Kids (6-12) never get the dark voice stage: a light chat card with read-aloud and a mic button.
  if (config.ageGroup === 'kids') {
    return (
      <KidPractice
        lang={lang}
        persona={persona}
        helpLabel={helpLabel}
        turns={turns}
        caption={caption}
        captionsOn={captionsOn}
        onToggleCaptions={() => setCaptionsOn(!captionsOn)}
        sending={sending}
        ended={ended}
        phase={phase}
        speaking={speaking}
        userTalking={userTalking}
        voice={capabilities.voicePractice}
        textOn={textOn}
        typed={typed}
        notice={notice}
        typedError={typedError}
        starters={preferences.starters ? starters : []}
        input={input}
        setInput={setInput}
        onSend={send}
        onMic={startVoice}
        onStopMic={stopVoice}
        onTypeInstead={typeInstead}
        onFinish={finish}
        coachPromptBanner={coachPromptBanner}
        coachState={coachState}
        coachBusy={coachBusy}
        onCoachPrompt={triggerCoachPrompt}
        onCoach={(action, format) => void runCoach(action, format)}
        onDismissCoachPrompt={() => setCoachPromptBanner(null)}
        onResume={() => void resumeFromCoach()}
        listRef={listRef}
      />
    )
  }

  const permissionTitle = voiceOn ? 'Voice and typed practice are on' : 'Typed practice is on'
  const speakerLabel = mode === 'talk' ? 'Voicewell Coach' : `${persona.name} (Simulated Role-Play)`
  const lastOf = (role: Turn['role']) => [...turns].reverse().find((turn) => turn.role === role)?.text ?? ''
  const draft = caption && !caption.final && caption.text.trim() ? caption : null
  const replyText = draft?.who === 'assistant' ? draft.text : lastOf('assistant')
  const userText = draft?.who === 'user' ? draft.text : lastOf('user')
  const live = phase !== 'idle'
  const status = sending
    ? 'idle'
    : phase === 'connecting'
      ? 'connecting'
      : phase === 'live'
        ? speaking && !userTalking
          ? 'speaking'
          : 'listening'
        : speaker.activeKey
          ? 'speaking'
          : 'idle'
  const speakerName = mode === 'talk' ? 'Coach' : persona.name

  if (ended === 'done') {
    return (
      <section className="voice-coach-page">
        <div className="vc-card vc-done">
          <Mascot size={110} />
          <h2>Practice complete</h2>
          <p>You went {MAX_TURNS} rounds. Nicely done. Let’s look at what went well.</p>
          <button className="vc-end" onClick={() => navigate('/feedback')}><Icon name="check" /> Get my feedback</button>
        </div>
      </section>
    )
  }

  const extra = (
    <>
      {notice && <p className="stage-notice" role="status">{notice}</p>}
        {/* Pause & Coach Prompt Banner (when confusion detected or button clicked) */}
        {coachPromptBanner && !coachState && (
          <div className="pause-coach-card" role="region" aria-label={helpLabel}>
            <div className="pc-header">
              <span className="pc-badge">{helpLabel}</span>
              <strong>{coachPromptBanner}</strong>
            </div>
            <p className="pc-sub">
              Choose how you would like coaching. Your role-play is paused and coaching does not count toward feedback.
            </p>
            <div className="pc-actions">
              {voiceOn && (
                <button
                  type="button"
                  className="web-primary"
                  disabled={coachBusy}
                  onClick={() => void runCoach('explain', 'audio')}
                >
                  <Icon name="volume" /> {t(lang, 'practice.explainAudio')}
                </button>
              )}
              {textOn && (
                <button
                  type="button"
                  className={voiceOn ? 'web-secondary' : 'web-primary'}
                  disabled={coachBusy}
                  onClick={() => void runCoach('explain', 'text')}
                >
                  <Icon name="text" /> {t(lang, 'practice.readInstead')}
                </button>
              )}
              <button
                type="button"
                className="web-secondary"
                disabled={coachBusy}
                onClick={() => setCoachPromptBanner(null)}
              >
                {t(lang, 'practice.keepGoing')}
              </button>
            </div>
          </div>
        )}

        {/* Active Pause & Coach Overlay */}
        {coachState && (
          <div className="pause-coach-card active-coach" role="region" aria-label="Coaching guidance">
            <div className="pc-header">
              <span className="pc-badge">Paused · {helpLabel}</span>
              <strong>Coach Breakdown ({coachState.format === 'audio' ? 'Audio + Captions' : 'Read mode'})</strong>
            </div>
            <p className="pc-explanation">{coachState.explanation}</p>
            {coachState.examplePhrase && (
              <blockquote className="pc-example">
                <small>Phrase you can try:</small>
                <p>&ldquo;{coachState.examplePhrase}&rdquo;</p>
                {typed && (
                  <button
                    type="button"
                    className="use-phrase-btn"
                    onClick={() => {
                      setInput(coachState.examplePhrase)
                      void resumeFromCoach()
                    }}
                  >
                    Use this phrase
                  </button>
                )}
              </blockquote>
            )}
            <div className="pc-actions">
              <button
                type="button"
                className="web-primary"
                disabled={coachBusy}
                onClick={() => void resumeFromCoach()}
              >
                <Icon name="play" /> {t(lang, 'practice.resume')}
              </button>
              <button
                type="button"
                className="web-secondary"
                disabled={coachBusy}
                onClick={() => void runCoach('retry_moment', coachState.format)}
              >
                {t(lang, 'practice.tryAgain')}
              </button>
              <button
                type="button"
                className="web-secondary"
                disabled={coachBusy}
                onClick={() => void runCoach('more_help', coachState.format)}
              >
                {t(lang, 'practice.moreHelp')}
              </button>
            </div>
          </div>
        )}

      {typedError && <p className="stage-notice" role="alert">{typedError}</p>}
    </>
  )

  const conversation = (
    <>
      {turns.length === 0 && <p className="chat-empty">{t(lang, 'vc.typeFirst')}</p>}
      {turns.map((turn, i) => (
        <p key={i} className={`vc-line ${turn.role}`}>
          <b>{turn.role === 'user' ? t(lang, 'vc.you') : speakerName}</b> {turn.text}
        </p>
      ))}
      {sending && <p className="vc-line assistant"><b>{speakerName}</b> …</p>}
    </>
  )

  return (
    <section className="voice-coach-page">
      <div className="practice-nav-row">
        <Link to="/home" className="text-back"><Icon name="back" /> Home</Link>
        <Link to="/lesson" className="text-back">Prep cards</Link>
      </div>

      {config.topicTitle && <span className="web-kicker topic-kicker">{config.topicTitle}</span>}

      {/* Dual Mode Switcher */}
      <div className="mode-pill-toggle" role="group" aria-label="Conversation mode">
        <button
          type="button"
          className={mode === 'talk' ? 'active' : ''}
          onClick={() => void switchMode('talk')}
        >
          💬 {t(lang, 'practice.talkMode')}
        </button>
        <button
          type="button"
          className={mode === 'practice' ? 'active' : ''}
          onClick={() => void switchMode('practice')}
        >
          🎭 {t(lang, 'practice.practiceMode')}
        </button>
      </div>

      <VoiceCoachCard
        lang={lang}
        eyebrow={t(lang, 'vc.voiceCoach')}
        name={speakerLabel}
        subtitle={
          mode === 'talk'
            ? 'Sort out your thoughts, test different ways to phrase what you mean, and switch to role-play whenever you feel ready.'
            : `${persona.description}. This is a simulated role-play to rehearse a real conversation. It cannot diagnose anything or give medical advice.`
        }
        topRight={
          config.ageGroup === 'teens' ? (
            <button type="button" className="vc-pill" onClick={() => setTipsOpen(!tipsOpen)} aria-pressed={tipsOpen}>
              <span aria-hidden="true">💡</span> {t(lang, 'vc.tips')}
            </button>
          ) : undefined
        }
        tipsPanel={
          config.ageGroup === 'teens' && tipsOpen ? (
            <ul className="vc-tips">
              <li>{t(lang, 'vc.tip1')}</li>
              <li>{t(lang, 'vc.tip2')}</li>
              <li>{t(lang, 'vc.tip3')}</li>
            </ul>
          ) : undefined
        }
        captionsOn={captionsOn}
        onToggleCaptions={() => setCaptionsOn(!captionsOn)}
        status={status}
        hideReply={!captionsOn && (phase === 'live' || !!speaker.activeKey)}
        userText={userText}
        replyText={replyText}
        replyPlaceholder={voiceOn ? t(lang, 'vc.readyHint').replace('{name}', persona.name) : t(lang, 'vc.typeFirst')}
        extra={extra}
        micOn={live}
        micDisabled={live ? false : !voiceOn || !!coachState}
        micNote={voiceOffNote ? `${t(lang, 'kidPractice.voiceOff')} ${voiceOffNote}` : null}
        onMic={live ? stopVoice : startVoice}
        typing={typed}
        onTypeInstead={typeInstead}
        typeForm={{
          input,
          setInput,
          onSend: send,
          sending,
          blocked: !!coachState,
          placeholder: mode === 'talk' ? 'Write what is on your mind…' : 'Type what you would say…',
        }}
        onReplay={() => (speaker.activeKey === 'replay' ? speaker.stop() : speaker.speak('replay', replyText))}
        canReplay={speaker.supported && !!replyText && !live}
        replaying={speaker.activeKey === 'replay'}
        chips={preferences.starters && !live && !coachState ? starters : []}
        onChip={(text) => {
          setInput(text)
          typeInstead()
        }}
        showConversation={showConversation}
        onToggleConversation={() => setShowConversation((v) => !v)}
        conversation={conversation}
        listRef={listRef}
        helpLabel={helpLabel}
        helpIcon="pause"
        helpDisabled={!!coachState}
        onHelp={triggerCoachPrompt}
        onEnd={finish}
        footnote={turnCount > 0 ? `Round ${Math.min(turnCount, MAX_TURNS)} of ${MAX_TURNS}` : undefined}
      />

      <div className="permission-note">
        <Icon name="check" />
        <span>
          <strong>{permissionTitle}</strong>
          {voiceOffNote && <small>{voiceOffNote}</small>}
          {voiceOffReason && ['off-in-settings', 'needs-grown-up'].includes(voiceOffReason) && (
            <Link to="/settings" className="inline-link">Turn on in Permissions</Link>
          )}
        </span>
      </div>
    </section>
  )
}
