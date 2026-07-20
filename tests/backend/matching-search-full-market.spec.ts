// Backend test — Recherche « marché complet » (migration 20260720150000).
//
// Deux RPC nouvelles, servant l'écran Matching · Recherche :
//   - search_market_listings  → candidats triés par FRAÎCHEUR (created_at DESC, id DESC)
//   - count_market_listings   → total EXACT du marché filtré
//
// CE QUE CE FICHIER FIGE
//
// 1. Le TRI. `match_candidate_listings` ordonne par `quality_score DESC, prix ASC` ;
//    36 222 annonces étant à égalité sur quality_score = 100, le prix décidait seul et
//    l'écran servait « les annonces les moins chères de Suisse ». La nouvelle RPC existe
//    pour ça et rien d'autre : on parcourt donc le tableau renvoyé paire par paire, et on
//    vérifie que la PLUS CHÈRE des annonces récentes sort AVANT la moins chère ancienne.
//    Un ORDER BY qui repartirait sur le prix ferait tomber ce test, pas un autre.
//
// 2. La COHÉRENCE des deux WHERE. Ils sont copiés à l'identique dans la migration ; rien
//    dans PostgreSQL ne les tient synchronisés. Pour les mêmes arguments, le count doit
//    valoir le nombre de lignes rendues quand la limite ne sature pas. C'est ce test qui
//    attrape une divergence future — un total qui ne décrirait pas la liste affichée est
//    exactement le mensonge que la migration corrige.
//
// 3. Le REVOKE anon (42501) sur les deux fonctions.
//
// MÉTHODE — pourquoi on sème au lieu de lire la prod
//
// Ces tests tournent contre un Supabase LOCAL fraîchement migré, où market_listings est
// vide ; et contre la prod, les volumes bougent toutes les nuits (flatfox-sync 04:00 UTC),
// donc aucun nombre absolu n'y serait stable. On sème donc un micro-marché dans une VILLE
// unique au run (`p_city` isole la population à l'unité près), ce qui rend l'ordre et le
// total exactement prévisibles, puis on détruit ces lignes en afterAll. Aucune ligne
// préexistante n'est lue en écriture ni modifiée, et le fichier est rejouable tel quel
// (le STAMP change à chaque run). Sur les données déjà là, les assertions restent des
// invariants relatifs (monotonie du tri, count ≥ lignes) — jamais un nombre magique.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { type SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient, anonClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

// Permission refusée. On ne s'appuie JAMAIS sur le message, seulement sur le code.
const DENIED = '42501'

type Row = { id: string; created_at: string }

describe.skipIf(!HAS_KEYS)('search/count_market_listings — fraîcheur + total honnête', () => {
  const STAMP = Date.now()
  // Ville accentuée ET unique au run : `p_city` devient un isolant parfait, et sert
  // au passage à prouver le unaccent (on interroge sans accent, en majuscules).
  const CITY = `Genève QA ${STAMP}`
  const CITY_UNACCENTED_UPPER = `GENEVE QA ${STAMP}`

  // Base fixe : l'ancienneté relative des semis est ce qui compte, pas la date du run.
  const T = (hoursAgo: number) =>
    new Date(Date.UTC(2026, 0, 15, 12, 0, 0) - hoursAgo * 3_600_000).toISOString()

  let service: SupabaseClient
  const seeded: string[] = []

  // Ex æquo parfait sur created_at → seul `id DESC` départage. On tire les UUID puis on
  // les trie : la comparaison uuid de PostgreSQL est octet par octet, donc identique à
  // l'ordre lexicographique de la forme hex minuscule rendue par randomUUID().
  const tiePair = [crypto.randomUUID(), crypto.randomUUID()].sort()
  const TIE_LO = tiePair[0]
  const TIE_HI = tiePair[1]

  // Le micro-marché. `oldBuy` est cher et ancien, `midBuyVd` est LE MOINS CHER,
  // `newBuyHouse` est LE PLUS CHER et le plus récent : si un tri par prix revenait,
  // l'ordre attendu ci-dessous s'inverserait aux deux bouts.
  let oldBuy = ''
  let midBuyVd = ''
  let newBuyHouse = ''
  let reducedBuy = ''
  let rentGe = ''
  let zeroPrice = ''
  let lowQuality = ''

  /** Ordre attendu, du plus récent au plus ancien, ex æquo départagés par id DESC. */
  const expectedBuyOrder = () => [newBuyHouse, reducedBuy, midBuyVd, oldBuy, TIE_HI, TIE_LO]
  const POPULATION = 6 // lignes 'buy' du micro-marché passant quality ≥ 50 et prix > 0

  const search = async (args: Record<string, unknown>): Promise<Row[]> => {
    const { data, error } = await service.rpc('search_market_listings', args)
    expect(error).toBeNull()
    return (data ?? []) as Row[]
  }

  const count = async (args: Record<string, unknown>): Promise<number> => {
    const { data, error } = await service.rpc('count_market_listings', args)
    expect(error).toBeNull()
    return Number(data ?? 0)
  }

  beforeAll(async () => {
    service = serviceRoleClient()

    const seed = async (
      suffix: string,
      row: Record<string, unknown>,
      forcedId?: string,
    ): Promise<string> => {
      const { data, error } = await service
        .from('market_listings')
        .insert({
          ...(forcedId ? { id: forcedId } : {}),
          source_id: `search-full-market-${suffix}-${STAMP}`,
          source_portal: 'flatfox',
          title: `Recherche marché complet QA ${suffix}`,
          city: CITY,
          canton: 'GE',
          type: 'apartment',
          transaction_type: 'buy',
          status: 'active',
          quality_score: 70,
          ...row,
        })
        .select('id')
        .single()
      if (error) throw new Error(`ml ${suffix}: ${error.message}`)
      seeded.push(data.id as string)
      return data.id as string
    }

    // Ordre d'INSERTION volontairement mélangé : si la RPC rendait l'ordre physique
    // (pas d'ORDER BY, ou un ORDER BY non couvrant), le résultat ne serait pas celui-ci.
    midBuyVd = await seed('mid-vd', { canton: 'VD', price: 900_000, created_at: T(48) })
    await seed('tie-hi', { price: 1_000_000, created_at: T(96) }, TIE_HI)
    zeroPrice = await seed('zero', { price: 0, created_at: T(2) })
    newBuyHouse = await seed('new-house', { type: 'house', price: 1_100_000, created_at: T(24) })
    lowQuality = await seed('low-q', { price: 1_000_000, quality_score: 10, created_at: T(3) })
    await seed('tie-lo', { price: 1_000_000, created_at: T(96) }, TIE_LO)
    rentGe = await seed('rent', { transaction_type: 'rent', price: 3_000, created_at: T(1) })
    oldBuy = await seed('old-buy', { price: 1_000_000, created_at: T(72) })
    // status='price_reduced' : le prédicat est `status IN ('active','price_reduced')`.
    // Un resserrement futur sur `status = 'active'` — la tentation naturelle, et le piège
    // que la migration signale — effacerait les biens à prix baissé (feature #822).
    // Semis en source_portal='flatfox' : le trigger trg_ra_price_status est BEFORE UPDATE
    // et scopé realadvisor, donc il ne réécrit pas ce statut posé à l'INSERT.
    reducedBuy = await seed('reduced', {
      price: 1_000_000, current_price: 950_000, price_at_first_seen: 1_000_000,
      status: 'price_reduced', created_at: T(36),
    })
  })

  afterAll(async () => {
    // Aucune FK sortante posée par ce fichier (pas de matches) → suppression directe.
    for (const id of seeded) await service.from('market_listings').delete().eq('id', id)
  })

  // ───────────────────────────── 1. Shape & limite ─────────────────────────────
  it('shape : chaque ligne porte id + created_at, et rien d\'autre à deviner', async () => {
    const rows = await search({ p_tx: 'buy', p_city: CITY, p_min_quality: 50, p_limit: 400 })
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) {
      expect(r).toHaveProperty('id')
      expect(r).toHaveProperty('created_at')
      expect(typeof r.id).toBe('string')
      expect(Number.isNaN(Date.parse(r.created_at))).toBe(false)
    }
  })

  it('p_limit borne le résultat, et garde la TÊTE du tri (pas une tranche au hasard)', async () => {
    const two = await search({ p_tx: 'buy', p_city: CITY, p_min_quality: 50, p_limit: 2 })
    expect(two.map((r) => r.id)).toEqual(expectedBuyOrder().slice(0, 2))

    // GREATEST(COALESCE(p_limit, 400), 1) : une limite absurde ne renvoie jamais 0 ligne.
    const one = await search({ p_tx: 'buy', p_city: CITY, p_min_quality: 50, p_limit: 0 })
    expect(one).toHaveLength(1)
    expect(one[0].id).toBe(newBuyHouse)
  })

  // ──────────────────── 2. Le tri : c'est TOUTE la raison d'être ────────────────
  it('ORDRE EXACT : created_at DESC puis id DESC — la plus chère récente devant la moins chère ancienne', async () => {
    const rows = await search({ p_tx: 'buy', p_city: CITY, p_min_quality: 50, p_limit: 400 })
    expect(rows.map((r) => r.id)).toEqual(expectedBuyOrder())

    // Formulation explicite du régresseur : l'annonce la plus CHÈRE du lot (1,1 M)
    // sort en tête, la moins chère (900 k) est au milieu. Un ORDER BY prix ASC —
    // le comportement de match_candidate_listings — inverserait exactement ceci.
    expect(rows[0].id).toBe(newBuyHouse)
    expect(rows[0].id).not.toBe(midBuyVd)
  })

  it('monotonie stricte : on parcourt le tableau paire par paire (semis + données déjà là)', async () => {
    const assertStrictlyOrdered = (rows: Row[]) => {
      for (let i = 1; i < rows.length; i++) {
        const prev = Date.parse(rows[i - 1].created_at)
        const curr = Date.parse(rows[i].created_at)
        expect(prev).toBeGreaterThanOrEqual(curr)
        // Ex æquo sur la date → la clé de départage doit être id DESC (future
        // pagination keyset : created_at n'est pas unique, id est indispensable).
        if (prev === curr) expect(rows[i - 1].id > rows[i].id).toBe(true)
      }
    }

    assertStrictlyOrdered(await search({ p_tx: 'buy', p_city: CITY, p_min_quality: 50, p_limit: 400 }))
    // Sur le marché réel : vacuously safe si la table est vide (CI local fraîchement migré).
    assertStrictlyOrdered(await search({ p_tx: 'buy', p_min_quality: 50, p_limit: 200 }))
    assertStrictlyOrdered(await search({ p_tx: 'rent', p_min_quality: 50, p_limit: 200 }))
  })

  // ─────────── 3. Cohérence count ↔ search : l'assertion qui tient la PR ───────────
  it('COHÉRENCE : pour les mêmes filtres, count == nb de lignes quand la limite ne sature pas', async () => {
    // Population isolée par la ville : 5 lignes attendues, très en dessous de la limite.
    const args = { p_tx: 'buy', p_city: CITY, p_min_quality: 50 }
    const rows = await search({ ...args, p_limit: 400 })
    expect(await count(args)).toBe(rows.length)
    expect(rows).toHaveLength(POPULATION)
  })

  it('status : les biens à prix baissé restent visibles (IN active/price_reduced, feature #822)', async () => {
    const ids = (await search({ p_tx: 'buy', p_city: CITY, p_min_quality: 50, p_limit: 400 })).map((r) => r.id)
    expect(ids).toContain(reducedBuy)
    // Et les deux RPC voient le même statut : un resserrement sur 'active' ferait
    // diverger la liste et le total simultanément, mais celui-ci le nomme.
    expect(await count({ p_tx: 'buy', p_city: CITY, p_min_quality: 50 })).toBe(POPULATION)
  })

  it('COHÉRENCE sur plusieurs jeux de filtres (canton, type, transaction, budget, qualité)', async () => {
    const cases: Record<string, unknown>[] = [
      { p_tx: 'buy', p_city: CITY, p_min_quality: 50, p_cantons: ['VD'] },
      { p_tx: 'buy', p_city: CITY, p_min_quality: 50, p_types: ['house'] },
      { p_tx: 'rent', p_city: CITY, p_min_quality: 50 },
      { p_tx: 'buy', p_city: CITY, p_min_quality: 0 },
      { p_tx: 'buy', p_city: CITY, p_min_quality: 50, p_budget_max: 800_000 },
      { p_tx: 'buy', p_city: CITY, p_min_quality: 50, p_budget_min: 1_200_000 },
      { p_tx: 'buy', p_city: CITY, p_min_quality: 50, p_budget_max: 1_000_000, p_margin: 0 },
    ]
    for (const args of cases) {
      const rows = await search({ ...args, p_limit: 400 })
      expect(await count(args), `divergence des WHERE pour ${JSON.stringify(args)}`).toBe(rows.length)
    }
  })

  it('COHÉRENCE sur le marché réel : count ≥ lignes, et égalité tant que la limite ne sature pas', async () => {
    // Aucun nombre magique : le volume GE bouge chaque nuit (flatfox-sync 04:00 UTC).
    // On n'affirme donc que la relation entre les deux RPC.
    const args = { p_tx: 'buy', p_cantons: ['GE'], p_min_quality: 50 }
    const LIMIT = 2_000
    const rows = await search({ ...args, p_limit: LIMIT })
    const total = await count(args)
    expect(total).toBeGreaterThanOrEqual(rows.length)
    if (rows.length < LIMIT) expect(total).toBe(rows.length) // limite non saturée → égalité stricte
  })

  // ───────────────────────── 4. Les filtres filtrent bien ─────────────────────────
  it('p_tx : un budget d\'achat ne ramène jamais de location, et réciproquement', async () => {
    const buys = await search({ p_tx: 'buy', p_city: CITY, p_min_quality: 50, p_limit: 400 })
    expect(buys.map((r) => r.id)).not.toContain(rentGe)

    const rents = await search({ p_tx: 'rent', p_city: CITY, p_min_quality: 50, p_limit: 400 })
    expect(rents.map((r) => r.id)).toEqual([rentGe])
  })

  it('p_cantons / p_types restreignent réellement', async () => {
    const vd = await search({ p_tx: 'buy', p_city: CITY, p_min_quality: 50, p_cantons: ['VD'], p_limit: 400 })
    expect(vd.map((r) => r.id)).toEqual([midBuyVd])

    const houses = await search({ p_tx: 'buy', p_city: CITY, p_min_quality: 50, p_types: ['house'], p_limit: 400 })
    expect(houses.map((r) => r.id)).toEqual([newBuyHouse])

    // Filtres omis (DEFAULT NULL) = aucun filtre, pas un filtre vide qui ne rendrait rien.
    const all = await search({ p_tx: 'buy', p_city: CITY, p_min_quality: 50, p_limit: 400 })
    expect(all.length).toBeGreaterThan(vd.length)
  })

  it('p_city : insensible aux accents ET à la casse (unaccent(lower(…)) des deux côtés)', async () => {
    const accented = await search({ p_tx: 'buy', p_city: CITY, p_min_quality: 50, p_limit: 400 })
    const plain = await search({ p_tx: 'buy', p_city: CITY_UNACCENTED_UPPER, p_min_quality: 50, p_limit: 400 })
    expect(plain.map((r) => r.id)).toEqual(accented.map((r) => r.id))
    expect(plain).toHaveLength(POPULATION)
    expect(await count({ p_tx: 'buy', p_city: CITY_UNACCENTED_UPPER, p_min_quality: 50 })).toBe(POPULATION)
  })

  it('p_min_quality : le seuil coupe, mais le prix 0 reste exclu même à seuil 0', async () => {
    const strict = await search({ p_tx: 'buy', p_city: CITY, p_min_quality: 50, p_limit: 400 })
    expect(strict.map((r) => r.id)).not.toContain(lowQuality)

    const loose = await search({ p_tx: 'buy', p_city: CITY, p_min_quality: 0, p_limit: 400 })
    expect(loose.map((r) => r.id)).toContain(lowQuality)
    // COALESCE(current_price, price) > 0 : le bruit (parkings, erreurs d'import)
    // n'est jamais rattrapé en baissant la qualité demandée.
    expect(loose.map((r) => r.id)).not.toContain(zeroPrice)
    expect(loose[0].id).toBe(lowQuality) // 3 h > 24 h : le tri reste la fraîcheur
  })

  it('budget + marge : la tolérance p_margin s\'applique aux deux bornes', async () => {
    // Plafond 800 k × 1,15 = 920 k → seul le bien à 900 k passe.
    const capped = await search({ p_tx: 'buy', p_city: CITY, p_min_quality: 50, p_budget_max: 800_000, p_limit: 400 })
    expect(capped.map((r) => r.id)).toEqual([midBuyVd])

    // Plancher 1,2 M × 0,85 = 1,02 M → seul le bien à 1,1 M passe.
    const floored = await search({ p_tx: 'buy', p_city: CITY, p_min_quality: 50, p_budget_min: 1_200_000, p_limit: 400 })
    expect(floored.map((r) => r.id)).toEqual([newBuyHouse])

    // Marge nulle : plafond strict à 1 M → le bien à 1,1 M tombe.
    const noMargin = await search({
      p_tx: 'buy', p_city: CITY, p_min_quality: 50, p_budget_max: 1_000_000, p_margin: 0, p_limit: 400,
    })
    expect(noMargin.map((r) => r.id)).not.toContain(newBuyHouse)
    expect(noMargin.map((r) => r.id)).toContain(oldBuy)
  })
})

// ───────────────────────────────── 5. Sécurité ─────────────────────────────────
describe.skipIf(!HAS_KEYS)('search/count_market_listings — EXECUTE fermé à l\'anon', () => {
  it('anon ne peut exécuter ni search_market_listings ni count_market_listings', async () => {
    const anon = anonClient()

    const { error: searchErr } = await anon.rpc('search_market_listings', { p_tx: 'buy', p_limit: 1 })
    expect(searchErr, 'anon doit être rejeté (EXECUTE révoqué)').not.toBeNull()
    expect(searchErr?.code).toBe(DENIED)

    const { error: countErr } = await anon.rpc('count_market_listings', { p_tx: 'buy' })
    expect(countErr, 'anon doit être rejeté (EXECUTE révoqué)').not.toBeNull()
    expect(countErr?.code).toBe(DENIED)
  })

  it('service_role, lui, passe (sinon le test précédent ne prouverait rien)', async () => {
    const { error } = await serviceRoleClient().rpc('count_market_listings', { p_tx: 'buy' })
    expect(error).toBeNull()
  })
})
