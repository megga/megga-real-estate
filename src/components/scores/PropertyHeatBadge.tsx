import { cn } from '@/lib/utils'
import { formatCHF } from '@/lib/utils'
import { usePropertyScore, getScoreColor, getHeatLabel } from '@/hooks/useScoreEngine'

interface PropertyHeatBadgeProps {
  propertyId: string
  source?: 'internal' | 'market'
  className?: string
  compact?: boolean
}

export default function PropertyHeatBadge({ propertyId, source = 'internal', className, compact }: PropertyHeatBadgeProps) {
  const { score, isLoading } = usePropertyScore(propertyId, source)

  if (isLoading || !score) return null

  const color = getScoreColor(score.heat_score)
  const label = getHeatLabel(score.heat_score)

  if (compact) {
    return (
      <span className={cn('text-[10px] font-bold', color, className)} title={label}>
        {score.heat_score}
      </span>
    )
  }

  return (
    <div className={cn('rounded-xl border border-theme-border p-4', className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-semibold text-theme-primary">Heat Score</h4>
          <span className="text-[10px] text-theme-muted">estimation IA</span>
        </div>
        <span className={cn('text-lg font-bold', color)}>{score.heat_score}<span className="text-xs text-theme-muted">/100</span></span>
      </div>

      {/* Heat bar */}
      <div className="h-2 rounded-full bg-theme-hover mb-4">
        <div
          className={cn('h-full rounded-full', score.heat_score >= 60 ? 'bg-emerald-500' : score.heat_score >= 40 ? 'bg-amber-500' : 'bg-red-500')}
          style={{ width: `${score.heat_score}%` }}
        />
      </div>

      {/* Details */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-theme-secondary">Position marché</span>
          <span className={cn('text-[11px] font-semibold', getScoreColor(score.market_position_score))}>{score.market_position_score}/100</span>
        </div>
        {score.price_vs_market_pct !== null && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-theme-secondary">vs marché</span>
            <span className={cn('text-[11px] font-semibold', score.price_vs_market_pct > 5 ? 'text-red-500' : score.price_vs_market_pct < -5 ? 'text-emerald-500' : 'text-theme-primary')}>
              {score.price_vs_market_pct > 0 ? '+' : ''}{score.price_vs_market_pct}%
            </span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-theme-secondary">Intérêt</span>
          <span className={cn('text-[11px] font-semibold', getScoreColor(score.interest_level))}>{score.interest_level}/100</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-theme-secondary">Jours sur le marché</span>
          <span className="text-[11px] font-semibold text-theme-primary">{score.days_on_market}j</span>
        </div>
        {score.comparable_count > 0 && score.avg_comparable_price && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-theme-secondary">Comparables ({score.comparable_count})</span>
            <span className="text-[11px] font-semibold text-theme-primary">{formatCHF(score.avg_comparable_price)} moy.</span>
          </div>
        )}
      </div>

      {/* Risk + trend */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-theme-border">
        <div className="flex items-center gap-1.5">
          <span className={cn('w-1.5 h-1.5 rounded-full', score.stagnation_risk === 'high' ? 'bg-red-500' : score.stagnation_risk === 'medium' ? 'bg-amber-500' : 'bg-emerald-500')} />
          <span className="text-[10px] text-theme-secondary">Risque stagnation : {score.stagnation_risk}</span>
        </div>
        <span className={cn('text-[10px] font-medium', score.price_trend === 'dropping' ? 'text-emerald-500' : score.price_trend === 'rising' ? 'text-red-500' : 'text-theme-muted')}>
          {score.price_trend === 'dropping' ? '↘ Baisse' : score.price_trend === 'rising' ? '↗ Hausse' : '→ Stable'}
        </span>
      </div>

      <p className="text-[10px] text-theme-muted mt-2 text-right">{label}</p>
    </div>
  )
}
