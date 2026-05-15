// MEGGA Marketplace — Property X "🎨 Color Styles" styleguide section.
// Source : Figma node 11703:26465 — code Figma EXACT.
//
// Page UI Kit Color Styles : shell partagé (tab="styles") + 2 sections :
//   - Primary colors : 1 Master Color Card (Accent = #14161C)
//   - Neutral Colors : 7 Master Color Cards (100 #FFFFFF → 700 #14161C)
//
// Chaque carte : 232×236, bg blanc, border neutral300, radius 16, shadow small.
// Color Block intérieur : flex-1, bg = la couleur, radius 8.
// Label (Accent / 100 / 200...) + HEX badge.

import { PX } from '..'
import PxStyleguideShell, { PxStyleguideSectionTitle } from './PxStyleguideShell'

interface ColorCardProps {
  label: string
  hex: string  // ex: 'FFFFFF', '14161C'
  blockBg: string  // ex: '#FFFFFF', '#14161C'
}

function MasterColorCard({ label, hex, blockBg }: ColorCardProps) {
  return (
    <div
      data-node-id="11703:26473"
      style={{
        background: PX.neutral100,
        border: `1px solid ${PX.neutral300}`,
        borderRadius: PX.radius.medium,    // 16px
        boxShadow: PX.shadow.small,
        width: 232,
        height: 236,
        minWidth: 230,
        padding: PX.space.large,           // 16px
        display: 'flex',
        flexDirection: 'column',
        gap: PX.space.large,
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        flexShrink: 0,
      }}
    >
      {/* Color Block : flex-1, bg = la couleur, border 1px neutral300, radius 8 (small) */}
      <div
        style={{
          flex: '1 0 0',
          minHeight: 0,
          width: '100%',
          background: blockBg,
          border: `1px solid ${PX.neutral300}`,
          borderRadius: PX.radius.tiny,    // 8px
        }}
      />

      {/* Flex Horizontal : label + HEX badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
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
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </p>
        {/* Color HEX badge : bg neutral200, border neutral300, radius 8, padding 8 horizontal, color neutral400 */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 8,
            paddingBottom: 6,
            background: PX.neutral200,
            border: `1px solid ${PX.neutral300}`,
            borderRadius: PX.radius.tiny,
            overflow: 'hidden',
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
              color: PX.neutral400,
            }}
          >
            #
          </p>
          <p
            style={{
              margin: 0,
              fontFamily: PX.font.sans,
              fontWeight: 500,
              fontSize: 14,
              lineHeight: 1.25,
              letterSpacing: '-0.42px',
              color: PX.neutral400,
              whiteSpace: 'nowrap',
            }}
          >
            {hex}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Neutral colors (100→700) — exact tokens PX ───────────────────────
const NEUTRALS: ReadonlyArray<{ label: string; hex: string; bg: string }> = [
  { label: '100', hex: 'FFFFFF', bg: PX.neutral100 },
  { label: '200', hex: 'FAFAFB', bg: PX.neutral200 },
  { label: '300', hex: 'EEEFF1', bg: PX.neutral300 },
  { label: '400', hex: 'A4A6B0', bg: PX.neutral400 },
  { label: '500', hex: '464851', bg: PX.neutral500 },
  { label: '600', hex: '202127', bg: PX.neutral600 },
  { label: '700', hex: '14161C', bg: PX.neutral700 },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', gap: 40 }}>
      <PxStyleguideSectionTitle title={title} />
      {children}
    </div>
  )
}

export default function PxColorStylesGuide() {
  return (
    <PxStyleguideShell
      tab="styles"
      selected="colors"
      title="Colors"
      iconName="colors-regular"
    >
      {/* ─── Primary colors : Accent ─── */}
      <Section title="Primary colors">
        <div data-node-id="11703:26471" style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
          <MasterColorCard label="Accent" hex="14161C" blockBg={PX.neutral700} />
        </div>
      </Section>

      {/* ─── Neutral Colors : 100 → 700 ─── */}
      <Section title="Neutral Colors">
        <div
          data-node-id="11703:26495"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 24,
            width: '100%',
          }}
        >
          {NEUTRALS.map(n => (
            <MasterColorCard
              key={n.label}
              label={n.label}
              hex={n.hex}
              blockBg={n.bg}
            />
          ))}
        </div>
      </Section>
    </PxStyleguideShell>
  )
}
