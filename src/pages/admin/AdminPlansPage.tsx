/**
 * Page super-admin — plans et abonnements.
 *
 * Route : `/plans` (console admin.megga.ch). Grille comparative des plans
 * (`PLANS`), tableau détaillé des fonctionnalités et gestion de l'abonnement par
 * agence (changement de plan écrit sur `agencies` via `admin_set_agency_plan`).
 *
 * Rendu en grammaire Sugar (kit `@/components/admin/kit`) : bentos séparés par
 * l'ombre, en-têtes de plan sans fond teinté (une pastille de ton suffit à
 * distinguer les trois offres), plan d'agence en pilule pleine, prix et
 * compteurs en chiffres tabulaires. Le repère violet « Admin MEGGA » a quitté la
 * page — il ne vit plus qu'une fois, dans le rail du shell.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CreditCard, Check, X, ChevronDown, Infinity as InfinityIcon } from 'lucide-react'
import { formatCHF } from '@/lib/utils'
import { PLANS } from '@/lib/plans'
import { useAdminAgencies } from '@/hooks/useAdminAgencies'
import { supabase } from '@/lib/supabase'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/Toast'
import { useAdminSugar } from '@/hooks/useAdminSugar'
import AdminPage from '@/components/admin/kit/AdminPage'
import {
  AdminCard,
  AdminDivider,
  AdminEmpty,
  AdminGhostBtn,
  AdminGroupTitle,
  AdminIc,
  AdminPill,
  AdminSkeleton,
  AdminTd,
  AdminTh,
} from '@/components/admin/kit/adminKit'
import { ADMIN_RADII, type AdminToneName } from '@/components/admin/kit/adminKitCore'

/**
 * Ton de pilule par plan.
 *
 * Le violet est exclu : il ne signale que « tu es dans la console », jamais une
 * offre commerciale. Starter n'a pas de signal, d'où `neutral`.
 */
const PLAN_TONE: Record<string, AdminToneName> = {
  starter: 'neutral',
  pro: 'info',
  entreprise: 'cyan',
}

/** Pilule du plan d'une agence ; libellé résolu depuis `PLANS`. */
function PlanBadge({ plan }: { plan: string }) {
  const normalized = (plan ?? 'starter').toLowerCase()
  const label = PLANS.find(p => p.id === normalized)?.name ?? plan
  return <AdminPill label={label} tone={PLAN_TONE[normalized] ?? 'neutral'} />
}

/** Menu de changement de plan d'une agence ; mutation directe sur `agencies.plan`. */
function PlanChangeDropdown({ currentPlan, agencyId }: { currentPlan: string; agencyId: string }) {
  const { t } = useTranslation('admin')
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const toast = useToast()
  const { sp, surf } = useAdminSugar()

  const changePlan = useMutation({
    mutationFn: async (newPlan: string) => {
      // La RPC upsert subscriptions avec p_status (défaut 'active') : on lit le
      // statut courant pour ne pas écraser un trialing/past_due existant.
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('agency_id', agencyId)
        .maybeSingle()
      const keepable = ['active', 'trialing', 'past_due', 'canceled']
      const { error } = await supabase.rpc('admin_set_agency_plan', {
        p_agency_id: agencyId,
        p_plan: newPlan,
        p_status: sub?.status && keepable.includes(sub.status) ? sub.status : 'active',
        p_note: 'via AdminPlansPage',
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success(t('plans.changeDone'))
      void queryClient.invalidateQueries({ queryKey: ['admin-agencies'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-agency-billing'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-billing-stripe'] })
      setOpen(false)
    },
    onError: () => toast.error(t('plans.changeError')),
  })

  const normalized = (currentPlan ?? 'starter').toLowerCase()

  return (
    <div style={{ position: 'relative' }}>
      <AdminGhostBtn onClick={() => setOpen(!open)} style={{ height: 30, padding: '0 13px', fontSize: 12 }}>
        {t('admin:plans.changePlan')}
        <AdminIc
          icon={ChevronDown}
          size={13}
          color={sp.sub}
          style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .18s ease' }}
        />
      </AdminGhostBtn>
      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 10 }}
            onClick={() => setOpen(false)}
            onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
          />
          <div
            role="listbox"
            style={{
              position: 'absolute', right: 0, top: '100%', marginTop: 5, zIndex: 20, minWidth: 152,
              background: surf.card, borderRadius: ADMIN_RADII.card, border: surf.hairline,
              boxShadow: sp.shadow, padding: 6,
            }}
          >
            {PLANS.map(plan => {
              const current = plan.id === normalized
              return (
                <button
                  key={plan.id}
                  // Le fond de repos est déclaré en INLINE (`transparent`) : aucune
                  // règle `:hover` de feuille de style ne peut le battre, sauf en
                  // `!important` — c'est ce que fait `.adm-row` (admin-console.css).
                  // Le plan courant en est exclu : il est désactivé et ne doit pas
                  // se signaler comme cliquable.
                  className={current ? undefined : 'adm-row'}
                  disabled={current || changePlan.isPending}
                  onClick={() => changePlan.mutate(plan.id)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '7px 12px', borderRadius: ADMIN_RADII.pill, border: 0, background: 'transparent',
                    fontFamily: 'inherit', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                    color: current ? sp.sub : sp.ink,
                    cursor: current ? 'default' : 'pointer',
                  }}
                >
                  {plan.name}
                  {current && <span style={{ marginLeft: 6, color: sp.sub }}>({t('admin:common.current')})</span>}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

/** Vue principale : grille de plans, tableau des fonctionnalités et liste des agences. */
export default function AdminPlansPage() {
  const { t } = useTranslation('admin')
  const { agencies, isLoading } = useAdminAgencies()
  const { sp, tones } = useAdminSugar()

  const featureKeys = PLANS[0].features.map(f => f.key)

  /** Couleur de la pastille d'en-tête d'un plan (même hiérarchie que `PLAN_TONE`). */
  const planDot = (id: string): string => {
    switch (PLAN_TONE[id]) {
      case 'info': return tones.info
      case 'cyan': return tones.cyan
      default: return sp.soft
    }
  }

  return (
    <AdminPage title={t('admin:plans.title')} subtitle={t('admin:plans.subtitle')} width="wide">
      {/* Plan comparison grid */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <AdminGroupTitle label={t('admin:plans.comparison')} tone="info" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {PLANS.map(plan => (
            <AdminCard key={plan.id} padding={0}>
              {/* Plan header */}
              <div style={{ padding: '16px 18px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ width: 8, height: 8, borderRadius: ADMIN_RADII.pill, background: planDot(plan.id), flexShrink: 0 }} />
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, letterSpacing: -0.3, color: sp.ink }}>{plan.name}</h3>
                </div>
                {plan.price_monthly === 0 ? (
                  <div style={{ marginTop: 8, fontSize: 20, fontWeight: 800, letterSpacing: -0.7, color: sp.ink }}>
                    {t('admin:plans.free')}
                  </div>
                ) : (
                  <div style={{ marginTop: 8 }}>
                    <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.7, color: sp.ink, fontVariantNumeric: 'tabular-nums' }}>
                      {formatCHF(plan.price_monthly)}
                    </span>
                    <span style={{ marginLeft: 4, fontSize: 11.5, color: sp.sub }}>{t('admin:plans.perMonth')}</span>
                    <div style={{ marginTop: 3, fontSize: 11, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
                      {t('admin:plans.annual', { price: formatCHF(plan.price_yearly) })}
                    </div>
                  </div>
                )}
              </div>

              <AdminDivider />

              {/* Features list */}
              <div style={{ padding: '13px 18px 16px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                {plan.features.map(feature => (
                  <div key={feature.key} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <AdminIc
                      icon={feature.included ? Check : X}
                      size={14}
                      color={feature.included ? tones.ok : tones.err}
                    />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: feature.included ? sp.ink : sp.sub }}>
                      {feature.label}
                    </span>
                    {feature.included && feature.limit !== undefined && (
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
                        {feature.limit}
                      </span>
                    )}
                    {feature.included && feature.limit === undefined && (
                      <AdminIc icon={InfinityIcon} size={13} color={sp.sub} />
                    )}
                  </div>
                ))}
              </div>
            </AdminCard>
          ))}
        </div>
      </section>

      {/* Feature comparison table (aligned rows) */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <AdminGroupTitle label={t('admin:plans.featureDetail')} tone="cyan" />
        <AdminCard padding={0} style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 540, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <AdminTh>{t('admin:plans.feature')}</AdminTh>
                  {PLANS.map(plan => (
                    <AdminTh key={plan.id} align="center" width={116}>{plan.name}</AdminTh>
                  ))}
                </tr>
              </thead>
              <tbody>
                {featureKeys.map(key => {
                  const label = PLANS[0].features.find(f => f.key === key)?.label ?? key
                  return (
                    <tr key={key}>
                      <AdminTd>{label}</AdminTd>
                      {PLANS.map(plan => {
                        const feature = plan.features.find(f => f.key === key)
                        return (
                          <AdminTd key={plan.id} align="center">
                            {!feature || !feature.included ? (
                              <AdminIc icon={X} size={14} color={tones.err} style={{ margin: '0 auto' }} />
                            ) : feature.limit !== undefined ? (
                              <span style={{ fontSize: 12, fontWeight: 700, color: sp.ink, fontVariantNumeric: 'tabular-nums' }}>
                                {feature.limit}
                              </span>
                            ) : (
                              <AdminIc icon={Check} size={14} color={tones.ok} style={{ margin: '0 auto' }} />
                            )}
                          </AdminTd>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </AdminCard>
      </section>

      {/* Agency plan management */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <AdminGroupTitle label={t('admin:plans.agencySubscriptions')} tone="ok" />
        {/* Pas de conteneur défilant ici : le menu « changer de plan » s'ouvre en
            absolu et serait rogné par un `overflow` sur la carte. */}
        <AdminCard padding={0}>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <AdminSkeleton key={i} height={38} />
              ))}
            </div>
          ) : agencies.length === 0 ? (
            <AdminEmpty icon={CreditCard} title={t('admin:plans.noAgency')} />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <AdminTh>{t('admin:plans.table.agency')}</AdminTh>
                  <AdminTh align="center" width={148}>{t('admin:plans.table.plan')}</AdminTh>
                  <AdminTh align="center" width={96}>{t('admin:plans.table.agents')}</AdminTh>
                  <AdminTh align="right" width={168}>{t('admin:plans.table.actions')}</AdminTh>
                </tr>
              </thead>
              <tbody>
                {agencies.map(agency => (
                  // `.adm-row` : le survol de ligne passe par la feuille de style
                  // (`!important`), les cellules gardant leurs fonds inline.
                  <tr key={agency.id} className="adm-row">
                    <AdminTd>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: sp.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {agency.name}
                      </div>
                      {agency.email && (
                        <div style={{ fontSize: 11, color: sp.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {agency.email}
                        </div>
                      )}
                    </AdminTd>
                    <AdminTd align="center">
                      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        <PlanBadge plan={agency.plan ?? 'starter'} />
                        {agency.subscription_status === 'trialing' && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: tones.info }}>{t('agencies.sub.trialing')}</span>
                        )}
                        {agency.subscription_status === 'past_due' && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: tones.err }}>{t('agencies.sub.pastDue')}</span>
                        )}
                      </div>
                    </AdminTd>
                    <AdminTd align="center" numeric style={{ color: sp.sub }}>{agency.agent_count}</AdminTd>
                    <AdminTd align="right">
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <PlanChangeDropdown currentPlan={agency.plan ?? 'starter'} agencyId={agency.id} />
                      </div>
                    </AdminTd>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </AdminCard>
      </section>
    </AdminPage>
  )
}
