import { useState, useRef, useEffect, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Plus, Menu, X, LogOut, LayoutDashboard, User, Sun, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'

const navLinks = [
  { label: 'Acheter', href: '/acheter' },
  { label: 'Louer', href: '/louer' },
  { label: 'Vendre', href: '/vendre' },
  { label: 'Estimations', href: '/estimations' },
  { label: 'Services', href: '/services' },
]

function UserAvatar({ name, email }: { name: string; email: string }) {
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : email[0].toUpperCase()

  return (
    <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center">
      <span className="text-xs font-semibold text-white" aria-hidden="true">{initials}</span>
    </div>
  )
}

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, loading, signOut } = useAuth()
  const { resolvedTheme, setTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [dropdownOpen])

  // Close dropdown on Escape
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setDropdownOpen(false)
    }
  }, [])

  const displayName = user?.user_metadata?.full_name || user?.email || ''
  const displayEmail = user?.email || ''

  async function handleSignOut() {
    await signOut()
    setDropdownOpen(false)
    navigate('/')
  }

  return (
    <header className="h-16 border-b border-border bg-card shadow-navbar sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 h-full flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex-shrink-0" aria-label="MEGGA — Accueil">
          <span className="text-2xl font-bold tracking-tight text-primary-900">MEGGA</span>
        </Link>

        {/* Navigation desktop */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Navigation principale">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.href
            return (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  'px-3 py-2 text-sm font-medium transition-colors rounded-md',
                  isActive
                    ? 'text-accent border-b-2 border-accent'
                    : 'text-primary-700 hover:text-accent'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        {/* Actions desktop */}
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-lg hover:bg-[var(--bg-surface)] text-primary-500 hover:text-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-accent/20"
            aria-label={resolvedTheme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
            title="Changer de thème"
          >
            {resolvedTheme === 'dark' ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
          </button>
          <Button
            size="default"
            className="rounded-full gap-2"
            onClick={() => {
              if (user) {
                navigate('/dashboard/listings/new')
              } else {
                navigate('/login', { state: { from: { pathname: '/dashboard/listings/new' } } })
              }
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Publier une annonce
          </Button>

          {loading ? (
            <div className="h-9 w-9 rounded-full bg-section animate-pulse" role="status" aria-label="Chargement" />
          ) : user ? (
            /* Logged in — avatar dropdown */
            <div className="relative" ref={dropdownRef} onKeyDown={handleKeyDown}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="rounded-full focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
                aria-label={`Menu utilisateur — ${displayName}`}
              >
                <UserAvatar name={displayName} email={displayEmail} />
              </button>

              {dropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-64 bg-card rounded-card shadow-dropdown border border-border py-2 z-50"
                  role="menu"
                  aria-label="Menu utilisateur"
                >
                  {/* User info */}
                  <div className="px-4 py-3 border-b border-border" role="none">
                    <p className="text-sm font-medium text-primary-900 truncate">
                      {displayName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {displayEmail}
                    </p>
                  </div>

                  {/* Menu items */}
                  <div className="py-1" role="none">
                    <Link
                      to="/dashboard"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-primary-700 hover:bg-section transition-colors"
                      onClick={() => setDropdownOpen(false)}
                      role="menuitem"
                    >
                      <LayoutDashboard className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      Dashboard
                    </Link>
                    <Link
                      to="/settings/profile"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-primary-700 hover:bg-section transition-colors"
                      onClick={() => setDropdownOpen(false)}
                      role="menuitem"
                    >
                      <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      Mon profil
                    </Link>
                  </div>

                  {/* Sign out */}
                  <div className="border-t border-border pt-1" role="none">
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-danger hover:bg-danger-light transition-colors w-full text-left"
                      role="menuitem"
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      Déconnexion
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Not logged in */
            <Link to="/login">
              <Button variant="outline" size="default" className="rounded-full">
                Se connecter
              </Button>
            </Link>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden p-2 rounded-md hover:bg-section focus:outline-none focus:ring-2 focus:ring-accent"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
          aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        >
          {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div id="mobile-menu" className="md:hidden bg-card border-b border-border shadow-dropdown">
          <nav className="flex flex-col px-4 py-3 gap-1" aria-label="Navigation principale mobile">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="px-3 py-2 text-sm font-medium text-primary-700 hover:text-accent hover:bg-section rounded-md"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}

            {/* Mobile auth section */}
            <div className="flex flex-col gap-2 pt-3 border-t border-border mt-2">
              <Button
                size="default"
                className="rounded-full gap-2 w-full"
                onClick={() => {
                  setMobileOpen(false)
                  if (user) {
                    navigate('/dashboard/listings/new')
                  } else {
                    navigate('/login', { state: { from: { pathname: '/dashboard/listings/new' } } })
                  }
                }}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Publier une annonce
              </Button>

              {user ? (
                <>
                  <div className="flex items-center gap-3 px-3 py-2">
                    <UserAvatar name={displayName} email={displayEmail} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-primary-900 truncate">{displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
                    </div>
                  </div>
                  <Link
                    to="/dashboard"
                    className="px-3 py-2 text-sm font-medium text-primary-700 hover:bg-section rounded-md"
                    onClick={() => setMobileOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={() => {
                      handleSignOut()
                      setMobileOpen(false)
                    }}
                    className="px-3 py-2 text-sm font-medium text-danger hover:bg-danger-light rounded-md text-left"
                  >
                    Déconnexion
                  </button>
                </>
              ) : (
                <Link to="/login" onClick={() => setMobileOpen(false)}>
                  <Button variant="outline" size="default" className="rounded-full w-full">
                    Se connecter
                  </Button>
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
