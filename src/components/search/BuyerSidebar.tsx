import { Search, Heart, Bell, Calculator, Bookmark, MessageCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useFavorites } from '@/hooks/useFavorites'
import { useAuth } from '@/hooks/useAuth'

const BLUE = '#2563EB'
const BLUE_BG = '#EFF6FF'

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
}

export default function BuyerSidebar({ activeView = 'search', onViewChange, className }: Props) {
  const { count: favCount } = useFavorites()
  const { user } = useAuth()
  const navigate = useNavigate()

  function renderItem(item: typeof NAV_ITEMS[0]) {
    const isActive = activeView === item.id
    const Icon = item.icon

    return (
      <button
        key={item.id}
        onClick={() => {
          if (item.id === 'contact' && !user) {
            navigate('/login')
            return
          }
          onViewChange?.(item.id)
        }}
        className="group relative flex flex-col items-center mb-2 cursor-pointer"
        title={item.label}
      >
        {/* Icon container — background only here */}
        <div
          className={cn(
            'flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-200',
            isActive ? 'shadow-sm' : 'group-hover:bg-gray-100'
          )}
          style={isActive ? { backgroundColor: BLUE_BG } : undefined}
        >
          <Icon
            className={cn('h-[20px] w-[20px] transition-colors', !isActive && 'text-gray-400 group-hover:text-gray-600')}
            style={isActive ? { color: BLUE } : undefined}
            strokeWidth={isActive ? 2.2 : 1.8}
            fill={isActive && item.id === 'favorites' ? BLUE : 'none'}
          />
        </div>

        {/* Label — outside the background */}
        <span
          className={cn(
            'text-[11px] mt-1 font-medium leading-tight transition-colors',
            !isActive && 'text-gray-400 group-hover:text-gray-600'
          )}
          style={isActive ? { color: BLUE } : undefined}
        >
          {item.label}
        </span>

        {/* Badge for favorites count */}
        {item.id === 'favorites' && favCount > 0 && (
          <span className="absolute top-0 right-1 h-[16px] min-w-[16px] px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {favCount > 99 ? '99+' : favCount}
          </span>
        )}
      </button>
    )
  }

  return (
    <nav
      className={cn(
        'hidden lg:flex flex-col items-center w-[90px] shrink-0 bg-white border-r border-gray-200',
        className
      )}
    >
      {/* Top spacer — aligns with navbar height */}
      <div className="w-full h-14 shrink-0 border-b border-gray-200" />
      {/* Icons area */}
      <div className="flex flex-col items-center pt-4 pb-5 flex-1">
        {NAV_ITEMS.map(renderItem)}
        <div className="w-8 h-px bg-gray-200 my-2" />
        {BOTTOM_ITEMS.map(renderItem)}
      </div>
    </nav>
  )
}
