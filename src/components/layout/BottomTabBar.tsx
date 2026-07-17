/**
 * Barre d'onglets mobile (< md) du CRM agent, fixée en bas de l'écran.
 * 4 onglets principaux + bouton « Plus » ouvrant un <Sheet> (drag-to-dismiss)
 * avec les surfaces secondaires. Masquée en desktop (`md:hidden`).
 */
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { cn } from '@/lib/utils'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import Sheet from '@/components/ui/Sheet'

interface TabItem {
  icon: MEIconName
  label: string
  path: string
}

const TABS: TabItem[] = [
  { icon: 'home', label: 'Accueil', path: '/dashboard' },
  { icon: 'flowchart', label: 'Pipeline', path: '/dashboard/pipeline' },
  { icon: 'users', label: 'Contacts', path: '/dashboard/contacts' },
  { icon: 'refresh', label: 'Matching', path: '/dashboard/matching' },
]

const MORE_ITEMS: TabItem[] = [
  { icon: 'dashboard', label: 'Dashboard', path: '/dashboard/analytics' },
  { icon: 'building', label: 'Mes biens', path: '/dashboard/listings' },
  { icon: 'shield', label: 'KYC', path: '/dashboard/kyc' },
  { icon: 'calendar', label: 'Calendrier', path: '/dashboard/calendar' },
  { icon: 'settings', label: 'Paramètres', path: '/dashboard/settings' },
]

// iOS UITabBar physics: snappy spring for tap, indicator slides between tabs.
const TAP_SPRING = { type: 'spring' as const, stiffness: 480, damping: 28, mass: 0.6 }
const INDICATOR_SPRING = { type: 'spring' as const, stiffness: 520, damping: 38 }

/** Onglet actif détecté par préfixe de path ; l'indicateur glisse via `layoutId`. */
export default function BottomTabBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()
  const [moreOpen, setMoreOpen] = useState(false)

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard'
    return location.pathname.startsWith(path)
  }

  const isMoreActive = MORE_ITEMS.some((item) => isActive(item.path))
  const tap = reducedMotion ? undefined : { scale: 0.92 }

  return (
    <>
      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-theme-card border-t border-theme-border" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-stretch h-14">
          {TABS.map((tab) => {
            const active = isActive(tab.path)
            return (
              <motion.button
                key={tab.path}
                onClick={() => { navigate(tab.path); setMoreOpen(false) }}
                whileTap={tap}
                transition={TAP_SPRING}
                className={cn(
                  'relative flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px] transition-colors',
                  active ? 'text-accent' : 'text-theme-tertiary'
                )}
              >
                {/* Active indicator — `layoutId` makes framer-motion animate it
                 *  from the previous tab to this one when `active` flips. */}
                {active && (
                  <motion.div
                    layoutId="bottom-tab-indicator"
                    className="absolute top-1 w-1 h-1 rounded-full bg-accent"
                    transition={reducedMotion ? { duration: 0 } : INDICATOR_SPRING}
                  />
                )}
                <MEIcon name={tab.icon as MEIconName} className="h-5 w-5" />
                <span className="text-xs">{tab.label}</span>
              </motion.button>
            )
          })}

          {/* More button */}
          <motion.button
            onClick={() => setMoreOpen(!moreOpen)}
            whileTap={tap}
            transition={TAP_SPRING}
            className={cn(
              'relative flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px] transition-colors',
              moreOpen || isMoreActive ? 'text-accent' : 'text-theme-tertiary'
            )}
          >
            {isMoreActive && !moreOpen && (
              <motion.div
                layoutId="bottom-tab-indicator"
                className="absolute top-1 w-1 h-1 rounded-full bg-accent"
                transition={reducedMotion ? { duration: 0 } : INDICATOR_SPRING}
              />
            )}
            <MEIcon name="more-horizontal" className="h-5 w-5" />
            <span className="text-xs">Plus</span>
          </motion.button>
        </div>
      </nav>

      {/* More menu — backed by the shared <Sheet> atom (drag-to-dismiss,
       *  rubber-band overdrag, Escape key, body scroll lock, reduced-motion). */}
      <Sheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        ariaLabel="Menu Plus"
        maxHeightVh={0.7}
      >
        <div className="flex items-center justify-between px-5 pb-3">
          <span className="text-sm font-medium text-theme-primary">Plus</span>
          <motion.button
            onClick={() => setMoreOpen(false)}
            aria-label="Fermer"
            whileTap={tap}
            transition={TAP_SPRING}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-theme-tertiary hover:text-theme-primary"
          >
            <MEIcon name="close" className="h-4 w-4" />
          </motion.button>
        </div>

        <div className="px-3 pb-4 space-y-0.5">
          {MORE_ITEMS.map((item) => {
            const active = isActive(item.path)
            return (
              <motion.button
                key={item.path}
                onClick={() => { navigate(item.path); setMoreOpen(false) }}
                whileTap={tap}
                transition={TAP_SPRING}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-3 rounded-xl min-h-[44px] transition-colors',
                  active ? 'bg-theme-active text-theme-primary' : 'text-theme-secondary hover:bg-theme-hover'
                )}
              >
                <MEIcon name={item.icon as MEIconName} className="h-5 w-5 shrink-0" />
                <span className="text-sm font-medium">{item.label}</span>
              </motion.button>
            )
          })}
        </div>
      </Sheet>
    </>
  )
}
