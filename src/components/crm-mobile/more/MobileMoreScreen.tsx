/**
 * Écran « Plus » du CRM mobile (crm-mobile/more) — onglet de la barre inférieure
 * regroupant profil, préférences (thème/langue) et accès aux écrans secondaires.
 * Ouvre la feuille Notifications (MrNotifSheet).
 */
import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { switchLanguage } from '@/i18n'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import Pressable from '@/components/ui/Pressable'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useAgentNotifications } from '@/hooks/useAgentNotifications'
import { useMobileTokens } from '../useMobileTokens'
import MeggaWordmark from '../shell/MeggaWordmark'
import MrNotifSheet from './MrNotifSheet'

interface MoreDest {
  labelKey: string
  icon: MEIconName
  route: string
  cta?: boolean
}

const MORE_DESTS: MoreDest[] = [
  { labelKey: 'nav.listings', icon: 'building', route: '/dashboard/listings' },
  { labelKey: 'nav.contacts', icon: 'users', route: '/dashboard/contacts' },
  { labelKey: 'nav.dashboard', icon: 'dashboard', route: '/dashboard/analytics' },
  { labelKey: 'nav.createListing', icon: 'plus', route: '/dashboard/listings/new', cta: true },
  { labelKey: 'nav.kyc', icon: 'shield', route: '/dashboard/kyc' },
  { labelKey: 'nav.settings', icon: 'settings', route: '/dashboard/settings' },
]

/** Bascule segmentée (pilule) générique — sert aux réglages Apparence et Langue. */
function Segment<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  const { tk } = useMobileTokens()
  return (
    <div style={{ display: 'inline-flex', gap: 'var(--crm-space-xs)', padding: 'var(--crm-space-xs)', borderRadius: 'var(--crm-radius-pill)', background: tk.cardSubtle }}>
      {options.map((o) => {
        const on = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            style={{
              height: 34,
              padding: '0 var(--crm-space-2xl)',
              borderRadius: 'var(--crm-radius-pill)',
              border: 0,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 'var(--crm-text-lg)',
              fontWeight: 600,
              letterSpacing: -0.1,
              background: on ? tk.accent : 'transparent',
              color: on ? tk.accentInk : tk.muted,
              boxShadow: on ? tk.shadowSm : 'none',
              transition: 'background .18s ease, color .18s ease',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Hub « Plus » — porte d'entrée des écrans secondaires (variante "list" de la
 * maquette). En-tête wordmark + cloche (→ feuille Notifications réelle), profil,
 * préférences (Apparence + Langue, branchées sur le thème et i18n), liste de
 * destinations, déconnexion. Navigation RÉELLE, aucune donnée mockée (les
 * compteurs meta de la maquette sont volontairement omis tant qu'ils ne sont
 * pas câblés). Sugar Pure : cartes blanches, ombres douces, zéro bordure déco.
 */
export default function MobileMoreScreen() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation('common')
  const { tk, isDark } = useMobileTokens()
  const { setTheme } = useTheme()
  const { profile, user, signOut } = useAuth()
  const notifs = useAgentNotifications()
  const [notifOpen, setNotifOpen] = useState(false)

  const displayName = profile?.full_name?.trim() || user?.email?.split('@')[0] || 'Agent'
  const initials =
    displayName
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '??'
  const lang = i18n.language.startsWith('en') ? 'en' : 'fr'

  const card: CSSProperties = { background: tk.card, borderRadius: 'var(--crm-radius-4xl)', boxShadow: tk.shadowSm, overflow: 'hidden' }
  const prefRow: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'var(--crm-space-xl)',
    padding: 'var(--crm-space-2xl) var(--crm-space-4xl)',
  }
  const prefIcon: CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: 'var(--crm-radius-md)',
    background: tk.cardSubtle,
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
  }

  return (
    <div style={{ padding: '0 var(--crm-space-4xl) var(--crm-space-md)' }}>
      {/* En-tête : wordmark + cloche */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'calc(env(safe-area-inset-top) + 14px) 2px 10px',
        }}
      >
        <MeggaWordmark color={tk.ink} height={24} />
        <button
          type="button"
          onClick={() => setNotifOpen(true)}
          aria-label={t('nav.notifications')}
          style={{
            position: 'relative',
            width: 40,
            height: 40,
            borderRadius: 'var(--crm-radius-pill)',
            border: 0,
            cursor: 'pointer',
            background: 'transparent',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <MEIcon name="bell" size={23} color={tk.ink} strokeWidth={1.9} />
          {notifs.unreadCount > 0 ? (
            <span
              style={{
                position: 'absolute',
                top: 7,
                right: 8,
                width: 8,
                height: 8,
                borderRadius: 'var(--crm-radius-pill)',
                background: '#E0533F',
                boxShadow: `0 0 0 2px ${tk.pageBg}`,
              }}
            />
          ) : null}
        </button>
      </header>

      {/* Profil */}
      <Pressable
        onClick={() => navigate('/dashboard/settings')}
        style={{
          width: '100%',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--crm-space-2xl)',
          padding: 'var(--crm-space-3xl) var(--crm-space-4xl)',
          borderRadius: 'var(--crm-radius-5xl)',
          background: tk.card,
          border: 0,
          boxShadow: tk.shadow,
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            width: 54,
            height: 54,
            borderRadius: 'var(--crm-radius-pill)',
            display: 'grid',
            placeItems: 'center',
            background: tk.accent,
            color: tk.accentInk,
            fontSize: 'var(--crm-text-3xl)',
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {initials}
        </span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-3xl)', fontWeight: 600, letterSpacing: -0.5, color: tk.ink }}>
          {displayName}
        </span>
        <MEIcon name="chevron-right" size={20} color={tk.ghost} />
      </Pressable>

      {/* Préférences */}
      <div style={{ ...card, marginTop: 12 }}>
        <div style={prefRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', minWidth: 0 }}>
            <span style={prefIcon}>
              <MEIcon name={isDark ? 'moon' : 'sun'} size={18} color={tk.ink} />
            </span>
            <span style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: tk.ink, letterSpacing: -0.2 }}>
              {t('nav.appearance')}
            </span>
          </div>
          <Segment
            value={isDark ? 'dark' : 'light'}
            onChange={(v) => setTheme(v === 'dark' ? 'dark' : 'light')}
            options={[
              { id: 'light', label: t('nav.light') },
              { id: 'dark', label: t('nav.dark') },
            ]}
          />
        </div>
        <div style={{ height: 1, background: tk.hair, marginLeft: 66 }} />
        <div style={prefRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', minWidth: 0 }}>
            <span style={prefIcon}>
              <MEIcon name="globe" size={18} color={tk.ink} />
            </span>
            <span style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: tk.ink, letterSpacing: -0.2 }}>
              {t('nav.language')}
            </span>
          </div>
          <Segment
            value={lang}
            // Charge le bundle PUIS bascule — cf. la JSDoc de switchLanguage.
            onChange={(v) => void switchLanguage(v)}
            options={[
              { id: 'fr', label: 'FR' },
              { id: 'en', label: 'EN' },
            ]}
          />
        </div>
      </div>

      {/* Destinations */}
      <div style={{ ...card, marginTop: 16 }}>
        {MORE_DESTS.map((d, i) => (
          <Pressable
            key={d.route}
            onClick={() => navigate(d.route)}
            style={{
              width: '100%',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--crm-space-2xl)',
              padding: 'var(--crm-space-2xl) var(--crm-space-4xl)',
              minHeight: 56,
              border: 0,
              background: 'transparent',
              cursor: 'pointer',
              borderTop: i === 0 ? undefined : `1px solid ${tk.hair}`,
            }}
          >
            <span
              style={{
                width: 40,
                height: 40,
                borderRadius: 'var(--crm-radius-lg)',
                flexShrink: 0,
                display: 'grid',
                placeItems: 'center',
                background: d.cta ? tk.accent : tk.cardSubtle,
              }}
            >
              <MEIcon name={d.icon} size={19} color={d.cta ? tk.accentInk : tk.ink} />
            </span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-2xl)', fontWeight: 600, letterSpacing: -0.3, color: tk.ink }}>
              {t(d.labelKey)}
            </span>
            <MEIcon name="chevron-right" size={18} color={tk.ghost} />
          </Pressable>
        ))}
      </div>

      {/* Déconnexion */}
      <div style={{ marginTop: 16 }}>
        <Pressable
          onClick={() => {
            void signOut().then(() => navigate('/login'))
          }}
          style={{
            width: '100%',
            height: 50,
            borderRadius: 'var(--crm-radius-pill)',
            border: 0,
            cursor: 'pointer',
            fontFamily: 'inherit',
            background: tk.card,
            boxShadow: tk.shadowSm,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--crm-space-md)',
          }}
        >
          <MEIcon name="logout" size={18} color={tk.muted} />
          <span style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, letterSpacing: -0.2, color: tk.muted }}>{t('nav.logout')}</span>
        </Pressable>
      </div>

      <MrNotifSheet
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        items={notifs.items}
        unreadCount={notifs.unreadCount}
        markRead={notifs.markRead}
        markAllRead={notifs.markAllRead}
      />
    </div>
  )
}
