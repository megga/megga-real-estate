import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { label: 'Acheter', href: '/search?context=acheter' },
  { label: 'Louer', href: '/search?context=louer' },
  { label: 'Vendre', href: '/vendre' },
  { label: 'Estimations', href: '/estimer' },
  { label: 'Services', href: '/services' },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md shadow-[var(--shadow-navbar)]">
      <nav className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-xl font-bold tracking-tight text-gray-900">MEGGA</span>
        </a>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-3">
          <a
            href="/publier"
            className="px-5 py-2.5 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-full transition-colors"
          >
            Publier une annonce
          </a>
          <a
            href="/login"
            className="px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
          >
            Se connecter
          </a>
        </div>

        {/* Mobile menu toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition cursor-pointer"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      <div
        className={cn(
          'md:hidden overflow-hidden transition-all duration-200',
          mobileOpen ? 'max-h-80' : 'max-h-0'
        )}
      >
        <div className="px-4 pb-4 border-t border-gray-100">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="block px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
            >
              {link.label}
            </a>
          ))}
          <div className="mt-3 flex flex-col gap-2">
            <a
              href="/publier"
              className="text-center px-5 py-2.5 text-sm font-medium text-white bg-accent rounded-full"
            >
              Publier une annonce
            </a>
            <a
              href="/login"
              className="text-center px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-full"
            >
              Se connecter
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
