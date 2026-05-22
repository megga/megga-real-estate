// MEGGA Premier jour — Écran 0 : Welcome
// Hero plein écran centré : prénom + accroche + CTA + skip.
// Source : handoff-premier-jour/premier-jour/crm-day0-calibration.jsx → D0Welcome
import { obPalette } from '@/components/onboarding-sugar/tokens'
import { ObBlackPill, ObIcon } from '@/components/onboarding-sugar/primitives'

export function D0Welcome({
  prenom,
  onStart,
  onSkip,
  dark,
}: {
  prenom: string
  onStart: () => void
  onSkip: () => void
  dark?: boolean
}) {
  const t = obPalette(dark)
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 32px',
        position: 'relative',
      }}
    >
      {/* MEGGA logo discret en haut gauche */}
      <div style={{ position: 'absolute', top: 26, left: 32 }}>
        <img
          src="/megga-logo.svg"
          alt="MEGGA"
          style={{
            height: 24,
            width: 'auto',
            opacity: 0.75,
            filter: dark ? 'invert(1)' : 'none',
          }}
        />
      </div>

      {/* Titre */}
      <div
        style={{
          textAlign: 'center',
          maxWidth: 640,
          animation: 'd0SlideUp .55s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <h1
          style={{
            margin: '0 0 18px',
            fontSize: 46,
            fontWeight: 700,
            color: t.ink,
            letterSpacing: -1.1,
            lineHeight: 1.05,
          }}
        >
          Bonjour {prenom}.
          <br />
          4 questions pour que je travaille
          <br />
          comme vous travaillez.
        </h1>
        <p
          style={{
            margin: '0 auto',
            maxWidth: 460,
            fontSize: 16,
            color: t.inkSoft,
            fontWeight: 500,
            lineHeight: 1.55,
          }}
        >
          Quelques minutes maintenant, et MEGGA AI saura comment vous aider dès demain matin.
        </p>
      </div>

      {/* CTA + Skip */}
      <div
        style={{
          marginTop: 44,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          animation: 'd0SlideUp .55s cubic-bezier(.2,.8,.2,1) both',
          animationDelay: '0.15s',
          animationFillMode: 'both',
        }}
      >
        <ObBlackPill
          onClick={onStart}
          dark={dark}
          size="lg"
          autoFocus
          icon={
            <ObIcon
              name="arrowR"
              size={16}
              stroke={dark ? '#0B0C0E' : '#fff'}
              sw={2}
            />
          }
        >
          Commencer
        </ObBlackPill>
        <button
          onClick={onSkip}
          style={{
            background: 'transparent',
            border: 0,
            padding: '8px 16px',
            color: t.muted,
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: -0.1,
          }}
        >
          Passer toutes les questions
        </button>
      </div>
    </div>
  )
}
