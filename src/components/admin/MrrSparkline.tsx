// P7 — Tendance du MRR estimé (platform_metrics.mrr_estimate, historisé horaire
// par admin-monitoring). Sparkline SVG inline (0 dépendance chart).
//
// Grammaire Sugar : bento séparé par l'ombre, montants en chiffres tabulaires,
// courbe au ton `info` — le violet de la plateforme est un repère de contexte,
// pas une couleur de tracé de donnée.

import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { formatCHF } from '@/lib/utils'
import { useAdminSugar } from '@/hooks/useAdminSugar'
import { AdminCard } from '@/components/admin/kit/adminKit'

function useMrrHistory() {
  return useQuery({
    queryKey: ['admin-mrr-history'],
    queryFn: async (): Promise<{ at: string; value: number }[]> => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('platform_metrics')
        .select('metric_value, recorded_at')
        .eq('metric_type', 'mrr_estimate')
        .gte('recorded_at', since)
        .order('recorded_at', { ascending: true })
      if (error) throw error
      return (data ?? []).map(d => ({ at: d.recorded_at as string, value: Number(d.metric_value) }))
    },
    staleTime: 300_000,
  })
}

/** Bento « Tendance MRR » : courbe 30 jours, écart en % et bornes min/max. */
export default function MrrSparkline() {
  const { t } = useTranslation('admin')
  const { sp, tones } = useAdminSugar()
  const { data, isLoading } = useMrrHistory()

  if (isLoading || !data || data.length < 2) return null

  const values = data.map(d => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const W = 240, H = 40
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W
    const y = H - ((v - min) / range) * H
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  const first = values[0]
  const last = values[values.length - 1]
  const delta = first > 0 ? Math.round(((last - first) / first) * 100) : 0

  return (
    <AdminCard>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, letterSpacing: -0.2, color: sp.ink }}>
          {t('billing.mrrTrend')}
        </h3>
        <span style={{ fontSize: 11.5, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
          {t('billing.mrrTrendDays', { count: data.length })}
          {delta !== 0 && (
            <span style={{ marginLeft: 6, fontWeight: 700, color: delta > 0 ? tones.ok : tones.err }}>
              {delta > 0 ? '+' : ''}{delta}%
            </span>
          )}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: 'block', width: '100%', height: H }}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <polyline points={pts} fill="none" stroke={tones.info} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6,
        fontSize: 11, color: sp.sub, fontVariantNumeric: 'tabular-nums',
      }}>
        <span>{formatCHF(min)}</span>
        <span>{formatCHF(max)}</span>
      </div>
    </AdminCard>
  )
}
