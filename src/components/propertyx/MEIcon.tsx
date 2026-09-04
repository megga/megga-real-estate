// MEGGA — MEIcon : système d'icônes maison unifié (ex-Property X + ex-MEIcon).
//
// Icônes line-style, stroke 1.6-1.8, rounded caps/joins, viewBox 24, tailles
// 14/16/18/22. Source unique des icônes du CRM + marketplace. Accepte `className`
// (taille via w-/h-, couleur via text-* sur currentColor, animate-spin, marges).

import type { ReactNode, CSSProperties } from 'react'
import PxIconFont, { type PxIconFontName } from './PxIconFont'

export type MEIconName =
  | 'search'
  | 'location'
  | 'chevron-down' | 'chevron-up' | 'chevron-left' | 'chevron-right'
  | 'arrow-up' | 'arrow-right' | 'arrow-down' | 'arrow-left'
  | 'bed' | 'bath' | 'surface' | 'sofa' | 'kitchen' | 'parking'
  | 'star' | 'heart' | 'share' | 'flag' | 'bookmark'
  | 'plus' | 'minus' | 'close' | 'check' | 'menu'
  | 'mail' | 'phone' | 'calendar' | 'clock' | 'lock'
  | 'home' | 'building' | 'key' | 'gallery'
  | 'sparkle' | 'shield' | 'eye' | 'globe' | 'compass'
  | 'filter' | 'sort' | 'settings' | 'download' | 'upload'
  | 'user' | 'users' | 'logout' | 'info' | 'help' | 'alert'
  | 'credit-card' | 'bell' | 'bell-ring'
  | 'edit' | 'trash' | 'copy' | 'external'
  | 'play' | 'pause' | 'refresh' | 'expand' | 'collapse'
  | 'thumb-up' | 'thumb-down' | 'message' | 'send' | 'briefcase'
  | 'pipeline' | 'camera' | 'target'
  // — Extension CRM — déléguées à PxIconFont (FONT_FALLBACK), glyphes Property X existants
  | 'file' | 'files' | 'save' | 'print' | 'link'
  | 'check-circle' | 'zoom-in' | 'zoom-out' | 'ruler' | 'door'
  | 'car' | 'store' | 'trending-up' | 'trending-down'
  | 'more-horizontal' | 'grip' | 'spinner'
  | 'dashboard' | 'chevron-up-down'
  | 'villa' | 'land' | 'warehouse'
  | 'moon' | 'sun' | 'layers' | 'bolt'
  | 'broadcast' | 'flowchart' | 'megaphone' | 'magic-wand' | 'close-circle'
  | 'flame' | 'banknote'
  // ⚠ `pin` est DESSINÉ ici et non délégué à PxIconFont : le glyphe de la fonte
  // est PLEIN (`fill={color}`), et posé à côté des tracés 1,6-1,8 de la barre
  // d'onglets il se lit comme une tache. C'est le seul glyphe que la barre
  // d'onglets demandait et que ce fichier n'avait pas.
  | 'pin'

const PATHS: Partial<Record<MEIconName, ReactNode>> = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  location: <><path d="M12 22s-7-7.5-7-13a7 7 0 0 1 14 0c0 5.5-7 13-7 13Z" /><circle cx="12" cy="9" r="2.5" /></>,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  'chevron-up': <path d="m6 15 6-6 6 6" />,
  'chevron-left': <path d="m15 6-6 6 6 6" />,
  'chevron-right': <path d="m9 6 6 6-6 6" />,
  'arrow-right': <><path d="M4 12h16" /><path d="m13 5 7 7-7 7" /></>,
  'arrow-down': <><path d="M12 4v16" /><path d="m5 13 7 7 7-7" /></>,
  bed: <><path d="M2 18v-4a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v4" /><path d="M2 18h20" /><path d="M6 10V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4" /></>,
  bath: <><path d="M9 7V5a3 3 0 0 1 6 0v2" /><path d="M2 13h20" /><path d="M3 13v4a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-4" /></>,
  surface: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 3v18" /></>,
  star: <path d="M12 2l2.95 6.27 6.81.62-5.16 4.66 1.52 6.7L12 16.7l-6.12 3.55 1.52-6.7L2.24 8.89l6.81-.62L12 2Z" />,
  heart: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" />,
  share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4" /><path d="m15.4 6.5-6.8 4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="m5 12 5 5L20 7" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></>,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  home: <><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>,
  building: <><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h.01M15 16h.01" /></>,
  key: <><circle cx="7" cy="14" r="4" /><path d="m11 14 9-9M16 9l3 3" /></>,
  gallery: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5-7 7" /></>,
  sparkle: <path d="m12 3-1.91 5.81a2 2 0 0 1-1.28 1.28L3 12l5.81 1.91a2 2 0 0 1 1.28 1.28L12 21l1.91-5.81a2 2 0 0 1 1.28-1.28L21 12l-5.81-1.91a2 2 0 0 1-1.28-1.28L12 3Z" />,
  shield: <><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></>,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  filter: <path d="M3 6h18M6 12h12M10 18h4" />,
  sort: <path d="M3 6h13M3 12h9M3 18h5M14 14l4 4 4-4M18 4v14" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.3l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2.2-1.3L14 3h-4l-.4 2.4a7 7 0 0 0-2.2 1.3l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .9.1 1.3l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2.2 1.3L10 21h4l.4-2.4a7 7 0 0 0 2.2-1.3l2.3.9 2-3.4-2-1.5c.1-.4.1-.9.1-1.3Z" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M3 20c.6-3.4 3-5 6-5s5.4 1.6 6 5" /><circle cx="17" cy="9" r="2.5" /><path d="M15 20c.4-2 1.5-3 3-3s2.6 1 3 3" /></>,
  logout: <><path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" /><path d="M10 17l-5-5 5-5" /><path d="M15 12H5" /></>,
  // Extension catalogue (icônes utilitaires marketplace)
  'arrow-up': <><path d="M12 20V4" /><path d="m5 11 7-7 7 7" /></>,
  'arrow-left': <><path d="M20 12H4" /><path d="m11 5-7 7 7 7" /></>,
  sofa: <><path d="M3 12a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v3" /><path d="M3 15v3h18v-3" /><path d="M5 12V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6" /></>,
  kitchen: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M4 11h16" /><path d="M8 7h.01M12 7h.01" /><path d="M8 15h.01M12 15h.01M16 15h.01" /></>,
  parking: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 17V7h5a3 3 0 0 1 0 6H9" /></>,
  flag: <><path d="M5 21V3" /><path d="M5 3h13l-2 5 2 5H5" /></>,
  bookmark: <path d="M6 3h12v18l-6-4-6 4V3Z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15 9-2 6-6 2 2-6 6-2Z" /></>,
  download: <><path d="M12 3v14" /><path d="m5 12 7 7 7-7" /><path d="M4 21h16" /></>,
  upload: <><path d="M12 21V7" /><path d="m5 12 7-7 7 7" /><path d="M4 3h16" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><circle cx="12" cy="7.5" r="0.6" fill="currentColor" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9 9a3 3 0 1 1 4.2 2.8c-.8.4-1.2 1-1.2 2" /><circle cx="12" cy="17" r="0.6" fill="currentColor" /></>,
  alert: <><path d="m12 2 11 19H1L12 2Z" /><path d="M12 10v5" /><circle cx="12" cy="18" r="0.6" fill="currentColor" /></>,
  'credit-card': <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /><path d="M6 15h4" /></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10 21a2 2 0 0 0 4 0" /></>,
  'bell-ring': <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10 21a2 2 0 0 0 4 0" /><path d="M3 4 2 5" /><path d="m21 4 1 1" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z" /></>,
  trash: <><path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="m5 6 1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14" /><path d="M10 11v6M14 11v6" /></>,
  copy: <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  external: <><path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></>,
  play: <path d="M5 4v16l14-8L5 4Z" />,
  pause: <><rect x="5" y="4" width="5" height="16" rx="1" /><rect x="14" y="4" width="5" height="16" rx="1" /></>,
  refresh: <><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></>,
  expand: <><path d="M21 3h-6M21 3v6M21 3l-7 7" /><path d="M3 21h6M3 21v-6M3 21l7-7" /></>,
  collapse: <><path d="M15 9h6M15 9V3M15 9l7-7" /><path d="M9 15H3M9 15v6M9 15l-7 7" /></>,
  'thumb-up': <><path d="M7 22V11" /><path d="M2 13v8a1 1 0 0 0 1 1h4V11H3a1 1 0 0 0-1 1Z" /><path d="M7 11V6a4 4 0 0 1 4-4l3 8h5a2 2 0 0 1 2 2l-2 8a2 2 0 0 1-2 2H7" /></>,
  'thumb-down': <><path d="M17 2v11" /><path d="M22 11V3a1 1 0 0 0-1-1h-4v11h4a1 1 0 0 0 1-1Z" /><path d="M17 13v5a4 4 0 0 1-4 4l-3-8H5a2 2 0 0 1-2-2l2-8a2 2 0 0 1 2-2h10" /></>,
  // Chat bubble — rounded square shape with tail (Figma Small Icon/V29).
  message: <><path d="M4 5h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8.5L6 21v-4H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /></>,
  send: <><path d="m22 2-7 20-4-9-9-4 20-7Z" /><path d="M22 2 11 13" /></>,
  // Briefcase — Figma Small Icon/V46 (Sales executives)
  briefcase: <><rect x="2" y="7" width="20" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /><path d="M2 13h20" /></>,
  // pipeline : 3 nœuds (entrée, milieu décalé, sortie) reliés par des branches
  // — symbolise un flux de travail intégré. Style Property X : line-rounded.
  pipeline: <><circle cx="5" cy="6" r="2" /><circle cx="5" cy="18" r="2" /><circle cx="19" cy="12" r="2" /><path d="M7 6h6a2 2 0 0 1 2 2v2" /><path d="M7 18h6a2 2 0 0 0 2-2v-2" /></>,
  camera: <><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" /><circle cx="12" cy="13" r="3.2" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /></>,
  // flame / banknote — glyphes MEGGA officiels (ex-crm-meicon), ajoutés pour la
  // refonte « Aujourd'hui » (carte OFFRE du focus + intention chaude du catalogue).
  flame: <path d="M12 3c2 3 5 4 5 8a5 5 0 0 1-10 0c0-1.5.6-2.7 1.5-3.5C8.7 8.5 10 7 12 3Z" />,
  banknote: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6 9.5v.01M18 14.5v.01" /></>,
  // Punaise vue de face : la tête trapézoïdale, puis la pointe. Reprise du tracé
  // de la maquette d'onglets, qui la dessine à 11 px — la pointe descend donc
  // jusqu'à 20 pour rester lisible une fois réduite.
  pin: <><path d="M9 4h6l-1 6 3.5 3.5H6.5L10 10z" /><path d="M12 13.5V20" /></>,
}

const FONT_FALLBACK: Partial<Record<MEIconName, PxIconFontName>> = {
  file: 'file', files: 'files', save: 'save', print: 'print', link: 'link',
  'check-circle': 'check-circle', 'zoom-in': 'zoom-in', 'zoom-out': 'zoom-out',
  ruler: 'dimensions', door: 'door-open', car: 'car', store: 'bank',
  'trending-up': 'chart', 'trending-down': 'chart',
  'more-horizontal': 'options', grip: 'drag', spinner: 'spinner',
  dashboard: 'dashboard', 'chevron-up-down': 'sort-asc',
  villa: 'buildings', land: 'mountain', warehouse: 'archive',
  moon: 'moon', sun: 'sun', layers: 'layers', bolt: 'lightning',
  broadcast: 'broadcast', flowchart: 'flowchart', megaphone: 'megaphone',
  'magic-wand': 'magic-wand', 'close-circle': 'close-circle',
}

interface MEIconProps {
  name: MEIconName
  size?: number
  color?: string
  strokeWidth?: number
  className?: string
  style?: CSSProperties
  fill?: string
}

export default function MEIcon({
  name,
  size = 16,
  color = 'currentColor',
  strokeWidth = 1.7,
  className,
  style,
  fill = 'none',
}: MEIconProps) {
  const path = PATHS[name]
  if (!path) {
    const fontName = FONT_FALLBACK[name]
    if (fontName) return <PxIconFont name={fontName} size={size} color={color} className={className} />
    return null
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: 'inline-block', flexShrink: 0, ...style }}>
      {path}
    </svg>
  )
}
