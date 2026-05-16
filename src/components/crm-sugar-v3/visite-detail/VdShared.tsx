// MEGGA CRM Sugar v3 — Fiche Visite (Sprint 2) — composants partagés
// Port pixel-près de crm-screen-visite-sugar.jsx (handoff Sprint 2).
//
// Trois composants principaux :
//   - VdBonPanel       : panneau Bon de visite (avant) + zone signature
//   - VdRapportPanel   : panneau Rapport (après) — sentiment + highlights + objections + voice note
//   - VdMobileCompanion: iPhone 375×812 simulé — outil terrain agent

import type { CSSProperties, ReactNode } from 'react'
import { SugarV3 } from '../tokens'
import { SgIcon } from '../icons'
import { VISIT_SENTIMENT_LABELS, type VisitSentiment } from '@/types/visit'
import type { VisitDetail } from '@/hooks/useVisitDetail'

// ─── Eyebrow + Card ─────────────────────────────────────────────────────
export function VdEyebrow({ children }: { children: ReactNode }) {
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

export function VdCard({
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
  const signed = !!visit.bon?.signedAt
  return (
    <VdCard>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
          gap: 12,
        }}
      >
        <div>
          <VdEyebrow>Bon de visite · {signed ? 'Signé' : 'À signer'}</VdEyebrow>
          <h2
            style={{
              margin: '10px 0 0',
              fontSize: 22,
              fontWeight: 700,
              color: SugarV3.ink,
              letterSpacing: -0.4,
            }}
          >
            Document de visite
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            title="Télécharger PDF"
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              border: 0,
              background: SugarV3.cardSubtle,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              boxShadow: SugarV3.shadowSm,
            }}
          >
            <SgIcon name="download" size={16} stroke={SugarV3.inkSoft} />
          </button>
          <button
            title="Envoyer"
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              border: 0,
              background: SugarV3.cardSubtle,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              boxShadow: SugarV3.shadowSm,
            }}
          >
            <SgIcon name="mail" size={16} stroke={SugarV3.inkSoft} />
          </button>
        </div>
      </div>

      {/* Aperçu document PDF */}
      <div
        style={{
          marginTop: 22,
          padding: 28,
          borderRadius: 18,
          background: '#FAFBFC',
          boxShadow: `inset 0 0 0 1px ${SugarV3.cardSubtle}`,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: SugarV3.ink,
              letterSpacing: 4,
              marginBottom: 6,
            }}
          >
            MEGGA REAL ESTATE
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: SugarV3.ink,
              letterSpacing: -0.3,
            }}
          >
            Bon de visite
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            fontSize: 13,
          }}
        >
          <div
            style={{
              paddingBottom: 14,
              borderBottom: `1px dashed ${SugarV3.cardSubtle}`,
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                color: SugarV3.muted,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 6,
              }}
            >
              Bien
            </div>
            <div
              style={{ fontWeight: 700, color: SugarV3.ink, fontSize: 14 }}
            >
              {visit.property?.title ?? '—'}
            </div>
            <div
              style={{
                color: SugarV3.inkSoft,
                fontSize: 12.5,
                marginTop: 2,
              }}
            >
              {visit.property?.address ?? '—'}
            </div>
          </div>
          <div
            style={{
              paddingBottom: 14,
              borderBottom: `1px dashed ${SugarV3.cardSubtle}`,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 18,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10.5,
                  color: SugarV3.muted,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 6,
                }}
              >
                Visiteur
              </div>
              <div
                style={{
                  fontWeight: 700,
                  color: SugarV3.ink,
                  fontSize: 13.5,
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
                  fontSize: 10.5,
                  color: SugarV3.muted,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 6,
                }}
              >
                Agent
              </div>
              <div
                style={{
                  fontWeight: 700,
                  color: SugarV3.ink,
                  fontSize: 13.5,
                }}
              >
                {visit.agent?.full_name ?? 'Grégory L.'}
              </div>
            </div>
          </div>
          <div
            style={{
              paddingBottom: 14,
              borderBottom: `1px dashed ${SugarV3.cardSubtle}`,
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                color: SugarV3.muted,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 6,
              }}
            >
              Date & heure
            </div>
            <div
              style={{
                fontWeight: 700,
                color: SugarV3.ink,
                fontSize: 13.5,
              }}
            >
              {vdDateTime(visit.scheduled_at)}
            </div>
            <div
              style={{
                color: SugarV3.muted,
                fontSize: 11.5,
                marginTop: 2,
              }}
            >
              Durée prévue : {visit.duration_minutes} min
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 10.5,
                color: SugarV3.muted,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 8,
              }}
            >
              Engagement du visiteur
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: SugarV3.inkSoft,
                lineHeight: 1.6,
                fontWeight: 500,
              }}
            >
              Le visiteur reconnaît avoir été informé de l'existence du mandat
              liant le vendeur à MEGGA et s'engage à ne pas contacter
              directement le vendeur. Toute transaction réalisée dans les 24
              mois suivant cette visite sera due à l'agence selon les termes du
              mandat.
            </p>
          </div>
        </div>

        {/* Zone signature */}
        <div
          style={{
            marginTop: 26,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
          }}
        >
          {[
            {
              l: 'Signature visiteur',
              signed,
              name: visit.bon?.visitorNames?.[0],
            },
            {
              l: 'Signature agent',
              signed,
              name: visit.agent?.full_name ?? 'Grégory L.',
            },
          ].map((s) => (
            <div
              key={s.l}
              style={{
                padding: 14,
                borderRadius: 12,
                background: SugarV3.card,
                boxShadow: `inset 0 0 0 1px ${SugarV3.cardSubtle}`,
                minHeight: 70,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: SugarV3.muted,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
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
                      fontSize: 22,
                      color: SugarV3.ink,
                      lineHeight: 1,
                    }}
                  >
                    {s.name}
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 9.5,
                      color: SugarV3.muted,
                      fontWeight: 600,
                    }}
                  >
                    Signé électroniquement
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
                    fontSize: 11,
                    color: SugarV3.ghost,
                    fontWeight: 500,
                  }}
                >
                  En attente de signature
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
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <button
          style={{
            height: 40,
            padding: '0 18px',
            borderRadius: 999,
            border: 0,
            background: 'transparent',
            color: SugarV3.inkSoft,
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <SgIcon name="download" size={14} stroke={SugarV3.inkSoft} />
          Télécharger PDF
        </button>
        <button
          style={{
            height: 40,
            padding: '0 18px',
            borderRadius: 999,
            border: 0,
            background: 'transparent',
            color: SugarV3.inkSoft,
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <SgIcon name="mail" size={14} stroke={SugarV3.inkSoft} />
          Envoyer par email
        </button>
        {!signed && (
          <button
            onClick={onSign}
            style={{
              height: 40,
              padding: '0 18px',
              borderRadius: 999,
              border: 0,
              background: SugarV3.black,
              color: '#fff',
              fontFamily: 'inherit',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 9,
              boxShadow: '0 6px 16px rgba(11,12,14,0.18)',
            }}
          >
            <SgIcon name="pen" size={14} stroke="#fff" sw={2} />
            Faire signer maintenant
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
  const r = visit.rapport
  const done = visit.kind === 'done' && r

  if (!done) {
    return (
      <VdCard>
        <VdEyebrow>Rapport · En attente de la visite</VdEyebrow>
        <h2
          style={{
            margin: '10px 0 16px',
            fontSize: 22,
            fontWeight: 700,
            color: SugarV3.ink,
            letterSpacing: -0.4,
          }}
        >
          Rapport de visite
        </h2>
        <div
          style={{
            padding: 28,
            borderRadius: 18,
            background: SugarV3.cardSubtle,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              margin: '0 auto 14px',
              background: SugarV3.card,
              color: SugarV3.muted,
              display: 'grid',
              placeItems: 'center',
              boxShadow: SugarV3.shadowSm,
            }}
          >
            <SgIcon name="clock" size={24} stroke={SugarV3.muted} sw={1.8} />
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: SugarV3.ink,
              marginBottom: 6,
            }}
          >
            Le rapport sera disponible après la visite
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: SugarV3.muted,
              fontWeight: 500,
              lineHeight: 1.5,
            }}
          >
            Pendant la visite, utilisez la vue mobile compagnon pour prendre
            des notes vocales, photos et impressions. Le rapport se remplira
            automatiquement.
          </div>
        </div>
      </VdCard>
    )
  }

  const sent = VISIT_SENTIMENT_LABELS[r.sentiment as VisitSentiment] ?? {
    label: 'Tiède',
    tone: SugarV3.muted,
  }

  return (
    <VdCard>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <VdEyebrow>
            Rapport ·{' '}
            {new Date(r.savedAt).toLocaleDateString('fr-CH', {
              day: '2-digit',
              month: 'short',
            })}
          </VdEyebrow>
          <h2
            style={{
              margin: '10px 0 0',
              fontSize: 22,
              fontWeight: 700,
              color: SugarV3.ink,
              letterSpacing: -0.4,
            }}
          >
            Rapport de visite
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 999,
              background: SugarV3.cardSubtle,
              color: SugarV3.ink,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: sent.tone,
              }}
            />
            {sent.label}
          </span>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: 10.5,
                color: SugarV3.muted,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Score
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: SugarV3.ink,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {r.interestLevel}
              <span
                style={{
                  fontSize: 13,
                  color: SugarV3.muted,
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
          gap: 18,
        }}
      >
        <div
          style={{
            padding: 22,
            borderRadius: 18,
            background: SugarV3.cardSubtle,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
              fontSize: 11.5,
              fontWeight: 700,
              color: SugarV3.muted,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            <SgIcon name="smile" size={13} stroke={SugarV3.muted} sw={1.8} />
            Points positifs
          </div>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {(r.highlights ?? []).map((h, i) => (
              <li
                key={i}
                style={{
                  fontSize: 13,
                  color: SugarV3.ink,
                  fontWeight: 500,
                  lineHeight: 1.5,
                  display: 'flex',
                  gap: 10,
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 999,
                    marginTop: 3,
                    background: SugarV3.ink,
                    color: '#fff',
                    flexShrink: 0,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <SgIcon name="check" size={9} stroke="#fff" sw={3} />
                </span>
                {h}
              </li>
            ))}
          </ul>
        </div>
        <div
          style={{
            padding: 22,
            borderRadius: 18,
            background: SugarV3.cardSubtle,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
              fontSize: 11.5,
              fontWeight: 700,
              color: SugarV3.muted,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            <SgIcon name="flame" size={13} stroke={SugarV3.muted} sw={1.8} />
            Objections
          </div>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {(r.objections ?? []).map((h, i) => (
              <li
                key={i}
                style={{
                  fontSize: 13,
                  color: SugarV3.ink,
                  fontWeight: 500,
                  lineHeight: 1.5,
                  display: 'flex',
                  gap: 10,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    marginTop: 8,
                    background: SugarV3.muted,
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
          padding: 22,
          borderRadius: 18,
          background: SugarV3.cardSubtle,
        }}
      >
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            color: SugarV3.muted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 8,
          }}
        >
          Prochaine étape
        </div>
        <div
          style={{
            fontSize: 14,
            color: SugarV3.ink,
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
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        {r.voiceNote && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 14,
              background: SugarV3.ink,
              color: '#fff',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 12,
              flex: 1,
              minWidth: 280,
            }}
          >
            <button
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                border: 0,
                background: 'rgba(255,255,255,0.12)',
                color: '#fff',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <SgIcon name="play" size={14} stroke="#fff" sw={2} />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 2,
                }}
              >
                Note vocale agent · {Math.floor(r.voiceNote.duration / 60)}:
                {(r.voiceNote.duration % 60).toString().padStart(2, '0')}
              </div>
              <div
                style={{
                  fontSize: 10.5,
                  color: 'rgba(255,255,255,0.6)',
                  fontWeight: 500,
                }}
              >
                Transcription automatique disponible
              </div>
            </div>
            <SgIcon
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
              padding: '12px 16px',
              borderRadius: 14,
              background: SugarV3.cardSubtle,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <SgIcon
              name="photos"
              size={15}
              stroke={SugarV3.inkSoft}
              sw={1.8}
            />
            <span
              style={{ fontSize: 13, fontWeight: 700, color: SugarV3.ink }}
            >
              {r.photos} photo{r.photos > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    </VdCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//  Vue mobile compagnon — iPhone 360×~ simulé
//
//  Note : sur la fiche desktop on l'embarque dans une frame iPhone à droite ;
//  sur la route /visite/:id/companion on l'utilise full-screen sans la frame.
// ═══════════════════════════════════════════════════════════════════════
export function VdMobileCompanion({
  visit,
  framed = true,
}: {
  visit: VisitDetail
  framed?: boolean
}) {
  const r = visit.rapport

  const content = (
    <div
      style={{
        width: '100%',
        height: framed ? '100%' : '100vh',
        background: SugarV3.bgGradient,
        borderRadius: framed ? 32 : 0,
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {framed && (
        <div
          style={{
            padding: '14px 24px 6px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 13,
            fontWeight: 700,
            color: SugarV3.ink,
            fontFamily: 'system-ui',
          }}
        >
          <span>14:32</span>
          <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
            <svg width="18" height="10" viewBox="0 0 18 10">
              <path
                d="M2 9c2-3 5-3 7 0M0 7c3-4 8-4 11 0M6 5c1-2 2-2 3 0"
                stroke="#0B0C0E"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
            <svg width="22" height="10" viewBox="0 0 22 10">
              <rect
                x="0"
                y="2"
                width="18"
                height="6"
                rx="1.5"
                fill="none"
                stroke="#0B0C0E"
                strokeWidth="1"
              />
              <rect x="2" y="3.5" width="13" height="3" fill="#0B0C0E" />
              <rect x="19" y="4" width="2" height="2" fill="#0B0C0E" />
            </svg>
          </span>
        </div>
      )}

      <div
        style={{
          flex: 1,
          padding: '10px 16px 16px',
          overflowY: 'auto',
        }}
      >
        {/* Header mini */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              background: SugarV3.card,
              color: SugarV3.inkSoft,
              display: 'grid',
              placeItems: 'center',
              boxShadow: SugarV3.shadowSm,
            }}
          >
            <SgIcon name="arrowL" size={15} stroke={SugarV3.inkSoft} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 9.5,
                color: SugarV3.muted,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Visite en cours
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: SugarV3.ink,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {visit.property?.title}
            </div>
          </div>
          <div
            style={{
              padding: '5px 10px',
              borderRadius: 999,
              background: SugarV3.ink,
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            ● REC 12:42
          </div>
        </div>

        {/* Hero mini bien */}
        <div
          style={{
            background: SugarV3.card,
            borderRadius: 18,
            padding: 14,
            marginBottom: 14,
            boxShadow: SugarV3.shadow,
          }}
        >
          <div
            style={{
              fontSize: 9.5,
              color: SugarV3.muted,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 4,
            }}
          >
            Visiteur
          </div>
          <div
            style={{ fontSize: 14, fontWeight: 700, color: SugarV3.ink }}
          >
            {visit.contact
              ? `${visit.contact.first_name} ${visit.contact.last_name}`
              : visit.bon?.visitorNames?.[0]}
          </div>
          <div
            style={{
              fontSize: 10.5,
              color: SugarV3.muted,
              fontWeight: 500,
              marginTop: 4,
            }}
          >
            {visit.property?.address}
          </div>
        </div>

        {/* Sentiment quick */}
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              fontSize: 9.5,
              color: SugarV3.muted,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 8,
            }}
          >
            Sentiment du visiteur
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 8,
            }}
          >
            {(
              [
                { l: 'Froid', k: 'cold' as const },
                { l: 'Tiède', k: 'cool' as const },
                { l: 'Intéressé', k: 'warm' as const },
                { l: 'Chaud', k: 'hot' as const },
              ]
            ).map((s) => {
              const active = r?.sentiment === s.k
              return (
                <div
                  key={s.k}
                  style={{
                    padding: '10px 0',
                    borderRadius: 14,
                    background: active ? SugarV3.ink : SugarV3.card,
                    color: active ? '#fff' : SugarV3.inkSoft,
                    fontSize: 10,
                    fontWeight: 700,
                    textAlign: 'center',
                    boxShadow: active
                      ? '0 4px 12px rgba(11,12,14,0.20)'
                      : SugarV3.shadowSm,
                  }}
                >
                  {s.l}
                </div>
              )
            })}
          </div>
        </div>

        {/* Notes rapides */}
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              fontSize: 9.5,
              color: SugarV3.muted,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 8,
            }}
          >
            Notes rapides
          </div>
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
          >
            {(r?.highlights ?? [
              'Exposition sud appréciée',
              'Cuisine à revoir',
            ])
              .slice(0, 3)
              .map((h, i) => (
                <div
                  key={i}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: SugarV3.card,
                    color: SugarV3.ink,
                    fontSize: 11.5,
                    fontWeight: 500,
                    lineHeight: 1.4,
                    boxShadow: SugarV3.shadowSm,
                  }}
                >
                  {h}
                </div>
              ))}
          </div>
        </div>

        {/* Big mic */}
        <button
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: 16,
            border: 0,
            background: SugarV3.ink,
            color: '#fff',
            fontFamily: 'inherit',
            fontWeight: 700,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 8px 20px rgba(11,12,14,0.25)',
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              background: 'rgba(255,255,255,0.16)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <SgIcon name="mic" size={16} stroke="#fff" sw={2} />
          </span>
          <div style={{ textAlign: 'left', flex: 1 }}>
            <div>Note vocale</div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.65)',
              }}
            >
              Transcrite et ajoutée au rapport
            </div>
          </div>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: SugarV3.err,
              animation: 'vdPulse 1.5s ease-in-out infinite',
            }}
          />
        </button>

        {/* Photo / Signature */}
        <div
          style={{
            marginTop: 10,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
          }}
        >
          {[
            { l: 'Photo', icon: 'photos' as const },
            { l: 'Signature', icon: 'pen' as const },
          ].map((b) => (
            <button
              key={b.l}
              style={{
                padding: '12px 0',
                borderRadius: 14,
                border: 0,
                background: SugarV3.card,
                color: SugarV3.ink,
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 11,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: SugarV3.shadowSm,
                cursor: 'pointer',
              }}
            >
              <SgIcon name={b.icon} size={13} stroke={SugarV3.ink} sw={1.8} />
              {b.l}
            </button>
          ))}
        </div>

        {/* AI hint */}
        <div
          style={{
            marginTop: 14,
            padding: '10px 12px',
            borderRadius: 14,
            background: SugarV3.card,
            boxShadow: SugarV3.shadowSm,
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
          }}
        >
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: 999,
              flexShrink: 0,
              background: SugarV3.ink,
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <SgIcon name="sparkle" size={11} stroke="#fff" sw={2} />
          </span>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 10,
                color: SugarV3.muted,
                fontWeight: 700,
              }}
            >
              MEGGA AI
            </div>
            <div
              style={{
                fontSize: 10.5,
                color: SugarV3.inkSoft,
                fontWeight: 500,
                lineHeight: 1.4,
                marginTop: 1,
              }}
            >
              Pense à demander si la cuisine est un point bloquant.
            </div>
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      {framed && (
        <div
          style={{
            padding: 12,
            background: SugarV3.card,
            display: 'flex',
            justifyContent: 'space-around',
          }}
        >
          {(
            [
              { icon: 'home' as const, a: false },
              { icon: 'mic' as const, a: true },
              { icon: 'photos' as const, a: false },
              { icon: 'user' as const, a: false },
            ]
          ).map((b, i) => (
            <div
              key={i}
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: b.a ? SugarV3.ink : 'transparent',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <SgIcon
                name={b.icon}
                size={16}
                stroke={b.a ? '#fff' : SugarV3.muted}
                sw={1.8}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )

  if (!framed) return content

  return (
    <div
      style={{
        width: 360,
        flexShrink: 0,
        animation: 'sgFadeUp .6s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <VdEyebrow>Vue mobile · Compagnon visite</VdEyebrow>
      <div
        style={{
          marginTop: 12,
          marginBottom: 14,
          fontSize: 13,
          color: SugarV3.muted,
          fontWeight: 500,
          lineHeight: 1.5,
        }}
      >
        Ce que l'agent voit sur son téléphone{' '}
        <strong style={{ color: SugarV3.ink, fontWeight: 700 }}>pendant</strong>{' '}
        la visite : capture rapide, note vocale, signature tactile.
      </div>

      {/* iPhone frame */}
      <div
        style={{
          width: 360,
          padding: 12,
          background: SugarV3.ink,
          borderRadius: 44,
          boxShadow: SugarV3.shadowLg,
        }}
      >
        <div style={{ position: 'relative', marginBottom: 6 }}>
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 0,
              transform: 'translateX(-50%)',
              width: 100,
              height: 24,
              background: SugarV3.ink,
              borderRadius: '0 0 16px 16px',
              zIndex: 2,
            }}
          />
        </div>
        <div style={{ width: '100%', aspectRatio: '9/19.5' }}>
          {content}
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          padding: '12px 14px',
          borderRadius: 16,
          background: SugarV3.card,
          boxShadow: SugarV3.shadowSm,
          fontSize: 12,
          color: SugarV3.inkSoft,
          lineHeight: 1.5,
        }}
      >
        Synchronisation temps réel avec le bureau : tout ce que l'agent
        capture remonte automatiquement dans le rapport ci-contre.
      </div>
    </div>
  )
}
