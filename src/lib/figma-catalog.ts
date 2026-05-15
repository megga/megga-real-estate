/**
 * MEGGA Figma Catalog — Code Connect "maison"
 *
 * Pourquoi ce fichier existe :
 * Figma Code Connect officiel est réservé aux plans Organization/Enterprise.
 * Ce catalogue local sert la même fonction : map Figma node IDs / variant names
 * aux composants React du codebase, pour accélérer les migrations Figma → code.
 *
 * Comment Claude (ou n'importe quel dev) doit l'utiliser :
 *   1. Avant de migrer un node Figma, consulter ce catalogue.
 *   2. Si le node est listé, utiliser le composant indiqué — pas besoin de réinventer.
 *   3. Si le node N'EST PAS listé, l'ajouter ici à la fin de la migration.
 *
 * Fichier Figma : https://www.figma.com/design/fZovI4RREX4XHpLazsz8JB
 * (BRIX Property X template — utilisé comme référence design pour MEGGA Marketplace)
 */

// ─── Types ──────────────────────────────────────────────────────────────────

/** Nom d'icône filled inline (composant FilledIcon dans PropertyXAboutPage.tsx) */
export type FilledIconName = 'bulb' | 'star' | 'chart' | 'team' | 'chat' | 'flag' | 'user' | 'home'

export interface FigmaComponentMapping {
  /** Nom du composant React à utiliser */
  component: string
  /** Path d'import depuis src/ */
  source: string
  /** Variants disponibles et leur signification Figma → props React */
  variants?: Record<string, string>
  /** Notes complémentaires pour qui migre ce node */
  notes?: string
}

// ─── Filled icons (Small Icon/V* dans Figma) ────────────────────────────────
//
// Les variants "Small Icon/V25", "V51"... sont des identifiants Figma arbitraires.
// Identification faite à partir des screenshots des badges + cards de /about.
// Format : variant Figma → nom FilledIcon (inline SVG)

export const FIGMA_ICON_VARIANT_MAP: Record<string, FilledIconName> = {
  'Small Icon/V25': 'star',  // étoile pleine (badges Values, Offices, Excellence)
  'Small Icon/V28': 'user',  // silhouette personne (badge Mission)
  'Small Icon/V29': 'chat',  // bulle de discussion (card Communication)
  'Small Icon/V32': 'flag',  // drapeau (card Ownership)
  'Small Icon/V36': 'home',  // maison (badges Agents, Follow)
  'Small Icon/V51': 'bulb',  // ampoule (card Innovation)
  'Small Icon/V52': 'chart', // graphique barres (card Growth)
  'Small Icon/V53': 'team',  // 2 silhouettes (card Team work)
}

// ─── Icônes SVG fichiers (`/public/icons/figma/*.svg`) ─────────────────────
//
// Icônes téléchargées depuis Figma et stockées comme fichiers SVG (utilisées
// via le composant `<PxFigmaIcon name="..." />`). Chaque icône a son `fill` /
// `stroke` réglé sur `currentColor` pour pouvoir être recoloriée via la prop
// `color` du composant.
//
// Workflow d'ajout :
//   1. Télécharger le SVG : `curl -o public/icons/figma/<name>.svg "<url-figma>"`
//   2. Remplacer `var(--stroke-0, ...)` / fill par `currentColor`
//   3. Ajouter `name` au type `PxFigmaIconName` dans PxFigmaIcon.tsx
//   4. Ajouter une entrée ci-dessous

export interface FigmaSvgIconMapping {
  /** Node ID Figma de référence (ou parent où l'icône apparaît) */
  figmaNodeId?: string
  /** Path du SVG dans `/public` */
  assetPath: string
  /** Description et contexte d'usage */
  usage: string
}

export const FIGMA_SVG_ICON_MAP: Record<string, FigmaSvgIconMapping> = {
  close: {
    figmaNodeId: '11734:15201',
    assetPath: 'public/icons/figma/close.svg',
    usage: 'X de fermeture — dismiss button de PxTopNotificationBar et autres dialogs',
  },

  // ─── Sidebar UI Kit (DS styleguide pages, scope local) ─────────────────
  // Ces 11 icônes ne sont utilisées que par PxButtonsStyleGuide (et plus tard
  // les autres pages /design-system/*). Stockées dans
  // `/public/icons/figma/ds-sidebar/` pour les isoler des icônes "produit".
  'ds-sidebar/buttons-regular': {
    figmaNodeId: '11703:25914',
    assetPath: 'public/icons/figma/ds-sidebar/buttons-regular.svg',
    usage: 'Icône "Buttons" 22px — page title du styleguide /design-system/buttons',
  },
  'ds-sidebar/links-regular': {
    figmaNodeId: '11703:25920',
    assetPath: 'public/icons/figma/ds-sidebar/links-regular.svg',
    usage: 'Icône "Links" 22px — page title du styleguide /design-system/links',
  },
  'ds-sidebar/badges-regular': {
    figmaNodeId: '11703:25955',
    assetPath: 'public/icons/figma/ds-sidebar/badges-regular.svg',
    usage: 'Icône "Badges" 22px — page title du styleguide /design-system/badges',
  },
  'badge-megaphone': {
    figmaNodeId: '11723:19548',
    assetPath: 'public/icons/figma/badge-megaphone.svg',
    usage: 'Icône megaphone (V41 Figma) — variant sm de PxBadge dans la page styleguide Badges',
  },
  'check-circle': {
    figmaNodeId: '7223:11994',
    assetPath: 'public/icons/figma/check-circle.svg',
    usage: 'Filled check circle — utilisée dans PxListsStyleGuide (variant type Icon) et réutilisable pour validation/success states',
  },
  'ds-sidebar/lists-regular': {
    figmaNodeId: '11703:25924',
    assetPath: 'public/icons/figma/ds-sidebar/lists-regular.svg',
    usage: 'Icône "Lists" 22px — page title du styleguide /design-system/lists',
  },
  'ds-sidebar/icons-regular': {
    assetPath: 'public/icons/figma/ds-sidebar/icons-regular.svg',
    usage: 'Icône "Icons" 22px — page title du styleguide /design-system/icons',
  },
  'ds-sidebar/logo': {
    assetPath: 'public/icons/figma/ds-sidebar/logo.svg',
    usage: 'Sidebar nav item "Logo"',
  },
  'ds-sidebar/buttons-small': {
    assetPath: 'public/icons/figma/ds-sidebar/buttons-small.svg',
    usage: 'Sidebar nav item "Buttons"',
  },
  'ds-sidebar/links': {
    assetPath: 'public/icons/figma/ds-sidebar/links.svg',
    usage: 'Sidebar nav item "Links"',
  },
  'ds-sidebar/badges': {
    assetPath: 'public/icons/figma/ds-sidebar/badges.svg',
    usage: 'Sidebar nav item "Badges"',
  },
  'ds-sidebar/lists': {
    assetPath: 'public/icons/figma/ds-sidebar/lists.svg',
    usage: 'Sidebar nav item "Lists"',
  },
  'ds-sidebar/icons': {
    assetPath: 'public/icons/figma/ds-sidebar/icons.svg',
    usage: 'Sidebar nav item "Icons"',
  },
  'ds-sidebar/iconfonts': {
    assetPath: 'public/icons/figma/ds-sidebar/iconfonts.svg',
    usage: 'Sidebar nav item "Icon Fonts"',
  },
  'ds-sidebar/avatars': {
    assetPath: 'public/icons/figma/ds-sidebar/avatars.svg',
    usage: 'Sidebar nav item "Avatars"',
  },
  'ds-sidebar/inputs': {
    assetPath: 'public/icons/figma/ds-sidebar/inputs.svg',
    usage: 'Sidebar nav item "Inputs"',
  },
  'ds-sidebar/images': {
    assetPath: 'public/icons/figma/ds-sidebar/images.svg',
    usage: 'Sidebar nav item "Images"',
  },
}

// ─── Composants principaux (Header, Footer, Button, Badge, etc.) ────────────

export const FIGMA_COMPONENT_MAP: Record<string, FigmaComponentMapping> = {
  // Boutons
  '4908:36278': {
    component: 'PxButton',
    source: 'src/components/propertyx/PxButton.tsx',
    variants: {
      'Default White': 'variant="primary" (False) | variant="invert" (True)',
      'Default Large': 'size="md" (False) | size="lg" (True)',
      'buttonText': 'children (string)',
    },
    notes: 'Pill button avec cercle blanc + icône arrow-right',
  },

  // Link avec chevron
  '11757:34397': {
    component: 'PxTextLink',
    source: 'src/pages/public/PropertyXAboutPage.tsx',
    notes: 'Texte + chevron-right, sans pill. Composant local à la page About pour l\'instant.',
  },

  // Header / Footer
  '11756:32564': {
    component: 'PxNav',
    source: 'src/components/propertyx/sections/PxNav.tsx',
    notes: 'Header global PropertyX — toutes pages publiques',
  },
  '9643:27993': {
    component: 'PxFooter',
    source: 'src/components/propertyx/sections/PxFooter.tsx',
    notes: 'Footer global PropertyX — toutes pages publiques',
  },

  // Styleguide UI Kit Buttons (page de référence interne /design-system/buttons)
  '11706:23422': {
    component: 'PxButtonsStyleGuide',
    source: 'src/components/propertyx/sections/PxButtonsStyleGuide.tsx',
    notes: 'Page "🧱 Buttons" du UI Kit Property X. Utilise PxStyleguideShell (sidebar partagé) + sections Primary Button (4 variantes PxButton) et Logo Text (4 variantes PxCircleButton). Route /design-system/buttons.',
  },

  // Styleguide UI Kit Links (page de référence interne /design-system/links)
  '11708:31063': {
    component: 'PxLinksStyleGuide',
    source: 'src/components/propertyx/sections/PxLinksStyleGuide.tsx',
    notes: 'Page "🔗 Links" du UI Kit Property X. Utilise PxStyleguideShell + showcase split bg (light gray + dark right panel) avec 4 PxLink (dark/light × regular/medium). Route /design-system/links.',
  },

  // Styleguide UI Kit Badges (page de référence interne /design-system/badges)
  '11708:31239': {
    component: 'PxBadgesStyleGuide',
    source: 'src/components/propertyx/sections/PxBadgesStyleGuide.tsx',
    notes: 'Page "🎖️ Badges" du UI Kit Property X. Utilise PxStyleguideShell + 4 PxBadge (primary/invert × sm/lg). Sm utilise icône inline 16px (megaphone V41), lg utilise icône dans cercle 26px (star V25 = badge-featured-star). Route /design-system/badges.',
  },

  // Styleguide UI Kit Lists (page de référence interne /design-system/lists)
  '11723:19659': {
    component: 'PxListsStyleGuide',
    source: 'src/components/propertyx/sections/PxListsStyleGuide.tsx',
    notes: 'Page "🎛️ Lists" du UI Kit Property X. Utilise PxStyleguideShell + showcase split bg (852×356, dark panel 426px) avec grille 4 lignes × 6 colonnes : 3 types (icon/bullet/number) × 4 size-weight combos (sm/lg × regular/medium) × 2 fonds. Route /design-system/lists.',
  },

  // Styleguide UI Kit Shadows (Basic Styles tab — /design-system/shadows)
  '11703:26319': {
    component: 'PxShadowsStylesGuide',
    source: 'src/components/propertyx/sections/PxShadowsStylesGuide.tsx',
    notes: 'Page "🌑 Shadow Styles" du UI Kit Property X (tab Basic Styles). Section "Neutral Shadows" : 4 cards 240×240 (Small/Regular/Medium/Large) bg white, border 1px neutral300, radius 24. Les box-shadow mappent exactement PX.shadow.small/regular/medium/large (Figma Neutral/BS *). Route /design-system/shadows.',
  },

  // Styleguide UI Kit Typography (Basic Styles tab — /design-system/typography)
  '11703:26347': {
    component: 'PxTypographyStylesGuide',
    source: 'src/components/propertyx/sections/PxTypographyStylesGuide.tsx',
    notes: 'Page "✍️ Typography Styles" du UI Kit Property X (tab Basic Styles). 3 sections : Font Family (Objectivity card avec alphabet + weights + Aa preview + Download Font), Display (10 lignes Display 10→1 avec size/lh/weights), Paragraph (3 lignes Large/Default/Small avec Lorem ipsum). Tous les sizes/line-heights matchent PX.type.display* exactement. Route /design-system/typography.',
  },

  // Styleguide UI Kit Colors (Basic Styles tab — /design-system/colors)
  '11703:26465': {
    component: 'PxColorStylesGuide',
    source: 'src/components/propertyx/sections/PxColorStylesGuide.tsx',
    notes: 'Page "🎨 Color Styles" du UI Kit Property X (tab Basic Styles, sidebar badge "Styles"). 2 sections : Primary colors (Accent #14161C) + Neutral Colors (100→700, mapping exact des tokens PX.neutral*). Chaque MasterColorCard = 232×236, bg blanc, color block intérieur radius 8, label + HEX badge. Route /design-system/colors. PxStyleguideShell supporte `tab="styles"` pour Basic Styles (sinon "components" par défaut).',
  },

  // Styleguide UI Kit Inputs (page de référence interne /design-system/inputs)
  '11723:27991': {
    component: 'PxInputsStyleGuide',
    source: 'src/components/propertyx/sections/PxInputsStyleGuide.tsx',
    notes: 'Page "📨 Inputs" du UI Kit Property X. 7 sections : Input Text (dark+button / light), Select, Text Area (pencil icon), Checkboxes (sm/lg × checked/unchecked + 4 avec labels), Radio Buttons (idem), Toggle Button (idem), Upload (filled / outline). Réutilise PxInput, PxSelect, PxTextArea, PxCheckbox, PxRadio, PxToggle, PxUploadCard, PxButton, PxFigmaIcon. Route /design-system/inputs.',
  },

  // Styleguide UI Kit Avatars (page de référence interne /design-system/avatars)
  '11723:24553': {
    component: 'PxAvatarsStyleGuide',
    source: 'src/components/propertyx/sections/PxAvatarsStyleGuide.tsx',
    notes: 'Page "👥 Avatars" du UI Kit Property X. 2 sections : Avatar Circle (6 tailles 32-160px, photo John Carter) + Avatar Photos (6 photos 200×200 : John, Sophie, Matt, Samantha, Will, Dylan). Photos téléchargées dans /public/images/avatars/<name>.png (~10 MB total — Figma source). Note : will-green.png est blanc/vide côté Figma (asset défaillant — fidèle au design). Route /design-system/avatars.',
  },

  // Styleguide UI Kit Icon Font (page de référence interne /design-system/iconfonts)
  '11723:20206': {
    component: 'PxIconFontsStyleGuide',
    source: 'src/components/propertyx/sections/PxIconFontsStyleGuide.tsx',
    notes: 'Page "📱 Icon font" du UI Kit Property X. 4 sections × 655 icônes individuelles téléchargées depuis Figma comme SVG individuels dans /public/icons/figma/icon-fonts/<style>/<name>.svg : line-rounded (230), line-squared (230), filled (161), social (34). Chaque SVG a fill/stroke=currentColor pour permettre recolorisation. Sub-nodes: 11723:20375 (Line Rounded), 11723:22666 (Line Squared), 11723:22667 (Filled), 11723:23222 (Social Media). Liste des noms : src/components/propertyx/sections/iconFontsNames.ts. Route /design-system/iconfonts.',
  },

  // Styleguide UI Kit Icons (page de référence interne /design-system/icons)
  '11723:19978': {
    component: 'PxIconsStyleGuide',
    source: 'src/components/propertyx/sections/PxIconsStyleGuide.tsx',
    notes: 'Page "📱 Icons" du UI Kit Property X. Showcase "Social Media Square Icons" — 33 brands × 2 variantes (colored + monochrome) = 66 rounded squares 24×24. Utilise les SVG Figma téléchargés dans /public/icons/social/<brand>-<variant>.svg (PxSocialIcon avait des paths hand-written approximatifs/cassés pour Yelp, Twitch, etc.). Google/Google Play/Google Podcast colored = white bg (icônes multi-couleurs). Gradients Figma reproduits pour Instagram/Soundcloud/Skype/Messenger/Telegram/Apple Podcast/Apple Music. Bug Figma corrigé : titre interne disait "Lists" → "Icons". Route /design-system/icons.',
  },

  // Top Notification Bar (barre noire au-dessus de PxNav) — 3 variantes
  '11709:33362': {
    component: 'PxTopNotificationBar',
    source: 'src/components/propertyx/sections/PxTopNotificationBar.tsx',
    notes: 'Section parente Figma "Notification Bar" — contient les 3 variantes V1/V2/V3. Le composant React supporte les 3 via prop `variant`.',
  },
  '11709:33363': {
    component: 'PxTopNotificationBar',
    source: 'src/components/propertyx/sections/PxTopNotificationBar.tsx',
    variants: { variant: '"plain"' },
    notes: 'V1 plain (1440×72) — texte centré + X dismiss',
  },
  '11709:33367': {
    component: 'PxTopNotificationBar',
    source: 'src/components/propertyx/sections/PxTopNotificationBar.tsx',
    variants: { variant: '"button"', buttonText: 'string', buttonHref: 'string' },
    notes: 'V2 button (1440×88) — texte + bouton invert "Get started" + X dismiss',
  },
  '11709:33372': {
    component: 'PxTopNotificationBar',
    source: 'src/components/propertyx/sections/PxTopNotificationBar.tsx',
    variants: { variant: '"form"', placeholder: 'string', submitText: 'string', onSubmit: '(email) => void' },
    notes: 'V3 form (1440×100) — texte + email input avec Subscribe + X dismiss',
  },
}

// ─── Pages/écrans complets (Hero/About/etc.) ────────────────────────────────

export const FIGMA_PAGE_MAP: Record<string, { route: string; component: string; source: string }> = {
  '9552:21435': {
    route: '/about',
    component: 'PropertyXAboutPage',
    source: 'src/pages/public/PropertyXAboutPage.tsx',
  },
}

// ─── Badges identifiés sur /about ────────────────────────────────────────────
//
// Chaque badge a un cercle 26px avec icône filled blanche.
// Format : node ID → ({ text, iconName }) pour réutilisation rapide

export const FIGMA_BADGE_MAP: Record<string, { text: string; iconName: FilledIconName; invert?: boolean }> = {
  '11757:34421': { text: 'Nos valeurs', iconName: 'star' },
  '11759:15913': { text: 'Notre mission', iconName: 'user' },
  '11763:17450': { text: 'Nos bureaux', iconName: 'star', invert: true },
  '11763:15926': { text: 'Nos agents', iconName: 'home' },
  '11763:17462': { text: 'Suivez-nous', iconName: 'home' },
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Resolve une icône via son variant name Figma. Renvoie undefined si non mappé. */
export function resolveIconForVariant(variantName: string): FilledIconName | undefined {
  return FIGMA_ICON_VARIANT_MAP[variantName]
}

/** Résumé textuel d'un node Figma — utile pour prompts ou logs de migration. */
export function summarizeFigmaNode(nodeId: string): string {
  const page = FIGMA_PAGE_MAP[nodeId]
  if (page) return `→ Page ${page.component} (route ${page.route})`

  const component = FIGMA_COMPONENT_MAP[nodeId]
  if (component) {
    const variants = component.variants
      ? Object.entries(component.variants).map(([k, v]) => `${k}: ${v}`).join(' | ')
      : ''
    return `→ ${component.component} from ${component.source}${variants ? ` [${variants}]` : ''}`
  }

  const badge = FIGMA_BADGE_MAP[nodeId]
  if (badge) {
    return `→ <EyebrowBadge text="${badge.text}" iconName="${badge.iconName}"${badge.invert ? ' invert' : ''} />`
  }

  return `(node ${nodeId} non mappé — ajouter à figma-catalog.ts)`
}

/** Liste tous les nodes mappés (utile pour debug / audit). */
export function listAllMappings() {
  return {
    iconVariants: Object.keys(FIGMA_ICON_VARIANT_MAP).length,
    svgIcons: Object.keys(FIGMA_SVG_ICON_MAP).length,
    components: Object.keys(FIGMA_COMPONENT_MAP).length,
    pages: Object.keys(FIGMA_PAGE_MAP).length,
    badges: Object.keys(FIGMA_BADGE_MAP).length,
  }
}
