/**
 * Chrome de la console super-admin (`/dashboard/admin`), en grammaire MEGGA X.
 *
 * Porté sur la coquille de l'écran Paramètres du CRM
 * (`SettingsPage`) : le contenu ne court plus bord à bord, il vit dans le
 * PAGER — un cadre flottant de rayon 26 séparé du fond par l'ombre — avec le
 * rail de navigation de 300 px À L'INTÉRIEUR du cadre, et la page active dans le
 * bento de droite.
 *
 * Les valeurs (rayon, ombre, bordure de cadre, largeur de rail, grammaire des
 * lignes de nav) viennent de `useAdminSurfaces()`, donc de `tokens.ts` — pas d'une
 * copie. `admin-console.css` continue de re-teinter les variables pour les
 * pages ; ici on lit la palette en JS pour obtenir le cadre exact.
 *
 * Le violet est CONSERVÉ, à contre-courant de l'accent unique de la direction :
 * c'est le seul signal qui dit « tu n'es plus dans ton agence, tu es dans la
 * plateforme ». Il vit en TROIS sites, tous ici (`VIOLET_CONSOLE`) — jamais un
 * bouton plein, jamais un statut métier, et jamais le ton du kit.
 *
 * Mise en page : le rail est dans le cadre au-delà de `lg`, en tiroir en
 * dessous (le cadre passe alors pleine largeur, sans rayon).
 */
import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { useAuth } from '@/hooks/useAuth'
import { useAdminSurfaces } from '@/hooks/useAdminSurfaces'
import { useAdminTheme } from '@/components/admin/AdminThemeProvider'
import { ADMIN_CONSOLE_PATH } from '@/lib/adminEntry'
import AdminSearchDialog from '@/components/admin/AdminSearchDialog'
import { ADMIN_KEYFRAMES, ADMIN_RADII, ADMIN_RAIL_WIDTH } from '@/components/admin/kit/adminKitCore'
// Le dock d'icônes du CRM, réutilisé tel quel (cf. `items` dans AdminShell).
// CRM_KEYFRAMES est requis : le rail s'ouvre en `crm-fade-up`, que
// ADMIN_KEYFRAMES ne définit pas — sans lui le rail apparaîtrait sec.
import { CrmIconRail, type RailItem } from '@/components/crm/LiquidGlassRail'
import { CRM_KEYFRAMES } from '@/components/crm/CrmShell'
// Palette de la console. Importée ICI et non par une entrée d'app : c'est la
// seule façon que les DEUX montages l'obtiennent. Elle est scopée à
// `.megga-admin-console`, posée sur la racine ci-dessous — sans quoi elle
// reteindrait tout le CRM.
import '@/styles/admin-console.css'
import { crmVoileEncre } from '@/components/crm/tokens'

/**
 * Le violet de la console — son unique repère de contexte, en TROIS sites, tous
 * dans ce fichier : la pastille du rail, le badge « ADMIN » et le titre mobile.
 *
 * ⚠ Distinct de `tones.accent`, qui est l'accent MEGGA X offert au KIT. Les
 * confondre est exactement ce qui s'était produit : deux des trois sites
 * lisaient le ton du kit, si bien que repeindre le kit aurait effacé le repère.
 */
const VIOLET_CONSOLE = 'rgb(var(--color-admin-accent))'

interface NavItem {
  labelKey: string
  href: string
  icon: MEIconName
  /** `end` : n'est actif que sur une correspondance exacte (l'accueil `/`). */
  end?: boolean
}

interface NavSection {
  labelKey: string
  items: NavItem[]
}

// Nav groupée en 5 sections (P6b) — une liste plate de 17 entrées était devenue
// illisible. Ordre des sections = du pilotage quotidien au produit.
// Chemins SANS préfixe : `ADMIN_CONSOLE_PATH` est ajouté au rendu.
//
// ⚠ Ne PAS repasser aux liens RELATIFS de React Router. `AdminShell` est
// l'`element` d'une route de mise en page sans `path`, montée sous un splat : la
// résolution du relatif dépend alors du drapeau `v7_relativeSplatPath`, absent
// du routeur du CRM. Mesuré : depuis `/dashboard/admin/agencies`, `to="live"`
// produisait `/dashboard/admin/agencies/live` et `to="."` pointait sur la page
// courante — nav cassée dès le premier clic, « Vue d'ensemble » allumé en
// permanence. Le préfixe explicite ne dépend d'aucun drapeau.
const NAV_SECTIONS: NavSection[] = [
  { labelKey: 'nav.adminSectionPilotage', items: [
    { labelKey: 'nav.adminLive', href: '/live', icon: 'broadcast' },
    { labelKey: 'nav.adminOverview', href: '', icon: 'dashboard', end: true },
  ]},
  { labelKey: 'nav.adminSectionClients', items: [
    { labelKey: 'nav.adminAgencies', href: '/agencies', icon: 'building' },
    { labelKey: 'nav.adminUsers', href: '/users', icon: 'users' },
    { labelKey: 'nav.adminEndUsers', href: '/end-users', icon: 'users' },
    { labelKey: 'nav.adminModeration', href: '/moderation', icon: 'store' },
    { labelKey: 'nav.adminOnboardingCalls', href: '/onboarding-calls', icon: 'calendar' },
  ]},
  { labelKey: 'nav.adminSectionRevenue', items: [
    { labelKey: 'nav.adminPlans', href: '/plans', icon: 'credit-card' },
  ]},
  { labelKey: 'nav.adminSectionOps', items: [
    { labelKey: 'nav.adminMonitoring', href: '/monitoring', icon: 'broadcast' },
    { labelKey: 'nav.adminSecurity', href: '/security', icon: 'shield' },
    { labelKey: 'nav.adminCompliance', href: '/compliance', icon: 'shield' },
    { labelKey: 'nav.adminKybReview', href: '/kyb-review', icon: 'eye' },
  ]},
  { labelKey: 'nav.adminSectionProduct', items: [
    { labelKey: 'nav.adminChangelog', href: '/changelog', icon: 'megaphone' },
    { labelKey: 'nav.adminFlags', href: '/feature-flags', icon: 'bolt' },
    { labelKey: 'nav.adminNps', href: '/nps', icon: 'star' },
    { labelKey: 'nav.adminAutonomy', href: '/autonomy', icon: 'sparkle' },
    { labelKey: 'nav.adminLearning', href: '/learning', icon: 'sparkle' },
    { labelKey: 'nav.adminToolUsage', href: '/tool-usage', icon: 'sparkle' },
  ]},
]

/**
 * Contenu du rail — partagé entre le rail dans le cadre et le tiroir mobile.
 *
 * Grammaire de nav reprise ligne pour ligne des Réglages : rayon 14, gap 12,
 * padding 10/12, et l'état actif marqué par une surface de carte + un anneau
 * intérieur de 1,5 px en encre. L'icône passe de `sp.sub` à l'encre ; le
 * libellé reste en encre, comme dans le rail des Réglages.
 */
function ShellNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation(['common', 'admin'])
  const { signOut, profile } = useAuth()
  const { dark } = useAdminTheme()
  const { sp, surf } = useAdminSurfaces()
  const navigate = useNavigate()

  const rowBase = {
    display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)',
    padding: 'var(--crm-space-lg) var(--crm-space-xl)', borderRadius: ADMIN_RADII.row,
    cursor: 'pointer', border: 0, width: '100%',
    fontFamily: 'inherit', textAlign: 'left' as const,
    background: 'transparent',
  }
  const labelStyle = { flex: 1, minWidth: 0, fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink } as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, padding: '26px 18px 18px' }}>
      {/* Titre d'écran + repère de contexte (le violet, une seule fois) */}
      <div style={{ padding: '0 var(--crm-space-sm)', marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 'var(--crm-text-6xl)', fontWeight: 600, letterSpacing: -1.1, color: sp.ink, lineHeight: 1 }}>
          {t('nav.adminConsole')}
        </h1>
        {/* ⛔ LE VIOLET, ET SEULEMENT ICI. Ces deux sites lisaient `tones.accent`,
            qui sert désormais le KIT et vaut l'accent MEGGA X : ils liraient donc
            du bleu, et le repère de contexte disparaîtrait. Le violet passe par
            sa variable, comme le titre plus bas — trois sites, tous dans ce
            fichier, tous des repères de contexte. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', marginTop: 9 }}>
          <span style={{ width: 7, height: 7, borderRadius: ADMIN_RADII.pill, background: VIOLET_CONSOLE, flexShrink: 0 }} />
          {/* Le repère de contexte passe par la clé, pas par un littéral : les 17
              pages la rendaient avant, elle serait devenue orpheline. */}
          <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: VIOLET_CONSOLE, letterSpacing: -0.1 }}>{t('admin:common.adminBadge')}</span>
        </div>
      </div>

      {/* Recherche et bascule de thème ne sont plus ici : elles vivent dans le
          rail d'icônes Sugar, à gauche du cadre, exactement comme sur l'écran
          Réglages du CRM dont cette coquille est le port. Les dupliquer dans les
          deux rails était le signe visuel qui trahissait « autre application ». */}
      <nav aria-label="Navigation admin" className="adm-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', marginTop: 6 }}>
        {NAV_SECTIONS.map((section) => (
          <div key={section.labelKey}>
            <div style={{ padding: 'var(--crm-space-2xl) var(--crm-space-xl) var(--crm-space-xs)' }}>
              <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, letterSpacing: 0.2, color: sp.sub, userSelect: 'none' }}>
                {t(section.labelKey)}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)' }}>
              {section.items.map((item) => (
                <NavLink key={item.href} to={`${ADMIN_CONSOLE_PATH}${item.href}`} end={item.end} onClick={onNavigate} className="adm-nav" style={({ isActive }) => ({
                  ...rowBase,
                  textDecoration: 'none',
                  background: isActive ? surf.card : 'transparent',
                  boxShadow: isActive ? `0 0 0 1.5px ${sp.ink} inset, ${surf.shadow}` : 'none',
                })}>
                  {({ isActive }) => (
                    <>
                      <span style={{ width: 22, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <MEIcon name={item.icon} size={17} color={isActive ? sp.ink : sp.sub} />
                      </span>
                      <span style={labelStyle}>{t(item.labelKey)}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Pied de rail : retour CRM, compte */}
      <div style={{ flexShrink: 0, marginTop: 10 }}>
        <div style={{ height: 1, background: crmVoileEncre(dark, 0.07), margin: '0 6px 8px' }} />

        {/* Une ancre, mais une navigation par le routeur : l'ancre préserve le
            clic-milieu et le survol d'URL, le routeur évite le rechargement. */}
        <a className="adm-nav" href="/dashboard" onClick={(e) => { e.preventDefault(); navigate('/dashboard') }} style={{ ...rowBase, textDecoration: 'none' }}>
          <span style={{ width: 22, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <MEIcon name="external" size={17} color={sp.sub} />
          </span>
          <span style={{ ...labelStyle, color: sp.soft }}>{t('nav.backToCrm')}</span>
        </a>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', marginTop: 8, padding: 'var(--crm-space-lg) var(--crm-space-xl)',
          borderRadius: ADMIN_RADII.row, background: surf.cardSub,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ margin: 0, fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.full_name ?? profile?.email ?? '—'}
            </p>
            <p style={{ margin: 0, fontSize: 'var(--crm-text-sm)', color: sp.sub, lineHeight: 1.3 }}>{t('nav.adminOverview')}</p>
          </div>
          <button
            onClick={() => void signOut()}
            title={t('nav.logout')}
            style={{
              width: 28, height: 28, borderRadius: ADMIN_RADII.pill, border: 0, cursor: 'pointer',
              background: 'transparent', color: sp.sub, display: 'grid', placeItems: 'center',
            }}
          >
            <MEIcon name="logout" size={15} color={sp.sub} />
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Shell complet : page teintée, cadre pager flottant, rail dans le cadre.
 *
 * Le `overflow: hidden` du cadre est ce qui clippe le bento aux coins arrondis ;
 * le scroll appartient donc à la colonne de contenu, pas à la fenêtre. C'est la
 * mécanique du pager Sugar (`KycPagerFrame`) sans le glissement vertical, dont
 * une console de tableaux n'a pas besoin.
 */
export default function AdminShell() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const { sp, surf, dark } = useAdminSurfaces()
  const { toggle } = useAdminTheme()
  const { t } = useTranslation(['common', 'admin'])
  const navigate = useNavigate()

  /**
   * Outils du rail d'icônes, côté console.
   *
   * La liste par défaut du rail est celle du CRM et n'a pas de sens ici :
   * `search` ouvrirait un hôte que seul `AgentLayout` monte, et `relances`
   * interrogerait des données d'agence alors que le super-admin n'en a pas. On
   * fournit donc les outils de la console — le composant, lui, reste le même
   * que dans le CRM.
   *
   * Les PAGES ne sont pas ici : elles vivent dans le rail de 300 px du cadre,
   * comme les sections des Réglages. Le dock ne porte que le transverse.
   */
  const railItems: RailItem[] = [
    { id: 'search', icon: 'search', label: t('common:nav.search'), action: () => setSearchOpen(true) },
    // Retour au CRM, par le routeur : même application, aucun rechargement.
    //
    // Icône `dashboard` et non `external` : le registre du rail ne connaît que
    // seize glyphes (`external` n'en fait pas partie et retombait sur la loupe,
    // donnant deux loupes côte à côte). `dashboard` est en outre le bon signe —
    // dans le CRM ce bouton mène au tableau de bord, ici il y ramène. Même
    // bouton, même place, geste analogue.
    { id: 'crm', icon: 'dashboard', label: t('common:nav.backToCrm'), action: () => navigate('/dashboard') },
  ]

  /** Le rail rend toujours « Réglages » : ils vivent dans le CRM, pas ici. */
  const onRailNavigate = (id: string) => {
    // Les réglages appartiennent au CRM, jamais à la console.
    if (id === 'settings') navigate('/dashboard/settings')
  }

  return (
    <div
      className="megga-admin-console"
      // Le sombre se lit ici, pas sur `data-theme` : dans le CRM, le
      // ThemeProvider agent pilote cet attribut depuis une autre clé et gagne.
      data-admin-dark={dark ? 'true' : 'false'}
      style={{
        position: 'relative', background: sp.pageBg, height: '100vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        // ⚠ Par la VARIABLE : une police en dur écraserait `--crm-font` pour
        // toute la console, et le défaut ne se verrait pas sous MEGGA X.
        fontFamily: 'var(--crm-font, "Inter Tight"), system-ui, sans-serif', color: sp.ink,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <style>{ADMIN_KEYFRAMES}</style>
      <style>{CRM_KEYFRAMES}</style>
      <style>{`
        /* Pas d'\`outline: none\` ici : c'est ce qui privait le rail, la palette ⌘K
           et la liste de notifications de tout repère de focus clavier. L'anneau
           vient de la règle WCAG d'admin-console.css. */
        .adm-nav { -webkit-tap-highlight-color: transparent; transition: background-color .18s ease; }
        .adm-nav:hover { background: ${crmVoileEncre(dark, 0.05)} !important; }
        /* Champ de recherche du kit (\`AdminSearchInput\`). Ces deux règles ne
           s'expriment pas en style inline ; elles vivaient donc recopiées dans
           chaque écran, sous une classe différente à chaque fois. */
        .adm-search::placeholder { color: ${sp.sub}; font-weight: 500; }
        .adm-search:focus { box-shadow: inset 0 0 0 2px ${sp.accent}; }
        .adm-scroll::-webkit-scrollbar { width: 9px; }
        .adm-scroll::-webkit-scrollbar-thumb { background: ${crmVoileEncre(dark, .12)}; border-radius: 99px; border: 3px solid transparent; background-clip: content-box; }
        /* Le dock d'icônes occupe la gouttière gauche (il porte sa propre
           largeur de 128 px), d'où l'absence de padding-left ici — même
           géométrie que l'écran Réglages du CRM. */
        .adm-body { display: flex; flex: 1; min-height: 0; }
        .adm-shell-main { flex: 1; min-width: 0; min-height: 0; padding: 20px 22px 22px 0; }
        .adm-frame { display: grid; grid-template-columns: ${ADMIN_RAIL_WIDTH}px 1fr; }
        .adm-rail { display: block; }
        .adm-icon-rail { display: block; }
        .adm-mobile-header { display: none; }
        @media (max-width: 1023px) {
          .adm-shell-main { padding: 0; }
          .adm-frame { grid-template-columns: 1fr; border-radius: 0 !important; border: 0 !important; box-shadow: none !important; }
          .adm-rail { display: none; }
          /* Sous lg la navigation passe par le tiroir : deux rails empilés
             mangeraient la largeur utile. */
          .adm-icon-rail { display: none; }
          .adm-mobile-header { display: flex; }
        }
      `}</style>

      {/* Barre mobile — le rail devient un tiroir sous lg */}
      <header
        className="adm-mobile-header"
        style={{
          height: 56, flexShrink: 0, alignItems: 'center', gap: 'var(--crm-space-xl)', padding: '0 var(--crm-space-2xl)',
          background: surf.card, boxShadow: sp.shadowSm,
        }}
      >
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label={t('common:nav.expandSidebar')}
          style={{ width: 36, height: 36, borderRadius: ADMIN_RADII.row, border: 0, background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
        >
          <MEIcon name="menu" size={19} color={sp.soft} />
        </button>
        <Link to={ADMIN_CONSOLE_PATH} style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: VIOLET_CONSOLE, textDecoration: 'none' }}>
          {t('admin:common.adminBadge')}
        </Link>
      </header>

      {drawerOpen && (
        <>
          <div
            onClick={() => setDrawerOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 40, background: dark ? 'rgba(0,0,4,.68)' : 'rgba(14,20,16,.42)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
          />
          <aside
            className="adm-scroll"
            style={{
              position: 'fixed', top: 0, bottom: 0, left: 0, width: ADMIN_RAIL_WIDTH, zIndex: 50,
              background: sp.pageBg, boxShadow: sp.shadow, overflowY: 'auto',
            }}
          >
            <ShellNav onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </>
      )}

      <div className="adm-body">
        {/* Le MÊME rail que les 15 surfaces Sugar du CRM — pas une copie. C'est
            lui qui fait qu'on ne « change pas de site » en ouvrant la console.
            Aucun écran CRM n'étant actif ici, `active` ne matche rien : aucun
            bouton n'est allumé à tort. */}
        <div className="adm-icon-rail">
          <CrmIconRail
            active="admin"
            items={railItems}
            onNavigate={onRailNavigate}
            dark={dark}
            setDark={toggle}
            sp={sp}
          />
        </div>

        <main className="adm-shell-main">
          <div
            className="adm-frame"
            style={{
              position: 'relative', height: '100%', borderRadius: ADMIN_RADII.frame, overflow: 'hidden',
              border: `1px solid ${sp.frameBorder}`, boxShadow: sp.shadow, background: sp.pageBg,
            }}
          >
            <aside className="adm-rail adm-scroll" style={{ minHeight: 0, overflowY: 'auto' }}>
              <ShellNav />
            </aside>

            <div className="adm-scroll" style={{ minWidth: 0, minHeight: 0, overflowY: 'auto' }}>
              <Outlet />
            </div>
          </div>
        </main>
      </div>

      <AdminSearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
