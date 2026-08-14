// MEGGA CRM Sugar v2 — Écran « Paramètres » (refonte finale — shell « À suivre »).
// Shell deux colonnes : rail de nav 300px à gauche + bento à droite qui rend la
// section active. 3 sections « Focus » (Profil, Agence, Préférences)
// reçoivent {sp, surf, dark, setDark} ; 3 sections conservées (Intégrations,
// Facturation, Sécurité) restent autonomes et lisent SET_PALETTE (mutée par
// applySetTheme avant render). Deep-link ?tab=.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { crmSugarPalette, sgVoileEncre } from '@/components/crm-sugar/tokens'
import { SugarTopNav, SugarIconRail, SUGAR_KEYFRAMES, type SugarScreenId } from '@/components/crm-sugar/SugarShell'
import { mxSurfaces } from '@/components/crm-sugar/biens/gallery/galHelpers'
import { IntegrationsSection } from '@/components/crm-sugar/settings/IntegrationsSection'
import { BillingSection } from '@/components/crm-sugar/settings/BillingSection'
import { SecuritySection } from '@/components/crm-sugar/settings/SecuritySection'
import { ProfileFocusSection } from '@/components/crm-sugar/settings/focus/ProfileFocusSection'
import { AgencyFocusSection } from '@/components/crm-sugar/settings/focus/AgencyFocusSection'
import { PreferencesFocusSection } from '@/components/crm-sugar/settings/focus/PreferencesFocusSection'
import { SETTINGS_SECTIONS, applySetTheme, type SectionId } from '@/components/crm-sugar/settings/data'
import { SETTINGS_KEYFRAMES } from '@/components/crm-sugar/settings/atoms'

const GROUP_ORDER: ('moi' | 'produit' | 'compte')[] = ['moi', 'produit', 'compte']
const ALLOWED: SectionId[] = ['profile', 'agency', 'preferences', 'integrations', 'security', 'billing']

// Icônes du rail (mêmes tracés que le proto SpgIcon).
const SPG_PATHS: Record<string, ReactNode> = {
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  building: <><path d="M3 21V7l9-4 9 4v14" /><path d="M9 21V12h6v9" /><path d="M9 8h.01M15 8h.01M9 11h.01M15 11h.01" /></>,
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

  const sp = crmSugarPalette(dark)
  const surf = mxSurfaces(sp)

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
  const spR = immersive ? crmSugarPalette(true) : sp
  const surfR = immersive ? mxSurfaces(spR) : surf
  const darkR = dark || immersive

  return (
    <div
      style={{
        position: 'relative', background: sp.pageBg, height: '100vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        // `var(--crm-font)` et non un littéral : écrire « Inter Tight » ici
        // ÉCRASAIT la variable de direction. La police tombait juste sous
        // MEGGA X par coïncidence, et Sugar ne récupérait jamais DM Sans —
        // mesuré : la variable passait bien à "DM Sans", le `<h1>` restait en
        // Inter Tight. Le repli garde la page lisible si la variable saute.
        fontFamily: 'var(--crm-font, "Inter Tight"), system-ui, sans-serif', color: sp.ink,
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
        /* Pas de \`border: 0\` ici : la ligne active porte désormais le filet 1 px
           de la carte MEGGA X en style inline, et l'inactive une bordure
           transparente de même épaisseur — c'est ce qui empêche le texte de
           sauter d'un pixel au changement de section. */
        .spg-nav { -webkit-tap-highlight-color: transparent; }
        .spg-nav:hover { background: ${darkR ? 'rgba(255,255,255,0.05)' : sgVoileEncre(false, 0.035)}; }
        .spg-scroll::-webkit-scrollbar { width: 9px; }
        .spg-scroll::-webkit-scrollbar-thumb { background: ${darkR ? 'rgba(255,255,255,.12)' : sgVoileEncre(false, .14)}; border-radius: 99px; border: 3px solid transparent; background-clip: content-box; }
      `}</style>

      <SugarTopNav active={'settings' as SugarScreenId} sp={sp} onNavigate={onNavigate} onCmd={onCmd} />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <SugarIconRail active="settings" onNavigate={onNavigate} onCmd={onCmd} dark={dark} setDark={setDark} sp={sp} />

        <main style={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%', paddingRight: 'var(--crm-space-7xl)', paddingBottom: 'var(--crm-space-6xl)' }}>
          <div style={{
            // ⚠ 26 reste un LITTÉRAL, et ce n'est pas un oubli : c'est le rayon
            // du cadre bento, écrit à l'identique sur 10 pages soeurs. Le passer
            // à `--crm-radius-6xl` ici seulement le désynchroniserait (28 en
            // Sugar au lieu de 26). Il se migre avec `src/pages/` en entier.
            position: 'relative', height: '100%', borderRadius: 26, overflow: 'hidden',
            border: `1px solid ${immersive ? 'rgba(255,255,255,0.08)' : sp.frameBorder}`, boxShadow: sp.shadow,
            // Couleur SOUS l'image de dégradé : elle suit le canvas, sinon la
            // facturation garde une zone quasi-noire au milieu du graphite.
            background: immersive ? `${spR.pageBg} url("${BILL_GRAD}") no-repeat bottom center / 140% auto` : sp.pageBg,
            display: 'grid', gridTemplateColumns: '300px 1fr',
          }}>
            {/* RAIL — titre + nav des sections (grammaire « À suivre ») */}
            {/* 30 px reste un littéral : au-delà de 24 c'est un décalage de
                composition, pas un barreau de rythme (même règle que la
                migration de `crm-sugar/`). */}
            <aside className="spg-scroll" style={{ padding: '30px var(--crm-space-7xl)', display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto' }}>
              {/* Titre en grammaire d'AFFICHAGE de la vitrine : ses `display-*` sont
                  réglés en 400/500/600, jamais en 800. Le 800 + `-1.1` venait de
                  Sugar, dont les titres sont des blocs compacts ; MEGGA X pose des
                  titres larges et peu gras, et c'est ce qui se lit d'abord en
                  entrant sur l'écran. */}
              <h1 style={{ margin: '0 0 var(--crm-space-6xl)', fontSize: 'var(--crm-text-9xl)', fontWeight: 500, letterSpacing: -0.8, color: spR.ink, lineHeight: 1.05 }}>{tr('focus.title')}</h1>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xs)' }}>
                {groups.map(({ g, items }) => (
                  <div key={g} style={{ display: 'contents' }}>
                    {items.map((s) => {
                      const on = s.id === active
                      return (
                        <button key={s.id} className="spg-nav" onClick={() => setActive(s.id)} style={{
                          display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-lg) var(--crm-space-xl)', borderRadius: 'var(--crm-radius-lg)', cursor: 'pointer',
                          fontFamily: 'inherit', textAlign: 'left', width: '100%',
                          // Ligne active = la CARTE de la vitrine (fond + filet 1 px),
                          // pas l'anneau noir `inset` de Sugar. C'est l'idiome que la
                          // vitrine emploie pour sa propre navigation latérale
                          // (`.utp---sidebar-dropdown-item` : fond `neutral-300`,
                          // bordure `neutral-400`) — rien d'inventé.
                          background: on ? surfR.card : 'transparent',
                          border: `1px solid ${on ? spR.cardBorder : 'transparent'}`,
                          boxShadow: on ? surfR.shadow : 'none',
                        }}>
                          <span style={{ width: 'var(--crm-icon-slot)', height: 'var(--crm-icon-slot)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                            <SpgIcon name={s.icon} size={17} stroke={on ? spR.ink : spR.sub} />
                          </span>
                          {/* Poids 500 et non 700 : la vitrine ne fait pas porter la
                              hiérarchie par la graisse mais par la couleur d'encre —
                              l'item inactif passe en `sub`, l'actif en `ink`. */}
                          <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-2xl)', fontWeight: 500, color: on ? spR.ink : spR.sub }}>{s.short || s.label}</span>
                        </button>
                      )
                    })}
                  </div>
                ))}
              </nav>
            </aside>

            {/* BENTO À DROITE — la section active (Facturation = plein cadre immersif) */}
            <div ref={scrollRef} className="spg-scroll" style={{ minHeight: 0, overflowY: 'auto', padding: immersive ? 0 : '28px 34px 40px var(--crm-space-xl)' }}>
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
