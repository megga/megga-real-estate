import { Sparkles, AlertTriangle, TrendingDown, Gauge, Timer } from 'lucide-react'
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

const TENSION_CONFIG: Record<string, { label: string; cls: string; barCls: string }> = {
  calm: { label: 'Calme', cls: 'bg-success/10 text-success', barCls: 'bg-success' },
  moderate: { label: 'Modéré', cls: 'bg-warning/10 text-warning', barCls: 'bg-warning' },
  tense: { label: 'Tendu', cls: 'bg-danger/10 text-danger', barCls: 'bg-danger' },
  critical: { label: 'Critique', cls: 'bg-danger text-white', barCls: 'bg-danger' },
}

const URGENCY_CONFIG: Record<string, { label: string; cls: string }> = {
  not_urgent: { label: 'Pas pressé', cls: 'bg-success/10 text-success' },
  moderate: { label: 'Modéré', cls: 'bg-warning/10 text-warning' },
  urgent: { label: 'Urgent', cls: 'bg-danger/10 text-danger' },
  very_urgent: { label: 'Très urgent', cls: 'bg-danger text-white' },
}

function ProgressBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const color = pct >= 70 ? 'bg-danger' : pct >= 40 ? 'bg-warning' : 'bg-success'

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-semibold text-primary-900 w-10 text-right">{value}%</span>
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
      <div className="flex items-center gap-2 mb-4">
        <div className="h-7 w-7 rounded-lg bg-warning/10 flex items-center justify-center">
          <Gauge className="h-4 w-4 text-warning" />
        </div>
        <h2 className="text-sm font-semibold text-primary-900 uppercase tracking-wider">Seller Intelligence</h2>
        <span className="text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded-badge flex items-center gap-1 cursor-help" title="Confiance IA : 72% — basé sur la durée de mise en vente, feedbacks et interactions">
          <Sparkles className="h-2.5 w-2.5" />
          Estimation IA
        </span>
      </div>

      <div className="space-y-4">
        {/* Tension level */}
        {tensionLevel && TENSION_CONFIG[tensionLevel] && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-primary-400" />
              <span className="text-xs font-medium text-primary-600">Niveau de tension</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', TENSION_CONFIG[tensionLevel].barCls)}
                  style={{
                    width: tensionLevel === 'calm' ? '25%' : tensionLevel === 'moderate' ? '50%' : tensionLevel === 'tense' ? '75%' : '100%',
                  }}
                />
              </div>
              <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', TENSION_CONFIG[tensionLevel].cls)}>
                {TENSION_CONFIG[tensionLevel].label}
              </span>
            </div>
          </div>
        )}

        {/* Price reduction probability */}
        {priceReductionProbability != null && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <TrendingDown className="h-3.5 w-3.5 text-primary-400" />
              <span className="text-xs font-medium text-primary-600">Probabilité de baisse de prix</span>
            </div>
            <ProgressBar value={priceReductionProbability} />
          </div>
        )}

        {/* Dissatisfaction risk */}
        {dissatisfactionRisk != null && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-primary-400" />
              <span className="text-xs font-medium text-primary-600">Risque d'insatisfaction</span>
            </div>
            <ProgressBar value={dissatisfactionRisk} />
          </div>
        )}

        {/* Urgency & Stats */}
        <div className="flex flex-wrap gap-4">
          {urgencyLevel && URGENCY_CONFIG[urgencyLevel] && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Timer className="h-3.5 w-3.5 text-primary-400" />
                <span className="text-xs font-medium text-primary-600">Urgence</span>
              </div>
              <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', URGENCY_CONFIG[urgencyLevel].cls)}>
                {URGENCY_CONFIG[urgencyLevel].label}
              </span>
            </div>
          )}
        </div>

        {/* Market stats */}
        {(daysOnMarket != null || totalVisits != null) && (
          <div className="pt-3 border-t border-border">
            <div className="grid grid-cols-2 gap-3">
              {daysOnMarket != null && (
                <div className="bg-section rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Jours en vente</p>
                  <p className={cn('text-lg font-bold', daysOnMarket > 60 ? 'text-danger' : daysOnMarket > 30 ? 'text-warning' : 'text-primary-900')}>
                    {daysOnMarket}
                  </p>
                </div>
              )}
              {totalVisits != null && (
                <div className="bg-section rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Visites totales</p>
                  <p className="text-lg font-bold text-primary-900">{totalVisits}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
