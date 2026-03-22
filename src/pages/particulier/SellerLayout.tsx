import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  Home, Eye, HandCoins, FileText, MessageCircle,
  Menu, X, PanelLeftClose, PanelLeftOpen,
  Phone, Mail, LogOut, Moon, Sun,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeProvider, useTheme } from '@/hooks/useTheme'
import { MOCK_SELLER_DATA } from '@/lib/mockSellerData'

// ── Nav items ────────────────────────────────────────────────────────────

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  badge?: number
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Mon bien', href: '/portail', icon: Home },
  { label: 'Visites', href: '/portail/visites', icon: Eye, badge: 1 },
  { label: 'Offres', href: '/portail/offres', icon: HandCoins, badge: 1 },
  { label: 'Documents', href: '/portail/documents', icon: FileText },
  { label: 'Messages', href: '/portail/messages', icon: MessageCircle },
]

// ── Fade label helper ────────────────────────────────────────────────────

const fadeLabel = (collapsed: boolean) =>
  cn(
    'overflow-hidden whitespace-nowrap transition-[opacity,max-width] duration-200 ease-out',
    collapsed ? 'max-w-0 opacity-0' : 'max-w-[180px] opacity-100'
  )

// ── Collapsed tooltip ────────────────────────────────────────────────────

function CollapsedTooltip({ show, children }: { show: boolean; children: React.ReactNode }) {
  if (!show) return null
  return (
    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 bg-theme-primary text-theme-inverse text-xs px-2 py-1 rounded-md shadow-lg whitespace-nowrap pointer-events-none animate-in fade-in-0 duration-100">
      {children}
    </div>
  )
}

// ── Inner layout (inside ThemeProvider) ──────────────────────────────────

function SellerLayoutInner() {
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const { property, agent } = MOCK_SELLER_DATA

  function isActive(href: string) {
    if (href === '/portail') return location.pathname === '/portail'
    return location.pathname.startsWith(href)
  }

  const navRow = (isCol: boolean, active: boolean) => cn(
    'flex items-center h-9 rounded-lg cursor-pointer select-none transition-colors duration-150',
    isCol ? 'mx-auto justify-center w-10' : 'mx-2 px-2.5 gap-2.5 text-sm',
    active
      ? 'bg-accent/8 text-accent font-medium'
      : 'text-theme-secondary hover:bg-theme-hover hover:text-theme-primary'
  )

  const sidebarContent = (isCol: boolean) => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Logo */}
      <div className={cn('h-14 flex items-center border-b border-theme-border-subtle shrink-0 transition-[padding] duration-200', isCol ? 'justify-center px-2' : 'px-4')}>
        <Link to="/portail" className="flex items-center shrink-0">
          {isCol ? (
            <img src="/megga-gg.svg" alt="MEGGA" className="h-5 w-auto" style={{ filter: 'var(--logo-filter, none)' }} />
          ) : (
            <img src="/megga-logo.svg" alt="MEGGA" className="h-5 w-auto" style={{ filter: 'var(--logo-filter, none)' }} />
          )}
        </Link>
        {!isCol && (
          <div className="ml-auto flex items-center gap-0.5">
            <button
              onClick={() => setCollapsed(true)}
              className="hidden lg:flex p-1.5 rounded-md hover:bg-theme-hover transition-colors"
            >
              <PanelLeftClose className="h-4 w-4 text-theme-tertiary" />
            </button>
            <button onClick={() => setMobileOpen(false)} className="lg:hidden p-1.5 rounded-md hover:bg-theme-hover">
              <X className="h-5 w-5 text-theme-muted" />
            </button>
          </div>
        )}
      </div>

      {/* Property context */}
      {!isCol && (
        <div className="mx-3 mt-3 mb-2 p-3 rounded-lg bg-theme-hover/50">
          <p className="text-xs font-medium text-theme-primary truncate">{property.title}</p>
          <p className="text-[10px] text-theme-tertiary truncate mt-0.5">{property.address}, {property.city}</p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2">
        {!isCol && (
          <div className="mb-1 px-3">
            <span className="text-[10px] uppercase tracking-[0.08em] text-theme-tertiary font-medium select-none">
              Mon espace
            </span>
          </div>
        )}
        <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href)
            return (
              <div key={item.href} className="relative">
                <Link
                  to={item.href}
                  onClick={() => setMobileOpen(false)}
                  onMouseEnter={() => isCol ? setHoveredItem(item.href) : undefined}
                  onMouseLeave={() => setHoveredItem(null)}
                  className={navRow(isCol, active)}
                >
                  <div className="relative flex-shrink-0">
                    <item.icon className="w-[18px] h-[18px] stroke-[1.8]" />
                    {item.badge && item.badge > 0 && (
                      <span className={cn(
                        'absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 transition-opacity duration-200',
                        isCol ? 'opacity-100' : 'opacity-0'
                      )} />
                    )}
                  </div>
                  <span className={fadeLabel(isCol)}>{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <span className={cn(
                      'ml-auto w-2 h-2 rounded-full bg-red-500 shrink-0 transition-opacity duration-200',
                      isCol ? 'opacity-0 absolute' : 'opacity-100'
                    )} />
                  )}
                </Link>
                <CollapsedTooltip show={isCol && hoveredItem === item.href}>
                  {item.label}
                </CollapsedTooltip>
              </div>
            )
          })}
        </div>
      </nav>

      {/* Bottom */}
      <div className="mt-auto shrink-0">
        <div className="mx-3 border-t border-theme-border-subtle mt-2 mb-2" />

        {/* Expand button — collapsed */}
        <div className={cn('overflow-hidden transition-[height] duration-200', isCol ? 'h-9' : 'h-0')}>
          <div className="relative"
            onMouseEnter={() => setHoveredItem('expand')}
            onMouseLeave={() => setHoveredItem(null)}
          >
            <button
              onClick={() => setCollapsed(false)}
              className="mx-auto flex items-center justify-center w-10 h-9 rounded-lg text-theme-secondary hover:bg-theme-hover hover:text-theme-primary transition-colors cursor-pointer"
            >
              <PanelLeftOpen className="w-[18px] h-[18px] stroke-[1.8]" />
            </button>
            <CollapsedTooltip show={hoveredItem === 'expand'}>Déplier</CollapsedTooltip>
          </div>
        </div>

        {/* Agent contact */}
        {!isCol && (
          <div className="mx-2 mb-2 p-3 rounded-lg hover:bg-theme-hover transition-colors">
            <p className="text-[10px] text-theme-tertiary uppercase tracking-wider mb-2">Votre agent</p>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-accent text-white text-[10px] font-semibold flex items-center justify-center shrink-0">
                {agent.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-theme-primary truncate">{agent.name}</p>
                <p className="text-[10px] text-theme-tertiary">MEGGA Immobilier</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <a href={`tel:${agent.phone}`} className="flex-1 h-7 rounded-md border border-theme-border flex items-center justify-center gap-1 text-[10px] text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors">
                <Phone className="w-3 h-3" /> Appeler
              </a>
              <a href={`mailto:${agent.email}`} className="flex-1 h-7 rounded-md border border-theme-border flex items-center justify-center gap-1 text-[10px] text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors">
                <Mail className="w-3 h-3" /> Email
              </a>
            </div>
          </div>
        )}

        {/* Theme toggle */}
        <div className="relative"
          onMouseEnter={() => isCol ? setHoveredItem('theme') : undefined}
          onMouseLeave={() => setHoveredItem(null)}
        >
          <button
            onClick={toggleTheme}
            className={cn(navRow(isCol, false), 'w-full')}
          >
            {theme === 'light' ? (
              <Moon className="w-[18px] h-[18px] stroke-[1.8] flex-shrink-0" />
            ) : (
              <Sun className="w-[18px] h-[18px] stroke-[1.8] flex-shrink-0" />
            )}
            <span className={fadeLabel(isCol)}>
              {theme === 'light' ? 'Mode sombre' : 'Mode clair'}
            </span>
          </button>
          <CollapsedTooltip show={isCol && hoveredItem === 'theme'}>
            {theme === 'light' ? 'Mode sombre' : 'Mode clair'}
          </CollapsedTooltip>
        </div>

        {/* Logout placeholder */}
        <div className="relative"
          onMouseEnter={() => isCol ? setHoveredItem('logout') : undefined}
          onMouseLeave={() => setHoveredItem(null)}
        >
          <button className={cn(navRow(isCol, false), 'w-full mb-2')}>
            <LogOut className="w-[18px] h-[18px] stroke-[1.8] flex-shrink-0" />
            <span className={fadeLabel(isCol)}>Déconnexion</span>
          </button>
          <CollapsedTooltip show={isCol && hoveredItem === 'logout'}>Déconnexion</CollapsedTooltip>
        </div>
      </div>
    </div>
  )

  const isDesktopCollapsed = collapsed

  return (
    <div className="flex h-screen overflow-hidden bg-theme-section isolate">
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

      {/* Tablet — collapsed */}
      <aside className="hidden md:flex lg:hidden w-16 flex-shrink-0 bg-theme-card border-r border-theme-border h-screen sticky top-0 z-40">
        {sidebarContent(true)}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-theme-overlay/30 backdrop-blur-sm z-40 md:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed inset-y-0 left-0 w-64 bg-theme-card z-50 md:hidden shadow-modal transform transition-transform duration-300 ease-out">
            {sidebarContent(false)}
          </aside>
        </>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden h-14 bg-theme-card border-b border-theme-border flex items-center px-4 sticky top-0 z-30">
          <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 rounded-lg hover:bg-theme-hover">
            <Menu className="h-5 w-5 text-theme-secondary" />
          </button>
          <div className="ml-3 flex items-center gap-2">
            <div className="h-6 w-6 bg-theme-primary rounded flex items-center justify-center">
              <span className="text-[9px] font-bold text-theme-inverse">GG</span>
            </div>
            <span className="text-sm font-bold text-theme-primary">MEGGA</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

// ── Export with ThemeProvider ─────────────────────────────────────────────

export default function SellerLayout() {
  return (
    <ThemeProvider>
      <SellerLayoutInner />
    </ThemeProvider>
  )
}
