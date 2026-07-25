/**
 * MEGGA CRM — Pipeline v2 « Sugar Pure » : vue Liste.
 * Port 1:1 du handoff crm-screen-pipeline-sugar.jsx §SugarPipelineList :
 * grille 6 colonnes (avatar · deal/contact · bien · pilule d'étape pleine à
 * texte blanc (sgStagePillBg) · valeur compacte CHF X.XXM/nK · prochaine
 * action + échéance en majuscules). Clic ligne → fiche deal.
 */

import { useTranslation } from 'react-i18next'
import { CRM_STAGES, crmInitials, sgStagePillBg, type SugarPalette } from '../tokens'
import { crmContactById, crmBienById, type CrmDeal } from '../mockData'

interface Props {
  sp: SugarPalette
  dark: boolean
  deals: CrmDeal[]
  onOpenDeal: (id: string) => void
}

export function PipelineList({ sp, dark, deals, onOpenDeal }: Props) {
  const { t } = useTranslation('pipeline')
  const danger = dark ? '#E0738C' : '#8E1F3D'
  const avBg = dark ? '#F2F3F5' : '#0B0C0E'
  const avFg = dark ? '#0B0C0E' : '#FFFFFF'
  const p2 = (n: number) => String(n).padStart(2, '0')
  const isoDay = (ms: number) => {
    const d = new Date(ms)
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
  }
  const nowMs = Date.now()
  const dueInfo = (na: CrmDeal['nextAction']): { overdue: boolean; label: string } => {
    if (!na?.dueAt) return { overdue: false, label: '' }
    const d = na.dueAt.slice(0, 10)
    const overdue = d < isoDay(nowMs)
    let label: string
    if (overdue) label = t('board.card.overdue')
    else if (d === isoDay(nowMs)) label = t('board.card.today')
    else if (d === isoDay(nowMs + 864e5)) label = t('board.card.tomorrow')
    else label = d.slice(5).split('-').reverse().join('/')
    return { overdue, label }
  }
  const fmtVal = (v: number) => v
    ? (v >= 1e6 ? `CHF ${(v / 1e6).toFixed(v % 1e6 === 0 ? 0 : 2)}M` : `CHF ${Math.round(v / 1e3)}K`)
    : ''
  const cols = '40px 1.7fr 1.4fr 1.15fr 0.85fr 1.9fr'

  return (
    <div style={{
      background: sp.cardBg, border: `1px solid ${sp.cardBorder}`,
      borderRadius: 22, overflow: 'hidden',
      boxShadow: sp.shadow,
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: cols, gap: 14,
        padding: '13px 20px', background: sp.cardBg,
        borderBottom: `1px solid ${sp.cardBorder}`,
        fontSize: 10.5, fontWeight: 700, color: sp.sub,
        letterSpacing: 0.4, textTransform: 'uppercase',
      }}>
        <span style={{ gridColumn: '1 / 3' }}>{t('board.list.dealContact')}</span>
        <span>{t('column.property')}</span>
        <span>{t('column.stage')}</span>
        <span style={{ textAlign: 'right', paddingRight: 56 }}>{t('column.value')}</span>
        <span style={{ paddingLeft: 64 }}>{t('board.list.nextAction')}</span>
      </div>
      {deals.map((deal, i) => {
        const c = crmContactById(deal.contactId)
        if (!c) return null
        const b = deal.bienId ? crmBienById(deal.bienId) : null
        const hue = sgStagePillBg(deal.stage, dark)
        const na = deal.nextAction
        const di = dueInfo(na)
        return (
          <div key={deal.id} onClick={() => onOpenDeal(deal.id)} style={{
            display: 'grid', gridTemplateColumns: cols, gap: 14,
            padding: '13px 20px', alignItems: 'center',
            borderBottom: i < deals.length - 1 ? `1px solid ${sp.cardBorder}` : 0,
            fontSize: 13, cursor: 'pointer',
            transition: 'background .12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = sp.cardSubBg }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 999,
              background: avBg, color: avFg,
              fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center',
            }}>{crmInitials(`${c.firstName} ${c.lastName}`)}</div>
            <div style={{
              fontSize: 13, fontWeight: 800, letterSpacing: -0.2, color: sp.ink,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{c.firstName} {c.lastName}</div>
            <div style={{
              fontSize: 12, fontWeight: 600, color: b ? sp.soft : sp.sub,
              fontStyle: b ? 'normal' : 'italic',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {b ? b.title : t('board.noPropertyYet')}
            </div>
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '4px 11px', borderRadius: 999, background: hue,
              fontSize: 11, color: '#fff', fontWeight: 700, width: 'fit-content',
              whiteSpace: 'nowrap', letterSpacing: -0.1,
            }}>
              {t(`stages.${deal.stage}`, { defaultValue: CRM_STAGES[deal.stage].label })}
            </span>
            <span style={{
              textAlign: 'right', paddingRight: 56, fontSize: 13, fontWeight: 800,
              color: sp.ink, fontVariantNumeric: 'tabular-nums',
            }}>
              {fmtVal(deal.value)}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, paddingLeft: 64 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                {na ? (
                  <span style={{
                    fontSize: 12.5, fontWeight: 600, color: sp.soft,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{na.note || t(`timeline.kind.${na.kind}`, { defaultValue: t('timeline.kind.fallback') })}</span>
                ) : null}
                {di.label && (
                  <span style={{
                    fontSize: 10, fontWeight: 800, letterSpacing: 0.2, textTransform: 'uppercase',
                    color: di.overdue ? danger : sp.sub, fontVariantNumeric: 'tabular-nums',
                  }}>{di.label}</span>
                )}
              </div>
            </div>
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
