import type { CapabilityState, OffReason } from './types'

// Plain-language copy for why a feature is off (spec section 3 / FR-2).
export const REASON_COPY: Record<OffReason, string> = {
  'consent-pending': 'Practice opens once your grown-up approves.',
  'needs-grown-up': 'A grown-up can turn this on in Permissions.',
  'not-permitted': "This isn't available for your account here.",
  'under-18': 'Tone tips are for adults.',
  'off-in-settings': 'This is switched off. You can turn it on in Permissions.',
}

export function reasonCopy(reason?: OffReason): string {
  return REASON_COPY[reason ?? 'not-permitted'] ?? REASON_COPY['not-permitted']
}

// Returns the sentence to show for a capability, or null when it is on.
export function offNote(cap: CapabilityState | undefined): string | null {
  if (!cap || cap.on) return null
  return reasonCopy(cap.reason)
}
