/**
 * Barre d'onglets du CRM mobile (crm-mobile/shell) : navigation principale à
 * 5 destinations, rendue par MobileShell en variant 'tabs'.
 */
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { useMobileTokens } from '../useMobileTokens'
import { MOBILE_TABS, pathnameToTab } from './routeMatchers'

/**
 * Pilule d'onglets flottante (5 destinations). Port fidèle de NavTabBar :
 * onglet actif = pilule pleine + label qui s'étend (flex-grow .36s). L'actif
 * est déduit de l'URL. Cibles tactiles 48px.
 */
export default function MobileTabBar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { t } = useTranslation('common')
  const { tk } = useMobileTokens()
  const active = pathnameToTab(pathname)

  return (
    <nav
      style={{
        position: 'fixed',
        left: 14,
        right: 14,
        bottom: 'calc(22px + env(safe-area-inset-bottom))',
        zIndex: 55,
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--crm-space-sm)',
        padding: 'var(--crm-space-md)',
        borderRadius: 'var(--crm-radius-6xl)',
        background: tk.tabBarBg,
        boxShadow: tk.tabBarShadow,
      }}
    >
      {MOBILE_TABS.map((tab) => {
        const on = tab.id === active
        const label = t(tab.labelKey)
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => navigate(tab.route)}
            aria-label={label}
            aria-current={on ? 'page' : undefined}
            style={{
              border: 0,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--crm-space-md)',
              height: 48,
              borderRadius: 'var(--crm-radius-3xl)',
              flexGrow: on ? 3 : 1,
              flexBasis: 0,
              minWidth: 34,
              overflow: 'hidden',
              background: on ? tk.pillBg : 'transparent',
              color: on ? tk.pillInk : tk.muted,
              transition: 'flex-grow .36s cubic-bezier(.2,.8,.2,1), background .26s ease',
            }}
          >
            <MEIcon
              name={tab.icon}
              size={21}
              strokeWidth={on ? 2.1 : 1.9}
              color={on ? tk.pillInk : tk.muted}
              style={{ flexShrink: 0 }}
            />
            <span
              style={{
                fontSize: 'var(--crm-text-lg)',
                fontWeight: 600,
                letterSpacing: -0.2,
                whiteSpace: 'nowrap',
                maxWidth: on ? 120 : 0,
                opacity: on ? 1 : 0,
                overflow: 'hidden',
                transition: 'max-width .36s cubic-bezier(.2,.8,.2,1), opacity .24s ease',
              }}
            >
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
