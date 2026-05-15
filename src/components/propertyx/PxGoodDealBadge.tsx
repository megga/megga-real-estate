// MEGGA Marketplace — Property X "Bon prix" badge.
//
// Affiché sur les cartes quand le prix/m² du bien est ≤ 85% de la médiane
// cantonale pour son type. Source des médianes : materialized view
// `cantonal_price_medians` (migration 20260515_001), refreshée quotidiennement.
//
// Inspiré du Comparis Rating (seul à exposer un score d'opportunité prix
// en CH côté UX). Direction visuelle PropertyX = monochrome + petite icône
// check pour signaler une opportunité sans casser la palette neutre.

import { PX } from './tokens'
import PxFigmaIcon from './PxFigmaIcon'

interface PxGoodDealBadgeProps {
  /** Réduction (en %) par rapport à la médiane, pour le tooltip. Optionnel. */
  discountPct?: number
}

export default function PxGoodDealBadge({ discountPct }: PxGoodDealBadgeProps) {
  const title = discountPct
    ? `Prix au m² ${discountPct}% sous la médiane cantonale pour ce type de bien`
    : 'Prix au m² sous la médiane cantonale pour ce type de bien'

  return (
    <span
      title={title}
      aria-label={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 6,
        paddingRight: 10,
        paddingTop: 4,
        paddingBottom: 4,
        background: PX.neutral100,
        border: `1px solid ${PX.neutral700}`,
        borderRadius: PX.radius.pill,
        boxShadow: PX.shadow.small,
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          display: 'inline-grid',
          placeItems: 'center',
          background: PX.neutral700,
          borderRadius: PX.radius.pill,
          flexShrink: 0,
        }}
        aria-hidden
      >
        <PxFigmaIcon name="checkbox-check" size={10} color={PX.neutral100} />
      </span>
      <span
        style={{
          paddingTop: 2,
          fontFamily: PX.font.display,
          fontSize: 13,
          fontWeight: 500,
          lineHeight: 1.25,
          letterSpacing: '-0.39px',
          color: PX.neutral700,
          whiteSpace: 'nowrap',
        }}
      >
        Bon prix
      </span>
    </span>
  )
}
