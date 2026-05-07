// MEGGA — Performance énergétique CECB (port 1:1 du proto megga-bien-features.jsx
// EnergyBlock).
// Combined CECB scale (A→G horizontal bands with arrow tip on active grade)
// + kWh/m²/an consumption tile (right column).

const M = {
  ink: '#0E1410',
  soft: '#3F4640',
  muted: '#7A8079',
  border: '#E6E8EC',
  green: '#0041D9',
  cardSoft: '#F6F8FC',
}
const FONT = '"Manrope", system-ui, -apple-system, sans-serif'

const GRADES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const
type EnergyGrade = (typeof GRADES)[number]
const COLORS = ['#1F8A4F', '#52A847', '#9DC23F', '#F0C53A', '#EE9A3A', '#DA5F2C', '#A93D26']

interface BienEnergyBlockProps {
  energyLabel?: string | null
  energyKwh?: number | null
  energyYear?: number | null
}

export default function BienEnergyBlock({
  energyLabel,
  energyKwh,
  energyYear,
}: BienEnergyBlockProps) {
  const grade = (energyLabel || '').toUpperCase() as EnergyGrade
  const idx = GRADES.indexOf(grade)
  // Always render the scale; show "non communiqué" when no valid grade
  const hasGrade = idx !== -1

  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${M.border}`,
        borderRadius: 14,
        padding: 22,
        fontFamily: FONT,
      }}
    >
      {/* SectionTitle proto */}
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
          Performance énergétique
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
          Certificat CECB
        </h2>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: energyKwh ? 'minmax(0, 1fr) 280px' : '1fr',
          gap: 28,
          alignItems: 'center',
        }}
      >
        {/* Scale A→G */}
        <div>
          <div
            style={{
              display: 'flex',
              height: 56,
              borderRadius: 10,
              overflow: 'hidden',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
            }}
          >
            {GRADES.map((g, i) => (
              <div
                key={g}
                style={{
                  flex: 1,
                  background: COLORS[i],
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  fontWeight: 800,
                  position: 'relative',
                  outline: i === idx ? `3px solid ${M.ink}` : 'none',
                  outlineOffset: i === idx ? -3 : 0,
                  zIndex: i === idx ? 2 : 1,
                }}
              >
                {g}
                {i === idx && (
                  <div
                    style={{
                      position: 'absolute',
                      top: -10,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 0,
                      height: 0,
                      borderLeft: '6px solid transparent',
                      borderRight: '6px solid transparent',
                      borderTop: `8px solid ${M.ink}`,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 8,
              fontSize: 11,
              color: M.muted,
              fontWeight: 600,
            }}
          >
            <span>Très efficace</span>
            <span>Peu efficace</span>
          </div>
          {!hasGrade && (
            <div
              style={{
                marginTop: 14,
                padding: '10px 14px',
                borderRadius: 10,
                background: M.cardSoft,
                border: `1px solid ${M.border}`,
                fontSize: 12,
                color: M.muted,
                lineHeight: 1.5,
              }}
            >
              Le certificat énergétique cantonal des bâtiments (CECB) n'est pas
              encore renseigné pour ce bien. Demandez-le à l'agent.
            </div>
          )}
        </div>

        {/* kWh tile */}
        {energyKwh ? (
          <div
            style={{
              background: M.cardSoft,
              borderRadius: 12,
              padding: 18,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: M.muted,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
              }}
            >
              Consommation
            </div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                color: M.ink,
                marginTop: 4,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: -0.5,
              }}
            >
              {energyKwh}
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: M.muted,
                  marginLeft: 4,
                }}
              >
                kWh/m²/an
              </span>
            </div>
            {energyYear && (
              <div
                style={{
                  fontSize: 11,
                  color: M.muted,
                  marginTop: 6,
                }}
              >
                Certificat CECB · {energyYear}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
