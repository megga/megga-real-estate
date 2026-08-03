// MEGGA AI — Panneau · icônes (stroke linéaire, zéro emoji) + glyphe étoile.
// Port fidèle du handoff `crm-copilot-panel.jsx`.

import type { ReactNode } from 'react'

// Glyphe MEGGA AI — étoile 4 branches (version « pleine » du panneau, ligne fine)
export const AI_GLYPH_PATH =
  'M12 2c.4 3.6 1.4 6 3.4 7.6 1.6 1.3 3.6 1.9 6.6 2.4-3 .5-5 1.1-6.6 2.4C13.4 16 12.4 18.4 12 22c-.4-3.6-1.4-6-3.4-7.6C7 13.1 5 12.5 2 12c3-.5 5-1.1 6.6-2.4C10.6 8 11.6 5.6 12 2Z'
// Étoile des bandeaux proactifs (glyphe plein blanc sur pastille bleue)
const ICON_PATHS: Record<string, ReactNode> = {
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />,
  close: <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>,
  menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  send: <><path d="M12 19V5" /><path d="M6 11l6-6 6 6" /></>,
  folder: <path d="M3 7a2 2 0 0 1 2-2h3l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.6" /><path d="m21 15-5-5L5 21" /></>,
  draft: <><path d="M4 4h11l5 5v11a0 0 0 0 1 0 0H4Z" /><path d="M15 4v5h5" /><path d="M8 13h8" /><path d="M8 17h5" /></>,
  pipeline: <><path d="M4 6h16" /><path d="M4 12h10" /><path d="M4 18h6" /></>,
  user: <><circle cx="12" cy="8" r="3.4" /><path d="M5.5 19a6.5 6.5 0 0 1 13 0" /></>,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 9h16" /><path d="M9 3v4" /><path d="M15 3v4" /></>,
  search: <><circle cx="11" cy="11" r="6" /><path d="M20 20l-4-4" /></>,
  arrowR: <><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></>,
  doc: <><path d="M6 3h8l4 4v14H6Z" /><path d="M14 3v4h4" /></>,
  check: <path d="M5 12l4.5 4.5L19 7" />,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
}

interface CpIconProps {
  name: string
  size?: number
  color?: string
  sw?: number
}
export function CpIcon({ name, size = 18, color = 'currentColor', sw = 1.7 }: CpIconProps) {
  const p = ICON_PATHS[name] || null
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {p}
    </svg>
  )
}

// Glyphe MEGGA AI — étoile dans une pastille ronde (accent au choix)
interface AiGlyphProps {
  size?: number
  on?: string
  bg?: string
}
export function AiGlyph({ size = 24, on = '#0B0C0E', bg }: AiGlyphProps) {
  return (
    <span
      style={{
        width: size + 12, height: size + 12, borderRadius: 999,
        background: bg || 'rgba(11,12,14,0.06)',
        display: 'grid', placeItems: 'center', flexShrink: 0,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill={on} aria-hidden="true">
        <path d={AI_GLYPH_PATH} />
      </svg>
    </span>
  )
}
