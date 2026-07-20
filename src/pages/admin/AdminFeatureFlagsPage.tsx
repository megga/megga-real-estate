/**
 * Page super-admin — feature flags.
 *
 * Route : `/dashboard/admin/feature-flags` (SuperAdminGuard, accent violet).
 * Chaque flag est activable globalement ou restreint à certains plans
 * (starter/pro/agency) ; les toggles écrivent directement via `useFeatureFlags`.
 */
import { ToggleLeft, ToggleRight } from 'lucide-react'
import { Flash3 as Zap } from '@/components/icons'
import { cn } from '@/lib/utils'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import { useTranslation } from 'react-i18next'

export default function AdminFeatureFlagsPage() {
  const { flags, isLoading, updateFlag } = useFeatureFlags()
  const { t } = useTranslation('admin')

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="h-2 w-2 rounded-full bg-admin-accent" />
          <span className="text-xs font-medium text-admin-accent">{t('admin:common.adminBadge')}</span>
        </div>
        <h1 className="text-2xl font-semibold text-theme-primary">{t('admin:featureFlags.title')}</h1>
        <p className="text-sm text-theme-tertiary mt-0.5">{t('admin:featureFlags.subtitle')}</p>
      </div>

      {/* Flags list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-theme-border p-5 animate-pulse">
              <div className="h-5 bg-theme-hover rounded w-48 mb-2" />
              <div className="h-3 bg-theme-hover rounded w-72" />
            </div>
          ))}
        </div>
      ) : flags.length === 0 ? (
        <div className="rounded-xl border border-theme-border p-12 text-center">
          <Zap className="h-8 w-8 text-theme-muted mx-auto mb-3" />
          <p className="text-sm text-theme-secondary">{t('admin:featureFlags.empty.title')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {flags.map(flag => (
            <div key={flag.id} className="rounded-xl border border-theme-border p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-theme-primary">{flag.label}</h3>
                    <span className="text-xs font-mono text-theme-muted bg-theme-hover px-1.5 py-0.5 rounded">
                      {flag.key}
                    </span>
                  </div>
                  <p className="text-xs text-theme-secondary">{flag.description}</p>

                  {/* Plan restrictions */}
                  {!flag.enabled_globally && flag.enabled_plans.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="text-xs text-theme-muted">{t('admin:featureFlags.plans')} :</span>
                      {flag.enabled_plans.map(plan => (
                        <span key={plan} className="text-xs font-medium text-admin-accent bg-admin-accent/10 px-1.5 py-0.5 rounded">
                          {t(`admin:common.plan.${plan}`)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Toggle */}
                <button
                  onClick={() => updateFlag.mutate({ id: flag.id, updates: { enabled_globally: !flag.enabled_globally } })}
                  aria-label={t('admin:featureFlags.toggle')}
                  className="flex-shrink-0 ml-4"
                >
                  {flag.enabled_globally ? (
                    <ToggleRight className="h-7 w-7 text-admin-accent" />
                  ) : (
                    <ToggleLeft className="h-7 w-7 text-theme-muted" />
                  )}
                </button>
              </div>

              {/* Plan pills (toggle per plan when not globally enabled) */}
              {!flag.enabled_globally && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-theme-border-subtle">
                  <span className="text-xs text-theme-muted mr-1">{t('admin:featureFlags.activeFor')}</span>
                  {['starter', 'pro', 'agency'].map(plan => {
                    const active = flag.enabled_plans.includes(plan)
                    return (
                      <button
                        key={plan}
                        onClick={() => {
                          const newPlans = active
                            ? flag.enabled_plans.filter(p => p !== plan)
                            : [...flag.enabled_plans, plan]
                          updateFlag.mutate({ id: flag.id, updates: { enabled_plans: newPlans } })
                        }}
                        className={cn(
                          'h-7 px-2.5 rounded-lg text-xs font-medium transition-colors',
                          active ? 'bg-admin-accent/10 text-admin-accent' : 'bg-theme-hover text-theme-muted hover:text-theme-primary'
                        )}
                      >
                        {t(`admin:common.plan.${plan}`)}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
