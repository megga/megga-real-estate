/**
 * Banc du CRM agent — `/dev/crm`, sans session réelle.
 *
 * ── POURQUOI CETTE ROUTE EXISTE ──────────────────────────────────────────────
 * Les dix surfaces `/dashboard/*` qu'il reste à porter en MEGGA X n'avaient
 * AUCUN banc : `Aujourd'hui`, KYC, Visites, Analytics, Import lead, Réglages,
 * Parcours, Audit, Calendrier. Sans session, `ProtectedRoute` fait
 * `window.location.replace('https://megga.ch/login')` — une redirection
 * **absolue** vers la production : on est déposé sur `app.megga.ch`, qui sert
 * `main`, en croyant regarder localhost. On relit alors l'ancienne version de
 * son propre travail, et ça ne ressemble pas à une erreur.
 *
 * ── UN BANC UNIQUE, ET C'EST UNE MESURE QUI L'A DÉCIDÉ ───────────────────────
 * Le plan laissait ouverte la question « un banc par surface, ou un banc du CRM
 * entier ». Trois mesures, faites le 15 août 2026 avant d'ouvrir un fichier :
 *
 *  1. **La navigation.** Dans TOUT le périmètre restant il y a UN SEUL
 *     `window.location` — `BillingSection.tsx:215`, et c'est un `mailto:`, pas
 *     une navigation. Un `MemoryRouter` capture donc 100 % des sorties, comme
 *     sur la console, sans câbler un `onNavigate` surface par surface.
 *  2. **Les données.** 31 tables, 18 RPC et 16 edge functions sur les dix-sept
 *     surfaces — toutes derrière la MÊME interception de `window.fetch`, celle
 *     qui couvrait déjà les 42 RPC de la console (`bancSupabase.ts`).
 *  3. **Le partage.** Le chrome tire `profiles`, `agencies`, `contacts`,
 *     `activity_events` et les deux tables de relance sur CHAQUE écran. Dix
 *     bancs auraient écrit ce socle dix fois — et le chrome lui-même, 172
 *     marqueurs rendus partout, n'aurait toujours eu de banc nulle part.
 *
 * ⚠ Les FIXTURES, elles, arrivent par vague : le lot 0 pose le socle et
 * « Aujourd'hui ». Ce qui manque est COMPTÉ et affiché en bas à droite — un banc
 * qui tronque en silence se lit « tout couvert ».
 *
 * ── TROIS MURS, PAS UN ───────────────────────────────────────────────────────
 * `ProtectedRoute` n'est que le premier. `AgentSugarLayout` retient l'écran sur
 * `BootSplash` tant que `useIdentityGate` n'a pas résolu, puis redirige vers
 * `/dashboard/identite` si l'identité n'est pas soumise ; `KycLabGuard` bloque
 * KYC tant que l'agence n'est pas validée. Les trois se lèvent par la DONNÉE
 * (`semerSessionBanc` + la fiche agence), pas par une substitution de code.
 *
 * ⚠ ROUTE CONDITIONNÉE AU MODE DEV, contrairement à `/dev/pipeline` ou
 * `/dev/biens`. Deux raisons, chacune suffisante : le banc SÈME une session dans
 * le stockage, ce qui n'a aucune excuse dans un bundle déployé ; et il monte des
 * écrans de CONFORMITÉ (KYC) et de facturation. Même arbitrage que `/dev/admin`
 * et `/dev/onboarding`.
 *
 * ⛔ Données de DÉMONSTRATION. Rien ne vient de la base, aucun geste n'écrit.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { MemoryRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AiPanelProvider } from '@/hooks/useAiPanel'
import { AuthProvider } from '@/hooks/useAuth'
import { ToastProvider } from '@/components/ui/Toast'
import { crmSugarPalette } from '@/components/crm-sugar/tokens'
import AgentSugarLayout from '@/components/layout/AgentSugarLayout'
import KycLabGuard from '@/components/layout/KycLabGuard'
import { SUPABASE_FUNCTIONS_URL } from '@/lib/supabase'
import { desinstallerBanc, installerBanc, reglerBanc, type BancEtat } from './bancSupabase'
import { CRM_RPC, CRM_RPC_VIDE, CRM_TABLES } from './crmFixtures'
import { semerSessionBanc } from './bancSession'

/* ─── Les surfaces montées, dérivées du ROUTAGE de `App.tsx` ───────────────── */

const TodaySugarPage = lazy(() => import('@/pages/agent/TodaySugarPage'))
const KycSugarV3Page = lazy(() => import('@/pages/agent/KycSugarV3Page'))
const KycOnboardingPage = lazy(() => import('@/pages/agent/KycOnboardingPage'))
const KycExportPage = lazy(() => import('@/pages/agent/KycExportPage'))
const VisitModalSugarV3Page = lazy(() => import('@/pages/agent/VisitModalSugarV3Page'))
const VisitDetailSugarV3Page = lazy(() => import('@/pages/agent/VisitDetailSugarV3Page'))
const DashboardSugarV4Page = lazy(() => import('@/pages/agent/DashboardSugarV4Page'))
const ImportLeadSugarV3Page = lazy(() => import('@/pages/agent/ImportLeadSugarV3Page'))
const SettingsSugarV2Page = lazy(() => import('@/pages/agent/SettingsSugarV2Page'))
const JourneySugarV2Page = lazy(() => import('@/pages/agent/JourneySugarV2Page'))
const AuditSugarPage = lazy(() => import('@/pages/agent/AuditSugarPage'))
const CalendarSugarV2Page = lazy(() => import('@/pages/agent/CalendarSugarV2Page'))

/**
 * Le panneau MEGGA AI — CHROME, pas une surface.
 *
 * ⚠ `App.tsx` le monte au-dessus de `<Routes>` (`CopilotPanelHost`), donc sur
 * TOUTE route `/dashboard`. Mesuré le 15 août 2026 : il porte **114 marqueurs**
 * sur 8 fichiers, et le plan du chantier ne les comptait nulle part — son
 * « chrome partagé » en annonçait 58, qui sont ceux du rail, de la recherche,
 * des notifications et du profil. Le monter ici est ce qui met les 172 sous les
 * yeux à chaque écran du banc.
 */
const CopilotPanel = lazy(() => import('@/components/ai-copilot/panel/CopilotPanel'))

/**
 * Les dix surfaces du chantier, dans l'ordre du plan : la vague A d'abord (celles
 * qui n'ont JAMAIS été portées, 552 marqueurs), puis celles dont seule la
 * COULEUR reste (236).
 *
 * ⚠ `porte` dit ce que le cliquet (`megga-x-grammar.spec.ts`) déclare, pas ce
 * qu'une description affirme — c'est la distinction qui avait fait rater un
 * tiers du périmètre de la console.
 */
const SURFACES: { id: string; chemin: string; label: string; vague: 'A' | 'B' }[] = [
  { id: 'today', chemin: '/dashboard', label: 'Aujourd’hui', vague: 'A' },
  { id: 'kyc', chemin: '/dashboard/kyc', label: 'KYC', vague: 'A' },
  { id: 'kyc-bienvenue', chemin: '/dashboard/kyc/bienvenue', label: 'KYC · bienvenue', vague: 'A' },
  { id: 'kyc-rapport', chemin: '/dashboard/kyc/k1/export', label: 'KYC · rapport', vague: 'A' },
  { id: 'visite-new', chemin: '/dashboard/visits/new', label: 'Visite · nouvelle', vague: 'A' },
  { id: 'visite', chemin: '/dashboard/visits/v1', label: 'Visite · fiche', vague: 'A' },
  { id: 'analytics', chemin: '/dashboard/analytics', label: 'Analytics', vague: 'A' },
  { id: 'import-lead', chemin: '/dashboard/import-lead', label: 'Import lead', vague: 'A' },
  { id: 'settings', chemin: '/dashboard/settings', label: 'Réglages', vague: 'B' },
  { id: 'calendar', chemin: '/dashboard/calendar', label: 'Calendrier', vague: 'B' },
  { id: 'journey', chemin: '/dashboard/journey', label: 'Parcours', vague: 'B' },
  { id: 'audit', chemin: '/dashboard/audit', label: 'Audit', vague: 'B' },
]

const ETATS: { id: BancEtat; label: string; titre: string }[] = [
  { id: 'nominal', label: 'Nominal', titre: '3 contacts, 2 biens, 2 rappels, 1 visite, journal à 4 lignes' },
  { id: 'vide', label: 'Vide', titre: 'Chaque source rend zéro ligne — les états vides de chaque surface' },
  { id: 'erreur', label: 'Échec', titre: 'Chaque source rend 500 — les branches d’erreur' },
]

/* ─── Chrome du banc ──────────────────────────────────────────────────────── */

/**
 * Lit le thème que le rail POSSÈDE (clé `megga.sugar.dark`, '1'/'0').
 *
 * ⚠ Le banc le SUIT et ne le décide jamais : ses propres commandes seraient
 * sinon peintes dans le thème d'avant la dernière bascule — un banc qui fabrique
 * lui-même l'incohérence qu'il sert à débusquer. Même règle que `/dev/pipeline`.
 */
function lireSombre(): boolean {
  const s = window.localStorage.getItem('megga.sugar.dark')
  if (s === '1') return true
  if (s === '0') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function Commandes({ etat, setEtat, sansFixture }: {
  etat: BancEtat
  setEtat: (e: BancEtat) => void
  sansFixture: string[]
}) {
  const navigate = useNavigate()
  const [replie, setReplie] = useState(false)
  const [dark, setDark] = useState(lireSombre)
  // Le rail bascule le thème sans notifier l'onglet courant (`storage` ne
  // concerne que les autres) : on relit, comme le fait `AgentSugarLayout`.
  useEffect(() => {
    const id = window.setInterval(() => setDark(lireSombre()), 400)
    return () => window.clearInterval(id)
  }, [])
  const sp = crmSugarPalette(dark)

  const pilule = (actif: boolean) => ({
    border: 0, cursor: 'pointer', fontFamily: 'inherit',
    padding: 'var(--crm-space-xs) var(--crm-space-lg)',
    borderRadius: 'var(--crm-radius-pill)',
    fontSize: 'var(--crm-text-sm)', fontWeight: 600,
    background: actif ? sp.accent : 'transparent',
    color: actif ? sp.accentInk : sp.sub,
    whiteSpace: 'nowrap' as const,
  })
  const groupe = {
    display: 'inline-flex', gap: 'var(--crm-space-2xs)', flexWrap: 'wrap' as const,
    background: sp.solidBg, borderRadius: 'var(--crm-radius-lg)',
    padding: 'var(--crm-space-2xs)', border: `1px solid ${sp.cardBorder}`,
    maxWidth: 560, justifyContent: 'flex-end' as const,
  }

  return (
    <div style={{
      position: 'fixed', bottom: 14, right: 14, zIndex: 9500,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
      gap: 'var(--crm-space-2xs)',
    }}>
      {!replie && (
        <>
          <div style={groupe}>
            {SURFACES.map((s) => (
              <button key={s.id} type="button" title={`vague ${s.vague} · ${s.chemin}`}
                onClick={() => navigate(s.chemin)} style={pilule(false)}>{s.label}</button>
            ))}
          </div>
          <div style={{ ...groupe, maxWidth: 'none' }}>
            {ETATS.map((e) => (
              <button key={e.id} type="button" title={e.titre}
                onClick={() => setEtat(e.id)} aria-pressed={etat === e.id}
                style={pilule(etat === e.id)}>{e.label}</button>
            ))}
          </div>
          {sansFixture.length > 0 && (
            // ⚠ Un banc qui borne sa couverture doit le DIRE : une troncature
            // silencieuse se lit « tout couvert ». Le lot 0 ne pose que le socle
            // et « Aujourd'hui » — cette ligne est la liste de courses des vagues
            // suivantes, mesurée à l'écran plutôt que devinée.
            <div
              title={sansFixture.join('\n')}
              style={{
                ...groupe, padding: 'var(--crm-space-2xs) var(--crm-space-lg)',
                fontSize: 'var(--crm-text-xs)', color: sp.sub, maxWidth: 360,
              }}>
              {sansFixture.length} appel{sansFixture.length > 1 ? 's' : ''} sans fixture → vide
            </div>
          )}
        </>
      )}
      <button
        type="button"
        onClick={() => setReplie((v) => !v)}
        aria-expanded={!replie}
        title={replie ? 'Déplier les commandes du banc' : 'Replier — dégage le coin bas-droit'}
        style={{
          border: 0, cursor: 'pointer', fontFamily: 'inherit',
          padding: 'var(--crm-space-2xs) var(--crm-space-lg)',
          borderRadius: 'var(--crm-radius-pill)', background: sp.accent, color: sp.accentInk,
          fontSize: 'var(--crm-text-xs)', fontWeight: 600,
        }}>
        {replie ? 'Aperçu ▸' : 'Aperçu · données de démonstration'}
      </button>
    </div>
  )
}

/**
 * Ce que le banc rend quand une surface vise une cible qu'il ne monte pas.
 *
 * C'est la SEULE sortie possible : le routeur mémoire n'a que les routes
 * ci-dessous. Elle le DIT et propose le retour, au lieu d'éjecter en production
 * — le défaut exact que la première version du banc du Pipeline avait livré.
 */
function SortieNeutralisee() {
  const navigate = useNavigate()
  const sp = crmSugarPalette(lireSombre())
  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center',
      background: sp.pageBg, color: sp.ink, textAlign: 'center', padding: 24,
    }}>
      <div style={{ maxWidth: 460, display: 'grid', gap: 'var(--crm-space-lg)' }}>
        <p style={{ margin: 0, fontSize: 'var(--crm-text-3xl)', fontWeight: 600 }}>
          Sortie neutralisée
        </p>
        <p style={{ margin: 0, fontSize: 'var(--crm-text-lg)', color: sp.sub, lineHeight: 1.5 }}>
          Cette surface a visé une cible que le banc ne monte pas. En production
          le lien aboutit ; ici il ne quitte pas le banc.
        </p>
        <div>
          <button type="button" onClick={() => navigate('/dashboard')} style={{
            border: 0, cursor: 'pointer', fontFamily: 'inherit',
            padding: 'var(--crm-space-lg) var(--crm-space-2xl)',
            borderRadius: 'var(--crm-radius-pill)',
            background: sp.accent, color: sp.accentInk,
            fontSize: 'var(--crm-text-lg)', fontWeight: 600,
          }}>Revenir à « Aujourd’hui »</button>
        </div>
      </div>
    </div>
  )
}

/**
 * L'arbre de routes du banc — la MÊME imbrication qu'`App.tsx` : les surfaces
 * sous `AgentSugarLayout`, et KYC sous `KycLabGuard`.
 *
 * ⚠ Recopier cette imbrication est ce qui rend la coquille vérifiable : c'est
 * elle qui porte la bannière d'impersonation, celle de l'appel d'accueil, l'hôte
 * de la recherche et la gouttière du panneau MEGGA AI. Un banc qui monterait les
 * pages nues aurait laissé ces quatre surfaces hors de portée.
 */
function RoutesBanc() {
  return (
    <Routes>
      <Route path="/dashboard" element={<AgentSugarLayout />}>
        <Route index element={<TodaySugarPage />} />
        <Route path="analytics" element={<DashboardSugarV4Page />} />
        <Route path="calendar" element={<CalendarSugarV2Page />} />
        <Route path="journey" element={<JourneySugarV2Page />} />
        <Route path="settings" element={<SettingsSugarV2Page />} />
        <Route path="audit" element={<AuditSugarPage />} />
        <Route path="import-lead" element={<ImportLeadSugarV3Page />} />
        <Route path="visits/new" element={<VisitModalSugarV3Page />} />
        <Route path="visits/:id" element={<VisitDetailSugarV3Page />} />
        <Route element={<KycLabGuard />}>
          <Route path="kyc" element={<KycSugarV3Page />} />
          <Route path="kyc/bienvenue" element={<KycOnboardingPage />} />
          <Route path="kyc/:dossierId" element={<KycSugarV3Page />} />
          {/* ⚠ Le RAPPORT n'avait aucun banc, et c'est la surface la plus
              difficile à relire de tête : trois pages A4 en pixels absolus,
              montées par DEUX routes (l'aperçu agent ici, le rendu headless sur
              `/kyc-report/:token`). Sans lui, ses 1 844 lignes ne se
              vérifiaient que par lecture. */}
          <Route path="kyc/:dossierId/export" element={<KycExportPage />} />
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<SortieNeutralisee />} />
    </Routes>
  )
}

/**
 * Client de requêtes PROPRE au banc — le vrai vit dans `App.tsx`, hors de portée
 * d'un import lazy sans créer de cycle. Ses réglages de reprise n'ont aucun sens
 * ici : chaque réponse vient de l'interception, aucune ne peut échouer par
 * réseau.
 */
const clientBanc = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
})

export default function CrmShowcasePage() {
  const [etat, setEtatLocal] = useState<BancEtat>('nominal')
  const [sansFixture, setSansFixture] = useState<string[]>([])

  // ⚠ Semé et installé PENDANT le rendu, donc AVANT que `AuthProvider` appelle
  // `getSession()` dans son effet et avant le premier `queryFn`. Un effet
  // arriverait trop tard : la coquille aurait déjà retenu l'écran.
  // ⚠ AVANT TOUT LE RESTE, et hors de l'initialiseur `useState` : il doit avoir
  // eu lieu quand `AuthProvider`, rendu plus bas, lancera son `getSession()`.
  const session = semerSessionBanc(SUPABASE_FUNCTIONS_URL)

  useState(() => {
    reglerBanc({
      tables: CRM_TABLES,
      rpc: CRM_RPC,
      rpcVide: CRM_RPC_VIDE,
      // Servie AUSSI sur `/auth/v1` : sans ça, le 401 du vrai service ferait
      // purger le jeton par `authAwareFetch`.
      session,
      // Dédoublonné par une mise à jour FONCTIONNELLE, pas par une `ref` — une
      // clôture qui lit `ref.current` et qu'on passe à une fonction pendant le
      // rendu fait rougir `react-hooks/refs`, et la règle a raison.
      signaler: (appel) => {
        setSansFixture((prev) => (prev.includes(appel) ? prev : [...prev, appel].sort()))
      },
    })
    installerBanc()
    return true
  })
  // ⛔ ET IL FAUT RÉINSTALLER ICI, sinon le banc part en production sans le
  // savoir. StrictMode monte, DÉMONTE, remonte : le nettoyage désinstalle
  // l'intercepteur, et l'initialiseur de `useState` ne rejoue PAS au remontage
  // (l'état survit). Défaut mesuré à l'écran sur le banc de la console — les
  // requêtes partaient vers la vraie base, qui répondait 401.
  // ⛔ `window.print()` EST UN GESTE, et le banc n'en laisse passer aucun.
  // `KycExportPage` l'appelle SEULE, 800 ms après que le dossier a chargé — sur
  // le banc ça ouvre une boîte native qui fige le volet du navigateur, et la
  // surface devient inobservable au moment précis où on voulait la regarder.
  // Mesuré : le volet est resté bloqué jusqu'à un Échap.
  //
  // Même arbitrage que l'interception de `fetch` — on neutralise la sortie, on
  // ne touche pas au code de production. La restauration est symétrique : le
  // banc démonté, la vraie fonction revient.
  useEffect(() => {
    const vraie = window.print
    window.print = () => {}
    return () => { window.print = vraie }
  }, [])

  useEffect(() => {
    // ⛔ `socle` — les deux tables qui TRAVERSENT l'état « Vide ». Sans elles, la
    // bascule vidait aussi l'identité de la session : le KYC tombait sur le mur
    // d'identité et l'écran affichait « Vérifiez l'identité de votre agence » au
    // lieu d'un état vide. On croyait regarder une surface, on regardait une
    // garde. Elles ne sont pas de la donnée à montrer — sans elles il n'y a pas
    // d'écran du tout, donc rien de vide à regarder.
    reglerBanc({
      tables: CRM_TABLES, rpc: CRM_RPC, rpcVide: CRM_RPC_VIDE, session,
      socle: ['profiles', 'agencies'],
    })
    installerBanc()
    return desinstallerBanc
  }, [session])

  const setEtat = useCallback((e: BancEtat) => {
    reglerBanc({ etat: e })
    setEtatLocal(e)
    // Les requêtes actives repartent avec la nouvelle réponse ; on ne remonte
    // pas l'arbre, sinon changer d'état ramènerait à « Aujourd'hui ».
    // ⚠ Le CLIENT directement, pas `useQueryClient()` : ce composant POSE le
    // provider, donc le hook s'exécuterait hors de lui — « No QueryClient set ».
    void clientBanc.resetQueries()
  }, [])

  const entrees = useMemo(() => ['/dashboard'], [])

  return (
    // ⛔ LES PROVIDERS SONT ICI, PAS DANS `App.tsx`, et l'ordre est tout : le
    // corps de ce composant — donc `semerSessionBanc` ci-dessus — s'exécute
    // AVANT le rendu de `AuthProvider` et donc avant son effet `getSession()`.
    // Posés dans `App.tsx`, ils partaient pendant que ce chunk chargeait encore,
    // ne trouvaient pas la session, et la coquille retenait l'écran sur
    // `BootSplash` pour toujours.
    <QueryClientProvider client={clientBanc}>
      <AuthProvider>
        <ToastProvider>
    <MemoryRouter initialEntries={entrees}>
      {/* ⛔ `AiPanelProvider` est DANS le routeur, pas au-dessus : il appelle
          `useLocation()`. Posé dans la coquille du banc (`BancCrmAgent`), il
          levait « useLocation() may be used only in the context of a <Router> »
          et rendait un écran BLANC — que `tsc` et `eslint` voyaient verts. */}
      <AiPanelProvider>
        <Suspense fallback={null}>
          <RoutesBanc />
          {/* Au-dessus des routes, comme en production : le panneau persiste
              quand on passe d'une surface à l'autre depuis les commandes. */}
          <CopilotPanel />
        </Suspense>
        <Commandes etat={etat} setEtat={setEtat} sansFixture={sansFixture} />
      </AiPanelProvider>
    </MemoryRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
