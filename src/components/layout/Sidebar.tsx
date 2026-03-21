import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Sparkles, LayoutDashboard, Users, GitBranch, Shuffle, Building2, Plus,
  MessageSquare, Calendar, ShieldCheck, FileText, Zap, Settings, LogOut, X, Search,
  Moon, Sun, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'

interface NavSection {
  label: string
  items: NavItem[]
}

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  badge?: number
  badgeColor?: string
  isCreateAction?: boolean
}

const navSections: NavSection[] = [
  {
    label: 'Principal',
    items: [
      { label: "Aujourd'hui", href: '/dashboard', icon: Sparkles, badge: 5, badgeColor: 'bg-accent text-accent-foreground' },
      { label: 'Dashboard', href: '/dashboard/analytics', icon: LayoutDashboard },
    ],
  },
  {
    label: 'CRM',
    items: [
      { label: 'Contacts', href: '/dashboard/contacts', icon: Users },
      { label: 'Pipeline', href: '/dashboard/pipeline', icon: GitBranch, badge: 12, badgeColor: 'bg-theme-active text-theme-secondary' },
      { label: 'Matching', href: '/dashboard/matching', icon: Shuffle, badge: 3, badgeColor: 'bg-accent-light text-accent' },
    ],
  },
  {
    label: 'Biens',
    items: [
      { label: 'Mes biens', href: '/dashboard/listings', icon: Building2, badge: 8, badgeColor: 'bg-theme-active text-theme-secondary' },
      { label: 'Créer un bien', href: '/dashboard/listings/new', icon: Plus, isCreateAction: true },
    ],
  },
  {
    label: 'Communication',
    items: [
      { label: 'Messages', href: '/dashboard/messages', icon: MessageSquare, badge: 4, badgeColor: 'bg-accent text-accent-foreground' },
      { label: 'Calendrier', href: '/dashboard/calendar', icon: Calendar },
    ],
  },
  {
    label: 'Conformité',
    items: [
      { label: 'KYC', href: '/dashboard/kyc', icon: ShieldCheck, badge: 2, badgeColor: 'bg-warning-light text-warning-dark' },
      { label: 'Documents', href: '/dashboard/documents', icon: FileText },
      { label: 'Automatisation', href: '/dashboard/automation', icon: Zap },
    ],
  },
]

interface SidebarProps {
  mobileOpen: boolean
  collapsed?: boolean
  onClose: () => void
  onToggleCollapse?: () => void
  onOpenCommandPalette?: () => void
}

function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="h-8 w-8 rounded-full bg-accent text-accent-foreground text-xs font-semibold flex items-center justify-center flex-shrink-0">
      {initials}
    </div>
  )
}

function NavIcon({ icon: Icon, isCreateAction }: { icon: React.ElementType; isCreateAction?: boolean }) {
  if (isCreateAction) {
    return (
      <div className="w-5 h-5 rounded-full bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
        <Icon className="w-3.5 h-3.5" />
      </div>
    )
  }
  return <Icon className="w-[18px] h-[18px] stroke-[1.8] flex-shrink-0" />
}

export default function Sidebar({ mobileOpen, collapsed = false, onClose, onToggleCollapse, onOpenCommandPalette }: SidebarProps) {
  const location = useLocation()
  const { signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)

  function isActive(href: string) {
    if (href === '/dashboard') return location.pathname === '/dashboard'
    return location.pathname.startsWith(href)
  }

  const sidebarContent = (isCollapsed: boolean) => (
    <div className="flex flex-col h-full">
      {/* Header: Logo */}
      <div className={cn(
        'h-14 flex items-center border-b border-theme-border-subtle shrink-0',
        isCollapsed ? 'justify-center px-2' : 'gap-2.5 px-4'
      )}>
        <Link to="/" className="flex items-center gap-2.5 shrink-0" onClick={onClose}>
          {isCollapsed ? (
            <img src="/megga-gg.svg" alt="MEGGA" className="h-6 w-auto text-theme-primary" style={{ filter: 'var(--logo-filter, none)' }} />
          ) : (
            <img src="/megga-logo.svg" alt="MEGGA" className="h-5 w-auto" style={{ filter: 'var(--logo-filter, none)' }} />
          )}
        </Link>
        {!isCollapsed && (
          <div className="ml-auto flex items-center gap-0.5">
            {/* Desktop collapse button */}
            <button
              onClick={onToggleCollapse}
              className="hidden lg:flex p-1.5 rounded-md hover:bg-theme-hover transition-colors"
              title="Réduire la sidebar"
            >
              <PanelLeftClose className="h-4 w-4 text-theme-tertiary" />
            </button>
            {/* Mobile close button */}
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-md hover:bg-theme-hover"
            >
              <X className="h-5 w-5 text-theme-muted" />
            </button>
          </div>
        )}
        {isCollapsed && onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex p-1.5 rounded-md hover:bg-theme-hover transition-colors"
            title="Ouvrir la sidebar"
          >
            <PanelLeftOpen className="h-4 w-4 text-theme-tertiary" />
          </button>
        )}
      </div>

      {/* Quick search */}
      {!isCollapsed ? (
        <div className="mx-3 mt-3 mb-1">
          <button
            onClick={() => onOpenCommandPalette?.()}
            className="w-full h-8 bg-theme-input rounded-lg px-3 flex items-center gap-2 text-xs text-theme-muted hover:bg-theme-hover transition-colors"
          >
            <Search className="w-3.5 h-3.5 text-theme-tertiary" />
            <span className="flex-1 text-left">Rechercher...</span>
            <kbd className="text-[10px] bg-theme-active text-theme-tertiary px-1.5 py-0.5 rounded font-mono">
              ⌘K
            </kbd>
          </button>
        </div>
      ) : (
        <div className="flex justify-center mt-3 mb-1">
          <button
            onClick={() => onOpenCommandPalette?.()}
            className="w-9 h-8 bg-theme-input rounded-lg flex items-center justify-center hover:bg-theme-hover transition-colors"
          >
            <Search className="w-4 h-4 text-theme-tertiary" />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-1">
        {navSections.map((section) => (
          <div key={section.label}>
            {/* Section label */}
            {!isCollapsed && (
              <div className="text-[10px] uppercase tracking-[0.08em] text-theme-tertiary font-medium mt-6 mb-1 px-3 select-none">
                {section.label}
              </div>
            )}
            {isCollapsed && <div className="mt-4" />}

            {/* Items */}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href)
                return (
                  <div key={item.href} className="relative">
                    <Link
                      to={item.href}
                      onClick={onClose}
                      onMouseEnter={() => isCollapsed ? setHoveredItem(item.href) : undefined}
                      onMouseLeave={() => setHoveredItem(null)}
                      className={cn(
                        'flex items-center transition-all duration-150 ease-out cursor-pointer select-none',
                        isCollapsed
                          ? 'mx-2 justify-center h-9 rounded-lg'
                          : 'mx-2 px-2.5 h-9 rounded-lg gap-2.5 text-sm font-normal',
                        active
                          ? isCollapsed
                            ? 'bg-accent/8 text-accent'
                            : 'bg-accent/8 text-accent font-medium'
                          : 'text-theme-secondary hover:bg-theme-hover hover:text-theme-primary'
                      )}
                    >
                      <div className="relative">
                        <NavIcon icon={item.icon} isCreateAction={item.isCreateAction} />
                        {/* Collapsed badge dot */}
                        {isCollapsed && item.badge && item.badge > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500" />
                        )}
                      </div>

                      {!isCollapsed && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge && item.badge > 0 && (
                            <span className="ml-auto w-2 h-2 rounded-full bg-red-500 shrink-0" />
                          )}
                        </>
                      )}
                    </Link>

                    {/* Collapsed tooltip */}
                    {isCollapsed && hoveredItem === item.href && (
                      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 bg-theme-primary text-theme-inverse text-xs px-2 py-1 rounded-md shadow-lg whitespace-nowrap pointer-events-none">
                        {item.label}
                        {item.badge && item.badge > 0 && (
                          <span className="ml-1.5 text-theme-tertiary">({item.badge})</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Separator + Theme toggle + Settings + Profile */}
      <div className="mt-auto shrink-0">
        <div className="mx-3 border-t border-theme-border-subtle mt-2 mb-2" />

        {/* Theme toggle */}
        <div className="relative">
          <button
            onClick={toggleTheme}
            onMouseEnter={() => { if (isCollapsed) setHoveredItem('theme') }}
            onMouseLeave={() => setHoveredItem(null)}
            className={cn(
              'flex items-center transition-all duration-150 ease-out cursor-pointer select-none',
              isCollapsed
                ? 'mx-2 justify-center w-9 h-9 rounded-lg'
                : 'mx-2 px-2.5 h-9 rounded-lg gap-2.5 text-sm font-normal w-[calc(100%-16px)]',
              'text-theme-secondary hover:bg-theme-hover hover:text-theme-primary'
            )}
          >
            {theme === 'light' ? (
              <Moon className="w-[18px] h-[18px] stroke-[1.8] flex-shrink-0" />
            ) : (
              <Sun className="w-[18px] h-[18px] stroke-[1.8] flex-shrink-0" />
            )}
            {!isCollapsed && (
              <span>{theme === 'light' ? 'Mode sombre' : 'Mode clair'}</span>
            )}
          </button>

          {isCollapsed && hoveredItem === 'theme' && (
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 bg-theme-primary text-theme-inverse text-xs px-2 py-1 rounded-md shadow-lg whitespace-nowrap pointer-events-none">
              {theme === 'light' ? 'Mode sombre' : 'Mode clair'}
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="relative">
          <Link
            to="/dashboard/settings"
            onClick={onClose}
            onMouseEnter={() => isCollapsed ? setHoveredItem('settings') : undefined}
            onMouseLeave={() => setHoveredItem(null)}
            className={cn(
              'flex items-center transition-all duration-150 ease-out cursor-pointer select-none',
              isCollapsed
                ? 'mx-2 justify-center h-9 rounded-lg'
                : 'mx-2 px-2.5 h-9 rounded-lg gap-2.5 text-sm font-normal',
              location.pathname.startsWith('/dashboard/settings')
                ? 'bg-accent/8 text-accent font-medium'
                : 'text-theme-secondary hover:bg-theme-hover hover:text-theme-primary'
            )}
          >
            <Settings className="w-[18px] h-[18px] stroke-[1.8] flex-shrink-0" />
            {!isCollapsed && <span>Paramètres</span>}
          </Link>

          {isCollapsed && hoveredItem === 'settings' && (
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 bg-theme-primary text-theme-inverse text-xs px-2 py-1 rounded-md shadow-lg whitespace-nowrap pointer-events-none">
              Paramètres
            </div>
          )}
        </div>

        {/* Profile */}
        <Link
          to="/dashboard/settings"
          onClick={onClose}
          className={cn(
            'border-t border-theme-border-subtle flex items-center transition-colors duration-150 hover:bg-theme-hover rounded-lg mt-1',
            isCollapsed ? 'justify-center p-2 mx-2 mb-2' : 'gap-2.5 p-3 mx-1 mb-1'
          )}
        >
          <UserAvatar name="Gregory Lyonnet" />
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-theme-primary leading-tight truncate">Gregory Lyonnet</p>
              <p className="text-[11px] text-theme-tertiary leading-tight truncate">Agent principal</p>
            </div>
          )}
          {!isCollapsed && (
            <button
              onClick={async (e) => { e.preventDefault(); e.stopPropagation(); await signOut() }}
              className="p-1.5 rounded-md hover:bg-theme-card text-theme-tertiary hover:text-danger transition-colors"
              title="Déconnexion"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </Link>
      </div>
    </div>
  )

  // Desktop: collapsed state is controlled by prop. Tablet (md to lg): always collapsed.
  const isDesktopCollapsed = collapsed

  return (
    <>
      {/* Desktop sidebar — collapsible */}
      <aside className={cn(
        'hidden lg:flex flex-shrink-0 bg-theme-card border-r border-theme-border h-screen sticky top-0 z-40 transition-all duration-200',
        isDesktopCollapsed ? 'w-16' : 'w-64'
      )}>
        {sidebarContent(isDesktopCollapsed)}
      </aside>

      {/* Tablet sidebar — always collapsed (md to lg) */}
      <aside className="hidden md:flex lg:hidden w-16 flex-shrink-0 bg-theme-card border-r border-theme-border h-screen sticky top-0 z-40">
        {sidebarContent(true)}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-theme-overlay/30 backdrop-blur-sm z-40 md:hidden"
            onClick={onClose}
          />
          <aside className="fixed inset-y-0 left-0 w-64 bg-theme-card z-50 md:hidden shadow-modal transform transition-transform duration-300 ease-out">
            {sidebarContent(false)}
          </aside>
        </>
      )}
    </>
  )
}
