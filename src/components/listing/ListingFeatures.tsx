// MEGGA — Section Caractéristiques (port `megga-bien-features.jsx` SpecsBlock)
// Card wrapper + SectionTitle (eyebrow + h2) + 2-col grid de SpecRows.

interface ListingFeaturesProps {
  features: Record<string, string> | string[]
}

const FONT = '"Manrope", system-ui, -apple-system, sans-serif'

export default function ListingFeatures({ features }: ListingFeaturesProps) {
  const entries = Array.isArray(features)
    ? features.map((f) => [f, ''] as [string, string])
    : Object.entries(features)

  if (!entries.length) return null

  // Split entries into two columns to match proto's 2-col layout
  const half = Math.ceil(entries.length / 2)
  const left = entries.slice(0, half)
  const right = entries.slice(half)

  return (
    <div
      id="caracteristiques"
      className="mt-8 scroll-mt-28"
      style={{
        background: '#fff',
        border: '1px solid #DDE2EA',
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
            color: '#0041D9',
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          Caractéristiques
        </div>
        <h2
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: '#0E1410',
            margin: 0,
            letterSpacing: -0.5,
          }}
        >
          Tout savoir sur le bien
        </h2>
      </div>

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
        borderBottom: '1px solid #DDE2EA',
        fontFamily: FONT,
      }}
    >
      <span style={{ fontSize: 13, color: '#7A8079', fontWeight: 500 }}>
        {label}
      </span>
      {value && (
        <span
          style={{
            fontSize: 13,
            color: '#0E1410',
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
