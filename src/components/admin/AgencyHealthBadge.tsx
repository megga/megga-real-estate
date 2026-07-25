/** Pastille de santé d'agence : point coloré (vert/ambre/rouge) selon `level`, avec score optionnel. */
import { cn } from '@/lib/utils'

interface AgencyHealthBadgeProps {
  score: number
  level: 'healthy' | 'warning' | 'critical'
  showScore?: boolean
}

const LEVEL_COLORS = {
  healthy: 'bg-emerald-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
}

export default function AgencyHealthBadge({ score, level, showScore = true }: AgencyHealthBadgeProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('w-2 h-2 rounded-full', LEVEL_COLORS[level])} />
      {showScore && (
        <span className="text-xs text-theme-secondary font-medium">{score}</span>
      )}
    </div>
  )
}
