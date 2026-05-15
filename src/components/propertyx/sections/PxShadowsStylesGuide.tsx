// MEGGA Marketplace — Property X "🌑 Shadow Styles" styleguide section.
// Source : Figma node 11703:26319 — code Figma EXACT.
//
// Page UI Kit Shadows : shell partagé (tab="styles") + 1 section "Neutral Shadows" :
//   - 4 cards 240×240 (Small / Regular / Medium / Large)
//   - Chaque card : bg white, 1px border neutral300, radius 24 (large), label centered
//   - Les ombres mappent exactement PX.shadow.small/regular/medium/large.

import { PX } from '..'
import PxStyleguideShell, { PxStyleguideSectionTitle } from './PxStyleguideShell'

interface ShadowCardProps {
  label: string
  shadow: string  // CSS box-shadow ou drop-shadow value
}

function ShadowCard({ label, shadow }: ShadowCardProps) {
  return (
    <div
      data-node-id="11703:26328"
      style={{
        width: 240,
        height: 240,
        background: PX.neutral100,
        border: `1px solid ${PX.neutral300}`,
        borderRadius: PX.radius.large,    // 24px
        boxShadow: shadow,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: PX.font.sans,
          fontWeight: 500,
          fontSize: 14,
          lineHeight: 1.25,
          letterSpacing: '-0.42px',
          color: PX.neutral700,
          textAlign: 'center',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </p>
    </div>
  )
}

// ─── 4 ombres Neutral/BS Small / Regular / Medium / Large ────────────
// Mappent exactement les tokens PX.shadow (déjà alignés sur Figma).
const SHADOWS: ReadonlyArray<{ label: string; shadow: string }> = [
  { label: 'Small',   shadow: PX.shadow.small },
  { label: 'Regular', shadow: PX.shadow.regular },
  { label: 'Medium',  shadow: PX.shadow.medium },
  { label: 'Large',   shadow: PX.shadow.large },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', gap: 40 }}>
      <PxStyleguideSectionTitle title={title} />
      {children}
    </div>
  )
}

export default function PxShadowsStylesGuide() {
  return (
    <PxStyleguideShell
      tab="styles"
      selected="shadows"
      title="Shadows"
      iconName="shadows-regular"
    >
      <Section title="Neutral Shadows">
        <div
          data-node-id="11703:26327"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 24,
            width: '100%',
          }}
        >
          {SHADOWS.map(s => (
            <ShadowCard key={s.label} label={s.label} shadow={s.shadow} />
          ))}
        </div>
      </Section>
    </PxStyleguideShell>
  )
}
