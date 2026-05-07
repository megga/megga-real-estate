// MEGGA — Bien specs block (port 1:1 du proto megga-bien-features.jsx SpecsBlock).
// 2-col detailed specs (Type, Année, Étage, Ascenseur, Surface, Terrain, Balcon,
// Terrasse / Parking, Cave, Buanderie, Charges, Vue, Orientation, État, Réf)
// + Équipements pills (E8EFFE bg, 0041D9 text, check icon).
//
// Diffère de ListingFeatures.tsx : ce composant a un schéma de specs FIXE qui
// matche exactement le proto, plutôt qu'un Record<string,string> ouvert. Il
// peut afficher les deux sections (specs + équipements) dans une seule Card.

import { formatCHF } from '@/lib/utils'

const M = {
  ink: '#0E1410',
  soft: '#3F4640',
  muted: '#7A8079',
  border: '#E6E8EC',
  green: '#0041D9',
  pillBg: '#E8EFFE',
}
const FONT = '"Manrope", system-ui, -apple-system, sans-serif'

const TYPE_LABEL: Record<string, string> = {
  appartement: 'Appartement',
  apartment: 'Appartement',
  maison: 'Maison',
  house: 'Maison',
  villa: 'Villa',
  chalet: 'Chalet',
  loft: 'Loft',
  studio: 'Studio',
  terrain: 'Terrain',
  land: 'Terrain',
  commercial: 'Commercial',
  office: 'Bureau',
  parking: 'Parking',
  storage: 'Dépôt',
}

const VIEW_LABEL: Record<string, string> = {
  lake: 'Lac',
  mountain: 'Montagne',
  city: 'Ville',
  green: 'Verdure',
}

const COND_LABEL: Record<string, string> = {
  new: 'Neuf',
  recent: 'Récent',
  good: 'Bon état',
  'to-refresh': 'À rafraîchir',
  'to-renovate': 'À rénover',
}

const ORIENT_LABEL: Record<string, string> = {
  S: 'Sud', SE: 'Sud-Est', SW: 'Sud-Ouest',
  E: 'Est', W: 'Ouest', N: 'Nord',
  NE: 'Nord-Est', NW: 'Nord-Ouest',
}

export interface BienSpecsBlockProps {
  bienId?: string | null
  type?: string | null
  yearBuilt?: number | null
  floor?: number | null
  floorsTotal?: number | null
  hasElevator?: boolean | null
  surfaceM2?: number | null
  gardenM2?: number | null
  balconyM2?: number | null
  terraceM2?: number | null
  parkingSpots?: number | null
  hasGarage?: boolean | null
  hasParking?: boolean | null
  hasCave?: boolean | null
  laundry?: 'private' | 'shared' | null
  chargesMonthly?: number | null
  view?: string | null
  orientation?: string | null
  condition?: string | null
  /** Pills équipements — proto: pills bleues avec check icon */
  equipments?: string[]
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
        gap: 12,
      }}
    >
      <span style={{ fontSize: 13, color: M.muted, fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <span
        style={{
          fontSize: 13,
          color: M.ink,
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          textAlign: 'right',
        }}
      >
        {value}
      </span>
    </div>
  )
}

export default function BienSpecsBlock({
  bienId,
  type,
  yearBuilt,
  floor,
  floorsTotal,
  hasElevator,
  surfaceM2,
  gardenM2,
  balconyM2,
  terraceM2,
  parkingSpots,
  hasGarage,
  hasParking,
  hasCave,
  laundry,
  chargesMonthly,
  view,
  orientation,
  condition,
  equipments,
}: BienSpecsBlockProps) {
  const dash = '—'

  // Build parking string
  const parkingValue = (() => {
    if (parkingSpots && parkingSpots > 0) {
      return `${parkingSpots} place${parkingSpots > 1 ? 's' : ''}`
    }
    if (hasGarage) return 'Garage'
    if (hasParking) return 'Oui'
    return dash
  })()

  // Build floor string
  const floorValue = (() => {
    if (floor != null && floorsTotal) return `${floor}/${floorsTotal}`
    if (floor != null) return String(floor)
    if (floorsTotal) return `${floorsTotal} niveaux`
    return dash
  })()

  const refValue = bienId ? `MG-${String(bienId).replace(/\D/g, '').padStart(5, '0').slice(0, 5) || '00000'}` : dash

  const left: Array<[string, string]> = [
    ['Type', type ? TYPE_LABEL[type.toLowerCase()] || (type[0].toUpperCase() + type.slice(1)) : dash],
    ['Année de construction', yearBuilt ? String(yearBuilt) : dash],
    ['Étage', floorValue],
    ['Ascenseur', hasElevator ? 'Oui' : (hasElevator === false ? 'Non' : dash)],
    ['Surface habitable', surfaceM2 ? `${surfaceM2} m²` : dash],
    ['Terrain / jardin', gardenM2 ? `${gardenM2} m²` : dash],
    ['Balcon', balconyM2 ? `${balconyM2} m²` : dash],
    ['Terrasse', terraceM2 ? `${terraceM2} m²` : dash],
  ]
  const right: Array<[string, string]> = [
    ['Parking', parkingValue],
    ['Cave', hasCave ? 'Oui' : (hasCave === false ? 'Non' : dash)],
    ['Buanderie', laundry === 'private' ? 'Privative' : (laundry === 'shared' ? 'Commune' : dash)],
    ['Charges', chargesMonthly && chargesMonthly > 0 ? `${formatCHF(chargesMonthly)} / mois` : dash],
    ['Vue', view ? VIEW_LABEL[view] || view : dash],
    ['Orientation', orientation ? ORIENT_LABEL[orientation] || orientation : dash],
    ['État général', condition ? COND_LABEL[condition] || condition : dash],
    ['Référence', refValue],
  ]

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
          Caractéristiques
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
          Tout savoir sur le bien
        </h2>
      </div>

      {/* 2-col specs grid (proto: gap 0 40px) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '0 40px',
        }}
      >
        <div>
          {left.map(([l, v]) => (
            <SpecRow key={l} label={l} value={v} />
          ))}
        </div>
        <div>
          {right.map(([l, v]) => (
            <SpecRow key={l} label={l} value={v} />
          ))}
        </div>
      </div>

      {/* Équipements pills (proto bottom of SpecsBlock) */}
      {equipments && equipments.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: M.muted,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 10,
            }}
          >
            Équipements
          </div>
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
        </div>
      )}
    </div>
  )
}
