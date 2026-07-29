// Backend test (live CI) -- socle de l'Edge Function agency-verification-run
// (etape 4, tache 1 -- supabase/functions/agency-verification-run/index.ts et son
// module partage supabase/functions/_shared/kyb-sources.ts), connecteur RDAP
// (etape 4, tache 2 -- domain_whois_age, premier connecteur reel du registre),
// connecteurs VIES / recherche-entreprises / Mapbox (etape 4, tache 3),
// declenchement + filet de rattrapage (etape 4, tache 4), juridiction d'une source
// (etape 6, tache 1 -- appliesTo / selectApplicableSources, volets 1 et 2 ci-dessous) et
// squelette Zefix (etape 6, tache 2 -- volet 8, en fin de fichier) et squelette du
// registre UID (etape 6, tache 3 -- volet 9, tout en bas, plus la preuve en base du
// volet 2).
//
// Principe directeur de toute l'etape 4 (voir
// docs/superpowers/plans/2026-07-28-onboarding-kyb-etape-4.md, « Le principe qui
// gouverne toute cette etape ») : une source qui ne repond pas produit un check
// `unavailable`, JAMAIS une absence de ligne et JAMAIS un echec. Le moteur
// (recompute_agency_verification, 20260728130000) exclut `unavailable` du
// numerateur et du denominateur -- un pays sans source disponible n'est donc pas
// penalise, seulement moins confirme. Corollaire : ne jamais fabriquer un resultat
// par defaut (un `match` faute de reponse serait une preuve fabriquee par le
// systeme lui-meme).
//
// Neuf volets dans ce fichier :
//   1. Le harnais PUR (_shared/kyb-sources.ts, describe hors skipIf juste sous cet
//      en-tete) -- import direct, aucun reseau, aucune dependance Deno (ce module
//      n'appelle jamais Deno.env.get, contrairement a _shared/magic-link-token.ts --
//      aucun shim globalThis.Deno necessaire, meme motif que whatsapp-antifab.spec.ts
//      qui importe deja un _shared/*.ts sans extension de la meme facon).
//   2. La fonction deployee (HTTP, port 54321) -- lecture agence, ecriture des
//      checks, appel du moteur, journalisation. Cinq connecteurs reels existent a ce
//      stade (RDAP tache 2 ; VIES, recherche-entreprises x2, Mapbox tache 3) ; les
//      tests HTTP portent sur la PLOMBERIE (elle lit, ecrit, appelle le moteur,
//      journalise, rejoue proprement) et tiennent compte de ce que CES connecteurs
//      ecrivent reellement.
//   3-6. Chaque connecteur (describe hors skipIf, plus bas dans ce fichier) -- logique
//      pure, fetch STUBBE (jamais de reseau reel dans la suite automatisee, meme motif
//      que _shared/esign-finalize.test.ts qui stubbe deja fetch pour un connecteur
//      externe). Tourne SANS Supabase local -- import direct du module, comme le
//      volet 1. La verification CONTRE les vrais services se fait a la main, une
//      fois, hors de cette suite -- voir docs/superpowers/sdd/task-3-report.md.
//   7. Declenchement (tache 4) -- personne n'appelait agency-verification-run avant
//      cette tache : submit_agency_identity() la declenche desormais elle-meme
//      (net.http_post depuis PL/pgSQL, meme motif que les triggers matching-engine de
//      la baseline et les crons realadvisor-*/whatsapp-*), best-effort et jamais
//      bloquant, plus un filet de rattrapage planifie (sweep_pending_agency_verifications)
//      pour les dossiers dont le declenchement primaire n'a jamais abouti (net.http_post
//      est fire-and-forget, sans garantie de livraison). Contre un Supabase local reel,
//      comme le volet 2.
//   8. Squelette Zefix (etape 6, tache 2 -- describe hors skipIf, tout en bas). Ce n'est
//      PAS un connecteur : Zefix repond 401 et les identifiants sont sans reponse
//      (docs/agency-kyb-handoff.md §8). Ce volet verrouille le CABLAGE et la GESTION
//      D'ERREUR -- trois check_type, juridiction CH, aucun reseau, `unavailable` dont la
//      preuve dit s'il manque une reponse d'un tiers ou du code.
//   9. Squelette du registre UID (etape 6, tache 3 -- meme place, meme forme que le
//      volet 8, dont il reprend le motif). Statut DIFFERENT de Zefix, et c'est ce que ce
//      volet verifie autant que le cablage : Zefix a repondu 401 (il existe, il exige une
//      authentification), le registre UID n'a JAMAIS ete teste en API et la question
//      « API separee ou champ Zefix ? » n'est pas tranchee (doc de conception §3). Sa
//      contrepartie en base -- les quatre lignes zefix/uid_register retiennent un dossier
//      suisse par ailleurs parfait, et elles seules -- vit dans le volet 2.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : ces tests tournent contre un Supabase local
// seede et DOIVENT reellement passer -- lire le compte de tests, jamais le code de
// sortie (meme convention que agency-verification-engine.spec.ts). Les volets 1 et 3-6
// ne sont eux-memes jamais concernes par ce skip : ils ne touchent ni reseau ni DB.
// Seuls les volets 2 et 7 en dependent reellement.

import { describe, it, expect, afterAll, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient, anonClient } from './helpers/supabase'
import {
  runKybSource,
  runAgencyKybSources,
  selectApplicableSources,
  AGENCY_KYB_SOURCES,
  createAddressGeocodeSource,
  createZefixSources,
  createUidRegisterSources,
  type KybSource,
  type AgencyForVerification,
  type PendingSourceConfig,
} from '../../supabase/functions/_shared/kyb-sources'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? ''
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? ''
const ENDPOINT = `${URL}/functions/v1/agency-verification-run`
const NIL_UUID = '00000000-0000-0000-0000-000000000000'

const FAKE_AGENCY: AgencyForVerification = {
  id: NIL_UUID,
  legal_name: 'Fake SA',
  trade_name: null,
  business_registration_number: null,
  country: 'CH',
  canton: 'GE',
  city: null,
  postal_code: null,
  address: null,
  website: null,
  tva: null,
}

/** PostgREST peut renvoyer un `numeric` en JSON number ou en texte selon la colonne -- defensif
 *  (meme motif que agency-verification-engine.spec.ts). */
const num = (x: unknown): number | null => (x === null || x === undefined ? null : Number(x))

function failingSource(checkType: string): KybSource {
  return {
    checkType,
    source: 'manual',
    run: async () => {
      throw new Error(`boom-${checkType}`)
    },
  }
}

function hangingSource(checkType: string): KybSource {
  // Ignore delibirement le signal d'annulation -- simule une source qui ne repond
  // JAMAIS, pas meme a une annulation. La garantie de runKybSource doit tenir malgre
  // ca (voir _shared/kyb-sources.ts : le timeout externe ne depend pas de la
  // cooperation de la source).
  return {
    checkType,
    source: 'manual',
    run: () => new Promise(() => {}),
  }
}

function okSource(checkType: string, result: 'match' | 'partial' | 'mismatch' = 'match'): KybSource {
  return {
    checkType,
    source: 'manual',
    run: async () => ({ result, raw_response: { probe: true } }),
  }
}

// ─── Juridiction d'une source (etape 6, tache 1) ──────────────────────────────
//
// Fixtures de la matrice d'exclusivite, hissees au niveau du fichier pour que les
// taches suivantes (connecteurs Zefix et registre UID) n'aient qu'un seul endroit a
// completer.

const AGENCY_VERIFICATION_RUN_INDEX = 'supabase/functions/agency-verification-run/index.ts'
/** Ce fichier-ci, relu par le garde-fou ci-dessous. Chemin relatif a la racine du depot,
 *  comme AGENCY_VERIFICATION_RUN_INDEX : vitest tourne avec le cwd a la racine. */
const THIS_SPEC = 'tests/backend/agency-verification-run.spec.ts'

/** Valeurs importees de _shared/kyb-sources.ts par la fonction deployee. Sert de
 *  declencheur a fullKybRegistry() ci-dessous : un connecteur qui a besoin d'un secret
 *  ne peut pas vivre dans AGENCY_KYB_SOURCES (liste construite au chargement du
 *  module), index.ts doit donc importer SA FABRIQUE pour le composer lui-meme -- ajouter
 *  une source de cette facon sans l'ajouter aussi a fullKybRegistry() sortirait la
 *  nouvelle source du champ de la matrice sans que rien ne le signale. */
const EDGE_FUNCTION_SOURCE_IMPORTS = [
  'AGENCY_KYB_SOURCES',
  'createAddressGeocodeSource',
  'createUidRegisterSources',
  'createZefixSources',
  'runAgencyKybSources',
  'selectApplicableSources',
]

/**
 * Le litteral `const sources = [...]` que compose agency-verification-run/index.ts, lu
 * dans le fichier reel. Sert a distinguer, parmi les imports ci-dessus, ceux qui
 * PRODUISENT des sources (et doivent donc se retrouver dans fullKybRegistry()) de ceux
 * qui n'en produisent aucune (le harnais d'execution et le filtre de juridiction) --
 * plutot qu'une seconde liste ecrite a la main, qu'il aurait suffi de completer pour
 * reverdir.
 *
 * Equilibrage de crochets et non regex : la composition contient des objets et des appels
 * imbriques, et une regex bornee par l'indentation se casserait au premier reformatage --
 * en rendant du meme coup le garde-fou aveugle, exactement ce qu'il existe pour empecher.
 */
function edgeFunctionSourcesComposition(src: string): string {
  const marker = 'const sources = ['
  const start = src.indexOf(marker)
  if (start < 0) {
    throw new Error(`\`${marker}\` introuvable dans ${AGENCY_VERIFICATION_RUN_INDEX} -- garde-fou aveugle`)
  }
  let depth = 0
  for (let i = start + marker.length - 1; i < src.length; i++) {
    if (src[i] === '[') depth += 1
    else if (src[i] === ']') {
      depth -= 1
      if (depth === 0) return src.slice(start, i + 1)
    }
  }
  throw new Error(`composition \`${marker}\` non terminee dans ${AGENCY_VERIFICATION_RUN_INDEX}`)
}

/** Le CORPS de fullKybRegistry() ci-dessous, relu dans ce fichier meme, COMMENTAIRES
 *  RETIRES. Le garde-fou doit verifier ce que la fonction CONTIENT, pas seulement qu'un
 *  nom figure dans une liste -- voir le test « la matrice couvre bien le registre qu
 *  index.ts compose ».
 *
 *  Le retrait des commentaires n'est pas cosmetique (revue etape 6/tache 3, verifie par
 *  mutation) : sur du TEXTE BRUT, mettre l'appel d'une fabrique en commentaire satisfait
 *  encore le garde-fou, alors que la source correspondante a bel et bien quitte le
 *  registre teste. La matrice redevient alors aveugle sans que rien ne le signale --
 *  exactement ce que ce garde-fou existe pour empecher.
 *
 *  Retrait naif (aucune analyse de chaines) : suffisant parce que ce corps-ci ne contient
 *  ni URL ni litteral portant `//`, et un faux retrait ne pourrait de toute facon que
 *  faire ROUGIR le garde-fou, jamais le rendre aveugle. */
function fullKybRegistryBody(): string {
  const src = readFileSync(THIS_SPEC, 'utf8')
  const body = src.match(/function fullKybRegistry\(\): KybSource\[\] \{([\s\S]*?)\n\}/)
  if (!body) throw new Error(`corps de fullKybRegistry() introuvable dans ${THIS_SPEC} -- garde-fou aveugle`)
  return body[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

/** Motif exigeant que `producer` soit reference DANS LA MEME FORME que l'emploie la
 *  fonction deployee : appele (`nom(`) si index.ts l'appelle, simplement nomme sinon
 *  (AGENCY_KYB_SOURCES est une liste qu'on etale, pas une fabrique qu'on invoque).
 *
 *  Les BORNES DE MOT sont le coeur du correctif (revue etape 6/tache 3, verifie par
 *  mutation) : `body.includes('createXSources')` est vrai quand le registre teste compose
 *  `createXSourcesV2` -- une sous-chaine suffisait, si bien qu'un registre DIVERGENT de la
 *  composition deployee restait vert. */
function producerReferenceRe(producer: string, calledByEdgeFunction: boolean): RegExp {
  const name = producer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(calledByEdgeFunction ? `\\b${name}\\s*\\(` : `\\b${name}\\b`)
}

/** Configuration Zefix telle qu'agency-verification-run/index.ts la lit AUJOURD'HUI :
 *  ZEFIX_API_URL et ZEFIX_API_CREDENTIAL sont absents de l'environnement (aucun secret
 *  Supabase, aucune entree de supabase/config.toml), donc vides. C'est l'etat NOMINAL de
 *  l'etape, pas un artefact de test -- la demande faite a zefix@bj.admin.ch est sans
 *  reponse (docs/agency-kyb-handoff.md §8). */
const ZEFIX_PENDING_CONFIG: PendingSourceConfig = { baseUrl: '', credential: '' }

/** Configuration du registre UID telle qu'index.ts la lit AUJOURD'HUI : UID_REGISTER_API_URL
 *  et UID_REGISTER_API_CREDENTIAL sont absents de l'environnement, donc vides -- et pour une
 *  raison qui n'est pas celle de Zefix : cette API n'a jamais ete testee, et la question
 *  « API separee ou champ Zefix ? » n'est pas tranchee (doc de conception §3). */
const UID_REGISTER_PENDING_CONFIG: PendingSourceConfig = { baseUrl: '', credential: '' }

/** Le registre COMPLET tel qu'agency-verification-run/index.ts le compose : les entrees
 *  statiques de AGENCY_KYB_SOURCES PLUS les connecteurs que la fonction construit
 *  elle-meme faute de pouvoir lire une configuration depuis le module pur (le geocodage,
 *  le squelette Zefix et le squelette du registre UID). Une matrice qui ne couvrirait que
 *  AGENCY_KYB_SOURCES ne protegerait pas ce qu'elle pretend proteger -- verifie par
 *  mutation a la tache 2 : cabler Zefix dans index.ts sans l'ajouter ici laisse la matrice
 *  AVEUGLE (elle reste verte), et c'est le test d'imports juste apres la matrice qui mord.
 *  Ce test-la a ete DURCI a la tache 3 pour lire le CORPS de cette fonction et non plus une
 *  simple liste de noms, puis a la tache 4 pour cesser de comparer du texte BRUT : corps relu
 *  commentaires retires, producteurs cherches sur bornes de mot et dans la forme meme
 *  qu'index.ts emploie -- voir fullKybRegistryBody() et producerReferenceRe() plus haut. */
function fullKybRegistry(): KybSource[] {
  return [
    ...AGENCY_KYB_SOURCES,
    createAddressGeocodeSource('fake-token'),
    ...createZefixSources(ZEFIX_PENDING_CONFIG),
    ...createUidRegisterSources(UID_REGISTER_PENDING_CONFIG),
  ]
}

/** Pays de la matrice, et ce que le registre complet doit rendre applicable pour chacun.
 *  'DE' n'est pas decoratif : il prouve que le gabarit de VIES est bien « tout sauf
 *  CH/LI » et non la seule France, sans qu'aucune liste d'Etats membres n'ait a etre
 *  maintenue. */
const JURISDICTION_MATRIX: { country: string | null; applicable: string[] }[] = [
  {
    country: 'FR',
    applicable: [
      'domain_whois_age',
      'vat_lookup',
      'registry_lookup',
      'registry_legal_name_match',
      'address_geocode',
    ],
  },
  {
    // Les trois entrees de registre viennent du squelette Zefix (etape 6, tache 2) :
    // elles produisent `unavailable` faute d'identifiants, mais elles sont bel et bien
    // APPLICABLES -- c'est ce qui les rend exclusives de leurs homonymes francaises.
    // vat_lookup y figure aussi depuis la tache 3, mais servi par le registre UID et non
    // par VIES : la Suisse n'est pas dans l'UE, VIES ne la couvre pas.
    country: 'CH',
    applicable: [
      'domain_whois_age',
      'address_geocode',
      'vat_lookup',
      'registry_lookup',
      'registry_legal_name_match',
      'registry_country_match',
    ],
  },
  // Le Liechtenstein n'est PAS couvert par Zefix (registre `oera.li`, aucune API
  // publique connue) : il ne recoit aucune entree de registre, contrairement a la Suisse.
  // Il recoit en revanche vat_lookup par le registre UID (tache 3) : le FL-UID derive du
  // systeme suisse par l'union douaniere et porte le meme prefixe CHE (doc de conception
  // §3). Registre du commerce et TVA ne se decoupent donc PAS sur la meme frontiere, et
  // cette ligne est le seul endroit ou la difference se lit d'un coup d'oeil.
  { country: 'LI', applicable: ['domain_whois_age', 'address_geocode', 'vat_lookup'] },
  { country: 'DE', applicable: ['domain_whois_age', 'vat_lookup', 'address_geocode'] },
  { country: null, applicable: ['domain_whois_age', 'address_geocode'] },
]

// ─── Harnais pur (_shared/kyb-sources.ts) -- etape 4 tache 1, juridiction etape 6 tache 1 ──
//
// Hors du describe.skipIf(!HAS_KEYS) ci-dessous DELIBEREMENT, meme motif que les quatre
// volets de connecteurs en fin de fichier : ce volet n'a besoin ni de reseau (aucun
// fetch, pas meme stubbe) ni de Supabase local (import direct du module pur, qui
// n'appelle jamais Deno.env.get). Il DOIT tourner meme sans `supabase start`.
//
// Ce n'est pas une preference de rangement (revue etape 6/tache 1) : la matrice
// d'exclusivite ci-dessous est le garde-fou annonce des connecteurs Zefix et du registre
// UID (etape 6, taches 2 et 3) -- un agent qui ajouterait Zefix sans l'inscrire au
// registre COMPLET doit voir sa suite rougir. Sous le skipIf, elle etait sautee des que
// les cles SUPABASE_TEST_* manquaient, c'est-a-dire exactement dans la configuration ou
// l'on compte sur elle.
//
// Verifie par MUTATION a la tache 2, et le resultat merite d'etre ecrit ici parce qu'il
// n'est pas celui qu'on suppose : cabler Zefix dans index.ts sans l'ajouter a
// fullKybRegistry() laisse la matrice elle-meme VERTE -- elle ne voit que ce qu'on lui
// donne, et on ne lui donnait pas Zefix. Ce qui mord alors, c'est le test d'imports qui
// suit la matrice (il lit la liste d'imports REELLE de index.ts) et les deux tests bout
// en bout du volet 2. La matrice ne se protege donc pas toute seule : ces trois-la sont
// ce qui la tient reliee au registre reel, et aucun ne doit etre affaibli.
describe('harnais pur -- runKybSource / runAgencyKybSources (aucun reseau, aucune DB)', () => {
  it('une source qui echoue produit unavailable, jamais un throw', async () => {
    const row = await runKybSource(failingSource('domain_whois_age'), FAKE_AGENCY)
    expect(row.result).toBe('unavailable')
    expect(row.check_type).toBe('domain_whois_age')
    expect(row.source).toBe('manual')
    expect(row.raw_response).not.toBeNull()
  })

  it('une source qui expire produit unavailable (jamais un hang indefini)', async () => {
    const row = await runKybSource(hangingSource('vat_lookup'), FAKE_AGENCY, 50)
    expect(row.result).toBe('unavailable')
    expect(row.check_type).toBe('vat_lookup')
  }, 2_000)

  it('une source qui reussit renvoie son propre resultat, inchange par le harnais', async () => {
    const row = await runKybSource(okSource('address_geocode', 'partial'), FAKE_AGENCY)
    expect(row.result).toBe('partial')
    expect(row.raw_response).toEqual({ probe: true })
  })

  it("aucune source ne produit jamais l'absence de ligne, quel que soit le sort de chacune", async () => {
    const sources = [okSource('address_geocode'), failingSource('domain_whois_age'), hangingSource('vat_lookup')]
    const rows = await Promise.all(sources.map((s) => runKybSource(s, FAKE_AGENCY, 50)))

    expect(rows).toHaveLength(sources.length)
    for (const row of rows) {
      expect(['match', 'partial', 'mismatch', 'unavailable', 'pending_manual_review']).toContain(row.result)
    }
    expect(rows[0].result).toBe('match')
    expect(rows[1].result, 'echec reseau -> unavailable, jamais absent').toBe('unavailable')
    expect(rows[2].result, 'timeout -> unavailable, jamais absent').toBe('unavailable')
  })

  it('runAgencyKybSources ne rejette jamais, meme si toutes les sources echouent ou expirent', async () => {
    const sources = [failingSource('domain_whois_age'), hangingSource('vat_lookup')]
    // Timeout court (50ms) : sans cet override, hangingSource attendrait
    // DEFAULT_SOURCE_TIMEOUT_MS (10s) avant de se resoudre -- correct mais inutilement
    // lent pour un test.
    const rows = await runAgencyKybSources(FAKE_AGENCY, sources, 50)
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.result === 'unavailable')).toBe(true)
  }, 2_000)

  it('AGENCY_KYB_SOURCES contient les 4 connecteurs sans configuration ajoutes aux taches 2 et 3 (RDAP, VIES, recherche-entreprises x2)', () => {
    // RDAP (tache 2) puis VIES + recherche-entreprises x2 (tache 3) : quatre
    // connecteurs qui n'ont besoin d'aucun secret, donc statiques dans ce registre
    // construit au chargement du module. Le geocodage Mapbox (tache 3 egalement)
    // n'y figure PAS : seul connecteur de ce fichier a avoir besoin d'un jeton, il
    // est construit par createAddressGeocodeSource() -- voir son en-tete dans
    // _shared/kyb-sources.ts et le describe dedie plus bas. Un check_type non
    // catalogue dans verification_check_types ferait de toute facon echouer
    // l'insert (FK, 20260728103000) -- ces entrees SONT donc deja de vrais
    // connecteurs, jamais des doubles de test.
    expect(AGENCY_KYB_SOURCES).toHaveLength(4)
    const sourceOfCheckType = (checkType: string) => AGENCY_KYB_SOURCES.find((s) => s.checkType === checkType)?.source
    expect(sourceOfCheckType('domain_whois_age')).toBe('rdap')
    expect(sourceOfCheckType('vat_lookup')).toBe('vies')
    expect(sourceOfCheckType('registry_lookup')).toBe('recherche_entreprises')
    expect(sourceOfCheckType('registry_legal_name_match')).toBe('recherche_entreprises')
  })

  // Revue etape 4/tache 1, point 1 : raw_response est desormais OBLIGATOIRE dans
  // KybSourceResult (voir _shared/kyb-sources.ts) -- un verdict sans preuve jointe
  // ne doit plus pouvoir s'ecrire. Les quatre tests ci-dessous verifient que le cas
  // `unavailable` (le seul que le harnais fabrique lui-meme) joint une preuve
  // exploitable par un humain, jamais un objet vide, jamais l'erreur brute (donc
  // jamais un secret ou un en-tete d'authentification).

  it("le raw_response d'un echec porte le type d'erreur et le message, exploitables par un humain qui relira le dossier", async () => {
    const row = await runKybSource(failingSource('domain_whois_age'), FAKE_AGENCY)
    expect(row.result).toBe('unavailable')
    expect(row.raw_response).toMatchObject({ reason: 'error', error_type: 'Error' })
    expect(typeof row.raw_response.message).toBe('string')
    expect(row.raw_response.message).toContain('boom-domain_whois_age')
  })

  it("le raw_response d'un timeout porte reason='timeout' et le nom de l'erreur de timeout, jamais un match par defaut", async () => {
    const row = await runKybSource(hangingSource('vat_lookup'), FAKE_AGENCY, 50)
    expect(row.result).toBe('unavailable')
    expect(row.raw_response).toMatchObject({ reason: 'timeout', error_type: 'KybSourceTimeoutError' })
    expect(row.raw_response.message).toContain('50ms')
  }, 2_000)

  it('un code de statut porte par une erreur de source est reporte dans raw_response.status, sans jamais transporter un secret ou un en-tete', async () => {
    // Simule un connecteur fetch()-base (taches 2+) dont l'erreur embarque sa
    // reponse HTTP -- statut ET en-tetes, Authorization compris. describeSourceFailure
    // (kyb-sources.ts) ne doit cherry-picker QUE le statut, jamais le reste.
    const statusSource: KybSource = {
      checkType: 'domain_whois_age',
      source: 'manual',
      run: async () => {
        const err = new Error('service unavailable') as Error & {
          status: number
          headers: Record<string, string>
        }
        err.status = 503
        err.headers = { Authorization: 'Bearer secret-token-do-not-leak' }
        throw err
      },
    }
    const row = await runKybSource(statusSource, FAKE_AGENCY)
    expect(row.result).toBe('unavailable')
    expect(row.raw_response.status).toBe(503)
    const serialized = JSON.stringify(row.raw_response)
    expect(serialized).not.toContain('secret-token-do-not-leak')
    expect(serialized).not.toContain('Authorization')
  })

  it('quel que soit le sort de chaque source (succes/echec/timeout), raw_response est toujours un objet non nul -- jamais absent', async () => {
    const sources = [okSource('address_geocode'), failingSource('domain_whois_age'), hangingSource('vat_lookup')]
    const rows = await Promise.all(sources.map((s) => runKybSource(s, FAKE_AGENCY, 50)))
    for (const row of rows) {
      expect(row.raw_response, `raw_response absent pour ${row.check_type}`).not.toBeNull()
      expect(row.raw_response, `raw_response absent pour ${row.check_type}`).not.toBeUndefined()
      expect(typeof row.raw_response).toBe('object')
    }
  })

  // ─── Juridiction d'une source (etape 6, tache 1) ────────────────────────────
  //
  // Le moteur (20260728130000) ne garde qu'UNE ligne par check_type et departage
  // deux lignes de la meme transaction par ctid, donc par ordre d'insertion. Depuis la
  // tache 2 de cette etape, registry_lookup et registry_legal_name_match ont DEUX
  // proprietaires (recherche_entreprises en FR, zefix en CH) ; la tache 3 en donnera un
  // second a vat_lookup (registre UID, CH/LI). Sans regle, l'`unavailable` que le
  // connecteur francais produit deja pour tout siege hors de France pourrait masquer le
  // `match` de Zefix : un veto reellement satisfait se lirait comme un veto absent. La
  // matrice ci-dessous rend cette collision impossible plutot que departagee.
  //
  // Portee : les check_type DECLARES par les sources. Un connecteur peut encore en
  // ecraser un a l'execution selon ce qu'il observe (KybSourceResult.check_type --
  // RDAP le fait pour domain_generic_provider), et cette matrice-la ne le voit pas.
  // Sans objet aujourd'hui (aucun type ecrase n'est declare par une autre source) ;
  // a reprendre le jour ou une source declarerait un type qu'une autre ecrase.

  it(
    'matrice d exclusivite : sur le registre COMPLET (celui qu index.ts compose), deux sources ' +
      'applicables au meme siege ne partagent jamais un check_type',
    () => {
      for (const { country } of JURISDICTION_MATRIX) {
        const { applicable } = selectApplicableSources({ ...FAKE_AGENCY, country }, fullKybRegistry())
        const ownerOfCheckType = new Map<string, string>()
        for (const source of applicable) {
          const previousOwner = ownerOfCheckType.get(source.checkType)
          expect(
            previousOwner,
            `pays ${country ?? 'non declare'} : ${source.checkType} revendique a la fois par ` +
              `${previousOwner} et par ${source.source} -- la derniere ligne inseree masquerait l'autre`
          ).toBeUndefined()
          ownerOfCheckType.set(source.checkType, source.source)
        }
      }
    }
  )

  it('la matrice n est pas vide : chaque pays garde exactement les sources qui couvrent sa juridiction', () => {
    for (const { country, applicable: expected } of JURISDICTION_MATRIX) {
      const { applicable, skipped } = selectApplicableSources({ ...FAKE_AGENCY, country }, fullKybRegistry())
      expect(applicable.map((s) => s.checkType).sort(), `pays ${country ?? 'non declare'}`).toEqual(
        [...expected].sort()
      )
      // Aucune source ne disparait : applicable + skipped rend toujours le registre
      // entier -- une source ecartee est ecartee EXPLICITEMENT, jamais perdue.
      expect(applicable.length + skipped.length).toBe(fullKybRegistry().length)
    }
  })

  it(
    'la matrice couvre bien le registre qu index.ts compose : toute source construite par la fonction ' +
      'deployee (donc importee par elle) doit passer par fullKybRegistry()',
    () => {
      // Un connecteur qui a besoin d'un secret ne peut pas etre une entree statique de
      // AGENCY_KYB_SOURCES (la matrice la couvre deja par construction) : index.ts
      // importe SA FABRIQUE et le compose lui-meme. Ce test lit la liste d'imports
      // reelle pour qu'ajouter une source de cette facon sans l'ajouter a
      // fullKybRegistry() echoue ici, plutot que de sortir silencieusement la nouvelle
      // source du champ de la matrice.
      const src = readFileSync(AGENCY_VERIFICATION_RUN_INDEX, 'utf8')
      // [^}] plutot que [\s\S] : la liste d'imports nommes n'en contient jamais, et
      // une classe permissive ferait demarrer le match sur le PREMIER `import {` du
      // fichier, avalant les imports voisins jusqu'ici.
      const importBlock = src.match(/import\s*\{([^}]*)\}\s*from\s*'\.\.\/_shared\/kyb-sources\.ts'/)
      expect(importBlock, `aucun import de _shared/kyb-sources.ts trouve dans ${AGENCY_VERIFICATION_RUN_INDEX}`)
        .not.toBeNull()
      const imported = importBlock![1]
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('type '))
        .sort()
      expect(
        imported,
        'index.ts importe des valeurs de _shared/kyb-sources.ts que ce fichier ne connait pas -- si c est une ' +
          'nouvelle fabrique de connecteur, ajoute-la a fullKybRegistry() PUIS a EDGE_FUNCTION_SOURCE_IMPORTS'
      ).toEqual([...EDGE_FUNCTION_SOURCE_IMPORTS].sort())

      // DURCISSEMENT (revue etape 6/tache 2, applique a la tache 3). La moitie ci-dessus
      // ne compare que des NOMS : verifie par mutation, inscrire une fabrique dans
      // EDGE_FUNCTION_SOURCE_IMPORTS sans l'ajouter au corps de fullKybRegistry() laissait
      // TOUT vert -- la seconde moitie du message d'echec ci-dessus suffisait a reverdir,
      // et la matrice restait aveugle a la nouvelle source. Le seul filet restant etait
      // alors la paire de tests bout en bout du volet 2, qui vit sous skipIf(!HAS_KEYS) :
      // absente pour qui travaille sans pile Supabase locale, c'est-a-dire exactement dans
      // la configuration ou l'on compte sur ce garde-fou.
      //
      // Ce qui suit exige donc que chaque import PRODUCTEUR DE SOURCES soit REFERENCE
      // DANS LE CORPS de fullKybRegistry(). « Producteur » n'est pas une liste ecrite ici
      // (elle se completerait aussi vite qu'EDGE_FUNCTION_SOURCE_IMPORTS) : c'est lu dans
      // la composition reelle de index.ts -- un nom qui apparait dans son `const sources =
      // [...]` construit des sources, par definition.
      const composition = edgeFunctionSourcesComposition(src)
      const producers = imported.filter((name) => composition.includes(name))
      expect(
        producers.length,
        `aucun import de _shared/kyb-sources.ts n apparait dans la composition \`const sources\` de ` +
          `${AGENCY_VERIFICATION_RUN_INDEX} -- le garde-fou lit-il encore le bon fichier ?`
      ).toBeGreaterThan(0)

      // Comparaison de TEXTE, mais plus de texte BRUT (revue etape 6/tache 3, les deux
      // angles morts verifies par mutation) : le corps est relu commentaires retires --
      // sans quoi un appel mis en commentaire satisfait encore le garde-fou -- et chaque
      // producteur y est cherche sur BORNES DE MOT, dans la forme meme qu'index.ts
      // emploie -- sans quoi un registre composant `createXSourcesV2` resterait vert
      // pendant qu'index.ts compose `createXSources`, la sous-chaine suffisant a l'un
      // comme a l'autre. Voir fullKybRegistryBody() et producerReferenceRe() plus haut.
      const registryBody = fullKybRegistryBody()
      for (const producer of producers) {
        expect(
          registryBody,
          `${producer} construit des sources dans ${AGENCY_VERIFICATION_RUN_INDEX} mais n apparait pas dans le ` +
            'corps de fullKybRegistry() -- ou y apparait en commentaire, ou sous un nom dont il n est qu un ' +
            'prefixe : la matrice d exclusivite ne verrait jamais ces sources-la. L inscrire a ' +
            'EDGE_FUNCTION_SOURCE_IMPORTS ne suffit pas -- il faut l ajouter au registre lui-meme.'
        ).toMatch(producerReferenceRe(producer, composition.includes(`${producer}(`)))
      }
    }
  )

  it('une source sans appliesTo n est jamais ecartee, quel que soit le pays', () => {
    const sansJuridiction = okSource('domain_whois_age')
    for (const { country } of JURISDICTION_MATRIX) {
      const { applicable, skipped } = selectApplicableSources({ ...FAKE_AGENCY, country }, [sansJuridiction])
      expect(applicable, `pays ${country ?? 'non declare'}`).toHaveLength(1)
      expect(skipped, `pays ${country ?? 'non declare'}`).toHaveLength(0)
    }
  })

  it('une source ecartee ne produit AUCUNE ligne de check, et figure dans skipped avec son type, sa source et sa raison', async () => {
    const horsJuridiction: KybSource = {
      ...okSource('registry_lookup'),
      source: 'recherche_entreprises',
      appliesTo: () => false,
    }
    const { applicable, skipped } = selectApplicableSources(FAKE_AGENCY, [horsJuridiction, okSource('address_geocode')])

    expect(skipped).toEqual([
      { check_type: 'registry_lookup', source: 'recherche_entreprises', reason: 'jurisdiction_not_covered' },
    ])

    // Ecartee AVANT execution : le harnais ne voit meme pas la source, donc aucune
    // ligne -- ni `unavailable`, ni rien d'autre. C'est bien une absence de ligne,
    // que le moteur traite a l'identique d'un `unavailable` (exclu du numerateur ET
    // du denominateur) : aucun verdict ne bouge.
    const rows = await runAgencyKybSources(FAKE_AGENCY, applicable)
    expect(rows.map((r) => r.check_type)).toEqual(['address_geocode'])
  })

  it('selectApplicableSources travaille sur AGENCY_KYB_SOURCES par defaut', () => {
    const { applicable, skipped } = selectApplicableSources({ ...FAKE_AGENCY, country: 'CH' })
    expect(applicable.length + skipped.length).toBe(AGENCY_KYB_SOURCES.length)
    expect(skipped.map((s) => s.check_type).sort()).toEqual(
      ['registry_legal_name_match', 'registry_lookup', 'vat_lookup'].sort()
    )
  })

  it('le pays declare est compare apres trim et passage en majuscules', () => {
    const { applicable } = selectApplicableSources({ ...FAKE_AGENCY, country: '  fr  ' }, fullKybRegistry())
    expect(applicable.map((s) => s.checkType).sort()).toEqual(
      ['address_geocode', 'domain_whois_age', 'registry_legal_name_match', 'registry_lookup', 'vat_lookup'].sort()
    )
  })

  it(
    'runAgencyKybSources reste inchangee : elle rend une ligne par source QU ON LUI DONNE, ' +
      'y compris une source hors juridiction (le filtre vit dans index.ts, jamais ici)',
    async () => {
      const rows = await runAgencyKybSources({ ...FAKE_AGENCY, country: 'CH' }, fullKybRegistry())
      expect(rows).toHaveLength(fullKybRegistry().length)
    }
  )

  it(
    'un appliesTo qui leve ECARTE la source, sans jamais faire echouer le passage ' +
      '(revue etape 6/tache 1 : le besoin etait legitime, la direction etait fausse)',
    async () => {
      const predicatBogue: KybSource = {
        ...failingSource('vat_lookup'),
        appliesTo: () => {
          throw new Error('predicat bogue')
        },
      }
      // Le voisin sans juridiction est la moitie qui compte du test : « un predicat
      // bogue ne doit jamais faire echouer tout le passage » reste vrai -- le bogue
      // n'emporte que SA source, les autres sont selectionnees normalement.
      const voisin = okSource('domain_whois_age')
      const { applicable, skipped } = selectApplicableSources(FAKE_AGENCY, [predicatBogue, voisin])

      expect(applicable.map((s) => s.checkType)).toEqual(['domain_whois_age'])
      expect(skipped).toEqual([
        { check_type: 'vat_lookup', source: 'manual', reason: 'jurisdiction_undeterminable' },
      ])

      // Ecarter est NEUTRE pour le verdict : le moteur (20260728130000) traite « ligne
      // absente » exactement comme l'`unavailable` que cette source produisait avant
      // (exclus du numerateur ET du denominateur), et un veto absent ne passe pas.
      // Garder la source, elle, produit un verdict FAUX des que deux sources se
      // partagent un check_type -- voir le test suivant.
      const rows = await runAgencyKybSources(FAKE_AGENCY, applicable)
      expect(rows.map((r) => r.check_type)).toEqual(['domain_whois_age'])
    }
  )

  it(
    'deux sources du MEME check_type dont les predicats levent tous les deux : aucune ne ressort ' +
      'applicable, et les deux figurent dans skipped -- la collision reste impossible',
    async () => {
      // Reproduction exacte du scenario que l'etape 6 rend atteignable : apres la tache
      // 2, registry_lookup aura DEUX proprietaires (recherche_entreprises en FR, zefix
      // en CH), tous deux discrimines par le MEME helper de pays. Ce helper peut lever
      // -- agency.country n'est pas garanti d'etre une chaine a l'execution,
      // maybeSingle<AgencyForVerification>() (index.ts) etant un cast NON verifie. Un
      // fail-open rendrait alors les deux sources applicables : deux lignes
      // registry_lookup dans la meme transaction, et l'`unavailable` francais, insere en
      // dernier, masquerait le `match` de Zefix -- un veto reellement satisfait se lirait
      // comme un veto absent. Un seul predicat bogue suffirait ; on leve ici des deux
      // cotes pour tenir le pire cas.
      const predicatQuiLeve = (): boolean => {
        throw new TypeError('agency.country.trim is not a function')
      }
      const francais: KybSource = {
        ...okSource('registry_lookup'),
        source: 'recherche_entreprises',
        appliesTo: predicatQuiLeve,
      }
      const suisse: KybSource = { ...okSource('registry_lookup'), source: 'zefix', appliesTo: predicatQuiLeve }

      const { applicable, skipped } = selectApplicableSources(FAKE_AGENCY, [francais, suisse])

      expect(
        applicable,
        'un predicat bogue ne doit jamais rendre applicables deux sources du meme check_type'
      ).toHaveLength(0)
      expect(skipped).toEqual([
        { check_type: 'registry_lookup', source: 'recherche_entreprises', reason: 'jurisdiction_undeterminable' },
        { check_type: 'registry_lookup', source: 'zefix', reason: 'jurisdiction_undeterminable' },
      ])

      // Corollaire : aucune ligne ecrite du tout, donc aucune collision a departager.
      const rows = await runAgencyKybSources(FAKE_AGENCY, applicable)
      expect(rows).toHaveLength(0)
    }
  )
})

describe.skipIf(!HAS_KEYS)('agency-verification-run -- socle (etape 4, tache 1)', () => {
  // Helpers DB partages par "Edge Function deployee" ET par
  // "record_agency_verification_run -- atomicite" (revue point 2) -- les deux
  // sections doivent creer une agence de test et lire son etat / ses checks / ses
  // evenements. Hisses ici (au lieu d'etre locaux a "Edge Function deployee" comme
  // avant ce correctif) pour que les deux sections les partagent sans dupliquer la
  // logique de nettoyage.
  const agencyIds: string[] = []

  afterAll(async () => {
    const svc = serviceRoleClient()
    // Best-effort HONNETE (meme motif que agency-verification-engine.spec.ts) :
    // une agence sur laquelle le moteur a tourne journalise un activity_events
    // append-only, ce qui peut empecher sa suppression (ON DELETE SET NULL sur
    // agency_id declenche le trigger d'immutabilite). On rapporte nommement,
    // jamais en silence.
    const undeletable: { id: string; reason: string }[] = []
    for (const id of agencyIds) {
      const { error } = await svc.from('agencies').delete().eq('id', id)
      if (error) undeletable.push({ id, reason: `${error.code ?? '?'} ${error.message}` })
    }
    if (undeletable.length > 0) {
      console.warn(
        `[agency-verification-run.spec.ts] ${undeletable.length}/${agencyIds.length} agence(s) de test non ` +
          'supprimee(s) -- limite structurelle documentee dans agency-verification-engine.spec.ts ' +
          '(activity_events est append-only, LBA art. 7), pas un echec inattendu :\n' +
          undeletable.map((u) => `  - ${u.id} : ${u.reason}`).join('\n')
      )
    }
  })

  async function createAgency(label: string): Promise<string> {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}-${label}`
    const { data, error } = await svc
      .from('agencies')
      .insert({ name: `Agence Run ${stamp}`, slug: `agence-run-${stamp}` })
      .select('id')
      .single()
    if (error) throw new Error(`agency: ${error.message}`)
    agencyIds.push(data!.id as string)
    return data!.id as string
  }

  async function addActiveSignatory(agencyId: string): Promise<string> {
    const svc = serviceRoleClient()
    const { data: person, error: pErr } = await svc
      .from('agency_related_persons')
      .insert({ agency_id: agencyId, first_name: 'Jean', last_name: 'Signataire' })
      .select('id')
      .single()
    if (pErr) throw new Error(`related_person: ${pErr.message}`)
    const { error: rErr } = await svc
      .from('agency_person_roles')
      .insert({ related_person_id: person!.id, role: 'signatory', signature_power: 'individual' })
    if (rErr) throw new Error(`person_role: ${rErr.message}`)
    return person!.id as string
  }

  async function getAgency(
    agencyId: string
  ): Promise<{
    verification_status: string
    verification_score: number | string | null
    verification_sweep_attempts: number
  }> {
    const { data, error } = await serviceRoleClient()
      .from('agencies')
      .select('verification_status, verification_score, verification_sweep_attempts')
      .eq('id', agencyId)
      .single()
    if (error) throw new Error(`get agency: ${error.message}`)
    return data as {
      verification_status: string
      verification_score: number | string | null
      verification_sweep_attempts: number
    }
  }

  /** `source` et `raw_response` sont lus depuis l'etape 6 (tache 2) : un `unavailable`
   *  n'est acceptable que si la piece d'audit dit POURQUOI la source n'a pas repondu, et
   *  cela doit se verifier sur la ligne reellement ecrite en base, pas seulement sur ce
   *  que le module retourne. */
  type StoredCheck = { check_type: string; source: string; result: string; raw_response: unknown }

  async function getChecks(agencyId: string): Promise<StoredCheck[]> {
    const { data, error } = await serviceRoleClient()
      .from('agency_verification_checks')
      .select('check_type, source, result, raw_response')
      .eq('agency_id', agencyId)
    if (error) throw new Error(`get checks: ${error.message}`)
    return data as StoredCheck[]
  }

  async function getEvents(agencyId: string, action: string): Promise<Record<string, unknown>[]> {
    const { data, error } = await serviceRoleClient()
      .from('activity_events')
      .select('category, severity, actor_id, actor_kind, entity_type, entity_id, metadata')
      .eq('agency_id', agencyId)
      .eq('action', action)
    if (error) throw new Error(`get events ${action}: ${error.message}`)
    return data as Record<string, unknown>[]
  }

  describe('Edge Function deployee -- contrat HTTP', () => {
    async function callRun(agencyId: string, bearer: string = SERVICE_KEY): Promise<Response> {
      // apikey + Authorization avec la MEME valeur : meme motif defensif que
      // kyc-report-data.spec.ts (cette fonction n'est pas dans la liste
      // verify_jwt=false de config.toml -- le passage par la passerelle locale
      // depend d'une cle reconnue, l'autorisation reelle est verifiee PAR la
      // fonction elle-meme, pas par la passerelle).
      return fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: bearer,
          Authorization: `Bearer ${bearer}`,
        },
        body: JSON.stringify({ agency_id: agencyId }),
      })
    }

    it('OPTIONS -> 2xx (CORS preflight)', async () => {
      const res = await fetch(ENDPOINT, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://megga.ch',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'authorization, content-type',
        },
      })
      expect(res.status >= 200 && res.status < 300, `CORS preflight got ${res.status}`).toBe(true)
    })

    it('sans Authorization -> 401', async () => {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agency_id: NIL_UUID }),
      })
      expect(res.status).toBe(401)
    })

    it("un Bearer valide mais qui n'est pas la cle service-role -> 401 (le jeton anon ne doit jamais suffire)", async () => {
      const res = await callRun(NIL_UUID, ANON_KEY)
      expect(res.status).toBe(401)
    })

    it('agency_id absent du corps -> 400', async () => {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(400)
    })

    it('agency_id malforme (pas un uuid) -> 400', async () => {
      const res = await callRun('not-a-uuid')
      expect(res.status).toBe(400)
    })

    it('agence introuvable -> 404', async () => {
      const res = await callRun(NIL_UUID)
      expect(res.status).toBe(404)
    })

    it('ecrit les checks des sources applicables (tous unavailable sans aucune donnee KYB declaree), appelle bien le moteur apres avoir ecrit, et journalise son passage', async () => {
      const agencyId = await createAgency('happy')
      await addActiveSignatory(agencyId)

      const res = await callRun(agencyId)
      const body = await res.json()
      expect(res.status, `attendu 200, recu ${res.status}: ${JSON.stringify(body)}`).toBe(200)
      expect(body.ok).toBe(true)
      // Cinq connecteurs existent depuis la tache 3 de l'etape 4 : RDAP + VIES +
      // recherche-entreprises x2 (statiques dans AGENCY_KYB_SOURCES) + Mapbox (ajoute
      // par la fonction elle-meme via createAddressGeocodeSource -- voir son en-tete).
      // createAgency() ne declare AUCUN pays : depuis la regle de juridiction (etape 6,
      // tache 1), les trois sources qui exigent un siege (VIES, recherche-entreprises
      // x2) sont ecartees AVANT execution -- elles ecrivaient jusque-la trois lignes
      // `unavailable` que le moteur excluait deja du numerateur ET du denominateur,
      // d'ou un statut et un score rigoureusement identiques (verifies plus bas). Les
      // deux qui restent n'ont rien a verifier (ni website, ni adresse) et produisent
      // `unavailable` -- jamais un echec, jamais une absence de ligne.
      expect(body.checks_written).toBe(2)
      expect(body.results.unavailable).toBe(2)

      // Le moteur a bien tourne : aucun check scorable disponible (tous unavailable,
      // exclus du numerateur ET du denominateur, regle du moteur 20260728130000) ->
      // score toujours null -> jamais auto_validated, et le statut a bouge du defaut
      // 'pending' vers 'manual_review'.
      const agency = await getAgency(agencyId)
      expect(agency.verification_status).toBe('manual_review')
      expect(num(agency.verification_score)).toBeNull()

      // Deux journalisations DISTINCTES : celle du moteur lui-meme
      // (agency_verification_recomputed, deja garantie par l'etape 3) et celle de
      // CETTE fonction (agency_verification_run, "journalise son passage" -- brief
      // tache 1).
      expect(await getEvents(agencyId, 'agency_verification_recomputed')).toHaveLength(1)
      expect(await getEvents(agencyId, 'agency_verification_run')).toHaveLength(1)

      const checks = await getChecks(agencyId)
      expect(checks).toHaveLength(2)
      expect(checks.every((c) => c.result === 'unavailable')).toBe(true)
      expect(new Set(checks.map((c) => c.check_type))).toEqual(new Set(['domain_whois_age', 'address_geocode']))
    })

    // ─── Juridiction d'une source, bout en bout (etape 6, tache 1) ──────────────

    async function setCountry(agencyId: string, country: string): Promise<void> {
      const { error } = await serviceRoleClient().from('agencies').update({ country }).eq('id', agencyId)
      if (error) throw new Error(`update country: ${error.message}`)
    }

    /** Sources ecartees telles que le journal du passage les porte
     *  (p_metadata.sources_skipped), triees pour ne pas dependre de l'ordre du registre. */
    async function getSkippedSources(agencyId: string): Promise<Record<string, unknown>[]> {
      const events = await getEvents(agencyId, 'agency_verification_run')
      expect(events, 'le passage doit avoir ete journalise').toHaveLength(1)
      const metadata = events[0].metadata as { sources_skipped?: Record<string, unknown>[] }
      return [...(metadata.sources_skipped ?? [])].sort((a, b) =>
        String(a.check_type).localeCompare(String(b.check_type))
      )
    }

    it(
      'une agence francaise ecrit toujours ses cinq checks : le seul pays reellement couvert aujourd hui ' +
        "ne change en rien, et rien n'est ecarte",
      async () => {
        const agencyId = await createAgency('jurisdiction-fr')
        await addActiveSignatory(agencyId)
        await setCountry(agencyId, 'FR')

        const res = await callRun(agencyId)
        const body = await res.json()
        expect(res.status, `attendu 200, recu ${res.status}: ${JSON.stringify(body)}`).toBe(200)
        expect(body.checks_written).toBe(5)

        const checks = await getChecks(agencyId)
        expect(new Set(checks.map((c) => c.check_type))).toEqual(
          new Set(['domain_whois_age', 'vat_lookup', 'registry_lookup', 'registry_legal_name_match', 'address_geocode'])
        )
        // Le squelette Zefix (etape 6, tache 2) couvre la Suisse et elle seule : ses
        // trois sources sont donc ECARTEES pour un siege francais, et c'est exactement ce
        // qui laisse registry_lookup et registry_legal_name_match au registre francais
        // sans collision possible. Le registre UID (tache 3) est ecarte de la meme facon
        // et pour la meme raison, ce qui laisse vat_lookup a VIES : c'est l'exclusivite du
        // TROISIEME check_type partage, verifiee ici sur le dossier reel. Le dossier
        // francais lui-meme ne change en rien : cinq checks, les memes qu'avant l'etape 6.
        expect(await getSkippedSources(agencyId)).toEqual([
          { check_type: 'registry_country_match', source: 'zefix', reason: 'jurisdiction_not_covered' },
          { check_type: 'registry_legal_name_match', source: 'zefix', reason: 'jurisdiction_not_covered' },
          { check_type: 'registry_lookup', source: 'zefix', reason: 'jurisdiction_not_covered' },
          { check_type: 'vat_lookup', source: 'uid_register', reason: 'jurisdiction_not_covered' },
        ])

        // NON-REGRESSION, le critere de cette tache : la France est le seul pays
        // reellement couvert aujourd'hui, et l'etape 6 ne doit pas l'avoir deplace d'un
        // pouce. Cinq lignes, toutes `unavailable` faute de la moindre donnee KYB
        // declaree, donc aucun check scorable -> score NULL, et les quatre vetos d'entite
        // absents ou indisponibles -> manual_review. Exactement l'etat ou l'etape 4 avait
        // laisse ce dossier.
        expect(body.results.unavailable).toBe(5)
        const agency = await getAgency(agencyId)
        expect(agency.verification_status).toBe('manual_review')
        expect(num(agency.verification_score)).toBeNull()
      }
    )

    it(
      'une agence suisse ecrit les checks suisses (Zefix compris, tous unavailable), son journal nomme les ' +
        'sources francaises ecartees, et AUCUN verdict ne bouge pour autant',
      async () => {
        const agencyId = await createAgency('jurisdiction-ch')
        await addActiveSignatory(agencyId)
        await setCountry(agencyId, 'CH')

        const res = await callRun(agencyId)
        const body = await res.json()
        expect(res.status, `attendu 200, recu ${res.status}: ${JSON.stringify(body)}`).toBe(200)
        // Six sources applicables : RDAP, geocodage, les trois entrees de registre
        // suisses (squelette Zefix, tache 2) et la TVA suisse (squelette du registre UID,
        // tache 3). Ces quatre dernieres n'ont AUCUN identifiant et sortent donc
        // `unavailable` -- la ligne existe, le relecteur voit pourquoi elle est vide, et
        // rien n'est invente.
        expect(body.checks_written).toBe(6)
        expect(body.results.unavailable).toBe(6)
        expect(new Set((await getChecks(agencyId)).map((c) => c.check_type))).toEqual(
          new Set([
            'domain_whois_age',
            'address_geocode',
            'vat_lookup',
            'registry_lookup',
            'registry_legal_name_match',
            'registry_country_match',
          ])
        )

        // La raison est LISIBLE dans la preuve, jamais un `unavailable` nu : c'est ce qui
        // distingue « on attend une reponse d'un tiers » de « le connecteur est casse ».
        // Verifie ici contre la base reelle, pas seulement contre le module. Les DEUX
        // squelettes sont lus ensemble : ils partagent la meme erreur, et c'est leur
        // libelle -- pas leur type d'erreur -- qui dit ce qu'on attend au juste de chacun.
        const pendingChecks = (await getChecks(agencyId)).filter(
          (c) => c.source === 'zefix' || c.source === 'uid_register'
        )
        expect(pendingChecks).toHaveLength(4)
        for (const check of pendingChecks) {
          expect(check.result).toBe('unavailable')
          expect((check.raw_response as { error_type?: string }).error_type).toBe(
            'KybSourcePendingCredentialsError'
          )
        }

        // Ce qui n'a pas ete interroge reste LISIBLE dans la trace -- une source
        // ecartee ne doit jamais se lire comme une source oubliee.
        expect(await getSkippedSources(agencyId)).toEqual([
          { check_type: 'registry_legal_name_match', source: 'recherche_entreprises', reason: 'jurisdiction_not_covered' },
          { check_type: 'registry_lookup', source: 'recherche_entreprises', reason: 'jurisdiction_not_covered' },
          { check_type: 'vat_lookup', source: 'vies', reason: 'jurisdiction_not_covered' },
        ])

        // Non-regression, le critere des trois taches : les trois sources FRANCAISES
        // ecrivaient jusque-la trois lignes `unavailable` que le moteur excluait deja du
        // numerateur ET du denominateur (tache 1), et les trois lignes ZEFIX qui les
        // remplacent sont `unavailable` a leur tour -- or le moteur fait echouer un veto
        // `unavailable` exactement comme un veto ABSENT (« Ne passe que sur 'match' »,
        // 20260728130000). La ligne du registre UID (tache 3) est neutre pour une raison
        // DIFFERENTE, et la nuance compte : vat_lookup n'est pas un veto mais un signal
        // scorable (weight 3.00, is_veto false) -- c'est l'exclusion de `unavailable` du
        // numerateur ET du denominateur qui la rend rigoureusement equivalente a la ligne
        // absente d'hier. Ni l'ecart, ni les ajouts ne changent donc ce que le dossier
        // vaut : meme statut, meme score (aucun) qu'avant les trois taches.
        const agency = await getAgency(agencyId)
        expect(agency.verification_status).toBe('manual_review')
        expect(num(agency.verification_score)).toBeNull()
      }
    )

    // ─── La preuve en base : ce sont les sources injoignables, et elles seules, qui
    //     retiennent un dossier suisse par ailleurs parfait (etape 6, tache 3) ─────────
    //
    // Les deux tests qui suivent ne valent QUE PAR PAIRE, et c'est le point. Le premier
    // seul montrerait qu'un dossier suisse impeccable ne passe pas -- ce qui peut avoir
    // dix causes (score, signataire, check en attente, veto sans connecteur...). Le
    // second isole la cause : la MEME agence, ses quatre vetos d'entite poses a la main
    // en `match` et rien d'autre de change, bascule en `auto_validated`. Motif repris de
    // la demonstration du §7bis de docs/agency-kyb-handoff.md, qui l'avait faite pour la
    // France sur les deux vetos sans connecteur.
    //
    // Une precision d'honnetete que le nom des tests ne porte pas : sur les quatre lignes
    // constatees, TROIS retiennent reellement le dossier (les vetos Zefix, `unavailable`
    // vaut veto non passe) ; la quatrieme, vat_lookup servie par le registre UID, n'est
    // pas un veto -- elle ne retient rien et ne debloque rien, elle rend seulement lisible
    // qu'aucune source n'a confirme la TVA. Un quatrieme veto, registry_number_format, n'a
    // par ailleurs AUCUN connecteur dans le depot (handoff §7bis) : il est absent, pas
    // indisponible, d'ou sa presence dans les quatre lignes posees a la main au second
    // temps.

    const SCORABLE_AGENCY_SIGNALS = [
      'vat_lookup',
      'address_registry_match',
      'address_geocode',
      'activity_code_match',
      'professional_registry',
      'lei_lookup',
      'domain_website_match',
      'domain_trade_name_similarity',
      'domain_whois_age',
      'domain_generic_provider',
      'phone_country_match',
    ]
    const SCORABLE_PERSON_SIGNALS = ['signatory_registry_match', 'poa_document_review']
    const PERSON_VETO_TYPES = ['pep_sanctions_screening', 'id_document']
    const AGENCY_VETO_TYPES = [
      'registry_number_format',
      'registry_lookup',
      'registry_legal_name_match',
      'registry_country_match',
    ]

    async function insertAgencyChecks(agencyId: string, checkTypes: string[], result: string): Promise<void> {
      const { error } = await serviceRoleClient()
        .from('agency_verification_checks')
        .insert(checkTypes.map((check_type) => ({ agency_id: agencyId, check_type, source: 'manual', result })))
      if (error) throw new Error(`seed agency checks: ${error.message}`)
    }

    async function insertPersonChecks(personId: string, checkTypes: string[], result: string): Promise<void> {
      const { error } = await serviceRoleClient()
        .from('agency_person_verification_checks')
        .insert(checkTypes.map((check_type) => ({ related_person_id: personId, check_type, source: 'manual', result })))
      if (error) throw new Error(`seed person checks: ${error.message}`)
    }

    /** Rappelle le MOTEUR seul (recompute_agency_verification), jamais l'Edge Function :
     *  rejouer le passage complet reecrirait ses propres lignes `unavailable` par-dessus
     *  les vetos poses a la main -- elles seraient plus recentes, donc gagnantes -- et le
     *  controle ne prouverait plus rien. */
    async function recompute(agencyId: string): Promise<void> {
      const { error } = await serviceRoleClient().rpc('recompute_agency_verification', { p_agency_id: agencyId })
      if (error) throw new Error(`recompute: ${error.message}`)
    }

    /** `veto_failed` tel que le moteur l'a journalise a son DERNIER passage
     *  (agency_verification_recomputed) -- la seule facon de le lire, aucune colonne ne le
     *  porte sur agencies. Tri EXPLICITE sur created_at : PostgREST ne garantit aucun
     *  ordre sans `order`, et ce test-ci lit precisement le dernier de deux passages. */
    async function lastVetoFailed(agencyId: string): Promise<boolean> {
      const { data, error } = await serviceRoleClient()
        .from('activity_events')
        .select('metadata, created_at')
        .eq('agency_id', agencyId)
        .eq('action', 'agency_verification_recomputed')
        .order('created_at', { ascending: false })
        .limit(1)
      if (error) throw new Error(`get recompute events: ${error.message}`)
      expect(data, 'le moteur doit avoir journalise au moins un passage').toHaveLength(1)
      return (data![0].metadata as { veto_failed?: boolean }).veto_failed === true
    }

    /** Une agence suisse dont TOUT LE RESTE est parfait : signataire actif, checks de
     *  personne (vetos et signaux scorables) en `match`, tous les signaux d'entite
     *  scorables en `match`. Rien ne manque a ce dossier que les registres. */
    async function createPerfectSwissAgency(label: string): Promise<string> {
      const agencyId = await createAgency(label)
      const signatoryId = await addActiveSignatory(agencyId)
      await setCountry(agencyId, 'CH')
      await insertAgencyChecks(agencyId, SCORABLE_AGENCY_SIGNALS, 'match')
      await insertPersonChecks(signatoryId, [...PERSON_VETO_TYPES, ...SCORABLE_PERSON_SIGNALS], 'match')
      return agencyId
    }

    it(
      'un dossier suisse dont tout le reste est parfait reste en manual_review : les quatre lignes zefix/uid_register ' +
        'existent, toutes unavailable, aucune absente, et veto_failed est vrai',
      async () => {
        const agencyId = await createPerfectSwissAgency('preuve-ch-retenu')

        const res = await callRun(agencyId)
        const body = await res.json()
        expect(res.status, `attendu 200, recu ${res.status}: ${JSON.stringify(body)}`).toBe(200)

        // AUCUNE ABSENTE : c'est la moitie de la preuve. Une source injoignable doit
        // laisser une ligne `unavailable`, jamais un silence -- le principe directeur de
        // toute l'etape 4. On compare des paires (type, source) et non des types seuls :
        // registry_lookup existe aussi cote francais, seule la source dit qui a repondu.
        const checks = await getChecks(agencyId)
        const pending = checks
          .filter((c) => c.source === 'zefix' || c.source === 'uid_register')
          .map((c) => `${c.source}:${c.check_type}`)
          .sort()
        expect(pending).toEqual(
          [
            'uid_register:vat_lookup',
            'zefix:registry_country_match',
            'zefix:registry_legal_name_match',
            'zefix:registry_lookup',
          ].sort()
        )
        for (const check of checks.filter((c) => c.source === 'zefix' || c.source === 'uid_register')) {
          expect(check.result, `${check.source}:${check.check_type}`).toBe('unavailable')
        }

        // Le dossier est par ailleurs IRREPROCHABLE : score plein. C'est ce qui rend la
        // preuve lisible -- ce n'est pas un dossier mediocre qu'on retient, c'est un
        // dossier parfait dont les registres n'ont rien pu confirmer. Les trois signaux
        // scorables que le passage a lui-meme recouverts d'un `unavailable`
        // (domain_whois_age, address_geocode, vat_lookup) sortent du calcul sans le
        // penaliser -- exclus du numerateur ET du denominateur.
        const agency = await getAgency(agencyId)
        expect(num(agency.verification_score), 'tout le reste est parfait, le score doit valoir 1.000').toBeCloseTo(1, 3)
        expect(agency.verification_status).toBe('manual_review')
        expect(await lastVetoFailed(agencyId), 'ce sont bien des vetos qui retiennent ce dossier').toBe(true)
      }
    )

    it(
      'le controle qui rend la preuve concluante : les quatre vetos d entite poses a la main en match, le MEME ' +
        'dossier bascule en auto_validated -- rien d autre n a change',
      async () => {
        const agencyId = await createPerfectSwissAgency('preuve-ch-controle')

        const res = await callRun(agencyId)
        expect(res.status).toBe(200)
        expect((await getAgency(agencyId)).verification_status).toBe('manual_review')

        // Les quatre vetos d'entite, poses APRES le passage : ils sont donc plus recents
        // que les `unavailable` de Zefix et gagnent le `distinct on (check_type)` du
        // moteur. Rien d'autre ne bouge -- ni le score, ni le signataire, ni les checks de
        // personne, ni la moindre ligne des connecteurs.
        await insertAgencyChecks(agencyId, AGENCY_VETO_TYPES, 'match')
        await recompute(agencyId)

        const agency = await getAgency(agencyId)
        expect(
          agency.verification_status,
          'si le dossier ne bascule pas ici, c est que quelque chose d AUTRE que les registres le retenait -- ' +
            'et le test precedent ne prouverait alors rien sur les sources injoignables'
        ).toBe('auto_validated')
        expect(num(agency.verification_score)).toBeCloseTo(1, 3)
        expect(await lastVetoFailed(agencyId)).toBe(false)
      }
    )

    it(
      'site web grand public (gmail.com) -> ecrit le check sous domain_generic_provider, jamais domain_whois_age ' +
        '(revue etape 4/tache 2, point 2 -- verifie ici contre le catalogue REEL, pas seulement contre la lecture du connecteur)',
      async () => {
        const agencyId = await createAgency('generic-provider')
        await addActiveSignatory(agencyId)
        const svc = serviceRoleClient()
        const { error: updErr } = await svc.from('agencies').update({ website: 'gmail.com' }).eq('id', agencyId)
        if (updErr) throw new Error(`update website: ${updErr.message}`)

        const res = await callRun(agencyId)
        const body = await res.json()
        expect(res.status, `attendu 200, recu ${res.status}: ${JSON.stringify(body)}`).toBe(200)
        // 2 sources applicables faute de pays declare (voir le test precedent) -- seul
        // RDAP a de quoi repondre ici (website renseigne), le geocodage reste unavailable.
        expect(body.checks_written).toBe(2)
        expect(body.results.partial).toBe(1)
        expect(body.results.unavailable).toBe(1)

        const checks = await getChecks(agencyId)
        expect(checks).toHaveLength(2)
        const genericProviderCheck = checks.find((c) => c.check_type === 'domain_generic_provider')
        expect(
          genericProviderCheck,
          'la FK agency_verification_checks.check_type -> verification_check_types.code aurait rejete un code absent du catalogue -- domain_generic_provider y figure deja avec son propre poids (migration 20260728103000)'
        ).toBeDefined()
        expect(genericProviderCheck?.result).toBe('partial')
      }
    )

    it('le passage journalise respecte activity_events (category=kyc, actor_kind=system, actor_id NULL)', async () => {
      const agencyId = await createAgency('audit-log')
      await addActiveSignatory(agencyId)
      const res = await callRun(agencyId)
      expect(res.status).toBe(200)

      const events = await getEvents(agencyId, 'agency_verification_run')
      expect(events).toHaveLength(1)
      const event = events[0]
      expect(event.category, 'category doit valoir kyc (jamais compliance, hors CHECK)').toBe('kyc')
      expect(event.actor_kind, "c'est cette fonction qui agit, pas un humain").toBe('system')
      expect(event.actor_id, 'actor_kind=system impose actor_id NULL').toBeNull()
      expect(event.entity_type).toBe('agency')
      expect(event.entity_id).toBe(agencyId)
    })

    it('rejouable : deux appels de suite ecrivent chacun leurs propres checks (pas de dedoublonnage cote fonction) et font tourner le moteur deux fois', async () => {
      const agencyId = await createAgency('replay')
      await addActiveSignatory(agencyId)

      const res1 = await callRun(agencyId)
      expect(res1.status).toBe(200)
      const res2 = await callRun(agencyId)
      expect(res2.status).toBe(200)

      // "Rejouable" ne veut pas dire "dedoublonne" : cette fonction insere une ligne a
      // CHAQUE appel pour CHAQUE connecteur APPLICABLE (2 ici, faute de pays declare --
      // voir la regle de juridiction, etape 6 tache 1), c'est le moteur qui departage
      // plusieurs lignes du meme type par ctid (voir le test dedie plus bas), jamais
      // cette fonction qui filtre avant d'ecrire.
      expect(await getChecks(agencyId)).toHaveLength(4)
      // Chaque appel a reellement fait tourner le moteur -- pas seulement le
      // premier -- et journalise son propre passage a chaque fois.
      expect(await getEvents(agencyId, 'agency_verification_recomputed')).toHaveLength(2)
      expect(await getEvents(agencyId, 'agency_verification_run')).toHaveLength(2)
    })

    it(
      'rejouable sans empiler de doublons CONTRADICTOIRES : deux checks du meme type dans la ' +
        'meme transaction se departagent par ctid, jamais par date (revue etape 3)',
      async () => {
        const agencyId = await createAgency('same-tx-tiebreak')
        await addActiveSignatory(agencyId)

        // Simule ce qu'ecrirait un futur connecteur qui rejoue un veto : deux lignes
        // du meme check_type dans UN SEUL insert => meme checked_at (defaut = debut
        // de transaction, cf. l'en-tete de recompute_agency_verification). Ce test
        // verifie que la plomberie de cette fonction (appel du moteur APRES
        // l'ecriture, sans jamais essayer de reordonner/nettoyer les checks
        // existants elle-meme -- y compris ceux, distincts, que le connecteur RDAP
        // ecrit a chaque appel) laisse le moteur trancher correctement sur les DEUX
        // lignes seedees ici, et que rejouer ne casse pas ce resultat.
        const svc = serviceRoleClient()
        const { error: seedErr } = await svc.from('agency_verification_checks').insert([
          { agency_id: agencyId, check_type: 'registry_number_format', source: 'manual', result: 'match' },
          { agency_id: agencyId, check_type: 'registry_number_format', source: 'manual', result: 'mismatch' },
        ])
        if (seedErr) throw new Error(`seed same-tx: ${seedErr.message}`)

        const res = await callRun(agencyId)
        expect(res.status).toBe(200)

        // Veto registry_number_format tranche sur la ligne inseree EN DERNIER
        // (mismatch) -- jamais sur l'egalite de date -- donc revue humaine, jamais
        // auto_validated.
        const agency = await getAgency(agencyId)
        expect(
          agency.verification_status,
          "la ligne inseree en dernier (mismatch) doit gagner ; ne jamais s'appuyer sur checked_at pour l'ordre"
        ).toBe('manual_review')

        // Rejouer une seconde fois ne doit ni faire disparaitre ce resultat ni
        // reordonner/nettoyer les 2 lignes seedees (cette fonction ne touche jamais
        // aux checks existants) : le veto reste tranche par la meme ligne mismatch,
        // toujours manual_review. Le compte total grandit bien (chaque connecteur
        // APPLICABLE ecrit sa propre ligne a chaque appel -- 2 ici faute de pays
        // declare, +2 a res, +2 a res2), preuve que "rejouable" n'est pas "silencieux"
        // -- seul le resultat DECISIF (le veto seede) ne doit pas bouger.
        const res2 = await callRun(agencyId)
        expect(res2.status).toBe(200)
        expect(await getChecks(agencyId)).toHaveLength(6)
        const agencyAfter = await getAgency(agencyId)
        expect(agencyAfter.verification_status).toBe('manual_review')
      }
    )
  })

  describe('record_agency_verification_run -- atomicite (revue etape 4/tache 1, point 2)', () => {
    // Avant ce correctif, l'ecriture des checks, l'appel du moteur et la
    // journalisation du passage de agency-verification-run etaient trois appels
    // separes (trois transactions) -- un echec sur le DERNIER laissait le travail
    // deja committe (voir l'en-tete d'agency-verification-run/index.ts). La RPC
    // record_agency_verification_run (20260728140000) enveloppe desormais les trois
    // dans UNE SEULE transaction Postgres. Preuve directe : on force un echec sur ce
    // qui etait l'etape 3 (le journal, via un p_severity qui viole
    // activity_events_severity_check) APRES que les deux premieres etapes (insert
    // des checks, recompute_agency_verification) ont reellement tourne -- et on
    // verifie qu'AUCUNE des trois n'a laisse de trace : ni le check insere, ni la
    // decision du moteur, ni l'un ou l'autre evenement.
    it("un echec sur la journalisation (dernier insert) annule aussi l'ecriture des checks et le passage du moteur -- rien ne reste committe", async () => {
      const agencyId = await createAgency('atomic-rollback')
      await addActiveSignatory(agencyId)

      const svc = serviceRoleClient()
      const before = await getAgency(agencyId)
      expect(before.verification_status, 'statut par defaut avant tout passage').toBe('pending')

      const { error } = await svc.rpc('record_agency_verification_run', {
        p_agency_id: agencyId,
        p_checks: [{ check_type: 'vat_lookup', source: 'manual', result: 'match', raw_response: { probe: true } }],
        // Valeur hors activity_events_severity_check ('info' | 'warn' | 'critical')
        // -- force un echec APRES que l'insert des checks et l'appel du moteur ont
        // deja eu lieu dans cette meme fonction PL/pgSQL.
        p_severity: 'not-a-valid-severity',
        p_metadata: { probe: true },
      })

      expect(error, 'le CHECK constraint sur severity doit rejeter la valeur invalide').not.toBeNull()

      // Rien ne doit avoir ete committe : ni le check insere, ni la decision du
      // moteur (statut/score inchanges), ni son propre evenement, ni celui du
      // moteur -- tout ou rien, jamais un etat intermediaire.
      expect(await getChecks(agencyId)).toHaveLength(0)
      const after = await getAgency(agencyId)
      expect(after.verification_status, 'le moteur a bien tourne PUIS a ete annule avec le reste').toBe('pending')
      expect(num(after.verification_score)).toBeNull()
      expect(await getEvents(agencyId, 'agency_verification_recomputed')).toHaveLength(0)
      expect(await getEvents(agencyId, 'agency_verification_run')).toHaveLength(0)
    })
  })

  // ─── Tache 4 : declenchement + filet de rattrapage ────────────────────────────
  //
  // Avant cette tache, rien n'appelait agency-verification-run : submit_agency_identity()
  // posait identity_submitted_at et s'arretait la (useAgencyIdentity.ts submit() -- voir
  // son en-tete -- n'appelle QUE cette RPC, jamais l'edge function). Motif ALIGNE sur ce
  // que ce depot fait deja ailleurs (jamais un troisieme motif) : net.http_post depuis
  // PL/pgSQL, comme les triggers matching-engine de la baseline
  // (trigger_matching_on_new_search et consorts) et les crons realadvisor-*/whatsapp-*.
  //
  // net.http_post MET LA REQUETE EN FILE (table net.http_request_queue, videe par un
  // worker de fond) plutot que de la jouer en ligne -- deja documente ailleurs dans ce
  // depot comme fire-and-forget (20260714170000, purge chat-staging : « pg_net est
  // asynchrone… un echec HTTP ponctuel est rattrape la nuit suivante » ; 20260705180000,
  // whatsapp-morning-brief : « tick FILET… un tick primaire manque ne doit pas couter la
  // journee »). Consequence directe pour les tests ci-dessous : AUCUNE assertion ne peut
  // lire l'effet juste apres l'appel RPC -- waitUntil() sonde jusqu'a ce que l'effet
  // apparaisse ou que le delai expire.
  //
  // Ce meme caractere fire-and-forget signifie que net.http_post peut echouer
  // SILENCIEUSEMENT du point de vue de l'appelant (worker pg_net jamais demarre, base
  // redemarree entre l'insertion en file et son traitement, edge function qui timeout ou
  // crashe avant d'ecrire sa propre trace) : sweep_pending_agency_verifications est le
  // filet de rattrapage qui ramasse les dossiers soumis dont verification_status est
  // reste 'pending' (jamais recalcule) plus de 15 minutes apres leur soumission.
  describe('declenchement de la verification depuis submit_agency_identity, et filet de rattrapage (etape 4, tache 4)', () => {
    const PW = 'Test-Password-123!'
    const founderUserIds: string[] = []

    // `URL` (127.0.0.1:54321, en tete de fichier) est l'adresse depuis laquelle CE
    // PROCESSUS NODE joint le gateway local -- c'est ce que "Edge Function deployee"
    // plus haut utilise pour ses fetch() directs. Mais net.http_post tourne DANS le
    // conteneur Postgres, sur un reseau Docker distinct : depuis ce conteneur,
    // 127.0.0.1 designe le conteneur lui-meme, pas le gateway (verifie a la main --
    // net._http_response y montre "Couldn't connect to server" pour cette URL). Le
    // conteneur Postgres resout en revanche le gateway Kong via l'alias Docker
    // documente par Supabase pour precisement ce scenario (Postgres -> Edge
    // Functions locales) : api.supabase.internal:8000. Seule la config app_config
    // posee ICI, pour que net.http_post (execute par Postgres) trouve sa cible, doit
    // utiliser cette adresse -- jamais `URL`, qui resterait "Couldn't connect to
    // server" du point de vue du worker pg_net.
    const PG_NET_LOCAL_FUNCTIONS_URL = 'http://api.supabase.internal:8000'

    afterAll(async () => {
      const svc = serviceRoleClient()
      for (const id of founderUserIds) {
        await svc.auth.admin.deleteUser(id).then(
          () => {},
          () => {}
        )
      }
    })

    interface Founder {
      id: string
      agencyId: string
      client: SupabaseClient
    }

    // Inscrit un fondateur reel (handle_new_user -> provision_solo_agency) : seule
    // maniere de tester is_agency_admin() sans fabriquer un profil a la main, meme
    // motif que agency-identity-submit.spec.ts (signUpFounder).
    async function signUpFounder(): Promise<Founder> {
      const svc = serviceRoleClient()
      const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
      const email = `kyb-trigger-${stamp}@megga-test.local`
      const { data, error } = await svc.auth.admin.createUser({
        email,
        password: PW,
        email_confirm: true,
        user_metadata: { full_name: `Fondateur ${stamp}`, role: 'agent' },
      })
      if (error) throw new Error(`createUser: ${error.message}`)
      const id = data.user!.id
      founderUserIds.push(id)

      const { data: prof } = await svc.from('profiles').select('agency_id').eq('id', id).maybeSingle()
      if (!prof?.agency_id) throw new Error('provisioning : aucune agence solo creee')
      const agencyId = prof.agency_id as string
      agencyIds.push(agencyId) // reutilise le nettoyage "honnete" de la describe englobante

      const client = anonClient()
      const { error: signInErr } = await client.auth.signInWithPassword({ email, password: PW })
      if (signInErr) throw new Error(`signin: ${signInErr.message}`)

      return { id, agencyId, client }
    }

    async function getChSaLegalFormId(): Promise<string> {
      const { data, error } = await serviceRoleClient().from('legal_forms').select('id').eq('code', 'CH_SA').single()
      if (error) throw new Error(`legal_forms lookup: ${error.message}`)
      return data!.id as string
    }

    // Complete l'agence jusqu'au minimum exige par _agency_identity_completeness_error
    // (raison sociale, forme juridique, pays, signataire actif) -- reutilise
    // addActiveSignatory de la describe englobante, deja definie plus haut.
    async function completeAgency(agencyId: string): Promise<void> {
      const legalFormId = await getChSaLegalFormId()
      const { error } = await serviceRoleClient()
        .from('agencies')
        .update({ legal_name: 'Regie Declenchement SA', legal_form_id: legalFormId, country: 'CH' })
        .eq('id', agencyId)
      if (error) throw new Error(`update agency: ${error.message}`)
      await addActiveSignatory(agencyId)
    }

    async function readConfig(key: string): Promise<string | null> {
      const { data } = await serviceRoleClient().from('app_config').select('value').eq('key', key).maybeSingle()
      return (data?.value as string | null) ?? null
    }

    async function setConfig(key: string, value: string): Promise<void> {
      const { error } = await serviceRoleClient()
        .from('app_config')
        .upsert({ key, value }, { onConflict: 'key' })
      if (error) throw new Error(`set app_config ${key}: ${error.message}`)
    }

    async function restoreConfig(key: string, original: string | null): Promise<void> {
      const svc = serviceRoleClient()
      if (original === null) await svc.from('app_config').delete().eq('key', key)
      else await svc.from('app_config').update({ value: original }).eq('key', key)
    }

    // Sonde une condition jusqu'a ce qu'elle devienne vraie ou que le delai expire.
    // Indispensable ici : net.http_post est asynchrone (file + worker de fond, voir
    // l'en-tete de cette section) -- aucune assertion ne peut lire l'effet juste apres
    // l'appel RPC.
    async function waitUntil(predicate: () => Promise<boolean>, timeoutMs = 10_000, intervalMs = 250): Promise<void> {
      const deadline = Date.now() + timeoutMs
      for (;;) {
        if (await predicate()) return
        if (Date.now() >= deadline) throw new Error(`waitUntil: condition jamais vraie apres ${timeoutMs}ms`)
        await new Promise((resolve) => setTimeout(resolve, intervalMs))
      }
    }

    describe('submit_agency_identity -- declenchement primaire', () => {
      it(
        'un dirigeant qui soumet une identite complete declenche reellement agency-verification-run ' +
          '(checks ecrits, moteur execute), et un second appel (deja soumis) ne redeclenche jamais',
        async () => {
          const urlBefore = await readConfig('supabase_url')
          const keyBefore = await readConfig('service_role_key')
          try {
            // Pointe le dispatch vers le VRAI runtime local (le meme que "Edge Function
            // deployee" plus haut dans ce fichier) : preuve directe de bout en bout,
            // pas seulement que la RPC "tente" un appel.
            await setConfig('supabase_url', PG_NET_LOCAL_FUNCTIONS_URL)
            await setConfig('service_role_key', SERVICE_KEY)

            const founder = await signUpFounder()
            await completeAgency(founder.agencyId)

            const { error } = await founder.client.rpc('submit_agency_identity')
            expect(error, `submit: ${error?.message}`).toBeNull()

            await waitUntil(async () => (await getChecks(founder.agencyId)).length > 0)
            await waitUntil(async () => (await getEvents(founder.agencyId, 'agency_verification_run')).length > 0)

            const agency = await getAgency(founder.agencyId)
            expect(agency.verification_status, 'le moteur a bien tourne (statut sorti de pending)').not.toBe('pending')

            // Deuxieme appel : deja soumis -> retour anticipe (etape 5 de la RPC),
            // jamais un second declenchement. Marge courte : si un second dispatch
            // partait par erreur, il aurait largement le temps d'ecrire avant
            // l'assertion suivante (le premier a deja mis, au pire, waitUntil() a
            // reussir pour aboutir jusqu'ici).
            const second = await founder.client.rpc('submit_agency_identity')
            expect(second.error).toBeNull()
            await new Promise((resolve) => setTimeout(resolve, 500))
            expect(
              await getEvents(founder.agencyId, 'agency_verification_run'),
              'un second appel (deja soumis) ne doit jamais redeclencher la verification'
            ).toHaveLength(1)
          } finally {
            await restoreConfig('supabase_url', urlBefore)
            await restoreConfig('service_role_key', keyBefore)
          }
        },
        15_000
      )

      it(
        "sans configuration (supabase_url absent -- env local/CI non seede), le dispatch est saute " +
          'silencieusement mais la soumission reussit quand meme',
        async () => {
          const urlBefore = await readConfig('supabase_url')
          try {
            await serviceRoleClient().from('app_config').delete().eq('key', 'supabase_url')

            const founder = await signUpFounder()
            await completeAgency(founder.agencyId)

            const { error } = await founder.client.rpc('submit_agency_identity')
            expect(error, `submit ne doit jamais echouer faute de config: ${error?.message}`).toBeNull()

            const { data: agency } = await serviceRoleClient()
              .from('agencies')
              .select('identity_submitted_at')
              .eq('id', founder.agencyId)
              .maybeSingle()
            expect(agency?.identity_submitted_at, 'la soumission reste posee malgre le dispatch saute').not.toBeNull()
            expect(await getEvents(founder.agencyId, 'agency_identity_submitted')).toHaveLength(1)
          } finally {
            await restoreConfig('supabase_url', urlBefore)
          }
        },
        15_000
      )

      it(
        'un dispatch vers une cible injoignable ne bloque ni ne fait echouer la soumission ' +
          '(best-effort, meme discipline que provision_solo_agency dans handle_new_user)',
        async () => {
          const urlBefore = await readConfig('supabase_url')
          const keyBefore = await readConfig('service_role_key')
          try {
            // Hote garanti sans DNS (RFC 2606, TLD .invalid) : jamais de service reel
            // derriere, mais une valeur NON VIDE -- passe donc la garde defensive
            // (base_url/svc_key non nuls) et force un vrai essai du worker pg_net, qui
            // echouera vite (DNS introuvable). Delibirement PAS une IP noire du genre
            // 192.0.2.1/TEST-NET-1 : verifie a la main contre le worker pg_net local
            // qu'une telle adresse n'echoue qu'au bout de SON PROPRE delai (jusqu'a
            // timeout_milliseconds), ce qui occupe le worker jusque-la et retarde les
            // requetes voisines encore en file (le worker traite par lot ; un lot ne se
            // libere qu'une fois son membre le plus lent regle) -- ca aurait fait
            // echouer par contagion les tests suivants de cette suite, qui dependent
            // eux d'un dispatch reel traite a temps. Un hote qui echoue par DNS reste
            // une cible tout aussi injoignable pour prouver ce test, sans ce cout.
            await setConfig('supabase_url', 'http://nonexistent-host-for-agency-verification-test.invalid')
            await setConfig('service_role_key', 'fake-service-key-unreachable-target')

            const founder = await signUpFounder()
            await completeAgency(founder.agencyId)

            const startedAt = Date.now()
            const { error } = await founder.client.rpc('submit_agency_identity')
            const elapsedMs = Date.now() - startedAt

            expect(error, `submit ne doit jamais echouer a cause d'une cible injoignable: ${error?.message}`).toBeNull()
            expect(
              elapsedMs,
              `submit_agency_identity a mis ${elapsedMs}ms -- net.http_post doit mettre en FILE, ` +
                'jamais attendre une reponse HTTP reelle'
            ).toBeLessThan(5_000)
            expect(await getEvents(founder.agencyId, 'agency_identity_submitted')).toHaveLength(1)
          } finally {
            await restoreConfig('supabase_url', urlBefore)
            await restoreConfig('service_role_key', keyBefore)
          }
        },
        15_000
      )
    })

    describe('sweep_pending_agency_verifications -- filet de rattrapage', () => {
      it(
        'ramasse un dossier soumis depuis plus de 15 minutes dont la verification n a jamais tourne',
        async () => {
          const urlBefore = await readConfig('supabase_url')
          const keyBefore = await readConfig('service_role_key')
          try {
            await setConfig('supabase_url', PG_NET_LOCAL_FUNCTIONS_URL)
            await setConfig('service_role_key', SERVICE_KEY)

            const agencyId = await createAgency('sweep-old')
            await addActiveSignatory(agencyId)
            const twentyMinAgo = new Date(Date.now() - 20 * 60_000).toISOString()
            const { error: updErr } = await serviceRoleClient()
              .from('agencies')
              .update({ identity_submitted_at: twentyMinAgo })
              .eq('id', agencyId)
            if (updErr) throw new Error(`seed identity_submitted_at: ${updErr.message}`)

            const { error } = await serviceRoleClient().rpc('sweep_pending_agency_verifications')
            expect(error, `sweep: ${error?.message}`).toBeNull()

            await waitUntil(async () => (await getChecks(agencyId)).length > 0)
            const agency = await getAgency(agencyId)
            expect(agency.verification_status, 'le filet a bien fait tourner le moteur').not.toBe('pending')

            // Cas nominal (revue etape 4/tache 4, point 1, exigence 3) : la
            // verification aboutit du premier coup, tres en-dessous de v_max_attempts
            // (5) -- une seule tentative comptee, jamais le traitement d'epuisement.
            expect(
              agency.verification_sweep_attempts,
              'une seule tentative suffit au cas nominal (verification aboutit du premier coup)'
            ).toBe(1)
            expect(
              await getEvents(agencyId, 'agency_verification_sweep_exhausted'),
              "le cas nominal ne doit jamais se faire passer pour un epuisement de tentatives"
            ).toHaveLength(0)
          } finally {
            await restoreConfig('supabase_url', urlBefore)
            await restoreConfig('service_role_key', keyBefore)
          }
        },
        15_000
      )

      it(
        'respecte la grace de 15 minutes : un dossier soumis a l instant n est pas ramasse par le meme passage',
        async () => {
          const urlBefore = await readConfig('supabase_url')
          const keyBefore = await readConfig('service_role_key')
          try {
            await setConfig('supabase_url', PG_NET_LOCAL_FUNCTIONS_URL)
            await setConfig('service_role_key', SERVICE_KEY)

            const oldAgencyId = await createAgency('sweep-grace-old')
            await addActiveSignatory(oldAgencyId)
            const twentyMinAgo = new Date(Date.now() - 20 * 60_000).toISOString()
            await serviceRoleClient().from('agencies').update({ identity_submitted_at: twentyMinAgo }).eq('id', oldAgencyId)

            const freshAgencyId = await createAgency('sweep-grace-fresh')
            await addActiveSignatory(freshAgencyId)
            await serviceRoleClient()
              .from('agencies')
              .update({ identity_submitted_at: new Date().toISOString() })
              .eq('id', freshAgencyId)

            const { error } = await serviceRoleClient().rpc('sweep_pending_agency_verifications')
            expect(error).toBeNull()

            // Attend que le dossier ELIGIBLE (soumis il y a 20 min) montre une activite
            // reelle -- preuve que le passage a bien eu lieu -- puis verifie, a ce MEME
            // instant, que le dossier trop recent n'en montre aucune : les deux
            // dispatches partageraient le meme worker pg_net et la meme edge function,
            // rien ne justifierait que l'un traine derriere l'autre si les deux avaient
            // ete envoyes.
            await waitUntil(async () => (await getChecks(oldAgencyId)).length > 0)
            expect(
              await getChecks(freshAgencyId),
              'un dossier soumis a l instant ne doit pas etre ramasse par le filet (course avec le declenchement primaire)'
            ).toHaveLength(0)
            const freshAgency = await getAgency(freshAgencyId)
            expect(freshAgency.verification_status).toBe('pending')
          } finally {
            await restoreConfig('supabase_url', urlBefore)
            await restoreConfig('service_role_key', keyBefore)
          }
        },
        15_000
      )

      it(
        "sans configuration, le filet ne fait rien plutot que d echouer (meme garde que le declenchement primaire)",
        async () => {
          const urlBefore = await readConfig('supabase_url')
          try {
            await serviceRoleClient().from('app_config').delete().eq('key', 'supabase_url')

            const agencyId = await createAgency('sweep-no-config')
            await addActiveSignatory(agencyId)
            const twentyMinAgo = new Date(Date.now() - 20 * 60_000).toISOString()
            await serviceRoleClient().from('agencies').update({ identity_submitted_at: twentyMinAgo }).eq('id', agencyId)

            const { error } = await serviceRoleClient().rpc('sweep_pending_agency_verifications')
            expect(error, `sweep ne doit jamais echouer faute de config: ${error?.message}`).toBeNull()
          } finally {
            await restoreConfig('supabase_url', urlBefore)
          }
        },
        15_000
      )

      // Revue etape 4/tache 4, point 1 -- le filet reprenait indefiniment le meme
      // dossier, sans compteur, sans borne, et sans jamais le rendre visible
      // autrement qu'en lisant les journaux Postgres. Les deux tests ci-dessous
      // prouvent la borne : celui qui la franchit (le compteur atteint
      // v_max_attempts et le dossier bascule en manual_review, journalise) et celui
      // qui l'a deja franchie (defense en profondeur -- le filtre lui-meme exclut
      // toute reprise, meme si le statut redevenait 'pending' par un chemin futur
      // non prevu aujourd'hui).
      it(
        'un dossier qui epuise ses tentatives (v_max_attempts) cesse d etre repris et devient visible ' +
          '(bascule verification_status=manual_review + activity_events explicite) -- jamais retente indefiniment en silence',
        async () => {
          const urlBefore = await readConfig('supabase_url')
          const keyBefore = await readConfig('service_role_key')
          try {
            // Cible injoignable mais non vide (meme motif que le test "cible injoignable"
            // du declenchement primaire, plus haut) : passe la garde defensive et force
            // un vrai essai du worker pg_net, qui echoue vite par DNS (TLD .invalid,
            // RFC 2606) sans jamais faire attendre ce test ni contaminer les requetes
            // voisines (jamais une IP noire qui bloquerait jusqu'a son propre timeout).
            await setConfig('supabase_url', 'http://nonexistent-host-for-agency-verification-sweep-exhaustion.invalid')
            await setConfig('service_role_key', 'fake-service-key-unreachable-target')

            const agencyId = await createAgency('sweep-exhausted')
            await addActiveSignatory(agencyId)
            const twentyMinAgo = new Date(Date.now() - 20 * 60_000).toISOString()
            // Seede juste EN DESSOUS de la borne (5) : cet appel de sweep est donc la
            // derniere tentative encore legitime -- exactement l'endroit ou le
            // comportement doit basculer.
            const { error: seedErr } = await serviceRoleClient()
              .from('agencies')
              .update({ identity_submitted_at: twentyMinAgo, verification_sweep_attempts: 4 })
              .eq('id', agencyId)
            if (seedErr) throw new Error(`seed attempts: ${seedErr.message}`)

            const { error } = await serviceRoleClient().rpc('sweep_pending_agency_verifications')
            expect(error, `sweep: ${error?.message}`).toBeNull()

            const agency = await getAgency(agencyId)
            expect(agency.verification_sweep_attempts, 'la derniere tentative autorisee est bien comptee').toBe(5)
            expect(
              agency.verification_status,
              'borne atteinte -> visible dans la file de revue humaine (manual_review), jamais laisse en pending silencieux'
            ).toBe('manual_review')

            const exhaustedEvents = await getEvents(agencyId, 'agency_verification_sweep_exhausted')
            expect(
              exhaustedEvents,
              'un activity_events explique la bascule -- un humain doit pouvoir le voir sans lire les journaux Postgres'
            ).toHaveLength(1)
            expect(exhaustedEvents[0]).toMatchObject({ category: 'kyc', actor_kind: 'system', actor_id: null })

            // Au-dela de la borne, on cesse de retenter : un second passage ne doit
            // plus jamais reprendre ce dossier -- ni nouvelle tentative comptee, ni
            // nouveau dispatch. Preuve que la boucle s'est reellement arretee, pas
            // seulement que cette fois-ci s'est bien passee.
            const { error: secondError } = await serviceRoleClient().rpc('sweep_pending_agency_verifications')
            expect(secondError).toBeNull()
            const agencyAfterSecondSweep = await getAgency(agencyId)
            expect(
              agencyAfterSecondSweep.verification_sweep_attempts,
              'au-dela de la borne, un second passage ne doit plus incrementer le compteur'
            ).toBe(5)
          } finally {
            await restoreConfig('supabase_url', urlBefore)
            await restoreConfig('service_role_key', keyBefore)
          }
        },
        15_000
      )

      it(
        'un dossier deja a la borne n est jamais repris ni recompte, meme redevenu pending par un chemin futur non prevu aujourd hui ' +
          '(defense en profondeur du filtre, independante de la bascule manual_review)',
        async () => {
          const urlBefore = await readConfig('supabase_url')
          const keyBefore = await readConfig('service_role_key')
          try {
            await setConfig('supabase_url', PG_NET_LOCAL_FUNCTIONS_URL)
            await setConfig('service_role_key', SERVICE_KEY)

            const agencyId = await createAgency('sweep-at-bound')
            await addActiveSignatory(agencyId)
            const twentyMinAgo = new Date(Date.now() - 20 * 60_000).toISOString()
            // verification_status force a 'pending' MALGRE un compteur deja a la
            // borne -- etat qu'aucun chemin actuel du depot ne produit (rien ne
            // repasse verification_status a 'pending' une fois sorti), mais que le
            // filtre doit exclure par lui-meme, sans dependre de la bascule
            // manual_review pour rester sans boucle.
            const { error: seedErr } = await serviceRoleClient()
              .from('agencies')
              .update({ identity_submitted_at: twentyMinAgo, verification_sweep_attempts: 5, verification_status: 'pending' })
              .eq('id', agencyId)
            if (seedErr) throw new Error(`seed attempts: ${seedErr.message}`)

            const { error } = await serviceRoleClient().rpc('sweep_pending_agency_verifications')
            expect(error, `sweep: ${error?.message}`).toBeNull()

            // Marge courte (meme motif que le second appel de submit_agency_identity,
            // plus haut) : si un dispatch partait par erreur, il aurait largement le
            // temps d'ecrire son check avant cette assertion.
            await new Promise((resolve) => setTimeout(resolve, 500))
            expect(
              await getChecks(agencyId),
              'un dossier deja a la borne ne doit declencher aucun dispatch, meme retrouve pending'
            ).toHaveLength(0)
            const agency = await getAgency(agencyId)
            expect(agency.verification_sweep_attempts, 'le filtre exclut la ligne avant meme de l atteindre -- pas de recompte').toBe(5)
          } finally {
            await restoreConfig('supabase_url', urlBefore)
            await restoreConfig('service_role_key', keyBefore)
          }
        },
        15_000
      )
    })
  })
})

// ─── Connecteur RDAP (domain_whois_age, etape 4 tache 2) -- logique pure ──────────
//
// Hors du describe.skipIf(!HAS_KEYS) ci-dessus DELIBEREMENT : ce volet n'a besoin ni
// de reseau reel (fetch stubbe, meme motif que _shared/esign-finalize.test.ts) ni de
// Supabase local (import direct du module, meme motif que le "harnais pur" plus
// haut). Il DOIT tourner meme sans `supabase start`, et jamais dependre de la
// disponibilite des serveurs RDAP publics (rdap.nic.ch / .li / .fr) -- une suite de
// tests qui dependrait d'un service tiers serait aussi fragile que le systeme qu'elle
// verifie. La verification CONTRE le vrai serveur RDAP se fait a la main, une fois,
// hors de cette suite -- voir docs/superpowers/sdd/task-2-report.md.
describe('connecteur RDAP (domain_whois_age) -- logique pure, fetch stubbe (aucun reseau reel)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function rdapSource(): KybSource {
    const found = AGENCY_KYB_SOURCES.find((s) => s.checkType === 'domain_whois_age')
    if (!found) throw new Error('domain_whois_age absent de AGENCY_KYB_SOURCES -- le connecteur RDAP n est pas enregistre')
    return found
  }

  function agencyWithWebsite(website: string | null): AgencyForVerification {
    return {
      id: '00000000-0000-0000-0000-000000000000',
      legal_name: 'Regie Test SA',
      trade_name: null,
      business_registration_number: null,
      country: 'CH',
      canton: 'GE',
      city: null,
      postal_code: null,
      address: null,
      website,
      tva: null,
    }
  }

  // Reponse RDAP minimale valide -- {status, events} par defaut, ecrasable au cas par
  // cas. new Response() (global Node/Deno standard, aucun import) suffit : le
  // connecteur ne lit que .status (HTTP) et .json().
  function rdapResponse(body: Record<string, unknown>, httpStatus = 200): Response {
    return new Response(JSON.stringify({ status: ['active'], events: [], ...body }), {
      status: httpStatus,
      headers: { 'content-type': 'application/json' },
    })
  }

  it('aucun site web declare -> unavailable, jamais mismatch (rien a verifier) -- et aucune requete reseau', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const row = await runKybSource(rdapSource(), agencyWithWebsite(null))
    expect(row.result).toBe('unavailable')
    expect(row.check_type).toBe('domain_whois_age')
    expect(row.source).toBe('rdap')
    expect(fetchSpy, 'pas de site web -> rien a interroger, jamais un appel RDAP').not.toHaveBeenCalled()
  })

  it('site web vide (chaine blanche) -> unavailable, meme traitement que null', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const row = await runKybSource(rdapSource(), agencyWithWebsite('   '))
    expect(row.result).toBe('unavailable')
  })

  it('suffixe non couvert (.de) -> unavailable, jamais un echec qui bloque tout le passage', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const row = await runKybSource(rdapSource(), agencyWithWebsite('https://www.example.de'))
    expect(row.result).toBe('unavailable')
    expect(fetchSpy, 'suffixe non couvert -> aucun serveur a interroger').not.toHaveBeenCalled()
  })

  it("domaine grand public (gmail.com) -> check domain_generic_provider en partial, jamais domain_whois_age (revue etape 4/tache 2, point 2) : beaucoup de petites agences n'ont pas de domaine propre", async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const row = await runKybSource(rdapSource(), agencyWithWebsite('gmail.com'))
    expect(row.result).toBe('partial')
    expect(
      row.check_type,
      'le catalogue (verification_check_types/verification_check_config, migration 20260728103000) distingue domain_generic_provider de domain_whois_age avec un poids different (1.00 vs 0.75) -- les plier dans un seul type laisserait une ligne de config morte'
    ).toBe('domain_generic_provider')
    expect(row.raw_response).toMatchObject({ domain: 'gmail.com', reason: 'generic_email_provider' })
    expect(fetchSpy, 'un domaine grand public ne declenche meme pas de requete RDAP').not.toHaveBeenCalled()
  })

  it('outlook.com (autre domaine grand public, avec chemin) -> partial et check_type domain_generic_provider egalement', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const row = await runKybSource(rdapSource(), agencyWithWebsite('https://outlook.com/mail/inbox'))
    expect(row.result).toBe('partial')
    expect(row.check_type).toBe('domain_generic_provider')
    expect(row.raw_response.domain).toBe('outlook.com')
  })

  it('domaine .ch introuvable au registre (RDAP 404) -> mismatch, jamais unavailable : le serveur A repondu, sans ambiguite', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 404 })))
    const row = await runKybSource(rdapSource(), agencyWithWebsite('https://une-agence-qui-nexiste-pas-zzz.ch'))
    expect(row.result).toBe('mismatch')
    expect(row.raw_response).toMatchObject({
      domain: 'une-agence-qui-nexiste-pas-zzz.ch',
      rdap_status: 404,
      reason: 'domain_not_registered',
    })
  })

  it(
    'domaine .ch enregistre il y a 3 jours, statut actif -> partial, jamais mismatch : un domaine recent ' +
      'ne contredit rien, il confirme seulement moins bien qu un domaine etabli (revue etape 4/tache 2, point 1)',
    async () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString()
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => rdapResponse({ status: ['active'], events: [{ eventAction: 'registration', eventDate: threeDaysAgo }] }))
      )
      const row = await runKybSource(rdapSource(), agencyWithWebsite('https://jeune-agence.ch'))
      expect(
        row.result,
        'une agence fondee le mois dernier a legitimement un domaine du mois dernier -- mismatch inscrirait un verdict defavorable pour un fait qui n a rien d anormal'
      ).toBe('partial')
      expect(row.raw_response.age_days).toBeLessThan(10)
    }
  )

  it(
    "domaine .ch enregistre a l'instant (age_days = 0), statut actif -> partial, jamais un verdict defavorable : " +
      'preuve directe qu un domaine actif tres recent ne contredit jamais rien (revue etape 4/tache 2, point 1)',
    async () => {
      const rightNow = new Date().toISOString()
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => rdapResponse({ status: ['active'], events: [{ eventAction: 'registration', eventDate: rightNow }] }))
      )
      const row = await runKybSource(rdapSource(), agencyWithWebsite('https://toute-nouvelle-agence.ch'))
      expect(row.raw_response.age_days).toBe(0)
      expect(row.result, 'meme a age_days=0 et statut actif, jamais mismatch -- seule la contradiction (inexistant/expire/suspendu) le justifie').toBe(
        'partial'
      )
    }
  )

  it('domaine .fr enregistre il y a plus de 6 mois, statut actif -> match', async () => {
    const longAgo = new Date(Date.now() - 400 * 86_400_000).toISOString()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => rdapResponse({ status: ['active'], events: [{ eventAction: 'registration', eventDate: longAgo }] }))
    )
    const row = await runKybSource(rdapSource(), agencyWithWebsite('https://www.regie-etablie.fr'))
    expect(row.result).toBe('match')
    expect(row.check_type, 'chemin normal (pas fournisseur grand public) -> check_type par defaut du connecteur').toBe('domain_whois_age')
  })

  it(
    'domaine .ch etabli (plus de 6 mois) mais statut pendingDelete -> mismatch : un domaine qui a existe mais ne ' +
      'tient plus contredit reellement une agence qui se pretend etablie ET en activite (revue etape 4/tache 2, point 1)',
    async () => {
      const longAgo = new Date(Date.now() - 400 * 86_400_000).toISOString()
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => rdapResponse({ status: ['pendingDelete'], events: [{ eventAction: 'registration', eventDate: longAgo }] }))
      )
      const row = await runKybSource(rdapSource(), agencyWithWebsite('https://regie-abandonnee.ch'))
      expect(row.result).toBe('mismatch')
    }
  )

  it('domaine .li enregistre il y a 90 jours (recent, sous le seuil d etablissement) -> partial : confirme moins bien qu un domaine etabli, sans jamais contredire', async () => {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => rdapResponse({ status: ['active'], events: [{ eventAction: 'registration', eventDate: ninetyDaysAgo }] }))
    )
    const row = await runKybSource(rdapSource(), agencyWithWebsite('agence-recente.li'))
    expect(row.result).toBe('partial')
  })

  it("reponse RDAP sans date d'enregistrement (constate en verification manuelle sur plusieurs domaines .ch reels) mais statut actif -> partial, jamais un match invente sur une anciennete inconnue", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => rdapResponse({ status: ['active'], events: [] })))
    const row = await runKybSource(rdapSource(), agencyWithWebsite('https://regie-sans-date.ch'))
    expect(row.result).toBe('partial')
  })

  it('statut non-actif sans date -> partial, jamais mismatch sur ce seul indice (vocabulaire de statut trop variable d un registre a l autre)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => rdapResponse({ status: ['inactive'], events: [] })))
    const row = await runKybSource(rdapSource(), agencyWithWebsite('https://regie-inactive.ch'))
    expect(row.result).toBe('partial')
  })

  it('le serveur RDAP repond en erreur serveur (500) -> unavailable, jamais un echec qui bloque le dossier', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })))
    const row = await runKybSource(rdapSource(), agencyWithWebsite('https://regie.ch'))
    expect(row.result).toBe('unavailable')
  })

  it('reponse illisible (JSON invalide) -> unavailable, jamais un match invente faute de savoir lire la reponse', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>pas du json</html>', { status: 200, headers: { 'content-type': 'text/html' } }))
    )
    const row = await runKybSource(rdapSource(), agencyWithWebsite('https://regie.ch'))
    expect(row.result).toBe('unavailable')
  })

  it('panne reseau (fetch qui rejette) -> unavailable, jamais une exception qui remonte jusqu au moteur', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      })
    )
    const row = await runKybSource(rdapSource(), agencyWithWebsite('https://regie.ch'))
    expect(row.result).toBe('unavailable')
  })

  it('le domaine est extrait du site web quelle que soit sa forme (https://, www., chemin, query) et interroge le bon registre selon le suffixe', async () => {
    const fetchSpy = vi.fn(async () => rdapResponse({ status: ['active'], events: [] }))
    vi.stubGlobal('fetch', fetchSpy)
    await runKybSource(rdapSource(), agencyWithWebsite('https://www.regie-dupont.ch/contact?ref=1'))
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(String(fetchSpy.mock.calls[0][0])).toBe('https://rdap.nic.ch/domain/regie-dupont.ch')
  })

  it('route .li vers rdap.nic.li et .fr vers rdap.nic.fr', async () => {
    const fetchSpy = vi.fn(async () => rdapResponse({ status: ['active'], events: [] }))
    vi.stubGlobal('fetch', fetchSpy)
    await runKybSource(rdapSource(), agencyWithWebsite('regie.li'))
    await runKybSource(rdapSource(), agencyWithWebsite('regie.fr'))
    expect(String(fetchSpy.mock.calls[0][0])).toBe('https://rdap.nic.li/domain/regie.li')
    expect(String(fetchSpy.mock.calls[1][0])).toBe('https://rdap.nic.fr/domain/regie.fr')
  })

  it('un resultat calcule (match/partial/mismatch) joint toujours domaine, statut HTTP et payload RDAP -- jamais un verdict sans preuve (revue etape 4/tache 1, point 1)', async () => {
    const longAgo = new Date(Date.now() - 400 * 86_400_000).toISOString()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => rdapResponse({ status: ['active'], events: [{ eventAction: 'registration', eventDate: longAgo }] }))
    )
    const row = await runKybSource(rdapSource(), agencyWithWebsite('https://regie-etablie.ch'))
    expect(row.result).toBe('match')
    expect(row.raw_response.domain).toBe('regie-etablie.ch')
    expect(row.raw_response.rdap_status).toBe(200)
    expect(row.raw_response.rdap).toBeTruthy()
  })

  it("timeout du connecteur RDAP (signal d'annulation atteint) -> unavailable via le harnais, meme sans reponse du tout", async () => {
    // Simule un serveur qui ne repond jamais : fetch ne se resout ni ne rejette avant
    // le timeout externe de runKybSource (Promise.race, _shared/kyb-sources.ts).
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const row = await runKybSource(rdapSource(), agencyWithWebsite('https://regie-muette.ch'), 50)
    expect(row.result).toBe('unavailable')
    expect(row.raw_response).toMatchObject({ reason: 'timeout' })
  }, 2_000)
})

// ─── Connecteur VIES (vat_lookup, etape 4 tache 3) -- logique pure ────────────────
//
// Hors du describe.skipIf(!HAS_KEYS) DELIBEREMENT, meme motif que le connecteur RDAP
// plus haut : fetch stubbe, aucun reseau reel, aucune dependance Supabase locale. La
// verification CONTRE le vrai service VIES se fait a la main, une fois, hors de cette
// suite -- voir docs/superpowers/sdd/task-3-report.md (endpoint REST, codes pays
// couverts EL/XI vs GR/GB/CH, forme exacte de reponse -- tout verifie en direct).
describe('connecteur VIES (vat_lookup) -- logique pure, fetch stubbe (aucun reseau reel)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function vatLookupSource(): KybSource {
    const found = AGENCY_KYB_SOURCES.find((s) => s.checkType === 'vat_lookup')
    if (!found) throw new Error('vat_lookup absent de AGENCY_KYB_SOURCES -- le connecteur VIES n est pas enregistre')
    return found
  }

  function agencyWithTva(tva: string | null): AgencyForVerification {
    return {
      id: '00000000-0000-0000-0000-000000000000',
      legal_name: 'Regie Test SA',
      trade_name: null,
      business_registration_number: null,
      country: 'FR',
      canton: null,
      city: null,
      postal_code: null,
      address: null,
      website: null,
      tva,
    }
  }

  function viesResponse(body: Record<string, unknown>): Response {
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
  }

  it('aucune TVA declaree -> unavailable, jamais mismatch (facultative a la saisie) -- et aucune requete reseau', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const row = await runKybSource(vatLookupSource(), agencyWithTva(null))
    expect(row.result).toBe('unavailable')
    expect(row.check_type).toBe('vat_lookup')
    expect(row.source).toBe('vies')
    expect(fetchSpy, 'pas de TVA -> rien a verifier, jamais un appel VIES').not.toHaveBeenCalled()
  })

  it('TVA vide (chaine blanche) -> unavailable, meme traitement que null', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const row = await runKybSource(vatLookupSource(), agencyWithTva('   '))
    expect(row.result).toBe('unavailable')
  })

  it(
    'TVA suisse (CHE-...) -> unavailable, jamais un appel VIES : la Suisse est hors UE, non couverte ' +
      '(registre UID, etape 6)',
    async () => {
      const fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)
      const row = await runKybSource(vatLookupSource(), agencyWithTva('CHE-115.856.981 TVA'))
      expect(row.result).toBe('unavailable')
      expect(fetchSpy).not.toHaveBeenCalled()
    }
  )

  it('numero valide selon VIES -> match', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => viesResponse({ valid: true, name: 'SA EXEMPLE', address: '1 RUE X' })))
    const row = await runKybSource(vatLookupSource(), agencyWithTva('FR10632012100'))
    expect(row.result).toBe('match')
  })

  it('numero juge invalide par VIES -> mismatch, jamais unavailable (le service A repondu)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => viesResponse({ valid: false, name: '---', address: '---' })))
    const row = await runKybSource(vatLookupSource(), agencyWithTva('FR00000000000'))
    expect(row.result).toBe('mismatch')
  })

  it('la TVA saisie avec espaces/tirets/points est normalisee avant l appel (pays + numero corrects)', async () => {
    const fetchSpy = vi.fn(async () => viesResponse({ valid: true }))
    vi.stubGlobal('fetch', fetchSpy)
    await runKybSource(vatLookupSource(), agencyWithTva('FR 10.632-012 100'))
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const init = fetchSpy.mock.calls[0][1] as RequestInit
    expect(JSON.parse(init.body as string)).toEqual({ countryCode: 'FR', vatNumber: '10632012100' })
  })

  it('la Grece (EL, pas GR) est acceptee et transmise telle quelle a VIES', async () => {
    const fetchSpy = vi.fn(async () => viesResponse({ valid: true }))
    vi.stubGlobal('fetch', fetchSpy)
    await runKybSource(vatLookupSource(), agencyWithTva('EL123456789'))
    const init = fetchSpy.mock.calls[0][1] as RequestInit
    expect(JSON.parse(init.body as string).countryCode).toBe('EL')
  })

  it('Irlande du Nord (XI) est acceptee (regime TVA UE maintenu post-Brexit)', async () => {
    const fetchSpy = vi.fn(async () => viesResponse({ valid: true }))
    vi.stubGlobal('fetch', fetchSpy)
    await runKybSource(vatLookupSource(), agencyWithTva('XI123456789'))
    const init = fetchSpy.mock.calls[0][1] as RequestInit
    expect(JSON.parse(init.body as string).countryCode).toBe('XI')
  })

  it(
    'VIES repond actionSucceed:false (code pays rejete ou service indisponible, HTTP 200 quand meme -- ' +
      'verifie en direct contre le vrai service, voir rapport de tache) -> unavailable, jamais mismatch',
    async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => viesResponse({ actionSucceed: false, errorWrappers: [{ error: 'INVALID_INPUT' }] }))
      )
      const row = await runKybSource(vatLookupSource(), agencyWithTva('FR10632012100'))
      expect(row.result).toBe('unavailable')
    }
  )

  it('erreur serveur (500) -> unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })))
    const row = await runKybSource(vatLookupSource(), agencyWithTva('FR10632012100'))
    expect(row.result).toBe('unavailable')
  })

  it('reponse illisible (JSON invalide) -> unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>pas du json</html>', { status: 200 })))
    const row = await runKybSource(vatLookupSource(), agencyWithTva('FR10632012100'))
    expect(row.result).toBe('unavailable')
  })

  it('panne reseau (fetch qui rejette) -> unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      })
    )
    const row = await runKybSource(vatLookupSource(), agencyWithTva('FR10632012100'))
    expect(row.result).toBe('unavailable')
  })

  it("timeout du connecteur -> unavailable via le harnais", async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const row = await runKybSource(vatLookupSource(), agencyWithTva('FR10632012100'), 50)
    expect(row.result).toBe('unavailable')
    expect(row.raw_response).toMatchObject({ reason: 'timeout' })
  }, 2_000)

  it('un resultat calcule joint toujours la TVA, le pays/numero extraits et la reponse VIES complete -- jamais un verdict sans preuve', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => viesResponse({ valid: true, name: 'SA EXEMPLE' })))
    const row = await runKybSource(vatLookupSource(), agencyWithTva('FR10632012100'))
    expect(row.raw_response.country_code).toBe('FR')
    expect(row.raw_response.vat_number).toBe('10632012100')
    expect(row.raw_response.vies).toMatchObject({ valid: true, name: 'SA EXEMPLE' })
  })
})

// ─── Connecteur registre francais (registry_lookup / registry_legal_name_match,
//     etape 4 tache 3) -- logique pure ─────────────────────────────────────────────
//
// Hors du describe.skipIf(!HAS_KEYS) DELIBEREMENT, meme motif que RDAP/VIES plus haut.
// La verification CONTRE le vrai service (recherche-entreprises.api.gouv.fr) se fait a
// la main, une fois, hors de cette suite -- voir docs/superpowers/sdd/task-3-report.md
// (recherche par SIREN direct, forme exacte de reponse, SIREN inexistant -> 200 avec
// results:[] -- tout verifie en direct contre le vrai service).
describe('connecteur registre francais (registry_lookup / registry_legal_name_match) -- logique pure, fetch stubbe', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function registryLookupSource(): KybSource {
    const found = AGENCY_KYB_SOURCES.find((s) => s.checkType === 'registry_lookup')
    if (!found) throw new Error('registry_lookup absent de AGENCY_KYB_SOURCES')
    return found
  }

  function registryLegalNameMatchSource(): KybSource {
    const found = AGENCY_KYB_SOURCES.find((s) => s.checkType === 'registry_legal_name_match')
    if (!found) throw new Error('registry_legal_name_match absent de AGENCY_KYB_SOURCES')
    return found
  }

  function agencyFR(overrides: Partial<AgencyForVerification> = {}): AgencyForVerification {
    return {
      id: '00000000-0000-0000-0000-000000000000',
      legal_name: 'Carrefour',
      trade_name: null,
      business_registration_number: '510761505',
      country: 'FR',
      canton: null,
      city: null,
      postal_code: null,
      address: null,
      website: null,
      tva: null,
      ...overrides,
    }
  }

  function rechercheEntreprisesResponse(results: Record<string, unknown>[]): Response {
    return new Response(JSON.stringify({ results, total_results: results.length }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  function activeResult(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return { siren: '510761505', nom_raison_sociale: 'CARREFOUR', etat_administratif: 'A', ...overrides }
  }

  for (const label of ['registry_lookup', 'registry_legal_name_match'] as const) {
    const sourceOf = () => (label === 'registry_lookup' ? registryLookupSource() : registryLegalNameMatchSource())

    it(`${label} : siege hors France (CH) -> unavailable, jamais un appel reseau (ne s interroge que pour un siege en France)`, async () => {
      const fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)
      const row = await runKybSource(sourceOf(), agencyFR({ country: 'CH' }))
      expect(row.result).toBe('unavailable')
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it(`${label} : aucun business_registration_number declare -> unavailable, jamais un appel reseau`, async () => {
      const fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)
      const row = await runKybSource(sourceOf(), agencyFR({ business_registration_number: null }))
      expect(row.result).toBe('unavailable')
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it(`${label} : SIREN manifestement malforme (pas 9 chiffres) -> unavailable, jamais un appel reseau`, async () => {
      const fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)
      const row = await runKybSource(sourceOf(), agencyFR({ business_registration_number: '12345' }))
      expect(row.result).toBe('unavailable')
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it(`${label} : erreur serveur (500) -> unavailable`, async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })))
      const row = await runKybSource(sourceOf(), agencyFR())
      expect(row.result).toBe('unavailable')
    })

    it(`${label} : reponse illisible (JSON invalide) -> unavailable`, async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('<html></html>', { status: 200 })))
      const row = await runKybSource(sourceOf(), agencyFR())
      expect(row.result).toBe('unavailable')
    })

    it(
      `${label} : reponse HTTP 200 hors schema (results absent, ex. panne fournisseur) -> unavailable, ` +
        'jamais un verdict invente (revue etape 4/tache 3, point 1 -- meme garde que VIES : le type du champ ' +
        'attendu est verifie avant de conclure a une absence)',
      async () => {
        vi.stubGlobal(
          'fetch',
          vi.fn(
            async () =>
              new Response(JSON.stringify({ error: 'service degrade' }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
              })
          )
        )
        const row = await runKybSource(sourceOf(), agencyFR())
        expect(row.result).toBe('unavailable')
      }
    )

    it(`${label} : panne reseau -> unavailable`, async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new Error('network down')
        })
      )
      const row = await runKybSource(sourceOf(), agencyFR())
      expect(row.result).toBe('unavailable')
    })

    it(`${label} : timeout -> unavailable via le harnais`, async () => {
      vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
      const row = await runKybSource(sourceOf(), agencyFR(), 50)
      expect(row.result).toBe('unavailable')
    }, 2_000)
  }

  it('SIREN saisi avec espaces (forme d affichage officielle INSEE) -> normalise avant l appel', async () => {
    const fetchSpy = vi.fn(async () => rechercheEntreprisesResponse([activeResult()]))
    vi.stubGlobal('fetch', fetchSpy)
    await runKybSource(registryLookupSource(), agencyFR({ business_registration_number: '510 761 505' }))
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(String(fetchSpy.mock.calls[0][0])).toBe('https://recherche-entreprises.api.gouv.fr/search?q=510761505')
  })

  describe('registry_lookup -- existence et statut actif', () => {
    it('SIREN introuvable (results:[], le registre A repondu -- verifie en direct) -> mismatch, jamais unavailable', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => rechercheEntreprisesResponse([])))
      const row = await runKybSource(registryLookupSource(), agencyFR())
      expect(row.result).toBe('mismatch')
      expect(row.raw_response).toMatchObject({ reason: 'siren_not_found' })
    })

    it('entreprise active (etat_administratif=A) -> match', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => rechercheEntreprisesResponse([activeResult()])))
      const row = await runKybSource(registryLookupSource(), agencyFR())
      expect(row.result).toBe('match')
    })

    it('entreprise existante mais cessee (etat_administratif != A) -> mismatch : contredit une agence qui se pretend en activite', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => rechercheEntreprisesResponse([activeResult({ etat_administratif: 'C' })]))
      )
      const row = await runKybSource(registryLookupSource(), agencyFR())
      expect(row.result).toBe('mismatch')
    })

    it('un resultat calcule joint toujours le SIREN, le statut et la reponse complete -- jamais un verdict sans preuve', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => rechercheEntreprisesResponse([activeResult()])))
      const row = await runKybSource(registryLookupSource(), agencyFR())
      expect(row.raw_response.siren).toBe('510761505')
      expect(row.raw_response.etat_administratif).toBe('A')
      expect(row.raw_response.recherche_entreprises).toBeTruthy()
    })
  })

  describe('registry_legal_name_match -- raison sociale (fuzzy strict : accents/casse/ponctuation)', () => {
    it('aucune raison sociale declaree (legal_name absent) -> unavailable, jamais un appel reseau', async () => {
      const fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)
      const row = await runKybSource(registryLegalNameMatchSource(), agencyFR({ legal_name: null }))
      expect(row.result).toBe('unavailable')
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('SIREN introuvable -> unavailable (rien a comparer), pas un doublon du mismatch de registry_lookup', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => rechercheEntreprisesResponse([])))
      const row = await runKybSource(registryLegalNameMatchSource(), agencyFR())
      expect(row.result).toBe('unavailable')
    })

    it('raison sociale identique au caractere pres -> match', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => rechercheEntreprisesResponse([activeResult({ nom_raison_sociale: 'CARREFOUR' })]))
      )
      const row = await runKybSource(registryLegalNameMatchSource(), agencyFR({ legal_name: 'CARREFOUR' }))
      expect(row.result).toBe('match')
    })

    it('difference de casse et d accents seulement -> match (tolere)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => rechercheEntreprisesResponse([activeResult({ nom_raison_sociale: 'REGIE DE LA COTE' })]))
      )
      const row = await runKybSource(registryLegalNameMatchSource(), agencyFR({ legal_name: 'régie de la Côte' }))
      expect(row.result).toBe('match')
    })

    it('difference de ponctuation seulement (S.A. vs SA, tiret vs espace) -> match (tolere)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => rechercheEntreprisesResponse([activeResult({ nom_raison_sociale: 'DUPONT MARTIN SA' })]))
      )
      const row = await runKybSource(registryLegalNameMatchSource(), agencyFR({ legal_name: 'Dupont-Martin S.A.' }))
      expect(row.result).toBe('match')
    })

    it('raison sociale reellement differente -> mismatch (rien au-dela d accent/casse/ponctuation n est tolere)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => rechercheEntreprisesResponse([activeResult({ nom_raison_sociale: 'CARREFOUR' })]))
      )
      const row = await runKybSource(registryLegalNameMatchSource(), agencyFR({ legal_name: 'Immobilier Dupont' }))
      expect(row.result).toBe('mismatch')
    })

    it('reste correct meme si l entreprise est cessee : le nom peut matcher independamment du statut actif', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => rechercheEntreprisesResponse([activeResult({ etat_administratif: 'C', nom_raison_sociale: 'CARREFOUR' })]))
      )
      const row = await runKybSource(registryLegalNameMatchSource(), agencyFR({ legal_name: 'Carrefour' }))
      expect(row.result).toBe('match')
    })

    it(
      'deux raisons sociales DIFFERENTES qui ne different que par la frontiere de mot (espace) ne doivent PAS ' +
        'matcher -- faux positif demontre en revue (etape 4/tache 3, point 2) : "Est Immobilier" et ' +
        '"ESTIM MOBILIER" se reduisaient avant correctif a la meme chaine, l espace ayant disparu comme ' +
        'n importe quelle ponctuation',
      async () => {
        vi.stubGlobal(
          'fetch',
          vi.fn(async () => rechercheEntreprisesResponse([activeResult({ nom_raison_sociale: 'ESTIM MOBILIER' })]))
        )
        const row = await runKybSource(registryLegalNameMatchSource(), agencyFR({ legal_name: 'Est Immobilier' }))
        expect(row.result).toBe('mismatch')
      }
    )

    it(
      'la ligature Œ (aucune decomposition canonique Unicode, donc pas touchee par NFD) doit matcher son ' +
        'ecriture en deux lettres -- faux negatif demontre en revue (etape 4/tache 3, point 2) : ' +
        '"Dupont et Soeurs" vs "DUPONT ET SŒURS"',
      async () => {
        vi.stubGlobal(
          'fetch',
          vi.fn(async () => rechercheEntreprisesResponse([activeResult({ nom_raison_sociale: 'DUPONT ET SŒURS' })]))
        )
        const row = await runKybSource(registryLegalNameMatchSource(), agencyFR({ legal_name: 'Dupont et Soeurs' }))
        expect(row.result).toBe('match')
      }
    )

    it(
      'la ligature Æ (voisine directe de Œ, meme absence de decomposition canonique) est egalement reduite ' +
        '-- pas seulement le cas signale (revue etape 4/tache 3, point 2)',
      async () => {
        vi.stubGlobal(
          'fetch',
          vi.fn(async () => rechercheEntreprisesResponse([activeResult({ nom_raison_sociale: 'AGENCE ÆQUITAS' })]))
        )
        const row = await runKybSource(registryLegalNameMatchSource(), agencyFR({ legal_name: 'Agence Aequitas' }))
        expect(row.result).toBe('match')
      }
    )
  })
})

// ─── Connecteur geocodage Mapbox (address_geocode, etape 4 tache 3) -- logique pure ──
//
// Hors du describe.skipIf(!HAS_KEYS) DELIBEREMENT, meme motif que les connecteurs
// precedents. PAS de verification a la main contre le vrai service Mapbox pour ce
// connecteur precis (contrairement a VIES et recherche-entreprises) : aucun jeton
// Mapbox n'etait disponible dans l'environnement de cette tache -- voir les reserves
// de docs/superpowers/sdd/task-3-report.md. La forme de reponse stubbee ici reprend
// EXACTEMENT le schema que Mapbox documente pour la Geocoding v5 (`features[].context[]`
// avec `id`/`short_code`) -- PAS un champ deja consomme tel quel ailleurs dans ce depot :
// Step2Address.tsx lit bien `context[].id` sur les memes entrees, mais pour leur
// `.text`, jamais `short_code` (meme correctif que le commentaire equivalent dans
// _shared/kyb-sources.ts, revue etape 4/tache 3, point 4).
describe('connecteur geocodage Mapbox (address_geocode) -- logique pure, fetch stubbe (aucun reseau reel)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function agencyGeo(overrides: Partial<AgencyForVerification> = {}): AgencyForVerification {
    return {
      id: '00000000-0000-0000-0000-000000000000',
      legal_name: 'Regie Test SA',
      trade_name: null,
      business_registration_number: null,
      country: 'CH',
      canton: 'GE',
      city: 'Geneve',
      postal_code: '1201',
      address: 'Rue du Rhone 1',
      website: null,
      tva: null,
      ...overrides,
    }
  }

  function mapboxResponse(features: Record<string, unknown>[]): Response {
    return new Response(JSON.stringify({ features }), { status: 200, headers: { 'content-type': 'application/json' } })
  }

  function chGeFeature(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      place_name: 'Rue du Rhone 1, 1201 Geneve, Suisse',
      context: [
        { id: 'region.456', short_code: 'CH-GE' },
        { id: 'country.789', short_code: 'CH' },
      ],
      ...overrides,
    }
  }

  it('aucun jeton configure -> unavailable, jamais un appel reseau', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const row = await runKybSource(createAddressGeocodeSource(''), agencyGeo())
    expect(row.result).toBe('unavailable')
    expect(row.check_type).toBe('address_geocode')
    expect(row.source).toBe('mapbox')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('aucune adresse declaree -> unavailable, jamais un appel reseau', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const row = await runKybSource(
      createAddressGeocodeSource('fake-token'),
      agencyGeo({ address: null, postal_code: null, city: null })
    )
    expect(row.result).toBe('unavailable')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('aucun pays declare -> unavailable, jamais un appel reseau (rien a comparer)', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const row = await runKybSource(createAddressGeocodeSource('fake-token'), agencyGeo({ country: null }))
    expect(row.result).toBe('unavailable')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('aucun resultat de geocodage (0 feature) -> partial, jamais mismatch (Mapbox n est pas un registre exhaustif)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => mapboxResponse([])))
    const row = await runKybSource(createAddressGeocodeSource('fake-token'), agencyGeo())
    expect(row.result).toBe('partial')
  })

  it('pays geocode identique au pays declare -> match', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => mapboxResponse([chGeFeature()])))
    const row = await runKybSource(createAddressGeocodeSource('fake-token'), agencyGeo({ country: 'CH', canton: null }))
    expect(row.result).toBe('match')
  })

  it('canton geocode identique au canton declare (CH) -> match', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => mapboxResponse([chGeFeature()])))
    const row = await runKybSource(createAddressGeocodeSource('fake-token'), agencyGeo({ country: 'CH', canton: 'GE' }))
    expect(row.result).toBe('match')
  })

  it('pays geocode DIFFERENT du pays declare -> mismatch : contradiction reelle', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => mapboxResponse([chGeFeature({ context: [{ id: 'country.1', short_code: 'FR' }] })]))
    )
    const row = await runKybSource(createAddressGeocodeSource('fake-token'), agencyGeo({ country: 'CH' }))
    expect(row.result).toBe('mismatch')
  })

  it('pays coherent mais canton geocode DIFFERENT du canton declare -> mismatch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        mapboxResponse([
          chGeFeature({
            context: [
              { id: 'region.1', short_code: 'CH-ZH' },
              { id: 'country.2', short_code: 'CH' },
            ],
          }),
        ])
      )
    )
    const row = await runKybSource(createAddressGeocodeSource('fake-token'), agencyGeo({ country: 'CH', canton: 'GE' }))
    expect(row.result).toBe('mismatch')
  })

  it(
    'pays coherent, canton absent de la reponse (non contredit) -> match : le canton ne fait que basculer un match ' +
      'en mismatch, jamais l inverse a lui seul',
    async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => mapboxResponse([chGeFeature({ context: [{ id: 'country.1', short_code: 'CH' }] })]))
      )
      const row = await runKybSource(createAddressGeocodeSource('fake-token'), agencyGeo({ country: 'CH', canton: 'GE' }))
      expect(row.result).toBe('match')
    }
  )

  it('reponse sans contexte pays exploitable -> partial, jamais invente', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => mapboxResponse([{ place_name: 'quelque part', context: [] }])))
    const row = await runKybSource(createAddressGeocodeSource('fake-token'), agencyGeo())
    expect(row.result).toBe('partial')
  })

  it(
    'reponse HTTP 200 hors schema (features absent) -> unavailable, jamais partial (zero resultat invente -- ' +
      'meme defaut/remede que le registre francais, revue etape 4/tache 3, point 3)',
    async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () =>
            new Response(JSON.stringify({ message: 'Not Found' }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            })
        )
      )
      const row = await runKybSource(createAddressGeocodeSource('fake-token'), agencyGeo())
      expect(row.result).toBe('unavailable')
    }
  )

  it('erreur serveur (500) -> unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })))
    const row = await runKybSource(createAddressGeocodeSource('fake-token'), agencyGeo())
    expect(row.result).toBe('unavailable')
  })

  it('reponse illisible (JSON invalide) -> unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html></html>', { status: 200 })))
    const row = await runKybSource(createAddressGeocodeSource('fake-token'), agencyGeo())
    expect(row.result).toBe('unavailable')
  })

  it(
    'panne reseau (fetch qui rejette) -> unavailable, et le message ne transporte JAMAIS le jeton ni l URL ' +
      '(seul connecteur de ce fichier dont la requete porte un secret en parametre)',
    async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new Error(
            'request to https://api.mapbox.com/geocoding/v5/mapbox.places/x.json?access_token=SUPER-SECRET-TOKEN failed'
          )
        })
      )
      const row = await runKybSource(createAddressGeocodeSource('SUPER-SECRET-TOKEN'), agencyGeo())
      expect(row.result).toBe('unavailable')
      const serialized = JSON.stringify(row.raw_response)
      expect(serialized).not.toContain('SUPER-SECRET-TOKEN')
      expect(serialized).not.toContain('access_token')
    }
  )

  it('timeout du connecteur -> unavailable via le harnais', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const row = await runKybSource(createAddressGeocodeSource('fake-token'), agencyGeo(), 50)
    expect(row.result).toBe('unavailable')
  }, 2_000)

  it('un resultat calcule ne joint jamais le jeton -- seule la requete texte (sans URL) et la reponse Mapbox figurent dans raw_response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => mapboxResponse([chGeFeature()])))
    const row = await runKybSource(createAddressGeocodeSource('SUPER-SECRET-TOKEN'), agencyGeo())
    const serialized = JSON.stringify(row.raw_response)
    expect(serialized).not.toContain('SUPER-SECRET-TOKEN')
    expect(row.raw_response.query).toBe('Rue du Rhone 1, 1201, Geneve')
    expect(row.raw_response.mapbox).toBeTruthy()
  })
})

// ─── Squelette Zefix (registre du commerce suisse, etape 6 tache 2) ────────────
//
// Hors du describe.skipIf(!HAS_KEYS) DELIBEREMENT, meme motif que les quatre volets de
// connecteurs precedents : ni reseau ni Supabase local. Volet DEDIE plutot qu'ajout au
// « harnais pur » du haut de fichier, pour la meme raison que RDAP/VIES/registre
// francais/Mapbox en ont un : ce volet stubbe `fetch` (afterEach + unstubAllGlobals),
// machinerie que le volet « harnais pur » se declare explicitement ne PAS avoir
// (« aucun fetch, pas meme stubbe » dans son en-tete). Ce que ce volet-la porte de
// l'etape 6, en revanche, reste chez lui : les fixtures de la matrice d'exclusivite
// (fullKybRegistry / JURISDICTION_MATRIX, en tete de fichier).
//
// Ce qui est verifie ici n'est PAS un connecteur : c'est un SQUELETTE. Zefix repond 401
// et les identifiants demandes a zefix@bj.admin.ch sont sans reponse depuis le
// 26.07.2026 (docs/agency-kyb-handoff.md §8). Aucune URL, aucun schema de reponse,
// aucun en-tete d'authentification n'est ecrit « au plus probable » -- une URL inventee
// qui se revelerait fausse le jour J couterait plus cher que pas d'URL du tout. Ce que
// ces tests verrouillent, c'est donc le CABLAGE et la GESTION D'ERREUR : les trois
// sources existent, portent les bons check_type, ne s'appliquent qu'a la Suisse,
// n'appellent JAMAIS le reseau, produisent `unavailable` (jamais un `match` par defaut)
// et joignent a leur preuve la raison exacte -- laquelle distingue « on attend une
// reponse d'un tiers » de « quelqu'un a pose les secrets sans brancher le connecteur ».
describe('squelette Zefix (registry_lookup / registry_legal_name_match / registry_country_match) -- aucun reseau', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** Configuration COMPLETE et fictive -- le cas « les secrets sont poses ». Ces valeurs
   *  ne designent aucun service reel : elles n'ont pas a le faire, puisque aucun code de
   *  ce squelette ne les utilise pour construire quoi que ce soit. Le credential est
   *  volontairement reconnaissable pour que les assertions de non-fuite mordent. */
  const ZEFIX_WIRED_CONFIG: PendingSourceConfig = {
    baseUrl: 'https://exemple.invalid/zefix',
    credential: 'SUPER-SECRET-ZEFIX-CREDENTIAL',
  }

  const ZEFIX_CHECK_TYPES = ['registry_lookup', 'registry_legal_name_match', 'registry_country_match']

  function agencyCH(overrides: Partial<AgencyForVerification> = {}): AgencyForVerification {
    return { ...FAKE_AGENCY, country: 'CH', business_registration_number: 'CHE-123.456.789', ...overrides }
  }

  function zefixSource(checkType: string, config: PendingSourceConfig): KybSource {
    const found = createZefixSources(config).find((s) => s.checkType === checkType)
    if (!found) throw new Error(`${checkType} absent de createZefixSources()`)
    return found
  }

  it('rend exactement trois sources, toutes de source zefix, une par veto de registre du catalogue', () => {
    // Trois sources et non une : une KybSourceResult ne porte qu'UN check_type (voir
    // _shared/kyb-sources.ts), et le registre francais a deja tranche ce point de la
    // meme facon -- deux entrees interrogeant le meme point d'API. Les trois codes sont
    // deja catalogues (verification_check_types, migration 20260728103000) et tous trois
    // vetos (weight 0, is_veto true) : aucune migration n'est necessaire.
    const sources = createZefixSources(ZEFIX_PENDING_CONFIG)
    expect(sources).toHaveLength(3)
    expect(sources.map((s) => s.checkType).sort()).toEqual([...ZEFIX_CHECK_TYPES].sort())
    expect(sources.every((s) => s.source === 'zefix')).toBe(true)
  })

  for (const checkType of ['registry_lookup', 'registry_legal_name_match', 'registry_country_match']) {
    it(
      `${checkType} : sans identifiants -> unavailable avec error_type=KybSourcePendingCredentialsError, ` +
        'et AUCUNE requete reseau',
      async () => {
        const fetchSpy = vi.fn()
        vi.stubGlobal('fetch', fetchSpy)

        const row = await runKybSource(zefixSource(checkType, ZEFIX_PENDING_CONFIG), agencyCH())

        expect(row.result, 'jamais un match par defaut : aucune source n a repondu').toBe('unavailable')
        expect(row.check_type).toBe(checkType)
        expect(row.source).toBe('zefix')
        expect(
          row.raw_response,
          'un relecteur de la file admin doit lire « en attente d identifiants », pas un unavailable nu'
        ).toMatchObject({ reason: 'error', error_type: 'KybSourcePendingCredentialsError' })
        expect(String(row.raw_response.message)).toContain('identifiants')
        expect(fetchSpy, 'aucune URL Zefix n est connue -- rien a appeler').not.toHaveBeenCalled()
      }
    )

    it(
      `${checkType} : configuration PRESENTE -> unavailable avec error_type=KybSourceNotWiredError ` +
        '(le garde-fou : sans lui, poser les secrets produirait un unavailable silencieux et permanent)',
      async () => {
        const fetchSpy = vi.fn()
        vi.stubGlobal('fetch', fetchSpy)

        const row = await runKybSource(zefixSource(checkType, ZEFIX_WIRED_CONFIG), agencyCH())

        expect(row.result).toBe('unavailable')
        expect(row.check_type).toBe(checkType)
        expect(
          row.raw_response,
          'les deux erreurs appellent deux gestes differents : attendre zefix@bj.admin.ch, ou brancher le connecteur'
        ).toMatchObject({ reason: 'error', error_type: 'KybSourceNotWiredError' })
        expect(fetchSpy, 'le squelette ne fabrique aucune requete, meme configure').not.toHaveBeenCalled()
      }
    )
  }

  it('le credential n apparait JAMAIS dans raw_response serialise, configuration absente comme presente', async () => {
    vi.stubGlobal('fetch', vi.fn())
    for (const config of [ZEFIX_PENDING_CONFIG, ZEFIX_WIRED_CONFIG]) {
      for (const checkType of ZEFIX_CHECK_TYPES) {
        const row = await runKybSource(zefixSource(checkType, config), agencyCH())
        const serialized = JSON.stringify(row.raw_response)
        expect(serialized, `${checkType} / baseUrl="${config.baseUrl}"`).not.toContain('SUPER-SECRET-ZEFIX-CREDENTIAL')
        // Ni l'URL : une baseUrl peut porter une cle en parametre de requete (le
        // connecteur Mapbox de ce meme fichier en est la preuve), et rien ne garantit
        // qu'elle n'en portera pas le jour ou elle sera connue.
        expect(serialized, `${checkType} / baseUrl="${config.baseUrl}"`).not.toContain('exemple.invalid')
      }
    }
  })

  it(
    'configuration a MOITIE posee (URL seule, ou credential seul) -> en attente d identifiants, ' +
      'jamais « non branche » : il manque toujours une reponse du tiers',
    async () => {
      vi.stubGlobal('fetch', vi.fn())
      const moities: PendingSourceConfig[] = [
        { baseUrl: ZEFIX_WIRED_CONFIG.baseUrl, credential: '' },
        { baseUrl: '', credential: ZEFIX_WIRED_CONFIG.credential },
        // Blanc typographique : une variable d'environnement posee a "   " est vide en
        // pratique, la traiter comme configuree ferait mentir le garde-fou.
        { baseUrl: '   ', credential: '   ' },
      ]
      for (const config of moities) {
        const row = await runKybSource(zefixSource('registry_lookup', config), agencyCH())
        expect(row.raw_response.error_type).toBe('KybSourcePendingCredentialsError')
      }
    }
  )

  it('juridiction : les trois sources s appliquent a CH, a aucun autre pays, ni a un pays absent', () => {
    const sources = createZefixSources(ZEFIX_PENDING_CONFIG)
    for (const source of sources) {
      expect(source.appliesTo, `${source.checkType} doit declarer sa juridiction`).toBeDefined()
      expect(source.appliesTo!(agencyCH()), `${source.checkType} / CH`).toBe(true)
      // Minuscules et blancs : agencies.country est du texte libre cote base.
      expect(source.appliesTo!(agencyCH({ country: '  ch  ' })), `${source.checkType} / "  ch  "`).toBe(true)
      for (const country of ['FR', 'LI', 'DE', null]) {
        expect(source.appliesTo!(agencyCH({ country })), `${source.checkType} / ${country ?? 'non declare'}`).toBe(false)
      }
    }
  })

  it(
    'exclusivite avec le registre francais : registry_lookup et registry_legal_name_match ne sont jamais ' +
      'revendiques par zefix ET recherche_entreprises pour le meme siege',
    () => {
      // Le point de rupture que toute la regle de juridiction (tache 1) existe pour
      // rendre impossible : le moteur (20260728130000) ne garde qu'UNE ligne par
      // check_type et departage deux lignes de la meme transaction par ctid, donc par
      // ordre d'insertion. Deux proprietaires applicables au meme dossier, et
      // l'`unavailable` insere en dernier masquerait l'autre verdict.
      for (const country of ['CH', 'FR', 'LI', 'DE', null]) {
        const { applicable } = selectApplicableSources({ ...FAKE_AGENCY, country }, fullKybRegistry())
        for (const checkType of ['registry_lookup', 'registry_legal_name_match']) {
          const owners = applicable.filter((s) => s.checkType === checkType).map((s) => s.source)
          expect(owners.length, `pays ${country ?? 'non declare'} : ${checkType} revendique par ${owners.join(' + ')}`)
            .toBeLessThanOrEqual(1)
        }
      }
    }
  )

  it(
    'aucun verdict ne bouge : trois vetos `unavailable` valent exactement les trois vetos ABSENTS d avant ' +
      '(le moteur les traite a l identique -- exclus du numerateur ET du denominateur, veto non passe)',
    async () => {
      // Verifie ici sur ce que le squelette ECRIT (la moitie de la propriete qui vit en
      // TypeScript) ; l'autre moitie -- que le moteur en tire le meme statut et le meme
      // score qu'avant -- est verifiee en base par le volet HTTP plus haut
      // (« une agence suisse ... AUCUN verdict ne bouge pour autant »).
      vi.stubGlobal('fetch', vi.fn())
      const rows = await runAgencyKybSources(agencyCH(), createZefixSources(ZEFIX_PENDING_CONFIG))
      expect(rows).toHaveLength(3)
      expect(rows.every((r) => r.result === 'unavailable'), 'jamais match, jamais partial, jamais mismatch').toBe(true)
    }
  )
})

// ─── Squelette du registre UID (vat_lookup CH/LI, etape 6 tache 3) ─────────────
//
// Meme place et meme forme que le volet Zefix ci-dessus, dont ce volet reprend le motif --
// mais PAS le meme statut, et c'est ce que verifient autant les tests que les
// commentaires. Zefix a REPONDU `401 Unauthorized` : on sait qu'il existe et qu'il attend
// une authentification, il ne manque qu'un identifiant. Le registre UID (uid.admin.ch)
// n'a JAMAIS ete teste en API, et la question posee par la doc de conception §3 -- « API
// separee ou champ Zefix ? » -- n'est pas tranchee : il manque ici une reponse sur CE
// QU'ON DOIT APPELER, pas seulement de quoi s'y authentifier.
//
// Consequence assumee sur la forme, et raison d'etre de ces tests : si la reponse est
// « champ Zefix », cette source DISPARAIT au profit d'un quatrieme type servi par le
// connecteur Zefix. La fabrique rend donc un TABLEAU alors qu'elle n'a qu'une source a
// rendre -- index.ts l'etale, si bien que ni sa disparition ni l'ajout d'un second type
// UID ne changeront la facon dont il l'appelle.
//
// La juridiction ne se decoupe PAS comme celle de Zefix, et c'est le piege que ce volet
// verrouille : CH **et** LI, parce que le FL-UID liechtensteinois derive du systeme suisse
// par l'union douaniere et porte le meme prefixe CHE (doc de conception §3), la ou le
// REGISTRE DU COMMERCE liechtensteinois est le sien (`oera.li`) et sort de Zefix.
describe('squelette du registre UID (vat_lookup) -- aucun reseau', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** Configuration COMPLETE et fictive -- le cas « les secrets sont poses ». Ces valeurs
   *  ne designent aucun service reel, et n'ont pas a le faire : aucune URL du registre UID
   *  n'est connue, et ce squelette n'en construit aucune. */
  const UID_REGISTER_WIRED_CONFIG: PendingSourceConfig = {
    baseUrl: 'https://exemple.invalid/uid',
    credential: 'SUPER-SECRET-UID-CREDENTIAL',
  }

  function agencyIn(country: string | null): AgencyForVerification {
    return { ...FAKE_AGENCY, country, tva: 'CHE-123.456.789' }
  }

  function uidSource(config: PendingSourceConfig): KybSource {
    const sources = createUidRegisterSources(config)
    if (sources.length !== 1) throw new Error(`createUidRegisterSources() rend ${sources.length} sources, attendu 1`)
    return sources[0]
  }

  it('rend UN TABLEAU d une seule source : vat_lookup servi par uid_register', () => {
    // Le tableau n'est pas une coquetterie de signature (arbitrage de la tache 3) : la
    // question « API separee ou champ Zefix ? » n'etant pas tranchee, cette source peut
    // aussi bien DISPARAITRE (au profit d'un quatrieme type Zefix) que se dedoubler. Dans
    // les deux cas, index.ts etale le resultat et n'a rien a changer. Une fabrique rendant
    // UNE source obligerait a le retoucher des le premier des deux scenarios.
    const sources = createUidRegisterSources(UID_REGISTER_PENDING_CONFIG)
    expect(Array.isArray(sources)).toBe(true)
    expect(sources).toHaveLength(1)
    expect(sources[0].checkType).toBe('vat_lookup')
    expect(sources[0].source).toBe('uid_register')
    // vat_lookup est deja catalogue (verification_check_types) et `uid_register` deja
    // admis par la contrainte CHECK sur agency_verification_checks.source -- les deux
    // depuis la migration 20260728103000. Aucune migration n'est necessaire, verifie en
    // base et non suppose.
  })

  it(
    'sans identifiants -> unavailable avec error_type=KybSourcePendingCredentialsError, et AUCUNE requete reseau',
    async () => {
      const fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)

      const row = await runKybSource(uidSource(UID_REGISTER_PENDING_CONFIG), agencyIn('CH'))

      expect(row.result, 'jamais un match par defaut : aucune source n a repondu').toBe('unavailable')
      expect(row.check_type).toBe('vat_lookup')
      expect(row.source).toBe('uid_register')
      expect(row.raw_response).toMatchObject({ reason: 'error', error_type: 'KybSourcePendingCredentialsError' })
      expect(
        fetchSpy,
        'aucune URL du registre UID n est connue -- et rien ne dit meme qu une API separee existe'
      ).not.toHaveBeenCalled()
    }
  )

  it(
    'configuration PRESENTE -> unavailable avec error_type=KybSourceNotWiredError (le garde-fou : sans lui, ' +
      'poser les secrets produirait un unavailable silencieux et permanent)',
    async () => {
      const fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)

      const row = await runKybSource(uidSource(UID_REGISTER_WIRED_CONFIG), agencyIn('CH'))

      expect(row.result).toBe('unavailable')
      expect(row.raw_response).toMatchObject({ reason: 'error', error_type: 'KybSourceNotWiredError' })
      expect(fetchSpy, 'le squelette ne fabrique aucune requete, meme configure').not.toHaveBeenCalled()
    }
  )

  it('configuration a MOITIE posee -> en attente d identifiants, jamais « non branche »', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const moities: PendingSourceConfig[] = [
      { baseUrl: UID_REGISTER_WIRED_CONFIG.baseUrl, credential: '' },
      { baseUrl: '', credential: UID_REGISTER_WIRED_CONFIG.credential },
      { baseUrl: '   ', credential: '   ' },
    ]
    for (const config of moities) {
      const row = await runKybSource(uidSource(config), agencyIn('CH'))
      expect(row.raw_response.error_type).toBe('KybSourcePendingCredentialsError')
    }
  })

  it('ni le credential ni l URL n apparaissent dans raw_response serialise, configuration absente comme presente', async () => {
    vi.stubGlobal('fetch', vi.fn())
    for (const config of [UID_REGISTER_PENDING_CONFIG, UID_REGISTER_WIRED_CONFIG]) {
      const row = await runKybSource(uidSource(config), agencyIn('CH'))
      const serialized = JSON.stringify(row.raw_response)
      expect(serialized, `baseUrl="${config.baseUrl}"`).not.toContain('SUPER-SECRET-UID-CREDENTIAL')
      // Ni l'URL : une baseUrl peut porter une cle en parametre de requete (le connecteur
      // Mapbox de ce meme fichier en est la preuve).
      expect(serialized, `baseUrl="${config.baseUrl}"`).not.toContain('exemple.invalid')
    }
  })

  it(
    'la preuve nomme LAQUELLE des sources en attente a manque : un relecteur de la file admin ne peut pas ' +
      'confondre le registre UID avec Zefix devant deux unavailable identiques',
    async () => {
      vi.stubGlobal('fetch', vi.fn())
      const uidRow = await runKybSource(uidSource(UID_REGISTER_PENDING_CONFIG), agencyIn('CH'))
      const zefixRow = await runKybSource(
        createZefixSources(ZEFIX_PENDING_CONFIG).find((s) => s.checkType === 'registry_lookup')!,
        agencyIn('CH')
      )

      expect(String(uidRow.raw_response.message)).toContain('registre UID')
      expect(
        String(uidRow.raw_response.message),
        'les deux squelettes partagent la MEME erreur : seul le libelle distingue ce qu on attend de chacun'
      ).not.toBe(String(zefixRow.raw_response.message))
    }
  )

  it('juridiction : CH et LI, aucun autre pays, ni un pays absent', () => {
    const source = uidSource(UID_REGISTER_PENDING_CONFIG)
    expect(source.appliesTo, 'la source doit declarer sa juridiction').toBeDefined()
    for (const country of ['CH', 'LI', '  ch  ', 'li']) {
      expect(source.appliesTo!(agencyIn(country)), `${country} doit etre couvert (trim + majuscules)`).toBe(true)
    }
    for (const country of ['FR', 'DE', 'AT', null]) {
      expect(source.appliesTo!(agencyIn(country)), `${country ?? 'non declare'} ne doit pas etre couvert`).toBe(false)
    }
  })

  it(
    'exclusivite avec VIES : vat_lookup n est jamais revendique par uid_register ET vies pour le meme siege, ' +
      'et il l est TOUJOURS par exactement l un des deux des qu un pays est declare',
    () => {
      // Le point de rupture que la regle de juridiction (tache 1) existe pour rendre
      // impossible, applique au TROISIEME check_type partage. La seconde moitie du test
      // compte autant que la premiere : « au plus un proprietaire » serait aussi satisfait
      // par ZERO, c'est-a-dire par une TVA que plus personne n'interroge nulle part.
      const ownersByCountry: Record<string, string[]> = {}
      for (const country of ['CH', 'LI', 'FR', 'DE', 'IT']) {
        const { applicable } = selectApplicableSources({ ...FAKE_AGENCY, country }, fullKybRegistry())
        ownersByCountry[country] = applicable.filter((s) => s.checkType === 'vat_lookup').map((s) => s.source)
      }
      expect(ownersByCountry).toEqual({
        CH: ['uid_register'],
        LI: ['uid_register'],
        FR: ['vies'],
        DE: ['vies'],
        IT: ['vies'],
      })

      // Sans pays declare, aucune des deux ne s'applique : une juridiction ne se devine
      // pas, et vat_lookup reste alors simplement absent du dossier.
      const { applicable } = selectApplicableSources({ ...FAKE_AGENCY, country: null }, fullKybRegistry())
      expect(applicable.filter((s) => s.checkType === 'vat_lookup')).toHaveLength(0)
    }
  )

  it(
    'aucun verdict ne bouge : la ligne vat_lookup `unavailable` vaut exactement la ligne ABSENTE d avant ' +
      '(vat_lookup est un signal SCORABLE, pas un veto -- exclu du numerateur ET du denominateur)',
    async () => {
      // Nuance qui distingue cette source des trois de Zefix, et qu'il serait faux de
      // recopier : les trois lignes Zefix sont des VETOS, neutres parce que le moteur fait
      // echouer un veto `unavailable` exactement comme un veto absent. vat_lookup, lui,
      // porte weight 3.00 / is_veto false (20260728103000) : ce qui le rend neutre, c'est
      // l'exclusion de `unavailable` du numerateur ET du denominateur. Meme conclusion,
      // deux mecanismes -- la contrepartie en base est le couple de tests de preuve du
      // volet 2, ou le score reste a 1.000 malgre cette ligne.
      vi.stubGlobal('fetch', vi.fn())
      const rows = await runAgencyKybSources(agencyIn('CH'), createUidRegisterSources(UID_REGISTER_PENDING_CONFIG))
      expect(rows).toHaveLength(1)
      expect(rows[0].result, 'jamais match, jamais partial, jamais mismatch').toBe('unavailable')
    }
  )
})
