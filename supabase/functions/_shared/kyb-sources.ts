// supabase/functions/_shared/kyb-sources.ts
//
// Connecteurs de verification KYB (etape 4 de l'onboarding agence). Ce module posait
// a la tache 1 le contrat que chaque connecteur (RDAP, VIES, recherche-entreprises,
// Mapbox) doit respecter, et le harnais qui impose la regle qui gouverne toute
// l'etape. La tache 2 y a ajoute le premier connecteur reel -- RDAP (domain_whois_age,
// plus bas). La tache 3 y ajoute VIES (vat_lookup), le registre francais
// (registry_lookup + registry_legal_name_match, recherche-entreprises.api.gouv.fr) et
// le geocodage (address_geocode, Mapbox). L'etape 6 (tache 1) y ajoute la JURIDICTION
// d'une source -- `appliesTo` + selectApplicableSources(), section dediee plus bas :
// deux sources qui se partagent un check_type ne doivent jamais etre interrogees pour
// le meme dossier, sans quoi la derniere ligne inseree masquerait l'autre au moteur --
// mais ecarter une source qui aurait eu un verdict a rendre coute ce verdict, ce que la
// revue finale a du corriger sur vat_lookup (section « Qui possede vat_lookup »). Sa
// tache 3 y ajoute le SQUELETTE DU REGISTRE UID (TVA suisse et liechtensteinoise,
// vat_lookup pour CH/LI) : une source cablee de bout en bout mais sans connecteur, faute de
// savoir ce qu'il faudrait appeler -- voir la section « Squelette du registre UID » et les
// deux erreurs qui la precedent. Le chantier LINDAS y ajoute le CONTROLE DU NUMERO DE
// REGISTRE (tache 1, registry_number_format) : le seul connecteur du fichier qui ne sorte
// pas du processus -- ni reseau, ni cle, ni juridiction declaree -- puis les TROIS SOURCES
// ZEFIX PAR LINDAS (tache 2, registry_lookup / registry_legal_name_match /
// registry_country_match), qui REMPLACENT le squelette Zefix de l'etape 6 : le registre du
// commerce suisse est publie en SPARQL par la Confederation, sans authentification. Trois
// des quatre vetos d'entite ont donc desormais un proprietaire qui repond ; le quatrieme,
// registry_lookup, repond aussi mais ne peut jamais valoir `match` faute de statut publie --
// section « Connecteur Zefix par LINDAS ». Sa tache 3 donne enfin a registry_country_match
// un proprietaire FRANCAIS (recherche_entreprises), en retenant pour la France l'argument
// que la tache 2 avait retenu pour la Suisse -- et c'est ce qui fait de la France le
// PREMIER pays dont les quatre vetos d'entite peuvent valoir `match` sans intervention
// humaine sur les vetos eux-memes.
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
  /** Juridiction couverte par ce connecteur -- voir la section « Juridiction d'une
   *  source » ci-dessous. FACULTATIF : une source qui n'en declare pas s'applique
   *  toujours, ce qui est le cas de tout connecteur seul proprietaire de son
   *  check_type (RDAP, geocodage) -- il n'y a alors rien a departager. */
  appliesTo?: (agency: AgencyForVerification) => boolean
  run: (agency: AgencyForVerification, signal: AbortSignal) => Promise<KybSourceResult>
}

// ─── Juridiction d'une source, et l'exclusivite qu'elle garantit (etape 6, tache 1) ──
//
// Le moteur (recompute_agency_verification, 20260728130000) ne garde qu'UNE ligne par
// check_type : `distinct on (check_type) ... order by check_type, checked_at desc,
// ctid desc`. Deux lignes ecrites dans la MEME transaction portent le meme checked_at
// (valeur par defaut = heure de DEBUT de transaction) -- c'est donc la DERNIERE INSEREE
// qui gagne, autrement dit l'ordre du tableau passe a record_agency_verification_run.
//
// La tache 2 de l'etape 6 donne un second proprietaire a registry_lookup et
// registry_legal_name_match (Zefix, CH, la ou recherche-entreprises couvre la France), et
// sa tache 3 en donne un a vat_lookup (registre UID, CH/LI, la ou VIES couvre l'UE). Le
// chantier LINDAS acheve la symetrie sur les registres : sa tache 2 fait revendiquer
// registry_country_match par Zefix, sa tache 3 par recherche-entreprises -- les TROIS
// check_type de registre ont donc desormais deux proprietaires chacun. Sans regle,
// l'`unavailable` que le connecteur francais produit deja pour tout siege hors de
// France pourrait s'inserer apres le verdict suisse et le masquer : un veto reellement
// satisfait se lirait comme un veto absent -- l'inverse exact de ce que la preuve dit.
// Departager cette collision serait deja trop tard ; la regle ci-dessous la rend
// impossible. Le risque a cesse d'etre theorique au chantier LINDAS (tache 2) : les
// sources suisses repondent desormais pour de bon, elles ecrivent `match`, `partial` et
// `mismatch` -- ce qu'aurait masque une ligne francaise inseree apres elles.
//
// Impossible POUR LE check_type QU'UNE SOURCE DECLARE (source.checkType), et c'est la
// totalite de ce que la regle promet -- la reserve merite d'etre ici, pas seulement dans
// un commentaire de test. Un connecteur peut ecraser son type A L'EXECUTION via
// KybSourceResult.check_type (c'est ce que fait RDAP, plus bas, pour
// domain_generic_provider) : cette ecriture-la ne passe par aucun filtre, puisqu'elle
// n'existe qu'une fois la source deja executee. Aucun type PARTAGE n'est produit de cette
// facon aujourd'hui ; celui qui ecrira le parsing Zefix doit le verifier avant d'y recourir.
//
// La regle : une source declare la juridiction qu'elle couvre (`appliesTo`), et
// selectApplicableSources() (plus bas) ecarte AVANT execution celles qui ne couvrent pas le
// dossier. Deux sources qui se partagent un check_type ne sont donc jamais applicables au
// meme dossier -- ni quand leur juridiction est INDETERMINABLE (predicat qui leve) : elles
// sont alors ecartees toutes les deux, jamais gardees toutes les deux (voir
// selectApplicableSources, revue etape 6/tache 1).
//
// « Juridiction » ne veut PAS dire « pays du siege » par principe : c'est la source qui
// declare ce qu'elle couvre. Les registres du commerce se departagent bien sur le siege
// (Zefix/CH, recherche-entreprises/FR), mais vat_lookup se departage sur le PREFIXE DE TVA
// DECLARE -- voir la section « Qui possede vat_lookup », et pourquoi confondre les deux a
// coute un verdict.
//
// Ou le filtre vit : dans agency-verification-run/index.ts, JAMAIS dans
// runAgencyKybSources(), qui doit continuer de rendre une ligne par source QU'ON LUI
// DONNE -- c'est son contrat documente (voir sa docstring), et les gardes internes des
// connecteurs (« siege hors France, source non interrogee ») restent la derniere ligne
// de defense pour un appelant qui lui passerait une source sans filtrer.
//
// CE QU'ECARTER COUTE, ET LA OU IL FAUT REGARDER (corrige en revue finale de l'etape 6 --
// ce paragraphe affirmait qu'aucun verdict ne bougeait, et c'etait faux). Ecarter une
// source est neutre A UNE CONDITION : que la source ecartee n'ait rien eu a repondre sur
// ce dossier, c'est-a-dire qu'elle aurait produit `unavailable`. La seule chose que le
// moteur traite reellement a l'identique, c'est `unavailable` et « ligne absente » (exclus
// du numerateur ET du denominateur, et un veto `unavailable` echoue comme un veto absent).
// Quand la source ecartee AURAIT RENDU UN VERDICT, l'ecarter jette ce verdict -- et le
// dossier ne vaut plus la meme chose. Mesure en base sur un dossier CH declarant une TVA a
// prefixe UE : 0.200/manual_review avec le `mismatch` de VIES, 1.000/auto_validated sans.
// Regle a retenir en ajoutant une juridiction : un predicat ne doit ecarter QUE des sources
// qui n'auraient rien pu dire du dossier -- ce qui exige de regarder la donnee qu'elles
// lisent (ici le prefixe de TVA), pas seulement le pays du siege. Ce qui est ecarte passe
// dans `sources_skipped` du journal du passage, pour que la trace dise ce qui n'a pas ete
// interroge, et pourquoi.

/** Une source qu'aucune juridiction declaree ne rend applicable au dossier. Jointe
 *  telle quelle au journal du passage (p_metadata.sources_skipped, voir
 *  agency-verification-run/index.ts) : « pas interrogee » doit rester lisible dans la
 *  trace d'un dispositif LAB, jamais devenir un silence.
 *
 *  DEUX raisons distinctes, et la distinction n'est pas cosmetique (revue etape 6/tache
 *  1) : 'jurisdiction_not_covered' dit « cette source ne couvre pas ce pays » -- le cas
 *  nominal, attendu, sans rien a corriger ; 'jurisdiction_undeterminable' dit « on n'a
 *  pas pu determiner si elle le couvre », c'est-a-dire que son `appliesTo` a leve. Cette
 *  seconde valeur est le SEUL signal qu'un predicat est bogue, et elle atterrit dans
 *  p_metadata de record_agency_verification_run, donc dans activity_events : les
 *  confondre reviendrait a enterrer un defaut de code dans le bruit du fonctionnement
 *  normal. */
export interface SkippedKybSource {
  check_type: string
  source: string
  reason: 'jurisdiction_not_covered' | 'jurisdiction_undeterminable'
}

/** Pays du siege sous la forme que comparent les juridictions declarees plus bas --
 *  agencies.country est du texte libre cote base, d'ou trim() + majuscules. `null`
 *  quand rien n'est declare : une juridiction ne se devine pas, et une source qui en
 *  exige une ne s'applique donc a aucun dossier sans pays. */
function declaredHeadOfficeCountry(agency: AgencyForVerification): string | null {
  const country = agency.country?.trim().toUpperCase()
  return country ? country : null
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

/** Reduit la TVA saisie librement a une forme comparable -- espaces/points/tirets
 *  courants dans la saisie humaine ("FR 10 632012100") retires, majuscules. `null` quand
 *  il n'y a rien a lire, ou quand la saisie est trop courte pour porter un prefixe ET un
 *  numero.
 *
 *  UN SEUL point de normalisation, et c'est delibere (revue finale etape 6) : le
 *  connecteur VIES ci-dessous et le departage de juridiction de vat_lookup
 *  (vatLookupOwner, plus bas) doivent lire EXACTEMENT le meme prefixe. S'ils divergeaient,
 *  une source pourrait etre retenue sur un prefixe que son propre connecteur refuse -- ou
 *  ecartee sur un prefixe qu'il aurait su traiter. */
function normalizeDeclaredVat(tva: string | null): string | null {
  const cleaned = tva?.replace(/[\s.-]/g, '').toUpperCase()
  return cleaned && cleaned.length >= 3 ? cleaned : null
}

/** Extrait le prefixe pays (2 lettres) et le numero depuis la TVA saisie librement.
 *  Leve TOUJOURS plutot que de choisir `unavailable` elle-meme (meme discipline que
 *  extractRdapDomain plus haut) si absent, trop court pour porter un prefixe+numero, ou
 *  si le prefixe n'est pas un code que VIES reconnait (CHE-... suisse par exemple) --
 *  runKybSource() traduit le throw en `unavailable`. */
function extractVatCountryAndNumber(tva: string | null): ViesVatCountryAndNumber {
  const raw = tva?.trim()
  if (!raw) throw new Error('vies: no tva declared')
  const cleaned = normalizeDeclaredVat(raw)
  if (!cleaned) throw new Error(`vies: unparseable tva "${raw}"`)
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

// ─── Qui possede vat_lookup -- le prefixe declare, PAS le seul pays du siege ───
//
// Corrige en revue finale de l'etape 6, et le defaut vaut d'etre ecrit ici plutot que
// resume : `agencies.tva` est du TEXTE LIBRE -- ni le wizard
// (src/components/crm-sugar-identity/steps/StepAgence.tsx) ni la base ne verifient que le
// prefixe declare s'accorde avec le pays du siege. Un dossier CH peut donc porter une TVA
// a prefixe UE, et VIES sait repondre sur ce numero-la : elle le faisait avant l'etape 6,
// ou vatLookupSource n'avait AUCUN appliesTo et etait interrogee pour tout siege.
//
// Departager les deux proprietaires de vat_lookup sur le SEUL pays du siege ecartait donc
// VIES d'un dossier sur lequel elle avait un verdict a rendre. Mesure en base sur ce
// dossier exact, tous vetos poses a la main : `mismatch` (VIES interrogee) -> score 0.200,
// manual_review ; `unavailable` (VIES ecartee, registre UID sans identifiants) -> score
// 1.000, auto_validated. Un signal defavorable de poids 3.00 disparaissait du calcul, et
// avec lui le passage oblige par la revue humaine -- donc par les gardes LAB
// (_shared/agency-lab-guard.ts), qu'`auto_validated` ouvre.
//
// La regle : le PREFIXE prime, le siege ne tranche que ce que le prefixe ne tranche pas.
// UN SEUL point de decision (vatLookupOwner) rend UNE valeur ; les deux `appliesTo` ne
// font que la comparer a la leur. Il n'y a donc pas deux predicats a tenir d'accord :
// l'exclusivite du type reste une propriete du code, y compris si la regle change.

/** Pays dont la TVA releve du registre UID (etape 6) et jamais de VIES : ni la Suisse
 *  ni le Liechtenstein ne sont dans l'UE. Volontairement une EXCLUSION plutot que la
 *  liste des 27 Etats membres : seule la disjonction avec le registre UID est
 *  necessaire a l'exclusivite de vat_lookup, et une agence allemande doit rester
 *  interrogeable sans qu'on ait a maintenir une liste qui se perimerait. Ne PAS
 *  confondre avec EU_VIES_COUNTRY_CODES ci-dessus : celle-la porte des prefixes de TVA
 *  (EL pour la Grece, XI pour l'Irlande du Nord), pas des codes pays de siege -- et c'est
 *  bien elle, pas celle-ci, que lit le premier temps de vatLookupOwner. */
const UID_REGISTRY_COUNTRIES: ReadonlySet<string> = new Set(['CH', 'LI'])

/** Les deux valeurs sont litteralement les `source` des deux KybSource proprietaires du
 *  type (`vies` plus bas, `uid_register` dans la section « Squelette du registre UID ») --
 *  verifie par la matrice de proprietaires de tests/backend/agency-verification-run.spec.ts. */
type VatLookupOwner = 'vies' | 'uid_register'

/**
 * Qui, du connecteur VIES ou du registre UID, doit interroger la TVA de CE dossier.
 * `null` quand ni l'un ni l'autre ne peut rien en dire. AU PLUS UN proprietaire par
 * construction : une valeur unique ne peut pas en designer deux.
 *
 * Ordre delibere, et chacun des trois temps repond a un cas mesure (revue finale etape 6) :
 *
 *   1. Le PREFIXE d'abord. C'est lui, jamais le siege, qui dit quel registre PEUT
 *      repondre : une TVA a prefixe UE se verifie chez VIES meme declaree par une agence
 *      suisse -- exactement ce que faisait le code d'avant l'etape 6.
 *   2. Le SIEGE ensuite, et lui seul, pour tout ce que le prefixe ne tranche pas (TVA
 *      absente, prefixe CHE, saisie illisible) : CH/LI au registre UID, tout le reste a
 *      VIES -- qui produira alors elle-meme l'`unavailable` qu'elle produisait deja avant
 *      l'etape 6 sur une TVA qu'elle ne sait pas lire.
 *   3. Sans pays declare ET sans prefixe couvert, personne. Une juridiction ne se devine
 *      pas ; vat_lookup reste simplement absent du dossier, et c'est le SEUL des cas ou la
 *      ligne change de forme par rapport a l'etat d'avant l'etape 6 (`unavailable`) --
 *      jamais de portee : le moteur exclut les deux du numerateur ET du denominateur.
 */
function vatLookupOwner(agency: AgencyForVerification): VatLookupOwner | null {
  const declaredVat = normalizeDeclaredVat(agency.tva)
  if (declaredVat !== null && EU_VIES_COUNTRY_CODES.has(declaredVat.slice(0, 2))) return 'vies'

  const country = declaredHeadOfficeCountry(agency)
  if (country === null) return null
  return UID_REGISTRY_COUNTRIES.has(country) ? 'uid_register' : 'vies'
}

const vatLookupSource: KybSource = {
  checkType: 'vat_lookup',
  source: 'vies',
  appliesTo: (agency) => vatLookupOwner(agency) === 'vies',
  run: runVatLookup,
}

// ─── Connecteur registre francais (registry_lookup / registry_legal_name_match /
//     registry_country_match, tache 3) ───────────────────────────────────────────
//
// recherche-entreprises.api.gouv.fr : public, sans cle, sans compte, 7 requetes/
// seconde (brief tache 3 ; doc de conception docs/agency-kyb-verification.md §3).
// Ne s'interroge QUE pour un siege en France (agency.country === 'FR') -- la Suisse a
// desormais ses propres sources de registre (Zefix par LINDAS, chantier LINDAS tache 2),
// le Liechtenstein n'a toujours aucune API publique connue (meme doc).
//
// TROIS check_type distincts pour UNE seule source (meme motif que
// domain_whois_age/domain_generic_provider a la tache 2, revue etape 4/tache 2 point
// 2) : le catalogue (verification_check_types, migration 20260728103000) distingue
// registry_lookup (existence + statut actif, un seul type pour les deux -- meme
// libelle catalogue), registry_legal_name_match (raison sociale) et
// registry_country_match (juridiction), CHACUN etant un veto d'entite independant
// (doc de conception §2.A). Une seule ligne KybSourceResult ne peut porter qu'UN
// check_type (voir KybSourceResult.check_type plus haut) -- impossible de renvoyer
// plusieurs verdicts en un seul appel de connecteur. D'ou TROIS entrees dans
// AGENCY_KYB_SOURCES, chacune interrogeant independamment le meme point d'API
// (couplage accepte : 7 req/s suffit largement a trois appels par verification, non
// par seconde).
//
// POURQUOI registry_country_match EST ICI ALORS QUE L'ETAPE 4 L'AVAIT ECARTE. Cette
// section a longtemps porte l'arbitrage inverse : ce connecteur n'interrogeant QUE des
// sieges deja declares en France, une reponse positive n'aurait
// fait que confirmer trivialement ce qui avait filtre l'appel. Le chantier LINDAS
// (tache 2) a tranche l'INVERSE pour la Suisse, et l'argument y est meilleur : le filtre
// de juridiction dit d'ou vient la QUESTION, jamais que la REPONSE est acquise. Une
// agence francaise peut parfaitement declarer un numero que le registre francais ne
// porte pas ; trouver le numero declare DANS LE REGISTRE DE LA JURIDICTION DECLAREE est
// donc la seule chose qui distingue « cette entite est immatriculee en France » de
// « cette agence pretend etre francaise ». Tenir les deux raisonnements a la fois etait
// intenable -- et laissait la France seule non auto-validable, pour un motif que plus
// personne ne defendait.
//
// CE QUE CE VETO NE FAIT PAS, et c'est ce qui l'empeche d'etre un doublon : il ne lit
// JAMAIS etat_administratif. Une entreprise radiee reste une entreprise immatriculee en
// France -- la juridiction ne depend d'aucun statut, contrairement a registry_lookup.
// Symetriquement, un SIREN introuvable ne s'ecrit PAS `mismatch` ici mais leve, donc
// `unavailable` : l'absence est deja le `mismatch` de registry_lookup, et la reporter
// ferait compter DEUX fois le meme constat sur deux vetos que la conception veut
// independants (meme arbitrage, mot pour mot, que runZefixRegistryCountryMatch).
//
// Le quatrieme veto d'entite, registry_number_format, a lui aussi son connecteur --
// section « Controle du numero de registre » juste apres celle-ci. C'est une source a
// part (`internal`), jamais une extension de celle-ci : il ne lit pas le registre
// francais, il calcule. Les QUATRE vetos d'entite ont donc desormais, pour la France, un
// proprietaire qui repond ET qui peut valoir `match` -- ce qui n'est vrai d'aucun autre
// pays (la Suisse bute sur le plafond de registry_lookup, voir la section LINDAS).

/** Etat administratif INSEE/RNE rencontre en reconnaissance manuelle (voir rapport de
 *  tache) : 'A' = actif. Tout le reste (notamment 'C' = cesse) contredit une agence
 *  qui se pretend en activite -- meme logique que le statut RDAP non rassurant sur un
 *  domaine etabli (classifyDomain plus haut). */
const FRENCH_REGISTRY_ACTIVE_STATUS = 'A'

/** Extrait un SIREN exploitable depuis business_registration_number, par la MEME lecture
 *  que le controle de la cle (registry_number_format, section plus bas) : les seuls
 *  separateurs de SAISIE sont retires (normalizeRegistryNumber, `[\s.-]` -- "510 761 505"
 *  et "510.761.505" sont des formes d'affichage officielles INSEE), puis FRENCH_SIREN_RE
 *  exige neuf chiffres et RIEN d'autre. Les deux sont declarees plus bas, avec ce
 *  controle : c'est deliberement le meme point de normalisation, pas une copie -- deux
 *  lectures du meme champ finissent par diverger, et ce module condamne cette divergence
 *  ailleurs.
 *
 *  Ce que cette lecture refuse et que la precedente acceptait (revue finale de branche,
 *  point 4) : elle retirait TOUTES les non-chiffres, si bien que "CHE-123456782" se lisait
 *  ici comme le SIREN 123456782 (present a l'index, cle de Luhn valide -- verifie en
 *  direct) alors que le controle de cle, lui, voyait "CHE123456782" et sortait
 *  `unavailable`. Meme champ, deux lectures : registry_country_match posait un `match` sur
 *  une entite derivee d'un numero de forme SUISSE, dans un dossier declare francais.
 *
 *  Leve TOUJOURS plutot que de choisir `unavailable` elle-meme (meme discipline que
 *  extractRdapDomain et extractZefixUid) : runKybSource() se charge de traduire un throw
 *  en `unavailable`. */
function extractSiren(businessRegistrationNumber: string | null): string {
  const raw = businessRegistrationNumber?.trim()
  if (!raw) throw new Error('recherche-entreprises: no business_registration_number declared')
  const normalized = normalizeRegistryNumber(raw)
  if (!FRENCH_SIREN_RE.test(normalized)) {
    throw new Error(`recherche-entreprises: unparseable SIREN "${raw}"`)
  }
  return normalized
}

/** Ligatures latines PROPRES AU FRANCAIS -- ni Œ/œ ni Æ/æ n'ont de decomposition
 *  canonique Unicode (verifie : 'Œ'.normalize('NFD') rend 'Œ' inchange), donc NFD
 *  ci-dessous ne les reduit JAMAIS a leurs deux lettres composantes, contrairement a
 *  un accent ordinaire (e accentue -> e + accent combinant, lui bien decompose).
 *  Œ/œ (sœur, cœur, bœuf, nœud, vœu, œuvre...) est le cas frequent en raison sociale
 *  francaise ; Æ/æ (ex æquo, curriculum vitæ) en est le voisin direct -- meme famille
 *  de probleme Unicode, traitee de la meme facon (revue etape 4/tache 3, point 2 :
 *  chercher les ligatures voisines plutot que de ne traiter que le seul cas signale).
 *  Cles en MINUSCULE uniquement : la fonction s'applique APRES toLowerCase(), qui
 *  replie deja Œ/Æ sur œ/æ (pliage de casse Unicode standard pour cette paire,
 *  verifie en direct). Volontairement LIMITE a ces deux ligatures "linguistiques" --
 *  les ligatures typographiques (fi/fl...) sont un artefact de rendu de police, pas
 *  une variante orthographique du francais ; les inclure irait au-dela de
 *  "accents...toleres" (doc de conception §2.A) que ce correctif vise a honorer
 *  fidelement, pas a elargir. */
const FRENCH_LIGATURES: Readonly<Record<string, string>> = {
  'œ': 'oe',
  'æ': 'ae',
}
const FRENCH_LIGATURE_RE = /[œæ]/g

function expandFrenchLigatures(s: string): string {
  return s.replace(FRENCH_LIGATURE_RE, (char) => FRENCH_LIGATURES[char])
}

/** Normalisation stricte pour le rapprochement de raison sociale : accents et casse
 *  toleres (NFD + suppression des diacritiques, minuscules, ligatures francaises
 *  reduites -- voir expandFrenchLigatures ci-dessus), PONCTUATION toleree en la
 *  supprimant sans laisser de trace ("S.A." et "SA" doivent matcher) -- mais l'ESPACE
 *  (et le tiret, equivalent : "Dupont-Martin" et "Dupont Martin" doivent matcher)
 *  reste une FRONTIERE DE MOT, jamais une simple ponctuation : un ou plusieurs
 *  caracteres de cette classe valent UN espace, JAMAIS rien (revue etape 4/tache 3,
 *  point 2). Avant ce correctif l'espace disparaissait exactement comme n'importe
 *  quelle ponctuation (aucune trace, aucune frontiere) -- deux decoupages de mots
 *  differents pouvaient alors coincider : "Est Immobilier" et "ESTIM MOBILIER" se
 *  reduisaient tous deux a "estimmobilier", un faux positif sur deux raisons sociales
 *  reellement distinctes. Volontairement SANS tolerance au-dela (doc de conception
 *  §2.A : "rien d'autre") -- ce n'est PAS le rapprochement approximatif
 *  (Jaro-Winkler) reserve a trade_name (voir l'en-tete RDAP plus haut) : deux raisons
 *  sociales qui different par autre chose qu'accent/casse/ponctuation/ligature
 *  doivent rester un mismatch. */
function normalizeLegalNameStrict(s: string): string {
  const lowered = s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  return expandFrenchLigatures(lowered)
    .replace(/[\s-]+/g, ' ')
    .trim()
    .replace(/[^\p{L}\p{N} ]/gu, '')
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

/** Appelle recherche-entreprises.api.gouv.fr par SIREN (le parametre `q` accepte un
 *  identifiant numerique en recherche directe -- verifie en direct : `q=510761505` rend UN
 *  seul resultat, CARREFOUR, la ou une recherche par nom en rend une page entiere
 *  -- `q=l'oreal` : 321 resultats, dont le premier porte le SIREN 632012100. C'est cet
 *  ecart-la qui rend la recherche par numero exploitable, pas une quelconque egalite entre
 *  les deux formes de requete).
 *  GARANTIT a ses trois appelants que le premier resultat, s'il y en a un, porte bien le
 *  SIREN demande -- voir la garde d'identite plus bas : `q=` reste une recherche plein
 *  texte. Ne catche RIEN elle-meme (non-2xx, JSON illisible, corps hors schema, resultat
 *  d'une autre entite) -- meme discipline que le connecteur RDAP, runKybSource() traduit
 *  tout ecart en `unavailable`. */
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

  // L'IDENTITE du resultat retenu est VERIFIEE, jamais supposee. `q=` est une recherche
  // PLEIN TEXTE : rien dans le contrat de l'API ne promet que le premier resultat porte le
  // SIREN demande. Sonde en direct (8 requetes a neuf chiffres -- SIREN reel, inexistant,
  // Luhn-invalide, 123456789, 999999999), le service le rend toujours ; mais c'est une
  // propriete du TIERS, qui peut changer sans nous prevenir, pas une propriete du code. Le
  // pendant suisse, lui, ne PEUT pas se tromper d'entite : il lie l'UID exactement dans le
  // litteral SPARQL (`schema:value "${uid}"`), son rapprochement est exact par construction.
  // On rend donc l'invariant local ici, en un seul point, pour les trois connecteurs.
  //
  // On LEVE -- donc `unavailable` via runKybSource() -- plutot que de conclure sur une
  // entite qu'on n'a pas demandee. JAMAIS `mismatch` : se tromper d'entite n'est pas
  // constater que l'entite declaree est fausse. L'enjeu a change avec la concordance de pays
  // francaise : les QUATRE vetos d'entite ont desormais, pour la France, un proprietaire qui
  // peut valoir `match`, si bien qu'un dossier francais complet n'attend plus qu'une decision
  // humaine sur la piece d'identite -- un verdict pris sur la mauvaise entite ne serait plus
  // rattrape par un autre veto.
  //
  // Une liste VIDE ne passe pas par ici, et c'est voulu : elle reste l'information positive
  // « ce SIREN n'existe pas », que registry_lookup ecrit en `mismatch`.
  const first = body.results[0]
  if (first !== undefined && first.siren !== siren) {
    throw new Error(
      `recherche-entreprises: le resultat rendu porte le SIREN ${first.siren ?? '(absent)'}, ` +
        `pas le ${siren} demande -- aucune conclusion possible sur une autre entite`
    )
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
  // Une raison sociale sans lettre ni chiffre ("-", ".", "&", "@@@") se reduit a la chaine
  // VIDE apres normalizeLegalNameStrict : il ne reste alors RIEN a comparer. On leve avant
  // l'appel reseau -- interroger le registre ne rendrait pas comparable ce qui ne l'est
  // pas (revue finale de branche, point 1 ; meme garde cote suisse).
  const normalizedDeclared = normalizeLegalNameStrict(declaredName)
  if (normalizedDeclared === '') {
    throw new Error(
      `recherche-entreprises: la raison sociale declaree "${declaredName}" ne porte ni lettre ni chiffre, rien a comparer`
    )
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

  // « AUCUN NOM AU REGISTRE » N'EST PAS « LE NOM CONCORDE » (revue finale de branche,
  // point 1). `??` ne rattrape que null/undefined : un enregistrement dont les DEUX champs
  // de nom sont nuls donnait `registryName = ''`, et l'egalite tenait alors face a toute
  // raison sociale declaree qui se reduit elle aussi a vide -- le veto PASSAIT sur une
  // comparaison de deux chaines vides, c'est-a-dire sur aucune preuve. Le cas d'entree est
  // reel : q=123456789, q=333333333 et q=999999999 rendent chacun un enregistrement
  // `{nom_raison_sociale: null, nom_complet: null}` (mesure en direct le 29.07.2026). On
  // leve, donc `unavailable` -- jamais `mismatch` : l'entite EXISTE au registre, c'est sa
  // seule raison sociale qui n'y est pas lisible, et registry_lookup porte deja, pour son
  // propre check_type, ce que le registre dit de son existence. Meme arbitrage et meme
  // formulation que runZefixRegistryLegalNameMatch (`legalNames.length === 0`).
  const registryName = result.nom_raison_sociale ?? result.nom_complet ?? ''
  const normalizedRegistry = normalizeLegalNameStrict(registryName)
  if (normalizedRegistry === '') {
    throw new Error(`recherche-entreprises: aucune raison sociale au registre pour ${siren}, rien a comparer`)
  }

  const isMatch = normalizedDeclared === normalizedRegistry
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

async function runRegistryCountryMatch(agency: AgencyForVerification, signal: AbortSignal): Promise<KybSourceResult> {
  if (agency.country !== 'FR') {
    throw new Error('recherche-entreprises: siege hors France, source non interrogee')
  }
  const siren = extractSiren(agency.business_registration_number)
  const body = await fetchFrenchRegistry(siren, signal)
  const result = body.results?.[0]

  if (!result) {
    // Rien a opposer au pays declare. L'absence elle-meme est deja le `mismatch` de
    // registry_lookup ; la reporter ici ferait compter DEUX fois le meme constat, sur deux
    // vetos que la conception veut independants (meme arbitrage que
    // runZefixRegistryCountryMatch).
    throw new Error(`recherche-entreprises: ${siren} absent du registre francais, aucune juridiction a comparer`)
  }

  // Trouve au registre du commerce FRANCAIS : l'entite y est immatriculee, et c'est
  // exactement ce que ce veto oppose au pays declare. `etat_administratif` n'est
  // deliberement PAS lu -- une entreprise radiee reste une entreprise immatriculee EN
  // FRANCE. Le statut est l'affaire de registry_lookup, et lui faire porter les deux
  // questions ferait de ce veto-ci son doublon.
  return {
    result: 'match',
    raw_response: {
      siren,
      declared_country: agency.country,
      registry_country: 'FR',
      recherche_entreprises: body,
    },
  }
}

/** Juridiction commune aux TROIS connecteurs du registre francais (meme predicat, trois
 *  check_type distincts), testee ici AVANT execution : c'est ce qui laisse le check_type
 *  libre pour Zefix sur un siege suisse. Leurs gardes internes restent en place :
 *  runAgencyKybSources() peut recevoir la source sans etre passee par
 *  selectApplicableSources(), son contrat le permet.
 *
 *  Ce predicat ne teste PAS tout a fait la meme valeur que ces gardes internes : il lit
 *  declaredHeadOfficeCountry() (trim + majuscules) la ou runRegistryLookup,
 *  runRegistryLegalNameMatch et runRegistryCountryMatch comparent `agency.country !== 'FR'`
 *  BRUT. L'ecart est reel (` fr ` satisfait le predicat et fait lever la garde interne)
 *  mais il ne peut pas couter un verdict, PARCE QU'IL VA DANS CE SENS-LA : tout siege
 *  que la garde interne laisse passer (`'FR'` exactement) satisfait aussi le predicat, donc
 *  selectApplicableSources() n'ecarte jamais une source qui avait quelque chose a
 *  repondre. Le seul cas couvert par le predicat et refuse par la garde produit un
 *  `unavailable` -- exactement ce que ces connecteurs produisaient deja sur cette saisie
 *  avant l'etape 6. Aligner les deux lectures reste souhaitable ; ce n'est pas ce qui
 *  fonde l'exclusivite du check_type (voir vatLookupOwner : un point de decision unique).
 */
function hasFrenchHeadOffice(agency: AgencyForVerification): boolean {
  return declaredHeadOfficeCountry(agency) === 'FR'
}

const registryLookupSource: KybSource = {
  checkType: 'registry_lookup',
  source: 'recherche_entreprises',
  appliesTo: hasFrenchHeadOffice,
  run: runRegistryLookup,
}

const registryLegalNameMatchSource: KybSource = {
  checkType: 'registry_legal_name_match',
  source: 'recherche_entreprises',
  appliesTo: hasFrenchHeadOffice,
  run: runRegistryLegalNameMatch,
}

/** MEME `appliesTo` que ses deux voisines, et c'est ce qui rend l'exclusivite avec
 *  zefixRegistryCountryMatchSource une propriete du code : les deux proprietaires du type
 *  se decident sur le MEME point (declaredHeadOfficeCountry), qui ne peut pas rendre 'FR'
 *  et 'CH' a la fois. */
const registryCountryMatchSource: KybSource = {
  checkType: 'registry_country_match',
  source: 'recherche_entreprises',
  appliesTo: hasFrenchHeadOffice,
  run: runRegistryCountryMatch,
}

// ─── Controle du numero de registre (registry_number_format, chantier LINDAS
//     tache 1) ────────────────────────────────────────────────────────────────
//
// Le seul des quatre vetos d'entite qui ne depende d'AUCUN tiers : la cle de controle
// d'un numero de registre se calcule. Pas de reseau, pas de cle, pas de quota -- d'ou
// une source `internal` (valeur ouverte par la migration 20260729160000) et non
// `manual` : `manual` designe une saisie HUMAINE, et un relecteur qui verrait `manual`
// sur un check calcule croirait qu'un humain l'a pose. Sur une piste d'audit LAB, c'est
// un contresens.
//
// AUCUNE JURIDICTION DECLAREE (pas d'`appliesTo`), et c'est un choix, pas un oubli.
// Trois raisons, dans cet ordre :
//
//   1. Ce connecteur est SEUL proprietaire de registry_number_format. `appliesTo`
//      n'existe que pour rendre impossible la collision de deux sources sur un meme
//      check_type (voir « Juridiction d'une source » plus haut) -- il n'y a rien a
//      departager ici, exactement comme pour RDAP et le geocodage.
//   2. Ecarter une source SUPPRIME sa ligne. Sur un pays dont on ne sait pas lire le
//      numero, le dossier n'aurait alors plus rien qui dise POURQUOI ce veto n'est pas
//      satisfait -- alors que le principe directeur de tout le chantier veut une ligne
//      `unavailable` avec sa raison, jamais un silence. Le cout d'ecrire cette ligne est
//      nul : le moteur (20260728130000) fait echouer un veto `unavailable` exactement
//      comme un veto absent.
//   3. Un predicat de plus serait un second point de decision a tenir d'accord avec ce
//      que `run` lit vraiment -- la faute exacte que la revue finale de l'etape 6 a du
//      corriger sur vat_lookup (« Qui possede vat_lookup » plus haut).
//
// La juridiction vit donc DANS le calcul : CH (IDE) et FR (SIREN), les deux seuls
// registres dont ce depot connaisse la cle. Tout le reste leve -- pays non couvert,
// numero absent, forme illisible -- et runKybSource() traduit ces levees en
// `unavailable`. JAMAIS `mismatch` : ne pas savoir lire un numero n'est pas constater
// qu'il est faux, et ce check-ci BLOQUE un dossier. `mismatch` est reserve au seul cas
// ou la forme est parfaitement lisible et ou la cle, elle, ne tombe pas.
//
// Ce que ce check ne fait PAS : verifier que le numero EXISTE au registre
// (registry_lookup), que la raison sociale correspond (registry_legal_name_match), ni
// que le pays declare est bien celui du registre (registry_country_match). Un numero
// bien forme peut n'avoir jamais ete attribue -- d'ou QUATRE vetos d'entite et non un
// seul, dont celui-ci est le moins couteux et le moins concluant a la fois.
// Corollaire assume : un SIREN declare par un dossier suisse leve ici (il n'a pas la
// forme attendue de la juridiction declaree) plutot que d'etre valide comme SIREN ; la
// concordance pays/registre appartient a registry_country_match, jamais a ce calcul.

/** Poids de la cle de controle de l'IDE suisse, appliques aux HUIT premiers chiffres
 *  (le neuvieme EST la cle). Eprouve sur 200 UID reels tires du graphe Zefix de LINDAS :
 *  200 valides, 0 rejete a tort, et aucune des 16 200 alterations d'un seul chiffre
 *  acceptee -- voir .superpowers/sdd/task-1-report.md. */
const SWISS_UID_WEIGHTS: readonly number[] = [5, 4, 3, 2, 7, 6, 5, 4]

/** Separateurs de la saisie humaine, retires avant tout calcul : une agence saisit
 *  `CHE-105.909.036` ou `510 761 505` (formes d'affichage officielles), la ou les
 *  registres publient `CHE105909036` et `510761505`. */
const REGISTRY_NUMBER_SEPARATORS_RE = /[\s.-]/g

/** Formes STRICTES, verifiees AVANT le calcul de la cle -- c'est cette verification-la,
 *  et elle seule, qui distingue « illisible » (leve -> unavailable) de « cle fausse »
 *  (mismatch). Sans separateur : les deux motifs s'appliquent au numero deja normalise. */
const SWISS_UID_RE = /^CHE\d{9}$/
const FRENCH_SIREN_RE = /^\d{9}$/

/** Les deux juridictions dont ce depot connait la cle de controle. Pas de liste a
 *  maintenir ailleurs : le pays retenu ici decide AUSSI de la forme attendue et de
 *  l'algorithme, en un seul point. */
const REGISTRY_NUMBER_FORMAT_COUNTRIES: ReadonlySet<string> = new Set(['CH', 'FR'])

function normalizeRegistryNumber(raw: string): string {
  return raw.replace(REGISTRY_NUMBER_SEPARATORS_RE, '').toUpperCase()
}

/**
 * Cle de controle de l'IDE suisse (CHE + 9 chiffres). `false` aussi bien sur une forme
 * illisible que sur une cle fausse : c'est le CONNECTEUR qui distingue les deux, cette
 * fonction repond seulement « est-ce un IDE valide ? ». Ne leve jamais.
 *
 * Somme ponderee des huit premiers chiffres modulo 11, cle = 11 - reste. Deux cas de
 * bord que des numeros reels n'exercent jamais, et qui sont pourtant la moitie de
 * l'algorithme : un reste de 1 donnerait une cle de 10, qui ne tient pas sur un chiffre
 * -- le registre n'emet donc JAMAIS un tel numero, il est invalide quel que soit son
 * dernier chiffre ; un reste de 0 donne 11, qui vaut 0.
 */
export function isValidSwissUid(raw: string): boolean {
  const cleaned = normalizeRegistryNumber(raw)
  if (!SWISS_UID_RE.test(cleaned)) return false

  const digits = cleaned.slice(3)
  let sum = 0
  for (let i = 0; i < SWISS_UID_WEIGHTS.length; i++) {
    sum += Number(digits[i]) * SWISS_UID_WEIGHTS[i]
  }
  const key = 11 - (sum % 11)
  // Une cle de 10 ne tient pas sur un chiffre : le registre n'emet jamais un tel numero.
  // Garde volontairement REDONDANTE (revue : elle est morte, aucun test ne la couvre et
  // la retirer ne change rien) -- `digits[8]` vient de SWISS_UID_RE, donc de [0,9], et la
  // comparaison finale rejetterait deja une cle de 10. Conservee parce qu'elle enonce la
  // regle du registre a l'endroit ou on la cherche, plutot que de la laisser deduire
  // d'une inegalite. La supprimer serait aussi correct ; la commenter faussement, non.
  if (key === 10) return false
  return (key === 11 ? 0 : key) === Number(digits[8])
}

/**
 * Cle de controle du SIREN francais (9 chiffres, Luhn). Meme contrat que
 * isValidSwissUid : `false` sur une forme illisible comme sur une cle fausse, jamais de
 * levee.
 *
 * AUCUN traitement particulier pour La Poste, contre-exemple classique que tout le monde
 * recopie : son SIREN `356000000` PASSE Luhn -- verifie en direct contre
 * recherche-entreprises. L'exception francaise porte sur le SIRET de ses etablissements,
 * jamais sur le SIREN. Coder cette exception ici ouvrirait un trou : n'importe quel
 * numero fabrique pourrait s'en reclamer.
 */
export function isValidFrenchSiren(raw: string): boolean {
  const cleaned = normalizeRegistryNumber(raw)
  if (!FRENCH_SIREN_RE.test(cleaned)) return false

  let sum = 0
  for (let i = 0; i < cleaned.length; i++) {
    let digit = Number(cleaned[i])
    // Un rang sur deux EN PARTANT DE LA DROITE est double (Luhn) : sur neuf chiffres, ce
    // sont les rangs de gauche pairs -- d'ou le calcul de la position depuis la fin
    // plutot qu'une parite d'index, qui dependrait de la longueur.
    if ((cleaned.length - i) % 2 === 0) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return sum % 10 === 0
}

/** Ne recoit pas de `signal` : aucune requete a annuler, ce connecteur ne sort pas du
 *  processus. Les squelettes plus bas ont la meme signature reduite, pour une raison
 *  differente (eux n'ont pas encore de connecteur du tout). Leve TOUJOURS plutot que de
 *  choisir `unavailable` lui-meme -- discipline du module, voir KybSourceResult. */
async function runRegistryNumberFormat(agency: AgencyForVerification): Promise<KybSourceResult> {
  const country = declaredHeadOfficeCountry(agency)
  if (country === null || !REGISTRY_NUMBER_FORMAT_COUNTRIES.has(country)) {
    throw new Error(
      `registry_number_format: juridiction "${country ?? 'non declaree'}" non couverte (CH et FR seulement)`
    )
  }

  const declared = agency.business_registration_number?.trim()
  if (!declared) throw new Error('registry_number_format: aucun numero de registre declare')

  const normalized = normalizeRegistryNumber(declared)
  const swiss = country === 'CH'
  if (!(swiss ? SWISS_UID_RE : FRENCH_SIREN_RE).test(normalized)) {
    // Illisible, donc rien a conclure -- pas meme un doute defavorable. Le message dit ce
    // qui etait attendu : devant un `unavailable`, un relecteur de la file admin doit
    // pouvoir corriger la saisie sans ouvrir le code.
    throw new Error(
      `registry_number_format: "${declared}" n'a pas la forme d'un ` +
        `${swiss ? 'IDE suisse (CHE + 9 chiffres)' : 'SIREN francais (9 chiffres)'}`
    )
  }

  const valid = swiss ? isValidSwissUid(normalized) : isValidFrenchSiren(normalized)
  return {
    result: valid ? 'match' : 'mismatch',
    raw_response: {
      declared,
      normalized,
      jurisdiction: country,
      // La preuve d'un check CALCULE, c'est le calcul : ce qui a ete lu, sous quelle
      // regle, et ce qu'elle a donne. Un relecteur doit pouvoir le refaire a la main.
      scheme: swiss ? 'IDE suisse (CHE, cle modulo 11)' : 'SIREN francais (Luhn)',
      check_digit_valid: valid,
    },
  }
}

export const registryNumberFormatSource: KybSource = {
  checkType: 'registry_number_format',
  source: 'internal',
  run: runRegistryNumberFormat,
}

// ─── Connecteur geocodage Mapbox (address_geocode, tache 3) ────────────────────
//
// Mapbox est deja dans la pile (frontend, VITE_MAPBOX_TOKEN -- src/lib/mapbox.ts,
// Step2Address.tsx). Reutilise la MEME configuration que ces deux fichiers (endpoint
// Geocoding v5, meme jeton VITE_MAPBOX_TOKEN) plutot que d'en introduire une nouvelle
// (brief tache 3). `context[].id`/`short_code` (region/country) est le schema que
// Mapbox documente lui-meme pour la Geocoding API v5 (context object) -- CE CHOIX-LA
// repose sur cette documentation fournisseur, PAS sur une reprise de code existant
// (corrige revue etape 4/tache 3, point 4 : la justification precedente affirmait a
// tort que Step2Address.tsx consommait deja `id`/`short_code`). Ce fichier lit bien
// `context[].id` sur les memes entrees (chooseSuggestion()), mais pour leur `.text`
// -- postcode/place/region -- jamais `short_code` ; son canton s'y derive PAR NOM
// (cantonShortFromName(), voir ../tokens), pas par ce champ. Le jeton est TOUJOURS
// injecte en parametre, jamais lu de l'env ici
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
      // Garde de forme (meme defaut, meme remede que le registre francais plus haut --
      // fetchFrenchRegistry -- revue etape 4/tache 3, point 3) : HTTP 200 ne garantit
      // pas la forme. `features` absent ou d'un type inattendu n'est PAS la meme chose
      // que "zero resultat" -- ce dernier EST une information (Mapbox a cherche et n'a
      // rien trouve, classifyGeocode le traduit deja en `partial` ci-dessous), l'autre
      // est une non-reponse qui ne doit jamais se lire comme un zero resultat par
      // defaut. Toute forme hors schema leve ici -> unavailable via runKybSource().
      // Connecteur non veto (signal moyen, doc de conception §2.B) donc moins critique
      // que le registre francais, mais meme remede applique par coherence.
      if (!Array.isArray(body.features)) {
        throw new Error('mapbox: unexpected response shape (features is not an array)')
      }
      const feature = body.features[0]
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

// ─── Sources en attente d'identifiants (etape 6) ──────────────────────────────
//
// Cette machinerie servait DEUX squelettes ; il n'en reste qu'UN, celui du registre UID.
// Le squelette Zefix, qui l'employait pour ses trois check_type, a disparu au profit d'un
// connecteur reel (chantier LINDAS, tache 2 -- section « Connecteur Zefix par LINDAS »
// plus bas) : le registre du commerce suisse est publie sans authentification, il n'y a
// plus d'identifiants a attendre pour l'interroger. Ce qui reste suspendu a
// zefix@bj.admin.ch n'est plus une SOURCE mais un CHAMP, le statut actif/radie, et il se
// greffera dans ce connecteur-la, pas ici.
//
// Deux erreurs, et c'est le coeur de ce squelette plutot qu'un detail : elles
// appellent deux GESTES DIFFERENTS. `KybSourcePendingCredentialsError` attend une
// reponse d'un tiers, hors de ce depot ; `KybSourceNotWiredError` dit que les secrets
// sont poses et que c'est du CODE qui manque -- la seule des deux qui se corrige ici.
// Les confondre en une seule erreur ferait de la seconde situation un `unavailable`
// silencieux et PERMANENT : celui qui vient de poser les secrets verrait le dossier
// rester exactement comme avant, sans aucun signal reliant l'un a l'autre.
//
// Le nom porte par ces classes n'est pas cosmetique : describeSourceFailure() (plus bas)
// ne lit QUE `err.name` pour remplir `raw_response.error_type`, et c'est ce champ-la que
// lit un relecteur de la file admin. Sans le `this.name = ...` explicite de chaque
// constructeur, `name` vaudrait 'Error' (herite) et les deux cas deviendraient
// indistinguables dans la piece d'audit -- meme discipline que KybSourceTimeoutError.

/** La configuration manque : la source ne PEUT PAS etre interrogee, et le geste attendu
 *  n'est pas dans ce depot (voir docs/agency-kyb-handoff.md §8 pour l'etat des demandes
 *  en cours). Cas nominal d'aujourd'hui pour le registre UID, seule source du fichier
 *  encore dans cette situation. */
export class KybSourcePendingCredentialsError extends Error {
  constructor(label: string) {
    super(`${label}: en attente d'identifiants, source non interrogee (voir docs/agency-kyb-handoff.md §8)`)
    this.name = 'KybSourcePendingCredentialsError'
  }
}

/** La configuration EST presente, mais le connecteur n'a jamais ete ecrit. Signale a
 *  celui qui vient de poser les secrets que le travail restant est du code, ici -- sans
 *  ce garde-fou, il ne verrait qu'un `unavailable` identique a celui de la veille. */
export class KybSourceNotWiredError extends Error {
  constructor(label: string) {
    super(`${label}: identifiants presents mais connecteur non ecrit -- reste a brancher (URL, authentification, parsing)`)
    this.name = 'KybSourceNotWiredError'
  }
}

/** Configuration d'une source dont les identifiants ne sont pas encore obtenus. Les deux
 *  champs sont vides aujourd'hui, et pour deux raisons distinctes : `credential` parce
 *  que la demande est sans reponse, `baseUrl` parce qu'on ne connait PAS l'URL a appeler
 *  -- un 401 apprend qu'un service existe et exige une authentification, jamais a quoi
 *  ressemble un appel autorise. Ecrire ici une URL « la plus probable » se paierait le
 *  jour J : une URL fausse se decouvre en production, une valeur vide se decouvre a la
 *  lecture. Lus depuis Deno.env par agency-verification-run/index.ts et injectes ici en
 *  parametre -- ce module reste pur (voir son en-tete). */
export interface PendingSourceConfig {
  baseUrl: string
  credential: string
}

/**
 * Construit UNE source dont le connecteur reste a ecrire. Fabrique INTERNE, PARAMETREE
 * plutot que recopiee : elle servait trois sources Zefix ET celle du registre UID, et ce
 * qui reste a ecrire le jour ou les identifiants arrivent (URL, authentification, analyse
 * de la reponse) ne devait exister qu'a UN SEUL endroit. Un seul appelant lui reste
 * aujourd'hui (createUidRegisterSources) -- Zefix a trouve une voie publique et n'attend
 * plus rien. Conservee telle quelle : sa valeur n'a jamais tenu au NOMBRE d'appelants mais
 * a la discipline qu'elle impose (deux erreurs distinctes, aucun secret dans le message,
 * aucune requete construite), et la replier dans son unique appelant ferait perdre cette
 * discipline au prochain squelette.
 *
 * `run` ne recoit deliberement ni `agency` ni `signal` : il n'y a rien a lire dans le
 * dossier ni rien a annuler tant qu'aucune requete n'est construite. Le jour ou une source
 * qu'elle sert est ecrite, celle-ci reprend la signature complete du contrat KybSource et
 * quitte cette fabrique -- c'est exactement ce que les trois sources Zefix viennent de
 * faire, une transition source par source, sans rien casser.
 *
 * Ni le credential ni la baseUrl n'entrent JAMAIS dans le message d'erreur : le premier
 * est un secret, et la seconde peut en porter un en parametre de requete (le connecteur
 * Mapbox de ce meme fichier en est la demonstration). describeSourceFailure() recopie
 * `.message` tel quel dans la piece d'audit -- la seule protection possible est ici.
 */
function createPendingCredentialsSource(params: {
  checkType: string
  source: string
  /** Ce que la source apportera, en clair -- c'est ce que lira un relecteur de la file
   *  admin devant un `unavailable`, jamais le nom d'une variable d'environnement. */
  label: string
  appliesTo: (agency: AgencyForVerification) => boolean
  config: PendingSourceConfig
}): KybSource {
  const { checkType, source, label, appliesTo, config } = params
  return {
    checkType,
    source,
    appliesTo,
    run: async (): Promise<KybSourceResult> => {
      // trim() : une variable d'environnement posee a "   " est vide en pratique ; la
      // traiter comme configuree ferait mentir le garde-fou dans la direction la plus
      // couteuse (« du code manque » alors qu'il manque un identifiant).
      if (!config.baseUrl.trim() || !config.credential.trim()) {
        throw new KybSourcePendingCredentialsError(label)
      }
      throw new KybSourceNotWiredError(label)
    },
  }
}

// ─── Connecteur Zefix par LINDAS (registry_lookup / registry_legal_name_match /
//     registry_country_match, chantier LINDAS tache 2) ─────────────────────────
//
// Zefix (Zentraler Firmenindex) est LE registre du marche vise. Son API PublicREST repond
// `401 Unauthorized` (verifie en direct le 25.07.2026, doc de conception §3) et les
// identifiants demandes a zefix@bj.admin.ch sont sans reponse -- c'est ce qui avait reduit
// l'etape 6 a un squelette. UNE VOIE PUBLIQUE existe pourtant, et c'est elle qu'on emprunte
// ici : LINDAS, l'entrepot de donnees liees de la Confederation, publie le graphe Zefix
// <https://lindas.admin.ch/foj/zefix> en SPARQL, sans aucune authentification. Ce depot s'en
// servait deja (scripts/zefix-enrich-agencies.mjs, qui l'avait choisi contre PublicREST
// « qui exige des identifiants OFJ + throttle »).
//
// Consequence de forme : ces trois sources n'ont besoin d'AUCUN secret, donc d'aucune
// fabrique appelee depuis agency-verification-run/index.ts. Ce sont des entrees STATIQUES
// de AGENCY_KYB_SOURCES, comme RDAP, VIES et le registre francais.
//
// CE QUE LE GRAPHE NE PORTE PAS, ET CE QUE CA COUTE. Les predicats d'une entite Zefix dans
// LINDAS sont, mesures en direct sur CHE105909036 : legalName, name, address, municipality,
// additionalType, description, identifier. AUCUN STATUT. Une societe radiee y figure
// exactement comme une active. `registry_lookup` ne peut donc JAMAIS valoir `match` :
// `match` signifierait « existe ET active » sur une preuve qui n'en porte que la moitie.
// Present dans le graphe -> `partial` ; absent -> `mismatch` (le registre a repondu, ce
// numero n'y est pas : c'est decisif, meme motif que le 404 RDAP et le `results:[]` du
// registre francais). Un veto ne passe que sur `match` (recompute_agency_verification,
// 20260729151200) : la Suisse reste donc non auto-validable, mais pour une raison desormais
// precise et mesuree -- verifiee en base, pas supposee, par la paire de tests
// « un dossier suisse autrement parfait ... reste en manual_review » de
// tests/backend/agency-verification-run.spec.ts.
//
// C'EST ICI, ET NULLE PART AILLEURS, QUE L'APPEL REST ZEFIX VIENDRA SE GREFFER le jour ou
// les identifiants arrivent. PublicREST apporte le STATUT, et rien d'autre que LINDAS ne
// donne deja : seul `runZefixRegistryLookup` ci-dessous change alors, et ce seul check passe
// de `partial` a `match` quand le statut est actif (`mismatch` s'il est radie, ce que LINDAS
// ne sait pas dire aujourd'hui). Les deux autres connecteurs n'ont rien a y gagner. Ce
// jour-la, ce connecteur-ci aura besoin d'un secret et redeviendra donc une FABRIQUE
// (meme motif que createAddressGeocodeSource), la lecture de l'environnement restant dans
// agency-verification-run/index.ts : ce module reste pur.
//
// LA FORME DE LA REQUETE DECIDE DE SA VITESSE, et ce n'est pas une optimisation mais une
// condition d'existence du connecteur. L'identifiant LINDAS est un NOEUD, pas une chaine
// portee par l'entite : `?company schema:identifier ?identifier`, puis `?identifier
// schema:name "CompanyUID" ; schema:value "CHE105909036"`. Filtrer par STRENDS sur l'URI de
// ce noeud met 14 s (scan des 2,37 M d'identifiants du graphe) ; interroger le LITTERAL
// `schema:value` met 0,147 s -- mesures en direct le 29.07.2026. Seule la seconde tient sous
// DEFAULT_SOURCE_TIMEOUT_MS (10 s). Ne jamais « simplifier » cette requete en un filtre sur
// l'URI : le connecteur deviendrait un `unavailable` permanent par timeout.
//
// La valeur publiee ne porte AUCUN separateur (`CHE105909036`) la ou la saisie humaine en
// porte (`CHE-105.909.036`, forme d'affichage officielle) -- d'ou normalizeRegistryNumber(),
// partagee avec le controle du numero de registre plus haut. Ce controle-la, lui, VERIFIE LA
// CLE ; celui-ci ne verifie que la FORME (SWISS_UID_RE), et deliberement : un numero a la
// cle fausse n'existera pas dans le graphe, et c'est `mismatch` sur registry_lookup qui le
// dira -- refuser de le chercher reviendrait a faire deux fois le travail d'un autre veto.
//
// La forme est verifiee AVANT toute construction de requete, et c'est aussi ce qui rend
// l'interpolation du numero dans le texte SPARQL sure : SWISS_UID_RE n'admet que `CHE` suivi
// de neuf chiffres, donc ni guillemet ni contre-oblique ne peut atteindre le litteral (meme
// discipline que DOMAIN_SHAPE_RE pour le chemin RDAP plus haut).
//
// TROIS sources et non une, pour la meme raison que le registre francais en a trois lui
// aussi (voir sa section) : une KybSourceResult ne porte qu'UN check_type. Les trois
// interrogent donc le meme point d'API sans se coordonner -- couplage assume, une poignee
// d'appels par verification et non par seconde, exactement l'arbitrage deja retenu pour la
// France.
//
// registry_country_match merite d'etre justifie plutot que subi, et LES DEUX REGISTRES le
// revendiquent, chacun pour SA juridiction : `zefix` ici pour un siege suisse,
// `recherche_entreprises` pour un siege francais. Les deux ne peuvent jamais repondre sur le
// meme dossier -- leurs `appliesTo` lisent le MEME declaredHeadOfficeCountry, qui ne rend pas
// 'CH' et 'FR' a la fois (c'est ce que verifie la matrice d'exclusivite de
// tests/backend/agency-verification-run.spec.ts).
//
// L'ARGUMENT QUI LES FONDE EST LE MEME, et il a ete formule ici avant d'etre repris pour la
// France : le filtre de juridiction dit d'ou vient la QUESTION, jamais que la REPONSE est
// acquise. Une agence peut parfaitement declarer un numero que le registre de son propre pays
// ne porte pas ; trouver le numero declare DANS LE REGISTRE DE LA JURIDICTION DECLAREE est
// donc la seule chose qui distingue « cette entite est enregistree en Suisse » de « cette
// agence pretend etre suisse » -- et, mot pour mot, la France de la pretention d'etre
// francaise.
//
// La section francaise avait d'abord ECARTE ce type, au motif qu'elle n'interroge que des
// sieges deja declares en France et qu'une reponse positive n'y confirmerait rien qu'on ne
// sache. Cet arbitrage-la n'a plus cours : tenir les deux raisonnements a la fois etait
// intenable, et il laissait la France seule non auto-validable pour un motif que plus
// personne ne defendait. Les deux sections disent desormais la meme chose ; si l'une des
// deux change, l'autre doit changer avec elle.

const LINDAS_SPARQL_ENDPOINT = 'https://lindas.admin.ch/query'
const LINDAS_ZEFIX_GRAPH = 'https://lindas.admin.ch/foj/zefix'

/** Borne du nombre de lignes rendues pour UN numero. Un meme UID peut en rendre plus d'une,
 *  mais c'est RARE et ce n'est pas une affaire de langue : 3 UID sur 791 068 rendent plus
 *  d'un noeud, chacun pour un DOUBLE SIEGE STATUTAIRE -- deux inscriptions cantonales de la
 *  meme entite (CHE105909036 rend « Nestlé AG » a Cham et « Nestlé S.A. » a Vevey ;
 *  CHE105944570 et CHE101329561 rendent deux fois la MEME raison sociale). Volontairement
 *  TRES au-dessus du besoin : le maximum de lignes pour un UID vaut 2 sur TOUT le graphe --
 *  les deux mesures faites en direct le 29.07.2026, par GROUP BY sur les identifiants du
 *  graphe (14 a 20 s, hors budget d'un connecteur : d'ou une mesure faite une fois, a la
 *  main, et une constante figee ici). Tronquer ne couterait rien a registry_lookup ni a
 *  registry_country_match (une seule ligne suffit a etablir la presence), mais ferait perdre
 *  a registry_legal_name_match l'inscription de l'autre siege -- donc un `mismatch` sur une
 *  raison sociale pourtant inscrite, sur un veto qui bloque un dossier. */
const ZEFIX_UID_RESULT_LIMIT = 50

/** Juridiction des trois sources Zefix : le registre du commerce suisse, et lui seul.
 *  Le Liechtenstein en est EXCLU bien qu'il partage le systeme UID (voir
 *  UID_REGISTRY_COUNTRIES plus haut) : son registre est `oera.li`, absent de LINDAS et sans
 *  aucune API publique connue (doc de conception §3) -- un dossier LI reste en revue
 *  manuelle, il ne doit pas se voir opposer une indisponibilite suisse qui laisserait croire
 *  qu'une source suisse aurait pu le couvrir. Meme valeur comparee et meme helper que le
 *  registre francais (declaredHeadOfficeCountry) : c'est ce qui rend l'exclusivite des trois
 *  check_type partages (registry_lookup, registry_legal_name_match, registry_country_match)
 *  une propriete du code et non une coincidence. */
function hasSwissHeadOffice(agency: AgencyForVerification): boolean {
  return declaredHeadOfficeCountry(agency) === 'CH'
}

/** Le numero a chercher dans le graphe, sous la forme que LINDAS publie (sans separateur).
 *  Leve TOUJOURS plutot que de choisir `unavailable` elle-meme (discipline du module, voir
 *  KybSourceResult) : numero absent, ou forme qui n'est pas celle d'un IDE. Le message dit ce
 *  qui etait attendu -- devant un `unavailable`, un relecteur de la file admin doit pouvoir
 *  corriger la saisie sans ouvrir le code. */
function extractZefixUid(businessRegistrationNumber: string | null): string {
  const raw = businessRegistrationNumber?.trim()
  if (!raw) throw new Error('zefix/lindas: aucun numero de registre declare')
  const normalized = normalizeRegistryNumber(raw)
  if (!SWISS_UID_RE.test(normalized)) {
    throw new Error(
      `zefix/lindas: le numero de registre "${raw}" n'a pas la forme d'un IDE suisse (CHE + 9 chiffres)`
    )
  }
  return normalized
}

/** La requete envoyee, sur la forme INDEXEE (litteral `schema:value`) -- voir l'en-tete de
 *  section pour les 14 s contre 0,147 s que ce choix vaut. `uid` a deja passe SWISS_UID_RE :
 *  aucun caractere d'echappement ne peut atteindre le litteral. */
function buildZefixUidQuery(uid: string): string {
  return `PREFIX schema: <http://schema.org/>
SELECT ?legalName ?municipality WHERE {
  GRAPH <${LINDAS_ZEFIX_GRAPH}> {
    ?company schema:identifier ?identifier ; schema:legalName ?legalName .
    ?identifier schema:name "CompanyUID" ; schema:value "${uid}" .
    OPTIONAL { ?company schema:address/schema:addressLocality ?municipality . }
  }
} LIMIT ${ZEFIX_UID_RESULT_LIMIT}`
}

/** Une valeur de la reponse SPARQL JSON : `{ "type": "literal", "value": "Nestlé AG" }`.
 *  `value` est deliberement `unknown` -- son type est verifie a la lecture, jamais suppose. */
interface LindasSparqlValue {
  value?: unknown
}

interface LindasSparqlBinding {
  legalName?: LindasSparqlValue
  municipality?: LindasSparqlValue
}

interface LindasSparqlResponse {
  results?: { bindings?: LindasSparqlBinding[] } | null
}

/** Ce que le graphe dit d'UN numero. `found` se lit sur le nombre de LIGNES rendues et non
 *  sur les raisons sociales lues : une ligne existe, donc le numero est inscrit -- meme si
 *  sa raison sociale s'averait illisible. Les deux questions sont distinctes, et les
 *  confondre ferait dire « ce numero n'existe pas » a un defaut de lecture. */
interface ZefixGraphEntries {
  uid: string
  legalNames: string[]
  municipalities: string[]
  rows: number
  /** La reponse a-t-elle bute sur ZEFIX_UID_RESULT_LIMIT ? Joint a la preuve : sans lui,
   *  une troncature ferait conclure un veto sur une liste incomplete, en silence. */
  truncated: boolean
  bindings: LindasSparqlBinding[]
}

/** Interroge LINDAS pour UN numero. Ne catche RIEN elle-meme (non-2xx, JSON illisible, corps
 *  hors schema) -- meme discipline que fetchFrenchRegistry plus haut : runKybSource() traduit
 *  tout ecart en `unavailable` avec la raison jointe. */
async function fetchZefixByUid(uid: string, signal: AbortSignal): Promise<ZefixGraphEntries> {
  const res = await fetch(LINDAS_SPARQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/sparql-results+json',
    },
    body: `query=${encodeURIComponent(buildZefixUidQuery(uid))}`,
    signal,
  })

  if (!res.ok) {
    const err = new Error(`zefix/lindas: unexpected status ${res.status}`) as Error & { status: number }
    err.status = res.status
    throw err
  }

  // Une reponse illisible (JSON invalide) leve ici -- jamais rattrapee.
  const body = (await res.json()) as LindasSparqlResponse | null

  // Garde de forme (meme defaut, meme remede que le registre francais et Mapbox, revue
  // etape 4/tache 3) : HTTP 200 ne garantit pas la forme. SEULE une liste VIDE est
  // l'information positive « ce numero n'est pas au registre » ; un corps hors schema
  // (panne fournisseur, page d'erreur deserialisee malgre tout) est une NON-REPONSE, et ces
  // trois check_type sont des VETOS -- l'ecrire comme une absence serait une affirmation
  // decisive posee sur une panne.
  const bindings = body?.results?.bindings
  if (!Array.isArray(bindings)) {
    throw new Error('zefix/lindas: unexpected response shape (results.bindings is not an array)')
  }

  // Dedoublonne en preservant l'ordre : OPTIONAL sur la commune peut rendre la meme raison
  // sociale sur plusieurs lignes, et la preuve doit rester lisible par un humain.
  const legalNames: string[] = []
  const municipalities: string[] = []
  for (const binding of bindings) {
    const legalName = binding?.legalName?.value
    if (typeof legalName === 'string' && !legalNames.includes(legalName)) legalNames.push(legalName)
    const municipality = binding?.municipality?.value
    if (typeof municipality === 'string' && !municipalities.includes(municipality)) municipalities.push(municipality)
  }

  // `truncated` joint a la preuve (revue tache 2, mineur) : la requete borne a
  // ZEFIX_UID_RESULT_LIMIT, et une troncature silencieuse ferait sortir
  // registry_legal_name_match en `mismatch` sur une raison sociale pourtant inscrite --
  // un veto qui bloque un dossier sur une liste incomplete, sans que rien ne le dise. Le
  // maximum observe vaut 2 (le double siege statutaire, voir ZEFIX_UID_RESULT_LIMIT), la
  // marge est donc large ; mais un relecteur doit pouvoir constater que la liste etait
  // entiere, pas le supposer.
  return {
    uid,
    legalNames,
    municipalities,
    rows: bindings.length,
    truncated: bindings.length >= ZEFIX_UID_RESULT_LIMIT,
    bindings,
  }
}

/** Le numero a chercher pour CE dossier, apres la garde de juridiction. Cette garde-ci fait
 *  double emploi avec `appliesTo` quand l'appelant a filtre (selectApplicableSources) -- et
 *  c'est voulu : runAgencyKybSources() peut recevoir la source sans filtrage, son contrat le
 *  permet explicitement. Lit la MEME valeur que hasSwissHeadOffice (declaredHeadOfficeCountry,
 *  donc trim + majuscules), a la difference des connecteurs francais qui comparent `country`
 *  brut -- l'ecart y est documente comme souhaitable a corriger, il n'y a aucune raison de le
 *  reproduire ici. */
function requireSwissUid(agency: AgencyForVerification): string {
  if (!hasSwissHeadOffice(agency)) {
    throw new Error('zefix/lindas: siege hors de Suisse, source non interrogee')
  }
  return extractZefixUid(agency.business_registration_number)
}

/** La preuve commune aux trois checks : ce qui a ete demande, a qui, et ce qui est revenu.
 *  Aucun secret ne peut y transiter -- LINDAS est public, l'URL ne porte aucun parametre. */
function zefixEvidence(entries: ZefixGraphEntries, declared: string | null): Record<string, unknown> {
  return {
    uid: entries.uid,
    declared,
    endpoint: LINDAS_SPARQL_ENDPOINT,
    graph: LINDAS_ZEFIX_GRAPH,
    registry_legal_names: entries.legalNames,
    municipalities: entries.municipalities,
    rows: entries.rows,
    truncated: entries.truncated,
    lindas_bindings: entries.bindings,
  }
}

async function runZefixRegistryLookup(
  agency: AgencyForVerification,
  signal: AbortSignal
): Promise<KybSourceResult> {
  const uid = requireSwissUid(agency)
  const entries = await fetchZefixByUid(uid, signal)
  const declared = agency.business_registration_number

  if (entries.rows === 0) {
    // Le registre A repondu : ce numero, precisement, n'y est pas. Signal decisif, pas une
    // indisponibilite -- meme motif que le 404 RDAP et le `results:[]` du registre francais.
    return {
      result: 'mismatch',
      raw_response: { ...zefixEvidence(entries, declared), reason: 'uid_not_found' },
    }
  }

  // JAMAIS `match`, et c'est le coeur du chantier : l'existence est etablie, le statut
  // actif/radie ne l'est PAS (voir l'en-tete de section). `reason` le dit dans la piece
  // d'audit elle-meme -- un relecteur devant un veto non passe doit lire ce qui manque sans
  // ouvrir le code. C'est cette ligne, et elle seule, que l'appel REST Zefix fera passer a
  // `match` le jour ou les identifiants arriveront.
  return {
    result: 'partial',
    raw_response: {
      ...zefixEvidence(entries, declared),
      reason: 'existence_confirmed_status_not_published',
    },
  }
}

async function runZefixRegistryLegalNameMatch(
  agency: AgencyForVerification,
  signal: AbortSignal
): Promise<KybSourceResult> {
  // Juridiction, puis numero, puis raison sociale : le MEME ordre que les deux autres
  // connecteurs de cette section, et ce n'est pas cosmetique. Sur un dossier auquel il
  // manque plusieurs champs, les trois lignes `unavailable` disent alors la MEME chose --
  // un relecteur de la file admin lit « ce dossier ne declare pas de numero de registre »
  // d'un coup d'oeil, au lieu de trois raisons differentes a rapprocher lui-meme.
  const uid = requireSwissUid(agency)
  const declaredName = agency.legal_name?.trim()
  if (!declaredName) {
    throw new Error('zefix/lindas: aucune raison sociale declaree, rien a comparer au registre')
  }
  // MEME garde que le registre francais, sur le cote DECLARE de la comparaison : une
  // raison sociale sans lettre ni chiffre se reduit a la chaine vide, et il ne reste alors
  // rien a comparer. Ce connecteur-ci ne pouvait pas en tirer un `match`, mais par une
  // propriete des DONNEES et non par une garde : 0 raison sociale du graphe Zefix ne se
  // reduit a vide (mesure en direct le 29.07.2026, FILTER sans lettre ni chiffre sur les
  // 791 071 entrees). Une barriere accidentelle n'est pas une garde -- surtout sur un veto
  // qui, cote francais, avait deja fait passer une identite sur aucune preuve.
  const normalizedDeclared = normalizeLegalNameStrict(declaredName)
  if (normalizedDeclared === '') {
    throw new Error(
      `zefix/lindas: la raison sociale declaree "${declaredName}" ne porte ni lettre ni chiffre, rien a comparer`
    )
  }
  const entries = await fetchZefixByUid(uid, signal)

  if (entries.legalNames.length === 0) {
    // Aucune raison sociale a comparer -- numero absent du graphe, ou lignes dont le
    // legalName ne se lit pas. Le constat d'absence est deja porte par registry_lookup pour
    // son propre check_type : rien a dupliquer ici sur une donnee qui, elle, n'existe pas.
    throw new Error(`zefix/lindas: aucune raison sociale au registre pour ${uid}, rien a comparer`)
  }

  // TOUTES les raisons sociales rendues sont acceptables : elles sont toutes inscrites au
  // registre pour ce numero. Ce n'est PAS le cas courant, et la justification longtemps
  // ecrite ici (« les versions linguistiques officielles ») etait fausse -- mesure sur le
  // graphe vivant le 29.07.2026 : 3 UID seulement, sur 791 068, rendent plus d'un noeud
  // (CHE105909036 Nestle, CHE105944570 BNS, CHE101329561 UBS), et dans les trois cas c'est
  // un DOUBLE SIEGE STATUTAIRE -- deux inscriptions cantonales de la meme entite. Un seul
  // de ces trois porte deux raisons sociales differentes (« Nestlé AG » a Cham, « Nestlé
  // S.A. » a Vevey) ; les deux autres portent la MEME sur leurs deux noeuds.
  //
  // `schema:legalName` est MONO-VALUE par entreprise (0 noeud sur 791 071 en porte plus
  // d'un, meme mesure) : la boucle ci-dessous n'existe donc que pour le double siege.
  //
  // Compare a `schema:legalName` UNIQUEMENT, jamais a `schema:name` -- et c'est LA que
  // vivent les traductions officielles (« UBS SA »/« UBS Inc. » pour l'entite dont le
  // legalName est « UBS AG » ; les quatre langues nationales pour la BNS). Ce connecteur
  // refuse deliberement de les lire : `schema:name` porte aussi, sur chaque entree, les
  // denominations des AUTRES entrees -- les y meler fabriquerait des `match` sur autre
  // chose que ce que ce veto verifie.
  //
  // CONSEQUENCE POUR L'AGENCE, a dire sans l'arrondir : une agence suisse qui declare la
  // traduction officielle de son nom plutot que la raison sociale INSCRITE recoit un
  // `mismatch` sur un veto, donc un dossier bloque -- alors meme que la traduction figure
  // au registre. C'est le prix assume de la seule comparaison qui prouve quelque chose ; la
  // saisie attendue est la raison sociale telle que le registre la publie.
  const isMatch = entries.legalNames.some((name) => normalizeLegalNameStrict(name) === normalizedDeclared)

  return {
    result: isMatch ? 'match' : 'mismatch',
    raw_response: {
      ...zefixEvidence(entries, agency.business_registration_number),
      declared_legal_name: declaredName,
    },
  }
}

async function runZefixRegistryCountryMatch(
  agency: AgencyForVerification,
  signal: AbortSignal
): Promise<KybSourceResult> {
  const uid = requireSwissUid(agency)
  const entries = await fetchZefixByUid(uid, signal)

  if (entries.rows === 0) {
    // Rien a opposer au pays declare. L'absence elle-meme est deja le `mismatch` de
    // registry_lookup ; la reporter ici ferait compter DEUX fois le meme constat, sur deux
    // vetos que la conception veut independants.
    throw new Error(`zefix/lindas: ${uid} absent du registre suisse, aucune juridiction a comparer`)
  }

  // Trouve dans le graphe Zefix : l'entite est inscrite au registre du commerce SUISSE.
  // C'est exactement ce que ce veto oppose au pays declare -- et la juridiction, elle, ne
  // depend d'aucun statut, contrairement a registry_lookup : une entite radiee reste une
  // entite qui a ete inscrite EN SUISSE. Ce check-ci n'a donc aucun plafond a subir.
  return {
    result: 'match',
    raw_response: {
      ...zefixEvidence(entries, agency.business_registration_number),
      declared_country: agency.country,
      registry_country: 'CH',
    },
  }
}

const zefixRegistryLookupSource: KybSource = {
  checkType: 'registry_lookup',
  source: 'zefix',
  appliesTo: hasSwissHeadOffice,
  run: runZefixRegistryLookup,
}

const zefixRegistryLegalNameMatchSource: KybSource = {
  checkType: 'registry_legal_name_match',
  source: 'zefix',
  appliesTo: hasSwissHeadOffice,
  run: runZefixRegistryLegalNameMatch,
}

const zefixRegistryCountryMatchSource: KybSource = {
  checkType: 'registry_country_match',
  source: 'zefix',
  appliesTo: hasSwissHeadOffice,
  run: runZefixRegistryCountryMatch,
}

// ─── Squelette du registre UID (vat_lookup CH/LI, etape 6 tache 3) ─────────────
//
// Le statut de cette source N'EST PAS celui de Zefix, et les presenter comme deux cas
// identiques serait la seule erreur vraiment couteuse de cette section. Zefix a REPONDU :
// `401 Unauthorized`, verifie en direct le 25.07.2026 (doc de conception §3) -- on sait
// donc qu'il existe, qu'il exige une authentification, et qu'il ne manque qu'un
// identifiant pour l'obtenir. Le registre UID (uid.admin.ch), lui, n'a JAMAIS ete teste
// en API, et la question que pose la meme doc -- « API separee ou champ Zefix ? » -- n'est
// pas tranchee. Ce qui manque ici n'est donc pas seulement de quoi s'authentifier : c'est
// la reponse a « qu'est-ce qu'on appelle, et est-ce que ca existe separement ? ».
//
// Consequence directe sur la FORME, et arbitrage de cette tache : si la reponse est
// « champ Zefix », cette source DISPARAIT au profit d'un quatrieme type servi par le
// connecteur Zefix. C'est pourquoi la fabrique rend un TABLEAU alors qu'elle n'a qu'une
// source a rendre -- agency-verification-run/index.ts l'etale (`...`), si bien que ni la
// disparition de cette source, ni l'ajout d'un second type UID plus tard, ne changera la
// facon dont il l'appelle. Une fabrique rendant UNE source obligerait a retoucher
// l'appelant dans les deux cas. Ce que LINDAS a change n'est PAS cette question : le
// graphe Zefix publie par la Confederation ne porte aucune donnee de TVA (predicats
// mesures : legalName, name, address, municipality, additionalType, description,
// identifier), il ne remplace donc pas le registre UID et ne tranche pas davantage ce qu'il
// faudrait appeler.
//
// RIEN n'est ecrit « au plus probable », et l'interdit pese plus lourd ici qu'a la tache
// precedente : sur Zefix, un 401 avait au moins etabli l'existence du service ; ici, meme
// l'existence d'une API separee reste une hypothese. Aucune URL, aucun schema de reponse,
// aucun en-tete d'authentification. Ce qui n'est pas su reste une configuration vide
// (UID_REGISTER_API_URL / UID_REGISTER_API_CREDENTIAL, lues par index.ts) et un commentaire
// qui dit quoi y mettre -- une URL inventee se decouvrirait en production, une valeur vide
// se decouvre a la lecture, et createPendingCredentialsSource la signale d'elle-meme.
//
// UNE seule source, la ou Zefix en a trois : le catalogue ne porte qu'un type de TVA
// (vat_lookup, migration 20260728103000), et rien a lire dans une reponse qu'on ne connait
// pas ne justifierait d'en decouper deux.
//
// AUCUN VERDICT NE BOUGE LA OU CETTE SOURCE S'APPLIQUE -- et la PORTEE de cette phrase est
// exactement ce que la revue finale de l'etape 6 a du corriger, l'affirmation valant
// jusque-la pour tout dossier CH/LI. Cette source ne possede vat_lookup que sur une TVA
// dont le prefixe n'est PAS couvert par VIES (voir « Qui possede vat_lookup » plus haut) ;
// or sur une telle TVA, le connecteur VIES d'avant l'etape 6 levait de lui-meme (« country
// code ... not covered », « no tva declared ») et produisait deja `unavailable`. Cette
// source prend donc la place d'un `unavailable`, pour le meme resultat.
//
// Ce qui la rend neutre n'est PAS ce qui rendait neutres les trois lignes du squelette
// Zefix, et la nuance merite d'etre dite plutot que recopiee. Celles-la etaient des VETOS
// `unavailable`, et le moteur (recompute_agency_verification) fait echouer un veto
// `unavailable` exactement comme un veto ABSENT. vat_lookup n'est pas un veto mais un
// SIGNAL SCORABLE (weight 3.00, is_veto false) : ce qui le rend neutre, c'est l'exclusion
// de `unavailable` du numerateur ET du denominateur. Meme conclusion, deux mecanismes. Les
// trois lignes suisses, elles, ont cesse d'etre neutres au chantier LINDAS : elles rendent
// desormais de vrais verdicts (voir « Connecteur Zefix par LINDAS » plus haut).
//
// CE QUI SERAIT FAUX, et l'a ete : en conclure que le pays du siege pouvait a lui seul
// decider qui interroge la TVA. Ecarter VIES d'un dossier CH qui declare une TVA a prefixe
// UE lui retirait un `mismatch` de poids 3.00 -- mesure en base : 0.200/manual_review avec,
// 1.000/auto_validated sans. Cette source ne retient aucun dossier et n'en debloque aucun ;
// elle rend seulement lisible, dans le dossier, qu'une TVA suisse ou liechtensteinoise n'a
// ete confirmee par personne. Verifie en base, pas suppose : voir les deux tests de preuve
// du volet 2 de tests/backend/agency-verification-run.spec.ts, et le test de non-regression
// du verdict qui les suit.

/** Juridiction du registre UID : un siege en Suisse OU au Liechtenstein, et une TVA que
 *  VIES ne couvre pas. Le FL-UID liechtensteinois derive du systeme suisse par l'union
 *  douaniere et porte le meme prefixe CHE (doc de conception §3) -- la frontiere n'est donc
 *  PAS celle du registre du commerce, ou le Liechtenstein a le sien (`oera.li`) et sort de
 *  la juridiction Zefix (voir hasSwissHeadOffice plus haut). Deux decoupages differents
 *  pour deux registres differents, et c'est volontaire.
 *
 *  Ne reimplemente RIEN : lit vatLookupOwner (defini avec le connecteur VIES plus haut),
 *  le point de decision unique du proprietaire de ce check_type. Les deux proprietaires
 *  interrogent litteralement la meme fonction et comparent son unique valeur a la leur --
 *  c'est ce qui fait de l'exclusivite sur vat_lookup une propriete du code, et non deux
 *  predicats a tenir d'accord a la main. La TVA compte autant que le pays ici : un dossier
 *  suisse qui declare une TVA a prefixe UE revient a VIES, qui sait y repondre (revue
 *  finale etape 6). */
function uidRegisterOwnsVatLookup(agency: AgencyForVerification): boolean {
  return vatLookupOwner(agency) === 'uid_register'
}

/**
 * Construit la (les) source(s) du registre UID. Fabrique, et fabrique rendant un TABLEAU
 * meme pour une source unique -- voir l'en-tete de cette section pour les deux raisons :
 * cette source peut disparaitre si la TVA s'avere n'etre qu'un champ Zefix, et elle peut
 * se dedoubler si le registre sert un jour un second type. Dans les deux cas,
 * agency-verification-run/index.ts n'a rien a changer.
 *
 * Seule cliente qui reste de createPendingCredentialsSource depuis que Zefix a trouve sa
 * voie publique -- donc memes deux erreurs et memes interdits : le credential et la baseUrl
 * n'entrent JAMAIS dans le message d'erreur, et aucune requete n'est construite.
 */
export function createUidRegisterSources(config: PendingSourceConfig): KybSource[] {
  return [
    createPendingCredentialsSource({
      checkType: 'vat_lookup',
      source: 'uid_register',
      // Le libelle dit ce qui manque AU JUSTE, parce que l'erreur, elle, est partagee avec
      // Zefix : « en attente d'identifiants » serait a moitie faux ici, ou l'acces n'a
      // jamais ete etabli et ou l'on ignore encore s'il existe une API a interroger. C'est
      // ce texte que lira un relecteur de la file admin devant deux `unavailable`.
      label: 'registre UID (numero de TVA suisse/liechtensteinois -- API jamais testee, acces non etabli)',
      appliesTo: uidRegisterOwnsVatLookup,
      config,
    }),
  ]
}

/**
 * Registre des connecteurs actifs SANS CONFIGURATION -- les connecteurs qui en ont
 * besoin passent par une fabrique appelee depuis agency-verification-run/index.ts
 * (createAddressGeocodeSource, createUidRegisterSources ci-dessus). VIDE a la tache 1 par
 * construction ("Tu n'ecris aucun connecteur reel dans cette tache", brief etape 4).
 * Un check_type non catalogue dans verification_check_types ferait de toute facon
 * echouer l'insert (FK, migration 20260729150300) -- une entree ici EST donc deja un
 * connecteur pour de vrai, jamais un double de test. RDAP (domain_whois_age) est le
 * premier, ajoute par la tache 2 ; la tache 3 y ajoute VIES (vat_lookup) et le
 * registre francais (registry_lookup, registry_legal_name_match) ; le chantier LINDAS
 * y ajoute le controle du numero de registre (tache 1, registry_number_format -- ni
 * secret NI RESEAU) puis les trois sources Zefix par LINDAS (tache 2 -- du reseau, mais
 * un endpoint PUBLIC, donc toujours aucun secret), et sa tache 3 la concordance de pays
 * pour la France (registry_country_match, recherche_entreprises -- meme point d'API que
 * ses deux voisines francaises). agency-verification-run/index.ts n'a jamais eu a changer
 * pour aucune des neuf ; il a en revanche CESSE de construire les sources Zefix a la
 * tache 2, l'endpoint public les ayant sorties de la fabrique a configuration ou le
 * squelette de l'etape 6 les avait laissees.
 *
 * DEUX proprietaires pour CHACUN des trois check_type de registre dans cette seule liste
 * (la France et la Suisse), et c'est SANS DANGER par construction : leurs `appliesTo`
 * s'excluent (declaredHeadOfficeCountry, un seul point de decision), et
 * selectApplicableSources() les departage AVANT execution -- voir la section
 * « Juridiction d'une source » en tete de fichier, et la matrice d'exclusivite du volet
 * « harnais pur » de tests/backend/agency-verification-run.spec.ts, qui verifie cette
 * propriete sur le registre COMPLET.
 */
export const AGENCY_KYB_SOURCES: KybSource[] = [
  rdapDomainWhoisAgeSource,
  vatLookupSource,
  registryLookupSource,
  registryLegalNameMatchSource,
  registryCountryMatchSource,
  registryNumberFormatSource,
  zefixRegistryLookupSource,
  zefixRegistryLegalNameMatchSource,
  zefixRegistryCountryMatchSource,
]

/**
 * Separe les sources applicables au dossier de celles qu'aucune juridiction declaree ne
 * couvre -- POINT DE FILTRAGE UNIQUE de l'exclusivite des check_type (voir la section
 * « Juridiction d'une source » plus haut pour ce que cette separation rend impossible).
 * Appelee par agency-verification-run/index.ts AVANT runAgencyKybSources(), jamais par
 * cette derniere.
 *
 * Le registre est un parametre (AGENCY_KYB_SOURCES par defaut) parce que la fonction
 * deployee compose sa propre liste : les connecteurs qui ont besoin d'un secret ne
 * peuvent pas etre des entrees statiques de ce module pur (voir
 * createAddressGeocodeSource). C'est bien le registre COMPLET qui doit passer ici --
 * filtrer la moitie du registre ne garantirait rien.
 *
 * Un `appliesTo` qui leve ECARTE la source, avec la raison
 * 'jurisdiction_undeterminable'. Le besoin reste le meme -- un predicat bogue ne doit
 * jamais faire echouer tout le passage, d'ou le catch -- mais sa DIRECTION est celle de
 * l'invariant (revue etape 6/tache 1) : garder la source rendrait la collision de
 * check_type de nouveau atteignable, puisque deux proprietaires du meme type se decident
 * sur le MEME point (declaredHeadOfficeCountry pour les registres, vatLookupOwner pour la
 * TVA) et tomberaient ensemble dans le catch -- deux lignes du meme type dans la meme
 * transaction, dont la derniere inseree masquerait l'autre.
 *
 * Ecarter n'est pas gratuit pour autant, et le dire ainsi est le correctif de la revue
 * finale : une source ecartee qui aurait rendu un verdict emporte ce verdict avec elle
 * (voir « Qui possede vat_lookup » plus haut, ou confondre juridiction et pays du siege
 * avait fait passer un dossier de manual_review a auto_validated). Mais garder poserait une
 * ligne CONCURRENTE du meme type : un verdict non seulement perdu, mais REMPLACE par un
 * autre, sans trace. Entre perdre un verdict en le disant -- 'jurisdiction_undeterminable'
 * est le seul signal qu'un predicat est bogue, et il atterrit dans p_metadata -- et en
 * poser un faux en silence, on ecarte.
 */
export function selectApplicableSources(
  agency: AgencyForVerification,
  sources: KybSource[] = AGENCY_KYB_SOURCES
): { applicable: KybSource[]; skipped: SkippedKybSource[] } {
  const applicable: KybSource[] = []
  const skipped: SkippedKybSource[] = []

  for (const source of sources) {
    // `true` par defaut : pas de juridiction declaree = rien a departager, la source
    // s'applique toujours. Le catch, lui, ecarte -- avec sa propre raison, pour que la
    // trace ne confonde pas un predicat bogue avec un pays simplement non couvert (voir
    // la docstring ci-dessus et SkippedKybSource).
    let covers = true
    let reason: SkippedKybSource['reason'] = 'jurisdiction_not_covered'
    if (source.appliesTo) {
      try {
        covers = source.appliesTo(agency)
      } catch {
        covers = false
        reason = 'jurisdiction_undeterminable'
      }
    }

    if (covers) {
      applicable.push(source)
    } else {
      skipped.push({
        check_type: source.checkType,
        source: source.source,
        reason,
      })
    }
  }

  return { applicable, skipped }
}

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
 *  la boucle.
 *
 *  N'applique JAMAIS le filtre de juridiction (etape 6, tache 1) : une ligne par source
 *  qu'on lui donne, sans exception -- c'est l'appelant qui choisit ce qu'il donne, via
 *  selectApplicableSources(). Deplacer le filtre ici casserait ce contrat. */
export async function runAgencyKybSources(
  agency: AgencyForVerification,
  sources: KybSource[] = AGENCY_KYB_SOURCES,
  timeoutMs: number = DEFAULT_SOURCE_TIMEOUT_MS
): Promise<AgencyCheckRow[]> {
  return Promise.all(sources.map((source) => runKybSource(source, agency, timeoutMs)))
}
