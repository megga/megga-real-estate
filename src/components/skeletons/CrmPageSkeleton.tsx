/**
 * Écran d'attente des surfaces CRM (`/dashboard/*`).
 *
 * Il remplace `DashboardSkeleton` sur ces routes, qui dessinait un chrome
 * disparu — sidebar de 240 px, barre de titre, cartes KPI — aux tokens `theme-*`
 * de l'app. Deux écarts en découlaient : la géométrie ne correspondait à aucune
 * page réelle, et la couleur venait de `--color-bg-page` (#FFFFFF en clair) au
 * lieu de la palette du CRM — donc un plein écran blanc entre deux pages noires
 * pour un agent en mode sombre.
 *
 * D'où les deux règles de ce composant :
 *   1. la couleur vient de la MÊME préférence que les pages (`useCrmDark`), pas
 *      de `data-theme` — les deux systèmes ne sont pas synchronisés ;
 *   2. la géométrie décalque le chrome réel, pour que la bascule squelette →
 *      page ne déplace rien.
 *
 * ⚠ REDESSINÉ le 7 septembre 2026, avec la coquille (`CrmWorkspace`) : la bande
 * d'onglets est passée PLEINE LARGEUR, au-dessus de la barre latérale ET du
 * contenu, et la barre a perdu ses sur-titres de groupe. Le squelette dessinait
 * encore l'état d'avant — bande dans la seule colonne de droite, cinq sur-titres,
 * une ligne de notifications dans le pied : la liste sautait de ~90 px à la
 * bascule et la carte latérale de 42. Les nombres ci-dessous sont relus du code
 * (`CrmWorkspace`, `CrmSidebar`, `CrmTabsBar`), pas de mémoire.
 *
 * ⚠ Le repli se lit par `useCrmSidebarRepli`, la MÊME règle que la barre : le
 * réglage stocké seul ne suffit pas (le téléphone et le dock MEGGA AI sur écran
 * étroit le forcent), et un squelette de 264 px qui se rétracte à 84 sous les
 * yeux de l'agent est le saut que ce composant existe pour empêcher.
 *
 * Il ne préfigure PAS le contenu (chaque page a le sien) — seulement le cadre,
 * qui est commun.
 */
import { useLocation } from 'react-router-dom'
import { useCrmDark } from '@/lib/crmDark'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useCrmSidebarRepli } from '@/hooks/useCrmSidebarRepli'
import { crmTabsEligible } from '@/lib/crmTabs'
import { CRM_SIDEBAR_GROUPS } from '@/components/crm/crmSidebarNav'
import { crmPalette } from '@/components/crm/tokens'

/** Hauteur de la bande, gouttière haute comprise — `H_BANDE` de `CrmWorkspace`. */
const H_BANDE = 42

/**
 * Lignes d'outils sous les pages : relances, import, aide. « Créer » s'y ajoute
 * quand l'écran fournit un geste de création — sous la liste, donc sans rien
 * déplacer au-dessus.
 */
const TOOL_ROWS = 3

export default function CrmPageSkeleton() {
  const dark = useCrmDark()
  const { pathname } = useLocation()
  const isMobile = useIsMobile()
  const { replie: collapsed } = useCrmSidebarRepli()
  const sp = crmPalette(dark)

  // ⚠ La bande suit la règle de `CrmWorkspace` (fournisseur d'onglets ET pas de
  // téléphone), lue sur le CHEMIN : ce squelette sert aussi de repli à la
  // frontière de `App.tsx`, au-dessus du fournisseur, pendant que le chunk du
  // layout arrive.
  const avecBande = !isMobile && crmTabsEligible(pathname)

  /** Une ligne de nav : le glyphe seul quand la barre est repliée, sinon la
   *  rangée pleine largeur. */
  const row = (key: string) => (
    <div
      key={key}
      style={{
        // ⚠ 37 dépliée, 36 repliée — MESURÉ sur la vraie ligne, pas déduit de son
        // padding : dépliée, la hauteur est portée par la boîte de ligne du
        // libellé (14 px × 1.5 de la préflight Tailwind = 21) et non par le
        // glyphe de 20 ; repliée, c'est le glyphe seul.
        height: collapsed ? 36 : 37, borderRadius: 'var(--crm-radius-xl)',
        background: sp.iconBtnBg,
        // Repliée, la ligne se réduit au carré du glyphe et se centre —
        // c'est ce que fait la vraie ligne (`justifyContent: center`).
        width: collapsed ? 36 : '100%',
        alignSelf: collapsed ? 'center' : 'stretch',
      }}
    />
  )

  /** Filet entre deux groupes, barre repliée seulement — `FiletDeGroupe`. */
  const filet = (key: string) => (
    <div key={key} style={{ height: 1, background: sp.frameBorder, margin: 'var(--crm-space-sm) var(--crm-space-lg) var(--crm-space-xs)' }} />
  )

  const groupes = [...CRM_SIDEBAR_GROUPS.map((g) => g.items.length), TOOL_ROWS]

  return (
    <div
      className="megga-fallback"
      role="status"
      aria-label="Chargement"
      style={{ background: sp.pageBg, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      {/* Gabarit de la bande — pleine largeur, AU-DESSUS de la barre et du
          contenu, mêmes gouttières asymétriques que `CrmWorkspace`. */}
      {avecBande && (
        <div style={{
          flexShrink: 0, height: H_BANDE,
          padding: 'var(--crm-space-lg) var(--crm-space-7xl) 0 var(--crm-space-lg)',
          display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xs)',
        }}>
          {/* Deux puces muettes : une pile fraîche en porte au moins une, et une
              seule barre grise se lirait comme un titre, pas comme des onglets. */}
          <div style={{ width: 128, height: 30, borderRadius: 'var(--crm-radius-pill)', background: sp.iconBtnBg }} />
          <div style={{ width: 96, height: 30, borderRadius: 'var(--crm-radius-pill)', background: sp.iconBtnBg, opacity: 0.55 }} />
          <div style={{ width: 26, height: 26, borderRadius: 'var(--crm-radius-pill)', background: sp.iconBtnBg, opacity: 0.4 }} />
          {/* Le quart droit : notifications, MEGGA AI, thème. */}
          <div style={{ flex: 1 }} />
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: 26, height: 26, borderRadius: 'var(--crm-radius-pill)', background: sp.iconBtnBg, opacity: 0.4 }} />
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, minWidth: 0 }}>
        {/* Gabarit CrmSidebar — mêmes largeurs, marges, rayon et hauteur que la
            carte réelle. ⚠ La hauteur y lit `--crm-chrome-top`, que la coquille
            ACTIVE publie ; pendant ce squelette il n'y en a pas, donc la bande
            est défalquée ici en clair. */}
        <aside
          style={{
            width: collapsed ? 84 : 264, flexShrink: 0,
            height: avecBande
              ? `calc(100vh - ${H_BANDE}px - var(--crm-space-lg) - var(--crm-space-6xl))`
              : 'calc(100vh - var(--crm-space-lg) - var(--crm-space-6xl))',
            margin: 'var(--crm-space-lg) 0 0 var(--crm-space-lg)',
            background: sp.frameBg,
            border: `1px solid ${sp.frameBorder}`,
            borderRadius: 'var(--crm-radius-6xl)',
            boxShadow: sp.shadow,
            padding: 'var(--crm-space-4xl) var(--crm-space-2xl)',
            display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4xl)',
          }}
        >
          {/* Identité d'agence */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: 'var(--crm-space-sm)',
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--crm-radius-pill)', background: sp.iconBtnBg, flexShrink: 0 }} />
            {!collapsed && <div style={{ flex: 1, height: 26, borderRadius: 'var(--crm-radius-sm)', background: sp.iconBtnBg }} />}
          </div>

          {/* Nav : les groupes de `CRM_SIDEBAR_GROUPS`, puis les outils. Aucun
              sur-titre ; repliée, un filet entre deux groupes. */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {groupes.map((n, g) => (
              <div key={g}>
                {collapsed && g > 0 && filet(`f${g}`)}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)' }}>
                  {Array.from({ length: n }).map((_, i) => row(`${g}-${i}`))}
                </div>
              </div>
            ))}
          </div>

          {/* Pied : encart de synthèse + compte. Les notifications n'y sont plus,
              elles vivent dans le quart droit de la bande. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)' }}>
            {collapsed
              ? <div style={{ width: 46, height: 46, borderRadius: 'var(--crm-radius-pill)', background: sp.iconBtnBg, alignSelf: 'center' }} />
              : <div style={{ height: 92, borderRadius: 'var(--crm-radius-4xl)', background: sp.iconBtnBg }} />}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)',
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: 'var(--crm-space-sm)',
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--crm-radius-pill)', background: sp.iconBtnBg, flexShrink: 0 }} />
              {!collapsed && <div style={{ flex: 1, height: 26, borderRadius: 'var(--crm-radius-sm)', background: sp.iconBtnBg }} />}
            </div>
          </div>
        </aside>

        {/* Le cadre de travail. Ses insets répondent EXACTEMENT à ceux des
            <main> réels — 12 px à gauche et en haut, 24 à droite et en bas —
            pour que le cadre ne bouge pas d'un pixel à la bascule. */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              flex: 1, minHeight: 0,
              margin: 'var(--crm-space-lg) var(--crm-space-6xl) var(--crm-space-6xl) var(--crm-space-lg)',
              borderRadius: 26,
              border: `1px solid ${sp.frameBorder}`,
              background: sp.cardBg,
              boxShadow: sp.shadow,
            }}
          />
        </div>
      </div>
    </div>
  )
}
