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
}

// ─── Pages/écrans complets (Hero/About/etc.) ────────────────────────────────

export const FIGMA_PAGE_MAP: Record<string, { route: string; component: string; source: string }> = {
  '9552:21435': {
    route: '/about',
    component: 'PropertyXAboutPage',
    source: 'src/pages/public/PropertyXAboutPage.tsx',
  },
  '9552:21441': {
    route: '/location',
    component: 'PropertyXLocationCmsPage',
    source: 'src/pages/public/PropertyXLocationCmsPage.tsx',
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
    components: Object.keys(FIGMA_COMPONENT_MAP).length,
    pages: Object.keys(FIGMA_PAGE_MAP).length,
    badges: Object.keys(FIGMA_BADGE_MAP).length,
  }
}
