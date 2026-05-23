// Dev preview du sas de configuration IA (D0Configuring) en isolation.
// Permet d'itérer sur le design sans rejouer tout le flow Premier jour.
// Accessible via /dev/configuring (loop infini : auto-replay sur completion).
import { useState } from 'react'
import { D0Configuring } from '@/components/premier-jour-sugar/D0Configuring'
import { OB_GLOBAL_CSS, obPalette } from '@/components/onboarding-sugar/tokens'
import { D0_CSS } from '@/components/premier-jour-sugar/tokens'
import type { D0Answers } from '@/components/premier-jour-sugar/types'

// Mock answers — tu peux modifier ces valeurs pour tester d'autres combinaisons.
const MOCK_ANSWERS: D0Answers = {
  specialite: 'vente',
  zone: ['c-ge', 'arc-leman'],
  dispo: 'office',
  priorite: 'acquisition',
}

export default function D0ConfiguringDemoPage() {
  // Loop infini : à la fin du sas, on incrémente la key pour reset l'animation.
  const [key, setKey] = useState(0)
  const [dark, setDark] = useState(false)
  const t = obPalette(dark)

  return (
    <div
      style={{
        minHeight: '100vh',
        background: t.bgGradient,
        fontFamily: 'Manrope, system-ui, sans-serif',
        color: t.ink,
        position: 'relative',
      }}
    >
      <style>{OB_GLOBAL_CSS + D0_CSS}</style>

      {/* Dev toolbar (top-right) — switch dark + replay */}
      <div
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 50,
          display: 'flex',
          gap: 8,
          padding: 6,
          background: t.card,
          border: `1px solid ${t.cardBorder}`,
          borderRadius: 999,
          boxShadow: t.shadow,
        }}
      >
        <button
          onClick={() => setDark((d) => !d)}
          style={{
            padding: '8px 14px',
            fontFamily: 'inherit',
            fontSize: 12,
            fontWeight: 600,
            color: t.inkSoft,
            background: 'transparent',
            border: 0,
            borderRadius: 999,
            cursor: 'pointer',
          }}
        >
          {dark ? '☀️ Light' : '🌙 Dark'}
        </button>
        <button
          onClick={() => setKey((k) => k + 1)}
          style={{
            padding: '8px 14px',
            fontFamily: 'inherit',
            fontSize: 12,
            fontWeight: 700,
            color: dark ? '#0B0C0E' : '#FFFFFF',
            background: t.ink,
            border: 0,
            borderRadius: 999,
            cursor: 'pointer',
          }}
        >
          Replay ↻
        </button>
      </div>

      <D0Configuring
        key={key}
        answers={MOCK_ANSWERS}
        dark={dark}
        onComplete={() => setKey((k) => k + 1)}
      />
    </div>
  )
}
