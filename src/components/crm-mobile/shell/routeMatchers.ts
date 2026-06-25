import type { MEIconName } from '@/components/propertyx/MEIcon'

export type MobileTab = 'today' | 'pipeline' | 'matching' | 'agenda' | 'more'

export interface MobileTabDef {
  id: MobileTab
  route: string
  icon: MEIconName
  labelKey: string
}

/** Barre d'onglets — 5 destinations (port 1:1 de NavTabBar, App Mobile.html). */
export const MOBILE_TABS: MobileTabDef[] = [
  { id: 'today', route: '/dashboard', icon: 'home', labelKey: 'nav.today' },
  { id: 'pipeline', route: '/dashboard/pipeline', icon: 'trending-up', labelKey: 'nav.pipeline' },
  { id: 'matching', route: '/dashboard/matching', icon: 'sparkle', labelKey: 'nav.matching' },
  { id: 'agenda', route: '/dashboard/calendar', icon: 'calendar', labelKey: 'nav.calendar' },
  { id: 'more', route: '/dashboard/more', icon: 'menu', labelKey: 'nav.more' },
]

/**
 * Onglet actif déduit du chemin. Les écrans secondaires (Contacts, KYC,
 * Analytics…) éclairent « Plus », exactement comme la maquette (eff='more').
 */
export function pathnameToTab(pathname: string): MobileTab {
  if (pathname === '/dashboard' || pathname === '/dashboard/') return 'today'
  if (pathname.startsWith('/dashboard/pipeline')) return 'pipeline'
  if (pathname.startsWith('/dashboard/matching')) return 'matching'
  if (pathname.startsWith('/dashboard/calendar')) return 'agenda'
  return 'more'
}

/**
 * Routes détail/création : header bouton-retour, PAS de barre d'onglets
 * (fidèle aux écrans biens-new / contact-new / detail de la maquette).
 * Les listes secondaires (/contacts, /listings, /kyc, /journey, /analytics,
 * /settings) gardent la barre (« Plus » éclairé).
 */
const DETAIL_PATTERNS: RegExp[] = [
  /^\/dashboard\/transactions\/[^/]+/, // détail deal + offre/contre-offre
  /^\/dashboard\/listings\/[^/]+/, // fiche :id, création /new, édition /:id/edit
  /^\/dashboard\/contacts\/[^/]+/, // fiche contact, /import, /new
  /^\/dashboard\/visits\//,
  /^\/dashboard\/visites\//,
  /^\/dashboard\/kyc\/[^/]+/, // détail dossier (la liste /kyc garde la barre)
  /^\/dashboard\/(market|marche)\//,
  /^\/dashboard\/import-lead/,
]

export function isDetailRoute(pathname: string): boolean {
  return DETAIL_PATTERNS.some((re) => re.test(pathname))
}
