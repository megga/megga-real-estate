// MEGGA Marketplace — Property X icon font system.
//
// Le DS Property X distingue deux familles d'icônes :
// - 📱 Icons     → line-style (stroke 1.6-1.8) → voir MEIcon.tsx
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
  // Recherche & nav
  | 'search' | 'link' | 'external-link' | 'back' | 'forward'
  | 'arrow-up' | 'arrow-down' | 'arrow-left' | 'arrow-right'
  | 'chevron-up' | 'chevron-down' | 'chevron-left' | 'chevron-right'
  // Annotations & communication
  | 'annotation' | 'comment' | 'chat' | 'send' | 'tag' | 'hashtag'
  | 'pin' | 'share'
  // Settings & power
  | 'settings' | 'power' | 'login' | 'logout' | 'options'
  // Actions
  | 'trash' | 'save' | 'print' | 'refresh' | 'rotate' | 'menu'
  | 'plus' | 'minus' | 'close' | 'check' | 'cancel'
  // Lifestyle & food
  | 'coffee' | 'restaurant' | 'gift' | 'music' | 'sport' | 'wine'
  | 'tea' | 'cookie' | 'pizza' | 'cake'
  // Transport
  | 'train' | 'bus' | 'plane' | 'ship' | 'truck' | 'taxi'
  | 'bicycle' | 'motorcycle' | 'walk'
  // Météo & nature
  | 'sun' | 'moon' | 'snowflake' | 'fire' | 'tree' | 'flower'
  | 'mountain' | 'water' | 'umbrella'
  // Récompenses
  | 'trophy' | 'crown' | 'medal' | 'ticket' | 'badge' | 'gem'
  // Status & émotions
  | 'thumb-up' | 'thumb-down' | 'smile' | 'sad' | 'wink'
  // UI utilitaire avancée
  | 'palette' | 'brush' | 'pencil' | 'scissors' | 'paperclip'
  | 'puzzle' | 'target' | 'magnet' | 'compass-2'
  // Stockage
  | 'package' | 'box' | 'shopping-bag' | 'shopping-cart' | 'wallet'
  // Voyage & lieux
  | 'plane-arrival' | 'plane-departure' | 'beach' | 'hotel'
  // Loader
  | 'loader' | 'spinner'
  // — Propriété & immobilier (spécifique) —
  | 'garden' | 'balcony' | 'terrace' | 'pool' | 'gym' | 'sauna'
  | 'fireplace' | 'garage' | 'basement' | 'attic' | 'elevator' | 'stairs'
  | 'roof' | 'wall' | 'window' | 'shutter' | 'doormat' | 'fence'
  // — Documents & contrats —
  | 'pdf' | 'doc' | 'xls' | 'ppt' | 'zip' | 'image-file'
  | 'video-file' | 'audio-file' | 'contract' | 'signature' | 'stamp'
  | 'invoice' | 'receipt' | 'certificate' | 'license'
  // — Finance —
  | 'transfer' | 'refund' | 'tax' | 'percent' | 'piggy-bank'
  | 'safe' | 'check' | 'cash' | 'coin' | 'savings'
  // — Outils & équipement —
  | 'tool' | 'hammer' | 'screwdriver' | 'wrench' | 'drill' | 'saw'
  | 'paint-roller' | 'measuring-tape' | 'level' | 'ladder'
  // — Connectivité & réseau —
  | 'wifi' | 'bluetooth' | 'rss' | 'antenna' | 'broadcast'
  | 'signal' | 'satellite' | 'server' | 'router' | 'cable'
  // — Mobile & device —
  | 'mobile' | 'tablet' | 'smartwatch' | 'monitor' | 'tv'
  | 'speaker' | 'mic' | 'volume' | 'mute'
  // — Direction & cible —
  | 'crosshair' | 'cursor' | 'pointer' | 'tap' | 'click'
  | 'drag' | 'resize' | 'zoom-in' | 'zoom-out'
  // — Météo détaillée —
  | 'cloudy' | 'rainy' | 'stormy' | 'thunder' | 'foggy' | 'windy'
  // — Faces & émotions étendues —
  | 'angry' | 'surprised' | 'neutral' | 'kiss' | 'cool' | 'sleepy'
  // — Visualisation / IA —
  | 'ai' | 'magic-wand' | 'sparkles' | 'star-shine' | 'idea'
  | 'brain' | 'mind' | 'robot' | 'chip' | 'circuit'
  // — Workflow —
  | 'workflow' | 'flowchart' | 'pipeline' | 'connect' | 'merge' | 'split'
  // — Photographie —
  | 'aperture' | 'focus' | 'flash' | 'exposure' | 'no-flash'
  // — Médical & santé étendu —
  | 'first-aid' | 'pill' | 'syringe' | 'stethoscope' | 'thermometer'
  // — Plantes & jardin —
  | 'plant' | 'leaf' | 'seed' | 'palm-tree' | 'cactus'
  // — Vêtement & shopping —
  | 'shirt' | 'shoe' | 'hat' | 'bag' | 'glasses'
  // — Énergie —
  | 'plug' | 'outlet' | 'battery' | 'battery-full' | 'battery-low'
  | 'solar' | 'wind-turbine' | 'recycle'
  // — Bureau —
  | 'desk' | 'chair' | 'office-chair' | 'whiteboard' | 'presentation'
  | 'projector' | 'pin-board'
  // — Bouquin / éducation —
  | 'graduation' | 'school' | 'library' | 'magazine' | 'newspaper'
  // — Plus de UI —
  | 'sort-asc' | 'sort-desc' | 'sort-az' | 'sort-za'
  | 'list-bullet' | 'list-numbered' | 'list-checkbox' | 'list-tree'
  | 'view-grid' | 'view-list' | 'view-board' | 'view-timeline'
  // — Voyage étendu —
  | 'passport' | 'luggage' | 'visa' | 'boarding-pass'
  // — Sports détaillés —
  | 'football' | 'basketball' | 'tennis' | 'golf' | 'skiing'
  | 'swimming' | 'running' | 'cycling' | 'yoga' | 'dumbbell'
  // — Web / online —
  | 'browser' | 'window-frame' | 'tab' | 'incognito'
  | 'bookmark-tab' | 'bookmarked' | 'home-page'
  // — Misc utilité —
  | 'megaphone' | 'speaker-phone' | 'antenna-broadcast'
  | 'calculator-detailed' | 'abacus' | 'binoculars' | 'magnifier'

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
  // — Catalogue étendu : Recherche & nav —
  search: <path d="M11 4a7 7 0 1 0 4.3 12.5l3.5 3.5 1.4-1.4-3.5-3.5A7 7 0 0 0 11 4Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z" />,
  link: <path d="M3.9 12a4 4 0 0 1 4-4h4v2h-4a2 2 0 0 0 0 4h4v2h-4a4 4 0 0 1-4-4Zm12.2 0a4 4 0 0 1-4 4h-4v-2h4a2 2 0 0 0 0-4h-4V8h4a4 4 0 0 1 4 4Zm-8.1-1h8v2H8Z" />,
  'external-link': <path d="M14 3v2h3.6l-7.3 7.3 1.4 1.4L19 6.4V10h2V3h-7ZM5 5h6v2H7v10h10v-4h2v6H5V5Z" />,
  back: <path d="M19 11H7.8l3.6-3.6L10 6l-6 6 6 6 1.4-1.4L7.8 13H19v-2Z" />,
  forward: <path d="M5 11h11.2l-3.6-3.6L14 6l6 6-6 6-1.4-1.4 3.6-3.6H5v-2Z" />,
  'arrow-up': <path d="M12 4 4 12h5v8h6v-8h5L12 4Z" />,
  'arrow-down': <path d="M12 20 4 12h5V4h6v8h5l-8 8Z" />,
  'arrow-left': <path d="M4 12 12 4v5h8v6h-8v5L4 12Z" />,
  'arrow-right': <path d="M20 12 12 20v-5H4v-6h8V4l8 8Z" />,
  'chevron-up': <path d="m6 14 6-6 6 6h-2.5L12 11l-3.5 3H6Z" />,
  'chevron-down': <path d="m6 10 6 6 6-6h-2.5L12 13l-3.5-3H6Z" />,
  'chevron-left': <path d="M14 6 8 12l6 6V15.5L11 12l3-3.5V6Z" />,
  'chevron-right': <path d="m10 6 6 6-6 6V15.5L13 12l-3-3.5V6Z" />,
  // — Annotations & communication —
  annotation: <path d="M3 3h18v14h-7l-5 4v-4H3V3Zm4 4v2h10V7H7Zm0 4v2h7v-2H7Z" />,
  comment: <path d="M2 4h20v14H7l-5 4V4Z" />,
  chat: <path d="M2 4h16v12H9l-7 6V4Zm18 4h4v16l-5-4h-9v-4h6c2 0 4-2 4-4V8Z" />,
  send: <path d="m22 2-11 11M22 2l-7 20-4-9-9-4 20-7Z" />,
  tag: <path d="M2 12V2h10l10 10-10 10L2 12Zm5-7a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />,
  hashtag: <path d="m20 8-1 4h-4l-1 4h4l-1 4h2l1-4h4l-1 4h2l1-4h-4l1-4h4V8h-3l1-4h-2l-1 4h-4l1-4h-2l-1 4H4v2h6Zm-3 0h4l-1 4h-4l1-4Z" />,
  pin: <path d="M16 2 8 10v3l-3 1 4 4-4 4 5-1-1 5 4-4 4 4 1-3 3-3h3l-8-8 8-8h-8Z" />,
  share: <path d="M18 16a3 3 0 0 0-2.4 1.2L8.9 13.6a3.2 3.2 0 0 0 0-3.2l6.7-3.6A3 3 0 1 0 14.4 5l-6.5 3.5a3 3 0 1 0 0 7l6.6 3.5A3 3 0 1 0 18 16Z" />,
  // — Settings & power —
  settings: <path d="m12 2 1.5 2.7L17 4l-.5 3.3L19 9l-2.5 1.7L17 14l-3.5-.7L12 16l-1.5-2.7L7 14l.5-3.3L5 9l2.5-1.7L7 4l3.5.7L12 2Zm0 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />,
  power: <path d="M13 2v10h-2V2h2Zm5 4.5L16.5 8a7 7 0 1 1-9 0L6 6.5a9 9 0 1 0 12 0Z" />,
  login: <path d="M9 4h11v16H9v-3h2v1h7V6h-7v1H9V4Zm-5 7 5-5v3h7v4h-7v3l-5-5Z" />,
  logout: <path d="M4 4h11v3h-2V6H6v12h7v-1h2v3H4V4Zm15 7-5-5v3H7v4h7v3l5-5Z" />,
  options: <path d="M5 7a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm7 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm7 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM5 14a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm7 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm7 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" />,
  // — Actions —
  trash: <path d="M9 2h6v2h5v2H4V4h5V2Zm-3 6h12l-1 14H7L6 8Zm3 2v10h2V10H9Zm4 0v10h2V10h-2Z" />,
  save: <path d="M5 3h12l4 4v14H3V3h2Zm2 2v6h10V5H7Zm3 1v4h2V6h-2ZM5 14v6h14v-6H5Z" />,
  print: <path d="M6 2h12v6H6V2Zm-4 8h20v8h-4v4H6v-4H2v-8Zm6 6v4h8v-4H8Zm10-3a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />,
  refresh: <path d="M12 4v3a5 5 0 1 1-5 5H4a8 8 0 1 0 8-8V1L7 6l5 5V4Z" />,
  rotate: <path d="M12 4a8 8 0 0 0-7.4 5L3 7l-1 1 3 5 5-3-1-1-2 1.5A6 6 0 1 1 12 18v2a8 8 0 0 0 0-16Z" />,
  menu: <path d="M3 6h18v2H3V6Zm0 5h18v2H3v-2Zm0 5h18v2H3v-2Z" />,
  plus: <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" />,
  minus: <path d="M5 11h14v2H5v-2Z" />,
  close: <path d="m12 10.6 5.7-5.7L19 6.3 13.4 12l5.7 5.7-1.4 1.4L12 13.4l-5.7 5.7-1.4-1.4L10.6 12 4.9 6.3l1.4-1.4L12 10.6Z" />,
  check: <path d="m9 17-5-5 1.4-1.4L9 14.2l9.6-9.6L20 6 9 17Z" />,
  cancel: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18A8 8 0 0 1 5 8.7L15.3 19A8 8 0 0 1 12 20Zm6.7-3.7L8.7 6A8 8 0 0 1 18.7 16.3Z" />,
  // — Lifestyle & food —
  coffee: <path d="M3 3h13v9a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V3Zm15 3h3v4a3 3 0 0 1-3 3v-2c.5 0 1-.5 1-1V8h-1V6ZM3 20h13v2H3v-2Z" />,
  restaurant: <path d="M7 2v8a3 3 0 0 0 2 2.8V22h2V12.8A3 3 0 0 0 13 10V2h-2v6h-1V2H8v6H7V2H7Zm10 0h2c1 0 2 1 2 2v8h-2v10h-2V12h-2V4c0-1 1-2 2-2Z" />,
  gift: <path d="M3 7h6.5C9 6 8 5 8 4a2 2 0 0 1 4 0c0 1-.5 2-1.5 3h3c-1-1-1.5-2-1.5-3a2 2 0 0 1 4 0c0 1-1 2-1.5 3H21v4h-2v11H5V11H3V7Zm8 4H7v9h4v-9Zm6 0h-4v9h4v-9Z" />,
  music: <path d="M9 17a3 3 0 1 1-3-3V5l13-3v12a3 3 0 1 1-3-3V6L9 8v9Z" />,
  sport: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4 4 1.5 3.5L20 8a8 8 0 0 1-1 6l-3-1-1 3 3 2A8 8 0 0 1 12 20a8 8 0 0 1-5-1.5l1.5-3-2-2.5-3 1.5A8 8 0 0 1 4 10l3-1L6 6a8 8 0 0 1 4-2l1 3h2l1-3a8 8 0 0 1 2 2Zm-4 4-3 2 1 4h4l1-4-3-2Z" />,
  wine: <path d="M8 2h8l1 7a5 5 0 0 1-4 4.9V20h3v2H8v-2h3v-6.1A5 5 0 0 1 7 9l1-7Z" />,
  tea: <path d="M4 3h13v4h2a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3h-2v2H4V3Zm15 6v6a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1Z" />,
  cookie: <path d="M12 2a10 10 0 1 0 10 10 6 6 0 0 1-6-6 4 4 0 0 1-4-4Zm-3 7a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm5 1a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm-6 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm7 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />,
  pizza: <path d="M12 2 2 21l10 1 10-1L12 2Zm0 6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm-4 5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm8 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm-4 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />,
  cake: <path d="M11 2h2v3h-2V2Zm1 4a3 3 0 0 1 3 3v3h-2v-3a1 1 0 0 0-2 0v3H9v-3a3 3 0 0 1 3-3Zm-8 8h16v8H4v-8Z" />,
  // — Transport —
  train: <path d="M4 4h16v14H4V4Zm2 2v5h12V6H6Zm0 7v3h12v-3H6Zm2 5-2 3h2l1-3Zm10 0 1 3h2l-2-3Z" />,
  bus: <path d="M4 4h16v3h-1v9h-2v3h-2v-3H9v3H7v-3H5V7H4V4Zm3 4v4h4V8H7Zm6 0v4h4V8h-4ZM7 14a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm10 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />,
  plane: <path d="m2 13 8-1V4l3 1v6l8 1v3l-8-1v6l3 1v2l-5-1-5 1v-2l3-1v-6L2 16v-3Z" />,
  ship: <path d="M11 2h2v3h5l3 6h-4v6c-2 1-3 1-5 0-2 1-3 1-5 0-2 1-3 1-5 0V11h-1l3-6h5V2H6v3h12V2H11Zm-3 5L7 9h10l-1-2H8Z" />,
  truck: <path d="M3 4h12v3h3l3 4v6h-2a2 2 0 1 1-4 0H9a2 2 0 1 1-4 0H3V4Zm12 5v3h5l-1-3h-4Z" />,
  taxi: <path d="M8 3h8v2h2v3h-1v3h2v8h-2v2h-2v-2H9v2H7v-2H5v-8h2V8H6V5h2V3Zm2 5v3h4V8h-4Z" />,
  bicycle: <path d="M5 12a5 5 0 1 0 5 5h-2a3 3 0 1 1-3-3v-2Zm14 0a5 5 0 1 1-5 5h2a3 3 0 1 0 3-3v-2Zm-7-7h3l2 4h-3l-1 2 4 3-1 2-5-4-2-4 3-3Z" />,
  motorcycle: <path d="M4 13a4 4 0 1 0 4 4h-2a2 2 0 1 1-2-2v-2Zm16 0a4 4 0 1 1-4 4h2a2 2 0 1 0 2-2v-2ZM12 5h4l2 4h-5L9 6V4h3v1Z" />,
  walk: <path d="M14 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm-2 5-3 5 2 2v8h2v-7l2-2-1-3 3 2v4h2v-5l-4-3-3-1Z" />,
  // — Météo & nature —
  sun: <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-6h2v3h-2V2Zm0 17h2v3h-2v-3ZM2 11h3v2H2v-2Zm17 0h3v2h-3v-2ZM4.2 4.2 6.4 6.4 5 7.8 2.8 5.6l1.4-1.4ZM18 17l1.4 1.4 2.2 2.2-1.4 1.4L18 19.8 18 17ZM4.2 19.8 5.6 18 7.8 16.6 6.4 18l-2.2 1.8Zm15.6-15.6L18 5.6 16.6 7l1.4-1.4L19.8 4.2Z" />,
  moon: <path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10Z" />,
  snowflake: <path d="M12 2v6l-3-2-1 1 4 3v4l-4-2-1-3-1 .5 1 3-3 1 .5 1 3-1 4 2-4 2-3-1-.5 1 3 1-1 3 1 .5 1-3 4-2v4l-4 3 1 1 3-2v6h2v-6l3 2 1-1-4-3v-4l4 2 1 3 1-.5-1-3 3-1-.5-1-3 1-4-2 4-2 3 1 .5-1-1-3 1-3-1-.5-1 3-4 2V8l4-3-1-1-3 2V2h-2Z" />,
  fire: <path d="M12 2c0 3 3 4 3 7 0 2-1 3-2 3 1-1 1-3-1-4-2 0-3 2-3 4 0 1 1 2 2 2-3 0-4-2-4-4 0-3 4-4 4-8 0-1 1 0 1 0Zm-2 13a4 4 0 1 0 8 0c0-2-2-3-4-5-2 2-4 3-4 5Z" />,
  tree: <path d="M12 2 6 9h3l-3 4h3l-3 4h6v5h2v-5h6l-3-4h3l-3-4h3l-6-7Z" />,
  flower: <path d="M12 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm-7 7a3 3 0 1 1 6 0 3 3 0 0 1-6 0Zm14 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm-3 7a3 3 0 1 1-4 0v6h4v-6ZM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />,
  mountain: <path d="m12 4 8 16H4L12 4Zm0 5-3 5h6l-3-5Z" />,
  water: <path d="M12 3c-3 4-7 7-7 12a7 7 0 0 0 14 0c0-5-4-8-7-12Z" />,
  umbrella: <path d="M12 2c4 0 9 3 10 8h-3l-2-2-2 2-3-2-3 2-2-2-2 2H2c1-5 6-8 10-8Zm0 9v9c0 1.5 1 2.5 2.5 2.5 0-1.5-1-2.5-2.5-2.5v-9Z" />,
  // — Récompenses —
  trophy: <path d="M6 2h12v6c0 2-2 4-5 4.5v3.5h3v2H8v-2h3V12.5C8 12 6 10 6 8V2Zm-3 1h2v6c0 1-1 2-2 2v-3a1 1 0 0 1 1-1V3Zm15 0h2v4a1 1 0 0 1 1 1v3c-1 0-2-1-2-2V3Z" />,
  crown: <path d="m2 8 4 4 6-8 6 8 4-4-1 12H3L2 8Z" />,
  medal: <path d="M12 2c-1 1-2 4-2 6 0 3 0 5-2 5l-3-6h3l1-4h6l1 4h3l-3 6c-2 0-2-2-2-5 0-2-1-5-2-6ZM7 14a5 5 0 1 0 10 0 5 5 0 0 0-10 0Z" />,
  ticket: <path d="M4 6c2 0 2 4 0 4v4c2 0 2 4 0 4h16c-2 0-2-4 0-4v-4c-2 0-2-4 0-4H4Zm7 0h2v2h-2V6Zm0 4h2v2h-2v-2Zm0 4h2v2h-2v-2Z" />,
  badge: <path d="m12 2 3 3h4v4l3 3-3 3v4h-4l-3 3-3-3H5v-4l-3-3 3-3V5h4l3-3Zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z" />,
  gem: <path d="m12 2 7 7-7 13L5 9l7-7Zm-3 7L12 5l3 4-3 5-3-5Z" />,
  // — Status & émotions —
  'thumb-up': <path d="M2 11h4v11H2V11Zm5 11V11l4-9 1 .5C13 4 13 6 12 9h7l-1 11c0 1-1 2-2 2H7Z" />,
  'thumb-down': <path d="M2 2h4v11H2V2Zm5 0h9c1 0 2 1 2 2l1 11h-7c1 3 1 5 0 6.5L11 22l-4-9V2Z" />,
  smile: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-3 8a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm-3 7c-2 0-4-1-5-3h10c-1 2-3 3-5 3Z" />,
  sad: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-3 8a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm-3 5c2 0 4 1 5 3H7c1-2 3-3 5-3Z" />,
  wink: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-3 8h3v1H7v-1c1 0 1-.5 2-1Zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm-3 7c-2 0-4-1-5-3h10c-1 2-3 3-5 3Z" />,
  // — UI utilitaire avancée —
  palette: <path d="M12 2a10 10 0 0 0 0 20c1 0 2-1 2-2 0-.5-.2-.9-.5-1.2-.4-.3-.5-.7-.5-1 0-1 .9-1.8 2-1.8h2c3 0 5-2 5-5 0-5-4-9-10-9Zm-5 7a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm5-3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm5 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />,
  brush: <path d="M20 2c-2 0-4 1-6 4l-4 6L8 11c-3 3-5 8-5 11 3 0 8-2 11-5l-1-2 6-4c3-2 4-4 4-6-1 0-3-1-3-3Z" />,
  pencil: <path d="m3 21 4-1 14-14-3-3L4 17l-1 4Z" />,
  scissors: <path d="M6 3a3 3 0 1 0 2 5L12 12 6 21h3l5-7 5 7h3L8 7a3 3 0 0 0-2-4Zm12 13a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" />,
  paperclip: <path d="M21 8 11 18a5 5 0 1 1-7-7L14 1l1.4 1.4L5.4 12.4a3 3 0 1 0 4.2 4.2L19.6 6.6 21 8Z" />,
  puzzle: <path d="M3 3h7v2c0 1 1 2 2 2s2-1 2-2V3h7v7h-2c-1 0-2 1-2 2s1 2 2 2h2v7h-7v-2c0-1-1-2-2-2s-2 1-2 2v2H3v-7h2c1 0 2-1 2-2s-1-2-2-2H3V3Z" />,
  target: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12Zm0 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />,
  magnet: <path d="M3 3h6v6H6v3a6 6 0 0 0 12 0V9h-3V3h6v9a9 9 0 0 1-18 0V3Z" />,
  'compass-2': <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4 6-2 6-6 2 2-6 6-2Z" />,
  // — Stockage —
  package: <path d="m12 2 9 5v10l-9 5-9-5V7l9-5Zm0 2.3L5.4 8 12 11.6 18.6 8 12 4.3Zm-7 6.4v6L11 20v-6.4L5 10.7Zm14 0L13 13.6V20l6-3.3v-6Z" />,
  box: <path d="M3 7h18v14H3V7Zm3-4h12l3 4H3l3-4Zm3 8v2h6v-2H9Z" />,
  'shopping-bag': <path d="M5 5h14l2 17H3L5 5Zm3 2v3h2V7h4v3h2V7h-2a3 3 0 1 0-6 0H8Z" />,
  'shopping-cart': <path d="M3 3h3l1 3h14l-3 9H7L5 5H3V3Zm5 16a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm10 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" />,
  wallet: <path d="M3 5h16v3h2v8h-2v3H3V5Zm14 5v4h2v-4h-2Z" />,
  // — Voyage & lieux —
  'plane-arrival': <path d="m22 18-1-2-7-2L9 4 7 3l1 7-5 1-2 1 6 4 11 3 4-1Z" />,
  'plane-departure': <path d="m2 18 4-1 11-3 6-4-2-1-5-1 1-7-2 1-5 8-7 2-1 2 1 2-2 4Z" />,
  beach: <path d="M12 2 8 6h3l-2 3h5l-2-3h3l-3-4Zm0 9-2 11h4l-2-11Zm-7 7c1 1 3 1 4 0s3-1 4 0 3 1 4 0 3-1 4 0v2H5v-2Z" />,
  hotel: <path d="M3 5h18v14H3V5Zm2 2v3h4V7H5Zm6 0v3h4V7h-4Zm6 0v3h2V7h-2ZM5 12v3h4v-3H5Zm6 0v3h4v-3h-4Zm6 0v3h2v-3h-2Z" />,
  // — Loader —
  loader: <path d="M12 2v4a6 6 0 0 0-6 6H2a10 10 0 0 1 10-10Z" />,
  spinner: <path d="M12 2v4a6 6 0 0 0-6 6H2a10 10 0 0 1 10-10Zm0 16v4A10 10 0 0 1 2 12h4a6 6 0 0 0 6 6Zm10-6a10 10 0 0 1-10 10v-4a6 6 0 0 0 6-6h4ZM12 2a10 10 0 0 1 10 10h-4a6 6 0 0 0-6-6V2Z" />,
  // — Propriété & immobilier (spécifique) —
  garden: <path d="M3 18v-2c0-2 2-3 4-3 1 0 2 .5 3 1V7a2 2 0 0 1 4 0v7c1-.5 2-1 3-1 2 0 4 1 4 3v2H3Zm0 2h18v2H3v-2Zm9-15a3 3 0 0 1 3 3v1c-1 0-2 1-3 2-1-1-2-2-3-2V8a3 3 0 0 1 3-3Z" />,
  balcony: <path d="M4 4h16v6h-2V6H6v4H4V4Zm0 8h16v10h-2v-2H6v2H4V12Zm2 2v2h2v-2H6Zm4 0v2h2v-2h-2Zm4 0v2h2v-2h-2Zm-8 4v2h12v-2H6Z" />,
  terrace: <path d="M2 8 12 2l10 6v2H2V8Zm2 4h16v8H4v-8Zm2 2v4h12v-4H6Z" />,
  pool: <path d="M2 14c1 0 2-1 3-1s2 1 3 1 2-1 3-1 2 1 3 1 2-1 3-1 2 1 3 1v2c-1 0-2-1-3-1s-2 1-3 1-2-1-3-1-2 1-3 1-2-1-3-1-2 1-3 1v-2Zm0 4c1 0 2-1 3-1s2 1 3 1 2-1 3-1 2 1 3 1 2-1 3-1 2 1 3 1v2c-1 0-2-1-3-1s-2 1-3 1-2-1-3-1-2 1-3 1-2-1-3-1-2 1-3 1v-2Zm5-13a3 3 0 1 1 6 0v6h-2V5a1 1 0 1 0-2 0v6H7V5Zm10 0a3 3 0 1 1 6 0v6h-2V5a1 1 0 1 0-2 0v6h-2V5Z" />,
  gym: <path d="M2 11h3v-3h2v3h10v-3h2v3h3v2h-3v3h-2v-3H7v3H5v-3H2v-2Z" />,
  sauna: <path d="M4 4h16v16H4V4Zm2 2v4h12V6H6Zm0 6v6h12v-6H6Zm1 2c0-1 1-2 2-2h6c1 0 2 1 2 2h-2v2H9v-2H7Z" />,
  fireplace: <path d="M3 4h18v3H3V4Zm0 5h18v13H3V9Zm2 2v9h14v-9H5Zm5 2c1-1 1 0 2 1 1-1 1-2 0-3 3 1 4 4 2 6-1 1-3 1-4 0 0-1 0-2 1-3-1-.5-1-.5-1-1Z" />,
  garage: <path d="M2 10 12 4l10 6v2h-2v8h-2v-4H6v4H4v-8H2v-2Zm6 4v2h8v-2H8Z" />,
  basement: <path d="M3 12h18v2H3v-2Zm0 4h18v2H3v-2Zm0 4h18v2H3v-2ZM12 2l10 8H2L12 2Z" />,
  attic: <path d="M12 2 2 14h3v8h14v-8h3L12 2Zm0 3 7 9H5l7-9Z" />,
  elevator: <path d="M5 3h14v18H5V3Zm2 2v14h10V5H7Zm5 1 3 3h-2v3h-2V9H9l3-3Zm0 12-3-3h2v-3h2v3h2l-3 3Z" />,
  stairs: <path d="M3 20v-2h3v-3h3v-3h3V9h3V6h3V3h3v17H3Z" />,
  roof: <path d="M2 14 12 4l10 10v6H2v-6Zm10-7-7 7h14l-7-7Z" />,
  wall: <path d="M3 4h18v4h-4v4h4v4h-8v4h4v4H3V4Zm2 2v4h6V6H5Zm8 0v4h6V6h-6ZM5 12v4h6v-4H5Zm0 6v4h4v-4H5Z" />,
  window: <path d="M4 3h16v18H4V3Zm2 2v6h5V5H6Zm7 0v6h5V5h-5ZM6 13v6h5v-6H6Zm7 0v6h5v-6h-5Z" />,
  shutter: <path d="M3 3h18v3H3V3Zm0 4h18v3H3V7Zm0 4h18v3H3v-3Zm0 4h18v3H3v-3Zm0 4h18v3H3v-3Z" />,
  doormat: <path d="M3 17h18v2H3v-2Zm2-2h14v1H5v-1Zm-1-3h16v1H4v-1Zm0-3h2v2H4v-2Zm4 0h2v2H8v-2Zm4 0h2v2h-2v-2Zm4 0h2v2h-2v-2Z" />,
  fence: <path d="M3 8h2V4l2-2 2 2v4h2V4l2-2 2 2v4h2V4l2-2 2 2v4h2v3H3V8Zm0 5h18v3H3v-3Zm0 5h18v3H3v-3Z" />,
  // — Documents & contrats —
  pdf: <path d="M6 2h9l5 5v15H6V2Zm9 1v5h5L15 3ZM8 11h2c1 0 2 1 2 2s-1 2-2 2H9v2H8v-6Zm1 1v2c1 0 1-.5 1-1s0-1-1-1Zm4-1h2c1.5 0 2 .7 2 2v2c0 1.3-.5 2-2 2h-2v-6Zm1 1v4h1c.5 0 1-.3 1-1v-2c0-.7-.5-1-1-1h-1Zm4-1h3v1h-2v2h2v1h-2v2h-1v-6Z" />,
  doc: <path d="M6 2h9l5 5v15H6V2Zm9 1v5h5L15 3ZM8 11h2v6H8v-6Zm3 0h2c1.5 0 2 .7 2 2v2c0 1.3-.5 2-2 2h-2v-6Zm1 1v4h1c.5 0 1-.3 1-1v-2c0-.7-.5-1-1-1h-1Zm4 0v6h1v-3l1 3h1v-6h-1v3l-1-3h-1Z" />,
  xls: <path d="M6 2h9l5 5v15H6V2Zm9 1v5h5L15 3ZM8 12l1.5 2.5L8 17h1l1-2 1 2h1l-1.5-2.5L12 12h-1l-1 2-1-2H8Zm5 0h1v4h2v1h-3v-5Zm5 0v1l-1.5.5 1.5.5v1l-2-1v2h-1v-4l2 1 1-1Z" />,
  ppt: <path d="M6 2h9l5 5v15H6V2Zm9 1v5h5L15 3ZM8 11h2c1 0 2 1 2 2s-1 2-2 2H9v2H8v-6Zm1 1v2c1 0 1-.5 1-1s0-1-1-1Zm3-1h2c1 0 2 1 2 2s-1 2-2 2h-1v2h-1v-6Zm1 1v2c1 0 1-.5 1-1s0-1-1-1Zm3-1h4v1h-1.5v5H17v-5h-1v-1Z" />,
  zip: <path d="M6 2h9l5 5v15H6V2Zm9 1v5h5L15 3Zm-4 0h-2v2H9v2h2v2H9v2h2v2H9v2h2c1 0 2-1 2-2v-2c0-1-1-1-1-1s1 0 1-1V5c0-1-1-2-2-2Z" />,
  'image-file': <path d="M6 2h9l5 5v15H6V2Zm9 1v5h5L15 3ZM8 12h10v8H8v-8Zm2 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm-1 5 3-3 2 2 2-2v3H9Z" />,
  'video-file': <path d="M6 2h9l5 5v15H6V2Zm9 1v5h5L15 3ZM8 12h10v8H8v-8Zm3 1v6l5-3-5-3Z" />,
  'audio-file': <path d="M6 2h9l5 5v15H6V2Zm9 1v5h5L15 3ZM10 12v6.5a1.5 1.5 0 1 1-1-1.5V13h6v4.5a1.5 1.5 0 1 1-1-1.5V12h-4Z" />,
  contract: <path d="M5 2h11l4 4v16H5V2Zm10 1v4h4l-4-4ZM7 9v1h10V9H7Zm0 3v1h10v-1H7Zm0 3v1h7v-1H7Zm0 3v1h5v-1H7Zm6 0 3-3 1 1-3 3-1-1Z" />,
  signature: <path d="M3 17c4 0 6-13 9-13 2 0 3 6 5 6 1 0 2-1 3-2v3c-2 1-3 2-4 2-3 0-4-6-5-6-2 0-3 13-8 13v-3Zm0 4h18v2H3v-2Z" />,
  stamp: <path d="M12 2c-2 0-4 2-4 4 0 1 .5 2 1 3-1 0-2 1-2 2v3h10v-3c0-1-1-2-2-2 .5-1 1-2 1-3 0-2-2-4-4-4Zm-7 14h14v3H5v-3Zm0 4h14v2H5v-2Z" />,
  invoice: <path d="M5 2h14v20l-2-2-2 2-2-2-2 2-2-2-2 2-2-2V2Zm2 4v2h10V6H7Zm0 4v2h10v-2H7Zm0 4v2h7v-2H7Z" />,
  receipt: <path d="M5 2h14v22l-2-2-2 2-2-2-2 2-2-2-2 2-2-2V2Zm2 4v2h10V6H7Zm0 4v2h10v-2H7Zm0 4v2h6v-2H7Z" />,
  certificate: <path d="M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2ZM9 13v8l3-2 3 2v-8c-1 .5-2 1-3 1s-2-.5-3-1Z" />,
  license: <path d="M3 5h18v14H3V5Zm2 2v10h14V7H5Zm2 2h6v2H7V9Zm0 4h10v1H7v-1Zm0 2h10v1H7v-1Zm9-6a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" />,
  // — Finance détaillée —
  transfer: <path d="M5 6h12V4l4 4-4 4V10H5V6Zm14 8H7v-2l-4 4 4 4v-2h12v-4Z" />,
  refund: <path d="M5 12a7 7 0 0 1 12-5l2-2v6h-6l2-2a5 5 0 1 0-1 8l1.4 1.4A7 7 0 0 1 5 12Z" />,
  tax: <path d="M5 2h14v20H5V2Zm2 2v2h10V4H7Zm0 4v3h3V8H7Zm5 0v3h3V8h-3ZM7 13v3h3v-3H7Zm5 0v3h3v-3h-3Zm-5 5v2h10v-2H7Z" />,
  percent: <path d="M7 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm10 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM18 5 5 19l1.5 1.5L19.5 6.5 18 5Z" />,
  'piggy-bank': <path d="M5 12c0-3 2-5 5-5h7l3-2v4l-1 1c1 1 1 2 1 3v3h-2l-2 3h-2l-1-2c-1 0-2 0-3-.3l-1 2.3H7l-2-3H3v-3h2v-1Zm10 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />,
  safe: <path d="M3 3h18v18H3V3Zm2 2v14h14V5H5Zm10 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm-1 5v2h-4v-2h4Z" />,
  copy: <path d="M5 4h12l2 4v12H5V4Zm2 4v2h10l-1-2H7Zm0 4v2h10v-2H7Zm0 4v2h7v-2H7Z" />,
  cash: <path d="M3 5h18v14H3V5Zm2 4v6c1 0 2 1 2 2h10c0-1 1-2 2-2V9c-1 0-2-1-2-2H7c0 1-1 2-2 2Zm7-1a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" />,
  coin: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12Zm-1 2v1H9v2h2v1H9v2h2v1h2v-1h2v-2h-2v-1h2V9h-2V8h-2Z" />,
  savings: <path d="M12 3 5 8v3h2v8h10v-8h2V8l-7-5Zm0 2.5L17 9v1H7V9l5-3.5Zm-3 8h2v3H9v-3Zm4 0h2v3h-2v-3Z" />,
  // — Outils & équipement —
  tool: <path d="M22 6 18 2l-4 4 1 1-7 7-2-1-3 3 6 6 3-3-1-2 7-7 1 1Z" />,
  hammer: <path d="M14 2 7 9l-1 4-4 4 4 4 4-4 4-1 7-7-7-7Zm0 3 4 4-2 2-4-4 2-2Z" />,
  screwdriver: <path d="m4 20 3 1 9-9-4-4-9 9 1 3Zm13-13 5-5-4-1-1-4-5 5 5 5Z" />,
  wrench: <path d="M21 7a5 5 0 0 0-7 0c-1.5 1.5-1.5 4 0 6L4 23l1 1L18 11c2 1 4.5 1.5 6-0 2-2 1.5-5 0-7l-3 3-1-1 1-1Z" />,
  drill: <path d="M3 6h12v3H3V6Zm0 3v4h2v4h2v-4h2v4h2v-4h2V9H3Zm14-1 4-3v6l-4-3Zm0 0v4l4-3v-1l-4-0Z" />,
  saw: <path d="m2 17 8-8h11l-7 9-3-3-2 2-3-3-2 3-2 0Zm10-8 1-3 2-1 3 1 3-1 2 1 1 2-1 3-3 2-3-1-3 1-1 1h-1Z" />,
  'paint-roller': <path d="M3 4h12v5H3V4Zm0 7h12v2H3v-2Zm5 4h2v6H8v-6Zm-2 0v4h6v-4h-6Zm12-9h2v6h-2V6Z" />,
  'measuring-tape': <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM7 12a5 5 0 1 1 10 0 5 5 0 0 1-10 0Zm5-3v3h2v-3h-2Zm-3 3v2h2v-2H9Zm6 0v2h2v-2h-2Zm-3 3v2h2v-2h-2Z" />,
  level: <path d="M2 9h20v6H2V9Zm10 0v2h-2V9H8v6h2v-2h2v2h2V9h-2Z" />,
  ladder: <path d="M6 2v20h2V2H6Zm10 0v20h2V2h-2ZM8 5h8v2H8V5Zm0 4h8v2H8V9Zm0 4h8v2H8v-2Zm0 4h8v2H8v-2Z" />,
  // — Connectivité —
  wifi: <path d="M12 19a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm0-5a5 5 0 0 0-5 3l-2-2a7 7 0 0 1 14 0l-2 2a5 5 0 0 0-5-3Zm0-5a10 10 0 0 0-9 5l-2-2a13 13 0 0 1 22 0l-2 2a10 10 0 0 0-9-5Z" />,
  bluetooth: <path d="m7 4 10 8-5 4v4l5-4 5 4-10 8L7 12 17 4 12 8V4H7Z" />,
  rss: <path d="M4 4a16 16 0 0 1 16 16h-3A13 13 0 0 0 4 7V4Zm0 6a10 10 0 0 1 10 10h-3A7 7 0 0 0 4 13v-3Zm0 6a4 4 0 0 1 4 4H4v-4Z" />,
  antenna: <path d="M12 2 5 9l1 1 6-6 6 6 1-1L12 2Zm0 3-4 4 1 1 3-3 3 3 1-1-4-4Zm-1 6v11h2V11h-2Z" />,
  broadcast: <path d="M12 2 5 16h3l4-9 4 9h3L12 2Zm0 13a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" />,
  signal: <path d="M3 18h2v3H3v-3Zm4-4h2v7H7v-7Zm4-4h2v11h-2V10Zm4-4h2v15h-2V6Zm4-4h2v19h-2V2Z" />,
  satellite: <path d="m4 17 3-3 4 4-3 3-4-4Zm6-6 3-3 4 4-3 3-4-4Zm-1 9c-2 0-4-1-4-3l2-2c0 1 1 2 2 2l2 2Zm-5-5c0-2 1-4 3-4l2 2c-1 0-2 1-2 2L4 15Zm14 4 2 2c-2 1-4 1-6 0l1-2c1 1 2 1 3 0Zm-2-2 2-2c1 1 1 2 0 3l-2-1Z" />,
  server: <path d="M3 4h18v6H3V4Zm0 8h18v6H3v-6Zm2-7v2h2V5H5Zm0 8v2h2v-2H5Zm10-8v2h2V5h-2Zm0 8v2h2v-2h-2Z" />,
  router: <path d="M3 14h18v6H3v-6Zm2 2v2h2v-2H5Zm10 0v2h2v-2h-2ZM7 8l2 2-2 2 3-3-3-3 2 2ZM9 4l4 4-4 4 5-5-5-5 4 4Zm6 0 3 3-3 3 4-4-4-4 3 3Z" />,
  cable: <path d="M5 2v4h2V2H5Zm10 0v4h2V2h-2ZM4 6h6v3H4V6Zm10 0h6v3h-6V6Zm-7 4v8a5 5 0 0 0 10 0v-8h-2v8a3 3 0 0 1-6 0v-8H7Z" />,
  // — Devices —
  mobile: <path d="M7 2h10v20H7V2Zm2 2v14h6V4H9Zm3 15a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />,
  tablet: <path d="M5 2h14v20H5V2Zm2 2v14h10V4H7Zm5 15a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />,
  smartwatch: <path d="M9 2h6v3h2v14h-2v3H9v-3H7V5h2V2Zm0 5v10h6V7H9Z" />,
  monitor: <path d="M3 4h18v12H3V4Zm5 14h8v2H8v-2Z" />,
  tv: <path d="M3 5h18v13H3V5Zm2 2v9h14V7H5Zm3 13h8v2H8v-2Z" />,
  speaker: <path d="M5 3h14v18H5V3Zm2 2v3h10V5H7Zm5 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" />,
  mic: <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Zm-5 9a5 5 0 0 0 10 0h2a7 7 0 0 1-6 7v3h-2v-3a7 7 0 0 1-6-7h2Z" />,
  volume: <path d="M3 9h4l5-4v14l-5-4H3V9Zm12 1 5-1v6l-5-1v-4Z" />,
  mute: <path d="M3 9h4l5-4v14l-5-4H3V9Zm15-1 4 8-1 1-4-3-4 3-1-1 4-8h2Z" />,
  // — Direction & cible —
  crosshair: <path d="M11 2v3h2V2h-2Zm0 17v3h2v-3h-2ZM2 11h3v2H2v-2Zm17 0h3v2h-3v-2Zm-7 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />,
  cursor: <path d="m3 2 14 7-6 1 4 9-2 1-4-9-6 1V2Z" />,
  pointer: <path d="M5 3v15l4-3 3 7 3-1-3-7 4-1L5 3Z" />,
  tap: <path d="M8 9V6a2 2 0 1 1 4 0v6l2-2 2 1-1 7H7l-3-5 2-1 2 3V9Z" />,
  click: <path d="M9 4a7 7 0 0 0-3 5l1 1c1-2 2-3 4-3v2c-1 0-2 1-2 2l-3 9 4-1 5-3 1-4c0-3-3-7-7-8Zm9 6 4-2-2-2-2 4Zm-3-4 2-4-2-2v4l-4 2 2 2 2-2Zm5 6h4l-2 2 2 2h-4v-4Z" />,
  drag: <path d="M9 4h2v2H9V4Zm0 4h2v2H9V8Zm0 4h2v2H9v-2Zm0 4h2v2H9v-2Zm4-12h2v2h-2V4Zm0 4h2v2h-2V8Zm0 4h2v2h-2v-2Zm0 4h2v2h-2v-2Z" />,
  resize: <path d="M3 3h7v2H5v5H3V3Zm11 0h7v7h-2V5h-5V3ZM3 14h2v5h5v2H3v-7Zm16 0h2v7h-7v-2h5v-5ZM8 8h8v8H8V8Z" />,
  'zoom-in': <path d="M11 4a7 7 0 1 1-7 7 7 7 0 0 1 7-7Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm-1 2v2H8v2h2v2h2v-2h2v-2h-2V8h-2Zm6 10 4 4-2 2-4-4 2-2Z" />,
  'zoom-out': <path d="M11 4a7 7 0 1 1-7 7 7 7 0 0 1 7-7Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM7 10h8v2H7v-2Zm9 8 4 4-2 2-4-4 2-2Z" />,
  // — Météo détaillée —
  cloudy: <path d="M19 9a6 6 0 0 0-12 0 4 4 0 0 0 0 8h12a4 4 0 0 0 0-8Z" />,
  rainy: <path d="M19 5a6 6 0 0 0-12 0 4 4 0 0 0 0 8h12a4 4 0 0 0 0-8Zm-12 11 2-3-1-1-2 3 1 1Zm5 0 2-3-1-1-2 3 1 1Zm5 0 2-3-1-1-2 3 1 1Zm-9 4 2-3-1-1-2 3 1 1Zm5 0 2-3-1-1-2 3 1 1Zm5 0 2-3-1-1-2 3 1 1Z" />,
  stormy: <path d="M19 7a6 6 0 0 0-12 0 4 4 0 0 0 0 8h12a4 4 0 0 0 0-8Zm-10 9-1 3h2l-2 5 4-5h-2l1-3H9Z" />,
  thunder: <path d="M13 2 4 13h6l-2 9 11-12h-6l2-8h-2Z" />,
  foggy: <path d="M2 8h20v2H2V8Zm2 4h20v2H4v-2Zm-2 4h20v2H2v-2Zm2 4h16v2H4v-2Z" />,
  windy: <path d="M2 7h12a2 2 0 1 0 0-4l-1 2 1 2Zm0 5h14a2 2 0 1 0 0-4l-1 2 1 2Zm0 5h16a2 2 0 1 0 0-4l-1 2 1 2Z" />,
  // — Émotions étendues —
  angry: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-3 8L7 8h4l-2 2Zm6 0-2-2h4l-2 2Zm-3 5c2 0 4 1 5 3H7c1-2 3-3 5-3Z" />,
  surprised: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-3 8a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm-3 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />,
  neutral: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-3 8a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm-7 6h10v1H8v-1Z" />,
  kiss: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-3 8a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm-2 6c-1 1-3 1-4 0l2-2 2 2Z" />,
  cool: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-5 6h4v3H7c-1 0-1-1-1-2s.5-1 1-1Zm6 0h4c.5 0 1 0 1 1s0 2-1 2h-4V8Zm-1 9c-2 0-4-1-5-3h10c-1 2-3 3-5 3Z" />,
  sleepy: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-4 6h4v1H8V8Zm4 0h4v1h-4V8Zm-1 6a2 2 0 1 0-2 2h4a2 2 0 1 0-2-2Z" />,
  // — IA & visualisation —
  ai: <path d="M12 2 9 9 2 12l7 3 3 7 3-7 7-3-7-3-3-7Zm0 5 2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4Z" />,
  'magic-wand': <path d="M9 2 11 7 14 8 11 9 9 14 7 9 4 8 7 7 9 2Zm5 7-7 7 1 1 7-7-1-1Zm5 6 1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z" />,
  sparkles: <path d="m5 3 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Zm10 5 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Zm-7 8 1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z" />,
  'star-shine': <path d="M12 2 14.7 9 22 9.6l-5.6 4.7L18 22l-6-3.6L6 22l1.6-7.7L2 9.6 9.3 9 12 2Zm-8 16 2 2-2 2-1-1 1-1-1-1 1-1Zm16 0 1 1-1 1 1 1-1 1-2-2 2-2Z" />,
  idea: <path d="M12 2a7 7 0 0 1 4 12.7V17H8v-2.3A7 7 0 0 1 12 2Zm-3 17h6v2H9v-2Zm1 3h4v1h-4v-1Z" />,
  brain: <path d="M9 2a3 3 0 0 0-3 3v1a3 3 0 0 0-2 3v2c0 1 .5 2 1 3-1 .5-1 1.5-1 3v1a3 3 0 0 0 3 3h4V2H9Zm6 0v20h4a3 3 0 0 0 3-3v-1c0-1.5 0-2.5-1-3 .5-1 1-2 1-3v-2a3 3 0 0 0-2-3V5a3 3 0 0 0-3-3h-2Z" />,
  mind: <path d="M12 2a4 4 0 0 0-4 4 4 4 0 0 0-3 7 3 3 0 0 0 1 5l-1 2 5-2v3h4v-3l5 2-1-2a3 3 0 0 0 1-5 4 4 0 0 0-3-7 4 4 0 0 0-4-4Zm0 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />,
  robot: <path d="M8 2v3H5v6h2v9h10v-9h2V5h-3V2h-2v3h-4V2H8Zm1 7a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm6 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm-6 5h6v2H9v-2Z" />,
  chip: <path d="M5 5h14v14H5V5Zm2 2v10h10V7H7Zm-3-1V3h2v3H4Zm14 0V3h2v3h-2ZM4 21v-3h2v3H4Zm14 0v-3h2v3h-2ZM3 9V7h-1V9h1Zm0 6v-2h-1v2h1Zm18-6V7h1V9h-1Zm0 6v-2h1v2h-1Z" />,
  circuit: <path d="M3 6h2v2H3V6Zm4 0h2v4H7V6Zm4 0h2v6h-2V6Zm4 0h2v8h-2V6Zm4 0h2v10h-2V6ZM3 12h2v2H3v-2Zm4 4h2v2H7v-2Zm4-2h2v4h-2v-4Zm4 2h2v2h-2v-2Z" />,
  // — Workflow —
  workflow: <path d="M3 3h6v6H3V3Zm12 12h6v6h-6v-6ZM3 15h6v6H3v-6Zm6-9h3v2H9V6Zm3 9h3v-2h-3v2Zm0-4h6v-2h-6v2Z" />,
  flowchart: <path d="M9 3h6v4h-2v3h5v4h-2v4h-4v-4H8v4H4v-4h2v-4h5V7H9V3Z" />,
  pipeline: <path d="M2 9h6v2H4v8H2V9Zm6 4h4v2H8v-2Zm6 0h2v4h2v-4h4v8h-4v-2h-4v2h-2v-8Zm0-8h6v2h-2v6h-2V7h-2V5Z" />,
  connect: <path d="M5 4a3 3 0 1 0 3 3H5V4Zm14 13a3 3 0 1 0-3 3v-3h3ZM8 7h2v4l4 4v2h-2v-2l-4-4V7Z" />,
  merge: <path d="M5 3h4v2H5V3Zm10 0h4v2h-4V3ZM7 7l5 5 5-5v6l-5 5-5-5V7Z" />,
  split: <path d="M5 19h4v2H5v-2Zm10 0h4v2h-4v-2ZM7 17V11l5-5 5 5v6l-5-5-5 5Z" />,
  // — Photographie —
  aperture: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 4 1.5 3-1 .5L10 7l1-1Zm5 3-1 2.5-2-1L15 7l1 2Zm2 5-2.5-1 1-2 1.5 1v2ZM12 18l-1.5-3 1-.5L13 16l-1 2Zm-5-3 1-2.5 2 1L9 16l-2-1Zm-2-5 2.5 1-1 2L5 12v-2Z" />,
  focus: <path d="M3 3h7v2H5v5H3V3Zm11 0h7v7h-2V5h-5V3ZM3 14h2v5h5v2H3v-7Zm16 0h2v7h-7v-2h5v-5ZM12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" />,
  flash: <path d="M13 2 4 13h6l-2 9 11-12h-6l2-8h-2Z" />,
  exposure: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 4h2v3h3v2h-3v3h3v2h-3v3h-2v-3H8v-2h3v-3H8V9h3V6Z" />,
  'no-flash': <path d="m2 2 20 20-1.5 1.5L18 21l-9 1 2-9L2 4l1.5-1.5L2 2Zm11 0 6 11h-3l2 5L9 22l9-12 1 1Z" />,
  // — Médical —
  'first-aid': <path d="M5 7h14v15H5V7Zm-2-4h18v3H3V3Zm9 6v3H9v2h3v3h2v-3h3v-2h-3V9h-2Z" />,
  pill: <path d="M9 2a7 7 0 1 0 7 14L21 11A7 7 0 0 0 16 4L11 9 6 4 5 5l5 5-5 5 1 1 5-5 5 5-5-5-1-1Z" />,
  syringe: <path d="m18 2 4 4-3 3-1-1-2 2 1 1-2 2-2-2-1 1L6 5 4 7l1 1L2 11l1 1 3-3 1 1 6 6 1-1 2 2-1 1 1 1 3-3 1 1 3-3-4-4-1-1Z" />,
  stethoscope: <path d="M5 3v8a4 4 0 0 0 4 4 4 4 0 0 0 4-4V3h-2v8a2 2 0 0 1-4 0V3H5Zm10 16a4 4 0 1 1 0-8c0-4-1-4-4-4v-2c4 0 6 1 6 6a2 2 0 1 0 2 2 2 2 0 1 0-2-2h-2c0 2 2 4 4 4s4-2 4-4-2-4-4-4Z" />,
  thermometer: <path d="M12 2a3 3 0 0 1 3 3v9.5a5 5 0 1 1-6 0V5a3 3 0 0 1 3-3Z" />,
  // — Plantes —
  plant: <path d="M12 22V13c-2 0-7-2-7-7 5 0 7 5 7 5s-1-7 5-7c0 6-3 7-5 9v9h-2v-9c-2-2-5-3-5-9 6 0 7 7 7 7Z" />,
  leaf: <path d="M17 2c-6 0-9 5-13 12 1 2 4 6 8 7 7 1 12-8 10-19Zm-1 4c-2 5-5 8-9 11l1 1c4-2 7-6 9-12h-1Z" />,
  seed: <path d="M12 2c4 0 6 4 6 8s-2 12-6 12-6-8-6-12 2-8 6-8Zm0 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />,
  'palm-tree': <path d="M11 22V9c-3 1-5 0-5 0s5-3 7-7c2 4 7 7 7 7s-2 1-5 0v13h-4Z" />,
  cactus: <path d="M10 22V8a3 3 0 0 0-3-3v6a3 3 0 0 0 3 3v8h4v-5a3 3 0 0 0 3-3V8a3 3 0 0 0-3 3v-5a3 3 0 0 0-3-3v19h-1Z" />,
  // — Vêtement & shopping —
  shirt: <path d="M5 3h4l1 2h4l1-2h4l4 3-3 4-2-1v13H6V9l-2 1-3-4 4-3Z" />,
  shoe: <path d="M2 14c0-3 4-5 6-7l3 1 2-4h3v5l4 2c2 1 4 2 4 4v3H2v-4Z" />,
  hat: <path d="M12 2a4 4 0 0 0-4 4v8H6v3h12v-3h-2V6a4 4 0 0 0-4-4Z" />,
  bag: <path d="M5 5h14l2 17H3L5 5Zm3 2v3h2V7h4v3h2V7" />,
  glasses: <path d="M5 8h6l1 1 1-1h6l2 6c0 3-2 5-5 5s-5-2-5-4c0-2-2-2-2 0s-1 4-4 4-5-2-5-5l2-6Zm2 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm10 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />,
  // — Énergie —
  plug: <path d="M9 2v6H7l1 5 4 2 4-2 1-5h-2V2h-2v6h-2V2H9Z" />,
  outlet: <path d="M5 3h14v18H5V3Zm2 2v14h10V5H7Zm2 4v3h2V9H9Zm4 0v3h2V9h-2Zm-2 5v3h2v-3h-2Z" />,
  battery: <path d="M4 7h14v10H4V7Zm15 2h2v6h-2V9Z" />,
  'battery-full': <path d="M4 7h14v10H4V7Zm15 2h2v6h-2V9Zm-13 2v6H6v-6Zm3 0v6h-1v-6Zm3 0v6h-1v-6Zm3 0v6h-1v-6Z" />,
  'battery-low': <path d="M4 7h14v10H4V7Zm15 2h2v6h-2V9ZM6 11v6h2v-6H6Z" />,
  solar: <path d="M2 12h20l-4 8H6L2 12Zm10-8 2 2-2 2-2-2 2-2Zm-7 3 3 1-1 3-3-1 1-3Zm14 0 1 3-3 1-1-3 3-1Z" />,
  'wind-turbine': <path d="M11 22V11c-1 0-2-1-2-2 0-1 4-4 4-6-3 0-7 1-7 4-1-1-2-1-3-1 1 2 2 4 3 5-1 0-2 0-3 1 2 0 4 1 5 1V22h3Z" />,
  recycle: <path d="m8 2 4 7-2 2-3-2v3H4l4 6h2l-2 2H4l-2-3 3-1V8L7 6l1 1V2Zm12 6 1 5-3 1-2-5h-3v3l-4-6 6-4 1 3-2 2 6 1Zm-1 14h-7l-1-3 3-1 2 5h2l3-6h2l-1-2-2 7h-1Z" />,
  // — Bureau —
  desk: <path d="M3 5h18v3H3V5Zm0 5h2v10H3V10Zm16 0h2v10h-2V10ZM6 12h12v2H6v-2Z" />,
  chair: <path d="M6 2h12v7l-1 1H7l-1-1V2Zm0 12h12l-1 8h-2l-1-6h-4l-1 6H7l-1-8Z" />,
  'office-chair': <path d="M9 2h6c2 0 3 1 3 3v6H6V5c0-2 1-3 3-3ZM6 13h12v3l-1 1h-4v3l3 2v1H8v-1l3-2v-3H7l-1-1v-3Z" />,
  whiteboard: <path d="M2 4h20v14H2V4Zm2 2v10h16V6H4Zm0 16 3-3 3 3H4Zm14 0 3-3-3-3v6h-3 3Z" />,
  presentation: <path d="M3 3h18v3H3V3Zm1 4h16v11l-7-3-8 3V7Zm6 12 2 3 2-3h-4Z" />,
  projector: <path d="M3 10h18v8H3v-8Zm0-2h2V6h2v2h10V6h2v2h2v1H3V8Zm12 5a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" />,
  'pin-board': <path d="M3 3h18v18H3V3Zm2 2v14h14V5H5Zm4 4v6h6V9H9Z" />,
  // — Éducation —
  graduation: <path d="M12 3 2 8l4 2v5l6 4 6-4v-5l2-1v6h2v-7l-10-5Zm0 2.3 6 2.7-6 2.7-6-2.7 6-2.7ZM8 11.5l4 2 4-2v3l-4 2.5-4-2.5v-3Z" />,
  school: <path d="M2 9 12 3l10 6v2h-2v9h-4v-6H8v6H4v-9H2V9Zm10 1a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />,
  library: <path d="M3 3h2v18H3V3Zm3 0h2v18H6V3Zm3 0h4l3 18h-4L9 3Zm5 0 3 3v15h-3V3Zm4 1 4 14-1 1-4-14 1-1Z" />,
  magazine: <path d="M5 2h14v20H5V2Zm2 2v3h10V4H7Zm0 5v8h10V9H7Zm0 9v2h10v-2H7Z" />,
  newspaper: <path d="M3 3h13v18H3V3Zm2 2v14h9V5H5Zm2 2h5v3H7V7Zm0 5h5v1H7v-1Zm0 3h5v1H7v-1Zm10-7h4v12c0 1-1 2-2 2v-2c1 0 1-1 1-1V8h-3V7Z" />,
  // — Sort & view —
  'sort-asc': <path d="M5 5v14l3-3-1-1-1 1V5H5Zm6 0h10v2H11V5Zm0 4h8v2h-8V9Zm0 4h6v2h-6v-2Zm0 4h4v2h-4v-2Z" />,
  'sort-desc': <path d="M7 5v14l-3-3 1-1 1 1V5h1Zm4 0h10v2H11V5Zm0 4h8v2h-8V9Zm0 4h6v2h-6v-2Zm0 4h4v2h-4v-2Z" />,
  'sort-az': <path d="M3 4h2L3 9h2L4 6l1 3h1L4 4H3Zm3 6h12V8H6v2Zm0 4h12v-2H6v2Zm0 4h12v-2H6v2Zm-3 0h4l-2-3 1-1 1 2v-3h1v3l1-2 1 1-2 3Z" />,
  'sort-za': <path d="M3 18h2l-2-5h2l-1 3 1-3h1l-2 5H3Zm3-12h12v2H6V6Zm0 4h12v2H6v-2Zm0 4h12v2H6v-2Zm-3-8h4l-2 3 1 1 1-2v3h1V7l1 2 1-1-2-3Z" />,
  'list-bullet': <path d="M4 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm0 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm0 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm0 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm4-12h12v2H8V6Zm0 4h12v2H8v-2Zm0 4h12v2H8v-2Zm0 4h12v2H8v-2Z" />,
  'list-numbered': <path d="M3 5h2v3H3V5Zm0 4h3v1l-2 2h2v1H3v-1l2-2H3V9Zm0 4h2v1H4v1h1v1H3v-1h1v-1H3v-1Zm0 4h3v1H5v3H3v-4Zm5-12h12v2H8V5Zm0 4h12v2H8V9Zm0 4h12v2H8v-2Zm0 4h12v2H8v-2Z" />,
  'list-checkbox': <path d="M3 5h3v3H3V5Zm0 4h3v3H3V9Zm0 4h3v3H3v-3Zm0 4h3v3H3v-3Zm5-12h12v2H8V5Zm0 4h12v2H8V9Zm0 4h12v2H8v-2Zm0 4h12v2H8v-2Z" />,
  'list-tree': <path d="M5 3h2v3H5V3Zm0 5h2v3H5V8Zm0 5h2v3H5v-3Zm0 5h2v3H5v-3Zm4 1h12v2H9v-2Zm0-5h12v2H9v-2Zm0-5h12v2H9V9Zm0-5h12v2H9V4Z" />,
  'view-grid': <path d="M3 3h8v8H3V3Zm10 0h8v8h-8V3ZM3 13h8v8H3v-8Zm10 0h8v8h-8v-8Z" />,
  'view-list': <path d="M3 4h18v4H3V4Zm0 6h18v4H3v-4Zm0 6h18v4H3v-4Z" />,
  'view-board': <path d="M3 4h5v16H3V4Zm6 0h5v8H9V4Zm6 0h6v16h-6V4ZM9 14h5v6H9v-6Z" />,
  'view-timeline': <path d="M3 6h8v3H3V6Zm0 5h12v3H3v-3Zm0 5h6v3H3v-3Zm10 0h8v3h-8v-3Zm-6-13a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm5 5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm5 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />,
  // — Voyage étendu —
  passport: <path d="M5 2h14v20H5V2Zm2 2v16h10V4H7Zm5 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm-4 11h8v1H8v-1Zm0 2h8v1H8v-1Z" />,
  luggage: <path d="M8 4V2h8v2h3v18H5V4h3Zm2-2v2h4V2h-4ZM5 6v14h14V6H5Zm3 2h2v10H8V8Zm6 0h2v10h-2V8Z" />,
  visa: <path d="M5 4h14v3H5V4Zm0 5h14v11H5V9Zm2 2v2h2v-2H7Zm0 3v2h6v-2H7Z" />,
  'boarding-pass': <path d="M2 8c1 0 1-1 1-2V4h18v2c0 1 0 2 1 2v8c-1 0-1 1-1 2v2H3v-2c0-1 0-2-1-2V8Zm5 1v6h2V9H7Zm4 0v6h6V9h-6Z" />,
  // — Sports détaillés —
  football: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-3 5L7 11l4 1 1 4 4-2 1-4-4-1-4-2Z" />,
  basketball: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM3 9c2 1 4 3 5 6l-2 4a8 8 0 0 1-3-10Zm14 12-2-4c1-3 3-5 5-6a8 8 0 0 1-3 10Zm-5-9 1 6L8 21A8 8 0 0 1 3 9l4 5 5-2Zm6-9-4 5-5-2-1-6a8 8 0 0 1 10 3Z" />,
  tennis: <path d="M3 3a14 14 0 0 1 18 18A14 14 0 0 1 3 3Zm12 12a6 6 0 0 0-6-6 8 8 0 0 1 6 6Z" />,
  golf: <path d="M5 22v-4h2v3h10v-3h2v4H5Zm6-8 5-9-5 2v7Zm0 0v6h-2v-2L4 16l5-2v-1l2 1Z" />,
  skiing: <path d="M3 17 14 6l1 1 4 4 1 1L9 23l-6-6Zm10-15a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" />,
  swimming: <path d="M2 14a3 3 0 0 1 3 3 3 3 0 0 0 6 0 3 3 0 0 1 6 0 3 3 0 0 0 6 0v3a5 5 0 0 1-9 0 5 5 0 0 1-9 0v-3a5 5 0 0 1 0-3ZM6 7a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm6 5-2-5 9-3 2 5-9 3Z" />,
  running: <path d="M14 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm-2 6L8 14h3l-1 8h2l1-7 3 3 5-3-1-2-4 2-3-3-2-3 4-1Z" />,
  cycling: <path d="M5 13a5 5 0 1 0 5 5h-2a3 3 0 1 1-3-3v-2Zm14 0a5 5 0 1 1-5 5h2a3 3 0 1 0 3-3v-2ZM14 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm-2 6L9 13l4 4 1-4 4 3-1-3-4-2-3-3 2 0Z" />,
  yoga: <path d="M12 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm-1 6h2v6h6v2h-3l-2 4h-3l-1-2 2-3v-1H4v-2h7V8Z" />,
  dumbbell: <path d="M3 9v6h2v2h2V7H5v2H3Zm14-2v10h-2v-2H9v-2h6v-2H9V9h6V7h2Zm2 2v6h2V9h-2Zm-2-2h2v10h-2V7Z" />,
  // — Web / online —
  browser: <path d="M3 4h18v16H3V4Zm2 2v3h14V6H5Zm0 5v9h14v-9H5Zm2-3a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm3 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />,
  'window-frame': <path d="M3 3h18v18H3V3Zm2 2v14h14V5H5Z" />,
  tab: <path d="M3 7h18v14H3V7Zm6-4h6v3H9V3Z" />,
  incognito: <path d="M5 2h14v6h-2V4H7v4H5V2Zm12 8 4 4-1 1-2 2c-1 0-2 1-3 0L12 14l-3 3c-1 1-2 0-3 0l-2-2-1-1 4-4h10ZM7 16a2 2 0 1 0 4 0 2 2 0 0 0-4 0Zm6 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z" />,
  'bookmark-tab': <path d="M3 4h18v16H3V4Zm5 2v8l3-2 3 2V6H8Z" />,
  bookmarked: <path d="M6 2h12v20l-6-4-6 4V2Zm5 4v4H7V8h4v2Z" />,
  'home-page': <path d="M3 3h18v18H3V3Zm2 2v14h14V5H5Zm5 8L12 11l2 2v3h-4v-3Z" />,
  // — Misc —
  megaphone: <path d="M2 9h6l10-5v16L8 15H4l1 5H3l-1-5V9Zm18-2 2 4-2 4-1-2 1-2-1-2 1-2Z" />,
  'speaker-phone': <path d="M3 4h18v16H3V4Zm2 2v3h14V6H5Zm0 5v3h14v-3H5Zm0 5v3h14v-3H5Z" />,
  'antenna-broadcast': <path d="M2 12a10 10 0 0 1 20 0l-2 2a8 8 0 0 0-16 0l-2-2Zm4 0a6 6 0 0 1 12 0l-2 2a4 4 0 0 0-8 0l-2-2Zm4 0a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm-1 5h6l-1 5h-4l-1-5Z" />,
  'calculator-detailed': <path d="M4 2h16v20H4V2Zm2 2v4h12V4H6Zm0 6v3h3v-3H6Zm5 0v3h3v-3h-3Zm5 0v3h3v-3h-3Zm-10 5v3h3v-3H6Zm5 0v3h3v-3h-3Zm5 0v3h3v-3h-3Z" />,
  abacus: <path d="M2 3h20v18H2V3Zm2 2v3h6V5H4Zm8 0v3h8V5h-8Zm0 5v3h8v-3h-8ZM4 14v3h8v-3H4Zm10 0v3h6v-3h-6ZM4 18v1h16v-1H4Z" />,
  binoculars: <path d="M4 3h6l1 4v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8l2-5Zm10 0h6l2 5v8a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2V7l1-4Zm-2 4h-1v6h1V7Z" />,
  magnifier: <path d="M11 4a7 7 0 1 1-7 7 7 7 0 0 1 7-7Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM9 10h4v2H9v-2Zm7 8 4 4-2 2-4-4 2-2Z" />,
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
