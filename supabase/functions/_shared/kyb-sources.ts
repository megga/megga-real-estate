// supabase/functions/_shared/kyb-sources.ts
//
// Socle des connecteurs de verification KYB (etape 4 de l'onboarding agence). Ce
// module ne contient AUCUN connecteur reel -- seulement le contrat que chaque
// connecteur (taches 2 et 3 : RDAP, VIES, recherche-entreprises, Mapbox) devra
// respecter, et le harnais qui impose la regle qui gouverne toute l'etape :
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
// runKybSource() est le SEUL point qui doit jamais lever ou pendre indefiniment :
// un connecteur ecrit ici (tache 2+) peut lever, timeouter, renvoyer n'importe
// quoi -- runKybSource() absorbe tout et rend TOUJOURS une ligne exploitable.
// AGENCY_KYB_SOURCES reste vide dans cette tache par construction (brief tache 1,
// "Tu n'ecris aucun connecteur reel dans cette tache") ; les taches suivantes y
// ajoutent leurs entrees sans jamais avoir a toucher a agency-verification-run/
// index.ts ni a reimplementer la gestion d'erreur/timeout.
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
 *  raw_response est la piece d'audit LAB (reponse brute de la source) ; optionnel
 *  a l'ecriture, jamais absent en sortie de runKybSource() (voir plus bas). */
export interface KybSourceResult {
  result: KybCheckResult
  raw_response?: Record<string, unknown> | null
}

/** Une ligne prete a inserer dans agency_verification_checks (moins agency_id,
 *  ajoute par l'appelant -- agency-verification-run/index.ts). Pas de `checked_at`
 *  ici : la colonne a une valeur par defaut (now(), l'heure de DEBUT de
 *  transaction) et rien dans ce module ne doit pretendre ordonner deux lignes du
 *  meme type mieux que le moteur ne le fait deja par ctid -- lire l'en-tete de
 *  recompute_agency_verification (20260728130000) avant d'y toucher. */
export interface AgencyCheckRow {
  check_type: string
  source: string
  result: KybCheckResult
  raw_response: Record<string, unknown> | null
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

/**
 * Registre des connecteurs actifs. VIDE dans cette tache par construction : "Tu
 * n'ecris aucun connecteur reel dans cette tache" (brief etape 4, tache 1). Un
 * check_type non catalogue dans verification_check_types ferait de toute facon
 * echouer l'insert (FK, migration 20260728103000) -- une entree ici EST donc deja
 * un connecteur pour de vrai, jamais un double de test. Les taches 2 (RDAP) et 3
 * (VIES, recherche-entreprises, Mapbox) y ajoutent leurs entrees ;
 * agency-verification-run/index.ts n'a jamais a changer pour ca.
 */
export const AGENCY_KYB_SOURCES: KybSource[] = []

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
      check_type: source.checkType,
      source: source.source,
      result: outcome.result,
      raw_response: outcome.raw_response ?? null,
    }
  } catch (err) {
    // Echec OU expiration : jamais un resultat fabrique (un `match` par exemple)
    // qui vaudrait preuve alors qu'aucune source n'a repondu -- corollaire du
    // principe directeur de cette etape.
    const isTimeout = err instanceof KybSourceTimeoutError
    const message = err instanceof Error ? err.message : String(err)
    return {
      check_type: source.checkType,
      source: source.source,
      result: 'unavailable',
      raw_response: { error: message, reason: isTimeout ? 'timeout' : 'error' },
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
