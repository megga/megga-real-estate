// MEGGA Marketplace — Property X "✍️ Typography Styles" styleguide section.
// Source : Figma node 11703:26347 — code Figma EXACT.
//
// Page UI Kit Typography : shell partagé (tab="styles") + 3 sections :
//   - Font Family : carte Objectivity (alphabet + weights + Aa preview + Download Font button)
//   - Display : table 10 lignes (Display 10 → Display 1) avec size + line-height + weights
//   - Paragraph : table 3 lignes (Large / Default / Small) avec size + line-height + weights
//
// Tous les sizes / line-heights matches PX.type.display* exactement.

import { PX, PxButton, PxFigmaIcon } from '..'
import PxStyleguideShell, { PxStyleguideSectionTitle } from './PxStyleguideShell'

// ─── Weight chip (Regular / Medium / Extra Bold) ──────────────────────
function WeightChip({ label, active }: { label: string; active?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 8,
        paddingBottom: 6,
        background: active ? PX.neutral700 : PX.neutral200,
        border: `1px solid ${active ? PX.neutral700 : PX.neutral300}`,
        borderRadius: PX.radius.tiny,
        fontFamily: PX.font.sans,
        fontWeight: active ? 700 : 500,
        fontSize: 14,
        lineHeight: 1.25,
        letterSpacing: '-0.42px',
        color: active ? PX.neutral100 : PX.neutral400,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

// ─── Weight chips row (Regular, Medium, Extra Bold) — Extra Bold active ─
function WeightChipsRow() {
  return (
    <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
      <WeightChip label="Regular" />
      <WeightChip label="Medium" />
      <WeightChip label="Extra Bold" active />
    </div>
  )
}

// ─── Section : Font Family card ───────────────────────────────────────
function FontFamilyCard() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 24,
        padding: 32,
        background: PX.neutral100,
        border: `1px solid ${PX.neutral300}`,
        borderRadius: PX.radius.medium,
        boxShadow: PX.shadow.small,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Left : Objectivity title + weights + alphabet + button */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p
            style={{
              margin: 0,
              fontFamily: PX.font.sans,
              fontWeight: 500,
              fontSize: 20,
              lineHeight: 1.25,
              letterSpacing: '-0.6px',
              color: PX.neutral700,
            }}
          >
            Objectivity
          </p>
          <WeightChipsRow />
          <p
            style={{
              margin: 0,
              fontFamily: PX.font.sans,
              fontWeight: 400,
              fontSize: 16,
              lineHeight: 1.5,
              letterSpacing: '-0.48px',
              color: PX.neutral700,
              maxWidth: 360,
            }}
          >
            Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk Ll Mm Nn Oo Pp Qq Rr Ss Tt Uu Vv Ww Xx Yy Zz
          </p>
        </div>
        <div>
          <PxButton variant="primary" size="sm">Download Font</PxButton>
        </div>
      </div>
      {/* Right : huge Aa preview */}
      <div style={{
        flex: '0 0 280px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <p
          style={{
            margin: 0,
            fontFamily: PX.font.sans,
            fontWeight: 700,
            fontSize: 200,
            lineHeight: 1,
            letterSpacing: '-6px',
            color: PX.neutral700,
          }}
        >
          Aa
        </p>
      </div>
    </div>
  )
}

// ─── Style row : Display N or Paragraph X ─────────────────────────────
interface StyleRowProps {
  label: string
  size: number      // ex: 72
  lineHeight: number // ex: 1.10 → "110%"
  isParagraph?: boolean  // affecte le wrap du texte / display
}

function StyleRow({ label, size, lineHeight, isParagraph }: StyleRowProps) {
  const ls = `${-(size * 0.03).toFixed(2)}px`
  // Texte affiché : pour les paragraphes, Lorem ipsum (Figma : "Gravida vulputate ...")
  const labelText = isParagraph
    ? `${label} — Gravida vulputate scelerisque dui at aliquam pt. Nec purus nisl a tellus velit tellus.`
    : label

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        padding: 24,
        background: PX.neutral100,
        border: `1px solid ${PX.neutral300}`,
        borderRadius: PX.radius.medium,
        boxShadow: PX.shadow.small,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Text Style preview — flex 1, no ellipsis (Display 10 doit s'afficher en entier) */}
      <p
        style={{
          margin: 0,
          flex: 1,
          minWidth: 0,
          fontFamily: PX.font.sans,
          fontWeight: isParagraph ? 500 : 500,
          fontSize: size,
          lineHeight,
          letterSpacing: ls,
          color: PX.neutral700,
          whiteSpace: 'normal',
        }}
      >
        {labelText}
      </p>
      {/* Size */}
      <div style={{ width: 80, fontFamily: PX.font.sans, fontSize: 14, color: PX.neutral400, fontWeight: 400, letterSpacing: '-0.42px' }}>
        {size}px
      </div>
      {/* Line height */}
      <div style={{ width: 100, fontFamily: PX.font.sans, fontSize: 14, color: PX.neutral400, fontWeight: 400, letterSpacing: '-0.42px' }}>
        {Math.round(lineHeight * 100)}%
      </div>
      {/* Weights */}
      <div style={{ width: 230 }}>
        <WeightChipsRow />
      </div>
    </div>
  )
}

// ─── Table header (Text Style | Size | Line Height | Weights) ─────────
function TableHeader() {
  const cellStyle: React.CSSProperties = {
    fontFamily: PX.font.sans,
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 1.25,
    letterSpacing: '-0.42px',
    color: PX.neutral400,
    textTransform: 'uppercase' as const,
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        paddingLeft: 24,
        paddingRight: 24,
        paddingBottom: 12,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <p style={{ ...cellStyle, flex: 1, margin: 0 }}>Text Style</p>
      <p style={{ ...cellStyle, width: 80, margin: 0 }}>Size</p>
      <p style={{ ...cellStyle, width: 100, margin: 0 }}>Line Height</p>
      <p style={{ ...cellStyle, width: 230, margin: 0 }}>Weights</p>
    </div>
  )
}

// ─── Section helper ──────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', gap: 16 }}>
      <PxStyleguideSectionTitle title={title} />
      {children}
    </div>
  )
}

// ─── Display rows config (10 → 1) ─────────────────────────────────────
const DISPLAYS: ReadonlyArray<{ n: number; size: number; lh: number }> = [
  { n: 10, size: 72, lh: 1.10 },
  { n:  9, size: 60, lh: 1.15 },
  { n:  8, size: 48, lh: 1.25 },
  { n:  7, size: 36, lh: 1.25 },
  { n:  6, size: 30, lh: 1.25 },
  { n:  5, size: 24, lh: 1.25 },
  { n:  4, size: 22, lh: 1.25 },
  { n:  3, size: 20, lh: 1.25 },
  { n:  2, size: 18, lh: 1.25 },
  { n:  1, size: 16, lh: 1.25 },
]

const PARAGRAPHS: ReadonlyArray<{ label: string; size: number; lh: number }> = [
  { label: 'Paragraph Large',   size: 24, lh: 1.5 },
  { label: 'Paragraph Default', size: 18, lh: 1.5 },
  { label: 'Paragraph Small',   size: 14, lh: 1.5 },
]

export default function PxTypographyStylesGuide() {
  return (
    <PxStyleguideShell
      tab="styles"
      selected="typography"
      title="Typography"
      iconName="typography-regular"
    >
      {/* ─── Font Family ─── */}
      <Section title="Font Family">
        <FontFamilyCard />
      </Section>

      {/* ─── Display (10 rows) ─── */}
      <Section title="Display">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
          <TableHeader />
          {DISPLAYS.map(d => (
            <StyleRow
              key={d.n}
              label={`Display ${d.n}`}
              size={d.size}
              lineHeight={d.lh}
            />
          ))}
        </div>
      </Section>

      {/* ─── Paragraph (3 rows) ─── */}
      <Section title="Paragraph">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
          <TableHeader />
          {PARAGRAPHS.map(p => (
            <StyleRow
              key={p.label}
              label={p.label}
              size={p.size}
              lineHeight={p.lh}
              isParagraph
            />
          ))}
        </div>
      </Section>
    </PxStyleguideShell>
  )
}
