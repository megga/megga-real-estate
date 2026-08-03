// MEGGA CRM Sugar v2 — Écran « Paramètres » (refonte finale — shell « À suivre »).
// Shell deux colonnes : rail de nav 300px à gauche + bento à droite qui rend la
// section active. 4 sections « Focus » (Profil, Agence, Notifications, Préférences)
// reçoivent {sp, surf, dark, setDark} ; 3 sections conservées (Intégrations,
// Facturation, Sécurité) restent autonomes et lisent SET_PALETTE (mutée par
// applySetTheme avant render). Police Inter Tight (chrome CRM). Deep-link ?tab=.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { crmStep, crmSugarPalette, sugarThemeTokens } from '@/components/crm-sugar/tokens'
import { useDarkTone } from '@/hooks/useDarkTone'
import { SugarTopNav, SugarIconRail, SUGAR_KEYFRAMES, type SugarScreenId } from '@/components/crm-sugar/SugarShell'
import { galSurfaces } from '@/components/crm-sugar/biens/gallery/galHelpers'
import { IntegrationsSection } from '@/components/crm-sugar/settings/IntegrationsSection'
import { BillingSection } from '@/components/crm-sugar/settings/BillingSection'
import { SecuritySection } from '@/components/crm-sugar/settings/SecuritySection'
import { ProfileFocusSection } from '@/components/crm-sugar/settings/focus/ProfileFocusSection'
import { AgencyFocusSection } from '@/components/crm-sugar/settings/focus/AgencyFocusSection'
import { NotificationsFocusSection } from '@/components/crm-sugar/settings/focus/NotificationsFocusSection'
import { PreferencesFocusSection } from '@/components/crm-sugar/settings/focus/PreferencesFocusSection'
import { SETTINGS_SECTIONS, applySetTheme, type SectionId } from '@/components/crm-sugar/settings/data'
import { SETTINGS_KEYFRAMES } from '@/components/crm-sugar/settings/atoms'

const GROUP_ORDER: ('moi' | 'produit' | 'compte')[] = ['moi', 'produit', 'compte']
const ALLOWED: SectionId[] = ['profile', 'agency', 'notifications', 'preferences', 'integrations', 'security', 'billing']

// Icônes du rail (mêmes tracés que le proto SpgIcon).
const SPG_PATHS: Record<string, ReactNode> = {
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  building: <><path d="M3 21V7l9-4 9 4v14" /><path d="M9 21V12h6v9" /><path d="M9 8h.01M15 8h.01M9 11h.01M15 11h.01" /></>,
  bell: <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z" /><path d="M10 21a2 2 0 0 0 4 0" /></>,
  plug: <><path d="M9 2v6M15 2v6" /><path d="M5 8h14v3a7 7 0 0 1-14 0V8Z" /><path d="M12 18v4" /></>,
  sliders: <><path d="M4 21V14M4 10V3M12 21V12M12 8V3M20 21v-5M20 12V3" /><path d="M2 14h4M10 8h4M18 16h4" /></>,
  card: <><rect x="2" y="6" width="20" height="13" rx="2" /><path d="M2 11h20M6 16h4" /></>,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
}
function SpgIcon({ name, size = 17, stroke = 'currentColor' }: { name: string; size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      {SPG_PATHS[name] ?? null}
    </svg>
  )
}

export default function SettingsSugarV2Page() {
  const navigate = useNavigate()
  const { t: tr } = useTranslation('settings')

  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = window.localStorage.getItem('megga.sugar.dark')
    if (saved === '1') return true
    if (saved === '0') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('megga.sugar.dark', dark ? '1' : '0')
    }
  }, [dark])

  const darkTone = useDarkTone()
  const t = sugarThemeTokens(dark, darkTone)
  const sp = crmSugarPalette(t, dark, darkTone)
  const surf = galSurfaces(sp, dark)

  // Les sections conservées (Integrations/Billing/Security) lisent SET_PALETTE :
  // on la mute AVANT le render pour qu'elles suivent le thème (pattern maquette).
  applySetTheme(dark)

  const [searchParams] = useSearchParams()
  const [active, setActive] = useState<SectionId>(() => {
    const tab = (searchParams.get('tab') ?? '') as SectionId
    return ALLOWED.includes(tab) ? tab : 'profile'
  })

  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0 }, [active])

  const onCmd = () => { /* placeholder */ }
  const onNavigate = (id: SugarScreenId | string) => {
    switch (id) {
      case 'today': navigate('/dashboard'); break
      case 'pipeline': navigate('/dashboard/pipeline'); break
      case 'matching': navigate('/dashboard/matching'); break
      case 'contacts': navigate('/dashboard/contacts'); break
      case 'biens': navigate('/dashboard/listings'); break
      case 'biens-new': navigate('/dashboard/listings/new'); break
      case 'parcours': navigate('/dashboard/journey'); break
      case 'calendar': navigate('/dashboard/calendar'); break
      case 'kyc': navigate('/dashboard/kyc'); break
      case 'ai':
      case 'julien': navigate('/dashboard/julien'); break
      case 'dashboard': navigate('/dashboard/analytics'); break
      case 'settings': break
      default:
    }
  }

  const renderContent = () => {
    switch (active) {
      case 'profile': return <ProfileFocusSection sp={sp} surf={surf} dark={dark} />
      case 'agency': return <AgencyFocusSection sp={sp} surf={surf} dark={dark} />
      case 'notifications': return <NotificationsFocusSection sp={sp} surf={surf} dark={dark} />
      case 'preferences': return <PreferencesFocusSection sp={sp} surf={surf} dark={dark} setDark={setDark} />
      case 'integrations': return <IntegrationsSection />
      case 'security': return <SecuritySection />
      case 'billing': return <BillingSection />
      default: return null
    }
  }

  const groups = GROUP_ORDER
    .map((g) => ({ g, items: SETTINGS_SECTIONS.filter((s) => s.group === g) }))
    .filter((x) => x.items.length > 0)

  // Facturation = bento IMMERSIF : tout le cadre (rail inclus) passe en noir +
  // dégradé vitrine, quel que soit le thème app. Le rail est re-thémé en palette
  // sombre ; le contenu Facturation est transparent pour laisser passer le dégradé.
  const immersive = active === 'billing'
  const BILL_GRAD = '/billing/gradient.png'
  const spR = immersive ? crmSugarPalette(sugarThemeTokens(true, darkTone), true, darkTone) : sp
  const surfR = immersive ? galSurfaces(spR, true) : surf
  const darkR = dark || immersive

  return (
    <div
      style={{
        position: 'relative', background: sp.pageBg, height: '100vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        fontFamily: '"Inter Tight", system-ui, sans-serif', color: sp.ink,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <style>{SUGAR_KEYFRAMES}</style>
      <style>{SETTINGS_KEYFRAMES}</style>
      <style>{`
        /* Pas d'\`outline: none\` : les lignes du rail sont des <button>, et le
           supprimer les privait de tout repère de focus clavier (WCAG 2.4.7).
           L'anneau vient de la règle \`button:focus-visible\` de globals.css ;
           \`:focus-visible\` fait qu'il n'apparaît pas au clic souris, ce qui était
           le seul motif légitime de couper l'outline. */
        .spg-nav { -webkit-tap-highlight-color: transparent; border: 0; }
        .spg-nav:hover { background: ${darkR ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.035)'}; }
        .spg-scroll::-webkit-scrollbar { width: 9px; }
        .spg-scroll::-webkit-scrollbar-thumb { background: ${darkR ? 'rgba(255,255,255,.12)' : 'rgba(15,23,42,.14)'}; border-radius: 99px; border: 3px solid transparent; background-clip: content-box; }
      `}</style>

      <SugarTopNav active={'settings' as SugarScreenId} t={t} sp={sp} onNavigate={onNavigate} onCmd={onCmd} />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <SugarIconRail active="settings" onNavigate={onNavigate} onCmd={onCmd} dark={dark} setDark={setDark} sp={sp} />

        <main style={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%', paddingRight: 24, paddingBottom: 22 }}>
          <div style={{
            position: 'relative', height: '100%', borderRadius: 26, overflow: 'hidden',
            border: `1px solid ${immersive ? 'rgba(255,255,255,0.08)' : sp.frameBorder}`, boxShadow: sp.shadow,
            // Couleur SOUS l'image de dégradé : elle suit le canvas, sinon la
            // facturation garde une zone quasi-noire au milieu du graphite.
            background: immersive ? `${crmStep('s0', '#0B0C0E')} url("${BILL_GRAD}") no-repeat bottom center / 140% auto` : sp.pageBg,
            display: 'grid', gridTemplateColumns: '300px 1fr',
          }}>
            {/* RAIL — titre + nav des sections (grammaire « À suivre ») */}
            <aside className="spg-scroll" style={{ padding: '30px 24px', display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto' }}>
              <h1 style={{ margin: '0 0 22px', fontSize: 31, fontWeight: 800, letterSpacing: -1.1, color: spR.ink, lineHeight: 1 }}>{tr('focus.title')}</h1>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {groups.map(({ g, items }) => (
                  <div key={g} style={{ display: 'contents' }}>
                    {items.map((s) => {
                      const on = s.id === active
                      return (
                        <button key={s.id} className="spg-nav" onClick={() => setActive(s.id)} style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 14, cursor: 'pointer',
                          fontFamily: 'inherit', textAlign: 'left', width: '100%',
                          background: on ? surfR.card : 'transparent',
                          boxShadow: on ? `0 0 0 1.5px ${spR.ink} inset, ${surfR.shadow}` : 'none',
                        }}>
                          <span style={{ width: 26, height: 26, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                            <SpgIcon name={s.icon} size={17} stroke={on ? spR.ink : spR.sub} />
                          </span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: spR.ink }}>{s.short || s.label}</span>
                        </button>
                      )
                    })}
                  </div>
                ))}
              </nav>
            </aside>

            {/* BENTO À DROITE — la section active (Facturation = plein cadre immersif) */}
            <div ref={scrollRef} className="spg-scroll" style={{ minHeight: 0, overflowY: 'auto', padding: immersive ? 0 : '28px 34px 40px 12px' }}>
              <div key={active} style={{ maxWidth: immersive ? 'none' : 1180, height: immersive ? '100%' : undefined, margin: immersive ? 0 : '0 auto', animation: 'setFadeUp .32s cubic-bezier(.2,.8,.2,1) both' }}>
                {renderContent()}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
