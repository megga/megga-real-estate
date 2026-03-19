import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Heart, Search, Bell, MessageSquare, Home } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

const NAV_ITEMS = [
  { label: 'Tableau de bord', href: '/mon-espace', icon: Home },
  { label: 'Mes favoris', href: '/mon-espace/favoris', icon: Heart },
  { label: 'Recherches sauvées', href: '/mon-espace/recherches', icon: Search },
  { label: 'Mes alertes', href: '/mon-espace/alertes', icon: Bell },
  { label: 'Messages', href: '/mon-espace/messages', icon: MessageSquare },
]

export default function BuyerLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()

  const displayName = profile?.full_name ?? 'Mon espace'
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  function isActive(href: string) {
    if (href === '/mon-espace') return location.pathname === '/mon-espace'
    return location.pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <header className="sticky top-0 z-30 bg-white border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="text-xl font-bold tracking-tight text-primary-900">
              MEGGA
            </Link>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-primary-900">{displayName}</p>
                <p className="text-xs text-muted-foreground">Mon espace</p>
              </div>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={displayName} className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center">
                  <span className="text-xs font-semibold text-white">{initials}</span>
                </div>
              )}
              <button
                onClick={handleSignOut}
                className="p-2 rounded-md text-primary-400 hover:text-danger hover:bg-danger/10 transition-colors"
                title="Se déconnecter"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <nav className="flex gap-0 -mb-px overflow-x-auto">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors inline-flex items-center gap-2',
                    isActive(item.href)
                      ? 'border-accent text-accent'
                      : 'border-transparent text-muted-foreground hover:text-primary-900 hover:border-primary-200'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
