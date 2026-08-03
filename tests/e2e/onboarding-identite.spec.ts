/**
 * Onboarding KYB — gate + wizard identité, parcours complet (étape 2, tâche 8).
 *
 * C'est le SEUL test qui prouve que le gate (useIdentityGate.ts) ne boucle pas :
 * tout le reste (tests/unit/identity-gate.spec.ts, tests/unit/identity-shell-
 * navigation.spec.ts) n'en est qu'une approximation statique sur des fonctions
 * pures, jamais un vrai cycle connexion -> redirection -> saisie -> soumission ->
 * déconnexion -> reconnexion dans un navigateur réel. Voir l'en-tête de
 * useIdentityGate.ts pour l'incident P0 (commit c830f9a9, « boucle onboarding »)
 * que ces deux garde-fous — et ce test — existent pour rendre impossible.
 *
 * Authentification RÉELLE, pas de mock — nécessaire pour un cycle connexion/
 * déconnexion/reconnexion crédible (sous VITE_DEV_BYPASS_AUTH, useAuth() renvoie
 * toujours le même profil MOCK quel que soit l'état réel de la session, cf.
 * useAuth.tsx : le gate ne verrait jamais le dirigeant réellement inscrit ici).
 * C'est pourquoi ce spec tourne sous playwright.kyb.config.ts (port 5175, pas de
 * bypass, Supabase LOCAL) et non le config principal (voir son testIgnore) — lancer
 * avec `npm run test:e2e:kyb` (nécessite `supabase start`).
 *
 * Second motif : le formulaire de connexion interne a été retiré de cette app (le
 * login vit sur la vitrine externe megga.ch/login, cf. VitrineLoginRedirect dans
 * App.tsx) — il n'y a donc plus d'écran /login à remplir dans ce navigateur. La
 * connexion/déconnexion se fait ici via le client Supabase RÉEL déjà bundlé par
 * l'app (import dynamique du module Vite servi en dev — même singleton que
 * useAuth.tsx importe, cf. signInLive/signOutLive plus bas), pas une session
 * fabriquée à la main : c'est le même signInWithPassword()/signOut() que l'app
 * appelle en production, seul le clic sur un formulaire externe est remplacé.
 *
 * ⚠ Navigation CLIENT-SIDE après la connexion — jamais page.goto()/page.reload()
 * une fois une session établie. Constaté à l'usage (28.07.2026, reproduit à
 * l'identique sur plusieurs runs) : sous cet environnement (Playwright/Chromium +
 * @supabase/supabase-js ^2.99.2), une navigation DURE (page.goto ou page.reload)
 * alors qu'un jeton de session existe déjà dans localStorage laisse
 * supabase.auth.getSession() bloqué indéfiniment — navigator.locks.query() montre
 * un verrou exclusif `lock:sb-127-auth-token` tenu sans jamais se libérer, y
 * compris sur un tout premier chargement avec session pré-injectée (donc sans
 * rapport avec une page précédente). useAuth.tsx documente déjà ce risque
 * ("Safety timeout: if getSession hangs (lock conflicts)") mais son filet de
 * sécurité ne fait que débloquer `loading`, jamais `session`/`profile` — le gate
 * reste alors à 'loading' indéfiniment (fail-open documenté dans
 * useIdentityGate.ts). C'est un verrou du navigateur/de la librairie cliente, pas
 * un défaut du gate applicatif : clientSideNavigate() (history.pushState +
 * 'popstate') fait naviguer React Router SANS jamais redémarrer le client Supabase
 * ni retoucher ce verrou — la seule navigation DURE de tout ce fichier est le tout
 * premier page.goto(), avant qu'aucun jeton n'existe.
 */
import { test, expect, type Locator, type Page } from '@playwright/test'
import { serviceRoleClient } from '../backend/helpers/supabase'

const PW = 'Test-Password-123!'

// Version COURANTE des CGU/confidentialité — celle de la table
// `legal_document_versions` (migration 20260731210000), à garder synchronisée
// avec ce fichier : pas d'import possible depuis ici, et une lecture en base
// alourdirait un helper qui tourne pour chaque fondateur. Sans consentement
// déjà enregistré à cette version, ConsentGate (monté par ProtectedRoute)
// prend tout l'écran à la toute première session d'un utilisateur neuf — hors
// sujet de ce test (gate IDENTITÉ, pas consentement) : createFounder()
// enregistre le consentement à l'avance, en écriture directe (service_role,
// qui contourne RLS comme le reste de l'arrangement de ce test —
// record_consent() exige auth.uid(), donc un appelant authentifié, pas
// service_role), pour ne jamais avoir à composer avec cet écran ici.
const CURRENT_CONSENT_VERSION = '2026-07'

// Page interne SANS authentification (cf. "Dev showcase routes (no auth)" dans
// App.tsx) : sert à charger le bundle de l'app (donc le module
// /src/lib/supabase.ts) sans jamais passer par ProtectedRoute — se connecter ou
// se déconnecter alors qu'on est monté SOUS /dashboard/* déclencherait la
// redirection externe de ProtectedRoute (window.location.replace vers
// megga.ch/login dès que `user` devient nul), qui ne peut pas aboutir dans cet
// environnement de test. signInLive/signOutLive s'y replient donc TOUJOURS
// (via navigation client-side, cf. en-tête) avant de toucher à la session.
const NEUTRAL_PAGE = '/design-system/megga-x'

// Plus petit PNG valide (1x1, transparent) — le contenu importe peu ici : seuls
// le content-type (image/png, accepté par validateIdentityDocumentFile) et le
// dépôt réel dans Storage sous le préfixe kyb-identity sont ce que ce test vérifie.
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

interface Founder {
  id: string
  email: string
  agencyId: string
}

/** Forme minimale du module réel importé dynamiquement dans le navigateur (cf. signInLive/signOutLive) — ce n'est pas un mock, seulement le sous-ensemble typé de src/lib/supabase.ts utilisé ici. */
interface SupabaseAuthModule {
  supabase: {
    auth: {
      signInWithPassword: (creds: { email: string; password: string }) => Promise<{ error: { message: string } | null }>
      signOut: () => Promise<{ error: { message: string } | null }>
    }
  }
}

/**
 * Provisionne un dirigeant dont l'agence n'a PAS soumis son identité : inscription
 * réelle (role='agent' en métadonnée -> handle_new_user()/provision_solo_agency()
 * le pose admin de sa propre agence solo, identity_submitted_at nul par défaut),
 * jamais une agence fabriquée à la main — même motif que signUpFounder() dans
 * tests/backend/agency-identity-submit.spec.ts, dont ce test réutilise la logique
 * (sans le helper lui-même : celui-là signe aussi in via un client Node, ce dont ce
 * spec n'a pas besoin — la connexion se fait dans le navigateur, cf. signInLive).
 */
async function createFounder(): Promise<Founder> {
  const svc = serviceRoleClient()
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const email = `kyb-e2e-${stamp}@megga-test.local`
  const { data, error } = await svc.auth.admin.createUser({
    email,
    password: PW,
    email_confirm: true,
    user_metadata: { full_name: `Dirigeant E2E ${stamp}`, role: 'agent' },
  })
  if (error) throw new Error(`createUser: ${error.message}`)
  const id = data.user!.id

  const { data: prof } = await svc.from('profiles').select('agency_id').eq('id', id).maybeSingle()
  if (!prof?.agency_id) throw new Error('provisioning: aucune agence solo créée pour ce fondateur')

  // Cf. CURRENT_CONSENT_VERSION ci-dessus : évite la modale ConsentGate,
  // hors sujet de ce test.
  const { error: consentErr } = await svc.from('user_consents').insert([
    { user_id: id, consent_type: 'terms', version: CURRENT_CONSENT_VERSION },
    { user_id: id, consent_type: 'privacy', version: CURRENT_CONSENT_VERSION },
  ])
  if (consentErr) throw new Error(`user_consents seed: ${consentErr.message}`)

  return { id, email, agencyId: prof.agency_id as string }
}

/**
 * Nettoyage best-effort — même motif que agency-identity-submit.spec.ts (les
 * erreurs sont avalées : une agence dont l'identité a été soumise laisse une ligne
 * activity_events append-only, cf. progress.md, ce qui peut empêcher la suppression
 * de l'agence ; ce n'est pas ce que ce test vérifie).
 */
async function deleteFounder(founder: Founder): Promise<void> {
  const svc = serviceRoleClient()
  await svc.auth.admin.deleteUser(founder.id).then(() => {}, () => {})
  await svc.from('agencies').delete().eq('id', founder.agencyId).then(() => {}, () => {})
}

/**
 * Navigation CLIENT-SIDE (React Router, via l'historique du navigateur) — jamais
 * une navigation dure. Voir l'en-tête du fichier : c'est ce qui permet de changer
 * de route une fois authentifié sans jamais retoucher le verrou de session de
 * supabase-js. `popstate` est l'événement que <BrowserRouter> écoute pour détecter
 * un changement d'URL déclenché hors de ses propres <Link>/navigate().
 */
async function clientSideNavigate(page: Page, path: string): Promise<void> {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
}

/**
 * Locator d'un champ par son libellé, ancré en DÉBUT de libellé.
 *
 * L'ancrage protégeait à l'origine d'un piège qui n'existe plus : les étapes
 * ENVELOPPAIENT leur contrôle dans le `<label>`, dont le texte englobait alors
 * l'option affichée d'un `<select>` — le placeholder « Choisissez d'abord le
 * pays du siège » de "Forme juridique" contient « pays du siège » et faisait
 * matcher `getByLabel('Pays du siège')` sur DEUX champs. Depuis la peau MEGGA X,
 * MxField rend un `<label for>` FRÈRE du contrôle (cf. son en-tête) : le texte
 * du libellé est désormais le libellé seul, rien d'autre.
 *
 * L'ancrage reste nécessaire pour une autre raison, elle toujours vraie :
 * `getByLabel` cherche une SOUS-CHAÎNE insensible à la casse, donc « Nom »
 * matcherait aussi « Prénom ». Toujours pas `exact: true` en revanche —
 * plusieurs libellés visés sont des préfixes voulus.
 */
function labelField(page: Page, label: string) {
  return page.getByLabel(new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
}

/**
 * Coche un choix exclusif (radio) ou une case, puis affirme qu'il est bien coché.
 *
 * Pourquoi passer par le `<label>` plutôt que cliquer le contrôle : sous la peau
 * MEGGA X, MxRadio/MxCheckbox masquent l'input natif sous la pastille dessinée
 * (`opacity: 0; position: absolute; z-index: -1`, transcription du custom
 * radio/checkbox Webflow de la vitrine). Playwright le tient pour visible — sa
 * boîte n'est pas vide — mais le contrôle de cible du clic résout sur le
 * `<label>` qui l'enveloppe, jamais sur l'input : un `.click()`/`.check()`
 * direct échouerait en « intercepts pointer events ». On clique donc ce qu'un
 * agent clique, la carte-étiquette, et on vérifie l'état obtenu — plus fort que
 * l'ancien `.click()` sur un `<button aria-pressed>`, qui n'affirmait rien après
 * coup. Le contrôle reste identifié par son rôle et son nom accessible.
 */
async function checkByLabel(page: Page, control: Locator): Promise<void> {
  await page.locator('label').filter({ has: control }).click()
  await expect(control).toBeChecked()
}

/**
 * Connexion RÉELLE, TOUJOURS depuis la page neutre (cf. NEUTRAL_PAGE) — en
 * navigation CLIENT-SIDE si une session existe déjà dans ce contexte navigateur
 * (reconnexion), en navigation dure seulement au tout premier appel du test (page
 * vierge, aucun jeton en storage, donc aucun risque de verrou — cf. en-tête).
 * Appelle le VRAI supabase.auth.signInWithPassword() du module bundlé par l'app
 * (import dynamique de l'URL que Vite sert en dev pour src/lib/supabase.ts — le
 * même singleton que useAuth.tsx importe, donc le même onAuthStateChange se
 * déclenche immédiatement, sans jamais redémarrer le client). C'est le
 * remplacement direct du formulaire de connexion qui n'existe plus dans cette app
 * (cf. en-tête du fichier) — jamais une session fabriquée à la main.
 */
async function signInLive(page: Page, email: string, password: string, { firstEver = false } = {}): Promise<void> {
  if (firstEver) {
    await page.goto(NEUTRAL_PAGE)
  } else {
    await clientSideNavigate(page, NEUTRAL_PAGE)
  }
  const errorMessage = await page.evaluate(
    async ({ email, password }) => {
      const mod = (await import('/src/lib/supabase.ts')) as unknown as { supabase: SupabaseAuthModule['supabase'] }
      const { error } = await mod.supabase.auth.signInWithPassword({ email, password })
      return error?.message ?? null
    },
    { email, password },
  )
  expect(errorMessage, `signInWithPassword a échoué: ${errorMessage}`).toBeNull()
}

/**
 * Déconnexion RÉELLE — toujours depuis la page neutre, en navigation CLIENT-SIDE
 * (cf. signInLive et l'en-tête du fichier).
 */
async function signOutLive(page: Page): Promise<void> {
  await clientSideNavigate(page, NEUTRAL_PAGE)
  await page.evaluate(async () => {
    const mod = (await import('/src/lib/supabase.ts')) as unknown as { supabase: SupabaseAuthModule['supabase'] }
    await mod.supabase.auth.signOut()
  })
}

/**
 * Assertion négative : `pattern` doit rester vrai après un court délai — c'est la
 * seule façon de prouver l'ABSENCE d'une redirection qui reviendrait (rien à
 * attendre positivement dans ce cas précis, cf. brief tâche 8 : « écris-le pour
 * qu'il échoue si le gate boucle »).
 */
async function expectNoBounceBack(page: Page, pattern: RegExp): Promise<void> {
  await expect(page).toHaveURL(pattern)
  await page.waitForTimeout(1500)
  await expect(page).toHaveURL(pattern)
}

/**
 * Assertion intermédiaire entre l'arrivée sur le wizard et la première saisie
 * (revue tâche 8, point 1) : sans elle, casser le garde-fou 2
 * (shouldRedirectToIdentityGate, useIdentityGate.ts) et casser un état de
 * chargement SANS RAPPORT (ex. useAgencyIdentity().isLoading qui ne résout
 * jamais) produisent le MÊME échec — un simple timeout générique sur le
 * premier `.fill()` plus bas, indiscernable sans ouvrir la trace Playwright
 * (que personne n'ouvre en pratique). Le repère choisi ici (bouton "Reprendre
 * plus tard", header d'IdentityShell) ne dépend QUE du montage du composant,
 * jamais de son chargement interne : `isLoading` (useAgencyIdentity) ne gate
 * que le <main> d'IdentityShell, jamais son <header> (cf. IdentityShell.tsx,
 * le header est rendu avant le `isLoading ? spinner : ...` du <main>). Son
 * absence ici ne peut donc pas venir d'un chargement lent : elle signe
 * qu'IdentityShell n'a jamais été monté du tout, ce qui n'arrive que si
 * AgentSugarLayout rend en boucle <Navigate to={IDENTITY_GATE_ROUTE}> à la
 * place de <Outlet/> alors que l'URL affiche déjà /dashboard/identite (cf.
 * AgentSugarLayout.tsx) — exactement le garde-fou 2 qui aurait régressé.
 */
async function expectWizardShellMounted(page: Page): Promise<void> {
  // Écran d'arrivée (01.08.2026) : depuis IdentityWelcomeScreen, un dirigeant qui
  // n'a RIEN saisi voit d'abord une explication à la place de la coquille, et le
  // wizard ne monte qu'après « Identifier mon agence ». Les parcours qui reviennent
  // avec des données déjà validées ne le voient pas — d'où un franchissement
  // CONDITIONNEL (cf. shouldShowIdentityWelcome dans IdentityShell.tsx).
  //
  // On attend l'UN OU L'AUTRE des deux repères avant de trancher : tester la
  // visibilité tout de suite lirait un écran encore en chargement (le gate tient
  // l'écran d'arrivée tant qu'il n'a pas résolu son statut) et conclurait à tort
  // qu'il n'y a pas d'écran à franchir.
  //
  // Le repère de la coquille est ici le RAIL D'ÉTAPES, et non « Reprendre plus
  // tard » : depuis la peau MEGGA X, l'écran d'arrivée porte lui aussi ce libellé
  // en <button> (MxLink sans href — il l'écrivait en <a href="#"> auparavant, ce
  // que la refonte a corrigé : l'action ne navigue pas). `or()` résoudrait donc
  // DEUX nœuds sur l'écran d'arrivée, violation de mode strict. Le rail, lui,
  // n'existe que dans la coquille, et il partage la propriété qui compte ici avec
  // le header : rendu HORS du `isLoading ? … : …`, qui ne gate que <main>. Son
  // absence signe donc toujours un IdentityShell jamais monté, jamais un
  // chargement interne lent.
  const commencer = page.getByRole('button', { name: 'Identifier mon agence' })
  const railEtapes = page.getByRole('navigation', { name: 'Étapes' })
  await expect(
    commencer.or(railEtapes),
    'ni l\'écran d\'arrivée ni la coquille du wizard ne se sont montrés sur /dashboard/identite',
  ).toBeVisible()
  if (await commencer.isVisible()) await commencer.click()

  await expect(
    page.getByRole('button', { name: 'Reprendre plus tard' }),
    `Coquille du wizard identité absente (bouton "Reprendre plus tard" introuvable) alors que ` +
    `l'URL affiche déjà /dashboard/identite : IdentityShell n'a probablement jamais monté -- ` +
    `AgentSugarLayout boucle sur <Navigate to={IDENTITY_GATE_ROUTE}> au lieu de rendre <Outlet/>. ` +
    `Vérifier le garde-fou 2 (shouldRedirectToIdentityGate) dans useIdentityGate.ts.`,
  ).toBeVisible()
}

/**
 * Champs de l'étape 0 (signataire) — mêmes noms que SignataireDraft (IdentityShell.tsx).
 * Factorisée (revue finale, lot 3) : les trois parcours de ce fichier remplissent cette
 * étape à l'identique, seules les valeurs varient.
 */
interface SignataireFixture {
  firstName: string
  lastName: string
  dateOfBirth: string
  nationality: string
  signaturePower: 'individual' | 'joint'
}

/** Remplit et valide (Continuer) l'étape 0, commune aux trois parcours de ce fichier. */
async function fillSignataireStep(page: Page, s: SignataireFixture): Promise<void> {
  await labelField(page, 'Prénom').fill(s.firstName)
  await labelField(page, 'Nom').fill(s.lastName)
  await labelField(page, 'Date de naissance').fill(s.dateOfBirth)
  await labelField(page, 'Nationalité').selectOption(s.nationality)
  // Rôle 'radio' et non 'button' : les deux pouvoirs de signature étaient rendus
  // par une paire de <button aria-pressed>, ils sont devenus un vrai groupe de
  // radios (SignaturePowerCard, StepSignataire.tsx). Le choix étant exclusif,
  // c'est le rôle juste — le test suit, il n'y a rien à faire régresser. Nom
  // accessible ÉLARGI au passage : le <label> du radio porte le titre ET la
  // précision, d'où une regex (sous-chaîne) plutôt qu'un libellé entier.
  const powerLabel = s.signaturePower === 'individual' ? /Signature individuelle/ : /Signature collective/
  await checkByLabel(page, page.getByRole('radio', { name: powerLabel }))
  await page.getByRole('button', { name: 'Continuer' }).click()
}

/**
 * Champs de l'étape 1 (agence) communs aux parcours qui la remplissent en entier dans
 * ce fichier — toujours en Suisse (seul pays exercé ici). « Nom commercial » et
 * « Numéro de TVA » ne figurent plus ici parce qu'ils ont quitté l'étape le
 * 03.08.2026 (décision client), pas parce que ce test les omettrait.
 * `legalFormLabel` est le libellé AFFICHÉ dans le menu déroulant, pas un code : c'est le
 * SEUL champ qui distingue le parcours société anonyme du parcours raison individuelle.
 * Il ne commande plus aucune bifurcation depuis le retrait de l'étape « bénéficiaires
 * effectifs » (03.08.2026) — les deux formes suivent désormais les mêmes quatre étapes.
 */
interface AgenceFixture {
  legalFormLabel: string
  legalName: string
  registrationNumber: string
  address: string
  postal: string
  city: string
  canton: string
}

/**
 * Remplit et valide (Continuer) l'étape 1. N'affirme délibérément pas quelle étape suit
 * ensuite : selon `legalFormLabel`, c'est soit les bénéficiaires effectifs, soit
 * directement la pièce d'identité (cf. l'en-tête d'AgenceFixture) — vérifier où l'on
 * atterrit reste la responsabilité de l'appelant.
 */
async function fillAgenceStep(page: Page, a: AgenceFixture): Promise<void> {
  await labelField(page, 'Pays du siège').selectOption('CH')
  await labelField(page, 'Forme juridique').selectOption({ label: a.legalFormLabel })
  await labelField(page, 'Raison sociale').fill(a.legalName)
  await labelField(page, 'Numéro de registre').fill(a.registrationNumber)
  await labelField(page, 'Adresse').fill(a.address)
  // Échap referme la liste de suggestions d'adresse (MxAddressAutocomplete,
  // branché sur geo.admin.ch depuis le 03.08.2026) : elle s'ouvre au-dessus de la
  // rangée NPA / Ville / Canton, et sans ce geste le clic suivant atterrirait
  // dessus au lieu du champ visé. Saisie libre volontaire ici plutôt qu'un choix
  // dans la liste : faire dépendre ce test d'un service externe le rendrait
  // instable en CI, alors que ce qu'il éprouve est le gate, pas l'autocomplétion.
  await page.keyboard.press('Escape')
  await labelField(page, 'NPA').fill(a.postal)
  await labelField(page, 'Ville').fill(a.city)
  await labelField(page, 'Canton').selectOption(a.canton)
  await page.getByRole('button', { name: 'Continuer' }).click()
}

/**
 * Dépose recto puis verso (ordre fixe dans le DOM, toujours 'piece-identite.png' donc
 * 'recto.png'/'verso.png' une fois dans Storage, cf. extensionOfFile dans
 * useAgencyIdentity.ts) et valide (Continuer) l'étape pièce d'identité — jamais sautée,
 * à la différence des bénéficiaires effectifs, donc commune à tout parcours qui va
 * jusqu'à la soumission dans ce fichier.
 */
async function fillPieceIdentiteStep(page: Page): Promise<void> {
  const idFile = { name: 'piece-identite.png', mimeType: 'image/png', buffer: Buffer.from(TINY_PNG_BASE64, 'base64') }
  const fileInputs = page.locator('input[type="file"]')
  await fileInputs.nth(0).setInputFiles(idFile)
  await fileInputs.nth(1).setInputFiles(idFile)
  // Attend que les DEUX tuiles confirment le dépôt avant de continuer — c'est aussi ce
  // qui gate le bouton Continuer (isPieceIdentiteStepComplete).
  await expect(page.getByText('Cliquez pour remplacer')).toHaveCount(2)
  await page.getByRole('button', { name: 'Continuer' }).click()
}

/**
 * Coche l'attestation d'exactitude et soumet depuis le récapitulatif (dernière étape).
 * Toujours la SEULE case de l'écran, d'où le rôle sans nom ; le clic passe par son
 * étiquette (cf. checkByLabel — MxCheckbox masque l'input natif).
 */
async function submitRecapitulatif(page: Page): Promise<void> {
  await checkByLabel(page, page.getByRole('checkbox'))
  await page.getByRole('button', { name: 'Soumettre le dossier' }).click()
}

test.describe('Onboarding KYB — gate et wizard identité', () => {
  test('parcours complet : connexion, gate, cinq étapes, soumission, dashboard, déconnexion, reconnexion sans reboucle', async ({ page }) => {
    const founder = await createFounder()
    try {
      // 1. Connexion d'un dirigeant dont l'agence n'a pas soumis son identité —
      // tout premier chargement de ce test, navigation dure légitime (page vierge).
      await signInLive(page, founder.email, PW, { firstEver: true })

      // 2. Redirection automatique vers le wizard depuis n'importe quelle page du
      // CRM — /dashboard/contacts, pas l'index /dashboard, pour ne pas laisser un
      // cas particulier de la route racine faire passer ce test à tort.
      await clientSideNavigate(page, '/dashboard/contacts')
      await expect(page).toHaveURL(/\/dashboard\/identite$/)
      // Revue tâche 8, point 1 : la coquille doit avoir réellement monté avant
      // la première saisie, cf. expectWizardShellMounted ci-dessus.
      await expectWizardShellMounted(page)

      // 3. Saisie des quatre étapes.

      // Étape 0 — signataire.
      await fillSignataireStep(page, {
        firstName: 'Jean', lastName: 'Dupont', dateOfBirth: '1980-05-15', nationality: 'CH', signaturePower: 'individual',
      })

      // Étape 1 — agence.
      await expect(page).toHaveURL(/\/dashboard\/identite$/)
      await fillAgenceStep(page, {
        legalFormLabel: 'Société anonyme (SA)',
        legalName: 'Regie Immobiliere Test SA',
        registrationNumber: 'CHE-123.456.789',
        address: '10 Rue du Test',
        postal: '1200',
        city: 'Geneve',
        canton: 'GE',
      })

      // Étape 2 — pièce d'identité (recto puis verso, ordre fixe dans le DOM).
      await fillPieceIdentiteStep(page)

      // Étape 3 — récapitulatif, attestation, soumission.
      await expect(page).toHaveURL(/\/dashboard\/identite$/)
      await submitRecapitulatif(page)

      // 4. Soumission — puis 5. accès au dashboard, sans redirection retour.
      // handleSubmit() navigue via useNavigate() (react-router, déjà client-side).
      await expectNoBounceBack(page, /\/dashboard$/)

      // Preuve backend, pas seulement l'URL du navigateur : la RPC a réellement
      // posé identity_submitted_at (submit_agency_identity, 20260728108000).
      const { data: agencyAfterSubmit } = await serviceRoleClient()
        .from('agencies')
        .select('identity_submitted_at')
        .eq('id', founder.agencyId)
        .maybeSingle()
      expect(agencyAfterSubmit?.identity_submitted_at, 'identity_submitted_at doit être posé après soumission').not.toBeNull()

      // Revue finale (lot 2). handleSubmit() (IdentityShell.tsx) transmet signatoryId à
      // submit() comme p_related_person_id : c'est cet argument, et lui seul, qui
      // déclenche la pose de la ligne agency_person_verification_checks pour la pièce
      // déposée à l'étape 3 (submit_agency_identity, 20260728110000). S'il devenait nul,
      // le dossier partirait quand même soumis (pièces déposées, identity_submitted_at
      // posé comme prouvé ci-dessus), mais sans aucune ligne de vérification : personne
      // ne serait jamais alerté de relire la pièce. Le signataire est ici l'unique
      // bénéficiaire effectif (reprend le signataire, étape 2 plus haut) : une seule
      // ligne agency_related_persons existe pour cette agence, .single() la retrouve
      // sans ambiguïté.
      const { data: signatoryRow, error: signatoryRowErr } = await serviceRoleClient()
        .from('agency_related_persons')
        .select('id')
        .eq('agency_id', founder.agencyId)
        .single()
      expect(signatoryRowErr).toBeNull()
      const signatoryId = signatoryRow!.id as string

      const { data: idDocumentCheck, error: idDocumentCheckErr } = await serviceRoleClient()
        .from('agency_person_verification_checks')
        .select('check_type, source, result')
        .eq('related_person_id', signatoryId)
        .maybeSingle()
      expect(idDocumentCheckErr).toBeNull()
      expect(
        idDocumentCheck?.check_type,
        'submit_agency_identity doit poser une ligne agency_person_verification_checks pour le signataire dont la pièce a été déposée',
      ).toBe('id_document')
      expect(idDocumentCheck?.source, 'aucun prestataire automatique à ce stade : source=manual').toBe('manual')
      expect(idDocumentCheck?.result, 'en attente de revue humaine, jamais un verdict automatique').toBe('pending_manual_review')

      // Et les deux faces déposées à l'étape 3 existent réellement dans Storage, sous le
      // préfixe réservé (identityDocumentFolder, useAgencyIdentity.ts) : pas seulement une
      // ligne DB, c'est le fichier lui-même que la revue humaine doit pouvoir rouvrir.
      // Extension 'png' : fillPieceIdentiteStep dépose toujours 'piece-identite.png'
      // (extensionOfFile la reprend telle quelle, useAgencyIdentity.ts).
      const kybIdentityFolder = `${founder.agencyId}/kyb-identity/${signatoryId}`
      const { data: storedFiles, error: storedFilesErr } = await serviceRoleClient()
        .storage.from('documents')
        .list(kybIdentityFolder)
      expect(storedFilesErr).toBeNull()
      expect(storedFiles?.some((f) => f.name === 'recto.png'), 'le recto déposé à l\'étape 3 doit exister dans Storage').toBe(true)
      expect(storedFiles?.some((f) => f.name === 'verso.png'), 'le verso déposé à l\'étape 3 doit exister dans Storage').toBe(true)

      // 6. Déconnexion, reconnexion, absence de nouvelle redirection.
      await signOutLive(page)
      await signInLive(page, founder.email, PW)
      await clientSideNavigate(page, '/dashboard')
      // C'est LA vérification anti-boucle : si le garde-fou (shouldRedirectToIdentityGate,
      // useIdentityGate.ts) régressait, cette navigation se terminerait ailleurs qu'à
      // /dashboard (renvoyé au wizard alors que l'identité est déjà soumise) —
      // expectNoBounceBack échoue dans les deux cas : mauvaise URL immédiate, ou
      // rebond après coup.
      await expectNoBounceBack(page, /\/dashboard$/)
    } finally {
      await deleteFounder(founder)
    }
  })

  test('sortie de secours : quitter en cours de saisie, écran d\'attente, revenir, données conservées', async ({ page }) => {
    const founder = await createFounder()
    try {
      await signInLive(page, founder.email, PW, { firstEver: true })
      await clientSideNavigate(page, '/dashboard')
      await expect(page).toHaveURL(/\/dashboard\/identite$/)
      // Revue tâche 8, point 1 — même garde-fou que le premier test.
      await expectWizardShellMounted(page)

      // Étape 0 — remplie et VALIDÉE (Continuer), donc persistée en base : c'est
      // ce dont ce test doit prouver la survie à un démontage/remontage complet
      // du wizard (pas seulement à un aller-retour d'état React en mémoire).
      await fillSignataireStep(page, {
        firstName: 'Alice', lastName: 'Martin', dateOfBirth: '1975-02-20', nationality: 'CH', signaturePower: 'joint',
      })

      // Étape 1 — saisie PARTIELLE, jamais validée par Continuer : ne doit rien
      // persister (persistCurrentStep refuse d'écrire un brouillon incomplet), à
      // dessein pour distinguer ce qui est réellement garanti (le déjà-validé) de
      // ce qui ne l'est pas.
      await expect(page).toHaveURL(/\/dashboard\/identite$/)
      await labelField(page, 'Raison sociale').fill('Brouillon Jamais Sauvegarde SA')

      // Sortie de secours : jamais de redirection vers /dashboard (qui boucle),
      // reste sur /dashboard/identite — écran d'attente lisible en place du wizard.
      await page.getByRole('button', { name: 'Reprendre plus tard' }).click()
      await expect(page).toHaveURL(/\/dashboard\/identite$/)
      // Titre raccourci par la refonte (gate.pendingNotice.title, fr/onboarding.json) —
      // et le sur-titre en majuscules « Saisie interrompue » qui l'accompagnait a
      // disparu avec la clé gate.pendingNotice.eyebrow.
      await expect(page.getByText('Votre saisie est en pause')).toBeVisible()
      await expect(labelField(page, 'Raison sociale')).not.toBeVisible()

      // Revenir (sans démonter) : le brouillon en mémoire de l'étape 1 encore en
      // cours est retrouvé tel quel — bascule purement locale, rien n'a été perdu
      // puisque rien n'a été démonté.
      await page.getByRole('button', { name: 'Reprendre la saisie' }).click()
      await expect(labelField(page, 'Raison sociale')).toHaveValue('Brouillon Jamais Sauvegarde SA')

      // Sortie de secours à nouveau, puis un VRAI démontage/remontage du wizard —
      // seule façon de prouver que la persistance vient des tables KYB (source de
      // vérité, cf. en-tête d'IdentityShell.tsx) et non seulement de l'état React
      // en mémoire. Navigation client-side (jamais page.reload(), cf. en-tête du
      // fichier) vers la page neutre puis retour : IdentityShell quitte
      // entièrement l'arbre React (route non affichée) puis remonte à neuf.
      await page.getByRole('button', { name: 'Reprendre plus tard' }).click()
      await clientSideNavigate(page, NEUTRAL_PAGE)
      await expect(page).toHaveURL(new RegExp(`${NEUTRAL_PAGE}$`))
      await clientSideNavigate(page, '/dashboard')

      // Le gate redirige de nouveau vers le wizard (toujours pas soumis) ; l'étape 0
      // — réellement persistée par le Continuer plus haut — est retrouvée telle
      // quelle. L'étape 1, jamais validée, est repartie de zéro (EMPTY_AGENCY_DRAFT) :
      // ce n'est pas un manque, c'est exactement ce que persistCurrentStep garantit.
      await expect(page).toHaveURL(/\/dashboard\/identite$/)
      // Revue tâche 8, point 1 — même garde-fou après le démontage/remontage réel.
      await expectWizardShellMounted(page)
      await expect(labelField(page, 'Prénom')).toHaveValue('Alice')
      await expect(labelField(page, 'Nom')).toHaveValue('Martin')
    } finally {
      await deleteFounder(founder)
    }
  })

  /**
   * Le client de référence est une RAISON INDIVIDUELLE, pas une société anonyme —
   * or les deux tests ci-dessus passent tous deux par une SA. Ce test parcourt donc
   * le wizard avec la forme juridique réellement visée, jusqu'à la soumission.
   *
   * ⚠ Ce test prouvait AUTRE CHOSE jusqu'au 03.08.2026 : une raison individuelle
   * SAUTAIT l'étape « bénéficiaires effectifs » (le signataire EST l'entité), et il
   * vérifiait les trois volets de ce saut — l'étape jamais atteinte, le rail qui ne
   * la comptait pas, la section absente du récapitulatif. L'étape ayant été retirée
   * du parcours pour TOUT LE MONDE (décision client), il n'y a plus de saut à
   * éprouver : ce chemin n'a plus rien de particulier, et c'est précisément ce que
   * ce test affirme désormais — quatre étapes, comme une société.
   */
  test('raison individuelle (forme du client de référence) : même parcours à quatre étapes, soumission aboutie', async ({ page }) => {
    const founder = await createFounder()
    try {
      await signInLive(page, founder.email, PW, { firstEver: true })
      await clientSideNavigate(page, '/dashboard/contacts')
      await expect(page).toHaveURL(/\/dashboard\/identite$/)
      await expectWizardShellMounted(page)

      // Étape 0 — signataire. Signature individuelle, cohérent avec une raison
      // individuelle : le signataire EST l'entité.
      await fillSignataireStep(page, {
        firstName: 'Marc', lastName: 'Bovay', dateOfBirth: '1985-11-02', nationality: 'CH', signaturePower: 'individual',
      })

      // Étape 1 — agence, en « Raison individuelle » (catégorie sole_proprietorship).
      await expect(page).toHaveURL(/\/dashboard\/identite$/)
      await fillAgenceStep(page, {
        legalFormLabel: 'Raison individuelle',
        legalName: 'Atelier Immobilier Bovay',
        registrationNumber: 'CHE-987.654.321',
        address: '5 Chemin du Test',
        postal: '1201',
        city: 'Geneve',
        canton: 'GE',
      })

      // Le parcours d'une raison individuelle est désormais celui de tout le monde :
      // l'agence mène droit à la pièce d'identité, et le rail compte quatre paliers.
      await expect(page.getByRole('heading', { name: 'Téléversez la pièce d\'identité du signataire' })).toBeVisible()
      await expect(page.getByRole('button', { name: /^\d\.\s/ })).toHaveCount(4)
      await expect(page.getByRole('button', { name: '3. Pièce d\'identité' })).toBeVisible()
      await expect(page.getByRole('button', { name: '4. Récapitulatif' })).toBeVisible()

      await fillPieceIdentiteStep(page)
      await expect(page).toHaveURL(/\/dashboard\/identite$/)

      await submitRecapitulatif(page)
      await expectNoBounceBack(page, /\/dashboard$/)

      // La soumission finale doit aboutir sur ce chemin aussi (même
      // preuve backend que le premier test de ce fichier).
      const { data: agencyAfterSubmit } = await serviceRoleClient()
        .from('agencies')
        .select('identity_submitted_at')
        .eq('id', founder.agencyId)
        .maybeSingle()
      expect(
        agencyAfterSubmit?.identity_submitted_at,
        'identity_submitted_at doit être posé après soumission, y compris pour une raison individuelle',
      ).not.toBeNull()
    } finally {
      await deleteFounder(founder)
    }
  })
  // ─── 4e cas : la boucle de rémédiation (étape 7, tâche 5) ───────────────────────────
  //
  // POURQUOI CE CAS EXISTE, ET POURQUOI IL EST E2E ET NON BACKEND. Le backend prouve déjà
  // que admin_request_agency_correction rouvre le gate et que la resoumission rend la main
  // au moteur (tests/backend/agency-correction-requested.spec.ts). Ce qu'il ne peut PAS
  // prouver, c'est l'absence de reboucle : rouvrir le gate rouvre le chemin de l'incident
  // P0 c830f9a9 (« boucle onboarding »), et une boucle de redirection ne se voit que dans un
  // vrai navigateur. C'est le seul endroit du dépôt qui l'éprouve sur ce chemin-là.
  test('correction demandée : le gate se réouvre, la resoumission aboutit, aucune reboucle', async ({ page }) => {
    const founder = await createFounder()
    try {
      // 1. Un dossier complet, soumis pour de vrai par le wizard — jamais un état posé en
      // service_role : ce test doit partir de ce que le parcours produit réellement.
      await signInLive(page, founder.email, PW, { firstEver: true })
      await clientSideNavigate(page, '/dashboard/contacts')
      await expect(page).toHaveURL(/\/dashboard\/identite$/)
      await expectWizardShellMounted(page)

      await fillSignataireStep(page, {
        firstName: 'Jean', lastName: 'Dupont', dateOfBirth: '1980-05-15', nationality: 'CH', signaturePower: 'individual',
      })
      await fillAgenceStep(page, {
        legalFormLabel: 'Raison individuelle',
        legalName: 'Regie Correction Test',
        registrationNumber: 'CHE-123.456.789',
        address: '10 Rue du Test',
        postal: '1200',
        city: 'Geneve',
        canton: 'GE',
      })
      await fillPieceIdentiteStep(page)
      await submitRecapitulatif(page)
      await expect(page).toHaveURL(/\/dashboard$/)

      // 2. Le relecteur renvoie le dossier. Posé en service_role plutôt qu'en montant une
      // session super-admin dans le navigateur : la console admin a ses propres tests, et
      // ce qui est éprouvé ici est le CRM agent, pas l'écran de revue.
      const svc = serviceRoleClient()
      // Le moteur a pu laisser le dossier en 'pending' (net.http_post ne part pas en local,
      // pg_net absent) : la RPC exige 'manual_review', l'état dans lequel un relecteur le
      // trouve réellement.
      const { error: setStatusErr } = await svc
        .from('agencies')
        .update({ verification_status: 'manual_review' })
        .eq('id', founder.agencyId)
      expect(setStatusErr).toBeNull()

      // L'EFFET de la RPC, écrit directement, et non la RPC elle-même : elle est gardée par
      // is_super_admin(), ce qui demanderait de monter une session super-admin dans ce
      // navigateur pour un test dont le sujet est le CRM AGENT. Son contrat — ce qu'elle
      // écrit, ce qu'elle refuse, ce qu'elle journalise — est vérifié ligne par ligne dans
      // tests/backend/agency-correction-requested.spec.ts. Ce qui est éprouvé ICI, et
      // nulle part ailleurs, c'est ce que le navigateur fait de cet état.
      const { error: correctionErr } = await svc
        .from('agencies')
        .update({
          verification_status: 'correction_requested',
          identity_submitted_at: null,
          verified_at: null,
        })
        .eq('id', founder.agencyId)
      expect(correctionErr, `mise en correction_requested : ${correctionErr?.message}`).toBeNull()

      // 3. Le gate se réouvre — et c'est ICI que la reboucle se verrait. Rechargement dur
      // volontaire : le hook lit identity_submitted_at avec un staleTime de 60 s, un simple
      // clientSideNavigate pourrait servir la valeur d'avant la correction.
      await page.goto('/dashboard/contacts')
      await expect(page).toHaveURL(/\/dashboard\/identite$/)
      await expectWizardShellMounted(page)

      // 3bis. Le bandeau dit CE QUI SE PASSE, et pas « vous n'avez rien soumis ».
      // C'est le fond du nouveau cas de useLabGuard : identity_submitted_at étant remis à
      // NULL, la branche « jamais soumis » répondrait la première si l'ordre des tests du
      // resolveur régressait, et l'écran mentirait à une agence qui a bel et bien soumis.
      await expect(
        page.getByText('Correction demandée', { exact: false }).first(),
        'le bandeau doit annoncer une correction demandée, jamais « non soumise »',
      ).toBeVisible()

      // 4. Resoumission. Le wizard repart de la PREMIÈRE étape — l'étape atteinte n'est pas
      // restaurée après une soumission — mais les données saisies, elles, le sont. Le
      // dirigeant reparcourt donc les écrans, ce qui est aussi l'occasion de relire ce qu'il
      // avait déclaré. Reparcours complet, sans raccourci par le stepper : ses paliers ne
      // sont cliquables qu'en arrière (i < step), donc aucun ne l'est à l'étape 1.
      await expectWizardShellMounted(page)
      await fillSignataireStep(page, {
        firstName: 'Jean', lastName: 'Dupont', dateOfBirth: '1980-05-15', nationality: 'CH', signaturePower: 'individual',
      })
      await fillAgenceStep(page, {
        legalFormLabel: 'Raison individuelle',
        legalName: 'Regie Correction Test',
        // LE champ corrigé : c'est ce que le relecteur avait demandé.
        registrationNumber: 'CHE-105.909.036',
        address: '10 Rue du Test',
        postal: '1200',
        city: 'Geneve',
        canton: 'GE',
      })
      await fillPieceIdentiteStep(page)
      await submitRecapitulatif(page)

      // 5. Retour au CRM, et AUCUNE reboucle : c'est la vérification que ce cas existe pour
      // faire. Si le gate régressait sur ce chemin, cette navigation finirait au wizard.
      await expect(page).toHaveURL(/\/dashboard$/)
      await expectNoBounceBack(page, /\/dashboard$/)

      // 6. Et le dossier a bien rendu la main au moteur.
      const { data: agencyAfter, error: agencyAfterErr } = await serviceRoleClient()
        .from('agencies')
        .select('verification_status, identity_submitted_at')
        .eq('id', founder.agencyId)
        .maybeSingle()
      expect(agencyAfterErr).toBeNull()
      expect(agencyAfter?.identity_submitted_at, 'la resoumission repose l\'horodatage').not.toBeNull()
      expect(
        agencyAfter?.verification_status,
        'sans le retour en pending, le moteur (qui n\'écrase jamais correction_requested) ne '
        + 'recalculerait plus jamais ce dossier',
      ).toBe('pending')

      // 7. Une déconnexion/reconnexion ne renvoie pas au wizard non plus.
      await signOutLive(page)
      await signInLive(page, founder.email, PW)
      await clientSideNavigate(page, '/dashboard')
      await expectNoBounceBack(page, /\/dashboard$/)
    } finally {
      await deleteFounder(founder)
    }
  })
})
