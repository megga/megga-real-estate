// MEGGA Onboarding — Étape Forfait
// Source : handoff-onboarding/onboarding/megga-onboarding-step-forfait.jsx
import { useState, type ReactNode } from 'react'
import { obPalette } from './tokens'
import type { Billing, OnboardingData, Plan, Setter } from './types'

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

// ─── Feature line ────────────────────────────────────────────────────

function ObPlanFeature({
  children, dark, invert, strong,
}: {
  children: ReactNode
  dark?: boolean
  invert?: boolean
  strong?: boolean
}) {
  const t = obPalette(dark)
  const tickBg = invert
    ? dark ? 'rgba(11,12,14,0.10)' : 'rgba(255,255,255,0.14)'
    : t.cardSubtle
  const tickStroke = invert ? (dark ? '#0B0C0E' : '#FFFFFF') : t.ink
  const textColor = invert
    ? dark ? 'rgba(11,12,14,0.78)' : 'rgba(255,255,255,0.86)'
    : t.inkSoft
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        fontSize: 13.5,
        lineHeight: 1.5,
        color: textColor,
        fontWeight: strong ? 600 : 500,
      }}
    >
      <span
        style={{
          flexShrink: 0,
          marginTop: 1,
          width: 20,
          height: 20,
          borderRadius: 999,
          background: tickBg,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke={tickStroke}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m5 13 4 4 10-12" />
        </svg>
      </span>
      <span>{children}</span>
    </li>
  )
}

// ─── Plan card ───────────────────────────────────────────────────────

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

  const priceMonth = isPro ? (billing === 'yearly' ? 65 : 79) : 0
  const annualBilled = 790

  const surface = isPro ? t.black : t.card
  const ink = isPro ? (dark ? '#0B0C0E' : '#FFFFFF') : t.ink
  const inkSoft = isPro
    ? dark ? 'rgba(11,12,14,0.72)' : 'rgba(255,255,255,0.78)'
    : t.inkSoft
  const muted = isPro
    ? dark ? 'rgba(11,12,14,0.52)' : 'rgba(255,255,255,0.58)'
    : t.muted

  const baseLift = isPro ? -6 : 0
  const hoverLift = h ? -3 : 0
  const baseShadow = isPro ? t.shadowLg : t.shadow
  const hoverShadow = t.shadowHov
  const ringColor = isPro ? (dark ? '#0B0C0E' : '#FFFFFF') : t.black
  const selectedShadow = selected
    ? `${hoverShadow}, 0 0 0 2px ${ringColor} inset`
    : h
      ? hoverShadow
      : baseShadow

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        position: 'relative',
        flex: '1 1 0',
        minWidth: 0,
        padding: '34px 30px 30px',
        background: surface,
        borderRadius: 24,
        boxShadow: selectedShadow,
        transform: `translateY(${baseLift + hoverLift}px)`,
        transition: 'all .28s cubic-bezier(.2,.8,.2,1)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        animation: 'obFadeUp .55s cubic-bezier(.2,.8,.2,1) both',
        animationDelay: isPro ? '0.12s' : '0.06s',
      }}
    >
      {isPro && (
        <div
          style={{
            position: 'absolute',
            top: -12,
            right: 22,
            padding: '6px 12px',
            borderRadius: 999,
            background: dark ? '#0B0C0E' : '#FFFFFF',
            color: dark ? '#ECEDF3' : '#0B0C0E',
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            boxShadow: '0 8px 20px rgba(11,12,14,0.20)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l2.6 6.7L22 9.3l-5.5 4.9 1.8 7.3L12 17.8 5.7 21.5l1.8-7.3L2 9.3l7.4-.6L12 2Z" />
          </svg>
          Recommandé
        </div>
      )}

      <div style={{ marginBottom: 22 }}>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: muted,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          {isPro ? 'Pour les agents en activité' : 'Pour démarrer'}
        </div>
        <div
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: ink,
            letterSpacing: -0.8,
            lineHeight: 1.1,
          }}
        >
          {isPro ? 'Pro' : 'Découverte'}
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: 13.5,
            color: inkSoft,
            fontWeight: 500,
            lineHeight: 1.5,
          }}
        >
          {isPro
            ? "L'outil de production pour boucler des mandats au quotidien."
            : 'Pour boucler votre premier mandat avec MEGGA.'}
        </div>
      </div>

      <div
        style={{
          marginBottom: 24,
          paddingBottom: 24,
          borderBottom: `1px solid ${
            isPro
              ? dark
                ? 'rgba(11,12,14,0.10)'
                : 'rgba(255,255,255,0.14)'
              : t.divider
          }`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: inkSoft,
              letterSpacing: -0.2,
            }}
          >
            CHF
          </span>
          <span
            style={{
              fontSize: 56,
              fontWeight: 700,
              color: ink,
              letterSpacing: -2,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
              transition: 'color .2s ease',
            }}
          >
            {priceMonth}
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: muted,
              letterSpacing: -0.1,
            }}
          >
            / mois
          </span>
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: muted,
            fontWeight: 500,
            lineHeight: 1.5,
            minHeight: 18,
          }}
        >
          {isPro
            ? billing === 'yearly'
              ? `Facturé CHF ${annualBilled.toLocaleString('fr-CH').replace(/\s/g, "'")} / an · Économie CHF 158`
              : 'Sans engagement · annulable à tout moment'
            : 'Gratuit, pour toujours'}
        </div>
      </div>

      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          flex: 1,
        }}
      >
        {isPro ? (
          <>
            <ObPlanFeature dark={dark} invert strong>
              Mandats, contacts & publications <strong>illimités</strong>
            </ObPlanFeature>
            <ObPlanFeature dark={dark} invert>
              MEGGA AI illimité — matching, parcours auto, rédaction
            </ObPlanFeature>
            <ObPlanFeature dark={dark} invert>
              KYC automatisé <strong>LBA / LSFin</strong> (OCR, PEP, archivage légal)
            </ObPlanFeature>
            <ObPlanFeature dark={dark} invert>
              Signature électronique Skribble QES + DocuSign
            </ObPlanFeature>
            <ObPlanFeature dark={dark} invert>
              C2PA sur photos publiées · calendrier sync Google/Outlook
            </ObPlanFeature>
            <ObPlanFeature dark={dark} invert>
              Documents avancés, reporting, export Bexio / Abacus
            </ObPlanFeature>
            <ObPlanFeature dark={dark} invert>
              Support prioritaire FR/DE/IT — réponse &lt; 4 h ouvrées
            </ObPlanFeature>
          </>
        ) : (
          <>
            <ObPlanFeature dark={dark} strong>
              <strong>3 mandats</strong> actifs · <strong>50 contacts</strong>
            </ObPlanFeature>
            <ObPlanFeature dark={dark}>
              Pipeline Kanban & vue Aujourd'hui complète
            </ObPlanFeature>
            <ObPlanFeature dark={dark}>
              Wizard de publication (3 publications / mois)
            </ObPlanFeature>
            <ObPlanFeature dark={dark}>
              MEGGA AI — 10 suggestions / mois
            </ObPlanFeature>
            <ObPlanFeature dark={dark}>
              Documents standards (mandat, fiche bien)
            </ObPlanFeature>
            <ObPlanFeature dark={dark}>
              KYC manuel · support communautaire
            </ObPlanFeature>
          </>
        )}
      </ul>

      <div style={{ marginTop: 28 }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onSelect()
          }}
          style={{
            width: '100%',
            height: 48,
            borderRadius: 999,
            border: 0,
            background: isPro
              ? dark ? '#0B0C0E' : '#FFFFFF'
              : t.black,
            color: isPro
              ? dark ? '#ECEDF3' : '#0B0C0E'
              : dark ? '#0B0C0E' : '#FFFFFF',
            fontFamily: 'inherit',
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: 0.1,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            boxShadow: isPro
              ? '0 8px 20px rgba(0,0,0,0.18)'
              : '0 6px 16px rgba(11,12,14,0.18)',
            transition: 'all .18s ease',
            transform: h ? 'translateY(-1px)' : 'translateY(0)',
          }}
        >
          {selected ? (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m5 13 4 4 10-12" />
              </svg>
              Sélectionné
            </>
          ) : (
            <>
              {isPro ? 'Choisir Pro' : 'Continuer en Découverte'}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </div>
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
      <div
        style={{
          textAlign: 'center',
          marginBottom: 30,
          animation: 'obFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: t.muted,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          Forfait
        </div>
        <h1
          style={{
            margin: '0 0 14px',
            fontSize: 44,
            fontWeight: 700,
            color: t.ink,
            letterSpacing: -1,
            lineHeight: 1.05,
          }}
        >
          Choisissez votre rythme.
        </h1>
        <p
          style={{
            margin: '0 auto',
            maxWidth: 540,
            fontSize: 15.5,
            color: t.inkSoft,
            fontWeight: 500,
            lineHeight: 1.55,
          }}
        >
          Démarrez gratuitement, passez à Pro quand votre activité décolle. Vous
          pouvez basculer à tout moment — sans engagement.
        </p>
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 22,
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

      <div
        style={{
          marginTop: 28,
          display: 'flex',
          justifyContent: 'center',
          gap: 28,
          flexWrap: 'wrap',
          animation: 'obFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
          animationDelay: '0.25s',
          animationFillMode: 'both',
        }}
      >
        {[
          ['check', 'Aucune carte requise'],
          ['clock', 'Bascule à tout moment'],
          ['flag', 'Facturation suisse · TVA incluse'],
        ].map(([_icon, label], i) => (
          <div
            key={i}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12.5,
              fontWeight: 600,
              color: t.muted,
              letterSpacing: 0.1,
            }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                background: t.card,
                color: t.inkSoft,
                display: 'grid',
                placeItems: 'center',
                boxShadow: t.shadowSm,
              }}
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {_icon === 'check' && <path d="m5 13 4 4 10-12" />}
                {_icon === 'clock' && (
                  <>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </>
                )}
                {_icon === 'flag' && <path d="M4 22V4M4 4h14l-2 5 2 5H4" />}
              </svg>
            </span>
            {label}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 18, textAlign: 'center' }}>
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
