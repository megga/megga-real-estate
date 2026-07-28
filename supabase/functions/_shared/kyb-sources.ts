// supabase/functions/_shared/kyb-sources.ts
//
// Connecteurs de verification KYB (etape 4 de l'onboarding agence). Ce module posait
// a la tache 1 le contrat que chaque connecteur (RDAP, VIES, recherche-entreprises,
// Mapbox) doit respecter, et le harnais qui impose la regle qui gouverne toute
// l'etape. La tache 2 y ajoute le premier connecteur reel -- RDAP (domain_whois_age,
// plus bas) ; VIES/recherche-entreprises/Mapbox suivent a la tache 3.
//
//   Une source qui ne repond pas produit un check `unavailable`, JAMAIS une
//   absence de ligne et JAMAIS un echec. Le moteur (recompute_agency_verification,
//   20260728130000) exclut `unavailable` du numerateur ET du denominateur -- un
//   pays sans source disponible n'est donc pas penalise, seulement moins confirme.
//
// Corollaire : ne jamais inventer un resultat par defaut. Un `match` pose faute de
// reponse serait une preuve fabriquee par le systeme lui-meme -- voir
// docs/superpowers/plans/2026-07-28-onboarding-kyb-etape-4.md.
//
// Meme corollaire applique a la preuve elle-meme (revue etape 4/tache 1, point 1) :
// raw_response est OBLIGATOIRE dans KybSourceResult, jamais optionnel. Sur un
// dispositif dont toute la valeur repose sur la preuve, un verdict sans preuve jointe
// ne doit pas pouvoir s'ecrire -- le type contraignait jusqu'ici la FORME du resultat,
// jamais son honnetete. L'indisponibilite joint desormais sa propre preuve : la raison
// de l'echec (type d'erreur, message, code de statut si connu), jamais un secret ni un
// en-tete d'authentification (voir describeSourceFailure plus bas).
//
// runKybSource() est le SEUL point qui doit jamais lever ou pendre indefiniment :
// un connecteur ecrit ici peut lever, timeouter, renvoyer n'importe quoi --
// runKybSource() absorbe tout et rend TOUJOURS une ligne exploitable.
// AGENCY_KYB_SOURCES etait vide a la tache 1 par construction (brief tache 1,
// "Tu n'ecris aucun connecteur reel dans cette tache"). La tache 2 y ajoute RDAP ; la
// tache 3 y ajoutera VIES/recherche-entreprises/Mapbox -- sans jamais avoir a
// toucher a agency-verification-run/index.ts ni a reimplementer la gestion
// d'erreur/timeout : c'est precisement ce que ce registre permet.
//
// Module pur : aucun import, aucun Deno.env.get. Importable tel quel depuis un
// test Node/vitest (meme motif que whatsapp-tools.ts, importe sans extension par
// whatsapp-antifab.spec.ts).

/** Enumeration exacte de agency_verification_checks.result /
 *  agency_person_verification_checks.result (CHECK constraint, migration
 *  20260728103000). Toute autre valeur ferait echouer l'insert. */
export type KybCheckResult = 'match' | 'partial' | 'mismatch' | 'unavailable' | 'pending_manual_review'

/** Sous-ensemble des colonnes `agencies` utile a un connecteur ENTITE. Etendu au
 *  fil des taches suivantes -- jamais la ligne complete (un connecteur n'a besoin
 *  ni de stripe_customer_id, ni de monthly_target). */
export interface AgencyForVerification {
  id: string
  legal_name: string | null
  trade_name: string | null
  business_registration_number: string | null
  country: string | null
  canton: string | null
  city: string | null
  postal_code: string | null
  address: string | null
  website: string | null
  tva: string | null
}

/** Ce qu'un connecteur produit pour SON check -- jamais `unavailable` par choix :
 *  c'est runKybSource() qui le fait a sa place quand `run` echoue ou expire.
 *  raw_response est OBLIGATOIRE (revue etape 4/tache 1, point 1), jamais `null` : un
 *  connecteur qui pose un `match` doit montrer ce sur quoi il se fonde, pour qu'un
 *  relecteur puisse le verifier apres coup. Avant ce correctif, raw_response etait
 *  facultatif -- un connecteur bogue (par exemple un `catch` interne mal ecrit sur une
 *  reponse ambigue) pouvait produire un `match` SANS aucune piece d'audit derriere ;
 *  le type contraignait la forme du resultat, jamais son honnetete. */
export interface KybSourceResult {
  result: KybCheckResult
  raw_response: Record<string, unknown>
  /** Ecrase, pour CETTE execution seulement, le check_type declare par le KybSource
   *  qui enregistre ce connecteur (source.checkType plus bas). Reserve au cas ou UN
   *  MEME connecteur peut, selon ce qu'il observe, ecrire sous plus d'un type du
   *  catalogue (revue etape 4/tache 2, point 2) : le connecteur RDAP est enregistre
   *  sous `domain_whois_age`, mais le cas fournisseur grand public (plus bas) doit
   *  produire un check `domain_generic_provider` -- un type distinct du catalogue
   *  (verification_check_types/verification_check_config, migration 20260728103000),
   *  avec son propre poids (1.00 contre 0.75). Plier les deux dans un seul type
   *  laisserait l'autre ligne de configuration morte et ferait porter a un type deux
   *  signaux que le schema distingue deliberement. Absent -> runKybSource() retombe
   *  sur source.checkType ; comportement inchange pour tout connecteur qui n'ecrit
   *  jamais que sous un seul type (le cas courant). */
  check_type?: string
}

/** Une ligne prete a inserer dans agency_verification_checks (moins agency_id,
 *  ajoute par l'appelant -- agency-verification-run/index.ts). Pas de `checked_at`
 *  ici : la colonne a une valeur par defaut (now(), l'heure de DEBUT de
 *  transaction) et rien dans ce module ne doit pretendre ordonner deux lignes du
 *  meme type mieux que le moteur ne le fait deja par ctid -- lire l'en-tete de
 *  recompute_agency_verification (20260728130000) avant d'y toucher. raw_response
 *  n'est jamais `null` ici (revue point 1) : runKybSource() fournit soit le
 *  raw_response du connecteur (obligatoire, voir KybSourceResult), soit la preuve de
 *  l'echec quand la source plante ou expire -- jamais un troisieme cas ou une valeur
 *  absente. check_type vaut le plus souvent source.checkType (le KybSource
 *  enregistrant le connecteur), sauf si le connecteur l'a explicitement ecrase via
 *  KybSourceResult.check_type (revue etape 4/tache 2, point 2). */
export interface AgencyCheckRow {
  check_type: string
  source: string
  result: KybCheckResult
  raw_response: Record<string, unknown>
}

/** Le contrat que chaque connecteur reel implementera (taches 2 et 3). `run` PEUT
 *  lever ou ne jamais se resoudre -- c'est meme l'usage attendu pour un reseau qui
 *  repond mal. `signal` permet a un connecteur fonde sur fetch() d'annuler sa
 *  requete sous-jacente quand runKybSource() atteint son timeout (hygiene
 *  ressources, meme discipline que kyc-screening) ; un connecteur qui l'ignore
 *  reste couvert par le timeout externe (voir runKybSource). */
export interface KybSource {
  checkType: string
  source: string
  run: (agency: AgencyForVerification, signal: AbortSignal) => Promise<KybSourceResult>
}

// ─── Connecteur RDAP (domain_whois_age, tache 2) ───────────────────────────────
//
// Extrait le domaine du site web declare par l'agence, puis interroge le serveur
// RDAP du suffixe -- .ch et .li chez SWITCH (meme infrastructure), .fr chez AFNIC.
// Ce que le check evalue : l'anciennete du domaine et son statut au registre (brief
// etape 4/tache 2 ; verifie en direct a la main pour cette tache, voir
// docs/superpowers/sdd/task-2-report.md). Services publics, sans cle, sans compte.
//
// Volontairement HORS PERIMETRE (arbitrage deja tranche par
// docs/agency-kyb-verification.md §2, rappele par le brief de cette tache) : la
// ressemblance domaine <-> raison sociale. Un domaine coute douze francs ; un
// fraudeur soigneux assortit le sien a son faux nom mieux qu'une agence legitime
// operant sous une enseigne distincte. Si ce rapprochement approximatif vient un
// jour, ce sera sur trade_name, jamais sur legal_name -- pas dans ce connecteur.
//
// Ne PAS reutiliser _shared/safe-fetch.ts ici : cette protection SSRF cible le cas
// d'une URL fournie par l'appelant dont l'HOTE est arbitraire (extract-property-url)
// et repose sur Deno.resolveDns, une API Deno qui casserait la testabilite Node de
// CE module (voir l'en-tete de fichier). Ici l'hote de la requete est TOUJOURS l'un
// des trois registres codes en dur ci-dessous -- seul le CHEMIN varie avec le
// domaine extrait. Le risque n'est donc pas un SSRF (redirection vers un hote
// interne) mais une injection dans le chemin, ecartee par DOMAIN_SHAPE_RE (forme
// stricte, deux etiquettes, verifiee AVANT toute construction d'URL) et par
// encodeURIComponent en defense supplementaire.

const RDAP_ENDPOINTS: Readonly<Record<string, string>> = {
  ch: 'https://rdap.nic.ch',
  li: 'https://rdap.nic.li',
  fr: 'https://rdap.nic.fr',
}

// Domaines de messagerie grand public : un dossier qui en declare un comme "site
// web" n'appartient a personne en particulier -- ni preuve d'existence de l'agence,
// ni signal de fraude (beaucoup de tres petites structures n'ont pas de domaine
// propre, brief tache 2). Liste volontairement courte et centree sur le marche vise
// (Suisse/France/Liechtenstein) plutot qu'exhaustive : un domaine grand public absent
// d'ici retombe simplement sur l'evaluation RDAP normale (et le plus souvent sur
// "suffixe non couvert" -> unavailable, puisque ce sont presque tous des .com),
// jamais sur une erreur. Produit un check `domain_generic_provider` (jamais
// `domain_whois_age`, revue etape 4/tache 2 point 2 -- voir KybSourceResult.check_type
// plus haut) : le catalogue distingue les deux signaux avec des poids differents
// (1.00 contre 0.75, migration 20260728103000), plier l'un dans l'autre laisserait
// une ligne de configuration morte.
const GENERIC_EMAIL_PROVIDER_DOMAINS: ReadonlySet<string> = new Set([
  'gmail.com', 'googlemail.com',
  'outlook.com', 'hotmail.com', 'hotmail.fr', 'live.com', 'msn.com',
  'yahoo.com', 'yahoo.fr',
  'icloud.com', 'me.com', 'aol.com',
  'protonmail.com', 'proton.me',
  'gmx.net', 'gmx.com', 'gmx.ch', 'web.de',
  'bluewin.ch',
  'orange.fr', 'wanadoo.fr', 'free.fr', 'laposte.net', 'sfr.fr',
])

// Forme stricte d'un domaine a deux etiquettes (SLD.TLD), apres reduction -- rejette
// tout ce qui contiendrait un caractere hors [a-z0-9-], donc toute tentative
// d'injection dans le chemin RDAP construit plus bas.
const DOMAIN_SHAPE_RE = /^[a-z0-9-]+\.[a-z0-9-]+$/

// Seuil UNIQUE separant "recent" (confirme moins bien : `partial`) d'"etabli"
// (confirme pleinement si le statut est par ailleurs sain : `match`) -- revue etape
// 4/tache 2, point 1. `match`/`partial`/`mismatch` veulent dire confirme/confirme a
// moitie/CONTREDIT ; un domaine recent ne contredit rien (une agence fondee le mois
// dernier a legitimement un domaine du mois dernier), il confirme seulement moins
// bien qu'un domaine etabli. Avant ce correctif, un second seuil ("domaine tres
// jeune", 30 jours) faisait a lui seul basculer un domaine recent en `mismatch` --
// un verdict defavorable pose sur un fait qui n'a rien d'anormal. Ce seuil-ci devient
// donc beaucoup moins critique qu'avant : il ne fait plus basculer entre confirmer et
// contredire, seulement entre confirmer et confirmer a moitie -- une valeur legerement
// differente ne ferait plus jamais basculer un dossier honnete vers un verdict
// defavorable, tout au plus vers `partial` au lieu de `match`. 180 jours (6 mois)
// reste une valeur raisonnable pour "etabli" (brief tache 2 ; seuils non chiffres par
// le brief, choisis et documentes dans task-2-report.md).
const ESTABLISHED_DOMAIN_THRESHOLD_DAYS = 180

/** Reduit un hostname a ses deux dernieres etiquettes (SLD.TLD) -- absorbe `www.`
 *  et tout sous-domaine de la meme facon, sans regle dediee a part. Ne gere pas les
 *  rares suffixes francais a deux niveaux herites (asso.fr, tm.fr...) : hors radar
 *  d'une agence immobiliere, et une erreur ici ne fait au pire qu'interroger le
 *  mauvais objet RDAP -> 404 -> mismatch, jamais un crash. */
function lastTwoLabels(hostname: string): string {
  const labels = hostname.toLowerCase().split('.').filter(Boolean)
  return labels.slice(-2).join('.')
}

/** Extrait le domaine a interroger depuis le site web declare. Leve TOUJOURS plutot
 *  que de choisir `unavailable` elle-meme (discipline du module, voir
 *  KybSourceResult plus haut) : site absent, url illisible meme apres l'essai
 *  `https://` par defaut, ou forme finale hors DOMAIN_SHAPE_RE -- runKybSource() se
 *  charge de traduire ca en `unavailable` avec la raison de l'echec jointe. */
function extractRdapDomain(website: string | null): string {
  const raw = website?.trim()
  if (!raw) throw new Error('rdap: no website declared')

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    try {
      url = new URL(`https://${raw}`)
    } catch {
      throw new Error(`rdap: unparseable website "${raw}"`)
    }
  }

  const domain = lastTwoLabels(url.hostname)
  if (!DOMAIN_SHAPE_RE.test(domain)) {
    throw new Error(`rdap: unparseable hostname "${url.hostname}"`)
  }
  return domain
}

/** Cherche l'evenement RDAP `registration` dans `events` -- absent chez de nombreux
 *  domaines .ch (constate en verification manuelle, voir task-2-report.md), jamais
 *  invente en son absence. */
function extractRegistrationDate(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null
  const events = (body as Record<string, unknown>).events
  if (!Array.isArray(events)) return null
  for (const event of events) {
    if (event && typeof event === 'object' && (event as Record<string, unknown>).eventAction === 'registration') {
      const date = (event as Record<string, unknown>).eventDate
      if (typeof date === 'string') return date
    }
  }
  return null
}

/** Statuts RDAP (tableau de chaines) portes par la reponse -- [] si absents ou mal
 *  formes, jamais invente. */
function extractStatuses(body: unknown): string[] {
  if (typeof body !== 'object' || body === null) return []
  const status = (body as Record<string, unknown>).status
  if (!Array.isArray(status)) return []
  return status.filter((s): s is string => typeof s === 'string')
}

function ageInDays(isoDate: string): number | null {
  const registered = new Date(isoDate).getTime()
  if (Number.isNaN(registered)) return null
  return Math.floor((Date.now() - registered) / 86_400_000)
}

/** Absence de statut (certains registres ne le publient pas) ou 'active' explicite :
 *  rien ne contredit un domaine sain -- `match` reste possible. Le reste (inactive,
 *  pendingDelete, redemptionPeriod, serverHold...) n'a PAS un sens fixe dans
 *  classifyDomain : sur un domaine RECENT ou d'anciennete inconnue, ce signal seul
 *  reste ambigu (le vocabulaire de statut varie trop d'un registre a l'autre, et un
 *  domaine tout juste enregistre peut traverser des etats transitoires) -- jamais de
 *  `mismatch` sur ce seul indice la, voir la branche `ageDays === null` et la branche
 *  "recent" ci-dessous. Mais une fois le domaine ETABLI (revue etape 4/tache 2, point
 *  1), ce meme statut non-actif decrit un domaine qui a existe mais ne tient plus
 *  (expire, suspendu, en attente de suppression) : ca contredit reellement une agence
 *  qui se pretend etablie ET en activite -- voir la branche finale de
 *  classifyDomain. */
function isReassuringStatus(statuses: string[]): boolean {
  return statuses.length === 0 || statuses.includes('active')
}

function classifyDomain(statuses: string[], ageDays: number | null): 'match' | 'partial' | 'mismatch' {
  if (ageDays === null) {
    // Anciennete indisponible (frequent chez rdap.nic.ch, verifie a la main -- voir
    // task-2-report.md) : le statut est le seul indice qui reste, jamais suffisant a
    // lui seul pour un verdict tranche -- ni un `match` plein (on ne confirme pas
    // l'anciennete que revendique un dossier "agence etablie"), ni un `mismatch`
    // (isReassuringStatus ci-dessus : le vocabulaire de statut varie trop d'un
    // registre a l'autre pour trancher sans corroboration par l'age).
    return 'partial'
  }
  if (ageDays < ESTABLISHED_DOMAIN_THRESHOLD_DAYS) {
    // Recent, quel que soit son age exact (revue etape 4/tache 2, point 1) : un
    // domaine recent ne contredit rien, il confirme seulement moins bien qu'un
    // domaine etabli. Jamais de `mismatch` sur ce seul critere d'age -- voir
    // ESTABLISHED_DOMAIN_THRESHOLD_DAYS plus haut.
    return 'partial'
  }
  // Etabli : actif (ou sans statut publie) confirme pleinement -- `match`. Un statut
  // qui n'est plus actif sur un domaine par ailleurs etabli ne confirme pas "a
  // moitie" : il contredit reellement une agence qui se pretend etablie ET en
  // activite -- `mismatch` (revue etape 4/tache 2, point 1 ; voir isReassuringStatus
  // plus haut pour ce qui distingue cette branche des deux precedentes).
  return isReassuringStatus(statuses) ? 'match' : 'mismatch'
}

async function runRdapDomainWhoisAge(agency: AgencyForVerification, signal: AbortSignal): Promise<KybSourceResult> {
  const website = agency.website
  const domain = extractRdapDomain(website)

  if (GENERIC_EMAIL_PROVIDER_DOMAINS.has(domain)) {
    // check_type explicite : ce check porte sur un signal different de
    // domain_whois_age (l'anciennete), avec son propre poids au catalogue (revue
    // etape 4/tache 2, point 2) -- voir KybSourceResult.check_type.
    return {
      result: 'partial',
      check_type: 'domain_generic_provider',
      raw_response: { website, domain, reason: 'generic_email_provider' },
    }
  }

  const tld = domain.slice(domain.lastIndexOf('.') + 1)
  const rdapBase = RDAP_ENDPOINTS[tld]
  if (!rdapBase) {
    throw new Error(`rdap: unsupported tld ".${tld}"`)
  }

  const res = await fetch(`${rdapBase}/domain/${encodeURIComponent(domain)}`, { signal })

  if (res.status === 404) {
    // Le registre A repondu : ce domaine, precisement, n'existe pas. Signal decisif,
    // pas une indisponibilite -- brief tache 2, "Trois suffixes couverts... et ce
    // sont ceux qui repondent".
    return {
      result: 'mismatch',
      raw_response: { website, domain, rdap_status: 404, reason: 'domain_not_registered' },
    }
  }

  if (!res.ok) {
    const err = new Error(`rdap: unexpected status ${res.status}`) as Error & { status: number }
    err.status = res.status
    throw err
  }

  // Une reponse illisible (JSON invalide) leve ici -- jamais rattrapee dans cette
  // fonction -- et runKybSource() la traduit en `unavailable` (brief tache 2 : "une
  // reponse illisible" vaut indisponibilite, jamais un match invente).
  const body: unknown = await res.json()

  const statuses = extractStatuses(body)
  const registeredOn = extractRegistrationDate(body)
  const ageDays = registeredOn ? ageInDays(registeredOn) : null

  return {
    result: classifyDomain(statuses, ageDays),
    raw_response: {
      website,
      domain,
      rdap_status: res.status,
      status: statuses,
      registered_on: registeredOn,
      age_days: ageDays,
      rdap: body,
    },
  }
}

// checkType declare ici = 'domain_whois_age', le cas par defaut de ce connecteur --
// mais son fournisseur grand public (plus haut) ecrase ce type en 'domain_generic_provider'
// via KybSourceResult.check_type (revue etape 4/tache 2, point 2) : UN registre ici,
// DEUX check_type possibles selon ce que le connecteur observe.
const rdapDomainWhoisAgeSource: KybSource = {
  checkType: 'domain_whois_age',
  source: 'rdap',
  run: runRdapDomainWhoisAge,
}

/**
 * Registre des connecteurs actifs. VIDE a la tache 1 par construction ("Tu n'ecris
 * aucun connecteur reel dans cette tache", brief etape 4). Un check_type non
 * catalogue dans verification_check_types ferait de toute facon echouer l'insert
 * (FK, migration 20260728103000) -- une entree ici EST donc deja un connecteur pour
 * de vrai, jamais un double de test. RDAP (domain_whois_age) est le premier, ajoute
 * par la tache 2 ; la tache 3 (VIES, recherche-entreprises, Mapbox) y ajoutera les
 * siens ; agency-verification-run/index.ts n'a jamais a changer pour ca.
 */
export const AGENCY_KYB_SOURCES: KybSource[] = [rdapDomainWhoisAgeSource]

/** Budget par source. Tres inferieur au testTimeout vitest (15s,
 *  vitest.backend.config.ts) et au budget d'execution d'une Edge Function -- une
 *  source qui traine ne doit jamais faire echouer TOUT le passage de
 *  verification. */
export const DEFAULT_SOURCE_TIMEOUT_MS = 10_000

class KybSourceTimeoutError extends Error {
  constructor(ms: number) {
    super(`kyb source timed out after ${ms}ms`)
    this.name = 'KybSourceTimeoutError'
  }
}

/**
 * Construit la preuve d'un echec de source -- raison, type d'erreur et message, plus
 * un code de statut si l'erreur en portait un (revue etape 4/tache 1, point 1) :
 * l'indisponibilite doit rester exploitable par un humain qui relit le dossier, pas
 * seulement `unavailable` nu. Cherry-pick des champs SURS uniquement -- ne JAMAIS
 * etaler l'objet erreur tel quel (`{...err}` ou equivalent) : un connecteur
 * fetch()-base (taches 2+) peut lever une erreur qui embarque sa requete sous-jacente,
 * en-tetes d'authentification compris. Ce module ne connait pas la forme exacte d'une
 * erreur qu'il n'a pas ecrite -- mieux vaut lire trop peu qu'exposer un secret dans une
 * piece d'audit LAB.
 */
function describeSourceFailure(err: unknown, isTimeout: boolean): Record<string, unknown> {
  const errorType = err instanceof Error ? err.name : typeof err
  const message = err instanceof Error ? err.message : String(err)
  const status = extractStatusCode(err)
  return {
    reason: isTimeout ? 'timeout' : 'error',
    error_type: errorType,
    message,
    ...(status === undefined ? {} : { status }),
  }
}

/** Lit UNIQUEMENT `.status` ou `.statusCode` sur l'erreur, s'il s'agit d'un nombre --
 *  jamais le reste de l'objet (voir describeSourceFailure ci-dessus). `undefined` si
 *  absent ou d'un type inattendu : pas de code de statut invente. */
function extractStatusCode(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined
  const record = err as Record<string, unknown>
  const candidate = record.status ?? record.statusCode
  return typeof candidate === 'number' ? candidate : undefined
}

/**
 * Execute UNE source de verification et retourne TOUJOURS une ligne exploitable --
 * jamais un throw, jamais indefiniment en attente. C'est cette fonction, et elle
 * seule, qui rend impossible qu'une source injoignable fasse disparaitre une
 * ligne du dossier ou fasse echouer toute la verification (le principe directeur
 * de l'etape 4).
 *
 * Deux mecanismes combines pour la garantie de timeout : le signal d'annulation
 * (AbortController) est une politesse envers les connecteurs fetch()-bases -- ils
 * peuvent l'observer pour couper leur requete sous-jacente -- mais rien n'oblige
 * un connecteur a l'ecouter. La garantie reelle "ne pend jamais indefiniment"
 * vient donc du Promise.race ci-dessous contre un timeout qui rejette DE
 * LUI-MEME, quel que soit le comportement de `run`.
 */
export async function runKybSource(
  source: KybSource,
  agency: AgencyForVerification,
  timeoutMs: number = DEFAULT_SOURCE_TIMEOUT_MS
): Promise<AgencyCheckRow> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new KybSourceTimeoutError(timeoutMs))
    }, timeoutMs)
  })

  try {
    const outcome = await Promise.race([source.run(agency, controller.signal), timeout])
    return {
      // outcome.check_type prime sur source.checkType quand le connecteur l'a
      // explicitement pose (revue etape 4/tache 2, point 2 -- voir
      // KybSourceResult.check_type) : UN registre peut couvrir plus d'un type du
      // catalogue selon ce que le connecteur observe a l'execution.
      check_type: outcome.check_type ?? source.checkType,
      source: source.source,
      result: outcome.result,
      raw_response: outcome.raw_response,
    }
  } catch (err) {
    // Echec OU expiration : jamais un resultat fabrique (un `match` par exemple)
    // qui vaudrait preuve alors qu'aucune source n'a repondu -- corollaire du
    // principe directeur de cette etape. La preuve jointe ICI est la raison de
    // l'echec elle-meme (revue point 1, voir describeSourceFailure). Pas
    // d'`outcome` ici (l'exception a interrompu `run` avant ou pendant son calcul) --
    // source.checkType reste donc le seul type possible pour cette ligne, jamais un
    // override que le connecteur n'a pas eu l'occasion de produire.
    return {
      check_type: source.checkType,
      source: source.source,
      result: 'unavailable',
      raw_response: describeSourceFailure(err, err instanceof KybSourceTimeoutError),
    }
  } finally {
    clearTimeout(timer)
  }
}

/** Execute toutes les sources fournies EN PARALLELE. Ne rejette jamais -- chaque
 *  source passe par runKybSource(), qui absorbe deja tout echec -- donc la
 *  longueur du tableau retourne est TOUJOURS egale a `sources.length`, jamais
 *  moins : aucune source ne peut faire disparaitre une ligne, meme collectivement.
 *  `timeoutMs` est transmis tel quel a chaque runKybSource() -- expose ici pour
 *  qu'un appelant (test compris) puisse le raccourcir sans devoir reimplementer
 *  la boucle. */
export async function runAgencyKybSources(
  agency: AgencyForVerification,
  sources: KybSource[] = AGENCY_KYB_SOURCES,
  timeoutMs: number = DEFAULT_SOURCE_TIMEOUT_MS
): Promise<AgencyCheckRow[]> {
  return Promise.all(sources.map((source) => runKybSource(source, agency, timeoutMs)))
}
