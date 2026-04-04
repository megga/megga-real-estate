import { useState } from 'react'
import { CreditCard, Check, X, ChevronDown, Infinity } from 'lucide-react'
import { cn, formatCHF } from '@/lib/utils'
import { PLANS } from '@/lib/plans'
import { useAdminAgencies } from '@/hooks/useAdminAgencies'
import { supabase } from '@/lib/supabase'
import { useMutation, useQueryClient } from '@tanstack/react-query'

const PLAN_COLORS: Record<string, { header: string; badge: string }> = {
  starter: {
    header: 'bg-theme-hover text-theme-primary',
    badge: 'bg-theme-hover text-theme-secondary',
  },
  pro: {
    header: 'bg-blue-500/10 text-blue-600',
    badge: 'bg-blue-500/10 text-blue-600',
  },
  entreprise: {
    header: 'bg-violet-500/10 text-violet-600',
    badge: 'bg-violet-500/10 text-violet-600',
  },
}

function PlanBadge({ plan }: { plan: string }) {
  const normalized = (plan ?? 'starter').toLowerCase()
  const colors = PLAN_COLORS[normalized] ?? PLAN_COLORS.starter
  const label = PLANS.find(p => p.id === normalized)?.name ?? plan
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-md', colors.badge)}>
      {label}
    </span>
  )
}

function PlanChangeDropdown({ currentPlan, agencyId }: { currentPlan: string; agencyId: string }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const changePlan = useMutation({
    mutationFn: async (newPlan: string) => {
      const { error } = await supabase
        .from('agencies')
        .update({ plan: newPlan })
        .eq('id', agencyId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-agencies'] })
      setOpen(false)
    },
  })

  const normalized = (currentPlan ?? 'starter').toLowerCase()

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="h-8 px-3 rounded-lg text-xs font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors flex items-center gap-1.5"
      >
        Changer
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-theme-card border border-theme-border rounded-lg py-1 min-w-[140px]">
            {PLANS.map(plan => (
              <button
                key={plan.id}
                disabled={plan.id === normalized || changePlan.isPending}
                onClick={() => changePlan.mutate(plan.id)}
                className={cn(
                  'w-full text-left px-3 py-1.5 text-xs transition-colors',
                  plan.id === normalized
                    ? 'text-theme-muted cursor-default'
                    : 'text-theme-secondary hover:bg-theme-hover hover:text-theme-primary cursor-pointer'
                )}
              >
                {plan.name}
                {plan.id === normalized && (
                  <span className="ml-1.5 text-theme-muted">(actuel)</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function AdminPlansPage() {
  const { agencies, isLoading } = useAdminAgencies()

  const featureKeys = PLANS[0].features.map(f => f.key)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="h-2 w-2 rounded-full bg-admin-accent" />
          <span className="text-xs font-medium text-admin-accent">Admin MEGGA</span>
        </div>
        <h1 className="text-2xl font-semibold text-theme-primary">Plans & Quotas</h1>
        <p className="text-sm text-theme-tertiary mt-0.5">
          Configuration des plans et gestion des abonnements agences
        </p>
      </div>

      {/* Plan comparison grid */}
      <div>
        <h2 className="text-lg font-semibold text-theme-primary mb-4">Comparaison des plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map(plan => {
            const colors = PLAN_COLORS[plan.id] ?? PLAN_COLORS.starter
            return (
              <div key={plan.id} className="rounded-xl border border-theme-border overflow-hidden">
                {/* Plan header */}
                <div className={cn('px-5 py-4', colors.header)}>
                  <h3 className="text-base font-semibold">{plan.name}</h3>
                  <div className="mt-1">
                    {plan.price_monthly === 0 ? (
                      <span className="text-xl font-bold">Gratuit</span>
                    ) : (
                      <div>
                        <span className="text-xl font-bold">{formatCHF(plan.price_monthly)}</span>
                        <span className="text-xs opacity-70">/mois</span>
                        <div className="text-xs opacity-60 mt-0.5">
                          ou {formatCHF(plan.price_yearly)}/mois (annuel)
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Features list */}
                <div className="p-4 space-y-2.5">
                  {plan.features.map(feature => (
                    <div key={feature.key} className="flex items-center gap-2.5 text-sm">
                      {feature.included ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                      )}
                      <span className={cn(
                        'flex-1',
                        feature.included ? 'text-theme-primary' : 'text-theme-muted'
                      )}>
                        {feature.label}
                      </span>
                      {feature.included && feature.limit !== undefined && (
                        <span className="text-xs text-theme-tertiary font-mono">
                          {feature.limit}
                        </span>
                      )}
                      {feature.included && feature.limit === undefined && (
                        <Infinity className="h-3 w-3 text-theme-tertiary" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Feature comparison table (aligned rows) */}
      <div>
        <h2 className="text-lg font-semibold text-theme-primary mb-4">Detail par feature</h2>
        <div className="rounded-xl border border-theme-border overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-4 bg-theme-hover text-xs font-medium text-theme-secondary">
            <div className="px-4 py-3">Feature</div>
            {PLANS.map(plan => (
              <div key={plan.id} className="px-4 py-3 text-center">{plan.name}</div>
            ))}
          </div>

          {/* Table rows */}
          {featureKeys.map((key, i) => {
            const label = PLANS[0].features.find(f => f.key === key)?.label ?? key
            return (
              <div
                key={key}
                className={cn(
                  'grid grid-cols-4 text-sm',
                  i % 2 === 0 ? 'bg-theme-card' : 'bg-theme-page'
                )}
              >
                <div className="px-4 py-2.5 text-theme-primary">{label}</div>
                {PLANS.map(plan => {
                  const feature = plan.features.find(f => f.key === key)
                  return (
                    <div key={plan.id} className="px-4 py-2.5 text-center">
                      {!feature || !feature.included ? (
                        <X className="h-3.5 w-3.5 text-red-400 mx-auto" />
                      ) : feature.limit !== undefined ? (
                        <span className="text-xs font-mono text-theme-primary">{feature.limit}</span>
                      ) : (
                        <Check className="h-3.5 w-3.5 text-emerald-500 mx-auto" />
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Agency plan management */}
      <div>
        <h2 className="text-lg font-semibold text-theme-primary mb-4">Abonnements agences</h2>
        <div className="rounded-xl border border-theme-border overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_120px_100px_100px] bg-theme-hover text-xs font-medium text-theme-secondary">
            <div className="px-4 py-3">Agence</div>
            <div className="px-4 py-3 text-center">Plan</div>
            <div className="px-4 py-3 text-center">Agents</div>
            <div className="px-4 py-3 text-center">Actions</div>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="divide-y divide-theme-border">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="grid grid-cols-[1fr_120px_100px_100px] animate-pulse">
                  <div className="px-4 py-3">
                    <div className="h-4 bg-theme-hover rounded w-32" />
                  </div>
                  <div className="px-4 py-3 flex justify-center">
                    <div className="h-5 bg-theme-hover rounded w-16" />
                  </div>
                  <div className="px-4 py-3 flex justify-center">
                    <div className="h-4 bg-theme-hover rounded w-6" />
                  </div>
                  <div className="px-4 py-3 flex justify-center">
                    <div className="h-7 bg-theme-hover rounded w-20" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && agencies.length === 0 && (
            <div className="px-4 py-12 text-center">
              <CreditCard className="h-8 w-8 text-theme-muted mx-auto mb-3" />
              <p className="text-sm text-theme-secondary">Aucune agence enregistree</p>
            </div>
          )}

          {/* Agency rows */}
          {!isLoading && agencies.length > 0 && (
            <div className="divide-y divide-theme-border">
              {agencies.map(agency => (
                <div key={agency.id} className="grid grid-cols-[1fr_120px_100px_100px] items-center hover:bg-theme-hover transition-colors">
                  <div className="px-4 py-3">
                    <p className="text-sm font-medium text-theme-primary truncate">{agency.name}</p>
                    {agency.email && (
                      <p className="text-xs text-theme-tertiary truncate">{agency.email}</p>
                    )}
                  </div>
                  <div className="px-4 py-3 flex justify-center">
                    <PlanBadge plan={agency.plan ?? 'starter'} />
                  </div>
                  <div className="px-4 py-3 text-center">
                    <span className="text-sm text-theme-secondary">{agency.agent_count}</span>
                  </div>
                  <div className="px-4 py-3 flex justify-center">
                    <PlanChangeDropdown currentPlan={agency.plan ?? 'starter'} agencyId={agency.id} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
