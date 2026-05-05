// MEGGA CRM Sugar v2 — Pipeline timeline view (Gantt-style 10 days).
// 1:1 port from the Claude Design bundle (crm-screen-pipeline-sugar.jsx — `SugarPipelineTimeline`).

import { CRM_STAGES, crmFmtCHF, crmInitials, type SugarPalette } from '../tokens'
import { CRM_DEALS, crmContactById } from '../mockData'

const DAYS = ['1 mai', '2 mai', '3 mai', '4 mai', '5 mai', '6 mai', '7 mai', '8 mai', '9 mai', '10 mai']

export function PipelineTimeline({ sp }: { sp: SugarPalette }) {
  return (
    <div style={{
      background: sp.cardBg, border: `1px solid ${sp.cardBorder}`,
      borderRadius: 22, overflow: 'hidden',
      boxShadow: sp.shadow,
    }}>
      <div style={{ display: 'flex', borderBottom: `1px solid ${sp.cardBorder}`, background: sp.tableHeadBg }}>
        <div style={{
          width: 240, padding: '14px 18px', borderRight: `1px solid ${sp.cardBorder}`,
          fontSize: 10.5, fontWeight: 700, color: sp.sub, letterSpacing: 0.4, textTransform: 'uppercase',
        }}>Deal</div>
        <div style={{
          flex: 1, display: 'grid', gridTemplateColumns: `repeat(${DAYS.length}, 1fr)`,
        }}>
          {DAYS.map((d, i) => (
            <div key={i} style={{
              padding: '14px 0', textAlign: 'center',
              borderRight: i < DAYS.length - 1 ? `1px solid ${sp.cardBorder}` : 0,
              fontSize: 11, color: sp.sub, fontWeight: 600,
            }}>{d}</div>
          ))}
        </div>
      </div>
      {CRM_DEALS.map((deal, i) => {
        const c = crmContactById(deal.contactId)!
        const start = (i * 2) % 5
        const span = ((i % 3) + 2)
        const stage = CRM_STAGES[deal.stage]
        return (
          <div key={deal.id} style={{
            display: 'flex',
            borderBottom: i < CRM_DEALS.length - 1 ? `1px solid ${sp.cardBorder}` : 0,
          }}>
            <div style={{
              width: 240, padding: '14px 18px', borderRight: `1px solid ${sp.cardBorder}`,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 999,
                background: c.avatarBg || '#0041D9', color: '#fff',
                fontSize: 10, fontWeight: 700,
                display: 'grid', placeItems: 'center', flexShrink: 0,
              }}>{crmInitials(`${c.firstName} ${c.lastName}`)}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 12.5, fontWeight: 700, color: sp.ink,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{c.firstName} {c.lastName}</div>
                <div style={{ fontSize: 10.5, color: sp.sub }}>{deal.value ? crmFmtCHF(deal.value) : '—'}</div>
              </div>
            </div>
            <div style={{
              flex: 1, position: 'relative',
              display: 'grid', gridTemplateColumns: `repeat(${DAYS.length}, 1fr)`, height: 64,
            }}>
              {DAYS.map((_, j) => (
                <div key={j} style={{
                  borderRight: j < DAYS.length - 1 ? `1px solid ${sp.cardBorder}` : 0,
                }} />
              ))}
              <div style={{
                position: 'absolute', top: 14, left: `${(start / DAYS.length) * 100}%`,
                width: `${(span / DAYS.length) * 100}%`, height: 36,
                background: stage.color + '1A', borderLeft: `3px solid ${stage.color}`,
                borderRadius: 12, padding: '7px 12px',
                fontSize: 11.5, fontWeight: 700, color: sp.ink,
                display: 'flex', alignItems: 'center',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                boxShadow: sp.shadowSm,
              }}>{stage.label}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
