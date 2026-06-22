// MEGGA CRM Sugar v3 — Carte « Compréhension MEGGA » (insights WhatsApp).
// Lecture seule. Assistance IA — jamais automatique, jamais garantie.
// Mirroir visuel de CdKycCard : même imports, même tokens, même KycSection.

import { useTranslation } from 'react-i18next'
import { SugarV3 } from '../tokens'
import { SgIcon } from '../icons'
import { KycSection } from '../primitives'
import { useConversationInsight } from '@/hooks/useConversationInsight'
import {
  nextActionLabel,
  sentimentTone,
  entityChips,
} from './conversationInsight.helpers'

// ─── Pill colorée (intent / sentiment) ────────────────────────────────────────
interface PillProps {
  label: string
  tone: 'ok' | 'err' | 'neutral'
}

function Pill({ label, tone }: PillProps) {
  const map = {
    ok: { bg: SugarV3.okSoft, fg: SugarV3.ok },
    err: { bg: SugarV3.errSoft, fg: SugarV3.errDarker },
    neutral: { bg: SugarV3.cardSubtle, fg: SugarV3.inkSoft },
  } as const
  const c = map[tone]
  return (
    <span
      style={{
        padding: '4px 10px',
        borderRadius: 999,
        background: c.bg,
        color: c.fg,
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

// ─── Carte principale ─────────────────────────────────────────────────────────
interface Props {
  contactId: string
}

export function CdConversationInsight({ contactId }: Props) {
  const { t } = useTranslation('contacts')
  const { data: insight, isLoading, error } = useConversationInsight(contactId)

  // Pas de données → ne rien afficher (empty state silencieux)
  if (!isLoading && !error && !insight) return null

  const sent = insight ? sentimentTone(insight.sentiment, t) : null
  const chips = insight ? entityChips(insight.entities as Record<string, unknown>, t) : []

  return (
    <KycSection
      eyebrow={t('cd.insightEyebrow')}
      title={t('cd.insightTitle')}
      action={
        <SgIcon name="sparkle" size={18} stroke={SugarV3.muted} sw={1.6} />
      }
    >
      {isLoading && (
        <div style={{ color: SugarV3.muted, fontSize: 13 }}>
          {t('cd.insightLoading')}
        </div>
      )}

      {error && (
        <div style={{ color: SugarV3.errDarker, fontSize: 13 }}>
          {t('cd.insightError')}
        </div>
      )}

      {insight && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Résumé */}
          {insight.summary && (
            <p
              style={{
                color: SugarV3.inkSoft,
                fontSize: 14,
                lineHeight: 1.55,
                margin: 0,
              }}
            >
              {insight.summary}
            </p>
          )}

          {/* Intent + Sentiment */}
          {(insight.intent || sent) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {insight.intent && <Pill label={insight.intent} tone="neutral" />}
              {sent && <Pill label={sent.label} tone={sent.tone} />}
            </div>
          )}

          {/* Entity chips */}
          {chips.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {chips.map((chip) => (
                <span
                  key={chip}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: SugarV3.cardSubtle,
                    color: SugarV3.inkSoft,
                    fontSize: 11,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {chip}
                </span>
              ))}
            </div>
          )}

          {/* Engagements */}
          {Array.isArray(insight.commitments) && insight.commitments.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: SugarV3.muted,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  marginBottom: 6,
                }}
              >
                {t('cd.insightCommitments')}
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  color: SugarV3.inkSoft,
                  fontSize: 13,
                  lineHeight: 1.55,
                }}
              >
                {insight.commitments.map((commitment, i) => (
                  <li key={i}>{commitment}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Prochaine action suggérée */}
          {insight.next_action && insight.next_action.type !== 'rien' && (
            <div
              style={{
                borderRadius: 14,
                background: SugarV3.cardSubtle,
                padding: '12px 14px',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: SugarV3.muted,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  marginBottom: 4,
                }}
              >
                {t('cd.insightNextAction')}
              </div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  color: SugarV3.ink,
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                <SgIcon name="sparkle" size={14} stroke={SugarV3.ink} sw={1.8} />
                {insight.next_action.label || nextActionLabel(insight.next_action.type, t)}
              </div>
            </div>
          )}

          {/* Footer IA */}
          <div style={{ fontSize: 11, color: SugarV3.muted }}>
            {t('cd.insightFooter', {
              count: insight.source_message_count,
              date: new Date(insight.generated_at).toLocaleDateString('fr-CH'),
            })}
          </div>
        </div>
      )}
    </KycSection>
  )
}
