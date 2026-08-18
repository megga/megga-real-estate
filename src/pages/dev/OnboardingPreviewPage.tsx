/**
 * Aperçu du parcours d'onboarding — route `/dev/onboarding`, **DEV UNIQUEMENT**
 * (enregistrée sous `import.meta.env.DEV` dans App.tsx, donc absente du bundle servi).
 *
 * POURQUOI CETTE PAGE EXISTE. Le parcours d'entrée est, en l'état, impossible à
 * ouvrir pour retoucher son front. Trois murs, cumulatifs :
 *   1. tout vit sous `/dashboard`, donc derrière ProtectedRoute — sans session,
 *      la route renvoie sur la page de connexion de la vitrine, hors de l'app ;
 *   2. `useIdentityGate()` EXEMPTE les super-admins, et c'est le rôle du compte de
 *      l'équipe : même connecté, le wizard ne s'affiche pas ;
 *   3. le parcours est à sens unique — `agencies.identity_submitted_at` posé, le gate
 *      rend `'done'` pour toujours et aucun de ces écrans ne se rouvre.
 * Trois écrans (attente, arrivée, sortie de secours) ne sont d'ailleurs pas des
 * routes du tout : ce sont des états locaux d'IdentityShell, qu'aucune URL ne désigne.
 *
 * CE QU'ELLE MONTRE. Les composants RÉELS, jamais des copies : retoucher ce qu'on voit
 * ici retouche le produit. Ce qui est simulé, c'est uniquement la DONNÉE — un cache
 * React Query pré-rempli, dans un client isolé de celui de l'app, plus l'accessoire
 * `preview` d'IdentityShell qui neutralise l'écriture entre étapes (cf. son JSDoc).
 *
 * ⚠ CE QU'ELLE NE PEUT PAS SIMULER : l'étape « Rendez-vous » lit ses créneaux par edge
 * function, sous session. Sans elle, l'étape montre ici son état « rien à réserver ».
 * ⛔ Ce n'est PLUS l'état de la production : un hôte actif y existe depuis le 9 août
 * 2026 (`onboarding_hosts`, lun-ven 09-12 et 14-17, Europe/Zurich). L'aperçu montre donc
 * le cas vide alors que le produit propose des créneaux — pour juger la liste réelle,
 * il faut passer par l'app connectée.
 */
import { useMemo, useState, type ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import IdentityShell, { type IdentityShellPreview } from '@/components/crm-identity/IdentityShell'
import IdentityMobileNotice from '@/pages/agent/IdentityMobileNotice'
import OnboardingCallPage from '@/pages/agent/OnboardingCallPage'
import KycOnboardingPage from '@/pages/agent/KycOnboardingPage'
import type { AgencySettingsData } from '@/hooks/useAgencySettings'
import type { IdentityPersonWithRoles } from '@/hooks/useAgencyIdentity'
import type { OnboardingCallRow } from '@/hooks/useOnboardingCall'
import type { KybIdReadRecord } from '@/types/kybIdRead'

/**
 * `null` et non un uuid : sans session, `useAuth().profile` est null, donc
 * `agencyId` l'est aussi et TOUTES les clés de cache du parcours se terminent par
 * `null`. Semer sous un faux identifiant produirait des entrées que personne ne lit.
 */
const AGENCY_ID = null

/**
 * Formes juridiques — les lignes réelles de `legal_forms`, dont la lecture RLS est
 * réservée aux sessions authentifiées. Les TROIS juridictions que l'étape agence
 * propose, et pas seulement la Suisse : changer de pays du siège dans l'aperçu doit
 * remplir le second sélecteur, sinon on croit à un écran cassé.
 */
const LEGAL_FORMS: Record<string, unknown[]> = {
  CH: [
  { id: 'c69461c4-eb0c-4121-9a22-b222c230f5d8', country: 'CH', category: 'corporation', label_fr: 'Société anonyme (SA)', label_de: 'Aktiengesellschaft (AG)', label_en: 'Public limited company (SA)', label_it: 'Società anonima (SA)', sort_order: 10 },
  { id: '4633ddf2-41b2-4846-9bca-d3146cc536a0', country: 'CH', category: 'corporation', label_fr: 'Société à responsabilité limitée (Sàrl)', label_de: 'Gesellschaft mit beschränkter Haftung (GmbH)', label_en: 'Limited liability company (Sàrl)', label_it: 'Società a garanzia limitata (Sagl)', sort_order: 20 },
  { id: 'bf7779c0-26e5-4ff7-938b-5e9a2aeac88d', country: 'CH', category: 'sole_proprietorship', label_fr: 'Raison individuelle', label_de: 'Einzelunternehmen', label_en: 'Sole proprietorship', label_it: 'Ditta individuale', sort_order: 30 },
  { id: 'ab07289d-233b-44c7-b661-3542a5e99db4', country: 'CH', category: 'partnership', label_fr: 'Société en nom collectif', label_de: 'Kollektivgesellschaft', label_en: 'General partnership', label_it: 'Società in nome collettivo', sort_order: 40 },
  { id: '05205070-78aa-4e9c-aa94-7335323b7907', country: 'CH', category: 'corporation', label_fr: 'Société coopérative', label_de: 'Genossenschaft', label_en: 'Cooperative', label_it: 'Società cooperativa', sort_order: 60 },
    { id: '762c2262-4933-4a36-af93-d0795670536c', country: 'CH', category: 'foundation_or_trust', label_fr: 'Fondation', label_de: 'Stiftung', label_en: 'Foundation', label_it: 'Fondazione', sort_order: 70 },
  ],
  FR: [
    { id: '3c4264d8-d005-48df-9f72-b3040dc872a2', country: 'FR', category: 'corporation', label_fr: 'Société par actions simplifiée (SAS)', label_de: 'Vereinfachte Aktiengesellschaft (SAS)', label_en: 'Simplified joint-stock company (SAS)', label_it: 'Società per azioni semplificata (SAS)', sort_order: 10 },
    { id: '9d8c7da7-3a0e-412d-bdd4-1a04e4c4f452', country: 'FR', category: 'corporation', label_fr: 'Société à responsabilité limitée (SARL)', label_de: 'Gesellschaft mit beschränkter Haftung (SARL)', label_en: 'Limited liability company (SARL)', label_it: 'Società a responsabilità limitata (SARL)', sort_order: 30 },
    { id: '89fb6a39-9d12-46e4-ab57-b83a447e61d9', country: 'FR', category: 'corporation', label_fr: 'Société anonyme (SA)', label_de: 'Aktiengesellschaft (SA)', label_en: 'Public limited company (SA)', label_it: 'Società anonima (SA)', sort_order: 50 },
    { id: '44b344bf-85c2-40f7-88e0-519b53e542ec', country: 'FR', category: 'partnership', label_fr: 'Société civile immobilière (SCI)', label_de: 'Immobilien-Zivilgesellschaft (SCI)', label_en: 'Real estate civil company (SCI)', label_it: 'Società civile immobiliare (SCI)', sort_order: 60 },
    { id: '02cc30de-efeb-4049-a1cf-3eda7bf98f27', country: 'FR', category: 'sole_proprietorship', label_fr: 'Entreprise individuelle (EI)', label_de: 'Einzelunternehmen (EI)', label_en: 'Sole proprietorship (EI)', label_it: 'Impresa individuale (EI)', sort_order: 80 },
  ],
  LI: [
    { id: '36e51f80-8c60-452e-9b3f-006a8fb7a980', country: 'LI', category: 'corporation', label_fr: 'Société anonyme (AG)', label_de: 'Aktiengesellschaft (AG)', label_en: 'Public limited company (AG)', label_it: 'Società anonima (AG)', sort_order: 10 },
    { id: '696c3d08-46e1-4d39-931d-b311b83256dd', country: 'LI', category: 'corporation', label_fr: 'Société à responsabilité limitée (GmbH)', label_de: 'Gesellschaft mit beschränkter Haftung (GmbH)', label_en: 'Limited liability company (GmbH)', label_it: 'Società a garanzia limitata (GmbH)', sort_order: 20 },
    { id: '44a8f866-8ff9-4085-ba67-8deaccff40cd', country: 'LI', category: 'foundation_or_trust', label_fr: 'Établissement (Anstalt)', label_de: 'Anstalt', label_en: 'Establishment (Anstalt)', label_it: 'Stabilimento (Anstalt)', sort_order: 30 },
    { id: 'b7ed5a8b-ba50-498b-810a-1d081dd64c31', country: 'LI', category: 'sole_proprietorship', label_fr: 'Entreprise individuelle', label_de: 'Einzelunternehmen', label_en: 'Sole proprietorship', label_it: 'Impresa individuale', sort_order: 60 },
  ],
}

const AGENCY_FIXTURE: AgencySettingsData = {
  name: 'Agence Lyonnet',
  address: 'Rue du Rhône 42',
  city: 'Genève',
  canton: 'GE',
  phone: '+41 22 555 10 10',
  email: 'contact@agence-lyonnet.ch',
  website: 'https://agence-lyonnet.ch',
  logoUrl: '',
  legal: 'Lyonnet Immobilier SA',
  legalFormId: 'c69461c4-eb0c-4121-9a22-b222c230f5d8',
  tradeName: 'Agence Lyonnet',
  businessRegistrationNumber: 'CHE-123.456.789',
  tva: '',
  foundedYear: '2018',
  postal: '1204',
  country: 'CH',
  aboutShort: '',
}

/** Personne enregistrée à l'étape 1 — sa présence est ce qui fait qu'on n'est plus « à l'arrivée ». */
/**
 * Le verdict de correspondance d'un dossier où la PIÈCE CONTREDIT le nom déclaré.
 *
 * Reproduit le cas réel du 17.08.2026 (changement de nom légal : ancien nom saisi à
 * l'étape 1, pièce au nouveau nom), qui a révélé que le sceau de l'écran de retour se
 * posait sur le seul statut de session. Sans cette fixture, le bandeau d'écart n'est
 * visible sur AUCUN écran du banc — donc invérifiable sans refaire une vraie capture.
 */
const VERDICT_ECART: KybIdReadRecord = {
  provider: 'stripe_identity',
  verdict: 'mismatch',
  fields: { firstName: 'exact', lastName: 'differs', dateOfBirth: 'unreadable' },
  documentTypeMatches: null,
  expiresOn: null,
  expired: null,
}

function signataireFixture(verified: boolean, ecart = false): IdentityPersonWithRoles {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    firstName: 'Gregory',
    lastName: 'Lyonnet',
    dateOfBirth: '1985-03-16',
    nationality: 'CH',
    agencyRole: 'admin',
    roles: [{ role: 'signatory', signaturePower: null, ownershipPct: null, pepSelfDeclared: false }],
    // Ce que le WEBHOOK pose après une vérification : la nature de la pièce lue et
    // l'instant du verdict. Sans eux, la section « Vérification » du récapitulatif se
    // réduit à une ligne de statut et on ne juge pas la forme réelle de la relecture.
    idDocumentType: verified ? 'passport' : null,
    idDocumentRead: ecart ? VERDICT_ECART : null,
    verificationStatus: verified ? 'verified' : null,
    verificationErrorCode: null,
    verifiedAt: verified ? '2026-08-06T09:12:00.000Z' : null,
  }
}

const CALL_FIXTURE: OnboardingCallRow = {
  id: '00000000-0000-4000-8000-000000000002',
  scheduled_at: '2026-08-14T09:00:00.000Z',
  duration_minutes: 30,
  status: 'scheduled',
  host_display_name: 'Équipe MEGGA',
  meeting_url: 'https://meet.google.com/aperçu-dev',
  manage_token: 'apercu-dev',
  rescheduled_count: 0,
}

/**
 * Créneaux d'appel d'accueil, fabriqués pour l'aperçu.
 *
 * Ils NE PEUVENT PAS être semés comme les autres fixtures : la clé de la requête est
 * `['onboarding-slots', from, to, 'session']` où `from` vaut `max(1er du mois, now)`,
 * calculé à la milliseconde au montage d'OcBooking. Impossible de la reconstituer ici.
 * D'où l'abonnement au cache plus bas, qui remplit la requête quelle que soit sa clé.
 *
 * Les instants suivent l'hôte réel de production (lun-ven, 09-12 et 14-17, pas de
 * 30 min) pour que ce qu'on retouche ressemble à ce que l'agence verra.
 */
function slotsFixture(reference: Date): { slots: string[]; duration_minutes: number; pool_empty: boolean; degraded: boolean } {
  const slots: string[] = []
  for (let dayOffset = 1; dayOffset <= 21 && slots.length < 200; dayOffset += 1) {
    const day = new Date(reference)
    day.setDate(day.getDate() + dayOffset)
    const isoDow = day.getDay() === 0 ? 7 : day.getDay()
    if (isoDow > 5) continue
    for (const [startHour, endHour] of [[9, 12], [14, 17]]) {
      for (let h = startHour; h < endHour; h += 1) {
        for (const minutes of [0, 30]) {
          const slot = new Date(day)
          slot.setHours(h, minutes, 0, 0)
          slots.push(slot.toISOString())
        }
      }
    }
  }
  return { slots, duration_minutes: 30, pool_empty: false, degraded: false }
}

/** Ce que le dossier contient au montage — l'axe qui change le plus les écrans. */
type Dossier = 'vierge' | 'rempli' | 'verifie'

/**
 * Client isolé, semé une fois par choix de dossier. `staleTime: Infinity` et
 * `retry: false` sont ce qui garde les fixtures en place : une revalidation partirait
 * sans session, échouerait, et remplacerait un écran rempli par un écran vide.
 */
function makeClient(dossier: Dossier, ecranId: string): QueryClient {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false, refetchOnWindowFocus: false } },
  })
  for (const [code, rows] of Object.entries(LEGAL_FORMS)) client.setQueryData(['legal-forms', code], rows)

  // Les créneaux, remplis À LA VOLÉE. Leur clé porte un horodatage calculé au montage
  // (cf. slotsFixture) : on ne peut pas la deviner, on l'attend. Dès qu'une requête
  // `onboarding-slots` entre dans le cache sans données, on lui en donne — sinon
  // l'étape « Rendez-vous » resterait à « Plus aucun créneau libre », faute de session
  // pour interroger l'edge function, et le calendrier serait le seul écran du parcours
  // qu'on ne pourrait pas retoucher.
  client.getQueryCache().subscribe((event) => {
    const key = event.query?.queryKey
    if (!Array.isArray(key) || key[0] !== 'onboarding-slots') return
    if (event.query.state.data !== undefined) return // déjà servi : ne pas reboucler
    client.setQueryData(key, slotsFixture(new Date()))
  })

  if (dossier === 'vierge') {
    // Rien pour l'agence ni le rendez-vous, délibérément : useAgencySettings n'hydrate
    // son état local que `if (data)`, donc une absence de cache laisse EMPTY_AGENCY en
    // place — alors qu'y semer un objet vide écraserait ce repli par du null.
    client.setQueryData(['agency-identity-persons', AGENCY_ID], [])
    return client
  }
  // L'écran « écart » impose son propre dossier : il n'a de sens que VÉRIFIÉ (c'est le
  // statut qui fait le sceau) ET contredit (c'est le verdict qui le retire). Le laisser
  // dépendre du sélecteur de dossier le rendrait invisible une fois sur deux.
  const ecart = ecranId === 'retour-ecart'
  client.setQueryData(
    ['agency-identity-persons', AGENCY_ID],
    [signataireFixture(ecart || dossier === 'verifie', ecart)],
  )
  client.setQueryData(['agency-settings', AGENCY_ID], { settings: AGENCY_FIXTURE, plan: 'pro', identitySubmittedAt: null })
  // ⛔ NE PAS semer ici la lecture de `useLabGuard` : le bandeau LAB est INMONTRABLE sur
  // ce banc, et ce n'est pas une graine qui manque. Sous `VITE_DEV_BYPASS_AUTH`, le hook
  // n'interroge pas le réseau du tout (`enabled: … && !DEV_BYPASS_AUTH`) et lit
  // `DEV_BYPASS_AGENCY`, qui vaut `validated` — donc « clear », donc rien. Sans bypass,
  // il n'y a aucun profil, donc aucun agencyId, donc la lecture est désactivée. Une
  // graine y serait du code mort dans les deux cas. Le bandeau et son renvoi se
  // vérifient par tests/unit/lab-guard-banner.spec.ts, qui monte le composant.
  // Rendez-vous semé selon l'ÉCRAN, pas selon le dossier — les deux surfaces qui le
  // lisent en veulent l'inverse :
  //   · étape « Rendez-vous » : PAS de réservation, sinon la carte de confirmation
  //     remplace tout le bloc et masque le calendrier ET le formulaire, les deux
  //     surfaces qu'on retouche ;
  //   · « Récapitulatif » : une réservation, sinon la section relit « Aucun rendez-vous »
  //     et on ne voit jamais la forme normale de cette relecture.
  // ⚠ L'étape « Rendez-vous » ne doit PAS voir de réservation en base : la carte de
  // confirmation remplacerait tout le bloc et masquerait le calendrier comme le
  // formulaire, c'est-à-dire les deux surfaces qu'on vient regarder. Le récapitulatif,
  // qui était l'autre lecteur de cette clé, a été retiré le 18.08.2026.
  if (ecranId !== 'step3') client.setQueryData(['onboarding-call', AGENCY_ID], CALL_FIXTURE)
  return client
}

interface Ecran {
  id: string
  label: string
  groupe: string
  /** Ce que la vraie app monte pour cet écran, et par quelle route on y arrive en production. */
  route: string
  render: () => ReactElement
}

function wizard(preview: IdentityShellPreview): () => ReactElement {
  return () => <IdentityShell preview={{ ...preview, skipPersist: true }} />
}

const ECRANS: Ecran[] = [
  { id: 'preparing', label: 'Attente (décision en cours)', groupe: 'Wizard identité', route: '/dashboard/identite', render: wizard({ screen: 'preparing' }) },
  { id: 'welcome', label: 'Arrivée', groupe: 'Wizard identité', route: '/dashboard/identite', render: wizard({ screen: 'welcome' }) },
  { id: 'step0', label: '1. Signataire', groupe: 'Wizard identité', route: '/dashboard/identite', render: wizard({ screen: 'wizard', step: 0 }) },
  { id: 'step1', label: '2. Agence', groupe: 'Wizard identité', route: '/dashboard/identite', render: wizard({ screen: 'wizard', step: 1 }) },
  // « Vérification » et non « Pièce d'identité » : l'étape a été renommée par #1164,
  // le rail du wizard le dit déjà — ce rail-ci ne doit pas raconter autre chose.
  { id: 'step2', label: '3. Vérification', groupe: 'Wizard identité', route: '/dashboard/identite', render: wizard({ screen: 'wizard', step: 2 }) },
  { id: 'step3', label: '4. Rendez-vous', groupe: 'Wizard identité', route: '/dashboard/identite', render: wizard({ screen: 'wizard', step: 3 }) },
  { id: 'exit', label: 'Reprendre plus tard', groupe: 'Wizard identité', route: '/dashboard/identite', render: wizard({ screen: 'exit' }) },
  // Retour du prestataire d'identité. Le sceau ne s'affiche que sur le dossier
  // « Vérifié » : c'est le statut de la personne, pas l'écran, qui le décide.
  { id: 'retour', label: 'Retour de Stripe', groupe: 'Wizard identité', route: '/dashboard/identite?verification=done', render: wizard({ screen: 'verificationReturn' }) },
  // Le MÊME écran, sur un dossier dont la pièce contredit le nom déclaré : pas de sceau,
  // et l'écart nommé. Deux entrées et non un sélecteur, parce que c'est la différence
  // entre les deux qu'il faut pouvoir regarder d'un clic.
  { id: 'retour-ecart', label: 'Retour de Stripe (nom qui diffère)', groupe: 'Wizard identité', route: '/dashboard/identite?verification=done', render: wizard({ screen: 'verificationReturn' }) },
  // ⚠ Le lien Meet de la fixture n'existe PAS en production tant qu'aucun agenda
  // d'hôte n'est branché (cf. l'en-tête d'IdentitySubmittedScreen) : cet aperçu
  // montre donc l'écran dans sa forme COMPLÈTE, celle que #1168 rendra atteignable.
  { id: 'soumis', label: 'Dossier soumis', groupe: 'Wizard identité', route: '/dashboard/identite', render: wizard({ screen: 'submitted' }) },
  { id: 'mobile', label: 'Invitation ordinateur', groupe: 'Mobile (< 768 px)', route: '/dashboard/identite', render: () => <IdentityMobileNotice /> },
  { id: 'call', label: 'Réserver l’appel d’accueil', groupe: 'Après le wizard', route: '/dashboard/rendez-vous-accueil', render: () => <OnboardingCallPage /> },
  { id: 'kyc', label: 'Première ouverture KYC', groupe: 'Après le wizard', route: '/dashboard/kyc/bienvenue', render: () => <KycOnboardingPage /> },
]

const DOSSIERS: { id: Dossier; label: string; aide: string }[] = [
  { id: 'vierge', label: 'Vierge', aide: 'Aucune saisie — champs vides, écran d’arrivée légitime.' },
  { id: 'rempli', label: 'Rempli', aide: 'Signataire et agence saisis, pièce non vérifiée.' },
  { id: 'verifie', label: 'Vérifié', aide: 'Comme « Rempli », plus la pièce vérifiée : le nom se verrouille à la réservation.' },
]

/** Aperçu dev du parcours d'onboarding : un écran à la fois, données simulées. */
export default function OnboardingPreviewPage() {
  const [ecranId, setEcranId] = useState('welcome')
  const [dossier, setDossier] = useState<Dossier>('rempli')

  // `key` sur le provider (plus bas) autant que sur le client : changer de dossier doit
  // REMONTER l'écran, sinon les brouillons locaux d'IdentityShell (hydratés une seule
  // fois, par `existingSignatory?.id`) garderaient la valeur du dossier précédent.
  const client = useMemo(() => makeClient(dossier, ecranId), [dossier, ecranId])
  const ecran = ECRANS.find((e) => e.id === ecranId) ?? ECRANS[0]
  const groupes = [...new Set(ECRANS.map((e) => e.groupe))]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0A0A0F' }}>
      <aside
        style={{
          width: 248, flex: '0 0 248px', padding: '20px 16px', color: '#E7E9EE',
          background: '#111117', borderRight: '1px solid #23232D',
          font: '13px/1.45 "Inter Tight", system-ui, sans-serif',
          position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
        }}
      >
        <p style={{ margin: '0 0 4px', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: '#7C7F8A' }}>
          Aperçu dev
        </p>
        <p style={{ margin: '0 0 18px', fontWeight: 600, fontSize: 15 }}>Parcours d’onboarding</p>

        <p style={{ margin: '0 0 8px', fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: '#7C7F8A' }}>
          Dossier
        </p>
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          {DOSSIERS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDossier(d.id)}
              style={{
                flex: 1, padding: '6px 4px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
                border: `1px solid ${dossier === d.id ? '#424BFB' : '#2A2A35'}`,
                background: dossier === d.id ? '#424BFB' : 'transparent',
                color: dossier === d.id ? '#fff' : '#B7BAC4',
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
        <p style={{ margin: '0 0 20px', fontSize: 11, lineHeight: 1.4, color: '#7C7F8A' }}>
          {DOSSIERS.find((d) => d.id === dossier)?.aide}
        </p>

        {groupes.map((groupe) => (
          <div key={groupe} style={{ marginBottom: 18 }}>
            <p style={{ margin: '0 0 8px', fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: '#7C7F8A' }}>
              {groupe}
            </p>
            {ECRANS.filter((e) => e.groupe === groupe).map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setEcranId(e.id)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', marginBottom: 4,
                  padding: '7px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
                  border: '1px solid transparent',
                  background: ecranId === e.id ? '#1E1E28' : 'transparent',
                  color: ecranId === e.id ? '#fff' : '#B7BAC4',
                }}
              >
                {e.label}
              </button>
            ))}
          </div>
        ))}

        <p style={{ margin: '24px 0 0', fontSize: 11, lineHeight: 1.5, color: '#63666F' }}>
          Route réelle : <code style={{ color: '#8E92A0' }}>{ecran.route}</code>
        </p>
        <p style={{ margin: '8px 0 0', fontSize: 11, lineHeight: 1.5, color: '#63666F' }}>
          Données simulées, aucune écriture en base. « Continuer » ne persiste rien.
        </p>
      </aside>

      <main style={{ flex: 1, minWidth: 0 }}>
        <QueryClientProvider key={`${dossier}-${ecran.id}`} client={client}>
          {ecran.render()}
        </QueryClientProvider>
      </main>
    </div>
  )
}
