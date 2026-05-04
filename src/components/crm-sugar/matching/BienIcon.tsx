// MEGGA CRM Sugar v2 — Bien type icon (apt/maison/location)
// 1:1 port from `crm-screen-matching-sugar.jsx` (BienIcon).

import type { CrmBien } from '../mockData'

interface BienIconProps {
  bien: CrmBien | null | undefined
  size?: number
  color?: string
  opacity?: number
}

export function BienIcon({ bien, size = 26, color, opacity = 0.78 }: BienIconProps) {
  if (!bien) return null
  const c = color || bien.accent
  if (bien.transaction === 'location') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={c}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ opacity }}
      >
        <circle cx="8" cy="14" r="4" />
        <path d="m11 11 8.5-8.5" />
        <path d="m17 5 3 3" />
        <path d="m14 8 3 3" />
      </svg>
    )
  }
  if (bien.type === 'maison') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={c}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ opacity }}
      >
        <path d="M3 11 12 3l9 8" />
        <path d="M5 9.5V21h14V9.5" />
        <path d="M16 5V3h2v4" />
        <path d="M10 21v-6h4v6" />
      </svg>
    )
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={c}
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity }}
    >
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <line x1="9" y1="8" x2="9.01" y2="8" strokeWidth={2} />
      <line x1="15" y1="8" x2="15.01" y2="8" strokeWidth={2} />
      <line x1="9" y1="12" x2="9.01" y2="12" strokeWidth={2} />
      <line x1="15" y1="12" x2="15.01" y2="12" strokeWidth={2} />
      <line x1="9" y1="16" x2="9.01" y2="16" strokeWidth={2} />
      <line x1="15" y1="16" x2="15.01" y2="16" strokeWidth={2} />
      <path d="M11 21v-3h2v3" />
    </svg>
  )
}
