// MEGGA Marketplace — Property X icon system.
//
// Pattern Property X observé : icônes line-style, stroke 1.6-1.8, rounded
// caps and joins, tailles 14/16/18/22. Les SVG paths ci-dessous sont des
// implémentations originales suivant le même style visuel (line-rounded).

import type { ReactNode } from 'react'

export type PxIconName =
  | 'search'
  | 'location'
  | 'chevron-down' | 'chevron-up' | 'chevron-left' | 'chevron-right'
  | 'arrow-right' | 'arrow-down'
  | 'bed' | 'bath' | 'surface'
  | 'star' | 'heart' | 'share'
  | 'plus' | 'minus' | 'close' | 'check' | 'menu'
  | 'mail' | 'phone' | 'calendar' | 'lock'
  | 'home' | 'building' | 'key' | 'gallery'
  | 'sparkle' | 'shield' | 'eye'
  | 'filter' | 'sort' | 'settings'
  | 'user' | 'users' | 'logout'

const PATHS: Record<PxIconName, ReactNode> = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  location: <><path d="M12 22s-7-7.5-7-13a7 7 0 0 1 14 0c0 5.5-7 13-7 13Z" /><circle cx="12" cy="9" r="2.5" /></>,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  'chevron-up': <path d="m6 15 6-6 6 6" />,
  'chevron-left': <path d="m15 6-6 6 6 6" />,
  'chevron-right': <path d="m9 6 6 6-6 6" />,
  'arrow-right': <><path d="M4 12h16" /><path d="m13 5 7 7-7 7" /></>,
  'arrow-down': <><path d="M12 4v16" /><path d="m5 13 7 7 7-7" /></>,
  bed: <><path d="M2 18v-4a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v4" /><path d="M2 18h20" /><path d="M6 10V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4" /></>,
  bath: <><path d="M9 7V5a3 3 0 0 1 6 0v2" /><path d="M2 13h20" /><path d="M3 13v4a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-4" /></>,
  surface: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 3v18" /></>,
  star: <path d="M12 2l2.95 6.27 6.81.62-5.16 4.66 1.52 6.7L12 16.7l-6.12 3.55 1.52-6.7L2.24 8.89l6.81-.62L12 2Z" />,
  heart: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" />,
  share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4" /><path d="m15.4 6.5-6.8 4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="m5 12 5 5L20 7" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></>,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  home: <><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>,
  building: <><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h.01M15 16h.01" /></>,
  key: <><circle cx="7" cy="14" r="4" /><path d="m11 14 9-9M16 9l3 3" /></>,
  gallery: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5-7 7" /></>,
  sparkle: <path d="m12 3-1.91 5.81a2 2 0 0 1-1.28 1.28L3 12l5.81 1.91a2 2 0 0 1 1.28 1.28L12 21l1.91-5.81a2 2 0 0 1 1.28-1.28L21 12l-5.81-1.91a2 2 0 0 1-1.28-1.28L12 3Z" />,
  shield: <><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></>,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  filter: <path d="M3 6h18M6 12h12M10 18h4" />,
  sort: <path d="M3 6h13M3 12h9M3 18h5M14 14l4 4 4-4M18 4v14" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.3l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2.2-1.3L14 3h-4l-.4 2.4a7 7 0 0 0-2.2 1.3l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .9.1 1.3l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2.2 1.3L10 21h4l.4-2.4a7 7 0 0 0 2.2-1.3l2.3.9 2-3.4-2-1.5c.1-.4.1-.9.1-1.3Z" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M3 20c.6-3.4 3-5 6-5s5.4 1.6 6 5" /><circle cx="17" cy="9" r="2.5" /><path d="M15 20c.4-2 1.5-3 3-3s2.6 1 3 3" /></>,
  logout: <><path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" /><path d="M10 17l-5-5 5-5" /><path d="M15 12H5" /></>,
}

interface PxIconProps {
  name: PxIconName
  size?: number
  color?: string
  strokeWidth?: number
}

export default function PxIcon({
  name,
  size = 16,
  color = 'currentColor',
  strokeWidth = 1.7,
}: PxIconProps) {
  const path = PATHS[name]
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', flexShrink: 0 }}>
      {path}
    </svg>
  )
}
