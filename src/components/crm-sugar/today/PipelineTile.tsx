// MEGGA CRM — Refonte « Aujourd'hui » · Tuile « Pipeline » (câblée)
// ----------------------------------------------------------------------------
// Visuel porté 1:1 de `today-proto-pipeline.jsx` (entonnoir + deal à risque) ;
// données CÂBLÉES sur les vraies transactions (usePipelineSugar). Les 9 stages
// CRM sont repliés sur les 4 buckets du prototype :
//   recherche = new-lead + to-qualify + searching
//   visite    = visit-scheduled + visit-done
//   offre     = interest-confirmed + offer
//   compromis = signed            (lost exclu)
// Carte « à risque » : 1er deal `risk: 'at-risk'` (sinon 'stalled'), noms
// résolus via le registry rempli par usePipelineSugar — masquée si aucun deal à
// risque (on ne fabrique pas). Fallback démo (prototype) si aucune transaction.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TK, TK_STAGE } from './tk'
import { Av } from './kit'
import { DATA, fmtCHF } from './data'
import { usePipelineSugar } from '@/hooks/usePipelineSugar'
import { crmContactById, crmBienById } from '@/components/crm-sugar/mockData'
import type { StageId } from '@/components/crm-sugar/tokens'

const STAGE_BUCKET: Record<StageId, string> = {
  'new-lead': 'recherche', 'to-qualify': 'recherche', 'searching': 'recherche',
  'visit-scheduled': 'visite', 'visit-done': 'visite',
  'interest-confirmed': 'offre', 'offer': 'offre',
  'signed': 'compromis', 'lost': '',
}
const BUCKET_ORDER = ['recherche', 'visite', 'offre', 'compromis']

interface Bucket { key: string; count: number; value: number }
interface RiskView { initials: string; av: string; bien: string; why: string; value: string }

function computeBuckets(deals: { stage: StageId; value: number }[]): Bucket[] {
  const acc: Record<string, { count: number; value: number }> = {
    recherche: { count: 0, value: 0 }, visite: { count: 0, value: 0 },
    offre: { count: 0, value: 0 }, compromis: { count: 0, value: 0 },
  }
  for (const d of deals) {
    const b = STAGE_BUCKET[d.stage]
    if (!b) continue
    acc[b].count += 1
    acc[b].value += d.value || 0
  }
  return BUCKET_ORDER.map((key) => ({ key, count: acc[key].count, value: acc[key].value }))
}

export function PipelineTile({ demo = false }: { demo?: boolean } = {}) {
  const { t } = useTranslation('dashboard')
  const [hover, setHover] = useState<number | null>(null)
  const { deals, isError } = usePipelineSugar()
  // Agent réel → vrai pipeline (entonnoir à 0 si aucun deal) ; seed démo derrière `demo`.
  const live = !demo

  const buckets: Bucket[] = live ? computeBuckets(deals) : DATA.pipeline
  const maxV = Math.max(...buckets.map((p) => p.value), 1)

  // Deal à risque réel (sinon démo). Masqué en live s'il n'y en a aucun.
  let risk: RiskView | null = null
  if (live) {
    const rd = deals.find((d) => d.risk === 'at-risk') || deals.find((d) => d.risk === 'stalled')
    if (rd) {
      const c = crmContactById(rd.contactId)
      const b = rd.bienId ? crmBienById(rd.bienId) : undefined
      risk = {
        initials: c ? `${c.firstName[0] || ''}${c.lastName[0] || ''}`.toUpperCase() : '—',
        av: c?.avatarBg || '#6F8CFF',
        bien: b?.title || (c ? `${c.firstName} ${c.lastName}`.trim() : t('today.pipeline.dealFallback')),
        why: rd.nextAction?.note || (rd.risk === 'stalled' ? t('today.pipeline.riskStalled') : t('today.pipeline.riskOverdue')),
        value: fmtCHF(rd.value),
      }
    }
  } else {
    const d = DATA.dealRisk
    risk = { initials: d.initials, av: d.av, bien: d.bien, why: d.why, value: d.value }
  }

  if (live && isError) {
    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 12px' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: TK.ink }}>{t('today.pipeline.error.title')}</div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* entonnoir */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, minHeight: 0 }}>
        {buckets.map((p, i) => {
          const st = TK_STAGE[p.key]
          const w = Math.round((p.value / maxV) * 100)
          const hov = hover === i
          return (
            <div key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 11, cursor: 'default' }}>
              <div style={{ width: 138, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: TK.inkDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t(st.labelKey)}</span>
              </div>
              <div style={{ flex: 1, position: 'relative', height: 26 }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${w}%`, minWidth: 46,
                  borderRadius: 7, background: hov ? `${st.color}44` : `${st.color}2e`,
                  border: `1px solid ${st.color}${hov ? '99' : '66'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 9px',
                  transition: 'background .15s, border-color .15s' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: TK.ink, fontVariantNumeric: 'tabular-nums' }}>{p.count}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {/* deal à risque — masqué si aucun en live */}
      {risk && (
        <div style={{ marginTop: 'auto', paddingTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 13,
            background: 'rgba(126,28,54,0.16)', border: '1px solid rgba(242,107,101,0.32)' }}>
            <Av initials={risk.initials} av={risk.av} size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: TK.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{risk.bien}</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#F0A8AC', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{risk.why}</div>
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: TK.ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{risk.value}</span>
          </div>
        </div>
      )}
    </div>
  )
}
