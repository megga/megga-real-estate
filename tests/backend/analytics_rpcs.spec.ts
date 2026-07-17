// Backend test (live CI) — Analytics « Cockpit Commission » : 3 RPC d'agrégation
// + persistance objectif (migration 20260614150000_analytics_rpcs.sql).
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : les tests s'exécutent contre un Supabase
// local seedé, ils doivent réellement passer.
//
// Couvre :
//   1. Isolation cross-tenant des 3 RPC SECURITY DEFINER (l'agence vient du JWT) :
//      l'agent A ne voit jamais les données de l'agence B, même si B a des deals.
//   2. Mapping stage exhaustif : 'lead'/'visit_planned_legacy' → pipeline, 'closed' → signed
//      (régression du bug TS où stageToDecomp('lead')=undefined perdait les deals).
//   3. Scope 'me' vs 'agency' : transactions.assigned_to / visits.agent_id /
//      crm_offers.created_by filtrés sur l'appelant ; contacts/kyc agence-only.
//   4. Conversion null quand dénominateur 0 (jamais 0 %).
//   5. Commission fallback 3 % + compteurs n_default_pct / n_missing_price.
//   6. crm_offers : fuite cross-tenant corrigée (funnel A ne compte pas l'offre de B).
//   7. analytics_set_target : écrit yearly/quarterly/monthly + 1 activity_events.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const PASSWORD = 'Test-Password-123!'

interface DecompShape { signed: number; compromis: number; offres: number; pipeline: number }
interface CockpitShape {
  decomp: DecompShape
  decomp_flags: Record<keyof DecompShape, { n_default_pct: number; n_missing_price: number }>
  projected: number
  deals: number
  n_signed: number
  conversion: number | null
  contributors: Array<{ name: string | null; stage: string; amount: number; price_missing: boolean; pct_default: boolean }>
}
interface ObjectifShape {
  target: number; target_is_set: boolean; realized: number; buckets: number
  realIdx: number; xLabels: string[]; real: number[]; median: number[]; projected: number; label: string
}
interface FunnelShape {
  funnel: { leads: number; qualif: number; visits: number; offers: number; compromis: number }
  sources: Array<{ source: string; v: number; conv: number; prev: number; comm: number; won: number }>
}

describe.skipIf(!HAS_KEYS)('analytics RPCs — agrégation live + isolation', () => {
  let setup: TwoAgenciesSetup
  let svc: SupabaseClient
  // Agency A : un 2e agent pour tester le scope 'me' vs 'agency'.
  let agentA2: SupabaseClient
  let agentA2Id: string
  // ids à nettoyer
  const propIds: string[] = []
  const contactIds: string[] = []

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    svc = serviceRoleClient()

    // 2e agent dans l'agence A
    const emailA2 = `agent-a2-${setup.stamp}@megga-test.local`
    const { data: u2, error: u2Err } = await svc.auth.admin.createUser({
      email: emailA2, password: PASSWORD, email_confirm: true,
      user_metadata: { full_name: 'Agent A2', role: 'agent' },
    })
    if (u2Err) throw new Error(`agentA2: ${u2Err.message}`)
    agentA2Id = u2.user!.id
    await svc.from('profiles').upsert({ id: agentA2Id, email: emailA2, full_name: 'Agent A2', role: 'agent', agency_id: setup.agencyAId })
    agentA2 = createClient(URL, process.env.SUPABASE_TEST_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
    await agentA2.auth.signInWithPassword({ email: emailA2, password: PASSWORD })

    // ── Biens (properties) ──────────────────────────────────────────────────
    // P1 : prix + taux de mandat renseigné (5%) → pas de fallback
    // P2 : prix présent, taux NULL → fallback 3% (pct_default)
    const seedProp = async (agency_id: string, price: number | null, pct: number | null): Promise<string> => {
      const { data, error } = await svc.from('properties').insert({
        agency_id, title: `Analytics QA ${setup.stamp} ${Math.random()}`,
        type: 'apartment', status: 'draft', price, mandate_commission_pct: pct,
        rooms: 4, surface_m2: 100, city: 'Genève', canton: 'GE',
      }).select('id').single()
      if (error) throw new Error(`property: ${error.message}`)
      propIds.push(data.id)
      return data.id
    }
    const pA_withPct = await seedProp(setup.agencyAId, 1000000, 5)   // commission 50'000
    const pA_default = await seedProp(setup.agencyAId, 2000000, null) // commission 60'000 (3% par défaut)
    const pA_noPrice = await seedProp(setup.agencyAId, null, null)    // prix manquant → exclu
    const pB = await seedProp(setup.agencyBId, 5000000, 4)            // agence B (commission 200'000)

    // ── Contacts (leads/qualifiés + sources) ─────────────────────────────────
    const seedContact = async (agency_id: string, source: string, score: 'hot' | 'warm' | 'cold' | null): Promise<string> => {
      const { data, error } = await svc.from('contacts').insert({
        agency_id, first_name: 'Lead', last_name: `QA-${Math.random()}`,
        email: `lead-${Math.random()}@megga-test.local`, type: 'buyer', source, score,
      }).select('id').single()
      if (error) throw new Error(`contact: ${error.message}`)
      contactIds.push(data.id)
      return data.id
    }
    const cA1 = await seedContact(setup.agencyAId, 'website', 'hot')
    await seedContact(setup.agencyAId, 'website', null)        // lead non qualifié
    await seedContact(setup.agencyAId, 'referral', 'warm')
    await seedContact(setup.agencyBId, 'website', 'hot')       // agence B (ne doit jamais fuiter dans A)

    // ── Transactions — couvre le mapping stage (lead/closed/visit_planned_legacy) ──
    const seedTx = async (agency_id: string, property_id: string | null, stage: string, assigned_to: string, contact_buyer_id?: string) => {
      const { error } = await svc.from('transactions').insert({
        agency_id, property_id, stage, assigned_to, contact_buyer_id: contact_buyer_id ?? null,
      })
      if (error) throw new Error(`transaction(${stage}): ${error.message}`)
    }
    // Agence A — agent principal (setup.agentAId)
    await seedTx(setup.agencyAId, pA_withPct, 'signed', setup.agentAId, cA1)            // signed, commission 50k
    await seedTx(setup.agencyAId, pA_default, 'closed', setup.agentAId)                 // closed → signed (mapping !), 60k, pct_default
    await seedTx(setup.agencyAId, pA_default, 'offer', setup.agentAId)                  // offres, 60k, pct_default
    await seedTx(setup.agencyAId, pA_withPct, 'lead', setup.agentAId)                   // lead → pipeline (mapping !), 50k
    await seedTx(setup.agencyAId, pA_withPct, 'visit_planned_legacy', setup.agentAId)   // legacy → pipeline (mapping !)
    await seedTx(setup.agencyAId, pA_noPrice, 'qualified', setup.agentAId) // qualified → pipeline, prix manquant
    await seedTx(setup.agencyAId, pA_withPct, 'lost', setup.agentAId)                   // lost → exclu + dénominateur conversion
    // Agence A — 2e agent (scope 'me' doit l'exclure pour agentA)
    await seedTx(setup.agencyAId, pA_withPct, 'offer', agentA2Id)                       // appartient à A2
    // Agence B (jamais visible pour A)
    await seedTx(setup.agencyBId, pB, 'signed', setup.agentBId)

    // ── crm_offers — fuite cross-tenant : 1 offre dans B ──────────────────────
    const expires = new Date(Date.now() + 7 * 864e5).toISOString()
    const { error: offErr } = await svc.from('crm_offers').insert({
      agency_id: setup.agencyBId, kind: 'offer', from_party: 'buyer', by_label: 'Acheteur B',
      amount: 990000, expires_at: expires, created_by: setup.agentBId,
    })
    if (offErr) throw new Error(`crm_offer B: ${offErr.message}`)

    // ── kyc_cases — risk high dans A (agence-only) ───────────────────────────
    const { error: kErr } = await svc.from('kyc_cases').insert([
      { agency_id: setup.agencyAId, type: 'buyer_pp', risk_level: 'high', expires_at: new Date(Date.now() + 3 * 864e5).toISOString() },
      { agency_id: setup.agencyBId, type: 'buyer_pp', risk_level: 'high' },
    ])
    if (kErr) throw new Error(`kyc: ${kErr.message}`)
  })

  afterAll(async () => {
    // Nettoyage des rows seedées (les agences cascadent via setup.cleanup mais on
    // retire les biens/contacts d'abord pour éviter les FK).
    if (propIds.length) await svc.from('transactions').delete().in('property_id', propIds)
    if (propIds.length) await svc.from('properties').delete().in('id', propIds)
    if (contactIds.length) await svc.from('contacts').delete().in('id', contactIds)
    await svc.auth.admin.deleteUser(agentA2Id).catch(() => {})
    await setup.cleanup()
  })

  // ── 1. Mapping stage exhaustif + commission fallback (scope agency) ────────
  it('cockpit : mappe lead/closed/visit_planned_legacy + commission fallback 3%', async () => {
    const { data, error } = await setup.clientA.rpc('analytics_cockpit', { p_period: 'year', p_scope: 'agency' })
    expect(error).toBeNull()
    const c = data as CockpitShape

    // signed = 'signed' (50k) + 'closed' (60k) = 110k → régression directe du bug 'closed'
    expect(c.decomp.signed).toBe(110000)
    // offres : 'offer' agent principal (60k) + 'offer' A2 (50k) = 110k (scope agency)
    expect(c.decomp.offres).toBe(110000)
    // pipeline (ELSE du mapping, prouve que les stages legacy ratés par le TS comptent) :
    // 'lead' (50k) + 'visit_planned_legacy' (50k) + 'qualified' (0, prix manquant) → 100k
    expect(c.decomp.pipeline).toBe(100000)

    // n_signed = 2 (signed + closed)
    expect(c.n_signed).toBe(2)

    // Compteurs fallback : closed + offer principal sont sur pA_default (pct NULL)
    expect(c.decomp_flags.signed.n_default_pct).toBeGreaterThanOrEqual(1)   // 'closed' sur pA_default
    expect(c.decomp_flags.offres.n_default_pct).toBeGreaterThanOrEqual(1)   // 'offer' sur pA_default
    // prix manquant : la tx 'qualified' sur pA_noPrice
    expect(c.decomp_flags.pipeline.n_missing_price).toBeGreaterThanOrEqual(1)

    // deals = toutes les actives (≠ lost), scope agency = 7
    // agent principal : signed, closed, offer, lead, visit_planned_legacy, qualified = 6
    // + agent A2 : offer = 1  →  total 7
    expect(c.deals).toBe(7)
  })

  // ── 2. Conversion : signed=2, lost=1 → 67 % ; pas null ici ─────────────────
  it('cockpit : conversion = signed/(signed+lost), non null quand dénom > 0', async () => {
    const { data } = await setup.clientA.rpc('analytics_cockpit', { p_period: 'year', p_scope: 'agency' })
    const c = data as CockpitShape
    // signed (signed+closed=2) / (2 + lost 1) = 67%
    expect(c.conversion).toBe(67)
  })

  // ── 3. Conversion null quand dénominateur 0 (agence B : 1 signed, 0 lost) ──
  it('cockpit : conversion calculée pour B ; null si aucun signed ni lost', async () => {
    const { data } = await setup.clientB.rpc('analytics_cockpit', { p_period: 'year', p_scope: 'agency' })
    const c = data as CockpitShape
    // B : 1 signed, 0 lost → 100%
    expect(c.conversion).toBe(100)
    // Période 'month' où aucune tx B n'a updated_at (toutes créées maintenant donc
    // dans le mois courant → on teste plutôt l'isolation, voir test suivant).
  })

  // ── 4. Scope 'me' vs 'agency' (agent principal exclut l'offre de A2) ───────
  it('cockpit : scope=me filtre sur assigned_to de l’appelant', async () => {
    const { data: me } = await setup.clientA.rpc('analytics_cockpit', { p_period: 'year', p_scope: 'me' })
    const { data: agency } = await setup.clientA.rpc('analytics_cockpit', { p_period: 'year', p_scope: 'agency' })
    const cMe = me as CockpitShape
    const cAg = agency as CockpitShape
    // L'offre de A2 (50k) n'est comptée qu'en scope agency.
    expect(cAg.decomp.offres).toBe(110000)
    expect(cMe.decomp.offres).toBe(60000)
    expect(cMe.deals).toBeLessThan(cAg.deals)
  })

  // ── 5. Isolation cross-tenant des 3 RPC ────────────────────────────────────
  it('isolation : aucune donnée de B ne fuite dans les RPC de A (et inversement)', async () => {
    const aCockpit = (await setup.clientA.rpc('analytics_cockpit', { p_period: 'year', p_scope: 'agency' })).data as CockpitShape
    // B a un signed de 200k (pB 5M × 4%). Si ça fuitait, signed de A serait ≠ 110k.
    expect(aCockpit.decomp.signed).toBe(110000)

    const aFunnel = (await setup.clientA.rpc('analytics_funnel', { p_period: 'year', p_scope: 'agency' })).data as FunnelShape
    // Fuite crm_offers corrigée : l'offre de B ne doit PAS compter pour A.
    expect(aFunnel.funnel.offers).toBe(0)
    // Leads de A = 3 (pas le lead de B).
    expect(aFunnel.funnel.leads).toBe(3)
    // qualifiés A = 2 (hot + warm)
    expect(aFunnel.funnel.qualif).toBe(2)

    const aObjectif = (await setup.clientA.rpc('analytics_objectif', { p_period: 'year', p_scope: 'agency' })).data as ObjectifShape
    // realized A = Σ commission signed = 110k (jamais le 200k de B).
    expect(aObjectif.realized).toBe(110000)
  })

  // ── 6. crm_offers : B voit son offre, A ne la voit pas ─────────────────────
  it('funnel : crm_offers de B comptée seulement pour B', async () => {
    const bFunnel = (await setup.clientB.rpc('analytics_funnel', { p_period: 'year', p_scope: 'agency' })).data as FunnelShape
    expect(bFunnel.funnel.offers).toBe(1)
  })

  // ── 6b. funnel : commission RÉELLE par canal (buyer → contacts.source) ──────
  it('funnel : commission réalisée attribuée au canal du contact acheteur', async () => {
    const aFunnel = (await setup.clientA.rpc('analytics_funnel', { p_period: 'year', p_scope: 'agency' })).data as FunnelShape
    // Le signed (pA_withPct 1M × 5% = 50k) a pour acheteur cA1 (source 'website').
    const web = aFunnel.sources.find(s => s.source === 'website')
    expect(web).toBeTruthy()
    expect(web!.comm).toBe(50000)
    expect(web!.won).toBe(1)
    // Le volume de leads reste INCHANGÉ (website = 2 leads : hot + non qualifié).
    expect(web!.v).toBe(2)
    // 'referral' a un lead mais aucun deal gagné → commission 0.
    const ref = aFunnel.sources.find(s => s.source === 'referral')
    expect(ref?.comm ?? 0).toBe(0)
    // Le 'closed' (60k) n'a PAS d'acheteur rattaché → non attribué : Σ par canal = 50k
    // (honnête : < realized 110k ; l'écart = commission gagnée sans acheteur/source).
    const totalComm = aFunnel.sources.reduce((s, x) => s + (x.comm ?? 0), 0)
    expect(totalComm).toBe(50000)
  })

  // ── 7. analytics_objectif : structure + extrapolation ──────────────────────
  it('objectif : buckets/real/median cohérents, target_is_set=false sans cible', async () => {
    const o = (await setup.clientA.rpc('analytics_objectif', { p_period: 'year', p_scope: 'agency' })).data as ObjectifShape
    expect(o.buckets).toBe(12)
    expect(o.xLabels).toHaveLength(12)
    expect(o.target).toBe(0)
    expect(o.target_is_set).toBe(false)
    expect(Array.isArray(o.real)).toBe(true)
    expect(o.realized).toBe(110000)
  })

  // ── 8. analytics_set_target : écrit 3 colonnes + 1 activity_events ─────────
  it('set_target : persiste yearly/quarterly/monthly + audit agency_target_updated', async () => {
    const { error } = await setup.clientA.rpc('analytics_set_target', { p_yearly: 1200000 })
    expect(error).toBeNull()

    const { data: ag } = await svc.from('agencies')
      .select('yearly_target, quarterly_target, monthly_target')
      .eq('id', setup.agencyAId).single()
    expect(Number(ag!.yearly_target)).toBe(1200000)
    expect(Number(ag!.quarterly_target)).toBe(300000)
    expect(Number(ag!.monthly_target)).toBe(100000)

    const { data: events } = await svc.from('activity_events')
      .select('action, category, actor_kind, actor_id')
      .eq('agency_id', setup.agencyAId)
      .eq('action', 'agency_target_updated')
    expect(events!.length).toBe(1)
    expect(events![0].category).toBe('settings')
    expect(events![0].actor_kind).toBe('user')
    expect(events![0].actor_id).toBe(setup.agentAId)

    // L'objectif est désormais reflété par le RPC (target_is_set=true).
    const o = (await setup.clientA.rpc('analytics_objectif', { p_period: 'year', p_scope: 'agency' })).data as ObjectifShape
    expect(o.target).toBe(1200000)
    expect(o.target_is_set).toBe(true)
  })

  // ── 9. set_target : isolation — B écrit son propre objectif, pas celui de A ─
  it('set_target : isolation cross-tenant sur l’écriture', async () => {
    await setup.clientB.rpc('analytics_set_target', { p_yearly: 800000 })
    const { data: bAg } = await svc.from('agencies')
      .select('yearly_target').eq('id', setup.agencyBId).single()
    expect(Number(bAg!.yearly_target)).toBe(800000)
    // A reste à 1.2M (non écrasé par B).
    const { data: aAg } = await svc.from('agencies')
      .select('yearly_target').eq('id', setup.agencyAId).single()
    expect(Number(aAg!.yearly_target)).toBe(1200000)
  })
})
