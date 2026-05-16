// MEGGA CRM Sugar v3 — Ligne dossier (vue liste)
// Port 1:1 de crm-screen-kyc-sugar.jsx lignes 198-290.

import { useMemo, useState } from 'react'
import { SugarV3, fmtDateShort } from '../tokens'
import { KycAvatar, KycRing, KycStatusPill, KycRiskPill } from '../primitives'
import { SgIcon } from '../icons'
import type { KycDossierRow as KycDossierRowData } from '@/hooks/useKycDossier'

interface Props {
  dossier: KycDossierRowData
  onOpen: () => void
}

export function KycDossierRow({ dossier, onOpen }: Props) {
  const [hover, setHover] = useState(false)

  const pct =
    dossier.checks_total > 0
      ? Math.round((dossier.checks_completed / dossier.checks_total) * 100)
      : 0

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

  const isBlocking = dossier.dossier_status !== 'verified'

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
        gridTemplateColumns: '56px 1fr 200px 160px 64px',
        gap: 24,
        alignItems: 'center',
        width: '100%',
        padding: '22px 28px',
        background: SugarV3.card,
        border: 0,
        borderRadius: 22,
        fontFamily: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
        boxShadow: hover ? SugarV3.shadowHover : SugarV3.shadow,
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'all .22s cubic-bezier(.2,.8,.2,1)',
      }}
    >
      {/* Avatar */}
      <KycAvatar firstName={c.first_name} lastName={c.last_name} size={56} />

      {/* Nom + type contact + meta */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: SugarV3.ink,
            letterSpacing: -0.3,
            marginBottom: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {c.first_name} {c.last_name}
          {isBlocking && (
            <span
              title="Ce dossier bloque l'avancement du deal en pipeline"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 999,
                background: SugarV3.errSoft,
                color: SugarV3.errDarker,
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: 0.2,
              }}
            >
              <SgIcon name="lock" size={10} stroke={SugarV3.errDarker} sw={2} />
              Bloque pipeline
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
            color: SugarV3.muted,
          }}
        >
          <span style={{ textTransform: 'capitalize' }}>{typeLabel}</span>
          <span
            style={{
              width: 3,
              height: 3,
              borderRadius: 999,
              background: SugarV3.ghost,
            }}
          />
          <span>
            Dossier ouvert{' '}
            {dossier.created_at
              ? 'le ' + fmtDateShort(dossier.created_at)
              : '—'}
          </span>
          {dossier.expires_at && (
            <>
              <span
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: 999,
                  background: SugarV3.ghost,
                }}
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

      {/* Status + Risk pills */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          alignItems: 'flex-start',
        }}
      >
        <KycStatusPill status={dossier.dossier_status} />
        <KycRiskPill risk={dossier.risk_level} />
      </div>

      {/* Ring de progression */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <KycRing pct={pct} />
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 500,
            color: SugarV3.muted,
            lineHeight: 1.4,
          }}
        >
          {dossier.checks_completed}
          <br />
          sur {dossier.checks_total} contrôles
        </div>
      </div>

      {/* CTA chevron */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          background: hover ? SugarV3.black : SugarV3.cardSubtle,
          color: hover ? '#fff' : SugarV3.inkSoft,
          display: 'grid',
          placeItems: 'center',
          justifySelf: 'end',
          transition: 'all .18s ease',
          transform: hover ? 'translateX(4px)' : 'translateX(0)',
        }}
      >
        <SgIcon name="arrowR" size={16} />
      </div>
    </button>
  )
}
