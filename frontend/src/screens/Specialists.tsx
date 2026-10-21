import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { api, errorMessage, redirectIfNoSession } from '../api'
import { formatCurrency, formatLocalDate, t } from '../i18n'
import { useSession } from '../session'
import type { AppointmentRequest, Specialist } from '../types'
import { Icon, Note } from '../ui'

export default function Specialists() {
  const { config } = useSession()
  const lang = config?.language ?? 'en'
  const ageGroup =
    config?.ageGroup ?? (config?.age && config.age <= 12 ? 'kids' : config?.age && config.age <= 17 ? 'teens' : 'adults')

  const [specialists, setSpecialists] = useState<Specialist[]>([])
  const [requests, setRequests] = useState<AppointmentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Search & Filter state
  const [search, setSearch] = useState('')
  const [ageFilter, setAgeFilter] = useState<string>('all')
  const [langFilter, setLangFilter] = useState<string>('all')
  const [formatFilter, setFormatFilter] = useState<string>('all')
  const [maxPrice, setMaxPrice] = useState<number>(200)

  // Booking Modal / Builder state
  const [selectedSp, setSelectedSp] = useState<Specialist | null>(null)
  const [bookingType, setBookingType] = useState<'adult_self' | 'adult_child_invite' | 'child_guardian_request'>(
    ageGroup === 'adults' ? 'adult_self' : 'child_guardian_request',
  )
  const [selectedSlot, setSelectedSlot] = useState('')
  const [selectedFormat, setSelectedFormat] = useState('Video')
  const [appointmentType, setAppointmentType] = useState('Initial Communication & Support Consultation')
  const [purposeLabel, setPurposeLabel] = useState(
    'Practise and prepare for upcoming family or healthcare conversations.',
  )
  const [informationScope, setInformationScope] = useState(
    'Only the approved summary card and questions we choose together — no private journal entries.',
  )
  const [busy, setBusy] = useState(false)

  // Child question / Scope update inputs for existing requests
  const [questionDrafts, setQuestionDrafts] = useState<Record<string, string>>({})
  const [scopeDrafts, setScopeDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    let live = true
    Promise.all([api.specialists(), api.appointments()])
      .then(([spRes, reqRes]) => {
        if (!live) return
        setSpecialists(spRes.specialists)
        setRequests(reqRes.requests)
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

  const filteredSpecialists = useMemo(() => {
    return specialists.filter((sp) => {
      if (ageFilter !== 'all' && !sp.supportedAges.includes(ageFilter)) return false
      if (langFilter !== 'all' && !sp.languages.some((l) => l.toLowerCase().includes(langFilter.toLowerCase())))
        return false
      if (formatFilter !== 'all' && !sp.formats.includes(formatFilter)) return false
      if (sp.price > maxPrice) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return (
          sp.name.toLowerCase().includes(q) ||
          sp.specialty.toLowerCase().includes(q) ||
          sp.summary.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [specialists, ageFilter, langFilter, formatFilter, maxPrice, search])

  const openBooking = (sp: Specialist, defaultMode?: 'adult_self' | 'adult_child_invite' | 'child_guardian_request') => {
    setSelectedSp(sp)
    setSelectedSlot(sp.availableSlots[0]?.startsAt ?? sp.nextAvailable)
    setSelectedFormat(sp.formats[0] ?? 'Video')
    if (defaultMode) {
      setBookingType(defaultMode)
    } else {
      setBookingType(ageGroup === 'adults' ? 'adult_self' : 'child_guardian_request')
    }
  }

  const submitBookingRequest = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedSp) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await api.createAppointment({
        bookingType,
        creatorRole: ageGroup,
        specialistId: selectedSp.id,
        specialistName: selectedSp.name,
        specialty: selectedSp.specialty,
        proposedAt: selectedSlot,
        format: selectedFormat,
        price: selectedSp.price,
        appointmentType,
        purposeLabel,
        informationScope,
      })
      setRequests((prev) => [res.request, ...prev])
      setSelectedSp(null)
      setNotice(
        bookingType === 'adult_self'
          ? 'Appointment request submitted! Status: Pending provider confirmation (never auto-confirmed).'
          : bookingType === 'adult_child_invite'
            ? 'Child invitation created! The young person can now review the plain-language purpose and respond Yes, I have questions, or Not right now.'
            : 'Support request created! Waiting for a parent or guardian to approve and authorize payment.',
      )
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleChildResponse = async (reqId: string, response: 'accept' | 'more_information' | 'decline') => {
    setBusy(true)
    setError('')
    try {
      const res = await api.respondAppointment(reqId, response, questionDrafts[reqId])
      setRequests((prev) => prev.map((r) => (r.id === reqId ? res.request : r)))
      setNotice(`Child response recorded: ${res.request.status}`)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleScopeChange = async (req: AppointmentRequest) => {
    const nextScope =
      scopeDrafts[req.id]?.trim() ||
      'Updated scope: Share school & home communication summary + invite counselor notes.'
    setBusy(true)
    setError('')
    try {
      const res = await api.changeAppointmentScope(req.id, nextScope)
      setRequests((prev) => prev.map((r) => (r.id === req.id ? res.request : r)))
      setNotice(res.message)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleGuardianAuth = async (reqId: string, action: 'approve' | 'decline') => {
    setBusy(true)
    setError('')
    try {
      const res = await api.guardianAuthorizeAppointment(reqId, action)
      setRequests((prev) => prev.map((r) => (r.id === reqId ? res.request : r)))
      setNotice(
        action === 'approve'
          ? 'Guardian approved & authorized payment. Request sent to specialist (awaiting provider confirmation).'
          : 'Guardian declined the appointment request.',
      )
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="specialists-shell">
      <div className="sp-header">
        <div>
          <span className="web-kicker">Verified Directory &amp; Transparent Booking</span>
          <h1>{t(lang, 'specialists.title')}</h1>
          <p>{t(lang, 'specialists.subtitle')}</p>
        </div>
        <div className="honesty-pill">
          <Icon name="check" />
          <span>Honest Statuses: Requests are never fake-confirmed before provider review</span>
        </div>
      </div>

      {notice && <Note>{notice}</Note>}
      {error && <Note tone="warn">{error}</Note>}

      {/* Search & Filter Bar */}
      <div className="sp-filter-bar" role="search">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search specialty, name, or focus…"
          className="sp-search-input"
        />
        <select value={ageFilter} onChange={(e) => setAgeFilter(e.target.value)} aria-label="Filter by age group">
          <option value="all">All age groups</option>
          <option value="kids">Kids (6–12)</option>
          <option value="teens">Teens (13–17)</option>
          <option value="adults">Adults (18+)</option>
        </select>
        <select value={langFilter} onChange={(e) => setLangFilter(e.target.value)} aria-label="Filter by language">
          <option value="all">All languages</option>
          <option value="English">English</option>
          <option value="Español">Español</option>
          <option value="简体中文">简体中文</option>
        </select>
        <select value={formatFilter} onChange={(e) => setFormatFilter(e.target.value)} aria-label="Filter by format">
          <option value="all">All formats</option>
          <option value="Video">Video</option>
          <option value="In-person">In-person</option>
          <option value="Phone">Phone</option>
        </select>
        <label className="price-filter">
          <span>Max: {formatCurrency(maxPrice, lang)}</span>
          <input
            type="range"
            min={90}
            max={200}
            step={10}
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
          />
        </label>
      </div>

      {/* Booking Request Builder Modal / Drawer */}
      {selectedSp && (
        <form className="sp-booking-drawer" onSubmit={submitBookingRequest}>
          <div className="jb-top">
            <div>
              <span className="web-kicker">Appointment Request (Not a Confirmed Booking)</span>
              <h2>Request time with {selectedSp.name}</h2>
              <small>{selectedSp.credentials} · {selectedSp.specialty}</small>
            </div>
            <button type="button" className="web-secondary" onClick={() => setSelectedSp(null)}>
              Cancel
            </button>
          </div>

          <div className="booking-type-selector" role="group" aria-label="Booking pathway">
            {ageGroup === 'adults' ? (
              <>
                <button
                  type="button"
                  className={`clue-chip ${bookingType === 'adult_self' ? 'selected' : ''}`}
                  onClick={() => setBookingType('adult_self')}
                >
                  👤 For myself (Adult self-request)
                </button>
                <button
                  type="button"
                  className={`clue-chip ${bookingType === 'adult_child_invite' ? 'selected' : ''}`}
                  onClick={() => setBookingType('adult_child_invite')}
                >
                  👨‍👧 Involve my child/teen (Creates separate child invitation)
                </button>
              </>
            ) : (
              <span className="pc-badge">
                Youth Request Pathway: Requires parent/guardian approval &amp; payment authorization
              </span>
            )}
          </div>

          <div className="jb-fields">
            <div className="jb-row-2">
              <label>
                <span>Preferred slot</span>
                <select value={selectedSlot} onChange={(e) => setSelectedSlot(e.target.value)}>
                  {selectedSp.availableSlots.map((slot) => (
                    <option key={slot.startsAt} value={slot.startsAt}>
                      {slot.label} ({formatLocalDate(slot.startsAt, lang)})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Session format ({formatCurrency(selectedSp.price, lang)})</span>
                <select value={selectedFormat} onChange={(e) => setSelectedFormat(e.target.value)}>
                  {selectedSp.formats.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              <span>Appointment type</span>
              <input type="text" value={appointmentType} onChange={(e) => setAppointmentType(e.target.value)} required />
            </label>

            <label>
              <span>Plain-language purpose (shown clearly to all participants)</span>
              <textarea rows={2} value={purposeLabel} onChange={(e) => setPurposeLabel(e.target.value)} required />
            </label>

            <label>
              <span>Information-sharing scope (changing this later requires renewed child agreement)</span>
              <textarea rows={2} value={informationScope} onChange={(e) => setInformationScope(e.target.value)} required />
            </label>
          </div>

          <div className="jb-actions">
            <button type="submit" className="web-primary" disabled={busy}>
              <Icon name="calendar" />{' '}
              {bookingType === 'adult_self'
                ? t(lang, 'specialists.requestBtn')
                : bookingType === 'adult_child_invite'
                  ? t(lang, 'specialists.inviteChildBtn')
                  : t(lang, 'specialists.askGuardianBtn')}
            </button>
          </div>
        </form>
      )}

      {/* Specialist Directory Grid */}
      {loading ? (
        <p className="screen-loading">Loading verified specialists…</p>
      ) : (
        <div className="specialists-grid">
          {filteredSpecialists.map((sp) => (
            <article key={sp.id} className="specialist-card">
              <header>
                <div>
                  <span className="verified-badge">✓ Verified · {sp.credentials}</span>
                  <h2>{sp.name}</h2>
                  <strong className="sp-specialty">{sp.specialty}</strong>
                </div>
                <div className="sp-price-tag">
                  <strong>{formatCurrency(sp.price, lang)}</strong>
                  <small>/ session</small>
                </div>
              </header>

              <p className="sp-summary">{sp.summary}</p>
              <p className="sp-about">{sp.about}</p>

              <div className="sp-meta-tags">
                <span>👥 Ages: {sp.supportedAgeRange}</span>
                <span>🌐 {sp.languages.join(', ')}</span>
                <span>📍 {sp.formats.join(' · ')}</span>
              </div>

              <footer className="sp-card-footer">
                {ageGroup === 'adults' ? (
                  <>
                    <button
                      type="button"
                      className="web-primary"
                      onClick={() => openBooking(sp, 'adult_self')}
                    >
                      {t(lang, 'specialists.requestBtn')}
                    </button>
                    <button
                      type="button"
                      className="web-secondary"
                      onClick={() => openBooking(sp, 'adult_child_invite')}
                    >
                      {t(lang, 'specialists.inviteChildBtn')}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="web-primary"
                    onClick={() => openBooking(sp, 'child_guardian_request')}
                  >
                    {t(lang, 'specialists.askGuardianBtn')}
                  </button>
                )}
              </footer>
            </article>
          ))}
        </div>
      )}

      {/* Active Appointment Requests & Child/Guardian Consent Tracker */}
      <div className="appointments-tracker-section">
        <h2>Your Appointment Requests &amp; Invitations ({requests.length})</h2>
        <p>
          Every request shows its real verification state: provider confirmation is never faked, and involving a child or changing information scope requires explicit child agreement.
        </p>

        {requests.length === 0 ? (
          <p className="empty-sub">No appointment requests submitted yet.</p>
        ) : (
          <div className="appointments-list">
            {requests.map((req) => (
              <article key={req.id} className="appointment-req-card">
                <header>
                  <div>
                    <span className="req-status-badge">{req.status.replace(/_/g, ' ')}</span>
                    <strong>{req.specialistName} · {req.specialty}</strong>
                  </div>
                  <div className="req-meta-right">
                    <code>{req.requestCode}</code>
                    <span className="version-pill">Agreement v{req.agreementVersion}</span>
                  </div>
                </header>

                <div className="req-details-grid">
                  <div>
                    <small>Proposed Date &amp; Format</small>
                    <p>{formatLocalDate(req.proposedAt, lang)} · {req.format} ({formatCurrency(req.price, lang)})</p>
                  </div>
                  <div>
                    <small>Plain-Language Purpose</small>
                    <p>{req.purposeLabel}</p>
                  </div>
                  <div>
                    <small>Information-Sharing Scope (v{req.agreementVersion})</small>
                    <p>{req.informationScope}</p>
                  </div>
                  <div>
                    <small>Provider &amp; Guardian Status</small>
                    <p>
                      Provider confirmed: <strong>{req.providerConfirmed ? 'Yes' : 'No (Pending review)'}</strong> ·
                      Guardian authorized: <strong>{req.guardianAuthorized ? 'Yes' : 'Pending'}</strong>
                    </p>
                  </div>
                </div>

                {/* If Adult-Child Invite: Show Child's Separate Invitation Controls + Scope Change Test */}
                {req.bookingType === 'adult_child_invite' && (
                  <div className="child-invite-consent-box">
                    <div className="cic-top">
                      <strong>🧒 Separate Child/Teen Invitation View (Agreement v{req.agreementVersion})</strong>
                      <span className="cic-response-pill">
                        Child response: {req.participantResponse.toUpperCase()}
                      </span>
                    </div>
                    <p>
                      The young person sees who the specialist is, when it is, the plain-language purpose above, and can respond:
                    </p>
                    <div className="cic-buttons">
                      <button
                        type="button"
                        className={`web-primary ${req.participantResponse === 'accepted' ? 'active' : ''}`}
                        disabled={busy}
                        onClick={() => void handleChildResponse(req.id, 'accept')}
                      >
                        ✓ {t(lang, 'specialists.childYes')}
                      </button>
                      <button
                        type="button"
                        className="web-secondary"
                        disabled={busy}
                        onClick={() => void handleChildResponse(req.id, 'more_information')}
                      >
                        ❓ {t(lang, 'specialists.childQuestions')}
                      </button>
                      <button
                        type="button"
                        className="danger-btn"
                        disabled={busy}
                        onClick={() => void handleChildResponse(req.id, 'decline')}
                      >
                        ✕ {t(lang, 'specialists.childNo')}
                      </button>
                    </div>
                    <div className="cic-question-row">
                      <input
                        type="text"
                        value={questionDrafts[req.id] ?? req.participantQuestion ?? ''}
                        onChange={(e) => setQuestionDrafts({ ...questionDrafts, [req.id]: e.target.value })}
                        placeholder="Optional question from the child/teen (e.g. Will my parent be in the room the whole time?)"
                      />
                    </div>

                    {/* Scope Change trigger demonstrating renewed agreement requirement */}
                    <div className="scope-change-bar">
                      <input
                        type="text"
                        value={scopeDrafts[req.id] ?? ''}
                        onChange={(e) => setScopeDrafts({ ...scopeDrafts, [req.id]: e.target.value })}
                        placeholder="Modify information scope or details (resets child agreement to pending)…"
                      />
                      <button
                        type="button"
                        className="web-secondary"
                        disabled={busy}
                        onClick={() => void handleScopeChange(req)}
                      >
                        Update Scope (Requires Renewed Agreement)
                      </button>
                    </div>
                  </div>
                )}

                {/* If Child/Teen Request: Show Guardian Approval & Payment Authorization */}
                {req.bookingType === 'child_guardian_request' && !req.guardianAuthorized && req.status !== 'GUARDIAN_DECLINED' && (
                  <div className="child-invite-consent-box">
                    <strong>🛡️ Parent / Guardian Approval &amp; Payment Authorization</strong>
                    <p>
                      A young person requested this session. A parent or guardian must approve and authorize payment ({formatCurrency(req.price, lang)}) before the request is sent to {req.specialistName}.
                    </p>
                    <div className="cic-buttons">
                      <button
                        type="button"
                        className="web-primary"
                        disabled={busy}
                        onClick={() => void handleGuardianAuth(req.id, 'approve')}
                      >
                        ✓ Approve &amp; Authorize Payment
                      </button>
                      <button
                        type="button"
                        className="danger-btn"
                        disabled={busy}
                        onClick={() => void handleGuardianAuth(req.id, 'decline')}
                      >
                        ✕ Decline Request
                      </button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

