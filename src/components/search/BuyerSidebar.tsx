import { Search, Heart, Bell, Calculator, Bookmark, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFavorites } from '@/hooks/useFavorites'

const BLUE = '#0041D9'
const BLUE_BG = '#E8EFFE'

const NAV_ITEMS = [
  { id: 'search', label: 'Recherche', icon: Search },
  { id: 'alerts', label: 'Alertes', icon: Bell },
  { id: 'favorites', label: 'Favoris', icon: Heart },
  { id: 'saved', label: 'Recherches', icon: Bookmark },
  { id: 'calculator', label: 'Accessibilité', icon: Calculator },
]

const BOTTOM_ITEMS = [
  { id: 'contact', label: 'Contact', icon: MessageCircle },
]

interface Props {
  activeView?: string
  onViewChange?: (view: string) => void
  className?: string
  context?: 'buy' | 'rent'
}

export default function BuyerSidebar({ activeView = 'search', onViewChange, className, context = 'buy' }: Props) {
  const { count: favCount } = useFavorites()
  // Calculator (accessibility hypothecaire) only relevant for buy context
  const navItems = context === 'rent' ? NAV_ITEMS.filter(item => item.id !== 'calculator') : NAV_ITEMS

  function renderItem(item: typeof NAV_ITEMS[0]) {
    const isActive = activeView === item.id
    const Icon = item.icon
    // Iconic "saved"-type items fill when active for extra weight shift
    const fillWhenActive = item.id === 'favorites' || item.id === 'saved'

    return (
      <button
        key={item.id}
        onClick={() => {
          onViewChange?.(item.id)
        }}
        className="group relative flex flex-col items-center mb-1.5 cursor-pointer focus:outline-none"
        title={item.label}
        aria-label={item.label}
        aria-pressed={activeView === item.id}
      >
        {/* Icon container */}
        <div
          className={cn(
            'relative flex items-center justify-center w-11 h-11 rounded-2xl transition-all duration-200',
            isActive ? '' : 'group-hover:bg-gray-100'
          )}
          style={isActive ? { backgroundColor: BLUE_BG } : undefined}
        >
          <Icon
            className={cn('h-5 w-5 transition-[stroke-width,color] duration-200', !isActive && 'text-gray-500 group-hover:text-gray-700')}
            style={isActive ? { color: BLUE } : undefined}
            strokeWidth={isActive ? 2.25 : 1.75}
            fill={isActive && fillWhenActive ? BLUE : 'none'}
          />

          {/* Badge — iOS-style, anchored to the icon container */}
          {item.id === 'favorites' && favCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 h-[18px] min-w-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white tabular-nums"
            >
              {favCount > 99 ? '99+' : favCount}
            </span>
          )}
        </div>

        {/* Label */}
        <span
          className={cn(
            'text-[11px] mt-1 font-medium leading-tight transition-colors',
            isActive ? 'font-semibold' : 'text-gray-500 group-hover:text-gray-700'
          )}
          style={isActive ? { color: BLUE } : undefined}
        >
          {item.label}
        </span>
      </button>
    )
  }

  return (
    <nav
      aria-label="Outils acheteur"
      className={cn(
        'flex flex-col items-center w-[90px] shrink-0 border-r border-gray-200 h-full',
        className
      )}
      style={{ backgroundColor: '#FAFBFD' }}
    >
      {/* Top spacer — only when sidebar is NOT fixed (static position, e.g. SearchPage) */}
      {!className?.includes('fixed') && (
        <div className="w-full h-[72px] shrink-0 border-b border-gray-200" />
      )}
      {/* Icons area */}
      <div className="flex flex-col items-center pt-4 pb-5 flex-1">
        {navItems.map(renderItem)}
        <div className="w-8 h-px bg-gray-200 my-2" />
        {BOTTOM_ITEMS.map(renderItem)}
      </div>
    </nav>
  )
}
