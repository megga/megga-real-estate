import { Sparkles, Scale, Clock, TrendingUp, Target, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { cn, formatCHF } from '@/lib/utils'

interface NegotiationCopilotProps {
  askingPrice: number
  offerPrice: number
  daysOnMarket: number
  totalVisits: number
  buyerInterestLevel: 'very_high' | 'high' | 'medium' | 'low'
  className?: string
}

const INTEREST_CLS: Record<string, string> = {
  very_high: 'bg-success/10 text-success',
  high: 'bg-success/10 text-success',
  medium: 'bg-warning/10 text-warning',
  low: 'bg-danger/10 text-danger',
}

const INTEREST_LABEL_KEY: Record<string, string> = {
  very_high: 'copilot.negotiation.interest.veryHigh',
  high: 'copilot.negotiation.interest.high',
  medium: 'copilot.negotiation.interest.medium',
  low: 'copilot.negotiation.interest.low',
}

function getStrategy(
  t: TFunction,
  gap: number,
  days: number,
  visits: number,
): { strategy: string; counterOffer: string; reasoning: string } {
  const gapStr = gap.toFixed(1)
  if (gap <= 3) {
    return {
      strategy: t('copilot.negotiation.tiers.symbolic.strategy'),
      counterOffer: t('copilot.negotiation.tiers.symbolic.counterOffer'),
      reasoning: t('copilot.negotiation.tiers.symbolic.reasoning', { gap: gapStr, visits, days }),
    }
  }
  if (gap <= 8) {
    return {
      strategy: t('copilot.negotiation.tiers.moderate.strategy'),
      counterOffer: t('copilot.negotiation.tiers.moderate.counterOffer', { mid: (gap / 2).toFixed(0) }),
      reasoning: t('copilot.negotiation.tiers.moderate.reasoning', { gap: gapStr }),
    }
  }
  if (gap <= 15) {
    return {
      strategy: t('copilot.negotiation.tiers.hold.strategy'),
      counterOffer: t('copilot.negotiation.tiers.hold.counterOffer'),
      reasoning:
        days > 60
          ? t('copilot.negotiation.tiers.hold.reasoningLong', { gap: gapStr })
          : t('copilot.negotiation.tiers.hold.reasoningMarket', { gap: gapStr }),
    }
  }
  return {
    strategy: t('copilot.negotiation.tiers.tooLow.strategy'),
    counterOffer: t('copilot.negotiation.tiers.tooLow.counterOffer'),
    reasoning:
      visits > 5
        ? t('copilot.negotiation.tiers.tooLow.reasoningInterest', { gap: gapStr, visits })
        : t('copilot.negotiation.tiers.tooLow.reasoningBudget', { gap: gapStr }),
  }
}

export default function NegotiationCopilot({
  askingPrice,
  offerPrice,
  daysOnMarket,
  totalVisits,
  buyerInterestLevel,
  className,
}: NegotiationCopilotProps) {
  const { t } = useTranslation('messages')
  const gap = ((askingPrice - offerPrice) / askingPrice) * 100
  const { strategy, counterOffer, reasoning } = getStrategy(t, gap, daysOnMarket, totalVisits)
  const interestCls = INTEREST_CLS[buyerInterestLevel]
  const interestLabel = t(INTEREST_LABEL_KEY[buyerInterestLevel])

  return (
    <div className={cn('rounded-xl border border-theme-border p-5', className)}>
      <div className="flex items-center gap-2 mb-4">
        <div className="h-7 w-7 rounded-lg bg-purple-100 flex items-center justify-center">
          <Scale className="h-4 w-4 text-purple-600" />
        </div>
        <h2 className="text-sm font-semibold text-primary-900 capitalize">{t('copilot.negotiation.title')}</h2>
        <span className="text-xs font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded-badge flex items-center gap-1">
          <Sparkles className="h-2.5 w-2.5" />
          {t('copilot.negotiation.aiBadge')}
        </span>
      </div>

      {/* Price gap visual */}
      <div className="bg-section rounded-lg p-4 mb-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-muted-foreground capitalize mb-1">{t('copilot.negotiation.askingPrice')}</p>
            <p className="text-sm font-bold text-primary-900">{formatCHF(askingPrice)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground capitalize mb-1">{t('copilot.negotiation.gap')}</p>
            <p className={cn('text-lg font-bold', gap > 10 ? 'text-danger' : gap > 5 ? 'text-warning' : 'text-success')}>
              -{gap.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground capitalize mb-1">{t('copilot.negotiation.offerReceived')}</p>
            <p className="text-sm font-bold text-accent">{formatCHF(offerPrice)}</p>
          </div>
        </div>

        {/* Gap bar */}
        <div className="mt-3 relative">
          <div className="h-3 bg-theme-active rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                gap > 10 ? 'bg-danger' : gap > 5 ? 'bg-warning' : 'bg-success'
              )}
              style={{ width: `${100 - gap}%` }}
            />
          </div>
        </div>
      </div>

      {/* Strategy */}
      <div className="space-y-3">
        <div className="flex items-start gap-3 p-3 bg-accent/5 rounded-lg border border-accent/10">
          <Target className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-accent capitalize mb-0.5">{t('copilot.negotiation.recommendedStrategy')}</p>
            <p className="text-sm font-medium text-primary-900">{strategy}</p>
            <p className="text-xs text-primary-600 mt-1">{counterOffer}</p>
          </div>
        </div>

        {/* Reasoning */}
        <div className="flex items-start gap-3 p-3 bg-section rounded-lg">
          <AlertCircle className="h-4 w-4 text-primary-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-primary-600 leading-relaxed">{reasoning}</p>
        </div>

        {/* Context indicators */}
        <div className="flex flex-wrap gap-3 pt-2">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-primary-400" />
            <span className="text-xs text-primary-600">{t('copilot.negotiation.daysOnMarket', { count: daysOnMarket })}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-primary-400" />
            <span className="text-xs text-primary-600">{t('copilot.negotiation.visits', { count: totalVisits })}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-primary-400" />
            <span className="text-xs text-primary-600">{t('copilot.negotiation.buyerInterest')}</span>
            <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded-full', interestCls)}>
              {interestLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-theme-tertiary mt-4 text-center">
        {t('copilot.negotiation.disclaimer')}
      </p>
    </div>
  )
}
