import { useState, useEffect } from 'react';
import { Menu, X, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { label: 'Acheter', href: '/search?context=acheter' },
  { label: 'Louer', href: '/search?context=louer' },
  { label: 'Vendre', href: '/vendre' },
  { label: 'Estimations', href: '/estimer' },
  { label: 'Services', href: '/services' },
];

interface NavbarProps {
  transparent?: boolean;
}

export default function Navbar({ transparent = false }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!transparent) return;
    function handleScroll() {
      setScrolled(window.scrollY > 50);
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [transparent]);

  const isTransparent = transparent && !scrolled;

  return (
    <header className={cn(
      'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
      isTransparent
        ? 'bg-transparent'
        : 'bg-white/95 backdrop-blur-md shadow-[var(--shadow-navbar)]'
    )}>
      <nav className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 shrink-0">
          <span className={cn('text-xl font-bold tracking-tight', isTransparent ? 'text-white' : 'text-gray-900')}>MEGGA</span>
        </a>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className={cn(
                'px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                isTransparent
                  ? 'text-white/80 hover:text-white hover:bg-white/10'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              )}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-2">
          {/* Dark mode toggle placeholder */}
          <button
            className={cn(
              'w-9 h-9 flex items-center justify-center rounded-full transition-colors cursor-pointer',
              isTransparent
                ? 'text-white/60 hover:text-white hover:bg-white/10'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            )}
          >
            <Sun className="w-4.5 h-4.5" />
          </button>
          <a
            href="/publier"
            className="px-5 py-2.5 text-sm font-medium text-white bg-[#2563EB] hover:opacity-90 rounded-full shadow-sm transition-all"
          >
            Publier une annonce
          </a>
          <a
            href="/login"
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-full transition-all',
              isTransparent
                ? 'text-white/80 hover:text-white hover:bg-white/10'
                : 'text-gray-700 hover:bg-gray-50'
            )}
          >
            Se connecter
          </a>
        </div>

        {/* Mobile menu toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className={cn(
            'md:hidden p-2 rounded-lg transition cursor-pointer',
            isTransparent ? 'text-white hover:bg-white/10' : 'hover:bg-gray-100'
          )}
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
        <div className={cn(
          'px-4 pb-4 border-t',
          isTransparent ? 'border-white/10 bg-black/40 backdrop-blur-md' : 'border-gray-100 bg-white'
        )}>
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className={cn(
                'block px-3 py-2.5 text-sm font-medium rounded-lg',
                isTransparent ? 'text-white/80 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-50'
              )}
            >
              {link.label}
            </a>
          ))}
          <div className="mt-3 flex flex-col gap-2">
            <a
              href="/publier"
              className="text-center px-5 py-2.5 text-sm font-medium text-white bg-[#2563EB] hover:opacity-90 rounded-full shadow-sm"
            >
              Publier une annonce
            </a>
            <a
              href="/login"
              className={cn(
                'text-center px-4 py-2.5 text-sm font-medium rounded-full',
                isTransparent
                  ? 'text-white/80 hover:bg-white/10'
                  : 'text-gray-700 hover:bg-gray-50'
              )}
            >
              Se connecter
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
