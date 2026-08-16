// Atelier Matching — icônes. Délègue au set maison MEIcon (stroke 1.6) ;
// tracés locaux pour les glyphes absents du set OU rendus en font-fallback
// par MEIcon (layers/bolt → PxIconFont), afin de garder le stroke linéaire
// exigé par la grammaire Sugar Pure du handoff (zéro emoji, stroke ~1.6).

import type { CSSProperties, ReactNode } from 'react'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'

// Glyphes locaux : nom → paths (stroke) ou élément (fill)
const LOCAL: Record<string, { fill?: boolean; node: ReactNode }> = {
  lift: {
    node: (
      <>
        <path d="M5 3h14v18H5z" />
        <path d="M9 8l3-3 3 3" />
        <path d="M9 16l3 3 3-3" />
      </>
    ),
  },
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
  tag: {
    node: (
      <>
        <path d="M12 2H2v10l9.3 9.3a1.7 1.7 0 0 0 2.4 0l7.6-7.6a1.7 1.7 0 0 0 0-2.4L12 2Z" />
        <path d="M7 7h.01" />
      </>
    ),
  },
}

export type AtlIconName = MEIconName | 'lift' | 'trend-down' | 'tag'

interface AtlIconProps {
  d: AtlIconName
  size?: number
  sw?: number
  style?: CSSProperties
  className?: string
}

export default function AtlIcon({ d, size = 16, sw = 1.6, style, className }: AtlIconProps) {
  const local = LOCAL[d]
  if (local) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill={local.fill ? 'currentColor' : 'none'}
        stroke={local.fill ? 'none' : 'currentColor'}
        strokeWidth={local.fill ? undefined : sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={{ display: 'inline-block', flexShrink: 0, ...style }}
      >
        {local.node}
      </svg>
    )
  }
  return <MEIcon name={d as MEIconName} size={size} strokeWidth={sw} className={className} style={style} />
}
