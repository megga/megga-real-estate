// MEGGA Pro — Eyebrow badge canonique Property X.
// Pattern fidèle PxTestimonials/PxAboutSection/PxFeaturedProperties Figma :
// pill neutral300/100×26 cercle neutral400 + PxFigmaIcon réelle + texte 16px.
//
// Variants :
// - LIGHT (sur fond clair) : bg neutral300, circle neutral400, icon white,
//   text neutral700
// - INVERT (sur fond dark)  : bg rgba(255,255,255,0.08), circle
//   rgba(255,255,255,0.16), icon white, text white

import { PX, PxFigmaIcon } from '../..'
import type { PxFigmaIconName } from '../..'

interface PxProBadgeProps {
  icon: PxFigmaIconName
  children: React.ReactNode
  invert?: boolean
}

export default function PxProBadge({ icon, children, invert = false }: PxProBadgeProps) {
  const pillBg = invert ? 'rgba(255,255,255,0.08)' : PX.neutral300
  const circleBg = invert ? 'rgba(255,255,255,0.16)' : PX.neutral400
  const textColor = invert ? PX.neutral100 : PX.neutral700

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 6,
        paddingRight: 12,
        paddingTop: 6,
        paddingBottom: 6,
        background: pillBg,
        borderRadius: PX.radius.pill,
      }}
    >
      <span
        style={{
          width: 26,
          height: 26,
          borderRadius: PX.radius.pill,
          background: circleBg,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <PxFigmaIcon name={icon} size={14.857} color={PX.neutral100} />
      </span>
      <span
        style={{
          paddingTop: 2,
          fontFamily: PX.font.display,
          fontSize: 16,
          fontWeight: 500,
          lineHeight: 1.25,
          letterSpacing: '-0.48px',
          color: textColor,
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </span>
    </span>
  )
}
