// MEGGA CRM Sugar v3 — Bannière verrou KYC fiche contact
// Port 1:1 de crm-screen-contact-detail-sugar.jsx lignes 167-213 (CdKycBanner).
//
// Affichée tant que dossier.status ≠ 'verified'. CTA "Lancer le KYC" ou "Continuer".

import { SugarV3 } from '../tokens'
import { SgIcon } from '../icons'
import type { KycDossierSummary } from '@/types/kyc'

interface Props {
  dossier: KycDossierSummary | null
  onOpenKyc: () => void
}

export function CdKycBanner({ dossier, onOpenKyc }: Props) {
  if (dossier?.dossier_status === 'verified') return null

  const isNone = !dossier || dossier.dossier_status === 'none'
  const isPending = dossier?.dossier_status === 'pending'

  const statusText = isNone
    ? "Aucun dossier KYC n'a été ouvert"
    : isPending
      ? 'Le dossier KYC est en cours — pièces manquantes'
      : 'Le dossier KYC doit être re-vérifié'

  const pct =
    dossier && dossier.checks_total > 0
      ? Math.round((dossier.checks_completed / dossier.checks_total) * 100)
      : 0

  return (
    <div
      style={{
        background: SugarV3.black,
        color: '#fff',
        borderRadius: 22,
        padding: '20px 24px',
        marginBottom: 24,
        boxShadow: '0 12px 32px rgba(11,12,14,0.18)',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: 20,
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
            fontSize: 14.5,
            fontWeight: 700,
            letterSpacing: -0.2,
            marginBottom: 2,
          }}
        >
          Pipeline bloqué — {statusText}.
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: 'rgba(255,255,255,0.7)',
            fontWeight: 500,
          }}
        >
          Ce contact ne pourra pas passer en <em>Intérêt confirmé</em> tant que
          le KYC n'est pas validé.
          {isPending && pct > 0 && ` Avancement : ${pct} %.`}
        </div>
      </div>
      <button
        onClick={onOpenKyc}
        style={{
          height: 40,
          padding: '0 18px',
          borderRadius: 999,
          border: 0,
          background: '#fff',
          color: SugarV3.ink,
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
        {isNone ? 'Lancer le KYC' : 'Continuer le dossier'}
        <SgIcon name="arrowR" size={14} stroke={SugarV3.ink} sw={2} />
      </button>
    </div>
  )
}
