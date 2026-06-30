// MEGGA CRM Sugar v3 — Carte « Suivis suggérés » (engagements actionnables WhatsApp).
// MEGGA dérive des suggestions datées depuis la conversation ; l'agent ACCEPTE
// (→ vrai rappel) ou IGNORE. Human-in-the-loop : rien n'est créé sans son clic.
// Mêmes tokens / primitives que CdConversationInsight.

import { useTranslation } from 'react-i18next'
import { SugarV3 } from '../tokens'
import { SgIcon } from '../icons'
import { KycSection, KycBlackPill, KycGhostPill } from '../primitives'
import {
  useFollowupSuggestions,
  useFollowupActions,
  type FollowupKind,
} from '@/hooks/useFollowupSuggestions'

const KIND_KEY: Record<FollowupKind, string> = {
  commitment: 'cd.followupKind_commitment',
  next_action: 'cd.followupKind_next_action',
  client_availability: 'cd.followupKind_client_availability',
}

function formatDue(iso: string | null, locale: string): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString(locale, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich',
  })
}

interface Props {
  contactId: string
}

export function CdFollowupSuggestions({ contactId }: Props) {
  const { t, i18n } = useTranslation('contacts')
  const { data: items, isLoading } = useFollowupSuggestions(contactId)
  const { accept, dismiss } = useFollowupActions(contactId)
  const locale = i18n.language?.startsWith('en') ? 'en-GB' : 'fr-CH'

  // Silencieux tant qu'il n'y a rien à proposer (comme la carte insight).
  if (isLoading || !items || items.length === 0) return null

  const busyId = accept.isPending ? accept.variables : dismiss.isPending ? dismiss.variables : null

  return (
    <KycSection
      eyebrow={t('cd.insightEyebrow')}
      title={t('cd.followupTitle')}
      action={<SgIcon name="sparkle" size={18} stroke={SugarV3.muted} sw={1.6} />}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((s) => {
          const due = formatDue(s.due_at, locale)
          const busy = busyId === s.id
          return (
            <div
              key={s.id}
              style={{
                borderRadius: 14,
                background: SugarV3.cardSubtle,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                opacity: busy ? 0.6 : 1,
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    padding: '3px 9px',
                    borderRadius: 999,
                    background: SugarV3.card,
                    color: SugarV3.muted,
                    fontSize: 10.5,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t(KIND_KEY[s.kind])}
                </span>
                {due && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: SugarV3.inkSoft, fontSize: 12, fontWeight: 600 }}>
                    <SgIcon name="clock" size={13} stroke={SugarV3.muted} sw={1.7} />
                    {due}
                  </span>
                )}
              </div>

              <div style={{ color: SugarV3.ink, fontSize: 14, lineHeight: 1.45 }}>{s.action}</div>

              <div style={{ display: 'flex', gap: 8 }}>
                <KycBlackPill
                  onClick={() => !busy && accept.mutate(s.id)}
                  disabled={busy}
                  icon={<SgIcon name="bell" size={14} stroke="#fff" sw={1.8} />}
                >
                  {t('cd.followupAccept')}
                </KycBlackPill>
                <KycGhostPill onClick={() => !busy && dismiss.mutate(s.id)} disabled={busy} size="sm">
                  {t('cd.followupDismiss')}
                </KycGhostPill>
              </div>
            </div>
          )
        })}

        <div style={{ fontSize: 11, color: SugarV3.muted }}>{t('cd.followupFooter')}</div>
      </div>
    </KycSection>
  )
}
