// Backend test (live CI) -- socle de l'Edge Function agency-verification-run
// (etape 4, tache 1 -- supabase/functions/agency-verification-run/index.ts et son
// module partage supabase/functions/_shared/kyb-sources.ts), connecteur RDAP
// (etape 4, tache 2 -- domain_whois_age, premier connecteur reel du registre),
// connecteurs VIES / recherche-entreprises / Mapbox (etape 4, tache 3),
// declenchement + filet de rattrapage (etape 4, tache 4), juridiction d'une source
// (etape 6, tache 1 -- appliesTo / selectApplicableSources, volets 1 et 2 ci-dessous),
// connecteur Zefix par LINDAS (chantier LINDAS, tache 2 -- volet 8, en fin de fichier ;
// il REMPLACE le squelette de l'etape 6, qui revendiquait les memes trois check_type sans
// jamais pouvoir repondre) et squelette du registre UID (etape 6, tache 3 -- volet 9, tout
// en bas, plus la preuve en base du volet 2).
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
// Dix volets dans ce fichier :
//   1. Le harnais PUR (_shared/kyb-sources.ts, describe hors skipIf juste sous cet
//      en-tete) -- import direct, aucun reseau, aucune dependance Deno (ce module
//      n'appelle jamais Deno.env.get, contrairement a _shared/magic-link-token.ts --
//      aucun shim globalThis.Deno necessaire, meme motif que whatsapp-antifab.spec.ts
//      qui importe deja un _shared/*.ts sans extension de la meme facon).
//   2. La fonction deployee (HTTP, port 54321) -- lecture agence, ecriture des
//      checks, appel du moteur, journalisation. Neuf connecteurs reels existent a ce
//      stade (RDAP tache 2 ; VIES, recherche-entreprises x2, Mapbox tache 3 ; le format
//      du numero et les trois sources Zefix/LINDAS du chantier LINDAS) ; les
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
//   8. Connecteur Zefix par LINDAS (chantier LINDAS, tache 2 -- describe hors skipIf,
//      tout en bas). C'est un CONNECTEUR, la ou l'etape 6 n'avait pu poser qu'un
//      squelette : le registre du commerce suisse est publie en SPARQL par LINDAS, sans
//      authentification. Ce que ce volet verrouille en plus du cablage, c'est le
//      PLAFOND du verdict -- registry_lookup ne peut JAMAIS valoir `match`, parce que le
//      graphe ne publie pas le statut actif/radie ; sa contrepartie en base (un dossier
//      suisse parfait retenu par ce seul `partial`) vit dans le volet 2.
//   9. Squelette du registre UID (etape 6, tache 3 -- meme place, meme forme que le
//      volet 8, dont il reprend le motif). Statut DIFFERENT de Zefix, et c'est ce que ce
//      volet verifie autant que le cablage : Zefix a repondu 401 (il existe, il exige une
//      authentification), le registre UID n'a JAMAIS ete teste en API et la question
//      « API separee ou champ Zefix ? » n'est pas tranchee (doc de conception §3). Sa
//      contrepartie en base -- les quatre lignes zefix/uid_register retiennent un dossier
//      suisse par ailleurs parfait, et elles seules -- vit dans le volet 2.
//  10. Controle du numero de registre (chantier LINDAS, tache 1 -- registry_number_format,
//      tout en bas). Le seul connecteur du fichier qui ne touche AUCUN reseau, pas meme
//      stubbe : une cle de controle se calcule. Il remplit le premier des quatre vetos
//      d'entite a avoir un proprietaire pour de bon -- sa contrepartie en base (un numero
//      faux retient le dossier, un numero vrai le laisse passer) vit dans le volet 2.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : ces tests tournent contre un Supabase local
// seede et DOIVENT reellement passer -- lire le compte de tests, jamais le code de
// sortie (meme convention que agency-verification-engine.spec.ts). Les volets 1 et 3-6
// ne sont eux-memes jamais concernes par ce skip : ils ne touchent ni reseau ni DB.
// Seuls les volets 2 et 7 en dependent reellement.

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient, anonClient } from './helpers/supabase'
import {
  runKybSource,
  runAgencyKybSources,
  selectApplicableSources,
  AGENCY_KYB_SOURCES,
  createAddressGeocodeSource,
  createUidRegisterSources,
  registryNumberFormatSource,
  isValidSwissUid,
  isValidFrenchSiren,
  type KybSource,
  type AgencyForVerification,
  type PendingSourceConfig,
} from '../../supabase/functions/_shared/kyb-sources'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? ''
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? ''
// Deux variables service-role, et c'est DELIBERE -- ne jamais les reunifier.
// Supabase expose la meme identite service_role sous deux formats, tous deux
// valides pour PostgREST/createClient : le JWT legacy (eyJ...) et la cle
// `sb_secret_...`. Mais agency-verification-run compare litteralement le Bearer recu
// a son Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), et le runtime edge n'y injecte
// JAMAIS que le JWT legacy (la cle sb_secret_ atterrit dans
// SUPABASE_INTERNAL_SECRET_KEY). Un Bearer au nouveau format est donc un credential
// parfaitement valide que la fonction refuse quand meme -- 401 avant toute logique.
// C'est exactement ce qui distinguait le local de la CI : .env.test.local porte le
// JWT legacy, tandis que backend.yml exporte SECRET_KEY (nouveau format) dans
// SUPABASE_TEST_SERVICE_ROLE_KEY. D'ou cette variable dediee, lue pour les SEULS
// appels d'edge functions -- y compris ceux declenches INDIRECTEMENT, via la config
// app_config.service_role_key que net.http_post rejoue en Bearer (volet 7 plus bas) --
// avec repli sur la variable historique (cas local).
// `||` et non `??` : une variable posee mais VIDE doit aussi retomber sur le repli.
const SERVICE_ROLE_JWT = process.env.SUPABASE_TEST_SERVICE_ROLE_JWT || SERVICE_KEY
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
 *  fonction deployee, la forme etant lue dans sa composition reelle : appele (`nom(`)
 *  quand index.ts l'appelle, ETALE (`...nom`) quand il l'etale sans l'appeler, et a
 *  defaut simplement nomme.
 *
 *  Les BORNES DE MOT sont le coeur du correctif (revue etape 6/tache 3, verifie par
 *  mutation) : `body.includes('createXSources')` est vrai quand le registre teste compose
 *  `createXSourcesV2` -- une sous-chaine suffisait, si bien qu'un registre DIVERGENT de la
 *  composition deployee restait vert.
 *
 *  La branche ETALEE ferme l'angle mort symetrique (revue etape 6/tache 4, verifie par la
 *  mutation correspondante) : exiger la forme d'appel sans condition rendrait le garde-fou
 *  rouge en permanence -- AGENCY_KYB_SOURCES est une constante qu'on etale, pas une
 *  fabrique qu'on invoque -- mais retomber sur la simple mention pour ce cas-la rendait
 *  justement au producteur etale la faiblesse que le durcissement retirait aux autres :
 *  `const oublie = AGENCY_KYB_SOURCES` dans le corps de fullKybRegistry() sort QUATRE
 *  sources du registre teste et satisfaisait encore le garde-fou. Il n'y a pas de raison
 *  d'etre plus indulgent avec l'etalement qu'avec l'appel : la forme est presente des deux
 *  cotes, on l'exige des deux cotes. */
function producerReferenceRe(producer: string, composition: string): RegExp {
  const name = producer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const call = new RegExp(`\\b${name}\\s*\\(`)
  if (call.test(composition)) return call
  const spread = new RegExp(`\\.\\.\\.\\s*${name}\\b`)
  if (spread.test(composition)) return spread
  return new RegExp(`\\b${name}\\b`)
}

/** Configuration du registre UID telle qu'index.ts la lit AUJOURD'HUI : UID_REGISTER_API_URL
 *  et UID_REGISTER_API_CREDENTIAL sont absents de l'environnement, donc vides -- et pour une
 *  raison qui n'est pas celle de Zefix : cette API n'a jamais ete testee, et la question
 *  « API separee ou champ Zefix ? » n'est pas tranchee (doc de conception §3). */
const UID_REGISTER_PENDING_CONFIG: PendingSourceConfig = { baseUrl: '', credential: '' }

/** Le registre COMPLET tel qu'agency-verification-run/index.ts le compose : les entrees
 *  statiques de AGENCY_KYB_SOURCES PLUS les connecteurs que la fonction construit
 *  elle-meme faute de pouvoir lire une configuration depuis le module pur (le geocodage et
 *  le squelette du registre UID). Une matrice qui ne couvrirait que AGENCY_KYB_SOURCES ne
 *  protegerait pas ce qu'elle pretend proteger -- verifie par mutation a la tache 2 de
 *  l'etape 6 : cabler une fabrique dans index.ts sans l'ajouter ici laisse la matrice
 *  AVEUGLE (elle reste verte), et c'est le test d'imports juste apres la matrice qui mord.
 *  Ce test-la a ete DURCI a la tache 3 pour lire le CORPS de cette fonction et non plus une
 *  simple liste de noms, puis a la tache 4 pour cesser de comparer du texte BRUT : corps relu
 *  commentaires retires, producteurs cherches sur bornes de mot et dans la forme meme
 *  qu'index.ts emploie -- voir fullKybRegistryBody() et producerReferenceRe() plus haut.
 *
 *  Les trois sources Zefix/LINDAS (chantier LINDAS, tache 2) n'apparaissent PLUS ici en
 *  propre : LINDAS etant public, elles n'ont besoin d'aucune configuration et sont des
 *  entrees statiques de AGENCY_KYB_SOURCES, deja etale ci-dessus. La matrice les voit donc
 *  par ce spread -- verifie par mutation (les retirer d'AGENCY_KYB_SOURCES, ou leur retirer
 *  leur `appliesTo`, fait rougir la matrice). */
function fullKybRegistry(): KybSource[] {
  return [
    ...AGENCY_KYB_SOURCES,
    createAddressGeocodeSource('fake-token'),
    ...createUidRegisterSources(UID_REGISTER_PENDING_CONFIG),
  ]
}

/** Pays de la matrice, et ce que le registre complet doit rendre applicable pour chacun.
 *  'DE' n'est pas decoratif : il prouve que le gabarit de VIES est bien « tout sauf
 *  CH/LI » et non la seule France, sans qu'aucune liste d'Etats membres n'ait a etre
 *  maintenue. */
//
//  `registry_number_format` figure sur TOUTES les lignes, y compris celles des pays
//  qu'il ne sait pas lire (LI, DE, pays absent), et ce n'est pas un oubli : ce
//  connecteur ne declare AUCUNE juridiction (voir son volet en fin de fichier). Seul
//  proprietaire de son check_type, il n'a rien a departager -- et l'ecarter supprimerait
//  la ligne `unavailable` qui dit au relecteur POURQUOI le veto n'est pas satisfait,
//  alors que le principe directeur de tout le chantier veut une ligne, jamais un silence.
const JURISDICTION_MATRIX: { country: string | null; applicable: string[] }[] = [
  {
    // `registry_country_match` y figure depuis la tache 3 du chantier LINDAS : le
    // connecteur francais le revendique desormais, comme Zefix le revendique pour la
    // Suisse. C'est cette ligne-ci qui rend la France couverte sur ses QUATRE vetos
    // d'entite -- et qui met les deux proprietaires du type en concurrence, d'ou la
    // matrice d'exclusivite juste en dessous.
    country: 'FR',
    applicable: [
      'domain_whois_age',
      'vat_lookup',
      'registry_lookup',
      'registry_legal_name_match',
      'registry_country_match',
      'registry_number_format',
      'address_geocode',
    ],
  },
  {
    // Les trois entrees de registre viennent des sources Zefix/LINDAS (chantier LINDAS,
    // tache 2) -- des connecteurs pour de bon depuis qu'elles interrogent l'endpoint
    // SPARQL public de la Confederation, la ou l'etape 6 n'avait qu'un squelette. Ce qui
    // compte ici est inchange : elles sont APPLICABLES, et c'est ce qui les rend
    // exclusives de leurs homonymes francaises. vat_lookup y figure aussi depuis la tache
    // 3 de l'etape 6, mais servi par le registre UID et non par VIES : la Suisse n'est pas
    // dans l'UE, VIES ne la couvre pas, et LINDAS ne dit rien de la TVA.
    country: 'CH',
    applicable: [
      'domain_whois_age',
      'address_geocode',
      'vat_lookup',
      'registry_lookup',
      'registry_legal_name_match',
      'registry_country_match',
      'registry_number_format',
    ],
  },
  // Le Liechtenstein n'est PAS couvert par Zefix (registre `oera.li`, aucune API
  // publique connue) : il ne recoit aucune entree de registre, contrairement a la Suisse.
  // Il recoit en revanche vat_lookup par le registre UID (tache 3) : le FL-UID derive du
  // systeme suisse par l'union douaniere et porte le meme prefixe CHE (doc de conception
  // §3). Registre du commerce et TVA ne se decoupent donc PAS sur la meme frontiere, et
  // cette ligne est le seul endroit ou la difference se lit d'un coup d'oeil.
  {
    country: 'LI',
    applicable: ['domain_whois_age', 'address_geocode', 'vat_lookup', 'registry_number_format'],
  },
  {
    country: 'DE',
    applicable: ['domain_whois_age', 'vat_lookup', 'address_geocode', 'registry_number_format'],
  },
  { country: null, applicable: ['domain_whois_age', 'address_geocode', 'registry_number_format'] },
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

  it('AGENCY_KYB_SOURCES contient les 9 connecteurs sans configuration (RDAP, VIES, recherche-entreprises x3, format du numero, Zefix/LINDAS x3)', () => {
    // RDAP (tache 2) puis VIES + recherche-entreprises x2 (tache 3), plus le controle
    // du numero de registre, les trois sources Zefix/LINDAS et la concordance de pays
    // francaise (chantier LINDAS, taches 1 a 3) : neuf connecteurs qui n'ont besoin
    // d'aucun secret, donc statiques dans
    // ce registre construit au chargement du module. LINDAS est PUBLIC -- c'est ce qui
    // sort Zefix de la fabrique a configuration qu'il occupait a l'etape 6. Le controle
    // du numero, lui, n'a meme besoin d'aucun RESEAU -- c'est un calcul, d'ou sa source
    // `internal` (voir le volet dedie en fin de fichier). Le geocodage Mapbox (tache 3
    // egalement) n'y figure PAS : seul connecteur de ce fichier a avoir besoin d'un
    // jeton, il est construit par createAddressGeocodeSource() -- voir son en-tete dans
    // _shared/kyb-sources.ts et le describe dedie plus bas. Un check_type non catalogue
    // dans verification_check_types ferait de toute facon echouer l'insert (FK,
    // 20260728103000) -- ces entrees SONT donc deja de vrais connecteurs, jamais des
    // doubles de test.
    expect(AGENCY_KYB_SOURCES).toHaveLength(9)
    // Paires (check_type, source) et non check_type seul : les TROIS check_type de
    // registre ont chacun DEUX proprietaires dans ce registre (la France et la Suisse),
    // que seule la juridiction departage.
    expect(AGENCY_KYB_SOURCES.map((s) => `${s.source}:${s.checkType}`).sort()).toEqual(
      [
        'rdap:domain_whois_age',
        'vies:vat_lookup',
        'recherche_entreprises:registry_lookup',
        'recherche_entreprises:registry_legal_name_match',
        'recherche_entreprises:registry_country_match',
        'internal:registry_number_format',
        'zefix:registry_lookup',
        'zefix:registry_legal_name_match',
        'zefix:registry_country_match',
      ].sort()
    )
    // Par IDENTITE, et pas seulement par check_type : c'est LA constante exportee qui
    // doit etre enregistree, pas un homonyme. Sans cette ligne, un second objet du meme
    // check_type satisferait encore l'assertion ci-dessus.
    expect(AGENCY_KYB_SOURCES).toContain(registryNumberFormatSource)
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
  // deux lignes de la meme transaction par ctid, donc par ordre d'insertion. QUATRE
  // check_type ont aujourd'hui DEUX proprietaires chacun : les TROIS de registre --
  // registry_lookup, registry_legal_name_match et registry_country_match -- partages
  // entre recherche_entreprises (FR) et zefix (CH), et vat_lookup, partage entre VIES et
  // le registre UID (CH/LI). Chronologie : les deux premiers depuis la tache 2 de cette
  // etape, vat_lookup depuis sa tache 3, registry_country_match depuis le chantier LINDAS
  // (Zefix a sa tache 2, le registre francais a sa tache 3). Sans regle, l'`unavailable`
  // que le connecteur francais produit deja pour tout siege hors de France pourrait masquer le
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
      // comme a l'autre. La forme exigee couvre l'ETALEMENT autant que l'appel depuis la
      // revue de la tache 4 : `const oublie = AGENCY_KYB_SOURCES` sortait quatre sources
      // du registre sans faire rougir ce test-ci. Voir fullKybRegistryBody() et
      // producerReferenceRe() plus haut.
      const registryBody = fullKybRegistryBody()
      for (const producer of producers) {
        expect(
          registryBody,
          `${producer} construit des sources dans ${AGENCY_VERIFICATION_RUN_INDEX} mais n apparait pas dans le ` +
            'corps de fullKybRegistry() sous la forme meme qu y emploie la fonction deployee -- ou y apparait ' +
            'en commentaire, ou sous un nom dont il n est qu un prefixe, ou nomme sans etre appele ni etale : ' +
            'la matrice d exclusivite ne verrait jamais ces sources-la. L inscrire a ' +
            'EDGE_FUNCTION_SOURCE_IMPORTS ne suffit pas -- il faut l ajouter au registre lui-meme.'
        ).toMatch(producerReferenceRe(producer, composition))
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
    // du denominateur). Le verdict ne bouge donc QUE si la source ecartee n'avait rien
    // a repondre : ce qu'elle aurait rendu, elle ne le rend plus (revue finale etape 6,
    // voir la matrice de proprietaires de vat_lookup en fin de fichier).
    const rows = await runAgencyKybSources(FAKE_AGENCY, applicable)
    expect(rows.map((r) => r.check_type)).toEqual(['address_geocode'])
  })

  it('selectApplicableSources travaille sur AGENCY_KYB_SOURCES par defaut', () => {
    const { applicable, skipped } = selectApplicableSources({ ...FAKE_AGENCY, country: 'CH' })
    expect(applicable.length + skipped.length).toBe(AGENCY_KYB_SOURCES.length)
    // Les TROIS types de registre partages sont ecartes cote francais sur un siege
    // suisse -- registry_country_match compris depuis la tache 3 du chantier LINDAS.
    expect(skipped.map((s) => s.check_type).sort()).toEqual(
      ['registry_country_match', 'registry_legal_name_match', 'registry_lookup', 'vat_lookup'].sort()
    )
  })

  it('le pays declare est compare apres trim et passage en majuscules', () => {
    const { applicable } = selectApplicableSources({ ...FAKE_AGENCY, country: '  fr  ' }, fullKybRegistry())
    expect(applicable.map((s) => s.checkType).sort()).toEqual(
      [
        'address_geocode',
        'domain_whois_age',
        'registry_country_match',
        'registry_legal_name_match',
        'registry_lookup',
        'registry_number_format',
        'vat_lookup',
      ].sort()
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
    // Demarrage a froid du worker, paye UNE fois ici plutot que par la premiere
    // assertion venue. Tant que la fonction n'etait pas declaree dans
    // config.toml, la passerelle locale lui appliquait verify_jwt=true et
    // rejetait elle-meme les appels non authentifies : ils repondaient en
    // quelques millisecondes sans jamais reveiller le worker, et les deux
    // premiers tests de ce bloc -- ceux qui verifient justement un REFUS --
    // passaient sans avoir rien exerce. Depuis la declaration verify_jwt=false
    // (etape 6, integration de main), ces deux appels atteignent vraiment le
    // runtime et paient le demarrage.
    //
    // Ce hook ne peut PAS faire echouer la suite, et c'est deliberé : un premier
    // jet le laissait simplement attendre `fetch`, sous le hookTimeout de 30 s --
    // mesure en CI, le demarrage vaut ~15 s d'ordinaire mais depasse 30 s sur un
    // runner charge, et le hook expirait alors en emportant tout le bloc. Un
    // rechauffement n'affirme rien : il ne doit jamais etre le motif d'un echec.
    // D'ou la course contre une echeance qui RESOUT (jamais ne rejette), et un
    // plafond de hook tres au-dessus d'elle. Si le worker n'est toujours pas
    // pret, ce sont les tests eux-memes qui le diront, avec leur propre budget.
    beforeAll(async () => {
      let timer: ReturnType<typeof setTimeout> | undefined
      const deadline = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, 60_000)
      })
      try {
        await Promise.race([
          fetch(ENDPOINT, { method: 'OPTIONS' }).then(() => undefined, () => undefined),
          deadline,
        ])
      } finally {
        clearTimeout(timer)
      }
    }, 120_000)

    async function callRun(agencyId: string, bearer: string = SERVICE_ROLE_JWT): Promise<Response> {
      // apikey + Authorization avec la MEME valeur : meme motif defensif que
      // kyc-report-data.spec.ts. L'autorisation reelle est verifiee PAR la
      // fonction elle-meme (comparaison a temps constant avec la cle
      // service-role), jamais par la passerelle -- qui la laisse desormais
      // passer, la fonction etant declaree verify_jwt=false dans config.toml.
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

    // Budget elargi sur ces deux-la SEULEMENT : ce sont les premiers appels du
    // bloc, donc ceux qui heritent du demarrage a froid si le rechauffement
    // ci-dessus n'a pas suffi (runner charge). Les suivants trouvent le worker
    // deja debout et gardent le testTimeout ordinaire de 15 s.
    it('sans Authorization -> 401', async () => {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agency_id: NIL_UUID }),
      })
      expect(res.status).toBe(401)
    }, 60_000)

    it("un Bearer valide mais qui n'est pas la cle service-role -> 401 (le jeton anon ne doit jamais suffire)", async () => {
      const res = await callRun(NIL_UUID, ANON_KEY)
      expect(res.status).toBe(401)
    }, 60_000)

    it('agency_id absent du corps -> 400', async () => {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SERVICE_ROLE_JWT,
          Authorization: `Bearer ${SERVICE_ROLE_JWT}`,
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
      // Six connecteurs : RDAP + VIES + recherche-entreprises x2 + le controle du numero
      // de registre (statiques dans AGENCY_KYB_SOURCES) + Mapbox (ajoute par la fonction
      // elle-meme via createAddressGeocodeSource -- voir son en-tete).
      // createAgency() ne declare AUCUN pays : depuis la regle de juridiction (etape 6,
      // tache 1), les trois sources qui exigent un siege (VIES, recherche-entreprises
      // x2) sont ecartees AVANT execution -- elles ecrivaient jusque-la trois lignes
      // `unavailable` que le moteur excluait deja du numerateur ET du denominateur,
      // d'ou un statut et un score rigoureusement identiques (verifies plus bas). Les
      // TROIS qui restent n'ont rien a verifier (ni website, ni adresse, ni numero de
      // registre) et produisent `unavailable` -- jamais un echec, jamais une absence de
      // ligne. La troisieme est le controle du numero (chantier LINDAS, tache 1) : il ne
      // declare aucune juridiction, donc il n'est jamais ecarte et ecrit toujours sa
      // ligne, y compris -- comme ici -- pour dire qu'il n'a rien pu lire.
      expect(body.checks_written).toBe(3)
      expect(body.results.unavailable).toBe(3)

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
      expect(checks).toHaveLength(3)
      expect(checks.every((c) => c.result === 'unavailable')).toBe(true)
      expect(new Set(checks.map((c) => c.check_type))).toEqual(
        new Set(['domain_whois_age', 'address_geocode', 'registry_number_format'])
      )
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
      'une agence francaise ecrit toujours ses sept checks : le seul pays reellement couvert aujourd hui ' +
        "ne change en rien, et rien n'est ecarte",
      async () => {
        const agencyId = await createAgency('jurisdiction-fr')
        await addActiveSignatory(agencyId)
        await setCountry(agencyId, 'FR')

        const res = await callRun(agencyId)
        const body = await res.json()
        expect(res.status, `attendu 200, recu ${res.status}: ${JSON.stringify(body)}`).toBe(200)
        // Cinq jusqu'au chantier LINDAS ; six depuis que le controle du numero de registre
        // (tache 1) ecrit sa propre ligne ; sept depuis que la concordance de pays a un
        // proprietaire francais (tache 3). Ce dossier ne declare aucun numero, ces
        // lignes-la valent donc `unavailable` -- le compte change, le verdict non
        // (verifie plus bas).
        expect(body.checks_written).toBe(7)

        const checks = await getChecks(agencyId)
        expect(new Set(checks.map((c) => c.check_type))).toEqual(
          new Set([
            'domain_whois_age',
            'vat_lookup',
            'registry_lookup',
            'registry_legal_name_match',
            'registry_country_match',
            'registry_number_format',
            'address_geocode',
          ])
        )
        // Zefix par LINDAS couvre la Suisse et elle seule : ses trois sources sont donc
        // ECARTEES pour un siege francais, et c'est exactement ce qui laisse les TROIS
        // check_type de registre au registre francais sans collision possible -- y compris
        // registry_country_match, que les deux revendiquent depuis la tache 3. Le registre
        // UID (etape 6, tache 3) est ecarte de la meme facon et pour la meme raison, ce qui
        // laisse vat_lookup a VIES : c'est l'exclusivite du QUATRIEME check_type partage,
        // verifiee ici sur le dossier reel.
        expect(await getSkippedSources(agencyId)).toEqual([
          { check_type: 'registry_country_match', source: 'zefix', reason: 'jurisdiction_not_covered' },
          { check_type: 'registry_legal_name_match', source: 'zefix', reason: 'jurisdiction_not_covered' },
          { check_type: 'registry_lookup', source: 'zefix', reason: 'jurisdiction_not_covered' },
          { check_type: 'vat_lookup', source: 'uid_register', reason: 'jurisdiction_not_covered' },
        ])

        // NON-REGRESSION : sept lignes, toutes `unavailable` faute de la moindre donnee
        // KYB declaree, donc aucun check scorable -> score NULL, et les quatre vetos
        // d'entite indisponibles -> manual_review. Exactement l'etat ou l'etape 4 avait
        // laisse ce dossier -- les deux lignes de plus (numero de registre, concordance de
        // pays) ne disent rien de plus qu'une absence, faute de numero a lire. C'est bien
        // sur un dossier COMPLET, et lui seul, que la tache 3 change le verdict : voir la
        // paire de tests « un dossier francais complet ... » plus bas.
        expect(body.results.unavailable).toBe(7)
        const agency = await getAgency(agencyId)
        expect(agency.verification_status).toBe('manual_review')
        expect(num(agency.verification_score)).toBeNull()
      }
    )

    it(
      'une agence suisse ecrit les checks suisses (Zefix compris, tous unavailable faute de numero declare), son ' +
        'journal nomme les sources francaises ecartees, et AUCUN verdict ne bouge pour autant',
      async () => {
        const agencyId = await createAgency('jurisdiction-ch')
        await addActiveSignatory(agencyId)
        await setCountry(agencyId, 'CH')

        const res = await callRun(agencyId)
        const body = await res.json()
        expect(res.status, `attendu 200, recu ${res.status}: ${JSON.stringify(body)}`).toBe(200)
        // Sept sources applicables : RDAP, geocodage, les trois entrees de registre
        // suisses (Zefix par LINDAS, chantier LINDAS tache 2), la TVA suisse (squelette du
        // registre UID, etape 6 tache 3) et le controle du numero de registre (chantier
        // LINDAS, tache 1). Ce dossier ne declare AUCUN numero de registre : les quatre
        // sources qui en ont besoin sortent donc `unavailable` sans meme sortir du
        // processus -- les trois suisses parce qu'il n'y a rien a chercher dans le graphe,
        // le controle du numero parce qu'il n'y a rien a calculer. Le squelette du registre
        // UID sort `unavailable` pour une raison qui n'est PAS la meme : celle-la attend
        // toujours une reponse d'un tiers. Dans tous les cas la ligne existe, le relecteur
        // voit pourquoi elle est vide, et rien n'est invente.
        expect(body.checks_written).toBe(7)
        expect(body.results.unavailable).toBe(7)
        expect(new Set((await getChecks(agencyId)).map((c) => c.check_type))).toEqual(
          new Set([
            'domain_whois_age',
            'address_geocode',
            'vat_lookup',
            'registry_lookup',
            'registry_legal_name_match',
            'registry_country_match',
            'registry_number_format',
          ])
        )

        // La raison est LISIBLE dans la preuve, jamais un `unavailable` nu : c'est ce qui
        // distingue « ce dossier ne declare pas de numero » de « on attend une reponse d'un
        // tiers » et de « le connecteur est casse ». Verifie ici contre la base reelle, pas
        // seulement contre le module -- et les deux familles sont lues SEPAREMENT, parce que
        // depuis le chantier LINDAS elles ne disent plus la meme chose.
        const storedChecks = await getChecks(agencyId)
        const zefixChecks = storedChecks.filter((c) => c.source === 'zefix')
        expect(zefixChecks).toHaveLength(3)
        for (const check of zefixChecks) {
          expect(check.result).toBe('unavailable')
          // Une erreur ORDINAIRE, et c'est le changement que le chantier LINDAS apporte
          // ici : ces trois lignes n'attendent plus d'identifiants (LINDAS est public), il
          // leur manque seulement le numero a chercher. Le message doit le dire.
          expect((check.raw_response as { error_type?: string }).error_type).toBe('Error')
          expect(String((check.raw_response as { message?: string }).message)).toContain('numero de registre')
        }

        const uidChecks = storedChecks.filter((c) => c.source === 'uid_register')
        expect(uidChecks).toHaveLength(1)
        expect(uidChecks[0].result).toBe('unavailable')
        expect((uidChecks[0].raw_response as { error_type?: string }).error_type).toBe(
          'KybSourcePendingCredentialsError'
        )

        // Ce qui n'a pas ete interroge reste LISIBLE dans la trace -- une source
        // ecartee ne doit jamais se lire comme une source oubliee.
        expect(await getSkippedSources(agencyId)).toEqual([
          { check_type: 'registry_country_match', source: 'recherche_entreprises', reason: 'jurisdiction_not_covered' },
          { check_type: 'registry_legal_name_match', source: 'recherche_entreprises', reason: 'jurisdiction_not_covered' },
          { check_type: 'registry_lookup', source: 'recherche_entreprises', reason: 'jurisdiction_not_covered' },
          { check_type: 'vat_lookup', source: 'vies', reason: 'jurisdiction_not_covered' },
        ])

        // Non-regression, le critere des trois taches : les sources FRANCAISES (quatre
        // depuis la tache 3, la concordance de pays comprise)
        // ecrivaient jusque-la des lignes `unavailable` que le moteur excluait deja du
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
    // qu'aucune source n'a confirme la TVA. Le quatrieme veto d'entite,
    // registry_number_format, ecrit lui aussi sa ligne `unavailable` sur ce dossier depuis
    // le chantier LINDAS (tache 1) : il a un connecteur, mais ce dossier ne declare aucun
    // numero -- d'ou sa presence dans les quatre vetos poses a la main au second temps.
    //
    // Depuis la tache 2 du chantier LINDAS, les trois lignes zefix ne sont plus
    // `unavailable` faute d'IDENTIFIANTS mais faute de NUMERO DECLARE : ce dossier-ci n'en
    // porte pas. La paire de tests qui suit celle-ci mesure l'autre situation -- celle qui
    // porte tout le chantier -- ou le numero EST declare, ou le registre repond, et ou le
    // dossier reste malgre tout en revue humaine.

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

    // ─── Le veto du numero de registre, mesure en base (chantier LINDAS, tache 1) ──
    //
    // Le cas qui compte pour la conformite, et il ne se prouve QU'ICI : un numero faux
    // doit retenir le dossier. Les tests du volet 10 mesurent le calcul ; ceux-ci
    // mesurent ce que le calcul FAIT au dossier, contre le vrai moteur et la vraie
    // contrainte de source.
    //
    // Meme motif de PAIRE que la demonstration Zefix juste au-dessus : le premier test
    // seul montrerait un dossier retenu, ce qui peut avoir dix causes ; le second isole
    // la cause en ne changeant QUE le numero. Les trois AUTRES vetos d'entite sont poses
    // a la main dans les deux cas -- registry_number_format, lui, n'est jamais pose a la
    // main : c'est le connecteur qui l'ecrit, et c'est tout l'objet de la mesure.

    /** Nestle, dont l'UID (CHE-105.909.036) a servi a la conception du chantier, et le
     *  MEME numero avec sa seule cle de controle changee. Un chiffre d'ecart, et c'est
     *  exactement la faute de frappe qu'un veto de format existe pour attraper. */
    const VALID_SWISS_UID = 'CHE-105.909.036'
    const INVALID_SWISS_UID = 'CHE-105.909.037'

    /** Les trois autres vetos d'entite -- derives d'AGENCY_VETO_TYPES et non recopies :
     *  un cinquieme veto ajoute au catalogue demain doit entrer ici tout seul. */
    const OTHER_AGENCY_VETO_TYPES = AGENCY_VETO_TYPES.filter((t) => t !== 'registry_number_format')

    async function setBusinessRegistrationNumber(agencyId: string, value: string): Promise<void> {
      const { error } = await serviceRoleClient()
        .from('agencies')
        .update({ business_registration_number: value })
        .eq('id', agencyId)
      if (error) throw new Error(`update business_registration_number: ${error.message}`)
    }

    async function runThenPassOtherVetos(agencyId: string): Promise<void> {
      const res = await callRun(agencyId)
      expect(res.status, `attendu 200 sur ${agencyId}`).toBe(200)
      // Poses APRES le passage : plus recents que les `unavailable` des squelettes, ils
      // gagnent le `distinct on (check_type)` du moteur. La ligne registry_number_format,
      // elle, vient du connecteur et de lui seul.
      await insertAgencyChecks(agencyId, OTHER_AGENCY_VETO_TYPES, 'match')
      await recompute(agencyId)
    }

    /** La ligne registry_number_format telle qu'elle a ete ECRITE EN BASE -- source
     *  comprise : c'est la contrainte CHECK reelle (migration 20260729160000) qui doit
     *  accepter `internal`, pas seulement le module qui doit le retourner. */
    async function registryNumberFormatCheck(agencyId: string): Promise<StoredCheck> {
      const rows = (await getChecks(agencyId)).filter((c) => c.check_type === 'registry_number_format')
      expect(rows, 'une ligne registry_number_format et une seule par passage').toHaveLength(1)
      return rows[0]
    }

    it(
      'un numero de registre faux pose le veto registry_number_format en echec (source internal) et envoie le ' +
        'dossier en revue humaine, alors que tous les autres vetos passent',
      async () => {
        const agencyId = await createPerfectSwissAgency('numero-faux')
        await setBusinessRegistrationNumber(agencyId, INVALID_SWISS_UID)

        await runThenPassOtherVetos(agencyId)

        const check = await registryNumberFormatCheck(agencyId)
        expect(check.result, 'la forme est parfaitement lisible, seule la cle ne tombe pas').toBe('mismatch')
        expect(
          check.source,
          '`internal` et jamais `manual` : un relecteur doit lire « la machine a calcule », pas « un humain a tranche »'
        ).toBe('internal')

        const agency = await getAgency(agencyId)
        expect(
          agency.verification_status,
          'un veto en echec envoie en revue humaine quel que soit le score -- c est toute la definition d un veto'
        ).toBe('manual_review')
        expect(num(agency.verification_score), 'le score reste plein : un veto ne se lit pas dans le score').toBeCloseTo(
          1,
          3
        )
        expect(await lastVetoFailed(agencyId), 'c est bien un VETO qui retient ce dossier').toBe(true)
      }
    )

    it(
      'le controle qui rend la mesure concluante : le MEME dossier avec le numero REEL bascule en auto_validated, ' +
        'et le veto est satisfait par le connecteur lui-meme -- jamais par une ligne posee a la main',
      async () => {
        const agencyId = await createPerfectSwissAgency('numero-vrai')
        await setBusinessRegistrationNumber(agencyId, VALID_SWISS_UID)

        await runThenPassOtherVetos(agencyId)

        const check = await registryNumberFormatCheck(agencyId)
        expect(check.result).toBe('match')
        expect(check.source).toBe('internal')

        const agency = await getAgency(agencyId)
        expect(
          agency.verification_status,
          'si ce dossier ne bascule pas, c est qu autre chose que le numero le retenait -- et le test precedent ne ' +
            'prouverait alors rien sur le veto de format'
        ).toBe('auto_validated')
        expect(await lastVetoFailed(agencyId)).toBe(false)
      }
    )

    // ─── LE FAIT QUI PORTE LE CHANTIER LINDAS : un dossier suisse autrement PARFAIT,
    //     dont le registre A REPONDU, reste en manual_review parce que registry_lookup
    //     vaut `partial` et qu'un veto ne passe que sur `match` (tache 2) ─────────────
    //
    // Les deux paires precedentes montraient un dossier suisse retenu par des sources qui
    // n'avaient RIEN pu dire (identifiants absents, puis numero non declare). Celle-ci
    // montre l'inverse, et c'est ce qui rend le chantier LINDAS lisible : le registre
    // suisse repond, il confirme l'existence de l'entite, sa raison sociale et sa
    // juridiction -- trois des quatre vetos d'entite passent pour de bon, sans qu'aucune
    // ligne ne soit posee a la main -- et le dossier reste malgre tout en revue humaine.
    //
    // La cause est UNE et elle est desormais precise : LINDAS ne publie AUCUN statut. Une
    // societe radiee y figure exactement comme une active. `match` signifierait « existe ET
    // active » sur une preuve qui n'en porte que la moitie ; `partial` est le verdict
    // honnete, et le moteur (20260729151200) fait echouer un veto `partial` exactement
    // comme un veto absent (« Ne passe que sur 'match' »).
    //
    // Le second test isole cette cause, et il vaut aussi comme REPETITION du jour ou les
    // identifiants Zefix PublicREST arriveront : cette seule ligne passe de `partial` a
    // `match` -- PublicREST apporte le statut, rien d'autre -- et le dossier s'auto-valide.

    /** L'une des deux raisons sociales que LINDAS publie pour CHE105909036 (l'autre est
     *  « Nestlé AG », meme numero, autre commune : un double siege statutaire). Le dossier
     *  en declare une ; le connecteur les accepte toutes, elles sont toutes deux inscrites
     *  au registre pour ce numero. */
    const NESTLE_LEGAL_NAME = 'Nestlé S.A.'

    async function setLegalName(agencyId: string, value: string): Promise<void> {
      const { error } = await serviceRoleClient().from('agencies').update({ legal_name: value }).eq('id', agencyId)
      if (error) throw new Error(`update legal_name: ${error.message}`)
    }

    /** La reponse REELLE de LINDAS pour CHE105909036, mesuree en direct le 29.07.2026 (voir
     *  .superpowers/sdd/task-2-report.md) : deux entrees pour un seul UID, communes
     *  differentes. Figee ici comme partout ailleurs dans ce fichier -- un test qui
     *  dependrait de la sante d'un service tiers ne mesurerait plus ce qu'il pretend. */
    function lindasNestleResponse(): Response {
      return new Response(
        JSON.stringify({
          head: { vars: ['legalName', 'municipality'] },
          results: {
            bindings: [
              { legalName: { type: 'literal', value: 'Nestlé AG' }, municipality: { type: 'literal', value: 'Cham' } },
              { legalName: { type: 'literal', value: 'Nestlé S.A.' }, municipality: { type: 'literal', value: 'Vevey' } },
            ],
          },
        }),
        { status: 200, headers: { 'content-type': 'application/sparql-results+json' } }
      )
    }

    /** Le dossier suisse irreprochable ET complet : tout ce que createPerfectSwissAgency
     *  pose, plus le numero de registre reel et la raison sociale du registre. Il ne lui
     *  manque donc RIEN de ce qu'un veto de registre sait verifier. */
    async function createCompleteSwissAgency(label: string): Promise<string> {
      const agencyId = await createPerfectSwissAgency(label)
      await setBusinessRegistrationNumber(agencyId, VALID_SWISS_UID)
      await setLegalName(agencyId, NESTLE_LEGAL_NAME)
      return agencyId
    }

    /**
     * Execute les sources de REGISTRE que le module juge applicables a ce dossier, contre un
     * LINDAS stubbe, et insere leurs lignes telles quelles.
     *
     * En processus et non par l'Edge Function, pour la meme raison que le test de
     * non-regression de la TVA juste apres : la fonction deployee appellerait le VRAI LINDAS
     * depuis le runtime edge, c'est-a-dire du reseau reel dans la suite automatisee. Le
     * ROUTAGE, lui, vient bien du module (selectApplicableSources sur le registre complet,
     * exactement ce que fait l'Edge Function avant d'executer quoi que ce soit) : c'est ce
     * qui fait mordre ce test si les sources Zefix cessaient d'etre applicables a la Suisse.
     */
    async function runRegistrySourcesAgainstStubbedLindas(
      agency: AgencyForVerification,
      agencyId: string
    ): Promise<Awaited<ReturnType<typeof runAgencyKybSources>>> {
      const { applicable } = selectApplicableSources(agency, fullKybRegistry())
      const registrySources = applicable.filter((s) => s.checkType.startsWith('registry_'))
      expect(
        registrySources.map((s) => `${s.source}:${s.checkType}`).sort(),
        'les quatre vetos d entite doivent avoir un proprietaire applicable a un siege suisse'
      ).toEqual(
        [
          'internal:registry_number_format',
          'zefix:registry_country_match',
          'zefix:registry_legal_name_match',
          'zefix:registry_lookup',
        ].sort()
      )

      // LINDAS stubbe le temps de l'appel, et RIEN d'autre : le client Supabase se sert du
      // meme fetch global, d'ou le retrait immediat du stub avant toute requete en base.
      vi.stubGlobal('fetch', vi.fn(async () => lindasNestleResponse()))
      let rows: Awaited<ReturnType<typeof runAgencyKybSources>>
      try {
        rows = await runAgencyKybSources(agency, registrySources)
      } finally {
        vi.unstubAllGlobals()
      }

      const { error } = await serviceRoleClient()
        .from('agency_verification_checks')
        .insert(rows.map((r) => ({ agency_id: agencyId, ...r })))
      if (error) throw new Error(`seed registry rows: ${error.message}`)
      return rows
    }

    it(
      'un dossier suisse autrement parfait, dont le registre A REPONDU, reste en manual_review : registry_lookup ' +
        'vaut partial (LINDAS ne publie pas le statut actif) et un veto ne passe que sur match',
      async () => {
        const agencyId = await createCompleteSwissAgency('lindas-partial-retient')
        const agency = await readAgencyForVerification(agencyId)

        const rows = await runRegistrySourcesAgainstStubbedLindas(agency, agencyId)
        await recompute(agencyId)

        // Trois vetos sur quatre passent POUR DE BON -- aucune ligne posee a la main.
        expect(rows.map((r) => `${r.source}:${r.check_type}=${r.result}`).sort()).toEqual(
          [
            'internal:registry_number_format=match',
            'zefix:registry_country_match=match',
            'zefix:registry_legal_name_match=match',
            'zefix:registry_lookup=partial',
          ].sort()
        )

        // Ecrites en base, `partial` compris : c'est la contrainte CHECK reelle sur
        // agency_verification_checks.source qui doit accepter `zefix`, pas seulement le
        // module qui doit le retourner.
        const stored = (await getChecks(agencyId))
          .filter((c) => c.source === 'zefix')
          .map((c) => `${c.check_type}=${c.result}`)
          .sort()
        expect(stored).toEqual(
          ['registry_country_match=match', 'registry_legal_name_match=match', 'registry_lookup=partial'].sort()
        )

        const after = await getAgency(agencyId)
        expect(
          num(after.verification_score),
          'un veto ne se lit JAMAIS dans le score : les vetos portent weight 0 et sortent du calcul'
        ).toBeCloseTo(1, 3)
        expect(
          after.verification_status,
          'score plein, signataire actif, trois vetos de registre satisfaits -- et pourtant la revue humaine'
        ).toBe('manual_review')
        expect(await lastVetoFailed(agencyId), 'c est bien un VETO qui retient ce dossier, pas le score').toBe(true)
      }
    )

    it(
      'le controle qui isole la cause -- et la repetition du jour ou Zefix PublicREST arrivera : la SEULE ligne ' +
        'registry_lookup passee de partial a match, le MEME dossier bascule en auto_validated',
      async () => {
        const agencyId = await createCompleteSwissAgency('lindas-partial-controle')
        const agency = await readAgencyForVerification(agencyId)

        await runRegistrySourcesAgainstStubbedLindas(agency, agencyId)
        await recompute(agencyId)
        expect((await getAgency(agencyId)).verification_status).toBe('manual_review')

        // UNE SEULE ligne change, et c'est exactement celle que PublicREST apportera : le
        // statut actif, la seule moitie de preuve qui manque a LINDAS. Posee APRES le
        // passage, elle est plus recente et gagne le `distinct on (check_type)` du moteur.
        // Ni le score, ni le signataire, ni les checks de personne, ni les trois autres
        // vetos ne bougent.
        await insertAgencyChecks(agencyId, ['registry_lookup'], 'match')
        await recompute(agencyId)

        const after = await getAgency(agencyId)
        expect(
          after.verification_status,
          'si le dossier ne bascule pas ici, c est qu autre chose que registry_lookup le retenait -- et le test ' +
            'precedent ne prouverait alors rien sur le plafond du verdict de LINDAS'
        ).toBe('auto_validated')
        expect(num(after.verification_score)).toBeCloseTo(1, 3)
        expect(await lastVetoFailed(agencyId)).toBe(false)
      }
    )

    // ─── LE CHANGEMENT DE REGIME QUE PORTE LA TACHE 3 : la France devient
    //     auto-validable des qu'un humain resout la piece d'identite ───────────────
    //
    // Jusqu'ici, AUCUN dossier d'AUCUN pays ne pouvait aboutir sans qu'on intervienne sur
    // les vetos d'entite eux-memes : les paires precedentes le montrent toutes les trois,
    // chacune n'obtenant l'auto-validation qu'en posant a la main une ligne de veto que
    // nul connecteur ne savait produire. Avec le quatrieme proprietaire francais
    // (registry_country_match, recherche_entreprises), un dossier francais complet voit
    // ses QUATRE vetos d'entite satisfaits PAR DES CONNECTEURS -- et il n'est plus retenu
    // que par la piece d'identite, un veto de PERSONNE qu'aucun prestataire automatique
    // ne resout et que la RPC de soumission pose en `pending_manual_review`.
    //
    // Trois tests, et ils ne valent qu'ensemble :
    //   (a) piece non resolue -> manual_review, les quatre vetos d'entite en `match` ;
    //   (b) la MEME, piece resolue -> auto_validated : le geste humain suffit desormais ;
    //   (c) le controle qui rend la mesure concluante -- le meme dossier prive de la SEULE
    //       source que cette tache ajoute ne bascule pas, piece resolue comprise. Sans
    //       (c), (b) ne prouverait rien : il resterait possible que la bascule vienne de
    //       la piece et non du veto comble.
    //
    // La Suisse, elle, ne bascule PAS, et c'est mesure juste au-dessus (« un dossier
    // suisse autrement parfait ... reste en manual_review ») : son registry_lookup vaut
    // `partial` faute de statut publie par LINDAS, et un veto ne passe que sur `match` --
    // sur un dossier dont la piece d'identite est POURTANT resolue. Le plafond de la
    // tache 2 tient donc, et la difference entre les deux pays est desormais lisible dans
    // ce fichier sans rien reconstituer.

    /** Carrefour : SIREN reel (il passe Luhn, donc le veto de format aussi) et raison
     *  sociale telle que le registre la publie. Meme fixture que le volet du connecteur
     *  francais, pour que la mesure en base et la mesure de logique parlent du meme cas. */
    const CARREFOUR_SIREN = '510761505'
    const CARREFOUR_LEGAL_NAME = 'CARREFOUR'

    /** Les vetos de personne AUTRES que la piece d'identite -- derives et non recopies,
     *  comme OTHER_AGENCY_VETO_TYPES : un troisieme veto de personne ajoute au catalogue
     *  demain doit entrer ici tout seul, sans quoi ces tests mesureraient la piece
     *  d'identite en laissant un autre veto retenir le dossier a sa place. */
    const OTHER_PERSON_VETO_TYPES = PERSON_VETO_TYPES.filter((t) => t !== 'id_document')

    /** La reponse de recherche-entreprises.api.gouv.fr pour ce SIREN, figee (forme exacte
     *  verifiee en direct a l'etape 4, voir le volet du connecteur francais). Un test qui
     *  dependrait de la sante d'un service tiers ne mesurerait plus ce qu'il pretend. */
    function rechercheEntreprisesCarrefourResponse(): Response {
      return new Response(
        JSON.stringify({
          results: [
            {
              siren: CARREFOUR_SIREN,
              nom_raison_sociale: CARREFOUR_LEGAL_NAME,
              nom_complet: CARREFOUR_LEGAL_NAME,
              etat_administratif: 'A',
            },
          ],
          total_results: 1,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    }

    /** Le dossier francais irreprochable ET complet : signataire actif, signaux scorables
     *  en `match`, veto PEP en `match`, numero de registre et raison sociale que le
     *  registre porte reellement. Une SEULE chose y reste en suspens, et c'est le sujet :
     *  la piece d'identite, posee en `pending_manual_review` exactement comme
     *  submit_agency_identity la pose (20260729151000), faute de prestataire automatique. */
    async function createCompleteFrenchAgency(label: string): Promise<{ agencyId: string; signatoryId: string }> {
      const agencyId = await createAgency(label)
      const signatoryId = await addActiveSignatory(agencyId)
      await setCountry(agencyId, 'FR')
      await setBusinessRegistrationNumber(agencyId, CARREFOUR_SIREN)
      await setLegalName(agencyId, CARREFOUR_LEGAL_NAME)
      await insertAgencyChecks(agencyId, SCORABLE_AGENCY_SIGNALS, 'match')
      await insertPersonChecks(signatoryId, [...OTHER_PERSON_VETO_TYPES, ...SCORABLE_PERSON_SIGNALS], 'match')
      await insertPersonChecks(signatoryId, ['id_document'], 'pending_manual_review')
      return { agencyId, signatoryId }
    }

    /**
     * Les sources de REGISTRE que LE MODULE juge applicables a ce dossier francais -- pas
     * une liste ecrite a la main : c'est selectApplicableSources() sur le registre complet,
     * exactement ce que fait l'Edge Function avant d'executer quoi que ce soit. C'est ce
     * qui fait mordre ces tests le jour ou la source francaise de registry_country_match
     * cesserait d'etre applicable a la France, ou se ferait doubler par Zefix.
     */
    function applicableFrenchRegistrySources(agency: AgencyForVerification): KybSource[] {
      const { applicable } = selectApplicableSources(agency, fullKybRegistry())
      const registrySources = applicable.filter((s) => s.checkType.startsWith('registry_'))
      expect(
        registrySources.map((s) => `${s.source}:${s.checkType}`).sort(),
        'les QUATRE vetos d entite doivent avoir un proprietaire applicable a un siege francais'
      ).toEqual(
        [
          'internal:registry_number_format',
          'recherche_entreprises:registry_country_match',
          'recherche_entreprises:registry_legal_name_match',
          'recherche_entreprises:registry_lookup',
        ].sort()
      )
      return registrySources
    }

    /** Execute les sources donnees contre un registre francais stubbe et insere leurs
     *  lignes telles quelles. En processus et non par l'Edge Function, meme raison que la
     *  demonstration LINDAS juste au-dessus : la fonction deployee appellerait le VRAI
     *  service depuis le runtime edge, c'est-a-dire du reseau reel dans la suite. */
    async function runFrenchRegistrySources(
      agency: AgencyForVerification,
      agencyId: string,
      sources: KybSource[]
    ): Promise<Awaited<ReturnType<typeof runAgencyKybSources>>> {
      // Le registre francais stubbe le temps de l'appel, et RIEN d'autre : le client
      // Supabase se sert du meme fetch global, d'ou le retrait immediat du stub.
      vi.stubGlobal('fetch', vi.fn(async () => rechercheEntreprisesCarrefourResponse()))
      let rows: Awaited<ReturnType<typeof runAgencyKybSources>>
      try {
        rows = await runAgencyKybSources(agency, sources)
      } finally {
        vi.unstubAllGlobals()
      }

      const { error } = await serviceRoleClient()
        .from('agency_verification_checks')
        .insert(rows.map((r) => ({ agency_id: agencyId, ...r })))
      if (error) throw new Error(`seed registry rows: ${error.message}`)
      return rows
    }

    /** Les vetos d'ENTITE tels qu'ils ont ete ECRITS EN BASE -- source comprise : c'est la
     *  contrainte CHECK reelle qui doit accepter `recherche_entreprises` sur ce type-la,
     *  pas seulement le module qui doit le retourner. */
    async function storedAgencyVetos(agencyId: string): Promise<string[]> {
      return (await getChecks(agencyId))
        .filter((c) => AGENCY_VETO_TYPES.includes(c.check_type))
        .map((c) => `${c.source}:${c.check_type}=${c.result}`)
        .sort()
    }

    const FRENCH_VETOS_ALL_MATCHED = [
      'internal:registry_number_format=match',
      'recherche_entreprises:registry_country_match=match',
      'recherche_entreprises:registry_legal_name_match=match',
      'recherche_entreprises:registry_lookup=match',
    ].sort()

    it(
      'un dossier francais complet voit ses QUATRE vetos d entite satisfaits PAR DES CONNECTEURS, et n est plus ' +
        'retenu que par la piece d identite : manual_review tant qu aucun humain ne la tranche',
      async () => {
        const { agencyId } = await createCompleteFrenchAgency('fr-quatre-vetos')
        const agency = await readAgencyForVerification(agencyId)

        const rows = await runFrenchRegistrySources(agency, agencyId, applicableFrenchRegistrySources(agency))
        await recompute(agencyId)

        // Les quatre en `match`, aucune ligne posee a la main -- c'est le fait nouveau.
        expect(rows.map((r) => `${r.source}:${r.check_type}=${r.result}`).sort()).toEqual(FRENCH_VETOS_ALL_MATCHED)
        expect(await storedAgencyVetos(agencyId)).toEqual(FRENCH_VETOS_ALL_MATCHED)

        const after = await getAgency(agencyId)
        expect(num(after.verification_score), 'tout le reste est parfait').toBeCloseTo(1, 3)
        expect(
          after.verification_status,
          'quatre vetos d entite satisfaits, score plein, signataire actif -- et pourtant la revue humaine'
        ).toBe('manual_review')
        expect(
          await lastVetoFailed(agencyId),
          'ce qui retient n est plus un veto d ENTITE mais la piece d identite, veto de PERSONNE en attente'
        ).toBe(true)
      }
    )

    it(
      'la meme, piece d identite resolue -> auto_validated : la France devient auto-validable des qu un humain ' +
        'tranche la piece, ce qu aucun dossier d aucun pays ne pouvait faire avant cette tache',
      async () => {
        const { agencyId, signatoryId } = await createCompleteFrenchAgency('fr-piece-resolue')
        const agency = await readAgencyForVerification(agencyId)

        await runFrenchRegistrySources(agency, agencyId, applicableFrenchRegistrySources(agency))
        await recompute(agencyId)
        expect((await getAgency(agencyId)).verification_status).toBe('manual_review')

        // LE GESTE HUMAIN, et lui seul : une ligne id_document plus recente en `match`,
        // ce que pose admin_resolve_agency_id_document (20260729151500). Rien d'autre ne
        // bouge -- ni le score, ni le signataire, ni la moindre ligne de connecteur.
        await insertPersonChecks(signatoryId, ['id_document'], 'match')
        await recompute(agencyId)

        const after = await getAgency(agencyId)
        expect(
          after.verification_status,
          'si ce dossier ne bascule pas, c est qu autre chose que la piece d identite le retenait'
        ).toBe('auto_validated')
        expect(num(after.verification_score)).toBeCloseTo(1, 3)
        expect(await lastVetoFailed(agencyId)).toBe(false)
      }
    )

    it(
      'le controle qui rend la mesure concluante : le MEME dossier prive de la SEULE source que cette tache ' +
        'ajoute reste en manual_review, piece d identite resolue comprise -- le veto registry_country_match manque',
      async () => {
        const { agencyId, signatoryId } = await createCompleteFrenchAgency('fr-controle-sans-source')
        const agency = await readAgencyForVerification(agencyId)

        // Le registre d'AVANT cette tache : les memes sources, moins celle qu'elle ajoute.
        // Un veto absent ne passe pas -- c'est la regle du moteur, et c'est ce qui tenait
        // la France hors de l'auto-validation jusqu'ici.
        const sansLaNouvelleSource = applicableFrenchRegistrySources(agency).filter(
          (s) => s.checkType !== 'registry_country_match'
        )
        await runFrenchRegistrySources(agency, agencyId, sansLaNouvelleSource)
        await insertPersonChecks(signatoryId, ['id_document'], 'match')
        await recompute(agencyId)

        expect(
          (await getChecks(agencyId)).filter((c) => c.check_type === 'registry_country_match'),
          'aucune ligne de ce type : c est bien un veto ABSENT que le moteur rencontre'
        ).toHaveLength(0)

        const after = await getAgency(agencyId)
        expect(
          after.verification_status,
          'si ce dossier basculait, la paire precedente ne prouverait rien sur la source ajoutee : la bascule ' +
            'viendrait de la piece d identite, pas du quatrieme veto comble'
        ).toBe('manual_review')
        expect(num(after.verification_score)).toBeCloseTo(1, 3)
        expect(await lastVetoFailed(agencyId)).toBe(true)
      }
    )

    // ─── Non-regression du VERDICT : le dossier CH a TVA europeenne (revue finale
    //     etape 6) ────────────────────────────────────────────────────────────────
    //
    // L'etape 6 s'etait donne un critere explicite : aucun verdict ne devait changer. Le
    // seul test qui pretendait le prouver n'assertait que `result === 'unavailable'`,
    // jamais un score. Il en manquait donc un, et c'est celui-ci : il mesure le VERDICT
    // contre le vrai moteur, sur le dossier exact ou le critere etait faux.
    //
    // Le routage vient du MODULE (selectApplicableSources sur le registre complet), pas
    // d'une valeur ecrite a la main : c'est ce qui fait echouer ce test tant que la
    // juridiction de vat_lookup se lit sur le seul pays du siege. Le passage complet n'est
    // pas rejoue par l'Edge Function ici -- elle appellerait VIES pour de vrai depuis le
    // runtime edge, un reseau reel dans la suite automatisee (discipline de ce fichier).

    /** TVA a prefixe UE portee par un dossier suisse. agencies.tva est du TEXTE LIBRE :
     *  ni le wizard (StepAgence.tsx) ni la base ne verifient l'accord prefixe/pays. Le
     *  numero est invalide, VIES repond donc `valid:false` -> mismatch. */
    const EU_PREFIXED_INVALID_TVA = 'FR00000000000'

    async function setTva(agencyId: string, tva: string): Promise<void> {
      const { error } = await serviceRoleClient().from('agencies').update({ tva }).eq('id', agencyId)
      if (error) throw new Error(`update tva: ${error.message}`)
    }

    /** L'agence telle que l'Edge Function la donne aux connecteurs -- memes colonnes, lues
     *  EN BASE et non fabriquees a la main : c'est la donnee reelle du dossier qui doit
     *  designer le proprietaire de vat_lookup. */
    async function readAgencyForVerification(agencyId: string): Promise<AgencyForVerification> {
      const { data, error } = await serviceRoleClient()
        .from('agencies')
        .select(
          'id, legal_name, trade_name, business_registration_number, country, canton, city, postal_code, address, website, tva'
        )
        .eq('id', agencyId)
        .single()
      if (error) throw new Error(`read agency for verification: ${error.message}`)
      return data as unknown as AgencyForVerification
    }

    /** Le dossier du scenario : siege CH, TVA a prefixe UE, les quatre vetos d'entite et
     *  les deux vetos de personne poses a la main en `match`, et UN SEUL signal scorable
     *  (domain_whois_age, poids 0.75). Ce dosage n'est pas decoratif : avec ce seul signal,
     *  la ligne vat_lookup (poids 3.00) fait a elle seule basculer le score de 1.000 a
     *  0.75/3.75 = 0.200, donc le statut de auto_validated a manual_review. C'est ce qui
     *  rend la difference MESURABLE plutot que theorique -- memes chiffres que la mesure de
     *  la revue finale. */
    async function createSwissDossierWithEuVatPrefix(label: string): Promise<string> {
      const agencyId = await createAgency(label)
      const signatoryId = await addActiveSignatory(agencyId)
      await setCountry(agencyId, 'CH')
      await setTva(agencyId, EU_PREFIXED_INVALID_TVA)
      await insertAgencyChecks(agencyId, AGENCY_VETO_TYPES, 'match')
      await insertAgencyChecks(agencyId, ['domain_whois_age'], 'match')
      await insertPersonChecks(signatoryId, PERSON_VETO_TYPES, 'match')
      return agencyId
    }

    it(
      'un siege CH qui declare une TVA a prefixe UE reste interroge par VIES : son mismatch retient le dossier ' +
        'en manual_review (0.200), la ou un unavailable l aurait auto-valide (1.000)',
      async () => {
        const agencyId = await createSwissDossierWithEuVatPrefix('nonreg-tva-ue')
        const agency = await readAgencyForVerification(agencyId)

        // Le registre COMPLET, filtre par le module lui-meme -- exactement ce que fait
        // l'Edge Function avant d'executer quoi que ce soit.
        const { applicable } = selectApplicableSources(agency, fullKybRegistry())
        const vatSources = applicable.filter((s) => s.checkType === 'vat_lookup')

        // VIES stubbe le temps de l'appel, et RIEN d'autre : le client Supabase se sert du
        // meme fetch global, d'ou le retrait immediat du stub avant toute requete en base.
        vi.stubGlobal(
          'fetch',
          vi.fn(async () => new Response(JSON.stringify({ valid: false }), { status: 200 }))
        )
        let rows: Awaited<ReturnType<typeof runAgencyKybSources>>
        try {
          rows = await runAgencyKybSources(agency, vatSources)
        } finally {
          vi.unstubAllGlobals()
        }

        expect(rows, 'un seul proprietaire de vat_lookup, jamais deux ni zero').toHaveLength(1)
        expect(rows[0], 'le prefixe declare designe VIES, et VIES a un verdict a rendre').toMatchObject({
          check_type: 'vat_lookup',
          source: 'vies',
          result: 'mismatch',
        })

        const { error: insErr } = await serviceRoleClient()
          .from('agency_verification_checks')
          .insert(rows.map((r) => ({ agency_id: agencyId, ...r })))
        if (insErr) throw new Error(`seed vat_lookup row: ${insErr.message}`)
        await recompute(agencyId)

        const after = await getAgency(agencyId)
        expect(
          num(after.verification_score),
          'un seul signal scorable en match (0.75) contre le mismatch de la TVA (3.00)'
        ).toBeCloseTo(0.2, 3)
        expect(
          after.verification_status,
          'le seul signal defavorable du dossier doit continuer de le retenir en revue humaine'
        ).toBe('manual_review')
        expect(await lastVetoFailed(agencyId), 'aucun veto ne retient ce dossier : c est bien le SCORE').toBe(false)

        // Le temoin qui rend la mesure concluante : le MEME dossier, avec la ligne
        // `unavailable` que produisait l'etape 6 avant ce correctif (VIES ecartee, registre
        // UID sans identifiants). Le signal defavorable sort du numerateur ET du
        // denominateur, le score remonte a 1.000 et le dossier s'auto-valide -- sans qu'un
        // relecteur, qui ne regarde pas la TVA, voie jamais passer la difference.
        const temoinId = await createSwissDossierWithEuVatPrefix('nonreg-tva-ue-temoin')
        const { error: temoinErr } = await serviceRoleClient()
          .from('agency_verification_checks')
          .insert({
            agency_id: temoinId,
            check_type: 'vat_lookup',
            source: 'uid_register',
            result: 'unavailable',
            raw_response: { reason: 'error', error_type: 'KybSourcePendingCredentialsError' },
          })
        if (temoinErr) throw new Error(`seed temoin row: ${temoinErr.message}`)
        await recompute(temoinId)

        const temoin = await getAgency(temoinId)
        expect(num(temoin.verification_score)).toBeCloseTo(1, 3)
        expect(
          temoin.verification_status,
          'si le temoin ne s auto-valide pas, la mesure ci-dessus ne prouve rien sur le verdict'
        ).toBe('auto_validated')
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
        // 3 sources applicables faute de pays declare (voir le test precedent) -- seul
        // RDAP a de quoi repondre ici (website renseigne) ; le geocodage et le controle du
        // numero de registre restent unavailable.
        expect(body.checks_written).toBe(3)
        expect(body.results.partial).toBe(1)
        expect(body.results.unavailable).toBe(2)

        const checks = await getChecks(agencyId)
        expect(checks).toHaveLength(3)
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
      // CHAQUE appel pour CHAQUE connecteur APPLICABLE (3 ici, faute de pays declare --
      // voir la regle de juridiction, etape 6 tache 1), c'est le moteur qui departage
      // plusieurs lignes du meme type par ctid (voir le test dedie plus bas), jamais
      // cette fonction qui filtre avant d'ecrire.
      expect(await getChecks(agencyId)).toHaveLength(6)
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
        //
        // Le type seede est registry_lookup depuis le chantier LINDAS (tache 1), et le
        // changement n'est pas cosmetique : c'etait registry_number_format, qui a
        // desormais un connecteur ecrivant SA propre ligne a chaque passage. Cette
        // ligne-la, plus recente, gagnerait legitimement le departage -- le test serait
        // reste vert en ne prouvant plus rien sur l'ordre d'insertion. registry_lookup
        // est un veto que ce dossier n'ecrit PAS (aucun pays declare : les sources de
        // registre sont ecartees), donc les deux lignes seedees restent les seules de
        // leur type.
        const svc = serviceRoleClient()
        const { error: seedErr } = await svc.from('agency_verification_checks').insert([
          { agency_id: agencyId, check_type: 'registry_lookup', source: 'manual', result: 'match' },
          { agency_id: agencyId, check_type: 'registry_lookup', source: 'manual', result: 'mismatch' },
        ])
        if (seedErr) throw new Error(`seed same-tx: ${seedErr.message}`)

        const res = await callRun(agencyId)
        expect(res.status).toBe(200)

        // Veto registry_lookup tranche sur la ligne inseree EN DERNIER
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
        // APPLICABLE ecrit sa propre ligne a chaque appel -- 3 ici faute de pays
        // declare, +3 a res, +3 a res2), preuve que "rejouable" n'est pas "silencieux"
        // -- seul le resultat DECISIF (le veto seede) ne doit pas bouger.
        const res2 = await callRun(agencyId)
        expect(res2.status).toBe(200)
        expect(await getChecks(agencyId)).toHaveLength(8)
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
            // La cle posee ici finit en Bearer du net.http_post, donc face a la MEME
            // comparaison litterale que les fetch() directs : SERVICE_ROLE_JWT, jamais
            // SERVICE_KEY (voir le bloc de declaration en tete de fichier).
            await setConfig('supabase_url', PG_NET_LOCAL_FUNCTIONS_URL)
            await setConfig('service_role_key', SERVICE_ROLE_JWT)

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
            await setConfig('service_role_key', SERVICE_ROLE_JWT)

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
            await setConfig('service_role_key', SERVICE_ROLE_JWT)

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
            await setConfig('service_role_key', SERVICE_ROLE_JWT)

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

// ─── Connecteur registre francais (registry_lookup / registry_legal_name_match /
//     registry_country_match, etape 4 tache 3 puis chantier LINDAS tache 3) --
//     logique pure ────────────────────────────────────────────────────────────────
//
// Hors du describe.skipIf(!HAS_KEYS) DELIBEREMENT, meme motif que RDAP/VIES plus haut.
// La verification CONTRE le vrai service (recherche-entreprises.api.gouv.fr) se fait a
// la main, une fois, hors de cette suite -- voir docs/superpowers/sdd/task-3-report.md
// (recherche par SIREN direct, forme exacte de reponse, SIREN inexistant -> 200 avec
// results:[] -- tout verifie en direct contre le vrai service).
//
// Le TROISIEME check_type est arrive au chantier LINDAS (tache 3) : ce connecteur avait
// ecarte registry_country_match, la tache 2 a retenu l'argument inverse pour la Suisse, et
// tenir les deux a la fois etait intenable -- voir la section dediee plus bas dans ce
// volet, et l'en-tete de section de _shared/kyb-sources.ts.
describe('connecteur registre francais (registry_lookup / registry_legal_name_match / registry_country_match) -- logique pure, fetch stubbe', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** Cherche sur la PAIRE (check_type, source) et jamais sur le seul check_type : les
   *  TROIS types que ce connecteur revendique ont aussi un proprietaire suisse dans le meme
   *  registre. Chercher par type seul rendait le bon connecteur par l'ORDRE du tableau
   *  (les entrees francaises precedent les suisses) -- une coincidence, pas une propriete,
   *  et un test qui mesurerait alors le mauvais connecteur sans rien signaler. Meme helper
   *  et meme raison que zefixSource() dans le volet Zefix. */
  function frenchSource(checkType: string): KybSource {
    const found = AGENCY_KYB_SOURCES.find((s) => s.checkType === checkType && s.source === 'recherche_entreprises')
    if (!found) throw new Error(`${checkType} (source recherche_entreprises) absent de AGENCY_KYB_SOURCES`)
    return found
  }

  function registryLookupSource(): KybSource {
    return frenchSource('registry_lookup')
  }

  function registryLegalNameMatchSource(): KybSource {
    return frenchSource('registry_legal_name_match')
  }

  function registryCountryMatchSource(): KybSource {
    return frenchSource('registry_country_match')
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

  // Les gardes d'entree et la traduction des pannes valent pour les TROIS check_type que
  // ce connecteur revendique -- registry_country_match compris depuis la tache 3 du
  // chantier LINDAS : un troisieme veto qui sortirait du processus sans passer par la
  // meme discipline (jamais d'appel hors juridiction, jamais un verdict sur une panne)
  // serait le seul du fichier a en etre dispense.
  for (const label of ['registry_lookup', 'registry_legal_name_match', 'registry_country_match'] as const) {
    const sourceOf = () => frenchSource(label)

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

    it(
      `${label} : numero de forme SUISSE ("CHE-123456782") sur un dossier francais -> unavailable, jamais un appel ` +
        'reseau : le MEME champ se lit de la MEME facon que le controle de cle (registry_number_format)',
      async () => {
        // Avant ce correctif, extractSiren retirait TOUTES les non-chiffres : ce numero se
        // lisait ici comme le SIREN 123456782 (present a l'index, Luhn valide -- verifie en
        // direct), et comme illisible pour registry_number_format, qui ne retire que
        // [\s.-] et voit donc "CHE123456782". Meme champ, deux lectures -- exactement la
        // divergence que ce module condamne ailleurs (« UN SEUL point de normalisation »).
        // registry_country_match posait alors un `match` sur une entite derivee d'un numero
        // de forme suisse, sur un dossier qui se declare francais.
        const fetchSpy = vi.fn(async () => rechercheEntreprisesResponse([activeResult({ siren: '123456782' })]))
        vi.stubGlobal('fetch', fetchSpy)
        const row = await runKybSource(sourceOf(), agencyFR({ business_registration_number: 'CHE-123456782' }))
        expect(row.result).toBe('unavailable')
        expect(fetchSpy).not.toHaveBeenCalled()
      }
    )

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

    it(
      `${label} : le resultat retenu porte un AUTRE SIREN que celui demande -> unavailable, et JAMAIS ` +
        'un verdict sur une entite qu on n a pas demandee',
      async () => {
        // `q=` est une recherche PLEIN TEXTE : rien dans le contrat de l'API ne promet que
        // le premier resultat porte le SIREN demande. Sonde en direct (8 requetes a neuf
        // chiffres -- SIREN reel, inexistant, Luhn-invalide, 123456789, 999999999), le
        // service le rend toujours ; mais c'est une propriete du TIERS, pas du code, et le
        // pendant suisse, lui, lie l'UID exactement dans le litteral SPARQL. Ce test rend
        // l'invariant LOCAL. Sans lui, ces trois vetos concluent sur l'entite rendue au lieu
        // de l'entite demandee -- et depuis que registry_country_match a un proprietaire
        // francais, un dossier francais dont les quatre vetos passent n'attend plus qu'une
        // decision humaine sur la piece d'identite.
        vi.stubGlobal(
          'fetch',
          // SIREN de Danone, une entite REELLE mais qui n'est pas celle du dossier (Carrefour).
          vi.fn(async () => rechercheEntreprisesResponse([activeResult({ siren: '552032534' })]))
        )
        const row = await runKybSource(sourceOf(), agencyFR())
        // `unavailable` et non `mismatch` : se tromper d'entite n'est pas constater que
        // l'entite declaree est fausse.
        expect(row.result).toBe('unavailable')
        // La raison est jointe : un relecteur de la file admin doit voir QUEL SIREN est
        // revenu sans ouvrir le code.
        expect(String(row.raw_response.message)).toContain('552032534')
      }
    )
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

    // ── Une comparaison SANS MATIERE ne conclut rien (revue finale de branche, point 1) ──
    //
    // Ce veto passait sur une comparaison de DEUX CHAINES VIDES. `??` ne rattrape que
    // null/undefined : un enregistrement sans aucun nom donnait `registryName = ''`, et
    // normalizeLegalNameStrict reduit a '' toute raison sociale declaree sans lettre ni
    // chiffre ('-', '.', '&', '@@@'). Les deux cotes valaient '', l'egalite tenait, le veto
    // passait -- il affirmait une identite prouvee sur aucune preuve. L'entree n'est pas
    // hypothetique : q=123456789, q=333333333 et q=999999999 rendent chacun un
    // enregistrement `{nom_raison_sociale: null, nom_complet: null}` (fantomes du jeu SIRENE,
    // mesure en direct le 29.07.2026). Aucune des 12 fixtures francaises n'exercait ce corps
    // -- toutes posaient un `nom_raison_sociale`. Le pendant suisse levait deja sur son cote
    // registre (`entries.legalNames.length === 0`) : les deux connecteurs disent desormais la
    // meme chose des deux cotes de la comparaison.
    it(
      'enregistrement SANS AUCUN NOM (nom_raison_sociale ET nom_complet a null) -> unavailable : ' +
        '« aucun nom au registre » n est pas « le nom concorde »',
      async () => {
        vi.stubGlobal(
          'fetch',
          vi.fn(async () =>
            rechercheEntreprisesResponse([activeResult({ nom_raison_sociale: null, nom_complet: null })])
          )
        )
        const row = await runKybSource(registryLegalNameMatchSource(), agencyFR({ legal_name: 'Carrefour' }))
        expect(row.result).toBe('unavailable')
      }
    )

    it(
      'raison sociale declaree faite de seule ponctuation -> unavailable, et jamais un appel reseau : ' +
        'rien a comparer avant meme d avoir interroge le registre',
      async () => {
        const fetchSpy = vi.fn(async () => rechercheEntreprisesResponse([activeResult()]))
        vi.stubGlobal('fetch', fetchSpy)
        for (const declaree of ['-', '.', '&', '@@@', "'''"]) {
          const row = await runKybSource(registryLegalNameMatchSource(), agencyFR({ legal_name: declaree }))
          expect(row.result, `legal_name ${JSON.stringify(declaree)}`).toBe('unavailable')
        }
        expect(fetchSpy).not.toHaveBeenCalled()
      }
    )

    it(
      'les DEUX a la fois (raison sociale declaree de seule ponctuation ET enregistrement sans nom) -> unavailable, ' +
        'JAMAIS match : deux chaines vides ne sont pas une identite prouvee',
      async () => {
        vi.stubGlobal(
          'fetch',
          vi.fn(async () =>
            rechercheEntreprisesResponse([activeResult({ nom_raison_sociale: null, nom_complet: null })])
          )
        )
        const row = await runKybSource(registryLegalNameMatchSource(), agencyFR({ legal_name: '-' }))
        expect(row.result, 'c est exactement le corps qui faisait passer le veto').toBe('unavailable')
      }
    )

    it(
      'nom_complet reste la retombee quand nom_raison_sociale est absent -- le correctif ci-dessus ne ferme que ' +
        'le cas ou il ne reste RIEN a comparer',
      async () => {
        vi.stubGlobal(
          'fetch',
          vi.fn(async () =>
            rechercheEntreprisesResponse([activeResult({ nom_raison_sociale: null, nom_complet: 'CARREFOUR' })])
          )
        )
        const row = await runKybSource(registryLegalNameMatchSource(), agencyFR({ legal_name: 'Carrefour' }))
        expect(row.result).toBe('match')
      }
    )

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

  // ── registry_country_match : l immatriculation au registre francais (tache 3) ──
  //
  // Ce connecteur avait ECARTE ce check, au motif qu'il n'interroge que des sieges deja
  // declares en France : une reponse positive n'y confirmerait rien qu'on ne sache. La
  // tache 2 a retenu l'argument INVERSE pour la Suisse, et garder les deux en meme temps
  // etait intenable -- trouver le numero declare DANS LE REGISTRE DE LA JURIDICTION
  // DECLAREE distingue reellement « cette entite est immatriculee en France » de « cette
  // agence pretend etre francaise ». Le filtre de juridiction dit d'ou vient la question,
  // jamais que la reponse est acquise : une agence francaise peut parfaitement declarer
  // un numero que le registre francais ne porte pas.
  describe('registry_country_match -- l immatriculation au registre francais', () => {
    it('SIREN trouve au registre francais -> match, l entite est immatriculee en France', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => rechercheEntreprisesResponse([activeResult()])))
      const row = await runKybSource(registryCountryMatchSource(), agencyFR())
      expect(row.result).toBe('match')
      expect(row.source).toBe('recherche_entreprises')
      expect(row.raw_response).toMatchObject({
        siren: '510761505',
        declared_country: 'FR',
        registry_country: 'FR',
      })
    })

    it(
      'SIREN introuvable (results:[]) -> unavailable, JAMAIS mismatch : l existence est deja portee par ' +
        'registry_lookup, et la reporter ici compterait deux fois le meme constat sur deux vetos independants',
      async () => {
        // Exactement l'arbitrage de runZefixRegistryCountryMatch cote suisse. Un mismatch
        // ici ferait payer DEUX vetos pour UNE seule absence -- la conception les veut
        // independants, et un dossier ne doit pas etre accuse deux fois du meme fait.
        vi.stubGlobal('fetch', vi.fn(async () => rechercheEntreprisesResponse([])))
        const row = await runKybSource(registryCountryMatchSource(), agencyFR())
        expect(row.result).toBe('unavailable')
      }
    )

    it(
      'entreprise cessee (etat_administratif != A) -> match quand meme : la juridiction ne depend d aucun statut, ' +
        'une entreprise radiee reste une entreprise immatriculee EN FRANCE',
      async () => {
        // Meme raisonnement que cote suisse, et c'est ce qui distingue ce veto de
        // registry_lookup : celui-la lit le statut, celui-ci ne le lit jamais. Les
        // confondre ferait de registry_country_match un doublon du veto d'existence.
        vi.stubGlobal(
          'fetch',
          vi.fn(async () => rechercheEntreprisesResponse([activeResult({ etat_administratif: 'C' })]))
        )
        const row = await runKybSource(registryCountryMatchSource(), agencyFR())
        expect(row.result).toBe('match')
      }
    )

    it('juridiction : la source declare la France, et ne s applique a aucun autre pays', () => {
      const source = registryCountryMatchSource()
      expect(source.appliesTo, 'registry_country_match a DEUX proprietaires : il doit declarer sa juridiction').toBeDefined()
      expect(source.appliesTo!(agencyFR())).toBe(true)
      // Minuscules et blancs : agencies.country est du texte libre cote base.
      expect(source.appliesTo!(agencyFR({ country: '  fr  ' }))).toBe(true)
      for (const country of ['CH', 'LI', 'DE', null]) {
        expect(source.appliesTo!(agencyFR({ country })), `pays ${country ?? 'non declare'}`).toBe(false)
      }
    })
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

// ─── Connecteur Zefix par LINDAS (registre du commerce suisse, chantier LINDAS
//     tache 2) : volet 8 ──────────────────────────────────────────────────────────
//
// Hors du describe.skipIf(!HAS_KEYS) DELIBEREMENT, meme motif que les volets de
// connecteurs precedents : ni Supabase local, ni reseau REEL -- `fetch` est stubbe, les
// valeurs sont figees. Ce qui a ete mesure contre le vrai endpoint, une fois, hors de
// cette suite, est consigne dans .superpowers/sdd/task-2-report.md.
//
// Ce volet remplace celui du SQUELETTE Zefix (etape 6, tache 2), qui revendiquait les
// memes trois check_type sans jamais pouvoir repondre : Zefix PublicREST exige des
// identifiants, demandes a zefix@bj.admin.ch et sans reponse. La voie publique existait
// pourtant -- LINDAS, l'entrepot de donnees liees de la Confederation, publie le graphe
// Zefix en SPARQL sans authentification, et ce depot s'en servait deja
// (scripts/zefix-enrich-agencies.mjs).
//
// LE PLAFOND DU VERDICT est ce que ce volet verrouille en plus du cablage, et c'est le
// coeur du sujet : registry_lookup ne peut JAMAIS valoir `match`. Le graphe ne publie
// AUCUN statut -- une societe radiee y figure exactement comme une active (predicats
// mesures : legalName, name, address, municipality, additionalType, description,
// identifier, et rien d'autre). Poser `match` signifierait « existe ET active » sur une
// preuve qui n'en porte que la moitie. La Suisse reste donc non auto-validable, mais pour
// une raison desormais precise -- sa contrepartie en base (un dossier suisse parfait
// retenu par ce seul `partial`) vit dans le volet 2.
//
// LA RAISON SOCIALE SE COMPARE A `schema:legalName`, JAMAIS A `schema:name`, et le cas
// Nestle mesure ci-dessous dit pourquoi mieux qu'un principe : les deux entrees que rend
// CHE105909036 portent chacune, en `schema:name`, la raison sociale DE L'AUTRE (« Nestlé
// S.A. » et « Nestlé Ltd. » sur l'entree dont le legalName est « Nestlé AG »). Meler les
// deux fabriquerait des `match` sur autre chose que ce que le veto verifie.
describe('connecteur Zefix par LINDAS (registry_lookup / registry_legal_name_match / registry_country_match)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const LINDAS_ENDPOINT = 'https://lindas.admin.ch/query'
  const ZEFIX_CHECK_TYPES = ['registry_lookup', 'registry_legal_name_match', 'registry_country_match']

  /** Recuperee dans AGENCY_KYB_SOURCES et non depuis une fabrique : LINDAS etant public,
   *  ces trois sources n'ont besoin d'AUCUNE configuration -- elles sont donc des entrees
   *  statiques du registre, comme RDAP, VIES et le registre francais. Chercher sur la PAIRE
   *  (check_type, source) et non sur le seul check_type : les TROIS types ont aussi un
   *  proprietaire francais dans ce meme registre (registry_country_match l'a rejoint a la
   *  tache 3 du chantier LINDAS). */
  function zefixSource(checkType: string): KybSource {
    const found = AGENCY_KYB_SOURCES.find((s) => s.checkType === checkType && s.source === 'zefix')
    if (!found) throw new Error(`${checkType} (source zefix) absent de AGENCY_KYB_SOURCES`)
    return found
  }

  /** Le dossier suisse de reference : l'UID de Nestle sous sa forme de SAISIE HUMAINE
   *  (separateurs compris, comme le wizard la recoit), et la raison sociale de l'une des
   *  deux entrees que le registre publie pour ce numero. */
  function agencyCH(overrides: Partial<AgencyForVerification> = {}): AgencyForVerification {
    return {
      ...FAKE_AGENCY,
      country: 'CH',
      legal_name: 'Nestlé S.A.',
      business_registration_number: 'CHE-105.909.036',
      ...overrides,
    }
  }

  function binding(legalName: string, municipality?: string): Record<string, unknown> {
    return {
      legalName: { type: 'literal', value: legalName },
      ...(municipality === undefined ? {} : { municipality: { type: 'literal', value: municipality } }),
    }
  }

  function lindasResponse(bindings: Record<string, unknown>[]): Response {
    return new Response(
      JSON.stringify({ head: { vars: ['legalName', 'municipality'] }, results: { bindings } }),
      { status: 200, headers: { 'content-type': 'application/sparql-results+json' } }
    )
  }

  /** La reponse REELLE de LINDAS pour CHE105909036, mesuree en direct le 29.07.2026. DEUX
   *  entrees pour UN SEUL UID, avec des communes differentes : c'est un DOUBLE SIEGE
   *  STATUTAIRE (deux inscriptions cantonales de la meme entite), et les deux raisons
   *  sociales sont inscrites. Ce n'est pas le cas nominal -- 3 UID sur 791 068 seulement
   *  rendent plus d'un noeud (mesure du 29.07.2026, voir ZEFIX_UID_RESULT_LIMIT dans
   *  _shared/kyb-sources.ts) -- mais c'est le seul cas ou la boucle du connecteur sert. */
  const NESTLE_BINDINGS = [binding('Nestlé AG', 'Cham'), binding('Nestlé S.A.', 'Vevey')]

  function stubLindas(bindings: Record<string, unknown>[]): ReturnType<typeof vi.fn> {
    const spy = vi.fn(async () => lindasResponse(bindings))
    vi.stubGlobal('fetch', spy)
    return spy
  }

  /** Le texte SPARQL reellement envoye, decode depuis le corps form-urlencoded. Sert aux
   *  assertions qui portent sur CE QUI A ETE DEMANDE, pas seulement sur ce qui a ete lu. */
  function sentSparql(spy: ReturnType<typeof vi.fn>): string {
    const init = spy.mock.calls[0][1] as RequestInit
    const body = String(init.body)
    expect(body.startsWith('query='), `corps inattendu : ${body.slice(0, 40)}`).toBe(true)
    return decodeURIComponent(body.slice('query='.length).replace(/\+/g, ' '))
  }

  it('les trois sources sont enregistrees dans AGENCY_KYB_SOURCES, de source zefix, sans fabrique ni configuration', () => {
    // LINDAS est PUBLIC : aucun secret a lire, donc aucune raison de passer par une
    // fabrique appelee depuis index.ts (c'est ce que la configuration vide du squelette
    // imposait a l'etape 6). Les trois codes sont deja catalogues (verification_check_types,
    // migration 20260729150300) et tous trois VETOS (weight 0, is_veto true), et `zefix` est
    // deja une valeur admise par la contrainte CHECK sur agency_verification_checks.source :
    // aucune migration n'est necessaire, verifie et non suppose.
    const sources = AGENCY_KYB_SOURCES.filter((s) => s.source === 'zefix')
    expect(sources).toHaveLength(3)
    expect(sources.map((s) => s.checkType).sort()).toEqual([...ZEFIX_CHECK_TYPES].sort())
  })

  // ── Ce qui ne sort jamais du processus : les gardes d'entree ──────────────────

  for (const checkType of ZEFIX_CHECK_TYPES) {
    it(`${checkType} : siege hors Suisse -> unavailable, jamais un appel reseau`, async () => {
      const fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)
      const row = await runKybSource(zefixSource(checkType), agencyCH({ country: 'FR' }))
      expect(row.result).toBe('unavailable')
      expect(row.source).toBe('zefix')
      expect(fetchSpy, 'la garde interne reste la derniere ligne de defense du filtre').not.toHaveBeenCalled()
    })

    it(`${checkType} : aucun numero de registre declare -> unavailable, jamais un appel reseau`, async () => {
      const fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)
      const row = await runKybSource(zefixSource(checkType), agencyCH({ business_registration_number: null }))
      expect(row.result).toBe('unavailable')
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it(`${checkType} : numero qui n a pas la forme d un IDE -> unavailable, jamais un appel reseau`, async () => {
      // Un SIREN francais, un UID tronque, un prefixe absent, une lettre au milieu : rien
      // de tout cela ne se LIT comme un IDE. La forme est verifiee AVANT de construire la
      // requete -- c'est aussi ce qui rend l'interpolation du numero dans le SPARQL sure.
      const fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)
      for (const saisie of ['510761505', 'CHE-12.34', 'CHE1059090366', 'CH105909036', 'CHE10590903A']) {
        const row = await runKybSource(zefixSource(checkType), agencyCH({ business_registration_number: saisie }))
        expect(row.result, `saisie "${saisie}"`).toBe('unavailable')
      }
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it(`${checkType} : erreur serveur (503) -> unavailable, avec le code de statut joint a la preuve`, async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 503 })))
      const row = await runKybSource(zefixSource(checkType), agencyCH())
      expect(row.result).toBe('unavailable')
      expect(row.raw_response.status, 'un relecteur doit pouvoir distinguer une panne d un verdict').toBe(503)
    })

    it(`${checkType} : corps illisible (JSON invalide) -> unavailable`, async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>bad gateway</html>', { status: 200 })))
      const row = await runKybSource(zefixSource(checkType), agencyCH())
      expect(row.result).toBe('unavailable')
    })

    it(
      `${checkType} : reponse HTTP 200 hors schema (results.bindings absent) -> unavailable, jamais ` +
        'un verdict invente -- SEULE une liste VIDE est l information « ce numero n y est pas »',
      async () => {
        // Meme garde, meme raison que le registre francais et Mapbox (revue etape 4/tache 3) :
        // HTTP 200 ne garantit pas la forme. Un corps hors schema ne permet PAS de conclure a
        // une absence, et ce check-ci est un VETO -- confondre les deux ecrirait une
        // affirmation decisive sur une panne de schema.
        for (const body of [{}, { results: {} }, { results: { bindings: 'nope' } }, { results: null }]) {
          vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }))
          )
          const row = await runKybSource(zefixSource(checkType), agencyCH())
          expect(row.result, `corps ${JSON.stringify(body)}`).toBe('unavailable')
        }
      }
    )

    it(`${checkType} : panne reseau -> unavailable`, async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new Error('network down')
        })
      )
      const row = await runKybSource(zefixSource(checkType), agencyCH())
      expect(row.result).toBe('unavailable')
    })

    it(`${checkType} : timeout -> unavailable via le harnais`, async () => {
      vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
      const row = await runKybSource(zefixSource(checkType), agencyCH(), 50)
      expect(row.result).toBe('unavailable')
      expect(row.raw_response).toMatchObject({ reason: 'timeout' })
    }, 2_000)
  }

  // ── La requete : la forme INDEXEE, et elle seule ──────────────────────────────

  it(
    'interroge LINDAS en POST form-urlencoded sur le litteral schema:value, la seule forme qui tienne ' +
      'sous le budget de 10 s du harnais',
    async () => {
      const spy = stubLindas(NESTLE_BINDINGS)
      await runKybSource(zefixSource('registry_lookup'), agencyCH())

      expect(spy).toHaveBeenCalledTimes(1)
      expect(String(spy.mock.calls[0][0])).toBe(LINDAS_ENDPOINT)
      const init = spy.mock.calls[0][1] as RequestInit
      expect(init.method).toBe('POST')
      const headers = init.headers as Record<string, string>
      expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded')
      expect(headers.Accept).toBe('application/sparql-results+json')

      const sparql = sentSparql(spy)
      // Le litteral `schema:value "CHE105909036"` est mesure a 0,147 s ; filtrer par
      // STRENDS sur l'URI de l'identifiant met 14 s (scan de 2,37 M d'identifiants) et ne
      // tiendrait PAS sous DEFAULT_SOURCE_TIMEOUT_MS. La forme de la requete decide de sa
      // vitesse, pas seulement de sa justesse.
      expect(sparql).toContain('schema:value "CHE105909036"')
      expect(sparql, "l'identifiant LINDAS est un NOEUD, pas une chaine portee par l entite").toContain(
        'schema:name "CompanyUID"'
      )
      // Le predicat qui lie ?legalName est verrouille ICI, dans la REQUETE, et pas
      // seulement dans la lecture de la reponse (revue tache 2, point Important) : un
      // lecteur ne peut pas savoir quel predicat a produit une liaison, donc aucun test
      // adosse a une reponse figee ne peut distinguer legalName de name. Mesure : passer
      // la requete a `schema:name ?legalName` laissait les 199 tests VERTS, et une agence
      // declarant « Nestle Ltd. » -- une denomination que le registre porte en name mais
      // JAMAIS en legalName -- obtenait alors un veto `match`. C'est exactement ce que la
      // conception interdit : la raison sociale se compare a la raison sociale.
      expect(sparql, 'la raison sociale se lit sur schema:legalName, jamais sur schema:name').toContain(
        'schema:legalName ?legalName'
      )
      expect(sparql, 'jamais un filtre sur l URI : 14 s mesures contre 0,147 s').not.toContain('STRENDS')
    }
  )

  it('le numero saisi avec separateurs est normalise avant la requete : le registre publie CHE105909036', async () => {
    // La saisie humaine porte la forme d'affichage officielle (CHE-105.909.036) ; le graphe,
    // lui, ne porte AUCUN separateur. Envoyer la saisie telle quelle ne rendrait jamais rien
    // -- et un `mismatch` sur registry_lookup, c'est-a-dire un dossier accuse a tort.
    for (const saisie of ['CHE-105.909.036', 'CHE 105 909 036', 'che-105.909.036', '  CHE105909036  ']) {
      const spy = stubLindas(NESTLE_BINDINGS)
      await runKybSource(zefixSource('registry_lookup'), agencyCH({ business_registration_number: saisie }))
      expect(sentSparql(spy), `saisie "${saisie}"`).toContain('schema:value "CHE105909036"')
      vi.unstubAllGlobals()
    }
  })

  // ── registry_lookup : le plafond du verdict ───────────────────────────────────

  it(
    'registry_lookup : UID present dans le graphe -> partial, JAMAIS match -- LINDAS ne publie pas le statut ' +
      'actif/radie, et poser match affirmerait « existe ET active » sur la moitie d une preuve',
    async () => {
      stubLindas(NESTLE_BINDINGS)
      const row = await runKybSource(zefixSource('registry_lookup'), agencyCH())
      expect(row.result).toBe('partial')
      expect(row.check_type).toBe('registry_lookup')
      expect(row.source).toBe('zefix')
      // La preuve doit dire au relecteur CE QUI MANQUE, pas seulement ce qui a ete trouve :
      // c'est un veto qui ne passera pas, et il doit pouvoir lire pourquoi sans ouvrir le code.
      expect(row.raw_response).toMatchObject({
        uid: 'CHE105909036',
        reason: 'existence_confirmed_status_not_published',
      })
    }
  )

  it(
    'registry_lookup : UID absent du graphe (bindings vides, le registre A repondu) -> mismatch, jamais unavailable',
    async () => {
      // Une liste VIDE est une information positive : le registre a cherche ce numero et ne
      // l'a pas. Meme motif que le 404 RDAP et le `results:[]` du registre francais.
      stubLindas([])
      const row = await runKybSource(zefixSource('registry_lookup'), agencyCH())
      expect(row.result).toBe('mismatch')
      expect(row.raw_response).toMatchObject({ reason: 'uid_not_found' })
    }
  )

  it(
    'registry_lookup ne vaut JAMAIS match, quelle que soit la reponse -- c est la propriete qui porte toute la tache',
    async () => {
      // Le jour ou les identifiants Zefix PublicREST arriveront, c'est CE check, et lui seul,
      // qui passera de `partial` a `match` : PublicREST apporte le statut que LINDAS n'a pas.
      // D'ici la, aucune reponse du graphe ne doit pouvoir produire un `match`.
      const reponses: Record<string, unknown>[][] = [
        [],
        [binding('Nestlé S.A.')],
        NESTLE_BINDINGS,
        [binding('Nestlé S.A.', 'Vevey'), binding('Nestlé S.A.', 'Vevey'), binding('Nestlé AG', 'Cham')],
      ]
      for (const bindings of reponses) {
        stubLindas(bindings)
        const row = await runKybSource(zefixSource('registry_lookup'), agencyCH())
        expect(row.result, `${bindings.length} entree(s)`).not.toBe('match')
        vi.unstubAllGlobals()
      }
    }
  )

  // ── registry_legal_name_match : toutes les raisons sociales INSCRITES, et elles seules ──

  it(
    'registry_legal_name_match : la raison sociale declaree correspond a la SECONDE entree rendue -> match ' +
      '(un double siege statutaire rend deux legalName, tous deux inscrits pour ce meme UID)',
    async () => {
      stubLindas(NESTLE_BINDINGS)
      const row = await runKybSource(zefixSource('registry_legal_name_match'), agencyCH({ legal_name: 'Nestlé S.A.' }))
      expect(row.result, 'les accepter toutes est juste : toutes sont inscrites au registre').toBe('match')
      expect(row.raw_response).toMatchObject({
        declared_legal_name: 'Nestlé S.A.',
        registry_legal_names: ['Nestlé AG', 'Nestlé S.A.'],
      })
    }
  )

  it('registry_legal_name_match : accents, casse et ponctuation restent toleres (normalizeLegalNameStrict)', async () => {
    for (const declaree of ['Nestlé S.A.', 'NESTLE SA', 'nestle s.a.', 'Nestlé AG', 'nestle ag']) {
      stubLindas(NESTLE_BINDINGS)
      const row = await runKybSource(zefixSource('registry_legal_name_match'), agencyCH({ legal_name: declaree }))
      expect(row.result, `raison sociale declaree "${declaree}"`).toBe('match')
      vi.unstubAllGlobals()
    }
  })

  it('registry_legal_name_match : raison sociale reellement differente -> mismatch', async () => {
    stubLindas(NESTLE_BINDINGS)
    const row = await runKybSource(zefixSource('registry_legal_name_match'), agencyCH({ legal_name: 'Regie du Lac SA' }))
    expect(row.result).toBe('mismatch')
  })

  it(
    'registry_legal_name_match : `schema:name` n est JAMAIS compare -- il porte des denominations qui ne sont ' +
      'pas la raison sociale, et les y meler fabriquerait des match sur autre chose que ce que le veto verifie',
    async () => {
      // Mesure en direct sur CHE105909036 : l'entree dont le legalName est « Nestlé AG »
      // porte en `schema:name` « Nestlé S.A. » ET « Nestlé Ltd. », c'est-a-dire les
      // denominations des AUTRES entrees. Un connecteur qui lirait `name` declarerait
      // identiques deux raisons sociales que le registre distingue.
      stubLindas([
        {
          legalName: { type: 'literal', value: 'Nestlé AG' },
          name: { type: 'literal', value: 'Regie du Lac SA' },
        },
      ])
      const row = await runKybSource(zefixSource('registry_legal_name_match'), agencyCH({ legal_name: 'Regie du Lac SA' }))
      expect(row.result, 'seul schema:legalName fait foi').toBe('mismatch')
    }
  )

  it('registry_legal_name_match : UID absent du graphe -> unavailable (rien a comparer), jamais mismatch', async () => {
    // Le constat d'absence est deja porte par registry_lookup, pour son propre check_type :
    // rien a dupliquer ici sur une donnee qui, elle, n'existe simplement pas.
    stubLindas([])
    const row = await runKybSource(zefixSource('registry_legal_name_match'), agencyCH())
    expect(row.result).toBe('unavailable')
  })

  it('registry_legal_name_match : aucune raison sociale declaree -> unavailable, jamais un appel reseau', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    for (const declaree of [null, '', '   ']) {
      const row = await runKybSource(zefixSource('registry_legal_name_match'), agencyCH({ legal_name: declaree }))
      expect(row.result, `legal_name ${JSON.stringify(declaree)}`).toBe('unavailable')
    }
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it(
    'registry_legal_name_match : raison sociale declaree faite de seule ponctuation -> unavailable, jamais un ' +
      'appel reseau (revue finale de branche, point 1 : meme remede que le registre francais)',
    async () => {
      // Ce cote-ci de la comparaison n'etait garde par AUCUN des deux connecteurs. Cote
      // suisse, il ne pouvait pas produire de `match` -- mais par une propriete des DONNEES,
      // pas par une garde : 0 raison sociale du graphe Zefix ne se reduit a vide (mesure en
      // direct le 29.07.2026, FILTER sans lettre ni chiffre sur les 791 071 entrees). Une
      // barriere accidentelle n'est pas une garde ; les deux connecteurs levent desormais.
      const fetchSpy = vi.fn(async () => lindasResponse(NESTLE_BINDINGS))
      vi.stubGlobal('fetch', fetchSpy)
      for (const declaree of ['-', '.', '&', '@@@']) {
        const row = await runKybSource(zefixSource('registry_legal_name_match'), agencyCH({ legal_name: declaree }))
        expect(row.result, `legal_name ${JSON.stringify(declaree)}`).toBe('unavailable')
      }
      expect(fetchSpy).not.toHaveBeenCalled()
    }
  )

  // ── registry_country_match : l inscription au registre suisse ─────────────────

  it(
    'registry_country_match : UID trouve dans le graphe Zefix -> match, l entite est inscrite au registre suisse',
    async () => {
      // L'arbitrage est l'INVERSE de celui du connecteur francais, et c'est delibere (voir
      // sa section dans _shared/kyb-sources.ts) : trouver le numero declare dans le registre
      // de la juridiction declaree distingue reellement « cette entite est enregistree en
      // Suisse » de « cette agence pretend etre suisse ».
      stubLindas(NESTLE_BINDINGS)
      const row = await runKybSource(zefixSource('registry_country_match'), agencyCH())
      expect(row.result).toBe('match')
      expect(row.raw_response).toMatchObject({ uid: 'CHE105909036', registry_country: 'CH' })
    }
  )

  it('registry_country_match : UID absent du graphe -> unavailable (rien a opposer au pays declare)', async () => {
    stubLindas([])
    const row = await runKybSource(zefixSource('registry_country_match'), agencyCH())
    expect(row.result).toBe('unavailable')
  })

  // ── Juridiction et exclusivite ────────────────────────────────────────────────

  it('juridiction : les trois sources s appliquent a CH, a aucun autre pays, ni a un pays absent', () => {
    for (const checkType of ZEFIX_CHECK_TYPES) {
      const source = zefixSource(checkType)
      expect(source.appliesTo, `${checkType} doit declarer sa juridiction`).toBeDefined()
      expect(source.appliesTo!(agencyCH()), `${checkType} / CH`).toBe(true)
      // Minuscules et blancs : agencies.country est du texte libre cote base.
      expect(source.appliesTo!(agencyCH({ country: '  ch  ' })), `${checkType} / "  ch  "`).toBe(true)
      // Le Liechtenstein est EXCLU bien qu'il partage le systeme UID : son registre du
      // commerce est `oera.li`, absent de LINDAS.
      for (const country of ['FR', 'LI', 'DE', null]) {
        expect(source.appliesTo!(agencyCH({ country })), `${checkType} / ${country ?? 'non declare'}`).toBe(false)
      }
    }
  })

  it(
    'exclusivite avec le registre francais : aucun des TROIS check_type de ce connecteur n est jamais ' +
      'revendique par zefix ET recherche_entreprises pour le meme siege',
    () => {
      // Le point de rupture que toute la regle de juridiction (etape 6, tache 1) existe pour
      // rendre impossible : le moteur (20260729151200) ne garde qu'UNE ligne par check_type
      // et departage deux lignes de la meme transaction par ctid, donc par ordre
      // d'insertion. Deux proprietaires applicables au meme dossier, et la derniere ligne
      // inseree masquerait l'autre verdict -- un veto dependrait alors de l'ordre du tableau.
      //
      // Les TROIS types sont desormais partages, registry_country_match compris (tache 3
      // du chantier LINDAS, qui lui donne un proprietaire francais) : la boucle derive donc
      // de ZEFIX_CHECK_TYPES au lieu d'enumerer, pour qu'un quatrieme type revendique par
      // ce connecteur entre ici tout seul.
      for (const country of ['CH', 'FR', 'LI', 'DE', null]) {
        const { applicable } = selectApplicableSources({ ...FAKE_AGENCY, country }, fullKybRegistry())
        for (const checkType of ZEFIX_CHECK_TYPES) {
          const owners = applicable.filter((s) => s.checkType === checkType).map((s) => s.source)
          expect(owners.length, `pays ${country ?? 'non declare'} : ${checkType} revendique par ${owners.join(' + ')}`)
            .toBeLessThanOrEqual(1)
        }
      }
    }
  )

  it(
    'les trois sources interrogent le meme point d API sans se coordonner : un appel chacune, couplage assume',
    async () => {
      // Meme arbitrage que le registre francais (deux entrees, deux appels) : une
      // KybSourceResult ne porte qu'UN check_type, il faut donc une source par type. Le
      // cout est une poignee d'appels par verification, jamais par seconde.
      const spy = stubLindas(NESTLE_BINDINGS)
      const rows = await runAgencyKybSources(
        agencyCH(),
        ZEFIX_CHECK_TYPES.map((t) => zefixSource(t))
      )
      expect(rows).toHaveLength(3)
      expect(spy).toHaveBeenCalledTimes(3)
      expect(rows.map((r) => `${r.check_type}=${r.result}`).sort()).toEqual(
        ['registry_country_match=match', 'registry_legal_name_match=match', 'registry_lookup=partial'].sort()
      )
    }
  )
})

// ─── Squelette du registre UID (vat_lookup CH/LI, etape 6 tache 3) ─────────────
//
// Le SEUL squelette qui reste dans ce fichier, et LINDAS n'y change rien : le graphe Zefix
// ne publie pas la TVA. Ce que ce volet verrouille est donc inchange par le chantier
// LINDAS -- cablage, gestion d'erreur, juridiction -- et son statut reste distinct de celui
// de Zefix. Zefix PublicREST a REPONDU `401 Unauthorized` : on sait qu'il existe et qu'il
// attend une authentification, il ne manque qu'un identifiant (et c'est le STATUT ACTIF
// qu'il apporterait, la seule chose que LINDAS ne donne pas). Le registre UID
// (uid.admin.ch) n'a JAMAIS ete teste en API, et la question posee par la doc de conception
// §3 -- « API separee ou champ Zefix ? » -- n'est pas tranchee : il manque ici une reponse
// sur CE QU'ON DOIT APPELER, pas seulement de quoi s'y authentifier.
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
    'la preuve nomme CE QUI MANQUE AU JUSTE : un relecteur de la file admin doit lire « registre UID, acces ' +
      'non etabli », jamais un unavailable nu ni un « en attente d identifiants » a moitie faux',
    async () => {
      // Ce test comparait jusqu'ici le message du registre UID a celui de Zefix, pour
      // prouver que deux `unavailable` partageant la MEME erreur restaient distinguables. Ce
      // contraste a disparu avec le squelette Zefix (chantier LINDAS, tache 2) : ce squelette
      // est desormais le seul, et l'erreur ne porte donc plus a confusion. Ce qui reste vrai,
      // et vaut d'etre tenu, c'est que `error_type` seul ne dit PAS ce qu'on attend -- le
      // libelle doit le dire, et c'est lui que lit un humain.
      vi.stubGlobal('fetch', vi.fn())
      const uidRow = await runKybSource(uidSource(UID_REGISTER_PENDING_CONFIG), agencyIn('CH'))

      const message = String(uidRow.raw_response.message)
      expect(message).toContain('registre UID')
      expect(message, "« acces non etabli » n'est pas « en attente d'identifiants »").toContain('acces non etabli')
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
    'la ligne vat_lookup du registre UID est `unavailable`, jamais un verdict fabrique -- et elle prend la ' +
      'place d un `unavailable` (le connecteur VIES levait deja sur une TVA a prefixe CHE avant l etape 6)',
    async () => {
      // Ce que ce test prouve, et RIEN DE PLUS (revue finale etape 6) : la forme de la
      // ligne. Son intitule pretendait avant « aucun verdict ne bouge » sans jamais
      // comparer un score -- l'egalite des verdicts se mesure contre le vrai moteur, et
      // c'est le test de non-regression du volet 2 qui la mesure, chiffres a l'appui.
      // La nuance qui distingue cette source des trois de Zefix reste vraie et vaut d'etre
      // dite : les lignes Zefix sont des VETOS, neutres parce que le moteur fait echouer un
      // veto `unavailable` exactement comme un veto absent ; vat_lookup porte weight 3.00 /
      // is_veto false (20260728103000) et n'est neutre que parce que `unavailable` sort du
      // numerateur ET du denominateur. Meme conclusion, deux mecanismes.
      vi.stubGlobal('fetch', vi.fn())
      const rows = await runAgencyKybSources(agencyIn('CH'), createUidRegisterSources(UID_REGISTER_PENDING_CONFIG))
      expect(rows).toHaveLength(1)
      expect(rows[0].result, 'jamais match, jamais partial, jamais mismatch').toBe('unavailable')
    }
  )

  // ─── Qui possede vat_lookup : le prefixe declare, pas le seul pays du siege
  //     (revue finale etape 6) ────────────────────────────────────────────────────
  //
  // agencies.tva est du TEXTE LIBRE (ni StepAgence.tsx ni la base ne verifient que le
  // prefixe s'accorde avec le pays du siege). Departager les deux proprietaires de
  // vat_lookup sur le seul pays du siege ecartait donc VIES d'un dossier CH declarant une
  // TVA a prefixe UE -- un dossier sur lequel elle avait pourtant un verdict a rendre, et
  // le rendait avant l'etape 6. Les deux tests qui suivent verrouillent le departage ;
  // c'est le volet 2 qui en mesure la consequence sur le verdict.

  /** TVA a prefixe UE et numero invalide -- exactement le dossier du scenario : VIES
   *  reconnait le prefixe, interroge son service, et repond `valid:false`. */
  const EU_PREFIXED_INVALID_TVA = 'FR00000000000'
  const SWISS_TVA = 'CHE-123.456.789'

  function vatLookupOwners(country: string | null, tva: string | null): string[] {
    const { applicable } = selectApplicableSources({ ...FAKE_AGENCY, country, tva }, fullKybRegistry())
    return applicable.filter((s) => s.checkType === 'vat_lookup').map((s) => s.source)
  }

  it(
    'proprietaire de vat_lookup selon (siege, prefixe declare) : au plus un a chaque fois, et jamais ZERO ' +
      'la ou le code d avant l etape 6 rendait un verdict',
    () => {
      // Les dix combinaisons de la revue, et pour chacune ce que produisait le code
      // d'avant l'etape 6 (36f90582 : vatLookupSource sans aucun appliesTo, donc VIES
      // interrogee pour TOUT siege). `owners` vide est acceptable UNIQUEMENT la ou VIES
      // levait d'elle-meme -- sa ligne valait alors `unavailable`, que le moteur traite
      // exactement comme la ligne absente. Partout ou elle rendait un VERDICT, un
      // proprietaire doit rester, et ce doit etre VIES.
      const matrix: { country: string | null; tva: string | null; owners: string[]; avant: string }[] = [
        { country: 'CH', tva: EU_PREFIXED_INVALID_TVA, owners: ['vies'], avant: 'VIES repondait : mismatch' },
        { country: 'CH', tva: SWISS_TVA, owners: ['uid_register'], avant: 'VIES levait : unavailable' },
        { country: 'CH', tva: null, owners: ['uid_register'], avant: 'VIES levait : unavailable' },
        { country: 'FR', tva: EU_PREFIXED_INVALID_TVA, owners: ['vies'], avant: 'VIES repondait : mismatch' },
        { country: 'FR', tva: SWISS_TVA, owners: ['vies'], avant: 'VIES levait : unavailable' },
        { country: 'FR', tva: null, owners: ['vies'], avant: 'VIES levait : unavailable' },
        { country: 'DE', tva: null, owners: ['vies'], avant: 'VIES levait : unavailable' },
        { country: 'DE', tva: 'DE123456789', owners: ['vies'], avant: 'VIES repondait' },
        // Pays absent : le seul des dix cas ou la ligne change de FORME. Sans prefixe
        // couvert, plus personne n'ecrit rien (avant : `unavailable`) -- meme portee pour
        // le moteur. Avec un prefixe couvert, VIES reste proprietaire et rend son verdict.
        { country: null, tva: null, owners: [], avant: 'VIES levait : unavailable' },
        { country: null, tva: EU_PREFIXED_INVALID_TVA, owners: ['vies'], avant: 'VIES repondait : mismatch' },
      ]

      for (const row of matrix) {
        expect(
          vatLookupOwners(row.country, row.tva),
          `siege=${row.country ?? 'absent'} tva=${row.tva ?? 'absente'} (avant l etape 6 : ${row.avant})`
        ).toEqual(row.owners)
      }
    }
  )

  it(
    'siege CH declarant une TVA a prefixe UE : VIES est bien interrogee et rend le meme mismatch qu avant ' +
      'l etape 6, jamais un unavailable qui retirerait du dossier son seul signal defavorable',
    async () => {
      const agency: AgencyForVerification = { ...FAKE_AGENCY, country: 'CH', tva: EU_PREFIXED_INVALID_TVA }
      const { applicable } = selectApplicableSources(agency, fullKybRegistry())
      const vatSources = applicable.filter((s) => s.checkType === 'vat_lookup')
      expect(vatSources.map((s) => s.source), 'le prefixe declare designe VIES, pas le registre UID').toEqual(['vies'])

      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify({ valid: false }), { status: 200 }))
      )
      const rows = await runAgencyKybSources(agency, vatSources)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ check_type: 'vat_lookup', source: 'vies', result: 'mismatch' })
    }
  )
})

// ─── Controle du numero de registre (registry_number_format) -- chantier LINDAS,
//     tache 1 : volet 10 ──────────────────────────────────────────────────────────
//
// Hors du describe.skipIf(!HAS_KEYS), meme motif que les volets de connecteurs qui
// precedent -- et ici la raison est plus forte encore : ce connecteur ne touche AUCUN
// reseau, pas meme stubbe. C'est un calcul, et un calcul de conformite doit pouvoir se
// verifier sans rien demarrer.
//
// Les numeros ci-dessous sont REELS et FIGES. Reels parce qu'une cle de controle se juge
// sur ce que les registres emettent vraiment, jamais sur des numeros fabriques qui
// pourraient partager un biais avec l'algorithme teste ; figes parce qu'un test qui
// appellerait LINDAS ou recherche-entreprises dependrait de la sante d'un service tiers
// (meme discipline que les quatre volets precedents). La reconnaissance qui les a
// produits, elle, a bien interroge les vrais services -- voir .superpowers/sdd/task-1-report.md :
// 200 UID tires de LINDAS (200 valides, 0 rejete a tort) et 15 SIREN tires de
// recherche-entreprises (15 valides), plus 17 415 alterations d'un chiffre, toutes
// rejetees. Ce volet en garde un echantillon suffisant pour mordre en cas de regression.
describe('controle du numero de registre (registry_number_format) -- calcul pur, aucun reseau', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** UID suisses reels, tires du graphe Zefix de LINDAS (schema:value "CHE105909036",
   *  sans separateurs -- c'est la forme que le registre publie). CHE105909036 est celui
   *  de Nestle, mesure a la main lors de la conception du chantier. */
  const REAL_SWISS_UIDS = [
    'CHE105909036',
    'CHE105840918',
    'CHE105832037',
    'CHE105833663',
    'CHE103247810',
    'CHE105814683',
    'CHE106369697',
    'CHE101682164',
    'CHE102748297',
    'CHE106946703',
    'CHE103814732',
    'CHE102475946',
    'CHE101926797',
    'CHE102403680',
    'CHE101892069',
    'CHE102445336',
  ]

  /** SIREN reels, tires de recherche-entreprises.api.gouv.fr. Les cinq derniers sont des
   *  reseaux immobiliers (Foncia, Nexity, Century 21, Guy Hoquet, Orpi) : c'est le marche
   *  que ce check verra vraiment. 356000000 est celui de La Poste, contre-exemple classique
   *  du SIREN qui « ne passerait pas Luhn » -- verifie en direct, il le PASSE : l'exception
   *  francaise porte sur le SIRET des etablissements, jamais sur le SIREN. */
  const REAL_FRENCH_SIRENS = [
    '356000000',
    '632012100',
    '106731474',
    '510761505',
    '380129866',
    '982770919',
    '424622884',
    '552032534',
    '306138900',
    '552049447',
    '890441223',
    '444346795',
    '339510695',
    '432945525',
    '301857041',
  ]

  function agencyWithNumber(country: string | null, businessRegistrationNumber: string | null): AgencyForVerification {
    return { ...FAKE_AGENCY, country, business_registration_number: businessRegistrationNumber }
  }

  /** Toutes les alterations d'UN chiffre d'un numero : les 9 positions x les 9
   *  substitutions possibles. Une cle de controle qui laisserait passer l'une d'elles ne
   *  servirait a rien -- c'est exactement la faute de frappe qu'elle existe pour attraper. */
  function singleDigitAlterations(digits: string): string[] {
    const out: string[] = []
    for (let i = 0; i < digits.length; i++) {
      for (const replacement of '0123456789') {
        if (replacement === digits[i]) continue
        out.push(digits.slice(0, i) + replacement + digits.slice(i + 1))
      }
    }
    return out
  }

  it('la source est enregistree telle quelle, sans juridiction declaree et sans fabrique', () => {
    expect(registryNumberFormatSource.checkType).toBe('registry_number_format')
    // `internal` et jamais `manual` : `manual` designe une saisie HUMAINE, et un relecteur
    // qui lirait `manual` sur un check calcule croirait qu'un humain l'a pose -- sur une
    // piste d'audit LAB, c'est un contresens. La valeur est admise par la contrainte CHECK
    // de agency_verification_checks.source depuis la migration de cette tache.
    expect(registryNumberFormatSource.source).toBe('internal')
    // AUCUNE juridiction declaree, et c'est un choix (voir JURISDICTION_MATRIX plus haut) :
    // seul proprietaire de son check_type, ce connecteur n'a rien a departager, et
    // l'ecarter d'un pays qu'il ne sait pas lire supprimerait la ligne `unavailable` qui
    // dit POURQUOI le veto n'est pas satisfait.
    expect(registryNumberFormatSource.appliesTo).toBeUndefined()
  })

  it('les UID suisses reels valent match, sans un seul appel reseau', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    for (const uid of REAL_SWISS_UIDS) {
      const row = await runKybSource(registryNumberFormatSource, agencyWithNumber('CH', uid))
      expect(row.result, `${uid} est un UID reel du registre du commerce suisse`).toBe('match')
      expect(row.check_type).toBe('registry_number_format')
      expect(row.source).toBe('internal')
    }
    expect(fetchSpy, 'ce connecteur est un calcul : il ne sort jamais du processus').not.toHaveBeenCalled()
  })

  it('les SIREN francais reels valent match, La Poste (356000000) comprise', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    for (const siren of REAL_FRENCH_SIRENS) {
      const row = await runKybSource(registryNumberFormatSource, agencyWithNumber('FR', siren))
      expect(row.result, `${siren} est un SIREN reel`).toBe('match')
    }
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('aucune alteration d un seul chiffre ne passe la cle de controle suisse (16 UID x 81 alterations)', () => {
    let tested = 0
    for (const uid of REAL_SWISS_UIDS) {
      for (const altered of singleDigitAlterations(uid.slice(3))) {
        tested++
        expect(isValidSwissUid(`CHE${altered}`), `CHE${altered} derive de ${uid} par un seul chiffre`).toBe(false)
      }
    }
    expect(tested, 'la boucle doit vraiment avoir teste les 9 positions x 9 substitutions').toBe(
      REAL_SWISS_UIDS.length * 81
    )
  })

  it('aucune alteration d un seul chiffre ne passe Luhn (15 SIREN x 81 alterations)', () => {
    let tested = 0
    for (const siren of REAL_FRENCH_SIRENS) {
      for (const altered of singleDigitAlterations(siren)) {
        tested++
        expect(isValidFrenchSiren(altered), `${altered} derive de ${siren} par un seul chiffre`).toBe(false)
      }
    }
    expect(tested).toBe(REAL_FRENCH_SIRENS.length * 81)
  })

  it('un numero altere passe par le connecteur vaut mismatch -- la source A conclu, ce n est pas une indisponibilite', async () => {
    vi.stubGlobal('fetch', vi.fn())
    // CHE105909036 avec son dernier chiffre change : la forme reste parfaitement lisible,
    // seule la cle ne tombe pas. C'est le SEUL cas ou ce connecteur pose un `mismatch`.
    const row = await runKybSource(registryNumberFormatSource, agencyWithNumber('CH', 'CHE-105.909.037'))
    expect(row.result).toBe('mismatch')
    const siren = await runKybSource(registryNumberFormatSource, agencyWithNumber('FR', '403265452'))
    expect(siren.result, '403265452 est un SIREN fabrique -- forme valide, cle fausse').toBe('mismatch')
  })

  it('les separateurs de saisie sont retires avant calcul : CHE-105.909.036 vaut CHE105909036', async () => {
    vi.stubGlobal('fetch', vi.fn())
    // La saisie humaine porte la forme d'affichage officielle ; le registre, lui, publie
    // le numero nu. Les deux doivent conclure a l'identique, casse comprise.
    for (const saisie of ['CHE-105.909.036', 'CHE 105 909 036', 'che-105.909.036', '  CHE105909036  ']) {
      const row = await runKybSource(registryNumberFormatSource, agencyWithNumber('CH', saisie))
      expect(row.result, `saisie "${saisie}"`).toBe('match')
    }
    for (const saisie of ['510 761 505', '510.761.505', '510-761-505']) {
      const row = await runKybSource(registryNumberFormatSource, agencyWithNumber('FR', saisie))
      expect(row.result, `saisie "${saisie}"`).toBe('match')
    }
  })

  it('un CHE mal forme leve -> unavailable, jamais mismatch : ne pas savoir lire un numero n est pas constater qu il est faux', async () => {
    vi.stubGlobal('fetch', vi.fn())
    // Trop court, trop long, prefixe tronque, prefixe absent, lettres au milieu : aucune
    // de ces saisies ne se LIT comme un UID -- et ce check est un VETO, qui bloque un
    // dossier. Un `mismatch` affirmerait que le numero est faux ; on n'en sait rien.
    for (const saisie of ['CHE-12.34', 'CHE1059090366', 'CH105909036', '105909036X', 'CHE10590903A']) {
      const row = await runKybSource(registryNumberFormatSource, agencyWithNumber('CH', saisie))
      expect(row.result, `saisie "${saisie}"`).toBe('unavailable')
      expect(row.raw_response.reason).toBe('error')
    }
  })

  it('numero absent ou blanc -> unavailable, jamais mismatch', async () => {
    vi.stubGlobal('fetch', vi.fn())
    for (const saisie of [null, '', '   ']) {
      for (const pays of ['CH', 'FR']) {
        const row = await runKybSource(registryNumberFormatSource, agencyWithNumber(pays, saisie))
        expect(row.result, `pays ${pays}, saisie ${JSON.stringify(saisie)}`).toBe('unavailable')
      }
    }
  })

  it('pays non couvert -> unavailable, et la preuve nomme le pays : une ligne, jamais un silence', async () => {
    vi.stubGlobal('fetch', vi.fn())
    // La source n'est PAS ecartee pour autant (voir le premier test de ce volet) : elle
    // ecrit une ligne qui dit au relecteur que ce veto reste sans reponse parce que la
    // juridiction n'est pas couverte, et non parce que le numero serait faux.
    const row = await runKybSource(registryNumberFormatSource, agencyWithNumber('DE', 'HRB 12345'))
    expect(row.result).toBe('unavailable')
    expect(String(row.raw_response.message)).toContain('DE')
    for (const pays of ['LI', 'IT', null]) {
      const autre = await runKybSource(registryNumberFormatSource, agencyWithNumber(pays, '510761505'))
      expect(autre.result, `pays ${pays ?? 'non declare'}`).toBe('unavailable')
    }
  })

  it('le pays declare est lu apres trim et passage en majuscules, comme partout ailleurs dans le module', async () => {
    vi.stubGlobal('fetch', vi.fn())
    expect((await runKybSource(registryNumberFormatSource, agencyWithNumber('  ch  ', 'CHE105909036'))).result).toBe(
      'match'
    )
    expect((await runKybSource(registryNumberFormatSource, agencyWithNumber('fr', '510761505'))).result).toBe('match')
  })

  it('un numero de la mauvaise juridiction leve -> unavailable, jamais mismatch', async () => {
    vi.stubGlobal('fetch', vi.fn())
    // Un SIREN sur un dossier suisse, un UID sur un dossier francais : dans les deux cas le
    // numero est parfaitement valide AILLEURS. Ce n'est donc pas « faux », c'est illisible
    // ici -- et la concordance entre le pays declare et le registre est le travail d'un
    // AUTRE veto (registry_country_match), jamais de celui-ci.
    const suisse = await runKybSource(registryNumberFormatSource, agencyWithNumber('CH', '510761505'))
    expect(suisse.result).toBe('unavailable')
    const francais = await runKybSource(registryNumberFormatSource, agencyWithNumber('FR', 'CHE105909036'))
    expect(francais.result).toBe('unavailable')
  })

  it('un SIRET (14 chiffres) leve -> unavailable : ce check porte sur le SIREN, pas sur l etablissement', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const row = await runKybSource(registryNumberFormatSource, agencyWithNumber('FR', '35600000000048'))
    expect(row.result).toBe('unavailable')
  })

  it('un reste de 1 (cle qui vaudrait 10) rend le numero invalide, quel que soit le dernier chiffre', () => {
    // 10000016 pese 34 (1x5 + 1x5 + 6x4), soit un reste de 1 modulo 11 : la cle vaudrait
    // 10, qui ne tient pas sur un chiffre. Le registre n'emet donc jamais un tel numero,
    // et AUCUN dernier chiffre ne peut le valider. C'est le seul cas d'entree qu'un jeu
    // de numeros reels ne peut pas contenir -- mais ce n'est PAS une branche de code
    // distincte : le rejet vient de la comparaison finale, une cle de 10 ne pouvant
    // egaler un chiffre. Voir isValidSwissUid, ou la garde explicite ne fait que dire la
    // regle (revue : elle est morte, et ce test-ci ne la couvre pas -- il couvre le
    // comportement, qui est le sujet).
    for (const dernier of '0123456789') {
      expect(isValidSwissUid(`CHE10000016${dernier}`), `CHE10000016${dernier}`).toBe(false)
    }
    // Le temoin de la branche voisine : un reste de 0 donne une cle de 0 (« 11 vaut 0 »).
    // 10000007 pese 33 (1x5 + 7x4), soit un reste de 0 : le dernier chiffre doit valoir 0.
    // Contrairement au cas ci-dessus, celui-la EST exerce par de vrais numeros -- deux
    // des seize UID reels figes plus haut y tombent (CHE103247810 pese 132, CHE102403680
    // pese 99, tous deux multiples de 11).
    expect(isValidSwissUid('CHE100000070'), 'somme 33, reste 0 -> cle 0').toBe(true)
    expect(isValidSwissUid('CHE100000071'), 'la meme, cle 1 : le reste de 0 ne vaut PAS 11').toBe(false)
  })

  it('isValidSwissUid et isValidFrenchSiren refusent tout ce qui n a pas la forme attendue, sans jamais lever', () => {
    // Ces deux fonctions sont exportees parce qu'un calcul de conformite doit pouvoir se
    // verifier isolement. Elles rendent `false` sur une forme illisible ; c'est le
    // CONNECTEUR, lui, qui distingue « illisible » (leve -> unavailable) de « cle fausse »
    // (mismatch) -- les deux tests precedents le verifient.
    for (const illisible of ['', '   ', 'CHE', 'CHE12345678', 'CHE1234567890', 'ABC105909036', 'CHE-105.909.03']) {
      expect(isValidSwissUid(illisible), `isValidSwissUid(${JSON.stringify(illisible)})`).toBe(false)
    }
    for (const illisible of ['', '   ', '12345678', '1234567890', 'FR510761505', '510761505X']) {
      expect(isValidFrenchSiren(illisible), `isValidFrenchSiren(${JSON.stringify(illisible)})`).toBe(false)
    }
  })

  it('un verdict calcule joint toujours sa preuve : numero declare, numero normalise et juridiction retenue', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const row = await runKybSource(registryNumberFormatSource, agencyWithNumber('CH', 'CHE-105.909.036'))
    expect(row.result).toBe('match')
    // Un verdict sans preuve jointe ne doit pas pouvoir s'ecrire (revue etape 4/tache 1,
    // point 1) -- et sur un check CALCULE, la preuve est le calcul lui-meme : ce qui a ete
    // lu, ce qui en a ete fait, et sous quelle juridiction.
    expect(row.raw_response).toMatchObject({
      declared: 'CHE-105.909.036',
      normalized: 'CHE105909036',
      jurisdiction: 'CH',
    })
    const francais = await runKybSource(registryNumberFormatSource, agencyWithNumber('FR', '510 761 505'))
    expect(francais.raw_response).toMatchObject({
      declared: '510 761 505',
      normalized: '510761505',
      jurisdiction: 'FR',
    })
  })

  it('exclusivite : registry_number_format n a qu un proprietaire, quel que soit le pays du siege', () => {
    // Le troisieme point de la regle de juridiction (etape 6, tache 1) applique a ce
    // check_type : deux sources applicables au meme siege pour un meme type feraient
    // dependre un VETO de l'ordre d'insertion. Un seul pretendant aujourd'hui -- ce test
    // mord le jour ou un second apparaitrait sans qu'on ait pense a les departager.
    for (const country of ['CH', 'FR', 'LI', 'DE', null]) {
      const { applicable } = selectApplicableSources({ ...FAKE_AGENCY, country }, fullKybRegistry())
      expect(
        applicable.filter((s) => s.checkType === 'registry_number_format').map((s) => s.source),
        `pays ${country ?? 'non declare'}`
      ).toEqual(['internal'])
    }
  })
})
