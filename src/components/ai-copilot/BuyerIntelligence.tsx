import { cn, formatCHF } from '@/lib/utils'

interface BuyerIntelligenceProps {
  seriousnessScore: number | null
  purchaseProbability: number | null
  timing: string | null
  engagementLevel: string | null
  budgetAnnounced: number | null
  budgetEstimatedAi: number | null
  className?: string
}

const TIMING_LABELS: Record<string, string> = {
  immediate: 'Immédiat',
  '1-3_months': '1-3 mois',
  '3-6_months': '3-6 mois',
  '6-12_months': '6-12 mois',
  long_term: 'Long terme',
}

const ENGAGEMENT_LABELS: Record<string, string> = {
  very_high: 'Très élevé',
  high: 'Élevé',
  medium: 'Moyen',
  low: 'Faible',
  dormant: 'Dormant',
}

function ScoreBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-theme-border rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-theme-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-medium text-theme-primary w-10 text-right tabular-nums">{value}%</span>
    </div>
  )
}

export default function BuyerIntelligence({
  seriousnessScore,
  purchaseProbability,
  timing,
  engagementLevel,
  budgetAnnounced,
  budgetEstimatedAi,
  className,
}: BuyerIntelligenceProps) {
  const hasData = seriousnessScore != null || purchaseProbability != null || timing || engagementLevel

  if (!hasData) return null

  return (
    <div className={cn('rounded-xl border border-theme-border p-5', className)}>
      <div className="flex items-center gap-2 mb-5">
        <h2 className="text-sm font-semibold text-theme-primary">Buyer intelligence</h2>
        <span className="text-[10px] text-theme-muted">estimation IA</span>
      </div>

      <div className="space-y-4">
        {seriousnessScore != null && (
          <div>
            <p className="text-xs text-theme-secondary mb-1.5">Niveau de sérieux</p>
            <ScoreBar value={seriousnessScore} />
          </div>
        )}

        {purchaseProbability != null && (
          <div>
            <p className="text-xs text-theme-secondary mb-1.5">Probabilité d'achat</p>
            <ScoreBar value={purchaseProbability} />
          </div>
        )}

        {(timing || engagementLevel) && (
          <div className="flex gap-6">
            {timing && TIMING_LABELS[timing] && (
              <div>
                <p className="text-xs text-theme-secondary mb-1">Timing</p>
                <p className="text-sm font-medium text-theme-primary">{TIMING_LABELS[timing]}</p>
              </div>
            )}
            {engagementLevel && ENGAGEMENT_LABELS[engagementLevel] && (
              <div>
                <p className="text-xs text-theme-secondary mb-1">Engagement</p>
                <p className="text-sm font-medium text-theme-primary">{ENGAGEMENT_LABELS[engagementLevel]}</p>
              </div>
            )}
          </div>
        )}

        {budgetAnnounced != null && (
          <div className="pt-3 border-t border-theme-border-subtle">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-xs text-theme-secondary mb-0.5">Budget annoncé</p>
                <p className="text-sm font-semibold text-theme-primary">{formatCHF(budgetAnnounced)}</p>
              </div>
              {budgetEstimatedAi != null && budgetEstimatedAi !== budgetAnnounced && (
                <div className="text-right">
                  <p className="text-xs text-theme-muted mb-0.5">Estimé · estimation IA</p>
                  <p className="text-sm font-semibold text-theme-primary">{formatCHF(budgetEstimatedAi)}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
