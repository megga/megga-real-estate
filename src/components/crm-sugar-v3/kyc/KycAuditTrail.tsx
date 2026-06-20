// MEGGA CRM Sugar v3 — Piste d'audit du dossier (mini timeline)
// Port 1:1 de crm-screen-kyc-sugar.jsx lignes 499-584 (KycAuditTrail).

import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { fmtDateTime } from '../tokens'
import { KycGhostPill } from './kycPrimitives'
import { useKycPalette } from './kycPalette'
import { SgIcon } from '../icons'
import type { KycAuditEvent } from '@/types/kyc'

interface Props {
  events: KycAuditEvent[]
  onExportPdf?: () => void
}

interface TimelineEntry {
  at: string
  label: string
  actor: string
  severity?: 'info' | 'warn' | 'critical'
  note?: string
}

function resolveActor(e: KycAuditEvent, t: TFunction): string {
  if (e.actor_kind === 'ai') return 'MEGGA AI'
  if (e.actor_kind === 'system') return t('dossier.audit.actorSystem')
  const name = e.actor?.full_name?.trim()
  if (name) return name
  if (e.actor_id) return t('dossier.audit.actorUnknown')
  return t('dossier.audit.actorSystem')
}

export function KycAuditTrail({ events, onExportPdf }: Props) {
  const sp = useKycPalette()
  const { t } = useTranslation('kyc')
  const entries: TimelineEntry[] = events
    .map((e) => {
      const sev =
        typeof e.metadata?.severity === 'string'
          ? (e.metadata.severity as 'info' | 'warn' | 'critical')
          : undefined
      return {
        at: e.created_at,
        label: e.action,
        actor: resolveActor(e, t),
        severity: sev,
        note:
          typeof e.metadata?.note === 'string'
            ? (e.metadata.note as string)
            : undefined,
      }
    })
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  return (
    <div
      style={{
        background: sp.card,
        borderRadius: 22,
        padding: '26px 28px',
        border: `1px solid ${sp.cardBorder}`,
        boxShadow: sp.shadow,
        animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: sp.muted,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          {t('dossier.audit.eyebrow')}
        </div>
        <h3
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 700,
            color: sp.ink,
            letterSpacing: -0.3,
          }}
        >
          {t('dossier.audit.title')}
        </h3>
      </div>

      {entries.length === 0 ? (
        <div
          style={{
            padding: '32px 20px',
            textAlign: 'center',
            background: sp.cardSubtle,
            borderRadius: 16,
            color: sp.muted,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {t('dossier.audit.empty')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {entries.map((ev, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                gap: 16,
                paddingBottom: i === entries.length - 1 ? 0 : 18,
                position: 'relative',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: sp.black,
                    flexShrink: 0,
                    boxShadow: '0 0 0 4px rgba(11,12,14,0.06)',
                  }}
                />
                {i < entries.length - 1 && (
                  <div
                    style={{
                      width: 2,
                      flex: 1,
                      background: sp.cardSubtle,
                      marginTop: 4,
                    }}
                  />
                )}
              </div>
              <div>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: sp.ink,
                    letterSpacing: -0.1,
                    marginBottom: 2,
                  }}
                >
                  {ev.label}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: sp.muted,
                    fontWeight: 500,
                  }}
                >
                  {fmtDateTime(ev.at)} · {ev.actor}
                </div>
                {ev.note && (
                  <div
                    style={{
                      fontSize: 12,
                      color: sp.inkSoft,
                      fontWeight: 500,
                      marginTop: 6,
                      lineHeight: 1.5,
                    }}
                  >
                    {ev.note}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          marginTop: 24,
          paddingTop: 18,
          borderTop: `1px solid ${sp.cardSubtle}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 12,
          color: sp.muted,
          fontWeight: 500,
        }}
      >
        <span>{t('dossier.audit.retention')}</span>
        <KycGhostPill
          onClick={onExportPdf}
          icon={<SgIcon name="download" size={14} stroke={sp.inkSoft} />}
        >
          {t('dossier.audit.exportPdf')}
        </KycGhostPill>
      </div>
    </div>
  )
}
