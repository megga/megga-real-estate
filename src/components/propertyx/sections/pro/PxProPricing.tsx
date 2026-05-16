// MEGGA Pro — "Tarifs transparents" — 3 cards Starter / Pro / Entreprise.
// Data source : src/lib/plans.ts (single source of truth, alignée avec CRM).
// Pro card mise en avant : dark bg + badge "Recommandé" + élévation.

import { useState } from 'react'
import { PX, PxButton, PxBadge, PxFigmaIcon, PxIconFont } from '../..'
import { PLANS } from '@/lib/plans'
import { useProFadeIn } from './useProFadeIn'
import { useBreakpoint, isMobile, isDesktop } from './useBreakpoint'
import PxProBadge from './PxProBadge'

type Billing = 'monthly' | 'yearly'

function formatPrice(amount: number): string {
  if (amount === 0) return '0'
  return amount.toLocaleString('fr-CH').replace(/,/g, "'")
}

function PriceDisplay({
  amount,
  billing,
  invert,
}: {
  amount: number
  billing: Billing
  invert: boolean
}) {
  const primary = invert ? PX.inkInverse : PX.neutral700
  const muted = invert ? PX.inkInverseMuted : PX.neutral500

  if (amount === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{
          fontFamily: PX.font.display,
          fontSize: 72,
          fontWeight: 500,
          lineHeight: 1,
          letterSpacing: '-3px',
          color: primary,
        }}>
          Gratuit
        </span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span style={{
        fontFamily: PX.font.display,
        fontSize: 22,
        fontWeight: 500,
        letterSpacing: '-0.66px',
        color: muted,
        lineHeight: 1,
      }}>
        CHF
      </span>
      <span style={{
        fontFamily: PX.font.display,
        fontSize: 72,
        fontWeight: 500,
        lineHeight: 1,
        letterSpacing: '-3px',
        color: primary,
      }}>
        {formatPrice(amount)}
      </span>
      <span style={{
        fontFamily: PX.font.sans,
        fontSize: 14,
        fontWeight: 400,
        letterSpacing: '-0.42px',
        color: muted,
      }}>
        /{billing === 'monthly' ? 'mois' : 'mois (annuel)'}
      </span>
    </div>
  )
}

function FeatureLine({
  label,
  included,
  limit,
  invert,
}: {
  label: string
  included: boolean
  limit?: number
  invert: boolean
}) {
  const checkBg = invert ? PX.inkInverse : PX.neutral700
  const checkColor = invert ? PX.neutral700 : PX.neutral100
  const mutedBg = invert ? 'rgba(255,255,255,0.10)' : PX.neutral300
  const textColor = invert
    ? included ? PX.inkInverse : PX.inkInverseMuted
    : included ? PX.neutral700 : PX.neutral400
  const limitColor = invert ? PX.inkInverseMuted : PX.neutral500

  const limitLabel = limit !== undefined ? ` · jusqu'à ${limit}` : ''

  return (
    <li style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      padding: '8px 0',
    }}>
      <span style={{
        width: 20,
        height: 20,
        borderRadius: PX.radius.pill,
        background: included ? checkBg : mutedBg,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        marginTop: 2,
      }}>
        {included ? (
          <PxFigmaIcon name="check" size={11} color={checkColor} />
        ) : (
          <PxFigmaIcon name="close" size={9} color={invert ? PX.inkInverseMuted : PX.neutral400} />
        )}
      </span>
      <span style={{
        flex: 1,
        fontFamily: PX.font.sans,
        fontSize: 14,
        fontWeight: 400,
        lineHeight: 1.5,
        letterSpacing: '-0.42px',
        color: textColor,
        textDecoration: included ? 'none' : 'line-through',
        textDecorationColor: invert ? 'rgba(255,255,255,0.30)' : PX.neutral400,
      }}>
        {label}
        {limit !== undefined && included && (
          <span style={{ color: limitColor, fontWeight: 400 }}>
            {limitLabel}
          </span>
        )}
      </span>
    </li>
  )
}

function PricingCard({
  plan,
  billing,
  highlight,
  delay,
  mobile,
  desktop,
}: {
  plan: typeof PLANS[number]
  billing: Billing
  highlight: boolean
  delay: number
  mobile: boolean
  desktop: boolean
}) {
  const ref = useProFadeIn<HTMLDivElement>(delay)
  const price = billing === 'monthly' ? plan.price_monthly : plan.price_yearly

  const bg = highlight ? PX.inkBg : PX.neutral100
  const border = highlight
    ? `1px solid ${PX.inkBg}`
    : `1px solid ${PX.neutral300}`
  const titleColor = highlight ? PX.inkInverse : PX.neutral700
  const descColor = highlight ? PX.inkInverseSoft : PX.neutral500

  const description =
    plan.id === 'starter' ? 'Idéal pour démarrer.'
    : plan.id === 'pro' ? 'Pour les agents indépendants actifs.'
    : 'Pour les agences avec équipes.'

  return (
    <div
      ref={ref}
      style={{
        background: bg,
        border,
        borderRadius: PX.radius.large,
        padding: mobile ? 28 : 40,
        display: 'flex',
        flexDirection: 'column',
        gap: mobile ? 24 : 32,
        position: 'relative',
        transform: highlight && desktop ? 'translateY(-12px)' : 'translateY(0)',
        boxShadow: highlight ? PX.shadow.large : 'none',
        transition: `transform ${PX.duration.base} ${PX.ease}, box-shadow ${PX.duration.base} ${PX.ease}`,
      }}
    >
      {highlight && (
        <div style={{
          position: 'absolute',
          top: -14,
          left: 40,
        }}>
          <PxBadge variant="invert" size="sm">Recommandé</PxBadge>
        </div>
      )}

      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{
            fontFamily: PX.font.display,
            fontSize: 24,
            fontWeight: 500,
            letterSpacing: '-0.72px',
            color: titleColor,
          }}>
            {plan.name}
          </span>
        </div>
        <p style={{
          margin: 0,
          fontFamily: PX.font.sans,
          fontSize: 14,
          fontWeight: 400,
          lineHeight: 1.5,
          letterSpacing: '-0.42px',
          color: descColor,
        }}>
          {description}
        </p>
      </div>

      {/* Price */}
      <PriceDisplay amount={price} billing={billing} invert={highlight} />

      {/* CTA */}
      <PxButton
        variant={highlight ? 'invert' : 'primary'}
        size="lg"
        to="/register"
      >
        {plan.id === 'starter' ? 'Commencer gratuitement' : `Démarrer en ${plan.name}`}
      </PxButton>

      {/* Divider */}
      <div style={{
        height: 1,
        background: highlight ? 'rgba(255,255,255,0.12)' : PX.neutral300,
        margin: '0',
      }} />

      {/* Features */}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {plan.features.map(f => (
          <FeatureLine
            key={f.key}
            label={f.label}
            included={f.included}
            limit={f.limit}
            invert={highlight}
          />
        ))}
      </ul>
    </div>
  )
}

// ─── Billing toggle ───────────────────────────────────────────────────

function BillingToggle({
  billing,
  setBilling,
}: {
  billing: Billing
  setBilling: (b: Billing) => void
}) {
  return (
    <div style={{
      display: 'inline-flex',
      padding: 4,
      background: PX.neutral200,
      borderRadius: PX.radius.pill,
      gap: 4,
    }}>
      {([
        { value: 'monthly', label: 'Mensuel' },
        { value: 'yearly', label: 'Annuel · −20 %' },
      ] as const).map(opt => {
        const active = billing === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setBilling(opt.value)}
            style={{
              padding: '8px 16px',
              borderRadius: PX.radius.pill,
              border: 'none',
              background: active ? PX.neutral700 : 'transparent',
              color: active ? PX.neutral100 : PX.neutral500,
              fontFamily: PX.font.sans,
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: '-0.42px',
              cursor: 'pointer',
              transition: `background ${PX.duration.fast} ${PX.ease}, color ${PX.duration.fast} ${PX.ease}`,
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Main section ─────────────────────────────────────────────────────

export default function PxProPricing() {
  const [billing, setBilling] = useState<Billing>('monthly')
  const bp = useBreakpoint()
  const mobile = isMobile(bp)
  const desktop = isDesktop(bp)

  const labelRef = useProFadeIn<HTMLDivElement>(0)
  const titleRef = useProFadeIn<HTMLHeadingElement>(100)
  const subRef = useProFadeIn<HTMLParagraphElement>(180)
  const toggleRef = useProFadeIn<HTMLDivElement>(260)
  const noteRef = useProFadeIn<HTMLDivElement>(400)

  return (
    <section
      id="tarifs"
      style={{
        paddingTop: mobile ? 80 : 120,
        paddingBottom: mobile ? 60 : 120,
        paddingLeft: mobile ? 16 : 24,
        paddingRight: mobile ? 16 : 24,
        background: PX.pageBg,
        scrollMarginTop: 24,
      }}
    >
      <div style={{
        maxWidth: 1280,
        margin: '0 auto',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: mobile ? 16 : 20,
          marginBottom: mobile ? 40 : 56,
          textAlign: 'center',
        }}>
          <div ref={labelRef}>
            <PxProBadge icon="currency">Tarifs</PxProBadge>
          </div>
          <h2
            ref={titleRef}
            style={{
              margin: 0,
              fontFamily: PX.font.display,
              fontSize: mobile ? 32 : 48,
              fontWeight: 500,
              lineHeight: 1.2,
              letterSpacing: mobile ? '-1.28px' : '-1.44px',
              color: PX.neutral700,
              maxWidth: 720,
            }}
          >
            Une formule pour chaque agence.
          </h2>
          <p
            ref={subRef}
            style={{
              margin: 0,
              fontFamily: PX.font.sans,
              fontSize: 18,
              fontWeight: 400,
              lineHeight: 1.5,
              letterSpacing: '-0.54px',
              color: PX.neutral500,
              maxWidth: 580,
            }}
          >
            Sans engagement. Annulation en 1 clic. Tarifs en cours de finalisation.
          </p>
          <div ref={toggleRef} style={{ marginTop: 16 }}>
            <BillingToggle billing={billing} setBilling={setBilling} />
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: mobile ? '1fr' : desktop ? 'repeat(3, 1fr)' : '1fr',
          gap: mobile ? 16 : 24,
          alignItems: mobile ? 'stretch' : 'start',
          maxWidth: mobile ? 480 : 'none',
          marginLeft: 'auto',
          marginRight: 'auto',
        }}>
          {PLANS.map((plan, i) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              billing={billing}
              highlight={plan.id === 'pro'}
              delay={i * 100}
              mobile={mobile}
              desktop={desktop}
            />
          ))}
        </div>

        <div
          ref={noteRef}
          style={{
            marginTop: mobile ? 40 : 56,
            textAlign: 'center',
            display: 'flex',
            justifyContent: 'center',
            gap: 32,
            flexWrap: 'wrap',
          }}
        >
          {([
            { icon: 'shield' as const, label: 'Conforme LPD suisse' },
            { icon: 'rotate' as const, label: 'Migration assistée gratuite' },
            { icon: 'message' as const, label: 'Support en français' },
          ]).map(item => (
            <div key={item.label} style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: PX.font.sans,
              fontSize: 14,
              fontWeight: 500,
              color: PX.neutral500,
              letterSpacing: '-0.42px',
            }}>
              <PxIconFont
                name={item.icon}
                size={16}
                color={PX.neutral500}
              />
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
