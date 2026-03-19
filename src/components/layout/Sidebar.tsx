import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Kanban, Users, Building2, ShieldCheck,
  MessageSquare, Calendar, Settings, LogOut, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Pipeline', href: '/dashboard/pipeline', icon: Kanban },
  { label: 'Contacts', href: '/dashboard/contacts', icon: Users },
  { label: 'Mes biens', href: '/dashboard/listings', icon: Building2 },
  { label: 'KYC', href: '/dashboard/kyc', icon: ShieldCheck, badge: 2 },
  { label: 'Messages', href: '/dashboard/messages', icon: MessageSquare, badge: 3 },
  { label: 'Calendrier', href: '/dashboard/calendar', icon: Calendar },
]

interface SidebarProps {
  mobileOpen: boolean
  onClose: () => void
}

function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-semibold text-white">{initials}</span>
    </div>
  )
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur',
  manager: 'Manager',
  agent: 'Agent immobilier',
  assistant: 'Assistant',
  buyer: 'Particulier',
  seller: 'Vendeur',
}

export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const location = useLocation()
  const { signOut, profile } = useAuth()
  const displayName = profile?.full_name || 'Utilisateur'
  const roleLabel = ROLE_LABELS[profile?.role || 'agent'] || 'Agent'

  function isActive(href: string) {
    if (href === '/dashboard') return location.pathname === '/dashboard'
    return location.pathname.startsWith(href)
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-border">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-7 w-7 bg-primary-900 rounded-lg flex items-center justify-center">
            <span className="text-xs font-bold text-white">GG</span>
          </div>
          <span className="text-lg font-bold text-primary-900">MEGGA</span>
        </Link>
        {/* Mobile close */}
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-md hover:bg-section"
        >
          <X className="h-5 w-5 text-primary-600" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors relative',
                active
                  ? 'bg-accent/10 text-accent border-l-2 border-accent pl-[10px]'
                  : 'text-primary-600 hover:bg-gray-100 hover:text-primary-900'
              )}
            >
              <Icon className="h-[18px] w-[18px] flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge && item.badge > 0 && (
                <span className="h-5 min-w-[20px] px-1.5 bg-accent text-white text-[11px] font-semibold rounded-full flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-border px-3 py-3 space-y-1">
        {/* Settings */}
        <Link
          to="/dashboard/settings"
          onClick={onClose}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
            location.pathname.startsWith('/dashboard/settings')
              ? 'bg-accent/10 text-accent'
              : 'text-primary-600 hover:bg-gray-100 hover:text-primary-900'
          )}
        >
          <Settings className="h-[18px] w-[18px]" />
          Paramètres
        </Link>

        {/* Profile */}
        <div className="flex items-center gap-3 px-3 py-3 mt-2 rounded-md bg-section">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt={displayName} className="h-9 w-9 rounded-full object-cover flex-shrink-0" />
          ) : (
            <UserAvatar name={displayName} />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-primary-900 truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{roleLabel}</p>
          </div>
          <button
            onClick={async () => { await signOut(); }}
            className="p-1.5 rounded-md hover:bg-white text-primary-400 hover:text-danger transition-colors"
            title="Déconnexion"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-shrink-0 bg-sidebar border-r border-border h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
          <aside className="fixed inset-y-0 left-0 w-64 bg-sidebar z-50 lg:hidden shadow-modal">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  )
}
