// MEGGA CRM Sugar v2 — Shell components (TopNav + IconRail + Frame + RoundIconBtn + Orb)
// 1:1 port from the Claude Design bundle (crm-screen-today-sugar.jsx).

import { useState, useRef, useEffect } from 'react'
import type { ReactNode, MouseEvent as ReactMouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AnimatedTopIcon } from './LiquidGlassRail'
import type { CrmTheme, SugarPalette } from './tokens'
// CRM_AGENT mock retiré — l'avatar lit `useAuth().profile` (vrai utilisateur)
import SugarNotificationsPopover from './notifications/SugarNotificationsPopover'
import { useAgentNotifications } from '@/hooks/useAgentNotifications'
import SugarProfileDropdown from './profile/SugarProfileDropdown'
import { useAuth } from '@/hooks/useAuth'
import { openHelpFor } from '@/lib/help-articles'
import { openSugarSearch } from './search/openSearch'
import { useAiPanel } from '@/hooks/useAiPanel'

// ─── Détachement de la barre pendant le dock MEGGA AI ──────────────────
// Hauteur de repli de la barre (24 + 44 + 14) — c'est aussi le `navH` dont part
// le panneau. Sert de valeur initiale au spacer avant la première mesure.
const NAV_H = 82

/** Premier ancêtre qui rogne son contenu (`overflow: hidden|clip`), ou null. */
function clipAncestor(node: HTMLElement | null): HTMLElement | null {
  let n = node?.parentElement ?? null
  while (n && n !== document.body) {
    const o = getComputedStyle(n)
    if (/(hidden|clip)/.test(o.overflow + o.overflowX)) return n
    n = n.parentElement
  }
  return null
}

// ─── Round icon button (44x44, glass) ──────────────────────────────────
interface SugarRoundIconBtnProps {
  children: ReactNode
  dot?: boolean
  onClick?: (e: ReactMouseEvent<HTMLButtonElement>) => void
  sp: SugarPalette
  title?: string
}
export function SugarRoundIconBtn({ children, dot, onClick, sp, title }: SugarRoundIconBtnProps) {
  return (
    <button onClick={onClick} title={title} aria-label={title} style={{
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
  | 'biens' | 'calendar' | 'julien'

interface SugarTopNavProps {
  active?: SugarScreenId
  t: CrmTheme
  sp: SugarPalette
  onNavigate?: (id: SugarScreenId) => void
  onCmd?: () => void
  dark?: boolean
}
export function SugarTopNav({ active = 'today', t, sp, onNavigate, dark = false }: SugarTopNavProps) {
  const navigate = useNavigate()
  const { t: tc } = useTranslation('common')
  const { signOut, profile, user } = useAuth()
  // MEGGA AI — le bouton ✦ ouvre le panneau docké (via AiPanelProvider). Repli
  // sur la page « Julien » si la nav est rendue hors du provider.
  const ai = useAiPanel()
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
  const { items: notifs, unreadCount, markRead, markAllRead } = useAgentNotifications()
  const [notifOpen, setNotifOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const notifAnchorRef = useRef<HTMLDivElement>(null)
  const profileAnchorRef = useRef<HTMLDivElement>(null)

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
    { id: 'today',     label: tc('nav.today') },
    { id: 'pipeline',  label: tc('nav.pipeline') },
    { id: 'matching',  label: tc('nav.matching') },
    { id: 'parcours',  label: tc('nav.journey') },
    { id: 'contacts',  label: tc('nav.contacts') },
    { id: 'biens',     label: tc('nav.listings') },
    { id: 'calendar',  label: tc('nav.calendar') },
  ]
  const isJulien = active === 'julien'
  // ✦ actif = page Julien OU panneau MEGGA AI ouvert (quand le provider est monté).
  const aiActive = isJulien || (ai.enabled && ai.isOpen)

  // ─── Dock MEGGA AI : la barre du haut ne bouge pas ─────────────────────
  // `AgentSugarLayout` comprime le contenu de travail par `paddingRight` quand le
  // panneau est ouvert. La barre, elle, est du chrome : elle doit rester pleine
  // largeur et immobile. Or elle vit DANS la racine d'écran (100vh +
  // overflow:hidden), qui rétrécit avec le push et rogne tout ce qui dépasse —
  // c'est ce qui faisait disparaître le cluster d'icônes « comme balayé par une
  // ligne horizontale ». On sort donc la barre entière du flux tant que le dock
  // occupe de la place ; un spacer conserve son empreinte pour que rien ne bouge
  // en dessous. Même source que le wrapper (`ai.isOpen`) : les deux ne peuvent
  // pas diverger. Hors provider (`enabled: false`), rien ne change.
  //
  // Pourquoi la barre ENTIÈRE et pas seulement le cluster d'icônes (comme dans le
  // handoff) : ici la barre porte 7 onglets + 5 boutons ronds. Ne détacher que le
  // cluster laisse les onglets centrés dans la barre pleine largeur, donc au-delà
  // du bord de clip — « Calendrier » se faisait rogner de 51 px dès que le
  // viewport passait sous ~1383 px (mesuré à 1280 px). Détacher la barre entière
  // règle les deux d'un coup, avec les mêmes invariants (coordonnées identiques
  // au flux, z 75 en fixed / auto en flux, re-pose par sonde de layout).
  const docked = ai.enabled && ai.isOpen
  const [barLifted, setBarLifted] = useState(docked)
  const barRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (docked) { setBarLifted(true); return }
    // Fermeture : on ne repose la barre QUE lorsque le layout a réellement fini de
    // s'élargir. Une minuterie perd la course — le re-rendu de fermeture bloque le
    // main thread (~500 ms) et retarde d'autant la transition `padding-right`, si
    // bien que la barre retomberait alors que le bord de clip est encore à sa
    // gauche : re-rognage transitoire (bande sombre qui balaie les boutons). On
    // sonde donc le layout réel à chaque frame. Invariant : le bord de clip
    // grandit de façon monotone et la position en flux de la barre est constante
    // → une fois « inside », toujours inside, quel que soit le stall.
    let raf = 0
    let ok = 0
    const t0 = performance.now()
    const probe = () => {
      const bar = barRef.current
      const clip = clipAncestor(bar)
      const inside = !bar || !clip
        || bar.getBoundingClientRect().right <= clip.getBoundingClientRect().right + 1
      ok = inside ? ok + 1 : 0
      if (ok >= 3 || performance.now() - t0 > 1500) { setBarLifted(false); return }
      raf = requestAnimationFrame(probe)
    }
    raf = requestAnimationFrame(probe)
    return () => cancelAnimationFrame(raf)
  }, [docked])
  const lifted = barLifted || docked
  // Boîte de la barre EN FLUX — `top` sert de coordonnée au détachement, `height`
  // d'empreinte au spacer. Mesurée, jamais déduite : `AgentSugarLayout` empile
  // au-dessus du contenu des bandeaux de hauteur variable (impersonation, garde
  // LAB, et ceux à venir), et une langue plus longue peut faire grandir la barre.
  // Coder ces hauteurs en dur ferait sauter la barre à l'ouverture du dock.
  // On observe aussi `document.body` : un bandeau qui apparaît déplace la barre
  // sans la redimensionner, donc l'observer posé sur elle seule ne verrait rien.
  const [barBox, setBarBox] = useState({ top: 0, h: NAV_H })
  useEffect(() => {
    const el = barRef.current
    if (lifted || !el) return
    // La 1re livraison de l'observer fait office de mesure initiale (pas de
    // setState synchrone dans le corps de l'effet).
    const measure = () => {
      const r = el.getBoundingClientRect()
      const next = { top: Math.round(r.top), h: Math.round(r.height) }
      setBarBox(prev => (prev.top === next.top && prev.h === next.h ? prev : next))
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    ro.observe(document.body)
    return () => ro.disconnect()
  }, [lifted])

  // Inset droit = 24 px, la MÊME valeur que le `paddingRight` de tous les <main>
  // Sugar : le bord droit des boutons ronds — et donc des popovers ancrés dessus
  // en `right: 0` — tombe pile sur le bord droit du pager. Ne pas le remonter à
  // 40 : le popover profil repartirait 16 px en retrait du pager.
  return (
    <>
    {/* Spacer en flux : réserve l'empreinte de la barre pendant qu'elle est
        détachée, pour que le contenu en dessous ne remonte pas d'un pixel. */}
    {lifted && <div aria-hidden style={{ height: barBox.h, flexShrink: 0 }} />}
    <div ref={barRef} style={{
      display: 'flex', alignItems: 'center', padding: '24px 24px 14px 33px',
      gap: 24,
      // Coordonnées `fixed` = coordonnées en flux (la barre est pleine largeur
      // dans les deux cas) → aucun saut visuel au basculement. Dock fermé, on
      // laisse la barre `static` (et non `relative`) : positionner un élément le
      // fait peindre au-dessus de ses frères non positionnés, ce qui changerait
      // l'ordre de rendu des pages alors qu'on ne touche à rien.
      position: lifted ? 'fixed' : undefined,
      top: lifted ? barBox.top : undefined, left: lifted ? 0 : undefined, right: lifted ? 0 : undefined,
      // `position:fixed` crée un stacking context : il faut passer au-dessus du
      // panneau (z 70) pour que les popovers cloche/profil restent visibles dock
      // ouvert. En flux, z `auto` — sinon la barre piégerait ses propres popovers
      // (z 9000) dans un stacking context passant SOUS le panneau.
      zIndex: lifted ? 75 : 'auto',
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
        <SugarRoundIconBtn sp={sp} title={tc('nav.search')} onClick={() => openSugarSearch()}><AnimatedTopIcon name="search" color={sp.soft} size={18} /></SugarRoundIconBtn>
        {/* Aide contextuelle : ouvre l'article Help Center de l'écran courant (ou le
            Centre d'aide à défaut, public si Intercom n'est pas configuré). */}
        <SugarRoundIconBtn sp={sp} title={tc('nav.help')} onClick={() => openHelpFor(active)}><AnimatedTopIcon name="help" color={sp.soft} size={18} /></SugarRoundIconBtn>
        {/* Bouton Megga — ouvre le panneau MEGGA AI docké (ou la page Julien en repli) */}
        <button
          onClick={() => {
            if (ai.enabled && active !== 'julien') ai.open()
            else onNavigate?.('julien')
          }}
          title={tc('nav.aiAgent')}
          aria-expanded={ai.enabled ? ai.isOpen : undefined}
          style={{
            width: 44, height: 44, borderRadius: 999, border: 0,
            background: aiActive ? sp.ink : sp.iconBtnBg,
            boxShadow: aiActive ? '0 6px 20px rgba(11,12,14,0.25)' : sp.shadow,
            display: 'grid', placeItems: 'center', cursor: 'pointer',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            transition: 'all .2s ease',
          }}>
          <AnimatedTopIcon name="sparkle" color={aiActive ? sp.pageBg : sp.soft} size={18} active={aiActive} />
        </button>
        <div ref={notifAnchorRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setNotifOpen(o => !o)}
            title={tc('nav.notifications')}
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
            <AnimatedTopIcon name="bell" color={notifOpen ? sp.pageBg : sp.soft} size={18} />
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
                markRead(n.id)
                setNotifOpen(false)
                if (onNavigate && n.ctaTo) {
                  // Deep-link futur : ctaTo est vide pour l'instant (cf. useAgentNotifications).
                  onNavigate(n.ctaTo as SugarScreenId)
                }
              }}
              onMarkAll={() => markAllRead()}
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
              onHelp={() => openHelpFor()}
              onLogout={async () => { await signOut(); navigate('/login') }}
            />
          )}
        </div>
      </div>
    </div>
    </>
  )
}

// ─── Left icon rail (128px) — « Liquid Glass » ─────────────────────────
// Refonte design (capsule de verre réfractée + icônes self-draw Framer Motion
// + morph soleil/lune). Implémentation déplacée dans LiquidGlassRail.tsx ;
// re-export ici pour que les pages qui importent depuis SugarShell héritent
// du nouveau rail sans changement.
export { SugarIconRail, type SugarIconRailProps } from './LiquidGlassRail'


// ─── Orb background — soft floating gradient blobs behind the glass ────
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
  @keyframes sgSignVeil {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes sgSealIn {
    from { opacity: 0; transform: scale(.85); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes sgSignExit {
    0%   { opacity: 1; transform: translateY(0) scale(1); max-height: 340px; margin-top: 0; }
    30%  { opacity: 1; transform: translateY(-6px) scale(1.015); }
    100% { opacity: 0; transform: translateY(-26px) scale(.9); max-height: 0; margin-top: -10px; padding-top: 0; padding-bottom: 0; }
  }
  @keyframes sfPop {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes qaFade {
    from { opacity: 0; transform: translateY(-2px); }
    to   { opacity: 1; transform: none; }
  }
`

