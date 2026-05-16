// MEGGA CRM Sugar v3 — Card Timeline activité unifiée
// Port 1:1 de crm-screen-contact-detail-sugar.jsx lignes 561-611 (CdTimelineCard).

import { SugarV3, fmtDateTime } from '../tokens'
import { SgIcon } from '../icons'
import { KycGhostPill, KycSection } from '../primitives'
import type { AuditEvent } from '@/types/kyc'

interface Props {
  events: AuditEvent[]
}

const CATEGORY_TO_ICON: Record<string, string> = {
  kyc: 'shield',
  deal: 'pipeline',
  contact: 'contact',
  bien: 'home',
  doc: 'file',
  auth: 'lock',
  settings: 'cog',
  ai: 'sparkle',
}

export function CdTimelineCard({ events }: Props) {
  const sorted = [...events].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  return (
    <KycSection
      title="Activité"
      eyebrow="Timeline unifiée"
      action={
        <div style={{ display: 'flex', gap: 6 }}>
          <KycGhostPill
            size="sm"
            icon={<SgIcon name="sparkle" size={13} stroke={SugarV3.inkSoft} />}
          >
            Résumer avec MEGGA AI
          </KycGhostPill>
          <KycGhostPill
            size="sm"
            icon={<SgIcon name="plus" size={13} stroke={SugarV3.inkSoft} sw={2} />}
          >
            Ajouter
          </KycGhostPill>
        </div>
      }
    >
      {sorted.length === 0 ? (
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
          Aucune activité enregistrée pour ce contact.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {sorted.map((ev, i) => {
            const iconName = ev.category
              ? CATEGORY_TO_ICON[ev.category] ?? 'note'
              : 'note'
            return (
              <div
                key={ev.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr',
                  gap: 16,
                  paddingBottom: i === sorted.length - 1 ? 0 : 20,
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
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      background: SugarV3.cardSubtle,
                      color: SugarV3.ink,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <SgIcon name={iconName} size={16} stroke={SugarV3.ink} />
                  </div>
                  {i < sorted.length - 1 && (
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
                <div style={{ paddingTop: 4 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: SugarV3.ink,
                      letterSpacing: -0.2,
                      marginBottom: 3,
                    }}
                  >
                    {ev.action}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: SugarV3.muted,
                      fontWeight: 500,
                      marginBottom: 6,
                    }}
                  >
                    {fmtDateTime(ev.created_at)} ·{' '}
                    {ev.actor_id ? 'Agent' : 'MEGGA AI'}
                  </div>
                  {ev.object_label && (
                    <div
                      style={{
                        fontSize: 13,
                        color: SugarV3.inkSoft,
                        fontWeight: 500,
                        lineHeight: 1.55,
                      }}
                    >
                      {ev.object_label}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </KycSection>
  )
}
