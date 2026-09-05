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
 * l'alimente directement, sans toucher `useListingsScreen`.
 *
 * ⚠ Le harnais fournit `ThemeProvider`. `WizardShell` reçoit pourtant `dark` en
 * prop — mais il appelle `useTheme()` AVANT de l'appliquer (`darkOverride ??
 * theme === 'dark'`), et un hook ne peut pas être conditionnel : le prop
 * n'exempte donc pas du contexte. Sans lui, ouvrir le wizard depuis ce harnais
 * lève l'ErrorBoundary — mesuré.
 *
 * ⚠ Le chemin ne contient PAS `/dashboard` : le script d'amorçage d'`index.html`
 * ne pose `data-theme="dark"` que si l'URL le contient. Le thème se pilote donc
 * ici, par le bouton de la barre latérale — la page ne dépend pas de l'amorçage.
 *
 * ⛔ Données de DÉMONSTRATION (`CRM_BIENS`). Rien de ce qui s'affiche ici ne
 * vient de la base, et aucune action n'écrit : c'est un banc d'essai visuel,
 * pas un aperçu du portefeuille réel.
 */
import { useMemo, useState } from 'react'
import { crmPalette } from '@/components/crm/tokens'
import { CRM_BIENS } from '@/components/crm/mockData'
import { mxSurfaces } from '@/components/crm/biens/gallery/galHelpers'
import { CRM_KEYFRAMES } from '@/components/crm/CrmShell'
import CrmWorkspace from '@/components/crm/CrmWorkspace'
import { BiensPager } from '@/components/crm/biens/pager/BiensPager'
import WizardShell from '@/components/crm-wizard/WizardShell'
import ListingDetailPage from '@/pages/agent/ListingDetailPage'
import { DEMO_LISTING } from './demoFixtures'
import { ThemeProvider } from '@/hooks/useTheme'
import { readCrmDark } from '@/lib/crmDark'

export default function BiensShowcasePage() {
  // ⚠ Même amorçage que `ListingsPage` : le CRM porte DEUX clés de thème
  // sans lien — `megga-theme` (lue par `useTheme`, donc par `data-theme`) et
  // `megga.sugar.dark` (lue par les surfaces Sugar, basculée par leur rail).
  // Un harnais qui démarre en dur sur `false` rend donc les bentos CLAIRS dans
  // une page dont `data-theme` dit « sombre » : on croit voir une incohérence
  // du wizard alors qu'on regarde un instrument mal réglé. Mesuré : 22 blocs
  // clairs contre 3 sombres.
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return readCrmDark()
  })
  const [wizardOpen, setWizardOpen] = useState(false)
  const [surface, setSurface] = useState<'liste' | 'fiche'>('liste')

  const sp = crmPalette(dark)
  const surf = mxSurfaces(sp)
  const now = useMemo(() => new Date(), [])

  return (
    <ThemeProvider>
    <div style={{
      position: 'relative', background: sp.pageBg, height: '100vh', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      fontFamily: '"Inter Tight", system-ui, sans-serif', color: sp.ink,
    }}>
      <style>{CRM_KEYFRAMES}</style>

      <div style={{
        position: 'fixed', bottom: 14, left: 14, zIndex: 9500,
        padding: 'var(--crm-space-sm) var(--crm-space-xl)',
        borderRadius: 'var(--crm-radius-pill)', background: sp.accent, color: sp.accentInk,
        fontSize: 'var(--crm-text-sm)', fontWeight: 600, pointerEvents: 'none',
      }}>
        Aperçu · données de démonstration
      </div>

      <div style={{
        position: 'fixed', bottom: 14, right: 14, zIndex: 9500, display: 'inline-flex',
        background: sp.cardBg, borderRadius: 'var(--crm-radius-pill)',
        padding: 'var(--crm-space-2xs)', gap: 'var(--crm-space-2xs)',
        border: `1px solid ${sp.cardBorder}`,
      }}>
        {(['liste', 'fiche'] as const).map((s2) => (
          <button key={s2} type="button" onClick={() => setSurface(s2)} aria-pressed={surface === s2}
            style={{
              border: 0, cursor: 'pointer', fontFamily: 'inherit',
              padding: 'var(--crm-space-xs) var(--crm-space-2xl)',
              borderRadius: 'var(--crm-radius-pill)',
              fontSize: 'var(--crm-text-md)', fontWeight: 600,
              background: surface === s2 ? sp.accent : 'transparent',
              color: surface === s2 ? sp.accentInk : sp.sub,
            }}>{s2 === 'liste' ? 'Liste' : 'Fiche'}</button>
        ))}
      </div>

      {/* ⚠ La FICHE monte sa propre barre latérale : c'est une page complète,
          pas un panneau. La coiffer du chrome du harnais afficherait DEUX
          barres côte à côte. Elle remplace donc tout, et le harnais ne garde
          que sa pastille et son sélecteur. */}
      {surface === 'fiche' ? (
        <ListingDetailPage demoData={DEMO_LISTING} />
      ) : (
        <>
          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            {/* `active` est explicite : `/dev/biens` ne dit pas l'écran, la barre ne
                peut donc pas le déduire de la route. Son geste « Créer » est ici le
                wizard, comme sur l'écran réel. ⚠ Ses AUTRES lignes mènent aux
                surfaces protégées : la barre se tait d'elle-même sous `/dev/*`
                (cf. sa garde `enBanc`), sans quoi un clic ferait rebondir le banc
                vers la production. */}
            <CrmWorkspace
              active="biens" sp={sp} dark={dark} setDark={setDark}
              onCmd={() => setWizardOpen(true)}
            >
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
              onOpenBien={() => setSurface('fiche')}
              onCreate={() => setWizardOpen(true)}
              onResumeDraft={() => {}}
              wizardOpen={wizardOpen}
              wizardSlot={<WizardShell embedded dark={dark} onClose={() => setWizardOpen(false)} />}
            />
            </CrmWorkspace>
          </div>
        </>
      )}
    </div>
    </ThemeProvider>
  )
}
