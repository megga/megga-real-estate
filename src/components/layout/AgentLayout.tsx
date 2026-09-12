/**
 * Layout des pages CRM Sugar v2 (route parente des surfaces agent). Volontairement
 * dépouillé : ni sidebar, ni breadcrumb, ni bottom bar — les pages Sugar portent
 * leur propre chrome. Fournit thème + contexte copilote, la bannière
 * d'impersonation, la poussée publiée quand le panneau MEGGA AI est ouvert (ce
 * sont les écrans qui la prennent — `usePousseeDock`),
 * et le gate identité légale (étape 2 KYB) qui redirige vers /dashboard/identite
 * tant que le dirigeant n'a pas soumis l'identité de son agence.
 *
 * Ne porte PLUS le bandeau du garde LAB depuis le 04.08.2026 : il est monté dans
 * IdentityShell, dans la coquille MEGGA X (cf. son en-tête).
 */
import { useState, useEffect, useMemo, memo, Suspense } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Routes, Navigate, useLocation } from 'react-router-dom'
import { ThemeProvider } from '@/hooks/useTheme'
import { CopilotContextProvider } from '@/hooks/useCopilotContext'
import { useAiPanel } from '@/hooks/useAiPanel'
import { COPILOT_WIDTH, DOCK_PUSH_VAR } from '@/components/ai-copilot/panel/aiPanel'
import { EcranPousse } from '@/components/layout/EcranPousse'
import { crmPalette } from '@/components/crm/tokens'
import ImpersonateBanner from '@/components/admin/ImpersonateBanner'
import BootSplash from '@/components/layout/BootSplash'
import SmartPageLoader from '@/components/skeletons/SmartPageLoader'
import { EcranActifProvider } from '@/hooks/useEcranActif'
import OnboardingCallBanner from '@/components/layout/OnboardingCallBanner'
import CrmSearchHost from '@/components/crm/search/CrmSearchHost'
import { useAgentNotificationsRealtime } from '@/hooks/useAgentNotifications'
import { CrmTabsProvider } from '@/components/crm/CrmTabsProvider'
import { useIdentityGate, shouldRedirectToIdentityGate, shouldHoldForIdentityGate, IDENTITY_GATE_ROUTE } from '@/hooks/useIdentityGate'
import { useCrmDark } from '@/lib/crmDark'
import { useCrmTabsOptionnel } from '@/hooks/useCrmTabs'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { crmEcransVivants, crmEcranVisible, crmPousserRecent, type CrmTab } from '@/lib/crmTabs'
import { IsRestoringProvider } from '@tanstack/react-query'
import { OngletEcranCtx } from '@/hooks/useCrmTabs'

/**
 * AgentLayout — barebones wrapper for Sugar v2 CRM pages.
 *
 * Unlike AgentLayout, it does NOT render a sidebar, breadcrumb, mobile header
 * or bottom tab bar. The Sugar pages provide their own chrome
 * (CrmSidebar — one collapsible left column carrying pages, tools and account).
 *
 * Kept utilities:
 *  - ThemeProvider (so toggling clair/sombre stays in sync with the rest of
 *    the app's CSS variables, even though Sugar uses its own tokens)
 *  - CopilotContextProvider (kept for cross-page MEGGA AI context)
 *  - La poussée du panneau MEGGA AI, publiée en `--crm-dock-push` (le panneau
 *    lui-même est monté dans App.tsx, au-dessus de <Routes>, pour persister à la
 *    nav) ; chaque écran la prend lui-même ou la laisse à son plan de travail
 *  - ImpersonateBanner (super-admin must always see they are impersonating)
 *  - Identity gate (useIdentityGate) — swaps <Outlet/> for a <Navigate> to
 *    /dashboard/identite while status === 'required'. Never redirects on an
 *    unresolved ('loading') status, and never redirects the identity route
 *    to itself (shouldRedirectToIdentityGate) — see the P0 incident notes on
 *    the gate call below.
 */

/**
 * Combien d'écrans restent VIVANTS derrière l'onglet affiché.
 *
 * ⛔ POURQUOI PAS TOUS. Un écran vivant garde ses abonnements Realtime, ses
 * requêtes et ses minuteries : vingt-quatre onglets vivants, c'est vingt-quatre
 * fois ça, et le plafond de la pile est justement de 24.
 *
 * ── DE TROIS À SIX (7 septembre 2026, décision Julien) ───────────────────────
 * Trois couvrait le geste dominant — l'aller-retour entre deux onglets, plus un
 * pour le détour. Ça ne couvre PAS le régime réel : Julien travaille à dix ou
 * quinze onglets ouverts, et à quatorze onglets **seuls 2 des 13 autres sont
 * vivants**. ~85 % des bascules RECONSTRUISAIENT donc l'écran — état local perdu
 * (`useTabScopedState` ne porte que 14 des ~38 positions d'écran), requêtes
 * rejouées, chrome remonté. Le mécanisme d'écrans vivants ne servait qu'une
 * bascule sur sept. À six, cinq des treize sont vivants : la part des bascules
 * qui reconstruisent tombe de ~85 % à ~62 %, et l'aller-retour dans un groupe de
 * travail de cinq ou six onglets — le geste réel — cesse d'en payer une seule.
 *
 * ⛔ CE CALCUL NE VALAIT RIEN EN PRODUCTION JUSQU'AU 12 SEPTEMBRE 2026 : la page
 * d'ARRIVÉE de chaque bascule y était détruite puis reconstruite, quel que soit ce
 * nombre (voir `crmEcranVisible`). Les « 1 reconstruction sur 24 » mesurées le 7
 * l'avaient été sur le banc, dont le routeur ne portait pas le drapeau de l'app.
 *
 * ⚠ CE QUE COÛTENT SIX ÉCRANS, ET CE QUI LE BORNE :
 *   • les écrans cachés sont retirés de React Query (`IsRestoringProvider`,
 *     ci-dessous) : ni rafraîchissement au retour sur la page, ni à la reconnexion,
 *     ni rendu sur une donnée qui change — et un rafraîchissement dès qu'ils sont
 *     montrés, si leur donnée est périmée ;
 *   • la cloche n'ouvre qu'UN canal Realtime pour toute la coquille
 *     (`AgentNotificationsRealtime`), pas un par bande ;
 *   • ⚠ `memo` n'épargne PAS le sous-arbre d'un écran caché : ses consommateurs du
 *     routeur et du contexte d'onglets se re-rendent quand ces contextes changent.
 *     Ce qu'il épargne, c'est le corps d'`EcranVivant` lui-même ;
 *   • la mise en page des écrans cachés reste calculée (`visibility: hidden`, voir
 *     `EcranVivant`) — c'est le prix de mesures justes au moment où ils
 *     réapparaissent.
 *
 * ⚠ UN sur mobile. Le CRM mobile n'a pas de bande d'onglets (sa pilule à cinq
 * destinations en tient lieu) : garder des écrans vivants n'y sert personne et
 * coûte la mémoire d'un téléphone.
 */
const VIVANTS_MAX = 6

/**
 * L'emplacement STOCKÉ d'un onglet, tel que le rend un écran qui n'est pas montré.
 *
 * ⚠ Lu champ par champ, et non en recoupant `crmTabHref(tb)` sur « ? » comme au
 * premier jet : un second « ? » dans la query y aurait été tronqué.
 */
function localisationDe(tb: CrmTab): { pathname: string; search: string; hash: string; state: unknown } {
  return { pathname: tb.path, search: tb.search || '', hash: '', state: null }
}

/**
 * Un écran d'onglet — visible, ou vivant mais retiré de la vue.
 *
 * ⚠ `visibility: hidden` et NON `display: none`, et c'est mesuré, pas
 * stylistique : un écran en `display: none` n'a plus de boîte, donc toutes les
 * mesures qu'il prend valent zéro. La bande d'onglets et les six pagers du CRM
 * se dimensionnent au `ResizeObserver` — ils reviendraient à un créneau, puis se
 * recorrigeraient une frame après l'affichage. C'est très exactement le
 * clignotement qu'on cherche à retirer. En `visibility: hidden` la mise en page
 * continue, les mesures restent justes, et rien n'est peint.
 *
 * ⚠ ET `visibility: hidden` SUFFIT à sortir l'écran du clavier et du curseur —
 * vérifié plutôt que supposé : `focus()` sur un bouton d'un écran caché laisse
 * `document.activeElement` sur `<body>`. `inert` avait été posé en ceinture ; il
 * a été retiré parce que React 18 ne le rend pas (l'attribut n'apparaissait pas
 * dans le DOM), et qu'un garde-fou qui ne s'applique pas est pire qu'aucun : il
 * se lit comme une protection. `aria-hidden` couvre l'arbre d'accessibilité.
 */
const EcranVivant = memo(function EcranVivant({ actif, id, pathname, search, hash, state, routes }: {
  /** L'écran est-il MONTRÉ (et non : son onglet est-il l'actif) — voir `crmEcranVisible`. */
  actif: boolean
  id: string
  pathname: string
  search: string
  hash: string
  /**
   * Le `state` de la navigation — transmis à l'écran montré, `null` aux autres.
   *
   * ⛔ IL ÉTAIT FORCÉ À `null` POUR TOUS, et un parcours en dépendait : l'accueil
   * KYC fait `navigate('/dashboard/kyc', { state: { openWizard } })`, et `KycPage`
   * n'ouvrait jamais le wizard « Créer / Importer » — le drapeau d'accueil posé,
   * l'agent ne revoyait plus l'accueil non plus. Sa référence est stable pour une
   * même entrée d'historique : `memo` la compare sans surcoût.
   */
  state: unknown
  routes: ReactNode
}) {
  /**
   * ⛔ L'OBJET DE LOCALISATION DOIT GARDER SON IDENTITÉ D'UN RENDU À L'AUTRE.
   *
   * `localisationDe` fabrique un objet neuf à chaque rendu, et `<Routes location=…>`
   * s'en sert pour re-matcher : sans mémoïsation, chaque rendu du parent relance
   * le calcul de route de TROIS écrans. Ce n'est pas ce qui cassait l'état (voir
   * l'ordre de rendu ci-dessous), mais c'est du travail rendu pour rien à chaque
   * frappe au clavier de l'écran actif.
   *
   * ⚠ Les props sont des primitives pour que `memo` compare quelque chose : un
   * objet refabriqué à chaque rendu du parent échouerait toujours la comparaison.
   * ⚠ Ce que `memo` épargne n'est que le corps de ce composant : `<Routes>` lit le
   * contexte du routeur, et les pages le contexte d'onglets — leurs consommateurs
   * se re-rendent quand ces contextes changent, `memo` ou pas.
   */
  const loc = useMemo(
    () => ({ pathname, search, hash, state, key: id }),
    [pathname, search, hash, state, id],
  )
  const style: CSSProperties = actif
    ? { position: 'relative' }
    : { position: 'absolute', inset: 0, visibility: 'hidden', pointerEvents: 'none', overflow: 'hidden' }
  // ⚠ Chaque écran vivant est un `EcranPousse` : c'est LUI qui se comprime quand
  // la page n'a pas de plan de travail pour le faire (voir `usePousseeDock`).
  return (
    <EcranPousse
      data-onglet={id}
      aria-hidden={actif ? undefined : true}
      style={style}
    >
      {/* ⛔ UNE FRONTIÈRE SUSPENSE PAR ÉCRAN, et c'est la pièce sans laquelle tout
          le reste ne sert à rien. Mesuré le 7 septembre 2026 : les trois écrans
          partageaient celle d'`App.tsx`. Ouvrir un onglet sur un écran dont le
          chunk n'était pas encore chargé le faisait SUSPENDRE — et React masque
          alors TOUS les enfants de la frontière, en DÉTRUISANT leurs effets, puis
          les recrée à la levée. L'état survivait, mais les effets d'initialisation
          repassaient : le mini-mois du calendrier, réglé sur Octobre, était
          RÉÉCRIT à Septembre par son propre effet de resynchronisation. Un écran
          vivant dont les effets se rejouent n'est pas vivant.

          Chacun la sienne : un chunk qui arrive ne concerne que son écran.
          ⚠ Fallback `null` quand l'écran est caché — y peindre un squelette
          invisible n'apporte rien et ferait clignoter la mise en page au moment
          où il redevient visible. */}
      {/* ⚠ Les écrans cachés déclarent qu'ils ne sont PAS regardés : leur chrome
          (bande d'onglets, barre latérale) cesse alors d'écouter le clavier.
          Sans ça, une frappe `Alt+1` partait trois fois — une par écran vivant —
          et poussait trois entrées d'historique pour un seul geste. */}
      {/* ⛔ UN ÉCRAN CACHÉ EST RETIRÉ DE REACT QUERY — c'est la garde de
          `refetchOnWindowFocus` demandée par Julien le 7 septembre 2026, refaite
          le 12. Au retour sur la page, TOUTES les requêtes montées repartaient,
          celles des écrans que personne ne regarde comprises.

          `useBaseQuery` n'abonne son observateur que si `!isRestoring` : sous
          `IsRestoringProvider value`, les requêtes d'un écran caché cessent
          d'observer la donnée — ni rafraîchissement au focus ni à la reconnexion,
          ni rendu quand elle change. Montré, l'écran se réabonne, et `onSubscribe`
          relance ce qui est périmé : il rattrape en arrivant, pas avant.

          ⛔ Premier jet : un SECOND QueryClient sur le même cache pour les écrans
          cachés. Trois défauts, tous mesurés : il ne rafraîchissait rien au
          dévoilement (`setOptions` ne relance que sur un changement de requête),
          il laissait passer la reconnexion (`refetchOnReconnect` copié), et
          changer de client à chaque bascule rejouait les effets Realtime qui le
          portent en dépendance — un `phx_leave` + `phx_join` par bascule, et
          l'invalidation regroupée de la messagerie jetée au passage. Un seul
          client, donc, dont l'identité ne bouge jamais.

          ⚠ `IsRestoringProvider` est l'API du persisteur de cache, employée ici
          hors de son usage d'origine ; le dépôt n'a pas de persisteur, et aucune
          requête suspense (vérifié). Le `gcTime` des défauts couvre le temps
          qu'un écran peut passer caché — voir `src/lib/queryClients.ts`. */}
      <IsRestoringProvider value={!actif}>
      <OngletEcranCtx.Provider value={id}>
      <EcranActifProvider value={actif}>
      <Suspense fallback={actif ? <SmartPageLoader /> : null}>
        {/* ⚠ `location` sur `<Routes>` ne fait pas que choisir la route : React
            Router enveloppe le sous-arbre dans un contexte de localisation à cette
            valeur (`useRoutes`, branche `locationArg`). Un écran caché lit donc SA
            propre URL — c'est d'elle que `useTabScopedState` tire le préfixe de
            section. La TRANCHE, elle, se lit par l'identité d'onglet
            (`OngletEcranCtx`) : sans elle, les écrans vivants lisaient et
            écrivaient tous celle de l'onglet actif. */}
        <Routes location={loc}>{routes}</Routes>
      </Suspense>
      </EcranActifProvider>
      </OngletEcranCtx.Provider>
      </IsRestoringProvider>
    </EcranPousse>
  )
})

/**
 * Les écrans des onglets — `VIVANTS_MAX` vivants au plus, un seul visible.
 *
 * ⛔ CE QU'IL Y AVAIT AVANT : `<Outlet />`. Un seul écran, celui de l'URL
 * courante, DÉTRUIT à chaque bascule d'onglet. Mesuré le 7 septembre 2026 :
 * Calendrier réglé sur Octobre, un autre onglet, retour — Septembre. Et ce n'est
 * pas le calendrier : `useTabScopedState` ne porte que 14 des ~38 positions
 * d'écran du CRM de bureau, les ~24 autres vivent en `useState` local et
 * meurent avec le composant.
 *
 * ⚠ LA PILE NE CONTIENT QUE DES ONGLETS DÉJÀ ACTIVÉS, et cette propriété n'est
 * pas décorative : elle sort du fait qu'on n'y entre que par un changement
 * d'actif. Un chemin persisté d'une vieille session qui pointerait vers une
 * route de REDIRECTION (`<Navigate>`) ne sera donc jamais monté en arrière-plan
 * — où il ferait sauter toute l'application. Il ne se montera qu'au clic, en
 * tant qu'écran actif, où rediriger est le comportement voulu.
 *
 * ⛔ L'ÉCRAN MONTRÉ EST CELUI QUE DÉSIGNE L'URL DU ROUTEUR, et c'est lui seul qui
 * se rend sur la localisation réelle ; tous les autres se rendent sur celle de
 * leur onglet. Rendre l'onglet ACTIF sur l'URL du routeur, comme au premier jet,
 * détruisait la page d'arrivée à chaque bascule en production — voir
 * `crmEcranVisible`, qui porte la règle et la mesure.
 */
function EcransVivants({ routes }: { routes: ReactNode }) {
  const api = useCrmTabsOptionnel()
  const location = useLocation()
  const isMobile = useIsMobile()
  const max = isMobile ? 1 : VIVANTS_MAX

  const tabs = api?.tabs
  const actifId = tabs && api ? tabs[api.active]?.id : undefined

  /**
   * La pile de récence — l'actif en tête.
   *
   * ⚠ Ajustée PENDANT LE RENDU et non dans un effet, sur le motif documenté par
   * React (« adjusting state when a prop changes ») : React relance le rendu
   * sans commiter l'intermédiaire, donc l'ensemble vivant est juste dès la
   * première frame de la bascule. Dans un effet, il aurait fallu une frame de
   * plus — celle où l'écran neuf n'est pas encore dans l'ensemble.
   */
  const [recents, setRecents] = useState<string[]>([])
  const [vuActif, setVuActif] = useState<string | undefined>(undefined)
  if (actifId && actifId !== vuActif) {
    setVuActif(actifId)
    setRecents((p) => crmPousserRecent(p, actifId, max))
  }

  const visibleId = useMemo(
    () => crmEcranVisible(tabs ?? [], actifId, location.pathname, location.search),
    [tabs, actifId, location.pathname, location.search],
  )

  // ⚠ La règle vit dans `crmEcransVivants` (fonction pure, éprouvée) : la
  // récence décide de l'appartenance, l'ordre de la PILE décide du rendu. L'écran
  // MONTRÉ s'y ajoute s'il n'y est pas — le temps d'une réconciliation, l'URL peut
  // désigner un onglet que la récence n'a pas encore vu passer.
  const vivants = useMemo(() => {
    const garde = crmEcransVivants(tabs ?? [], actifId, recents, max)
    if (!visibleId || garde.some((t) => t.id === visibleId)) return garde
    const ids = new Set([...garde.map((t) => t.id), visibleId])
    return (tabs ?? []).filter((t) => ids.has(t.id))
  }, [tabs, actifId, recents, max, visibleId])

  // Hors fournisseur d'onglets, ou pile d'onglets vide (aucun onglet actif) : un
  // seul écran, sur l'URL courante. Rien à garder vivant, rien à empiler — mais
  // un écran quand même, qui porte le repli de la poussée.
  if (!vivants.length) {
    return <EcranPousse><Routes location={location}>{routes}</Routes></EcranPousse>
  }

  return (
    <div style={{ position: 'relative', minHeight: '100%' }}>
      {vivants.map((tb) => {
        const montre = tb.id === visibleId
        return (
          <EcranVivant
            key={tb.id}
            id={tb.id}
            actif={montre}
            {...(montre
              ? { pathname: location.pathname, search: location.search, hash: location.hash, state: location.state }
              : localisationDe(tb))}
            routes={routes}
          />
        )
      })}
    </div>
  )
}

function AgentLayoutInner({ routes }: { routes: ReactNode }) {
  // ⚠ UN canal de notifications pour toute la coquille, et qui ne change jamais de
  // main — voir le hook. Les cloches des bandes d'onglets n'en ouvrent plus.
  useAgentNotificationsRealtime()
  const { isOpen } = useAiPanel()
  const { status: identityGateStatus } = useIdentityGate()
  const location = useLocation()
  // ⚠ Abonné à la bascule (`CRM_DARK_EVENT`), plus relu toutes les 400 ms : ce
  // layout ne se remonte pas à la navigation, et la relecture périodique laissait
  // ce fond dans l'ancien thème jusqu'au tick suivant — pour toujours sur les écrans
  // qui n'écrivaient pas la clé.
  const dark = useCrmDark()
  // Fond de ce conteneur. Il ne se voit plus derrière le dock des écrans à plan de
  // travail (ils y peignent leur propre fond) ; il reste celui du bandeau d'accueil
  // et du repli, sans lequel on verrait le `body` blanc en mode sombre.
  const pageBg = crmPalette(dark).pageBg

  // Gate identité légale (étape 2 KYB) : tant que useIdentityGate() n'a pas
  // positivement résolu l'état à 'required', on NE redirige PAS — garde-fou 1
  // de l'incident P0 c830f9a9 (« boucle onboarding »). shouldRedirectToIdentityGate
  // refuse en plus de rediriger /dashboard/identite vers elle-même (garde-fou 2) :
  // sans ce second garde-fou, la page qui doit justement lever le statut 'required'
  // ne pourrait jamais se monter.
  const mustRedirectToIdentity = shouldRedirectToIdentityGate(identityGateStatus, location.pathname)
  // …et tant que le statut n'est pas résolu, on ne rend PAS le CRM non plus :
  // sans ça, le tableau de bord s'affichait une fraction de seconde avant que la
  // lecture agence ne réponde 'required' et ne renvoie sur le wizard d'identité.
  // On prolonge l'écran d'arrivée — le même que celui de ProtectedRoute, donc la
  // bascule ne se voit pas — plutôt que d'ouvrir une porte qu'on va refermer.
  //
  // UNE SEULE FOIS, et c'est essentiel : retenir l'écran remplace l'<Outlet/>,
  // donc DÉMONTE la page et son état. Un retour à 'loading' après coup ferait
  // repartir le wizard d'identité de zéro en pleine saisie (cf. le JSDoc de
  // shouldHoldForIdentityGate). Une fois le gate résolu, on ne retient plus rien.
  const [gateResolvedOnce, setGateResolvedOnce] = useState(false)
  useEffect(() => {
    if (identityGateStatus !== 'loading') setGateResolvedOnce(true)
  }, [identityGateStatus])
  const holdForIdentity = shouldHoldForIdentityGate(identityGateStatus, gateResolvedOnce)

  return (
    // flex column pleine hauteur (correctif revue, point mineur) : les bandeaux
    // (Impersonate/LabGuard) et la zone de contenu se PARTAGENT 100vh au lieu de
    // s'empiler chacun leur propre ancrage minimal indépendant — un bandeau (qui a
    // sa propre hauteur) suivi d'une zone de contenu qui réclamait ELLE AUSSI
    // min-height:100vh dépassait la fenêtre et produisait un ascenseur de page
    // parasite sur un écran par ailleurs court (KycLabGuard bloqué, cf. son
    // en-tête). flex:'1 1 auto' sur la zone de contenu lui donne une hauteur
    // DÉFINIE (règle flexbox : un flex-item résout une taille définie même quand
    // son conteneur n'a qu'un min-height) — c'est ce qui permet à
    // KycBlockedScreen/LoadingScreen d'utiliser min-h-full plutôt que min-h-screen
    // et de s'ajuster sous un bandeau au lieu de l'ignorer. Comportement inchangé
    // en l'absence de bandeau (cas courant) : un seul enfant flexible occupe toute
    // la hauteur, comme avant.
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <ImpersonateBanner />
      {/* LabGuardBanner ne s'empile PLUS ici (04.08.2026) : il est monté dans
          IdentityShell, dans la coquille MEGGA X. Deux raisons, détaillées dans son
          en-tête — la garde d'identité ne le laissait de toute façon lire que sur
          l'entonnoir, et empilé au-dessus d'une coquille qui réclame `100dvh` il en
          faisait déborder le pied d'actions. */}
      {/* Le panneau MEGGA AI « pousse » le contenu de travail vers la gauche
          quand il est ouvert (COPILOT_WIDTH = panneau + gouttières).

          ⛔ CE CONTENEUR NE SE COMPRIME PLUS : il PUBLIE la poussée, et ce sont
          les écrans qui la prennent (voir `usePousseeDock`). Il se comprimait
          jusqu'au 12 septembre 2026, et sa gouttière — peinte ici à `pageBg` —
          était la plaque que Julien voyait derrière le dock : « Aujourd'hui »
          peint `#EBEDF1` en clair, cette gouttière `#F9F9F9`. Désormais la page
          s'étend sous le dock et y peint son propre fond.

          ⚠ `pageBg` reste le fond de CE conteneur, et il ne se voit plus que
          derrière le dock des écrans qui ne portent pas leur poussée — console,
          squelette et états de chargement, garde LAB, écrans mobiles : leur
          fond y est justement `pageBg`. */}
      <div
        style={{
          [DOCK_PUSH_VAR as string]: isOpen ? `${COPILOT_WIDTH}px` : '0px',
          background: pageBg,
          flex: '1 1 auto',
        } as CSSProperties}
      >
        {/* ⚠ Le bandeau d'accueil est DANS la zone poussée, pas au-dessus.
            Il l'était jusqu'au 4 septembre 2026, ce qui ne coûtait rien tant que
            le panneau démarrait 90 px plus bas (il dégageait la barre du haut).
            La barre du haut partie, le panneau remonte à 16 px du bord et
            recouvre la seule action du bandeau — « Rejoindre » / « Réserver »,
            calée à droite. Le pousser avec le contenu la fait glisser à gauche
            du dock. ⛔ Ne pas « corriger » en montant son z-index : un bandeau
            pleine largeur qui peint PAR-DESSUS le dock est pire que le
            chevauchement qu'il règle. Le bandeau d'usurpation, lui, reste au-
            dessus : il est `sticky z-[90]` et le panneau le compense déjà.

            ⚠ Il est hors de tout écran, donc il prend la poussée LUI-MÊME, sur sa
            racine — voir son en-tête. */}
        <OnboardingCallBanner />
        {holdForIdentity
          ? <BootSplash />
          : mustRedirectToIdentity
            ? <Navigate to={IDENTITY_GATE_ROUTE} replace />
            : <EcransVivants routes={routes} />}
      </div>
      <CrmSearchHost />
      {/* Le panneau MEGGA AI est monté dans App.tsx (au-dessus de <Routes>)
          pour persister à la navigation ; ici on ne fait que « pousser » le contenu. */}
    </div>
  )
}

/** Enrobe le layout interne des providers thème + contexte copilote. */
export default function AgentLayout({ routes }: { routes: ReactNode }) {
  return (
    <ThemeProvider>
      <CopilotContextProvider>
        {/* ⚠ Le FOURNISSEUR d'onglets est hissé ici, la BARRE ne l'est pas — et
            l'asymétrie est délibérée. Ce layout ne se remonte plus à la
            navigation (les routes ne sont plus keyées par `pathname`) : c'est le
            seul endroit d'où une pile d'onglets peut survivre à un clic. La
            barre, elle, reste montée par chaque surface, comme la barre
            latérale — la hisser la poserait sur la console super-admin, sur
            `IdentityShell` et sur quatre routes qui n'en veulent pas, et la
            retirerait des bancs `/dev/*`. Un fournisseur ne peint rien : le
            poser sur une route sans barre ne coûte rien, et `crmTabsEligible`
            l'empêche d'ouvrir un onglet pour ces routes-là. */}
        <CrmTabsProvider>
          <AgentLayoutInner routes={routes} />
        </CrmTabsProvider>
      </CopilotContextProvider>
    </ThemeProvider>
  )
}
