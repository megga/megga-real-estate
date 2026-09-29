/**
 * Matching · Recherche — le rendu de ses icônes : le jeu maison `MEIcon`, au trait de 1,6, complété de tracés locaux
 * pour les glyphes absents du jeu OU que `MEIcon` rend en police de repli (`layers` → `PxIconFont`) — le trait reste
 * linéaire, sans emoji. `RechIcon` y traduit les noms du proto de la Recherche.
 */

import type { CSSProperties, ReactNode } from 'react'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'

// Glyphes locaux : nom → paths (stroke) ou élément (fill)
const LOCAL: Record<string, { fill?: boolean; node: ReactNode }> = {
  layers: {
    fill: true,
    node: <path d="m12 2 11 6-11 6-11-6 11-6Zm-11 9 11 6 11-6-2-1-9 5-9-5-2 1Zm0 4 11 6 11-6-2-1-9 5-9-5-2 1Z" />,
  },
  'trend-down': {
    node: (
      <>
        <path d="M22 17 13.5 8.5l-5 5L2 7" />
        <path d="M16 17h6v-6" />
      </>
    ),
  },
}

/** Le trait des icônes de la Recherche : 1,6, un rien plus fin que le trait par défaut de `MEIcon` (1,7). */
const TRAIT = 1.6

export type MrhIconName = MEIconName | 'trend-down'

interface MrhIconProps {
  d: MrhIconName
  size?: number
  style?: CSSProperties
  className?: string
}

export default function MrhIcon({ d, size = 16, style, className }: MrhIconProps) {
  const local = LOCAL[d]
  if (local) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill={local.fill ? 'currentColor' : 'none'}
        stroke={local.fill ? 'none' : 'currentColor'}
        strokeWidth={local.fill ? undefined : TRAIT}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={{ display: 'inline-block', flexShrink: 0, ...style }}
      >
        {local.node}
      </svg>
    )
  }
  return <MEIcon name={d as MEIconName} size={size} strokeWidth={TRAIT} className={className} style={style} />
}
