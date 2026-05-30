// Dev preview de l'écran d'activation IA « Atterrissage » (D0Activation) en
// isolation. Permet d'itérer sur le design sans rejouer tout le flow Premier
// jour. Accessible via /dev/activation (loop infini : auto-replay au CTA).
// Le toggle de thème (sun/moon animé) est rendu PAR l'écran lui-même (haut
// droite) ; le dev toolbar ne garde que « Replay » (bas droite).
import { useState } from 'react'
import { D0Activation } from '@/components/premier-jour-sugar/D0Activation'
import { OB_GLOBAL_CSS, obPalette } from '@/components/onboarding-sugar/tokens'
import { D0_CSS } from '@/components/premier-jour-sugar/tokens'
import type { D0Answers } from '@/components/premier-jour-sugar/types'

// Mock answers — modifie ces valeurs pour tester d'autres combinaisons.
const MOCK_ANSWERS: D0Answers = {
  specialite: 'vente',
  zone: ['c-ge', 'arc-leman'],
  dispo: 'office',
  priorite: 'acquisition',
}

export default function D0ActivationDemoPage() {
  // Loop : à la fin du sas (CTA), on incrémente la key pour reset l'animation.
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

      {/* Dev toolbar (bas droite) — Replay seulement (le toggle thème est sur
          l'écran). Bas droite pour ne pas chevaucher le toggle haut droite. */}
      <button
        onClick={() => setKey((k) => k + 1)}
        style={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: 50,
          padding: '8px 14px',
          fontFamily: 'inherit',
          fontSize: 12,
          fontWeight: 700,
          color: dark ? '#0B0C0E' : '#FFFFFF',
          background: t.ink,
          border: 0,
          borderRadius: 999,
          boxShadow: t.shadow,
          cursor: 'pointer',
        }}
      >
        Replay ↻
      </button>

      <D0Activation
        key={key}
        answers={MOCK_ANSWERS}
        prenom="Marie"
        dark={dark}
        onThemeChange={(next) => setDark(next === 'dark')}
        onComplete={() => setKey((k) => k + 1)}
      />
    </div>
  )
}
