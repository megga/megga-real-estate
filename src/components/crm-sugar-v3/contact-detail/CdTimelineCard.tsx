// MEGGA CRM Sugar v3 — Card Timeline activité unifiée
// Port 1:1 de crm-screen-contact-detail-sugar.jsx lignes 561-611 (CdTimelineCard).
// Tier 1 mail : merge optionnel d'emails Gmail/Outlook avec les activity_events
// → timeline réellement unifiée.

import { SugarV3, fmtDateTime } from '../tokens'
import { SgIcon } from '../icons'
import { KycGhostPill, KycSection } from '../primitives'
import type { AuditEvent } from '@/types/kyc'
import type { EmailMessage } from '@/hooks/useGmail'

interface EmailEntry extends EmailMessage {
  provider: 'gmail' | 'outlook'
}

interface Props {
  events: AuditEvent[]
  /** Emails Gmail + Outlook mergés à la timeline. Direction (sent/received)
   *  déduite via comparaison from_address vs contactEmail. */
  emails?: EmailEntry[]
  contactEmail?: string | null
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

interface TimelineItem {
  key: string
  kind: 'event' | 'email'
  ts: number
  payload: AuditEvent | EmailEntry
}

export function CdTimelineCard({ events, emails = [], contactEmail }: Props) {
  // Merge events + emails dans une liste unifiée triée par date desc
  const merged: TimelineItem[] = [
    ...events.map(e => ({
      key: `ev-${e.id}`,
      kind: 'event' as const,
      ts: new Date(e.created_at).getTime(),
      payload: e,
    })),
    ...emails.map(m => ({
      key: `email-${m.provider}-${m.id}`,
      kind: 'email' as const,
      ts: new Date(m.sent_at).getTime(),
      payload: m,
    })),
  ]
  const sorted = merged.sort((a, b) => b.ts - a.ts)

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
          {sorted.map((item, i) => {
            const isLast = i === sorted.length - 1
            const lowerEmail = contactEmail?.toLowerCase()

            let iconName = 'note'
            let title = ''
            let subtitle = ''
            let detail = ''

            if (item.kind === 'event') {
              const ev = item.payload as AuditEvent
              iconName = ev.category ? CATEGORY_TO_ICON[ev.category] ?? 'note' : 'note'
              title = ev.action
              subtitle = `${fmtDateTime(ev.created_at)} · ${ev.actor_id ? 'Agent' : 'MEGGA AI'}`
              detail = ev.object_label ?? ''
            } else {
              const em = item.payload as EmailEntry
              const isReceived = em.from_address?.toLowerCase() === lowerEmail
              iconName = 'mail'
              title = isReceived
                ? `Email reçu — ${em.from_name || em.from_address}`
                : `Email envoyé à ${em.to_addresses[0] ?? em.from_address}`
              subtitle = `${fmtDateTime(em.sent_at)} · ${em.provider === 'gmail' ? 'Gmail' : 'Outlook'}${em.is_unread ? ' · Non lu' : ''}`
              detail = em.subject || em.snippet || '(Sans objet)'
            }

            return (
              <div
                key={item.key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr',
                  gap: 16,
                  paddingBottom: isLast ? 0 : 20,
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
                      background: item.kind === 'email'
                        ? ((item.payload as EmailEntry).provider === 'gmail' ? '#FFE9E5' : '#E5EFFB')
                        : SugarV3.cardSubtle,
                      color: SugarV3.ink,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <SgIcon name={iconName} size={16} stroke={SugarV3.ink} />
                  </div>
                  {!isLast && (
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
                    {title}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: SugarV3.muted,
                      fontWeight: 500,
                      marginBottom: 6,
                    }}
                  >
                    {subtitle}
                  </div>
                  {detail && (
                    <div
                      style={{
                        fontSize: 13,
                        color: SugarV3.inkSoft,
                        fontWeight: 500,
                        lineHeight: 1.55,
                      }}
                    >
                      {detail}
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
