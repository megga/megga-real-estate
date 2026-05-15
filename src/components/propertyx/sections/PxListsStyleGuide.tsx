// MEGGA Marketplace — Property X "🎛️ Lists" styleguide section.
// Source : Figma node 11723:19659 — code Figma EXACT.
//
// Page UI Kit Lists : shell partagé (PxStyleguideShell) + showcase split bg :
//   - Panneau gauche light gray #EEEFF1 avec border-dashed (852×356)
//   - Panneau droit dark #14161C (426×356) avec right-side rounded
//   - Grille 4 lignes × 6 colonnes (3 Icon/Bullet/Number × 2 bg light/dark)
//   - Variantes par ligne : sm-regular / sm-medium / lg-regular / lg-medium

import { PX, PxFigmaIcon } from '..'
import PxStyleguideShell, { PxStyleguideSectionTitle } from './PxStyleguideShell'

type ListType = 'icon' | 'bullet' | 'number'
type ListSize = 'sm' | 'lg'
type ListWeight = 'regular' | 'medium'

interface ListItemProps {
  type: ListType
  size: ListSize
  weight: ListWeight
  white?: boolean
  text?: string
  number?: string
}

function ListItem({ type, size, weight, white = false, text = 'List item', number = '1.' }: ListItemProps) {
  const isSmall = size === 'sm'
  const fontSize = isSmall ? 14 : 16
  const ls = isSmall ? '-0.42px' : '-0.48px'
  const fontWeight = weight === 'medium' ? 500 : 400
  const color = white ? PX.neutral100 : PX.neutral700

  // Bullet sizes : sm 4px / lg 5px (Figma exact)
  const bulletSize = isSmall ? 4 : 5

  return (
    <div
      style={{
        display: 'flex',
        gap: 6,                                 // lists/gaps/gap-regular
        alignItems: 'center',
      }}
    >
      {type === 'icon' && (
        <span
          style={{
            width: 14,
            height: 14,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
            flexShrink: 0,
          }}
        >
          <PxFigmaIcon name="check-circle" size={12.6} color={color} />
        </span>
      )}
      {type === 'bullet' && (
        <span
          style={{
            width: bulletSize,
            height: bulletSize,
            borderRadius: '50%',
            background: color,
            flexShrink: 0,
          }}
        />
      )}
      {type === 'number' && (
        <span
          style={{
            margin: 0,
            fontFamily: PX.font.sans,
            fontWeight,
            fontSize,
            lineHeight: 1.25,
            letterSpacing: ls,
            color,
            textAlign: 'right',
            whiteSpace: 'nowrap',
          }}
        >
          {number}
        </span>
      )}
      <span
        style={{
          margin: 0,
          fontFamily: PX.font.sans,
          fontWeight,
          fontSize,
          lineHeight: 1.25,
          letterSpacing: ls,
          color,
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </span>
    </div>
  )
}

// 4 lignes × 3 colonnes (Icon/Bullet/Number) — variantes : sm-regular, sm-medium, lg-regular, lg-medium
const ROWS: ReadonlyArray<{ size: ListSize; weight: ListWeight }> = [
  { size: 'sm', weight: 'regular' },
  { size: 'sm', weight: 'medium' },
  { size: 'lg', weight: 'regular' },
  { size: 'lg', weight: 'medium' },
]

function ListsHalf({ white }: { white: boolean }) {
  return (
    <div
      style={{
        flex: '0 0 426px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 16,
        paddingLeft: 60,
        paddingRight: 16,
      }}
    >
      {ROWS.map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: 40, alignItems: 'center' }}>
          <div style={{ flex: '0 0 90px' }}>
            <ListItem type="icon" size={row.size} weight={row.weight} white={white} />
          </div>
          <div style={{ flex: '0 0 90px' }}>
            <ListItem type="bullet" size={row.size} weight={row.weight} white={white} />
          </div>
          <div style={{ flex: '0 0 90px' }}>
            <ListItem type="number" size={row.size} weight={row.weight} white={white} />
          </div>
        </div>
      ))}
    </div>
  )
}

function ListsShowcase() {
  return (
    <div
      data-node-id="11723:19668"
      style={{
        position: 'relative',
        width: 852,
        height: 356,
        borderRadius: PX.radius.large,
      }}
    >
      {/* Light gray bg with dashed border — node 11723:19669 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: PX.neutral300,
          border: `1.5px dashed ${PX.neutral500}`,
          borderRadius: PX.radius.large,
          boxShadow: PX.shadow.regular,
        }}
      />
      {/* Dark right panel (426×356) — node 11723:19670 */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: 426,
          height: 356,
          background: PX.neutral700,
          borderTopRightRadius: PX.radius.large,
          borderBottomRightRadius: PX.radius.large,
        }}
      />

      {/* Grille de 24 items (12 par panneau) */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <ListsHalf white={false} />
        <ListsHalf white={true} />
      </div>
    </div>
  )
}

export default function PxListsStyleGuide() {
  return (
    <PxStyleguideShell selected="lists" title="Lists" iconName="lists-regular">
      <div data-node-id="11723:19667" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', gap: 40 }}>
        <PxStyleguideSectionTitle title="Lists item" />
        <ListsShowcase />
      </div>
    </PxStyleguideShell>
  )
}
