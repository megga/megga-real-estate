/**
 * Constantes de la barre d'onglets mobile (crm-mobile/shell) : la table des
 * 5 destinations et la résolution du chemin courant vers l'onglet actif.
 */
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

