// MEGGA CRM Sugar v3 — Card KYC enrichie (livrable #6)
// Port 1:1 de crm-screen-contacts-sugar.jsx lignes 594-723 (CtKyc).
// CORRIGÉ au port : CTA `#0041D9` (ancien token Property X) → `#0B0C0E` (Sugar Pure).
//
// Mode non-bloquant : affiche l'état du dossier sans jamais empêcher d'action.
// Mini-stepper 6 étapes UI + 3 KPIs (Risque/Pièces/Dernier screening) + CTA contextuel.
//
// Spec : KYC_ENRICHISSEMENTS.md §1 + README §Arbitrages §3

import { Fragment } from 'react'
import { SugarV3, fmtDateShort } from '../tokens'
import { SgIcon } from '../icons'
import {
  KYC_UI_STEPS,
  STEP_BY_STATUS,
  getRiskScoreColor,
  getRiskScoreLabel,
} from '../kycStepper'
import { useKycDossierByContact } from '@/hooks/useKycDossier'
import type { KycDossierStatus } from '@/types/kyc'

interface Props {
  contactId: string
  onOpenKyc: (contactId: string) => void
}

interface HeaderMeta {
  tone: string
  soft: string
  label: string
  hint: string
}

const HEADER_BY_STATUS: Record<KycDossierStatus, HeaderMeta> = {
  none: {
    tone: SugarV3.warn,
    soft: SugarV3.warnSoft,
    label: 'À démarrer',
    hint: 'Vous pouvez continuer à travailler ce dossier — pensez à le compléter avant la signature.',
  },
  pending: {
    tone: SugarV3.warn,
    soft: SugarV3.warnSoft,
    label: 'En cours',
    hint: 'Vérifications en attente · délai habituel 24-48h.',
  },
  verified: {
    tone: SugarV3.okDark,
    soft: SugarV3.okSoft,
    label: 'Validé',
    hint: 'Dossier conforme — re-screening conseillé à 12 mois.',
  },
  stale: {
    tone: SugarV3.warn,
    soft: SugarV3.warnSoft,
    label: 'À re-screener',
    hint: 'Sanctions/PEP à rafraîchir — recommandé après 12 mois ou changement de situation.',
  },
  failed: {
    tone: SugarV3.err,
    soft: SugarV3.errSoft,
    label: 'Échec',
    hint: 'Un contrôle a échoué — revoyez le dossier en détail.',
  },
}

const CTA_BY_STATUS: Record<KycDossierStatus, string> = {
  none: 'Démarrer le dossier KYC',
  pending: 'Voir le dossier',
  verified: 'Consulter le dossier',
  stale: 'Relancer le screening',
  failed: 'Examiner le dossier',
}

export function CtKyc({ contactId, onOpenKyc }: Props) {
  const { data: dossier } = useKycDossierByContact(contactId)

  const status: KycDossierStatus = dossier?.dossier_status ?? 'none'
  const header = HEADER_BY_STATUS[status]
  const cta = CTA_BY_STATUS[status]

  // Step actif : depuis status par défaut (handoff KYC_ENRICHISSEMENTS §1)
  const activeStep = STEP_BY_STATUS[status] ?? 0

  // KPIs
  const docsTotal = 6
  const docsDone =
    dossier && dossier.checks_total > 0
      ? Math.min(6, Math.round((dossier.checks_completed / dossier.checks_total) * 6))
      : 0
  const riskValue = dossier?.risk_score ?? null
  const riskColor = getRiskScoreColor(riskValue)
  const riskLabel = riskValue != null ? getRiskScoreLabel(riskValue) : '—'
  const lastScreen = dossier?.last_screening_at
    ? fmtDateShort(dossier.last_screening_at).replace(/ /g, '.')
    : '—'

  return (
    <div
      style={{
        background: SugarV3.card,
        borderRadius: 18,
        padding: '14px 16px',
        boxShadow: SugarV3.shadowSm,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header : statut + hint */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            flexShrink: 0,
            background: header.soft,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <SgIcon name="kyc" size={14} stroke={header.tone} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: SugarV3.ink,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            Conformité KYC / LBA
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 999,
                background: header.soft,
                color: header.tone,
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: 0.2,
              }}
            >
              {header.label}
            </span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: SugarV3.inkSoft,
              marginTop: 2,
              lineHeight: 1.45,
            }}
          >
            {header.hint}
          </div>
        </div>
      </div>

      {/* Mini-stepper horizontal — 6 étapes UI (projection sur 5 checks DB) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 0,
          marginBottom: 14,
        }}
      >
        {KYC_UI_STEPS.map((s, i) => {
          const done = i < activeStep
          const active = i === activeStep && status !== 'verified'
          return (
            <Fragment key={s.id}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 999,
                    background: done
                      ? SugarV3.okDark
                      : active
                        ? SugarV3.ink
                        : SugarV3.cardSubtle,
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    boxShadow: active ? `0 0 0 3px ${SugarV3.cardSubtle}` : 'none',
                  }}
                >
                  {done && <SgIcon name="check" size={8} stroke="#fff" sw={2.5} />}
                </div>
                <div
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    textAlign: 'center',
                    color: done || active ? SugarV3.ink : SugarV3.muted,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.label}
                </div>
              </div>
              {i < KYC_UI_STEPS.length - 1 && (
                <div
                  style={{
                    height: 2,
                    flex: 0.5,
                    alignSelf: 'center',
                    marginTop: -14,
                    marginLeft: -2,
                    marginRight: -2,
                    background:
                      i < activeStep - 1 ? SugarV3.okDark : SugarV3.cardSubtle,
                  }}
                />
              )}
            </Fragment>
          )
        })}
      </div>

      {/* 3 KPIs : Risque / Pièces / Dernier screening */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            padding: '8px 10px',
            borderRadius: 8,
            background: SugarV3.cardSubtle,
          }}
        >
          <div
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              color: SugarV3.muted,
            }}
          >
            Risque
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: riskColor,
              marginTop: 2,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {riskValue ?? '—'}
            <span
              style={{
                fontSize: 10,
                color: SugarV3.muted,
                fontWeight: 600,
                marginLeft: 4,
              }}
            >
              {riskValue != null ? `/ ${riskLabel}` : ''}
            </span>
          </div>
        </div>
        <div
          style={{
            padding: '8px 10px',
            borderRadius: 8,
            background: SugarV3.cardSubtle,
          }}
        >
          <div
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              color: SugarV3.muted,
            }}
          >
            Pièces
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: SugarV3.ink,
              marginTop: 2,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {docsDone}
            <span
              style={{
                fontSize: 10,
                color: SugarV3.muted,
                fontWeight: 600,
              }}
            >
              {' '}
              / {docsTotal}
            </span>
          </div>
        </div>
        <div
          style={{
            padding: '8px 10px',
            borderRadius: 8,
            background: SugarV3.cardSubtle,
          }}
        >
          <div
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              color: SugarV3.muted,
            }}
          >
            Dernier screening
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: SugarV3.ink,
              marginTop: 2,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {lastScreen}
          </div>
        </div>
      </div>

      {/* CTA — NOIR Sugar Pure #0B0C0E (correction du bug #0041D9 du JSX) */}
      <button
        onClick={() => onOpenKyc(contactId)}
        style={{
          width: '100%',
          height: 32,
          borderRadius: 8,
          background: status === 'verified' ? 'transparent' : SugarV3.black,
          color: status === 'verified' ? SugarV3.ink : '#fff',
          border:
            status === 'verified'
              ? `1px solid ${SugarV3.cardSubtle}`
              : 0,
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <SgIcon
          name="kyc"
          size={12}
          stroke={status === 'verified' ? SugarV3.ink : '#fff'}
        />
        {cta}
      </button>
    </div>
  )
}
