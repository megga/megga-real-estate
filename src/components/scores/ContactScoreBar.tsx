import { cn } from '@/lib/utils'
import { formatCHF } from '@/lib/utils'
import { useContactScore, getScoreColor, getScoreLabel } from '@/hooks/useScoreEngine'

interface ContactScoreBarProps {
  contactId: string
  className?: string
  compact?: boolean
}

export default function ContactScoreBar({ contactId, className, compact }: ContactScoreBarProps) {
  const { score, isLoading } = useContactScore(contactId)

  if (isLoading || !score) return null

  const color = getScoreColor(score.buyer_score)
  const label = getScoreLabel(score.buyer_score)

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="h-1.5 w-16 rounded-full bg-theme-hover">
          <div className={cn('h-full rounded-full', score.buyer_score >= 60 ? 'bg-emerald-500' : score.buyer_score >= 40 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${score.buyer_score}%` }} />
        </div>
        <span className={cn('text-[10px] font-bold', color)}>{score.buyer_score}</span>
      </div>
    )
  }

  return (
    <div className={cn('rounded-xl border border-theme-border p-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-semibold text-theme-primary">Score comportemental</h4>
          <span className="text-[10px] text-theme-muted">estimation IA</span>
        </div>
        <span className={cn('text-lg font-bold', color)}>{score.buyer_score}<span className="text-xs text-theme-muted">/100</span></span>
      </div>

      {/* Score bar */}
      <div className="h-2 rounded-full bg-theme-hover mb-4">
        <div
          className={cn('h-full rounded-full transition-all', score.buyer_score >= 60 ? 'bg-emerald-500' : score.buyer_score >= 40 ? 'bg-amber-500' : 'bg-red-500')}
          style={{ width: `${score.buyer_score}%` }}
        />
      </div>

      {/* Dimensions */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <ScoreDimension label="Réactivité" score={score.reactivity_score} />
        <ScoreDimension label="Engagement" score={score.engagement_score} trend={score.engagement_trend} />
        <ScoreDimension label="Cohérence budget" score={score.budget_coherence_score} />
        <ScoreDimension label="Visites" score={score.visit_quality_score} />
      </div>

      {/* Conversion probability */}
      <div className="mt-3 pt-3 border-t border-theme-border flex items-center justify-between">
        <span className="text-xs text-theme-secondary">Probabilité de conversion</span>
        <span className={cn('text-xs font-bold', getScoreColor(score.conversion_probability))}>{score.conversion_probability}%</span>
      </div>

      {/* Estimated real budget */}
      {score.estimated_real_budget && score.estimated_real_budget > 0 && (
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-theme-secondary">Budget estimé réel</span>
          <span className="text-xs font-semibold text-theme-primary">{formatCHF(score.estimated_real_budget)}</span>
        </div>
      )}

      {/* Rejection patterns */}
      {score.rejection_patterns.length > 0 && (
        <div className="mt-3 pt-3 border-t border-theme-border">
          <p className="text-[10px] text-theme-muted mb-1.5">Objections détectées</p>
          <div className="flex flex-wrap gap-1">
            {score.rejection_patterns.map(pattern => (
              <span key={pattern} className="px-2 py-0.5 rounded text-[10px] text-red-500 border border-red-500/20">{pattern}</span>
            ))}
          </div>
        </div>
      )}

      {/* Label */}
      <p className="text-[10px] text-theme-muted mt-2 text-right capitalize">{label}</p>
    </div>
  )
}

function ScoreDimension({ label, score, trend }: { label: string; score: number; trend?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-theme-secondary">{label}</span>
      <div className="flex items-center gap-1">
        {trend === 'rising' && <span className="text-[10px] text-emerald-500">↑</span>}
        {trend === 'declining' && <span className="text-[10px] text-red-500">↓</span>}
        <span className={cn('text-[11px] font-semibold', getScoreColor(score))}>{score}</span>
      </div>
    </div>
  )
}
