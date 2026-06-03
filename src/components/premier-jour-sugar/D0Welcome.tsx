// MEGGA Premier jour — Écran 0 : Welcome
// Hero plein écran centré, composition monumentale éditoriale.
// Cohérent avec Step 1 KYC du wizard (Objectivity 64-84px).
// Source : handoff-premier-jour/premier-jour/crm-day0-calibration.jsx → D0Welcome
import { obPalette } from '@/components/onboarding-sugar/tokens'
import { ObBlackPill } from '@/components/onboarding-sugar/primitives'
import { ObThemeToggle } from '@/components/onboarding-sugar/OnboardingShell'
import MEIcon from '@/components/propertyx/MEIcon'

export function D0Welcome({
  prenom,
  onStart,
  dark,
  onThemeChange,
}: {
  prenom: string
  onStart: () => void
  /** Conservé pour la signature mais non utilisé : le skip n'est plus affiché. */
  onSkip?: () => void
  dark?: boolean
  onThemeChange?: (theme: 'light' | 'dark') => void
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
      {/* Header — logo gauche + toggle dark mode droite */}
      <div
        style={{
          position: 'absolute',
          top: 22,
          left: 32,
          right: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
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
        {onThemeChange && (
          <ObThemeToggle dark={!!dark} onChange={onThemeChange} t={t} />
        )}
      </div>

      {/* Hero — H1 monumental Objectivity, cohérent avec wizard onboarding */}
      <div
        style={{
          textAlign: 'center',
          maxWidth: 820,
          animation: 'd0SlideUp .55s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <h1
          style={{
            margin: '0 0 20px',
            fontFamily:
              '"Objectivity", "Plus Jakarta Sans", system-ui, sans-serif',
            fontSize: 64,
            fontWeight: 700,
            color: t.ink,
            letterSpacing: '-0.04em',
            lineHeight: 1.02,
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
            maxWidth: 480,
            fontSize: 16,
            color: t.inkSoft,
            fontWeight: 500,
            lineHeight: 1.55,
            letterSpacing: '-0.005em',
          }}
        >
          Quelques minutes maintenant, et MEGGA AI saura comment vous aider
          dès demain matin.
        </p>
      </div>

      {/* CTA — Commencer (sans skip, comme les questions) */}
      <div
        style={{
          marginTop: 48,
          display: 'flex',
          justifyContent: 'center',
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
            <MEIcon
              name="arrow-right"
              size={16}
              color={dark ? '#0B0C0E' : '#FFFFFF'}
              strokeWidth={2}
            />
          }
        >
          Commencer
        </ObBlackPill>
      </div>
    </div>
  )
}
