import { Link, Outlet, useLocation } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { label: 'Tableau de bord', href: '/seller' },
  { label: 'Visites', href: '/seller/visits' },
  { label: 'Offres', href: '/seller/offers' },
  { label: 'Documents', href: '/seller/documents' },
  { label: 'Messages', href: '/seller/messages' },
]

export default function SellerLayout() {
  const location = useLocation()

  function isActive(href: string) {
    if (href === '/seller') return location.pathname === '/seller'
    return location.pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <header className="sticky top-0 z-30 bg-white border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <Link to="/seller" className="text-xl font-bold tracking-tight text-primary-900">
              MEGGA
            </Link>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-primary-900">Marie Rochat</p>
                <p className="text-xs text-muted-foreground">Portail vendeur</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center">
                <span className="text-xs font-semibold text-white">MR</span>
              </div>
              <button className="p-2 rounded-md text-primary-400 hover:text-danger hover:bg-danger/10 transition-colors" title="Se déconnecter">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <nav className="flex gap-0 -mb-px overflow-x-auto">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                  isActive(item.href)
                    ? 'border-accent text-accent'
                    : 'border-transparent text-muted-foreground hover:text-primary-900 hover:border-primary-200'
                )}
              >
                {item.label}
              </Link>
            ))}
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
