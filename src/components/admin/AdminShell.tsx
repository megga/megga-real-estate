/**
 * Chrome de la console super-admin (admin.megga.ch) : rail de navigation des 16
 * surfaces, recherche admin, notifications, bascule de thème, retour au CRM et
 * déconnexion. Rend les pages via `<Outlet>`.
 *
 * Grammaire Sugar (lot 0 de l'audit visuel) : séparation par ombre douce
 * plutôt que par bordure, surfaces arrondies, Inter Tight, et la teinte sombre
 * du CRM (noir franc). Les couleurs viennent des variables re-teintes par
 * `src/styles/admin-console.css` — les pages, elles, n'ont pas bougé.
 *
 * L'accent violet est CONSERVÉ, à contre-courant de l'accent unique de Sugar
 * Pure : une fois le chrome unifié, c'est le seul signal qui dit « tu n'es plus
 * dans ton agence, tu es dans la plateforme ». Il est réduit à sa portion utile
 * (pastille, item actif) — jamais un bouton plein.
 */
import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { useAuth } from '@/hooks/useAuth'
import { useAdminTheme } from '@/components/admin/AdminThemeProvider'
import { cn } from '@/lib/utils'
import { CRM_APP_URL } from '@/lib/adminEntry'
import AdminSearchDialog from '@/components/admin/AdminSearchDialog'
import AdminNotificationPanel from '@/components/admin/AdminNotificationPanel'

interface NavItem {
  labelKey: string
  href: string
  icon: MEIconName
  /** `end` : n'est actif que sur une correspondance exacte (l'accueil `/`). */
  end?: boolean
}

interface NavSection {
  labelKey: string
  items: NavItem[]
}

// Nav groupée en 5 sections (P6b) — une liste plate de 17 entrées était devenue
// illisible. Ordre des sections = du pilotage quotidien au produit.
const NAV_SECTIONS: NavSection[] = [
  { labelKey: 'nav.adminSectionPilotage', items: [
    { labelKey: 'nav.adminLive', href: '/live', icon: 'broadcast' },
    { labelKey: 'nav.adminOverview', href: '/', icon: 'dashboard', end: true },
  ]},
  { labelKey: 'nav.adminSectionClients', items: [
    { labelKey: 'nav.adminAgencies', href: '/agencies', icon: 'building' },
    { labelKey: 'nav.adminUsers', href: '/users', icon: 'users' },
    { labelKey: 'nav.adminEndUsers', href: '/end-users', icon: 'users' },
    { labelKey: 'nav.adminMarketplace', href: '/marketplace', icon: 'store' },
  ]},
  { labelKey: 'nav.adminSectionRevenue', items: [
    { labelKey: 'nav.adminPlans', href: '/plans', icon: 'credit-card' },
  ]},
  { labelKey: 'nav.adminSectionOps', items: [
    { labelKey: 'nav.adminMonitoring', href: '/monitoring', icon: 'broadcast' },
    { labelKey: 'nav.adminSecurity', href: '/security', icon: 'shield' },
    { labelKey: 'nav.adminCompliance', href: '/compliance', icon: 'shield' },
    { labelKey: 'nav.adminKybReview', href: '/kyb-review', icon: 'eye' },
  ]},
  { labelKey: 'nav.adminSectionProduct', items: [
    { labelKey: 'nav.adminChangelog', href: '/changelog', icon: 'megaphone' },
    { labelKey: 'nav.adminFlags', href: '/feature-flags', icon: 'bolt' },
    { labelKey: 'nav.adminNps', href: '/nps', icon: 'star' },
    { labelKey: 'nav.adminAutonomy', href: '/autonomy', icon: 'sparkle' },
    { labelKey: 'nav.adminLearning', href: '/learning', icon: 'sparkle' },
    { labelKey: 'nav.adminToolUsage', href: '/tool-usage', icon: 'sparkle' },
  ]},
]

const ROW = 'flex items-center h-9 mx-2 px-2.5 gap-2.5 text-sm rounded-xl cursor-pointer select-none transition-colors duration-150'

/** Contenu du rail — partagé entre le rail fixe (desktop) et le tiroir (mobile). */
function ShellNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation('common')
  const { signOut, profile } = useAuth()
  const { dark, toggle } = useAdminTheme()
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="h-14 flex items-center px-4 shrink-0">
        <img src="/megga-logo.svg" alt="MEGGA" className="h-5 w-auto" style={{ filter: 'var(--logo-filter, none)' }} />
      </div>

      <div className="px-3 mt-3 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-admin-accent" />
          <span className="text-xs font-semibold text-admin-accent">Admin MEGGA</span>
        </div>
      </div>

      <button onClick={() => setSearchOpen(true)} className={cn(ROW, 'text-theme-secondary hover:bg-theme-hover hover:text-theme-primary')}>
        <MEIcon name="search" className="h-[18px] w-[18px] flex-shrink-0 stroke-[1.8]" />
        <span>{t('nav.search')}</span>
      </button>
      <AdminSearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />

      <nav aria-label="Navigation admin" className="flex-1 overflow-y-auto overflow-x-hidden py-2 scrollbar-hide">
        {NAV_SECTIONS.map((section) => (
          <div key={section.labelKey}>
            <div className="mt-4 mb-1 px-3 first:mt-0">
              <span className="text-xs capitalize text-theme-tertiary font-medium select-none">
                {t(section.labelKey)}
              </span>
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) => cn(
                    ROW,
                    isActive
                      ? 'bg-admin-accent/8 text-admin-accent font-medium'
                      : 'text-theme-secondary hover:bg-theme-hover hover:text-theme-primary',
                  )}
                >
                  <MEIcon name={item.icon} className="h-[18px] w-[18px] flex-shrink-0 stroke-[1.8]" />
                  <span>{t(item.labelKey)}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto shrink-0">
        <div className="mx-3 h-px bg-theme-border-subtle mt-2 mb-2" />

        <AdminNotificationPanel />

        <button
          onClick={toggle}
          aria-label={dark ? 'Activer le mode clair' : 'Activer le mode sombre'}
          data-testid="theme-toggle"
          className={cn(ROW, 'w-[calc(100%-1rem)] text-theme-secondary hover:bg-theme-hover hover:text-theme-primary')}
        >
          <MEIcon name={dark ? 'sun' : 'moon'} className="w-[18px] h-[18px] stroke-[1.8] flex-shrink-0" />
          <span>{dark ? t('nav.lightMode') : t('nav.darkMode')}</span>
        </button>

        {/* Retour au CRM : autre origine, donc lien plein — pas de React Router. */}
        <a
          href={CRM_APP_URL}
          className={cn(ROW, 'text-theme-secondary hover:bg-theme-hover hover:text-theme-primary')}
        >
          <MEIcon name="external" className="w-[18px] h-[18px] stroke-[1.8] flex-shrink-0" />
          <span>{t('nav.backToCrm')}</span>
        </a>

        <div className="flex items-center gap-2.5 p-3 mx-1 mb-1 mt-1 rounded-xl bg-theme-hover/60">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-theme-primary leading-tight truncate">
              {profile?.full_name ?? profile?.email ?? '—'}
            </p>
            <p className="text-xs text-theme-tertiary leading-tight truncate">{t('nav.adminOverview')}</p>
          </div>
          <button
            onClick={() => void signOut()}
            className="p-1.5 rounded-md hover:bg-theme-card text-theme-tertiary hover:text-danger transition-colors"
            title={t('nav.logout')}
          >
            <MEIcon name="logout" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

/** Shell complet : rail fixe ≥ lg, tiroir en dessous, zone de contenu scrollable. */
export default function AdminShell() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-theme-page isolate">
      <aside className="hidden lg:flex flex-shrink-0 w-64 bg-theme-card console-shadow h-screen sticky top-0 z-40">
        <ShellNav />
      </aside>

      {drawerOpen && (
        <>
          <div className="fixed inset-0 bg-theme-overlay/30 backdrop-blur-sm z-40 lg:hidden" onClick={() => setDrawerOpen(false)} />
          <aside className="fixed inset-y-0 left-0 w-64 bg-theme-card z-50 lg:hidden console-shadow-lg">
            <ShellNav onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden h-14 bg-theme-card console-shadow flex items-center px-4 sticky top-0 z-30">
          <button onClick={() => setDrawerOpen(true)} className="p-2 -ml-2 rounded-lg hover:bg-theme-hover">
            <MEIcon name="menu" className="h-5 w-5 text-theme-secondary" />
          </button>
          <Link to="/" className="ml-3 text-sm font-bold text-admin-accent">Admin MEGGA</Link>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
