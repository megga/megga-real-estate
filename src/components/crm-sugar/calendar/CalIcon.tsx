// MEGGA CRM Sugar v2 — Calendar-specific icons
// 1:1 port from `crm-calendar-sugar-shell.jsx` (CalIcon).

import type { ReactNode } from 'react'

export type CalIconName =
  | 'home' | 'signature' | 'stamp' | 'check' | 'upload' | 'chevL' | 'chevR'
  | 'plus' | 'close' | 'sparkle' | 'pin' | 'clock' | 'phone' | 'flame'
  | 'warn' | 'list' | 'grid' | 'map' | 'mic' | 'arrowR' | 'eye' | 'car'
  | 'user'

const PATHS: Record<CalIconName, ReactNode> = {
  home: (
    <>
      <path d="M3 21V11l9-7 9 7v10" />
      <path d="M9 21v-7h6v7" />
    </>
  ),
  signature: (
    <>
      <path d="M3 17s4-2 8-2 5 2 9 2" />
      <path d="m12 12 6-6a1.5 1.5 0 0 1 2 2l-6 6" />
    </>
  ),
  stamp: (
    <>
      <path d="M5 21h14" />
      <path d="M7 17a3 3 0 0 1-1-2v-3l3-1V6a3 3 0 1 1 6 0v5l3 1v3a3 3 0 0 1-1 2Z" />
    </>
  ),
  check: <path d="m4 12 5 5L20 6" />,
  upload: (
    <>
      <path d="M12 3v14" />
      <path d="m6 9 6-6 6 6" />
      <path d="M5 21h14" />
    </>
  ),
  chevL: <path d="m15 6-6 6 6 6" />,
  chevR: <path d="m9 6 6 6-6 6" />,
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  close: (
    <>
      <path d="M18 6 6 18M6 6l12 12" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </>
  ),
  pin: (
    <>
      <path d="M12 22s7-7 7-13a7 7 0 1 0-14 0c0 6 7 13 7 13Z" />
      <circle cx="12" cy="9" r="2.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  phone: (
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.7.6 2.5a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.8.3 1.6.5 2.5.6A2 2 0 0 1 22 16.9Z" />
  ),
  flame: <path d="M12 2s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3 1-5 1 1 2 2 4 2-1-2 0-4 0-6Z" />,
  warn: (
    <>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </>
  ),
  list: (
    <>
      <path d="M3 6h18M3 12h18M3 18h18" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </>
  ),
  map: (
    <>
      <path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2Z" />
      <path d="M9 3v16M15 5v16" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </>
  ),
  arrowR: (
    <>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  car: (
    <>
      <path d="M5 17h14l-1.5-7H6.5L5 17Z" />
      <circle cx="8" cy="17" r="2" />
      <circle cx="16" cy="17" r="2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
}

interface CalIconProps {
  name: CalIconName
  size?: number
  stroke?: string
  sw?: number
}

export function CalIcon({ name, size = 16, stroke = 'currentColor', sw = 1.8 }: CalIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  )
}
