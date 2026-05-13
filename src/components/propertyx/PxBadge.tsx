// MEGGA Marketplace — Property X badge (port fidèle du composant 🎖️ Badges Figma).
//
// Anatomie :
// - Pill (radius 200)
// - Variants : primary (bg #14161C / texte #FFFFFF) · invert (bg #FFFFFF / texte #14161C)
// - Sizes : sm (padding 12/6 vertical) · lg (avec icône cercle 26px à gauche)
// - Typography : Objectivity Medium 16px, lh 1.25, ls -0.48
// - Gap : 6px (x-small)

import type { ReactNode } from 'react'
import { PX } from './tokens'

export type PxBadgeVariant = 'primary' | 'invert'
export type PxBadgeSize = 'sm' | 'lg'

interface PxBadgeProps {
  children: ReactNode
  variant?: PxBadgeVariant
  size?: PxBadgeSize
  icon?: ReactNode    // icône optionnelle (à gauche pour sm, dans cercle pour lg)
  className?: string
}

export default function PxBadge({
  children,
  variant = 'primary',
  size = 'sm',
  icon,
  className,
}: PxBadgeProps) {
  const isLarge = size === 'lg'
  const isPrimary = variant === 'primary'

  const bg = isPrimary ? PX.neutral700 : PX.neutral100
  const textColor = isPrimary ? PX.neutral100 : PX.neutral700

  // Padding asymétrique en variant large (place pour le cercle à gauche)
  const padLeft = isLarge ? 6 : 12
  const padRight = 12
  const padY = 6

  // Couleur du cercle interne en variant large
  const innerCircleBg = isPrimary ? PX.neutral500 : PX.neutral400
  const innerIconColor = PX.neutral100

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingLeft: padLeft,
        paddingRight: padRight,
        paddingTop: padY,
        paddingBottom: padY,
        borderRadius: PX.radius.pill,
        background: bg,
        color: textColor,
        fontFamily: PX.font.sans,
        fontWeight: 500,
        fontSize: 16,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        whiteSpace: 'nowrap',
      }}>
      {icon && isLarge && (
        <span style={{
          width: 26, height: 26,
          borderRadius: PX.radius.pill,
          background: innerCircleBg,
          color: innerIconColor,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          {icon}
        </span>
      )}
      {icon && !isLarge && (
        <span style={{
          width: 16, height: 16,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          {icon}
        </span>
      )}
      <span style={{ paddingTop: 2, display: 'inline-block' }}>{children}</span>
    </span>
  )
}
