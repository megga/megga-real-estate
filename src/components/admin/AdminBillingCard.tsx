// Carte billing d'une agence (P4 admin) — abonnement (policy
// super_admin_read_all_subscriptions), lien client Stripe, et override manuel
// de plan via la RPC admin_set_agency_plan (auditée subscription_changed).
//
// Grammaire Sugar : bento séparé par l'ombre, statut d'abonnement en pilule
// pleine (plus de `text-red-500` / `text-emerald-500`), dates et montants en
// chiffres tabulaires, champs du formulaire d'override sans bordure dessinée.

import { useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CreditCard, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast'
import { useAdminSugar } from '@/hooks/useAdminSugar'
import {
  AdminCard,
  AdminDivider,
  AdminEmpty,
  AdminGhostBtn,
  AdminIc,
  AdminPill,
  AdminSkeleton,
  AdminSolidBtn,
} from '@/components/admin/kit/adminKit'
import { ADMIN_RADII, type AdminToneName } from '@/components/admin/kit/adminKitCore'

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

/** Ton de pilule du statut d'abonnement ; `trialing`/`canceled` restent sans signal. */
const STATUS_TONE: Record<string, AdminToneName> = { active: 'ok', past_due: 'err' }

/** Bento « Abonnement » d'une agence : plan, statut, période, lien Stripe et override manuel. */
export default function AdminBillingCard({ agencyId }: { agencyId: string }) {
  const { t } = useTranslation('admin')
  const toast = useToast()
  const queryClient = useQueryClient()
  const { sp, surf, dark } = useAdminSugar()
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

  // Champs du formulaire d'override : surface enfoncée + liseré INTERNE, jamais
  // une bordure dessinée (elle rouvrirait le langage « boîte » que Sugar retire).
  const field: CSSProperties = {
    height: 34, padding: '0 12px', borderRadius: ADMIN_RADII.pill, border: 0, outline: 'none',
    fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
    background: surf.cardSub, color: sp.ink,
    boxShadow: `inset 0 0 0 1.5px ${dark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.07)'}`,
  }

  return (
    <AdminCard>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <AdminIc icon={CreditCard} size={16} color={sp.soft} />
        <h3 style={{ flex: 1, margin: 0, fontSize: 13, fontWeight: 800, letterSpacing: -0.2, color: sp.ink }}>
          {t('agencyDetail.billing.title')}
        </h3>
        <AdminGhostBtn
          onClick={() => {
            setPlan(sub?.plan ?? 'starter')
            setStatus(sub?.status && (STATUSES as readonly string[]).includes(sub.status) ? sub.status : 'active')
            setEditing((v) => !v)
          }}
        >
          {t('agencyDetail.billing.manualPlan')}
        </AdminGhostBtn>
      </div>

      {isLoading ? (
        <AdminSkeleton height={38} />
      ) : !sub ? (
        <AdminEmpty title={t('agencyDetail.billing.none')} />
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '7px 14px' }}>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.2, color: sp.ink, textTransform: 'capitalize' }}>
            {sub.plan}
          </span>
          <AdminPill
            label={t(`common.status.${sub.status === 'past_due' ? 'pending' : sub.status === 'canceled' ? 'closed' : 'active'}`, { defaultValue: sub.status })}
            tone={STATUS_TONE[sub.status] ?? 'neutral'}
          />
          <span style={{ fontSize: 11.5, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
            {fmtDate(sub.current_period_start)} → {fmtDate(sub.current_period_end)}
            {sub.cancel_at_period_end ? ` · ${t('agencyDetail.billing.cancelsAtEnd')}` : ''}
          </span>
          {isManual ? (
            <span style={{ fontSize: 11.5, color: sp.soft }}>{t('agencyDetail.billing.manual')}</span>
          ) : sub.stripe_customer_id ? (
            <a
              href={`https://dashboard.stripe.com/customers/${sub.stripe_customer_id}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 11.5, fontWeight: 700, color: sp.soft,
                textDecoration: 'underline', textUnderlineOffset: 2,
              }}
            >
              Stripe
              <AdminIc icon={ExternalLink} size={12} color={sp.soft} />
            </a>
          ) : null}
        </div>
      )}

      {editing && (
        <>
          {/* Un `::placeholder` ne s'exprime pas en style inline, et la console n'a
              pas de règle globale : sans cette ligne le champ retomberait sur la
              couleur par défaut du navigateur (gris foncé), illisible sur la
              surface sombre. Même procédé que `AgencyQuotaForm`. `sp.sub` reprend
              exactement la valeur de l'ancien `text-theme-muted`. */}
          <style>{`.abill-note::placeholder { color: ${sp.sub}; font-weight: 500; }`}</style>
          <AdminDivider margin="14px 0 12px" />
          <p style={{ margin: '0 0 10px', fontSize: 11.5, color: sp.sub, lineHeight: 1.45 }}>
            {t('agencyDetail.billing.overrideHint')}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <select value={plan} onChange={(e) => setPlan(e.target.value)} style={field}>
              {PLANS.map((p) => (
                <option key={p} value={p}>{t(`common.plan.${p}`)}</option>
              ))}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={field}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('agencyDetail.billing.notePlaceholder')}
              className="abill-note"
              style={{ ...field, flex: 1, minWidth: 140 }}
            />
            <AdminSolidBtn onClick={() => setAgencyPlan.mutate()} disabled={setAgencyPlan.isPending}>
              {setAgencyPlan.isPending ? t('common.loading') : t('common.save')}
            </AdminSolidBtn>
          </div>
        </>
      )}
    </AdminCard>
  )
}
