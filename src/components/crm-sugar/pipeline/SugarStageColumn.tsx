/**
 * MEGGA CRM — Pipeline v2 « Sugar Pure » : colonne kanban.
 * Port 1:1 du handoff crm-screen-pipeline-sugar.jsx §SugarStageColumn.
 * Fond pastel teinté par étape (sgStageTint), aucune bordure ; en-tête pastille
 * vive + compteur teinté + bouton « + » (création inline) ; somme CHF X.XXM ;
 * zone vide pointillée qui devient cible de drop.
 */

import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { sgStageTint, type SugarPalette, type StageId } from '../tokens'
import type { CrmDeal } from '../mockData'
import { SugarDealCard, type SugarDealCardActions } from './SugarDealCard'

interface StageColumnProps extends SugarDealCardActions {
  stage: StageId
  deals: CrmDeal[]
  sp: SugarPalette
  dark: boolean
  onOpenDeal: (id: string) => void
  draggingId: string | null
  signingId?: string | null
  signExit?: boolean
  dragOver: boolean
  onDragOver: () => void
  onDrop: () => void
  onDragLeave: () => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
  /** Ouvre la carte fantôme de création inline dans cette colonne (bouton « + »).
   *  null = pas de bouton (ex. création inline désactivée). */
  onInlineOpen?: (() => void) | null
  /** Carte fantôme SgInlineNewDeal rendue en tête de pile quand ouverte. */
  inlineForm?: ReactNode
}

export function SugarStageColumn({
  stage, deals, sp, dark, onOpenDeal,
  draggingId, signingId, signExit,
  dragOver, onDragOver, onDrop, onDragLeave, onDragStart, onDragEnd,
  onInlineOpen, inlineForm,
  onReassign, onArchive, onMarkLost, onScheduleVisit, onAskAiVisit,
}: StageColumnProps) {
  const { t } = useTranslation('pipeline')
  const label = t(`stages.${stage}`)
  const stageVal = deals.reduce((x, d) => x + (d.value || 0), 0)
  const tint = sgStageTint(stage, dark)

  return (
    <div
      onDragOver={e => { e.preventDefault(); onDragOver() }}
      onDrop={e => { e.preventDefault(); onDrop() }}
      onDragLeave={onDragLeave}
      style={{
        flex: '0 0 252px',
        height: '100%', minHeight: 0,
        display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)',
        position: 'relative',
        background: tint.panel,
        borderRadius: 'var(--crm-radius-4xl)',
        padding: 'var(--crm-space-2xl) var(--crm-space-xl) var(--crm-space-xl)',
        boxSizing: 'border-box',
        boxShadow: dragOver && draggingId ? `0 0 0 2px ${tint.hue} inset` : 'none',
        transition: 'box-shadow .15s, transform .15s',
      }}>
      {/* En-tête — pastille teintée vive + libellé + compteur + « + » */}
      <div style={{ padding: '0 var(--crm-space-xs)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', minWidth: 0 }}>
          <span style={{ width: 9, height: 9, borderRadius: 'var(--crm-radius-pill)', background: tint.hue, flexShrink: 0 }} />
          <span style={{
            fontSize: 'var(--crm-text-lg)', fontWeight: 800, letterSpacing: -0.2, color: sp.ink,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{label}</span>
          <span style={{
            marginLeft: 'auto', fontSize: 'var(--crm-text-md)', fontWeight: 800, color: tint.tintInk,
            fontVariantNumeric: 'tabular-nums', flexShrink: 0,
          }}>{deals.length}</span>
          {onInlineOpen && (
            <button onClick={onInlineOpen} title={t('board.card.newDealInColumn', { stage: label })} style={{
              width: 22, height: 22, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', flexShrink: 0,
              background: dark ? 'rgba(255,255,255,.08)' : 'rgba(11,12,14,.06)',
              display: 'grid', placeItems: 'center', fontFamily: 'inherit', padding: 0,
            }}>
              <MEIcon name="plus" size={10} color={sp.ink} />
            </button>
          )}
        </div>
        <div style={{
          // ⛔ Le total est posé sur le VOILE de l'étape, pas sur la carte : il
          // prend donc l'encre du panneau (`tintInk`, celle du compteur juste
          // au-dessus), pas l'encre secondaire générique. Mesuré : `sp.sub`
          // plafonne à 4,39:1 sur l'indigo et 4,49:1 sur le bleu — les deux
          // teintes les plus froides — quand `tintInk` tient 5,22:1 au pire des
          // huit, dans les DEUX thèmes. Ce n'étaient pas deux colonnes
          // malchanceuses : la famille entière tenait dans 0,4 du plancher.
          paddingLeft: 'var(--crm-space-3xl)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tint.tintInk,
          fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {stageVal > 0 ? `CHF ${(stageVal / 1e6).toFixed(2)}M` : ''}
        </div>
      </div>

      {/* Cartes — scroll vertical interne */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
        display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)', margin: '0 -4px', padding: 'var(--crm-space-2xs) var(--crm-space-xs)',
      }}>
        {inlineForm}
        {deals.length === 0 && !inlineForm && (
          <div style={{
            padding: '32px 12px', textAlign: 'center', fontSize: 'var(--crm-text-sm)', fontWeight: 600,
            color: dragOver && draggingId ? tint.tintInk : sp.sub,
            border: `1.5px dashed ${dragOver && draggingId ? tint.hue : (dark ? 'rgba(255,255,255,.18)' : 'rgba(11,12,14,.14)')}`,
            // Zone de drop : en sombre le voile blanc à .35 fabriquerait une
            // surface hors échelle — elle prend le palier « card ».
            borderRadius: 'var(--crm-radius-2xl)', background: dragOver && draggingId ? 'rgba(255,255,255,.35)' : 'transparent',
            transition: 'all .15s',
          }}>{dragOver && draggingId
            ? t('board.dropToStage', { stage: label })
            : t('board.dragDealHere')}</div>
        )}
        {deals.map(d => (
          <SugarDealCard
            key={d.id} deal={d} sp={sp} dark={dark}
            signing={signingId === d.id} signExit={!!signExit && signingId === d.id}
            onClick={() => onOpenDeal(d.id)}
            isDragging={draggingId === d.id}
            onDragStart={() => onDragStart(d.id)}
            onDragEnd={onDragEnd}
            onReassign={onReassign} onArchive={onArchive} onMarkLost={onMarkLost}
            onScheduleVisit={onScheduleVisit} onAskAiVisit={onAskAiVisit}
          />
        ))}
      </div>
    </div>
  )
}
