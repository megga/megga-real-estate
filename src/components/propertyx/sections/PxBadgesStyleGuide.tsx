// MEGGA Marketplace — Property X "🎖️ Badges" styleguide section.
// Source : Figma node 11708:31239 — code Figma EXACT.
//
// Page UI Kit Badges : shell partagé (PxStyleguideShell) + 1 showcase :
//   - 4 PxBadge : primary/invert × sm/lg
//   - Variant sm utilise icône megaphone (V41) inline 16px
//   - Variant lg utilise icône star (V25) inside un cercle 26px

import { PX, PxBadge, PxFigmaIcon } from '..'
import PxStyleguideShell, { PxStyleguideSectionTitle, PxStyleguideShowcase } from './PxStyleguideShell'

export default function PxBadgesStyleGuide() {
  return (
    <PxStyleguideShell selected="badges" title="Badge" iconName="badges-regular">
      <div data-node-id="11708:31247" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
        <PxStyleguideSectionTitle title="Badge" />
        <div style={{ marginTop: 24 }}>
          <PxStyleguideShowcase>
            {/* SM dark : megaphone 16px + texte blanc */}
            <PxBadge
              variant="primary"
              size="sm"
              icon={<PxFigmaIcon name="badge-megaphone" size={16} color={PX.neutral100} />}
            >
              Default
            </PxBadge>
            {/* LG dark : star dans cercle neutral500 + texte blanc */}
            <PxBadge
              variant="primary"
              size="lg"
              icon={<PxFigmaIcon name="badge-featured-star" size={14.857} color={PX.neutral100} />}
            >
              Default
            </PxBadge>
            {/* SM white : megaphone 16px + texte sombre */}
            <PxBadge
              variant="invert"
              size="sm"
              icon={<PxFigmaIcon name="badge-megaphone" size={16} color={PX.neutral700} />}
            >
              Default
            </PxBadge>
            {/* LG white : star dans cercle neutral400 + texte sombre */}
            <PxBadge
              variant="invert"
              size="lg"
              icon={<PxFigmaIcon name="badge-featured-star" size={14.857} color={PX.neutral100} />}
            >
              Default
            </PxBadge>
          </PxStyleguideShowcase>
        </div>
      </div>
    </PxStyleguideShell>
  )
}
