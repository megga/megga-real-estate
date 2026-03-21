import { Sparkles, TrendingUp, Clock, Zap, Banknote } from 'lucide-react'
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

const TIMING_CONFIG: Record<string, { label: string; cls: string }> = {
  immediate: { label: 'Immédiat', cls: 'bg-success/10 text-success' },
  '1-3_months': { label: '1-3 mois', cls: 'bg-success/10 text-success' },
  '3-6_months': { label: '3-6 mois', cls: 'bg-warning/10 text-warning' },
  '6-12_months': { label: '6-12 mois', cls: 'bg-warning/10 text-warning' },
  long_term: { label: 'Long terme', cls: 'bg-primary-100 text-primary-600' },
}

const ENGAGEMENT_CONFIG: Record<string, { label: string; cls: string }> = {
  very_high: { label: 'Très élevé', cls: 'bg-success/10 text-success' },
  high: { label: 'Élevé', cls: 'bg-success/10 text-success' },
  medium: { label: 'Moyen', cls: 'bg-warning/10 text-warning' },
  low: { label: 'Faible', cls: 'bg-danger/10 text-danger' },
  dormant: { label: 'Dormant', cls: 'bg-primary-100 text-primary-500' },
}

function ProgressBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const color = pct >= 70 ? 'bg-success' : pct >= 40 ? 'bg-warning' : 'bg-danger'

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-semibold text-primary-900 w-10 text-right">{value}%</span>
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
      <div className="flex items-center gap-2 mb-4">
        <div className="h-7 w-7 rounded-lg bg-accent/10 flex items-center justify-center">
          <TrendingUp className="h-4 w-4 text-accent" />
        </div>
        <h2 className="text-sm font-semibold text-primary-900 uppercase tracking-wider">Buyer Intelligence</h2>
        <span className="text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded-badge flex items-center gap-1 cursor-help" title="Confiance IA : 78% — basé sur les interactions, visites et comportement du client">
          <Sparkles className="h-2.5 w-2.5" />
          Estimation IA
        </span>
      </div>

      <div className="space-y-4">
        {/* Seriousness */}
        {seriousnessScore != null && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Zap className="h-3.5 w-3.5 text-primary-400" />
              <span className="text-xs font-medium text-primary-600">Niveau de sérieux</span>
            </div>
            <ProgressBar value={seriousnessScore} />
          </div>
        )}

        {/* Purchase probability */}
        {purchaseProbability != null && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-primary-400" />
              <span className="text-xs font-medium text-primary-600">Probabilité d'achat</span>
            </div>
            <ProgressBar value={purchaseProbability} />
          </div>
        )}

        {/* Timing & Engagement */}
        <div className="flex flex-wrap gap-4">
          {timing && TIMING_CONFIG[timing] && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Clock className="h-3.5 w-3.5 text-primary-400" />
                <span className="text-xs font-medium text-primary-600">Timing d'achat</span>
              </div>
              <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', TIMING_CONFIG[timing].cls)}>
                {TIMING_CONFIG[timing].label}
              </span>
            </div>
          )}

          {engagementLevel && ENGAGEMENT_CONFIG[engagementLevel] && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Zap className="h-3.5 w-3.5 text-primary-400" />
                <span className="text-xs font-medium text-primary-600">Engagement</span>
              </div>
              <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', ENGAGEMENT_CONFIG[engagementLevel].cls)}>
                {ENGAGEMENT_CONFIG[engagementLevel].label}
              </span>
            </div>
          )}
        </div>

        {/* Budget comparison */}
        {budgetAnnounced != null && budgetEstimatedAi != null && budgetEstimatedAi !== budgetAnnounced && (
          <div className="pt-3 border-t border-border">
            <div className="flex items-center gap-1.5 mb-2">
              <Banknote className="h-3.5 w-3.5 text-primary-400" />
              <span className="text-xs font-medium text-primary-600">Budget</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-section rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Annoncé</p>
                <p className="text-sm font-bold text-primary-900">{formatCHF(budgetAnnounced)}</p>
              </div>
              <div className="bg-accent/5 rounded-lg p-3 border border-accent/10">
                <p className="text-[10px] text-accent uppercase tracking-wider mb-0.5 flex items-center gap-1">
                  Estimé IA <Sparkles className="h-2.5 w-2.5" />
                </p>
                <p className="text-sm font-bold text-accent">{formatCHF(budgetEstimatedAi)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
