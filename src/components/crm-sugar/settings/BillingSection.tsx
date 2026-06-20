// MEGGA CRM Sugar « Sugar Pure » — Settings Facturation (wired Stripe).
//
// Maquette : crm-screen-settings-step4.jsx → SettingsBillingSection + PriceBento.
// Layout : (1) hero sombre fixe « Votre abonnement » + « Gérer dans Stripe »,
//          (2) toggle Mensuel / Annuel −20% (yearly = monthly×0.8, toujours /mois),
//          (3) grille 3 plans (Gratuit / Pro / Custom) avec features ✓.
//
// Câblage réel (useSubscription → table subscriptions + Stripe webhook sync) :
//   - plan courant dérivé de currentPlan/isActive (PAS un current:true mocké) ;
//     mapping plan DB → carte : starter→free, pro→pro, entreprise→custom.
//   - « Gérer dans Stripe » → openPortal() (Stripe Customer Portal).
//   - CTA upgrade payant → createCheckout(priceId) avec STRIPE_PRICES.* .
//   - Custom → mailto:sales@megga.ch (pas de self-serve).
//
// Prix d'affichage : repris EXACTEMENT de la maquette (Gratuit 0 · Pro 49 ·
// Custom sur devis). Le portail Stripe reste la source de vérité du montant réel
// facturé ; ici on affiche le tarif catalogue de la maquette.

import { useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/components/ui/Toast'
import { useSubscription } from '@/hooks/useSubscription'
import { STRIPE_PRICES } from '@/lib/constants'
import { SetIcon } from './atoms'
import { SET_PALETTE } from './data'

const SET = SET_PALETTE

const NUM: CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum" 1',
}

type PlanId = 'free' | 'pro' | 'custom'

interface PlanDef {
  id: PlanId
  /** Clé i18n du nom de plan (Gratuit / Pro reste un nom propre catalogue). */
  nameKey: string
  /** Tarif mensuel catalogue (maquette). null = sur devis. */
  monthly: number | null
  taglineKey: string
  featureKeys: string[]
  popular?: boolean
}

const PLANS: PlanDef[] = [
  {
    id: 'free',
    nameKey: 'settings.billing.plans.free.name',
    monthly: 0,
    taglineKey: 'settings.billing.plans.free.tagline',
    featureKeys: [
      'settings.billing.plans.free.features.properties',
      'settings.billing.plans.free.features.crm',
      'settings.billing.plans.free.features.aiSearch',
      'settings.billing.plans.free.features.sellerPortal',
      'settings.billing.plans.free.features.emailSupport',
    ],
  },
  {
    id: 'pro',
    nameKey: 'settings.billing.plans.pro.name',
    monthly: 49,
    taglineKey: 'settings.billing.plans.pro.tagline',
    featureKeys: [
      'settings.billing.plans.pro.features.unlimitedProperties',
      'settings.billing.plans.pro.features.fullCrm',
      'settings.billing.plans.pro.features.pipeline',
      'settings.billing.plans.pro.features.compliance',
      'settings.billing.plans.pro.features.docGeneration',
      'settings.billing.plans.pro.features.multichannel',
      'settings.billing.plans.pro.features.copilot',
      'settings.billing.plans.pro.features.prioritySupport',
    ],
    popular: true,
  },
  {
    id: 'custom',
    nameKey: 'settings.billing.plans.custom.name',
    monthly: null,
    taglineKey: 'settings.billing.plans.custom.tagline',
    featureKeys: [
      'settings.billing.plans.custom.features.allPro',
      'settings.billing.plans.custom.features.multiAgency',
      'settings.billing.plans.custom.features.api',
      'settings.billing.plans.custom.features.sso',
      'settings.billing.plans.custom.features.branding',
      'settings.billing.plans.custom.features.accountManager',
      'settings.billing.plans.custom.features.sla',
    ],
  },
]

/** Mappe le plan DB (useSubscription) vers la carte de la maquette. */
function planIdFromDb(dbPlan: string): PlanId {
  if (dbPlan === 'pro') return 'pro'
  if (dbPlan === 'entreprise') return 'custom'
  return 'free' // starter / inconnu
}

export function BillingSection() {
  const {
    subscription,
    isLoading,
    currentPlan,
    isActive,
    createCheckout,
    isCheckoutLoading,
    openPortal,
    isPortalLoading,
  } = useSubscription()
  const { t } = useTranslation('settings')
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null)
  const toast = useToast()

  // Plan courant réel : on retient le plan DB seulement s'il est actif,
  // sinon on retombe sur Gratuit (cohérent avec un compte sans abonnement).
  const currentPlanId: PlanId = isActive ? planIdFromDb(currentPlan) : 'free'
  const currentDef = PLANS.find((p) => p.id === currentPlanId) ?? PLANS[0]

  const handlePortal = async () => {
    try {
      await openPortal()
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('settings.billing.unknownError')
      toast.error(t('settings.billing.failureWith', { message: msg }))
    }
  }

  const handleUpgrade = async (planId: PlanId) => {
    // Seul Pro est self-serve payant (Custom = mailto, Gratuit = pas de checkout).
    if (planId !== 'pro') return
    const priceId =
      period === 'yearly' ? STRIPE_PRICES.pro.yearly : STRIPE_PRICES.pro.monthly
    if (!priceId) {
      toast.error(t('settings.billing.stripeMissing'))
      return
    }
    try {
      await createCheckout(priceId)
      // createCheckout redirige déjà via window.location.href
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('settings.billing.unknownError')
      toast.error(t('settings.billing.failureWith', { message: msg }))
    }
  }

  if (isLoading) {
    return (
      <div style={{ padding: 40, color: SET.muted, fontSize: 13 }}>
        {t('settings.billing.loading')}
      </div>
    )
  }

  // Prix mensuel affiché pour le hero (catalogue maquette).
  const heroMonthly = currentDef.monthly

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        paddingBottom: 24,
        animation: 'setFadeUp .35s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      {/* Plan actuel — hero sombre fixe (signature site, sombre dans les 2 thèmes) */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0B0C0E 0%, #1F2937 100%)',
          color: '#fff',
          borderRadius: 24,
          padding: 28,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(11,12,14,0.20)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 80% 120% at 82% 0%, rgba(255,255,255,0.10) 0%, transparent 58%)',
          }}
        />
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 24,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '1 1 280px' }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.55)',
                marginBottom: 10,
              }}
            >
              {t('settings.billing.yourSubscription')}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 14,
                flexWrap: 'wrap',
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 36,
                  fontWeight: 700,
                  letterSpacing: -0.6,
                }}
              >
                {t(currentDef.nameKey)}
              </h2>
              {heroMonthly !== null ? (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span
                    style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}
                  >
                    CHF
                  </span>
                  <span
                    style={{ fontSize: 34, fontWeight: 700, letterSpacing: -0.6, ...NUM }}
                  >
                    {heroMonthly}
                  </span>
                  <span
                    style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.55)' }}
                  >
                    {t('settings.billing.perMonth')}
                  </span>
                </div>
              ) : (
                <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.4 }}>
                  {t('settings.billing.onQuote')}
                </span>
              )}
            </div>

            {/* Renouvellement/annulation réel si la sub Stripe le fournit */}
            {isActive && subscription?.current_period_end && (
              <div
                style={{
                  marginTop: 14,
                  padding: '8px 14px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.10)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  ...NUM,
                }}
              >
                <span
                  style={{ width: 7, height: 7, borderRadius: 999, background: '#22C55E' }}
                />
                {subscription.cancel_at_period_end
                  ? t('settings.billing.cancellationOn', { date: formatPeriodDate(subscription.current_period_end) })
                  : t('settings.billing.renewalOn', { date: formatPeriodDate(subscription.current_period_end) })}
              </div>
            )}
          </div>

          <button
            onClick={handlePortal}
            disabled={isPortalLoading}
            style={{
              height: 44,
              padding: '0 22px',
              border: 0,
              borderRadius: 999,
              background: '#fff',
              color: '#0B0C0E',
              fontFamily: 'inherit',
              fontSize: 13.5,
              fontWeight: 700,
              cursor: isPortalLoading ? 'wait' : 'pointer',
              opacity: isPortalLoading ? 0.7 : 1,
              whiteSpace: 'nowrap',
              flexShrink: 0,
              boxShadow: '0 6px 18px rgba(0,0,0,0.20)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <SetIcon name="card" size={15} stroke="#0B0C0E" sw={2} />
            {isPortalLoading ? t('settings.billing.opening') : t('settings.billing.manageInStripe')}
          </button>
        </div>
      </div>

      {/* Changer de plan — bentos tarifaires */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: 18,
          }}
        >
          <div>
            <h3
              style={{
                margin: '0 0 4px',
                fontSize: 17,
                fontWeight: 700,
                color: SET.ink,
                letterSpacing: -0.3,
              }}
            >
              {t('settings.billing.changePlan')}
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: SET.muted, fontWeight: 500 }}>
              {t('settings.billing.changePlanHint')}
            </p>
          </div>
          <div
            style={{
              display: 'inline-flex',
              padding: 4,
              borderRadius: 999,
              background: SET.cardSubtle,
            }}
          >
            {([
              { id: 'monthly', labelKey: 'settings.billing.monthly' },
              { id: 'yearly', labelKey: 'settings.billing.yearlyDiscount' },
            ] as const).map((tg) => {
              const active = period === tg.id
              return (
                <button
                  key={tg.id}
                  onClick={() => setPeriod(tg.id)}
                  style={{
                    height: 34,
                    padding: '0 16px',
                    border: 0,
                    borderRadius: 999,
                    background: active ? SET.card : 'transparent',
                    color: active ? SET.ink : SET.inkSoft,
                    fontFamily: 'inherit',
                    fontSize: 12.5,
                    fontWeight: active ? 700 : 600,
                    cursor: 'pointer',
                    letterSpacing: -0.1,
                    boxShadow: active ? '0 4px 12px rgba(11,12,14,0.10)' : 'none',
                    transition: 'all .15s',
                  }}
                >
                  {t(tg.labelKey)}
                </button>
              )
            })}
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
          }}
        >
          {PLANS.map((p) => (
            <PriceBento
              key={p.id}
              plan={p}
              period={period}
              isCurrent={p.id === currentPlanId}
              selected={selectedPlan === p.id}
              onSelect={() => setSelectedPlan(p.id)}
              onUpgrade={() => handleUpgrade(p.id)}
              upgrading={isCheckoutLoading}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

interface PriceBentoProps {
  plan: PlanDef
  period: 'monthly' | 'yearly'
  isCurrent: boolean
  selected: boolean
  onSelect: () => void
  onUpgrade: () => void
  upgrading: boolean
}

function PriceBento({
  plan,
  period,
  isCurrent,
  selected,
  onSelect,
  onUpgrade,
  upgrading,
}: PriceBentoProps) {
  const { t } = useTranslation('settings')
  const isYearly = period === 'yearly' && plan.monthly !== null && plan.monthly > 0
  const price =
    plan.monthly === null
      ? null
      : isYearly
        ? Math.round(plan.monthly * 0.8)
        : plan.monthly
  const checkColor = selected ? SET.ink : SET.muted

  return (
    <div
      onClick={onSelect}
      style={{
        background: SET.card,
        borderRadius: 20,
        padding: '26px 24px 24px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        cursor: 'pointer',
        transition: 'box-shadow .2s cubic-bezier(.2,.8,.2,1)',
        boxShadow: selected
          ? `inset 0 0 0 2px ${SET.ink}, 0 16px 40px rgba(11,12,14,0.12)`
          : SET.shadow,
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: SET.ink, letterSpacing: -0.1 }}>
          {t(plan.nameKey)}
        </div>
        <div style={{ fontSize: 12.5, color: SET.muted, fontWeight: 500, marginTop: 3 }}>
          {t(plan.taglineKey)}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, minHeight: 44 }}>
        {price !== null ? (
          <>
            <span style={{ fontSize: 13, fontWeight: 600, color: SET.muted }}>CHF</span>
            <span
              style={{
                fontSize: 38,
                fontWeight: 700,
                color: SET.ink,
                letterSpacing: -0.8,
                ...NUM,
              }}
            >
              {price}
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: SET.muted }}>{t('settings.billing.perMonth')}</span>
          </>
        ) : (
          <span
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: SET.ink,
              letterSpacing: -0.4,
              whiteSpace: 'nowrap',
            }}
          >
            {t('settings.billing.onQuote')}
          </span>
        )}
      </div>
      <div style={{ height: 1, background: SET.line }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {plan.featureKeys.map((fk) => (
          <div
            key={fk}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 9,
              fontSize: 12.5,
              color: SET.inkSoft,
              fontWeight: 500,
              lineHeight: 1.45,
            }}
          >
            <span style={{ marginTop: 1, flexShrink: 0, display: 'inline-flex' }}>
              <SetIcon name="check" size={15} stroke={checkColor} sw={2.4} />
            </span>
            {t(fk)}
          </div>
        ))}
      </div>

      {isCurrent ? (
        <button
          disabled
          style={{
            height: 44,
            marginTop: 4,
            border: 0,
            borderRadius: 999,
            background: SET.cardSubtle,
            color: SET.muted,
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'default',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            whiteSpace: 'nowrap',
          }}
        >
          <SetIcon name="check" size={14} stroke={SET.muted} sw={2.6} />
          {t('settings.billing.currentPlan')}
        </button>
      ) : plan.id === 'custom' ? (
        <button
          onClick={(e) => {
            e.stopPropagation()
            window.location.href = 'mailto:sales@megga.ch'
          }}
          style={{
            height: 44,
            marginTop: 4,
            border: 0,
            borderRadius: 999,
            background: SET.cardSubtle,
            color: SET.ink,
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all .15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = SET.line
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = SET.cardSubtle
          }}
        >
          {t('settings.billing.contactUs')}
        </button>
      ) : plan.id === 'free' ? (
        // Downgrade vers Gratuit : pas de checkout Stripe — passe par le portail
        // (géré côté hero « Gérer dans Stripe »). Ici, bouton informatif désactivé.
        <button
          disabled
          style={{
            height: 44,
            marginTop: 4,
            border: 0,
            borderRadius: 999,
            background: SET.cardSubtle,
            color: SET.muted,
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'default',
            whiteSpace: 'nowrap',
          }}
        >
          {t('settings.billing.included')}
        </button>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (!upgrading) onUpgrade()
          }}
          disabled={upgrading}
          style={{
            height: 44,
            marginTop: 4,
            border: 0,
            borderRadius: 999,
            background: SET.black,
            color: SET.blackInk,
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 700,
            cursor: upgrading ? 'wait' : 'pointer',
            opacity: upgrading ? 0.7 : 1,
            boxShadow: '0 6px 16px rgba(11,12,14,0.18)',
            transition: 'all .15s',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
          onMouseEnter={(e) => {
            if (!upgrading) e.currentTarget.style.background = SET.blackHover
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = SET.black
          }}
        >
          {upgrading ? t('settings.billing.opening') : t('settings.billing.switchTo', { plan: t(plan.nameKey) })}
        </button>
      )}
    </div>
  )
}

/** Format date court FR pour le hero (renouvellement / annulation). */
function formatPeriodDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-CH', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}
