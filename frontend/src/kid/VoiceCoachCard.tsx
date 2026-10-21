import type { FormEvent, ReactNode, RefObject } from 'react'
import { t } from '../i18n'
import { Icon, Mascot } from '../ui'

// Light "talk to the guide" card shared by the kid (Wello) and teen/adult (voice coach) practice screens.
// The screens own all state, API and voice calls; this component only lays it out.
export interface VoiceCoachCardProps {
  lang: string
  eyebrow: string // small caps label, e.g. "Talk to Wello"
  name: string // bold line under it
  topRight?: ReactNode // e.g. the Tips pill (teens)
  subtitle?: ReactNode
  captionsOn: boolean
  onToggleCaptions: () => void
  // 'speaking' | 'listening' | 'connecting' | 'idle'
  status: 'speaking' | 'listening' | 'connecting' | 'idle'
  hideReply: boolean // captions off while audio is playing
  userText: string
  replyText: string
  replyPlaceholder: string
  extra?: ReactNode // coach offer / coach card / notices
  micOn: boolean // a voice session is running
  micDisabled: boolean
  micNote?: string | null // plain-language reason when voice is off
  onMic: () => void
  typing: boolean
  onTypeInstead: () => void
  typeForm: {
    input: string
    setInput: (value: string) => void
    onSend: (event: FormEvent) => void
    sending: boolean
    blocked: boolean
    placeholder: string
  }
  onReplay: () => void
  canReplay: boolean
  replaying: boolean
  chips: string[]
  onChip: (text: string) => void
  chipsLabel?: string
  showConversation: boolean
  onToggleConversation: () => void
  conversation: ReactNode
  listRef: RefObject<HTMLDivElement | null>
  helpLabel: string
  helpIcon?: 'info' | 'pause'
  helpDisabled: boolean
  onHelp: () => void
  onEnd: () => void
  footnote?: string
  tipsPanel?: ReactNode
}

export default function VoiceCoachCard({ listRef, typeForm, ...p }: VoiceCoachCardProps) {
  const { lang } = p
  const statusText =
    p.status === 'speaking'
      ? t(lang, 'vc.speaking')
      : p.status === 'listening'
        ? t(lang, 'vc.listening')
        : p.status === 'connecting'
          ? t(lang, 'vc.connecting')
          : null

  return (
    <div className="vc-card">
      <div className="vc-top">
        <span className="vc-label">
          <small>{p.eyebrow}</small>
          <strong>{p.name}</strong>
        </span>
        <div className="vc-top-actions">
          <button type="button" className="vc-pill" onClick={p.onToggleCaptions} aria-pressed={p.captionsOn}>
            <span className="vc-t" aria-hidden="true">T</span> {t(lang, 'vc.captions')}
          </button>
          {p.topRight}
        </div>
      </div>
      {p.subtitle && <p className="vc-sub">{p.subtitle}</p>}
      {p.tipsPanel}

      <div className="vc-stage">
        <div className={`vc-mascot ${p.status}`}>
          <i className="arc a1" />
          <i className="arc a2" />
          <Mascot size={150} />
        </div>
        <span className="vc-status" role="status">{statusText ?? ' '}</span>
        {p.userText && !p.hideReply && (
          <span className="vc-you"><b>{t(lang, 'vc.you')}</b> {p.userText}</span>
        )}
        <p className="vc-reply" aria-live="polite">
          {p.hideReply ? t(lang, 'vc.captionsOff') : p.replyText || p.replyPlaceholder}
        </p>
      </div>

      {p.extra}

      <div className="vc-controls">
        <button type="button" className="vc-side" onClick={p.onTypeInstead} aria-pressed={p.typing}>
          <span className="vc-t" aria-hidden="true">T</span> {t(lang, 'vc.typeInstead')}
        </button>
        <button
          type="button"
          className={`vc-mic ${p.micOn ? 'on' : ''}`}
          disabled={p.micDisabled}
          aria-label={p.micOn ? t(lang, 'vc.stopMic') : t(lang, 'vc.startMic')}
          aria-describedby={p.micNote ? 'vc-mic-note' : undefined}
          onClick={p.onMic}
        >
          <Icon name={p.micOn ? 'micoff' : 'mic'} size={34} />
        </button>
        <button type="button" className="vc-side" onClick={p.onReplay} disabled={!p.canReplay} aria-pressed={p.replaying}>
          <Icon name="volume" size={18} /> {t(lang, 'vc.replay')}
        </button>
      </div>
      {p.micNote && <p className="vc-mic-note" id="vc-mic-note">{p.micNote}</p>}

      {p.typing && (
        <form className="vc-type" onSubmit={typeForm.onSend}>
          <label className="sr-only" htmlFor="vc-text">{typeForm.placeholder}</label>
          <textarea
            id="vc-text"
            value={typeForm.input}
            onChange={(event) => typeForm.setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
            placeholder={typeForm.placeholder}
            rows={2}
            maxLength={600}
            disabled={typeForm.sending || typeForm.blocked}
          />
          <button
            type="submit"
            className="vc-send"
            aria-label={t(lang, 'kidPractice.send')}
            disabled={typeForm.sending || typeForm.blocked || !typeForm.input.trim()}
          >
            <Icon name="send" size={20} />
          </button>
        </form>
      )}

      {p.chips.length > 0 && (
        <div className="vc-chips">
          <span>{p.chipsLabel ?? t(lang, 'vc.orTapOne')}</span>
          {p.chips.map((chip) => (
            <button key={chip} type="button" onClick={() => p.onChip(chip)}>{chip}</button>
          ))}
        </div>
      )}

      {p.showConversation && (
        <div className="vc-convo" ref={listRef} aria-label={t(lang, 'vc.showConversation')}>
          {p.conversation}
        </div>
      )}

      {p.footnote && <small className="vc-foot">{p.footnote}</small>}

      <div className="vc-bottom">
        <button type="button" className="vc-link" onClick={p.onToggleConversation} aria-expanded={p.showConversation}>
          {p.showConversation ? t(lang, 'vc.hideConversation') : t(lang, 'vc.showConversation')}
        </button>
        <div className="vc-bottom-right">
          <button type="button" className="vc-outline" disabled={p.helpDisabled} onClick={p.onHelp}>
            <Icon name={p.helpIcon ?? 'info'} size={18} /> {p.helpLabel}
          </button>
          <button type="button" className="vc-end" onClick={p.onEnd}>
            <Icon name="check" size={18} /> {t(lang, 'vc.end')}
          </button>
        </div>
      </div>
    </div>
  )
}
