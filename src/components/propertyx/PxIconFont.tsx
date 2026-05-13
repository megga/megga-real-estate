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
  // Habitat & propriété
  | 'home' | 'building' | 'buildings' | 'door' | 'door-open' | 'key'
  | 'bed' | 'bath' | 'sofa' | 'kitchen' | 'dimensions' | 'parking'
  // Notifications & actions
  | 'bell' | 'bell-ring' | 'bookmark' | 'heart' | 'star' | 'flag'
  | 'calendar' | 'clock' | 'hourglass' | 'mail' | 'phone' | 'message'
  // Lieux & navigation
  | 'location' | 'globe' | 'compass' | 'map' | 'navigation'
  // Media
  | 'eye' | 'camera' | 'gallery' | 'film' | 'image' | 'play'
  // Status
  | 'check-circle' | 'close-circle' | 'info' | 'help' | 'alert' | 'alarm'
  // Sécurité
  | 'shield' | 'lock' | 'unlock'
  // Personnes
  | 'user' | 'users' | 'contacts' | 'avatar'
  // Argent
  | 'credit-card' | 'dollar' | 'euro' | 'bank' | 'briefcase'
  // Fichiers & document
  | 'file' | 'files' | 'folder' | 'folder-open' | 'archive' | 'clipboard'
  | 'book' | 'inbox' | 'copy' | 'edit'
  // Données & graphiques
  | 'chart' | 'dashboard' | 'database' | 'layers' | 'grid' | 'leaderboard'
  // Tech / utilitaire
  | 'laptop' | 'devices' | 'cloud' | 'code' | 'calculator' | 'lightbulb'
  | 'lightning' | 'droplet' | 'health' | 'headphones' | 'car'
  | 'filter' | 'fullscreen'

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
  // Extension catalogue Property X
  'door-open': <path d="M3 3h7v18H3V3Zm9 0h9v18h-9V3Zm6 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />,
  parking: <path d="M5 3h14v18H5V3Zm5 14v-4h3a3 3 0 0 0 0-6h-5v10h2Zm0-8v2h3a1 1 0 0 0 0-2h-3Z" />,
  'bell-ring': <path d="M12 2a6 6 0 0 0-6 6v4l-2 3v2h16v-2l-2-3V8a6 6 0 0 0-6-6Zm-2 18a2 2 0 0 0 4 0h-4ZM2 5l2-2 1 1L3 6l-1-1Zm17-2 2 2-1 1-2-2 1-1Z" />,
  hourglass: <path d="M6 2h12v4l-4 6 4 6v4H6v-4l4-6-4-6V2Zm2 2v1l4 6-4 6v1h8v-1l-4-6 4-6V4H8Z" />,
  message: <path d="M2 4h20v14H7l-5 4V4Zm5 6v2h10v-2H7Z" />,
  map: <path d="M2 5 9 3l6 2 7-2v16l-7 2-6-2-7 2V5Zm7-1v15l6 2V5L9 4Z" />,
  navigation: <path d="m12 2 9 19-9-5-9 5 9-19Z" />,
  film: <path d="M3 3h18v18H3V3Zm2 2v2h2V5H5Zm12 0v2h2V5h-2ZM5 9v2h2V9H5Zm12 0v2h2V9h-2ZM5 13v2h2v-2H5Zm12 0v2h2v-2h-2ZM5 17v2h2v-2H5Zm12 0v2h2v-2h-2ZM9 5v14h6V5H9Z" />,
  image: <path d="M3 3h18v18H3V3Zm5 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm-3 12 5-6 3 3 4-5 5 8H5Z" />,
  play: <path d="M5 3v18l16-9L5 3Z" />,
  alarm: <path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm1 9h-2V7h2v6ZM4 4l4 3-1 1-4-3 1-1Zm16 0 1 1-4 3-1-1 4-3Z" />,
  unlock: <path d="M6 11V8a6 6 0 0 1 11.7-2L16 7a4 4 0 0 0-8 1v3h12v11H4V11h2Z" />,
  contacts: <path d="M3 3h18v18H3V3Zm9 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm-4 12c0-2.2 1.8-4 4-4s4 1.8 4 4H8Z" />,
  avatar: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Zm0 16c-2.3 0-4.5-.8-6-2.3.1-2.5 4-3.7 6-3.7s5.9 1.2 6 3.7c-1.5 1.5-3.7 2.3-6 2.3Z" />,
  dollar: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 16v-1.5c1.7-.2 3-1.3 3-3 0-1.8-1.7-2.4-3.2-2.8-1-.3-1.8-.5-1.8-1.2 0-.7.6-1 1.5-1 .9 0 1.5.3 1.5 1H16c0-1.5-1.3-2.7-3-2.9V5h-2v1.6c-1.7.2-3 1.3-3 3 0 1.8 1.7 2.4 3.2 2.8 1 .3 1.8.5 1.8 1.2 0 .7-.6 1-1.5 1-.9 0-1.5-.3-1.5-1H8c0 1.5 1.3 2.7 3 2.9V18h2Z" />,
  euro: <path d="M12 2a10 10 0 1 0 0 20c2.7 0 5.1-1 7-2.8l-1.4-1.4A8 8 0 0 1 4.4 13H11v-2H4.1a8 8 0 0 1 13.5-4.8L19 4.8A10 10 0 0 0 12 2Z" />,
  bank: <path d="M12 2 2 7v2h20V7L12 2Zm-8 9v8H2v2h20v-2h-2v-8h-2v8h-2v-8h-2v8h-2v-8h-2v8h-2v-8H6v8H4v-8Z" />,
  briefcase: <path d="M8 4V2h8v2h5v18H3V4h5Zm2 0h4V4h-4Z" />,
  file: <path d="M6 2h9l5 5v15H6V2Zm9 1v5h5L15 3Z" />,
  files: <path d="M4 4v16h12V4H4Zm4 2h6l4 4v10H8V6Zm10 0v12h2V6h-2Zm0-2h2v2h-2V4Z" />,
  folder: <path d="M2 5h7l2 2h11v13H2V5Z" />,
  'folder-open': <path d="M2 5h7l2 2h11v3H2V5Zm0 5h20l-2 10H4L2 10Z" />,
  archive: <path d="M2 3h20v4H2V3Zm2 6h16v12H4V9Zm5 3v2h6v-2H9Z" />,
  clipboard: <path d="M8 2h8v3H8V2ZM5 4h2v3h10V4h2v18H5V4Z" />,
  book: <path d="M4 3h7v18H4V3Zm9 0h7v18h-7V3Z" />,
  inbox: <path d="M3 3h18v18H3V3Zm2 2v9h4l2 3h2l2-3h4V5H5Z" />,
  edit: <path d="M3 17v4h4l11-11-4-4L3 17Zm16-13a2 2 0 0 0-3 0l-1 1 4 4 1-1a2 2 0 0 0-1-4Z" />,
  chart: <path d="M3 3h2v18H3V3Zm6 12h2v6H9v-6Zm4-8h2v14h-2V7Zm4 4h2v10h-2V11Z" />,
  dashboard: <path d="M3 3h8v9H3V3Zm0 11h8v7H3v-7Zm10-11h8v5h-8V3Zm0 7h8v11h-8V10Z" />,
  database: <path d="M12 2c-4.4 0-8 1.3-8 3v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5c0-1.7-3.6-3-8-3Zm0 16c-3.7 0-6-1-6-1.5V14c1.4.7 3.4 1 6 1s4.6-.3 6-1v2.5c0 .5-2.3 1.5-6 1.5Zm0-5c-3.7 0-6-1-6-1.5V9c1.4.7 3.4 1 6 1s4.6-.3 6-1v2.5c0 .5-2.3 1.5-6 1.5Zm0-5c-3.7 0-6-1-6-1.5S8.3 5 12 5s6 1 6 1.5-2.3 1.5-6 1.5Z" />,
  layers: <path d="m12 2 11 6-11 6-11-6 11-6Zm-11 9 11 6 11-6-2-1-9 5-9-5-2 1Zm0 4 11 6 11-6-2-1-9 5-9-5-2 1Z" />,
  grid: <path d="M3 3h8v8H3V3Zm10 0h8v8h-8V3ZM3 13h8v8H3v-8Zm10 0h8v8h-8v-8Z" />,
  leaderboard: <path d="M3 14h5v7H3v-7Zm6-7h6v14H9V7Zm7 4h5v10h-5V11ZM12 2l1.5 3 3.5.5-2.5 2.5.6 3.5L12 9.8 8.9 11.5l.6-3.5L7 5.5l3.5-.5L12 2Z" />,
  laptop: <path d="M3 4h18v12H3V4Zm2 2v8h14V6H5ZM1 18h22v2H1v-2Z" />,
  devices: <path d="M2 3h13v9h-2V5H4v10h7v2H2V3Zm14 6h6v12h-6V9Zm2 2v8h2v-8h-2Z" />,
  cloud: <path d="M19.4 14a5 5 0 0 0-9.8-1.6A4 4 0 1 0 8 20h11a3 3 0 0 0 .4-6Z" />,
  code: <path d="m8 6-6 6 6 6 1.5-1.5L4.8 12l4.7-4.5L8 6Zm8 0-1.5 1.5L19.2 12l-4.7 4.5L16 18l6-6-6-6Z" />,
  calculator: <path d="M4 2h16v20H4V2Zm2 2v4h12V4H6Zm0 6v3h3v-3H6Zm5 0v3h3v-3h-3Zm5 0v3h3v-3h-3Zm-10 5v3h3v-3H6Zm5 0v3h3v-3h-3Zm5 0v3h3v-3h-3Z" />,
  lightbulb: <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Zm-3 17h6v2H9v-2Z" />,
  lightning: <path d="M13 2 4 14h6l-2 8 9-12h-6l2-8Z" />,
  droplet: <path d="M12 2c-3.3 4-7 7.5-7 12a7 7 0 1 0 14 0c0-4.5-3.7-8-7-12Z" />,
  health: <path d="M12 3a7 7 0 0 1 7 7c0 5-7 11-7 11s-7-6-7-11a7 7 0 0 1 7-7Zm-1 4v3H8v2h3v3h2v-3h3v-2h-3V7h-2Z" />,
  headphones: <path d="M12 2a9 9 0 0 0-9 9v8h5v-7H5v-1a7 7 0 0 1 14 0v1h-3v7h5v-8a9 9 0 0 0-9-9Z" />,
  car: <path d="M5 11 7 5h10l2 6v8h-3v-2H8v2H5v-8Zm2-1h10l-1-4H8l-1 4Zm0 4a1 1 0 1 0 2 0 1 1 0 0 0-2 0Zm8 0a1 1 0 1 0 2 0 1 1 0 0 0-2 0Z" />,
  filter: <path d="M3 4h18l-7 9v7l-4 1v-8L3 4Z" />,
  fullscreen: <path d="M3 3h7v2H5v5H3V3Zm11 0h7v7h-2V5h-5V3ZM3 14h2v5h5v2H3v-7Zm16 0h2v7h-7v-2h5v-5Z" />,
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
