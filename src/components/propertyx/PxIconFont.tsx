// MEGGA Marketplace — Property X icon font system.
//
// Le DS Property X distingue deux familles d'icônes :
// - 📱 Icons     → line-style (stroke 1.6-1.8) → voir PxIcon.tsx
// - 📱 Icon font → filled (forme pleine)       → ce fichier
//
// Le Figma original utilise une police d'icônes (caractères glyphés) pour
// Icon font. Côté React on préfère SVG inline — mêmes formes, plus contrôlables.
// Catalogue limité aux icônes pertinentes pour la marketplace immobilière.

import type { ReactNode } from 'react'

export type PxIconFontName =
  | 'home' | 'building' | 'buildings' | 'door' | 'key'
  | 'bed' | 'bath' | 'sofa' | 'kitchen' | 'dimensions'
  | 'bell' | 'bookmark' | 'heart' | 'star' | 'flag'
  | 'calendar' | 'clock' | 'mail' | 'phone' | 'location'
  | 'eye' | 'camera' | 'gallery' | 'globe' | 'compass'
  | 'check-circle' | 'close-circle' | 'info' | 'help' | 'alert'
  | 'shield' | 'lock' | 'user' | 'users' | 'credit-card'

// Paths SVG filled (solid). Conventions universelles d'iconographie.
const PATHS: Record<PxIconFontName, ReactNode> = {
  home: <path d="M12 2.5 2 11h3v9h5v-6h4v6h5v-9h3L12 2.5Z" />,
  building: <path d="M5 2v20h14V2H5Zm4 18H7v-2h2v2Zm0-4H7v-2h2v2Zm0-4H7v-2h2v2Zm0-4H7V6h2v2Zm4 12h-2v-2h2v2Zm0-4h-2v-2h2v2Zm0-4h-2v-2h2v2Zm0-4h-2V6h2v2Zm4 12h-2v-2h2v2Zm0-4h-2v-2h2v2Zm0-4h-2v-2h2v2Zm0-4h-2V6h2v2Z" />,
  buildings: <path d="M2 22V8l5-2v3h2v3H7v2h2v2H7v2h2v2H7v2H2Zm9 0V2l11 4v16h-5v-2h-2v2H11Zm6-12V8h-2v2h2Zm0 4v-2h-2v2h2Zm0 4v-2h-2v2h2Zm4-8V8h-2v2h2Zm0 4v-2h-2v2h2Zm0 4v-2h-2v2h2Z" />,
  door: <path d="M6 2h12v20H6V2Zm9 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />,
  key: <path d="M14 9a4 4 0 0 0-3.8 5.2L3 22l2 2 3-3v-2h2v-2h2v-2.2A4 4 0 1 0 14 9Zm1 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />,
  bed: <path d="M2 12V6h2v6h6V8h8a4 4 0 0 1 4 4v6h-2v-2H4v2H2v-6Zm5-1.5a2 2 0 1 0 0-3.5 2 2 0 0 0 0 3.5Z" />,
  bath: <path d="M9 5a3 3 0 0 1 6 0v2h6v8a4 4 0 0 1-4 4l-1 3h-2l-1-3H7l-1 3H4l-1-3a4 4 0 0 1-1-2.7V7h6V5Zm0 0v2h6V5a3 3 0 0 0-6 0Z" />,
  sofa: <path d="M3 12a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v3h1v3h-2v-1H4v1H2v-3h1v-3Zm3 3h12v-3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v3Z" />,
  kitchen: <path d="M4 3h7v8H4V3Zm9 0h7v18h-7V3Zm-9 9h7v9H4v-9Zm12 4v3h2v-3h-2Zm0-6v3h2V10h-2Z" />,
  dimensions: <path d="M3 4h18v2H3V4Zm0 14h18v2H3v-2ZM5 8h2v8H5V8Zm12 0h2v8h-2V8Zm-8 1h6v6H9V9Z" />,
  bell: <path d="M12 2a6 6 0 0 0-6 6v4l-2 3v2h16v-2l-2-3V8a6 6 0 0 0-6-6Zm-2 18a2 2 0 0 0 4 0h-4Z" />,
  bookmark: <path d="M6 2h12v20l-6-4-6 4V2Z" />,
  heart: <path d="M12 21s-7-5-9-10c-1-3 1-7 5-7 2 0 3 1 4 2 1-1 2-2 4-2 4 0 6 4 5 7-2 5-9 10-9 10Z" />,
  star: <path d="M12 2 14.7 9 22 9.6l-5.6 4.7L18 22l-6-3.6L6 22l1.6-7.7L2 9.6 9.3 9 12 2Z" />,
  flag: <path d="M5 2h2v20H5V2Zm2 1h11l-2 4 2 4H7V3Z" />,
  calendar: <path d="M3 6h18v15H3V6Zm14-4v3h-2V2h2ZM9 2v3H7V2h2Zm-6 7h18v2H3V9Zm3 4h2v2H6v-2Zm5 0h2v2h-2v-2Zm5 0h2v2h-2v-2Z" />,
  clock: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 11h-4V5h2v6h2v2Z" />,
  mail: <path d="M2 5h20v14H2V5Zm2 1.6L12 13l8-6.4V6H4v.6Z" />,
  phone: <path d="M5 3h4l2 5-2.5 1.5a13 13 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A18 18 0 0 1 3 5a2 2 0 0 1 2-2Z" />,
  location: <path d="M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8Zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" />,
  eye: <path d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />,
  camera: <path d="M9 4 7 6H3v14h18V6h-4l-2-2H9Zm3 13a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z" />,
  gallery: <path d="M3 3h18v18H3V3Zm5 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm-3 12 5-6 3 3 4-5 5 8H5Z" />,
  globe: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 18a8 8 0 0 1-5-4h3v2c0 1 1 2 2 2Zm0-14a8 8 0 0 0-6 5h3l-2-2 3 1 2-2v-2Zm6 2-2 1-1 2 3 1v2l3-1a8 8 0 0 0-3-5Zm-3 13c2-1 4-3 4-6h-3l-2 2 1 2v2Z" />,
  compass: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm3 7-2 6-6 2 2-6 6-2Z" />,
  'check-circle': <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm5 7-6 7-4-3 1.4-1.4L11 13l4.6-5.4L17 9Z" />,
  'close-circle': <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4 13-1.5 1.5L12 14l-2.5 2.5L8 15l2.5-2.5L8 10l1.5-1.5L12 11l2.5-2.5L16 10l-2.5 2.5L16 15Z" />,
  info: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-6h2v6Zm-1-9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />,
  help: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 17a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Zm2-7c-1 .7-1 1-1 2h-2c0-1.5.5-2.2 1.5-2.9.7-.5 1-.9 1-1.6 0-.8-.6-1.4-1.5-1.4-.8 0-1.5.5-1.5 1.5H8.5c0-2.1 1.6-3.5 3.5-3.5s3.5 1.4 3.5 3.4c0 1.4-.7 2.1-1.5 2.5Z" />,
  alert: <path d="M12 2 1 21h22L12 2Zm1 16h-2v-2h2v2Zm0-4h-2V9h2v5Z" />,
  shield: <path d="M12 2 3 5v7c0 5 4 9 9 10 5-1 9-5 9-10V5l-9-3Zm-1 13-4-4 1.4-1.4L11 12.2l4.6-4.6L17 9l-6 6Z" />,
  lock: <path d="M6 11V8a6 6 0 0 1 12 0v3h2v11H4V11h2Zm10 0V8a4 4 0 0 0-8 0v3h8Z" />,
  user: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-5 0-8 2.5-8 6v2h16v-2c0-3.5-3-6-8-6Z" />,
  users: <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4 0-7 2-7 5v2h14v-2c0-3-3-5-7-5Zm9-1a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 1c-1 0-2 0-3 .5a8 8 0 0 1 2 4.5h5v-1c0-2.5-1.5-4-4-4Z" />,
  'credit-card': <path d="M2 5h20v14H2V5Zm2 4v2h16V9H4Z" />,
}

interface PxIconFontProps {
  name: PxIconFontName
  size?: number
  color?: string
  className?: string
}

export default function PxIconFont({
  name,
  size = 16,
  color = 'currentColor',
  className,
}: PxIconFontProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      style={{ display: 'inline-block', flexShrink: 0 }}>
      {PATHS[name]}
    </svg>
  )
}
