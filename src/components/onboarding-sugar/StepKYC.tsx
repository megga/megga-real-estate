// MEGGA Onboarding — Étape 1 KYC info marketing
// Source : handoff-onboarding/onboarding/megga-onboarding-app.jsx → ObStepKYC
// Purely informational — NEVER collect ID pieces here (KYC = buyer scope, not agent).
import type { ReactNode } from 'react'
import { obPalette } from './tokens'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import SwissIdCardSkeleton from './SwissIdCardSkeleton'

function ObKYCFeature({
  icon, title, sub, dark,
}: {
  icon: MEIconName
  title: string
  sub: ReactNode
  dark?: boolean
}) {
  const t = obPalette(dark)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 18,
        padding: '16px 0',
        borderBottom: `1px solid ${t.divider}`,
      }}
    >
      {/* Icône Property X — pas de fond, juste le glyph line-stroke 1.7 */}
      <div
        style={{
          flexShrink: 0,
          width: 28,
          display: 'grid',
          placeItems: 'center',
          color: t.ink,
          marginTop: 2,
        }}
      >
        <MEIcon name={icon} size={26} color={t.ink} strokeWidth={1.7} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 700,
            color: t.ink,
            letterSpacing: -0.2,
            marginBottom: 4,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 13,
            color: t.inkSoft,
            fontWeight: 500,
            lineHeight: 1.5,
          }}
        >
          {sub}
        </div>
      </div>
    </div>
  )
}

const FEATURES: Array<{ icon: MEIconName; title: string; sub: string }> = [
  {
    icon: 'pipeline',
    title: 'Cousu dans le pipeline.',
    sub: "Le KYC n'a pas son onglet. Il apparaît quand un dossier le réclame, disparaît quand c'est fait.",
  },
  {
    icon: 'shield',
    title: 'Audit-ready. Toujours.',
    sub: 'OCR identité, PEP en continu, archivage légal automatique. À chaque dossier, sans intervention.',
  },
  {
    icon: 'sparkle',
    title: "L'IA déclenche au compromis.",
    sub: "Pas à l'inscription. Pas à la visite. Au moment légalement requis.",
  },
]

export function StepKYC({ dark }: { dark?: boolean }) {
  const t = obPalette(dark)
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', paddingTop: 4 }}>
      {/* ── HERO : 2 colonnes — H1 + lead + punch à gauche, ID card à droite ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 320px',
          gap: 80,
          alignItems: 'center',
          marginBottom: 88,
          animation: 'obFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <div>
          {/* Strate 1 — H1 monumental, 3 lignes asymétriques */}
          <h1
            style={{
              margin: 0,
              fontFamily:
                '"Objectivity", "Plus Jakarta Sans", system-ui, sans-serif',
              fontSize: 84,
              fontWeight: 700,
              color: t.ink,
              letterSpacing: '-0.04em',
              lineHeight: 0.9,
              textTransform: 'uppercase',
            }}
          >
            Le KYC suit.
            <br />
            Vous,
            <br />
            vous vendez.
          </h1>

          {/* Divider Pangram — trait court signature */}
          <div
            style={{
              width: 60,
              height: 1.5,
              background: t.ink,
              margin: '32px 0',
            }}
          />

          {/* Strate 2 — Lead : petit, factuel, max-width étroit */}
          <p
            style={{
              margin: 0,
              maxWidth: 400,
              fontSize: 15,
              fontWeight: 400,
              color: t.inkSoft,
              lineHeight: 1.6,
              letterSpacing: '-0.005em',
            }}
          >
            Premier CRM immobilier suisse où l'OCR identité,
            <br />
            le PEP et l'archivage légal sont intégrés au pipeline.
          </p>

          {/* Strate 3 — Punch inline avec séparateur typographique " · " */}
          <p
            style={{
              margin: '20px 0 0',
              fontSize: 11,
              fontWeight: 700,
              color: t.ink,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              lineHeight: 1.4,
            }}
          >
            Aucun outil tiers · Aucune ressaisie · Aucune amende
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <SwissIdCardSkeleton dark={dark} />
        </div>
      </div>

      {/* ── FEATURES : pleine largeur, stacked avec dividers ── */}
      <div
        style={{
          animation: 'obFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
          animationDelay: '0.15s',
          animationFillMode: 'both',
        }}
      >
        {FEATURES.map((f, i) => (
          <ObKYCFeature key={i} {...f} dark={dark} />
        ))}
      </div>
    </div>
  )
}
