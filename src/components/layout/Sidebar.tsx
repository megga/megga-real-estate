import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useAvatar } from '@/hooks/useAvatar'
import { usePreferences } from '@/hooks/usePreferences'
import AdminNotificationPanel from '@/components/admin/AdminNotificationPanel'
import AdminSearchDialog from '@/components/admin/AdminSearchDialog'
import { useOpenTicketCount } from '@/hooks/useOpenTicketCount'

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface NavSection { labelKey: string; items: NavItem[] }
interface NavItem { labelKey: string; href: string; icon: MEIconName; badge?: number; isCreateAction?: boolean }

// ─── NAV DATA ───────────────────────────────────────────────────────────────

const NAV_SECTIONS: NavSection[] = [
  { labelKey: 'sections.main', items: [
    { labelKey: 'nav.today', href: '/dashboard', icon: 'sparkle' },
    { labelKey: 'nav.dashboard', href: '/dashboard/analytics', icon: 'dashboard' },
  ]},
  { labelKey: 'sections.crm', items: [
    { labelKey: 'nav.contacts', href: '/dashboard/contacts', icon: 'users' },
    { labelKey: 'nav.pipeline', href: '/dashboard/pipeline', icon: 'flowchart' },
    { labelKey: 'nav.matching', href: '/dashboard/matching', icon: 'refresh' },
  ]},
  { labelKey: 'sections.properties', items: [
    { labelKey: 'nav.listings', href: '/dashboard/listings', icon: 'building' },
    { labelKey: 'nav.createListing', href: '/dashboard/listings/new', icon: 'plus', isCreateAction: true },
  ]},
  { labelKey: 'sections.communication', items: [
    { labelKey: 'nav.calendar', href: '/dashboard/calendar', icon: 'calendar' },
    { labelKey: 'nav.support', href: '/dashboard/support', icon: 'help' },
  ]},
  { labelKey: 'sections.compliance', items: [
    { labelKey: 'nav.kyc', href: '/dashboard/kyc', icon: 'shield' },
    { labelKey: 'nav.documents', href: '/dashboard/documents', icon: 'file' },
  ]},
]

// ─── PROPS ──────────────────────────────────────────────────────────────────

interface SidebarProps {
  mobileOpen: boolean
  collapsed?: boolean
  onClose: () => void
  onToggleCollapse?: () => void
  onOpenCommandPalette?: () => void
  onQuickContact?: () => void
}

// ─── HELPER: fade label (always rendered, hidden via opacity + overflow) ────

const fadeLabel = (collapsed: boolean) =>
  cn(
    'overflow-hidden whitespace-nowrap transition-[opacity,max-width] duration-200 ease-out',
    collapsed ? 'max-w-0 opacity-0' : 'max-w-[180px] opacity-100'
  )

// ─── SUB-COMPONENTS ─────────────────────────────────────────────────────────

function UserAvatar({ name, avatarUrl, size = 'default' }: { name: string; avatarUrl?: string | null; size?: 'default' | 'small' }) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const s = size === 'small' ? 'h-7 w-7 text-xs' : 'h-8 w-8 text-xs'

  return avatarUrl ? (
    <img src={avatarUrl} alt={name} className={cn('rounded-full object-cover flex-shrink-0 transition-[width,height] duration-200', s)} />
  ) : (
    <div className={cn('rounded-full bg-accent text-accent-foreground font-semibold flex items-center justify-center flex-shrink-0 transition-[width,height] duration-200', s)}>
      {initials}
    </div>
  )
}

function CollapsedTooltip({ show, children }: { show: boolean; children: React.ReactNode }) {
  if (!show) return null
  return (
    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 bg-theme-primary text-theme-inverse text-xs px-2 py-1 rounded-md shadow-lg whitespace-nowrap pointer-events-none animate-in fade-in-0 duration-100">
      {children}
    </div>
  )
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────

export default function Sidebar({ mobileOpen, collapsed = false, onClose, onToggleCollapse, onOpenCommandPalette, onQuickContact }: SidebarProps) {
  const location = useLocation()
  const { signOut, profile } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { t } = useTranslation('common')
  const { avatarUrl } = useAvatar()
  const { preferences } = usePreferences()
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const isAdminRoute = location.pathname.startsWith('/dashboard/admin')
  const [adminMode, setAdminMode] = useState(isAdminRoute)
  const [adminSearchOpen, setAdminSearchOpen] = useState(false)
  const isMinimalSidebar = preferences.sidebarStyle === 'minimal'
  const openTicketCount = useOpenTicketCount()

  function isActive(href: string) {
    if (href === '/dashboard') return location.pathname === '/dashboard'
    return location.pathname.startsWith(href)
  }

  // ── Shared classes ────────────────────────────────────────────────────
  const navRow = (isCol: boolean, active: boolean) => cn(
    'flex items-center h-9 rounded-lg cursor-pointer select-none transition-colors duration-150',
    isCol ? 'mx-auto justify-center w-10' : 'mx-2 px-2.5 gap-2.5 text-sm',
    active
      ? 'bg-accent/8 text-accent font-medium'
      : 'text-theme-secondary hover:bg-theme-hover hover:text-theme-primary'
  )

  // ── Content (shared between desktop/tablet/mobile) ────────────────────
  const sidebarContent = (isCol: boolean) => (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Logo ── */}
      <div className={cn('h-14 flex items-center border-b border-theme-border-subtle shrink-0 transition-[padding] duration-200', isCol ? 'justify-center px-2' : 'px-4')}>
        <Link to="/" className="flex items-center shrink-0" onClick={onClose}>
          {isCol ? (
            <img src="/megga-gg.svg" alt="MEGGA" className="h-5 w-auto" style={{ filter: 'var(--logo-filter, none)' }} />
          ) : (
            <img src="/megga-logo.svg" alt="MEGGA" className="h-5 w-auto" style={{ filter: 'var(--logo-filter, none)' }} />
          )}
        </Link>
        {!isCol && (
          <div className="ml-auto flex items-center gap-0.5">
            <button
              onClick={onToggleCollapse}
              aria-label="Réduire la sidebar"
              className="hidden lg:flex p-1.5 rounded-md hover:bg-theme-hover transition-colors"
            >
              <MEIcon name="collapse" className="h-4 w-4 text-theme-tertiary" />
            </button>
            <button onClick={onClose} aria-label="Fermer le menu" className="lg:hidden p-1.5 rounded-md hover:bg-theme-hover">
              <MEIcon name="close" className="h-5 w-5 text-theme-muted" />
            </button>
          </div>
        )}
      </div>

      {/* ── Search ── */}
      {isCol ? (
        <div className="flex justify-center mt-3 mb-1 relative"
          onMouseEnter={() => setHoveredItem('search')}
          onMouseLeave={() => setHoveredItem(null)}
        >
          <button
            onClick={() => onOpenCommandPalette?.()}
            aria-label="Rechercher"
            className="w-10 h-8 rounded-lg flex items-center justify-center hover:bg-theme-hover transition-colors text-theme-tertiary hover:text-theme-primary"
          >
            <MEIcon name="search" className="w-[18px] h-[18px] stroke-[1.8]" />
          </button>
          <CollapsedTooltip show={hoveredItem === 'search'}>{t('nav.search')}</CollapsedTooltip>
        </div>
      ) : (
        <div className="mx-3 mt-3 mb-1">
          <button
            onClick={() => onOpenCommandPalette?.()}
            className="w-full h-8 bg-theme-input rounded-lg px-3 flex items-center gap-2 text-xs text-theme-muted hover:bg-theme-hover transition-colors"
          >
            <MEIcon name="search" className="w-3.5 h-3.5 text-theme-tertiary" />
            <span className="flex-1 text-left">{t('nav.search')}</span>
            <kbd className="text-xs bg-theme-active text-theme-tertiary px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
          </button>
        </div>
      )}

      {/* ── Quick Contact ── */}
      {isCol ? (
        <div className="flex justify-center mb-1 relative"
          onMouseEnter={() => setHoveredItem('quick-contact')}
          onMouseLeave={() => setHoveredItem(null)}
        >
          <button
            onClick={() => onQuickContact?.()}
            className="w-10 h-8 rounded-lg flex items-center justify-center hover:bg-theme-hover transition-colors text-theme-tertiary hover:text-theme-primary"
          >
            <MEIcon name="plus" className="w-[18px] h-[18px] stroke-[1.8]" />
          </button>
          <CollapsedTooltip show={hoveredItem === 'quick-contact'}>Nouveau contact ⌘⇧C</CollapsedTooltip>
        </div>
      ) : (
        <div className="mx-3 mb-1">
          <button
            onClick={() => onQuickContact?.()}
            className="w-full h-8 rounded-lg px-3 flex items-center gap-2 text-xs text-theme-secondary hover:bg-theme-hover hover:text-theme-primary transition-colors"
          >
            <MEIcon name="plus" className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">Nouveau contact</span>
            <kbd className="text-xs bg-theme-active text-theme-tertiary px-1.5 py-0.5 rounded font-mono">⌘⇧C</kbd>
          </button>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav aria-label="Navigation agent" className="flex-1 overflow-y-auto overflow-x-hidden py-1 scrollbar-hide">
        {adminMode ? (
          /* ── Admin Mode ── */
          <>
            {/* Back to agent button */}
            <div className="mb-2">
              <button
                onClick={() => setAdminMode(false)}
                className={cn(
                  navRow(isCol, false),
                  'w-full text-theme-secondary hover:text-theme-primary'
                )}
              >
                <MEIcon name="chevron-down" className="h-[18px] w-[18px] flex-shrink-0 stroke-[1.8] rotate-90" />
                <span className={fadeLabel(isCol)}>Retour agent</span>
              </button>
            </div>

            {/* Admin header */}
            {!isCol && !isMinimalSidebar && (
              <div className="px-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-admin-accent" />
                  <span className="text-xs font-semibold text-admin-accent">Admin MEGGA</span>
                </div>
              </div>
            )}

            {/* Admin search */}
            <div className="mb-2">
              <button
                onClick={() => setAdminSearchOpen(true)}
                className={cn(navRow(isCol, false), 'w-full text-theme-secondary')}
              >
                <MEIcon name="search" className="h-[18px] w-[18px] flex-shrink-0 stroke-[1.8]" />
                <span className={fadeLabel(isCol)}>Rechercher...</span>
              </button>
            </div>
            <AdminSearchDialog open={adminSearchOpen} onClose={() => setAdminSearchOpen(false)} />

            {/* Admin items */}
            <div className="space-y-0.5">
              {[
                { labelKey: 'nav.adminLive', href: '/dashboard/admin/live', icon: 'broadcast' },
                { labelKey: 'nav.adminOverview', href: '/dashboard/admin', icon: 'dashboard' },
                { labelKey: 'nav.adminAgencies', href: '/dashboard/admin/agencies', icon: 'building' },
                { labelKey: 'nav.adminUsers', href: '/dashboard/admin/users', icon: 'users' },
                { labelKey: 'nav.adminMonitoring', href: '/dashboard/admin/monitoring', icon: 'broadcast' },
                { labelKey: 'nav.adminMarketplace', href: '/dashboard/admin/marketplace', icon: 'store' },
                { labelKey: 'nav.adminCompliance', href: '/dashboard/admin/compliance', icon: 'shield' },
                { labelKey: 'nav.adminSupport', href: '/dashboard/admin/support', icon: 'help' },
                { labelKey: 'nav.adminChangelog', href: '/dashboard/admin/changelog', icon: 'megaphone' },
                { labelKey: 'nav.adminFlags', href: '/dashboard/admin/feature-flags', icon: 'bolt' },
                { labelKey: 'nav.adminPlans', href: '/dashboard/admin/plans', icon: 'credit-card' },
                { labelKey: 'nav.adminSecurity', href: '/dashboard/admin/security', icon: 'shield' },
                { labelKey: 'nav.adminNps', href: '/dashboard/admin/nps', icon: 'star' },
              ].map((item) => {
                const isItemActive = location.pathname === item.href ||
                  (item.href !== '/dashboard/admin' && location.pathname.startsWith(item.href))
                const label = t(item.labelKey)
                return (
                  <div key={item.href} className="relative">
                    <Link
                      to={item.href}
                      onClick={onClose}
                      onMouseEnter={() => isCol ? setHoveredItem(item.href) : undefined}
                      onMouseLeave={() => setHoveredItem(null)}
                      className={cn(
                        navRow(isCol, isItemActive),
                        isItemActive && '!bg-admin-accent/8 !text-admin-accent'
                      )}
                    >
                      <div className="relative flex-shrink-0">
                        <MEIcon name={item.icon as MEIconName} className={cn('h-[18px] w-[18px] stroke-[1.8]', isItemActive && 'text-admin-accent')} />
                        {item.href === '/dashboard/admin/support' && openTicketCount > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-red-500" />
                        )}
                      </div>
                      <span className={fadeLabel(isCol)}>{label}</span>
                    </Link>
                    <CollapsedTooltip show={isCol && hoveredItem === item.href}>
                      {label}
                      {item.href === '/dashboard/admin/support' && openTicketCount > 0 && <span className="ml-1.5 text-red-500">({openTicketCount})</span>}
                    </CollapsedTooltip>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          /* ── Agent Mode (default) ── */
          <>
            {/* Admin switch — pinned at the top for super_admin so the
                feature is discoverable on first load. Previously this lived
                at the bottom of the nav and was easy to miss (audit B2). */}
            {profile?.role === 'super_admin' && (
              <>
                {!isCol && !isMinimalSidebar && (
                  <div className="px-3 mb-1 mt-1">
                    <span className="text-xs capitalize text-theme-tertiary font-medium select-none">
                      {t('nav.platformSection', { defaultValue: 'Plateforme' })}
                    </span>
                  </div>
                )}
                <div className="relative mb-2">
                  <button
                    onClick={() => setAdminMode(true)}
                    onMouseEnter={() => isCol ? setHoveredItem('admin-switch') : undefined}
                    onMouseLeave={() => setHoveredItem(null)}
                    className={cn(
                      navRow(isCol, false),
                      'w-full text-admin-accent hover:!bg-admin-accent/8'
                    )}
                  >
                    <MEIcon name="shield" className="h-[18px] w-[18px] flex-shrink-0 stroke-[1.8]" />
                    <span className={fadeLabel(isCol)}>Admin MEGGA</span>
                  </button>
                  <CollapsedTooltip show={isCol && hoveredItem === 'admin-switch'}>
                    Admin MEGGA
                  </CollapsedTooltip>
                </div>
              </>
            )}

            {NAV_SECTIONS.map((section) => (
              <div key={section.labelKey}>
                {isCol || isMinimalSidebar ? (
                  <div className="mt-3" />
                ) : (
                  <div className="mt-6 mb-1 px-3">
                    <span className="text-xs capitalize text-theme-tertiary font-medium select-none">
                      {t(section.labelKey)}
                    </span>
                  </div>
                )}

                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = isActive(item.href)
                    const label = t(item.labelKey)
                    return (
                      <div key={item.href} className="relative">
                        <Link
                          to={item.href}
                          onClick={onClose}
                          onMouseEnter={() => isCol ? setHoveredItem(item.href) : undefined}
                          onMouseLeave={() => setHoveredItem(null)}
                          className={navRow(isCol, active)}
                        >
                          <div className="relative flex-shrink-0">
                            <MEIcon name={item.icon as MEIconName} className="w-[18px] h-[18px] stroke-[1.8]" />
                          </div>
                          <span className={fadeLabel(isCol)}>{label}</span>
                        </Link>
                        <CollapsedTooltip show={isCol && hoveredItem === item.href}>
                          {label}
                        </CollapsedTooltip>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </nav>

      {/* ── Bottom ── */}
      <div className="mt-auto shrink-0">
        <div className="mx-3 border-t border-theme-border-subtle mt-2 mb-2" />

        {/* Expand button — collapsed only */}
        <div className={cn('overflow-hidden transition-[height] duration-200', isCol ? 'h-9' : 'h-0')}>
          <div className="relative"
            onMouseEnter={() => setHoveredItem('expand')}
            onMouseLeave={() => setHoveredItem(null)}
          >
            <button
              onClick={onToggleCollapse}
              aria-label="Déplier la sidebar"
              className="mx-auto flex items-center justify-center w-10 h-9 rounded-lg text-theme-secondary hover:bg-theme-hover hover:text-theme-primary transition-colors cursor-pointer"
            >
              <MEIcon name="expand" className="w-[18px] h-[18px] stroke-[1.8]" />
            </button>
            <CollapsedTooltip show={hoveredItem === 'expand'}>Déplier</CollapsedTooltip>
          </div>
        </div>

        {/* Admin notifications — super_admin only */}
        {profile?.role === 'super_admin' && adminMode && (
          <div className="relative"
            onMouseEnter={() => isCol ? setHoveredItem('admin-notif') : undefined}
            onMouseLeave={() => setHoveredItem(null)}
          >
            <AdminNotificationPanel />
            <CollapsedTooltip show={isCol && hoveredItem === 'admin-notif'}>
              Notifications
            </CollapsedTooltip>
          </div>
        )}

        {/* Theme toggle */}
        <div className="relative"
          onMouseEnter={() => isCol ? setHoveredItem('theme') : undefined}
          onMouseLeave={() => setHoveredItem(null)}
        >
          <button
            onClick={toggleTheme}
            aria-label={theme === 'light' ? 'Activer le mode sombre' : 'Activer le mode clair'}
            data-testid="theme-toggle"
            className={cn(navRow(isCol, false), 'w-full')}
          >
            {theme === 'light' ? (
              <MEIcon name="moon" className="w-[18px] h-[18px] stroke-[1.8] flex-shrink-0" />
            ) : (
              <MEIcon name="sun" className="w-[18px] h-[18px] stroke-[1.8] flex-shrink-0" />
            )}
            <span className={fadeLabel(isCol)}>
              {theme === 'light' ? t('nav.darkMode') : t('nav.lightMode')}
            </span>
          </button>
          <CollapsedTooltip show={isCol && hoveredItem === 'theme'}>
            {theme === 'light' ? t('nav.darkMode') : t('nav.lightMode')}
          </CollapsedTooltip>
        </div>

        {/* Settings */}
        <div className="relative"
          onMouseEnter={() => isCol ? setHoveredItem('settings') : undefined}
          onMouseLeave={() => setHoveredItem(null)}
        >
          <Link
            to="/dashboard/settings"
            onClick={onClose}
            className={navRow(isCol, location.pathname.startsWith('/dashboard/settings'))}
          >
            <MEIcon name="settings" className="w-[18px] h-[18px] stroke-[1.8] flex-shrink-0" />
            <span className={fadeLabel(isCol)}>{t('nav.settings')}</span>
          </Link>
          <CollapsedTooltip show={isCol && hoveredItem === 'settings'}>
            {t('nav.settings')}
          </CollapsedTooltip>
        </div>

        {/* Profile */}
        <Link
          to="/dashboard/settings"
          onClick={onClose}
          className={cn(
            'border-t border-theme-border-subtle flex items-center transition-[padding,gap] duration-200 hover:bg-theme-hover mt-1 rounded-lg',
            isCol ? 'justify-center p-2 mx-1.5 mb-2' : 'gap-2.5 p-3 mx-1 mb-1'
          )}
        >
          <UserAvatar name={profile?.full_name ?? 'Gregory Lyonnet'} avatarUrl={avatarUrl} size={isCol ? 'small' : 'default'} />
          <div className={cn(fadeLabel(isCol), 'min-w-0 flex-1')}>
            <p className="text-sm font-medium text-theme-primary leading-tight truncate">{profile?.full_name ?? 'Gregory Lyonnet'}</p>
            <p className="text-xs text-theme-tertiary leading-tight truncate">{t('nav.mainAgent')}</p>
          </div>
          <div className={cn(fadeLabel(isCol))}>
            <button
              onClick={async (e) => { e.preventDefault(); e.stopPropagation(); await signOut() }}
              className="p-1.5 rounded-md hover:bg-theme-card text-theme-tertiary hover:text-danger transition-colors"
              title={t('nav.logout')}
            >
              <MEIcon name="logout" className="h-4 w-4" />
            </button>
          </div>
        </Link>
      </div>
    </div>
  )

  const isDesktopCollapsed = collapsed

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-shrink-0 bg-theme-card border-r border-theme-border h-screen sticky top-0 z-40 transition-[width] duration-200 ease-out',
          isDesktopCollapsed ? 'w-16' : 'w-64'
        )}
        style={{ willChange: 'width', transform: 'translateZ(0)' }}
      >
        {sidebarContent(isDesktopCollapsed)}
      </aside>

      {/* Tablet — always collapsed */}
      <aside className="hidden md:flex lg:hidden w-16 flex-shrink-0 bg-theme-card border-r border-theme-border h-screen sticky top-0 z-40">
        {sidebarContent(true)}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-theme-overlay/30 backdrop-blur-sm z-40 md:hidden" onClick={onClose} />
          <aside className="fixed inset-y-0 left-0 w-64 bg-theme-card z-50 md:hidden shadow-modal transform transition-transform duration-300 ease-out">
            {sidebarContent(false)}
          </aside>
        </>
      )}
    </>
  )
}
