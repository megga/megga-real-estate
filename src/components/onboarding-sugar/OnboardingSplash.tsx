// MEGGA Onboarding — Splash bascule Property X → Sugar
// Source : handoff-onboarding/onboarding/megga-onboarding-app.jsx → ObSplash
import { useEffect, useState } from 'react'
import { obPalette } from './tokens'

export function OnboardingSplash({
  onDone, prenom = 'Marie', dark, replayKey,
}: {
  onDone: () => void
  prenom?: string
  dark?: boolean
  replayKey?: number
}) {
  // Phases : 0 = Property X (Objectivity, fond blanc) · 1 = bascule Sugar · 2 = unmount
  const [phase, setPhase] = useState(0)
  const t = obPalette(dark)

  useEffect(() => {
    setPhase(0)
    const t1 = setTimeout(() => setPhase(1), 900)
    const t2 = setTimeout(() => setPhase(2), 1900)
    const t3 = setTimeout(() => onDone(), 2200)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayKey])

  const bg = phase === 0 ? '#FFFFFF' : t.bgGradient

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: bg,
        transition: 'background 1.1s cubic-bezier(.4,0,.2,1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 26,
        opacity: phase === 2 ? 0 : 1,
        pointerEvents: phase === 2 ? 'none' : 'auto',
      }}
    >
      <img
        src="/megga-logo.svg"
        alt="MEGGA"
        style={{
          height: 52,
          width: 'auto',
          opacity: phase === 0 ? 1 : 0.86,
          transform: phase === 0 ? 'scale(1)' : 'scale(0.92)',
          transition: 'all .8s cubic-bezier(.2,.8,.2,1)',
          filter: dark && phase > 0 ? 'invert(1)' : 'none',
        }}
      />

      <div
        style={{
          fontFamily:
            phase === 0
              ? "'Objectivity', 'Plus Jakarta Sans', system-ui, sans-serif"
              : 'Manrope, system-ui, sans-serif',
          fontSize: 28,
          fontWeight: 500,
          letterSpacing: phase === 0 ? '-0.03em' : '-0.6px',
          color: t.ink,
          opacity: phase === 0 ? 1 : 0,
          transform: phase === 0 ? 'translateY(0)' : 'translateY(-6px)',
          transition: 'all .6s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        Bienvenue,{' '}
        <span style={{ fontWeight: 700, letterSpacing: -0.8 }}>{prenom}</span>
      </div>

      <div
        style={{
          width: 4,
          height: 4,
          borderRadius: 999,
          background: t.muted,
          opacity: phase === 0 ? 1 : 0,
          transition: 'opacity .4s ease',
          animation: phase === 0 ? 'obPulse 1.2s ease-in-out infinite' : 'none',
        }}
      />
    </div>
  )
}
