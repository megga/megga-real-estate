import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, LogOut, LayoutDashboard, User, Plus, Heart, Bookmark, HelpCircle, Globe, ChevronDown, Users, Building2, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useAvatar } from '@/hooks/useAvatar'

// ─── Navigation links ───────────────────────────────────────────────────

const leftLinks = [
  { label: 'Acheter', href: '/acheter' },
  { label: 'Louer', href: '/louer' },
  { label: 'Vendre', href: '/vendre' },
]

const proDropdownItems = [
  { label: 'Trouver un agent', href: '/agents', icon: Users, desc: 'Trouvez un courtier' },
  { label: 'Trouver une agence', href: '/agences', icon: Building2, desc: 'Annuaire des agences' },
  { label: 'Créer un profil', href: '/devenir-agent', icon: UserPlus, desc: 'Rejoignez MEGGA' },
]

const mobileLinks = [
  { label: 'Acheter', href: '/acheter' },
  { label: 'Louer', href: '/louer' },
  { label: 'Vendre', href: '/vendre' },
  { label: 'Trouver un agent', href: '/agents' },
  { label: 'Trouver une agence', href: '/agences' },
  { label: 'Créer un profil', href: '/devenir-agent' },
  { label: 'Estimations', href: '/estimations' },
  { label: 'Services', href: '/services' },
]

// ─── User avatar ────────────────────────────────────────────────────────

function UserAvatar({ name, email, avatarUrl, size = 'md' }: {
  name: string; email: string; avatarUrl?: string | null; size?: 'sm' | 'md'
}) {
  const initials = name
    ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : email[0].toUpperCase()

  const sizeClass = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9'
  const textSize = size === 'sm' ? 'text-xs' : 'text-xs'

  if (avatarUrl) {
    return <img src={avatarUrl} alt={name || email} className={cn(sizeClass, 'rounded-full object-cover')} />
  }

  return (
    <div className={cn(sizeClass, 'rounded-full bg-gray-900 flex items-center justify-center')}>
      <span className={cn(textSize, 'font-semibold text-white')}>{initials}</span>
    </div>
  )
}

// ─── Navbar ─────────────────────────────────────────────────────────────

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, profile, loading, signOut, isAgent } = useAuth()
  const { avatarUrl } = useAvatar()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [agentDropOpen, setAgentDropOpen] = useState(false)
  const agentDropRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const langRef = useRef<HTMLDivElement>(null)

  const LANGUAGES = [
    { code: 'FR', label: 'Français' },
    { code: 'DE', label: 'Deutsch' },
    { code: 'EN', label: 'English' },
    { code: 'IT', label: 'Italiano' },
  ] as const
  const [currentLang, setCurrentLang] = useState(() => {
    const saved = localStorage.getItem('megga-language')
    return saved || 'FR'
  })

  const isHome = location.pathname === '/'

  // Scroll detection
  useEffect(() => {
    function handleScroll() { setScrolled(window.scrollY > 20) }
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

  // Close agent dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (agentDropRef.current && !agentDropRef.current.contains(e.target as Node)) {
        setAgentDropOpen(false)
      }
    }
    if (agentDropOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [agentDropOpen])

  // Close lang dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false)
      }
    }
    if (langOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [langOpen])

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email || ''
  const displayEmail = user?.email || ''

  async function handleSignOut() {
    setDropdownOpen(false)
    await signOut()
    navigate('/')
  }

  const isTransparent = isHome && !scrolled && !mobileOpen

  return (
    <header
      className={cn(
        'h-[72px] sticky top-0 z-50 transition-all duration-300',
        isTransparent
          ? 'bg-transparent'
          : 'bg-theme-page border-b border-theme-border'
      )}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 h-full flex items-center">

        {/* ─── LEFT: Navigation links (desktop) ─── */}
        <nav className="hidden md:flex items-center gap-0.5 flex-1">
          {leftLinks.map((link) => {
            const isActive = location.pathname === link.href
            return (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  'px-3.5 py-1.5 text-sm font-medium transition-all duration-150',
                  isActive
                    ? isTransparent
                      ? 'text-white'
                      : 'text-theme-primary'
                    : isTransparent
                      ? 'text-white/80 hover:text-white'
                      : 'text-theme-tertiary hover:text-theme-primary'
                )}
              >
                {link.label}
              </Link>
            )
          })}

          {/* Trouver un agent — dropdown */}
          <div className="relative" ref={agentDropRef}>
            <button
              onClick={() => setAgentDropOpen(!agentDropOpen)}
              className={cn(
                'flex items-center gap-1 px-3.5 py-1.5 text-sm font-medium transition-all duration-150',
                (location.pathname.startsWith('/agents') || location.pathname.startsWith('/agences') || location.pathname === '/devenir-agent')
                  ? isTransparent ? 'text-white' : 'text-theme-primary'
                  : isTransparent ? 'text-white/80 hover:text-white' : 'text-theme-tertiary hover:text-theme-primary'
              )}
            >
              Professionnels
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', agentDropOpen && 'rotate-180')} />
            </button>
            {agentDropOpen && (
              <div className="absolute left-0 mt-2 w-56 bg-theme-card rounded-xl border border-theme-border py-2 z-50">
                {proDropdownItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setAgentDropOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-theme-hover',
                        location.pathname === item.href ? 'bg-theme-hover' : ''
                      )}
                    >
                      <Icon className="w-4 h-4 text-theme-muted flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-theme-primary">{item.label}</p>
                        <p className="text-xs text-theme-muted">{item.desc}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </nav>

        {/* ─── LEFT: Hamburger (mobile) ─── */}
        <button
          className={cn(
            'md:hidden p-1.5 rounded-lg transition-colors -ml-1.5',
            isTransparent ? 'text-white hover:bg-white/10' : 'text-theme-secondary hover:bg-theme-hover'
          )}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {/* ─── CENTER: Logo ─── */}
        <Link to="/" className="flex-shrink-0 mx-auto md:mx-0 md:flex-none md:absolute md:left-1/2 md:-translate-x-1/2">
          <img
            src="/megga-logo.svg"
            alt="MEGGA"
            className={cn(
              'h-8 transition-all duration-300',
              isTransparent && 'brightness-0 invert'
            )}
          />
        </Link>

        {/* ─── RIGHT: Actions (desktop) ─── */}
        <div className="hidden md:flex items-center gap-1 flex-1 justify-end">
          {/* Language selector */}
          <div className="relative" ref={langRef}>
            <button
              onClick={() => setLangOpen(!langOpen)}
              className={cn(
                'flex items-center gap-1 h-8 px-2.5 text-xs font-medium rounded-lg transition-all duration-150',
                isTransparent
                  ? 'text-white/70 hover:text-white hover:bg-white/10'
                  : 'text-theme-muted hover:text-theme-secondary hover:bg-theme-hover'
              )}
            >
              <Globe className="w-3.5 h-3.5" />
              {currentLang}
              <ChevronDown className="w-3 h-3" />
            </button>
            {langOpen && (
              <div className="absolute right-0 mt-1.5 w-40 bg-theme-card rounded-xl border border-theme-border py-1 z-50">
                {LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setCurrentLang(lang.code)
                      localStorage.setItem('megga-language', lang.code)
                      setLangOpen(false)
                    }}
                    className={cn(
                      'w-full text-left px-3.5 py-2 text-sm transition-colors',
                      currentLang === lang.code
                        ? 'text-theme-primary font-medium bg-theme-hover'
                        : 'text-theme-secondary hover:bg-theme-hover'
                    )}
                  >
                    <span className="font-medium">{lang.code}</span>
                    <span className="text-theme-muted ml-2">{lang.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Aide */}
          <Link
            to="/aide"
            className={cn(
              'flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium rounded-lg transition-all duration-150',
              isTransparent
                ? 'text-white/70 hover:text-white hover:bg-white/10'
                : location.pathname.startsWith('/aide')
                  ? 'text-theme-primary bg-theme-hover'
                  : 'text-theme-muted hover:text-theme-secondary hover:bg-theme-hover'
            )}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Aide
          </Link>

          {/* Publier */}
          <Link
            to="/publier"
            className={cn(
              'flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg transition-all duration-150',
              isTransparent
                ? 'text-white/80 hover:text-white hover:bg-white/10'
                : 'text-theme-tertiary hover:text-theme-primary hover:bg-theme-hover'
            )}
          >
            <Plus className="w-3.5 h-3.5" />
            Publier
          </Link>

          {loading ? (
            <div className="h-8 w-8 rounded-full bg-theme-hover animate-pulse" />
          ) : user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                aria-label="Mon compte"
                className="rounded-full focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
              >
                <UserAvatar name={displayName} email={displayEmail} avatarUrl={avatarUrl} size="sm" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-theme-card rounded-xl border border-theme-border py-1.5 z-50">
                  <div className="px-4 py-2.5 border-b border-theme-border-subtle">
                    <p className="text-sm font-medium text-theme-primary truncate">{displayName}</p>
                    <p className="text-xs text-theme-tertiary truncate">{displayEmail}</p>
                  </div>
                  <div className="py-1">
                    <Link
                      to={isAgent ? '/dashboard' : '/portail'}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-theme-secondary hover:bg-theme-hover transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      {isAgent ? <LayoutDashboard className="h-4 w-4 text-theme-muted" /> : <User className="h-4 w-4 text-theme-muted" />}
                      {isAgent ? 'Dashboard' : 'Mon espace'}
                    </Link>
                    {!isAgent && (
                      <>
                        <Link
                          to="/acheter?favorites=true"
                          className="flex items-center gap-3 px-4 py-2 text-sm text-theme-secondary hover:bg-theme-hover transition-colors"
                          onClick={() => setDropdownOpen(false)}
                        >
                          <Heart className="h-4 w-4 text-theme-muted" />
                          Mes favoris
                        </Link>
                        <Link
                          to="/acheter?saved=true"
                          className="flex items-center gap-3 px-4 py-2 text-sm text-theme-secondary hover:bg-theme-hover transition-colors"
                          onClick={() => setDropdownOpen(false)}
                        >
                          <Bookmark className="h-4 w-4 text-theme-muted" />
                          Mes recherches
                        </Link>
                      </>
                    )}
                  </div>
                  <div className="border-t border-theme-border-subtle pt-1">
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-red-500 hover:bg-theme-hover transition-colors w-full text-left"
                    >
                      <LogOut className="h-4 w-4" />
                      Déconnexion
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login">
              <button
                className={cn(
                  'h-9 px-4 text-sm font-medium rounded-full transition-all duration-150',
                  isTransparent
                    ? 'bg-white text-gray-900 hover:bg-white/90'
                    : 'bg-theme-primary text-theme-inverse hover:opacity-90'
                )}
              >
                Se connecter
              </button>
            </Link>
          )}
        </div>

        {/* ─── RIGHT: Avatar/Login (mobile) ─── */}
        <div className="md:hidden">
          {loading ? (
            <div className="h-8 w-8 rounded-full bg-theme-hover animate-pulse" />
          ) : user ? (
            <Link to={isAgent ? '/dashboard' : '/portail'}>
              <UserAvatar name={displayName} email={displayEmail} avatarUrl={avatarUrl} size="sm" />
            </Link>
          ) : (
            <Link
              to="/login"
              className={cn(
                'text-sm font-medium transition-colors',
                isTransparent ? 'text-white' : 'text-theme-primary'
              )}
            >
              Connexion
            </Link>
          )}
        </div>
      </div>

      {/* ─── Mobile menu (slide-down) ─── */}
      <div
        className={cn(
          'md:hidden bg-theme-card border-b border-theme-border-subtle overflow-hidden transition-all duration-250 ease-out',
          mobileOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 border-b-0'
        )}
      >
        <nav className="flex flex-col px-4 py-3 gap-0.5">
          {mobileLinks.map((link) => {
            const isActive = location.pathname === link.href
            return (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  'px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-150',
                  isActive
                    ? 'text-theme-primary bg-theme-hover'
                    : 'text-theme-secondary hover:text-theme-primary hover:bg-theme-hover'
                )}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            )
          })}

          {/* Aide (mobile) */}
          <Link
            to="/aide"
            className={cn(
              'px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-150',
              location.pathname.startsWith('/aide')
                ? 'text-theme-primary bg-theme-hover'
                : 'text-theme-secondary hover:text-theme-primary hover:bg-theme-hover'
            )}
            onClick={() => setMobileOpen(false)}
          >
            Aide
          </Link>

          {/* Language pills (mobile) */}
          <div className="flex items-center gap-1.5 px-3 pt-2">
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => {
                  setCurrentLang(lang.code)
                  localStorage.setItem('megga-language', lang.code)
                }}
                className={cn(
                  'h-8 px-3 text-xs font-medium rounded-lg transition-colors',
                  currentLang === lang.code
                    ? 'bg-theme-active text-theme-primary font-medium'
                    : 'bg-theme-hover text-theme-tertiary hover:text-theme-secondary'
                )}
              >
                {lang.code}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2.5 pt-4 border-t border-theme-border-subtle mt-2">
            <Link to="/publier" onClick={() => setMobileOpen(false)}>
              <button className="w-full h-10 text-sm font-medium rounded-lg border border-theme-border text-theme-secondary hover:bg-theme-hover transition-colors flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" />
                Publier une annonce
              </button>
            </Link>

            {user ? (
              <>
                <div className="flex items-center gap-3 px-3 py-2">
                  <UserAvatar name={displayName} email={displayEmail} avatarUrl={avatarUrl} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-theme-primary truncate">{displayName}</p>
                    <p className="text-xs text-theme-tertiary truncate">{displayEmail}</p>
                  </div>
                </div>
                <Link
                  to={isAgent ? '/dashboard' : '/portail'}
                  className="px-3 py-2.5 text-sm font-medium text-theme-secondary hover:bg-theme-hover rounded-lg"
                  onClick={() => setMobileOpen(false)}
                >
                  {isAgent ? 'Dashboard' : 'Mon espace'}
                </Link>
                <button
                  onClick={() => { handleSignOut(); setMobileOpen(false) }}
                  className="px-3 py-2.5 text-sm font-medium text-red-500 hover:bg-theme-hover rounded-lg text-left"
                >
                  Déconnexion
                </button>
              </>
            ) : (
              <Link to="/login" onClick={() => setMobileOpen(false)}>
                <button className="w-full h-10 text-sm font-medium rounded-lg bg-theme-primary text-theme-inverse hover:opacity-90 transition-colors">
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
