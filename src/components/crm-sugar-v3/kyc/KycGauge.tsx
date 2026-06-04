// MEGGA CRM Sugar v3 — Jauge de progression KYC unifiée
// Port de crm-screen-kyc-sugar.jsx §KycGauge (handoff §4).
//
// Reprend le style de la jauge « Pipeline du jour » (anneau épais arrondi).
// DOUBLE ENCODAGE :
//   • longueur de l'arc + fraction au centre (done/total) → avancement contrôles
//   • couleur de l'arc → niveau de RISQUE (faible/modéré/élevé)
//   • halo de vigilance → modéré (ambre statique) · élevé (rouge STATIQUE)
// Un dossier risqué se repère donc même à 0/5. Remplace l'ancien anneau noir
// + la pilule de risque redondante en ligne.

import { useKycPalette, KYC_RISK_TONE } from './kycPalette'
import { KYC_RISK_LABELS } from '../tokens'
import type { KycRiskLevel } from '@/lib/constants'

interface Props {
  /** Contrôles complétés (numérateur). */
  done: number
  /** Contrôles au total (dénominateur). */
  total: number
  /** Niveau de risque → couleur de l'arc + halo. */
  risk: KycRiskLevel
  size?: number
}

export function KycGauge({ done, total, risk, size = 60 }: Props) {
  const sp = useKycPalette()
  const frac = total > 0 ? done / total : 0

  const riskKey = (risk in KYC_RISK_TONE ? risk : 'unassessed') as keyof typeof KYC_RISK_TONE
  const color = KYC_RISK_TONE[riskKey]
  const isHigh = risk === 'high'
  const isMed = risk === 'medium'
  const riskLabel = KYC_RISK_LABELS[risk as keyof typeof KYC_RISK_LABELS]?.label ?? 'Risque'

  const stroke = Math.max(5, Math.round(size * 0.12))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const off = c * (1 - frac)
  const big = size >= 80 ? 21 : 15

  return (
    <div
      className={isHigh ? 'kyc-halo-high' : undefined}
      title={`${riskLabel} · ${done}/${total} contrôles`}
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: 999,
        // Modéré → halo ambre statique. Élevé → classe .kyc-halo-high (rouge statique).
        boxShadow: isMed ? `0 0 14px 0 ${color}3A` : undefined,
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={sp.ringTrack}
          strokeWidth={stroke}
        />
        {frac > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={c}
            strokeDashoffset={off}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)' }}
          />
        )}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center', lineHeight: 1 }}>
          <div
            style={{
              fontSize: big,
              fontWeight: 700,
              color: sp.ink,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: -0.4,
            }}
          >
            {done}
            <span style={{ color: sp.muted, fontWeight: 600 }}>/{total}</span>
          </div>
          {size >= 80 && (
            <div
              style={{
                fontSize: 9,
                fontWeight: 600,
                color: sp.muted,
                textTransform: 'uppercase',
                letterSpacing: 0.3,
                marginTop: 5,
              }}
            >
              contrôles
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
