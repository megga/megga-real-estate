// MEGGA — Bien price card (port 1:1 du proto megga-bien-features.jsx
// PriceBlock + KpiRow combinés dans une Card wrapper).
// Affiché en haut de la colonne gauche sur /biens/:id.

import { formatCHF } from '@/lib/utils'

const M = {
  ink: '#0E1410',
  soft: '#4A5249',
  muted: '#847D6E',
  border: '#DDE2EA',
  card: '#FFFFFF',
  green: '#0041D9',
}
const FONT = '"Manrope", system-ui, -apple-system, sans-serif'

interface BienPriceCardProps {
  /** Prix actuel (current_price si baisse, sinon price ; ou rent si louer) */
  price: number
  /** Prix original (avant baisse) — affiche strikethrough + % de baisse */
  priceOriginal?: number | null
  /** Mode louer ou acheter */
  mode: 'louer' | 'acheter'
  /** Surface en m² (pour calcul prix au m²) */
  surface?: number | null
  /** Charges mensuelles (CHF) — affichées sous le prix au m² */
  charges?: number | null
  /** KPIs */
  rooms?: number | null
  bedrooms?: number | null
  bathrooms?: number | null
}

interface KpiProps {
  label: string
  value: string
  sub?: string
}

function Kpi({ label, value, sub }: KpiProps) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        padding: '18px 18px',
        background: '#fff',
        border: `1px solid ${M.border}`,
        borderRadius: 12,
      }}
    >
      <div
        style={{
          fontFamily: FONT,
          fontSize: 11,
          fontWeight: 700,
          color: M.muted,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: FONT,
          fontSize: 24,
          fontWeight: 700,
          color: M.ink,
          marginTop: 6,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: -0.3,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontFamily: FONT,
            fontSize: 11,
            color: M.muted,
            marginTop: 2,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  )
}

export default function BienPriceCard({
  price,
  priceOriginal,
  mode,
  surface,
  charges,
  rooms,
  bedrooms,
  bathrooms,
}: BienPriceCardProps) {
  const isLouer = mode === 'louer'
  const hasReduced = !isLouer && priceOriginal && priceOriginal > price
  const ppm = !isLouer && surface ? Math.round(price / surface) : null
  const reductionPct = hasReduced ? Math.round((1 - price / priceOriginal!) * 100) : null

  return (
    <div
      style={{
        background: M.card,
        border: `1px solid ${M.border}`,
        borderRadius: 16,
        padding: 24,
        fontFamily: FONT,
      }}
    >
      {/* Price block */}
      <div style={{ marginBottom: 18 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              fontFamily: FONT,
              fontSize: 'clamp(28px, 4vw, 36px)',
              fontWeight: 800,
              color: M.ink,
              letterSpacing: -1,
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}
          >
            {formatCHF(price)}
            {isLouer && (
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: M.muted,
                  marginLeft: 6,
                }}
              >
                {' '}/ mois
              </span>
            )}
          </div>
          {hasReduced && priceOriginal && (
            <>
              <span
                style={{
                  fontFamily: FONT,
                  fontSize: 18,
                  fontWeight: 600,
                  color: M.muted,
                  textDecoration: 'line-through',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatCHF(priceOriginal)}
              </span>
              <span
                style={{
                  padding: '5px 10px',
                  borderRadius: 999,
                  background: M.green,
                  color: '#fff',
                  fontFamily: FONT,
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 0.4,
                }}
              >
                −{reductionPct}% baisse
              </span>
            </>
          )}
        </div>
        {ppm && (
          <div
            style={{
              fontFamily: FONT,
              fontSize: 13,
              color: M.muted,
              marginTop: 6,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatCHF(ppm)} / m²
            {charges && charges > 0 && (
              <> · Charges {formatCHF(charges)}/mois</>
            )}
          </div>
        )}
        {isLouer && (
          <div
            style={{
              fontFamily: FONT,
              fontSize: 13,
              color: M.muted,
              marginTop: 6,
            }}
          >
            {charges && charges > 0
              ? `Charges ${formatCHF(charges)}/mois en sus`
              : 'Charges comprises · Bail 12 mois minimum'}
          </div>
        )}
      </div>

      {/* KPI row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          gap: 10,
        }}
      >
        <Kpi label="Pièces" value={rooms ? String(rooms) : '—'} />
        <Kpi label="Surface" value={surface ? `${surface} m²` : '—'} />
        <Kpi label="Chambres" value={bedrooms ? String(bedrooms) : '—'} />
        <Kpi label="Salles d'eau" value={bathrooms ? String(bathrooms) : '—'} />
      </div>
    </div>
  )
}
