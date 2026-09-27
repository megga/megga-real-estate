/**
 * Les outils du matching du copilote WhatsApp (lot D2), éprouvés sans base ni réseau.
 *
 * POURQUOI CE BANC. Les exécuteurs lisent par le client service-role : la RLS est contournée, et le
 * `.eq('agency_id', …)` de chaque lecture est la seule garde de tenant. Le faux client ci-dessous APPLIQUE les filtres
 * qu'on lui passe à des lignes en mémoire — un filtre oublié laisse passer la ligne d'une autre agence, et le test le
 * voit. Les écritures passent par des fonctions de base (`rpc`) : on éprouve ce qu'on leur envoie, leur SQL est
 * éprouvé par `tests/backend/matching-whatsapp.spec.ts` (CI).
 *
 * ⚠ LE TRI ACCUMULE SES CLÉS, IL NE TRIE QU'UNE FOIS (relecture qualité, 25.09.2026). Un `.order()` par appel — la
 * première version de ce faux client — fait de la DERNIÈRE clé la primaire, l'inverse de PostgREST (la première clé
 * prime, les suivantes départagent). `fauxClient` accumule les clés posées par `.order()` et ne trie qu'à la
 * résolution (`.then()` / `.maybeSingle()`), `.limit()` coupant APRÈS ce tri — voir `describe('fauxClient — …')`
 * plus bas, qui l'éprouve directement. ⚠ Les tâches 7 à 9 ajoutent leurs tests à CE fichier et réutilisent ce faux
 * client : garder son INTERFACE (`fauxClient(tables, rpc?, opts?)` → `{ client, appels, inserts }`).
 */
import { describe, it, expect } from 'vitest'
import { execGetMatches } from './whatsapp-matching-outils'
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
      // `null` et `undefined` comptent comme la MÊME absence (relecture qualité, 25.09.2026, H8) : sans ce garde,
      // `a === b` est faux pour l'un valant `null` et l'autre `undefined`, et les deux branches de nullité suivantes
      // répondaient alors le MÊME signe quel que soit l'ordre des arguments — un comparateur qui se contredit,
      // que `.sort()` ne garantit plus de résoudre de façon cohérente.
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
 */
function fauxClient(tables: Record<string, Ligne[]>, rpc: Record<string, unknown> = {}, opts: { erreurSur?: ReadonlySet<string> } = {}) {
  const appels: Appel[] = []
  const inserts: { table: string; row: unknown }[] = []
  const from = (table: string) => {
    let lignes = [...(tables[table] ?? [])]
    const cles: Cle[] = []
    let limite: number | null = null
    const enErreur = opts.erreurSur?.has(table) ?? false
    const resoudre = (): Ligne[] => {
      const triees = trier(lignes, cles)
      return limite == null ? triees : triees.slice(0, limite)
    }
    const echec = { data: null, error: { message: `erreur simulée sur ${table}` } }
    const self: Record<string, unknown> = {}
    self.select = () => self
    self.eq = (c: string, v: unknown) => { lignes = lignes.filter((l) => l[c] === v); return self }
    self.in = (c: string, vs: readonly unknown[]) => { lignes = lignes.filter((l) => vs.includes(l[c])); return self }
    self.is = (c: string, v: unknown) => { lignes = lignes.filter((l) => (l[c] ?? null) === v); return self }
    // Compare aussi un numérique écrit en CHAÎNE (relecture qualité, 25.09.2026, H9) : PostgreSQL le ferait sur une
    // colonne `numeric`, que PostgREST sérialise parfois en chaîne. `Number(null)` vaut 0 (donc `> 0` l'exclut déjà
    // par la VALEUR, sans garde `typeof` à part) ; `Number(undefined)`/`Number('abc')` valent NaN, exclus par le test.
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
    // PLUSIEURS lignes rendent une ERREUR, comme PostgREST/PGRST116 (relecture qualité, 25.09.2026) — jamais la
    // première ligne prise en silence, qui masquerait une donnée de test dupliquée par erreur.
    self.maybeSingle = async () => {
      if (enErreur) return echec
      const trouvees = resoudre()
      if (trouvees.length > 1) return { data: null, error: { message: 'plusieurs lignes trouvées, une seule attendue', code: 'PGRST116' } }
      return { data: trouvees[0] ?? null, error: null }
    }
    self.insert = (row: unknown) => { inserts.push({ table, row }); return { error: null } }
    // `touchHotContact` (le « contact chaud » de l'agent) : sans effet ici.
    self.upsert = () => Promise.resolve({ error: null })
    self.then = (resolve: (r: unknown) => void) => resolve(enErreur ? echec : { data: resoudre(), error: null })
    return self
  }
  const client = {
    from,
    // `erreurSur` peut aussi viser un `rpc`, par son NOM (relecture qualité, 25.09.2026) — pour les tâches 7 à 9, qui
    // écrivent par des fonctions de base (`wa_matching_consigner`, `wa_matching_visite`) : rien ici ne l'exerce encore.
    rpc: async (nom: string, args: Record<string, unknown>) => {
      appels.push({ rpc: nom, args })
      if (opts.erreurSur?.has(nom)) return { data: null, error: { message: `erreur simulée sur rpc ${nom}` } }
      return { data: rpc[nom] ?? null, error: null }
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

describe('execGetMatches — identifiant refusé, contact absent, lecture du contact en échec (relecture qualité §6)', () => {
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

describe('execGetMatches — résolution des biens : agence, suppression, critères, lecture en échec (relecture qualité §1)', () => {
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

  // Relecture qualité, 25.09.2026, H10 : le filtre d'agence de `lireCriteres` (.eq('agency_id', …) sur
  // client_searches) n'avait aucun témoin — un match de A citant une recherche de B pouvait fuir sans qu'aucun test
  // ne le voie.
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

describe('fauxClient — tri à clés multiples fidèle à PostgREST (relecture qualité §2, H1)', () => {
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

describe('fauxClient — comportements neufs (relecture qualité §5, H8/H9)', () => {
  it('null et undefined comptent comme la MÊME absence (H8) : leur ordre relatif suit l’ordre d’entrée, quel qu’il soit', async () => {
    // Un tri STABLE (garanti par la spec depuis ES2019) garde deux lignes « égales » dans leur ordre D'ENTRÉE.
    // Avant la correction, le comparateur se contredisait entre `null` et `undefined` (voir le commentaire de
    // `trier`) : cette égalité de traitement, elle, ne dépend pas de l'ordre — la vérifier dans les DEUX sens le
    // prouve mieux qu'un résultat unique, qui pourrait n'être vrai que par accident.
    const { client: c1 } = fauxClient({ t: [{ id: 'a', v: null }, { id: 'b', v: undefined }] })
    const r1 = await chainable(c1, 't').select().order('v').limit(2)
    expect(r1.data.map((l) => l.id)).toEqual(['a', 'b'])
    const { client: c2 } = fauxClient({ t: [{ id: 'b', v: undefined }, { id: 'a', v: null }] })
    const r2 = await chainable(c2, 't').select().order('v').limit(2)
    expect(r2.data.map((l) => l.id)).toEqual(['b', 'a'])
  })

  it('`.gt` compare aussi un numérique écrit en CHAÎNE, comme PostgreSQL sur une colonne `numeric` (H9)', async () => {
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

describe('execGetMatches — la coupe à 40 ne perd plus un « revenu » au score égal (relecture qualité §3, H2)', () => {
  it('41 annonces au même score, plus récentes, n’évincent plus le bien revenu pour le prix : il reste visible, et le total porte un « + »', async () => {
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

  // Relecture qualité, 25.09.2026, H7 : `revenus.mord` seul (sans `aProposer.mord`) posait un « + » sur un total déjà
  // EXACT — la lecture « à proposer » avait tout lu, la lecture « revenus », bien plus bornée, mordait sur son propre
  // plafond sans que ça change rien à ce qui est déjà connu en entier.
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

describe('execGetMatches — « en cours » au-delà de 30 ne perd plus l’intéressé prioritaire (relecture qualité §4, H3)', () => {
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
