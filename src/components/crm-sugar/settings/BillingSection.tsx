// MEGGA CRM — Settings Facturation (immersif vitrine, câblé Stripe).
//
// Design : crm-facturation-plans.html (module pricing vitrine Webflow) rendu en
// MODE IMMERSIF (le cadre entier des Réglages passe en noir #0B0C0E + dégradé bas,
// fourni par le shell). Ici : toggle Mensuel/Annuel « Deux mois offerts » + 3 cartes
// plans transparentes (Gratuit / Pro populaire / Custom), palette sombre FIXE
// (indépendante du thème app, comme la maquette). Reproduit le look vitrine en
// React — pas d'iframe ni de CSS vitrine embarqué (cf. handoff « recréer, pas embarquer »).
//
// Câblage réel PRÉSERVÉ (useSubscription → table subscriptions + Stripe webhook) :
//   - plan courant dérivé de currentPlan/isActive (starter→free, pro→pro, entreprise→custom) ;
//   - CTA plan courant / Gratuit → openPortal() (Stripe Customer Portal) ;
//   - CTA « Passer à Pro » → createCheckout(STRIPE_PRICES.pro.*) ;
//   - Custom → mailto:sales@megga.ch.
// Prix affichés = catalogue maquette (Gratuit 0 · Pro 49, annuel 41 « deux mois offerts »
//   · Custom sur devis) ; le portail Stripe reste la source de vérité du montant facturé.

import { useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/components/ui/Toast'
import { useSubscription } from '@/hooks/useSubscription'
import { STRIPE_PRICES } from '@/lib/constants'

const NUM: CSSProperties = { fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum" 1' }

// Palette sombre FIXE reprise de la vitrine (le module est toujours sombre).
const V = {
  brand: '#424bfb',
  head: '#FFFFFF',
  text: '#C7C8CE',
  mut: '#8A8B93',
  border: 'rgba(255,255,255,0.10)',
  sub: 'rgba(255,255,255,0.05)',
  onBrand: '#FFFFFF',
}

type PlanId = 'free' | 'pro' | 'custom'

interface PlanDef {
  id: PlanId
  icon: string
  nameKey: string
  taglineKey: string
  monthly: number | null
  featureKeys: string[]
  popular?: boolean
}

const PLANS: PlanDef[] = [
  {
    id: 'free', icon: '/billing/plan-free.png', nameKey: 'billing.plans.free.name', taglineKey: 'billing.plans.free.tagline', monthly: 0,
    featureKeys: ['billing.plans.free.features.properties', 'billing.plans.free.features.crm', 'billing.plans.free.features.aiSearch', 'billing.plans.free.features.emailSupport'],
  },
  {
    id: 'pro', icon: '/billing/plan-pro.png', nameKey: 'billing.plans.pro.name', taglineKey: 'billing.plans.pro.tagline', monthly: 49, popular: true,
    featureKeys: ['billing.plans.pro.features.unlimitedProperties', 'billing.plans.pro.features.fullCrm', 'billing.plans.pro.features.pipeline', 'billing.plans.pro.features.compliance', 'billing.plans.pro.features.docGeneration', 'billing.plans.pro.features.multichannel', 'billing.plans.pro.features.copilot', 'billing.plans.pro.features.prioritySupport'],
  },
  {
    id: 'custom', icon: '/billing/plan-custom.png', nameKey: 'billing.plans.custom.name', taglineKey: 'billing.plans.custom.tagline', monthly: null,
    featureKeys: ['billing.plans.custom.features.allPro', 'billing.plans.custom.features.multiAgency', 'billing.plans.custom.features.api', 'billing.plans.custom.features.sso', 'billing.plans.custom.features.branding', 'billing.plans.custom.features.accountManager', 'billing.plans.custom.features.sla'],
  },
]

function planIdFromDb(dbPlan: string): PlanId {
  if (dbPlan === 'pro') return 'pro'
  if (dbPlan === 'entreprise') return 'custom'
  return 'free'
}

function CheckDot({ pro }: { pro?: boolean }) {
  return (
    <span style={{ width: 18, height: 18, borderRadius: 999, flexShrink: 0, marginTop: 2, display: 'grid', placeItems: 'center', background: pro ? V.brand : 'rgba(255,255,255,0.10)' }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7" /></svg>
    </span>
  )
}

export function BillingSection() {
  const { subscription, isLoading, currentPlan, isActive, createCheckout, isCheckoutLoading, openPortal, isPortalLoading } = useSubscription()
  const { t } = useTranslation('settings')
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const toast = useToast()

  const currentPlanId: PlanId = isActive ? planIdFromDb(currentPlan) : 'free'

  const handlePortal = async () => {
    try { await openPortal() } catch (err) {
      toast.error(t('billing.failureWith', { message: err instanceof Error ? err.message : t('billing.unknownError') }))
    }
  }
  const handleUpgrade = async () => {
    const priceId = period === 'yearly' ? STRIPE_PRICES.pro.yearly : STRIPE_PRICES.pro.monthly
    if (!priceId) { toast.error(t('billing.stripeMissing')); return }
    try { await createCheckout(priceId) } catch (err) {
      toast.error(t('billing.failureWith', { message: err instanceof Error ? err.message : t('billing.unknownError') }))
    }
  }

  if (isLoading) {
    return <div style={{ padding: 48, color: V.mut, fontSize: 13, textAlign: 'center' }}>{t('billing.loading')}</div>
  }

  const renewal = isActive && subscription?.current_period_end
    ? (subscription.cancel_at_period_end
        ? t('billing.cancellationOn', { date: formatPeriodDate(subscription.current_period_end) })
        : t('billing.renewalOn', { date: formatPeriodDate(subscription.current_period_end) }))
    : null

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 28px 40px', fontFamily: '"Inter Tight", system-ui, sans-serif' }}>
      {/* Toggle Mensuel / Annuel (+ badge « Deux mois offerts ») */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: 5, borderRadius: 999, background: 'rgba(255,255,255,0.05)', boxShadow: `0 0 0 1px ${V.border} inset`, marginBottom: 30 }}>
        {([
          { id: 'monthly', label: t('billing.monthly'), badge: null },
          { id: 'yearly', label: t('billing.annual'), badge: t('billing.twoMonthsFree') },
        ] as const).map((tg) => {
          const on = period === tg.id
          return (
            <button key={tg.id} onClick={() => setPeriod(tg.id)} style={{
              height: 40, padding: '0 20px', border: 0, borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
              background: on ? '#181A20' : 'transparent', color: on ? V.head : V.mut, display: 'inline-flex', alignItems: 'center', gap: 9, transition: 'color .15s, background .15s',
            }}>
              {tg.label}
              {tg.badge && <span style={{ height: 22, padding: '0 9px', borderRadius: 999, background: V.brand, color: '#fff', fontSize: 11.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>{tg.badge}</span>}
            </button>
          )
        })}
      </div>

      {renewal && (
        <div style={{ marginBottom: 26, padding: '7px 16px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: V.text, ...NUM }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: '#22C55E' }} />
          {renewal}
        </div>
      )}

      {/* 3 cartes plans */}
      <div style={{ width: '100%', maxWidth: 1120, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, alignItems: 'stretch' }}>
        {PLANS.map((p) => (
          <PlanCard key={p.id} plan={p} period={period} isCurrent={p.id === currentPlanId}
            onPortal={handlePortal} onUpgrade={handleUpgrade} busy={isCheckoutLoading || isPortalLoading} />
        ))}
      </div>
    </div>
  )
}

interface PlanCardProps {
  plan: PlanDef
  period: 'monthly' | 'yearly'
  isCurrent: boolean
  onPortal: () => void
  onUpgrade: () => void
  busy: boolean
}

function PlanCard({ plan, period, isCurrent, onPortal, onUpgrade, busy }: PlanCardProps) {
  const { t } = useTranslation('settings')
  const pro = !!plan.popular

  // Prix affiché : annuel Pro = « deux mois offerts » ⇒ ~10 mois (monthly × 10/12).
  let priceBig: string
  let priceTail = ''
  if (plan.monthly === null) { priceBig = t('billing.onQuote'); priceTail = t('billing.perYourNeeds') }
  else if (plan.monthly === 0) { priceBig = t('billing.plans.free.name') }
  else {
    const m = period === 'yearly' ? Math.round(plan.monthly * 10 / 12) : plan.monthly
    priceBig = `CHF ${m}`; priceTail = t('billing.perPersonMonth')
  }

  return (
    <div style={{
      position: 'relative', display: 'flex', flexDirection: 'column', gap: 18, padding: '26px 24px 24px', borderRadius: 24,
      border: `1px solid ${pro ? 'rgba(66,75,251,0.55)' : V.border}`,
      background: pro ? 'linear-gradient(180deg, rgba(66,75,251,0.10) 0%, rgba(66,75,251,0.02) 40%, transparent 100%)' : 'rgba(255,255,255,0.02)',
    }}>
      {/* En-tête : icône + nom + tagline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src={plan.icon} alt="" width={44} height={44} style={{ flexShrink: 0, objectFit: 'contain' }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: V.head, letterSpacing: -0.4, lineHeight: 1.15 }}>{t(plan.nameKey)}</div>
          <div style={{ fontSize: 13.5, color: V.mut, fontWeight: 500, marginTop: 1 }}>{t(plan.taglineKey)}</div>
        </div>
      </div>

      {/* Prix */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', minHeight: 40 }}>
        <span style={{ fontSize: 34, fontWeight: 600, color: V.head, letterSpacing: -1, ...NUM }}>{priceBig}</span>
        {priceTail && <span style={{ fontSize: 13.5, color: V.mut, fontWeight: 500 }}>{priceTail}</span>}
      </div>

      <div style={{ height: 1, background: V.border }} />

      {/* Features */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: V.head, letterSpacing: 0.1 }}>{t('billing.whatsIncluded')}</div>
        {plan.featureKeys.map((fk) => (
          <div key={fk} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: V.text, fontWeight: 500, lineHeight: 1.4 }}>
            <CheckDot pro={pro} />{t(fk)}
          </div>
        ))}
      </div>

      {/* CTA */}
      {isCurrent ? (
        <button onClick={onPortal} disabled={busy} style={ctaStyle(pro ? 'brand' : 'ghost', busy)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={pro ? '#fff' : V.head} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 2 }}><path d="m5 12 5 5L20 7" /></svg>
          {t('billing.activeSubscription')}
        </button>
      ) : plan.id === 'pro' ? (
        <button onClick={onUpgrade} disabled={busy} style={ctaStyle('brand', busy)}>
          {busy ? t('billing.opening') : t('billing.switchTo', { plan: t(plan.nameKey) })}
        </button>
      ) : plan.id === 'custom' ? (
        <button onClick={() => { window.location.href = 'mailto:sales@megga.ch' }} style={ctaStyle('light', false)}>
          {t('billing.contactUs')}
        </button>
      ) : (
        <button onClick={onPortal} disabled={busy} style={ctaStyle('light', busy)}>
          {t('billing.chooseFree')}
        </button>
      )}
    </div>
  )
}

function ctaStyle(kind: 'brand' | 'light' | 'ghost', busy: boolean): CSSProperties {
  const base: CSSProperties = {
    height: 46, marginTop: 4, border: 0, borderRadius: 999, fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
    cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1, width: '100%',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, whiteSpace: 'nowrap',
  }
  if (kind === 'brand') return { ...base, background: V.brand, color: '#fff' }
  if (kind === 'light') return { ...base, background: '#FFFFFF', color: '#0B0C0E' }
  return { ...base, background: 'rgba(255,255,255,0.08)', color: V.head } // ghost (plan courant non-pro)
}

function formatPeriodDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' }) } catch { return iso }
}
