// MEGGA CRM Sugar v2 — Shell components (TopNav + IconRail + Frame + RoundIconBtn + Orb)
// 1:1 port from the Claude Design bundle (crm-screen-today-sugar.jsx).

import { useState, useRef, useEffect } from 'react'
import type { CSSProperties, ReactNode, MouseEvent as ReactMouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import CRMIcon, { type CrmIconName } from './CRMIcon'
import type { CrmTheme, SugarPalette } from './tokens'
// CRM_AGENT mock retiré — l'avatar lit `useAuth().profile` (vrai utilisateur)
import SugarNotificationsPopover from './notifications/SugarNotificationsPopover'
import { SUGAR_NOTIFS, type SugarNotif } from './notifications/data'
import SugarProfileDropdown from './profile/SugarProfileDropdown'
import { useAuth } from '@/hooks/useAuth'

// ─── Round icon button (44x44, glass) ──────────────────────────────────
interface SugarRoundIconBtnProps {
  children: ReactNode
  dot?: boolean
  onClick?: (e: ReactMouseEvent<HTMLButtonElement>) => void
  sp: SugarPalette
}
export function SugarRoundIconBtn({ children, dot, onClick, sp }: SugarRoundIconBtnProps) {
  return (
    <button onClick={onClick} style={{
      width: 44, height: 44, borderRadius: 999, border: 0, background: sp.iconBtnBg,
      boxShadow: sp.shadow, display: 'grid', placeItems: 'center', cursor: 'pointer',
      position: 'relative',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
    }}>
      {children}
      {dot && <span style={{
        position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 999,
        background: '#E53935', border: `2px solid ${sp.iconBtnBg}`,
      }} />}
    </button>
  )
}

// ─── Top navigation (logo + horizontal tabs + actions) ─────────────────
export type SugarScreenId =
  | 'today' | 'pipeline' | 'matching' | 'parcours' | 'contacts'
  | 'biens' | 'calendar' | 'docs' | 'julien'

interface SugarTopNavProps {
  active?: SugarScreenId
  t: CrmTheme
  sp: SugarPalette
  onNavigate?: (id: SugarScreenId) => void
  onCmd?: () => void
  dark?: boolean
}
export function SugarTopNav({ active = 'today', t, sp, onNavigate, onCmd, dark = false }: SugarTopNavProps) {
  const navigate = useNavigate()
  const { signOut, profile, user } = useAuth()
  // Calcule initiales/affichage depuis le vrai profil. Fallback "??" pour
  // les sessions sans profil (devrait être rare — l'AuthGuard route avant).
  const displayName = profile?.full_name?.trim() || user?.email?.split('@')[0] || 'Agent'
  const displayInitials = displayName
    .split(/\s+/)
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '??'
  const displayRole = profile?.role
    ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1)
    : 'Agent'
  const [notifs, setNotifs] = useState<SugarNotif[]>(SUGAR_NOTIFS)
  const [notifOpen, setNotifOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const notifAnchorRef = useRef<HTMLDivElement>(null)
  const profileAnchorRef = useRef<HTMLDivElement>(null)
  const unreadCount = notifs.filter(n => !n.read).length

  useEffect(() => {
    if (!notifOpen && !profileOpen) return
    function handleClick(e: MouseEvent) {
      if (notifOpen && notifAnchorRef.current && !notifAnchorRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
      if (profileOpen && profileAnchorRef.current && !profileAnchorRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setNotifOpen(false)
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [notifOpen, profileOpen])
  const tabs: { id: SugarScreenId; label: string }[] = [
    { id: 'today',     label: "Aujourd'hui" },
    { id: 'pipeline',  label: 'Pipeline' },
    { id: 'matching',  label: 'Matching' },
    { id: 'parcours',  label: 'Parcours' },
    { id: 'contacts',  label: 'Contacts' },
    { id: 'biens',     label: 'Mes biens' },
    { id: 'calendar',  label: 'Calendrier' },
    { id: 'docs',      label: 'Documents' },
  ]
  const isJulien = active === 'julien'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '24px 40px 14px 33px',
      gap: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, height: 44 }}>
        <svg viewBox="0 0 694.81 419.02" width="62" height="38" style={{ display: 'block' }} aria-label="MEGGA">
          <path fill={sp.ink} d="M212.94,0c46.64,5.38,88.55,22.94,122.21,59.67-22.79,28.12-37.71,60.3-47.08,96.28-7.89-14.68-16.56-27.02-28.35-37.25-40.39-35.04-99.55-30.53-134.81,9.66-40.25,45.89-40.1,117.16.48,162.82,35.48,39.93,94.73,44.05,134.83,8.67,14.5-12.89,25.12-28.95,32.24-48.42l-95.26-.1-.03-83.65,192.78-.02c8.8,28.23,5.09,73.7-2.86,101.4-22.71,79.15-85.98,140.1-169.06,149-2.17.23-4.11.34-5.1.93h-31c-42.03-4.33-81.34-20.79-113.04-49.92C-27.8,280.23-21.84,119.65,81.31,39.5,110.93,16.49,145.39,3.92,181.93,0h31.01Z"/>
          <path fill={sp.ink} d="M511.94,419.01h-29c-47.56,0-91.35-24.53-123.87-60,24.65-30.5,36.53-57.89,47.2-96.18,7.43,14.3,16.5,27.51,28.71,37.93,36.96,31.55,90.34,30.86,126.22-1.89,13.97-12.75,24.27-28.48,31.18-47.43l-94.84-.08-.05-83.65,192.4-.03c2.59,9.14,3.94,17.82,4.5,27.2,4.34,72.2-25.1,142.48-83.13,186.34-29.43,22.24-63.45,34.03-99.32,37.8h0Z"/>
          <path fill={sp.ink} d="M511.94,0c43.2,4.34,82.78,21.02,114.61,50.52,6.43,5.96,12.05,11.43,17.39,19.2l-56.72,84.95c-7.57-14.34-16.16-25.96-27.71-36.03-33.9-29.56-83.44-31.58-119.35-4.39-12.97,9.71-22.64,21.92-30.74,35.77l-101.14-.14c10.87-40.77,32.85-75.32,63.12-102.25C402.99,19.45,441.75,4.18,482.95.02h29-.01Z"/>
        </svg>
      </div>
      <nav style={{ display: 'flex', gap: 4, flex: 1, justifyContent: 'center' }}>
        {tabs.map(tab => {
          const isActive = tab.id === active
          return (
            <button key={tab.id} onClick={() => onNavigate && onNavigate(tab.id)} style={{
              padding: '10px 22px', borderRadius: 999, border: 0, cursor: 'pointer',
              background: isActive ? sp.ink : 'transparent',
              color: isActive ? sp.pageBg : sp.soft,
              fontWeight: isActive ? 700 : 500, fontSize: 14.5,
              fontFamily: 'inherit', boxShadow: isActive ? sp.focusShadow : 'none',
            }}>{tab.label}</button>
          )
        })}
      </nav>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <SugarRoundIconBtn sp={sp} onClick={onCmd}><CRMIcon name="search" size={18} stroke={sp.soft} /></SugarRoundIconBtn>
        {/* Bouton Julien — Agent IA */}
        <button
          onClick={() => onNavigate && onNavigate('julien')}
          title="Julien — Agent IA"
          style={{
            width: 44, height: 44, borderRadius: 999, border: 0,
            background: isJulien ? sp.ink : sp.iconBtnBg,
            boxShadow: isJulien ? '0 6px 20px rgba(11,12,14,0.25)' : sp.shadow,
            display: 'grid', placeItems: 'center', cursor: 'pointer',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            transition: 'all .2s ease',
          }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke={isJulien ? sp.pageBg : sp.soft}
            strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
          </svg>
        </button>
        <div ref={notifAnchorRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setNotifOpen(o => !o)}
            title="Notifications"
            style={{
              width: 44, height: 44, borderRadius: 999, border: 0,
              background: notifOpen ? sp.ink : sp.iconBtnBg,
              boxShadow: sp.shadow,
              display: 'grid', placeItems: 'center', cursor: 'pointer',
              position: 'relative',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              transition: 'background 160ms ease',
            }}>
            <CRMIcon name="bell" size={18} stroke={notifOpen ? sp.pageBg : sp.soft} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: 7, right: 7,
                minWidth: 16, height: 16, borderRadius: 999,
                background: '#E53935', color: '#fff',
                fontSize: 9.5, fontWeight: 800,
                display: 'grid', placeItems: 'center', padding: '0 4px',
                border: `2px solid ${notifOpen ? sp.ink : sp.iconBtnBg}`,
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
              }}>{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </button>
          {notifOpen && (
            <SugarNotificationsPopover
              sp={sp}
              dark={dark}
              items={notifs}
              onItemClick={(n) => {
                setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
                setNotifOpen(false)
                if (onNavigate && n.ctaTo) {
                  // Map ctaTo to SugarScreenId when possible
                  const target = n.ctaTo as SugarScreenId
                  onNavigate(target)
                }
              }}
              onMarkAll={() => setNotifs(prev => prev.map(n => ({ ...n, read: true })))}
              onSeeAll={() => setNotifOpen(false)}
              onMute={() => setNotifOpen(false)}
            />
          )}
        </div>
        <div ref={profileAnchorRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => { setProfileOpen(o => !o); setNotifOpen(false) }}
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            title={`${displayName} · ${displayRole}`}
            style={{
              width: 44, height: 44, borderRadius: 999, border: 0,
              background: profileOpen ? sp.ink : t.primary,
              color: '#fff',
              display: 'grid', placeItems: 'center',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              boxShadow: profileOpen
                ? '0 6px 20px rgba(11,12,14,0.25)'
                : sp.shadow,
              transition: 'background 200ms ease, box-shadow 200ms ease',
            }}>{displayInitials}</button>
          {profileOpen && (
            <SugarProfileDropdown
              sp={sp}
              dark={dark}
              onClose={() => setProfileOpen(false)}
              onSettings={() => navigate('/dashboard/settings')}
              onKyc={() => navigate('/dashboard/kyc')}
              onAgencyPublic={() => window.open('/agencies', '_blank', 'noopener,noreferrer')}
              onHelp={() => navigate('/help')}
              onLogout={async () => { await signOut(); navigate('/login') }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Left icon rail (128px) ────────────────────────────────────────────
// Logo GG → search/create → modules (AI, Dashboard, +Bien) → Messages → KYC/Auto → Settings → DarkToggle
interface SugarIconRailProps {
  active?: string
  onNavigate?: (id: string) => void
  dark: boolean
  setDark: (v: boolean) => void
  sp: SugarPalette
  onCmd?: () => void
  extraBottomBtn?: ReactNode
}
export function SugarIconRail({
  active = 'today', onNavigate, dark, setDark, sp, onCmd, extraBottomBtn,
}: SugarIconRailProps) {
  const idleBg = dark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)'
  const idleStroke = sp.soft
  const activeBg = sp.ink
  const activeStroke = sp.focusInk
  const dividerColor = dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'

  type RailItem = { id: string; icon: CrmIconName; label: string; onClick?: () => void; dot?: boolean }
  const top: RailItem[] = [
    { id: 'search', icon: 'search', onClick: onCmd, label: 'Rechercher' },
    { id: 'add',    icon: 'plus',   label: 'Créer' },
  ]
  const modules: RailItem[] = [
    { id: 'ai',        icon: 'spark', label: 'MEGGA AI' },
    { id: 'dashboard', icon: 'dash',  label: 'Dashboard' },
    { id: 'biens-new', icon: 'plus',  label: 'Créer un bien' },
  ]
  const tools: RailItem[] = [
    { id: 'kyc',    icon: 'kyc',   label: 'KYC' },
    { id: 'reseau', icon: 'share', label: "Réseau d'agences" },
  ]

  const RailBtn = ({ it }: { it: RailItem }) => {
    const isActive = it.id === active
    return (
      <button
        title={it.label}
        onClick={() => { if (it.onClick) it.onClick(); else if (onNavigate) onNavigate(it.id) }}
        style={{
          width: 52, height: 52, borderRadius: 16, border: 0,
          background: isActive ? activeBg : idleBg,
          boxShadow: isActive ? sp.focusShadow : 'none',
          display: 'grid', placeItems: 'center', cursor: 'pointer',
          position: 'relative',
          transition: 'background 160ms ease, transform 160ms ease',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)' }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = idleBg }}
      >
        <CRMIcon name={it.icon} size={22} stroke={isActive ? activeStroke : idleStroke} strokeWidth={1.7} />
        {it.dot && <span style={{
          position: 'absolute', top: 8, right: 8, width: 9, height: 9, borderRadius: 999,
          background: '#E53935', border: `2px solid ${sp.pageBg}`,
        }} />}
      </button>
    )
  }

  const Divider = () => (
    <div style={{
      width: 28, height: 1, background: dividerColor, margin: '6px 0', borderRadius: 999,
    }} />
  )

  return (
    <aside style={{
      width: 128, flexShrink: 0,
      padding: '108px 0 20px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      background: 'transparent',
    }}>
      {top.map(it => <RailBtn key={it.id} it={it} />)}
      {modules.map(it => <RailBtn key={it.id} it={it} />)}
      {tools.map(it => <RailBtn key={it.id} it={it} />)}

      {extraBottomBtn && <>{extraBottomBtn}<Divider /></>}

      <button title="Réglages" onClick={() => onNavigate && onNavigate('settings')} style={{
        width: 52, height: 52, borderRadius: 16, border: 0,
        background: idleBg,
        display: 'grid', placeItems: 'center', cursor: 'pointer',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}>
        <CRMIcon name="cog" size={22} stroke={idleStroke} strokeWidth={1.7} />
      </button>

      <button onClick={() => setDark(!dark)} title={dark ? 'Mode clair' : 'Mode sombre'} style={{
        width: 52, height: 52, borderRadius: 16, border: 0,
        background: idleBg,
        display: 'grid', placeItems: 'center', cursor: 'pointer',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}>
        <CRMIcon name={dark ? 'sun' : 'moon'} size={22} stroke={idleStroke} strokeWidth={1.7} />
      </button>
    </aside>
  )
}

// ─── Floating "frame" card ─────────────────────────────────────────────
interface SugarFrameProps {
  title: string
  badge?: ReactNode
  actions?: ReactNode
  children: ReactNode
  teamChips?: ReactNode
  style?: CSSProperties
  sp: SugarPalette
  index?: number
}
export function SugarFrame({
  title, badge, actions, children, teamChips, style, sp, index = 0,
}: SugarFrameProps) {
  return (
    <div style={{
      background: sp.frameBg,
      border: `1px solid ${sp.frameBorder}`,
      borderRadius: 24,
      padding: '20px 22px',
      boxShadow: sp.shadow,
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      animation: `sugar-fade-up 480ms cubic-bezier(.22,1,.36,1) ${index * 80}ms backwards`,
      ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <h2 style={{
          margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: -0.3, color: sp.ink,
        }}>{title}</h2>
        {badge}
        {teamChips && (
          <div style={{ display: 'flex', marginLeft: 8 }}>
            {teamChips}
          </div>
        )}
        <div style={{ flex: 1 }} />
        {actions}
      </div>
      {children}
    </div>
  )
}

// ─── Orb background — soft floating gradient blobs behind the glass ────
export function SugarOrbBackground({ dark }: { dark: boolean }) {
  const orbs = dark
    ? [
        { top: '-8%',  left: '-6%', size: 560, color: 'rgba(99,102,241,0.32)' },
        { top: '30%',  left: '62%', size: 640, color: 'rgba(168,85,247,0.22)' },
        { top: '70%',  left: '10%', size: 520, color: 'rgba(20,184,166,0.18)' },
      ]
    : [
        { top: '-10%', left: '-8%', size: 560, color: 'rgba(255,180,140,0.45)' },
        { top: '25%',  left: '65%', size: 640, color: 'rgba(140,180,255,0.40)' },
        { top: '70%',  left: '8%',  size: 520, color: 'rgba(180,255,210,0.38)' },
      ]
  return (
    <div aria-hidden style={{
      position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none',
      zIndex: 0,
    }}>
      {orbs.map((o, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: o.top, left: o.left,
          width: o.size, height: o.size,
          background: `radial-gradient(circle at center, ${o.color} 0%, transparent 70%)`,
          filter: 'blur(40px)',
        }} />
      ))}
    </div>
  )
}

// ─── Sugar global animations (mounted once at the page root) ───────────
export const SUGAR_KEYFRAMES = `
  @keyframes sugar-fade-up {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes sugar-slide-in {
    from { transform: translateX(100%); }
    to   { transform: translateX(0); }
  }
  @keyframes sugar-bento-in {
    from { opacity: 0; transform: translateX(40px) scale(0.96); }
    to   { opacity: 1; transform: translateX(0) scale(1); }
  }
  @keyframes sugar-overlay-fade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes sugar-toast {
    from { opacity: 0; transform: translate(-50%, 12px); }
    to   { opacity: 1; transform: translate(-50%, 0); }
  }
  @keyframes sugar-dash-flow {
    to { stroke-dashoffset: -14; }
  }
`

