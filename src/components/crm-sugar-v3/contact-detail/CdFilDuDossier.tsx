// MEGGA CRM Sugar v3 — Fil du dossier (boucle de match, réception acheteur).
// Une ligne par bien transmis + pilule d'état (Liké/Vu/Transmis/Écarté), motif
// d'écartement, méta transmis/ouvert/réagi. Lecture — l'agent agit via l'atelier.

import { useTranslation } from 'react-i18next'
import { SugarV3 } from '../tokens'
import { SgIcon } from '../icons'
import { KycSection } from '../primitives'
import { formatCHF, formatRelativeDate } from '@/lib/utils'
import type { ContactLoop, LoopItem, LoopState } from '@/hooks/useContactSentMatches'

const rel = (d?: string | null) => (d ? formatRelativeDate(d) : '—')

// Pilules d'état — fond plein couleur + texte blanc, sans dot (règle DS).
const PILL: Record<LoopState, { bg: string; dim?: boolean }> = {
  liked: { bg: '#059669' },
  seen: { bg: '#0891B2' },
  sent: { bg: '#7A8088' },
  dismissed: { bg: '#7A8088', dim: true },
}

interface Props {
  loop: ContactLoop
  onOpenAtelier: () => void
}

export function CdFilDuDossier({ loop, onOpenAtelier }: Props) {
  const { t } = useTranslation('contacts')
  if (loop.transmitted === 0) return null

  const pillLabel = (s: LoopState) =>
    s === 'liked' ? t('loop.pillLiked') : s === 'seen' ? t('loop.pillSeen') : s === 'dismissed' ? t('loop.pillDismissed') : t('loop.pillSent')
  const metaOf = (it: LoopItem) => {
    const sent = rel(it.sentAt)
    if (it.state === 'liked') return t('loop.metaLiked', { sent, when: rel(it.respondedAt) })
    if (it.state === 'seen') return t('loop.metaSeen', { sent })
    if (it.state === 'dismissed') return t('loop.metaDismissed')
    return t('loop.metaSent', { sent })
  }

  const action = (
    <button onClick={onOpenAtelier}
      style={{ height: 34, padding: '0 14px', borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, background: SugarV3.cardSubtle, color: SugarV3.inkSoft, display: 'inline-flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' }}>
      {t('loop.openAtelier')} <SgIcon name="send" size={13} stroke={SugarV3.inkSoft} />
    </button>
  )

  return (
    <KycSection eyebrow={t('loop.filEyebrow')} title={t('loop.filTitle')} action={action}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: SugarV3.muted, marginTop: -8, marginBottom: 14 }}>
        {t('loop.filMeta', { sent: loop.transmitted, opened: loop.opened })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loop.items.map((it) => {
          const p = PILL[it.state]
          return (
            <div key={it.matchId} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', background: SugarV3.cardSubtle, borderRadius: 16, opacity: p.dim ? 0.72 : 1 }}>
              <span style={{ width: 44, height: 44, borderRadius: 999, flexShrink: 0, display: 'grid', placeItems: 'center', background: SugarV3.card, boxShadow: SugarV3.shadow, fontSize: 14, fontWeight: 800, color: SugarV3.ink, fontVariantNumeric: 'tabular-nums' }}>
                {it.score != null ? it.score : '—'}
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: SugarV3.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {it.title}{it.state === 'dismissed' && it.motif ? ' — ' + t('loop.motif', { motif: it.motif }) : ''}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: SugarV3.muted, marginTop: 3 }}>
                  {(it.price != null ? formatCHF(it.price) + ' · ' : '') + metaOf(it)}
                </div>
              </div>
              <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 11px', borderRadius: 999, background: p.bg, color: '#fff', fontSize: 10.5, fontWeight: 700, letterSpacing: 0.2 }}>
                {pillLabel(it.state)}
              </span>
            </div>
          )
        })}
      </div>
    </KycSection>
  )
}
