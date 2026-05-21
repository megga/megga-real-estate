// MEGGA Onboarding — Étape 1 KYC info marketing
// Source : handoff-onboarding/onboarding/megga-onboarding-app.jsx → ObStepKYC
// Purely informational — NEVER collect ID pieces here (KYC = buyer scope, not agent).
import type { ReactNode } from 'react'
import { obPalette } from './tokens'
import { ObIcon, type ObIconName } from './primitives'
import { ObSwissFlag } from './primitives'

function ObKYCIdCard({ dark }: { dark?: boolean }) {
  const t = obPalette(dark)
  const bar = (w: number | string, h = 6, opacity = 1) => ({
    width: w,
    height: h,
    borderRadius: 4,
    background: dark
      ? `rgba(236,237,243,${0.10 * opacity})`
      : `rgba(11,12,14,${0.10 * opacity})`,
  })
  const barStrong = (w: number | string, h = 8) => ({
    width: w,
    height: h,
    borderRadius: 4,
    background: dark ? 'rgba(236,237,243,0.22)' : 'rgba(11,12,14,0.22)',
  })

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 360,
        aspectRatio: '1.586 / 1',
        background: t.card,
        borderRadius: 18,
        boxShadow: t.shadow,
        padding: '24px 22px',
        display: 'flex',
        gap: 18,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 18,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <ObSwissFlag size={12} />
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: t.muted,
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          Pièce d'identité
        </span>
      </div>

      <div
        style={{
          flexShrink: 0,
          width: 78,
          height: 100,
          borderRadius: 8,
          background: t.cardSubtle,
          display: 'grid',
          placeItems: 'center',
          alignSelf: 'center',
        }}
      >
        <svg
          width="34"
          height="34"
          viewBox="0 0 24 24"
          fill="none"
          stroke={dark ? 'rgba(236,237,243,0.30)' : 'rgba(11,12,14,0.20)'}
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="9" r="3.6" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </svg>
      </div>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          paddingTop: 18,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={bar(38, 4, 0.55)} />
          <div style={barStrong(96, 8)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={bar(42, 4, 0.55)} />
          <div style={barStrong(70, 7)} />
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={bar(28, 4, 0.55)} />
            <div style={barStrong(46, 7)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={bar(28, 4, 0.55)} />
            <div style={barStrong(40, 7)} />
          </div>
        </div>

        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
          }}
        >
          <div style={bar('100%', 5, 0.45)} />
          <div style={bar('88%', 5, 0.45)} />
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: -14,
          right: -14,
          width: 38,
          height: 38,
          borderRadius: 999,
          background: t.ink,
          color: t.card,
          display: 'grid',
          placeItems: 'center',
          boxShadow: '0 12px 24px rgba(11,12,14,0.30)',
          border: `3px solid ${t.bg}`,
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke={dark ? '#0B0C0E' : '#fff'}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m5 13 4 4 10-12" />
        </svg>
      </div>
    </div>
  )
}

function ObKYCFeature({
  icon, title, sub, dark,
}: {
  icon: ObIconName
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
        gap: 16,
        padding: '16px 0',
        borderBottom: `1px solid ${t.divider}`,
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 40,
          height: 40,
          borderRadius: 12,
          background: t.cardSubtle,
          color: t.ink,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <ObIcon name={icon} size={18} stroke={t.ink} sw={1.7} />
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

const FEATURES: Array<{ icon: ObIconName; title: string; sub: string }> = [
  {
    icon: 'pipeline',
    title: 'Natif, pas un plug-in',
    sub:
      'Le KYC vit dans le pipeline — pas dans une boîte à part, pas un outil tiers à connecter.',
  },
  {
    icon: 'shield',
    title: 'Conforme LBA / LSFin',
    sub:
      'OCR pièce d\'identité, vérification PEP, archivage 10 ans — out of the box.',
  },
  {
    icon: 'sparkle',
    title: 'Déclenché par MEGGA AI',
    sub: 'Au bon moment sur l\'acheteur, jamais en avance, jamais à la main.',
  },
]

export function StepKYC({ dark }: { dark?: boolean }) {
  const t = obPalette(dark)
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', paddingTop: 4 }}>
      <div
        style={{
          textAlign: 'center',
          marginBottom: 44,
          animation: 'obFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
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
          Le premier CRM avec
          <br />
          le KYC intégré.
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
          Plus d'outils tiers, plus de classeur Excel. Tout est natif, conforme LBA,
          et déclenché au bon moment.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr minmax(280px, 360px)',
          gap: 56,
          alignItems: 'center',
          animation: 'obFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
          animationDelay: '0.1s',
          animationFillMode: 'both',
        }}
      >
        <div>
          {FEATURES.map((f, i) => (
            <ObKYCFeature key={i} {...f} dark={dark} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <ObKYCIdCard dark={dark} />
        </div>
      </div>
    </div>
  )
}
