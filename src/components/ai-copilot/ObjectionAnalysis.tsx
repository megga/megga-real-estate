import { Sparkles, AlertTriangle, ThumbsDown, Lightbulb, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Objection {
  label: string
  count: number
  percentage: number
}

interface Weakness {
  label: string
  severity: 'high' | 'medium' | 'low'
}

interface Suggestion {
  label: string
  type: 'price' | 'staging' | 'marketing' | 'info'
}

interface ObjectionAnalysisProps {
  totalVisits: number
  objections: Objection[]
  weaknesses: Weakness[]
  suggestions: Suggestion[]
  className?: string
}

const SEVERITY_CONFIG: Record<string, { cls: string }> = {
  high: { cls: 'bg-danger/10 text-danger' },
  medium: { cls: 'bg-warning/10 text-warning' },
  low: { cls: 'bg-primary-100 text-primary-600' },
}

// Mock data for when no real data is available
export const MOCK_OBJECTION_DATA: ObjectionAnalysisProps = {
  totalVisits: 12,
  objections: [
    { label: 'Prix trop élevé', count: 5, percentage: 42 },
    { label: 'Bruit environnant', count: 3, percentage: 25 },
    { label: 'Surface trop petite', count: 2, percentage: 17 },
    { label: 'Manque de luminosité', count: 1, percentage: 8 },
    { label: 'Pas de parking', count: 1, percentage: 8 },
  ],
  weaknesses: [
    { label: 'Positionnement prix au-dessus du marché (+8%)', severity: 'high' },
    { label: 'Proximité d\'un axe routier passant', severity: 'medium' },
    { label: 'Cuisine non rénovée', severity: 'low' },
  ],
  suggestions: [
    { label: 'Envisager une baisse de prix de 3-5% pour s\'aligner au marché', type: 'price' },
    { label: 'Programmer les visites le week-end (moins de bruit)', type: 'staging' },
    { label: 'Mettre en avant le potentiel de rénovation cuisine dans l\'annonce', type: 'marketing' },
    { label: 'Ajouter des photos avec meilleur éclairage', type: 'staging' },
  ],
}

export default function ObjectionAnalysis({
  totalVisits,
  objections,
  weaknesses,
  suggestions,
  className,
}: ObjectionAnalysisProps) {
  if (objections.length === 0) return null

  return (
    <div className={cn('bg-white rounded-card shadow-card p-5', className)}>
      <div className="flex items-center gap-2 mb-4">
        <div className="h-7 w-7 rounded-lg bg-amber-100 flex items-center justify-center">
          <BarChart3 className="h-4 w-4 text-amber-600" />
        </div>
        <h2 className="text-sm font-semibold text-primary-900 uppercase tracking-wider">Analyse des objections</h2>
        <span className="text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded-badge flex items-center gap-1">
          <Sparkles className="h-2.5 w-2.5" />
          Analyse IA
        </span>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Basée sur les retours de {totalVisits} visite{totalVisits > 1 ? 's' : ''}.
      </p>

      <div className="space-y-5">
        {/* Objections */}
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <ThumbsDown className="h-3.5 w-3.5 text-primary-400" />
            <span className="text-xs font-semibold text-primary-700 uppercase tracking-wider">Objections récurrentes</span>
          </div>
          <div className="space-y-2">
            {objections.map((obj, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-primary-700">{obj.label}</span>
                    <span className="text-xs font-medium text-muted-foreground">
                      {obj.count}x ({obj.percentage}%)
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        obj.percentage >= 30 ? 'bg-danger' : obj.percentage >= 15 ? 'bg-warning' : 'bg-primary-300'
                      )}
                      style={{ width: `${obj.percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Weaknesses */}
        {weaknesses.length > 0 && (
          <div className="pt-3 border-t border-border">
            <div className="flex items-center gap-1.5 mb-3">
              <AlertTriangle className="h-3.5 w-3.5 text-primary-400" />
              <span className="text-xs font-semibold text-primary-700 uppercase tracking-wider">Points faibles identifiés</span>
            </div>
            <div className="space-y-2">
              {weaknesses.map((w, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={cn('w-2 h-2 rounded-full flex-shrink-0', SEVERITY_CONFIG[w.severity]?.cls?.split(' ')[0] || 'bg-gray-300')} />
                  <span className="text-sm text-primary-700">{w.label}</span>
                  <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-badge ml-auto flex-shrink-0', SEVERITY_CONFIG[w.severity]?.cls)}>
                    {w.severity === 'high' ? 'Impact fort' : w.severity === 'medium' ? 'Impact modéré' : 'Impact faible'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="pt-3 border-t border-border">
            <div className="flex items-center gap-1.5 mb-3">
              <Lightbulb className="h-3.5 w-3.5 text-primary-400" />
              <span className="text-xs font-semibold text-primary-700 uppercase tracking-wider">Suggestions d'ajustement</span>
            </div>
            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <div key={i} className="flex items-start gap-2.5 p-2.5 bg-success/5 rounded-lg border border-success/10">
                  <Lightbulb className="h-3.5 w-3.5 text-success mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-primary-700 leading-relaxed">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-[10px] text-gray-300 mt-4 text-center">
        Analyse IA des retours de visite — données anonymisées.
      </p>
    </div>
  )
}
