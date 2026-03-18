import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Plus, Menu, X, LogOut, LayoutDashboard, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

const navLinks = [
  { label: 'Acheter', href: '/search?context=buy' },
  { label: 'Louer', href: '/search?context=rent' },
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
  const { user, loading, signOut } = useAuth()
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

  const displayName = user?.user_metadata?.full_name || user?.email || ''
  const displayEmail = user?.email || ''

  async function handleSignOut() {
    await signOut()
    setDropdownOpen(false)
    navigate('/')
  }

  return (
    <header className="h-16 border-b border-gray-100 bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 h-full flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex-shrink-0 mr-12">
          <span className="text-2xl font-bold tracking-tight text-primary-900">MEGGA</span>
        </Link>

        {/* Navigation desktop */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => {
            const linkUrl = new URL(link.href, window.location.origin)
            const isActive =
              location.pathname === linkUrl.pathname &&
              (linkUrl.search
                ? location.search.includes(linkUrl.search.slice(1))
                : !location.search)
            return (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  'text-sm transition-colors',
                  isActive
                    ? 'text-primary-900 font-semibold'
                    : 'text-gray-600 font-medium hover:text-primary-900'
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        {/* Actions desktop */}
        <div className="hidden md:flex items-center gap-4">
          {loading ? (
            <div className="h-8 w-8 rounded-full bg-gray-100 animate-pulse" />
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
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-dropdown border border-gray-100 py-2 z-50">
                  {/* User info */}
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-primary-900 truncate">
                      {displayName}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {displayEmail}
                    </p>
                  </div>

                  {/* Menu items */}
                  <div className="py-1">
                    <Link
                      to="/dashboard"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <LayoutDashboard className="h-4 w-4 text-gray-400" />
                      Dashboard
                    </Link>
                    <Link
                      to="/settings/profile"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <User className="h-4 w-4 text-gray-400" />
                      Mon profil
                    </Link>
                  </div>

                  {/* Sign out */}
                  <div className="border-t border-gray-100 pt-1">
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-danger hover:bg-red-50 transition-colors w-full text-left"
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
            <Link to="/login" className="text-sm font-medium text-primary-900 hover:text-accent transition-colors">
              Se connecter
            </Link>
          )}

          <button className="h-9 px-5 text-sm font-medium rounded-full bg-accent text-white hover:bg-accent/90 transition-colors flex items-center gap-2 cursor-pointer">
            <Plus className="h-3.5 w-3.5" />
            Publier une annonce
          </button>
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
              <Button size="default" className="rounded-full gap-2 w-full">
                <Plus className="h-4 w-4" />
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
