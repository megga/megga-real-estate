// P7 — Tendance du MRR estimé (platform_metrics.mrr_estimate, historisé horaire
// par admin-monitoring). Sparkline SVG inline (0 dépendance chart).

import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { formatCHF } from '@/lib/utils'

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

export default function MrrSparkline() {
  const { t } = useTranslation('admin')
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
    <div className="rounded-xl border border-theme-border p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-theme-primary">{t('billing.mrrTrend')}</h3>
        <span className="text-xs text-theme-tertiary">
          {t('billing.mrrTrendDays', { count: data.length })}
          {delta !== 0 && <span className={delta > 0 ? 'text-emerald-500 ml-1.5' : 'text-red-500 ml-1.5'}>{delta > 0 ? '+' : ''}{delta}%</span>}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-10" preserveAspectRatio="none" aria-hidden="true">
        <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-admin-accent" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex items-center justify-between mt-1 text-xs text-theme-muted">
        <span>{formatCHF(min)}</span>
        <span>{formatCHF(max)}</span>
      </div>
    </div>
  )
}
