// supabase/functions/_shared/kyb-sources.ts
//
// Connecteurs de verification KYB (etape 4 de l'onboarding agence). Ce module posait
// a la tache 1 le contrat que chaque connecteur (RDAP, VIES, recherche-entreprises,
// Mapbox) doit respecter, et le harnais qui impose la regle qui gouverne toute
// l'etape. La tache 2 y a ajoute le premier connecteur reel -- RDAP (domain_whois_age,
// plus bas). La tache 3 y ajoute VIES (vat_lookup), le registre francais
// (registry_lookup + registry_legal_name_match, recherche-entreprises.api.gouv.fr) et
// le geocodage (address_geocode, Mapbox).
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
// "Tu n'ecris aucun connecteur reel dans cette tache"). La tache 2 y a ajoute RDAP ;
// la tache 3 y ajoute VIES et le registre francais (aucun des trois n'a besoin d'un
// secret) -- sans jamais avoir a toucher a agency-verification-run/index.ts ni a
// reimplementer la gestion d'erreur/timeout : c'est precisement ce que ce registre
// permet. SEUL le geocodage Mapbox (tache 3 egalement) fait exception : c'est le
// premier et seul connecteur du fichier qui a besoin d'un jeton, absent au chargement
// du module (voir createAddressGeocodeSource plus bas) -- agency-verification-run/
// index.ts doit donc bien le construire lui-meme, la seule retouche fonctionnelle que
// ce fichier ait jamais demandee a l'appelant.
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

// ─── Connecteur VIES (vat_lookup, tache 3) ─────────────────────────────────────
//
// Service public de l'UE, sans cle (brief tache 3). Valide un numero de TVA
// intracommunautaire -- jamais un numero suisse/liechtensteinois (CHE-..., hors UE,
// non couvert par VIES : etape 6, registre UID). La TVA etant FACULTATIVE a la saisie
// (decision produit du 27.07.2026, etape 2 tache 4 -- seuil d'assujettissement
// suisse), son absence produit `unavailable` et non `mismatch` : une petite entite
// sous ce seuil n'en a legitimement aucune, et le lui reprocher serait faux.
//
// Endpoint REST verifie en reconnaissance manuelle (voir task-3-report.md) :
//   POST https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number
//   {countryCode, vatNumber} -> {valid: boolean, name, address, ...} sur un pays
//   couvert ; {actionSucceed: false, errorWrappers: [...]} (HTTP 200 quand meme) sur
//   un code pays que VIES ne reconnait pas -- verifie avec GR (rejete, la Grece
//   utilise EL) et GB/CH (rejetes, hors UE) contre EL et XI (Irlande du Nord,
//   acceptes).

/** Codes pays reconnus par VIES -- les 27 Etats membres UE en ISO 3166-1 alpha-2 SAUF
 *  la Grece (EL, pas GR -- verifie en reconnaissance manuelle : GR est rejete par le
 *  service reel), plus XI (Irlande du Nord, regime TVA UE maintenu post-Brexit --
 *  verifie de la meme facon, GB lui est rejete). CH/LI en sont volontairement absents :
 *  ni l'un ni l'autre n'est dans l'UE, VIES ne les couvre pas -- c'est le registre UID
 *  (etape 6) qui s'en chargera. */
const EU_VIES_COUNTRY_CODES: ReadonlySet<string> = new Set([
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'ES', 'FI', 'FR', 'HR', 'HU',
  'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'XI',
])

interface ViesVatCountryAndNumber {
  countryCode: string
  vatNumber: string
}

/** Extrait le prefixe pays (2 lettres) et le numero depuis la TVA saisie librement --
 *  espaces/points/tirets courants dans la saisie humaine ("FR 10 632012100") retires
 *  avant decoupage. Leve TOUJOURS plutot que de choisir `unavailable` elle-meme (meme
 *  discipline que extractRdapDomain plus haut) si absent, trop court pour porter un
 *  prefixe+numero, ou si le prefixe n'est pas un code que VIES reconnait (CHE-...
 *  suisse par exemple) -- runKybSource() traduit le throw en `unavailable`. */
function extractVatCountryAndNumber(tva: string | null): ViesVatCountryAndNumber {
  const raw = tva?.trim()
  if (!raw) throw new Error('vies: no tva declared')
  const cleaned = raw.replace(/[\s.-]/g, '').toUpperCase()
  if (cleaned.length < 3) throw new Error(`vies: unparseable tva "${raw}"`)
  const countryCode = cleaned.slice(0, 2)
  const vatNumber = cleaned.slice(2)
  if (!EU_VIES_COUNTRY_CODES.has(countryCode)) {
    throw new Error(`vies: country code "${countryCode}" not covered by VIES`)
  }
  return { countryCode, vatNumber }
}

interface ViesCheckResponse {
  valid?: boolean
  name?: string
  address?: string
  actionSucceed?: boolean
  errorWrappers?: Array<{ error?: string }>
}

async function runVatLookup(agency: AgencyForVerification, signal: AbortSignal): Promise<KybSourceResult> {
  const { countryCode, vatNumber } = extractVatCountryAndNumber(agency.tva)

  const res = await fetch('https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ countryCode, vatNumber }),
    signal,
  })

  if (!res.ok) {
    const err = new Error(`vies: unexpected status ${res.status}`) as Error & { status: number }
    err.status = res.status
    throw err
  }

  // Une reponse illisible (JSON invalide) leve ici -- jamais rattrapee -- et
  // runKybSource() la traduit en `unavailable` (meme discipline que RDAP).
  const body = (await res.json()) as ViesCheckResponse

  // actionSucceed:false = la requete elle-meme n'a pas abouti (code pays rejete,
  // service du pays membre indisponible...) -- verifie en reconnaissance manuelle
  // avec un code pays que VIES rejette (HTTP 200 malgre tout, jamais de champ `valid`
  // en reponse dans ce cas). Jamais interprete comme un mismatch : la question posee
  // n'a simplement pas ete traitee, ce n'est pas une reponse sur le fond.
  if (body.actionSucceed === false || typeof body.valid !== 'boolean') {
    throw new Error(`vies: request not processed (${JSON.stringify(body.errorWrappers ?? [])})`)
  }

  return {
    result: body.valid ? 'match' : 'mismatch',
    raw_response: {
      tva: agency.tva,
      country_code: countryCode,
      vat_number: vatNumber,
      vies: body,
    },
  }
}

const vatLookupSource: KybSource = {
  checkType: 'vat_lookup',
  source: 'vies',
  run: runVatLookup,
}

// ─── Connecteur registre francais (registry_lookup / registry_legal_name_match,
//     tache 3) ─────────────────────────────────────────────────────────────────
//
// recherche-entreprises.api.gouv.fr : public, sans cle, sans compte, 7 requetes/
// seconde (brief tache 3 ; doc de conception docs/agency-kyb-verification.md §3).
// Ne s'interroge QUE pour un siege en France (agency.country === 'FR') -- la Suisse
// reste aveugle faute d'acces a Zefix (etape 6), le Liechtenstein n'a aucune API
// publique connue (meme doc).
//
// DEUX check_type distincts pour UNE seule source (meme motif que
// domain_whois_age/domain_generic_provider a la tache 2, revue etape 4/tache 2 point
// 2) : le catalogue (verification_check_types, migration 20260728103000) distingue
// registry_lookup (existence + statut actif, un seul type pour les deux -- meme
// libelle catalogue) de registry_legal_name_match (raison sociale), CHACUN etant un
// veto d'entite independant (doc de conception §2.A). Une seule ligne
// KybSourceResult ne peut porter qu'UN check_type (voir KybSourceResult.check_type
// plus haut) -- impossible de renvoyer les deux verdicts en un seul appel de
// connecteur. D'ou DEUX entrees dans AGENCY_KYB_SOURCES, chacune interrogeant
// independamment le meme point d'API (couplage accepte : 7 req/s suffit largement a
// deux appels par verification, non par seconde).
//
// Hors perimetre de cette tache (brief tache 3, qui n'enumere que "l'existence, le
// statut actif et la raison sociale") : registry_number_format (format/cle de
// controle du SIREN -- calcul pur, sans reseau, catalogue mais non rempli ici) et
// registry_country_match (ce connecteur ne s'interrogeant QUE pour un siege deja
// declare en France, une reponse positive ne ferait jamais que confirmer
// trivialement ce qui a deja filtre l'appel -- aucune donnee de "juridiction"
// distincte a comparer). Les deux restent un veto absent (`unavailable`), donc un
// dossier francais part encore en revue humaine malgre cette tache -- comportement
// attendu, pas un defaut (meme principe que Zefix, doc de conception §3).

/** Etat administratif INSEE/RNE rencontre en reconnaissance manuelle (voir rapport de
 *  tache) : 'A' = actif. Tout le reste (notamment 'C' = cesse) contredit une agence
 *  qui se pretend en activite -- meme logique que le statut RDAP non rassurant sur un
 *  domaine etabli (classifyDomain plus haut). */
const FRENCH_REGISTRY_ACTIVE_STATUS = 'A'

/** Extrait un SIREN exploitable (9 chiffres) depuis business_registration_number, en
 *  ne gardant que les chiffres -- la saisie peut porter des espaces ("510 761 505",
 *  forme d'affichage officielle INSEE). Leve TOUJOURS plutot que de choisir
 *  `unavailable` elle-meme (meme discipline que extractRdapDomain) : runKybSource()
 *  se charge de traduire un throw en `unavailable`. */
function extractSiren(businessRegistrationNumber: string | null): string {
  const raw = businessRegistrationNumber?.trim()
  if (!raw) throw new Error('recherche-entreprises: no business_registration_number declared')
  const digits = raw.replace(/[^0-9]/g, '')
  if (!/^\d{9}$/.test(digits)) {
    throw new Error(`recherche-entreprises: unparseable SIREN "${raw}"`)
  }
  return digits
}

/** Normalisation stricte pour le rapprochement de raison sociale : accents et casse
 *  toleres (NFD + suppression des diacritiques, minuscules), PONCTUATION ET ESPACES
 *  retires entierement -- "S.A." et "SA", "Dupont-Martin" et "Dupont Martin" doivent
 *  matcher. Volontairement SANS tolerance au-dela (doc de conception §2.A : "rien
 *  d'autre") -- ce n'est PAS le rapprochement approximatif (Jaro-Winkler) reserve a
 *  trade_name (voir l'en-tete RDAP plus haut) : deux raisons sociales qui different
 *  par autre chose qu'accent/casse/ponctuation doivent rester un mismatch. */
function normalizeLegalNameStrict(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
}

interface RechercheEntreprisesResult {
  siren?: string
  nom_raison_sociale?: string | null
  nom_complet?: string | null
  etat_administratif?: string | null
}

interface RechercheEntreprisesResponse {
  results?: RechercheEntreprisesResult[]
}

/** Appelle recherche-entreprises.api.gouv.fr par SIREN exact (le parametre `q`
 *  accepte un identifiant numerique en recherche directe -- verifie en
 *  reconnaissance manuelle, voir rapport de tache : `q=510761505` renvoie le meme
 *  resultat unique que `q=l'oreal`). Ne catche RIEN elle-meme (non-2xx, JSON
 *  illisible) -- meme discipline que le connecteur RDAP, runKybSource() traduit tout
 *  ecart en `unavailable`. */
async function fetchFrenchRegistry(siren: string, signal: AbortSignal): Promise<RechercheEntreprisesResponse> {
  const res = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${siren}`, { signal })
  if (!res.ok) {
    const err = new Error(`recherche-entreprises: unexpected status ${res.status}`) as Error & { status: number }
    err.status = res.status
    throw err
  }
  const body = (await res.json()) as RechercheEntreprisesResponse
  // Garde de forme (meme discipline que VIES, runVatLookup plus haut -- il verifie le
  // TYPE du champ attendu avant de conclure) : HTTP 200 n'est pas une garantie de
  // forme. Un corps hors schema (`results` absent ou pas un tableau -- panne
  // fournisseur, page d'erreur deserialisee malgre tout en JSON...) ne permet PAS de
  // conclure a une absence : SEULE une liste vide EST cette information positive ("le
  // registre a repondu : ce SIREN n'existe pas"). Toute autre forme leve ici ->
  // unavailable via runKybSource() (revue etape 4/tache 3, point 1) : un corps
  // `{"error":"service degrade"}` produisait avant ce correctif exactement le meme
  // `mismatch` ("siren introuvable") qu'un vrai SIREN inconnu -- une panne de schema
  // chez le fournisseur ne doit jamais s'ecrire comme une affirmation decisive sur un
  // veto.
  if (!Array.isArray(body.results)) {
    throw new Error('recherche-entreprises: unexpected response shape (results is not an array)')
  }
  return body
}

async function runRegistryLookup(agency: AgencyForVerification, signal: AbortSignal): Promise<KybSourceResult> {
  if (agency.country !== 'FR') {
    throw new Error('recherche-entreprises: siege hors France, source non interrogee')
  }
  const siren = extractSiren(agency.business_registration_number)
  const body = await fetchFrenchRegistry(siren, signal)
  const result = body.results?.[0]

  if (!result) {
    // Le registre A repondu : ce SIREN, precisement, n'existe pas -- signal decisif
    // (meme motif que le 404 RDAP), pas une indisponibilite.
    return { result: 'mismatch', raw_response: { siren, reason: 'siren_not_found', recherche_entreprises: body } }
  }

  const active = result.etat_administratif === FRENCH_REGISTRY_ACTIVE_STATUS
  return {
    result: active ? 'match' : 'mismatch',
    raw_response: {
      siren,
      etat_administratif: result.etat_administratif ?? null,
      recherche_entreprises: body,
    },
  }
}

async function runRegistryLegalNameMatch(agency: AgencyForVerification, signal: AbortSignal): Promise<KybSourceResult> {
  if (agency.country !== 'FR') {
    throw new Error('recherche-entreprises: siege hors France, source non interrogee')
  }
  const declaredName = agency.legal_name?.trim()
  if (!declaredName) {
    throw new Error('recherche-entreprises: no legal_name declared')
  }
  const siren = extractSiren(agency.business_registration_number)
  const body = await fetchFrenchRegistry(siren, signal)
  const result = body.results?.[0]

  if (!result) {
    // Aucune entite au registre -> aucune raison sociale a comparer : cette
    // dimension-la reste indisponible (le veto d'existence, registry_lookup, porte
    // deja ce signal pour son propre check_type -- pas de raison de dupliquer le
    // meme mismatch ici sur une donnee qui, elle, n'existe simplement pas).
    throw new Error('recherche-entreprises: siren not found, nothing to compare legal_name against')
  }

  const registryName = result.nom_raison_sociale ?? result.nom_complet ?? ''
  const isMatch = normalizeLegalNameStrict(declaredName) === normalizeLegalNameStrict(registryName)
  return {
    result: isMatch ? 'match' : 'mismatch',
    raw_response: {
      siren,
      declared_legal_name: declaredName,
      registry_legal_name: registryName,
      recherche_entreprises: body,
    },
  }
}

const registryLookupSource: KybSource = {
  checkType: 'registry_lookup',
  source: 'recherche_entreprises',
  run: runRegistryLookup,
}

const registryLegalNameMatchSource: KybSource = {
  checkType: 'registry_legal_name_match',
  source: 'recherche_entreprises',
  run: runRegistryLegalNameMatch,
}

// ─── Connecteur geocodage Mapbox (address_geocode, tache 3) ────────────────────
//
// Mapbox est deja dans la pile (frontend, VITE_MAPBOX_TOKEN -- src/lib/mapbox.ts,
// Step2Address.tsx). Reutilise la MEME configuration (endpoint Geocoding v5, meme
// forme de reponse `context[]` avec `id`/`short_code` deja consommee par
// Step2Address.tsx -- chooseSuggestion()) plutot que d'en introduire une nouvelle
// (brief tache 3). Le jeton est TOUJOURS injecte en parametre, jamais lu de l'env ici
// (meme discipline que src/lib/mapbox.ts : "le token est TOUJOURS injecte en
// parametre, jamais lu de l'env ici") -- ce module reste pur (aucun Deno.env.get,
// voir l'en-tete de fichier). C'est agency-verification-run/index.ts, qui lit deja
// SUPABASE_SERVICE_ROLE_KEY/SUPABASE_URL depuis Deno.env, qui lit le jeton Mapbox
// (MAPBOX_TOKEN) et construit ce connecteur -- DONC UNE FACTORY
// (createAddressGeocodeSource), pas une entree statique de AGENCY_KYB_SOURCES comme
// les trois autres connecteurs de cette tache : c'est le SEUL connecteur de tout ce
// module qui a besoin d'un secret, et AGENCY_KYB_SOURCES est une liste construite au
// chargement du module, avant qu'aucun jeton ne soit connu. Meme situation que
// DILISENSE_API_KEY/GEMINI_API_KEY (kyc-screening, _shared/vision.ts) : un secret
// tiers reel, non fixable pour un test local (contrairement a
// MEGGA_MAGIC_LINK_HMAC_SECRET, un secret HMAC que ce depot controle entierement) --
// absent en local, aucune entree dediee dans supabase/config.toml.
//
// Ce qu'evalue le check (brief tache 3) : la coherence entre l'adresse saisie et le
// pays OU LE CANTON declare -- pas l'existence en soi. Sans pays declare, il n'y a
// donc rien a comparer -> `unavailable`, meme traitement que "aucune adresse".
//
// AUCUNE URL (donc aucun jeton) n'entre jamais dans raw_response ou dans le message
// d'une erreur remontee au harnais -- seule la reponse Mapbox elle-meme (qui ne
// contient jamais le jeton, seule la REQUETE le porte) y figure. Verification
// manuelle : voir les reserves du rapport de tache -- ce connecteur n'a pas pu etre
// exerce contre le vrai service (aucun jeton disponible dans cet environnement).

interface MapboxContextEntry {
  id?: string
  short_code?: string
}

interface MapboxFeature {
  place_name?: string
  context?: MapboxContextEntry[]
}

interface MapboxGeocodeResponse {
  features?: MapboxFeature[]
}

function findContextShortCode(context: MapboxContextEntry[] | undefined, idPrefix: string): string | null {
  const entry = context?.find((c) => typeof c.id === 'string' && c.id.startsWith(idPrefix))
  return typeof entry?.short_code === 'string' ? entry.short_code.toUpperCase() : null
}

/** "CH-GE" -> "GE". null si la forme ne comporte pas exactement un tiret (canton non
 *  extractible -- jamais invente). */
function extractCantonSuffix(regionShortCode: string | null): string | null {
  if (!regionShortCode) return null
  const parts = regionShortCode.split('-')
  return parts.length === 2 ? parts[1].toUpperCase() : null
}

/** Ne pose un `mismatch` que sur une CONTRADICTION reelle (pays different, ou canton
 *  different quand les deux sont connus) -- jamais sur une donnee simplement absente,
 *  qui vaut `partial` (0 resultat, ou reponse dont le contexte pays est illisible :
 *  Mapbox n'est pas un registre exhaustif comme RDAP, un resultat absent ne PROUVE
 *  pas que l'adresse n'existe pas). Le canton ne peut que faire BASCULER un match en
 *  mismatch (contradiction ajoutee), jamais empecher un match a lui seul quand il est
 *  simplement absent de la reponse -- "pays OU canton declare" (brief tache 3) : le
 *  pays a lui seul confirme deja suffisamment en l'absence de contradiction sur le
 *  canton. */
function classifyGeocode(
  declaredCountry: string,
  declaredCanton: string | null,
  feature: MapboxFeature | undefined
): 'match' | 'partial' | 'mismatch' {
  if (!feature) return 'partial'
  const geocodedCountry = findContextShortCode(feature.context, 'country')
  if (!geocodedCountry) return 'partial'
  if (geocodedCountry !== declaredCountry.toUpperCase()) return 'mismatch'

  if (declaredCountry.toUpperCase() === 'CH' && declaredCanton) {
    const geocodedCanton = extractCantonSuffix(findContextShortCode(feature.context, 'region'))
    if (geocodedCanton && geocodedCanton !== declaredCanton.toUpperCase()) return 'mismatch'
  }
  return 'match'
}

/** Construit le connecteur de geocodage -- fonction plutot qu'instance statique
 *  (voir l'en-tete de cette section) : le jeton n'est connu qu'a l'execution de
 *  l'Edge Function, jamais au chargement de ce module. */
export function createAddressGeocodeSource(mapboxToken: string): KybSource {
  return {
    checkType: 'address_geocode',
    source: 'mapbox',
    run: async (agency: AgencyForVerification, signal: AbortSignal): Promise<KybSourceResult> => {
      if (!mapboxToken) throw new Error('mapbox: not configured')

      const queryParts = [agency.address, agency.postal_code, agency.city].filter(
        (p): p is string => !!p && p.trim() !== ''
      )
      if (queryParts.length === 0) throw new Error('mapbox: no address declared')
      const declaredCountry = agency.country?.trim()
      if (!declaredCountry) throw new Error('mapbox: no declared country to compare against')

      const query = queryParts.join(', ')
      const url =
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
        `?access_token=${mapboxToken}&limit=1`

      let res: Response
      try {
        res = await fetch(url, { signal })
      } catch {
        // Jamais le message brut de l'erreur reseau ici : l'URL ci-dessus porte le
        // jeton Mapbox en parametre de requete, et certaines implementations de
        // fetch() embarquent l'URL complete dans le message d'une erreur reseau (DNS,
        // connexion refusee...). describeSourceFailure() (plus bas dans ce fichier)
        // ne lit que .message sans le filtrer davantage -- la seule protection
        // possible est ICI, avant que l'erreur ne quitte ce connecteur. Aucun autre
        // connecteur de ce fichier n'a ce probleme (RDAP/VIES/recherche-entreprises
        // sont tous sans cle).
        throw new Error('mapbox: network error')
      }

      if (!res.ok) {
        const err = new Error(`mapbox: unexpected status ${res.status}`) as Error & { status: number }
        err.status = res.status
        throw err
      }

      const body = (await res.json()) as MapboxGeocodeResponse
      const feature = body.features?.[0]
      const classification = classifyGeocode(declaredCountry, agency.canton, feature)

      return {
        result: classification,
        raw_response: {
          // `query` est un texte d'adresse, jamais l'URL (donc jamais le jeton).
          query,
          declared_country: declaredCountry,
          declared_canton: agency.canton,
          place_name: feature?.place_name ?? null,
          mapbox: body,
        },
      }
    },
  }
}

/**
 * Registre des connecteurs actifs SANS CONFIGURATION (voir createAddressGeocodeSource
 * ci-dessus pour le seul connecteur qui en a besoin). VIDE a la tache 1 par
 * construction ("Tu n'ecris aucun connecteur reel dans cette tache", brief etape 4).
 * Un check_type non catalogue dans verification_check_types ferait de toute facon
 * echouer l'insert (FK, migration 20260728103000) -- une entree ici EST donc deja un
 * connecteur pour de vrai, jamais un double de test. RDAP (domain_whois_age) est le
 * premier, ajoute par la tache 2 ; la tache 3 y ajoute VIES (vat_lookup) et le
 * registre francais (registry_lookup, registry_legal_name_match) ;
 * agency-verification-run/index.ts n'a jamais eu a changer pour ces trois-la.
 */
export const AGENCY_KYB_SOURCES: KybSource[] = [
  rdapDomainWhoisAgeSource,
  vatLookupSource,
  registryLookupSource,
  registryLegalNameMatchSource,
]

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
