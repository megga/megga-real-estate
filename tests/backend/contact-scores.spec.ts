// Backend test (live CI) — Score de contact v1 : RPC calculate_contact_scores +
// get_contact_score_config + blend focus_top_matches
// (migrations 20260616170000_contact_scoring_v1.sql + 20260616180000_focus_blend_contact_score.sql).
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : les tests s'exécutent contre un Supabase
// local seedé (jamais la prod) et DOIVENT réellement passer. Le barème vient de
// la migration (app_config.contact_scoring_v1) → les valeurs sont déterministes.
//
// Couvre :
//   - Calcul + persistance (UPSERT) ; overall_score ∈ [0,100].
//   - v1 ACHETEUR : 0 ligne pour un contact 'seller'.
//   - Comportemental NULL (jamais fabriqué) : reactivity/engagement/conversion/…
//   - ANTI-BIAIS : un 'cold' avec BEAUCOUP de matches score SOUS un 'hot' sans match.
//   - Mapping qualité (hot85/warm65/cold35), budget (full/min/implausible/absent,
//     tx-type-aware rent vs buy), pipeline (stage + tx 'cancelled' ignorée + bonus KYC).
//   - data_completeness honnête (score/budget/tx).
//   - Idempotence (UPSERT) : 2ᵉ run = mêmes scores, 1 ligne/contact, last_calculated_at bougé.
//   - Isolation multi-tenant : calculate(A) ne touche pas B ; RLS lecture par agence.
//   - GRANT : un agent authentifié NE PEUT PAS appeler calculate (service_role only).
//   - activity_events : 1 event 'contact_scores.recompute' actor_kind='system'.
//   - focus_top_matches : re-tri par score mélangé SANS muter matches.score + lead_score.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { type SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

const num = (x: unknown): number => Number(x)

interface FocusMatchRow {
  match_id: string
  contact_id: string
  score: number
  lead_score: number | null
}

describe.skipIf(!HAS_KEYS)('calculate_contact_scores — score de contact v1 (live + isolation)', () => {
  let setup: TwoAgenciesSetup
  let svc: SupabaseClient

  const contactIds: string[] = []
  const propIds: string[] = []
  const mlIds: string[] = []
  let urlCfg: { had: boolean; value: string | null } = { had: false, value: null }

  // contacts notables (agence A sauf cB)
  let cHot = ''           // hot buyer, budget buy plausible, 0 match  → 78, blend hot raw 75
  let cCold = ''          // cold lead, sans budget/tx, AVEC match raw 95 → 32 (anti-biais)
  let cWarm = ''          // warm buyer, sans budget/tx → 47
  let cSeller = ''        // seller → JAMAIS scoré (v1 acheteur)
  let cBudgetMin = ''     // budget_min seul → 70
  let cBudgetImplausible = '' // budget_max 3000 (buy) → 50
  let cRentPlausible = '' // budget_max 3000 (rent) → 100  (tx-type-aware)
  let cPipeline = ''      // tx 'offer' active + tx 'signed' CANCELLED (ignorée) → p75
  let cKyc = ''           // tx 'lead' + kyc validated → p28
  let cLeadNoKyc = ''     // tx 'lead' sans kyc → p20
  let cFull = ''          // score+budget+tx → completeness 1.0
  let cB = ''             // agence B → isolation

  const mkContact = async (agencyId: string, last: string, type: string, score: string | null): Promise<string> => {
    const { data, error } = await svc.from('contacts').insert({
      agency_id: agencyId, first_name: 'Score', last_name: `${last}-${setup.stamp}`,
      email: `score-${last}-${Math.random()}@megga-test.local`, type, score,
    }).select('id').single()
    if (error) throw new Error(`contact ${last}: ${error.message}`)
    contactIds.push(data.id)
    return data.id
  }

  const mkSearch = async (agencyId: string, contactId: string, criteria: Record<string, unknown>): Promise<void> => {
    const { error } = await svc.from('client_searches').insert({
      agency_id: agencyId, contact_id: contactId, label: `s-${setup.stamp}`, criteria, is_active: true,
    })
    if (error) throw new Error(`search: ${error.message}`)
  }

  const mkTx = async (agencyId: string, contactId: string, stage: string, status: string): Promise<void> => {
    const { error } = await svc.from('transactions').insert({
      agency_id: agencyId, property_id: propIds[0], contact_buyer_id: contactId, stage, status,
    })
    if (error) throw new Error(`tx ${stage}/${status}: ${error.message}`)
  }

  const mkKycValidated = async (agencyId: string, contactId: string): Promise<void> => {
    const { error } = await svc.from('kyc_cases').insert({
      agency_id: agencyId, contact_id: contactId, type: 'buyer_pp', status: 'validated',
    })
    if (error) throw new Error(`kyc: ${error.message}`)
  }

  const mkMatch = async (agencyId: string, contactId: string, score: number): Promise<void> => {
    const { error } = await svc.from('matches').insert({
      agency_id: agencyId, contact_id: contactId, score, source: 'internal',
      status: 'suggested', property_id: propIds[0],
      reasons: { budget: { match: true }, zone: { match: true } },
    })
    if (error) throw new Error(`match: ${error.message}`)
  }

  // annonces marché distinctes (uq_matches_contact_market) → permettent au cold
  // contact d'avoir PLUSIEURS matches (gros volume) pour éprouver le cap per_contact.
  const mkMl = async (tag: string): Promise<string> => {
    const { data, error } = await svc.from('market_listings').insert({
      source_id: `cs-qa-${tag}-${setup.stamp}`, source_portal: 'flatfox', title: `CS QA market ${tag}`,
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

  const scoreOf = async (cid: string): Promise<Record<string, unknown> | null> => {
    const { data } = await svc.from('contact_scores').select('*').eq('contact_id', cid).maybeSingle()
    return data as Record<string, unknown> | null
  }

  const runA = async (): Promise<number> => {
    const { data, error } = await svc.rpc('calculate_contact_scores', { p_agency: setup.agencyAId })
    if (error) throw new Error(`calculate A: ${error.message}`)
    return data as number
  }

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    svc = serviceRoleClient()

    // Le trigger AFTER INSERT on_new_client_search appelle net.http_post(url :=
    // get_app_config('supabase_url') || …) quand is_active=true ; en CI supabase_url
    // est NULL → url NULL → violation NOT NULL sur http_request_queue. On pose une
    // URL factice NON-RÉSOLVABLE le temps du seed : l'INSERT passe (url non-null) mais
    // l'appel net async vers matching-engine ÉCHOUE (DNS) → aucun match parasite créé
    // pour cHot (qui a une recherche). On restaure en fin de suite. (backend tests =
    // série, fileParallelism:false → pas de course sur app_config.)
    {
      const { data: row } = await svc.from('app_config').select('value').eq('key', 'supabase_url').maybeSingle()
      urlCfg = { had: row !== null, value: (row?.value as string | null) ?? null }
      await svc.from('app_config').upsert({ key: 'supabase_url', value: 'http://invalid.local' }, { onConflict: 'key' })
    }

    // bien interne (pour les matches internal + les transactions)
    const { data: prop, error: pErr } = await svc.from('properties').insert({
      agency_id: setup.agencyAId, title: `Score QA bien ${setup.stamp}`,
      type: 'apartment', status: 'draft', price: 1_000_000, rooms: 4, surface_m2: 100,
      city: 'Genève', canton: 'GE', photos: ['https://example.test/p.jpg'],
    }).select('id').single()
    if (pErr) throw new Error(`property: ${pErr.message}`)
    propIds.push(prop.id)

    cHot = await mkContact(setup.agencyAId, 'Hot', 'buyer', 'hot')
    cCold = await mkContact(setup.agencyAId, 'Cold', 'lead', 'cold')
    cWarm = await mkContact(setup.agencyAId, 'Warm', 'buyer', 'warm')
    cSeller = await mkContact(setup.agencyAId, 'Seller', 'seller', 'hot')
    cBudgetMin = await mkContact(setup.agencyAId, 'BudMin', 'buyer', 'warm')
    cBudgetImplausible = await mkContact(setup.agencyAId, 'BudImp', 'buyer', 'warm')
    cRentPlausible = await mkContact(setup.agencyAId, 'Rent', 'buyer', 'warm')
    cPipeline = await mkContact(setup.agencyAId, 'Pipe', 'buyer', 'warm')
    cKyc = await mkContact(setup.agencyAId, 'Kyc', 'buyer', 'warm')
    cLeadNoKyc = await mkContact(setup.agencyAId, 'NoKyc', 'buyer', 'warm')
    cFull = await mkContact(setup.agencyAId, 'Full', 'buyer', 'hot')
    cB = await mkContact(setup.agencyBId, 'AgencyB', 'buyer', 'hot')

    // searches (budget) — tx-type-aware
    await mkSearch(setup.agencyAId, cHot, { type: 'apartment', budget_min: 700000, budget_max: 800000 })  // buy plausible → 100
    await mkSearch(setup.agencyAId, cBudgetMin, { type: 'apartment', budget_min: 500000 })                 // min seul → 70
    await mkSearch(setup.agencyAId, cBudgetImplausible, { type: 'apartment', budget_max: 3000 })            // buy implausible → 50
    await mkSearch(setup.agencyAId, cRentPlausible, { type: 'apartment', transaction_type: 'rent', budget_max: 3000 }) // rent plausible → 100
    await mkSearch(setup.agencyAId, cFull, { type: 'apartment', budget_max: 900000 })                       // buy plausible → 100
    await mkSearch(setup.agencyBId, cB, { type: 'apartment', budget_max: 800000 })

    // transactions (pipeline)
    await mkTx(setup.agencyAId, cPipeline, 'offer', 'active')      // depth 75
    await mkTx(setup.agencyAId, cPipeline, 'signed', 'cancelled')  // ignorée (status='cancelled')
    await mkTx(setup.agencyAId, cKyc, 'lead', 'active')            // depth 20
    await mkTx(setup.agencyAId, cLeadNoKyc, 'lead', 'active')      // depth 20
    await mkTx(setup.agencyAId, cFull, 'offer', 'active')          // depth 75
    await mkKycValidated(setup.agencyAId, cKyc)                    // +8

    // matches : cCold = GROS VOLUME (3 market matches raw 95/90/85, > per_contact=2),
    // cHot = 1 internal raw 75 (blend le fait passer DEVANT), cSeller = 1 internal raw 80
    // (lead_score NULL car non scoré). Reproduit le scénario réel (1 contact monopolise).
    const ml1 = await mkMl('1'); const ml2 = await mkMl('2'); const ml3 = await mkMl('3')
    await mkMarketMatch(setup.agencyAId, cCold, 95, ml1)
    await mkMarketMatch(setup.agencyAId, cCold, 90, ml2)
    await mkMarketMatch(setup.agencyAId, cCold, 85, ml3)
    await mkMatch(setup.agencyAId, cHot, 75)
    await mkMatch(setup.agencyAId, cSeller, 80)

    await runA()
  })

  afterAll(async () => {
    if (!svc) return
    if (contactIds.length) {
      await svc.from('matches').delete().in('contact_id', contactIds)
      await svc.from('kyc_cases').delete().in('contact_id', contactIds)
      await svc.from('client_searches').delete().in('contact_id', contactIds)
    }
    if (propIds.length) await svc.from('transactions').delete().in('property_id', propIds)
    if (contactIds.length) await svc.from('contact_scores').delete().in('contact_id', contactIds)
    if (propIds.length) await svc.from('properties').delete().in('id', propIds)
    if (contactIds.length) await svc.from('contacts').delete().in('id', contactIds)
    if (mlIds.length) await svc.from('market_listings').delete().in('id', mlIds)
    // restaure supabase_url tel qu'avant le seed
    if (urlCfg.had) await svc.from('app_config').update({ value: urlCfg.value }).eq('key', 'supabase_url')
    else await svc.from('app_config').delete().eq('key', 'supabase_url')
    await setup.cleanup()
  })

  it('S1 — calcul + persistance : overall_score ∈ [0,100] pour chaque acheteur/lead', async () => {
    const ids = [cHot, cCold, cWarm, cBudgetMin, cBudgetImplausible, cRentPlausible, cPipeline, cKyc, cLeadNoKyc, cFull]
    for (const id of ids) {
      const r = await scoreOf(id)
      expect(r, `score manquant pour ${id}`).toBeTruthy()
      const ov = num(r!.overall_score)
      expect(ov).toBeGreaterThanOrEqual(0)
      expect(ov).toBeLessThanOrEqual(100)
      expect(r!.agency_id).toBe(setup.agencyAId)
    }
  })

  it('S2 — v1 acheteur : un contact "seller" n\'est JAMAIS scoré', async () => {
    expect(await scoreOf(cSeller)).toBeNull()
  })

  it('S3 — comportemental = NULL (jamais fabriqué, pas 0)', async () => {
    const r = await scoreOf(cHot)
    for (const k of [
      'reactivity_score', 'engagement_score', 'visit_quality_score', 'buyer_score',
      'conversion_probability', 'conversion_score', 'estimated_real_budget', 'estimated_budget',
      'engagement_trend', 'intent_signals', 'rejection_patterns',
      'interactions_count', 'visits_count', 'matches_sent_count',
    ]) {
      expect(r![k], `${k} devrait être NULL`).toBeNull()
    }
  })

  it('S4 — ANTI-BIAIS : un "cold" avec un match raw 95 score SOUS un "hot" sans match', async () => {
    const cold = await scoreOf(cCold)
    const hot = await scoreOf(cHot)
    expect(num(cold!.overall_score)).toBe(32)   // 0.5·35 + 0.3·30 + 0.2·25 = 31.5
    expect(num(hot!.overall_score)).toBe(78)    // 0.5·85 + 0.3·100 + 0.2·25 = 77.5
    expect(num(cold!.overall_score)).toBeLessThan(num(hot!.overall_score))
    expect(cold!.score_label).toBe('froid')
    expect(hot!.score_label).toBe('serieux')
  })

  it('S5 — mapping qualité : hot 85 / warm 65 / cold 35', async () => {
    expect(num((await scoreOf(cHot))!.quality_score)).toBe(85)
    expect(num((await scoreOf(cWarm))!.quality_score)).toBe(65)
    expect(num((await scoreOf(cCold))!.quality_score)).toBe(35)
  })

  it('S6 — budget : full 100 / min-seul 70 / implausible 50 / absent 30 + tx-type-aware', async () => {
    expect(num((await scoreOf(cHot))!.budget_coherence_score)).toBe(100)              // buy plausible
    expect(num((await scoreOf(cBudgetMin))!.budget_coherence_score)).toBe(70)         // min seul
    expect(num((await scoreOf(cBudgetImplausible))!.budget_coherence_score)).toBe(50) // buy 3000 implausible
    expect(num((await scoreOf(cRentPlausible))!.budget_coherence_score)).toBe(100)    // rent 3000 plausible
    expect(num((await scoreOf(cWarm))!.budget_coherence_score)).toBe(30)              // pas de recherche
  })

  it('S7 — pipeline : stage le plus avancé, tx "cancelled" ignorée, bonus KYC +8', async () => {
    expect(num((await scoreOf(cPipeline))!.pipeline_score)).toBe(75)  // 'offer' ; 'signed' cancelled ignorée
    expect(num((await scoreOf(cLeadNoKyc))!.pipeline_score)).toBe(20) // 'lead'
    expect(num((await scoreOf(cKyc))!.pipeline_score)).toBe(28)       // 'lead' + KYC validé (+8)
  })

  it('S8 — data_completeness honnête (score / budget / tx présents)', async () => {
    expect(num((await scoreOf(cFull))!.data_completeness)).toBe(1)        // score+budget+tx
    expect(num((await scoreOf(cWarm))!.data_completeness)).toBe(0.33)     // score seul
    expect(num((await scoreOf(cHot))!.data_completeness)).toBe(0.67)      // score+budget
  })

  it('S9 — idempotence : 2ᵉ run = mêmes scores, 1 ligne/contact, last_calculated_at avance', async () => {
    const before = await scoreOf(cHot)
    const { count } = await svc.from('contact_scores').select('id', { count: 'exact', head: true }).eq('contact_id', cHot)
    expect(count).toBe(1)
    await new Promise((r) => setTimeout(r, 10))
    await runA()
    const after = await scoreOf(cHot)
    expect(num(after!.overall_score)).toBe(num(before!.overall_score))
    const { count: count2 } = await svc.from('contact_scores').select('id', { count: 'exact', head: true }).eq('contact_id', cHot)
    expect(count2).toBe(1)
    expect(new Date(after!.last_calculated_at as string).getTime())
      .toBeGreaterThanOrEqual(new Date(before!.last_calculated_at as string).getTime())
  })

  it('S10 — isolation : calculate(A) ne score pas l\'agence B ; RLS lecture par agence', async () => {
    expect(await scoreOf(cB)).toBeNull()
    // un agent de B ne lit jamais les scores de A (RLS agency_id = get_my_agency_id())
    const { data: leak } = await setup.clientB.from('contact_scores').select('contact_id, agency_id').eq('contact_id', cHot)
    expect(leak ?? []).toEqual([])
  })

  it('S11 — GRANT : un agent authentifié NE PEUT PAS appeler calculate (service_role only)', async () => {
    const { error } = await setup.clientA.rpc('calculate_contact_scores', { p_agency: setup.agencyAId })
    expect(error).not.toBeNull()
  })

  it('S12 — audit : activity_events "contact_scores.recompute" (actor_kind=system) pour A', async () => {
    const { data } = await svc.from('activity_events')
      .select('action, actor_kind, entity_type, metadata, agency_id')
      .eq('agency_id', setup.agencyAId).eq('action', 'contact_scores.recompute')
      .order('created_at', { ascending: false }).limit(1)
    const ev = (data ?? [])[0] as Record<string, unknown> | undefined
    expect(ev, 'aucun activity_event de recompute').toBeTruthy()
    expect(ev!.actor_kind).toBe('system')
    expect(ev!.entity_type).toBe('contact_scores')
    expect(num((ev!.metadata as Record<string, unknown>).count)).toBeGreaterThan(0)
  })

  it('S13 — get_contact_score_config : un agent lit le barème (poids/seuils/quality_map)', async () => {
    const { data, error } = await setup.clientA.rpc('get_contact_score_config', {})
    expect(error).toBeNull()
    const cfg = data as { weights?: Record<string, number>; thresholds?: Record<string, number>; quality_map?: Record<string, number> }
    expect(typeof cfg.weights?.quality).toBe('number')
    expect(typeof cfg.thresholds?.label_serieux).toBe('number')
    expect(typeof cfg.quality_map?.hot).toBe('number')
  })

  it('S14 — anti-biais EN FILE : le cold (3 matches raw≤95) est CAPPÉ à 2 et passe DERRIÈRE le hot (raw 75) — sans muter matches.score', async () => {
    const { data, error } = await setup.clientA.rpc('focus_top_matches', { p_limit: 30 })
    expect(error).toBeNull()
    const rows = (data ?? []) as FocusMatchRow[]
    const coldRows = rows.filter((r) => r.contact_id === cCold)
    const idxHot = rows.findIndex((r) => r.contact_id === cHot)
    expect(idxHot).toBeGreaterThanOrEqual(0)
    // (a) cap per_contact (2) : le contact à gros volume ne monopolise PAS la file
    expect(coldRows.length).toBe(2)
    expect(coldRows.map((r) => r.score).sort((a, b) => b - a)).toEqual([95, 90]) // les 2 meilleurs bruts
    // (b) le hot (lead 78, raw 75) passe DEVANT TOUTES les lignes du cold (lead 32, raw≤95) — biais cassé
    for (const cr of coldRows) expect(idxHot).toBeLessThan(rows.indexOf(cr))
    // (c) colonne score = BRUT préservé ; lead_score = score de contact
    expect(rows[idxHot].score).toBe(75)
    expect(num(rows[idxHot].lead_score)).toBe(78)
    expect(coldRows.every((r) => num(r.lead_score) === 32)).toBe(true)
    // lead_score NULL si le contact n'est pas scoré (seller, hors v1) — la ligne reste dans la file
    const rSeller = rows.find((r) => r.contact_id === cSeller)
    expect(rSeller, 'le match du seller doit rester dans la file').toBeTruthy()
    expect(rSeller!.lead_score).toBeNull()
    // matches.score en base INCHANGÉ (le blend ne vit que dans l'ORDER BY)
    const { data: raw } = await svc.from('matches').select('score').eq('contact_id', cCold).order('score', { ascending: false })
    expect((raw ?? []).map((m: Record<string, unknown>) => num(m.score))).toEqual([95, 90, 85])
  })
})
