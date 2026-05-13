import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import {
  Home, GitBranch, Users, Shuffle, MoreHorizontal,
  LayoutDashboard, Building2, ShieldCheck, Calendar, FileText, Settings, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface TabItem {
  icon: typeof Home
  label: string
  path: string
}

const TABS: TabItem[] = [
  { icon: Home, label: 'Accueil', path: '/dashboard' },
  { icon: GitBranch, label: 'Pipeline', path: '/dashboard/pipeline' },
  { icon: Users, label: 'Contacts', path: '/dashboard/contacts' },
  { icon: Shuffle, label: 'Matching', path: '/dashboard/matching' },
]

const MORE_ITEMS: TabItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard/analytics' },
  { icon: Building2, label: 'Mes biens', path: '/dashboard/listings' },
  { icon: ShieldCheck, label: 'KYC', path: '/dashboard/kyc' },
  { icon: Calendar, label: 'Calendrier', path: '/dashboard/calendar' },
  { icon: FileText, label: 'Documents', path: '/dashboard/documents' },
  { icon: Settings, label: 'Paramètres', path: '/dashboard/settings' },
]

export default function BottomTabBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen] = useState(false)

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard'
    return location.pathname.startsWith(path)
  }

  const isMoreActive = MORE_ITEMS.some((item) => isActive(item.path))

  return (
    <>
      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-theme-card border-t border-theme-border" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-stretch h-14">
          {TABS.map((tab) => {
            const active = isActive(tab.path)
            return (
              <button
                key={tab.path}
                onClick={() => { navigate(tab.path); setMoreOpen(false) }}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px] transition-colors',
                  active ? 'text-accent' : 'text-theme-tertiary'
                )}
              >
                {active && <div className="w-1 h-1 rounded-full bg-accent mb-0.5" />}
                <tab.icon className="h-5 w-5" />
                <span className="text-xs">{tab.label}</span>
              </button>
            )
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px] transition-colors',
              moreOpen || isMoreActive ? 'text-accent' : 'text-theme-tertiary'
            )}
          >
            {(moreOpen || isMoreActive) && !moreOpen && <div className="w-1 h-1 rounded-full bg-accent mb-0.5" />}
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-xs">Plus</span>
          </button>
        </div>
      </nav>

      {/* More menu — bottom sheet */}
      {moreOpen && createPortal(
        <div className="fixed inset-0 z-[90] md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-theme-card rounded-t-2xl border-t border-theme-border" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px)' }}>
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 rounded-full bg-theme-border" />
            </div>

            {/* Close */}
            <div className="flex items-center justify-between px-5 pb-3">
              <span className="text-sm font-medium text-theme-primary">Plus</span>
              <button onClick={() => setMoreOpen(false)} aria-label="Fermer" className="h-8 w-8 flex items-center justify-center rounded-lg text-theme-tertiary hover:text-theme-primary">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Items */}
            <div className="px-3 pb-4 space-y-0.5">
              {MORE_ITEMS.map((item) => {
                const active = isActive(item.path)
                return (
                  <button
                    key={item.path}
                    onClick={() => { navigate(item.path); setMoreOpen(false) }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-3 rounded-xl min-h-[44px] transition-colors',
                      active ? 'bg-theme-active text-theme-primary' : 'text-theme-secondary hover:bg-theme-hover'
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
