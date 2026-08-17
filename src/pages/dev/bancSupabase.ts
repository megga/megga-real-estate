/**
 * Interception de `window.fetch` pour les bancs `/dev/*` — le point d'injection
 * des données, commun à `/dev/admin` et `/dev/crm`.
 *
 * ── POURQUOI CE MODULE EXISTE ────────────────────────────────────────────────
 * Le banc de la console (14 août 2026) a établi qu'une SEULE interception couvre
 * toute la couture de données d'une surface protégée : les hooks passent par le
 * client `supabase`, dont le `global.fetch` (`authAwareFetch`) appelle le `fetch`
 * **global** au moment de l'appel. Aucun slot dans du code de production.
 *
 * Le banc du CRM agent a la même forme et une couture plus large — 31 tables,
 * 18 RPC et 16 edge functions mesurées sur les dix-sept surfaces `/dashboard`
 * restantes. Recopier ~150 lignes d'analyse PostgREST pour la seconde fois aurait
 * garanti que les deux versions divergent : c'est le filtrage des prédicats qui
 * empêche le banc de mentir par excès, et une seule des deux copies aurait reçu
 * la prochaine correction.
 *
 * ⚠ CE MODULE NE PORTE AUCUNE FIXTURE. Il ne sait pas ce qu'est une agence ni un
 * deal ; il sait lire une URL PostgREST et appliquer un prédicat. Les fixtures
 * vivent dans `adminFixtures.ts` et `crmFixtures.ts`, et c'est le banc qui les
 * lui donne par {@link reglerBanc}.
 */
import { SUPABASE_FUNCTIONS_URL } from '@/lib/supabase'

/** Les trois états qu'un banc fait jouer à ses sources. */
export type BancEtat = 'nominal' | 'vide' | 'erreur'

/** Une fixture de RPC : une valeur, ou une fonction de ses arguments. */
export type FixtureRpc = unknown | ((args: Record<string, unknown>) => unknown)

/** Marqueur d'une fixture d'edge qui doit répondre en ÉCHEC HTTP. */
const STATUT = '__bancStatut'

/**
 * Réponse d'edge en ÉCHEC CIBLÉ — une fonction, pas tout le banc.
 *
 * ⛔ POURQUOI ÇA MANQUAIT, ET CE QUE ÇA CACHAIT. `contrat.etat === 'erreur'`
 * existait déjà, mais il fait échouer TOUT : edges et PostgREST ensemble. Sur la
 * face publique, qui LIT son écran par une edge, ça ne montre pas une page en
 * erreur — ça montre « lien invalide », c'est-à-dire l'absence de page. Les
 * bannières d'échec des gestes (report, annulation, dépôt de pièce refusé)
 * n'étaient donc atteignables dans AUCUN état du banc.
 *
 * ⚠ ET LE CORPS NE SUFFIT PAS : les hooks décident sur `!res.ok`, jamais sur la
 * forme du corps (`useAppointmentBooking`, `useMagicLinkClient`). Une fixture qui
 * rendait `{ error: … }` en 200 était donc lue comme un SUCCÈS, et la page
 * affichait son écran de confirmation sur un geste refusé. Il fallait pouvoir
 * rendre un STATUT.
 *
 * Combiné à une fixture-FONCTION, ça permet ce que la face publique demande :
 * la même edge sert la LECTURE normalement et refuse l'ÉCRITURE.
 */
export function echecEdge(statut: number, corps: Record<string, unknown> = {}): Record<string, unknown> {
  return { [STATUT]: statut, ...corps }
}

function statutDe(fixture: unknown): number | null {
  if (!fixture || typeof fixture !== 'object') return null
  const v = (fixture as Record<string, unknown>)[STATUT]
  return typeof v === 'number' ? v : null
}

const BASE = SUPABASE_FUNCTIONS_URL.replace(/\/functions\/v1$/, '')
const REST = `${BASE}/rest/v1/`
const FN = `${BASE}/functions/v1/`
const AUTH = `${BASE}/auth/v1/`

/**
 * Contrat courant, lu par l'intercepteur à CHAQUE appel.
 *
 * ⚠ Une variable de module, pas une clôture : l'intercepteur est installé une
 * fois, et il doit répondre selon l'état choisi APRÈS son installation.
 */
const contrat = {
  etat: 'nominal' as BancEtat,
  tables: {} as Record<string, unknown[]>,
  rpc: {} as Record<string, FixtureRpc>,
  /**
   * Fixtures propres à l'état « Vide », quand rendre `null` ne dit pas la même
   * chose que rendre une réponse VIDE.
   *
   * ⛔ « ZÉRO LIGNE » N'EST PAS « ZÉRO MONTANT ». Pour une RPC qui rend un
   * TABLEAU, `[]` dit bien « rien à montrer ». Pour une RPC qui rend un OBJET —
   * le cockpit d'Analytics, sa trajectoire, son entonnoir — rendre `null` dit
   * « pas encore répondu », et la page reste sur son squelette : on croit
   * regarder l'état vide, on regarde un chargement qui n'aboutira jamais.
   * Mesuré à l'écran, pas déduit. Une entrée ici rend l'objet ZÉRO attendu.
   */
  rpcVide: {} as Record<string, FixtureRpc>,
  /**
   * Session à servir sur `/auth/v1/*`, ou `null` pour laisser passer l'appel.
   *
   * ⛔ SANS ELLE, UN BANC À SESSION SEMÉE S'EFFACE LUI-MÊME. Le jeton du banc
   * n'est pas signé : `/auth/v1/user` répond 401 avec un corps qui contient le
   * mot « JWT » — or `authAwareFetch` (src/lib/supabase.ts) reconnaît ce motif
   * et appelle `purgeAuthTokens()`. La session disparaît alors du stockage en
   * pleine session, et l'écran retombe sur le mur au rechargement suivant.
   * Mesuré sur `/dev/crm` : trois 401 à l'ouverture.
   *
   * `/dev/admin` la laisse à `null` — il n'a pas de session et n'en veut pas.
   */
  session: null as unknown,
  /**
   * Tables qui TRAVERSENT l'état « Vide » — l'identité de la session, jamais du
   * domaine.
   *
   * ⛔ SANS ELLES, « VIDE » NE MONTRE PAS CE QU'IL ANNONCE. Son libellé promet
   * « les états vides de chaque surface » ; en vidant AUSSI `profiles` et
   * `agencies`, il faisait tomber le KYC sur le mur d'identité — l'écran
   * affichait « Vérifiez l'identité de votre agence », pas un état vide. Le
   * troisième mur du banc se relève dès qu'on retire la donnée qui le tenait
   * ouvert, et on croit regarder une surface alors qu'on regarde une garde.
   *
   * Ces tables ne sont pas de la donnée à montrer : sans elles il n'y a pas
   * d'écran du tout, donc rien de vide à regarder.
   */
  socle: [] as string[],
  /**
   * Fixtures par EDGE FUNCTION, pour les surfaces dont l'écran ENTIER vient
   * d'une fonction et non de PostgREST.
   *
   * ⛔ SANS ELLES, LE BANC RÉPOND `{ok:true, banc:true}` À TOUT. C'était sans
   * conséquence tant que les bancs montaient des surfaces `/dashboard` : leurs
   * données viennent de `rest/v1`, et les edges n'y servent qu'à écrire. La face
   * PUBLIQUE est l'inverse — `/kyc/:token`, `/reception/:token` et
   * `/rendez-vous/:token` LISENT tout par une edge, jetons compris. Leur servir
   * `{ok:true}` ne montre pas un écran vide : ça montre un écran d'ERREUR, ou
   * rien du tout.
   *
   * ⚠ La clé est le NOM de la fonction (`magic-link-get`), pas l'URL. Une
   * fonction sans fixture garde l'ancienne réponse et est SIGNALÉE, comme une
   * table inconnue — sinon un banc muet ressemble à un banc complet.
   */
  edges: {} as Record<string, FixtureRpc>,
  /** Noms d'appels qu'aucune fixture ne couvre — remontés aux commandes du banc. */
  signaler: (_appel: string) => {},
}

/** Règle tout ou partie du contrat. Appelable avant comme après l'installation. */
export function reglerBanc(p: Partial<typeof contrat>): void {
  Object.assign(contrat, p)
}

/** Corps JSON, avec les en-têtes que `supabase-js` sait lire. */
function json(corps: unknown, nombre: number): Response {
  return new Response(corps === undefined ? 'null' : JSON.stringify(corps), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-range': `0-${Math.max(0, nombre - 1)}/${nombre}`,
    },
  })
}

/** Échec côté serveur, dans la forme que PostgREST rend — pour l'état « Échec ». */
function echec(): Response {
  return new Response(
    JSON.stringify({ code: 'PGRST000', message: 'banc : échec simulé', details: null, hint: null }),
    { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } },
  )
}

/** Colonnes non lisibles telles quelles (`select` n'est pas appliqué : inutile ici). */
const PARAMS_HORS_FILTRE = new Set(['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'])

/** Valeur PostgREST : `"…"` quoté, `null`, sinon la chaîne brute. */
function valeur(v: string): unknown {
  const s = v.replace(/^"(.*)"$/, '$1')
  if (s === 'null') return null
  return s
}

/**
 * Applique les filtres et le tri de la requête aux lignes de la fixture.
 *
 * ⛔ SANS ÇA LE BANC MENT PAR EXCÈS. Le journal d'erreurs du Monitoring
 * interroge `activity_events` avec `action=eq.edge_function_error` ; en rendant
 * les huit événements quel que soit le filtre, il affichait des créations
 * d'agence dans une liste d'erreurs. Une fixture qui ignore le prédicat produit
 * un écran cohérent en apparence et faux en substance — la variante (e) des
 * pièges de sonde.
 *
 * Sous-ensemble volontaire : `eq`, `neq`, `gt(e)`, `lt(e)`, `in`, `is`, plus
 * `order` et `limit`. Un opérateur inconnu laisse passer la ligne plutôt que de
 * la retirer : mieux vaut un écran trop plein qu'un vide qu'on lirait comme un
 * bogue de la page.
 */
function filtrer(lignes: unknown[], requete: string): unknown[] {
  const p = new URLSearchParams(requete)
  let out = lignes as Record<string, unknown>[]

  for (const [col, expr] of p.entries()) {
    if (PARAMS_HORS_FILTRE.has(col)) continue
    const sep = expr.indexOf('.')
    if (sep < 0) continue
    const op = expr.slice(0, sep)
    const brut = expr.slice(sep + 1)
    out = out.filter((l) => {
      const v = l[col]
      switch (op) {
        case 'eq': return String(v) === String(valeur(brut))
        case 'neq': return String(v) !== String(valeur(brut))
        case 'gt': return String(v) > brut
        case 'gte': return String(v) >= brut
        case 'lt': return String(v) < brut
        case 'lte': return String(v) <= brut
        case 'is': return brut === 'null' ? v == null : v != null
        case 'in': return brut.replace(/^\(|\)$/g, '').split(',')
          .map((x) => String(valeur(x))).includes(String(v))
        default: return true
      }
    })
  }

  const ordre = p.get('order')
  if (ordre) {
    const [col, sens] = ordre.split('.')
    const desc = sens === 'desc'
    out = [...out].sort((a, b) => {
      const x = String(a[col!] ?? ''), y = String(b[col!] ?? '')
      return (x < y ? -1 : x > y ? 1 : 0) * (desc ? -1 : 1)
    })
  }

  const limite = Number(p.get('limit'))
  return Number.isFinite(limite) && limite > 0 ? out.slice(0, limite) : out
}

/** Arguments d'une RPC, lus dans le corps POST. `{}` si le corps n'est pas du JSON. */
function lireArguments(init?: RequestInit): Record<string, unknown> {
  if (typeof init?.body !== 'string') return {}
  try {
    const v: unknown = JSON.parse(init.body)
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
  } catch { return {} }
}

/**
 * `Accept` de la requête, quelle que soit la NOTATION de ses en-têtes.
 *
 * ⛔ CE POINT DÉCIDAIT DE LA FORME RENDUE, ET IL NE CONNAISSAIT QU'UNE NOTATION.
 * La lecture d'origine — `init.headers.Accept ?? init.headers.accept` — ne
 * fonctionne que sur un OBJET NU. Or `supabase-js` passe une instance de
 * `Headers`, où ces deux propriétés valent `undefined` : la valeur n'est
 * atteignable que par `.get()`. Mesuré sur `/dev/crm` avant correctif —
 * `typeDeHeaders: "Headers"`, `litParPointAccept: "(undefined)"`,
 * `litParGet: "application/vnd.pgrst.object+json"`.
 *
 * `objetSeul` était donc TOUJOURS faux, et chacun des 35 `.single()` du dépôt
 * recevait un TABLEAU là où son hook attend un objet — sans exception, sans type
 * faux, sans rien dans la console : la page se dessinait avec tous ses champs à
 * `undefined`. Sur la fiche stricte du KYC, les cinq contrôles s'affichaient
 * « Automatique — en attente » sur un dossier screené.
 *
 * `new Headers(...)` normalise les TROIS formes de `HeadersInit` (instance,
 * objet nu, couples). Le repli sur la lecture nue ne sert qu'au cas où la
 * normalisation jette sur une entrée malformée : mieux vaut la réponse imparfaite
 * d'avant qu'un banc qui lève. Gardé par `banc-supabase.spec.ts`.
 */
function accept(init?: RequestInit): string {
  try {
    return new Headers(init?.headers).get('accept') ?? ''
  } catch {
    const nu = init?.headers as Record<string, string> | undefined
    return String(nu?.Accept ?? nu?.accept ?? '')
  }
}

/**
 * Réponse du banc pour une URL Supabase, ou `null` si l'appel ne le concerne pas
 * (l'appel part alors au vrai `fetch` — c'est le cas de `/auth/v1`).
 */
function repondre(url: string, init?: RequestInit): Response | null {
  const objetSeul = accept(init).includes('vnd.pgrst.object')

  // ⚠ L'auth passe AVANT l'état « Échec » : faire répondre 401 à `/auth/v1`
  // déclencherait la purge de jetons décrite sur `contrat.session`, et l'état
  // « Échec » cesserait d'être réversible — il éjecterait le banc.
  if (url.startsWith(AUTH)) {
    if (contrat.session == null) return null
    const s = contrat.session as { user?: unknown }
    // `/user` rend l'utilisateur nu ; `/token`, `/logout` et le reste rendent la
    // session. Aucun de ces appels n'atteint le vrai service.
    return json(url.startsWith(`${AUTH}user`) ? (s.user ?? null) : contrat.session, 1)
  }

  if (url.startsWith(FN)) {
    if (contrat.etat === 'erreur') return echec()
    const nom = url.slice(FN.length).split('?')[0]!.replace(/\/$/, '')
    if (!Object.prototype.hasOwnProperty.call(contrat.edges, nom)) {
      contrat.signaler(`fn/${nom}`)
      return json({ ok: true, banc: true }, 1)
    }
    const brut = contrat.edges[nom]
    const fixture = typeof brut === 'function'
      ? (brut as (a: Record<string, unknown>) => unknown)(lireArguments(init))
      : brut
    // ⚠ ÉCHEC CIBLÉ AVANT TOUT LE RESTE : une fixture peut demander un statut HTTP
    // précis (cf. `echecEdge`). C'est le seul moyen d'atteindre les bannières
    // d'échec de geste, les hooks décidant sur `!res.ok` et non sur le corps.
    const statut = statutDe(fixture)
    if (statut !== null) {
      const { [STATUT]: _, ...corps } = fixture as Record<string, unknown>
      return new Response(JSON.stringify(corps), {
        status: statut,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      })
    }
    // ⚠ « Vide » n'a pas de sens universel pour une edge : une fonction qui rend
    // un OBJET doit rendre l'objet ZÉRO, pas `null` — sinon la page reste sur son
    // squelette et on croit regarder un état vide (même piège que `rpcVide`).
    const rendu = contrat.etat === 'vide' && Array.isArray(fixture) ? [] : fixture
    return json(rendu, Array.isArray(rendu) ? rendu.length : 1)
  }

  if (!url.startsWith(REST)) return null
  if (contrat.etat === 'erreur') return echec()

  const [chemin = '', requete = ''] = url.slice(REST.length).split('?')

  if (chemin.startsWith('rpc/')) {
    const nom = chemin.slice(4)
    const brut = Object.prototype.hasOwnProperty.call(contrat.rpc, nom) ? contrat.rpc[nom] : undefined
    if (brut === undefined) contrat.signaler(`rpc/${nom}`)
    // Une fixture peut être une FONCTION des arguments : la fiche agence doit
    // rendre l'agence demandée, sinon l'en-tête contredit la ligne cliquée.
    const fixture = typeof brut === 'function'
      ? (brut as (a: Record<string, unknown>) => unknown)(lireArguments(init))
      : brut
    const propreAuVide = Object.prototype.hasOwnProperty.call(contrat.rpcVide, nom)
      ? contrat.rpcVide[nom]
      : undefined
    const rendu = contrat.etat === 'vide'
      ? (propreAuVide !== undefined ? propreAuVide : (Array.isArray(fixture) ? [] : null))
      : (fixture ?? (objetSeul ? null : []))
    const n = Array.isArray(rendu) ? rendu.length : 1
    return json(objetSeul && Array.isArray(rendu) ? (rendu[0] ?? null) : rendu, n)
  }

  const lignes = Object.prototype.hasOwnProperty.call(contrat.tables, chemin) ? contrat.tables[chemin]! : undefined
  if (lignes === undefined) contrat.signaler(chemin)
  const vide = contrat.etat === 'vide' && !contrat.socle.includes(chemin)
  const sortie = vide ? [] : filtrer(lignes ?? [], requete)
  return json(objetSeul ? (sortie[0] ?? null) : sortie, sortie.length)
}

let fetchOrigine: typeof window.fetch | null = null

/**
 * Installe l'intercepteur. Idempotent : `useState(initialiseur)` est
 * ré-exécuté par StrictMode, et une seconde enveloppe autour de la première
 * ferait de l'origine sauvegardée… l'intercepteur lui-même.
 */
export function installerBanc(): void {
  if (fetchOrigine) return
  fetchOrigine = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const reponse = repondre(url, init)
    if (reponse) return reponse
    return fetchOrigine!(input, init)
  }
}

export function desinstallerBanc(): void {
  if (!fetchOrigine) return
  window.fetch = fetchOrigine
  fetchOrigine = null
}
