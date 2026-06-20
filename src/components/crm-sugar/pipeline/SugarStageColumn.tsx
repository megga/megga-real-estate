// MEGGA CRM Sugar v2 — Pipeline stage column (kanban).
// 1:1 port from the Claude Design bundle (crm-screen-pipeline-sugar.jsx).

import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { CRM_STAGES, crmInitials, type SugarPalette, type StageId } from '../tokens'
import { crmContactById, type CrmDeal } from '../mockData'
import { SugarDealCard } from './SugarDealCard'

interface StageColumnProps {
  stage: StageId
  deals: CrmDeal[]
  sp: SugarPalette
  dark: boolean
  onOpenDeal?: (id: string) => void
  draggingId: string | null
  dragOver: boolean
  onDragOver?: () => void
  onDrop?: () => void
  onDragLeave?: () => void
  onDragStart?: (id: string) => void
  onDragEnd?: () => void
}

export function SugarStageColumn({
  stage, deals, sp, dark, onOpenDeal,
  draggingId, dragOver, onDragOver, onDrop, onDragLeave, onDragStart, onDragEnd,
}: StageColumnProps) {
  const { t } = useTranslation('pipeline')
  const s = CRM_STAGES[stage]
  const stageVal = deals.reduce((x, d) => x + (d.value || 0), 0)
  const avatars = deals.slice(0, 3)
    .map(d => crmContactById(d.contactId))
    .filter((c): c is NonNullable<typeof c> => !!c)

  return (
    <div
      onDragOver={e => { e.preventDefault(); onDragOver?.() }}
      onDrop={e => { e.preventDefault(); onDrop?.() }}
      onDragLeave={onDragLeave}
      style={{
        flex: '0 0 240px',
        display: 'flex', flexDirection: 'column', gap: 10,
        position: 'relative',
        transition: 'transform .15s',
      }}>
      {/* Column header — carte opaque, label en pilule pleine + ligne de décompte */}
      <div style={{
        background: dragOver && draggingId
          ? (dark ? 'rgba(255,255,255,.06)' : 'rgba(0,65,217,.06)')
          : (dark ? '#1B1E25' : '#FFFFFF'),
        border: dragOver && draggingId
          ? `1.5px solid ${s.color}`
          : (dark ? '1px solid #2C2F38' : '1px solid #E4E7EC'),
        borderRadius: 18, padding: '12px 14px',
        boxShadow: sp.shadow,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {/* Ligne 1 — pilule d'étape + avatars empilés */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            padding: '4px 11px', borderRadius: 999,
            background: s.color, color: '#FFFFFF',
            boxShadow: `0 1px 2px ${s.color}59, inset 0 -1px 0 rgba(0,0,0,0.14)`,
            fontSize: 12, fontWeight: 700, letterSpacing: -0.2,
          }}>{t(`stages.${stage}`)}</span>
          <div style={{ display: 'flex', marginLeft: 'auto', flexShrink: 0 }}>
            {avatars.map((c, i) => (
              <div key={c.id} style={{
                width: 24, height: 24, borderRadius: 999,
                background: c.avatarBg || '#0041D9', color: '#fff',
                fontSize: 9, fontWeight: 700,
                display: 'grid', placeItems: 'center',
                border: `2px solid ${sp.avatarBorder}`, marginLeft: i === 0 ? 0 : -8,
                boxShadow: '0 1px 3px rgba(0,0,0,.2)',
              }}>{crmInitials(`${c.firstName} ${c.lastName}`)}</div>
            ))}
          </div>
        </div>
        {/* Ligne 2 — décompte + bouton d'ajout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            flex: 1, minWidth: 0, fontSize: 11, color: sp.sub, fontVariantNumeric: 'tabular-nums',
          }}>
            {stageVal > 0
              ? t('board.dealsCountWithValue', {
                  count: deals.length,
                  value: `CHF ${(stageVal / 1e6).toFixed(2)}M`,
                })
              : t('board.dealsCount', { count: deals.length })}
          </div>
          <button style={{
            width: 26, height: 26, borderRadius: 999, border: 0, background: sp.cardBg,
            boxShadow: sp.shadowSm, flexShrink: 0,
            display: 'grid', placeItems: 'center', cursor: 'pointer',
          }}>
            <MEIcon name="plus" size={11} color={sp.soft} />
          </button>
        </div>
      </div>

      {/* Cards */}
      {deals.length === 0 && (
        <div style={{
          padding: '32px 12px', textAlign: 'center', fontSize: 11.5,
          color: dragOver && draggingId ? s.color : sp.sub,
          border: dragOver && draggingId
            ? `1.5px dashed ${s.color}`
            : `1px dashed ${sp.cardBorder}`,
          borderRadius: 16,
          background: dragOver && draggingId ? s.color + '08' : (dark ? 'rgba(255,255,255,.025)' : sp.frameBg),
          transition: 'all .15s',
        }}>{dragOver && draggingId
          ? t('board.dropToStage', { stage: t(`stages.${stage}`) })
          : t('board.dragDealHere')}</div>
      )}
      {deals.map((d, i) => (
        <SugarDealCard
          key={d.id}
          deal={d}
          sp={sp}
          dark={dark}
          focused={i === 0 && stage === 'offer'}
          onClick={() => onOpenDeal?.(d.id)}
          isDragging={draggingId === d.id}
          onDragStart={() => onDragStart?.(d.id)}
          onDragEnd={onDragEnd}
        />
      ))}
    </div>
  )
}
