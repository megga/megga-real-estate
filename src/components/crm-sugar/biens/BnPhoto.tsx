// MEGGA CRM Sugar v2 — Vignette photo (placeholder déterministe)
// 1:1 port from `crm-screen-biens-sugar.jsx` (BnPhoto).
//
// Sprint 3 : badge ✓ C2PA retiré — la signature tourne en arrière-plan,
// traçable dans le journal d'audit. La prop `signed` reste pour compat
// API mais est ignorée. Côté marketplace publique, le badge reste visible.

import type { SugarPalette } from '../tokens'

interface BnPhotoProps {
  id: string
  sp: SugarPalette
  w?: number | string
  h?: number | string
  /** @deprecated Sprint 3 — badge retiré du chrome agent. Prop ignorée. */
  signed?: boolean
}

export function BnPhoto({ id, sp, w = 64, h = 48 }: BnPhotoProps) {
  let n = 0
  for (let i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) % 360
  const h1 = n
  const h2 = (n + 40) % 360
  return (
    <div
      style={{
        width: w,
        height: h,
        flexShrink: 0,
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
        background: `linear-gradient(135deg, hsl(${h1} 55% 65%), hsl(${h2} 60% 45%))`,
        border: `1px solid ${sp.cardBorder}`,
      }}
    >
      <svg
        viewBox="0 0 100 75"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0.3,
        }}
      >
        <path fill="rgba(255,255,255,.45)" d="M0 75 V52 L18 38 L34 50 L34 75 Z" />
        <path fill="rgba(255,255,255,.32)" d="M30 75 V44 L52 26 L72 42 L72 75 Z" />
        <path fill="rgba(0,0,0,.25)" d="M65 75 V48 L82 36 L100 50 L100 75 Z" />
      </svg>
      {/* Sprint 3 : badge ✓ C2PA retiré — signature silencieuse, log audit nLPD. */}
    </div>
  )
}
