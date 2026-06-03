// MEGGA Onboarding — Étape Forfait
// Source : handoff-onboarding/onboarding/megga-onboarding-step-forfait.jsx
// Direction A — Specimen typographique : 2 plans en miroir, séparés par une
// hairline. Plus de cards arrondies/ombrées, plus de star ⭐ "Recommandé".
// Pro se distingue uniquement par un tiny eyebrow + features asymétriques.
import { useState, type ReactNode } from 'react'
import { obPalette } from './tokens'
import type { Billing, OnboardingData, Plan, Setter } from './types'
import MEIcon from '@/components/propertyx/MEIcon'

// ─── Toggle monthly / yearly ─────────────────────────────────────────

function ObBillingToggle({
  value, onChange, dark,
}: {
  value: Billing
  onChange: (v: Billing) => void
  dark?: boolean
}) {
  const t = obPalette(dark)
  const isYearly = value === 'yearly'
  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        animation: 'obFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <div
        role="tablist"
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          padding: 4,
          borderRadius: 999,
          background: t.cardSubtle,
          boxShadow: `inset 0 1px 2px ${dark ? 'rgba(0,0,0,0.25)' : 'rgba(11,12,14,0.04)'}`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 4,
            bottom: 4,
            left: isYearly ? '50%' : 4,
            width: 'calc(50% - 4px)',
            background: t.black,
            borderRadius: 999,
            boxShadow: '0 4px 12px rgba(11,12,14,0.20)',
            transition: 'left .32s cubic-bezier(.2,.8,.2,1)',
            zIndex: 0,
          }}
        />
        {(['monthly', 'yearly'] as Billing[]).map((opt) => {
          const active = value === opt
          return (
            <button
              key={opt}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(opt)}
              style={{
                position: 'relative',
                zIndex: 1,
                minWidth: 116,
                height: 36,
                padding: '0 18px',
                background: 'transparent',
                border: 0,
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: 0.1,
                color: active ? (dark ? '#0B0C0E' : '#FFFFFF') : t.inkSoft,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'color .2s ease',
              }}
            >
              {opt === 'monthly' ? 'Mensuel' : 'Annuel'}
            </button>
          )
        })}
      </div>

      <span
        style={{
          position: 'absolute',
          left: 'calc(100% + 12px)',
          top: '50%',
          transform: isYearly
            ? 'translateY(-50%) translateX(0)'
            : 'translateY(-50%) translateX(-6px)',
          fontSize: 11.5,
          fontWeight: 700,
          color: t.ink,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          padding: '5px 10px',
          borderRadius: 999,
          background: t.card,
          boxShadow: t.shadowSm,
          opacity: isYearly ? 1 : 0,
          transition: 'all .3s cubic-bezier(.2,.8,.2,1)',
          pointerEvents: isYearly ? 'auto' : 'none',
          whiteSpace: 'nowrap',
        }}
      >
        − 2 mois offerts
      </span>
    </div>
  )
}

// ─── Plan card (Direction B — Polish hybrid PX) ──────────────────────
// Cards comme containers visuels (chunking), mais nettoyées :
// - 4 features max (vs 7 avant)
// - MEIcon partout (no SVG inline)
// - Pas de star ⭐ "Recommandé" → eyebrow discret
// - Prix 40px (vs 56px) — moins agressif
// - Border 1px hybrid PX sur Free, Pro garde son surface ink
// - Tick pastille typographique → micro MEIcon check

function ObPlanCard({
  variant, selected, onSelect, billing, dark,
}: {
  variant: 'free' | 'pro'
  selected: boolean
  onSelect: () => void
  billing: Billing
  dark?: boolean
}) {
  const t = obPalette(dark)
  const [h, setH] = useState(false)
  const isPro = variant === 'pro'

  const priceMonth = isPro ? (billing === 'yearly' ? 65 : 79) : null
  const annualSave = 158

  // Surfaces — Free clair avec border, Pro accent ink
  const surface = isPro ? t.black : t.card
  const ink = isPro ? (dark ? '#0B0C0E' : '#FFFFFF') : t.ink
  const inkSoft = isPro
    ? dark
      ? 'rgba(11,12,14,0.72)'
      : 'rgba(255,255,255,0.82)'
    : t.inkSoft
  const muted = isPro
    ? dark
      ? 'rgba(11,12,14,0.52)'
      : 'rgba(255,255,255,0.58)'
    : t.muted
  const dividerColor = isPro
    ? dark
      ? 'rgba(11,12,14,0.12)'
      : 'rgba(255,255,255,0.14)'
    : t.divider
  const tickBg = isPro
    ? dark
      ? 'rgba(11,12,14,0.10)'
      : 'rgba(255,255,255,0.14)'
    : t.cardSubtle

  // Border + shadow — hybrid PX (Free a une fine ligne, Pro garde son volume)
  const border = isPro ? 'none' : `1px solid ${t.cardBorder}`
  const baseShadow = isPro ? t.shadowLg : t.shadow
  const hoverShadow = t.shadowHov
  const ringColor = isPro ? (dark ? '#0B0C0E' : '#FFFFFF') : t.ink
  const finalShadow = selected
    ? `${hoverShadow}, 0 0 0 2px ${ringColor} inset`
    : h
      ? hoverShadow
      : baseShadow

  const features: Array<ReactNode> = isPro
    ? [
        <>Mandats, contacts & publications <strong>illimités</strong></>,
        <>MEGGA AI illimité — matching, parcours, rédaction</>,
        <>KYC automatisé <strong>LBA / LSFin</strong></>,
        <>Skribble QES + DocuSign · reporting avancé</>,
      ]
    : [
        <><strong>3 mandats</strong> actifs · <strong>50 contacts</strong></>,
        <>Pipeline & vue aujourd'hui complète</>,
        <>3 publications / mois · IA 10 sugg./mois</>,
        <>Documents standards · KYC manuel</>,
      ]

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        position: 'relative',
        padding: '32px 28px 28px',
        background: surface,
        border,
        borderRadius: 24,
        boxShadow: finalShadow,
        transform: h ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'all .25s cubic-bezier(.2,.8,.2,1)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        animation: 'obFadeUp .55s cubic-bezier(.2,.8,.2,1) both',
        animationDelay: isPro ? '0.12s' : '0.06s',
      }}
    >
      {/* Name + tagline */}
      <h2
        style={{
          margin: 0,
          fontFamily:
            '"Objectivity", "Plus Jakarta Sans", system-ui, sans-serif',
          fontSize: 28,
          fontWeight: 700,
          color: ink,
          letterSpacing: '-0.025em',
          lineHeight: 1.05,
        }}
      >
        {isPro ? 'Pro' : 'Découverte'}
      </h2>
      <p
        style={{
          margin: '10px 0 0',
          fontSize: 13.5,
          fontWeight: 500,
          color: inkSoft,
          lineHeight: 1.5,
        }}
      >
        {isPro
          ? "L'outil de production pour boucler des mandats au quotidien."
          : 'Pour boucler votre premier mandat avec MEGGA.'}
      </p>

      {/* Prix */}
      <div
        style={{
          marginTop: 24,
          paddingBottom: 22,
          borderBottom: `1px solid ${dividerColor}`,
        }}
      >
        {isPro ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
              <span
                style={{
                  fontFamily:
                    '"Objectivity", "Plus Jakarta Sans", system-ui, sans-serif',
                  fontSize: 40,
                  fontWeight: 700,
                  color: ink,
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                CHF {priceMonth}
              </span>
              <span style={{ fontSize: 13, fontWeight: 500, color: muted }}>
                / mois
              </span>
            </div>
            <div
              style={{
                marginTop: 7,
                fontSize: 12,
                color: muted,
                fontWeight: 500,
              }}
            >
              {billing === 'yearly'
                ? `Facturé annuellement · économie CHF ${annualSave}`
                : 'Sans engagement'}
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                fontFamily:
                  '"Objectivity", "Plus Jakarta Sans", system-ui, sans-serif',
                fontSize: 40,
                fontWeight: 700,
                color: ink,
                letterSpacing: '-0.03em',
                lineHeight: 1,
              }}
            >
              Gratuit
            </div>
            <div
              style={{
                marginTop: 7,
                fontSize: 12,
                color: muted,
                fontWeight: 500,
              }}
            >
              Pour toujours
            </div>
          </>
        )}
      </div>

      {/* Features — 4 max avec tick pastille MEIcon */}
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: '22px 0 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          flex: 1,
        }}
      >
        {features.map((feature, i) => (
          <li
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              fontSize: 13,
              fontWeight: 500,
              color: inkSoft,
              lineHeight: 1.5,
              letterSpacing: '-0.005em',
            }}
          >
            <span
              style={{
                flexShrink: 0,
                marginTop: 2,
                width: 18,
                height: 18,
                borderRadius: 999,
                background: tickBg,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <MEIcon
                name="check"
                size={10}
                strokeWidth={2.4}
                color={ink}
              />
            </span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA — bouton plein, plus discret que l'ancien */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
        style={{
          marginTop: 24,
          width: '100%',
          height: 44,
          borderRadius: 999,
          border: 0,
          background: isPro
            ? dark
              ? '#0B0C0E'
              : '#FFFFFF'
            : t.ink,
          color: isPro
            ? dark
              ? '#ECEDF3'
              : '#0B0C0E'
            : dark
              ? '#0B0C0E'
              : '#FFFFFF',
          fontFamily: 'inherit',
          fontSize: 13.5,
          fontWeight: 700,
          letterSpacing: '-0.005em',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          transition: 'all .18s ease',
        }}
      >
        {selected ? (
          <>
            <MEIcon
              name="check"
              size={14}
              strokeWidth={2.4}
              color={
                isPro ? (dark ? '#ECEDF3' : '#0B0C0E') : dark ? '#0B0C0E' : '#FFFFFF'
              }
            />
            Sélectionné
          </>
        ) : (
          <>
            {isPro ? 'Choisir Pro' : 'Continuer en Découverte'}
            <MEIcon
              name="arrow-right"
              size={13}
              strokeWidth={1.9}
              color={
                isPro ? (dark ? '#ECEDF3' : '#0B0C0E') : dark ? '#0B0C0E' : '#FFFFFF'
              }
            />
          </>
        )}
      </button>
    </div>
  )
}

// ─── Step ────────────────────────────────────────────────────────────

export function StepForfait({
  data, set, dark,
}: {
  data: OnboardingData
  set: Setter
  dark?: boolean
}) {
  const t = obPalette(dark)
  const billing = data.billing
  const plan = data.plan

  const setBilling = (b: Billing) => set({ billing: b })
  const choose = (p: NonNullable<Plan>) => set({ plan: p })

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', paddingTop: 4 }}>
      {/* Hero monumental éditorial — composition centrée comme Step 1 KYC */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: 56,
          animation: 'obFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily:
              '"Objectivity", "Plus Jakarta Sans", system-ui, sans-serif',
            fontSize: 72,
            fontWeight: 700,
            color: t.ink,
            letterSpacing: '-0.04em',
            lineHeight: 0.95,
            textTransform: 'uppercase',
          }}
        >
          Votre rythme.
        </h1>

        {/* Sous-titre — titre secondaire sous le H1 */}
        <h2
          style={{
            margin: '24px 0 0',
            fontFamily:
              '"Objectivity", "Plus Jakarta Sans", system-ui, sans-serif',
            fontSize: 24,
            fontWeight: 500,
            color: t.inkSoft,
            letterSpacing: '-0.02em',
            lineHeight: 1.3,
          }}
        >
          Démarrez gratuitement.
          <br />
          Passez à Pro quand l'activité décolle.
        </h2>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: 32,
        }}
      >
        <ObBillingToggle value={billing} onChange={setBilling} dark={dark} />
      </div>

      {/* Grid 2-col — Polish hybrid PX, cards comme containers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 20,
          alignItems: 'stretch',
          paddingTop: 14,
        }}
      >
        <ObPlanCard
          variant="free"
          selected={plan === 'free'}
          onSelect={() => choose('free')}
          billing={billing}
          dark={dark}
        />
        <ObPlanCard
          variant="pro"
          selected={plan === 'pro'}
          onSelect={() => choose('pro')}
          billing={billing}
          dark={dark}
        />
      </div>

      <div style={{ marginTop: 32, textAlign: 'center' }}>
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: t.inkSoft,
            textDecoration: 'none',
            letterSpacing: 0.1,
            borderBottom: `1px solid ${t.divider}`,
            paddingBottom: 2,
            cursor: 'pointer',
          }}
        >
          Voir le détail complet des forfaits →
        </a>
      </div>
    </div>
  )
}
