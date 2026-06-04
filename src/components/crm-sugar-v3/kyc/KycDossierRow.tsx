// MEGGA CRM Sugar v3 — Ligne dossier (vue liste)
// Port du handoff Claude Design juin 2026 (crm-screen-kyc-sugar.jsx §KycDossierRow) :
//  - jauge unifiée (avancement + risque encodé par la couleur + halo)
//  - rappel doux « À compléter » (gris, horloge) — JAMAIS « Bloque pipeline »
//    (politique KYC non-bloquant, CLAUDE.md)
//  - thème dynamique clair ↔ sombre via useKycPalette

import { useMemo, useState } from 'react'
import { fmtDateShort } from '../tokens'
import { KycAvatar } from '../primitives'
import { SgIcon } from '../icons'
import { useKycPalette } from './kycPalette'
import { KycGauge } from './KycGauge'
import type { KycDossierRow as KycDossierRowData } from '@/hooks/useKycDossier'

interface Props {
  dossier: KycDossierRowData
  onOpen: () => void
}

export function KycDossierRow({ dossier, onOpen }: Props) {
  const sp = useKycPalette()
  const [hover, setHover] = useState(false)

  // Memo : appelé avant l'early return pour respecter les règles des hooks
  const expiresIn = useMemo(() => {
    if (!dossier.expires_at) return null
    return Math.round(
      (new Date(dossier.expires_at).getTime() - Date.now()) /
        (1000 * 3600 * 24 * 30),
    )
  }, [dossier.expires_at])

  const c = dossier.contact
  if (!c) return null

  // Rappel doux : le dossier n'est pas encore vérifié → « À compléter ».
  // NON bloquant — le deal avance quel que soit l'état du KYC (CLAUDE.md).
  const incomplete = dossier.dossier_status !== 'verified'

  const typeLabel =
    c.type === 'buyer'
      ? 'Acheteur'
      : c.type === 'seller'
        ? 'Vendeur'
        : c.type === 'tenant'
          ? 'Locataire'
          : c.type === 'landlord'
            ? 'Propriétaire'
            : 'Mixte'

  return (
    <button
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '56px 1fr 160px 64px',
        gap: 24,
        alignItems: 'center',
        width: '100%',
        padding: '22px 28px',
        background: sp.card,
        border: `1px solid ${sp.cardBorder}`,
        borderRadius: 22,
        fontFamily: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
        boxShadow: hover ? sp.shadowHover : sp.shadow,
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'all .22s cubic-bezier(.2,.8,.2,1)',
      }}
    >
      {/* Avatar — bg accent + initiales onAccent (flip clair/sombre cohérent) */}
      <KycAvatar
        firstName={c.first_name}
        lastName={c.last_name}
        avatarBg={sp.black}
        color={sp.onAccent}
        size={56}
      />

      {/* Nom + rappel doux + meta */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: sp.ink,
            letterSpacing: -0.3,
            marginBottom: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {c.first_name} {c.last_name}
          {incomplete && (
            <span
              title="Rappel doux — KYC à compléter (non bloquant pour le pipeline)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 9px',
                borderRadius: 999,
                background: sp.cardSubtle,
                color: sp.muted,
                border: `1px solid ${sp.cardBorder}`,
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: 0.2,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <SgIcon name="clock" size={10} stroke={sp.muted} sw={2} />
              À compléter
            </span>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12.5,
            fontWeight: 500,
            color: sp.muted,
          }}
        >
          <span style={{ textTransform: 'capitalize' }}>{typeLabel}</span>
          <span
            style={{ width: 3, height: 3, borderRadius: 999, background: sp.ghost }}
          />
          <span>
            Dossier ouvert{' '}
            {dossier.created_at ? 'le ' + fmtDateShort(dossier.created_at) : '—'}
          </span>
          {dossier.expires_at && (
            <>
              <span
                style={{ width: 3, height: 3, borderRadius: 999, background: sp.ghost }}
              />
              <span>
                Échéance{' '}
                {expiresIn !== null && expiresIn > 0
                  ? `dans ${expiresIn} mois`
                  : 'passée'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Jauge unifiée : avancement (fraction) + risque (couleur + halo) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <KycGauge
          done={dossier.checks_completed}
          total={dossier.checks_total}
          risk={dossier.risk_level}
        />
      </div>

      {/* CTA chevron */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          background: hover ? sp.black : sp.cardSubtle,
          color: hover ? sp.onAccent : sp.inkSoft,
          display: 'grid',
          placeItems: 'center',
          justifySelf: 'end',
          transition: 'all .18s ease',
          transform: hover ? 'translateX(4px)' : 'translateX(0)',
        }}
      >
        <SgIcon name="arrowR" size={16} stroke={hover ? sp.onAccent : sp.inkSoft} />
      </div>
    </button>
  )
}
