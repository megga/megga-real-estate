/**
 * Écran d'attente des surfaces CRM Sugar (`/dashboard/*` hors routes AgentLayout).
 *
 * Il remplace `DashboardSkeleton` sur ces routes, qui dessinait un chrome
 * disparu — sidebar de 240 px, barre de titre, cartes KPI — aux tokens `theme-*`
 * de l'app. Deux écarts en découlaient : la géométrie ne correspondait à aucune
 * page réelle (AgentSugarLayout ne rend NI sidebar NI header, les pages portent
 * SugarTopNav + SugarIconRail), et la couleur venait de `--color-bg-page`
 * (#FFFFFF en clair) au lieu de la palette Sugar — donc un plein écran blanc
 * entre deux pages noires pour un agent en mode sombre.
 *
 * D'où les deux règles de ce composant :
 *   1. la couleur vient de `megga.sugar.dark` (la MÊME préférence que les pages
 *      Sugar), pas de `data-theme` — les deux systèmes ne sont pas synchronisés ;
 *   2. la géométrie décalque le chrome réel (SugarShell.tsx / LiquidGlassRail.tsx),
 *      pour que la bascule squelette → page ne déplace rien.
 *
 * Grammaire Sugar Pure : ombre douce, aucune bordure décorative, une seule
 * surface de travail. Il ne préfigure PAS le contenu (chaque page a le sien) —
 * seulement le cadre, qui est commun.
 */
import { readSugarDark } from '@/lib/sugarDark'
import { crmSugarPalette, sugarThemeTokens } from '@/components/crm-sugar/tokens'
import { useDarkTone } from '@/hooks/useDarkTone'

/** Largeurs des 7 onglets, calées sur les libellés FR (Aujourd'hui → Agenda). */
const TAB_WIDTHS = [104, 82, 84, 84, 84, 62, 78]

/** Boutons ronds de la TopNav : recherche · aide · MEGGA AI · cloche · avatar. */
const TOPNAV_ACTIONS = 5

/** Outils du rail : 6 + réglages + bascule sombre (LiquidGlassRail.tsx:320-338). */
const RAIL_ITEMS = 8

export default function SugarPageSkeleton() {
  const dark = readSugarDark()
  const darkTone = useDarkTone()
  const sp = crmSugarPalette(sugarThemeTokens(dark, darkTone), dark, darkTone)

  return (
    <div
      className="megga-fallback"
      role="status"
      aria-label="Chargement"
      style={{ background: sp.pageBg, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      {/* Gabarit SugarTopNav — SugarShell.tsx (padding + gap identiques). L'inset
          droit suit celui du chrome réel : le désaligner ferait sauter les boutons
          ronds de 16 px à la bascule squelette → page. */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '24px 24px 14px 33px', gap: 24 }}>
        <div style={{ width: 62, height: 38, borderRadius: 10, background: sp.iconBtnBg, flexShrink: 0 }} />
        <div style={{ display: 'flex', gap: 4, flex: 1, justifyContent: 'center' }}>
          {TAB_WIDTHS.map((w, i) => (
            <div key={i} style={{ width: w, height: 38, borderRadius: 999, background: sp.iconBtnBg }} />
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {Array.from({ length: TOPNAV_ACTIONS }).map((_, i) => (
            <div key={i} style={{ width: 44, height: 44, borderRadius: 999, background: sp.iconBtnBg }} />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Gabarit SugarIconRail — aside 128 px, capsule r34 (LiquidGlassRail.tsx:361-377). */}
        <aside
          style={{
            width: 128,
            flexShrink: 0,
            padding: '96px 0 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              borderRadius: 34,
              padding: '14px 10px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              background: sp.frameBg,
              boxShadow: sp.shadow,
            }}
          >
            {Array.from({ length: RAIL_ITEMS }).map((_, i) => (
              <div key={i} style={{ width: 46, height: 46, borderRadius: 999, background: sp.iconBtnBg }} />
            ))}
          </div>
        </aside>

        {/* Surface de travail unique — ombre douce, aucune bordure décorative.
            Inset droit 24 px = `paddingRight` des <main> Sugar, pour que le bord
            droit ne bouge pas non plus à la bascule squelette → page. */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            margin: '24px 24px 32px 0',
            borderRadius: 26,
            background: sp.cardBg,
            boxShadow: sp.shadow,
          }}
        />
      </div>
    </div>
  )
}
