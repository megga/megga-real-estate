// MEGGA CRM Sugar v3 — Piste d'audit du dossier (mini timeline)
// Port 1:1 de crm-screen-kyc-sugar.jsx lignes 499-584 (KycAuditTrail).

import { SugarV3, fmtDateTime } from '../tokens'
import { KycGhostPill } from '../primitives'
import { SgIcon } from '../icons'
import type { AuditEvent } from '@/types/kyc'

interface Props {
  events: AuditEvent[]
  onExportPdf?: () => void
}

interface TimelineEntry {
  at: string
  label: string
  actor: string
  note?: string
}

export function KycAuditTrail({ events, onExportPdf }: Props) {
  // Transforme les AuditEvents en entrées timeline lisibles
  const entries: TimelineEntry[] = events
    .map((e) => ({
      at: e.created_at,
      label: e.action,
      actor: e.actor_id ? 'Agent' : 'Système',
      note:
        typeof e.metadata?.note === 'string'
          ? (e.metadata.note as string)
          : undefined,
    }))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  return (
    <div
      style={{
        background: SugarV3.card,
        borderRadius: 22,
        padding: '26px 28px',
        boxShadow: SugarV3.shadow,
        animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: SugarV3.muted,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          Conformité nLPD · LBA
        </div>
        <h3
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 700,
            color: SugarV3.ink,
            letterSpacing: -0.3,
          }}
        >
          Piste d'audit
        </h3>
      </div>

      {entries.length === 0 ? (
        <div
          style={{
            padding: '32px 20px',
            textAlign: 'center',
            background: SugarV3.cardSubtle,
            borderRadius: 16,
            color: SugarV3.muted,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          Aucune action enregistrée — dossier non démarré.
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
                    background: SugarV3.black,
                    flexShrink: 0,
                    boxShadow: '0 0 0 4px rgba(11,12,14,0.06)',
                  }}
                />
                {i < entries.length - 1 && (
                  <div
                    style={{
                      width: 2,
                      flex: 1,
                      background: SugarV3.cardSubtle,
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
                    color: SugarV3.ink,
                    letterSpacing: -0.1,
                    marginBottom: 2,
                  }}
                >
                  {ev.label}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: SugarV3.muted,
                    fontWeight: 500,
                  }}
                >
                  {fmtDateTime(ev.at)} · {ev.actor}
                </div>
                {ev.note && (
                  <div
                    style={{
                      fontSize: 12,
                      color: SugarV3.inkSoft,
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
          borderTop: `1px solid ${SugarV3.cardSubtle}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 12,
          color: SugarV3.muted,
          fontWeight: 500,
        }}
      >
        <span>Traçabilité conservée 10 ans (art. 7 LBA)</span>
        <KycGhostPill
          onClick={onExportPdf}
          icon={<SgIcon name="download" size={14} stroke={SugarV3.inkSoft} />}
        >
          Exporter PDF horodaté
        </KycGhostPill>
      </div>
    </div>
  )
}
