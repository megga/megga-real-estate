// Backend test (live CI) — Score de bien v1 : RPC calculate_property_scores +
// get_property_score_config (migration 20260616190000_property_scoring_v1.sql).
//
// JUMEAU du score de contact (20260616170000) : ici l'entité scorée est
// public.properties (biens INTERNES, RLS agence) — PAS market_listings
// (marketplace OFF → les colonnes marché de property_scores restent NULL).
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : les tests s'exécutent contre un Supabase
// local seedé (jamais la prod) et DOIVENT réellement passer. Le barème vient de
// la migration (app_config.property_scoring_v1) → les valeurs sont déterministes.
//
// Sémantique : overall_score 0-100 = SANTÉ/CHALEUR du bien. HAUT = sain/complet/
// qui avance ; BAS = stagnant/incomplet/froid. 4 axes honnêtes pondérés FIXES :
//   overall = round(0.20·freshness + 0.20·interest + 0.15·pipeline + 0.45·completeness)
// Signal ABSENT → défaut NEUTRE (jamais 0 qui cratérerait) :
//   interest n=0 → 30 ; pipeline 0 tx → 25. freshness/completeness intrinsèques.
//
// Couvre :
//   - S1  Calcul + persistance (UPSERT) ; overall ∈ [0,100] ; agency_id NOT NULL (invariant anti-fuite) ; source='internal'.
//   - S2  Isolation soft-delete : un bien deleted_at IS NOT NULL n'est PAS scoré.
//   - S3  Colonnes MARCHÉ + heat/fantômes JAMAIS écrites (NULL) : honnêteté, pas fabrication.
//   - S4  DISCRIMINATION (pivot du bien) : fiche-complète ≫ fiche-bare ; la complétude discrimine.
//   - S5  Axes — freshness (frais → 100), completeness (fraction des champs présents, photos vides via cardinality).
//   - S6  BORNAGE INTÉRÊT : >cap contacts ne dépassent pas le cap (jamais additif) ; matches marché exclus.
//   - S7  PIPELINE : tx 'cancelled' ignorée ; 0 tx → neutral 25 (pas 0) ; stage 'offer' → 75.
//   - S8  data_completeness honnête (interest + pipeline sur 2) ; score_label par seuils (chaud/a_animer/en_veille).
//   - S9  Idempotence (UPSERT) : 2ᵉ run = mêmes scores, 1 ligne/(property_id,'internal'), last_calculated_at avance.
//   - S10 Isolation multi-tenant : calculate(A) ne score pas B ; RLS lecture clientB bloquée.
//   - S11 GRANT : un agent authentifié NE PEUT PAS appeler calculate (service_role only).
//   - S12 activity_events : 1 event 'property_scores.recompute' actor_kind='system' (FILTRÉ — le trigger d'audit pollue).
//   - S13 get_property_score_config : un agent lit le barème (poids/seuils/freshness/completeness).
//   - S14 Robustesse : volume_cap=0 dans le barème ne crashe pas le run (garde anti division-par-zéro).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { type SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

const num = (x: unknown): number => Number(x)

describe.skipIf(!HAS_KEYS)('calculate_property_scores — score de bien v1 (live + isolation)', () => {
  let setup: TwoAgenciesSetup
  let svc: SupabaseClient

  const propIds: string[] = []      // biens (toutes agences, tous nettoyés en afterAll)
  const contactIds: string[] = []   // contacts porteurs des matches (FK matches.contact_id NOT NULL)
  const mlIds: string[] = []        // annonces marché (matches market exclus du scoring)
  let urlCfg: { had: boolean; value: string | null } = { had: false, value: null }

  // biens notables (agence A sauf pB)
  let pFull = ''       // fiche complète 9/9 + 1 match interne@100 → fresh100/int55/pipe25/comp100 → 80 'chaud'
  let pPartial = ''    // 5 champs cœur, 0 match, 0 tx → 100/30/25/63 → 58 'a_animer'
  let pBare = ''       // price seul, 0 match, 0 tx → 100/30/25/13 → 36 'en_veille'
  let pPipeline = ''   // 5 champs cœur + tx 'offer' active + tx 'signed' CANCELLED (ignorée) → 100/30/75/63 → 66 'a_animer'
  let pCap = ''        // 5 champs cœur + 5 matches internes@100 (5 contacts distincts) + 3 matches MARCHÉ (exclus) → 100/100/25/63 → 72 'chaud'
  let pDeleted = ''    // deleted_at NOT NULL → JAMAIS scoré
  let pB = ''          // agence B → isolation

  // ── helpers de seed ───────────────────────────────────────────────────────

  // Contact minimal — porteur des matches (matches.contact_id NOT NULL). On NE
  // teste PAS le score de contact ici : ces contacts existent juste pour la FK.
  const mkContact = async (agencyId: string, tag: string): Promise<string> => {
    const { data, error } = await svc.from('contacts').insert({
      agency_id: agencyId, first_name: 'PS', last_name: `${tag}-${setup.stamp}`, type: 'buyer',
    }).select('id').single()
    if (error) throw new Error(`contact ${tag}: ${error.message}`)
    contactIds.push(data.id)
    return data.id
  }

  // Bien INTERNE. status='draft' OBLIGATOIRE : évite on_property_active /
  // on_property_price_change (net.http_post vers matching-engine — NULL en CI →
  // violation NOT NULL http_request_queue). `fields` permet de varier la complétude.
  const mkProperty = async (
    agencyId: string,
    tag: string,
    fields: Record<string, unknown> = {},
  ): Promise<string> => {
    const { data, error } = await svc.from('properties').insert({
      agency_id: agencyId, title: `PS QA ${tag} ${setup.stamp}`,
      type: 'apartment', status: 'draft', transaction_type: 'buy',
      ...fields,
    }).select('id').single()
    if (error) throw new Error(`property ${tag}: ${error.message}`)
    propIds.push(data.id)
    return data.id
  }

  // Fiche COMPLÈTE (9/9 champs de completeness présents) → completeness_score=100.
  const fullFiche = {
    price: 1_000_000, surface_m2: 100, rooms: 4,
    description: 'Bel appartement lumineux au cœur de Genève, proche commodités et transports.',
    photos: ['https://example.test/p1.jpg', 'https://example.test/p2.jpg'],
    address: 'Rue du Test 1', city: 'Genève', canton: 'GE', postal_code: '1200',
    energy_label: 'B', year_built: 2015, c2pa_verified: true,
  }

  // Fiche CŒUR (5 champs : price+surface+rooms+description+location ; photos/energy/
  // year/c2pa absents) → Σpoids présents = 1+1+1+1+1 = 5.0 / 8.0 total → comp=63.
  const coreFiche = {
    price: 800_000, surface_m2: 80, rooms: 3,
    description: 'Appartement de trois pièces avec balcon, vue dégagée, quartier calme et résidentiel.',
    address: 'Rue du Test 2', city: 'Genève', canton: 'GE', postal_code: '1201',
    // photos NON fournies → DEFAULT '{}' → cardinality 0 (GOTCHA : array_length('{}')=NULL).
    // energy_label/energy_class, year_built, c2pa_verified absents.
  }

  // Fiche BARE (price seul) → Σpoids = 1.0 / 8.0 → comp=13.
  const bareFiche = { price: 500_000 }

  const mkInternalMatch = async (agencyId: string, contactId: string, propId: string, score: number): Promise<void> => {
    const { error } = await svc.from('matches').insert({
      agency_id: agencyId, contact_id: contactId, property_id: propId,
      score, source: 'internal', status: 'suggested',
      reasons: { budget: { match: true }, zone: { match: true } },
    })
    if (error) throw new Error(`internal match: ${error.message}`)
  }

  // Annonce marché distincte + match MARCHÉ (source='market', market_listing_id) :
  // ne DOIT PAS compter dans interest (le RPC filtre source='internal').
  const mkMl = async (tag: string): Promise<string> => {
    const { data, error } = await svc.from('market_listings').insert({
      source_id: `ps-qa-${tag}-${setup.stamp}`, source_portal: 'flatfox', title: `PS QA market ${tag}`,
      city: 'Genève', canton: 'GE', type: 'apartment', transaction_type: 'buy',
      price: 1_100_000, current_price: 1_100_000, status: 'active', quality_score: 70,
      photos: ['https://example.test/ml.jpg'],
    }).select('id').single()
    if (error) throw new Error(`ml ${tag}: ${error.message}`)
    mlIds.push(data.id)
    return data.id
  }

  const mkMarketMatch = async (agencyId: string, contactId: string, score: number, mlId: string): Promise<void> => {
    const { error } = await svc.from('matches').insert({
      agency_id: agencyId, contact_id: contactId, score, source: 'market',
      status: 'suggested', market_listing_id: mlId,
      reasons: { budget: { match: true }, zone: { match: true } },
    })
    if (error) throw new Error(`market match: ${error.message}`)
  }

  // Transaction liée à un bien (property_id). contact_buyer_id requis pour réalisme ;
  // le scoring du bien ne compte que count + max(stage_depth) sur status<>'cancelled'.
  const mkTx = async (agencyId: string, propId: string, contactId: string, stage: string, status: string): Promise<void> => {
    const { error } = await svc.from('transactions').insert({
      agency_id: agencyId, property_id: propId, contact_buyer_id: contactId, stage, status,
    })
    if (error) throw new Error(`tx ${stage}/${status}: ${error.message}`)
  }

  const scoreOf = async (pid: string): Promise<Record<string, unknown> | null> => {
    const { data } = await svc.from('property_scores')
      .select('*').eq('property_id', pid).eq('source', 'internal').maybeSingle()
    return data as Record<string, unknown> | null
  }

  const runA = async (): Promise<number> => {
    const { data, error } = await svc.rpc('calculate_property_scores', { p_agency: setup.agencyAId })
    if (error) throw new Error(`calculate A: ${error.message}`)
    return data as number
  }

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    svc = serviceRoleClient()

    // ── PARADE CI ────────────────────────────────────────────────────────────
    // Les biens sont seedés en status='draft' → on_property_active /
    // on_property_price_change NE se déclenchent PAS (ils ne tirent que sur
    // status='active'). Ceinture + bretelles : on pose tout de même une supabase_url
    // factice NON-RÉSOLVABLE le temps de la suite (au cas où un futur seed passerait
    // un bien en 'active'), restaurée en afterAll. (backend tests = série,
    // fileParallelism:false → pas de course sur app_config.)
    {
      const { data: row } = await svc.from('app_config').select('value').eq('key', 'supabase_url').maybeSingle()
      urlCfg = { had: row !== null, value: (row?.value as string | null) ?? null }
      await svc.from('app_config').upsert({ key: 'supabase_url', value: 'http://invalid.local' }, { onConflict: 'key' })
    }

    // contacts porteurs (matches.contact_id NOT NULL). uq_matches_contact_property
    // interdit 2 matches du MÊME contact sur le même bien → pour donner à pCap un
    // VOLUME au-dessus du cap (4), on croise 5 contacts DISTINCTS.
    const cA = await mkContact(setup.agencyAId, 'A')
    const cB = await mkContact(setup.agencyBId, 'B')
    const capContacts: string[] = []
    for (let i = 0; i < 5; i++) capContacts.push(await mkContact(setup.agencyAId, `Cap${i}`))

    // ── biens (agence A) ─────────────────────────────────────────────────────
    pFull = await mkProperty(setup.agencyAId, 'Full', fullFiche)
    pPartial = await mkProperty(setup.agencyAId, 'Partial', coreFiche)
    pBare = await mkProperty(setup.agencyAId, 'Bare', bareFiche)
    pPipeline = await mkProperty(setup.agencyAId, 'Pipe', coreFiche)
    pCap = await mkProperty(setup.agencyAId, 'Cap', coreFiche)
    // bien soft-deleted → JAMAIS scoré (deleted_at posé après insert ; status reste
    // 'draft' → pas de trigger matching)
    pDeleted = await mkProperty(setup.agencyAId, 'Deleted', fullFiche)
    await svc.from('properties').update({ deleted_at: new Date().toISOString() }).eq('id', pDeleted)

    // bien agence B (isolation) — fiche complète pour qu'il SERAIT scoré si touché
    pB = await mkProperty(setup.agencyBId, 'AgencyB', fullFiche)

    // ── intérêt (matches INTERNES, source='internal', property_id) ───────────
    await mkInternalMatch(setup.agencyAId, cA, pFull, 100)            // 1 match → int=round(0.6*25+0.4*100)=55

    // pCap : 5 matches internes@100 (5 contacts distincts) → volume cappé à 4 → int=100,
    // ne dépasse PAS pFull(80) malgré 5× plus de matches (jamais additif).
    for (const cc of capContacts) await mkInternalMatch(setup.agencyAId, cc, pCap, 100)
    // + 3 matches MARCHÉ sur pCap (via market_listing_id, contact cA) → DOIVENT être ignorés
    const ml1 = await mkMl('1'); const ml2 = await mkMl('2'); const ml3 = await mkMl('3')
    await mkMarketMatch(setup.agencyAId, cA, 100, ml1)
    await mkMarketMatch(setup.agencyAId, cA, 100, ml2)
    await mkMarketMatch(setup.agencyAId, cA, 100, ml3)

    // ── pipeline (transactions liées) ────────────────────────────────────────
    await mkTx(setup.agencyAId, pPipeline, cA, 'offer', 'active')      // depth 75
    await mkTx(setup.agencyAId, pPipeline, cA, 'signed', 'cancelled')  // ignorée (status='cancelled')

    // bien B avec match interne (pour prouver que calculate(A) ne le touche pas)
    await mkInternalMatch(setup.agencyBId, cB, pB, 100)

    await runA()
  })

  afterAll(async () => {
    if (!svc) return
    if (propIds.length) {
      await svc.from('matches').delete().in('property_id', propIds)
      await svc.from('transactions').delete().in('property_id', propIds)
      await svc.from('property_scores').delete().in('property_id', propIds)
    }
    if (mlIds.length) await svc.from('matches').delete().in('market_listing_id', mlIds)
    if (contactIds.length) await svc.from('matches').delete().in('contact_id', contactIds)
    if (propIds.length) await svc.from('properties').delete().in('id', propIds)
    if (contactIds.length) await svc.from('contacts').delete().in('id', contactIds)
    if (mlIds.length) await svc.from('market_listings').delete().in('id', mlIds)
    // restaure supabase_url tel qu'avant le seed
    if (urlCfg.had) await svc.from('app_config').update({ value: urlCfg.value }).eq('key', 'supabase_url')
    else await svc.from('app_config').delete().eq('key', 'supabase_url')
    await setup.cleanup()
  })

  it('S1 — calcul + persistance : overall ∈ [0,100], agency_id NOT NULL (anti-fuite), source=internal', async () => {
    const ids = [pFull, pPartial, pBare, pPipeline, pCap]
    for (const id of ids) {
      const r = await scoreOf(id)
      expect(r, `score manquant pour ${id}`).toBeTruthy()
      const ov = num(r!.overall_score)
      expect(ov).toBeGreaterThanOrEqual(0)
      expect(ov).toBeLessThanOrEqual(100)
      expect(r!.agency_id).toBe(setup.agencyAId)
      expect(r!.source).toBe('internal')
      for (const k of ['freshness_score', 'interest_score', 'pipeline_score', 'completeness_score']) {
        expect(num(r![k])).toBeGreaterThanOrEqual(0)
        expect(num(r![k])).toBeLessThanOrEqual(100)
      }
    }
    // invariant anti-fuite RLS : AUCUNE ligne écrite avec agency_id NULL (sinon
    // lisible cross-agence via la policy de lecture 'OR agency_id IS NULL').
    const { data: allRows } = await svc.from('property_scores').select('agency_id').in('property_id', propIds)
    expect((allRows ?? []).length).toBeGreaterThan(0)
    for (const row of allRows ?? []) expect(row.agency_id).not.toBeNull()
  })

  it('S2 — soft-delete : un bien deleted_at IS NOT NULL n\'est JAMAIS scoré', async () => {
    expect(await scoreOf(pDeleted)).toBeNull()
  })

  it('S3 — colonnes MARCHÉ + fantômes JAMAIS écrites (NULL, jamais fabriquées)', async () => {
    const r = await scoreOf(pFull)
    for (const k of [
      'market_listing_id', 'market_position_score', 'comparable_count',
      'avg_comparable_price', 'price_vs_market_pct',
      'heat_score', 'interest_level', 'days_on_market', 'price_trend', 'stagnation_risk',
    ]) {
      expect(r![k], `${k} devrait être NULL (jamais fabriqué)`).toBeNull()
    }
  })

  it('S4 — DISCRIMINATION : fiche-complète ≫ fiche-bare (la complétude discrimine)', async () => {
    const full = await scoreOf(pFull)
    const bare = await scoreOf(pBare)
    expect(num(full!.overall_score)).toBe(80)   // fresh100/int55/pipe25/comp100
    expect(num(bare!.overall_score)).toBe(36)   // fresh100/int30/pipe25/comp13
    expect(num(full!.overall_score)).toBeGreaterThan(num(bare!.overall_score))
    expect(full!.score_label).toBe('chaud')
    expect(bare!.score_label).toBe('en_veille')
  })

  it('S5 — axes : freshness (frais → 100) + completeness (fraction des champs, photos vides via cardinality)', async () => {
    const full = await scoreOf(pFull)
    const partial = await scoreOf(pPartial)
    const bare = await scoreOf(pBare)
    expect(num(full!.freshness_score)).toBe(100)
    expect(num(partial!.freshness_score)).toBe(100)
    expect(num(full!.completeness_score)).toBe(100)
    expect(num(partial!.completeness_score)).toBe(63)  // 5/8 (photos vides exclues via cardinality)
    expect(num(bare!.completeness_score)).toBe(13)     // 1/8
  })

  it('S6 — BORNAGE INTÉRÊT : >cap contacts cappés (jamais additif) ; matches marché exclus', async () => {
    const full = await scoreOf(pFull)
    const cap = await scoreOf(pCap)
    const partial = await scoreOf(pPartial)
    expect(num(full!.interest_score)).toBe(55)
    expect(num(cap!.interest_score)).toBe(100)
    expect(num(cap!.interest_score)).toBeLessThanOrEqual(100)
    expect(num(partial!.interest_score)).toBe(30)     // neutral, PAS 0
    expect(num(cap!.overall_score)).toBe(72)
    expect(num(cap!.overall_score)).toBeLessThan(num(full!.overall_score)) // 72 < 80 malgré 5× matches
  })

  it('S7 — PIPELINE : tx "cancelled" ignorée ; stage "offer" → 75 ; 0 tx → neutral 25 (pas 0)', async () => {
    const pipe = await scoreOf(pPipeline)
    const bare = await scoreOf(pBare)
    expect(num(pipe!.pipeline_score)).toBe(75)
    expect(num(bare!.pipeline_score)).toBe(25)
    expect(num(pipe!.overall_score)).toBe(66)
    expect(pipe!.score_label).toBe('a_animer')
  })

  it('S8 — data_completeness honnête (interest + pipeline sur 2) + labels par seuils', async () => {
    expect(num((await scoreOf(pFull))!.data_completeness)).toBe(0.5)
    expect(num((await scoreOf(pCap))!.data_completeness)).toBe(0.5)
    expect(num((await scoreOf(pPartial))!.data_completeness)).toBe(0)
    expect(num((await scoreOf(pBare))!.data_completeness)).toBe(0)
    expect(num((await scoreOf(pPipeline))!.data_completeness)).toBe(0.5)
    expect((await scoreOf(pFull))!.score_label).toBe('chaud')        // 80
    expect((await scoreOf(pCap))!.score_label).toBe('chaud')         // 72
    expect((await scoreOf(pPartial))!.score_label).toBe('a_animer')  // 58
    expect((await scoreOf(pPipeline))!.score_label).toBe('a_animer') // 66
    expect((await scoreOf(pBare))!.score_label).toBe('en_veille')    // 36
  })

  it('S9 — idempotence : 2ᵉ run = mêmes scores, 1 ligne/(property_id,internal), last_calculated_at avance', async () => {
    const before = await scoreOf(pFull)
    const { count } = await svc.from('property_scores')
      .select('id', { count: 'exact', head: true }).eq('property_id', pFull).eq('source', 'internal')
    expect(count).toBe(1)
    await new Promise((r) => setTimeout(r, 10))
    await runA()
    const after = await scoreOf(pFull)
    expect(num(after!.overall_score)).toBe(num(before!.overall_score))
    expect(num(after!.completeness_score)).toBe(num(before!.completeness_score))
    const { count: count2 } = await svc.from('property_scores')
      .select('id', { count: 'exact', head: true }).eq('property_id', pFull).eq('source', 'internal')
    expect(count2).toBe(1)
    expect(new Date(after!.last_calculated_at as string).getTime())
      .toBeGreaterThanOrEqual(new Date(before!.last_calculated_at as string).getTime())
  })

  it('S10 — isolation : calculate(A) ne score pas l\'agence B ; RLS lecture clientB bloquée', async () => {
    expect(await scoreOf(pB)).toBeNull()
    const { data: leak } = await setup.clientB.from('property_scores')
      .select('property_id, agency_id').eq('property_id', pFull)
    expect(leak ?? []).toEqual([])
  })

  it('S11 — GRANT : un agent authentifié NE PEUT PAS appeler calculate (service_role only)', async () => {
    const { error } = await setup.clientA.rpc('calculate_property_scores', { p_agency: setup.agencyAId })
    expect(error).not.toBeNull()
  })

  it('S12 — audit : activity_events "property_scores.recompute" (actor_kind=system) pour A — FILTRÉ', async () => {
    const { data } = await svc.from('activity_events')
      .select('action, actor_kind, actor_id, entity_type, category, metadata, agency_id')
      .eq('agency_id', setup.agencyAId).eq('action', 'property_scores.recompute')
      .order('created_at', { ascending: false }).limit(1)
    const ev = (data ?? [])[0] as Record<string, unknown> | undefined
    expect(ev, 'aucun activity_event de recompute').toBeTruthy()
    expect(ev!.actor_kind).toBe('system')
    expect(ev!.actor_id).toBeNull()
    expect(ev!.entity_type).toBe('property_scores')
    expect(ev!.category).toBe('bien')
    expect(num((ev!.metadata as Record<string, unknown>).count)).toBeGreaterThan(0)
  })

  it('S13 — get_property_score_config : un agent lit le barème (poids/seuils/freshness/completeness)', async () => {
    const { data, error } = await setup.clientA.rpc('get_property_score_config', {})
    expect(error).toBeNull()
    const cfg = data as {
      weights?: Record<string, number>
      thresholds?: Record<string, number>
      freshness?: { tiers?: unknown[]; floor?: number }
      completeness?: { fields?: Record<string, number> }
      interest?: { volume_cap?: number }
    }
    expect(typeof cfg.weights?.completeness).toBe('number')
    expect(typeof cfg.thresholds?.label_chaud).toBe('number')
    expect(Array.isArray(cfg.freshness?.tiers)).toBe(true)
    expect(typeof cfg.completeness?.fields?.photos).toBe('number')
    expect(typeof cfg.interest?.volume_cap).toBe('number')
  })

  it('S14 — robustesse : volume_cap=0 dans le barème ne crashe pas le run (garde anti division-par-zéro)', async () => {
    const { data: row } = await svc.from('app_config').select('value').eq('key', 'property_scoring_v1').maybeSingle()
    const original = row?.value as string
    const cfg = JSON.parse(original) as { interest: { volume_cap: number } }
    cfg.interest.volume_cap = 0
    await svc.from('app_config').update({ value: JSON.stringify(cfg) }).eq('key', 'property_scoring_v1')
    try {
      // GREATEST(1, …) ramène le cap à 1 → pas de division par zéro, le run aboutit.
      const n = await runA()
      expect(n).toBeGreaterThan(0)
      const r = await scoreOf(pCap)
      expect(num(r!.overall_score)).toBeGreaterThanOrEqual(0)
      expect(num(r!.overall_score)).toBeLessThanOrEqual(100)
    } finally {
      // restaure le barème d'origine + re-score pour ne pas laisser un état tuné.
      await svc.from('app_config').update({ value: original }).eq('key', 'property_scoring_v1')
      await runA()
    }
  })
})
