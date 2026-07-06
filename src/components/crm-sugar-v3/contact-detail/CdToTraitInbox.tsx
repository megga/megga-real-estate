// MEGGA CRM Sugar v3 — Inbox « À traiter » (boucle de match).
// Entre le héro et la grille : SEULS les likes acheteur non encore traités.
// L'agent propose la visite (HITL) ou reporte. Invisible quand vide.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SugarV3 } from '../tokens'
import { SgIcon } from '../icons'
import { KycSection } from '../primitives'
import { formatCHF, formatRelativeDate } from '@/lib/utils'
import type { LoopItem } from '@/hooks/useContactSentMatches'

const rel = (d?: string | null) => (d ? formatRelativeDate(d) : '—')

interface Props {
  pendingLikes: LoopItem[]
  onProposeVisit: (matchId: string) => void
}

export function CdToTraitInbox({ pendingLikes, onProposeVisit }: Props) {
  const { t } = useTranslation('contacts')
  const [later, setLater] = useState<Set<string>>(new Set())
  const items = pendingLikes.filter((i) => !later.has(i.matchId))
  if (!items.length) return null

  return (
    <div style={{ marginBottom: 18 }}>
      <KycSection title={`${t('loop.inboxTitle')} · ${items.length}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((it) => {
            const scorePart = it.score != null ? t('loop.matchPct', { score: it.score }) : ''
            const pricePart = it.price != null ? formatCHF(it.price) : '—'
            return (
              <div key={it.matchId} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: SugarV3.cardSubtle, borderRadius: 16 }}>
                <span style={{ width: 34, height: 34, borderRadius: 999, flexShrink: 0, display: 'grid', placeItems: 'center', background: '#059669', color: '#fff' }}>
                  <SgIcon name="heart" size={16} stroke="#fff" />
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: SugarV3.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t('loop.likedTitle', { title: it.title })}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: SugarV3.muted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t('loop.likedSub', { when: rel(it.respondedAt ?? it.sentAt), price: pricePart, score: scorePart })}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => setLater((s) => new Set(s).add(it.matchId))}
                    style={{ height: 38, padding: '0 14px', borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, background: 'transparent', color: SugarV3.muted }}>
                    {t('loop.later')}
                  </button>
                  <button onClick={() => onProposeVisit(it.matchId)}
                    style={{ height: 38, padding: '0 16px', borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, background: SugarV3.black, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' }}>
                    <SgIcon name="cal" size={14} stroke="#fff" /> {t('loop.proposeVisit')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </KycSection>
    </div>
  )
}
