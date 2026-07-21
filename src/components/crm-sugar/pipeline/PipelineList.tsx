// MEGGA CRM Sugar v2 — Pipeline list view (table).
// 1:1 port from the Claude Design bundle (crm-screen-pipeline-sugar.jsx — `SugarPipelineList`).

import { useTranslation } from 'react-i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { CRM_STAGES, crmFmtCHF, crmInitials, type SugarPalette } from '../tokens'
import { crmContactById, crmBienById, type CrmDeal } from '../mockData'

function actionIcon(kind: string): MEIconName {
  if (kind === 'call') return 'phone'
  if (kind === 'visit') return 'home'
  if (kind === 'kyc') return 'shield'
  if (kind === 'match') return 'sparkle'
  return 'flag'
}

interface PipelineListProps {
  sp: SugarPalette
  deals: CrmDeal[]
  onOpenDeal?: (id: string) => void
}

export function PipelineList({ sp, deals, onOpenDeal }: PipelineListProps) {
  const { t } = useTranslation('pipeline')
  return (
    <div style={{
      background: sp.cardBg, border: `1px solid ${sp.cardBorder}`,
      borderRadius: 22, overflow: 'hidden',
      boxShadow: sp.shadow,
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '40px 2fr 1.4fr 1.2fr 0.8fr 1.4fr 100px',
        padding: '14px 18px', background: sp.tableHeadBg,
        borderBottom: `1px solid ${sp.cardBorder}`,
        fontSize: 10.5, fontWeight: 700, color: sp.sub,
        letterSpacing: 0.4, textTransform: 'uppercase',
      }}>
        <span></span>
        <span>{t('board.list.dealContact')}</span>
        <span>{t('column.property')}</span>
        <span>{t('column.stage')}</span>
        <span>{t('column.value')}</span>
        <span>{t('board.list.nextAction')}</span>
        <span style={{ textAlign: 'right' }}>{t('board.list.status')}</span>
      </div>
      {deals.map((deal, i) => {
        const c = crmContactById(deal.contactId)!
        const b = deal.bienId ? crmBienById(deal.bienId) : null
        const stage = CRM_STAGES[deal.stage]
        const riskColor = deal.risk === 'at-risk' ? '#F59E0B' : deal.risk === 'stalled' ? '#E53935' : '#0E9F6E'
        const riskLabel = deal.risk === 'at-risk' ? t('board.risk.atRisk') : deal.risk === 'stalled' ? t('board.risk.stalled') : t('board.risk.healthy')
        const riskBg = deal.risk === 'at-risk' ? '#FEF3DB' : deal.risk === 'stalled' ? '#FDECEA' : '#E1F5EC'
        return (
          <div key={deal.id} onClick={() => onOpenDeal?.(deal.id)} style={{
            display: 'grid', gridTemplateColumns: '40px 2fr 1.4fr 1.2fr 0.8fr 1.4fr 100px',
            padding: '14px 18px', alignItems: 'center',
            borderBottom: i < deals.length - 1 ? `1px solid ${sp.cardBorder}` : 0,
            fontSize: 13, cursor: 'pointer',
            transition: 'background .12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = sp.cardSubBg }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 999,
              background: c.avatarBg || '#0041D9', color: '#fff',
              fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center',
            }}>{crmInitials(`${c.firstName} ${c.lastName}`)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontWeight: 700, color: sp.ink,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{c.firstName} {c.lastName}</div>
              <div style={{ fontSize: 11, color: sp.sub, marginTop: 1 }}>{c.email}</div>
            </div>
            <div style={{
              fontSize: 12.5, color: sp.soft,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {b ? b.title : <span style={{ color: sp.sub, fontStyle: 'italic' }}>{t('board.noPropertyYet')}</span>}
            </div>
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '4px 12px', borderRadius: 999, background: stage.color,
              fontSize: 11.5, color: '#FFFFFF', fontWeight: 700, width: 'fit-content',
              whiteSpace: 'nowrap',
              boxShadow: `inset 0 -1px 0 rgba(0,0,0,0.14)`,
            }}>
              {t(`stages.${deal.stage}`)}
            </span>
            <span style={{ fontWeight: 800, color: sp.ink, fontVariantNumeric: 'tabular-nums' }}>
              {deal.value ? crmFmtCHF(deal.value) : '—'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              {deal.nextAction && (
                <>
                  <div style={{
                    width: 22, height: 22, borderRadius: 999, background: sp.cardSubBg,
                    display: 'grid', placeItems: 'center', flexShrink: 0,
                  }}>
                    <MEIcon name={actionIcon(deal.nextAction.kind)} size={10} color={sp.soft} />
                  </div>
                  <span style={{
                    fontSize: 12, color: sp.soft,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{deal.nextAction.note}</span>
                </>
              )}
            </div>
            <span style={{
              justifySelf: 'end',
              padding: '3px 10px', borderRadius: 999,
              background: riskBg, color: riskColor,
              fontSize: 10.5, fontWeight: 700,
            }}>{riskLabel}</span>
          </div>
        )
      })}
      {deals.length === 0 && (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: sp.sub, fontSize: 13 }}>
          {t('board.list.noMatch')}
        </div>
      )}
    </div>
  )
}
