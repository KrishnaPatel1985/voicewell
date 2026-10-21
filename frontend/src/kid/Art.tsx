import type { ReactNode } from 'react'

// Small inline illustrations for the kid home: feeling faces and the three activity icons.

const INK = '#2b1d17'

const FACES: Record<string, { fill: string; face: ReactNode }> = {
  happy: {
    fill: '#ecc97f',
    face: (
      <>
        <circle cx="21" cy="25" r="2.6" fill={INK} />
        <circle cx="35" cy="25" r="2.6" fill={INK} />
        <path d="M20 33q8 7 16 0" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      </>
    ),
  },
  calm: {
    fill: '#b9d8c3',
    face: (
      <>
        <circle cx="21" cy="26" r="2.6" fill={INK} />
        <circle cx="35" cy="26" r="2.6" fill={INK} />
        <path d="M22 34q6 3 12 0" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      </>
    ),
  },
  worried: {
    fill: '#cdbfe6',
    face: (
      <>
        <circle cx="21" cy="27" r="2.6" fill={INK} />
        <circle cx="35" cy="27" r="2.6" fill={INK} />
        <path d="M16 21l8-3M40 21l-8-3M21 37q7-6 14 0" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      </>
    ),
  },
  sad: {
    fill: '#bccbea',
    face: (
      <>
        <circle cx="21" cy="26" r="2.6" fill={INK} />
        <circle cx="35" cy="26" r="2.6" fill={INK} />
        <path d="M21 38q7-7 14 0" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      </>
    ),
  },
  cross: {
    fill: '#eeab98',
    face: (
      <>
        <circle cx="21" cy="28" r="2.6" fill={INK} />
        <circle cx="35" cy="28" r="2.6" fill={INK} />
        <path d="M15 20l9 4M41 20l-9 4M22 38q6-4 12 0" fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
      </>
    ),
  },
  tired: {
    fill: '#cfe0d3',
    face: (
      <>
        <path d="M17 27h8M31 27h8M23 36h10" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      </>
    ),
  },
  unsure: {
    fill: '#f1e3c4',
    face: (
      <>
        <circle cx="21" cy="28" r="2.6" fill={INK} />
        <circle cx="35" cy="28" r="2.6" fill={INK} />
        <path d="M22 37h12" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
        <text x="44" y="14" fontSize="14" fontWeight="700" fill={INK}>?</text>
      </>
    ),
  },
}

export function FeelingFace({ id, size = 58 }: { id: string; size?: number }) {
  const f = FACES[id] ?? FACES.unsure
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" aria-hidden="true">
      <circle cx="28" cy="28" r="26" fill={f.fill} />
      {f.face}
    </svg>
  )
}

export function ActivityIcon({ kind, size = 72 }: { kind: 'detective' | 'builder' | 'ask'; size?: number }) {
  const stroke = { stroke: INK, strokeWidth: 3.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" aria-hidden="true">
      {kind === 'detective' && (
        <>
          <circle cx="32" cy="32" r="20" fill="#f6e8c8" {...stroke} />
          <circle cx="26" cy="29" r="2.4" fill={INK} />
          <circle cx="38" cy="29" r="2.4" fill={INK} />
          <path d="M25 38q7 6 14 0M47 47l16 16" fill="none" {...stroke} />
        </>
      )}
      {kind === 'builder' && (
        <>
          <rect x="8" y="12" width="30" height="14" rx="7" fill="#fffdf9" {...stroke} />
          <rect x="22" y="30" width="40" height="14" rx="7" fill="#e7c988" {...stroke} />
          <rect x="8" y="48" width="26" height="14" rx="7" fill="#fffdf9" {...stroke} />
        </>
      )}
      {kind === 'ask' && (
        <>
          <path d="M10 12h28a6 6 0 0 1 6 6v14a6 6 0 0 1-6 6H24l-10 8v-8h-4a6 6 0 0 1-6-6V18a6 6 0 0 1 6-6z" fill="#fffdf9" {...stroke} />
          <path d="M24 20q0-5 5-5t5 4q0 3-5 5" fill="none" {...stroke} strokeWidth={3} transform="translate(-6 2)" />
          <rect x="38" y="36" width="26" height="18" rx="9" fill="#e9a58d" {...stroke} />
        </>
      )}
    </svg>
  )
}
