// MEGGA CRM Sugar v3 — Catalogue d'icônes SVG stroke
// Port 1:1 des paths SVG des fichiers JSX du handoff (kyc/wizard/contact/audit/pipeline).
// Style Sugar Pure : line stroke uniquement, jamais d'emoji.

import type { ReactNode } from 'react'

export type SgIconName =
  // Navigation / actions
  | 'arrowL' | 'arrowR' | 'arrowDown' | 'plus' | 'close' | 'search' | 'chevDown'
  // KYC checks (5 LBA + variants)
  | 'shield' | 'shieldStar' | 'id' | 'home' | 'flag' | 'ban' | 'coins'
  // Status / actions
  | 'check' | 'checkAll' | 'clock' | 'alert' | 'lock' | 'dot' | 'refresh'
  // Documents
  | 'file' | 'eye' | 'pencil' | 'note' | 'upload' | 'download'
  // Communication
  | 'phone' | 'mail' | 'msg' | 'chat' | 'cal' | 'send' | 'user'
  // Pipeline / audit
  | 'pipeline' | 'contact' | 'cog' | 'sparkle' | 'server' | 'person'
  // Misc
  | 'map' | 'target' | 'star' | 'bed' | 'bath' | 'flame' | 'swap'
  | 'deal' | 'computer' | 'cloud' | 'moon' | 'bell' | 'inbox'
  | 'kyc'
  // Sprint 2 — Bien, Deal, Visite
  | 'arrowUp' | 'globe' | 'ruler' | 'heart' | 'photos' | 'pen' | 'mic'
  | 'pin' | 'smile' | 'play' | 'pause'

const PATHS: Record<SgIconName, ReactNode> = {
  // Navigation / actions
  arrowL: <><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></>,
  arrowR: <><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></>,
  arrowDown: <><path d="M12 5v14" /><path d="M5 12l7 7 7-7" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  close: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  chevDown: <><path d="m6 9 6 6 6-6" /></>,

  // KYC checks (5 LBA + variants)
  shield: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" /></>,
  shieldStar: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" /><path d="m9 11 2 2 4-4" /></>,
  id: <><rect x="3" y="6" width="18" height="13" rx="2" /><circle cx="9" cy="12" r="2.5" /><path d="M14 10h4M14 14h4" /></>,
  home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v9h14v-9" /></>,
  flag: <><path d="M4 21V4" /><path d="M4 5h13l-2 4 2 4H4" /></>,
  ban: <><circle cx="12" cy="12" r="9" /><path d="m5.5 5.5 13 13" /></>,
  coins: <><circle cx="9" cy="9" r="6" /><circle cx="15" cy="15" r="6" /></>,
  kyc: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" /><path d="m9 11 2 2 4-4" /></>,

  // Status / actions
  check: <><path d="m5 13 4 4 10-12" /></>,
  checkAll: <><path d="m2 13 4 4 10-12" /><path d="m9 15 3 3 10-12" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  dot: <><circle cx="12" cy="12" r="3" /></>,
  refresh: <><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></>,

  // Documents
  file: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  pencil: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" /></>,
  note: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></>,
  upload: <><path d="M12 20V4M7 9l5-5 5 5" /><path d="M5 20h14" /></>,
  download: <><path d="M12 4v12" /><path d="m7 11 5 5 5-5" /><path d="M5 20h14" /></>,

  // Communication
  phone: <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13 1.06.37 2.1.72 3.11a2 2 0 0 1-.45 2.11L8.09 10.1a16 16 0 0 0 6 6l1.16-1.27a2 2 0 0 1 2.11-.45c1 .35 2.05.59 3.11.72A2 2 0 0 1 22 16.92Z" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  msg: <><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.4-.7L3 21l1.7-6.1a8.5 8.5 0 0 1-.7-3.4 8.38 8.38 0 0 1 8.5-8.5 8.38 8.38 0 0 1 8.5 8.5Z" /></>,
  chat: <><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.4-.7L3 21l1.7-6.1a8.5 8.5 0 0 1-.7-3.4 8.38 8.38 0 0 1 8.5-8.5 8.38 8.38 0 0 1 8.5 8.5Z" /></>,
  cal: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></>,
  send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,

  // Pipeline / audit
  pipeline: <><rect x="3" y="4" width="6" height="6" rx="1" /><rect x="3" y="14" width="6" height="6" rx="1" /><rect x="15" y="9" width="6" height="6" rx="1" /><path d="M9 7h6M9 17h6" /></>,
  contact: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  cog: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>,
  sparkle: <><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z" /></>,
  server: <><rect x="3" y="4" width="18" height="6" rx="2" /><rect x="3" y="14" width="18" height="6" rx="2" /><path d="M7 7h.01M7 17h.01" /></>,
  person: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,

  // Misc
  map: <><path d="m3 7 6-2 6 2 6-2v12l-6 2-6-2-6 2Z" /><path d="M9 5v14M15 7v14" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  star: <><polygon points="12 2 15 8.5 22 9.5 17 14.5 18.5 21.5 12 18 5.5 21.5 7 14.5 2 9.5 9 8.5" /></>,
  bed: <><path d="M3 18V8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10" /><path d="M3 14h18M7 11h3" /></>,
  bath: <><path d="M5 10V5a2 2 0 0 1 2-2h2" /><path d="M3 10h18v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-3Z" /><path d="M7 21v-1M17 21v-1" /></>,
  flame: <><path d="M12 2s3 4 3 8a3 3 0 0 1-6 0c0-1 .5-2 1-3 0-2-1-4-1-4-2 3-4 5-4 9a6 6 0 0 0 12 0c0-5-5-10-5-10Z" /></>,
  swap: <><path d="m7 4 4 4-4 4M17 20l-4-4 4-4" /><path d="M7 8h14M3 16h14" /></>,
  deal: <><path d="M12 2v6M12 16v6M5 9h14M5 15h14" /></>,
  computer: <><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  cloud: <><path d="M18 10a4 4 0 0 0-7.55-1A4 4 0 1 0 7 18h11a4 4 0 0 0 0-8Z" /></>,
  moon: <><path d="M20 14a8 8 0 0 1-10-10 8 8 0 1 0 10 10Z" /></>,
  bell: <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z" /><path d="M10 21a2 2 0 0 0 4 0" /></>,
  inbox: <><path d="M3 13v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" /><path d="M3 13l3-7a2 2 0 0 1 2-1h8a2 2 0 0 1 2 1l3 7" /><path d="M3 13h5l1 2h6l1-2h5" /></>,

  // Sprint 2 additions
  arrowUp: <><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  ruler: <><path d="M21 3 3 21" /><path d="M9 3l3 3M13 7l3 3M17 11l3 3M3 9l3 3M7 13l3 3M11 17l3 3" /></>,
  heart: <><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" /></>,
  photos: <><rect x="3" y="6" width="14" height="14" rx="2" /><path d="M7 2h14v14" /></>,
  pen: <><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /></>,
  mic: <><rect x="9" y="2" width="6" height="13" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" /></>,
  pin: <><circle cx="12" cy="10" r="3" /><path d="M12 22s-7-7-7-12a7 7 0 0 1 14 0c0 5-7 12-7 12Z" /></>,
  smile: <><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" /></>,
  play: <><path d="m6 4 14 8-14 8V4Z" /></>,
  pause: <><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>,
}

interface SgIconProps {
  name: SgIconName | string
  size?: number
  stroke?: string
  sw?: number
}

/**
 * Icône SVG stroke style Sugar Pure.
 *
 * @param name — clef du catalogue (port 1:1 des paths JSX handoff)
 * @param size — px, défaut 22
 * @param stroke — couleur, défaut `currentColor`
 * @param sw — strokeWidth, défaut 1.6
 */
export function SgIcon({ name, size = 22, stroke = 'currentColor', sw = 1.6 }: SgIconProps) {
  const path = PATHS[name as SgIconName]
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
      {path ?? null}
    </svg>
  )
}
