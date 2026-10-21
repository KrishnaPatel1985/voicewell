import { createContext, useContext } from 'react'
import type { SessionConfig, User } from './types'

export interface SessionValue {
  config: SessionConfig | null
  setConfig: (config: SessionConfig) => void
  // The signed-in account (BUILD_SPEC_V2 1.2); null while signed out.
  user: User | null
  signIn: (user: User) => void
  signOut: () => void
}

export const SessionContext = createContext<SessionValue>({
  config: null,
  setConfig: () => {},
  user: null,
  signIn: () => {},
  signOut: () => {},
})

export function useSession(): SessionValue {
  return useContext(SessionContext)
}

// For screens rendered inside <Guard>, where the config is always loaded.
export function useConfig(): SessionConfig {
  const { config } = useContext(SessionContext)
  if (!config) throw new Error('Session config is not loaded')
  return config
}
