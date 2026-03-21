import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Plus, Menu, X, LogOut, LayoutDashboard, HelpCircle, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

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
      <span className="text-xs font-semibold text-white">{initials}</span>
    </div>
  )
}

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, profile, loading, signOut, isAgent } = useAuth()
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

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email || ''
  const displayEmail = user?.email || ''

  async function handleSignOut() {
    setDropdownOpen(false)
    await signOut()
    navigate('/')
  }

  return (
    <header className="h-16 border-b border-border bg-white shadow-navbar sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 h-full flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex-shrink-0">
          <img src="/megga-logo.svg" alt="MEGGA" className="h-5 hidden sm:block" />
          <img src="/megga-gg.svg" alt="MEGGA" className="h-5 sm:hidden" />
        </Link>

        {/* Navigation desktop */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.href
            return (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  'px-3 py-2 text-sm font-medium transition-colors rounded-md',
                  isActive
                    ? 'text-accent font-semibold'
                    : 'text-primary-700 hover:text-accent'
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        {/* Actions desktop */}
        <div className="hidden md:flex items-center gap-3">
          <Link to="/publier">
            <Button size="default" className="rounded-full gap-2">
              <Plus className="h-4 w-4" />
              Publier une annonce
            </Button>
          </Link>

          {loading ? (
            <div className="h-9 w-9 rounded-full bg-section animate-pulse" />
          ) : user ? (
            /* Logged in — avatar dropdown */
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="rounded-full focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
              >
                <UserAvatar name={displayName} email={displayEmail} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-dropdown border border-border py-2 z-50">
                  {/* User info */}
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm font-medium text-primary-900 truncate">
                      {displayName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {displayEmail}
                    </p>
                  </div>

                  {/* Menu items — role-aware */}
                  <div className="py-1">
                    <Link
                      to={isAgent ? '/dashboard' : '/portal'}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-primary-700 hover:bg-section transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      {isAgent ? (
                        <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <User className="h-4 w-4 text-muted-foreground" />
                      )}
                      {isAgent ? 'Dashboard' : 'Mon espace'}
                    </Link>
                    <Link
                      to="/aide"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-primary-700 hover:bg-section transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      Aide
                    </Link>
                  </div>

                  {/* Sign out */}
                  <div className="border-t border-border pt-1">
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-danger hover:bg-danger-light transition-colors w-full text-left"
                    >
                      <LogOut className="h-4 w-4" />
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
          className="md:hidden p-2 rounded-md hover:bg-section"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-b border-border shadow-dropdown">
          <nav className="flex flex-col px-4 py-3 gap-1">
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
              <Link to="/publier" onClick={() => setMobileOpen(false)}>
                <Button size="default" className="rounded-full gap-2 w-full">
                  <Plus className="h-4 w-4" />
                  Publier une annonce
                </Button>
              </Link>

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
                    to={isAgent ? '/dashboard' : '/portal'}
                    className="px-3 py-2 text-sm font-medium text-primary-700 hover:bg-section rounded-md"
                    onClick={() => setMobileOpen(false)}
                  >
                    {isAgent ? 'Dashboard' : 'Mon espace'}
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
