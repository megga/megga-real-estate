/**
 * Banc du CRM agent — `/dev/crm`, sans session réelle.
 *
 * ── POURQUOI CETTE ROUTE EXISTE ──────────────────────────────────────────────
 * Les dix surfaces `/dashboard/*` qu'il reste à porter en MEGGA X n'avaient
 * AUCUN banc : `Aujourd'hui`, KYC, Visites, Analytics, Import lead, Réglages,
 * Parcours, Audit, Calendrier. Sans session, `ProtectedRoute` fait
 * `window.location.replace('https://getmegga.com/login')` — une redirection
 * **absolue** vers la production : on est déposé sur `app.getmegga.com`, qui sert
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
 * `ProtectedRoute` n'est que le premier. `AgentLayout` retient l'écran sur
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
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CrmWorkspace from '@/components/crm/CrmWorkspace'
import { MemoryRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ROUTER_FUTURE } from '@/lib/routerFuture'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AiPanelProvider } from '@/hooks/useAiPanel'
import { AuthProvider } from '@/hooks/useAuth'
import { ToastProvider } from '@/components/ui/Toast'
import { crmPalette } from '@/components/crm/tokens'
import AgentLayout from '@/components/layout/AgentLayout'
import KycLabGuard from '@/components/layout/KycLabGuard'
import ByParam from '@/components/layout/ByParam'
import { SUPABASE_FUNCTIONS_URL } from '@/lib/supabase'
import { NewTabPagePrechargeable } from '@/lib/pagesPrechargeables'
import { desinstallerBanc, installerBanc, reglerBanc, type BancEtat } from './bancSupabase'
import { CRM_EDGES, CRM_RPC, CRM_RPC_VIDE, CRM_TABLES } from './crmFixtures'
import { AGENT_BANC, semerSessionBanc } from './bancSession'
import { useCrmDark, useCrmDarkPref } from '@/lib/crmDark'
import { MailFixturesContext, useMailFixtures } from '@/components/crm/messagerie/fixtures'
import BootCurtain, { CurtainLift } from '@/components/layout/BootCurtain'

/* ─── Les surfaces montées, dérivées du ROUTAGE de `App.tsx` ───────────────── */

const TodayPage = lazy(() => import('@/pages/agent/TodayPage'))
// La MÊME instance que l'app : le banc doit montrer le préchargement tel qu'il marche.
const NewTabPage = NewTabPagePrechargeable
const DashboardNotFoundPage = lazy(() => import('@/pages/agent/DashboardNotFoundPage'))

/**
 * Lève pendant le rendu : le seul moyen de voir le VRAI repli d'`ErrorBoundary` — le banc
 * est enroulé dans le même (`BancCrmAgent`, App.tsx). ⚠ Il remplace donc le banc entier,
 * ses commandes comprises ; « Recharger la page » y ramène.
 */
function ErreurDeRendu(): never {
  throw new Error('banc : erreur de rendu voulue')
}
const KycPage = lazy(() => import('@/pages/agent/KycPage'))
const KycOnboardingPage = lazy(() => import('@/pages/agent/KycOnboardingPage'))
const KycExportPage = lazy(() => import('@/pages/agent/KycExportPage'))
const VisitNewPage = lazy(() => import('@/pages/agent/VisitNewPage'))
const VisitDetailPage = lazy(() => import('@/pages/agent/VisitDetailPage'))
const AnalyticsPage = lazy(() => import('@/pages/agent/AnalyticsPage'))
const ExternalListingDetailPage = lazy(() => import('@/pages/agent/ExternalListingDetailPage'))
const ImportLeadPage = lazy(() => import('@/pages/agent/ImportLeadPage'))
const SettingsPage = lazy(() => import('@/pages/agent/SettingsPage'))
const JourneyPage = lazy(() => import('@/pages/agent/JourneyPage'))
const AuditPage = lazy(() => import('@/pages/agent/AuditPage'))
const CalendarPage = lazy(() => import('@/pages/agent/CalendarPage'))
const MessageriePage = lazy(() => import('@/pages/agent/MessageriePage'))
const ContactsPage = lazy(() => import('@/pages/agent/ContactsPage'))
const ContactDetailPage = lazy(() => import('@/pages/agent/ContactDetailPage'))
const ListingsPage = lazy(() => import('@/pages/agent/ListingsPage'))
const ListingDetailPage = lazy(() => import('@/pages/agent/ListingDetailPage'))
const NouveauBienPage = lazy(() => import('@/pages/agent/NouveauBienPage'))

/**
 * La Messagerie du banc, REMONTÉE quand la source de ses courriels change — même
 * geste que `/dev/messagerie`. ⛔ Sans la clé, repasser de « Vide » (aucune
 * boîte) à « Nominal » laissait l'écran sur « Aucune boîte » : il garde la boîte
 * courante dans son reducer, et celle-ci pointait sur rien.
 */
function MessagerieBanc() {
  const fx = useMailFixtures()
  return <MessageriePage key={fx ?? 'reseau'} />
}

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
const SURFACES: { id: string; chemin: string; label: string; vague: 'A' | 'B' | null }[] = [
  { id: 'today', chemin: '/dashboard', label: 'Aujourd’hui', vague: 'A' },
  { id: 'nouvel-onglet', chemin: '/dashboard/nouvel-onglet', label: 'Nouvel onglet', vague: 'A' },
  { id: 'introuvable', chemin: '/dashboard/introuvable', label: 'Page introuvable', vague: 'A' },
  // Fiche d'annonce marché — l'uuid est celui de `ANNONCE_MARCHE_BANC`.
  { id: 'market', chemin: '/dashboard/market/00432e97-f3d2-4d11-9c1f-dd882343ee8e', label: 'Annonce marché', vague: 'A' },
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
  // ⚠ HORS CHANTIER, donc sans vague : la Messagerie est née en MEGGA X (PR #1276).
  // Elle est ici parce que c'est le seul endroit où la voir DANS la coquille —
  // `/dev/messagerie` la monte sans fournisseur d'onglets, donc sans bande. Ses
  // courriels sont les fixtures de ce banc-là (`MailFixturesContext`, plus bas).
  { id: 'messagerie', chemin: '/dashboard/messagerie', label: 'Messagerie', vague: null },
  // ⚠ HORS CHANTIER aussi : Contacts est déjà porté, et `/dev/contacts` le monte
  // hors coquille, sur des données déjà ADAPTÉES. Ici il passe par ses vrais hooks —
  // la barre latérale et la bande d'onglets y mènent, et y aboutissaient à vide.
  { id: 'contacts', chemin: '/dashboard/contacts', label: 'Contacts', vague: null },
  { id: 'contact', chemin: '/dashboard/contacts/c1', label: 'Contact · fiche', vague: null },
  // ⚠ HORS CHANTIER : « Mes biens » a son banc hors coquille (`/dev/biens`, sur
  // `CRM_BIENS` déjà adaptés). Ici il passe par ses vrais hooks et les `properties`
  // du banc — la barre latérale y menait, et y aboutissait à vide.
  { id: 'biens', chemin: '/dashboard/listings', label: 'Mes biens', vague: null },
  { id: 'bien', chemin: '/dashboard/listings/p1', label: 'Bien · fiche', vague: null },
  // La création d'annonce en quatre étapes — elle a remplacé l'ancien wizard le 16.09.2026.
  { id: 'nouveau-bien', chemin: '/dashboard/listings/new', label: 'Nouveau bien', vague: null },
  // L'écran d'erreur de l'application (`ErreurApplication`), atteint par une vraie erreur.
  { id: 'erreur-rendu', chemin: '/dashboard/erreur-rendu', label: 'Erreur de rendu', vague: null },
]

const ETATS: { id: BancEtat; label: string; titre: string }[] = [
  { id: 'nominal', label: 'Nominal', titre: '8 contacts, 50 biens, 2 rappels, 1 visite, journal à 4 lignes' },
  { id: 'vide', label: 'Vide', titre: 'Chaque source rend zéro ligne — les états vides de chaque surface' },
  { id: 'erreur', label: 'Échec', titre: 'Chaque source rend 500 — les branches d’erreur' },
]

/* ─── Chrome du banc ──────────────────────────────────────────────────────── */

function Commandes({ etat, setEtat, sansFixture }: {
  etat: BancEtat
  setEtat: (e: BancEtat) => void
  sansFixture: string[]
}) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  // ⚖ MINIMALISTE (Julien, 16.09.2026 : « il me gâche la vue ») : une seule pastille
  // discrète dans le coin, qui dit où l'on est ; les 22 surfaces, les trois états et le
  // compte des appels sans fixture vivent dans un menu REPLIÉ par défaut. Avant, un pavé
  // de quatre lignes couvrait le coin bas-droit de chaque écran — là où vivent justement
  // les boutons d'action et les dernières lignes des listes.
  const [ouvert, setOuvert] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  // ⚠ Le banc SUIT le thème et ne le décide jamais : ses propres commandes seraient
  // sinon peintes dans le thème d'avant la dernière bascule — un banc qui fabrique
  // lui-même l'incohérence qu'il sert à débusquer. Abonné à la bascule, comme le dock.
  const dark = useCrmDark()
  const sp = crmPalette(dark)

  useEffect(() => {
    if (!ouvert) return
    const dehors = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false) }
    const echap = (e: KeyboardEvent) => { if (e.key === 'Escape') setOuvert(false) }
    document.addEventListener('mousedown', dehors)
    document.addEventListener('keydown', echap)
    return () => { document.removeEventListener('mousedown', dehors); document.removeEventListener('keydown', echap) }
  }, [ouvert])

  // La surface courante : le chemin le plus long qui préfixe l'URL du routeur mémoire.
  const courante = [...SURFACES]
    .filter((x) => pathname === x.chemin || pathname.startsWith(x.chemin + '/'))
    .sort((a, b) => b.chemin.length - a.chemin.length)[0]
  const etatCourant = ETATS.find((e) => e.id === etat)

  return (
    <div ref={ref} className="banc-commandes" style={{
      position: 'fixed', bottom: 12, right: 12, zIndex: 9500,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--crm-space-xs)',
      fontFamily: 'var(--crm-font), system-ui, sans-serif',
    }}>
      <style>{`
        .banc-pastille { opacity: .55; transition: opacity .15s ease; }
        .banc-pastille:hover, .banc-pastille[aria-expanded="true"] { opacity: 1; }
        .banc-item:hover { background: ${sp.focusSurface} !important; }
      `}</style>
      {ouvert && (
        <div role="menu" style={{
          width: 240, maxHeight: '60vh', display: 'flex', flexDirection: 'column',
          background: sp.solidBg, border: `1px solid ${sp.solidBorder}`, borderRadius: 'var(--crm-radius-lg)',
          boxShadow: sp.solidShadow, overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', gap: 'var(--crm-space-2xs)', padding: 'var(--crm-space-xs)', borderBottom: `1px solid ${sp.solidBorder}` }}>
            {ETATS.map((e) => (
              <button key={e.id} type="button" title={e.titre} onClick={() => setEtat(e.id)} aria-pressed={etat === e.id} style={{
                flex: 1, border: 0, cursor: 'pointer', fontFamily: 'inherit', height: 26,
                borderRadius: 'var(--crm-radius-md)', fontSize: 'var(--crm-text-xs)', fontWeight: 600,
                background: etat === e.id ? sp.accent : 'transparent', color: etat === e.id ? sp.accentInk : sp.sub,
              }}>{e.label}</button>
            ))}
          </div>
          <div style={{ overflowY: 'auto', padding: 'var(--crm-space-2xs)' }}>
            {SURFACES.map((s) => {
              const actif = s.id === courante?.id
              return (
                <button key={s.id} type="button" role="menuitem" className="banc-item" title={s.chemin}
                  onClick={() => { navigate(s.chemin); setOuvert(false) }} style={{
                    display: 'block', width: '100%', textAlign: 'left', border: 0, cursor: 'pointer', fontFamily: 'inherit',
                    padding: 'var(--crm-space-xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-md)',
                    fontSize: 'var(--crm-text-sm)', fontWeight: actif ? 600 : 500,
                    background: actif ? sp.focusSurface : 'transparent', color: actif ? sp.ink : sp.sub,
                  }}>{s.label}</button>
              )
            })}
          </div>
          {sansFixture.length > 0 && (
            // ⚠ Un banc qui borne sa couverture doit le DIRE : une troncature silencieuse se
            // lit « tout couvert ». Replié, le compte reste là, dans le menu.
            <div title={sansFixture.join('\n')} style={{
              padding: 'var(--crm-space-xs) var(--crm-space-md)', borderTop: `1px solid ${sp.solidBorder}`,
              fontSize: 'var(--crm-text-xs)', color: sp.sub,
            }}>
              {sansFixture.length} appel{sansFixture.length > 1 ? 's' : ''} sans fixture → vide
            </div>
          )}
        </div>
      )}
      <button type="button" className="banc-pastille" onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert} aria-haspopup="menu"
        title="Banc · données de démonstration" style={{
          display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', height: 24,
          padding: '0 var(--crm-space-md)', border: `1px solid ${sp.solidBorder}`, cursor: 'pointer', fontFamily: 'inherit',
          borderRadius: 'var(--crm-radius-pill)', background: sp.solidBg, color: sp.sub,
          fontSize: 'var(--crm-text-xs)', fontWeight: 600, whiteSpace: 'nowrap',
        }}>
        <span aria-hidden style={{ width: 6, height: 6, borderRadius: 'var(--crm-radius-pill)', background: etat === 'nominal' ? sp.accent : sp.sub }} />
        {courante?.label ?? 'Banc'}{etat !== 'nominal' && etatCourant ? ` · ${etatCourant.label}` : ''}
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
  // Le MÊME magasin que les pages : un `useState` ici laissait cette surface
  // claire quand la bande basculait les autres en sombre.
  const [dark, setDark] = useCrmDarkPref()
  const sp = crmPalette(dark)
  return (
    <div style={{ background: sp.pageBg, minHeight: '100vh', color: sp.ink, fontFamily: 'var(--crm-font), system-ui, sans-serif' }}>
      <div style={{ display: 'flex' }}>
        <CrmWorkspace sp={sp} dark={dark} setDark={setDark}>
    <main style={{
      flex: 1, minHeight: '100vh', display: 'grid', placeItems: 'center',
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
    </main>
        </CrmWorkspace>
      </div>
    </div>
  )
}

/**
 * L'arbre de routes du banc — la MÊME imbrication qu'`App.tsx` : les surfaces
 * sous `AgentLayout`, et KYC sous `KycLabGuard`.
 *
 * ⚠ Recopier cette imbrication est ce qui rend la coquille vérifiable : c'est
 * elle qui porte la bannière d'impersonation, celle de l'appel d'accueil, l'hôte
 * de la recherche et la gouttière du panneau MEGGA AI. Un banc qui monterait les
 * pages nues aurait laissé ces quatre surfaces hors de portée.
 */
/**
 * La table du banc, hissée comme celle de l'app.
 *
 * ⚠ Même forme qu'`App.tsx` depuis le 7 septembre 2026 : `AgentLayout` rend
 * lui-même les écrans (trois vivants au plus) et réclame donc sa table en prop,
 * le parent passant en `/dashboard/*`. Le banc doit suivre, sinon il n'éprouve
 * plus la coquille que l'app monte.
 */
const ROUTES_BANC = (
  <>
        <Route index element={<TodayPage />} />
        <Route path="nouvel-onglet" element={<NewTabPage />} />
        {/* ⚠ Monté sur un chemin NOMMÉ, alors qu'en production il est le filet
            `*`. Le banc a déjà son propre filet (« Sortie neutralisée »), qui dit
            autre chose : sans cette route, le 404 réel du CRM n'aurait aucun
            endroit où se regarder. */}
        <Route path="introuvable" element={<DashboardNotFoundPage />} />
        <Route path="erreur-rendu" element={<ErreurDeRendu />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="market/:externalId" element={<ExternalListingDetailPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="journey" element={<JourneyPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="messagerie" element={<MessagerieBanc />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="contacts/:id" element={<ByParam><ContactDetailPage /></ByParam>} />
        <Route path="listings" element={<ListingsPage />} />
        <Route path="listings/new" element={<NouveauBienPage />} />
        <Route path="listings/:id" element={<ByParam><ListingDetailPage /></ByParam>} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="import-lead" element={<ImportLeadPage />} />
        <Route path="visits/new" element={<VisitNewPage />} />
        <Route path="visits/:id" element={<VisitDetailPage />} />
        <Route element={<KycLabGuard />}>
          <Route path="kyc" element={<KycPage />} />
          <Route path="kyc/bienvenue" element={<KycOnboardingPage />} />
          <Route path="kyc/:dossierId" element={<KycPage />} />
          {/* ⚠ Le RAPPORT n'avait aucun banc, et c'est la surface la plus
              difficile à relire de tête : trois pages A4 en pixels absolus,
              montées par DEUX routes (l'aperçu agent ici, le rendu headless sur
              `/kyc-report/:token`). Sans lui, ses 1 844 lignes ne se
              vérifiaient que par lecture. */}
          <Route path="kyc/:dossierId/export" element={<KycExportPage />} />
        </Route>
        {/* ⚠ Le même filet que l'app : sous un parent en `/dashboard/*`, une
            cible non montée ne matche plus rien et rendrait un écran BLANC —
            alors que le banc doit dire « Sortie neutralisée ».
            ⚠ Et il le dit DANS la coquille, comme le 404 de l'app : sortir du
            cadre pour annoncer qu'on n'a pas trouvé fait croire à un plantage,
            et masque la pile d'onglets restée ouverte. */}
        <Route path="*" element={<SortieNeutralisee />} />
  </>
)

function RoutesBanc() {
  return (
    <Routes>
      <Route path="/dashboard/*" element={<AgentLayout routes={ROUTES_BANC} />} />
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
      edges: CRM_EDGES,
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
      tables: CRM_TABLES, rpc: CRM_RPC, rpcVide: CRM_RPC_VIDE, edges: CRM_EDGES, session,
      // `whatsapp_agent_links` aussi : le lien WhatsApp appartient au COMPTE, pas au carnet —
      // vider les contacts ne délie pas le numéro de l'agent (écran vide des Contacts).
      socle: ['profiles', 'agencies', 'whatsapp_agent_links'],
      // Les libellés du Calendrier se créent et se suppriment DANS le banc ; une visite ou
      // une tâche glissée d'un jour à l'autre y change de jour pour de bon — sans quoi
      // l'écriture « réussissait » sans rien changer, et « Aujourd'hui », qui relit les
      // mêmes tables, la montrait encore à son ancienne place.
      // `contacts` aussi : un visiteur créé depuis « Planifier une visite » doit exister ensuite.
      ecrivables: ['calendar_labels', 'visits', 'reminders', 'calendar_events', 'contact_notes', 'contacts'],
      // Une note ajoutée dans le banc est signée de l'agent de démonstration, comme la base
      // la signerait de l'appelant — sinon elle n'aurait ni auteur ni « Modifier ».
      completions: {
        contact_notes: () => ({ author_id: AGENT_BANC.id, author_kind: 'user', updated_at: null, author: { full_name: AGENT_BANC.full_name } }),
        // Le banc n'applique pas `select` : sans la jointure portée par la ligne, une visite
        // posée depuis la fiche d'un bien s'y affichait sans nom de visiteur.
        visits: (l) => {
          const c = (CRM_TABLES.contacts as { id: string; first_name: string; last_name: string }[]).find((x) => x.id === l.contact_id)
          return c ? { contact: { first_name: c.first_name, last_name: c.last_name } } : {}
        },
      },
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

  // `?entree=/dashboard/…` ouvre le banc directement sur une route — la seule façon
  // d'atteindre celles qu'aucun lien interne ne dessert (le rapport KYC s'ouvre par
  // `window.open`, donc HORS du banc). Lue une fois, au montage : le banc est un
  // `MemoryRouter`, l'URL du navigateur ne bouge plus ensuite.
  const entrees = useMemo(() => {
    const entree = new URLSearchParams(window.location.search).get('entree')
    return [entree && entree.startsWith('/dashboard') ? entree : '/dashboard']
  }, [])

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
    {/* ⚠ Les MÊMES drapeaux que le routeur de l'app (`ROUTER_FUTURE`) : sans
        `v7_startTransition`, le banc naviguait de façon synchrone et ne voyait pas
        le remontage des écrans d'onglet que la production subissait. */}
    <MemoryRouter initialEntries={entrees} future={ROUTER_FUTURE}>
      {/* ⛔ `AiPanelProvider` est DANS le routeur, pas au-dessus : il appelle
          `useLocation()`. Posé dans la coquille du banc (`BancCrmAgent`), il
          levait « useLocation() may be used only in the context of a <Router> »
          et rendait un écran BLANC — que `tsc` et `eslint` voyaient verts. */}
      <AiPanelProvider>
        {/* ⚠ La MESSAGERIE ne lit pas `window.fetch` en « Nominal » : ses hooks
            répondent depuis les fixtures de `/dev/messagerie` (une boîte pleine),
            un seul jeu de démonstration pour tous les bancs. En « Vide » et
            « Échec », `null` les rend au réseau — donc à l'interception, qui
            sert zéro ligne ou un 500 : les deux branches réelles de l'écran. */}
        <MailFixturesContext.Provider value={etat === 'nominal' ? 'full' : null}>
        <Suspense fallback={null}>
          <RoutesBanc />
          {/* Au-dessus des routes, comme en production : le panneau persiste
              quand on passe d'une surface à l'autre depuis les commandes. */}
          <CopilotPanel />
          {/* Même rideau d'arrivée que ProtectedRoute : un rechargement du banc montre
              l'écran MEGGA jusqu'à la première peinture, comme `/dashboard`. */}
          <CurtainLift />
        </Suspense>
        </MailFixturesContext.Provider>
        <BootCurtain />
        <Commandes etat={etat} setEtat={setEtat} sansFixture={sansFixture} />
      </AiPanelProvider>
    </MemoryRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
