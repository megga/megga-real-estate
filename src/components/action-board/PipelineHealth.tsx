import { useState } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { usePipelineHealth, type PipelineAnomaly, type AnomalySeverity } from '@/hooks/usePipelineHealth'

const SEVERITY_STYLES: Record<AnomalySeverity, { dot: string; text: string; border: string }> = {
  critical: { dot: 'bg-red-500', text: 'text-red-500', border: 'border-l-red-500' },
  warning: { dot: 'bg-amber-500', text: 'text-amber-500', border: 'border-l-amber-500' },
  info: { dot: 'bg-blue-500', text: 'text-blue-500', border: 'border-l-blue-500' },
}

const HEALTH_COLORS: Record<string, string> = {
  excellent: 'text-emerald-500',
  good: 'text-emerald-500',
  attention: 'text-amber-500',
  critical: 'text-red-500',
}

function AnomalyRow({ anomaly }: { anomaly: PipelineAnomaly }) {
  const style = SEVERITY_STYLES[anomaly.severity]

  return (
    <Link
      to={anomaly.actionRoute}
      className={cn(
        'flex items-center gap-3 py-2.5 px-3 rounded-lg border-l-2 transition-colors hover:bg-theme-hover',
        style.border
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', style.dot)} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-theme-primary truncate">{anomaly.title}</p>
        <p className="text-[10px] text-theme-tertiary truncate">{anomaly.description}</p>
      </div>
      <span className="text-[10px] font-medium text-theme-secondary shrink-0">{anomaly.actionLabel}</span>
    </Link>
  )
}

export default function PipelineHealth() {
  const health = usePipelineHealth()
  const [expanded, setExpanded] = useState(false)

  if (health.anomalies.length === 0) return null

  const criticalCount = health.anomalies.filter(a => a.severity === 'critical').length
  const warningCount = health.anomalies.filter(a => a.severity === 'warning').length
  const shown = expanded ? health.anomalies : health.anomalies.slice(0, 5)

  return (
    <div className="rounded-xl border border-theme-border p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-theme-primary">Santé du pipeline</h3>
          <div className="flex items-center gap-1.5">
            <span className={cn(
              'text-xs font-bold',
              HEALTH_COLORS[health.label]
            )}>
              {health.score}/100
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="text-[10px] font-medium text-red-500">{criticalCount} critique{criticalCount > 1 ? 's' : ''}</span>
          )}
          {warningCount > 0 && (
            <span className="text-[10px] font-medium text-amber-500">{warningCount} attention</span>
          )}
        </div>
      </div>

      {/* Health bar */}
      <div className="h-1.5 rounded-full bg-theme-hover mb-4">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            health.score >= 80 ? 'bg-emerald-500' :
            health.score >= 60 ? 'bg-emerald-500' :
            health.score >= 40 ? 'bg-amber-500' : 'bg-red-500'
          )}
          style={{ width: `${health.score}%` }}
        />
      </div>

      {/* Anomalies list */}
      <div className="space-y-1">
        {shown.map(anomaly => (
          <AnomalyRow key={anomaly.id} anomaly={anomaly} />
        ))}
      </div>

      {/* Show more */}
      {health.anomalies.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-center text-[10px] font-medium text-theme-tertiary hover:text-theme-primary mt-2 py-1 transition-colors"
        >
          {expanded ? 'Voir moins' : `Voir les ${health.anomalies.length - 5} autres`}
        </button>
      )}
    </div>
  )
}
