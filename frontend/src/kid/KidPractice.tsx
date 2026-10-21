import { useEffect, useState, type FormEvent, type RefObject } from 'react'
import { useSpeaker } from '../audio/speak'
import { t } from '../i18n'
import { offNote } from '../reasons'
import { navigate } from '../router'
import type { CapabilityState, CoachReply, Persona, Turn } from '../types'
import { Icon, Link, Mascot } from '../ui'
import SpeakButton from './SpeakButton'
import VoiceCoachCard from './VoiceCoachCard'

// Kid (6-12) "Talk to Wello" screen: light voice card with read-aloud, a mic button and a typed fallback.
// PracticeStage owns the state and the API/voice calls; this component only lays them out.
export interface KidPracticeProps {
  lang: string
  persona: Persona
  helpLabel: string
  turns: Turn[]
  caption: { who: 'user' | 'assistant'; text: string; final: boolean } | null
  captionsOn: boolean
  onToggleCaptions: () => void
  sending: boolean
  ended: 'done' | 'safety' | null
  phase: 'idle' | 'connecting' | 'live'
  speaking: boolean
  userTalking: boolean
  voice: CapabilityState
  textOn: boolean
  typed: boolean
  notice: string | null
  typedError: string
  starters: string[]
  input: string
  setInput: (value: string) => void
  onSend: (event: FormEvent) => void
  onMic: () => void
  onStopMic: () => void
  onTypeInstead: () => void
  onFinish: () => void
  coachPromptBanner: string | null
  coachState: CoachReply | null
  coachBusy: boolean
  onCoachPrompt: () => void
  onCoach: (action: 'explain' | 'more_help' | 'retry_moment', format: 'text' | 'audio') => void
  onDismissCoachPrompt: () => void
  onResume: () => void
  listRef: RefObject<HTMLDivElement | null>
}

function WelloAvatar() {
  return <span className="kid-avatar" aria-hidden="true"><Mascot size={32} /></span>
}

export default function KidPractice({ listRef, ...p }: KidPracticeProps) {
  const { lang, persona, voice, phase } = p
  const speaker = useSpeaker(lang)
  const voiceOn = voice.on
  const voiceOffNote = offNote(voice)
  const live = phase !== 'idle'
  const stopReading = speaker.stop
  const speakCoach = speaker.speak
  const [showConversation, setShowConversation] = useState(false)
  // Voice off: "Hear an explanation" fetches the text coaching and reads it aloud here (output only).
  const [readCoach, setReadCoach] = useState(false)
  const { coachState } = p

  // Never read aloud over the live voice session.
  useEffect(() => {
    if (live) stopReading()
  }, [live, stopReading])

  useEffect(() => {
    if (!coachState) setReadCoach(false)
    else if (readCoach) speakCoach('coach', `${coachState.explanation} ${coachState.examplePhrase}`)
    // Only a new coachState should trigger reading, not toggling the flag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachState])

  const line = (key: string, text: string, who: string) => (
    <div className="kid-row" key={key}>
      <WelloAvatar />
      <div className="kid-bubble persona">
        <small className="sr-only">{who}</small>
        <p>{text}</p>
        {speaker.supported && (
          <SpeakButton
            lang={lang}
            playing={speaker.activeKey === key}
            disabled={live}
            onClick={() => (speaker.activeKey === key ? speaker.stop() : speaker.speak(key, text))}
          />
        )}
      </div>
    </div>
  )

  if (p.ended === 'done') {
    return (
      <section className="kid-practice">
        <div className="kid-chat-card kid-done">
          <Mascot size={96} />
          <h1>{t(lang, 'kidPractice.doneTitle')}</h1>
          <p>{t(lang, 'kidPractice.doneBody')}</p>
          <button type="button" className="web-primary kid-end" onClick={() => navigate('/feedback')}>
            <Icon name="check" size={18} /> {t(lang, 'kidPractice.getReflection')}
          </button>
        </div>
      </section>
    )
  }

  const lastOf = (role: Turn['role']) => [...p.turns].reverse().find((turn) => turn.role === role)?.text ?? ''
  const draft = p.caption && !p.caption.final && p.caption.text.trim() ? p.caption : null
  const replyText = draft?.who === 'assistant' ? draft.text : lastOf('assistant')
  const userText = draft?.who === 'user' ? draft.text : lastOf('user')
  const status = p.sending
    ? 'idle'
    : phase === 'connecting'
      ? 'connecting'
      : phase === 'live'
        ? p.speaking && !p.userTalking
          ? 'speaking'
          : 'listening'
        : speaker.activeKey
          ? 'speaking'
          : 'idle'

  const micNote = voiceOn ? null : `${t(lang, 'kidPractice.voiceOff')} ${voiceOffNote}`

  const extra = (
    <>
      {p.coachPromptBanner && !coachState && (
        <div className="kid-coach-offer" role="region" aria-label={p.helpLabel}>
          <p>{p.coachPromptBanner}</p>
          <div className="kid-coach-actions">
            {(voiceOn || speaker.supported) && (
              <button
                type="button"
                disabled={p.coachBusy}
                onClick={() => {
                  // voiceOn: Practice.tsx speaks the audio-format reply; otherwise read the text reply here.
                  setReadCoach(!voiceOn)
                  p.onCoach('explain', voiceOn ? 'audio' : 'text')
                }}
              >
                <Icon name="volume" size={16} /> {t(lang, 'practice.explainAudio')}
              </button>
            )}
            {p.textOn && (
              <button
                type="button"
                disabled={p.coachBusy}
                onClick={() => {
                  setReadCoach(false)
                  p.onCoach('explain', 'text')
                }}
              >
                <Icon name="text" size={16} /> {t(lang, 'practice.readInstead')}
              </button>
            )}
            <button type="button" className="quiet" disabled={p.coachBusy} onClick={p.onDismissCoachPrompt}>
              {t(lang, 'practice.keepGoing')}
            </button>
          </div>
        </div>
      )}

      {coachState && (
        <div className="kid-coach-card" role="region" aria-label={p.helpLabel}>
          <span className="kid-coach-head"><Icon name="pause" size={14} /> {t(lang, 'kidPractice.paused')}</span>
          <div className="kid-coach-captions">
            <p>
              {coachState.explanation}
              {speaker.supported && (
                <SpeakButton
                  lang={lang}
                  playing={speaker.activeKey === 'coach'}
                  onClick={() =>
                    speaker.activeKey === 'coach'
                      ? speaker.stop()
                      : speaker.speak('coach', `${coachState.explanation} ${coachState.examplePhrase}`)
                  }
                />
              )}
            </p>
            {coachState.examplePhrase && (
              <p className="kid-coach-phrase">
                <small>{t(lang, 'kidPractice.tryPhrase')}</small>
                &ldquo;{coachState.examplePhrase}&rdquo;
              </p>
            )}
          </div>
          <div className="kid-coach-actions">
            <button type="button" className="solid" disabled={p.coachBusy} onClick={p.onResume}>
              <Icon name="play" size={16} /> {t(lang, 'practice.resume')}
            </button>
            {coachState.examplePhrase && (
              <button
                type="button"
                disabled={p.coachBusy}
                onClick={() => {
                  p.setInput(coachState.examplePhrase)
                  p.onResume()
                }}
              >
                {t(lang, 'kidPractice.usePhrase')}
              </button>
            )}
            <button type="button" disabled={p.coachBusy} onClick={() => p.onCoach('retry_moment', coachState.format)}>
              {t(lang, 'practice.tryAgain')}
            </button>
            <button type="button" disabled={p.coachBusy} onClick={() => p.onCoach('more_help', coachState.format)}>
              {t(lang, 'practice.moreHelp')}
            </button>
          </div>
          <small>{t(lang, 'kidPractice.coachNote')}</small>
        </div>
      )}

      {p.notice && <p className="kid-notice" role="status">{p.notice}</p>}
      {p.typedError && <p className="kid-notice" role="alert">{p.typedError}</p>}
    </>
  )

  const conversation = (
    <>
      {p.turns.length === 0 && line('wello-first', t(lang, 'kidPractice.wFirst'), 'Wello')}
      {p.turns.map((turn, i) =>
        turn.role === 'user' ? (
          <div key={i} className="kid-bubble user"><small className="sr-only">You</small><p>{turn.text}</p></div>
        ) : (
          line(`turn-${i}`, turn.text, persona.name)
        ),
      )}
      {p.sending && (
        <div className="kid-row"><WelloAvatar /><div className="kid-bubble persona thinking"><p>…</p></div></div>
      )}
    </>
  )

  return (
    <section className="kid-practice">
      <Link to="/home" className="text-back"><Icon name="back" /> {t(lang, 'kidPractice.back')}</Link>
      <VoiceCoachCard
        lang={lang}
        eyebrow={t(lang, 'kids.talkToWello')}
        name="Wello"
        subtitle={t(lang, 'kidPractice.sub').replace('{name}', persona.name)}
        captionsOn={p.captionsOn}
        onToggleCaptions={p.onToggleCaptions}
        status={status}
        hideReply={!p.captionsOn && (live || !!speaker.activeKey)}
        userText={userText}
        replyText={replyText}
        replyPlaceholder={t(lang, 'kidPractice.wFirst')}
        extra={extra}
        micOn={live}
        micDisabled={live ? false : !voiceOn || p.sending || !!coachState}
        micNote={micNote}
        onMic={live ? p.onStopMic : p.onMic}
        typing={p.typed}
        onTypeInstead={p.onTypeInstead}
        typeForm={{
          input: p.input,
          setInput: p.setInput,
          onSend: p.onSend,
          sending: p.sending,
          blocked: !!coachState,
          placeholder: t(lang, 'kidPractice.placeholder'),
        }}
        onReplay={() => (speaker.activeKey === 'replay' ? speaker.stop() : speaker.speak('replay', replyText))}
        canReplay={speaker.supported && !!replyText && !live}
        replaying={speaker.activeKey === 'replay'}
        chips={!live && !coachState ? p.starters : []}
        onChip={(text) => {
          p.setInput(text)
          p.onTypeInstead()
        }}
        chipsLabel={t(lang, 'vc.orTapOne')}
        showConversation={showConversation}
        onToggleConversation={() => setShowConversation((v) => !v)}
        conversation={conversation}
        listRef={listRef}
        helpLabel={p.helpLabel}
        helpDisabled={!!coachState}
        onHelp={p.onCoachPrompt}
        onEnd={p.onFinish}
      />
    </section>
  )
}
