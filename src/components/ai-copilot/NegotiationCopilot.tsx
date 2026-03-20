import { Sparkles, Scale, Clock, TrendingUp, Target, AlertCircle } from 'lucide-react'
import { cn, formatCHF } from '@/lib/utils'

interface NegotiationCopilotProps {
  askingPrice: number
  offerPrice: number
  daysOnMarket: number
  totalVisits: number
  buyerInterestLevel: 'very_high' | 'high' | 'medium' | 'low'
  className?: string
}

const INTEREST_CONFIG: Record<string, { label: string; cls: string }> = {
  very_high: { label: 'Très élevé', cls: 'bg-success/10 text-success' },
  high: { label: 'Élevé', cls: 'bg-success/10 text-success' },
  medium: { label: 'Moyen', cls: 'bg-warning/10 text-warning' },
  low: { label: 'Faible', cls: 'bg-danger/10 text-danger' },
}

function getMockStrategy(gap: number, days: number, visits: number): { strategy: string; counterOffer: string; reasoning: string } {
  if (gap <= 3) {
    return {
      strategy: 'Accepter ou contre-offre symbolique',
      counterOffer: `Contre-offre à -1% du prix demandé`,
      reasoning: `L'écart est faible (${gap.toFixed(1)}%). Avec ${visits} visites et ${days} jours en vente, le marché valide le prix. Risque de perdre l'acheteur en négociant trop.`,
    }
  }
  if (gap <= 8) {
    return {
      strategy: 'Contre-offre modérée',
      counterOffer: `Contre-offre au point médian (-${(gap / 2).toFixed(0)}%)`,
      reasoning: `L'écart de ${gap.toFixed(1)}% est dans la norme de négociation. Proposer un compromis au milieu pour maintenir l'intérêt tout en protégeant la valeur.`,
    }
  }
  if (gap <= 15) {
    return {
      strategy: 'Maintenir le prix avec arguments',
      counterOffer: `Contre-offre à -3% maximum`,
      reasoning: `L'écart de ${gap.toFixed(1)}% est significatif. ${days > 60 ? 'Cependant, le bien est en vente depuis longtemps — considérer un ajustement.' : 'Le prix est justifié par le marché — présenter les comparables.'}`,
    }
  }
  return {
    strategy: 'Offre trop basse — refuser poliment',
    counterOffer: 'Maintenir le prix demandé',
    reasoning: `L'écart de ${gap.toFixed(1)}% est trop important. ${visits > 5 ? 'Le bien a suscité de l\'intérêt ('+visits+' visites) — d\'autres acheteurs sont possibles.' : 'Suggérer à l\'acheteur de revoir son budget.'}`,
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
  const gap = ((askingPrice - offerPrice) / askingPrice) * 100
  const { strategy, counterOffer, reasoning } = getMockStrategy(gap, daysOnMarket, totalVisits)
  const interest = INTEREST_CONFIG[buyerInterestLevel]

  return (
    <div className={cn('bg-white rounded-card shadow-card p-5', className)}>
      <div className="flex items-center gap-2 mb-4">
        <div className="h-7 w-7 rounded-lg bg-purple-100 flex items-center justify-center">
          <Scale className="h-4 w-4 text-purple-600" />
        </div>
        <h2 className="text-sm font-semibold text-primary-900 uppercase tracking-wider">Copilote de négociation</h2>
        <span className="text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded-badge flex items-center gap-1">
          <Sparkles className="h-2.5 w-2.5" />
          Suggestion IA
        </span>
      </div>

      {/* Price gap visual */}
      <div className="bg-section rounded-lg p-4 mb-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Prix demandé</p>
            <p className="text-sm font-bold text-primary-900">{formatCHF(askingPrice)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Écart</p>
            <p className={cn('text-lg font-bold', gap > 10 ? 'text-danger' : gap > 5 ? 'text-warning' : 'text-success')}>
              -{gap.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Offre reçue</p>
            <p className="text-sm font-bold text-accent">{formatCHF(offerPrice)}</p>
          </div>
        </div>

        {/* Gap bar */}
        <div className="mt-3 relative">
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
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
            <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-0.5">Stratégie recommandée</p>
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
            <span className="text-xs text-primary-600">{daysOnMarket} jours en vente</span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-primary-400" />
            <span className="text-xs text-primary-600">{totalVisits} visites</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-primary-400" />
            <span className="text-xs text-primary-600">Intérêt acheteur :</span>
            <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded-full', interest.cls)}>
              {interest.label}
            </span>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-[10px] text-gray-300 mt-4 text-center">
        Aide à la décision — ne constitue pas une recommandation formelle.
      </p>
    </div>
  )
}
