// MEGGA CRM Sugar v3 — Bannière KYC pipeline (top of pipeline)
//
// KYC/LBA = nice to have, JAMAIS un verrou (règle métier mai 2026). Un deal
// avance à toutes les étapes sans KYC validé. Cette bannière est un RAPPEL DOUX :
// elle compte les dossiers KYC à compléter sur les étapes sensibles (suggestion,
// pas blocage) et propose d'ouvrir la liste. Cachée si aucun dossier en attente.

import MEIcon from '@/components/propertyx/MEIcon'

interface PendingDeal {
  id: string
  contactFullName: string
}

interface Props {
  /** Deals avec KYC non vérifié sur stage sensible (rappel doux, non-bloquant). */
  pending: PendingDeal[]
  onOpenKyc: () => void
}

export function SugarPipelineKycLock({ pending, onOpenKyc }: Props) {
  if (pending.length === 0) return null

  return (
    <div
      style={{
        background: '#0B0C0E',
        color: '#fff',
        borderRadius: 22,
        padding: '16px 22px',
        marginBottom: 18,
        boxShadow: '0 12px 32px rgba(11,12,14,0.18)',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: 18,
        alignItems: 'center',
        animation: 'sgFadeUp .45s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          background: 'rgba(255,255,255,0.10)',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <MEIcon name="shield" size={20} color="#fff" strokeWidth={1.8} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: -0.2,
            whiteSpace: 'nowrap',
          }}
        >
          {pending.length} dossier{pending.length > 1 ? 's' : ''} KYC à compléter
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            padding: '3px 8px',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.14)',
            color: 'rgba(255,255,255,0.92)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          Optionnel
        </span>
      </div>
      <button
        onClick={onOpenKyc}
        style={{
          height: 38,
          padding: '0 18px',
          borderRadius: 999,
          border: 0,
          background: '#fff',
          color: '#0B0C0E',
          fontFamily: 'inherit',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 9,
          whiteSpace: 'nowrap',
          boxShadow: '0 6px 16px rgba(0,0,0,0.20)',
        }}
      >
        Voir les dossiers
        <MEIcon name="arrow-right" size={14} color="#0B0C0E" strokeWidth={2} />
      </button>
    </div>
  )
}
