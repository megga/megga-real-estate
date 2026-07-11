// MEGGA CRM — Refonte « Aujourd'hui » · ATOMES PARTAGÉS (port fidèle)
// ----------------------------------------------------------------------------
// Port 1:1 des atomes de `today-redesign-kit.jsx` + `today-redesign-c1c2.jsx`
// (uniquement ceux consommés par la page finale rendue : cockpit + catalogue).
// `RXIcon` est un simple adaptateur qui traduit les noms locaux du proto vers
// les glyphes officiels MEIcon (src/components/propertyx/MEIcon).

import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { TK } from './tk'

// ─── RXIcon — adaptateur noms locaux → MEIcon (trait bold ≥ 2.1) ───────────
const RX_TO_ME: Record<string, MEIconName> = {
  phone: 'phone', cal: 'calendar', home: 'home', shield: 'shield', doc: 'file',
  offer: 'banknote', check: 'check', arrow: 'arrow-right', spark: 'sparkle', bell: 'bell',
  search: 'search', plus: 'plus', bolt: 'bolt', clock: 'clock', flame: 'flame',
  target: 'target', trend: 'trending-up', user: 'user', dots: 'more-horizontal',
  grid: 'dashboard', cards: 'layers', mail: 'mail', send: 'send', key: 'key',
}

// Noms MEIcon valides — pour le repli « nom direct » (sinon « more-horizontal »),
// fidèle au check `window.ME_PATHS[name]` du proto.
const ME_KNOWN: Set<string> = new Set<MEIconName>([
  'search', 'location', 'chevron-down', 'chevron-up', 'chevron-left', 'chevron-right',
  'arrow-up', 'arrow-right', 'arrow-down', 'arrow-left', 'bed', 'bath', 'surface', 'sofa',
  'kitchen', 'parking', 'star', 'heart', 'share', 'flag', 'bookmark', 'plus', 'minus',
  'close', 'check', 'menu', 'mail', 'phone', 'calendar', 'clock', 'lock', 'home',
  'building', 'key', 'gallery', 'sparkle', 'shield', 'eye', 'globe', 'compass', 'filter',
  'sort', 'settings', 'download', 'upload', 'user', 'users', 'logout', 'info', 'help',
  'alert', 'credit-card', 'bell', 'bell-ring', 'edit', 'trash', 'copy', 'external', 'play',
  'pause', 'refresh', 'expand', 'collapse', 'thumb-up', 'thumb-down', 'message', 'send',
  'briefcase', 'pipeline', 'camera', 'target', 'file', 'files', 'save', 'print', 'link',
  'check-circle', 'zoom-in', 'zoom-out', 'ruler', 'door', 'car', 'store', 'trending-up',
  'trending-down', 'more-horizontal', 'grip', 'spinner', 'dashboard', 'chevron-up-down',
  'villa', 'land', 'warehouse', 'moon', 'sun', 'layers', 'bolt', 'broadcast', 'flowchart',
  'megaphone', 'magic-wand', 'close-circle', 'flame', 'banknote',
])

interface RXIconProps {
  name: string
  size?: number
  sw?: number
  color?: string
  fill?: string
}

export function RXIcon({ name, size = 18, sw = 1.6, color = 'currentColor', fill = 'none' }: RXIconProps) {
  const me = RX_TO_ME[name] || (ME_KNOWN.has(name) ? (name as MEIconName) : 'more-horizontal')
  // Trait plancher bold (≥ 2.1) ; respecte un sw appelant plus épais.
  return <MEIcon name={me} size={size} color={color} strokeWidth={Math.max(sw, 2.1)} fill={fill === 'none' ? undefined : fill} />
}

// ─── Avatar ─────────────────────────────────────────────────────────────
interface AvProps {
  initials: string
  av?: string
  size?: number
  ring?: boolean
}

export function Av({ initials, av, size = 38, ring = false }: AvProps) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: 999, background: av || '#6F8CFF',
        color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0,
        fontSize: size * 0.36, fontWeight: 700, letterSpacing: -0.2,
        fontVariantNumeric: 'tabular-nums',
        boxShadow: ring ? `0 0 0 2px ${TK.bg}, 0 0 0 3.5px ${av || '#6F8CFF'}55` : '0 2px 8px rgba(0,0,0,.35)',
      }}
    >
      {initials}
    </div>
  )
}



// ─── Frame / Tile (verre Sugar) ─────────────────────────────────────────
interface TileProps {
  children: ReactNode
  style?: CSSProperties
  pad?: number
  hover?: boolean
}

export function Tile({ children, style, pad = 18, hover = true }: TileProps) {
  const [h, setH] = useState(false)
  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        position: 'relative', borderRadius: 24, padding: pad,
        background: h && hover ? TK.frameHi : TK.frame,
        border: `1px solid ${h && hover ? TK.borderHi : TK.border}`,
        boxShadow: TK.shadow,
        transition: 'background .25s ease, border-color .25s ease',
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  )
}


// ─── Orbs de fond (lueur douce derrière le verre) — no-op fidèle ─────────
export function Orbs() {
  return null
}

// ─── section header tuile (today-redesign-c1c2) ─────────────────────────
// `icon` / `accent` sont acceptés mais non rendus (fidèle au proto : TileHead
// destructure ces props sans les utiliser).
interface TileHeadProps {
  icon?: string
  title: string
  action?: ReactNode
  accent?: string
}

export function TileHead({ title, action }: TileHeadProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 13 }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: TK.ink, letterSpacing: -0.2, whiteSpace: 'nowrap' }}>{title}</h3>
      <div style={{ flex: 1 }} />
      {action}
    </div>
  )
}

interface MoreLinkProps {
  children?: ReactNode
  onClick?: () => void
}

export function MoreLink({ children, onClick }: MoreLinkProps) {
  const { t } = useTranslation('common')
  return (
    <span
      onClick={onClick}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: TK.sub, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
    >
      {children ?? t('actions.viewAll')}
      <RXIcon name="arrow" size={13} sw={2} />
    </span>
  )
}
