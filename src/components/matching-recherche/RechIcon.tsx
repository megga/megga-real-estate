// Matching · Recherche — pont d'icônes. Le proto handoff appelle `CRMIcon` avec
// une couleur de trait explicite (`stroke`) ; on délègue à `MrhIcon` (→ MEIcon,
// trait de 1,6) en posant la couleur via `color` (MrhIcon rend en `currentColor`).
// Trait linéaire, 0 emoji.

import type { CSSProperties } from 'react'
import MrhIcon, { type MrhIconName } from './MrhIcon'

// nom proto → nom MEIcon/MrhIcon
const MAP: Record<string, MrhIconName> = {
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
  trendDown: 'trend-down',
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
    <MrhIcon
      d={MAP[name] ?? 'info'}
      size={size}
      className={className}
      style={stroke ? { color: stroke, ...style } : style}
    />
  )
}
