import { getStrings } from '../i18n'
import { navigate } from '../router'
import { useSession } from '../session'
import { load } from '../storage'
import { Icon, Mascot } from '../ui'

export default function Welcome() {
  const { config } = useSession()
  const lang = config?.language ?? load('vw.language') ?? 'en'
  const t = getStrings(lang)

  return (
    <section className="welcome-web">
      <div className="welcome-card">
        <Mascot size={132} check />
        <h1>{t.welcomeTitle}</h1>
        <p>{t.welcomeSubtitle}</p>
        <div className="welcome-cta-row">
          <button className="web-primary welcome-go" onClick={() => navigate('/age')}>
            <Icon name="arrow" /> {t.getStarted}
          </button>
          {config && (
            <button className="web-secondary" onClick={() => navigate('/home')}>
              {t.navHome} ({config.ageGroup === 'kids' ? 'Kids 6–12' : config.ageGroup === 'teens' ? 'Teens 13–17' : 'Adults 18+'} · {config.jurisdiction})
            </button>
          )}
        </div>
        <div className="trust-row">
          <span><Icon name="check" /> {t.trustPrivate}</span>
          <span><Icon name="check" /> {t.trustNoDiagnosis}</span>
          <span><Icon name="check" /> {t.trustAdaptive}</span>
        </div>
      </div>
    </section>
  )
}
