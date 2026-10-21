// Mirrors backend API shapes across all 4 phases.

export type Capability = 'lessons' | 'textPractice' | 'voicePractice' | 'toneFeedback'
export type OffReason = 'not-permitted' | 'needs-grown-up' | 'consent-pending' | 'under-18' | 'off-in-settings'
export type AgeBand = 'under-15' | '15-24' | '25-64' | '65-plus'
export type AgeGroup = 'unsupported' | 'kids' | 'teens' | 'adults'
export type Depth = 'simple' | 'standard' | 'deep'
export type Intent = 'myself' | 'someone-else'
export type PracticeMode = 'talk' | 'practice'
export type SupportTarget = 'child' | 'partner' | 'friend' | 'other'

export interface CapabilityState {
  on: boolean
  reason?: OffReason
}

export interface Preferences {
  captions: boolean
  slowerPace: boolean
  moreVisuals: boolean
  largeText: boolean
  starters: boolean
}

export interface User {
  id: string
  email: string
  displayName: string
}

export type TopicIcon = 'calendar' | 'heart' | 'book' | 'spark'

export interface TopicInfo {
  id: string
  title: string
  summary: string
  icon: TopicIcon
  intents: Intent[]
}

export interface Persona {
  id: string
  name: string
  description: string
}

export interface RawPermission {
  enabled: boolean
  managedBy?: string | null
}

export interface SessionConfig {
  status: 'pass' | 'pending'
  age?: number
  ageGroup?: AgeGroup
  helpLabel?: string
  country?: string
  jurisdiction?: string
  language?: string
  mode?: PracticeMode
  supportTarget?: SupportTarget | null
  supportAge?: number | null
  customGoal?: string | null
  rawPermissions?: Record<string, RawPermission>
  capabilities: Record<Capability, CapabilityState>
  learner: {
    ageBand: AgeBand
    ageGroup?: AgeGroup
    adult: boolean
    depth: Depth
    cardsPerLesson: number
    cardsPerScreen: 1 | 2
    pace: 'guided' | 'self' | 'slow'
  }
  preferences: Preferences
  intent: Intent | null
  topic: string | null
  topicTitle: string | null
  persona: Persona | null
  textSize: 'normal' | 'large'
}

export interface LessonCard {
  conceptId: string
  depth: Depth
  title: string
  body: string
  check?: { question: string; options: string[] }
}

export interface LessonStep {
  cards: LessonCard[]
  index: number
  total: number
  done: boolean
}

export interface FeedbackItem {
  point: string
  quote?: string
}

export interface PhraseSwap {
  instead?: string
  try: string
}

export type SkillName = 'Opening' | 'Listening' | 'Clarity' | 'Questions'
export type SkillLevel = 'Strong' | 'Growing' | 'Try next'

export interface Skill {
  name: SkillName
  level: SkillLevel
  note: string
}

export interface Feedback {
  summary: string
  skills: Skill[]
  strengths: FeedbackItem[]
  improvements: FeedbackItem[]
  missingQuestions: string[]
  suggestedPhrases: PhraseSwap[]
  tone?: string
  turnsPracticed: number
}

export interface ClaimResponse {
  status: 'pass' | 'pending'
  config: SessionConfig
}

export interface CheckResult {
  correct: boolean
  explanation: string
  nextDepth: Depth
}

export interface TextReply {
  reply: string
  turn: number
  done: boolean
  coachPrompt?: string
  safety?: { message: string }
}

export interface CoachReply {
  paused: boolean
  action: 'explain' | 'more_help' | 'retry_moment'
  format: 'text' | 'audio'
  explanation: string
  examplePhrase: string
  caption: string
  turn: number
}

export interface Turn {
  role: 'user' | 'assistant'
  text: string
}

export interface JournalCard {
  id: string
  topic: string
  practicedAt: string
  reflection: string
  usefulPhrase: string
  nextStep: string
  notes: string
  audience: string
  language: string
  createdAt: string
  updatedAt: string
}

export interface JournalCardInput {
  topic: string
  practicedAt?: string
  reflection: string
  usefulPhrase: string
  nextStep: string
  notes?: string
  audience?: string
  language?: string
}

export interface CaregiverInvite {
  id: string
  code: string
  ageGroup: string
  topic: string
  caregiverRole: string
  whatToUnderstand: string
  whatSupportHelps: string
  usefulPhrase: string
  language: string
  status: 'pending' | 'acknowledged' | 'completed' | 'revoked' | 'expired'
  supportActionChosen?: string | null
  alreadyViewed: boolean
  createdAt: string
  updatedAt: string
  expiresAt: string
}

export interface CaregiverLesson {
  lessonTitle: string
  lessonSummary: string
  steps: string[]
  phrasesToTry: string[]
  phrasesToAvoid: string[]
  supportActions: string[]
}

export interface SpecialistSlot {
  startsAt: string
  label: string
}

export interface Specialist {
  id: string
  name: string
  verified: boolean
  credentials: string
  specialty: string
  supportedAges: string[]
  supportedAgeRange: string
  languages: string[]
  formats: string[]
  price: number
  accent: string
  summary: string
  about: string
  nextAvailable: string
  availableSlots: SpecialistSlot[]
}

export interface AppointmentRequest {
  id: string
  requestCode: string
  creatorRole: string
  specialistId: string
  specialistName: string
  specialty: string
  proposedAt: string
  format: string
  price: number
  bookingType: 'adult_self' | 'adult_child_invite' | 'child_guardian_request'
  appointmentType: string
  purposeLabel: string
  informationScope: string
  status: string
  participantResponse: string
  participantQuestion?: string | null
  guardianAuthorized: boolean
  paymentStatus: string
  providerConfirmed: boolean
  agreementVersion: number
  createdAt: string
  updatedAt: string
}
