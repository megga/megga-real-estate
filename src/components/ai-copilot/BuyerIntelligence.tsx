import { useTranslation } from 'react-i18next'
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

const TIMING_LABEL_KEY: Record<string, string> = {
  immediate: 'copilot.buyer.timing.immediate',
  '1-3_months': 'copilot.buyer.timing.months1to3',
  '3-6_months': 'copilot.buyer.timing.months3to6',
  '6-12_months': 'copilot.buyer.timing.months6to12',
  long_term: 'copilot.buyer.timing.longTerm',
}

const ENGAGEMENT_LABEL_KEY: Record<string, string> = {
  very_high: 'copilot.buyer.engagement.veryHigh',
  high: 'copilot.buyer.engagement.high',
  medium: 'copilot.buyer.engagement.medium',
  low: 'copilot.buyer.engagement.low',
  dormant: 'copilot.buyer.engagement.dormant',
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
  const { t } = useTranslation('messages')
  const hasData = seriousnessScore != null || purchaseProbability != null || timing || engagementLevel

  if (!hasData) return null

  return (
    <div className={cn('rounded-xl border border-theme-border p-5', className)}>
      <div className="flex items-center gap-2 mb-5">
        <h2 className="text-sm font-semibold text-theme-primary">{t('copilot.buyer.title')}</h2>
        <span className="text-xs text-theme-muted">{t('copilot.aiEstimate')}</span>
      </div>

      <div className="space-y-4">
        {seriousnessScore != null && (
          <div>
            <p className="text-xs text-theme-secondary mb-1.5">{t('copilot.buyer.seriousnessLevel')}</p>
            <ScoreBar value={seriousnessScore} />
          </div>
        )}

        {purchaseProbability != null && (
          <div>
            <p className="text-xs text-theme-secondary mb-1.5">{t('copilot.buyer.purchaseProbability')}</p>
            <ScoreBar value={purchaseProbability} />
          </div>
        )}

        {(timing || engagementLevel) && (
          <div className="flex gap-6">
            {timing && TIMING_LABEL_KEY[timing] && (
              <div>
                <p className="text-xs text-theme-secondary mb-1">{t('copilot.buyer.timingLabel')}</p>
                <p className="text-sm font-medium text-theme-primary">{t(TIMING_LABEL_KEY[timing])}</p>
              </div>
            )}
            {engagementLevel && ENGAGEMENT_LABEL_KEY[engagementLevel] && (
              <div>
                <p className="text-xs text-theme-secondary mb-1">{t('copilot.buyer.engagementLabel')}</p>
                <p className="text-sm font-medium text-theme-primary">{t(ENGAGEMENT_LABEL_KEY[engagementLevel])}</p>
              </div>
            )}
          </div>
        )}

        {budgetAnnounced != null && (
          <div className="pt-3 border-t border-theme-border-subtle">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-xs text-theme-secondary mb-0.5">{t('copilot.buyer.budgetAnnounced')}</p>
                <p className="text-sm font-semibold text-theme-primary">{formatCHF(budgetAnnounced)}</p>
              </div>
              {budgetEstimatedAi != null && budgetEstimatedAi !== budgetAnnounced && (
                <div className="text-right">
                  <p className="text-xs text-theme-muted mb-0.5">{t('copilot.buyer.budgetEstimated')}</p>
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
