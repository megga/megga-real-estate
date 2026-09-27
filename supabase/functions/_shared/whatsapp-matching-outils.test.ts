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
 * client : garder son INTERFACE (`fauxClient(tables, rpc?, opts?)` → `{ client, appels, inserts }`).
 */
import { describe, it, expect } from 'vitest'
import { execGetMatches, execGetBuyersForProperty } from './whatsapp-matching-outils'
import type { ActionCtx } from './whatsapp-actions'

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
 * PostgREST. `opts.erreurSur` simule une lecture (une table nommée) OU un `rpc` (son nom) en ÉCHEC
 * (`{ data: null, error: {...} }`), pour éprouver le chemin `LECTURE_IMPOSSIBLE` sans dépendre d'un vrai réseau.
 * ⚠ `.select('a, b, c')` PROJETTE les lignes rendues sur CES colonnes SEULES, comme PostgREST : un test dont l'oracle
 * dépend d'une colonne absente du `select()` réel doit rougir — sans ça, un `select()` amputé en production (colonne
 * jamais lue, valant `undefined`) resterait invisible ici. `select('*')` (ou un appel sans argument) rend tout, sans
 * filtrage. ⚠ `.rpc(nom, args)` respecte aussi `args.p_limite` — les lignes configurées sont coupées à CETTE valeur,
 * comme le ferait la fonction réelle avec son propre `limit` : un appelant qui demanderait la mauvaise limite reçoit
 * donc moins (ou plus) de lignes, pas les mêmes. Pour l'agence et les mots, c'est `appels` (rendu par `fauxClient`)
 * que les tests inspectent directement — aucune donnée de fixture n'est elle-même scopée par agence.
 */
function fauxClient(tables: Record<string, Ligne[]>, rpc: Record<string, unknown> = {}, opts: { erreurSur?: ReadonlySet<string> } = {}) {
  const appels: Appel[] = []
  const inserts: { table: string; row: unknown }[] = []
  const from = (table: string) => {
    let lignes = [...(tables[table] ?? [])]
    const cles: Cle[] = []
    let limite: number | null = null
    let colonnes: string[] | null = null
    const enErreur = opts.erreurSur?.has(table) ?? false
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
      if (enErreur) return echec
      // La recherche de la ligne (et l'erreur « plusieurs trouvées ») ignore encore la projection : PostgREST, lui
      // aussi, décide de PGRST116 sur les lignes réelles, jamais sur ce que `select()` en laisse voir à l'appelant.
      const triees = trier(lignes, cles)
      const coupees = limite == null ? triees : triees.slice(0, limite)
      if (coupees.length > 1) return { data: null, error: { message: 'plusieurs lignes trouvées, une seule attendue', code: 'PGRST116' } }
      return { data: coupees[0] ? projeter(coupees[0]) : null, error: null }
    }
    self.insert = (row: unknown) => { inserts.push({ table, row }); return { error: null } }
    // `touchHotContact` (le « contact chaud » de l'agent) : sans effet ici.
    self.upsert = () => Promise.resolve({ error: null })
    self.then = (resolve: (r: unknown) => void) => resolve(enErreur ? echec : { data: resoudre(), error: null })
    return self
  }
  const client = {
    from,
    // `erreurSur` peut aussi viser un `rpc`, par son NOM — exercé par les tests de désignation par texte
    // (`wa_matching_biens_designes`) et par ceux des fonctions d'écriture (`wa_matching_consigner`, `wa_matching_visite`).
    rpc: async (nom: string, args: Record<string, unknown>) => {
      appels.push({ rpc: nom, args })
      if (opts.erreurSur?.has(nom)) return { data: null, error: { message: `erreur simulée sur rpc ${nom}` } }
      const brut = rpc[nom]
      // `p_limite` coupe les lignes configurées comme le ferait le `limit` réel de la fonction : un appelant qui
      // demanderait la mauvaise limite reçoit un nombre de lignes différent, jamais les mêmes.
      const limite = typeof args.p_limite === 'number' ? args.p_limite : undefined
      const data = Array.isArray(brut) && limite != null ? brut.slice(0, limite) : (brut ?? null)
      return { data, error: null }
    },
  }
  return { client, appels, inserts }
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
 * `aLaLimite`, l'affinage `candidats`, la relecture en colonnes complètes, la propagation des pannes, et qu'une
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

    it('défense en profondeur : même si la base désignait par erreur un mandat hors agence, la relecture complète (agency_id) l’écarte — jamais une fuite, une panne lue', async () => {
      // Un id qui ressemble à un mandat de CETTE agence, mais dont la ligne réelle (properties) est hors scope :
      // ne peut arriver que si wa_matching_biens_designes elle-même avait un défaut — la relecture par id, en TS,
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

    it('une panne de la relecture complète reste une panne même avec PLUSIEURS candidats désignés, jamais une liste vide', async () => {
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
      // du texte cherché. Cinquante annonces de bruit qu'un mot NUMÉRIQUE (« 2 ») écarte (il ne se compare qu'à
      // l'adresse, comme `candidats`), plus UNE qui passe : d'autres, au-delà de la coupe, auraient pu passer aussi —
      // la base ne les a pas rendues, et le silence sur leur existence ne doit pas se lire comme leur absence.
      const bruit = Array.from({ length: 50 }, (_, i) => ({
        id: `d6000000-0000-4000-8000-${String(i).padStart(12, '0')}`, title: `Appartement 2 pièces ${i}`, address: `Rue du Lac ${i + 10}`,
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
        ['properties (texte, relecture complète du candidat mandat)', new Set(['properties']), { bien: 'la villa de Cologny' }],
        ['matches (compatibles)', new Set(['matches']), { bien: VILLA }],
        ['contacts (noms)', new Set(['contacts']), { bien: VILLA }],
      ]
      for (const [label, erreurSur, args] of cas) {
        const { client } = fauxClient(matchesVilla, rpcVilla, { erreurSur })
        const r = await execGetBuyersForProperty(ctx(client), args)
        expect(r, label).toMatch(/momentanément impossible/)
      }
    })

    it('une panne sur la relecture complète d’une ANNONCE désignée par texte est aussi une panne, jamais une absence', async () => {
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
  })
})
