import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ACCOUNT_TOKENS as T } from '@/lib/account-tokens'
import { useAuth } from '@/hooks/useAuth'
import { useAvatar } from '@/hooks/useAvatar'
import { useIsMobile } from '@/hooks/useMediaQuery'
import {
  UserIcon,
  HomeIcon,
  BookmarkIcon,
  HeartIcon,
  MessageIcon,
  ChevronDownIcon,
  SettingsIcon,
  HelpIcon,
  LogoutIcon,
} from './icons'

interface Props {
  onLogout: () => void
}

const NAV_LINKS: Array<[string, string]> = [
  ['/acheter', 'Acheter'],
  ['/louer', 'Louer'],
  ['/estimations', 'Estimer'],
  ['/services', 'Services'],
  ['/services', 'Pro'],
]

interface MenuItem {
  label: string
  hash: string
  icon: (p: { size?: number }) => React.ReactElement
}

const MENU_ITEMS: MenuItem[] = [
  { label: 'Profil', hash: '#profile', icon: UserIcon },
  { label: 'Mes annonces', hash: '#listings', icon: HomeIcon },
  { label: 'Mes recherches', hash: '#searches', icon: BookmarkIcon },
  { label: 'Favoris', hash: '#favorites', icon: HeartIcon },
  { label: 'Messagerie', hash: '#messages', icon: MessageIcon },
]

export default function AccountHeader({ onLogout }: Props) {
  const { user, profile } = useAuth()
  const { avatarUrl } = useAvatar()
  const isMobile = useIsMobile()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email || ''
  const displayEmail = user?.email || ''
  const firstName = displayName.split(' ')[0] || displayEmail.split('@')[0] || 'Vous'
  const initials = displayName
    ? displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : (displayEmail[0] || 'U').toUpperCase()

  useEffect(() => {
    if (!menuOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        height: 64,
        padding: isMobile ? '0 16px' : '0 32px',
        background: 'rgba(251, 252, 250, 0.92)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${T.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontFamily: T.fontStack,
      }}
    >
      <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
        <img
          src="/megga-logo.svg"
          alt="MEGGA"
          style={{ height: 22, width: 'auto', display: 'block', filter: 'brightness(0) saturate(100%)' }}
        />
      </Link>

      <nav
        style={{
          display: isMobile ? 'none' : 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {NAV_LINKS.map(([href, label], i) => (
          <Link
            key={`${href}-${i}`}
            to={href}
            style={{
              padding: '8px 14px',
              fontFamily: T.fontStack,
              fontSize: 13,
              fontWeight: 600,
              color: T.soft,
              textDecoration: 'none',
              borderRadius: 999,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = T.ink
              e.currentTarget.style.background = T.section
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = T.soft
              e.currentTarget.style.background = 'transparent'
            }}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            style={{
              height: 38,
              padding: isMobile ? '0 4px 0 4px' : '0 6px 0 14px',
              borderRadius: 999,
              border: `1px solid ${menuOpen ? T.ink : T.border}`,
              background: '#fff',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: T.fontStack,
              fontSize: 13,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              boxShadow: menuOpen ? '0 1px 0 rgba(0,0,0,0.04)' : 'none',
            }}
            onMouseEnter={(e) => {
              if (!menuOpen) e.currentTarget.style.borderColor = T.ink
            }}
            onMouseLeave={(e) => {
              if (!menuOpen) e.currentTarget.style.borderColor = T.border
            }}
          >
            {!isMobile && <span style={{ color: T.ink }}>{firstName}</span>}
            {!isMobile && (
              <span
                style={{
                  color: T.soft,
                  display: 'inline-flex',
                  transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.18s ease',
                }}
              >
                <ChevronDownIcon size={12} />
              </span>
            )}
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 999,
                background: avatarUrl ? `center/cover no-repeat url(${avatarUrl})` : T.accent,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: T.fontStack,
                fontSize: 12,
                fontWeight: 800,
                overflow: 'hidden',
              }}
            >
              {!avatarUrl && initials}
            </div>
          </button>

          {menuOpen && (
            <div
              role="menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                minWidth: 280,
                background: '#fff',
                border: `1px solid ${T.border}`,
                borderRadius: 16,
                boxShadow: '0 12px 40px rgba(15, 22, 36, 0.10), 0 2px 6px rgba(15, 22, 36, 0.06)',
                padding: 6,
                animation: 'megga-account-modal-in 0.16s ease-out',
                zIndex: 60,
              }}
            >
              <style>{`@keyframes megga-account-modal-in { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 12px 14px',
                  borderBottom: `1px solid ${T.border}`,
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 999,
                    background: avatarUrl ? `center/cover no-repeat url(${avatarUrl})` : T.accent,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: T.fontStack,
                    fontSize: 14,
                    fontWeight: 800,
                    flexShrink: 0,
                    overflow: 'hidden',
                  }}
                >
                  {!avatarUrl && initials}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: T.fontStack,
                      fontSize: 14,
                      fontWeight: 700,
                      color: T.ink,
                      lineHeight: 1.2,
                    }}
                  >
                    {displayName || displayEmail}
                  </div>
                  <div
                    style={{
                      fontFamily: T.fontStack,
                      fontSize: 12,
                      fontWeight: 500,
                      color: T.soft,
                      marginTop: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {displayEmail}
                  </div>
                </div>
              </div>

              {MENU_ITEMS.map((item) => {
                const Icon = item.icon
                return (
                  <a
                    key={item.hash}
                    href={item.hash}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 12px',
                      borderRadius: 10,
                      textDecoration: 'none',
                      fontFamily: T.fontStack,
                      fontSize: 13,
                      fontWeight: 600,
                      color: T.ink,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = T.section
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <span style={{ color: T.soft, display: 'inline-flex' }}>
                      <Icon size={18} />
                    </span>
                    <span>{item.label}</span>
                  </a>
                )
              })}

              <div style={{ height: 1, background: T.border, margin: '6px 8px' }} />

              <Link
                to="/aide"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 10,
                  textDecoration: 'none',
                  fontFamily: T.fontStack,
                  fontSize: 13,
                  fontWeight: 600,
                  color: T.ink,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = T.section
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <span style={{ color: T.soft, display: 'inline-flex' }}>
                  <SettingsIcon size={18} />
                </span>
                <span>Paramètres</span>
              </Link>

              <Link
                to="/aide"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 10,
                  textDecoration: 'none',
                  fontFamily: T.fontStack,
                  fontSize: 13,
                  fontWeight: 600,
                  color: T.ink,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = T.section
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <span style={{ color: T.soft, display: 'inline-flex' }}>
                  <HelpIcon size={18} />
                </span>
                <span>Aide & support</span>
              </Link>

              <div style={{ height: 1, background: T.border, margin: '6px 8px' }} />

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  onLogout()
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontFamily: T.fontStack,
                  fontSize: 13,
                  fontWeight: 600,
                  color: T.dangerDark,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = T.dangerSoft
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <span style={{ display: 'inline-flex' }}>
                  <LogoutIcon size={18} />
                </span>
                <span>Se déconnecter</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
