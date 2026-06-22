import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface SellerIntelligenceProps {
  tensionLevel: string | null
  priceReductionProbability: number | null
  dissatisfactionRisk?: number | null
  urgencyLevel?: string | null
  daysOnMarket?: number | null
  totalVisits?: number | null
  className?: string
}

const TENSION_LABEL_KEY: Record<string, string> = {
  calm: 'copilot.seller.tension.calm',
  moderate: 'copilot.seller.tension.moderate',
  tense: 'copilot.seller.tension.tense',
  critical: 'copilot.seller.tension.critical',
}

const TENSION_PCT: Record<string, number> = {
  calm: 25,
  moderate: 50,
  tense: 75,
  critical: 100,
}

const URGENCY_LABEL_KEY: Record<string, string> = {
  not_urgent: 'copilot.seller.urgency.notUrgent',
  moderate: 'copilot.seller.urgency.moderate',
  urgent: 'copilot.seller.urgency.urgent',
  very_urgent: 'copilot.seller.urgency.veryUrgent',
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

export default function SellerIntelligence({
  tensionLevel,
  priceReductionProbability,
  dissatisfactionRisk,
  urgencyLevel,
  daysOnMarket,
  totalVisits,
  className,
}: SellerIntelligenceProps) {
  const { t } = useTranslation('messages')
  const hasData = tensionLevel || priceReductionProbability != null

  if (!hasData) return null

  return (
    <div className={cn('rounded-xl border border-theme-border p-5', className)}>
      <div className="flex items-center gap-2 mb-5">
        <h2 className="text-sm font-semibold text-theme-primary">{t('copilot.seller.title')}</h2>
        <span className="text-xs text-theme-muted">{t('copilot.aiEstimate')}</span>
      </div>

      <div className="space-y-4">
        {tensionLevel && TENSION_LABEL_KEY[tensionLevel] && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-theme-secondary">{t('copilot.seller.tensionLevel')}</p>
              <span className="text-xs font-medium text-theme-primary">{t(TENSION_LABEL_KEY[tensionLevel])}</span>
            </div>
            <div className="h-1.5 bg-theme-border rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-theme-primary transition-all" style={{ width: `${TENSION_PCT[tensionLevel]}%` }} />
            </div>
          </div>
        )}

        {priceReductionProbability != null && (
          <div>
            <p className="text-xs text-theme-secondary mb-1.5">{t('copilot.seller.priceReductionProbability')}</p>
            <ScoreBar value={priceReductionProbability} />
          </div>
        )}

        {dissatisfactionRisk != null && (
          <div>
            <p className="text-xs text-theme-secondary mb-1.5">{t('copilot.seller.dissatisfactionRisk')}</p>
            <ScoreBar value={dissatisfactionRisk} />
          </div>
        )}

        {urgencyLevel && URGENCY_LABEL_KEY[urgencyLevel] && (
          <div>
            <p className="text-xs text-theme-secondary mb-1">{t('copilot.seller.urgencyLabel')}</p>
            <p className="text-sm font-medium text-theme-primary">{t(URGENCY_LABEL_KEY[urgencyLevel])}</p>
          </div>
        )}

        {(daysOnMarket != null || totalVisits != null) && (
          <div className="pt-3 border-t border-theme-border-subtle flex gap-6">
            {daysOnMarket != null && (
              <div>
                <p className="text-xs text-theme-secondary mb-0.5">{t('copilot.seller.daysOnMarket')}</p>
                <p className="text-sm font-semibold text-theme-primary">{daysOnMarket}</p>
              </div>
            )}
            {totalVisits != null && (
              <div>
                <p className="text-xs text-theme-secondary mb-0.5">{t('copilot.seller.totalVisits')}</p>
                <p className="text-sm font-semibold text-theme-primary">{totalVisits}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
