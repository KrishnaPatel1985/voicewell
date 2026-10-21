// LocalStorage keys for session state and locale persistence. Every access is wrapped in try/catch
// because storage can be blocked or empty in private windows.

export type StorageKey =
  | 'kid.sessionId'
  | 'kid.challengeId'
  | 'vw.age'
  | 'vw.intent'
  | 'vw.country'
  | 'vw.jurisdiction'
  | 'vw.language'

export function load(key: StorageKey): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function persist(key: StorageKey, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage unavailable: the app still works, it just cannot resume after a reload.
  }
}

export const save = persist

export function forget(...keys: StorageKey[]): void {
  for (const key of keys) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // ignore
    }
  }
}

// Log out clears every kid.* and vw.* key.
export function forgetAll(): void {
  forget('kid.sessionId', 'kid.challengeId', 'vw.age', 'vw.intent', 'vw.country', 'vw.jurisdiction', 'vw.language')
}
