/**
 * Harnais d'aperçu de « Mes biens » — `/dev/biens`, sans session.
 *
 * POURQUOI CETTE ROUTE EXISTE. Toute surface `/dashboard/*` passe par
 * `ProtectedRoute`, qui sans session fait
 * `window.location.replace('https://megga.ch/login')` — une redirection ABSOLUE
 * vers la production. Un développeur dont la session locale a expiré est donc
 * expulsé de son propre localhost vers `app.megga.ch`, qui sert `main` : il
 * relit l'ancienne version en croyant regarder son travail. Le piège coûte
 * cher parce qu'il ne ressemble pas à une erreur.
 *
 * Injecter une session dans `localStorage` NE règle rien (mesuré : l'app rend
 * une coquille et n'émet aucun appel Supabase). Le seul chemin qui marche est
 * une route publique montant les composants avec des données de démonstration —
 * c'est déjà l'idiome de `/dev/mobile`, permanent lui aussi.
 *
 * ⚠ Aucun échafaudage n'entre dans le code de production : `BiensPager` est
 * purement présentationnel (il reçoit `biens` en prop), donc ce harnais
 * l'alimente directement, sans toucher `useBiensSugar`.
 *
 * ⚠ Le harnais fournit `ThemeProvider`. `WizardShell` reçoit pourtant `dark` en
 * prop — mais il appelle `useTheme()` AVANT de l'appliquer (`darkOverride ??
 * theme === 'dark'`), et un hook ne peut pas être conditionnel : le prop
 * n'exempte donc pas du contexte. Sans lui, ouvrir le wizard depuis ce harnais
 * lève l'ErrorBoundary — mesuré.
 *
 * ⚠ Le chemin ne contient PAS `/dashboard` : le script d'amorçage d'`index.html`
 * ne pose `data-theme="dark"` que si l'URL le contient. Le thème se pilote donc
 * ici, par le bouton du rail — la page ne dépend pas de l'amorçage.
 *
 * ⛔ Données de DÉMONSTRATION (`CRM_BIENS`). Rien de ce qui s'affiche ici ne
 * vient de la base, et aucune action n'écrit : c'est un banc d'essai visuel,
 * pas un aperçu du portefeuille réel.
 */
import { useMemo, useState } from 'react'
import { crmSugarPalette } from '@/components/crm-sugar/tokens'
import { CRM_BIENS } from '@/components/crm-sugar/mockData'
import { mxSurfaces } from '@/components/crm-sugar/biens/gallery/galHelpers'
import { SugarTopNav, SugarIconRail, SUGAR_KEYFRAMES, type SugarScreenId } from '@/components/crm-sugar/SugarShell'
import { BiensPager } from '@/components/crm-sugar/biens/pager/BiensPager'
import WizardShell from '@/components/crm-sugar-wizard/WizardShell'
import { ThemeProvider } from '@/hooks/useTheme'

export default function BiensShowcasePage() {
  const [dark, setDark] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)

  const sp = crmSugarPalette(dark)
  const surf = mxSurfaces(sp)
  const now = useMemo(() => new Date(), [])

  // Le harnais ne navigue nulle part : chaque cible mènerait à une surface
  // protégée, donc au rebond vers la production que cette page existe pour
  // éviter. Seuls le thème et l'ouverture du wizard agissent.
  const onNavigate = (id: SugarScreenId | string) => {
    if (id === 'biens-new') setWizardOpen(true)
  }

  return (
    <ThemeProvider>
    <div style={{
      position: 'relative', background: sp.pageBg, height: '100vh', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      fontFamily: '"Inter Tight", system-ui, sans-serif', color: sp.ink,
    }}>
      <style>{SUGAR_KEYFRAMES}</style>

      <div style={{
        position: 'fixed', bottom: 14, left: 14, zIndex: 9500,
        padding: 'var(--crm-space-sm) var(--crm-space-xl)',
        borderRadius: 'var(--crm-radius-pill)', background: sp.accent, color: sp.accentInk,
        fontSize: 'var(--crm-text-sm)', fontWeight: 600, pointerEvents: 'none',
      }}>
        Aperçu · données de démonstration
      </div>

      <SugarTopNav active="biens" sp={sp} onNavigate={onNavigate} dark={dark} />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <SugarIconRail active="biens" onNavigate={onNavigate} onCmd={() => {}} dark={dark} setDark={setDark} sp={sp} />
        <BiensPager
          biens={CRM_BIENS}
          sp={sp}
          surf={surf}
          dark={dark}
          now={now}
          fresh={false}
          isLoading={false}
          isError={false}
          refetch={() => {}}
          idxEnabled={false}
          onOpenBien={() => {}}
          onCreate={() => setWizardOpen(true)}
          onResumeDraft={() => {}}
          wizardOpen={wizardOpen}
          wizardSlot={<WizardShell embedded dark={dark} onClose={() => setWizardOpen(false)} />}
        />
      </div>
    </div>
    </ThemeProvider>
  )
}
