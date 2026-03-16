import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Plus, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const navLinks = [
  { label: 'Acheter', href: '/acheter' },
  { label: 'Louer', href: '/louer' },
  { label: 'Vendre', href: '/vendre' },
  { label: 'Estimations', href: '/estimations' },
  { label: 'Services', href: '/services' },
]

export default function Navbar() {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="h-16 border-b border-border bg-white shadow-navbar sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 h-full flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex-shrink-0">
          <span className="text-2xl font-bold tracking-tight text-primary-900">MEGGA</span>
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
                    ? 'text-accent border-b-2 border-accent'
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
          <Button size="default" className="rounded-full gap-2">
            <Plus className="h-4 w-4" />
            Publier une annonce
          </Button>
          <Button variant="outline" size="default" className="rounded-full">
            Se connecter
          </Button>
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
            <div className="flex flex-col gap-2 pt-3 border-t border-border mt-2">
              <Button size="default" className="rounded-full gap-2 w-full">
                <Plus className="h-4 w-4" />
                Publier une annonce
              </Button>
              <Button variant="outline" size="default" className="rounded-full w-full">
                Se connecter
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
