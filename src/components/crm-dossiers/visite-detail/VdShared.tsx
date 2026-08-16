// MEGGA CRM Sugar v3 — Fiche Visite (Sprint 2) — composants partagés
//
// Deux composants principaux :
//   - VdBonPanel     : panneau Bon de visite (avant) + zone signature
//   - VdRapportPanel : panneau Rapport (après) — sentiment + highlights + objections + voice note
//
// (VdMobileCompanion supprimé — la vue mobile compagnon contenait
//  uniquement des contrôles non-fonctionnels — voir l'historique git.)

import { crmVoileEncre } from '@/components/crm/tokens'
import { useMemo, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useCrmDark } from '@/lib/crmDark'
import { dossierPalette } from '../tokens'
import { CrmIcon } from '../icons'
import { VISIT_SENTIMENT_LABELS, type VisitSentiment } from '@/types/visit'
import type { VisitDetail } from '@/hooks/useVisitDetail'

// ─── Eyebrow + Card ─────────────────────────────────────────────────────
export function VdEyebrow({ children }: { children: ReactNode }) {
  const dark = useCrmDark()
  const S = useMemo(() => dossierPalette(dark), [dark])
  return (
    <div
      style={{
        fontSize: 'var(--crm-text-md)',
        fontWeight: 600,
        color: S.muted,
                      }}
    >
      {children}
    </div>
  )
}

export function VdCard({
  children,
  padding = 28,
  style,
}: {
  children: ReactNode
  padding?: number | string
  style?: CSSProperties
}) {
  const dark = useCrmDark()
  const S = useMemo(() => dossierPalette(dark), [dark])
  return (
    <div
      style={{
        background: S.card,
        borderRadius: 'var(--crm-radius-5xl)',
        boxShadow: S.shadow,
        padding,
        animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function vdDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-CH', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ═══════════════════════════════════════════════════════════════════════
//  Panneau Bon de visite (avant)
// ═══════════════════════════════════════════════════════════════════════
export function VdBonPanel({
  visit,
  onSign,
}: {
  visit: VisitDetail
  onSign?: () => void
}) {
  const { t } = useTranslation('calendar')
  const dark = useCrmDark()
  const S = useMemo(() => dossierPalette(dark), [dark])
  const signed = !!visit.bon?.signedAt
  return (
    <VdCard>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
          gap: 'var(--crm-space-xl)',
        }}
      >
        <div>
          <VdEyebrow>
            {t('visitDetail.bon.eyebrowPrefix')} ·{' '}
            {signed
              ? t('visitDetail.bon.signed')
              : t('visitDetail.bon.toSign')}
          </VdEyebrow>
          <h2
            style={{
              margin: '10px 0 0',
              fontSize: 'var(--crm-text-4xl)',
              fontWeight: 600,
              color: S.ink,
              letterSpacing: -0.4,
            }}
          >
            {t('visitDetail.bon.documentTitle')}
          </h2>
        </div>
        {/* Header download/email icon buttons removed — both were no-op
            placeholders. Real PDF download + email-send for visit bons
            are tracked as a follow-up chip (will reuse PR #444's
            @react-pdf flow + the send-property-email Edge Function). */}
      </div>

      {/* Aperçu document PDF */}
      <div
        style={{
          marginTop: 22,
          padding: 28,
          borderRadius: 'var(--crm-radius-3xl)',
          background: '#FAFBFC',
          boxShadow: `inset 0 0 0 1px ${S.cardSubtle}`,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div
            style={{
              fontSize: 'var(--crm-text-sm)',
              fontWeight: 600,
              color: S.ink,
              marginBottom: 6,
            }}
          >
            MEGGA REAL ESTATE
          </div>
          <div
            style={{
              fontSize: 'var(--crm-text-3xl)',
              fontWeight: 600,
              color: S.ink,
              letterSpacing: -0.3,
            }}
          >
            {t('visitDetail.bon.pdfTitle')}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--crm-space-2xl)',
            fontSize: 'var(--crm-text-lg)',
          }}
        >
          <div
            style={{
              paddingBottom: 'var(--crm-space-2xl)',
              borderBottom: `1px dashed ${S.cardSubtle}`,
            }}
          >
            <div
              style={{
                fontSize: 'var(--crm-text-xs)',
                color: S.muted,
                fontWeight: 600,
                                                marginBottom: 6,
              }}
            >
              {t('visitDetail.bon.fieldProperty')}
            </div>
            <div
              style={{ fontWeight: 600, color: S.ink, fontSize: 'var(--crm-text-xl)' }}
            >
              {visit.property?.title ?? '—'}
            </div>
            <div
              style={{
                color: S.inkSoft,
                fontSize: 'var(--crm-text-md)',
                marginTop: 2,
              }}
            >
              {visit.property?.address ?? '—'}
            </div>
          </div>
          <div
            style={{
              paddingBottom: 'var(--crm-space-2xl)',
              borderBottom: `1px dashed ${S.cardSubtle}`,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--crm-space-4xl)',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 'var(--crm-text-xs)',
                  color: S.muted,
                  fontWeight: 600,
                                                      marginBottom: 6,
                }}
              >
                {t('visitDetail.bon.fieldVisitor')}
              </div>
              <div
                style={{
                  fontWeight: 600,
                  color: S.ink,
                  fontSize: 'var(--crm-text-lg)',
                }}
              >
                {visit.bon?.visitorNames?.[0] ??
                  (visit.contact
                    ? `${visit.contact.first_name} ${visit.contact.last_name}`
                    : '—')}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 'var(--crm-text-xs)',
                  color: S.muted,
                  fontWeight: 600,
                                                      marginBottom: 6,
                }}
              >
                {t('visitDetail.bon.fieldAgent')}
              </div>
              <div
                style={{
                  fontWeight: 600,
                  color: S.ink,
                  fontSize: 'var(--crm-text-lg)',
                }}
              >
                {visit.agent?.full_name ?? 'Grégory L.'}
              </div>
            </div>
          </div>
          <div
            style={{
              paddingBottom: 'var(--crm-space-2xl)',
              borderBottom: `1px dashed ${S.cardSubtle}`,
            }}
          >
            <div
              style={{
                fontSize: 'var(--crm-text-xs)',
                color: S.muted,
                fontWeight: 600,
                                                marginBottom: 6,
              }}
            >
              {t('visitDetail.bon.fieldDateTime')}
            </div>
            <div
              style={{
                fontWeight: 600,
                color: S.ink,
                fontSize: 'var(--crm-text-lg)',
              }}
            >
              {vdDateTime(visit.scheduled_at)}
            </div>
            <div
              style={{
                color: S.muted,
                fontSize: 'var(--crm-text-sm)',
                marginTop: 2,
              }}
            >
              {t('visitDetail.bon.plannedDuration', {
                minutes: visit.duration_minutes,
              })}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 'var(--crm-text-xs)',
                color: S.muted,
                fontWeight: 600,
                                                marginBottom: 8,
              }}
            >
              {t('visitDetail.bon.commitmentLabel')}
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--crm-text-md)',
                color: S.inkSoft,
                lineHeight: 1.6,
                fontWeight: 500,
              }}
            >
              {t('visitDetail.bon.commitmentText')}
            </p>
          </div>
        </div>

        {/* Zone signature */}
        <div
          style={{
            marginTop: 26,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--crm-space-3xl)',
          }}
        >
          {[
            {
              l: t('visitDetail.bon.signatureVisitor'),
              signed,
              name: visit.bon?.visitorNames?.[0],
            },
            {
              l: t('visitDetail.bon.signatureAgent'),
              signed,
              name: visit.agent?.full_name ?? 'Grégory L.',
            },
          ].map((s) => (
            <div
              key={s.l}
              style={{
                padding: 'var(--crm-space-2xl)',
                borderRadius: 'var(--crm-radius-lg)',
                background: S.card,
                boxShadow: `inset 0 0 0 1px ${S.cardSubtle}`,
                minHeight: 70,
              }}
            >
              <div
                style={{
                  fontSize: 'var(--crm-text-xs)',
                  color: S.muted,
                  fontWeight: 600,
                                                      marginBottom: 8,
                }}
              >
                {s.l}
              </div>
              {s.signed ? (
                <div>
                  <div
                    style={{
                      fontFamily: "Caveat, 'Brush Script MT', cursive",
                      fontSize: 'var(--crm-text-4xl)',
                      color: S.ink,
                      lineHeight: 1,
                    }}
                  >
                    {s.name}
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 'var(--crm-text-xs)',
                      color: S.muted,
                      fontWeight: 600,
                    }}
                  >
                    {t('visitDetail.bon.signedElectronically')}
                    {visit.bon?.signedAt
                      ? ` ${new Date(visit.bon.signedAt).toLocaleString('fr-CH', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}`
                      : ''}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    fontSize: 'var(--crm-text-sm)',
                    color: S.muted,
                    fontWeight: 500,
                  }}
                >
                  {t('visitDetail.bon.awaitingSignature')}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          display: 'flex',
          gap: 'var(--crm-space-lg)',
          flexWrap: 'wrap',
        }}
      >
        {/* "Télécharger PDF" and "Envoyer par email" buttons removed —
            both were no-op placeholders. Real bon-de-visite PDF gen and
            email-send are tracked as a follow-up chip. Only "Faire signer
            maintenant" stays (wired to useSignVisitBon). */}
        {!signed && (
          <button
            onClick={onSign}
            style={{
              height: 40,
              padding: '0 var(--crm-space-4xl)',
              borderRadius: 'var(--crm-radius-pill)',
              border: 0,
              background: S.accent,
              color: '#fff',
              fontFamily: 'inherit',
              fontWeight: 600,
              fontSize: 'var(--crm-text-lg)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--crm-space-md)',
              boxShadow: `0 6px 16px ${crmVoileEncre(false, 0.18)}`,
            }}
          >
            <CrmIcon name="pen" size={14} stroke="#fff" sw={2} />
            {t('visitDetail.bon.signNow')}
          </button>
        )}
      </div>
    </VdCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//  Panneau Rapport de visite (après)
// ═══════════════════════════════════════════════════════════════════════
export function VdRapportPanel({ visit }: { visit: VisitDetail }) {
  const { t } = useTranslation('calendar')
  const dark = useCrmDark()
  const S = useMemo(() => dossierPalette(dark), [dark])
  const r = visit.rapport
  const done = visit.kind === 'done' && r

  if (!done) {
    return (
      <VdCard>
        <VdEyebrow>
          {t('visitDetail.report.eyebrowPrefix')} ·{' '}
          {t('visitDetail.report.awaitingVisit')}
        </VdEyebrow>
        <h2
          style={{
            margin: '10px 0 16px',
            fontSize: 'var(--crm-text-4xl)',
            fontWeight: 600,
            color: S.ink,
            letterSpacing: -0.4,
          }}
        >
          {t('visitDetail.report.title')}
        </h2>
        <div
          style={{
            padding: 28,
            borderRadius: 'var(--crm-radius-3xl)',
            background: S.cardSubtle,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 'var(--crm-radius-pill)',
              margin: '0 auto 14px',
              background: S.card,
              color: S.muted,
              display: 'grid',
              placeItems: 'center',
              boxShadow: S.shadowSm,
            }}
          >
            <CrmIcon name="clock" size={24} stroke={S.muted} sw={1.8} />
          </div>
          <div
            style={{
              fontSize: 'var(--crm-text-xl)',
              fontWeight: 600,
              color: S.ink,
              marginBottom: 6,
            }}
          >
            {t('visitDetail.report.emptyTitle')}
          </div>
          <div
            style={{
              fontSize: 'var(--crm-text-md)',
              color: S.muted,
              fontWeight: 500,
              lineHeight: 1.5,
            }}
          >
            {t('visitDetail.report.emptyHint')}
          </div>
        </div>
      </VdCard>
    )
  }

  const sent = VISIT_SENTIMENT_LABELS[r.sentiment as VisitSentiment] ?? {
    label: t('visitDetail.report.sentimentFallback'),
    tone: S.muted,
  }

  return (
    <VdCard>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--crm-space-xl)',
        }}
      >
        <div>
          <VdEyebrow>
            {t('visitDetail.report.eyebrowPrefix')} ·{' '}
            {new Date(r.savedAt).toLocaleDateString('fr-CH', {
              day: '2-digit',
              month: 'short',
            })}
          </VdEyebrow>
          <h2
            style={{
              margin: '10px 0 0',
              fontSize: 'var(--crm-text-4xl)',
              fontWeight: 600,
              color: S.ink,
              letterSpacing: -0.4,
            }}
          >
            {t('visitDetail.report.title')}
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3xl)' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--crm-space-md)',
              padding: 'var(--crm-space-md) var(--crm-space-3xl)',
              borderRadius: 'var(--crm-radius-pill)',
              background: S.cardSubtle,
              color: S.ink,
              fontSize: 'var(--crm-text-lg)',
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 'var(--crm-radius-pill)',
                background: sent.tone,
              }}
            />
            {sent.label}
          </span>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: 'var(--crm-text-xs)',
                color: S.muted,
                fontWeight: 600,
                                              }}
            >
              {t('visitDetail.report.score')}
            </div>
            <div
              style={{
                fontSize: 'var(--crm-text-4xl)',
                fontWeight: 600,
                color: S.ink,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {r.interestLevel}
              <span
                style={{
                  fontSize: 'var(--crm-text-lg)',
                  color: S.muted,
                  fontWeight: 500,
                }}
              >
                /10
              </span>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 24,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--crm-space-4xl)',
        }}
      >
        <div
          style={{
            padding: 'var(--crm-space-6xl)',
            borderRadius: 'var(--crm-radius-3xl)',
            background: S.cardSubtle,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--crm-space-md)',
              marginBottom: 12,
              fontSize: 'var(--crm-text-sm)',
              fontWeight: 600,
              color: S.muted,
                                        }}
          >
            <CrmIcon name="smile" size={13} stroke={S.muted} sw={1.8} />
            {t('visitDetail.report.highlights')}
          </div>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--crm-space-md)',
            }}
          >
            {(r.highlights ?? []).map((h, i) => (
              <li
                key={i}
                style={{
                  fontSize: 'var(--crm-text-lg)',
                  color: S.ink,
                  fontWeight: 500,
                  lineHeight: 1.5,
                  display: 'flex',
                  gap: 'var(--crm-space-lg)',
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 'var(--crm-radius-pill)',
                    marginTop: 3,
                    background: S.invBg,
                    color: S.invInk,
                    flexShrink: 0,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <CrmIcon name="check" size={9} stroke={S.invInk} sw={3} />
                </span>
                {h}
              </li>
            ))}
          </ul>
        </div>
        <div
          style={{
            padding: 'var(--crm-space-6xl)',
            borderRadius: 'var(--crm-radius-3xl)',
            background: S.cardSubtle,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--crm-space-md)',
              marginBottom: 12,
              fontSize: 'var(--crm-text-sm)',
              fontWeight: 600,
              color: S.muted,
                                        }}
          >
            <CrmIcon name="flame" size={13} stroke={S.muted} sw={1.8} />
            {t('visitDetail.report.objections')}
          </div>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--crm-space-md)',
            }}
          >
            {(r.objections ?? []).map((h, i) => (
              <li
                key={i}
                style={{
                  fontSize: 'var(--crm-text-lg)',
                  color: S.ink,
                  fontWeight: 500,
                  lineHeight: 1.5,
                  display: 'flex',
                  gap: 'var(--crm-space-lg)',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 'var(--crm-radius-pill)',
                    marginTop: 8,
                    background: S.muted,
                    flexShrink: 0,
                  }}
                />
                {h}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Prochaine étape */}
      <div
        style={{
          marginTop: 18,
          padding: 'var(--crm-space-6xl)',
          borderRadius: 'var(--crm-radius-3xl)',
          background: S.cardSubtle,
        }}
      >
        <div
          style={{
            fontSize: 'var(--crm-text-sm)',
            fontWeight: 600,
            color: S.muted,
                                    marginBottom: 8,
          }}
        >
          {t('visitDetail.report.nextStep')}
        </div>
        <div
          style={{
            fontSize: 'var(--crm-text-xl)',
            color: S.ink,
            fontWeight: 500,
            lineHeight: 1.6,
          }}
        >
          {r.nextSteps}
        </div>
      </div>

      {/* Note vocale + photos */}
      <div
        style={{
          marginTop: 18,
          display: 'flex',
          gap: 'var(--crm-space-xl)',
          flexWrap: 'wrap',
        }}
      >
        {r.voiceNote && (
          <div
            style={{
              padding: 'var(--crm-space-xl) var(--crm-space-3xl)',
              borderRadius: 'var(--crm-radius-xl)',
              background: S.invBg,
              color: S.invInk,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--crm-space-xl)',
              flex: 1,
              minWidth: 280,
            }}
          >
            <button
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--crm-radius-pill)',
                border: 0,
                background: S.invVeil,
                color: S.invInk,
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <CrmIcon name="play" size={14} stroke={S.invInk} sw={2} />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 'var(--crm-text-md)',
                  fontWeight: 600,
                  marginBottom: 2,
                }}
              >
                {t('visitDetail.report.voiceNote', {
                  time: `${Math.floor(r.voiceNote.duration / 60)}:${(
                    r.voiceNote.duration % 60
                  )
                    .toString()
                    .padStart(2, '0')}`,
                })}
              </div>
              <div
                style={{
                  fontSize: 'var(--crm-text-xs)',
                  color: 'rgba(255,255,255,0.6)',
                  fontWeight: 500,
                }}
              >
                {t('visitDetail.report.autoTranscript')}
              </div>
            </div>
            <CrmIcon
              name="mic"
              size={14}
              stroke="rgba(255,255,255,0.6)"
              sw={1.8}
            />
          </div>
        )}
        {(r.photos ?? 0) > 0 && (
          <div
            style={{
              padding: 'var(--crm-space-xl) var(--crm-space-3xl)',
              borderRadius: 'var(--crm-radius-xl)',
              background: S.cardSubtle,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--crm-space-lg)',
            }}
          >
            <CrmIcon
              name="photos"
              size={15}
              stroke={S.inkSoft}
              sw={1.8}
            />
            <span
              style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: S.ink }}
            >
              {t('visitDetail.report.photoCount', { count: r.photos })}
            </span>
          </div>
        )}
      </div>
    </VdCard>
  )
}

