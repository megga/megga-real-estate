import { useTranslation } from 'react-i18next'
import { Lock } from 'lucide-react'
import { formatCHF } from '@/lib/utils'
import type { AgentProfileRow } from '@/hooks/useAgentDirectory'

interface AgentStatsPanelProps {
  agent: AgentProfileRow
}

export default function AgentStatsPanel({ agent }: AgentStatsPanelProps) {
  const { t } = useTranslation('directory')
  const isVerified = agent.status === 'verified'

  const stats = [
    { label: t('stats.propertiesSold'), value: String(agent.stats_properties_sold) },
    { label: t('stats.avgPrice'), value: formatCHF(agent.stats_avg_price) },
    { label: t('stats.avgDays'), value: t('stats.days', { count: agent.stats_avg_days_to_sell }) },
    { label: t('stats.responseRate'), value: `${Math.round(agent.stats_response_rate)}%` },
  ]

  return (
    <div className="rounded-xl border border-theme-border p-5">
      <h3 className="text-sm font-semibold text-theme-primary mb-4">{t('profile.stats')}</h3>

      {isVerified ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            {stats.map(s => (
              <div key={s.label}>
                <p className="text-lg font-bold text-theme-primary">{s.value}</p>
                <p className="text-xs text-theme-muted">{s.label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-theme-muted mt-4 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            {t('stats.verifiedLabel')}
          </p>
        </>
      ) : (
        <div className="relative">
          {/* Blurred stats */}
          <div className="grid grid-cols-2 gap-4 blur-sm select-none pointer-events-none">
            {stats.map(s => (
              <div key={s.label}>
                <p className="text-lg font-bold text-theme-primary">--</p>
                <p className="text-xs text-theme-muted">{s.label}</p>
              </div>
            ))}
          </div>
          {/* Overlay CTA */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Lock className="h-5 w-5 text-theme-muted mx-auto mb-2" />
              <p className="text-xs text-theme-secondary">{t('stats.blurredCTA')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
