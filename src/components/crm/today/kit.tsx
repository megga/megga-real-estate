// MEGGA CRM — Today V2 « concept H » · ATOMES PARTAGÉS
// ----------------------------------------------------------------------------
// Port des atomes de `today-redesign-kit.jsx`, réduits à ceux que les surfaces
// VIVANTES consomment : la page Aujourd'hui, le catalogue, la session de relance
// et le mobile. `Tile`, `TileHead` et `MoreLink` sont partis avec les tuiles de
// l'ancien cockpit, qu'elles seules servaient.
//
// `RXIcon` est un simple adaptateur qui traduit les noms locaux du proto vers
// les glyphes officiels MEIcon (src/components/propertyx/MEIcon).

import type { ReactNode } from 'react'
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
        width: size, height: size, borderRadius: 'var(--crm-radius-pill)', background: av || '#6F8CFF',
        color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0,
        fontSize: size * 0.36, fontWeight: 600, letterSpacing: -0.2,
        fontVariantNumeric: 'tabular-nums',
        boxShadow: ring ? `0 0 0 2px ${TK.bg}, 0 0 0 3.5px ${av || '#6F8CFF'}55` : '0 2px 8px rgba(0,0,0,.35)',
      }}
    >
      {initials}
    </div>
  )
}

// ─── Eyebrow — libellé de section ───────────────────────────────────────
interface EyebrowProps {
  children: ReactNode
  color?: string
}

export function Eyebrow({ children, color }: EyebrowProps) {
  return (
    <div
      style={{
        fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: color || TK.sub,
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

