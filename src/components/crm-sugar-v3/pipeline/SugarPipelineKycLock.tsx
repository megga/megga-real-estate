// MEGGA CRM Sugar v3 — Bannière verrou pipeline (top of pipeline)
// Port 1:1 de crm-screen-pipeline-sugar.jsx lignes 349-409 (SugarPipelineKycLock).
//
// Architecture §5.5 : un deal ne peut pas passer en intérêt-confirmé si KYC ≠ verified.
// Compte les deals "sensibles" (visit-done/interest-confirmed/offer/signed) sans KYC validé,
// liste les 3 premiers noms, et propose d'ouvrir la liste des dossiers en un clic.
// Caché si aucun deal bloqué.

import { SgIcon } from '../icons'

interface BlockingDeal {
  id: string
  contactFullName: string
}

interface Props {
  /** Deals avec KYC non vérifié sur stage sensible. */
  blocking: BlockingDeal[]
  onOpenKyc: () => void
}

export function SugarPipelineKycLock({ blocking, onOpenKyc }: Props) {
  if (blocking.length === 0) return null

  const sampleNames = blocking.slice(0, 3).map((d) => d.contactFullName)
  const extra = blocking.length - sampleNames.length

  return (
    <div
      style={{
        background: '#0B0C0E',
        color: '#fff',
        borderRadius: 22,
        padding: '18px 22px',
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
        <SgIcon name="lock" size={20} stroke="#fff" sw={1.8} />
      </div>
      <div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: -0.2,
            marginBottom: 3,
          }}
        >
          {blocking.length} deal{blocking.length > 1 ? 's' : ''} bloqué
          {blocking.length > 1 ? 's' : ''} par la conformité KYC · LBA
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: 'rgba(255,255,255,0.7)',
            fontWeight: 500,
          }}
        >
          {sampleNames.length > 0 && (
            <>
              {sampleNames.join(', ')}
              {extra > 0 && ` +${extra}`} ·{' '}
            </>
          )}
          ne pourront pas passer en <em>Intérêt confirmé</em> tant que leur
          dossier n'est pas validé.
        </div>
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
        <SgIcon name="arrowR" size={14} stroke="#0B0C0E" sw={2} />
      </button>
    </div>
  )
}
