'use client'

import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react'
import type { CareProviderView } from './CareConnect'
import { createJournalCard, deleteJournalCard, loadJournalCards, updateJournalCard, type JournalCardInput } from './journal-actions'
import { changeRequestInformationScope, createCareRequest, respondToCareRequest, setCareActor } from './care-actions'

type Page = 'home' | 'journal' | 'specialists'
type HomeStep = 'welcome' | 'age' | 'topic' | 'lesson' | 'practice' | 'feedback' | 'journal-draft'
type Audience = 'self' | 'child'
type Topic = 'appointment' | 'symptoms' | 'diagnosis' | 'medication' | 'unsure' | 'other'
type Specialist = CareProviderView & { languages: string; formats: string[]; price: number; next: string; accent: string }
type JournalCardView = JournalCardInput & { id: string; createdAt?: string; updatedAt?: string }
type SupportRequestView = {
  id: string
  requestCode: string
  status: string
  participantResponse: string
  appointmentType: 'child' | 'joint'
  purposeLabel: string
  informationScope?: string | null
  agreementVersion: number
  attendees?: { displayName: string; role: string; response: string }[]
}
type IconName = 'arrow' | 'back' | 'book' | 'calendar' | 'check' | 'chevron' | 'close' | 'edit' | 'heart' | 'home' | 'journal' | 'mic' | 'pause' | 'person' | 'play' | 'search' | 'spark' | 'text' | 'trash' | 'volume'

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    arrow: <><path d="M5 12h14" /><path d="m14 7 5 5-5 5" /></>,
    back: <path d="m15 18-6-6 6-6" />,
    book: <><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H20v16H7.5A3.5 3.5 0 0 0 4 21.5z" /><path d="M4 5.5v16" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" />,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
    journal: <><path d="M5 3h14v18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M8 7h7M8 11h7M8 15h4" /></>,
    mic: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8" /></>,
    pause: <><path d="M9 5v14M15 5v14" /></>,
    person: <><circle cx="12" cy="8" r="4" /><path d="M4 22a8 8 0 0 1 16 0" /></>,
    play: <path d="m8 5 11 7-11 7z" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    spark: <><path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z" /></>,
    text: <><path d="M4 6V3h16v3M12 3v18M8 21h8" /></>,
    trash: <><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7M14 10v7" /></>,
    volume: <><path d="M11 5 6 9H2v6h4l5 4z" /><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function Brand() {
  return <div className="web-brand"><span><i /><i /><i /><i /></span><strong>voicewell</strong></div>
}

const topicOptions: { id: Topic; label: string; description: string }[] = [
  { id: 'appointment', label: 'Prepare for an appointment', description: 'Organize what matters before you go' },
  { id: 'symptoms', label: 'Describe symptoms', description: 'Practice explaining what you’ve noticed' },
  { id: 'diagnosis', label: 'Ask about a diagnosis', description: 'Prepare clear questions without assumptions' },
  { id: 'medication', label: 'Discuss medication', description: 'Talk through questions and concerns' },
  { id: 'unsure', label: 'I’m not sure yet', description: 'Find a useful place to start' },
  { id: 'other', label: 'Something different', description: 'Enter another healthcare topic' },
]

function VoiceOrb({ listening = false }: { listening?: boolean }) {
  return <div className={`web-orb ${listening ? 'listening' : ''}`}><i /><i /><i /><i /><i /></div>
}

const emptyDraft: JournalCardInput = {
  topic: '',
  practicedAt: new Date().toISOString(),
  reflection: '',
  usefulPhrase: '',
  nextStep: '',
  notes: '',
  audience: 'self',
}

export default function VoicewellApp({ providers }: { providers: CareProviderView[] }) {
  const [page, setPage] = useState<Page>('home')
  const [step, setStep] = useState<HomeStep>('welcome')
  const [audience, setAudience] = useState<Audience | null>(null)
  const [age, setAge] = useState<number | null>(null)
  const [region, setRegion] = useState('United Kingdom')
  const [topic, setTopic] = useState<Topic | null>(null)
  const [otherTopic, setOtherTopic] = useState('')
  const [practiceStarted, setPracticeStarted] = useState(false)
  const [listening, setListening] = useState(false)
  const [paused, setPaused] = useState(false)
  const [captions, setCaptions] = useState(true)
  const [practiceTurn, setPracticeTurn] = useState(0)
  const [journalCards, setJournalCards] = useState<JournalCardView[]>([])
  const [journalLoading, setJournalLoading] = useState(true)
  const [journalError, setJournalError] = useState('')
  const [journalDraft, setJournalDraft] = useState<JournalCardInput>(emptyDraft)
  const [editingCard, setEditingCard] = useState<string | null>(null)
  const [savedNotice, setSavedNotice] = useState('')
  const [specialtyFilter, setSpecialtyFilter] = useState('All')
  const [availabilityFilter, setAvailabilityFilter] = useState('Any time')
  const [priceFilter, setPriceFilter] = useState('Any price')
  const [selectedSpecialist, setSelectedSpecialist] = useState<Specialist | null>(null)
  const [selectedSlot, setSelectedSlot] = useState('')
  const [specialistView, setSpecialistView] = useState<'list' | 'detail' | 'review' | 'permission' | 'complete'>('list')
  const [bookingFor, setBookingFor] = useState<'self' | 'child_request'>('self')
  const [supportType, setSupportType] = useState<'child' | 'joint'>('child')
  const [requestPurpose, setRequestPurpose] = useState('I would like us to have support preparing for healthcare conversations.')
  const [informationScope, setInformationScope] = useState('Provider, proposed time, attendees, and a general reason for the appointment')
  const [supportRequest, setSupportRequest] = useState<SupportRequestView | null>(null)
  const [childPreview, setChildPreview] = useState(false)
  const [requestNotice, setRequestNotice] = useState('')
  const [requestError, setRequestError] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      try {
        const cards = await loadJournalCards()
        setJournalCards(cards as unknown as JournalCardView[])
      } catch {
        setJournalError('Your journal could not be loaded. Please try again.')
      } finally {
        setJournalLoading(false)
      }
    })
  }, [])

  const specialists: Specialist[] = useMemo(() => providers.map((provider, index) => ({
    ...provider,
    languages: (provider as CareProviderView & { languages?: string }).languages || ['English', 'Spanish', 'French'][index % 3] + (index === 0 ? ', Spanish' : ''),
    formats: (provider as CareProviderView & { sessionFormat?: string[] }).sessionFormat || (index === 1 ? ['Video', 'In person'] : ['Video', 'Phone']),
    price: (provider as CareProviderView & { price?: number }).price ?? [95, 120, 80][index % 3],
    next: (provider as CareProviderView & { nextAvailableLabel?: string }).nextAvailableLabel || provider.availableSlots[0]?.label || 'Contact for availability',
    accent: ['sage', 'lavender', 'sand'][index % 3],
  })), [providers])

  const filteredSpecialists = specialists.filter((specialist) => {
    const specialtyMatch = specialtyFilter === 'All' || specialist.specialty.includes(specialtyFilter)
    const availabilityMatch = availabilityFilter === 'Any time' || specialist.next.includes(availabilityFilter)
    const priceMatch = priceFilter === 'Any price' || (priceFilter === 'Under £100' ? specialist.price < 100 : specialist.price >= 100)
    return specialtyMatch && availabilityMatch && priceMatch
  })

  const topicLabel = topic === 'other' && otherTopic.trim()
    ? otherTopic.trim()
    : topicOptions.find((item) => item.id === topic)?.label ?? 'Healthcare conversation'
  const isParent = audience === 'child'
  const voiceAllowed = audience === 'self' ? (age ?? 0) >= 18 : true
  const prompt = isParent
    ? age !== null && age < 12
      ? 'Help me explain what my child has been experiencing in simple, clear language.'
      : 'Help me support my child while making room for them to speak.'
    : topic === 'symptoms'
      ? 'Help me describe when this started and how it affects daily life.'
      : 'Help me organize the most important thing I want to say.'

  const navigate = (next: Page) => {
    setPage(next)
    if (next === 'specialists') setSpecialistView('list')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const beginAudience = (next: Audience) => {
    setAudience(next)
    setAge(3)
    setTopic(null)
    setStep('age')
  }

  const startPractice = () => {
    setPracticeStarted(true)
    setListening(false)
    setPaused(false)
    setPracticeTurn(0)
  }

  const finishPractice = () => {
    setPracticeStarted(false)
    setStep('feedback')
    setJournalDraft({
      topic: topicLabel,
      practicedAt: new Date().toISOString(),
      reflection: isParent
        ? 'I practiced describing what I have noticed while keeping my child’s perspective at the center.'
        : 'I practiced leading with the change that matters most and asking a clear follow-up question.',
      usefulPhrase: isParent
        ? '“I can share what I’ve noticed, and I’d also like my child to explain it in their own words.”'
        : '“The main change I’ve noticed is…, and it has affected me by…”',
      nextStep: 'Write down the one question I most want answered.',
      notes: '',
      audience: isParent ? 'parent_support' : 'self',
    })
  }

  const saveJournal = () => {
    setJournalError('')
    startTransition(async () => {
      try {
        const card = editingCard
          ? await updateJournalCard(editingCard, journalDraft)
          : await createJournalCard(journalDraft)
        const next = card as unknown as JournalCardView
        setJournalCards((current) => [next, ...current.filter((item) => item.id !== next.id)])
        setEditingCard(null)
        setSavedNotice('Saved to My Journal')
        setPage('journal')
        setStep('welcome')
      } catch (error) {
        setJournalError(error instanceof Error ? error.message : 'The card could not be saved.')
      }
    })
  }

  const openCard = (card: JournalCardView) => {
    setEditingCard(card.id)
    setJournalDraft(card)
  }

  const removeCard = (id: string) => {
    setJournalError('')
    startTransition(async () => {
      try {
        await deleteJournalCard(id)
        setJournalCards((current) => current.filter((item) => item.id !== id))
        if (editingCard === id) setEditingCard(null)
      } catch {
        setJournalError('The card could not be deleted.')
      }
    })
  }

  const openSpecialist = (specialist: Specialist, intent: 'self' | 'child_request' = bookingFor) => {
    setSelectedSpecialist(specialist)
    setSelectedSlot(specialist.availableSlots[0]?.startsAt ?? '')
    setBookingFor(intent)
    setSpecialistView('detail')
  }

  const sendSupportRequest = () => {
    if (!selectedSpecialist || !selectedSlot) return
    setRequestError('')
    setRequestNotice('')
    startTransition(async () => {
      try {
        await setCareActor('parent')
        const result = await createCareRequest({
          appointmentType: supportType,
          providerId: selectedSpecialist.id,
          proposedAt: selectedSlot,
          purposeLabel: requestPurpose,
          payer: 'parent',
          informationScope,
        })
        setSupportRequest(result.request as unknown as SupportRequestView)
        setSpecialistView('permission')
      } catch (error) {
        setRequestError(error instanceof Error ? error.message : 'The permission request could not be sent.')
      }
    })
  }

  const previewInvitation = () => {
    startTransition(async () => {
      await setCareActor('child')
      setChildPreview(true)
      setRequestNotice('')
    })
  }

  const returnToParent = () => {
    startTransition(async () => {
      await setCareActor('parent')
      setChildPreview(false)
    })
  }

  const respondAsChild = (response: 'accept' | 'decline' | 'more_information') => {
    if (!supportRequest) return
    setRequestError('')
    startTransition(async () => {
      try {
        const result = await respondToCareRequest(supportRequest.id, response)
        setSupportRequest(result.request as unknown as SupportRequestView)
        setRequestNotice(response === 'accept' ? 'Your response has been shared.' : response === 'decline' ? 'That’s okay. The proposal has been declined without sharing a private reason.' : 'Your question has been shared with the parent.')
      } catch (error) {
        setRequestError(error instanceof Error ? error.message : 'Your response could not be saved.')
      }
    })
  }

  const changeSharingScope = () => {
    if (!supportRequest) return
    setRequestError('')
    startTransition(async () => {
      try {
        await setCareActor('parent')
        const nextScope = 'Provider, proposed time, attendees, general reason, and a parent-written appointment summary'
        const result = await changeRequestInformationScope(supportRequest.id, nextScope)
        setInformationScope(nextScope)
        setSupportRequest(result.request as unknown as SupportRequestView)
        setRequestNotice(result.message)
      } catch (error) {
        setRequestError(error instanceof Error ? error.message : 'The proposal could not be changed.')
      }
    })
  }

  const resetHome = () => {
    setStep('welcome')
    setAudience(null)
    setAge(null)
    setTopic(null)
    setPracticeStarted(false)
    navigate('home')
  }

  return (
    <div className="web-app">
      <header className="web-header">
        <button className="brand-button" onClick={resetHome}><Brand /></button>
        <nav aria-label="Primary navigation">
          <button className={page === 'home' ? 'active' : ''} onClick={() => navigate('home')}><Icon name="home" /> Home</button>
          <button className={page === 'journal' ? 'active' : ''} onClick={() => navigate('journal')}><Icon name="journal" /> My Journal{journalCards.length > 0 && <b>{journalCards.length}</b>}</button>
          <button className={page === 'specialists' ? 'active' : ''} onClick={() => navigate('specialists')}><Icon name="search" /> Specialists</button>
        </nav>
        <div className="web-profile"><span>{audience === 'child' ? 'P' : 'M'}</span><div><strong>{audience === 'child' ? 'Parent space' : 'My space'}</strong><small>{age !== null ? `Age ${age} · ${region}` : 'Set up your practice'}</small></div></div>
      </header>

      {page === 'home' && (
        <main className="web-main">
          {step === 'welcome' && <section className="welcome-web">
            <div className="welcome-copy"><span className="web-kicker"><Icon name="spark" size={16} /> Practice before it matters</span><h1>Find the words for your next healthcare conversation.</h1><p>Voicewell helps you organize what you want to say, rehearse questions, and arrive feeling more prepared.</p><div className="trust-row"><span><Icon name="check" /> Private practice</span><span><Icon name="check" /> No diagnosis</span><span><Icon name="check" /> Your pace</span></div></div>
            <div className="welcome-art"><VoiceOrb /><div className="float-card float-one"><Icon name="heart" /><span><small>Warm support</small><strong>No judgment, no score</strong></span></div><div className="float-card float-two"><Icon name="mic" /><span><small>Practice out loud</small><strong>Say it your way</strong></span></div></div>
            <div className="intent-section"><div><span className="web-kicker">Choose your starting point</span><h2>Who are you preparing for?</h2></div><div className="intent-grid"><button onClick={() => beginAudience('self')}><span className="intent-icon sage"><Icon name="person" size={31} /></span><Icon name="arrow" /><div><small>For me</small><strong>Myself</strong><p>Practice for my own healthcare conversation.</p></div></button><button onClick={() => beginAudience('child')}><span className="intent-icon lavender"><Icon name="heart" size={31} /></span><Icon name="arrow" /><div><small>For my family</small><strong>My child</strong><p>Understand and support my child without entering their private journal.</p><b className="together-feature"><Icon name="person" size={14} /> Request support together</b></div></button></div></div>
          </section>}

          {step === 'age' && audience && <section className="flow-shell"><FlowHeader current={1} title={isParent ? 'How old is your child?' : 'How old are you?'} copy="Select the actual age. Voicewell uses it to adjust language, examples, and available practice tools." onBack={() => setStep('welcome')} />
            <AgeRoller value={age ?? 3} onChange={setAge} subject={isParent ? 'Your child' : 'You'} />
            <div className="region-row"><label><span>Country or region</span><select value={region} onChange={(event) => setRegion(event.target.value)}><option>United Kingdom</option><option>United States</option><option>Canada</option><option>Australia</option></select></label><div><Icon name="check" /><span><strong>Demo permission check ready</strong><small>Age and region guide platform features. They do not determine healthcare consent.</small></span></div></div>
            <button className="web-primary flow-next" disabled={age === null} onClick={() => setStep('topic')}>Continue <Icon name="arrow" /></button>
          </section>}

          {step === 'topic' && <section className="flow-shell"><FlowHeader current={2} title="What would you like to practice?" copy={`Choose a useful starting point for ${isParent ? `supporting your ${age}-year-old child` : 'your conversation'}.`} onBack={() => setStep('age')} />
            <div className="topic-grid">{topicOptions.map((item) => <button key={item.id} className={topic === item.id ? 'selected' : ''} onClick={() => setTopic(item.id)}><span>{topic === item.id ? <Icon name="check" /> : <Icon name={item.id === 'appointment' ? 'calendar' : item.id === 'symptoms' ? 'heart' : item.id === 'medication' ? 'book' : 'spark'} />}</span><strong>{item.label}</strong><p>{item.description}</p></button>)}</div>
            {topic === 'other' && <label className="other-topic"><span>Your practice topic</span><input value={otherTopic} onChange={(event) => setOtherTopic(event.target.value)} placeholder="For example, asking for a second opinion" /></label>}
            <button className="web-primary flow-next" disabled={!topic || (topic === 'other' && !otherTopic.trim())} onClick={() => setStep('lesson')}>Build my practice <Icon name="arrow" /></button>
          </section>}

          {step === 'lesson' && <section className="lesson-web"><button className="text-back" onClick={() => setStep('topic')}><Icon name="back" /> Change topic</button><div className="lesson-heading"><span className="web-kicker">A two-minute warm-up</span><h1>Make the conversation easier to follow.</h1><p>You don’t need perfect words. A simple structure can help you share what matters.</p></div><div className="lesson-cards"><article><span>01</span><div><strong>Start with the main change</strong><p>{isParent ? 'Share what you have observed without deciding what it means.' : 'Name the change that brought you to the appointment.'}</p></div></article><article><span>02</span><div><strong>Add useful context</strong><p>When did it start? What makes it better or harder? How does it affect everyday life?</p></div></article><article><span>03</span><div><strong>End with your question</strong><p>Ask what information is needed, what options exist, and what happens next.</p></div></article></div><div className="lesson-callout"><Icon name="heart" /><span><strong>{isParent ? 'Keep your child’s voice in the room' : 'You are allowed to pause'}</strong><p>{isParent ? 'Your observations can help, while your child’s own experience remains theirs to share.' : 'It is okay to check notes, ask for simpler language, or take a moment to think.'}</p></span></div><button className="web-primary" onClick={() => setStep('practice')}>Continue to practice <Icon name="mic" /></button></section>}

          {step === 'practice' && <section className="practice-web"><div className="practice-copy"><button className="text-back" onClick={() => setStep('lesson')}><Icon name="back" /> Warm-up</button><span className="web-kicker">Personalized practice</span><h1>Practice saying it out loud.</h1><p>Voicewell will ask follow-up questions to help organize your thoughts. It will not diagnose or act as a clinician.</p><div className="permission-note"><Icon name="check" /><span><strong>{voiceAllowed ? 'Voice and text practice available' : 'Supported text practice available'}</strong><small>Simulated platform permission · {region}</small></span></div><div className="prompt-panel"><span>Suggested starting prompt</span><blockquote>“{prompt}”</blockquote><button onClick={startPractice}><Icon name="play" /> Use this prompt</button></div></div><div className={`practice-stage ${practiceStarted ? 'active' : ''}`}><div className="stage-top"><span><i /> Scripted demonstration</span><button onClick={() => setCaptions(!captions)}><Icon name="volume" /> Captions {captions ? 'on' : 'off'}</button></div><VoiceOrb listening={listening && !paused} /><span className="agent-name">Voicewell practice coach</span>{!practiceStarted ? <><h2>Ready when you are</h2><p>Start freely, or use the suggested prompt.</p><button className="stage-start" onClick={startPractice}><Icon name={voiceAllowed ? 'mic' : 'text'} /> Start {voiceAllowed ? 'voice' : 'text'} practice</button></> : <><div className="practice-caption"><small>{paused ? 'Paused' : listening ? 'Listening…' : practiceTurn === 0 ? 'Voicewell' : practiceTurn === 1 ? 'You' : 'Voicewell'}</small><p>{!captions ? 'Captions are turned off.' : paused ? 'Practice is paused. Resume whenever you are ready.' : listening ? '“I’m thinking about how I want to explain it…”' : practiceTurn === 0 ? `“Let’s practice. ${prompt} What feels most important to communicate?”` : practiceTurn === 1 ? isParent ? '“I want to explain what I’ve noticed, but leave room for my child to speak too.”' : '“The biggest change is that it has started affecting my usual routine.”' : '“That’s clear. When did you first notice the change, and what question would you most like answered?”'}</p></div><div className={`web-wave ${listening && !paused ? 'listening' : ''}`}>{Array.from({ length: 35 }).map((_, index) => <i key={index} style={{ height: `${14 + (index * 17) % 53}%`, animationDelay: `${index * -.04}s` }} />)}</div><button disabled={paused} className={`web-mic ${listening ? 'listening' : ''}`} onClick={() => { if (!listening) setListening(true); else { setListening(false); setPracticeTurn((current) => Math.min(2, current + 1)) } }}><Icon name={listening ? 'pause' : voiceAllowed ? 'mic' : 'text'} size={28} /></button><small className="mic-help">{paused ? 'Resume to continue' : listening ? 'Tap when finished' : 'Tap to respond'}</small><div className="practice-controls"><button onClick={() => { setPaused(!paused); setListening(false) }}><Icon name={paused ? 'play' : 'pause'} /> {paused ? 'Resume' : 'Pause'}</button><button onClick={finishPractice}><Icon name="check" /> End & reflect</button></div></>}</div></section>}

          {step === 'feedback' && <section className="feedback-web"><div className="feedback-hero"><span><Icon name="check" size={28} /></span><small>Practice complete</small><h1>You created a clear starting point.</h1><p>This is feedback on communication choices—not a score or medical assessment.</p></div><div className="feedback-grid"><article><span><Icon name="check" /></span><div><small>You led with what matters</small><strong>{isParent ? 'You described an observation without speaking for your child.' : 'You identified the main change before adding detail.'}</strong></div></article><article><span><Icon name="check" /></span><div><small>You added context</small><strong>You practiced explaining timing and everyday impact.</strong></div></article><article className="try-next"><span><Icon name="spark" /></span><div><small>Try next</small><strong>Pause after your main question and give yourself time to listen.</strong></div></article></div><div className="next-step-heading"><span className="web-kicker">Optional next steps</span><h2>What would help now?</h2></div><div className="next-actions"><button onClick={() => setStep('journal-draft')}><span className="intent-icon lavender"><Icon name="journal" /></span><div><small>Keep a short reflection</small><strong>Create a journal card</strong><p>Preview and edit it before anything is saved.</p></div><Icon name="arrow" /></button><button onClick={() => { setBookingFor('self'); navigate('specialists') }}><span className="intent-icon sage"><Icon name="calendar" /></span><div><small>Browse sample providers</small><strong>Book an appointment for myself</strong><p>Explore demo availability. No real appointment will be scheduled.</p></div><Icon name="arrow" /></button></div><button className="feedback-retry" onClick={() => setStep('practice')}><Icon name="play" /> Practice this topic again</button></section>}

          {step === 'journal-draft' && <JournalEditor title="Preview your journal card" draft={journalDraft} setDraft={setJournalDraft} pending={isPending} error={journalError} onCancel={() => setStep('feedback')} onSave={saveJournal} saveLabel="Save to My Journal" />}
        </main>
      )}

      {page === 'journal' && <main className="web-main journal-page"><div className="page-heading"><span className="web-kicker">Private reflections</span><h1>My Journal</h1><p>Short practice takeaways—not full conversation transcripts. Parent reflections remain separate from a child’s private journal.</p></div>{savedNotice && <div className="success-banner"><Icon name="check" /> {savedNotice}<button onClick={() => setSavedNotice('')}><Icon name="close" /></button></div>}{journalError && <div className="error-banner">{journalError}</div>}{journalLoading ? <div className="loading-grid"><i /><i /><i /></div> : journalCards.length === 0 ? <div className="journal-empty"><span><Icon name="journal" size={30} /></span><h2>Your journal is ready when you are.</h2><p>After a practice, you can choose to save a short card here.</p><button className="web-primary" onClick={resetHome}>Start a practice <Icon name="arrow" /></button></div> : <div className="journal-layout"><div className="journal-list">{journalCards.map((card) => <article key={card.id} className={editingCard === card.id ? 'selected' : ''} onClick={() => openCard(card)}><div><span>{card.audience === 'parent_support' ? 'Parent reflection' : 'My practice'}</span><small>{new Date(card.practicedAt).toLocaleDateString([], { dateStyle: 'medium' })}</small></div><h2>{card.topic}</h2><p>{card.reflection}</p><div><button onClick={(event) => { event.stopPropagation(); openCard(card) }}><Icon name="edit" /> Edit</button><button onClick={(event) => { event.stopPropagation(); removeCard(card.id) }} disabled={isPending}><Icon name="trash" /> Delete</button></div></article>)}</div><aside>{editingCard ? <JournalEditor title="Edit journal card" draft={journalDraft} setDraft={setJournalDraft} pending={isPending} error="" compact onCancel={() => setEditingCard(null)} onSave={saveJournal} saveLabel="Save changes" /> : <div className="journal-preview-empty"><Icon name="journal" size={28} /><strong>Open a card to edit it</strong><small>Your notes can be changed or deleted at any time.</small></div>}</aside></div>}</main>}

      {page === 'specialists' && <main className="web-main specialists-page">
        {specialistView === 'list' && <><div className="page-heading specialist-heading"><span className="web-kicker">Sample specialists</span><h1>Find someone who fits.</h1><p>Browse demonstration profiles and availability. No provider is contacted and no real appointment is scheduled.</p></div><div className="demo-banner"><Icon name="spark" /><span><strong>Demo directory</strong> All profiles, prices, and appointment times are samples.</span></div><div className="filter-bar"><label><span>Specialty</span><select value={specialtyFilter} onChange={(event) => setSpecialtyFilter(event.target.value)}><option>All</option>{[...new Set(specialists.map((item) => item.specialty))].map((value) => <option key={value}>{value}</option>)}</select></label><label><span>Availability</span><select value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value)}><option>Any time</option><option>Tuesday</option><option>Wednesday</option><option>Friday</option></select></label><label><span>Price</span><select value={priceFilter} onChange={(event) => setPriceFilter(event.target.value)}><option>Any price</option><option>Under £100</option><option>£100 and over</option></select></label><button onClick={() => { setSpecialtyFilter('All'); setAvailabilityFilter('Any time'); setPriceFilter('Any price') }}>Clear filters</button></div>{filteredSpecialists.length === 0 ? <div className="specialist-empty"><Icon name="search" size={30} /><h2>No sample specialists match.</h2><button onClick={() => { setSpecialtyFilter('All'); setAvailabilityFilter('Any time'); setPriceFilter('Any price') }}>Reset filters</button></div> : <div className="specialist-grid">{filteredSpecialists.map((specialist) => <article key={specialist.id}><div className={`specialist-photo ${specialist.accent}`}><span>{specialist.name.split(' ').map((part) => part[0]).slice(0,2).join('')}</span><b>Sample profile</b></div><div className="specialist-body"><small>{specialist.specialty}</small><h2>{specialist.name}</h2><p>{specialist.summary}</p><dl><div><dt>Languages</dt><dd>{specialist.languages}</dd></div><div><dt>Format</dt><dd>{specialist.formats.join(' · ')}</dd></div><div><dt>Price</dt><dd>£{specialist.price} / session</dd></div></dl><div className="availability"><Icon name="calendar" /><span><small>Next available</small><strong>{specialist.next}</strong></span></div><button onClick={() => openSpecialist(specialist)}>View profile <Icon name="arrow" /></button></div></article>)}</div>}</>}

        {specialistView === 'detail' && selectedSpecialist && <section className="specialist-detail"><button className="text-back" onClick={() => setSpecialistView('list')}><Icon name="back" /> All specialists</button><div className="detail-grid"><div><div className={`detail-photo ${selectedSpecialist.accent}`}>{selectedSpecialist.name.split(' ').map((part) => part[0]).slice(0,2).join('')}<span>Sample specialist</span></div><div className="detail-copy"><span className="web-kicker">{selectedSpecialist.specialty}</span><h1>{selectedSpecialist.name}</h1><p>{selectedSpecialist.summary}</p><div className="detail-facts"><span><b>Languages</b>{selectedSpecialist.languages}</span><span><b>Session format</b>{selectedSpecialist.formats.join(', ')}</span><span><b>Demo price</b>£{selectedSpecialist.price} per session</span></div><h3>About this sample specialist</h3><p>Uses clear, collaborative conversation to help people prepare questions and discuss next steps with confidence.</p></div></div><aside className="booking-panel"><span>Choose a sample time</span><h2>Availability</h2><div className="slot-list">{selectedSpecialist.availableSlots.map((slot) => <button key={slot.startsAt} className={selectedSlot === slot.startsAt ? 'selected' : ''} onClick={() => setSelectedSlot(slot.startsAt)}><Icon name="calendar" /><span><strong>{slot.label}</strong><small>{new Date(slot.startsAt).toLocaleDateString([], { dateStyle: 'medium' })}</small></span>{selectedSlot === slot.startsAt && <Icon name="check" />}</button>)}</div><div className="booking-for"><span>Appointment for</span><button className={bookingFor === 'self' ? 'selected' : ''} onClick={() => setBookingFor('self')}>Myself</button>{audience === 'child' && <button className={bookingFor === 'child_request' ? 'selected' : ''} onClick={() => setBookingFor('child_request')}>Request support together</button>}</div>{bookingFor === 'child_request' && <div className="support-request-fields"><div className="session-type"><span>Who would attend?</span><button className={supportType === 'child' ? 'selected' : ''} onClick={() => setSupportType('child')}>My child and specialist</button><button className={supportType === 'joint' ? 'selected' : ''} onClick={() => setSupportType('joint')}>Parent, child, and specialist</button></div><label><span>Why are you suggesting support?</span><textarea value={requestPurpose} onChange={(event) => setRequestPurpose(event.target.value)} rows={3} /></label><label><span>What information would be shared?</span><select value={informationScope} onChange={(event) => setInformationScope(event.target.value)}><option>Provider, proposed time, attendees, and a general reason for the appointment</option><option>Provider, proposed time, attendees, general reason, and a parent-written appointment summary</option></select></label><div className="permission-warning"><Icon name="heart" /><p>This sends a permission request only. No response is treated as permission, and no booking or charge can occur before acceptance and any additional required consent.</p></div></div>}<button className="web-primary" disabled={!selectedSlot || (bookingFor === 'child_request' && !requestPurpose.trim())} onClick={() => setSpecialistView('review')}>Review {bookingFor === 'self' ? 'demo booking' : 'permission request'} <Icon name="arrow" /></button></aside></div></section>}

        {specialistView === 'review' && selectedSpecialist && <section className="booking-review"><button className="text-back" onClick={() => setSpecialistView('detail')}><Icon name="back" /> Change details</button><div className="review-heading"><span className="web-kicker">Review</span><h1>{bookingFor === 'self' ? 'Check your demo booking.' : 'Check the permission request.'}</h1><p>{bookingFor === 'self' ? 'Nothing has been sent or charged.' : 'Your child will see exactly these coordination details before choosing how to respond.'}</p></div><div className="review-card"><div><span className={`mini-avatar ${selectedSpecialist.accent}`}>{selectedSpecialist.name.slice(0,1)}</span><div><strong>{selectedSpecialist.name}</strong><small>{selectedSpecialist.specialty}</small></div></div><dl><div><dt>Date and time</dt><dd>{new Date(selectedSlot).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}</dd></div><div><dt>Who would attend</dt><dd>{bookingFor === 'self' ? 'You and the specialist' : supportType === 'joint' ? 'Parent, child, and specialist' : 'Child and specialist'}</dd></div>{bookingFor === 'child_request' && <><div><dt>Why support is suggested</dt><dd>{requestPurpose}</dd></div><div><dt>Information shared</dt><dd>{informationScope}</dd></div></>}<div><dt>{bookingFor === 'self' ? 'Demo total' : 'Expected payer'}</dt><dd>£{selectedSpecialist.price}</dd></div><div><dt>Private journal and practice access</dt><dd>Never shared</dd></div></dl><label><input type="checkbox" defaultChecked /> <span>I understand this is a demonstration and no real appointment will be scheduled.</span></label></div>{bookingFor === 'child_request' && <div className="approval-preview"><span><Icon name="check" /> Parent creates one appointment-specific request</span><span><i>2</i> Child chooses: comfortable, questions, or not right now</span><span><i>3</i> Additional legal consent and payment remain separate</span></div>}{requestError && <div className="error-banner">{requestError}</div>}<button className="web-primary review-submit" disabled={isPending} onClick={() => bookingFor === 'self' ? setSpecialistView('complete') : sendSupportRequest()}>{isPending ? 'Sending…' : bookingFor === 'self' ? 'Complete demo booking' : 'Send permission request'} <Icon name="arrow" /></button></section>}

        {specialistView === 'permission' && selectedSpecialist && supportRequest && (childPreview ? <section className={`child-invitation ${age !== null && age < 12 ? 'younger' : ''}`}><div className="invitation-demo-label"><Icon name="spark" /> Preview child’s invitation · Demo view</div><button className="text-back" onClick={returnToParent}><Icon name="back" /> Return to parent status</button><div className="invitation-shell"><div className="invitation-hero"><span className={`mini-avatar ${selectedSpecialist.accent}`}>{selectedSpecialist.name.slice(0,1)}</span><small>{age !== null && age < 12 ? 'Someone wants to ask you first' : 'You have an appointment invitation'}</small><h1>{age !== null && age < 12 ? 'Would this feel okay to you?' : 'You get a say before anything is booked.'}</h1><p>{age !== null && age < 12 ? 'Your parent is suggesting a conversation with a health support person. You can say yes, ask something, or say not now.' : 'Review the proposal below. No response is treated as permission, and declining is completely okay.'}</p></div><div className="invitation-details"><div><dt>Who is the specialist?</dt><dd><strong>{selectedSpecialist.name}</strong><span>{selectedSpecialist.specialty}</span></dd></div><div><dt>Why is support suggested?</dt><dd>{supportRequest.purposeLabel}</dd></div><div><dt>Who would attend?</dt><dd>{supportType === 'joint' ? 'You, your parent, and the specialist' : 'You and the specialist'}</dd></div><div><dt>What would be shared?</dt><dd>{supportRequest.informationScope || informationScope}<small>Your private Voicewell journal and practice conversations are never included.</small></dd></div></div>{requestNotice && <div className="success-banner"><Icon name="check" /> {requestNotice}</div>}{requestError && <div className="error-banner">{requestError}</div>} {supportRequest.status === 'PENDING_PARTICIPANT_RESPONSE' && <div className="child-response-actions"><button className="comfortable" disabled={isPending} onClick={() => respondAsChild('accept')}><Icon name="check" /><span><strong>Yes, I’m comfortable</strong><small>This only agrees to this proposal</small></span></button><button disabled={isPending} onClick={() => respondAsChild('more_information')}><Icon name="spark" /><span><strong>I have questions</strong><small>Ask for more details first</small></span></button><button disabled={isPending} onClick={() => respondAsChild('decline')}><Icon name="close" /><span><strong>Not right now</strong><small>It is okay to say no</small></span></button></div>}<p className="decline-note"><Icon name="heart" /> You will not be in trouble for declining. A private reason is not sent to the parent.</p></div></section> : <section className="permission-status-page"><button className="text-back" onClick={() => setSpecialistView('list')}><Icon name="back" /> Specialists</button><div className="status-header"><span className={`request-status status-${supportRequest.status.toLowerCase()}`}>{supportRequest.status === 'PARTICIPANT_AGREED' ? 'Accepted' : supportRequest.status === 'DECLINED' ? 'Declined' : supportRequest.participantResponse === 'more_information' ? 'Questions to discuss' : 'Awaiting response'}</span><h1>Permission request sent.</h1><p>This proposal is for one appointment only. It does not grant access to your child’s private journal or practice conversations.</p></div>{requestNotice && <div className="success-banner"><Icon name="check" /> {requestNotice}</div>}{requestError && <div className="error-banner">{requestError}</div>}<div className="permission-status-grid"><div className="request-summary-card"><div><span className={`mini-avatar ${selectedSpecialist.accent}`}>{selectedSpecialist.name.slice(0,1)}</span><span><strong>{selectedSpecialist.name}</strong><small>{selectedSpecialist.specialty}</small></span></div><dl><div><dt>Proposed time</dt><dd>{new Date(selectedSlot).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</dd></div><div><dt>Session</dt><dd>{supportType === 'joint' ? 'Joint parent-child' : 'Child individual'}</dd></div><div><dt>Sharing scope</dt><dd>{supportRequest.informationScope || informationScope}</dd></div><div><dt>Agreement version</dt><dd>{supportRequest.agreementVersion}</dd></div></dl><button className="scope-change" onClick={changeSharingScope} disabled={isPending || supportRequest.status !== 'PARTICIPANT_AGREED'}><Icon name="edit" /> Change what is shared <small>Asks again</small></button></div><aside className="invitation-share"><span className="web-kicker">Demo invitation</span><h2>Let your child review it privately.</h2><div className="qr-code" aria-label="Demonstration QR code">{Array.from({ length: 49 }).map((_, index) => <i key={index} className={(index * 7 + index % 3) % 5 < 2 ? 'filled' : ''} />)}</div><button onClick={() => setRequestNotice('Demo invitation link copied.')}>Copy invitation link</button><button className="preview-button" onClick={previewInvitation}>Preview child’s invitation <Icon name="arrow" /></button><small>For judging only: this opens the child side in the same browser.</small></aside></div><div className="unlock-panel"><div><span className={supportRequest.status === 'PARTICIPANT_AGREED' ? 'done' : ''}>{supportRequest.status === 'PARTICIPANT_AGREED' ? <Icon name="check" /> : '1'}</span><p><strong>Child response</strong><small>{supportRequest.status === 'PARTICIPANT_AGREED' ? 'Accepted for this proposal' : supportRequest.status === 'DECLINED' ? 'Declined—booking remains locked' : supportRequest.participantResponse === 'more_information' ? 'Questions need discussion' : 'No response yet'}</small></p></div><div><span>2</span><p><strong>Additional consent</strong><small>Checked separately where required</small></p></div><div><span>3</span><p><strong>Payment and provider confirmation</strong><small>Not started and never assumed</small></p></div><button className="web-primary" disabled={supportRequest.status !== 'PARTICIPANT_AGREED'} onClick={() => setSpecialistView('complete')}>Continue to consent and booking <Icon name="arrow" /></button></div></section>)}

        {specialistView === 'complete' && selectedSpecialist && <section className="booking-complete"><span><Icon name="check" size={31} /></span><small>{bookingFor === 'self' ? 'Demo flow complete' : 'Participant accepted'}</small><h1>{bookingFor === 'self' ? 'You completed the booking demonstration.' : 'The next consent step is now unlocked.'}</h1><p>{bookingFor === 'self' ? 'No real provider was contacted, no payment was taken, and no appointment was scheduled.' : 'Acceptance applies only to this proposal. This is still not an appointment: applicable healthcare consent, eligibility, payment approval, and real provider confirmation remain separate.'}</p><div className="complete-summary"><strong>{selectedSpecialist.name}</strong><span>{new Date(selectedSlot).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span><span>{selectedSpecialist.formats[0]} · £{selectedSpecialist.price} demo price</span></div><button className="web-primary" onClick={resetHome}>Return home <Icon name="arrow" /></button><button className="web-secondary" onClick={() => setSpecialistView('list')}>Browse other specialists</button></section>}
      </main>}

      <footer className="web-footer"><Brand /><p>Conversation practice—not diagnosis or medical advice.</p><span>Demo experience · No real appointments</span></footer>
    </div>
  )
}

function FlowHeader({ current, title, copy, onBack }: { current: number; title: string; copy: string; onBack: () => void }) {
  return <><button className="text-back" onClick={onBack}><Icon name="back" /> Back</button><div className="flow-progress"><span>Step {current} of 3</span><div><i className="done" /><i className={current >= 2 ? 'done' : ''} /><i className={current >= 3 ? 'done' : ''} /></div></div><div className="flow-heading"><h1>{title}</h1><p>{copy}</p></div></>
}

function AgeRoller({ value, onChange, subject }: { value: number; onChange: (age: number) => void; subject: string }) {
  const clamp = (next: number) => Math.min(100, Math.max(3, next))
  const change = (next: number) => onChange(clamp(next))
  const visible = [-2, -1, 0, 1, 2].map((offset) => {
    const age = value + offset
    return age >= 3 && age <= 100 ? age : null
  })

  return <div className="age-roller-card">
    <div className="roller-intro"><span className="web-kicker">Age roller</span><h2>{subject} {subject === 'You' ? 'are' : 'is'} <strong>{value === 100 ? '100+' : value}</strong></h2><p>Scroll, use the arrow keys, or drag the slider.</p></div>
    <div className="roller-control">
      <button aria-label="Decrease age" onClick={() => change(value - 1)} disabled={value <= 3}><Icon name="chevron" /></button>
      <div
        className="number-wheel"
        role="slider"
        aria-label="Age"
        aria-valuemin={3}
        aria-valuemax={100}
        aria-valuenow={value}
        tabIndex={0}
        onWheel={(event) => change(value + (event.deltaY > 0 ? 1 : -1))}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') change(value - 1)
          if (event.key === 'ArrowDown' || event.key === 'ArrowRight') change(value + 1)
          if (event.key === 'Home') change(3)
          if (event.key === 'End') change(100)
        }}
      >
        <i className="wheel-highlight" />
        {visible.map((age, index) => <button key={`${age}-${index}`} className={index === 2 ? 'selected' : ''} disabled={age === null} onClick={() => age && change(age)}>{age === null ? '' : age === 100 ? '100+' : age}</button>)}
      </div>
      <button aria-label="Increase age" onClick={() => change(value + 1)} disabled={value >= 100}><Icon name="chevron" /></button>
    </div>
    <div className="roller-range"><span>3</span><input aria-label="Age slider" type="range" min="3" max="100" value={value} onChange={(event) => change(Number(event.target.value))} /><span>100+</span></div>
  </div>
}

function JournalEditor({ title, draft, setDraft, pending, error, onCancel, onSave, saveLabel, compact = false }: { title: string; draft: JournalCardInput; setDraft: (next: JournalCardInput) => void; pending: boolean; error: string; onCancel: () => void; onSave: () => void; saveLabel: string; compact?: boolean }) {
  const field = (key: keyof JournalCardInput, value: string) => setDraft({ ...draft, [key]: value })
  return <section className={`journal-editor ${compact ? 'compact' : ''}`}><button className="text-back" onClick={onCancel}><Icon name="back" /> {compact ? 'Close editor' : 'Feedback'}</button><div className="editor-heading"><span className="web-kicker">Nothing saves automatically</span><h1>{title}</h1><p>Edit this short reflection, then explicitly save it. The full conversation transcript is never included.</p></div>{error && <div className="error-banner">{error}</div>}<div className="journal-card-preview"><div className="journal-date"><label><span>Topic</span><input value={draft.topic} onChange={(event) => field('topic', event.target.value)} /></label><label><span>Date</span><input type="date" value={draft.practicedAt.slice(0,10)} onChange={(event) => field('practicedAt', new Date(`${event.target.value}T12:00:00`).toISOString())} /></label></div><label><span>Short reflection</span><textarea value={draft.reflection} onChange={(event) => field('reflection', event.target.value)} rows={3} /></label><label className="phrase-field"><span>Useful phrase to remember</span><textarea value={draft.usefulPhrase} onChange={(event) => field('usefulPhrase', event.target.value)} rows={2} /></label><label><span>One suggested next step</span><input value={draft.nextStep} onChange={(event) => field('nextStep', event.target.value)} /></label><label><span>My own notes <small>Optional</small></span><textarea value={draft.notes} onChange={(event) => field('notes', event.target.value)} rows={4} placeholder="Add anything you want to remember…" /></label></div><div className="editor-actions"><button className="web-secondary" onClick={onCancel}>Cancel</button><button className="web-primary" onClick={onSave} disabled={pending}>{pending ? 'Saving…' : saveLabel} <Icon name="check" /></button></div></section>
}
