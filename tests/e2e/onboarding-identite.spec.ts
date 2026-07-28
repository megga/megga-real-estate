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
import { test, expect, type Page } from '@playwright/test'
import { serviceRoleClient } from '../backend/helpers/supabase'

const PW = 'Test-Password-123!'

// Versions COURANTES des CGU/confidentialité (src/lib/consents.ts,
// CURRENT_CONSENT_VERSIONS) — à garder synchronisées avec ce fichier, pas
// d'import direct depuis ici (module app, résolu par Vite, pas par le
// bundler de tests Playwright). Sans consentement déjà enregistré aux
// versions courantes, ConsentGate (monté par ProtectedRoute, migration
// 20260705170000) affiche une modale bloquante à la toute première session
// d'un utilisateur neuf — hors sujet de ce test (gate IDENTITÉ, pas
// consentement) : createFounder() enregistre le consentement à l'avance,
// en écriture directe (service_role, qui contourne RLS comme le reste de
// l'arrangement de ce test — record_consent() exige auth.uid(), donc un
// appelant authentifié, pas service_role), pour ne jamais avoir à composer
// avec cette modale ici.
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
 * Locator d'un champ par son libellé, ancré en DÉBUT de nom accessible. Pour un
 * `<select>`, le nom accessible calculé englobe le texte de l'option
 * actuellement affichée (le placeholder tant que rien n'est choisi) — deux
 * champs de StepAgence.tsx en sont la preuve directe : le placeholder de
 * "Forme juridique" tant que le pays n'est pas choisi est littéralement
 * « Choisissez d'abord le pays du siège », qui contient la sous-chaîne « pays
 * du siège » et fait donc matcher `getByLabel('Pays du siège')` (substring,
 * insensible à la casse par défaut) sur DEUX champs à la fois. Ancrer en
 * préfixe (jamais `exact: true`, qui échouerait aussi — le nom accessible du
 * champ visé n'est justement pas QUE son libellé) lève l'ambiguïté partout,
 * pas seulement sur ce cas observé.
 */
function labelField(page: Page, label: string) {
  return page.getByLabel(new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
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
  await expect(
    page.getByRole('button', { name: 'Reprendre plus tard' }),
    `Coquille du wizard identité absente (bouton "Reprendre plus tard" introuvable) alors que ` +
    `l'URL affiche déjà /dashboard/identite : IdentityShell n'a probablement jamais monté -- ` +
    `AgentSugarLayout boucle sur <Navigate to={IDENTITY_GATE_ROUTE}> au lieu de rendre <Outlet/>. ` +
    `Vérifier le garde-fou 2 (shouldRedirectToIdentityGate) dans useIdentityGate.ts.`,
  ).toBeVisible()
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

      // 3. Saisie des cinq étapes.

      // Étape 0 — signataire.
      await labelField(page, 'Prénom').fill('Jean')
      await labelField(page, 'Nom').fill('Dupont')
      await labelField(page, 'Date de naissance').fill('1980-05-15')
      await labelField(page, 'Nationalité').selectOption('CH')
      await page.getByRole('button', { name: /Signature individuelle/ }).click()
      await page.getByRole('button', { name: 'Continuer' }).click()

      // Étape 1 — agence. CH_SA (« Société anonyme (SA) », catégorie corporation)
      // pour que l'étape bénéficiaires NE soit PAS sautée — le brief exige les
      // cinq étapes, pas quatre.
      await expect(page).toHaveURL(/\/dashboard\/identite$/)
      await labelField(page, 'Pays du siège').selectOption('CH')
      await labelField(page, 'Forme juridique').selectOption({ label: 'Société anonyme (SA)' })
      await labelField(page, 'Raison sociale').fill('Regie Immobiliere Test SA')
      await labelField(page, 'Nom commercial').fill('Regie Test')
      await labelField(page, 'Numéro de registre').fill('CHE-123.456.789')
      // TVA volontairement laissée vide — décision produit du 27.07.2026 (facultative).
      await labelField(page, 'Adresse').fill('10 Rue du Test')
      await labelField(page, 'NPA').fill('1200')
      await labelField(page, 'Ville').fill('Geneve')
      await labelField(page, 'Canton').selectOption('GE')
      await page.getByRole('button', { name: 'Continuer' }).click()

      // Étape 2 — bénéficiaires effectifs. Reprend le signataire déjà saisi (cas
      // central du brief tâche 5 : la même personne peut être signataire ET
      // bénéficiaire) plutôt qu'une ligne vide, pour ne pas resaisir prénom/nom/
      // date de naissance/nationalité déjà connus.
      // "(signataire)" (pas seulement "Reprendre", trop large) : le bouton "Reprendre
      // plus tard" de l'en-tête (sortie de secours, tâche 8) est TOUJOURS présent à
      // ce stade et contient lui aussi "Reprendre" — ambiguïté de mode strict sinon.
      await page.getByRole('button', { name: /\(signataire\)/ }).click()
      await labelField(page, 'Pourcentage de détention').fill('30')
      await page.getByRole('button', { name: /^Non\b/ }).click()
      await page.getByRole('button', { name: 'Continuer' }).click()

      // Étape 3 — pièce d'identité (recto puis verso, ordre fixe dans le DOM).
      const idFile = { name: 'piece-identite.png', mimeType: 'image/png', buffer: Buffer.from(TINY_PNG_BASE64, 'base64') }
      const fileInputs = page.locator('input[type="file"]')
      await fileInputs.nth(0).setInputFiles(idFile)
      await fileInputs.nth(1).setInputFiles(idFile)
      // Attend que les DEUX tuiles confirment le dépôt avant de continuer — c'est
      // aussi ce qui gate le bouton Continuer (isPieceIdentiteStepComplete).
      await expect(page.getByText('Cliquez pour remplacer')).toHaveCount(2)
      await page.getByRole('button', { name: 'Continuer' }).click()

      // Étape 4 — récapitulatif, attestation, soumission.
      await expect(page).toHaveURL(/\/dashboard\/identite$/)
      await page.getByRole('checkbox').check()
      await page.getByRole('button', { name: 'Soumettre le dossier' }).click()

      // 4. Soumission — puis 5. accès au dashboard, sans redirection retour.
      // handleSubmit() navigue via useNavigate() (react-router, déjà client-side).
      await expectNoBounceBack(page, /\/dashboard$/)

      // Preuve backend, pas seulement l'URL du navigateur : la RPC a réellement
      // posé identity_submitted_at (submit_agency_identity, 20260727100000).
      const { data: agencyAfterSubmit } = await serviceRoleClient()
        .from('agencies')
        .select('identity_submitted_at')
        .eq('id', founder.agencyId)
        .maybeSingle()
      expect(agencyAfterSubmit?.identity_submitted_at, 'identity_submitted_at doit être posé après soumission').not.toBeNull()

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
      await labelField(page, 'Prénom').fill('Alice')
      await labelField(page, 'Nom').fill('Martin')
      await labelField(page, 'Date de naissance').fill('1975-02-20')
      await labelField(page, 'Nationalité').selectOption('CH')
      await page.getByRole('button', { name: /Signature collective/ }).click()
      await page.getByRole('button', { name: 'Continuer' }).click()

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
      await expect(page.getByText('Votre dossier reste en attente')).toBeVisible()
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
})
