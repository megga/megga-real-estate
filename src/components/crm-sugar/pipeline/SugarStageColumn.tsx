// MEGGA CRM Sugar v2 — Pipeline stage column (kanban).
// 1:1 port from the Claude Design bundle (crm-screen-pipeline-sugar.jsx).

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
      {/* Column header */}
      <div style={{
        background: dragOver && draggingId
          ? (dark ? 'rgba(255,255,255,.06)' : 'rgba(0,65,217,.06)')
          : sp.frameBg,
        border: dragOver && draggingId
          ? `1.5px solid ${s.color}`
          : `1px solid ${sp.frameBorder}`,
        borderRadius: 18, padding: '12px 14px',
        boxShadow: sp.shadow,
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{
          width: 9, height: 9, borderRadius: 999, background: s.color, flexShrink: 0,
          boxShadow: `0 0 0 3px ${s.color}1F`,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: sp.ink, letterSpacing: -0.2 }}>{s.label}</div>
          <div style={{
            fontSize: 10.5, color: sp.sub, marginTop: 1, fontVariantNumeric: 'tabular-nums',
          }}>
            {deals.length} deal{deals.length > 1 ? 's' : ''}{stageVal > 0 && ` · CHF ${(stageVal / 1e6).toFixed(2)}M`}
          </div>
        </div>
        <div style={{ display: 'flex' }}>
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
        <button style={{
          width: 26, height: 26, borderRadius: 999, border: 0, background: sp.cardBg,
          boxShadow: sp.shadowSm,
          display: 'grid', placeItems: 'center', cursor: 'pointer',
        }}>
          <MEIcon name="plus" size={11} color={sp.soft} />
        </button>
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
          background: dragOver && draggingId ? s.color + '08' : sp.frameBg,
          transition: 'all .15s',
        }}>{dragOver && draggingId ? `Déposer ici → ${s.label}` : 'Glisser un deal ici'}</div>
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
