import { t } from '../i18n'
import { Icon } from '../ui'

// Small speaker button that reads a line aloud (tap again to stop).
export default function SpeakButton({ lang, playing, disabled, onClick }: {
  lang: string
  playing: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`speak-btn ${playing ? 'playing' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={playing}
      aria-label={playing ? t(lang, 'kidPractice.stopReading') : t(lang, 'kidPractice.readAloud')}
    >
      <Icon name="volume" size={16} />
    </button>
  )
}
