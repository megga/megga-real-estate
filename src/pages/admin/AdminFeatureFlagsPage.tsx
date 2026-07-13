import { useMemo, useState } from 'react'
import { Check, ChevronDown, ToggleLeft, ToggleRight, X, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFeatureFlags, type FeatureFlag } from '@/hooks/useFeatureFlags'
import { useAdminAgencies } from '@/hooks/useAdminAgencies'
import { useTranslation } from 'react-i18next'

// Les plans réels de l'enum agency_plan — « agency » n'existe pas (un ciblage
// posé dessus ne matchait jamais, corrigé P5).
const PLAN_IDS = ['starter', 'pro', 'entreprise'] as const

function AgencyTargetPicker({ flag, agencies, disabled, onUpdate }: {
  flag: FeatureFlag
  agencies: { id: string; name: string }[]
  disabled: boolean
  onUpdate: (ids: string[]) => void
}) {
  const { t } = useTranslation('admin')
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return agencies
    return agencies.filter(a => a.name.toLowerCase().includes(q))
  }, [agencies, search])

  const toggleAgency = (id: string) => {
    const next = flag.enabled_agencies.includes(id)
      ? flag.enabled_agencies.filter(a => a !== id)
      : [...flag.enabled_agencies, id]
    onUpdate(next)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="h-7 px-2.5 rounded-lg text-xs font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors flex items-center gap-1.5"
      >
        {t('admin:featureFlags.targetAgency')}
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-theme-card border border-theme-border rounded-lg py-1 w-64" role="listbox">
            <div className="px-2 pb-1">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('admin:featureFlags.searchAgency')}
                className="w-full h-7 px-2 rounded-md bg-theme-hover text-xs text-theme-primary placeholder:text-theme-muted outline-none"
              />
            </div>
            <div className="max-h-56 overflow-y-auto scrollbar-hide">
              {filtered.length === 0 && (
                <p className="px-3 py-2 text-xs text-theme-muted">{t('admin:featureFlags.noAgencyFound')}</p>
              )}
              {filtered.map(a => {
                const active = flag.enabled_agencies.includes(a.id)
                return (
                  <button
                    key={a.id}
                    onClick={() => toggleAgency(a.id)}
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center justify-between gap-2',
                      active ? 'text-admin-accent' : 'text-theme-secondary hover:bg-theme-hover hover:text-theme-primary'
                    )}
                  >
                    <span className="truncate">{a.name}</span>
                    {active && <Check className="h-3 w-3 flex-shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function AdminFeatureFlagsPage() {
  const { flags, isLoading, updateFlag } = useFeatureFlags()
  const { agencies } = useAdminAgencies()
  const { t } = useTranslation('admin')

  const agencyById = useMemo(() => new Map(agencies.map(a => [a.id, a])), [agencies])

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
                  {PLAN_IDS.map(plan => {
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

              {/* Ciblage par agence (enabled_agencies — supporté par le hook depuis 20260518_001, UI ajoutée P5) */}
              {!flag.enabled_globally && (
                <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-theme-border-subtle">
                  <span className="text-xs text-theme-muted mr-1">{t('admin:featureFlags.agencies')}</span>
                  {flag.enabled_agencies.map(id => (
                    <span key={id} className="flex items-center gap-1 h-7 pl-2.5 pr-1.5 rounded-lg text-xs font-medium bg-admin-accent/10 text-admin-accent">
                      <span className="truncate max-w-[160px]">{agencyById.get(id)?.name ?? t('admin:featureFlags.unknownAgency')}</span>
                      <button
                        onClick={() => updateFlag.mutate({ id: flag.id, updates: { enabled_agencies: flag.enabled_agencies.filter(a => a !== id) } })}
                        aria-label={t('admin:featureFlags.removeAgency')}
                        className="p-0.5 rounded hover:bg-admin-accent/20"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <AgencyTargetPicker
                    flag={flag}
                    agencies={agencies}
                    disabled={updateFlag.isPending}
                    onUpdate={ids => updateFlag.mutate({ id: flag.id, updates: { enabled_agencies: ids } })}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
