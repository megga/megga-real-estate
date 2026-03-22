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

const TENSION_LABELS: Record<string, string> = {
  calm: 'Calme',
  moderate: 'Modéré',
  tense: 'Tendu',
  critical: 'Critique',
}

const TENSION_PCT: Record<string, number> = {
  calm: 25,
  moderate: 50,
  tense: 75,
  critical: 100,
}

const URGENCY_LABELS: Record<string, string> = {
  not_urgent: 'Pas pressé',
  moderate: 'Modéré',
  urgent: 'Urgent',
  very_urgent: 'Très urgent',
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
  const hasData = tensionLevel || priceReductionProbability != null

  if (!hasData) return null

  return (
    <div className={cn('rounded-xl border border-theme-border p-5', className)}>
      <div className="flex items-center gap-2 mb-5">
        <h2 className="text-sm font-semibold text-theme-primary">Seller intelligence</h2>
        <span className="text-[10px] text-theme-muted">estimation IA</span>
      </div>

      <div className="space-y-4">
        {tensionLevel && TENSION_LABELS[tensionLevel] && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-theme-secondary">Niveau de tension</p>
              <span className="text-xs font-medium text-theme-primary">{TENSION_LABELS[tensionLevel]}</span>
            </div>
            <div className="h-1.5 bg-theme-border rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-theme-primary transition-all" style={{ width: `${TENSION_PCT[tensionLevel]}%` }} />
            </div>
          </div>
        )}

        {priceReductionProbability != null && (
          <div>
            <p className="text-xs text-theme-secondary mb-1.5">Probabilité de baisse de prix</p>
            <ScoreBar value={priceReductionProbability} />
          </div>
        )}

        {dissatisfactionRisk != null && (
          <div>
            <p className="text-xs text-theme-secondary mb-1.5">Risque d'insatisfaction</p>
            <ScoreBar value={dissatisfactionRisk} />
          </div>
        )}

        {urgencyLevel && URGENCY_LABELS[urgencyLevel] && (
          <div>
            <p className="text-xs text-theme-secondary mb-1">Urgence</p>
            <p className="text-sm font-medium text-theme-primary">{URGENCY_LABELS[urgencyLevel]}</p>
          </div>
        )}

        {(daysOnMarket != null || totalVisits != null) && (
          <div className="pt-3 border-t border-theme-border-subtle flex gap-6">
            {daysOnMarket != null && (
              <div>
                <p className="text-xs text-theme-secondary mb-0.5">Jours en vente</p>
                <p className="text-sm font-semibold text-theme-primary">{daysOnMarket}</p>
              </div>
            )}
            {totalVisits != null && (
              <div>
                <p className="text-xs text-theme-secondary mb-0.5">Visites totales</p>
                <p className="text-sm font-semibold text-theme-primary">{totalVisits}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
