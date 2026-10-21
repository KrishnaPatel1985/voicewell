import { useEffect, useState, type FormEvent } from 'react'
import { api, errorMessage, redirectIfNoSession } from '../api'
import { formatLocalDate, t } from '../i18n'
import { useSession } from '../session'
import type { CaregiverInvite, JournalCard } from '../types'
import { Icon, Link, Note } from '../ui'

export default function Journal() {
  const { config } = useSession()
  const lang = config?.language ?? 'en'
  const ageGroup = config?.ageGroup ?? (config?.age && config.age <= 12 ? 'kids' : config?.age && config.age <= 17 ? 'teens' : 'adults')

  const params = new URLSearchParams(window.location.search)
  const initialTab = params.get('share') === '1' ? 'share' : 'journal'

  const [tab, setTab] = useState<'journal' | 'share'>(initialTab)
  const [cards, setCards] = useState<JournalCard[]>([])
  const [invites, setInvites] = useState<CaregiverInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Journal Draft & Preview state
  const [showBuilder, setShowBuilder] = useState(params.get('draft') === '1' || params.get('share') === '1')
  const [previewMode, setPreviewMode] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [topic, setTopic] = useState(params.get('topic') ?? config?.topicTitle ?? 'Sharing how I feel')
  const [reflection, setReflection] = useState(
    params.get('reflection') ?? 'I practised naming how I feel clearly and asking for what I need.',
  )
  const [usefulPhrase, setUsefulPhrase] = useState(
    params.get('phrase') ?? 'I want to share something important, and I just need you to listen first.',
  )
  const [nextStep, setNextStep] = useState(params.get('nextStep') ?? 'Pick a calm moment to start the conversation.')
  const [notes, setNotes] = useState('')
  const [audience, setAudience] = useState('Just for me (Private)')
  const [busy, setBusy] = useState(false)

  // Caregiver Support Card Builder state
  const [caregiverRole, setCaregiverRole] = useState('Parent / Guardian')
  const [whatToUnderstand, setWhatToUnderstand] = useState(
    params.get('reflection') ?? 'Sometimes it takes me a moment to find the right words when I feel overwhelmed.',
  )
  const [whatSupportHelps, setWhatSupportHelps] = useState(
    'Listening calmly first without jumping straight into fixing or lecturing.',
  )
  const [sharePhrase, setSharePhrase] = useState(
    params.get('phrase') ?? 'I feel overwhelmed and I need a few minutes to explain what happened.',
  )
  const [sharePreview, setSharePreview] = useState(false)

  useEffect(() => {
    let live = true
    Promise.all([api.journals(), api.caregiverInvites()])
      .then(([jRes, cRes]) => {
        if (!live) return
        setCards(jRes.cards)
        setInvites(cRes.invites)
      })
      .catch((e) => {
        if (live && !redirectIfNoSession(e)) setError(errorMessage(e))
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [])

  const saveCard = async (e: FormEvent) => {
    e.preventDefault()
    if (!previewMode) {
      setPreviewMode(true)
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (editingId) {
        const res = await api.updateJournal(editingId, {
          topic,
          reflection,
          usefulPhrase,
          nextStep,
          notes,
          audience,
          language: lang,
        })
        setCards((prev) => prev.map((c) => (c.id === editingId ? res.card : c)))
        setNotice('Journal card updated.')
      } else {
        const res = await api.createJournal({
          topic,
          reflection,
          usefulPhrase,
          nextStep,
          notes,
          audience,
          language: lang,
        })
        setCards((prev) => [res.card, ...prev])
        setNotice('Private journal card saved.')
      }
      setPreviewMode(false)
      setShowBuilder(false)
      setEditingId(null)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (card: JournalCard) => {
    setEditingId(card.id)
    setTopic(card.topic)
    setReflection(card.reflection)
    setUsefulPhrase(card.usefulPhrase)
    setNextStep(card.nextStep)
    setNotes(card.notes)
    setAudience(card.audience)
    setPreviewMode(false)
    setShowBuilder(true)
    setTab('journal')
  }

  const removeCard = async (id: string) => {
    setBusy(true)
    setError('')
    try {
      await api.deleteJournal(id)
      setCards((prev) => prev.filter((c) => c.id !== id))
      setNotice('Journal card deleted.')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const createSupportInvite = async (e: FormEvent) => {
    e.preventDefault()
    if (!sharePreview) {
      setSharePreview(true)
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await api.createCaregiverInvite({
        ageGroup,
        topic,
        caregiverRole,
        whatToUnderstand,
        whatSupportHelps,
        usefulPhrase: sharePhrase,
        language: lang,
      })
      setInvites((prev) => [res.invite, ...prev])
      setSharePreview(false)
      setNotice('Approved Caregiver Support Card link & QR code created!')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const revokeInvite = async (code: string) => {
    setBusy(true)
    setError('')
    try {
      const res = await api.revokeCaregiverInvite(code)
      setInvites((prev) => prev.map((inv) => (inv.code === code ? res.invite : inv)))
      setNotice(res.notice)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const shareHeading =
    ageGroup === 'kids'
      ? t(lang, 'feedback.kidsShare')
      : ageGroup === 'teens'
        ? t(lang, 'feedback.teensShare')
        : 'Share a Caregiver / Support Card'

  return (
    <section className="journal-shell">
      <div className="journal-header">
        <div>
          <span className="web-kicker">Privacy-First Reflection &amp; Sharing</span>
          <h1>{t(lang, 'journal.title')}</h1>
          <p>{t(lang, 'journal.subtitle')}</p>
        </div>
        <div className="journal-tab-switch" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'journal'}
            className={tab === 'journal' ? 'active' : ''}
            onClick={() => setTab('journal')}
          >
            🔒 Private Journal Cards ({cards.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'share'}
            className={tab === 'share' ? 'active' : ''}
            onClick={() => setTab('share')}
          >
            🤝 {shareHeading} ({invites.length})
          </button>
        </div>
      </div>

      {notice && <Note>{notice}</Note>}
      {error && <Note tone="warn">{error}</Note>}

      {/* =====================================================================
          TAB 1: PRIVATE JOURNAL CARDS
         ===================================================================== */}
      {tab === 'journal' && (
        <div className="journal-tab-content">
          <div className="journal-toolbar">
            <div className="privacy-guarantee">
              <Icon name="check" />
              <span>
                <strong>Private by default:</strong> Only cards you preview and save appear here. Raw practice transcripts and voice audio are never stored.
              </span>
            </div>
            {!showBuilder && (
              <button
                type="button"
                className="web-primary"
                onClick={() => {
                  setEditingId(null)
                  setPreviewMode(false)
                  setShowBuilder(true)
                }}
              >
                + New Journal Card
              </button>
            )}
          </div>

          {showBuilder && (
            <form className="journal-builder-card" onSubmit={saveCard}>
              <div className="jb-top">
                <h2>{editingId ? 'Edit Journal Card' : previewMode ? 'Preview Before Saving' : 'Create a Private Journal Card'}</h2>
                <span className="privacy-pill">🔒 Private to your account</span>
              </div>

              {!previewMode ? (
                <div className="jb-fields">
                  <div className="jb-row-2">
                    <label>
                      <span>Topic or conversation</span>
                      <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} required />
                    </label>
                    <label>
                      <span>Optional person / audience</span>
                      <input type="text" value={audience} onChange={(e) => setAudience(e.target.value)} />
                    </label>
                  </div>
                  <label>
                    <span>Key reflection / takeaway</span>
                    <textarea rows={2} value={reflection} onChange={(e) => setReflection(e.target.value)} required />
                  </label>
                  <label>
                    <span>Useful phrase I want to remember</span>
                    <textarea rows={2} value={usefulPhrase} onChange={(e) => setUsefulPhrase(e.target.value)} required />
                  </label>
                  <div className="jb-row-2">
                    <label>
                      <span>Concrete next step</span>
                      <input type="text" value={nextStep} onChange={(e) => setNextStep(e.target.value)} />
                    </label>
                    <label>
                      <span>Personal notes (optional)</span>
                      <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </label>
                  </div>
                </div>
              ) : (
                <div className="journal-preview-box">
                  <small>Preview — confirm what will be saved to your private journal:</small>
                  <h3>{topic}</h3>
                  <p><strong>Reflection:</strong> {reflection}</p>
                  <blockquote>&ldquo;{usefulPhrase}&rdquo;</blockquote>
                  {nextStep && <p><strong>Next step:</strong> {nextStep}</p>}
                  {notes && <p><strong>Notes:</strong> {notes}</p>}
                  <small>Audience: {audience}</small>
                </div>
              )}

              <div className="jb-actions">
                {previewMode ? (
                  <>
                    <button type="button" className="web-secondary" onClick={() => setPreviewMode(false)}>
                      Back to edit
                    </button>
                    <button type="submit" className="web-primary" disabled={busy}>
                      <Icon name="check" /> {busy ? 'Saving…' : t(lang, 'journal.saveCard')}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="web-secondary"
                      onClick={() => {
                        setShowBuilder(false)
                        setEditingId(null)
                      }}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="web-primary">
                      {t(lang, 'journal.previewSave')} <Icon name="arrow" />
                    </button>
                  </>
                )}
              </div>
            </form>
          )}

          {loading ? (
            <p className="screen-loading">Loading your journal cards…</p>
          ) : cards.length === 0 ? (
            <div className="empty-journal-state">
              <p>You haven’t saved any journal cards yet.</p>
              <button type="button" className="web-secondary" onClick={() => setShowBuilder(true)}>
                Create your first journal card
              </button>
            </div>
          ) : (
            <div className="journal-cards-grid">
              {cards.map((card) => (
                <article key={card.id} className="saved-journal-card">
                  <header>
                    <div>
                      <span className="web-kicker">{card.topic}</span>
                      <small>{formatLocalDate(card.practicedAt || card.createdAt, lang)}</small>
                    </div>
                    <span className="privacy-pill">{card.audience || 'Private'}</span>
                  </header>
                  <p className="jc-reflection">{card.reflection}</p>
                  {card.usefulPhrase && <blockquote className="jc-phrase">&ldquo;{card.usefulPhrase}&rdquo;</blockquote>}
                  {card.nextStep && (
                    <p className="jc-next">
                      <strong>Next step:</strong> {card.nextStep}
                    </p>
                  )}
                  {card.notes && (
                    <p className="jc-notes">
                      <small>{card.notes}</small>
                    </p>
                  )}
                  <footer className="jc-footer">
                    <button type="button" className="web-secondary" onClick={() => startEdit(card)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="web-secondary"
                      onClick={() => {
                        setWhatToUnderstand(card.reflection)
                        setSharePhrase(card.usefulPhrase)
                        setTab('share')
                      }}
                    >
                      Share with a grown-up / supporter
                    </button>
                    <button type="button" className="danger-btn" disabled={busy} onClick={() => void removeCard(card.id)}>
                      Delete
                    </button>
                  </footer>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 2: CHILD-INITIATED CAREGIVER SUPPORT CARDS & INVITATIONS
         ===================================================================== */}
      {tab === 'share' && (
        <div className="journal-tab-content">
          <div className="caregiver-share-builder">
            <div className="cs-intro">
              <span className="web-kicker">Child-Initiated Support Invitation</span>
              <h2>{shareHeading}</h2>
              <p>
                Review and edit your <strong>Caregiver Support Card</strong> below. Only the words on this approved card are shared — your private journal and practice chat are never shared.
              </p>
            </div>

            <form onSubmit={createSupportInvite} className="cs-form">
              {!sharePreview ? (
                <div className="jb-fields">
                  <div className="jb-row-2">
                    <label>
                      <span>Who is this card for?</span>
                      <select value={caregiverRole} onChange={(e) => setCaregiverRole(e.target.value)}>
                        <option value="Parent / Guardian">Parent / Guardian</option>
                        <option value="Teacher / School Counselor">Teacher / School Counselor</option>
                        <option value="Doctor / Healthcare Provider">Doctor / Healthcare Provider</option>
                        <option value="Partner / Trusted Adult">Partner / Trusted Adult</option>
                      </select>
                    </label>
                    <label>
                      <span>Topic</span>
                      <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} required />
                    </label>
                  </div>

                  <label>
                    <span>1. What I want you to understand:</span>
                    <textarea
                      rows={2}
                      value={whatToUnderstand}
                      onChange={(e) => setWhatToUnderstand(e.target.value)}
                      required
                    />
                  </label>

                  <label>
                    <span>2. What kind of support would help me most:</span>
                    <textarea
                      rows={2}
                      value={whatSupportHelps}
                      onChange={(e) => setWhatSupportHelps(e.target.value)}
                      required
                    />
                  </label>

                  <label>
                    <span>3. The phrase I practised saying:</span>
                    <input
                      type="text"
                      value={sharePhrase}
                      onChange={(e) => setSharePhrase(e.target.value)}
                      required
                    />
                  </label>
                </div>
              ) : (
                <div className="approved-card-preview">
                  <span className="pc-badge">Approved Card Preview — Only this card will be visible</span>
                  <h3>For my {caregiverRole}: {topic}</h3>
                  <p><strong>What I want you to understand:</strong> {whatToUnderstand}</p>
                  <p><strong>What would help me:</strong> {whatSupportHelps}</p>
                  <blockquote>&ldquo;{sharePhrase}&rdquo;</blockquote>
                </div>
              )}

              <div className="jb-actions">
                {sharePreview ? (
                  <>
                    <button type="button" className="web-secondary" onClick={() => setSharePreview(false)}>
                      Edit card
                    </button>
                    <button type="submit" className="web-primary" disabled={busy}>
                      <Icon name="check" /> Approve &amp; Create Share Link / QR
                    </button>
                  </>
                ) : (
                  <button type="submit" className="web-primary">
                    Preview Support Card <Icon name="arrow" />
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="invites-list-section">
            <h3>Your Shared Support Invitations</h3>
            <p className="revoke-honesty-note">
              You can revoke any link at any time to block future access. Note: information that a recipient has already viewed while the link was active cannot be taken back.
            </p>
            {invites.length === 0 ? (
              <p className="empty-sub">No caregiver invitations created yet.</p>
            ) : (
              <div className="invites-grid">
                {invites.map((inv) => {
                  const shareUrl = `${window.location.origin}/caregiver?code=${inv.code}`
                  return (
                    <article key={inv.id} className={`invite-card status-${inv.status}`}>
                      <header>
                        <div>
                          <span className={`invite-status-pill ${inv.status}`}>
                            Status: {inv.status.toUpperCase()}
                          </span>
                          <strong>For: {inv.caregiverRole}</strong>
                        </div>
                        <code className="invite-code">Code: {inv.code}</code>
                      </header>

                      <div className="invite-qr-row">
                        {/* Stylized deterministic QR Code SVG for the invitation link */}
                        <div className="qr-box" aria-label={`QR Code for ${inv.code}`}>
                          <svg viewBox="0 0 64 64" width="76" height="76" role="img">
                            <rect width="64" height="64" rx="6" fill="#fff" stroke="#176b62" strokeWidth="2" />
                            <rect x="6" y="6" width="16" height="16" fill="#176b62" />
                            <rect x="10" y="10" width="8" height="8" fill="#fff" />
                            <rect x="42" y="6" width="16" height="16" fill="#176b62" />
                            <rect x="46" y="10" width="8" height="8" fill="#fff" />
                            <rect x="6" y="42" width="16" height="16" fill="#176b62" />
                            <rect x="10" y="46" width="8" height="8" fill="#fff" />
                            <rect x="26" y="10" width="6" height="6" fill="#176b62" />
                            <rect x="26" y="24" width="12" height="12" fill="#176b62" />
                            <rect x="44" y="28" width="10" height="6" fill="#176b62" />
                            <rect x="28" y="44" width="8" height="12" fill="#176b62" />
                            <rect x="42" y="42" width="14" height="14" fill="#176b62" />
                          </svg>
                        </div>
                        <div className="invite-summary">
                          <p><strong>Understand:</strong> {inv.whatToUnderstand}</p>
                          <p><strong>Helps:</strong> {inv.whatSupportHelps}</p>
                          {inv.supportActionChosen && (
                            <p className="chosen-action-banner">
                              ✓ Caregiver committed to: <strong>{inv.supportActionChosen}</strong>
                            </p>
                          )}
                          <small>
                            {inv.alreadyViewed ? 'Viewed by recipient' : 'Not opened yet'} · Expires {formatLocalDate(inv.expiresAt, lang)}
                          </small>
                        </div>
                      </div>

                      <footer className="jc-footer">
                        <Link to={`/caregiver?code=${inv.code}`} className="web-primary">
                          Open Caregiver View ({inv.code})
                        </Link>
                        <button
                          type="button"
                          className="web-secondary"
                          onClick={() => {
                            void navigator.clipboard?.writeText(shareUrl)
                            setNotice(`Copied caregiver link: ${shareUrl}`)
                          }}
                        >
                          Copy Link
                        </button>
                        {inv.status !== 'revoked' && inv.status !== 'expired' && (
                          <button
                            type="button"
                            className="danger-btn"
                            disabled={busy}
                            onClick={() => void revokeInvite(inv.code)}
                          >
                            Revoke Link
                          </button>
                        )}
                      </footer>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
