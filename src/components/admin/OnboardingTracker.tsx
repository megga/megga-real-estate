import { cn, formatRelativeDate } from '@/lib/utils'
import { useOnboardingTracker } from '@/hooks/useOnboardingTracker'
import type { AgencyOnboarding } from '@/hooks/useOnboardingTracker'
import { Building2, Check } from 'lucide-react'

const STEP_LABELS: { key: keyof AgencyOnboarding['steps']; label: string }[] = [
  { key: 'profile_completed', label: 'Inscrit' },
  { key: 'first_contact', label: 'Contact' },
  { key: 'first_property', label: 'Bien' },
  { key: 'first_kyc', label: 'KYC' },
  { key: 'first_transaction', label: 'Transaction' },
  { key: 'first_match', label: 'Match' },
]

const STATUS_CONFIG: Record<AgencyOnboarding['status'], { label: string; dotClass: string }> = {
  active: { label: 'Actif', dotClass: 'bg-emerald-500' },
  at_risk: { label: 'A risque', dotClass: 'bg-amber-500' },
  dormant: { label: 'Dormant', dotClass: 'bg-red-500' },
}

export default function OnboardingTracker() {
  const { data: agencies, isLoading } = useOnboardingTracker()

  if (isLoading) {
    return (
      <div className="rounded-xl border border-theme-border p-5">
        <div className="h-5 bg-theme-hover rounded w-48 mb-6 animate-pulse" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 bg-theme-hover rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!agencies?.length) {
    return (
      <div className="rounded-xl border border-theme-border p-5">
        <h2 className="text-sm font-semibold text-theme-primary mb-4">Activation des agences</h2>
        <div className="flex flex-col items-center py-8 text-center">
          <Building2 className="h-8 w-8 text-theme-muted mb-3" />
          <p className="text-sm text-theme-secondary">Aucune agence inscrite</p>
        </div>
      </div>
    )
  }

  // Compute funnel counts
  const total = agencies.length
  const funnelSteps = STEP_LABELS.map(step => {
    const count = agencies.filter(a => a.steps[step.key]).length
    return { ...step, count, pct: Math.round((count / total) * 100) }
  })

  // Sort agencies by completion ascending (most at risk first)
  const sorted = [...agencies].sort((a, b) => a.completion - b.completion)

  return (
    <div className="rounded-xl border border-theme-border p-5 space-y-6">
      <h2 className="text-sm font-semibold text-theme-primary">Activation des agences</h2>

      {/* Funnel summary */}
      <div className="space-y-2">
        {funnelSteps.map((step, i) => (
          <div key={step.key} className="flex items-center gap-3">
            <span className="text-xs text-theme-secondary w-24 flex-shrink-0 text-right">{step.label}</span>
            <div className="flex-1 h-6 rounded bg-theme-hover overflow-hidden relative">
              <div
                className="h-full rounded bg-admin-accent transition-all duration-500"
                style={{ width: `${step.pct}%` }}
              />
              <span className="absolute inset-0 flex items-center px-2 text-xs font-medium">
                <span className={cn(
                  step.pct > 40 ? 'text-white' : 'text-theme-primary',
                  'ml-1'
                )}>
                  {step.count}/{total}
                </span>
              </span>
            </div>
            <span className="text-xs text-theme-muted w-10 text-right">{step.pct}%</span>
          </div>
        ))}
      </div>

      {/* Agency list */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-theme-border">
              <th className="text-left text-xs font-medium text-theme-secondary pb-2 pr-4">Agence</th>
              <th className="text-left text-xs font-medium text-theme-secondary pb-2 pr-4 w-36">Progression</th>
              <th className="text-center text-xs font-medium text-theme-secondary pb-2 pr-4 w-40">Etapes</th>
              <th className="text-left text-xs font-medium text-theme-secondary pb-2 pr-4 w-24">Statut</th>
              <th className="text-right text-xs font-medium text-theme-secondary pb-2 w-28">Derniere activite</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(agency => {
              const statusCfg = STATUS_CONFIG[agency.status]
              return (
                <tr key={agency.agency_id} className="border-b border-theme-border/50 hover:bg-theme-hover/50 transition-colors">
                  {/* Agency name */}
                  <td className="py-2.5 pr-4">
                    <span className="text-sm text-theme-primary font-medium">{agency.agency_name}</span>
                  </td>

                  {/* Progress bar */}
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-theme-hover overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            agency.completion === 100 ? 'bg-emerald-500' : 'bg-admin-accent'
                          )}
                          style={{ width: `${agency.completion}%` }}
                        />
                      </div>
                      <span className="text-xs text-theme-muted w-8 text-right">{agency.completion}%</span>
                    </div>
                  </td>

                  {/* Step dots */}
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center justify-center gap-1.5">
                      {STEP_LABELS.map(step => {
                        const done = agency.steps[step.key]
                        return (
                          <div
                            key={step.key}
                            title={step.label}
                            className={cn(
                              'h-4 w-4 rounded-full flex items-center justify-center',
                              done ? 'bg-emerald-500' : 'bg-theme-hover'
                            )}
                          >
                            {done && <Check className="h-2.5 w-2.5 text-white" />}
                          </div>
                        )
                      })}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <span className={cn('w-2 h-2 rounded-full', statusCfg.dotClass)} />
                      <span className="text-xs text-theme-secondary">{statusCfg.label}</span>
                    </div>
                  </td>

                  {/* Last activity */}
                  <td className="py-2.5 text-right">
                    <span className="text-xs text-theme-muted">
                      {agency.last_activity ? formatRelativeDate(agency.last_activity) : 'Aucune'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
