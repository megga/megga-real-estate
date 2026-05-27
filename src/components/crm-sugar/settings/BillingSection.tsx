// MEGGA CRM Sugar v2 — Settings Billing section (wired Stripe).
//
// Modèle simple : Découverte (gratuit, plan='starter') vs Pro (payant,
// plan='pro'). Source de vérité : useSubscription (table subscriptions
// + Stripe webhook sync).
//
// Actions câblées :
//   - "Passer à Pro" → invoke stripe-checkout (redirige vers Stripe Checkout)
//   - "Gérer ma facturation" → invoke stripe-portal (Customer Portal Stripe :
//     facturation, factures, méthodes paiement, annulation)
//
// Retirés (chip dédié)
//   - INVOICES hardcodées : Stripe Customer Portal les affiche déjà.
//   - USAGE bars mockées : besoin RPC count contacts/properties par plan.
//   - PlanChooserModal multi-tiers : 2 plans seulement (Découverte / Pro).
//   - Entreprise tier : pas exposé self-serve (contact commercial).

import { useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { useSubscription } from '@/hooks/useSubscription'
import { STRIPE_PRICES } from '@/lib/constants'
import {
  SectionHeader,
  SetBlackBtn,
  SetCard,
  SetGhostBtn,
  SetIcon,
} from './atoms'
import { SET_PALETTE } from './data'

const SET = SET_PALETTE

const PRO_PRICE_MONTHLY = 79
const PRO_PRICE_YEARLY = 65 // par mois, facturation annuelle

const PRO_FEATURES = [
  'Mandats, contacts & publications illimités',
  'MEGGA AI illimité — matching, parcours, rédaction',
  'KYC automatisé LBA / LSFin',
  'Skribble QES + DocuSign · reporting avancé',
  'Portail vendeur · sync Google/Outlook',
  'Support prioritaire',
]

const FREE_FEATURES = [
  '3 mandats actifs · 50 contacts',
  'Pipeline & vue Aujourd\'hui complète',
  '3 publications / mois · IA 10 sugg./mois',
  'Documents standards · KYC manuel',
]

function formatDate(iso: string | null): string {
  if (!iso) return '—'
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
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const toast = useToast()

  const isPro = currentPlan === 'pro' && isActive

  const handleUpgrade = async () => {
    const priceId =
      billing === 'yearly' ? STRIPE_PRICES.pro.yearly : STRIPE_PRICES.pro.monthly
    if (!priceId) {
      toast.error('Configuration Stripe manquante — contactez le support')
      return
    }
    try {
      await createCheckout(priceId)
      // createCheckout already calls window.location.href = url
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      toast.error(`Échec : ${msg}`)
    }
  }

  const handlePortal = async () => {
    try {
      await openPortal()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      toast.error(`Échec : ${msg}`)
    }
  }

  if (isLoading) {
    return (
      <div style={{ padding: 40, color: SET.muted, fontSize: 13 }}>
        Chargement de la facturation…
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        paddingBottom: 24,
        animation: 'setFadeUp .35s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <SectionHeader
        kicker="Facturation"
        title="Votre plan et vos paiements"
        sub={
          isPro
            ? 'Plan Pro actif. Vous pouvez changer ou annuler à tout moment via le portail Stripe.'
            : 'Démarrez gratuitement, passez à Pro quand vous êtes prêt.'
        }
      />

      {/* Hero card — plan actuel */}
      <div
        style={{
          background: isPro
            ? 'linear-gradient(135deg, #0B0C0E 0%, #1F2937 100%)'
            : SET.card,
          color: isPro ? '#fff' : SET.ink,
          borderRadius: 24,
          padding: 28,
          boxShadow: isPro ? '0 20px 60px rgba(11,12,14,0.20)' : SET.shadow,
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
              color: isPro ? 'rgba(255,255,255,0.65)' : SET.muted,
              marginBottom: 10,
            }}
          >
            Plan actuel
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
            <h2
              style={{
                margin: 0,
                fontSize: 36,
                fontWeight: 700,
                letterSpacing: -0.6,
                fontFamily: "Georgia, 'Times New Roman', serif",
              }}
            >
              {isPro ? 'Pro' : 'Découverte'}
            </h2>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: isPro ? 'rgba(255,255,255,0.65)' : SET.muted }}>
                CHF
              </span>
              <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: -0.6 }}>
                {isPro
                  ? (subscription?.billing_period === 'yearly' ? PRO_PRICE_YEARLY : PRO_PRICE_MONTHLY)
                  : '0'}
              </span>
              <span style={{ fontSize: 13, fontWeight: 500, color: isPro ? 'rgba(255,255,255,0.65)' : SET.muted }}>
                /mois{isPro && subscription?.billing_period === 'yearly' ? ' (facturé annuellement)' : ''}
              </span>
            </div>
          </div>

          {isPro && subscription?.current_period_end && (
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
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: 999, background: '#22C55E' }} />
              {subscription.cancel_at_period_end
                ? `Annulation prévue le ${formatDate(subscription.current_period_end)}`
                : `Renouvellement le ${formatDate(subscription.current_period_end)}`}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
          {isPro ? (
            <button
              onClick={handlePortal}
              disabled={isPortalLoading}
              style={{
                height: 44,
                padding: '0 22px',
                border: 0,
                borderRadius: 999,
                background: '#fff',
                color: SET.ink,
                fontFamily: 'inherit',
                fontSize: 13.5,
                fontWeight: 700,
                cursor: isPortalLoading ? 'wait' : 'pointer',
                opacity: isPortalLoading ? 0.7 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <SetIcon name="external" size={13} stroke={SET.ink} />
              {isPortalLoading ? 'Ouverture…' : 'Gérer ma facturation'}
            </button>
          ) : (
            <SetBlackBtn
              size="md"
              onClick={handleUpgrade}
              loading={isCheckoutLoading}
              icon={<SetIcon name="sparkle" size={13} stroke="#fff" sw={2.2} />}
            >
              Passer à Pro
            </SetBlackBtn>
          )}
        </div>
      </div>

      {/* Si Découverte : afficher comparatif + toggle billing */}
      {!isPro && (
        <SetCard
          title="Pro · libérez tout le potentiel"
          sub="Mandats illimités, MEGGA AI sans plafond, KYC automatisé, Skribble QES."
        >
          {/* Toggle billing */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
            <div
              style={{
                display: 'inline-flex',
                padding: 4,
                borderRadius: 999,
                background: SET.cardSubtle,
                boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.04)',
              }}
            >
              {(['monthly', 'yearly'] as const).map(b => {
                const active = billing === b
                return (
                  <button
                    key={b}
                    onClick={() => setBilling(b)}
                    style={{
                      height: 36,
                      padding: '0 18px',
                      borderRadius: 999,
                      border: 0,
                      background: active ? SET.black : 'transparent',
                      color: active ? '#fff' : SET.ink,
                      fontFamily: 'inherit',
                      fontSize: 13,
                      fontWeight: active ? 700 : 600,
                      cursor: 'pointer',
                      transition: 'all .18s ease',
                    }}
                  >
                    {b === 'monthly' ? 'Mensuel' : 'Annuel'}
                    {b === 'yearly' && (
                      <span style={{ marginLeft: 8, fontSize: 11, color: active ? '#fff' : SET.ok, fontWeight: 700 }}>
                        −2 mois
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Comparatif features */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: SET.muted,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  marginBottom: 12,
                }}
              >
                Votre plan actuel · Découverte
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {FREE_FEATURES.map(f => (
                  <li key={f} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <SetIcon name="check" size={14} stroke={SET.muted} sw={2.2} />
                    <span style={{ fontSize: 13, color: SET.inkSoft, lineHeight: 1.55 }}>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div
              style={{
                padding: '18px 20px',
                borderRadius: 16,
                background: SET.cardSubtle,
                boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.04)',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: SET.ink,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  marginBottom: 12,
                }}
              >
                Pro · CHF {billing === 'yearly' ? PRO_PRICE_YEARLY : PRO_PRICE_MONTHLY}/mois
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {PRO_FEATURES.map(f => (
                  <li key={f} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <SetIcon name="check" size={14} stroke={SET.ok} sw={2.4} />
                    <span style={{ fontSize: 13, color: SET.ink, fontWeight: 500, lineHeight: 1.55 }}>{f}</span>
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: 18 }}>
                <SetBlackBtn
                  onClick={handleUpgrade}
                  loading={isCheckoutLoading}
                  icon={<SetIcon name="sparkle" size={13} stroke="#fff" sw={2.2} />}
                >
                  Passer à Pro
                </SetBlackBtn>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 18,
              padding: '12px 16px',
              borderRadius: 12,
              background: `${SET.muted}10`,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <SetIcon name="info" size={14} stroke={SET.muted} sw={2.2} />
            <span style={{ fontSize: 12.5, color: SET.inkSoft, lineHeight: 1.55 }}>
              Paiement sécurisé via Stripe. Facturation immédiate, annulation à tout moment via le portail.
            </span>
          </div>
        </SetCard>
      )}

      {/* Si Pro : ouvre portail Stripe pour factures/méthodes paiement */}
      {isPro && (
        <SetCard
          title="Factures et méthodes de paiement"
          sub="Téléchargez vos factures, modifiez votre carte ou annulez votre abonnement via le portail sécurisé Stripe."
          action={
            <SetGhostBtn
              size="sm"
              onClick={handlePortal}
              disabled={isPortalLoading}
              icon={<SetIcon name="external" size={12} stroke={SET.inkSoft} />}
            >
              Ouvrir le portail
            </SetGhostBtn>
          }
        >
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 12,
              background: SET.cardSubtle,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <SetIcon name="receipt" size={16} stroke={SET.muted} />
            <span style={{ fontSize: 12.5, color: SET.inkSoft, lineHeight: 1.5 }}>
              Toutes vos factures sont disponibles dans le portail Stripe, conformes à la TVA suisse.
            </span>
          </div>
        </SetCard>
      )}
    </div>
  )
}
