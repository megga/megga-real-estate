// Matching · Recherche — pont d'icônes. Le proto handoff appelle `CRMIcon` avec
// une couleur de trait explicite (`stroke`) ; on délègue à `AtlIcon` (→ MEIcon,
// stroke 1.6, même set que l'atelier) en posant la couleur via `color`
// (AtlIcon rend en `currentColor`). Garde la grammaire Sugar : stroke linéaire, 0 emoji.

import type { CSSProperties } from 'react'
import AtlIcon, { type AtlIconName } from '@/components/matching-atelier/AtlIcon'

// nom proto → nom MEIcon/AtlIcon
const MAP: Record<string, AtlIconName> = {
  search: 'search',
  chevronL: 'chevron-left',
  chevronR: 'chevron-right',
  plus: 'plus',
  check: 'check',
  close: 'close',
  user: 'user',
  home: 'home',
  spark: 'sparkle',
  arrowR: 'arrow-right',
  phone: 'phone',
  layers: 'layers',
  eye: 'eye',
  cal: 'calendar',
  info: 'info',
  send: 'send',
  mapPin: 'location',
}

export type RechIconName = keyof typeof MAP

interface Props {
  name: RechIconName
  size?: number
  stroke?: string
  style?: CSSProperties
  className?: string
}

export default function RechIcon({ name, size = 16, stroke, style, className }: Props) {
  return (
    <AtlIcon
      d={MAP[name] ?? 'info'}
      size={size}
      className={className}
      style={stroke ? { color: stroke, ...style } : style}
    />
  )
}
