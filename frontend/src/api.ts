import { navigate } from './router'
import type {
  AppointmentRequest,
  CaregiverInvite,
  CaregiverLesson,
  CheckResult,
  ClaimResponse,
  CoachReply,
  Feedback,
  Intent,
  JournalCard,
  JournalCardInput,
  LessonStep,
  OffReason,
  PracticeMode,
  Preferences,
  SessionConfig,
  Specialist,
  SupportTarget,
  TextReply,
  TopicInfo,
  User,
} from './types'

export class ApiError extends Error {
  status: number
  code: string
  reason?: OffReason

  constructor(status: number, code: string, message: string, reason?: OffReason) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.reason = reason
  }
}

export const SIGNED_OUT_EVENT = 'vw:signed-out'

export function signalSignedOut(): void {
  window.dispatchEvent(new Event(SIGNED_OUT_EVENT))
}

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'network', "We couldn't reach Voicewell. Check your connection and try again.")
  }
  if (!res.ok) {
    let code = 'error'
    let message = 'Something went wrong. Please try again.'
    let reason: OffReason | undefined
    try {
      const data = (await res.json()) as { error?: string; message?: string; reason?: OffReason }
      code = data.error ?? code
      message = data.message ?? message
      reason = data.reason
    } catch {
      // non-JSON error body
    }
    if (res.status === 401 && code === 'not_authenticated' && !path.startsWith('/auth/')) signalSignedOut()
    throw new ApiError(res.status, code, message, reason)
  }
  return (await res.json()) as T
}

export function redirectIfNoSession(error: unknown): boolean {
  if (error instanceof ApiError && error.status === 401) {
    if (error.code !== 'not_authenticated') navigate('/age', true)
    return true
  }
  return false
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.'
}

let feedbackInFlight: Promise<Feedback> | null = null

export const api = {
  signup: (email: string, password: string, displayName?: string) =>
    request<{ user: User }>('/auth/signup', 'POST', { email, password, displayName }),
  login: (email: string, password: string) => request<{ user: User }>('/auth/login', 'POST', { email, password }),
  logout: () => request<{ ok: true }>('/auth/logout', 'POST'),
  me: () => request<{ user: User }>('/auth/me'),
  topics: () => request<{ topics: TopicInfo[] }>('/topics'),
  claim: (claimToken: string, age: number, country?: string, language?: string) =>
    request<ClaimResponse>('/kid/claim', 'POST', { claimToken, age, country, language }),
  claimPending: (age: number, country?: string, language?: string) =>
    request<ClaimResponse>('/kid/pending', 'POST', { age, country, language }),
  session: (fresh = false) => request<SessionConfig>(fresh ? '/session?fresh=1' : '/session'),
  getLocale: () => request<{ country: string | null; jurisdiction: string | null; language: string }>('/settings/locale'),
  updateLocale: (payload: { country?: string; jurisdiction?: string; language?: string }) =>
    request<{
      locale: { country: string | null; jurisdiction: string | null; language: string }
      requiresKidCheck: boolean
      config: SessionConfig | null
    }>('/settings/locale', 'POST', payload),
  onboarding: (
    intent: Intent,
    topic: string,
    preferences: Preferences,
    extra?: {
      mode?: PracticeMode
      supportTarget?: SupportTarget | null
      supportAge?: number | null
      customGoal?: string
      language?: string
    },
  ) => request<SessionConfig>('/onboarding', 'POST', { intent, topic, preferences, ...extra }),
  lessonNext: (topic: string) => request<LessonStep>(`/lesson/${encodeURIComponent(topic)}/next`),
  lessonSimpler: (topic: string) => request<LessonStep>(`/lesson/${encodeURIComponent(topic)}/simpler`),
  lessonCheck: (conceptId: string, answerIndex: number) =>
    request<CheckResult>('/lesson/check', 'POST', { conceptId, answerIndex }),
  starters: () => request<{ starters: string[] }>('/practice/starters'),
  setPracticeMode: (mode: PracticeMode) => request<SessionConfig>('/practice/mode', 'POST', { mode }),
  practiceText: (text: string, mode?: PracticeMode) =>
    request<TextReply>('/practice/text', 'POST', { text, mode }),
  practiceCoach: (action: 'explain' | 'more_help' | 'retry_moment', format: 'text' | 'audio', question?: string) =>
    request<CoachReply>('/practice/coach', 'POST', { action, format, question }),
  practiceResume: () => request<{ ok: true; paused: boolean; turn: number }>('/practice/resume', 'POST'),
  practiceReset: () => request<{ ok: true }>('/practice/reset', 'POST'),
  feedback: () => {
    if (!feedbackInFlight) {
      feedbackInFlight = request<Feedback>('/practice/feedback', 'POST').finally(() => {
        setTimeout(() => {
          feedbackInFlight = null
        }, 1000)
      })
    }
    return feedbackInFlight
  },
  // Private Journals
  journals: () => request<{ cards: JournalCard[] }>('/journals'),
  createJournal: (input: JournalCardInput) => request<{ card: JournalCard }>('/journals', 'POST', input),
  updateJournal: (id: string, input: Partial<JournalCardInput>) =>
    request<{ card: JournalCard }>(`/journals/${encodeURIComponent(id)}`, 'PUT', input),
  deleteJournal: (id: string) => request<{ ok: true }>(`/journals/${encodeURIComponent(id)}`, 'DELETE'),
  // Caregiver Invitations & Portal
  caregiverInvites: () => request<{ invites: CaregiverInvite[] }>('/caregiver-invites'),
  createCaregiverInvite: (input: {
    ageGroup: string
    topic: string
    caregiverRole: string
    whatToUnderstand: string
    whatSupportHelps: string
    usefulPhrase: string
    language?: string
  }) => request<{ invite: CaregiverInvite }>('/caregiver-invites', 'POST', input),
  revokeCaregiverInvite: (code: string) =>
    request<{ invite: CaregiverInvite; notice: string }>(`/caregiver-invites/${encodeURIComponent(code)}/revoke`, 'POST'),
  caregiverPortal: (code: string, lang?: string) =>
    request<{ status: string; invite: CaregiverInvite | null; lesson: CaregiverLesson | null }>(
      `/caregiver-portal/${encodeURIComponent(code)}${lang ? `?lang=${encodeURIComponent(lang)}` : ''}`,
    ),
  caregiverPortalAction: (code: string, supportAction: string) =>
    request<{ invite: CaregiverInvite }>(`/caregiver-portal/${encodeURIComponent(code)}/action`, 'POST', {
      supportAction,
    }),
  caregiverPortalPractice: (code: string, text: string, language?: string) =>
    request<{ reply: string; coachTip: string }>(`/caregiver-portal/${encodeURIComponent(code)}/practice`, 'POST', {
      text,
      language,
    }),
  // Specialists & Appointments
  specialists: () => request<{ specialists: Specialist[] }>('/specialists'),
  appointments: () => request<{ requests: AppointmentRequest[] }>('/appointments'),
  createAppointment: (input: {
    bookingType: 'adult_self' | 'adult_child_invite' | 'child_guardian_request'
    creatorRole?: string
    specialistId: string
    specialistName: string
    specialty: string
    proposedAt: string
    format: string
    price: number
    appointmentType?: string
    purposeLabel: string
    informationScope?: string
  }) => request<{ request: AppointmentRequest }>('/appointments', 'POST', input),
  respondAppointment: (id: string, response: 'accept' | 'more_information' | 'decline', question?: string) =>
    request<{ request: AppointmentRequest }>(`/appointments/${encodeURIComponent(id)}/respond`, 'POST', {
      response,
      question,
    }),
  changeAppointmentScope: (
    id: string,
    informationScope: string,
    proposedAt?: string,
    appointmentType?: string,
  ) =>
    request<{ request: AppointmentRequest; message: string }>(
      `/appointments/${encodeURIComponent(id)}/scope`,
      'POST',
      { informationScope, proposedAt, appointmentType },
    ),
  guardianAuthorizeAppointment: (id: string, action: 'approve' | 'decline') =>
    request<{ request: AppointmentRequest }>(`/appointments/${encodeURIComponent(id)}/guardian`, 'POST', { action }),
}

export function voiceUrl(): string {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${scheme}://${window.location.host}/api/practice/voice`
}
