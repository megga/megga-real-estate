// MEGGA — Section Caractéristiques + Équipements (port 1:1 proto
// megga-bien-features.jsx SpecsBlock).
//
// Comportement :
// - Si `features` est un Record<string, string> → rendu en 2-col SpecRows
//   (label gauche muted, valeur droite ink semibold tabular-nums)
// - Si `features` est string[] → rendu en pills bleues avec check icon
//   (proto "Équipements" section)
// - Card wrapper unifiée avec SectionTitle (eyebrow blue + h2 ink)

interface ListingFeaturesProps {
  features: Record<string, string> | string[]
}

const M = {
  ink: '#0E1410',
  muted: '#847D6E',
  border: '#DDE2EA',
  green: '#0041D9',
  pillBg: '#E8EFFE',
}
const FONT = '"Manrope", system-ui, -apple-system, sans-serif'

export default function ListingFeatures({ features }: ListingFeaturesProps) {
  const isArray = Array.isArray(features)
  const equipments = isArray ? features : []
  const specEntries = !isArray ? Object.entries(features) : []

  if (isArray && equipments.length === 0) return null
  if (!isArray && specEntries.length === 0) return null

  // Split specs into two cols (proto layout)
  const half = Math.ceil(specEntries.length / 2)
  const left = specEntries.slice(0, half)
  const right = specEntries.slice(half)

  return (
    <div
      id="caracteristiques"
      className="scroll-mt-28"
      style={{
        background: '#fff',
        border: `1px solid ${M.border}`,
        borderRadius: 14,
        padding: 22,
        fontFamily: FONT,
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: M.green,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          {isArray ? 'Équipements' : 'Caractéristiques'}
        </div>
        <h2
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: M.ink,
            margin: 0,
            letterSpacing: -0.5,
          }}
        >
          {isArray ? 'Ce que le bien inclut' : 'Tout savoir sur le bien'}
        </h2>
      </div>

      {isArray ? (
        // Pills équipements — port proto SpecsBlock.features pills
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {equipments.map(f => (
            <span
              key={f}
              style={{
                height: 30,
                padding: '0 14px',
                borderRadius: 999,
                background: M.pillBg,
                color: M.green,
                fontFamily: FONT,
                fontSize: 12,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path
                  d="M2 5l2 2 4-5"
                  stroke={M.green}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {f}
            </span>
          ))}
        </div>
      ) : (
        // 2-col SpecRows — port proto SpecsBlock specs
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '0 40px',
          }}
        >
          <div>
            {left.map(([key, value]) => (
              <SpecRow key={key} label={key} value={value} />
            ))}
          </div>
          <div>
            {right.map(([key, value]) => (
              <SpecRow key={key} label={key} value={value} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '11px 0',
        borderBottom: `1px solid ${M.border}`,
        fontFamily: FONT,
      }}
    >
      <span style={{ fontSize: 13, color: M.muted, fontWeight: 500 }}>
        {label}
      </span>
      {value && (
        <span
          style={{
            fontSize: 13,
            color: M.ink,
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </span>
      )}
    </div>
  )
}
