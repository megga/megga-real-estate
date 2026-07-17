/**
 * Suivi d'onboarding des agences (section super-admin).
 *
 * Deux vues : un funnel agrégé (part des agences ayant franchi chaque étape) et
 * la liste des agences triée par complétion croissante — les plus à risque en
 * tête. Étapes et statut (active / at_risk / dormant) viennent de
 * `useOnboardingTracker`.
 */
import { useTranslation } from 'react-i18next'
import { cn, formatRelativeDate } from '@/lib/utils'
import { useOnboardingTracker } from '@/hooks/useOnboardingTracker'
import type { AgencyOnboarding } from '@/hooks/useOnboardingTracker'
import { Building2, Check } from 'lucide-react'

const STEP_LABEL_KEYS: { key: keyof AgencyOnboarding['steps']; i18nKey: string }[] = [
  { key: 'profile_completed', i18nKey: 'onboarding.step.registered' },
  { key: 'first_contact', i18nKey: 'onboarding.step.contact' },
  { key: 'first_property', i18nKey: 'onboarding.step.property' },
  { key: 'first_kyc', i18nKey: 'onboarding.step.kyc' },
  { key: 'first_transaction', i18nKey: 'onboarding.step.transaction' },
  { key: 'first_match', i18nKey: 'onboarding.step.match' },
]

const STATUS_CONFIG: Record<AgencyOnboarding['status'], { i18nKey: string; dotClass: string }> = {
  active: { i18nKey: 'onboarding.status.active', dotClass: 'bg-emerald-500' },
  at_risk: { i18nKey: 'onboarding.status.atRisk', dotClass: 'bg-amber-500' },
  dormant: { i18nKey: 'onboarding.status.dormant', dotClass: 'bg-red-500' },
}

/** Carte funnel + table des agences, chacune avec barre de progression, pastilles d'étapes et statut. */
export default function OnboardingTracker() {
  const { t } = useTranslation('admin')
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
        <h2 className="text-sm font-semibold text-theme-primary mb-4">{t('onboarding.title')}</h2>
        <div className="flex flex-col items-center py-8 text-center">
          <Building2 className="h-8 w-8 text-theme-muted mb-3" />
          <p className="text-sm text-theme-secondary">{t('onboarding.noAgencies')}</p>
        </div>
      </div>
    )
  }

  // Compute funnel counts
  const total = agencies.length
  const funnelSteps = STEP_LABEL_KEYS.map(step => {
    const count = agencies.filter(a => a.steps[step.key]).length
    return { ...step, count, pct: Math.round((count / total) * 100) }
  })

  // Sort agencies by completion ascending (most at risk first)
  const sorted = [...agencies].sort((a, b) => a.completion - b.completion)

  return (
    <div className="rounded-xl border border-theme-border p-5 space-y-6">
      <h2 className="text-sm font-semibold text-theme-primary">{t('onboarding.title')}</h2>

      {/* Funnel summary */}
      <div className="space-y-2">
        {funnelSteps.map((step) => (
          <div key={step.key} className="flex items-center gap-3">
            <span className="text-xs text-theme-secondary w-24 flex-shrink-0 text-right">{t(step.i18nKey)}</span>
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
              <th className="text-left text-xs font-medium text-theme-secondary pb-2 pr-4">{t('onboarding.table.agency')}</th>
              <th className="text-left text-xs font-medium text-theme-secondary pb-2 pr-4 w-36">{t('onboarding.table.progress')}</th>
              <th className="text-center text-xs font-medium text-theme-secondary pb-2 pr-4 w-40">{t('onboarding.table.steps')}</th>
              <th className="text-left text-xs font-medium text-theme-secondary pb-2 pr-4 w-24">{t('onboarding.table.status')}</th>
              <th className="text-right text-xs font-medium text-theme-secondary pb-2 w-28">{t('onboarding.table.lastActivity')}</th>
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
                      {STEP_LABEL_KEYS.map(step => {
                        const done = agency.steps[step.key]
                        return (
                          <div
                            key={step.key}
                            title={t(step.i18nKey)}
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
                      <span className="text-xs text-theme-secondary">{t(statusCfg.i18nKey)}</span>
                    </div>
                  </td>

                  {/* Last activity */}
                  <td className="py-2.5 text-right">
                    <span className="text-xs text-theme-muted">
                      {agency.last_activity ? formatRelativeDate(agency.last_activity) : t('onboarding.noActivity')}
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
