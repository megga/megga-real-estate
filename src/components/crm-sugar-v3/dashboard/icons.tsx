// MEGGA CRM Sugar v3 — Dashboard Analytics (Sprint 4) — Mini icon set
// Port pixel-près de DBIcon (sprint-4/crm-dashboard-shell.jsx).

import type { JSX } from 'react'

export type DbIconName =
  | 'chev'
  | 'refresh'
  | 'download'
  | 'cal'
  | 'users'
  | 'arrow'
  | 'arrowUp'
  | 'arrowDn'
  | 'info'
  | 'spark'
  | 'target'
  | 'funnel'
  | 'bolt'
  | 'settings'
  | 'back'
  | 'check'
  | 'close'
  | 'pause'
  | 'sparkle'
  | 'arrowL'
  | 'send'
  | 'phone'
  | 'clock'
  | 'eye'
  | 'mail'
  | 'msg'
  | 'doc'
  | 'party'
  | 'wave'

interface DbIconProps {
  name: DbIconName
  size?: number
  stroke?: string
  sw?: number
}

const PATHS: Record<DbIconName, JSX.Element> = {
  chev: <path d="m6 9 6 6 6-6" />,
  refresh: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12m-5-5 5 5 5-5" />
      <path d="M5 21h14" />
    </>
  ),
  cal: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c.6-3.4 3-5 6-5s5.4 1.6 6 5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15 20c.4-2 1.5-3 3-3s2.6 1 3 3" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowUp: <path d="M5 15l7-7 7 7" />,
  arrowDn: <path d="M5 9l7 7 7-7" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v.01M11 12h1v5h1" />
    </>
  ),
  spark: <path d="m12 4 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z" />,
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  funnel: <path d="M4 4h16l-6 8v8l-4-2v-6L4 4Z" />,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1.3l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2.2-1.3L14 3h-4l-.4 2.4a7 7 0 0 0-2.2 1.3l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .9.1 1.3l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2.2 1.3L10 21h4l.4-2.4a7 7 0 0 0 2.2-1.3l2.3.9 2-3.4-2-1.5c.1-.4.1-.9.1-1.3Z" />
    </>
  ),
  back: <path d="M15 6l-6 6 6 6" />,
  check: <path d="M20 6 9 17l-5-5" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  pause: (
    <>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </>
  ),
  sparkle: (
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z" />
  ),
  arrowL: <path d="M19 12H5M11 18l-6-6 6-6" />,
  send: (
    <>
      <path d="m22 2-7 20-4-9-9-4 20-7Z" />
      <path d="M22 2 11 13" />
    </>
  ),
  phone: (
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.7.6 2.5a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.8.3 1.6.5 2.5.6A2 2 0 0 1 22 16.9Z" />
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  msg: (
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
  ),
  doc: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
    </>
  ),
  party: (
    <path d="m12 2 2.4 7.4H22l-6 4.5L18.4 22 12 17.5 5.6 22l2.4-8.1L2 9.4h7.6Z" />
  ),
  wave: (
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
  ),
}

export function DbIcon({
  name,
  size = 16,
  stroke = 'currentColor',
  sw = 1.7,
}: DbIconProps) {
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
