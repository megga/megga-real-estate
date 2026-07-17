/**
 * Cartes stats du cockpit « Aujourd'hui » mobile : jauge circulaire (Ring) +
 * tuiles Pipeline / Objectif.
 */
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { usePipelineSugar } from '@/hooks/usePipelineSugar'
import { useAxDashboardData } from '@/hooks/useAxDashboardData'
import { axPace } from '@/components/crm-sugar/analytics/tokens'
import { useMobileTokens } from '../useMobileTokens'

/** Jauge circulaire SVG (0-100 %, clampé) : anneau + arc de progression animé, pourcentage centré. */
function Ring({ pct, color }: { pct: number; color: string }) {
  const { tk } = useMobileTokens()
  const size = 66
  const stroke = 7
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, pct))
  const off = c * (1 - clamped / 100)
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={tk.hair} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.22,1,.36,1)' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          fontSize: 16,
          fontWeight: 800,
          color: tk.ink,
          letterSpacing: -0.4,
        }}
      >
        {`${Math.round(clamped)}%`}
      </div>
    </div>
  )
}

/**
 * Cartes statistiques du cockpit : Pipeline (cumul live des deals actifs) +
 * Objectif (jauge projetée). Câblé `usePipelineSugar` + `useAxDashboardData`
 * (mêmes hooks que le desktop, dédupés par React Query). Empty-states honnêtes ;
 * seeds uniquement derrière `demo`.
 */
export function MobileStatCards({ demo = false }: { demo?: boolean }) {
  const { t } = useTranslation('dashboard')
  const { tk } = useMobileTokens()
  const { deals } = usePipelineSugar()
  const { data: ax } = useAxDashboardData('year', 'me')

  const active = deals.filter((d) => d.stage !== 'lost')
  const pipeTotal = demo ? 'CHF 7.6M' : `CHF ${(active.reduce((s, d) => s + (d.value || 0), 0) / 1e6).toFixed(1)}M`
  const dealCount = demo ? 22 : active.length
  const atRisk = demo ? 1 : active.filter((d) => d.risk === 'at-risk' || d.risk === 'stalled').length

  const pace = ax ? axPace(ax) : null
  const targetSet = demo || (ax ? (ax.targetIsSet ?? ax.target > 0) : false)
  const projPct = demo ? 90 : (pace?.projPct ?? 0)
  const realized = demo ? '1.07' : ax ? (ax.realizedNow / 1e6).toFixed(2) : '—'
  const target = demo ? '1.2M' : ax && ax.target ? `${(ax.target / 1e6).toFixed(1)}M` : '—'

  const cardBase = {
    background: tk.card,
    border: `1px solid ${tk.cardBorder}`,
    borderRadius: 18,
    padding: '16px 16px 15px',
    boxShadow: tk.shadowSm,
  } as const

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
      {/* Pipeline */}
      <div style={{ ...cardBase, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: tk.muted }}>
          <MEIcon name="trending-up" size={15} color={tk.muted} />
          <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.2 }}>{t('today.cockpit.tiles.pipeline')}</span>
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -1, color: tk.ink, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
          {pipeTotal}
        </div>
        <div style={{ fontSize: 11.5, color: tk.muted, fontWeight: 600 }}>
          {t('today.cockpit.pipelineDeals', { count: dealCount })}
          {atRisk > 0 ? ` · ${t('today.cockpit.pipelineAtRisk', { count: atRisk })}` : ''}
        </div>
      </div>

      {/* Objectif */}
      <div style={{ ...cardBase, display: 'flex', alignItems: 'center', gap: 14 }}>
        {targetSet ? <Ring pct={projPct} color={tk.goal} /> : null}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: tk.muted, letterSpacing: 0.2 }}>
            {t('today.cockpit.tiles.objectif')}
          </div>
          {targetSet ? (
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.4, color: tk.ink, fontVariantNumeric: 'tabular-nums', marginTop: 4, whiteSpace: 'nowrap' }}>
              {realized}
              <span style={{ color: tk.muted, fontWeight: 700 }}> / {target}</span>
            </div>
          ) : (
            <div style={{ fontSize: 13.5, fontWeight: 700, color: tk.muted, marginTop: 4 }}>
              {t('today.cockpit.objectifUnset')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
