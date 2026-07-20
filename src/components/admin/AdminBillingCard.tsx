// Carte billing d'une agence (P4 admin) — abonnement (policy
// super_admin_read_all_subscriptions), lien client Stripe, et override manuel
// de plan via la RPC admin_set_agency_plan (auditée subscription_changed).

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CreditCard } from 'lucide-react'
import { ExternalLink } from '@/components/icons'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast'

interface AgencySubscription {
  plan: string
  status: string
  billing_period: string | null
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean | null
  stripe_customer_id: string | null
}

function useAdminAgencyBilling(agencyId: string) {
  return useQuery({
    queryKey: ['admin-agency-billing', agencyId],
    enabled: !!agencyId,
    queryFn: async (): Promise<AgencySubscription | null> => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('plan, status, billing_period, current_period_start, current_period_end, cancel_at_period_end, stripe_customer_id')
        .eq('agency_id', agencyId)
        .maybeSingle()
      if (error) throw error
      return data
    },
    staleTime: 30_000,
  })
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return format(new Date(iso), 'dd.MM.yyyy')
  } catch {
    return iso
  }
}

const PLANS = ['starter', 'pro', 'entreprise'] as const
const STATUSES = ['active', 'trialing', 'past_due', 'canceled'] as const

export default function AdminBillingCard({ agencyId }: { agencyId: string }) {
  const { t } = useTranslation('admin')
  const toast = useToast()
  const queryClient = useQueryClient()
  const { data: sub, isLoading } = useAdminAgencyBilling(agencyId)

  const [editing, setEditing] = useState(false)
  const [plan, setPlan] = useState<string>('starter')
  const [status, setStatus] = useState<string>('active')
  const [note, setNote] = useState('')

  const setAgencyPlan = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('admin_set_agency_plan', {
        p_agency_id: agencyId,
        p_plan: plan,
        p_status: status,
        p_note: note || undefined,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success(t('agencyDetail.billing.overrideDone'))
      setEditing(false)
      void queryClient.invalidateQueries({ queryKey: ['admin-agency-billing', agencyId] })
      void queryClient.invalidateQueries({ queryKey: ['admin-agencies'] })
    },
    onError: () => toast.error(t('agencyDetail.billing.overrideError')),
  })

  const isManual = sub?.stripe_customer_id?.startsWith('manual_') ?? false

  return (
    <div className="rounded-xl border border-theme-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-theme-secondary" />
          <h3 className="text-sm font-semibold text-theme-primary">{t('agencyDetail.billing.title')}</h3>
        </div>
        <button
          onClick={() => {
            setPlan(sub?.plan ?? 'starter')
            setStatus(sub?.status && (STATUSES as readonly string[]).includes(sub.status) ? sub.status : 'active')
            setEditing((v) => !v)
          }}
          className="h-8 px-3 text-xs font-medium border border-theme-border text-theme-secondary rounded-lg hover:bg-theme-hover transition-colors"
        >
          {t('agencyDetail.billing.manualPlan')}
        </button>
      </div>

      {isLoading ? (
        <div className="h-10 bg-theme-hover rounded-lg animate-pulse" />
      ) : !sub ? (
        <p className="text-sm text-theme-muted">{t('agencyDetail.billing.none')}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <span className="font-medium text-theme-primary capitalize">{sub.plan}</span>
          <span className={cn('text-xs font-medium', sub.status === 'past_due' ? 'text-red-500' : sub.status === 'active' ? 'text-emerald-500' : 'text-theme-secondary')}>
            {t(`common.status.${sub.status === 'past_due' ? 'pending' : sub.status === 'canceled' ? 'closed' : 'active'}`, { defaultValue: sub.status })}
          </span>
          <span className="text-xs text-theme-tertiary">
            {fmtDate(sub.current_period_start)} → {fmtDate(sub.current_period_end)}
            {sub.cancel_at_period_end ? ` · ${t('agencyDetail.billing.cancelsAtEnd')}` : ''}
          </span>
          {isManual ? (
            <span className="text-xs text-theme-muted">{t('agencyDetail.billing.manual')}</span>
          ) : sub.stripe_customer_id ? (
            <a
              href={`https://dashboard.stripe.com/customers/${sub.stripe_customer_id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-theme-secondary underline underline-offset-2 hover:text-theme-primary"
            >
              Stripe
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          ) : null}
        </div>
      )}

      {editing && (
        <div className="mt-4 space-y-2 border-t border-theme-border-subtle pt-3">
          <p className="text-xs text-theme-muted">{t('agencyDetail.billing.overrideHint')}</p>
          <div className="flex flex-wrap gap-2">
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="h-8 px-2 text-xs bg-transparent border border-theme-border rounded-lg text-theme-primary"
            >
              {PLANS.map((p) => (
                <option key={p} value={p}>{t(`common.plan.${p}`)}</option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-8 px-2 text-xs bg-transparent border border-theme-border rounded-lg text-theme-primary"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('agencyDetail.billing.notePlaceholder')}
              className="h-8 flex-1 min-w-[140px] px-2 text-xs bg-transparent border border-theme-border rounded-lg text-theme-primary placeholder:text-theme-muted"
            />
            <button
              onClick={() => setAgencyPlan.mutate()}
              disabled={setAgencyPlan.isPending}
              className="h-8 px-3 text-xs font-medium border border-theme-border text-theme-secondary rounded-lg hover:bg-theme-hover transition-colors disabled:opacity-50"
            >
              {setAgencyPlan.isPending ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
