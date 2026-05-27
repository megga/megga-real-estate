// MEGGA CRM Sugar v3 — Fiche Deal (Sprint 2) — composants partagés
// Port pixel-près du canon crm-screen-deal-detail-sugar.jsx (handoff Sprint 2).

import type { CSSProperties, ReactNode } from 'react'
import { SugarV3, fmtDateTime } from '../tokens'
import { SgIcon } from '../icons'
import {
  DEAL_STEPPER_ORDER,
  DEAL_STEPPER_LABELS,
  dealStepperIndex,
} from '../dealStepper'
import type { TransactionStage } from '@/lib/constants'
import type { Offer } from '@/types/offer'

// ─── Eyebrow + Card ─────────────────────────────────────────────────────
export function DdEyebrow({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: SugarV3.muted,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </div>
  )
}

export function DdCard({
  children,
  padding = 28,
  style,
}: {
  children: ReactNode
  padding?: number | string
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        background: SugarV3.card,
        borderRadius: 24,
        boxShadow: SugarV3.shadow,
        padding,
        animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ─── Formatter Sprint 2 ─────────────────────────────────────────────────
export function ddFmt(n: number | null | undefined): string {
  if (n == null) return '—'
  return `CHF ${n.toLocaleString('fr-CH').replace(/[  ,]/g, "'")}`
}

// ═══════════════════════════════════════════════════════════════════════
//  Stage stepper — 8 cercles connectés (handoff §2 Stepper pipeline)
// ═══════════════════════════════════════════════════════════════════════
export function DdStageStepper({
  stage,
}: {
  stage: TransactionStage | string | null | undefined
}) {
  const idx = dealStepperIndex(stage)
  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${DEAL_STEPPER_ORDER.length}, 1fr)`,
          gap: 4,
          position: 'relative',
        }}
      >
        {DEAL_STEPPER_ORDER.map((s, i) => {
          const done = i < idx
          const active = i === idx
          return (
            <div
              key={s}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                position: 'relative',
                minWidth: 0,
              }}
            >
              {i > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    left: '-50%',
                    right: '50%',
                    top: 13,
                    height: 2,
                    zIndex: 0,
                    background:
                      i <= idx ? SugarV3.ink : SugarV3.cardSubtle,
                    marginLeft: 14,
                    marginRight: 14,
                  }}
                />
              )}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  background:
                    active || done ? SugarV3.ink : SugarV3.cardSubtle,
                  color: active || done ? '#fff' : SugarV3.muted,
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'grid',
                  placeItems: 'center',
                  zIndex: 1,
                  boxShadow: active
                    ? '0 0 0 5px rgba(11,12,14,0.10), 0 4px 12px rgba(11,12,14,0.18)'
                    : 'none',
                  transition: 'all .2s ease',
                }}
              >
                {done ? (
                  <SgIcon name="check" size={13} stroke="#fff" sw={2.5} />
                ) : (
                  i + 1
                )}
              </div>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: active ? 700 : 500,
                  color: active ? SugarV3.ink : SugarV3.muted,
                  textAlign: 'center',
                  lineHeight: 1.25,
                  letterSpacing: 0.2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%',
                }}
              >
                {DEAL_STEPPER_LABELS[s]}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── KYC chip (4 statuts) ───────────────────────────────────────────────
export function DdKycChip({
  status,
}: {
  status: 'none' | 'pending' | 'verified' | 'stale' | 'failed' | string
}) {
  const map: Record<string, { label: string; tone: string }> = {
    verified: { label: 'KYC vérifié', tone: SugarV3.ok },
    pending: { label: 'KYC en cours', tone: SugarV3.warn },
    none: { label: 'KYC à faire', tone: SugarV3.muted },
    stale: { label: 'KYC périmé', tone: SugarV3.warn },
    failed: { label: 'KYC échec', tone: SugarV3.err },
  }
  const m = map[status] ?? map.none
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '5px 12px',
        borderRadius: 999,
        background: SugarV3.cardSubtle,
        color: SugarV3.inkSoft,
        fontSize: 11.5,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: m.tone,
        }}
      />
      {m.label}
    </span>
  )
}

// ─── Sentiment chip ─────────────────────────────────────────────────────
export function DdSentimentChip({
  tone,
  label,
}: {
  tone: 'healthy' | 'at-risk' | 'stalled' | string
  label: string
}) {
  const map: Record<string, string> = {
    healthy: SugarV3.ok,
    'at-risk': SugarV3.warn,
    stalled: SugarV3.err,
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '5px 12px',
        borderRadius: 999,
        background: SugarV3.cardSubtle,
        color: SugarV3.inkSoft,
        fontSize: 11.5,
        fontWeight: 600,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: map[tone] ?? SugarV3.muted,
        }}
      />
      {label}
    </span>
  )
}

// ─── Condition pill (offre suspensive) ──────────────────────────────────
export function DdConditionPill({
  icon,
  label,
}: {
  icon: string
  label: string
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 11px',
        borderRadius: 999,
        background: SugarV3.card,
        color: SugarV3.inkSoft,
        fontSize: 11.5,
        fontWeight: 600,
        boxShadow: SugarV3.shadowSm,
      }}
    >
      <SgIcon name={icon} size={11} stroke={SugarV3.inkSoft} sw={1.8} />
      {label}
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//  Offer card — carte d'offre avec trait de filiation pour contre-offres
// ═══════════════════════════════════════════════════════════════════════
export function DdOfferCard({
  offer,
  isCurrent,
  onUpdateStatus,
}: {
  offer: Offer
  isCurrent: boolean
  /** Wire status mutations (Accept / Reject / Withdraw / Mark signed).
   * Optional — parent decides whether the actions are exposed
   * (currently only DealDetailSugarV3Page passes this for `isCurrent`
   * + `status==='pending'` offers). */
  onUpdateStatus?: (status: 'accepted' | 'rejected' | 'withdrawn' | 'expired') => void
}) {
  const isCounter = offer.kind === 'counter'
  const canAct = !!onUpdateStatus && isCurrent && offer.status === 'pending'
  return (
    <div
      style={{
        position: 'relative',
        paddingLeft: isCounter ? 32 : 0,
      }}
    >
      {isCounter && (
        <>
          <div
            style={{
              position: 'absolute',
              left: 11,
              top: -20,
              bottom: '50%',
              width: 2,
              background: SugarV3.cardSubtle,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 11,
              top: 24,
              width: 18,
              height: 2,
              background: SugarV3.cardSubtle,
            }}
          />
        </>
      )}

      <div
        style={{
          padding: 22,
          borderRadius: 20,
          background: isCurrent ? SugarV3.card : SugarV3.cardSubtle,
          boxShadow: isCurrent
            ? `0 0 0 2px ${SugarV3.ink} inset, ${SugarV3.shadowSm}`
            : 'none',
        }}
      >
        <div
          style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              flexShrink: 0,
              background: isCounter ? SugarV3.cardSubtle : SugarV3.ink,
              color: isCounter ? SugarV3.ink : '#fff',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <SgIcon
              name={isCounter ? 'swap' : 'arrowR'}
              size={15}
              stroke={isCounter ? SugarV3.ink : '#fff'}
              sw={2}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: SugarV3.muted,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  whiteSpace: 'nowrap',
                }}
              >
                {isCounter ? 'Contre-offre · vendeur' : 'Offre · acheteur'}
              </span>
              {isCurrent && (
                <span
                  style={{
                    padding: '2px 9px',
                    borderRadius: 999,
                    background: SugarV3.ink,
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}
                >
                  En cours
                </span>
              )}
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 11,
                  color: SugarV3.muted,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}
              >
                {fmtDateTime(offer.created_at)}
              </span>
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: SugarV3.ink,
                marginBottom: 14,
              }}
            >
              {offer.by_label}
            </div>

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
                  fontSize: 28,
                  fontWeight: 700,
                  color: SugarV3.ink,
                  letterSpacing: -0.6,
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              >
                {ddFmt(offer.amount)}
              </div>
              {offer.deposit && (
                <div
                  style={{
                    fontSize: 12.5,
                    color: SugarV3.muted,
                    fontWeight: 500,
                  }}
                >
                  + {ddFmt(offer.deposit)} d'acompte
                </div>
              )}
            </div>

            {/* Conditions */}
            {offer.conditions && (
              <div
                style={{
                  marginTop: 14,
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                {offer.conditions.financing?.active && (
                  <DdConditionPill
                    icon="shield"
                    label={`Financement · ${offer.conditions.financing.days ?? 45}j`}
                  />
                )}
                {offer.conditions.sale?.active && (
                  <DdConditionPill icon="home" label="Vente d'un autre bien" />
                )}
                {offer.conditions.diagnostic?.active && (
                  <DdConditionPill icon="file" label="Expertise" />
                )}
                {offer.conditions.occupancy?.active && (
                  <DdConditionPill icon="cal" label="Libération du logement" />
                )}
              </div>
            )}

            {offer.conditions?.other && (
              <p
                style={{
                  margin: '14px 0 0',
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: isCurrent ? SugarV3.cardSubtle : SugarV3.card,
                  fontSize: 12.5,
                  color: SugarV3.inkSoft,
                  lineHeight: 1.55,
                  fontWeight: 500,
                }}
              >
                {offer.conditions.other}
              </p>
            )}

            <div
              style={{
                marginTop: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              {offer.expires_at && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    fontSize: 11.5,
                    color: SugarV3.muted,
                    fontWeight: 600,
                  }}
                >
                  <SgIcon name="cal" size={12} stroke={SugarV3.muted} sw={1.8} />
                  Expire {fmtDateTime(offer.expires_at)}
                </div>
              )}
              {offer.attachments?.length > 0 && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    fontSize: 11.5,
                    color: SugarV3.muted,
                    fontWeight: 600,
                  }}
                >
                  <SgIcon name="file" size={12} stroke={SugarV3.muted} sw={1.8} />
                  {offer.attachments.length} pièce
                  {offer.attachments.length > 1 ? 's' : ''} jointe
                  {offer.attachments.length > 1 ? 's' : ''}
                </div>
              )}
            </div>

            {/* Action row — visible only on the current pending offer.
                Acceptation / refus / retrait sont des transitions à
                trace nLPD via le trigger DB sur crm_offers.status. */}
            {canAct && (
              <div style={{
                marginTop: 14,
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
              }}>
                <button
                  onClick={() => onUpdateStatus?.('accepted')}
                  style={{
                    height: 36, padding: '0 16px', borderRadius: 999, border: 0,
                    background: SugarV3.ok, color: '#fff',
                    fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(16,170,113,0.25)',
                  }}
                >
                  Accepter
                </button>
                <button
                  onClick={() => onUpdateStatus?.('rejected')}
                  style={{
                    height: 36, padding: '0 16px', borderRadius: 999, border: `1px solid ${SugarV3.cardSubtle}`,
                    background: SugarV3.card, color: SugarV3.errDarker,
                    fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Refuser
                </button>
                <button
                  onClick={() => onUpdateStatus?.('withdrawn')}
                  style={{
                    height: 36, padding: '0 16px', borderRadius: 999, border: `1px solid ${SugarV3.cardSubtle}`,
                    background: SugarV3.card, color: SugarV3.inkSoft,
                    fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Retirer
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
