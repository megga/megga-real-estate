// MEGGA Contacts V3 — jeu réduit d'icônes Sugar Pure.
// Port 1:1 de `refonte-contacts-shared.jsx` (RcIcon).
// Stroke par défaut : 1.7 — donne le rendu "filaire fin" Sugar.

import type { ReactNode } from 'react'

export type RcIconName =
  | 'search'
  | 'plus'
  | 'arrowR'
  | 'pencil'
  | 'check'
  | 'close'
  | 'phone'
  | 'mail'
  | 'cal'
  | 'sparkle'
  | 'home'
  | 'bag'
  | 'key'
  | 'eye'
  | 'list'
  | 'grid'
  | 'table'
  | 'dot'
  | 'chevR'
  | 'chevD'
  | 'shield'
  | 'bell'
  | 'flame'
  | 'clock'
  | 'moon'

interface RcIconProps {
  name: RcIconName
  size?: number
  stroke?: string
  sw?: number
}

const PATHS: Record<RcIconName, ReactNode> = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  arrowR: <path d="M5 12h14M13 5l7 7-7 7" />,
  pencil: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </>
  ),
  check: <path d="m5 13 4 4 10-12" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  phone: (
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.7.6 2.5a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.8.3 1.6.5 2.5.6A2 2 0 0 1 22 16.9Z" />
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 7 9-7" />
    </>
  ),
  cal: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  sparkle: (
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z" />
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v9h14v-9" />
    </>
  ),
  bag: (
    <>
      <path d="M6 7h12l-1 13H7L6 7Z" />
      <path d="M9 7V5a3 3 0 0 1 6 0v2" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="14" r="4" />
      <path d="m11 11 9-9 3 3-3 3M14 8l3 3" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  list: <path d="M3 6h18M3 12h18M3 18h18" />,
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </>
  ),
  table: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M3 14h18M9 5v14M15 5v14" />
    </>
  ),
  dot: <circle cx="12" cy="12" r="3" />,
  chevR: <path d="m9 6 6 6-6 6" />,
  chevD: <path d="m6 9 6 6 6-6" />,
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" />,
  bell: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </>
  ),
  flame: (
    <path d="M12 2s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3 1-5 1 1 2 2 4 2-1-2 0-4 0-6Z" />
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
}

export default function RcIcon({
  name,
  size = 16,
  stroke = 'currentColor',
  sw = 1.7,
}: RcIconProps) {
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
