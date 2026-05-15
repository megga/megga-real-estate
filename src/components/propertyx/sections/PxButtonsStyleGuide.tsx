// MEGGA Marketplace — Property X "🧱 Buttons" styleguide section.
// Source : Figma node 11706:23422 — code Figma EXACT.
//
// Page UI Kit Buttons : shell partagé (PxStyleguideShell) + 2 sections internes :
//   - Primary Button : 4 PxButton (primary/invert × sm/lg)
//   - Logo Text (mis-titré dans Figma) : 4 PxCircleButton (dark/light × sm/lg) avec chevron-left

import { PX, PxButton, PxCircleButton, PxFigmaIcon } from '..'
import PxStyleguideShell, { PxStyleguideSectionTitle, PxStyleguideShowcase } from './PxStyleguideShell'

export default function PxButtonsStyleGuide() {
  return (
    <PxStyleguideShell selected="buttons" title="Button" iconName="buttons-regular">
      {/* ─── Primary Button section ─── */}
      <div data-node-id="11706:23430" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
        <PxStyleguideSectionTitle title="Primary Button" />
        <div style={{ marginTop: 24 }}>
          <PxStyleguideShowcase>
            <PxButton variant="primary" size="sm">Default</PxButton>
            <PxButton variant="primary" size="lg">Default</PxButton>
            <PxButton variant="invert" size="sm">Default</PxButton>
            <PxButton variant="invert" size="lg">Default</PxButton>
          </PxStyleguideShowcase>
        </div>
      </div>

      {/* ─── Logo Text section (mis-titré dans Figma — montre les Circle Buttons) ─── */}
      <div data-node-id="11706:23437" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
        <PxStyleguideSectionTitle title="Logo Text" />
        <div style={{ marginTop: 24 }}>
          <PxStyleguideShowcase>
            <PxCircleButton variant="light" size="sm">
              <PxFigmaIcon name="chevron-left" size={12} color={PX.neutral700} />
            </PxCircleButton>
            <PxCircleButton variant="light" size="lg">
              <PxFigmaIcon name="chevron-left" size={12} color={PX.neutral700} />
            </PxCircleButton>
            <PxCircleButton variant="dark" size="sm">
              <PxFigmaIcon name="chevron-left" size={12} color={PX.neutral100} />
            </PxCircleButton>
            <PxCircleButton variant="dark" size="lg">
              <PxFigmaIcon name="chevron-left" size={12} color={PX.neutral100} />
            </PxCircleButton>
          </PxStyleguideShowcase>
        </div>
      </div>
    </PxStyleguideShell>
  )
}
