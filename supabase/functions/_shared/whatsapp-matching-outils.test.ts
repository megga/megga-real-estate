/**
 * Les outils du matching du copilote WhatsApp (lot D2), éprouvés sans base ni réseau.
 *
 * POURQUOI CE BANC. Les exécuteurs lisent par le client service-role : la RLS est contournée, et le
 * `.eq('agency_id', …)` de chaque lecture est la seule garde de tenant. Le faux client ci-dessous APPLIQUE les filtres
 * qu'on lui passe à des lignes en mémoire — un filtre oublié laisse passer la ligne d'une autre agence, et le test le
 * voit. Les écritures passent par des fonctions de base (`rpc`) : on éprouve ce qu'on leur envoie, leur SQL est
 * éprouvé par `tests/backend/matching-whatsapp.spec.ts` (CI).
 *
 * ⚠ LE TRI ACCUMULE SES CLÉS, IL NE TRIE QU'UNE FOIS. Un `.order()` par appel ferait de la DERNIÈRE clé la primaire,
 * l'inverse de PostgREST (la première clé prime, les suivantes départagent). `fauxClient` accumule les clés posées
 * par `.order()` et ne trie qu'à la résolution (`.then()` / `.maybeSingle()`), `.limit()` coupant APRÈS ce tri — voir
 * `describe('fauxClient — …')` plus bas, qui l'éprouve directement. Tous les outils du matching partagent ce faux
 * client : garder son INTERFACE (`fauxClient(tables, rpc?, opts?)` → `{ client, appels, inserts, lectures }`).
 * `lectures` (le nom de chaque table lue, à chaque résolution) s'y est ajouté pour `record_match_outcome` : un texte
 * s'y désigne EN BASE, sans lire la page des matchs de l'acheteur, et seul ce journal le montre. De même
 * `opts.erreurSur` accepte `table#n` — la n-ième lecture de cette table seule en échec : un refus « aucun » relit la
 * page de l'acheteur, dans la même table que la lecture qui a échoué avant elle, et une panne de TOUTES les lectures
 * finirait en échec même si la première avait été lue comme une absence. Et `rpc#n`, le n-ième appel d'une fonction
 * seul : l'écho d'un libellé relit `wa_matching_biens_de_l_acheteur` une seconde fois.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import {
  execGetMatches, execGetBuyersForProperty, prepareRecordMatchOutcome, executeRecordMatchOutcome, execScheduleVisit, annulerVisite,
} from './whatsapp-matching-outils'
import {
  confirmConsigner, consigne, consignerAnnonceRetiree, consignerAucunBien, consignerEchoTropLarge, consignerPlusieursBiens,
  consignerTropDeBiens, consignerTropLarge,
} from './whatsapp-i18n'
import type { ActionCtx, Prepared } from './whatsapp-actions'

const A = 'a0000000-0000-4000-8000-00000000000a'
const B = 'b0000000-0000-4000-8000-00000000000b'
const JULIE = 'c0000000-0000-4000-8000-000000000001'
const AUTRE = 'c0000000-0000-4000-8000-000000000002'
const ATTIQUE = 'd0000000-0000-4000-8000-000000000001'
const STUDIO = 'd0000000-0000-4000-8000-000000000002'
const VILLA = 'e0000000-0000-4000-8000-000000000001'

type Ligne = Record<string, unknown>
type Appel = { rpc: string; args: Record<string, unknown> }
type Cle = { c: string; asc: boolean; nullsFirst: boolean }

/** Comparateur simple pour deux valeurs NON NULLES ; le `null`/`undefined` est géré À PART, dans `trier`, selon
 *  `nullsFirst` — qui ne vaut PAS toujours « en dernier » (il dépend du sens du tri, voir `trier`). */
const comparer = (x: unknown, y: unknown): number => (x === y ? 0 : (x as never) > (y as never) ? 1 : -1)

/**
 * Trie `lignes` par les clés ACCUMULÉES par `.order()`, la PREMIÈRE clé posée étant PRIMAIRE (comme PostgREST) :
 * chaque clé suivante ne départage que les égalités de la précédente. Nulls à la manière de PostgreSQL par défaut —
 * en dernier en ASC, en premier en DESC — sauf `nullsFirst` explicitement posé par l'appelant.
 */
function trier(lignes: readonly Ligne[], cles: readonly Cle[]): Ligne[] {
  if (!cles.length) return [...lignes]
  return [...lignes].sort((x, y) => {
    for (const k of cles) {
      const a = x[k.c], b = y[k.c]
      // `null` et `undefined` comptent comme la MÊME absence : sans ce garde, `a === b` est faux pour l'un valant
      // `null` et l'autre `undefined`, et les deux branches de nullité suivantes répondraient alors le MÊME signe
      // quel que soit l'ordre des arguments — un comparateur qui se contredit, que `.sort()` ne garantit plus de
      // résoudre de façon cohérente.
      if (a === b || (a == null && b == null)) continue
      if (a == null) return k.nullsFirst ? -1 : 1
      if (b == null) return k.nullsFirst ? 1 : -1
      const r = comparer(a, b)
      return k.asc ? r : -r
    }
    return 0
  })
}

/**
 * Un faux client supabase-js : `.eq` / `.in` / `.is` / `.gt` (numérique OU chaîne numérique) / `.not(… is null)`
 * filtrent ; `.order` ACCUMULE ses clés (première = primaire) sans trier immédiatement ; `.limit` mémorise sa coupe,
 * appliquée APRÈS le tri complet, à la résolution. `.maybeSingle()` sur PLUSIEURS lignes rend une ERREUR, comme
 * PostgREST. `opts.erreurSur` simule une lecture (une table nommée, ou sa n-ième lecture seule : `table#n`) OU un
 * `rpc` (son nom) en ÉCHEC (`{ data: null, error: {...} }`), pour éprouver le chemin `LECTURE_IMPOSSIBLE` sans
 * dépendre d'un vrai réseau.
 * ⚠ `.select('a, b, c')` PROJETTE les lignes rendues sur CES colonnes SEULES, comme PostgREST : un test dont l'oracle
 * dépend d'une colonne absente du `select()` réel doit rougir — sans ça, un `select()` amputé en production (colonne
 * jamais lue, valant `undefined`) resterait invisible ici. `select('*')` (ou un appel sans argument) rend tout, sans
 * filtrage. ⚠ `.rpc(nom, args)` respecte aussi `args.p_limite` — les lignes configurées sont coupées à CETTE valeur,
 * comme le ferait la fonction réelle avec son propre `limit` : un appelant qui demanderait la mauvaise limite reçoit
 * donc moins (ou plus) de lignes, pas les mêmes. Pour l'agence et les mots, c'est `appels` (rendu par `fauxClient`)
 * que les tests inspectent directement — aucune donnée de fixture n'est elle-même scopée par agence.
 * ⚠ `opts.echecInsertion` fait échouer `.insert()` sur une table nommée (`{ error: {...} }`, rien poussé dans
 * `inserts`) : éprouve qu'une confirmation (« /annuler ») n'est JAMAIS promise sur un enregistrement qui a échoué.
 * ⚠ `opts.erreurCode` porte un `code` Postgres sur l'erreur simulée d'un `rpc` déjà nommé par `erreurSur` (même clé,
 * `nom` ou `nom#n`) : SANS lui, l'erreur simulée n'a PAS de `code` — une panne de TRANSPORT, comme un `fetch` qui
 * échoue après que la base a écrit. Distingue les deux chemins d'échec qu'un exécuteur doit garder séparés (schedule_visit,
 * record_match_outcome) : un `code` dit que la base a tranché (rien n'a été écrit, de bonne foi), son absence ne le dit pas.
 */
function fauxClient(
  tables: Record<string, Ligne[]>, rpc: Record<string, unknown> = {},
  opts: { erreurSur?: ReadonlySet<string>; echecInsertion?: ReadonlySet<string>; erreurCode?: Record<string, string> } = {},
) {
  const appels: Appel[] = []
  const inserts: { table: string; row: unknown }[] = []
  const lectures: string[] = []
  const from = (table: string) => {
    let lignes = [...(tables[table] ?? [])]
    const cles: Cle[] = []
    let limite: number | null = null
    let colonnes: string[] | null = null
    /** Consigne la lecture, et dit si elle échoue : toutes celles de la table, ou sa n-ième seule (`table#n`). */
    const lire = (): boolean => {
      lectures.push(table)
      const rang = lectures.filter((t) => t === table).length
      return (opts.erreurSur?.has(table) ?? false) || (opts.erreurSur?.has(`${table}#${rang}`) ?? false)
    }
    const projeter = (l: Ligne): Ligne =>
      colonnes ? Object.fromEntries(colonnes.map((c) => [c, l[c]])) : l
    const resoudre = (): Ligne[] => {
      const triees = trier(lignes, cles)
      const coupees = limite == null ? triees : triees.slice(0, limite)
      return coupees.map(projeter)
    }
    const echec = { data: null, error: { message: `erreur simulée sur ${table}` } }
    const self: Record<string, unknown> = {}
    self.select = (cols?: string) => {
      colonnes = cols && cols.trim() !== '*' ? cols.split(',').map((c) => c.trim()) : null
      return self
    }
    self.eq = (c: string, v: unknown) => { lignes = lignes.filter((l) => l[c] === v); return self }
    self.in = (c: string, vs: readonly unknown[]) => { lignes = lignes.filter((l) => vs.includes(l[c])); return self }
    self.is = (c: string, v: unknown) => { lignes = lignes.filter((l) => (l[c] ?? null) === v); return self }
    // Compare aussi un numérique écrit en CHAÎNE : PostgreSQL le ferait sur une colonne `numeric`, que PostgREST
    // sérialise parfois en chaîne. `Number(null)` vaut 0 (donc `> 0` l'exclut déjà par la VALEUR, sans garde `typeof`
    // à part) ; `Number(undefined)`/`Number('abc')` valent NaN, exclus par le test.
    self.gt = (c: string, v: unknown) => {
      lignes = lignes.filter((l) => { const n = Number(l[c]); return !Number.isNaN(n) && n > Number(v) })
      return self
    }
    self.not = (c: string, op: string, v: unknown) => { if (op === 'is' && v === null) lignes = lignes.filter((l) => l[c] != null); return self }
    self.order = (c: string, o?: { ascending?: boolean; nullsFirst?: boolean }) => {
      const asc = o?.ascending !== false
      // PostgreSQL par défaut : NULLS LAST en ASC, NULLS FIRST en DESC — sauf précision explicite.
      cles.push({ c, asc, nullsFirst: o?.nullsFirst ?? !asc })
      return self
    }
    self.limit = (n: number) => { limite = n; return self }
    // PLUSIEURS lignes rendent une ERREUR, comme PostgREST/PGRST116 — jamais la première ligne prise en silence, qui
    // masquerait une donnée de test dupliquée par erreur.
    self.maybeSingle = async () => {
      if (lire()) return echec
      // La recherche de la ligne (et l'erreur « plusieurs trouvées ») ignore encore la projection : PostgREST, lui
      // aussi, décide de PGRST116 sur les lignes réelles, jamais sur ce que `select()` en laisse voir à l'appelant.
      const triees = trier(lignes, cles)
      const coupees = limite == null ? triees : triees.slice(0, limite)
      if (coupees.length > 1) return { data: null, error: { message: 'plusieurs lignes trouvées, une seule attendue', code: 'PGRST116' } }
      return { data: coupees[0] ? projeter(coupees[0]) : null, error: null }
    }
    self.insert = (row: unknown) => {
      if (opts.echecInsertion?.has(table)) return { error: { message: `échec simulé de l'insertion dans ${table}` } }
      inserts.push({ table, row })
      return { error: null }
    }
    // `touchHotContact` (le « contact chaud » de l'agent) : sans effet ici.
    self.upsert = () => Promise.resolve({ error: null })
    self.then = (resolve: (r: unknown) => void) => resolve(lire() ? echec : { data: resoudre(), error: null })
    return self
  }
  const client = {
    from,
    // `erreurSur` peut aussi viser un `rpc`, par son NOM — exercé par les tests de désignation par texte
    // (`wa_matching_biens_designes`) et par ceux des fonctions d'écriture (`wa_matching_consigner`, `wa_matching_visite`).
    rpc: async (nom: string, args: Record<string, unknown>) => {
      appels.push({ rpc: nom, args })
      const rang = appels.filter((a) => a.rpc === nom).length
      const cle = opts.erreurSur?.has(nom) ? nom : opts.erreurSur?.has(`${nom}#${rang}`) ? `${nom}#${rang}` : null
      if (cle) {
        const code = opts.erreurCode?.[cle]
        return { data: null, error: { message: `erreur simulée sur rpc ${nom}`, ...(code ? { code } : {}) } }
      }
      const brut = rpc[nom]
      // `p_limite` coupe les lignes configurées comme le ferait le `limit` réel de la fonction : un appelant qui
      // demanderait la mauvaise limite reçoit un nombre de lignes différent, jamais les mêmes.
      const limite = typeof args.p_limite === 'number' ? args.p_limite : undefined
      const data = Array.isArray(brut) && limite != null ? brut.slice(0, limite) : (brut ?? null)
      return { data, error: null }
    },
  }
  return { client, appels, inserts, lectures }
}

const ctx = (client: unknown, lang: 'fr' | 'en' = 'fr'): ActionCtx => ({ supabase: client as never, profileId: 'p-agent', agencyId: A, lang })

/** La forme chaînable du faux client, pour les tests qui l'exercent directement (sans passer par un exécuteur). */
interface FauxChainable extends PromiseLike<{ data: Ligne[]; error: { message: string; code?: string } | null }> {
  select: () => FauxChainable
  eq: (c: string, v: unknown) => FauxChainable
  gt: (c: string, v: unknown) => FauxChainable
  order: (c: string, o?: { ascending?: boolean; nullsFirst?: boolean }) => FauxChainable
  limit: (n: number) => FauxChainable
  maybeSingle: () => Promise<{ data: Ligne | null; error: { message: string; code?: string } | null }>
}
const chainable = (client: { from: (t: string) => unknown }, table: string): FauxChainable => client.from(table) as unknown as FauxChainable

const contacts: Ligne[] = [
  { id: JULIE, agency_id: A, first_name: 'Julie', last_name: 'Martin' },
  { id: AUTRE, agency_id: B, first_name: 'Hors', last_name: 'Agence' },
]
const annonces: Ligne[] = [
  { id: ATTIQUE, title: 'Attique 4 p.', address: 'Route de Florissant 12', city: 'Genève', price: 1_500_000, transaction_type: 'buy', status: 'active' },
  { id: STUDIO, title: 'Studio', address: 'Rue du Lac 2', city: 'Genève', price: 450_000, transaction_type: 'buy', status: 'active' },
]
const mandats: Ligne[] = [
  { id: VILLA, agency_id: A, deleted_at: null, title: 'Villa contemporaine', address: 'Chemin des Hauts 3', city: 'Cologny', price: 4_200_000, transaction_type: 'buy', status: 'active', off_market: false },
]
const m = (o: Ligne): Ligne => ({
  agency_id: A, contact_id: JULIE, status: 'suggested', score: 80, reasons: null, client_search_id: null, property_id: null,
  market_listing_id: null, snoozed_until: null, sent_at: null, response_at: null, reaction_motif: null, reaction_note: null,
  prix_propose: null, created_at: '2026-09-01T00:00:00Z', ...o,
})

/**
 * `n` matchs de Julie (LIMITE_DEPART+1 par défaut ; `status`, `suggested` par défaut) sur autant d'annonces
 * DISTINCTES et RÉSOLVABLES — de quoi couper la page de `prepareRecordMatchOutcome` (mesuré en production le
 * 25.09.2026, jusqu'à 1 142 matchs `suggested` pour un seul acheteur), sans rapport avec le bien qu'un test désigne par
 * ailleurs. Scores décroissants : le tri (score desc, puis id) reste déterministe.
 */
function pageDebordante(status = 'suggested', n = 101): { matches: Ligne[]; annonces: Ligne[] } {
  const annonces: Ligne[] = []
  const matches: Ligne[] = []
  for (let i = 0; i < n; i++) {
    const id = `d9000000-0000-4000-8000-${String(i).padStart(12, '0')}`
    annonces.push({ id, title: `Bruit ${i}`, address: `Rue du Bruit ${i}`, city: 'Genève', price: 1_000_000, transaction_type: 'buy', status: 'active' })
    matches.push(m({ id: `f9000000-0000-4000-8000-${String(i).padStart(12, '0')}`, market_listing_id: id, score: 1000 - i, status }))
  }
  return { matches, annonces }
}

describe('execGetMatches — les biens vivants d’un acheteur de l’agence', () => {
  it('rend les biens en cours puis à proposer, jamais un refusé ; la lecture est filtrée par agence', async () => {
    const { client } = fauxClient({
      contacts, market_listings: annonces, properties: mandats, client_searches: [],
      matches: [
        m({ id: 'm1', status: 'sent', sent_at: '2026-09-20T10:00:00Z', market_listing_id: ATTIQUE }),
        m({ id: 'm2', status: 'rejected', market_listing_id: STUDIO }),
        m({ id: 'm3', property_id: VILLA, score: 91 }),
        m({ id: 'm4', agency_id: B, market_listing_id: STUDIO }),
      ],
    })
    const r = JSON.parse(await execGetMatches(ctx(client), { contact_id: JULIE }))
    expect(r.contact).toBe('Julie Martin')
    expect(r.biens.map((b: { id: string; etat: { code: string } }) => [b.id, b.etat.code])).toEqual([[ATTIQUE, 'propose'], [VILLA, 'a_proposer']])
  })
})

describe('execGetMatches — identifiant refusé, contact absent, lecture du contact en échec', () => {
  it('un contact d’une autre agence : introuvable', async () => {
    const { client } = fauxClient({ contacts, matches: [] })
    expect(await execGetMatches(ctx(client), { contact_id: AUTRE })).toMatch(/introuvable/)
  })

  it('un nom passé en guise d’identifiant : message dédié (search_contacts), jamais confondu avec « introuvable »', async () => {
    const { client } = fauxClient({ contacts, matches: [] })
    const r = await execGetMatches(ctx(client), { contact_id: 'Julie Martin' })
    expect(r).not.toMatch(/introuvable/)
    expect(r).toMatch(/search_contacts/)
  })

  it('une ERREUR de lecture du contact (panne, pas une absence) → LECTURE_IMPOSSIBLE, jamais « introuvable »', async () => {
    const { client } = fauxClient({ contacts, matches: [] }, {}, { erreurSur: new Set(['contacts']) })
    const r = await execGetMatches(ctx(client), { contact_id: JULIE })
    expect(r).not.toMatch(/introuvable/)
    expect(r).toMatch(/momentanément impossible/)
  })
})

describe('execGetMatches — résolution des biens : agence, suppression, critères, lecture en échec', () => {
  const MANDAT_B = 'e0000000-0000-4000-8000-000000000002'
  const MANDAT_SUPPRIME = 'e0000000-0000-4000-8000-000000000003'
  const SEARCH_ID = 'f0000000-0000-4000-8000-000000000001'

  it('un match vers un mandat ACTIF d’une AUTRE agence : absent de la réponse (son id n’apparaît nulle part)', async () => {
    const { client } = fauxClient({
      contacts, market_listings: [], client_searches: [],
      properties: [{ id: MANDAT_B, agency_id: B, deleted_at: null, title: 'Bien agence B', city: 'Lausanne', price: 999_000, transaction_type: 'buy', status: 'active', off_market: false }],
      matches: [m({ id: 'm-b', property_id: MANDAT_B, score: 88 })],
    })
    const raw = await execGetMatches(ctx(client), { contact_id: JULIE })
    expect(raw).not.toContain(MANDAT_B)
    expect(JSON.parse(raw).biens).toEqual([])
  })

  it('un match vers un mandat SUPPRIMÉ (deleted_at posé) de l’agence A : absent de la réponse', async () => {
    const { client } = fauxClient({
      contacts, market_listings: [], client_searches: [],
      properties: [{ id: MANDAT_SUPPRIME, agency_id: A, deleted_at: '2026-09-01T00:00:00Z', title: 'Mandat supprimé', city: 'Genève', price: 1_000_000, transaction_type: 'buy', status: 'active', off_market: false }],
      matches: [m({ id: 'm-sup', property_id: MANDAT_SUPPRIME, score: 88 })],
    })
    const raw = await execGetMatches(ctx(client), { contact_id: JULIE })
    expect(raw).not.toContain(MANDAT_SUPPRIME)
    expect(JSON.parse(raw).biens).toEqual([])
  })

  it('un match avec client_search_id fait apparaître ses critères (l’aller-retour recherche → explication)', async () => {
    const { client } = fauxClient({
      contacts, properties: [], market_listings: annonces,
      client_searches: [{ id: SEARCH_ID, agency_id: A, criteria: { budget_max: 2_000_000 } }],
      matches: [m({ id: 'm-crit', market_listing_id: ATTIQUE, client_search_id: SEARCH_ID, score: 88 })],
    })
    const r = JSON.parse(await execGetMatches(ctx(client), { contact_id: JULIE }))
    expect(r.biens).toHaveLength(1)
    expect(r.biens[0].criteres.length).toBeGreaterThan(0)
    expect(r.biens[0].criteres[0]).toMatchObject({ critere: 'budget' })
  })

  it('une lecture des BIENS en erreur (properties) → LECTURE_IMPOSSIBLE', async () => {
    const { client } = fauxClient(
      { contacts, market_listings: [], client_searches: [], properties: mandats, matches: [m({ id: 'm-err', property_id: VILLA, score: 88 })] },
      {}, { erreurSur: new Set(['properties']) },
    )
    expect(await execGetMatches(ctx(client), { contact_id: JULIE })).toMatch(/momentanément impossible/)
  })

  // Le filtre d'agence de `lireCriteres` (.eq('agency_id', …) sur client_searches) doit avoir un témoin : sans lui,
  // un match de A citant une recherche de B pourrait fuir sans qu'aucun test ne le voie.
  it('un match de l’agence A cite une recherche (client_search_id) de l’agence B : ses critères restent VIDES', async () => {
    const SEARCH_B = 'f0000000-0000-4000-8000-000000000002'
    const { client } = fauxClient({
      contacts, properties: [], market_listings: annonces,
      client_searches: [{ id: SEARCH_B, agency_id: B, criteria: { budget_max: 2_000_000, zones: ['Lausanne'] } }],
      matches: [m({ id: 'm-xb', market_listing_id: ATTIQUE, client_search_id: SEARCH_B, score: 88 })],
    })
    const r = JSON.parse(await execGetMatches(ctx(client), { contact_id: JULIE }))
    expect(r.biens).toHaveLength(1)
    // Le bien reste rendu (il est résolu, lui) ; seuls SES CRITÈRES, empruntés à une recherche hors agence, sont tus.
    expect(r.biens[0].criteres).toEqual([])
  })
})

describe('fauxClient — tri à clés multiples fidèle à PostgREST', () => {
  it('order(score desc).order(created_at desc).order(id).limit(2) garde les MEILLEURS scores, départagés par created_at, jamais par id seul', async () => {
    const { client } = fauxClient({
      t: [
        { id: 'a', score: 90, created_at: '2026-01-01T00:00:00Z' },
        { id: 'b', score: 90, created_at: '2026-03-01T00:00:00Z' }, // même score, plus récent → devant 'a'
        { id: 'c', score: 50, created_at: '2026-09-01T00:00:00Z' }, // created_at le plus récent, mais score pire → exclu
      ],
    })
    const r = await chainable(client, 't')
      .select().order('score', { ascending: false }).order('created_at', { ascending: false }).order('id').limit(2)
    expect(r.data.map((l) => l.id)).toEqual(['b', 'a'])
  })

  it('les nulls suivent PostgreSQL par défaut : en dernier en ASC, en premier en DESC', async () => {
    const { client } = fauxClient({ t: [{ id: 'x', v: 1 }, { id: 'y', v: null }, { id: 'z', v: 2 }] })
    const asc = await chainable(client, 't').select().order('v').limit(3)
    expect(asc.data.map((l) => l.id)).toEqual(['x', 'z', 'y'])
    const desc = await chainable(client, 't').select().order('v', { ascending: false }).limit(3)
    expect(desc.data.map((l) => l.id)).toEqual(['y', 'z', 'x'])
  })
})

describe('fauxClient — nulls, doublons et comparaisons numériques', () => {
  it('null et undefined comptent comme la MÊME absence : leur ordre relatif suit l’ordre d’entrée, quel qu’il soit', async () => {
    // Un tri STABLE (garanti par la spec depuis ES2019) garde deux lignes « égales » dans leur ordre D'ENTRÉE.
    // Un comparateur qui traiterait `null` et `undefined` différemment se contredirait (voir le commentaire de
    // `trier`) : cette égalité de traitement, elle, ne dépend pas de l'ordre — la vérifier dans les DEUX sens le
    // prouve mieux qu'un résultat unique, qui pourrait n'être vrai que par accident.
    const { client: c1 } = fauxClient({ t: [{ id: 'a', v: null }, { id: 'b', v: undefined }] })
    const r1 = await chainable(c1, 't').select().order('v').limit(2)
    expect(r1.data.map((l) => l.id)).toEqual(['a', 'b'])
    const { client: c2 } = fauxClient({ t: [{ id: 'b', v: undefined }, { id: 'a', v: null }] })
    const r2 = await chainable(c2, 't').select().order('v').limit(2)
    expect(r2.data.map((l) => l.id)).toEqual(['b', 'a'])
  })

  it('`.gt` compare aussi un numérique écrit en CHAÎNE, comme PostgreSQL sur une colonne `numeric`', async () => {
    const { client } = fauxClient({ t: [{ id: 'x', prix_propose: '1000000' }, { id: 'y', prix_propose: 5 }, { id: 'z', prix_propose: null }, { id: 'w', prix_propose: 'pas un nombre' }] })
    const r = await chainable(client, 't').select().gt('prix_propose', 0).order('id').limit(4)
    expect(r.data.map((l) => l.id)).toEqual(['x', 'y'])
  })

  it('`.maybeSingle()` sur PLUSIEURS lignes rend une ERREUR (PGRST116), jamais la première ligne en silence', async () => {
    const { client } = fauxClient({ t: [{ id: 'x', v: 1 }, { id: 'x', v: 2 }] })
    const r = await chainable(client, 't').select().eq('id', 'x').maybeSingle()
    expect(r.data).toBeNull()
    expect(r.error).not.toBeNull()
  })

  it('`opts.erreurSur` peut aussi viser un `rpc`, par son NOM', async () => {
    const { client } = fauxClient({}, { ma_fonction: 'jamais lu' }, { erreurSur: new Set(['ma_fonction']) })
    const r = await client.rpc('ma_fonction', {})
    expect(r.data).toBeNull()
    expect(r.error).not.toBeNull()
  })
})

describe('execGetMatches — la coupe à 40 ne perd pas un « revenu » au score égal', () => {
  it('41 annonces au même score, plus récentes, n’évincent pas le bien revenu pour le prix : il reste visible, et le total porte un « + »', async () => {
    const marche: Ligne[] = []
    const matches: Ligne[] = []
    for (let i = 1; i <= 41; i++) {
      const id = `d0000000-0000-4000-8000-${String(i).padStart(12, '0')}`
      marche.push({ id, title: `Annonce ${i}`, address: 'Rue 1', city: 'Genève', price: 1_000_000, transaction_type: 'buy', status: 'active' })
      matches.push(m({ id: `f0000000-0000-4000-8000-${String(i).padStart(12, '0')}`, market_listing_id: id, score: 95, created_at: '2026-09-20T00:00:00Z' }))
    }
    const REVENU = 'e0000000-0000-4000-8000-000000000009'
    marche.push({ id: REVENU, title: 'Le bien revenu', address: 'Rue 2', city: 'Genève', price: 900_000, transaction_type: 'buy', status: 'active' })
    matches.push(m({
      id: 'f0000000-0000-4000-8000-000000000099', market_listing_id: REVENU, score: 95,
      created_at: '2026-06-01T00:00:00Z', sent_at: '2026-06-01T00:00:00Z', reaction_motif: 'prix', prix_propose: 1_000_000,
    }))
    const { client } = fauxClient({ contacts, market_listings: marche, properties: [], client_searches: [], matches })
    const r = JSON.parse(await execGetMatches(ctx(client), { contact_id: JULIE }))
    const ids = r.biens.map((b: { id: string }) => b.id)
    expect(ids).toContain(REVENU)
    // Score égal partout : le REVENU porte un signal (baisse depuis son refus), les 41 autres non — il passe devant.
    expect(ids[0]).toBe(REVENU)
    expect(r.total.a_proposer).toMatch(/\+$/)
  })

  // `revenus.mord` SEUL (sans `aProposer.mord`) ne doit jamais poser un « + » sur un total déjà EXACT : la lecture
  // « à proposer » peut avoir tout lu quand la lecture « revenus », bien plus bornée, mord sur son propre plafond —
  // ça ne change rien à ce qui est déjà connu en entier.
  it('onze revenus, onze matchs à proposer AU TOTAL (bien sous 40) : le total est EXACT, sans « + »', async () => {
    const marche: Ligne[] = []
    const matches: Ligne[] = []
    for (let i = 1; i <= 11; i++) {
      const id = `d0000000-0000-4000-8000-${String(i).padStart(12, '0')}`
      marche.push({ id, title: `Annonce ${i}`, address: 'Rue 1', city: 'Genève', price: 900_000, transaction_type: 'buy', status: 'active' })
      matches.push(m({
        id: `f0000000-0000-4000-8000-${String(i).padStart(12, '0')}`, market_listing_id: id,
        sent_at: `2026-06-${String(i).padStart(2, '0')}T00:00:00Z`, reaction_motif: 'prix', prix_propose: 1_000_000,
      }))
    }
    const { client } = fauxClient({ contacts, market_listings: marche, properties: [], client_searches: [], matches })
    const r = JSON.parse(await execGetMatches(ctx(client), { contact_id: JULIE }))
    expect(r.biens).toHaveLength(8) // MAX_BIENS : les onze existent, huit au plus sont montrés
    expect(r.total.a_proposer).toBe('11')
  })
})

describe('execGetMatches — « en cours » au-delà de 30 ne perd pas l’intéressé prioritaire', () => {
  it('31 propositions récentes + 1 intéressé plus ancien : l’intéressé reste visible, le total porte un « + »', async () => {
    const marche: Ligne[] = []
    const matches: Ligne[] = []
    for (let i = 1; i <= 31; i++) {
      const id = `d0000000-0000-4000-8000-${String(i).padStart(12, '0')}`
      marche.push({ id, title: `Annonce ${i}`, address: 'Rue 1', city: 'Genève', price: 1_000_000, transaction_type: 'buy', status: 'active' })
      matches.push(m({
        id: `f0000000-0000-4000-8000-${String(i).padStart(12, '0')}`, market_listing_id: id, status: 'sent',
        sent_at: `2026-09-${String(10 + (i % 15)).padStart(2, '0')}T10:00:00Z`,
      }))
    }
    const INTERESSE = 'e0000000-0000-4000-8000-000000000009'
    marche.push({ id: INTERESSE, title: 'Le bien qui intéresse Julie', address: 'Rue 2', city: 'Genève', price: 1_000_000, transaction_type: 'buy', status: 'active' })
    matches.push(m({ id: 'f0000000-0000-4000-8000-000000000099', market_listing_id: INTERESSE, status: 'interested', sent_at: '2026-08-01T10:00:00Z' }))
    const { client } = fauxClient({ contacts, market_listings: marche, properties: [], client_searches: [], matches })
    const r = JSON.parse(await execGetMatches(ctx(client), { contact_id: JULIE }))
    const ids = r.biens.map((b: { id: string }) => b.id)
    expect(ids).toContain(INTERESSE)
    // « Intéressé » est le rang le plus prioritaire de la vue (RANG_EN_COURS) : il passe en tête.
    expect(ids[0]).toBe(INTERESSE)
    expect(r.total.en_cours).toMatch(/\+$/)
  })
})

/**
 * `execGetBuyersForProperty` : la désignation par TEXTE tourne EN BASE (`wa_matching_biens_designes`, migration
 * `…_matching_whatsapp.sql`, §5) — ce faux client ne réimplémente PAS ce SQL (c'est `tests/unit/matching-whatsapp-sql.spec.ts`
 * et `tests/backend/matching-whatsapp.spec.ts`, W4, qui le prouvent) : il simule seulement ce que la fonction
 * RENDRAIT pour ces données, par son `rpc`, et ce fichier n'éprouve donc que ce que
 * `designerBien`/`execGetBuyersForProperty` en FONT (l'appel à limite+1 avec l'agence et les mots corrects,
 * `aLaLimite`, l'affinage `candidats`, la seconde lecture en colonnes complètes, la propagation des pannes, et qu'une
 * lecture coupée ne rend jamais un bien seul comme LE bien). Un identifiant, lui, reste résolu en TypeScript (mandat
 * d'abord, annonce seulement à défaut — sans jamais interroger la base par texte).
 */
describe('execGetBuyersForProperty — qui pour ce bien', () => {
  const tables = {
    contacts, market_listings: annonces, properties: mandats,
    matches: [
      m({ id: 'b1', property_id: VILLA, score: 88 }),
      m({ id: 'b2', property_id: VILLA, status: 'rejected' }),
      m({ id: 'b3', market_listing_id: ATTIQUE, status: 'sent' }),
    ],
  }
  /** La ligne coarse que `wa_matching_biens_designes` rendrait pour un bien de fixture : {genre,id,titre,adresse,ville}. */
  const D = (genre: 'mandat' | 'annonce', b: Ligne) => ({ genre, id: b.id, titre: b.title, adresse: b.address, ville: b.city })
  const rpcVilla = { wa_matching_biens_designes: [D('mandat', mandats[0])] }

  it('un mandat désigné par son nom : ses compatibles, sans les refus', async () => {
    const { client } = fauxClient(tables, rpcVilla)
    const r = JSON.parse(await execGetBuyersForProperty(ctx(client), { bien: 'la villa de Cologny' }))
    expect(r.bien).toMatchObject({ id: VILLA, genre: 'mandat' })
    expect(r.total).toBe('1')
    expect(r.acheteurs).toEqual([{ contact_id: JULIE, nom: 'Julie Martin', score: 88, etat: { code: 'a_proposer' } }])
  })

  it('sinon, une annonce suivie par l’agence', async () => {
    const { client } = fauxClient(tables, { wa_matching_biens_designes: [D('annonce', annonces[0])] })
    const r = JSON.parse(await execGetBuyersForProperty(ctx(client), { bien: 'attique Florissant' }))
    expect(r.bien).toMatchObject({ id: ATTIQUE, genre: 'annonce' })
  })

  it('JAMAIS choisir entre un mandat et une annonce qui répondent tous les deux (conception §3, principe 5)', async () => {
    // Un mandat « Route de Florissant 20 » ET l'attique « Route de Florissant 12 », où Julie est intéressée :
    // un mandat ne doit jamais répondre SEUL et masquer une annonce qui répond aussi. Les deux ressortent, mandat en tête.
    const MFLO = 'e0000000-0000-4000-8000-0000000000f1'
    const mandatFlo = { id: MFLO, agency_id: A, deleted_at: null, title: 'Appartement 5 p.', address: 'Route de Florissant 20', city: 'Genève', price: 2_000_000, transaction_type: 'buy', status: 'active', off_market: false }
    const { client } = fauxClient(
      { contacts, market_listings: annonces, properties: [...mandats, mandatFlo], matches: [m({ id: 'c1', market_listing_id: ATTIQUE, status: 'interested' })] },
      { wa_matching_biens_designes: [D('mandat', mandatFlo), D('annonce', annonces[0])] },
    )
    const r = JSON.parse(await execGetBuyersForProperty(ctx(client), { bien: 'Florissant' }))
    expect(r.candidats).toHaveLength(2)
    expect(r.candidats.map((c: { id: string }) => c.id)).toEqual([MFLO, ATTIQUE]) // mandat en tête
    expect(r.total).toBe('2')
    expect(r.acheteurs).toBeUndefined()
  })

  it('« 5 sur N » : sept candidats affinés, cinq montrés, le total dit RÉELLEMENT sept (plus le couplage muet de l’ancien code)', async () => {
    const sept = Array.from({ length: 7 }, (_, i) => ({
      id: `d2000000-0000-4000-8000-${String(i).padStart(12, '0')}`, title: `Appartement ${i}`, address: `Rue du Rhône ${i + 1}`, city: 'Genève',
      price: 900_000, transaction_type: 'buy', status: 'active',
    }))
    const { client } = fauxClient(
      { contacts, properties: mandats, market_listings: sept, matches: [] },
      { wa_matching_biens_designes: sept.map((a) => D('annonce', a)) },
    )
    const r = JSON.parse(await execGetBuyersForProperty(ctx(client), { bien: 'appartement Rhône' }))
    expect(r.candidats).toHaveLength(5)
    expect(r.total).toBe('7')
  })

  it('un texte qui ne désigne aucun bien (la base ne rend rien) : introuvable', async () => {
    const { client } = fauxClient(tables) // pas de wa_matching_biens_designes configuré → la base ne rend rien
    const r = JSON.parse(await execGetBuyersForProperty(ctx(client), { bien: 'chalet à Lausanne' }))
    expect(r).toEqual({ introuvable: true, note: 'Aucun mandat de l’agence ni aucune annonce suivie ne correspond à « chalet à Lausanne ».' })
  })

  it('la lecture en base a MORDU (LIMITE_DESIGNES+1) et l’affinage n’a rien gardé parmi ce qu’elle a vu : jamais « introuvable », mais « trop large »', async () => {
    // 51 lignes (LIMITE_DESIGNES+1) qu'aucune ne matche le texte cherché : un bien RÉEL pourrait exister plus loin,
    // au-delà de ce que la lecture a pu voir — l'affirmer « introuvable » mentirait sur ce qu'on ignore.
    const bruit = Array.from({ length: 51 }, (_, i) => ({
      id: `d5000000-0000-4000-8000-${String(i).padStart(12, '0')}`, genre: 'annonce', titre: `Studio ${i}`, adresse: `Rue ${i}`, ville: 'Lausanne',
    }))
    const { client } = fauxClient({ contacts, properties: mandats, market_listings: annonces, matches: [] }, { wa_matching_biens_designes: bruit })
    const r = await execGetBuyersForProperty(ctx(client), { bien: 'attique Florissant' })
    expect(r).not.toMatch(/introuvable/)
    expect(r).toMatch(/trop large/)
  })

  it('une annonce RETIRÉE reste désignable : la réponse le dit (`retire: true`), sans anciens prospects (réservé aux mandats), et NOTE_MODELE le dit aussi', async () => {
    const RETIREE = 'd0000000-0000-4000-8000-000000000003'
    const annonceRetiree = { id: RETIREE, title: 'Chalet Retiré', address: 'Route de la Neige 9', city: 'Verbier', price: 800_000, transaction_type: 'buy', status: 'removed' }
    const { client } = fauxClient(
      { contacts, properties: mandats, market_listings: [...annonces, annonceRetiree], matches: [m({ id: 'b5', market_listing_id: RETIREE, score: 70 })] },
      { wa_matching_biens_designes: [D('annonce', annonceRetiree)] },
    )
    const r = JSON.parse(await execGetBuyersForProperty(ctx(client), { bien: 'Verbier' }))
    expect(r.bien).toMatchObject({ id: RETIREE, genre: 'annonce', retire: true })
    expect(r.anciens_prospects).toBeUndefined()
    expect(r.acheteurs).toEqual([{ contact_id: JULIE, nom: 'Julie Martin', score: 70, etat: { code: 'a_proposer' } }])
    // Un bien retiré ne se propose plus non plus à ses acquéreurs (comme la fiche du CRM, QuiPourFiche.tsx:~71).
    expect(r.note).toMatch(/retiré/)
  })

  it('un mandat ACTIF : la réponse rappelle que les anciens prospects sont sur sa fiche (conception §5.2, 3ᵉ puce)', async () => {
    const { client } = fauxClient(tables, rpcVilla)
    const r = JSON.parse(await execGetBuyersForProperty(ctx(client), { bien: VILLA }))
    expect(r.anciens_prospects).toBe('S\'il y en a, ils sont sur la fiche du mandat, dans le CRM (« Qui pour ce bien ? ») : ils s\'y réactivent d\'un geste.')
  })

  it('un acheteur dont la fiche est HORS AGENCE est écarté AVANT de compter (comme `versCompatible`, filQuiPour.ts)', async () => {
    const { client } = fauxClient({ contacts, market_listings: annonces, properties: mandats, matches: [m({ id: 'c4', property_id: VILLA, contact_id: AUTRE })] }, rpcVilla)
    const raw = await execGetBuyersForProperty(ctx(client), { bien: VILLA })
    expect(raw).not.toContain('Hors')
    expect(JSON.parse(raw).total).toBe('0')
    expect(JSON.parse(raw).acheteurs).toEqual([])
  })

  it('101 acheteurs distincts sur un bien : leurs fiches se lisent TOUTES, en deux lots de 100 — le total n’en perd aucune', async () => {
    const ids = Array.from({ length: 101 }, (_, i) => `c9000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`)
    const { client } = fauxClient({
      contacts: ids.map((id, i) => ({ id, agency_id: A, first_name: `P${i}`, last_name: 'Cent' })),
      market_listings: annonces, properties: mandats,
      matches: ids.map((id, i) => m({ id: `f9000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, contact_id: id, property_id: VILLA, score: 101 - i })),
    }, rpcVilla)
    const r = JSON.parse(await execGetBuyersForProperty(ctx(client), { bien: VILLA }))
    expect(r.total).toBe('101')
    expect(r.acheteurs).toHaveLength(10)
    expect(r.acheteurs.every((a: { nom: string }) => a.nom !== '—')).toBe(true)
  })

  describe('par IDENTIFIANT (UUID) — résolu en TypeScript, jamais par un appel à la base', () => {
    it('un UUID de mandat de l’agence : ce mandat, avec ses compatibles (même résultat que par le nom)', async () => {
      const { client } = fauxClient(tables)
      const r = JSON.parse(await execGetBuyersForProperty(ctx(client), { bien: VILLA }))
      expect(r.bien).toMatchObject({ id: VILLA, genre: 'mandat' })
      expect(r.total).toBe('1')
      expect(r.acheteurs).toEqual([{ contact_id: JULIE, nom: 'Julie Martin', score: 88, etat: { code: 'a_proposer' } }])
    })

    it('un UUID de mandat d’une AUTRE agence : ne le désigne pas', async () => {
      const HORS_AGENCE = 'e0000000-0000-4000-8000-000000000010'
      const { client } = fauxClient({
        contacts, market_listings: annonces, matches: [],
        properties: [...mandats, { id: HORS_AGENCE, agency_id: B, deleted_at: null, title: 'Bien agence B', address: 'Rue de Lausanne 1', city: 'Lausanne', price: 1_000_000, transaction_type: 'buy', status: 'active', off_market: false }],
      })
      const r = JSON.parse(await execGetBuyersForProperty(ctx(client), { bien: HORS_AGENCE }))
      expect(r).toEqual({ introuvable: true, note: `Aucun mandat de l’agence ni aucune annonce suivie ne correspond à « ${HORS_AGENCE} ».` })
    })

    it('un UUID de mandat SUPPRIMÉ (deleted_at posé) : ne le désigne pas', async () => {
      const SUPPRIME = 'e0000000-0000-4000-8000-000000000011'
      const { client } = fauxClient({
        contacts, market_listings: annonces, matches: [],
        properties: [...mandats, { id: SUPPRIME, agency_id: A, deleted_at: '2026-09-01T00:00:00Z', title: 'Mandat supprimé', address: 'Rue X 1', city: 'Genève', price: 1_000_000, transaction_type: 'buy', status: 'active', off_market: false }],
      })
      const r = JSON.parse(await execGetBuyersForProperty(ctx(client), { bien: SUPPRIME }))
      expect(r).toEqual({ introuvable: true, note: `Aucun mandat de l’agence ni aucune annonce suivie ne correspond à « ${SUPPRIME} ».` })
    })

    it('un identifiant d’annonce SANS match dans l’agence est désigné (total 0) — le texte, lui, dirait introuvable (asymétrie assumée : la désignation par texte exige un match compatible, la désignation par id non)', async () => {
      const { client } = fauxClient({ contacts, properties: mandats, market_listings: annonces, matches: [] })
      const parId = JSON.parse(await execGetBuyersForProperty(ctx(client), { bien: STUDIO }))
      const parTexte = JSON.parse(await execGetBuyersForProperty(ctx(client), { bien: 'studio Genève' }))
      expect(parId.total).toBe('0')
      expect(parTexte.introuvable).toBe(true)
    })

    it('le mandat se lit D’ABORD, l’annonce SEULEMENT s’il est absent : une panne sur les annonces ne fait pas échouer une réponse que le mandat a déjà résolue', async () => {
      const { client } = fauxClient(tables, {}, { erreurSur: new Set(['market_listings']) })
      // VILLA est un mandat : la lecture de market_listings (qui échouerait) n'est jamais atteinte.
      const r = JSON.parse(await execGetBuyersForProperty(ctx(client), { bien: VILLA }))
      expect(r.bien).toMatchObject({ id: VILLA, genre: 'mandat' })
    })

    it('défense en profondeur : même si la base désignait par erreur un mandat hors agence, la lecture complète par id (agency_id) l’écarte — jamais une fuite, une panne lue', async () => {
      // Un id qui ressemble à un mandat de CETTE agence, mais dont la ligne réelle (properties) est hors scope :
      // ne peut arriver que si wa_matching_biens_designes elle-même avait un défaut — la lecture par id, en TS,
      // reste le dernier rempart et ne doit jamais afficher ce qu'elle ne peut pas relire dans son propre périmètre.
      const HORS_AGENCE = 'e0000000-0000-4000-8000-000000000010'
      const { client } = fauxClient({
        contacts, market_listings: annonces,
        properties: [...mandats, { id: HORS_AGENCE, agency_id: B, deleted_at: null, title: 'Bien agence B', address: 'Rue de Lausanne 1', city: 'Lausanne', price: 1_000_000, transaction_type: 'buy', status: 'active', off_market: false }],
        matches: [],
      }, { wa_matching_biens_designes: [{ genre: 'mandat', id: HORS_AGENCE, titre: 'Bien agence B', adresse: 'Rue de Lausanne 1', ville: 'Lausanne' }] })
      const r = await execGetBuyersForProperty(ctx(client), { bien: 'Lausanne' })
      expect(r).toMatch(/momentanément impossible/)
    })

    it('défense en profondeur : un mandat SUPPRIMÉ que la base désignerait par erreur n’est pas relu non plus', async () => {
      const SUPPRIME = 'e0000000-0000-4000-8000-0000000000c1'
      const supprime = { ...mandats[0], id: SUPPRIME, deleted_at: '2026-09-01T00:00:00Z', title: 'Chalet supprimé', city: 'Verbier' }
      const { client } = fauxClient(
        { contacts, properties: [...mandats, supprime], market_listings: annonces, matches: [] },
        { wa_matching_biens_designes: [D('mandat', supprime)] },
      )
      const raw = await execGetBuyersForProperty(ctx(client), { bien: 'chalet Verbier' })
      expect(raw).not.toContain(SUPPRIME)
    })

    it('une panne de la lecture complète reste une panne même avec PLUSIEURS candidats désignés, jamais une liste vide', async () => {
      const villaClassique = { ...mandats[0], id: 'e0000000-0000-4000-8000-0000000000a2', title: 'Villa classique' }
      const { client } = fauxClient(
        { contacts, properties: [...mandats, villaClassique], market_listings: annonces, matches: [] },
        { wa_matching_biens_designes: [D('mandat', mandats[0]), D('mandat', villaClassique)] },
        { erreurSur: new Set(['properties']) },
      )
      expect(await execGetBuyersForProperty(ctx(client), { bien: 'villa Cologny' })).toMatch(/momentanément impossible/)
    })

    it('la base est appelée à LIMITE+1, pour l’agence de l’agent, avec les mots nettoyés (pas le texte brut)', async () => {
      const { client, appels } = fauxClient({ contacts, properties: mandats, market_listings: annonces, matches: [] }, rpcVilla)
      await execGetBuyersForProperty(ctx(client), { bien: 'la villa de Cologny' })
      expect(appels).toContainEqual({ rpc: 'wa_matching_biens_designes', args: { p_agency: A, p_mots: ['villa', 'cologny'], p_limite: 51 } })
    })
  })

  describe('gardes de tenant et de désignation', () => {
    it('annonce PARTAGÉE : l’acheteur d’une autre agence sur la même annonce ne sort pas', async () => {
      const { client } = fauxClient({
        contacts, properties: mandats, market_listings: annonces,
        matches: [
          m({ id: 'g1a', market_listing_id: ATTIQUE, score: 70 }),
          m({ id: 'g1b', agency_id: B, contact_id: AUTRE, market_listing_id: ATTIQUE, score: 95 }),
        ],
      })
      const raw = await execGetBuyersForProperty(ctx(client), { bien: ATTIQUE })
      expect(raw).not.toContain(AUTRE)
      expect(JSON.parse(raw).total).toBe('1')
    })

    it('un match d’une AUTRE agence sur l’annonce PARTAGÉE, dont le contact_id existe AUSSI chez nous, est écarté par le filtre d’agence de CETTE lecture — pas seulement par celui, séparé, des contacts', async () => {
      // Sans cette ligne, un match orphelin de l'agence B (matches_insert, RLS, ne vérifie que agency_id) pointant
      // vers un contact qui EXISTE chez nous (JULIE) passerait le filtre des NOMS (lui-même scopé agence) et
      // masquerait la vraie fuite : le score et le statut d'un match d'une autre agence resteraient visibles.
      const { client } = fauxClient({
        contacts, properties: mandats, market_listings: annonces,
        matches: [
          m({ id: 'g1a', market_listing_id: ATTIQUE, score: 70 }),
          m({ id: 'fuite-agence', agency_id: B, contact_id: JULIE, market_listing_id: ATTIQUE, score: 999 }),
        ],
      })
      const r = JSON.parse(await execGetBuyersForProperty(ctx(client), { bien: ATTIQUE }))
      expect(r.total).toBe('1')
      expect(r.acheteurs).toEqual([{ contact_id: JULIE, nom: 'Julie Martin', score: 70, etat: { code: 'a_proposer' } }])
    })

    it('SELECT des compatibles inclut `snoozed_until` : un match REPORTÉ (date future) n’est pas montré « à proposer »', async () => {
      const { client } = fauxClient({
        contacts, properties: mandats, market_listings: annonces,
        matches: [m({ id: 'report', property_id: VILLA, score: 80, snoozed_until: '2099-01-01T00:00:00Z' })],
      }, rpcVilla)
      const r = JSON.parse(await execGetBuyersForProperty(ctx(client), { bien: VILLA }))
      expect(r.acheteurs[0].etat).toEqual({ code: 'reporte', jusqua: '01.01.2099' })
    })

    it('une lecture coupée dont UN SEUL bien survit à l’affinage n’est jamais rendue comme LE bien, sans question', async () => {
      // La base coupe le sur-ensemble à LIMITE_DESIGNES+1, trié par genre puis id — SANS RAPPORT avec la pertinence
      // du texte cherché. Cinquante annonces de bruit portent « rue », « lac » et un « 2 » CONTENU dans leur numéro
      // (« 20 », « 21 »… : la base les rend), jamais le « 2 » entier que `candidats` exige — l'affinage ne garde que
      // la vraie. D'autres, au-delà de la coupe, auraient pu passer aussi — la base ne les a pas rendues, et le
      // silence sur leur existence ne doit pas se lire comme leur absence.
      const bruit = Array.from({ length: 50 }, (_, i) => ({
        id: `d6000000-0000-4000-8000-${String(i).padStart(12, '0')}`, title: 'Appartement lumineux', address: `Rue du Lac 2${i}`,
        city: 'Genève', price: 900_000, transaction_type: 'buy', status: 'active',
      }))
      const vraie = { id: 'd6000000-0000-4000-8000-999999999999', title: 'Studio', address: 'Rue du Lac 2', city: 'Genève', price: 450_000, transaction_type: 'buy', status: 'active' }
      const lignes = [vraie, ...bruit]
      const { client } = fauxClient(
        { contacts, properties: mandats, market_listings: lignes, matches: [m({ id: 'k1', market_listing_id: vraie.id, status: 'interested' })] },
        { wa_matching_biens_designes: lignes.map((l) => D('annonce', l)) },
      )
      const r = JSON.parse(await execGetBuyersForProperty(ctx(client), { bien: 'rue du Lac 2' }))
      expect(r.bien).toBeUndefined()
      expect(r.candidats).toEqual([expect.objectContaining({ id: vraie.id })])
      expect(r.total).toBe('1+')
      // Une question VIDE passerait les deux assertions ci-dessus : celle rendue à l'agent doit dire l'incertitude.
      expect(r.question).toMatch(/trop large/)
    })

    it('exactement 50 biens désignés : le total est EXACT, « 50 », sans « + » — la 51ᵉ ligne seule dit la coupe', async () => {
      const lignes = Array.from({ length: 50 }, (_, i) => ({
        id: `d7100000-0000-4000-8000-${String(i).padStart(12, '0')}`, title: `Appartement ${i}`, address: `Rue du Rhône ${i + 100}`,
        city: 'Genève', price: 900_000, transaction_type: 'buy', status: 'active',
      }))
      const { client } = fauxClient({ contacts, properties: mandats, market_listings: lignes, matches: [] }, { wa_matching_biens_designes: lignes.map((l) => D('annonce', l)) })
      const r = JSON.parse(await execGetBuyersForProperty(ctx(client), { bien: 'appartement Rhône' }))
      expect(r.total).toBe('50')
      expect(r.question).toMatch(/^Plusieurs biens correspondent/)
    })

    it('lecture coupée et PLUSIEURS candidats affinés : le total porte déjà un « + »', async () => {
      const lignes = Array.from({ length: 51 }, (_, i) => ({
        id: `d7000000-0000-4000-8000-${String(i).padStart(12, '0')}`, title: `Appartement ${i}`, address: `Rue du Rhône ${i + 100}`,
        city: 'Genève', price: 900_000, transaction_type: 'buy', status: 'active',
      }))
      const { client } = fauxClient({ contacts, properties: mandats, market_listings: lignes, matches: [] }, { wa_matching_biens_designes: lignes.map((l) => D('annonce', l)) })
      const r = JSON.parse(await execGetBuyersForProperty(ctx(client), { bien: 'appartement Rhône' }))
      expect(r.total).toBe('50+')
      expect(r.candidats).toHaveLength(5)
    })

    it('une PANNE n’est jamais lue comme une absence, sur CHAQUE lecture — identifiant, texte, compatibles, noms', async () => {
      const matchesVilla = { ...tables, matches: [m({ id: 'g6', property_id: VILLA, score: 80 })] }
      const cas: [string, ReadonlySet<string>, Record<string, unknown>][] = [
        ['properties (identifiant → mandat)', new Set(['properties']), { bien: VILLA }],
        ['market_listings (identifiant → annonce, mandat absent)', new Set(['market_listings']), { bien: STUDIO }],
        ['wa_matching_biens_designes (texte)', new Set(['wa_matching_biens_designes']), { bien: 'la villa de Cologny' }],
        ['properties (texte, lecture complète du candidat mandat)', new Set(['properties']), { bien: 'la villa de Cologny' }],
        ['matches (compatibles)', new Set(['matches']), { bien: VILLA }],
        ['contacts (noms)', new Set(['contacts']), { bien: VILLA }],
      ]
      for (const [label, erreurSur, args] of cas) {
        const { client } = fauxClient(matchesVilla, rpcVilla, { erreurSur })
        const r = await execGetBuyersForProperty(ctx(client), args)
        expect(r, label).toMatch(/momentanément impossible/)
      }
    })

    it('une panne sur la lecture complète d’une ANNONCE désignée par texte est aussi une panne, jamais une absence', async () => {
      const { client } = fauxClient(
        { contacts, properties: mandats, market_listings: annonces, matches: [] },
        { wa_matching_biens_designes: [D('annonce', annonces[0])] },
        { erreurSur: new Set(['market_listings']) },
      )
      const r = await execGetBuyersForProperty(ctx(client), { bien: 'attique Florissant' })
      expect(r).toMatch(/momentanément impossible/)
    })

    it('coupe à 200 : le MEILLEUR score reste, même s’il a le plus grand id (scores distincts — une coupe par id seul ne le prouverait pas)', async () => {
      const lignes = Array.from({ length: 200 }, (_, i) => m({ id: `f0000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, property_id: VILLA, score: 50 }))
      lignes.push(m({ id: 'f0000000-0000-4000-8000-999999999999', property_id: VILLA, score: 99 }))
      const { client } = fauxClient({ contacts, market_listings: annonces, properties: mandats, matches: lignes }, rpcVilla)
      const r = JSON.parse(await execGetBuyersForProperty(ctx(client), { bien: VILLA }))
      expect(r.total).toBe('200+')
      expect(r.acheteurs[0].score).toBe(99)
    })

    it('exactement 200 compatibles (scores DISTINCTS) : le total est EXACT, SANS « + » — le cas qui a motivé la lecture à LIMITE+1', async () => {
      const lignes = Array.from({ length: 200 }, (_, i) => m({ id: `f1000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, property_id: VILLA, score: 200 - i }))
      const { client } = fauxClient({ contacts, market_listings: annonces, properties: mandats, matches: lignes }, rpcVilla)
      const r = JSON.parse(await execGetBuyersForProperty(ctx(client), { bien: VILLA }))
      expect(r.total).toBe('200')
      expect(r.acheteurs[0].score).toBe(200) // le meilleur score, jamais perdu par une coupe à l'id
    })

    it('les DIX acheteurs montrés ont leur nom', async () => {
      const ids = Array.from({ length: 12 }, (_, i) => `c1000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`)
      const { client } = fauxClient({
        contacts: ids.map((id, i) => ({ id, agency_id: A, first_name: `P${i}`, last_name: 'N' })),
        market_listings: annonces, properties: mandats,
        matches: ids.map((id, i) => m({ id: `g8-${String(i).padStart(2, '0')}`, contact_id: id, property_id: VILLA, score: 90 - i })),
      }, rpcVilla)
      const r = JSON.parse(await execGetBuyersForProperty(ctx(client), { bien: VILLA }))
      expect(r.acheteurs).toHaveLength(10)
      expect(r.acheteurs.every((a: { nom: string }) => a.nom !== '—')).toBe(true)
    })

    it('le nom d’une fiche hors agence ne sort pas (et n’est pas compté du tout — voir le test dédié ci-dessus)', async () => {
      const { client } = fauxClient({ contacts, market_listings: annonces, properties: mandats, matches: [m({ id: 'g9', property_id: VILLA, contact_id: AUTRE })] }, rpcVilla)
      const raw = await execGetBuyersForProperty(ctx(client), { bien: VILLA })
      expect(raw).not.toContain('Hors')
    })
  })

  describe('garde-fous du copilote (sans agence, bien vide)', () => {
    it('sans agence : refuse avant toute lecture', async () => {
      const { client } = fauxClient(tables, rpcVilla)
      const sansAgence: ActionCtx = { supabase: client as never, profileId: 'p-agent', agencyId: null, lang: 'fr' }
      expect(await execGetBuyersForProperty(sansAgence, { bien: VILLA })).toMatch(/aucune agence/)
    })

    it('bien vide ou absent : demande de préciser, sans lire la base', async () => {
      const { client, appels } = fauxClient(tables, rpcVilla)
      expect(await execGetBuyersForProperty(ctx(client), { bien: '' })).toMatch(/quel bien/)
      expect(await execGetBuyersForProperty(ctx(client), {})).toMatch(/quel bien/)
      expect(appels).toEqual([]) // aucun rpc appelé
    })

    it('un texte sans mot utile (« le bien ») ne désigne rien, sans appeler la base', async () => {
      const { client, appels } = fauxClient(tables, rpcVilla)
      expect(JSON.parse(await execGetBuyersForProperty(ctx(client), { bien: 'le bien' }))).toMatchObject({ introuvable: true })
      expect(appels).toEqual([])
    })
  })
})

// ── record_match_outcome ────────────────────────────────────────────────────

const MARC = 'c0000000-0000-4000-8000-000000000003'
const contactsAvecMarc: Ligne[] = [...contacts, { id: MARC, agency_id: A, first_name: 'Marc', last_name: 'Roux' }]
/** Les libellés que le copilote montre de ces trois biens (`libelleBien`). */
const ATT = 'Attique 4 p. · Route de Florissant 12'
const STU = 'Studio · Rue du Lac 2'
const VIL = 'Villa contemporaine · Chemin des Hauts 3'
const ECHEC = "La consignation a échoué — rien n'a été écrit. Réessaie dans un instant."

/**
 * La ligne que `wa_matching_biens_de_l_acheteur` rendrait pour ce match et ce bien. Comme pour
 * `wa_matching_biens_designes`, ce banc ne réimplémente pas le SQL (W5, tests/backend/matching-whatsapp.spec.ts) : il
 * dit ce que la base RENDRAIT, et éprouve ce que l'exécuteur en fait.
 */
const LA = (match: Ligne, genre: 'mandat' | 'annonce', b: Ligne) => ({
  match_id: match.id, genre, id: b.id, titre: b.title ?? null, adresse: b.address ?? null, ville: b.city ?? null,
})
const erreur = (p: Prepared): string => {
  if (p.ok) throw new Error(`une question, là où un refus était attendu : ${p.prompt}`)
  return p.error
}

describe('prepareRecordMatchOutcome — la question Oui / Non, ou un refus qui nomme les biens', () => {
  const r1 = m({ id: 'r1', status: 'sent', market_listing_id: ATTIQUE })
  const r2 = m({ id: 'r2', status: 'sent', market_listing_id: STUDIO })
  const tables = { contacts, market_listings: annonces, properties: mandats, matches: [r1, r2] }

  it('un seul bien répond : la question dit tout ce qui s’écrira, la charge porte le match', async () => {
    const { client, appels } = fauxClient(tables, { wa_matching_biens_de_l_acheteur: [LA(r1, 'annonce', annonces[0])] })
    const p = await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien: 'attique', reponse: 'pas_interesse', motif: 'prix', note: 'trop cher' })
    // Le bien nommé est « titre · adresse » (libelleBien) : deux annonces au même titre restent distinguables.
    expect(p).toEqual({
      ok: true,
      prompt: 'Je consigne pour Julie Martin : « Attique 4 p. · Route de Florissant 12 » — pas intéressé·e, motif prix (« trop cher »). Tu confirmes ? (« oui » / « non »)',
      payload: { match_id: 'r1', reponse: 'pas_interesse', motif: 'prix', note: 'trop cher', nom: 'Julie Martin', bien: ATT },
    })
    expect(appels).toEqual([{
      rpc: 'wa_matching_biens_de_l_acheteur',
      args: { p_agency: A, p_contact: JULIE, p_statuts: ['sent', 'interested'], p_mots: ['attique'], p_limite: 51 },
    }])
  })

  it('plusieurs biens, aucun bien : un refus qui les nomme, jamais une question', async () => {
    const { client } = fauxClient(tables)
    expect(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, reponse: 'interesse' })).toEqual({
      ok: false,
      error: `Plusieurs biens pour Julie Martin correspondent : « ${ATT} », « ${STU} ». Lequel ?`,
    })
    expect(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien: 'villa', reponse: 'interesse' })).toEqual({
      ok: false,
      error: `Aucun bien proposé en attente de réponse pour Julie Martin ne correspond. Ceux que je vois : « ${ATT} », « ${STU} ». Lequel ?`,
    })
  })

  it('une réponse inconnue, un refus sans motif, un acheteur hors agence ou non résolu : un refus qui dit quoi faire, sans rien lire des biens', async () => {
    const { client, appels, lectures } = fauxClient(tables)
    expect(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, reponse: 'bof' }))
      .toEqual({ ok: false, error: 'Quelle réponse ? propose, interesse, pas_interesse ou pas_encore.' })
    expect(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien: 'attique', reponse: 'pas_interesse' })).toEqual({
      ok: false,
      error: 'Pour « pas intéressé », il me faut le motif : prix, quartier, surface, pièces, type de bien, équipements, état du bien ou autre.',
    })
    for (const contact_id of [AUTRE, 'Julie Martin', undefined]) {
      expect(await prepareRecordMatchOutcome(ctx(client), { contact_id, bien: 'attique', reponse: 'interesse' }), String(contact_id))
        .toEqual({ ok: false, error: 'Quel acheteur ? Retrouve-le d’abord avec search_contacts.' })
    }
    expect(appels).toEqual([])
    expect(lectures.filter((t) => t !== 'contacts')).toEqual([])
  })
})

describe('prepareRecordMatchOutcome — le texte choisit la lecture', () => {
  it('un IDENTIFIANT se revérifie exactement, sans rpc — celui d’un mandat comme celui d’une annonce, même au-delà de la page', async () => {
    const { matches: bruit } = pageDebordante()
    const { client, appels } = fauxClient({
      contacts, market_listings: annonces, properties: mandats,
      matches: [...bruit, m({ id: 'm-villa', property_id: VILLA, score: 1 }), m({ id: 'm-studio', market_listing_id: STUDIO, score: 1 })],
    })
    expect(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien: VILLA, reponse: 'propose' }))
      .toMatchObject({ ok: true, payload: { match_id: 'm-villa', bien: VIL } })
    expect(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien: STUDIO, reponse: 'propose' }))
      .toMatchObject({ ok: true, payload: { match_id: 'm-studio', bien: STU } })
    expect(appels).toEqual([])
  })

  it('un match que les deux lectures d’un identifiant rendent ne donne qu’UNE question (dédoublonné par id de match)', async () => {
    // Improbable — le même uuid dans `property_id` et dans `market_listing_id` —, mais les deux lectures rendraient
    // alors le même match : sans le dédoublonnage, « plusieurs biens » nommerait deux fois le même bien.
    const { client } = fauxClient({
      contacts, market_listings: [{ ...annonces[0], id: VILLA }], properties: mandats,
      matches: [m({ id: 'm-double', property_id: VILLA, market_listing_id: VILLA })],
    })
    expect(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien: VILLA, reponse: 'propose' }))
      .toMatchObject({ ok: true, payload: { match_id: 'm-double' } })
  })

  it.each([
    ['propose', ['suggested']],
    ['interesse', ['sent']],
    ['pas_interesse', ['sent', 'interested']],
    ['pas_encore', ['sent']],
  ] as const)('des MOTS (« %s ») se désignent en base : l’agence de l’agent, CET acheteur, ses statuts de départ %j, les mots nettoyés, à LIMITE_DESIGNES+1', async (reponse, statuts) => {
    const { client, appels } = fauxClient({ contacts, market_listings: annonces, properties: [], matches: [] }, { wa_matching_biens_de_l_acheteur: [] })
    await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien: "l'attique de Florissant", reponse, motif: 'prix' })
    expect(appels).toEqual([{
      rpc: 'wa_matching_biens_de_l_acheteur',
      args: { p_agency: A, p_contact: JULIE, p_statuts: [...statuts], p_mots: ['attique', 'florissant'], p_limite: 51 },
    }])
  })

  it('un texte se désigne TOUJOURS en base, jamais dans la seule page : le bien au-delà d’elle répond aussi, rien n’est choisi', async () => {
    // La page (les cent meilleurs scores) ne voit que l'« Attique Nord » ; l'« Attique Sud », au-delà, répond aussi au
    // texte. Une désignation dans la page seule poserait la question sur Nord.
    const { matches: bruit, annonces: annoncesBruit } = pageDebordante()
    const nord = { id: 'd1000000-0000-4000-8000-00000000000a', title: 'Attique Nord', address: 'Rue Nord 1', city: 'Genève', price: 1_000_000, transaction_type: 'buy', status: 'active' }
    const sud = { id: 'd1000000-0000-4000-8000-00000000000b', title: 'Attique Sud', address: 'Rue Sud 2', city: 'Genève', price: 1_000_000, transaction_type: 'buy', status: 'active' }
    const mNord = m({ id: 'nord', market_listing_id: nord.id, score: 2000 })
    const mSud = m({ id: 'sud', market_listing_id: sud.id, score: 1 })
    const { client, lectures } = fauxClient(
      { contacts, properties: [], market_listings: [...annoncesBruit, nord, sud], matches: [...bruit, mNord, mSud] },
      { wa_matching_biens_de_l_acheteur: [LA(mNord, 'annonce', nord), LA(mSud, 'annonce', sud)] },
    )
    expect(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien: 'attique', reponse: 'propose' })).toEqual({
      ok: false,
      error: 'Plusieurs biens pour Julie Martin correspondent : « Attique Nord · Rue Nord 1 », « Attique Sud · Rue Sud 2 ». Lequel ?',
    })
    // Les biens désignés se lisent ; la page des matchs, non.
    expect(lectures).not.toContain('matches')
  })

  it('« le bien », « le », ou aucun texte ne disent rien du bien : la page, sans rpc — un seul bien qui attend s’y désigne de lui-même', async () => {
    const { client, appels } = fauxClient({ contacts, market_listings: annonces, properties: [], matches: [m({ id: 'seul', status: 'sent', market_listing_id: ATTIQUE })] })
    for (const bien of ['le bien', 'le', undefined]) {
      expect(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien, reponse: 'interesse' }), String(bien))
        .toMatchObject({ ok: true, payload: { match_id: 'seul', bien: ATT } })
    }
    expect(appels).toEqual([])
  })
})

describe('prepareRecordMatchOutcome — l’agence, l’acheteur et le statut de départ bornent chaque lecture', () => {
  it('la page ne lit que les matchs de CET acheteur : ceux de Marc, de la même agence, n’y entrent pas', async () => {
    const { client } = fauxClient({
      contacts: contactsAvecMarc, market_listings: annonces, properties: [],
      matches: [m({ id: 'julie', status: 'sent', market_listing_id: ATTIQUE }), m({ id: 'marc', contact_id: MARC, status: 'sent', market_listing_id: STUDIO, score: 99 })],
    })
    expect(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, reponse: 'interesse' }))
      .toMatchObject({ ok: true, payload: { match_id: 'julie' } })
  })

  it('un identifiant ne trouve que le match de CET acheteur : celui de Marc sur le même bien n’est pas le sien', async () => {
    const { client } = fauxClient({
      contacts: contactsAvecMarc, market_listings: annonces, properties: [],
      matches: [m({ id: 'marc', contact_id: MARC, status: 'sent', market_listing_id: ATTIQUE })],
    })
    expect(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien: ATTIQUE, reponse: 'interesse' }))
      .toEqual({ ok: false, error: "Julie Martin n'a aucun bien proposé en attente de réponse." })
  })

  it.each([
    ['propose', 'suggested', 'sent'],
    ['interesse', 'sent', 'interested'],
    ['pas_interesse', 'interested', 'suggested'],
    ['pas_encore', 'sent', 'rejected'],
  ] as const)('« %s » ne voit que ses matchs au statut de départ (%s), jamais un autre (%s) — par la page comme par l’identifiant', async (reponse, garde, ecarte) => {
    const { client } = fauxClient({
      contacts, market_listings: annonces, properties: [],
      matches: [m({ id: 'garde', status: garde, market_listing_id: ATTIQUE, score: 10 }), m({ id: 'ecarte', status: ecarte, market_listing_id: STUDIO, score: 90 })],
    })
    const args = { contact_id: JULIE, reponse, motif: 'prix' }
    expect(await prepareRecordMatchOutcome(ctx(client), args)).toMatchObject({ ok: true, payload: { match_id: 'garde' } })
    expect(await prepareRecordMatchOutcome(ctx(client), { ...args, bien: ATTIQUE })).toMatchObject({ ok: true, payload: { match_id: 'garde' } })
    expect((await prepareRecordMatchOutcome(ctx(client), { ...args, bien: STUDIO })).ok).toBe(false)
  })

  it('un match de Julie porté par une AUTRE agence n’est trouvé ni par la page, ni par son identifiant ; la désignation en base reçoit l’agence de l’agent', async () => {
    const fuite = m({ id: 'fuite', agency_id: B, status: 'sent', market_listing_id: STUDIO, score: 99 })
    const { client, appels } = fauxClient({ contacts, market_listings: annonces, properties: [], matches: [m({ id: 'ok', status: 'sent', market_listing_id: ATTIQUE }), fuite] })
    expect(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, reponse: 'interesse' }))
      .toMatchObject({ ok: true, payload: { match_id: 'ok' } })
    expect((await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien: STUDIO, reponse: 'interesse' })).ok).toBe(false)
    await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien: 'studio', reponse: 'interesse' })
    expect(appels.map((x) => x.args.p_agency)).toEqual([A])
  })
})

describe('prepareRecordMatchOutcome — les frontières des lectures', () => {
  const cinqPremiers = [0, 1, 2, 3, 4].map((i) => `« Bruit ${i} · Rue du Bruit ${i} »`).join(', ')

  it('la page : 100 matchs, elle est complète (« 5 sur 100 ») ; 101, elle est coupée (« 5 sur plus de 100 »)', async () => {
    for (const [n, compte] of [[100, '(5 sur 100)'], [101, '(5 sur plus de 100)']] as const) {
      const { matches, annonces: marche } = pageDebordante('sent', n)
      const { client } = fauxClient({ contacts, market_listings: marche, properties: [], matches })
      expect(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, reponse: 'interesse' }), String(n)).toEqual({
        ok: false, error: `Plusieurs biens pour Julie Martin correspondent ${compte} : ${cinqPremiers}. Lequel ?`,
      })
    }
  })

  it('un texte qui ne désigne rien, une page coupée : « Ceux que je vois (5 sur plus de 100) »', async () => {
    const { matches, annonces: marche } = pageDebordante()
    const { client } = fauxClient({ contacts, market_listings: marche, properties: [], matches }, { wa_matching_biens_de_l_acheteur: [] })
    expect(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien: 'chalet', reponse: 'propose' })).toEqual({
      ok: false,
      error: `Aucun bien à proposer pour Julie Martin ne correspond. Ceux que je vois (5 sur plus de 100) : ${cinqPremiers}. Lequel ?`,
    })
  })

  it('la désignation : 50 lignes, elle tranche (« 5 sur 50 ») ; 51, « trop large » — ni un bien seul, ni « aucun »', async () => {
    const duplex = Array.from({ length: 51 }, (_, i) => ({
      id: `d3000000-0000-4000-8000-${String(i).padStart(12, '0')}`, title: `Duplex ${i}`, address: `Rue du Rhône ${i + 1}`,
      city: 'Genève', price: 1_000_000, transaction_type: 'buy', status: 'active',
    }))
    const matchs = duplex.map((d, i) => m({ id: `f3000000-0000-4000-8000-${String(i).padStart(12, '0')}`, market_listing_id: d.id, status: 'sent', score: 90 - i }))
    const lignes = duplex.map((d, i) => LA(matchs[i], 'annonce', d))
    const tablesDuplex = { contacts, properties: [], market_listings: duplex, matches: matchs }
    const { client: c50 } = fauxClient(tablesDuplex, { wa_matching_biens_de_l_acheteur: lignes.slice(0, 50) })
    expect(erreur(await prepareRecordMatchOutcome(ctx(c50), { contact_id: JULIE, bien: 'duplex', reponse: 'interesse' })))
      .toMatch(/^Plusieurs biens pour Julie Martin correspondent \(5 sur 50\) : « Duplex 0 · Rue du Rhône 1 »/)
    const { client: c51 } = fauxClient(tablesDuplex, { wa_matching_biens_de_l_acheteur: lignes })
    expect(await prepareRecordMatchOutcome(ctx(c51), { contact_id: JULIE, bien: 'duplex', reponse: 'interesse' })).toEqual({
      ok: false, error: "Pour Julie Martin, la recherche « duplex » est trop large pour trancher : donne l'adresse, ou l'identifiant du bien (via get_matches).",
    })
  })

  it('la page se lit par score décroissant, puis par id (`matches.score` est `integer not null`)', async () => {
    const LOFT = 'd0000000-0000-4000-8000-0000000000e1'
    const { client } = fauxClient({
      contacts, properties: mandats,
      market_listings: [...annonces, { id: LOFT, title: 'Loft', address: 'Rue Verte 1', city: 'Genève', status: 'active' }],
      matches: [
        m({ id: 'z-10', status: 'sent', market_listing_id: LOFT, score: 10 }),
        m({ id: 'b-50', status: 'sent', market_listing_id: STUDIO, score: 50 }),
        m({ id: 'a-50', status: 'sent', market_listing_id: ATTIQUE, score: 50 }),
        m({ id: 'c-90', status: 'sent', property_id: VILLA, score: 90 }),
      ],
    })
    expect(erreur(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, reponse: 'interesse' })))
      .toBe(`Plusieurs biens pour Julie Martin correspondent : « ${VIL} », « ${ATT} », « ${STU} », « Loft · Rue Verte 1 ». Lequel ?`)
  })
})

describe('prepareRecordMatchOutcome — « propose » ne vise jamais une annonce retirée', () => {
  const retiree = { id: 'd0000000-0000-4000-8000-000000000099', title: 'Loft Retiré Rhône', address: 'Rue du Rhône 5', city: 'Genève', price: 800_000, transaction_type: 'buy', status: 'removed' }
  const retiree2 = { id: 'd0000000-0000-4000-8000-000000000098', title: 'Duplex Retiré Rhône', address: 'Rue du Rhône 9', city: 'Genève', price: 700_000, transaction_type: 'buy', status: 'removed' }
  const vivante = { id: 'd0000000-0000-4000-8000-000000000097', title: 'Loft Vivant Rhône', address: 'Rue du Rhône 7', city: 'Genève', price: 900_000, transaction_type: 'buy', status: 'active' }
  const vivante2 = { id: 'd0000000-0000-4000-8000-000000000096', title: 'Studio Vivant Rhône', address: 'Rue du Rhône 11', city: 'Genève', price: 600_000, transaction_type: 'buy', status: 'active' }
  const RET = 'Loft Retiré Rhône · Rue du Rhône 5'
  const RE2 = 'Duplex Retiré Rhône · Rue du Rhône 9'
  const VIV = 'Loft Vivant Rhône · Rue du Rhône 7'
  const VI2 = 'Studio Vivant Rhône · Rue du Rhône 11'
  const mR = m({ id: 'rt1', market_listing_id: retiree.id, score: 90 })
  const mR2 = m({ id: 'rt2', market_listing_id: retiree2.id, score: 85 })
  const mV = m({ id: 'rt3', market_listing_id: vivante.id, score: 20 })
  const mV2 = m({ id: 'rt4', market_listing_id: vivante2.id, score: 10 })
  const marche = [...annonces, retiree, retiree2, vivante, vivante2]
  const preparer = (matches: Ligne[], designes: Ligne[] | null, bien?: string) => {
    const { client } = fauxClient({ contacts, market_listings: marche, properties: [], matches }, designes ? { wa_matching_biens_de_l_acheteur: designes } : {})
    return prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien, reponse: 'propose' })
  }

  it('une retirée seule : le refus la nomme, au singulier — rien de consigné', async () => {
    expect(await preparer([mR], [LA(mR, 'annonce', retiree)], 'Rhône')).toEqual({
      ok: false, error: `« ${RET} » est retirée du marché : elle ne se propose plus. Rien n'est consigné.`,
    })
  })

  it('deux retirées : au pluriel', async () => {
    expect(erreur(await preparer([mR, mR2], [LA(mR, 'annonce', retiree), LA(mR2, 'annonce', retiree2)], 'Rhône')))
      .toBe(`« ${RET} », « ${RE2} » sont retirées du marché : elles ne se proposent plus. Rien n'est consigné.`)
  })

  it('retirée ET vivante mêlées : la vivante seule, et la question', async () => {
    const p = await preparer([mR, mV], [LA(mR, 'annonce', retiree), LA(mV, 'annonce', vivante)], 'Rhône')
    expect(p).toMatchObject({ ok: true, payload: { match_id: 'rt3', bien: VIV } })
  })

  it('« plusieurs » ne nomme que les vivantes', async () => {
    const p = await preparer([mR, mV, mV2], [LA(mR, 'annonce', retiree), LA(mV, 'annonce', vivante), LA(mV2, 'annonce', vivante2)], 'Rhône')
    expect(erreur(p)).toBe(`Plusieurs biens pour Julie Martin correspondent : « ${VIV} », « ${VI2} ». Lequel ?`)
  })

  it('« Ceux que je vois » ne nomme aucune retirée', async () => {
    expect(erreur(await preparer([mR, mV], [], 'duplex')))
      .toBe(`Aucun bien à proposer pour Julie Martin ne correspond. Ceux que je vois : « ${VIV} ». Lequel ?`)
  })

  it('sans texte : la seule vivante se désigne d’elle-même ; que des retirées, le refus qui les nomme', async () => {
    expect(await preparer([mR, mV], null)).toMatchObject({ ok: true, payload: { match_id: 'rt3', bien: VIV } })
    expect(erreur(await preparer([mR, mR2], null)))
      .toBe(`« ${RET} », « ${RE2} » sont retirées du marché : elles ne se proposent plus. Rien n'est consigné.`)
  })

  it('« interesse » reste consignable sur une annonce retirée : la règle ne vaut que pour « propose »', async () => {
    const mS = m({ id: 'rt5', market_listing_id: retiree.id, status: 'sent' })
    const { client } = fauxClient({ contacts, market_listings: marche, properties: [], matches: [mS] }, { wa_matching_biens_de_l_acheteur: [LA(mS, 'annonce', retiree)] })
    expect(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien: 'Rhône', reponse: 'interesse' }))
      .toMatchObject({ ok: true, payload: { match_id: 'rt5', bien: RET } })
  })

  it('un MANDAT vendu se propose encore, comme dans le fil : la règle `occasion` des mandats attend la décision 12 du lot D1', async () => {
    const vendu = { ...mandats[0], id: 'e0000000-0000-4000-8000-0000000000d1', status: 'sold' }
    const mS = m({ id: 'rt6', property_id: vendu.id })
    const { client } = fauxClient({ contacts, market_listings: [], properties: [vendu], matches: [mS] }, { wa_matching_biens_de_l_acheteur: [LA(mS, 'mandat', vendu)] })
    expect(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien: 'villa', reponse: 'propose' }))
      .toMatchObject({ ok: true, payload: { match_id: 'rt6', bien: VIL } })
  })
})

describe('prepareRecordMatchOutcome — une page coupée où rien ne se nomme', () => {
  const supprimes = Array.from({ length: 101 }, (_, i) => ({
    id: `e7000000-0000-4000-8000-${String(i).padStart(12, '0')}`, agency_id: A, deleted_at: '2026-09-01T00:00:00Z',
    title: `Supprimé ${i}`, address: `Rue ${i}`, city: 'Genève', status: 'active',
  }))
  const surSupprimes = supprimes.map((p, i) => m({ id: `x${String(i).padStart(3, '0')}`, property_id: p.id }))

  it('sans texte, 101 matchs sur des mandats supprimés : ni « aucun bien », ni une liste vide — le copilote demande lequel', async () => {
    const { client } = fauxClient({ contacts, properties: supprimes, market_listings: [], matches: surSupprimes })
    expect(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, reponse: 'propose' })).toEqual({
      ok: false,
      error: 'Quel bien à proposer pour Julie Martin ? Il y en a trop pour que je les nomme : donne son nom, son adresse ou sa ville, ou son identifiant (via get_matches).',
    })
  })

  it('sans texte, une page coupée de retirées : pas « retirées » — d’autres attendent peut-être au-delà —, la même question', async () => {
    const { matches, annonces: marche } = pageDebordante()
    const { client } = fauxClient({ contacts, properties: [], market_listings: marche.map((a) => ({ ...a, status: 'removed' })), matches })
    expect(erreur(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, reponse: 'propose' }))).toMatch(/^Quel bien à proposer pour Julie Martin \?/)
  })

  it('sans texte, une page coupée où UN seul bien se nomme : « plusieurs (1 sur plus de 100) », jamais la question — d’autres attendent au-delà', async () => {
    const { client } = fauxClient({
      contacts, properties: supprimes, market_listings: annonces,
      matches: [...surSupprimes.slice(0, 100), m({ id: 'lisible', market_listing_id: ATTIQUE, score: 90 })],
    })
    expect(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, reponse: 'propose' })).toEqual({
      ok: false, error: `Plusieurs biens pour Julie Martin correspondent (1 sur plus de 100) : « ${ATT} ». Lequel ?`,
    })
  })

  it('sans texte, une page coupée où DEUX biens se nomment : « (2 sur plus de 100) » — jamais une liste courte qui passe pour entière', async () => {
    const annonce2 = { id: 'd0000000-0000-4000-8000-0000000000f2', title: 'Duplex', address: 'Rue Verte 2', city: 'Genève', status: 'active' }
    const { client } = fauxClient({
      contacts, properties: supprimes, market_listings: [...annonces, annonce2],
      matches: [...surSupprimes.slice(0, 99), m({ id: 'a', market_listing_id: ATTIQUE, score: 95 }), m({ id: 'd', market_listing_id: annonce2.id, score: 94 })],
    })
    expect(erreur(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, reponse: 'propose' })))
      .toBe(`Plusieurs biens pour Julie Martin correspondent (2 sur plus de 100) : « ${ATT} », « Duplex · Rue Verte 2 ». Lequel ?`)
  })

  it('un identifiant qui ne désigne rien, une page coupée où rien ne se nomme : « aucun ne correspond », jamais « n’a aucun bien »', async () => {
    const { client } = fauxClient({ contacts, properties: supprimes, market_listings: annonces, matches: surSupprimes })
    expect(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien: ATTIQUE, reponse: 'propose' }))
      .toEqual({ ok: false, error: 'Aucun bien à proposer pour Julie Martin ne correspond.' })
  })
})

describe('prepareRecordMatchOutcome — un match qui porte un mandat ET une annonce est nommé par son mandat', () => {
  it('sans texte, par l’identifiant de son annonce, par la ligne que la base rend : la question nomme la villa', async () => {
    const double = m({ id: 'm-double', status: 'sent', property_id: VILLA, market_listing_id: ATTIQUE })
    const { client } = fauxClient(
      { contacts, properties: mandats, market_listings: annonces, matches: [double] },
      { wa_matching_biens_de_l_acheteur: [LA(double, 'mandat', mandats[0])] },
    )
    for (const bien of [undefined, ATTIQUE, 'villa']) {
      expect(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien, reponse: 'interesse' }), String(bien))
        .toMatchObject({ ok: true, payload: { match_id: 'm-double', bien: VIL } })
    }
  })
})

describe('prepareRecordMatchOutcome — l’écho de ce que le copilote a montré désigne son bien', () => {
  // Une attique au n° 40 : la base la rend avec les autres (« attique » et « 4 », contenu dans « 40 »), `candidats`
  // l'écarte (un nombre est un mot entier).
  const attique40 = { id: 'd0000000-0000-4000-8000-0000000000b3', title: 'Attique 3 p.', address: 'Route de Florissant 40', city: 'Genève', price: 1_300_000, transaction_type: 'buy', status: 'active' }
  const jumeau = { id: 'd0000000-0000-4000-8000-0000000000b2', title: 'Attique 4 p. duplex', address: 'Route de Florissant 12', city: 'Genève', price: 1_700_000, transaction_type: 'buy', status: 'active' }
  const mA = m({ id: 'm-attique', status: 'sent', market_listing_id: ATTIQUE })
  const m40 = m({ id: 'm-attique40', status: 'sent', market_listing_id: attique40.id })
  const mJ = m({ id: 'm-jumeau', status: 'sent', market_listing_id: jumeau.id })
  const tables = { contacts, properties: [], market_listings: [...annonces, attique40, jumeau], matches: [mA, m40, mJ] }

  it('le TITRE nu à chiffres que get_matches a montré (« Attique 4 p. ») : retrouvé par les mots — son « 4 » entier, pas le « 40 » de l’autre', async () => {
    const { client } = fauxClient(tables, { wa_matching_biens_de_l_acheteur: [LA(m40, 'annonce', attique40), LA(mA, 'annonce', annonces[0])] })
    expect(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien: 'Attique 4 p.', reponse: 'interesse' }))
      .toMatchObject({ ok: true, payload: { match_id: 'm-attique', bien: ATT } })
  })

  it('le titre nu avec un leurre qui porte « attique » et le « 4 » dans son adresse : les DEUX, le copilote demande', async () => {
    const leurre = { id: 'd0000000-0000-4000-8000-0000000000b4', title: 'Attique 3 p.', address: 'Rue du Stand 4', city: 'Genève', price: 1_200_000, transaction_type: 'buy', status: 'active' }
    const mLe = m({ id: 'm-leurre', status: 'sent', market_listing_id: leurre.id })
    const { client } = fauxClient(
      { ...tables, market_listings: [...tables.market_listings, leurre], matches: [...tables.matches, mLe] },
      { wa_matching_biens_de_l_acheteur: [LA(mLe, 'annonce', leurre), LA(mA, 'annonce', annonces[0])] },
    )
    expect(erreur(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien: 'Attique 4 p.', reponse: 'interesse' })))
      .toBe(`Plusieurs biens pour Julie Martin correspondent : « Attique 3 p. · Rue du Stand 4 », « ${ATT} ». Lequel ?`)
  })

  it('le titre nu, avec un jumeau à la même adresse : les deux — c’est le LIBELLÉ qu’un refus a nommé qui désigne l’attique seule', async () => {
    const { client } = fauxClient(tables, { wa_matching_biens_de_l_acheteur: [LA(mJ, 'annonce', jumeau), LA(mA, 'annonce', annonces[0])] })
    expect(erreur(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien: 'Attique 4 p.', reponse: 'interesse' })))
      .toBe(`Plusieurs biens pour Julie Martin correspondent : « Attique 4 p. duplex · Route de Florissant 12 », « ${ATT} ». Lequel ?`)
    expect(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien: ATT, reponse: 'interesse' }))
      .toMatchObject({ ok: true, payload: { match_id: 'm-attique', bien: ATT } })
  })
})

describe('prepareRecordMatchOutcome — un refus est une phrase pour l’agent', () => {
  it('ni identifiant ni seconde ligne : au second refus d’un échange, whatsapp-agent le lui rend tel quel', async () => {
    const r1 = m({ id: 'r1', status: 'sent', market_listing_id: ATTIQUE })
    const r2 = m({ id: 'r2', status: 'sent', market_listing_id: STUDIO })
    const retiree = { id: 'd0000000-0000-4000-8000-000000000099', title: 'Loft Retiré', address: 'Rue du Rhône 5', city: 'Genève', status: 'removed' }
    const mR = m({ id: 'rt', market_listing_id: retiree.id })
    const { client } = fauxClient(
      { contacts, market_listings: [...annonces, retiree], properties: [], matches: [r1, r2, mR] },
      { wa_matching_biens_de_l_acheteur: [LA(mR, 'annonce', retiree)] },
    )
    const refus = [
      await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, reponse: 'interesse' }),
      await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien: 'villa', reponse: 'interesse' }),
      await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien: 'loft', reponse: 'propose' }),
    ].map(erreur)
    expect(refus.map((r) => r.slice(0, 12))).toEqual(['Plusieurs bi', 'Aucun bien p', '« Loft Retir'])
    for (const r of refus) {
      expect(r).not.toContain('\n')
      expect(r).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i)
    }
  })
})

describe('prepareRecordMatchOutcome — l’ÉCHO d’un libellé sur une désignation coupée', () => {
  // Une annonce SANS adresse : son libellé est « titre · ville », et « donne l'adresse » n'y aurait pas de réponse.
  const cible = { id: 'd1000000-0000-4000-8000-000000000001', title: 'Appartement 4.5 pièces', address: null, city: 'Genève', price: 1_000_000, transaction_type: 'buy', status: 'active' }
  const ECHO = 'Appartement 4.5 pièces · Genève'
  /** La cible et `n` voisins aux mêmes mots, dans l'ordre où la base les rendrait ; la cible en tête. */
  const monter = (n: number) => {
    const voisins = Array.from({ length: n }, (_, i) => ({
      id: `d2000000-0000-4000-8000-${String(i).padStart(12, '0')}`, title: `Appartement ${i % 3 + 3}.5 pièces`, address: `Rue ${i + 40}`,
      city: 'Genève', price: 900_000, transaction_type: 'buy', status: 'active',
    }))
    const biens = [cible, ...voisins]
    const matchs = biens.map((b, i) => m({ id: `e${String(i).padStart(3, '0')}`, market_listing_id: b.id }))
    return {
      tables: { contacts, properties: [], market_listings: biens, matches: matchs },
      rpc: { wa_matching_biens_de_l_acheteur: biens.map((b, i) => LA(matchs[i], 'annonce', b)) },
    }
  }

  it('coupée à 50 : l’écho se relit jusqu’à 200 (demande de 201), et le libellé désigne son bien', async () => {
    const { tables, rpc } = monter(50)
    const { client, appels } = fauxClient(tables, rpc)
    expect(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien: ECHO, reponse: 'propose' }))
      .toMatchObject({ ok: true, payload: { match_id: 'e000', bien: ECHO } })
    expect(appels.map((a) => a.args.p_limite)).toEqual([51, 201])
  })

  it('toujours coupée à 200 : un refus qui ne demande PAS l’adresse — la réponse se consigne depuis le CRM', async () => {
    const { tables, rpc } = monter(201)
    const { client } = fauxClient(tables, rpc)
    expect(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien: ECHO, reponse: 'propose' })).toEqual({
      ok: false, error: `Trop de biens de Julie Martin répondent aux mots de « ${ECHO} » pour que je tranche par WhatsApp : consigne cette réponse depuis le CRM.`,
    })
    expect(erreur(await prepareRecordMatchOutcome(ctx(client, 'en'), { contact_id: JULIE, bien: ECHO, reponse: 'propose' })))
      .toBe(`Too many of Julie Martin's properties match the words of « ${ECHO} » for me to settle this over WhatsApp: record the answer from the CRM.`)
  })

  it('exactement 200 à la seconde lecture : complète, le libellé désigne son bien — la 201ᵉ ligne seule dit la coupe', async () => {
    const { tables, rpc } = monter(199)
    const { client } = fauxClient(tables, rpc)
    expect(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien: ECHO, reponse: 'propose' }))
      .toMatchObject({ ok: true, payload: { match_id: 'e000' } })
  })

  it('sans « · », pas d’écho : une désignation coupée reste « trop large », sans seconde lecture', async () => {
    const { tables, rpc } = monter(50)
    const { client, appels } = fauxClient(tables, rpc)
    expect(erreur(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien: 'appartement 4.5 pièces genève', reponse: 'propose' })))
      .toBe("Pour Julie Martin, la recherche « appartement 4.5 pièces genève » est trop large pour trancher : donne l'adresse, ou l'identifiant du bien (via get_matches).")
    expect(appels).toHaveLength(1)
  })

  it('la seconde lecture en panne : l’échec — ni la première lecture gardée, ni « trop large »', async () => {
    const { tables, rpc } = monter(50)
    const { client } = fauxClient(tables, rpc, { erreurSur: new Set(['wa_matching_biens_de_l_acheteur#2']) })
    expect(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien: ECHO, reponse: 'propose' })).toEqual({ ok: false, error: ECHEC })
  })
})

describe('prepareRecordMatchOutcome — une panne n’est jamais une absence', () => {
  const r1 = m({ id: 'r1', status: 'sent', market_listing_id: ATTIQUE })
  const tables = { contacts, market_listings: annonces, properties: [], matches: [r1] }
  const cas: [string, ReadonlySet<string>, Record<string, unknown>, Record<string, unknown>][] = [
    ['la page des matchs (sans texte)', new Set(['matches']), { reponse: 'interesse' }, {}],
    ['les biens de la page (sans texte)', new Set(['market_listings']), { reponse: 'interesse' }, {}],
    ['la désignation en base (des mots)', new Set(['wa_matching_biens_de_l_acheteur']), { reponse: 'interesse', bien: 'attique' }, {}],
    ['les biens désignés (des mots)', new Set(['market_listings']), { reponse: 'interesse', bien: 'attique' }, { wa_matching_biens_de_l_acheteur: [LA(r1, 'annonce', annonces[0])] }],
    ['les matchs du bien (un identifiant)', new Set(['matches']), { reponse: 'interesse', bien: ATTIQUE }, {}],
    ['les biens du match (un identifiant)', new Set(['market_listings']), { reponse: 'interesse', bien: ATTIQUE }, {}],
    ['la page qui nomme « ceux que je vois »', new Set(['market_listings']), { reponse: 'interesse', bien: 'villa' }, { wa_matching_biens_de_l_acheteur: [] }],
    // La première lecture seule en panne : la page que relirait un refus « aucun », elle, se lirait — une panne lue
    // comme une absence rendrait alors « Ceux que je vois », jamais l'échec.
    ['les biens désignés seuls (des mots)', new Set(['market_listings#1']), { reponse: 'interesse', bien: 'attique' }, { wa_matching_biens_de_l_acheteur: [LA(r1, 'annonce', annonces[0])] }],
    ['les matchs du bien seuls (un identifiant)', new Set(['matches#1']), { reponse: 'interesse', bien: ATTIQUE }, {}],
    ['les biens du match seuls (un identifiant)', new Set(['market_listings#1']), { reponse: 'interesse', bien: ATTIQUE }, {}],
  ]

  it.each(cas)('%s en panne : l’échec, jamais « aucun » ni une question', async (_, erreurSur, args, rpc) => {
    const { client } = fauxClient(tables, rpc, { erreurSur })
    expect(await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, ...args })).toEqual({ ok: false, error: ECHEC })
  })

  it('panne à la lecture du contact : LECTURE_IMPOSSIBLE, jamais « introuvable »', async () => {
    const { client } = fauxClient({ contacts, matches: [] }, {}, { erreurSur: new Set(['contacts']) })
    const p = await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, reponse: 'interesse' })
    expect(p.ok).toBe(false)
    if (!p.ok) expect(p.error).toMatch(/momentanément impossible/)
  })

  it('un `contact_id` qui n’est pas un UUID : « Quel acheteur ? » SANS lecture, même les contacts en panne', async () => {
    const { client } = fauxClient({ contacts, matches: [] }, {}, { erreurSur: new Set(['contacts']) })
    const p = await prepareRecordMatchOutcome(ctx(client), { contact_id: 'Julie Martin', reponse: 'interesse' })
    expect(p.ok).toBe(false)
    if (!p.ok) {
      expect(p.error).toMatch(/Quel acheteur/)
      expect(p.error).not.toMatch(/momentanément impossible/)
    }
  })
})

describe('prepareRecordMatchOutcome — la note d’un refus', () => {
  const r1 = m({ id: 'r1', status: 'sent', market_listing_id: ATTIQUE })
  const rpc = { wa_matching_biens_de_l_acheteur: [LA(r1, 'annonce', annonces[0])] }
  const tables = { contacts, market_listings: annonces, properties: [], matches: [r1] }

  it('300 POINTS DE CODE au plus : un émoji à la frontière reste entier, jamais la moitié d’une paire', async () => {
    const { client } = fauxClient(tables, rpc)
    const p = await prepareRecordMatchOutcome(ctx(client), {
      contact_id: JULIE, bien: 'attique', reponse: 'pas_interesse', motif: 'prix', note: `${'é'.repeat(299)}😀 et la suite`,
    })
    if (!p.ok) throw new Error(p.error)
    const note = p.payload.note as string
    expect(note).toBe(`${'é'.repeat(299)}😀`)
    expect(Array.from(note)).toHaveLength(300)
    expect(p.prompt).toContain(`(« ${note} »)`)
  })

  it('une note ne vaut que pour « pas intéressé »', async () => {
    const { client } = fauxClient(tables, rpc)
    const p = await prepareRecordMatchOutcome(ctx(client), { contact_id: JULIE, bien: 'attique', reponse: 'interesse', note: 'adore la vue' })
    expect(p).toMatchObject({ ok: true, payload: { note: null } })
  })
})

describe('executeRecordMatchOutcome — l’écriture d’un bloc, par la base', () => {
  const payload = { match_id: 'r1', reponse: 'interesse', motif: null, note: null, nom: 'Julie Martin', bien: 'Attique 4 p.' }

  it('envoie l’agence et l’agent de la session, puis rend le compte rendu', async () => {
    const { client, appels } = fauxClient({}, { wa_matching_consigner: { ok: true, deja: false } })
    expect(await executeRecordMatchOutcome(ctx(client), payload)).toBe('✅ Consigné pour Julie Martin : « Attique 4 p. » — intéressé·e.')
    expect(appels).toEqual([{ rpc: 'wa_matching_consigner', args: { p_agency: A, p_profile: 'p-agent', p_match: 'r1', p_reponse: 'interesse', p_motif: null, p_note: null } }])
  })

  it.each([
    ['propose', 'sent', 'interested'],
    ['interesse', 'interested', 'rejected'],
    ['pas_interesse', 'rejected', 'suggested'],
  ] as const)('« %s » que la base n’écrit pas : « déjà consignée » si le match porte %s, « a changé » s’il porte %s ; hors agence, un troisième message', async (reponse, arrivee, autre) => {
    const charge = { ...payload, reponse, motif: 'prix' }
    const lire = (data: unknown) => executeRecordMatchOutcome(ctx(fauxClient({}, { wa_matching_consigner: data }).client), charge)
    const messages = [
      await lire({ ok: true, deja: true, statut: arrivee }),
      await lire({ ok: true, deja: true, statut: autre }),
      await lire({ ok: false }),
    ]
    expect(messages).toEqual([
      "Rien n'a été écrit : la réponse pour Julie Martin sur « Attique 4 p. » a déjà été consignée entre-temps.",
      "Rien n'a été écrit : « Attique 4 p. » n'attend plus cette réponse pour Julie Martin, il a changé entre-temps.",
      "Rien n'a été écrit : ce bien n'est plus dans la boucle de ton agence.",
    ])
  })

  it('« pas encore » n’écrit aucun statut : la base qui n’a rien écrit dit toujours que le bien a changé, jamais « déjà consignée »', async () => {
    for (const statut of ['interested', 'rejected', null, undefined]) {
      const { client } = fauxClient({}, { wa_matching_consigner: { ok: true, deja: true, statut } })
      expect(await executeRecordMatchOutcome(ctx(client), { ...payload, reponse: 'pas_encore' }), String(statut))
        .toBe("Rien n'a été écrit : « Attique 4 p. » n'attend plus cette réponse pour Julie Martin, il a changé entre-temps.")
    }
  })

  it('une charge illisible — réponse inconnue, match absent — ne va jamais jusqu’à la base', async () => {
    const { client, appels } = fauxClient({}, { wa_matching_consigner: { ok: true, deja: false } })
    expect(await executeRecordMatchOutcome(ctx(client), { ...payload, reponse: 'bof' })).toBe(ECHEC)
    expect(await executeRecordMatchOutcome(ctx(client), { ...payload, match_id: undefined })).toBe(ECHEC)
    expect(await executeRecordMatchOutcome(ctx(client), { ...payload, match_id: '   ' })).toBe(ECHEC)
    expect(appels).toEqual([])
  })

  it('le rpc en panne rend un échec, jamais une exception : « rien n’a été écrit » SEULEMENT si l’erreur porte un `code` Postgres', async () => {
    // Avec `code` : la base a VU la requête et l'a tranchée — « rien n'a été écrit » est de bonne foi.
    const codee = fauxClient({}, {}, { erreurSur: new Set(['wa_matching_consigner']), erreurCode: { wa_matching_consigner: '23505' } })
    await expect(executeRecordMatchOutcome(ctx(codee.client), payload)).resolves.toBe(ECHEC)
    // Sans `code` : une panne de TRANSPORT — la base a pu écrire avant que la réponse ne se perde.
    const sansCode = fauxClient({}, {}, { erreurSur: new Set(['wa_matching_consigner']) })
    const r = await executeRecordMatchOutcome(ctx(sansCode.client), payload)
    expect(r).toBe('Non confirmée — vérifie la fiche avant de réessayer.')
    expect(r).not.toBe(ECHEC)
  })

  it('« pas intéressé » transmet le motif ET la note à `wa_matching_consigner`', async () => {
    const { client, appels } = fauxClient({}, { wa_matching_consigner: { ok: true, deja: false } })
    const refus = { match_id: 'r2', reponse: 'pas_interesse', motif: 'prix', note: 'trop cher', nom: 'Julie Martin', bien: 'Attique 4 p.' }
    await executeRecordMatchOutcome(ctx(client), refus)
    expect(appels).toEqual([{ rpc: 'wa_matching_consigner', args: { p_agency: A, p_profile: 'p-agent', p_match: 'r2', p_reponse: 'pas_interesse', p_motif: 'prix', p_note: 'trop cher' } }])
  })

  it('sans agence, ni la préparation ni l’écriture ne lisent ni n’écrivent rien', async () => {
    const { client, appels, lectures } = fauxClient({ contacts, matches: [m({ id: 'r1', status: 'sent', market_listing_id: ATTIQUE })] }, { wa_matching_consigner: { ok: true, deja: false } })
    const sansAgence: ActionCtx = { supabase: client as never, profileId: 'p-agent', agencyId: null, lang: 'fr' }
    const refus = 'Erreur: ton compte n’est rattaché à aucune agence. Contacte un administrateur.'
    expect(await prepareRecordMatchOutcome(sansAgence, { contact_id: JULIE, reponse: 'interesse' })).toEqual({ ok: false, error: refus })
    expect(await executeRecordMatchOutcome(sansAgence, payload)).toBe(refus)
    expect(appels).toEqual([])
    expect(lectures).toEqual([])
  })
})

describe('record_match_outcome — en anglais, de bout en bout', () => {
  const r1 = m({ id: 'r1', status: 'sent', market_listing_id: ATTIQUE })
  const r2 = m({ id: 'r2', status: 'sent', market_listing_id: STUDIO })
  const tables = { contacts, market_listings: annonces, properties: [], matches: [r1, r2] }

  it('la question, puis le compte rendu', async () => {
    const { client } = fauxClient(tables, { wa_matching_biens_de_l_acheteur: [LA(r1, 'annonce', annonces[0])], wa_matching_consigner: { ok: true, deja: false } })
    const p = await prepareRecordMatchOutcome(ctx(client, 'en'), { contact_id: JULIE, bien: 'attique', reponse: 'pas_interesse', motif: 'prix', note: 'too expensive' })
    if (!p.ok) throw new Error(p.error)
    expect(p.prompt).toBe(`I'll record for Julie Martin: « ${ATT} » — not interested, reason: price (« too expensive »). Confirm? ("yes" / "no")`)
    expect(await executeRecordMatchOutcome(ctx(client, 'en'), p.payload)).toBe(`✅ Recorded for Julie Martin: « ${ATT} » — not interested (price).`)
  })

  it('les refus de la préparation', async () => {
    const { client } = fauxClient(tables)
    const en = (args: Record<string, unknown>) => prepareRecordMatchOutcome(ctx(client, 'en'), { contact_id: JULIE, ...args })
    expect(erreur(await en({ reponse: 'interesse' }))).toBe(`Several properties for Julie Martin match: « ${ATT} », « ${STU} ». Which one?`)
    expect(erreur(await en({ reponse: 'interesse', bien: 'villa' })))
      .toBe(`No property proposed and awaiting an answer for Julie Martin matches. Those I found: « ${ATT} », « ${STU} ». Which one?`)
    expect(erreur(await en({ reponse: 'bof' }))).toBe('Which answer? propose, interesse, pas_interesse or pas_encore.')
    expect(erreur(await en({ reponse: 'pas_interesse', bien: 'attique' })))
      .toBe('To record "not interested", I need the reason: price, neighbourhood, floor area, rooms, property type, features, condition or other.')
    expect(erreur(await en({ contact_id: AUTRE, reponse: 'interesse' }))).toBe('Which buyer? Find them first with search_contacts.')
    const { client: large } = fauxClient(tables, { wa_matching_biens_de_l_acheteur: Array.from({ length: 51 }, (_, i) => LA(m({ id: `l${i}` }), 'annonce', { id: `z${i}`, title: `Loft ${i}` })) })
    expect(erreur(await prepareRecordMatchOutcome(ctx(large, 'en'), { contact_id: JULIE, bien: 'loft', reponse: 'interesse' })))
      .toBe(`For Julie Martin, the search "loft" is too broad to settle: give the address, or the property's identifier (via get_matches).`)
  })

  it('un acheteur sans nom : « this contact » en anglais, « ce contact » en français — le repli suit la langue', async () => {
    const SANS_NOM = 'c0000000-0000-4000-8000-000000000009'
    const { client } = fauxClient({
      contacts: [...contacts, { id: SANS_NOM, agency_id: A, first_name: null, last_name: ' ' }], market_listings: annonces, properties: [],
      matches: [m({ id: 'x', contact_id: SANS_NOM, status: 'sent', market_listing_id: ATTIQUE })],
    })
    const en = await prepareRecordMatchOutcome(ctx(client, 'en'), { contact_id: SANS_NOM, reponse: 'interesse' })
    expect(en).toMatchObject({ ok: true, payload: { nom: 'this contact' }, prompt: `I'll record for this contact: « ${ATT} » — interested. Confirm? ("yes" / "no")` })
    expect(await prepareRecordMatchOutcome(ctx(client), { contact_id: SANS_NOM, reponse: 'interesse' })).toMatchObject({ ok: true, payload: { nom: 'ce contact' } })
  })

  it('les trois issues d’une écriture que la base refuse', async () => {
    const lire = (data: unknown) => executeRecordMatchOutcome(ctx(fauxClient({}, { wa_matching_consigner: data }).client, 'en'), {
      match_id: 'r1', reponse: 'interesse', nom: 'Julie Martin', bien: 'Attique 4 p.',
    })
    expect(await lire({ ok: true, deja: true, statut: 'interested' })).toBe("Nothing was written: Julie Martin's answer about « Attique 4 p. » was already recorded in the meantime.")
    expect(await lire({ ok: true, deja: true, statut: 'rejected' })).toBe('Nothing was written: « Attique 4 p. » is no longer waiting for this answer from Julie Martin — it changed in the meantime.')
    expect(await lire({ ok: false })).toBe('Nothing was written: this property is no longer in your agency’s loop.')
  })
})

describe('execGetBuyersForProperty — l’écho de ce que le copilote a montré désigne son bien', () => {
  const attique40 = { id: 'd0000000-0000-4000-8000-0000000000b3', title: 'Attique 3 p.', address: 'Route de Florissant 40', city: 'Genève', price: 1_300_000, transaction_type: 'buy', status: 'active' }
  const jumeau = { id: 'd0000000-0000-4000-8000-0000000000b2', title: 'Attique 4 p. duplex', address: 'Route de Florissant 12', city: 'Genève', price: 1_700_000, transaction_type: 'buy', status: 'active' }
  const D = (b: Ligne) => ({ genre: 'annonce', id: b.id, titre: b.title, adresse: b.address, ville: b.city })
  const tables = { contacts, properties: mandats, market_listings: [...annonces, attique40, jumeau], matches: [m({ id: 'e1', status: 'sent', market_listing_id: ATTIQUE })] }
  const julie = [{ contact_id: JULIE, nom: 'Julie Martin', score: 80, etat: { code: 'propose', le: null } }]

  it('le TITRE nu à chiffres (« Attique 4 p. ») : retrouvé par les mots — son « 4 » entier, pas le « 40 » de l’autre — et ses acheteurs', async () => {
    const { client } = fauxClient(tables, { wa_matching_biens_designes: [D(annonces[0]), D(attique40)] })
    const r = JSON.parse(await execGetBuyersForProperty(ctx(client), { bien: 'Attique 4 p.' }))
    expect(r.bien).toMatchObject({ id: ATTIQUE })
    expect(r.acheteurs).toEqual(julie)
  })

  it('le titre nu avec un leurre au « 4 » dans son adresse : les DEUX candidats et une question — jamais le leurre seul, avec ses acheteurs', async () => {
    const leurre = { id: 'd0000000-0000-4000-8000-0000000000b4', title: 'Attique 3 p.', address: 'Rue du Stand 4', city: 'Genève', price: 1_200_000, transaction_type: 'buy', status: 'active' }
    const { client } = fauxClient(
      { ...tables, market_listings: [...tables.market_listings, leurre] },
      { wa_matching_biens_designes: [D(leurre), D(annonces[0])] },
    )
    const r = JSON.parse(await execGetBuyersForProperty(ctx(client), { bien: 'Attique 4 p.' }))
    expect(r.acheteurs).toBeUndefined()
    expect(r.candidats.map((c: { id: string }) => c.id)).toEqual([leurre.id, ATTIQUE])
    expect(r.question).toMatch(/^Plusieurs biens correspondent/)
  })

  it('le LIBELLÉ (« Attique 4 p. · Route de Florissant 12 ») : l’attique, pas son jumeau à la même adresse — que le titre nu ne départage pas', async () => {
    const { client } = fauxClient(tables, { wa_matching_biens_designes: [D(annonces[0]), D(jumeau)] })
    const r = JSON.parse(await execGetBuyersForProperty(ctx(client), { bien: ATT }))
    expect(r.bien).toMatchObject({ id: ATTIQUE })
    expect(r.acheteurs).toEqual(julie)
    const nu = JSON.parse(await execGetBuyersForProperty(ctx(client), { bien: 'Attique 4 p.' }))
    expect(nu.candidats.map((c: { id: string }) => c.id)).toEqual([ATTIQUE, jumeau.id])
  })
})

describe('whatsapp-i18n — les refus de record_match_outcome, à l’égalité exacte', () => {
  const six = Array.from({ length: 6 }, (_, i) => `Bien ${i}`)
  const cinqNommes = '« Bien 0 », « Bien 1 », « Bien 2 », « Bien 3 », « Bien 4 »'

  it('trop large : le texte cherché, en français et en anglais', () => {
    expect(consignerTropLarge('fr', 'Julie', 'appartement')).toBe("Pour Julie, la recherche « appartement » est trop large pour trancher : donne l'adresse, ou l'identifiant du bien (via get_matches).")
    expect(consignerTropLarge('en', 'Julie', 'flat')).toBe(`For Julie, the search "flat" is too broad to settle: give the address, or the property's identifier (via get_matches).`)
  })

  it('retirée : singulier, pluriel, et au-delà de cinq « (5 sur N) » — en français et en anglais', () => {
    expect(consignerAnnonceRetiree('fr', ['A'])).toBe("« A » est retirée du marché : elle ne se propose plus. Rien n'est consigné.")
    expect(consignerAnnonceRetiree('fr', ['A', 'B'])).toBe("« A », « B » sont retirées du marché : elles ne se proposent plus. Rien n'est consigné.")
    expect(consignerAnnonceRetiree('fr', six)).toBe(`${cinqNommes} (5 sur 6) sont retirées du marché : elles ne se proposent plus. Rien n'est consigné.`)
    expect(consignerAnnonceRetiree('en', ['A'])).toBe("« A » is no longer on the market: it can't be proposed any more. Nothing recorded.")
    expect(consignerAnnonceRetiree('en', ['A', 'B'])).toBe("« A », « B » are no longer on the market: they can't be proposed any more. Nothing recorded.")
    expect(consignerAnnonceRetiree('en', six)).toBe(`${cinqNommes} (5 of 6) are no longer on the market: they can't be proposed any more. Nothing recorded.`)
  })

  it('cinq biens nommés au plus : à cinq, aucun compte ; à six, « (5 sur 6) » et cinq noms seulement', () => {
    expect(consignerPlusieursBiens('fr', 'Julie', six.slice(0, 5))).toBe(`Plusieurs biens pour Julie correspondent : ${cinqNommes}. Lequel ?`)
    expect(consignerPlusieursBiens('fr', 'Julie', six)).toBe(`Plusieurs biens pour Julie correspondent (5 sur 6) : ${cinqNommes}. Lequel ?`)
    expect(consignerAucunBien('en', 'propose', 'Julie', six, 100)).toBe(`No property to propose for Julie matches. Those I found (5 of over 100): ${cinqNommes}. Which one?`)
  })

  it('une lecture coupée dit TOUJOURS son plancher, même pour deux biens nommés : « (2 sur plus de 100) »', () => {
    expect(consignerPlusieursBiens('fr', 'Julie', ['A', 'B'], 100)).toBe('Plusieurs biens pour Julie correspondent (2 sur plus de 100) : « A », « B ». Lequel ?')
    expect(consignerPlusieursBiens('en', 'Julie', ['A', 'B'], 100)).toBe('Several properties for Julie match (2 of over 100): « A », « B ». Which one?')
    expect(consignerAucunBien('fr', 'interesse', 'Julie', ['A'], 100))
      .toBe('Aucun bien proposé en attente de réponse pour Julie ne correspond. Ceux que je vois (1 sur plus de 100) : « A ». Lequel ?')
  })

  it('aucun : une page complète vide dit « n’a aucun bien » ; une page coupée où rien ne se nommait, seulement que rien ne correspond', () => {
    expect(consignerAucunBien('fr', 'interesse', 'Julie', [])).toBe("Julie n'a aucun bien proposé en attente de réponse.")
    expect(consignerAucunBien('fr', 'interesse', 'Julie', [], 100)).toBe('Aucun bien proposé en attente de réponse pour Julie ne correspond.')
    expect(consignerAucunBien('en', 'pas_interesse', 'Julie', [])).toBe('Julie has no property proposed or interested.')
    expect(consignerAucunBien('en', 'pas_interesse', 'Julie', [], 100)).toBe('No property proposed or interested for Julie matches.')
  })

  it('trop de biens à nommer : la question, en français et en anglais', () => {
    expect(consignerTropDeBiens('fr', 'pas_encore', 'Julie')).toBe('Quel bien proposé en attente de réponse pour Julie ? Il y en a trop pour que je les nomme : donne son nom, son adresse ou sa ville, ou son identifiant (via get_matches).')
    expect(consignerTropDeBiens('en', 'propose', 'Julie')).toBe('Which property to propose for Julie? There are too many for me to list: give its name, address or town, or its identifier (via get_matches).')
  })

  it('l’écho trop large : ce sont les MOTS du libellé qui répondent — ni « donne l’adresse » ni l’identifiant, le CRM', () => {
    expect(consignerEchoTropLarge('fr', 'Julie', 'Studio · Genève'))
      .toBe('Trop de biens de Julie répondent aux mots de « Studio · Genève » pour que je tranche par WhatsApp : consigne cette réponse depuis le CRM.')
    expect(consignerEchoTropLarge('en', 'Julie', 'Studio · Genève'))
      .toBe("Too many of Julie's properties match the words of « Studio · Genève » for me to settle this over WhatsApp: record the answer from the CRM.")
  })

  it('les phrases de « pas encore » et de « propose », à l’égalité : la question, puis le compte rendu', () => {
    const c = { nom: 'Julie Martin', bien: 'Attique 4 p. · Route de Florissant 12' }
    expect(confirmConsigner('fr', { ...c, reponse: 'pas_encore' }))
      .toBe("Je note que Julie Martin n'a pas encore répondu pour « Attique 4 p. · Route de Florissant 12 » : la relance est repoussée de 3 jours. Tu confirmes ? (« oui » / « non »)")
    expect(consigne('fr', { ...c, reponse: 'pas_encore' }))
      .toBe("✅ Consigné : Julie Martin n'a pas encore répondu pour « Attique 4 p. · Route de Florissant 12 » — relance dans 3 jours.")
    expect(confirmConsigner('en', { ...c, reponse: 'propose' }))
      .toBe('I\'ll record that you proposed « Attique 4 p. · Route de Florissant 12 » to Julie Martin, with a follow-up in 3 days. Confirm? ("yes" / "no")')
    expect(consigne('en', { ...c, reponse: 'propose' }))
      .toBe('✅ Recorded: « Attique 4 p. · Route de Florissant 12 » proposed to Julie Martin, follow-up in 3 days.')
  })
})

describe('whatsapp-i18n — le total tu par consignerAucunBien/consignerPlusieursBiens au-delà de cinq', () => {
  const dix = Array.from({ length: 10 }, (_, i) => `Bien ${i}`)

  it('cinq ou moins : la sortie ne bouge pas (aucun total ajouté)', () => {
    expect(consignerPlusieursBiens('fr', 'Julie', ['A', 'B'])).toBe('Plusieurs biens pour Julie correspondent : « A », « B ». Lequel ?')
    expect(consignerAucunBien('fr', 'interesse', 'Julie', ['A', 'B']))
      .toBe('Aucun bien proposé en attente de réponse pour Julie ne correspond. Ceux que je vois : « A », « B ». Lequel ?')
  })

  it('plus de cinq, lecture EXACTE (non coupée) : « 5 sur N » / « 5 of N »', () => {
    expect(consignerPlusieursBiens('fr', 'Julie', dix)).toContain('(5 sur 10)')
    expect(consignerPlusieursBiens('en', 'Julie', dix)).toContain('(5 of 10)')
    expect(consignerAucunBien('fr', 'interesse', 'Julie', dix)).toContain('(5 sur 10)')
    expect(consignerAucunBien('en', 'interesse', 'Julie', dix)).toContain('(5 of 10)')
  })

  it('plus de cinq, lecture COUPÉE : « 5 sur plus de N » / « 5 of over N », N le plancher de la lecture', () => {
    expect(consignerPlusieursBiens('fr', 'Julie', dix, 100)).toContain('(5 sur plus de 100)')
    expect(consignerPlusieursBiens('en', 'Julie', dix, 100)).toContain('(5 of over 100)')
    expect(consignerAucunBien('fr', 'interesse', 'Julie', dix, 100)).toContain('(5 sur plus de 100)')
    expect(consignerAucunBien('en', 'interesse', 'Julie', dix, 100)).toContain('(5 of over 100)')
  })
})

const QUAND = '2026-09-29T14:00:00+02:00'

/**
 * Fige « maintenant » avant QUAND et les autres dates de ce fichier, écrites en dur : sans ça, elles finissent par
 * entrer dans le passé, et le refus des dates passées (`DATE_PASSEE`) ferait échouer la suite à partir de ce
 * jour-là. Seule `Date` est truquée (pas les timers) : chaque `describe` d'`execScheduleVisit` l'appelle en premier.
 */
function figerHorloge() {
  beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-09-25T08:00:00Z') }) })
  afterAll(() => { vi.useRealTimers() })
}

describe('execScheduleVisit — une visite interne, mandat ou annonce', () => {
  figerHorloge()
  const tables = { contacts, market_listings: annonces, properties: mandats }

  it('un mandat part en `p_property`, une annonce en `p_market_listing` ; p_debut et p_profile atteignent la base ; « /annuler » est enregistré', async () => {
    const { client, appels, inserts } = fauxClient(tables, {
      wa_matching_visite: { ok: true, genre: 'mandat', titre: 'Villa contemporaine', visite_id: 'v1', match_id: 'm1', statut_match: 'interested', match_avant: 'interested', deal_id: 'd1', etape_avant: 'new_lead' },
    })
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: VILLA, scheduled_at: QUAND })
    expect(r.startsWith('Visite planifiée le')).toBe(true)
    expect(r).toContain(`pour Julie Martin — « ${VIL} ».`)
    expect(r).toContain('Julie Martin passe en « visite planifiée » dans le Matching.')
    expect(appels[0].args).toMatchObject({
      p_agency: A, p_profile: 'p-agent', p_contact: JULIE, p_property: VILLA, p_market_listing: null,
      p_debut: '2026-09-29T12:00:00.000Z', p_duree: 45, p_type: 'sur_place',
    })
    expect(inserts).toEqual([{ table: 'whatsapp_recent_auto_actions', row: expect.objectContaining({ tool: 'schedule_visit', payload_undo: { visite_id: 'v1', evenement_id: null, match_id: 'm1', deal_id: 'd1', etape_avant: 'new_lead' } }) }])

    const annonce = fauxClient(tables, { wa_matching_visite: { ok: true, genre: 'annonce', titre: 'Attique 4 p.', evenement_id: 'e1', statut_match: 'sent' } })
    const r2 = await execScheduleVisit(ctx(annonce.client), { contact_id: JULIE, property_id: ATTIQUE, scheduled_at: QUAND })
    expect(annonce.appels[0].args).toMatchObject({ p_property: null, p_market_listing: ATTIQUE })
    // Le LIBELLÉ de l'annonce (titre · adresse), pas son seul titre — distingue deux annonces au même titre.
    expect(r2).toContain(`pour Julie Martin — « ${ATT} ».`)
    expect(r2).toMatch(/L’intérêt de Julie Martin pour ce bien n’est pas consigné/)
  })

  it('un bien inconnu (UUID valide, absent des deux tables) n’est pas planifié', async () => {
    const { client, appels } = fauxClient(tables)
    expect(await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: 'f0000000-0000-4000-8000-000000000000', scheduled_at: QUAND })).toMatch(/bien introuvable/)
    expect(appels).toEqual([])
  })

  it('market_listing_id SEUL (sans property_id) fonctionne', async () => {
    const { client, appels } = fauxClient(tables, {
      wa_matching_visite: { ok: true, genre: 'annonce', titre: 'Attique 4 p.', evenement_id: 'e9', statut_match: null },
    })
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, market_listing_id: ATTIQUE, scheduled_at: QUAND })
    expect(r.startsWith('Visite planifiée le')).toBe(true)
    expect(appels[0].args).toMatchObject({ p_property: null, p_market_listing: ATTIQUE })
  })
})

describe('execScheduleVisit — « non consigné » ne se dit QUE pour un match "sent", jamais un autre statut', () => {
  figerHorloge()
  const tables = { contacts, market_listings: annonces, properties: mandats }

  it.each(['visit_planned', 'suggested', 'rejected', null])('statut_match = %s : ni « passe en visite planifiée » ni « non consigné »', async (statut) => {
    const { client } = fauxClient(tables, { wa_matching_visite: { ok: true, genre: 'mandat', titre: 'Villa contemporaine', visite_id: 'v1', statut_match: statut } })
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: VILLA, scheduled_at: QUAND })
    expect(r).not.toMatch(/n’est pas consigné|passe en « visite planifiée »/)
  })
})

describe('execScheduleVisit — le contact : trois issues distinctes, jamais confondues', () => {
  figerHorloge()
  const tables = { contacts, market_listings: annonces, properties: mandats }

  it('une PANNE de lecture (pas une absence) ⇒ le message de lecture impossible', async () => {
    const { client } = fauxClient(tables, {}, { erreurSur: new Set(['contacts']) })
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: VILLA, scheduled_at: QUAND })
    expect(r).toMatch(/momentanément impossible/)
  })

  it('un identifiant mal formé ⇒ refusé SANS lire `contacts` (la panne posée sur cette table ne se déclenche jamais)', async () => {
    const { client, lectures } = fauxClient(tables, {}, { erreurSur: new Set(['contacts']) })
    const r = await execScheduleVisit(ctx(client), { contact_id: 'Julie Martin', property_id: VILLA, scheduled_at: QUAND })
    expect(r).toMatch(/search_contacts/)
    expect(r).not.toMatch(/momentanément impossible/)
    expect(lectures).toEqual([])
  })

  it('absent (contact d’une autre agence) ⇒ introuvable dans l’agence', async () => {
    const { client } = fauxClient(tables)
    const r = await execScheduleVisit(ctx(client), { contact_id: AUTRE, property_id: VILLA, scheduled_at: QUAND })
    expect(r).toMatch(/contact introuvable dans votre agence/)
  })
})

describe('execScheduleVisit — une panne de lecture du BIEN n’est jamais une absence', () => {
  figerHorloge()
  const tables = { contacts, market_listings: annonces, properties: mandats }

  it('panne sur properties (un mandat est visé) ⇒ lecture impossible, sans rpc', async () => {
    const { client, appels } = fauxClient(tables, {}, { erreurSur: new Set(['properties']) })
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: VILLA, scheduled_at: QUAND })
    expect(r).toMatch(/momentanément impossible/)
    expect(appels).toEqual([])
  })

  it('panne sur market_listings (une annonce est visée, absente des mandats) ⇒ lecture impossible, sans rpc', async () => {
    const { client, appels } = fauxClient(tables, {}, { erreurSur: new Set(['market_listings']) })
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: ATTIQUE, scheduled_at: QUAND })
    expect(r).toMatch(/momentanément impossible/)
    expect(appels).toEqual([])
  })
})

describe('execScheduleVisit — property_id / market_listing_id : conflit, un seul UUID valide, un identifiant mal formé', () => {
  figerHorloge()
  const tables = { contacts, market_listings: annonces, properties: mandats }
  const okMandat = { wa_matching_visite: { ok: true, genre: 'mandat', titre: 'Villa contemporaine', visite_id: 'v1', statut_match: null } }
  const okAnnonce = { wa_matching_visite: { ok: true, genre: 'annonce', titre: 'Attique 4 p.', evenement_id: 'e1', statut_match: null } }

  it('deux ids VALIDES et DIFFÉRENTS : refusé, demande lequel — sans appeler la base', async () => {
    const { client, appels } = fauxClient(tables, okMandat)
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: VILLA, market_listing_id: ATTIQUE, scheduled_at: QUAND })
    expect(r).toMatch(/lequel/)
    expect(appels).toEqual([])
  })

  it('un seul UUID valide parmi les deux (l’autre est un nom) : c’est lui', async () => {
    const { client, appels } = fauxClient(tables, okAnnonce)
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: 'Attique Florissant', market_listing_id: ATTIQUE, scheduled_at: QUAND })
    expect(appels[0].args).toMatchObject({ p_property: null, p_market_listing: ATTIQUE })
    expect(r.startsWith('Visite planifiée le')).toBe(true)
  })

  it('property_id est un NOM, seul : refusé — « l’id vient de get_matches », jamais « bien introuvable »', async () => {
    const { client, appels } = fauxClient(tables, okAnnonce)
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: 'l’attique', scheduled_at: QUAND })
    expect(r).toMatch(/get_matches/)
    expect(r).not.toMatch(/bien introuvable/)
    expect(appels).toEqual([])
  })

  it('les deux ids IDENTIQUES : pas un conflit, planifié normalement', async () => {
    const { client, appels } = fauxClient(tables, okMandat)
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: VILLA, market_listing_id: VILLA, scheduled_at: QUAND })
    expect(appels[0].args).toMatchObject({ p_property: VILLA })
    expect(r.startsWith('Visite planifiée le')).toBe(true)
  })

  it('le MÊME UUID en casses différentes n’est pas un conflit (Postgres compare un uuid sans égard à la casse)', async () => {
    const { client, appels } = fauxClient(tables, okMandat)
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: VILLA, market_listing_id: VILLA.toUpperCase(), scheduled_at: QUAND })
    expect(appels).toHaveLength(1)
    expect(r.startsWith('Visite planifiée le')).toBe(true)
  })

  it('DEUX TEXTES qui ne sont ni l’un ni l’autre un UUID : refusé « l’id vient de get_matches », jamais « lequel ? »', async () => {
    const { client, appels } = fauxClient(tables, okMandat)
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: 'Villa', market_listing_id: 'Attique', scheduled_at: QUAND })
    expect(r).toMatch(/get_matches/)
    expect(r).not.toMatch(/lequel/)
    expect(appels).toEqual([])
  })
})

describe('execScheduleVisit — l’heure d’un scheduled_at SANS décalage suit Genève, jamais le fuseau du process', () => {
  figerHorloge()
  const tables = { contacts, market_listings: annonces, properties: mandats }
  const okMandat = { wa_matching_visite: { ok: true, genre: 'mandat', titre: 'Villa contemporaine', visite_id: 'v1', statut_match: null } }

  it('« 14:00 » sans décalage part à l’heure de Genève même si le process tourne en UTC, comme l’Edge Function en production', async () => {
    const original = process.env.TZ
    process.env.TZ = 'UTC'
    try {
      const { client, appels } = fauxClient(tables, okMandat)
      const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: VILLA, scheduled_at: '2026-09-29T14:00:00' })
      // 14:00 à Genève (CEST, +02:00 fin septembre) = 12:00 UTC — jamais 14:00Z, ce que lirait `new Date(...)` sous un
      // process en UTC (la panne mesurée par la revue : la visite partirait deux heures plus tard qu'annoncé).
      expect(appels[0].args.p_debut).toBe('2026-09-29T12:00:00.000Z')
      expect(r).toContain('29.09.26 14:00')
    } finally {
      if (original === undefined) delete process.env.TZ; else process.env.TZ = original
    }
  })

  it('un décalage EXPLICITE reste lu tel quel, secondes comprises', async () => {
    const { client, appels } = fauxClient(tables, okMandat)
    await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: VILLA, scheduled_at: '2026-09-29T14:00:30+02:00' })
    expect(appels[0].args.p_debut).toBe('2026-09-29T12:00:30.000Z')
  })

  it('une date SEULE (sans heure) est refusée, sans appeler la base', async () => {
    const { client, appels } = fauxClient(tables, okMandat)
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: VILLA, scheduled_at: '2026-09-29' })
    expect(r).toMatch(/date\/heure/)
    expect(appels).toEqual([])
  })

  it('« 1 » (que `Date.parse` lirait comme 2001) est refusé, jamais planifié à une date fabriquée', async () => {
    const { client, appels } = fauxClient(tables, okMandat)
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: VILLA, scheduled_at: '1' })
    expect(r).toMatch(/date\/heure/)
    expect(appels).toEqual([])
  })

  it('une heure SAUTÉE au passage à l’heure d’été (29.03.2026, 02:00 → 03:00) a son propre message, distinct de « date/heure requise »', async () => {
    const { client, appels } = fauxClient(tables, okMandat)
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: VILLA, scheduled_at: '2026-03-29T02:30' })
    expect(r).toMatch(/n’existe pas ce jour-là/)
    expect(r).not.toMatch(/ISO 8601/)
    expect(appels).toEqual([])
  })

  it('une date PASSÉE de plus d’une heure est refusée, jamais planifiée', async () => {
    const { client, appels } = fauxClient(tables, okMandat)
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: VILLA, scheduled_at: '2020-01-07T14:00:00+01:00' })
    expect(r).toMatch(/passée/)
    expect(appels).toEqual([])
  })

  it('une date à MOINS d’une heure dans le passé est tolérée (planifiée quand même)', async () => {
    const { client } = fauxClient(tables, okMandat)
    const ilYA10Min = new Date(Date.now() - 10 * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z')
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: VILLA, scheduled_at: ilYA10Min })
    expect(r.startsWith('Visite planifiée le')).toBe(true)
  })

  it('la borne : 59 minutes dans le passé acceptée, 61 minutes refusée', async () => {
    const ilYA = (min: number) => new Date(Date.now() - min * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z')
    const oui = fauxClient(tables, okMandat)
    expect((await execScheduleVisit(ctx(oui.client), { contact_id: JULIE, property_id: VILLA, scheduled_at: ilYA(59) })).startsWith('Visite planifiée le')).toBe(true)
    const non = fauxClient(tables, okMandat)
    const r = await execScheduleVisit(ctx(non.client), { contact_id: JULIE, property_id: VILLA, scheduled_at: ilYA(61) })
    expect(r).toMatch(/passée/)
  })

  it('des SECONDES sans décalage sont gardées, à l’heure de Genève', async () => {
    const { client, appels } = fauxClient(tables, okMandat)
    await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: VILLA, scheduled_at: '2026-09-29T14:00:45' })
    expect(appels[0].args.p_debut).toBe('2026-09-29T12:00:45.000Z')
  })

  it('des fractions de seconde sont acceptées (avec ou sans décalage)', async () => {
    const sansDecalage = fauxClient(tables, okMandat)
    await execScheduleVisit(ctx(sansDecalage.client), { contact_id: JULIE, property_id: VILLA, scheduled_at: '2026-09-29T14:00:00.500' })
    expect(sansDecalage.appels[0].args.p_debut).toBe('2026-09-29T12:00:00.500Z')
    const avecDecalage = fauxClient(tables, okMandat)
    await execScheduleVisit(ctx(avecDecalage.client), { contact_id: JULIE, property_id: VILLA, scheduled_at: '2026-09-29T14:00:00.000Z' })
    expect(avecDecalage.appels[0].args.p_debut).toBe('2026-09-29T14:00:00.000Z')
  })

  it('l’heure 24 n’existe pas (24:00) : refusée', async () => {
    const { client, appels } = fauxClient(tables, okMandat)
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: VILLA, scheduled_at: '2026-09-29T24:00' })
    expect(r).toMatch(/date\/heure/)
    expect(appels).toEqual([])
  })

  it('du texte APRÈS une heure par ailleurs valide est refusé (l’ancre de fin tient), avec ou sans décalage', async () => {
    // Avec décalage : `Date.parse` refuserait de toute façon le texte en trop, même sans l'ancre — ce cas seul ne
    // prouverait rien sur l'ancre elle-même.
    const avecDecalage = fauxClient(tables, okMandat)
    const r1 = await execScheduleVisit(ctx(avecDecalage.client), { contact_id: JULIE, property_id: VILLA, scheduled_at: '2026-09-29T14:00Z et vendredi' })
    expect(r1).toMatch(/date\/heure/)
    expect(avecDecalage.appels).toEqual([])
    // Sans décalage : la lecture passe par `wallTimeToInstant`, qui ne voit que les GROUPES CAPTURÉS (hh, mi) —
    // jamais la chaîne complète. Sans l'ancre de fin, le texte en trop serait silencieusement ignoré.
    const sansDecalage = fauxClient(tables, okMandat)
    const r2 = await execScheduleVisit(ctx(sansDecalage.client), { contact_id: JULIE, property_id: VILLA, scheduled_at: '2026-09-29T14:00 et vendredi' })
    expect(r2).toMatch(/date\/heure/)
    expect(sansDecalage.appels).toEqual([])
  })

  it('un décalage ÉTRANGER à Genève (+05:45, -05:00) est lu tel quel, jamais recalculé pour Genève', async () => {
    const inde = fauxClient(tables, okMandat)
    await execScheduleVisit(ctx(inde.client), { contact_id: JULIE, property_id: VILLA, scheduled_at: '2026-09-29T14:00+05:45' })
    expect(inde.appels[0].args.p_debut).toBe('2026-09-29T08:15:00.000Z')
    const est = fauxClient(tables, okMandat)
    await execScheduleVisit(ctx(est.client), { contact_id: JULIE, property_id: VILLA, scheduled_at: '2026-09-29T14:00:00-05:00' })
    expect(est.appels[0].args.p_debut).toBe('2026-09-29T19:00:00.000Z')
  })

  it('« +00:00 » n’est pas un décalage genevois : lu tel quel, comme « Z »', async () => {
    const { client, appels } = fauxClient(tables, okMandat)
    await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: VILLA, scheduled_at: '2026-09-29T14:00:00+00:00' })
    expect(appels[0].args.p_debut).toBe('2026-09-29T14:00:00.000Z')
  })
})

describe('execScheduleVisit — un décalage GENEVOIS (+01:00 ou +02:00) suit la vraie saison de la date, pas celui écrit', () => {
  figerHorloge()
  const tables = { contacts, market_listings: annonces, properties: mandats }
  const okMandat = { wa_matching_visite: { ok: true, genre: 'mandat', titre: 'Villa contemporaine', visite_id: 'v1', statut_match: null } }

  it('novembre (hiver, vrai décalage +01:00) écrit avec « +02:00 » (l’écart de septembre) : lu à 14:00 Genève = 13:00Z, pas 12:00Z', async () => {
    const { client, appels } = fauxClient(tables, okMandat)
    await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: VILLA, scheduled_at: '2026-11-15T14:00:00+02:00' })
    expect(appels[0].args.p_debut).toBe('2026-11-15T13:00:00.000Z')
  })

  it('juillet (été, vrai décalage +02:00) écrit avec « +01:00 » : lu à 14:00 Genève = 12:00Z, pas 13:00Z', async () => {
    const { client, appels } = fauxClient(tables, okMandat)
    await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: VILLA, scheduled_at: '2027-07-15T14:00:00+01:00' })
    expect(appels[0].args.p_debut).toBe('2027-07-15T12:00:00.000Z')
  })
})

describe('execScheduleVisit — une date IMPOSSIBLE, même avec un décalage explicite, est refusée (jamais reportée au jour suivant)', () => {
  figerHorloge()
  const tables = { contacts, market_listings: annonces, properties: mandats }
  const okMandat = { wa_matching_visite: { ok: true, genre: 'mandat', titre: 'Villa contemporaine', visite_id: 'v1', statut_match: null } }
  const refuse = async (scheduled_at: string) => {
    const { client, appels } = fauxClient(tables, okMandat)
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: VILLA, scheduled_at })
    return { r, appels }
  }

  it('31 septembre (30 jours seulement) : refusé, jamais reporté au 1ᵉʳ octobre', async () => {
    const { r, appels } = await refuse('2026-09-31T10:00:00Z')
    expect(r).toMatch(/date\/heure/)
    expect(appels).toEqual([])
  })

  it('29 février 2027 (non bissextile) : refusé, jamais reporté au 1ᵉʳ mars', async () => {
    const { r, appels } = await refuse('2027-02-29T14:00:00+01:00')
    expect(r).toMatch(/date\/heure/)
    expect(appels).toEqual([])
  })

  it('29 février 2028 (bissextile) : accepté', async () => {
    const { r, appels } = await refuse('2028-02-29T14:00:00+01:00')
    expect(r.startsWith('Visite planifiée le')).toBe(true)
    expect(appels).toHaveLength(1)
  })

  it('30 février (n’existe jamais) : refusé', async () => {
    const { r, appels } = await refuse('2026-02-30T14:00:00+01:00')
    expect(r).toMatch(/date\/heure/)
    expect(appels).toEqual([])
  })
})

describe('execScheduleVisit — durée : un nombre OU une chaîne numérique, arrondie, bornée à [5, 480], 45 par défaut', () => {
  figerHorloge()
  const tables = { contacts, market_listings: annonces, properties: mandats }
  const okMandat = { wa_matching_visite: { ok: true, genre: 'mandat', titre: 'Villa contemporaine', visite_id: 'v9', statut_match: null } }
  const duree = async (duration_minutes?: unknown) => {
    const { client, appels } = fauxClient(tables, okMandat)
    await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: VILLA, scheduled_at: QUAND, ...(duration_minutes === undefined ? {} : { duration_minutes }) })
    return appels[0].args.p_duree
  }

  it('absente : 45 (défaut)', async () => expect(await duree()).toBe(45))
  it('0 ou négative : 45 (défaut, pas « zéro minute »)', async () => {
    expect(await duree(0)).toBe(45)
    expect(await duree(-5)).toBe(45)
  })
  it('une chaîne numérique ("60") est acceptée comme un nombre', async () => expect(await duree('60')).toBe(60))
  it('une chaîne DÉCIMALE ("30.5") est acceptée et arrondie, comme le nombre équivalent', async () => expect(await duree('30.5')).toBe(31))
  it('des espaces autour d’une chaîne numérique (" 60 ") sont tolérés (`.trim()` avant le test)', async () => expect(await duree(' 60 ')).toBe(60))
  it('bornée à 480 au plus', async () => expect(await duree(1000)).toBe(480))
  it('arrondie, et plancher à 5 (0.4 minute ne devient pas 0)', async () => {
    expect(await duree(30.5)).toBe(31)
    expect(await duree(0.4)).toBe(5)
  })
  it('une chaîne qui n’est PAS que des chiffres ⇒ le défaut, jamais lue par `Number()` (hexadécimal, notation scientifique, unité)', async () => {
    expect(await duree('1h30')).toBe(45)
    expect(await duree('0x10')).toBe(45) // Number('0x10') vaut 16 : accepté à tort avant ce garde
    expect(await duree('1e2')).toBe(45) // Number('1e2') vaut 100 : idem
  })
  it('la réponse AFFICHE la durée retenue, pour que l’agent la voie', async () => {
    const { client } = fauxClient(tables, okMandat)
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: VILLA, scheduled_at: QUAND, duration_minutes: 60 })
    expect(r).toContain('(60 min)')
    const parDefaut = fauxClient(tables, okMandat)
    const r2 = await execScheduleVisit(ctx(parDefaut.client), { contact_id: JULIE, property_id: VILLA, scheduled_at: QUAND })
    expect(r2).toContain('(45 min)')
  })
})

describe('execScheduleVisit — la base refuse : trois raisons connues, et un retour anormal (jamais « bien introuvable » hors raison "bien")', () => {
  figerHorloge()
  const tables = { contacts, market_listings: annonces, properties: mandats }

  it('raison "contact"', async () => {
    const { client } = fauxClient(tables, { wa_matching_visite: { ok: false, raison: 'contact' } })
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: VILLA, scheduled_at: QUAND })
    expect(r).toMatch(/contact introuvable dans votre agence/)
  })

  it('raison "bien"', async () => {
    const { client } = fauxClient(tables, { wa_matching_visite: { ok: false, raison: 'bien' } })
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: VILLA, scheduled_at: QUAND })
    expect(r).toMatch(/bien introuvable/)
  })

  it('raison "profil" : un message dédié, jamais « bien introuvable »', async () => {
    const { client } = fauxClient(tables, { wa_matching_visite: { ok: false, raison: 'profil' } })
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: VILLA, scheduled_at: QUAND })
    expect(r).toMatch(/profil n.est pas rattaché à cette agence/)
    expect(r).not.toMatch(/bien introuvable/)
  })

  it('un retour anormal — data nulle, ok:false sans raison, ou une raison inconnue — dit l’échec générique, jamais « bien introuvable », et n’enregistre rien', async () => {
    for (const donnee of [null, { ok: false }, { ok: false, raison: 'mystere' }]) {
      const { client, inserts } = fauxClient(tables, { wa_matching_visite: donnee })
      const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: VILLA, scheduled_at: QUAND })
      expect(r, JSON.stringify(donnee)).toMatch(/la planification a échoué/)
      expect(r, JSON.stringify(donnee)).not.toMatch(/bien introuvable/)
      expect(inserts, JSON.stringify(donnee)).toEqual([])
    }
  })
})

describe('execScheduleVisit — un bien qui n’est plus disponible est signalé (règle du module, BienWa.retire), une annonce vidéo sans visio', () => {
  figerHorloge()
  const RETIREE = 'd0000000-0000-4000-8000-0000000000e1'
  const annonceRetiree = { id: RETIREE, title: 'Chalet Retiré', address: 'Route de la Neige 9', city: 'Verbier', price: 800_000, transaction_type: 'buy', status: 'removed' }
  const VENDU = 'e0000000-0000-4000-8000-0000000000e2'
  const mandatVendu = { id: VENDU, agency_id: A, deleted_at: null, title: 'Duplex vendu', address: 'Rue du Marché 5', city: 'Genève', status: 'sold' }
  const EN_BAISSE = 'd0000000-0000-4000-8000-0000000000e3'
  const annonceEnBaisse = { id: EN_BAISSE, title: 'Loft en baisse', address: 'Quai des Bergues 8', city: 'Genève', price: 1_100_000, transaction_type: 'buy', status: 'price_reduced' }
  const tables = { contacts, properties: [...mandats, mandatVendu], market_listings: [...annonces, annonceRetiree, annonceEnBaisse] }

  it('une annonce RETIRÉE du marché (status: removed) : planifiée quand même, et signalée', async () => {
    const { client, appels } = fauxClient(tables, { wa_matching_visite: { ok: true, genre: 'annonce', titre: 'Chalet Retiré', evenement_id: 'e5', statut_match: null } })
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: RETIREE, scheduled_at: QUAND })
    expect(appels).toHaveLength(1) // planifiée quand même, jamais refusée
    expect(r).toMatch(/plus disponible/)
  })

  it('un mandat VENDU (status: sold) est signalé lui aussi — la règle vient du module, pas d’un cas spécial « annonce »', async () => {
    const { client } = fauxClient(tables, { wa_matching_visite: { ok: true, genre: 'mandat', titre: 'Duplex vendu', visite_id: 'v-vendu', statut_match: null } })
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: VENDU, scheduled_at: QUAND })
    expect(r).toMatch(/plus disponible/)
  })

  it('une annonce EN BAISSE (price_reduced) n’est JAMAIS dite retirée — seul `removed` l’est', async () => {
    const { client } = fauxClient(tables, { wa_matching_visite: { ok: true, genre: 'annonce', titre: 'Loft en baisse', evenement_id: 'e8', statut_match: null } })
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: EN_BAISSE, scheduled_at: QUAND })
    expect(r).not.toMatch(/plus disponible/)
  })

  it('une annonce ACTIVE n’est pas dite retirée ; son agenda est dit', async () => {
    const { client } = fauxClient(tables, { wa_matching_visite: { ok: true, genre: 'annonce', titre: 'Attique 4 p.', evenement_id: 'e1', statut_match: null } })
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: ATTIQUE, scheduled_at: QUAND })
    expect(r).not.toMatch(/plus disponible/)
    expect(r).toContain('Annonce du marché : inscrite à l’agenda.')
  })

  it('visit_type "video" sur une annonce : signalé, jamais refusé', async () => {
    const { client, appels } = fauxClient(tables, { wa_matching_visite: { ok: true, genre: 'annonce', titre: 'Attique 4 p.', evenement_id: 'e6', statut_match: 'sent' } })
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: ATTIQUE, scheduled_at: QUAND, visit_type: 'video' })
    expect(appels[0].args).toMatchObject({ p_type: 'video' })
    expect(r).toMatch(/sans visio/)
  })
})

describe('execScheduleVisit — une panne de la base : transport (non confirmé) vs un `code` Postgres (rien n’a été écrit)', () => {
  figerHorloge()
  const tables = { contacts, market_listings: annonces, properties: mandats }

  it('SANS `code` : panne de TRANSPORT — « non confirmé », jamais « rien n’a été écrit », aucun enregistrement d’annulation', async () => {
    const { client, inserts } = fauxClient(tables, { wa_matching_visite: 'jamais lu' }, { erreurSur: new Set(['wa_matching_visite']) })
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: VILLA, scheduled_at: QUAND })
    expect(r).toMatch(/non confirmé/)
    expect(r).not.toMatch(/erreur simulée/)
    expect(r).not.toMatch(/rien n.a été écrit/)
    expect(inserts).toEqual([])
  })

  it('AVEC `code` : la base a tranché — phrase générique « rien n’a été écrit », sans le message de la base', async () => {
    const { client, inserts } = fauxClient(
      tables, { wa_matching_visite: 'jamais lu' },
      { erreurSur: new Set(['wa_matching_visite']), erreurCode: { wa_matching_visite: '23505' } },
    )
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: VILLA, scheduled_at: QUAND })
    expect(r).toMatch(/la planification a échoué/)
    expect(r).not.toMatch(/erreur simulée/)
    expect(inserts).toEqual([])
  })
})

describe('execScheduleVisit — « /annuler » n’est promis QUE si son enregistrement réussit', () => {
  figerHorloge()
  const tables = { contacts, market_listings: annonces, properties: mandats }
  const okMandat = { wa_matching_visite: { ok: true, genre: 'mandat', titre: 'Villa contemporaine', visite_id: 'v1', statut_match: null } }

  it('l’insertion de whatsapp_recent_auto_actions échoue : la visite reste planifiée, mais « /annuler » n’est jamais promis', async () => {
    const { client } = fauxClient(tables, okMandat, { echecInsertion: new Set(['whatsapp_recent_auto_actions']) })
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: VILLA, scheduled_at: QUAND })
    expect(r.startsWith('Visite planifiée le')).toBe(true)
    expect(r).not.toContain('/annuler')
  })

  it('à l’identique, sur une insertion réussie : « /annuler » EST promis', async () => {
    const { client } = fauxClient(tables, okMandat)
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: VILLA, scheduled_at: QUAND })
    expect(r).toContain('/annuler')
  })
})

describe('execScheduleVisit — le genre est ancré sur l’agence : un mandat d’une AUTRE agence n’en est pas un', () => {
  figerHorloge()
  it('même id qu’une annonce suivie : un mandat hors agence ne le masque pas, l’annonce répond', async () => {
    const PARTAGE = 'e0000000-0000-4000-8000-000000000099'
    const mandatHorsAgence = { id: PARTAGE, agency_id: B, deleted_at: null, title: 'Bien agence B', address: 'Rue X 1', city: 'Lausanne', price: 1_000_000, transaction_type: 'buy', status: 'active', off_market: false }
    const annonceMemeId = { id: PARTAGE, title: 'Annonce suivie', address: 'Rue Y 2', city: 'Lausanne', price: 900_000, transaction_type: 'buy', status: 'active' }
    const { client, appels } = fauxClient(
      { contacts, properties: [...mandats, mandatHorsAgence], market_listings: [...annonces, annonceMemeId] },
      { wa_matching_visite: { ok: true, genre: 'annonce', titre: 'Annonce suivie', evenement_id: 'e7', statut_match: null } },
    )
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: PARTAGE, scheduled_at: QUAND })
    expect(appels[0].args).toMatchObject({ p_property: null, p_market_listing: PARTAGE })
    expect(r.startsWith('Visite planifiée le')).toBe(true)
  })

  it('un mandat SUPPRIMÉ (deleted_at posé) de l’agence n’en est pas un non plus : jamais planifié comme mandat', async () => {
    const SUPPRIME = 'e0000000-0000-4000-8000-0000000000f2'
    const mandatSupprime = { id: SUPPRIME, agency_id: A, deleted_at: '2026-09-01T00:00:00Z', title: 'Mandat supprimé', address: 'Rue Z 1', city: 'Genève', status: 'active' }
    const { client, appels } = fauxClient({ contacts, properties: [...mandats, mandatSupprime], market_listings: annonces })
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: SUPPRIME, scheduled_at: QUAND })
    expect(r).toMatch(/bien introuvable/)
    expect(appels).toEqual([])
  })

  it('un id qui désigne un mandat ET une annonce, DANS LA MÊME agence : le mandat gagne (lu en premier)', async () => {
    const PARTAGE2 = 'e0000000-0000-4000-8000-0000000000f3'
    const mandatIci = { id: PARTAGE2, agency_id: A, deleted_at: null, title: 'Les deux à la fois', address: 'Rue W 1', city: 'Genève', status: 'active' }
    const annonceIci = { id: PARTAGE2, title: 'Les deux à la fois (annonce)', address: 'Rue W 1', city: 'Genève', status: 'active' }
    const { client, appels } = fauxClient(
      { contacts, properties: [...mandats, mandatIci], market_listings: [...annonces, annonceIci] },
      { wa_matching_visite: { ok: true, genre: 'mandat', titre: 'Les deux à la fois', visite_id: 'v-double', statut_match: null } },
    )
    const r = await execScheduleVisit(ctx(client), { contact_id: JULIE, property_id: PARTAGE2, scheduled_at: QUAND })
    expect(appels[0].args).toMatchObject({ p_property: PARTAGE2, p_market_listing: null })
    expect(r.startsWith('Visite planifiée le')).toBe(true)
  })
})

describe('annulerVisite — « /annuler » passe par la base', () => {
  figerHorloge()
  it('rend vrai seulement si la base a défait quelque chose', async () => {
    const oui = fauxClient({}, { wa_matching_visite_annuler: { ok: true } })
    expect(await annulerVisite(oui.client as never, A, 'p-agent', { visite_id: 'v1' })).toBe(true)
    expect(oui.appels).toEqual([{ rpc: 'wa_matching_visite_annuler', args: { p_agency: A, p_profile: 'p-agent', p_retour: { visite_id: 'v1' } } }])
    const non = fauxClient({}, { wa_matching_visite_annuler: { ok: false } })
    expect(await annulerVisite(non.client as never, A, 'p-agent', { visite_id: 'v1' })).toBe(false)
  })

  it('agence nulle : `false` SANS appeler la base', async () => {
    const f = fauxClient({}, { wa_matching_visite_annuler: { ok: true } })
    expect(await annulerVisite(f.client as never, null, 'p-agent', { visite_id: 'v1' })).toBe(false)
    expect(f.appels).toEqual([])
  })

  it('une erreur rpc ⇒ `false`', async () => {
    const f = fauxClient({}, { wa_matching_visite_annuler: { ok: true } }, { erreurSur: new Set(['wa_matching_visite_annuler']) })
    expect(await annulerVisite(f.client as never, A, 'p-agent', { visite_id: 'v1' })).toBe(false)
  })

  it('un retour vide (data nulle) ⇒ `false`', async () => {
    const f = fauxClient({}, { wa_matching_visite_annuler: null })
    expect(await annulerVisite(f.client as never, A, 'p-agent', { visite_id: 'v1' })).toBe(false)
  })
})
