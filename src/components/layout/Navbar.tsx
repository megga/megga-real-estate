import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, LogOut, LayoutDashboard, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useAvatar } from '@/hooks/useAvatar'

const navLinks = [
  { label: 'Acheter', href: '/acheter' },
  { label: 'Louer', href: '/louer' },
  { label: 'Vendre', href: '/vendre' },
  { label: 'Estimations', href: '/estimations' },
  { label: 'Services', href: '/services' },
]

function UserAvatar({ name, email, avatarUrl }: { name: string; email: string; avatarUrl?: string | null }) {
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : email[0].toUpperCase()

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || email}
        className="h-9 w-9 rounded-full object-cover"
      />
    )
  }

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
  const { avatarUrl } = useAvatar()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Track scroll for glass effect
  const isHome = location.pathname === '/'
  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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

  // On home page at top: transparent navbar with white text
  const isTransparent = isHome && !scrolled && !mobileOpen

  return (
    <header
      className={cn(
        'h-16 sticky top-0 z-50 transition-all duration-300',
        isTransparent
          ? 'bg-transparent border-b border-white/10'
          : 'bg-white/95 backdrop-blur-md border-b border-gray-100'
      )}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 h-full flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex-shrink-0">
          <img
            src="/megga-logo.svg"
            alt="MEGGA"
            className={cn('h-7 hidden sm:block transition-all', isTransparent && 'brightness-0 invert')}
          />
          <img
            src="/megga-gg.svg"
            alt="MEGGA"
            className={cn('h-6 sm:hidden transition-all', isTransparent && 'brightness-0 invert')}
          />
        </Link>

        {/* Navigation desktop */}
        <nav className="hidden md:flex items-center gap-1.5">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.href
            return (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  'relative px-4 py-2 text-[15px] font-medium transition-colors rounded-md',
                  isActive
                    ? isTransparent
                      ? 'text-white font-semibold'
                      : 'text-accent font-semibold'
                    : isTransparent
                      ? 'text-white/80 hover:text-white'
                      : 'text-gray-600 hover:text-gray-900'
                )}
              >
                {link.label}
                {isActive && (
                  <span
                    className={cn(
                      'absolute bottom-0 left-4 right-4 h-0.5 rounded-full',
                      isTransparent ? 'bg-white' : 'bg-accent'
                    )}
                  />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Actions desktop */}
        <div className="hidden md:flex items-center gap-3">
          <Link to="/publier">
            <button
              className={cn(
                'h-10 px-5 text-sm font-medium rounded-full border transition-colors',
                isTransparent
                  ? 'border-white/30 text-white hover:bg-white/10'
                  : 'border-gray-200 text-gray-700 hover:text-gray-900 hover:border-gray-400'
              )}
            >
              Publier une annonce
            </button>
          </Link>

          {loading ? (
            <div className="h-9 w-9 rounded-full bg-gray-100 animate-pulse" />
          ) : user ? (
            /* Logged in — avatar dropdown */
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                aria-label="Mon compte"
                className="rounded-full focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
              >
                <UserAvatar name={displayName} email={displayEmail} avatarUrl={avatarUrl} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                  {/* User info */}
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {displayName}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {displayEmail}
                    </p>
                  </div>

                  {/* Menu items — role-aware */}
                  <div className="py-1">
                    <Link
                      to={isAgent ? '/dashboard' : '/portail'}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      {isAgent ? (
                        <LayoutDashboard className="h-4 w-4 text-gray-400" />
                      ) : (
                        <User className="h-4 w-4 text-gray-400" />
                      )}
                      {isAgent ? 'Dashboard' : 'Mon espace'}
                    </Link>
                  </div>

                  {/* Sign out */}
                  <div className="border-t border-gray-100 pt-1">
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors w-full text-left"
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
              <button
                className={cn(
                  'h-10 px-5 text-sm font-medium rounded-full transition-colors',
                  isTransparent
                    ? 'bg-white text-gray-900 hover:bg-white/90'
                    : 'bg-accent text-white hover:bg-accent/90'
                )}
              >
                Se connecter
              </button>
            </Link>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          className={cn(
            'md:hidden p-2 rounded-md transition-colors',
            isTransparent ? 'text-white hover:bg-white/10' : 'text-gray-700 hover:bg-gray-50'
          )}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      <div
        className={cn(
          'md:hidden bg-white border-b border-gray-100 shadow-lg overflow-hidden transition-all duration-200 ease-out',
          mobileOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 border-b-0 shadow-none'
        )}
      >
        <nav className="flex flex-col px-4 py-3 gap-1">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.href
            return (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  'px-3 py-2.5 text-[15px] font-medium rounded-md transition-colors',
                  isActive
                    ? 'text-accent bg-accent/5'
                    : 'text-gray-700 hover:text-accent hover:bg-gray-50'
                )}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            )
          })}

          {/* Mobile auth section */}
          <div className="flex flex-col gap-3 pt-4 border-t border-gray-100 mt-2">
            <Link to="/publier" onClick={() => setMobileOpen(false)}>
              <button className="w-full h-10 text-sm font-medium rounded-full border border-gray-200 text-gray-700 hover:text-gray-900 hover:border-gray-400 transition-colors">
                Publier une annonce
              </button>
            </Link>

            {user ? (
              <>
                <div className="flex items-center gap-3 px-3 py-2">
                  <UserAvatar name={displayName} email={displayEmail} avatarUrl={avatarUrl} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
                    <p className="text-xs text-gray-500 truncate">{displayEmail}</p>
                  </div>
                </div>
                <Link
                  to={isAgent ? '/dashboard' : '/portail'}
                  className="px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
                  onClick={() => setMobileOpen(false)}
                >
                  {isAgent ? 'Dashboard' : 'Mon espace'}
                </Link>
                <button
                  onClick={() => {
                    handleSignOut()
                    setMobileOpen(false)
                  }}
                  className="px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md text-left"
                >
                  Déconnexion
                </button>
              </>
            ) : (
              <Link to="/login" onClick={() => setMobileOpen(false)}>
                <button className="w-full h-10 text-sm font-medium rounded-full bg-accent text-white hover:bg-accent/90 transition-colors">
                  Se connecter
                </button>
              </Link>
            )}
          </div>
        </nav>
      </div>
    </header>
  )
}
