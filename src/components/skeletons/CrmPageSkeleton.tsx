/**
 * Écran d'attente des surfaces CRM (`/dashboard/*` hors routes AgentLayout).
 *
 * Il remplace `DashboardSkeleton` sur ces routes, qui dessinait un chrome
 * disparu — sidebar de 240 px, barre de titre, cartes KPI — aux tokens `theme-*`
 * de l'app. Deux écarts en découlaient : la géométrie ne correspondait à aucune
 * page réelle, et la couleur venait de `--color-bg-page` (#FFFFFF en clair) au
 * lieu de la palette du CRM — donc un plein écran blanc entre deux pages noires
 * pour un agent en mode sombre.
 *
 * D'où les deux règles de ce composant :
 *   1. la couleur vient de la MÊME préférence que les pages (`readCrmDark`), pas
 *      de `data-theme` — les deux systèmes ne sont pas synchronisés ;
 *   2. la géométrie décalque le chrome réel, pour que la bascule squelette →
 *      page ne déplace rien.
 *
 * ⚠ REDESSINÉ le 4 septembre 2026 : le chrome décalqué n'existe plus. Ce n'était
 * pas une barre du haut de 82 px plus un rail de 128 px, mais UNE barre latérale
 * (`CrmSidebar.tsx`) de 264 px — 84 repliée. Les nombres ci-dessous sont donc
 * relus de là, pas de mémoire : mêmes marges, même rayon, mêmes hauteurs de
 * ligne. Un squelette qui décalque le chrome d'hier fait sauter la page au
 * moment précis où elle apparaît.
 *
 * ⚠ Le repli est LU, pas supposé, et il se lit COMME dans la barre —
 * `isMobile || readCrmSidebarCollapsed()`. Le seul réglage stocké ne suffit pas :
 * trois routes de bureau rendent à 375 px sans variante mobile, où la barre se
 * replie d'office. Un agent qui travaille barre repliée verrait sinon 264 px de
 * squelette se rétracter à 84 px sous ses yeux à chaque chargement.
 *
 * Il ne préfigure PAS le contenu (chaque page a le sien) — seulement le cadre,
 * qui est commun.
 */
import { readCrmDark } from '@/lib/crmDark'
import { readCrmSidebarCollapsed } from '@/lib/crmSidebar'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { crmPalette } from '@/components/crm/tokens'

/**
 * La nav en QUATRE groupes libellés (2 · 3 · 3 · 2), puis un cinquième pour les
 * outils (recherche, relances, import, aide + MEGGA AI). Les notifications sont
 * dans le PIED, avec le compte.
 *
 * ⚠ Le squelette dessine aussi les SUR-TITRES : cinq libellés valent ~90 px, et
 * les omettre ferait remonter toute la liste de ~90 px à la bascule — le saut
 * exact que ce composant existe pour empêcher.
 */
const NAV_GROUPS = [2, 3, 3, 2]
const TOOL_ROWS = 5

export default function CrmPageSkeleton() {
  const dark = readCrmDark()
  // ⚠ La MÊME expression que la barre (`isMobile || stored`) et le MÊME hook de
  // media query : lire le seul réglage stocké faisait dessiner 264 px sur les
  // trois routes de bureau qui rendent à 375 px, puis la vraie barre arrivait à
  // 84 px — un saut à la bascule, exactement ce que ce squelette existe pour
  // empêcher.
  const isMobile = useIsMobile()
  const collapsed = isMobile || readCrmSidebarCollapsed()
  const sp = crmPalette(dark)

  /** Une ligne de nav : le glyphe seul quand la barre est repliée, sinon la
   *  rangée pleine largeur. */
  const row = (key: number) => (
    <div
      key={key}
      style={{
        // ⚠ 37 dépliée, 34 repliée — MESURÉ sur la vraie ligne, pas déduit de son
        // padding : dépliée, la hauteur est portée par la boîte de ligne du
        // libellé (14 px × 1.5 de la préflight Tailwind = 21) et non par le
        // glyphe de 18. Un gabarit à 34 dans les deux états faisait sauter la
        // liste de 30 px à la bascule.
        height: collapsed ? 34 : 37, borderRadius: 'var(--crm-radius-xl)',
        background: sp.iconBtnBg,
        // Repliée, la ligne se réduit au carré du glyphe et se centre —
        // c'est ce que fait la vraie ligne (`justifyContent: center`).
        width: collapsed ? 34 : '100%',
        alignSelf: collapsed ? 'center' : 'stretch',
      }}
    />
  )

  return (
    <div
      className="megga-fallback"
      role="status"
      aria-label="Chargement"
      style={{ background: sp.pageBg, minHeight: '100vh', display: 'flex' }}
    >
      {/* Gabarit CrmSidebar — mêmes largeurs, marges, rayon et hauteur que la
          carte réelle (CrmSidebar.tsx, bloc <aside>). */}
      <aside
        style={{
          width: collapsed ? 84 : 264, flexShrink: 0,
          height: 'calc(100vh - 34px)',
          margin: 'var(--crm-space-lg) 0 0 var(--crm-space-lg)',
          background: sp.frameBg,
          border: `1px solid ${sp.frameBorder}`,
          borderRadius: 'var(--crm-radius-6xl)',
          boxShadow: sp.shadow,
          padding: 'var(--crm-space-4xl) var(--crm-space-2xl)',
          display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4xl)',
        }}
      >
        {/* Identité d'agence — pas de wordmark au-dessus, la vraie barre n'en a plus */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: 'var(--crm-space-sm)',
        }}>
          <div style={{ width: 40, height: 40, borderRadius: 'var(--crm-radius-pill)', background: sp.iconBtnBg, flexShrink: 0 }} />
          {!collapsed && <div style={{ flex: 1, height: 26, borderRadius: 'var(--crm-radius-sm)', background: sp.iconBtnBg }} />}
        </div>

        {/* Nav : quatre groupes de pages puis les outils, chacun sous son sur-titre */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {[...NAV_GROUPS, TOOL_ROWS].map((n, g) => (
            <div key={g}>
              {/* Sur-titre : un trait de 12 px déplié, un filet quand la barre est
                  repliée — et rien au-dessus du premier groupe, comme la vraie barre. */}
              {collapsed
                ? (g > 0 && <div style={{ height: 1, background: sp.frameBorder, margin: 'var(--crm-space-sm) var(--crm-space-lg) var(--crm-space-xs)' }} />)
                : <div style={{ height: 12, width: 76, borderRadius: 'var(--crm-radius-xs)', background: sp.iconBtnBg, margin: 'var(--crm-space-xs) var(--crm-space-2xl) var(--crm-space-2xs)' }} />}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)' }}>
                {Array.from({ length: n }).map((_, i) => row(g * 100 + i))}
              </div>
            </div>
          ))}
        </div>

        {/* Pied : notifications + encart de synthèse + compte */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)' }}>
          {row(999)}
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

      {/* La colonne de travail : bande d'onglets PUIS surface. Les insets
          répondent EXACTEMENT à ceux des <main> réels — 12 px à gauche et en
          haut, 24 à droite, 22 en bas — pour que le cadre ne bouge pas d'un
          pixel à la bascule squelette → page.

          ⚠ La bande d'onglets DOIT être dessinée ici, et pas seulement la
          surface : `CrmWorkspace` lui prend 48 px (36 de puce + 12 de gouttière)
          en tête de colonne. Un squelette qui ne montrerait que le cadre le
          ferait sauter de 48 px à chaque bascule — le saut exact que ce
          composant existe pour empêcher. */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          flexShrink: 0, display: 'flex', alignItems: 'center',
          gap: 'var(--crm-space-2xs)',
          padding: 'var(--crm-space-lg) var(--crm-space-lg) 0',
        }}>
          {/* Deux puces muettes : une pile fraîche en porte au moins une, et une
              seule barre grise se lirait comme un titre, pas comme des onglets. */}
          <div style={{ width: 128, height: 36, borderRadius: 'var(--crm-radius-pill)', background: sp.iconBtnBg }} />
          <div style={{ width: 96, height: 36, borderRadius: 'var(--crm-radius-pill)', background: sp.iconBtnBg, opacity: 0.55 }} />
          <div style={{ width: 30, height: 30, borderRadius: 'var(--crm-radius-pill)', background: sp.iconBtnBg, opacity: 0.4 }} />
        </div>
        <div
          style={{
            flex: 1, minHeight: 0,
            margin: 'var(--crm-space-lg) 24px 22px var(--crm-space-lg)',
            borderRadius: 26,
            border: `1px solid ${sp.frameBorder}`,
            background: sp.cardBg,
            boxShadow: sp.shadow,
          }}
        />
      </div>
    </div>
  )
}
