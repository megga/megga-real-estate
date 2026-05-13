// MEGGA Marketplace — Property X section eyebrow pill.
// Source : Figma Home V3 — "Section Wrapper Titles" / "Pill Wrapper".
// Pattern fidèle : pill clair avec petit cercle contenant l'icône à gauche
// + texte capitalize. Variante invert pour sections noires.
//
// Exemples :
//   <PxSectionLabel icon="user">À propos de MEGGA</PxSectionLabel>
//   <PxSectionLabel icon="star" invert>Biens vedettes</PxSectionLabel>

import type { ReactNode } from 'react'
import { PX } from './tokens'
import PxIcon, { type PxIconName } from './PxIcon'

interface PxSectionLabelProps {
  children: ReactNode
  /** Icône Lucide-like dans le cercle gauche. Default: `sparkle`. */
  icon?: PxIconName
  /** Variante pour sections à fond noir/dark. */
  invert?: boolean
}

export default function PxSectionLabel({
  children,
  icon = 'sparkle',
  invert = false,
}: PxSectionLabelProps) {
  // Couleurs fidèles à la pill Figma "About us" :
  // - pill bg : neutral200 clair (rgba blanc 6% en invert)
  // - circle bg : neutral300 (rgba blanc 12% en invert)
  // - icône color : neutral500 (blanc 72% en invert)
  // - texte color : neutral700 (blanc en invert)
  const pillBg = invert ? 'rgba(255,255,255,0.08)' : PX.neutral200
  const circleBg = invert ? 'rgba(255,255,255,0.16)' : PX.neutral300
  const iconColor = invert ? 'rgba(255,255,255,0.72)' : PX.neutral500
  const textColor = invert ? PX.neutral100 : PX.neutral700

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 12px 4px 4px',
        background: pillBg,
        borderRadius: PX.radius.pill,
        fontFamily: PX.font.display,
        fontSize: 13,
        fontWeight: 500,
        lineHeight: 1.25,
        letterSpacing: '-0.39px',
        color: textColor,
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: PX.radius.pill,
          background: circleBg,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <PxIcon name={icon} size={12} color={iconColor} />
      </span>
      {children}
    </span>
  )
}
