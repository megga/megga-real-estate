// Backend test (live CI) — Algo Focus : RPC focus_top_matches
// (migration 20260616120000_today_focus.sql).
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : les tests s'exécutent contre un Supabase
// local seedé, ils doivent réellement passer. CI = base locale (jamais la prod) ;
// les chiffres prod (1 contact = 94% des matches) justifient l'invariant cap,
// ils ne servent pas de fixture.
//
// Couvre :
//   - Isolation anti-IDOR (agence du JWT) : A ne voit jamais B et vice-versa.
//   - Filtres durs : status='suggested', response_at NULL, non snoozé, score >= gate.
//   - Cap 2 matches/contact (dé-duplication SQL), ordre score DESC + p_limit.
//   - Distinction kind internal (bien propre) vs market (Flatfox).
//   - Lecture LIVE du tunable app_config.today_focus_v1 (match_gate).
//   - reasons_match_count / reason_keys dérivés du jsonb reasons.
//   - Garde JWT sans agence → [] (aucune fuite).
//   - Coexistence des 3 sources pour une agence (le RPC reste cantonné aux matches).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const PASSWORD = 'Test-Password-123!'

interface FocusMatchRow {
  match_id: string
  contact_id: string
  contact_name: string | null
  kind: 'internal' | 'market'
  score: number
  reasons_match_count: number
  reason_keys: string[] | null
  property_title: string | null
  property_price: number | null
  property_photo: string | null
  city: string | null
  kyc_risk_high: boolean
  kyc_days_to_expiry: number | null
}

describe.skipIf(!HAS_KEYS)('focus_top_matches — RPC matches Focus (live + isolation)', () => {
  let setup: TwoAgenciesSetup
  let svc: SupabaseClient

  const contactIds: string[] = []
  const propIds: string[] = []
  const mlIds: string[] = []
  const reminderIds: string[] = []

  // ids notables pour les assertions
  let cBig = ''
  let cInt = ''
  let cMkt = ''
  let cB = ''

  // Annonce marché distincte (uq_matches_contact_market = (contact_id,
  // market_listing_id) WHERE market_listing_id IS NOT NULL → 1 listing par
  // (contact, market match) ; cBig a besoin de 5 listings distincts).
  const mkMl = async (tag: string): Promise<string> => {
    const { data, error } = await svc.from('market_listings').insert({
      source_id: `focus-qa-${tag}-${setup.stamp}`, source_portal: 'flatfox', title: `Focus QA market ${tag} ${setup.stamp}`,
      city: 'Genève', canton: 'GE', type: 'apartment', transaction_type: 'buy',
      price: 1_100_000, current_price: 1_100_000, status: 'active', quality_score: 70,
      photos: ['https://example.test/ml.jpg'],
    }).select('id').single()
    if (error) throw new Error(`market_listing ${tag}: ${error.message}`)
    mlIds.push(data.id)
    return data.id
  }

  const mkContact = async (agencyId: string, last: string): Promise<string> => {
    const { data, error } = await svc.from('contacts').insert({
      agency_id: agencyId, first_name: 'Focus', last_name: `${last}-${setup.stamp}`,
      email: `focus-${last}-${Math.random()}@megga-test.local`, type: 'buyer',
    }).select('id').single()
    if (error) throw new Error(`contact ${last}: ${error.message}`)
    contactIds.push(data.id)
    return data.id
  }

  const mkMatch = async (opts: {
    agencyId: string; contactId: string; score: number; source: 'internal' | 'market'
    propertyId?: string | null; marketListingId?: string | null
    status?: string; responseAt?: string | null; snoozedUntil?: string | null
    reasons?: Record<string, { match: boolean }>
  }): Promise<void> => {
    const { error } = await svc.from('matches').insert({
      agency_id: opts.agencyId,
      contact_id: opts.contactId,
      score: opts.score,
      source: opts.source,
      status: opts.status ?? 'suggested',
      property_id: opts.propertyId ?? null,
      market_listing_id: opts.marketListingId ?? null,
      response_at: opts.responseAt ?? null,
      snoozed_until: opts.snoozedUntil ?? null,
      reasons: opts.reasons ?? { budget: { match: true }, zone: { match: true }, type: { match: false } },
    })
    if (error) throw new Error(`match: ${error.message}`)
  }

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    svc = serviceRoleClient()

    // Bien interne (agence A) — pour kind='internal'.
    const { data: prop, error: pErr } = await svc.from('properties').insert({
      agency_id: setup.agencyAId, title: `Focus QA bien ${setup.stamp}`,
      type: 'apartment', status: 'draft', price: 1_200_000, rooms: 4, surface_m2: 100,
      city: 'Genève', canton: 'GE', photos: ['https://example.test/prop.jpg'],
    }).select('id').single()
    if (pErr) throw new Error(`property: ${pErr.message}`)
    propIds.push(prop.id)

    // Annonce marché partagée (pour les contacts à 1 match) + 5 distinctes pour cBig.
    const mlShared = await mkMl('shared')
    const mlBig: string[] = []
    for (let i = 0; i < 5; i++) mlBig.push(await mkMl(`big${i}`))

    cBig = await mkContact(setup.agencyAId, 'Big')
    cInt = await mkContact(setup.agencyAId, 'Int')
    cMkt = await mkContact(setup.agencyAId, 'Mkt')
    const cResp = await mkContact(setup.agencyAId, 'Resp')
    const cSno = await mkContact(setup.agencyAId, 'Snooze')
    const cLow = await mkContact(setup.agencyAId, 'Low')
    const cSent = await mkContact(setup.agencyAId, 'Sent')
    cB = await mkContact(setup.agencyBId, 'AgencyB')

    // cBig : 5 matches éligibles (>=70) sur 5 listings distincts (contrainte
    // uq_matches_contact_market) → le RPC doit en renvoyer 2 (cap/contact).
    const bigScores = [95, 88, 82, 76, 71]
    for (let i = 0; i < bigScores.length; i++) {
      await mkMatch({ agencyId: setup.agencyAId, contactId: cBig, score: bigScores[i], source: 'market', marketListingId: mlBig[i] })
    }
    // cInt : 1 internal (bien propre) score 90, reasons → count 2 (budget, zone).
    await mkMatch({ agencyId: setup.agencyAId, contactId: cInt, score: 90, source: 'internal', propertyId: prop.id })
    // cMkt : 1 market score 85 (listing partagé — contacts distincts, contrainte OK).
    await mkMatch({ agencyId: setup.agencyAId, contactId: cMkt, score: 85, source: 'market', marketListingId: mlShared })
    // exclus : répondu / snoozé / sous le gate / status non-suggested.
    await mkMatch({ agencyId: setup.agencyAId, contactId: cResp, score: 99, source: 'market', marketListingId: mlShared, responseAt: new Date().toISOString() })
    await mkMatch({ agencyId: setup.agencyAId, contactId: cSno, score: 99, source: 'market', marketListingId: mlShared, snoozedUntil: new Date(Date.now() + 86_400_000).toISOString() })
    await mkMatch({ agencyId: setup.agencyAId, contactId: cLow, score: 65, source: 'market', marketListingId: mlShared })
    await mkMatch({ agencyId: setup.agencyAId, contactId: cSent, score: 96, source: 'market', marketListingId: mlShared, status: 'sent' })
    // Agence B : 1 match score 100 — jamais visible par A.
    await mkMatch({ agencyId: setup.agencyBId, contactId: cB, score: 100, source: 'market', marketListingId: mlShared })
  })

  afterAll(async () => {
    if (!svc) return
    if (contactIds.length) await svc.from('matches').delete().in('contact_id', contactIds)
    if (reminderIds.length) await svc.from('reminders').delete().in('id', reminderIds)
    if (propIds.length) await svc.from('transactions').delete().in('property_id', propIds)
    if (propIds.length) await svc.from('properties').delete().in('id', propIds)
    if (mlIds.length) await svc.from('market_listings').delete().in('id', mlIds)
    if (contactIds.length) await svc.from('contacts').delete().in('id', contactIds)
    await setup.cleanup()
  })

  const callA = async (limit?: number): Promise<FocusMatchRow[]> => {
    const { data, error } = await setup.clientA.rpc('focus_top_matches', limit != null ? { p_limit: limit } : {})
    expect(error).toBeNull()
    return (data ?? []) as FocusMatchRow[]
  }

  it('L1 — isolation anti-IDOR : A ne voit jamais l\'agence B', async () => {
    const rows = await callA()
    expect(rows.some((r) => r.contact_id === cB)).toBe(false)
    // tous les contacts vus appartiennent au seed de A
    expect(rows.every((r) => contactIds.includes(r.contact_id))).toBe(true)
    expect(rows.some((r) => r.score === 100)).toBe(false) // le 100 est à B
  })

  it('L1b — isolation : B ne voit que ses propres matches (pas ceux de A)', async () => {
    const { data, error } = await setup.clientB.rpc('focus_top_matches', {})
    expect(error).toBeNull()
    const rows = (data ?? []) as FocusMatchRow[]
    expect(rows.every((r) => r.contact_id === cB)).toBe(true)
    expect(rows).toHaveLength(1)
  })

  it('L2/L3/L4/L8 — filtres durs : status/response_at/snooze/gate excluent les bons matches', async () => {
    const rows = await callA()
    const ids = new Set(rows.map((r) => r.contact_id))
    // cResp (répondu), cSno (snoozé), cLow (<gate), cSent (status 'sent') absents.
    // On vérifie via leur score signature absente.
    expect(rows.some((r) => r.score === 96)).toBe(false) // cSent (status != 'suggested')
    expect(rows.some((r) => r.score === 65)).toBe(false) // cLow sous le gate
    // cResp & cSno avaient 99 : aucun 99 ne doit apparaître.
    expect(rows.some((r) => r.score === 99)).toBe(false)
    expect(ids.size).toBeGreaterThan(0)
  })

  it('L5 — cap 2/contact : cBig (5 matches) → exactement 2, les meilleurs scores', async () => {
    const rows = await callA()
    const big = rows.filter((r) => r.contact_id === cBig)
    expect(big).toHaveLength(2)
    expect(big.map((r) => r.score).sort((a, b) => b - a)).toEqual([95, 88])
  })

  it('L6 — kind internal : cInt résout le bien propre (properties)', async () => {
    const rows = await callA()
    const r = rows.find((x) => x.contact_id === cInt)
    expect(r).toBeDefined()
    expect(r!.kind).toBe('internal')
    expect(r!.property_title).toContain('Focus QA bien')
    expect(r!.property_price).toBe(1_200_000)
  })

  it('L7 — kind market : cMkt résout l\'annonce marché (market_listings)', async () => {
    const rows = await callA()
    const r = rows.find((x) => x.contact_id === cMkt)
    expect(r).toBeDefined()
    expect(r!.kind).toBe('market')
    expect(r!.property_title).toContain('Focus QA market')
  })

  it('L8b — lecture LIVE du tunable : monter match_gate à 90 fait disparaître cMkt(85)', async () => {
    const { data: cfgRow } = await svc.from('app_config').select('value').eq('key', 'today_focus_v1').single()
    const original = (cfgRow as { value: string }).value
    const bumped = JSON.parse(original)
    bumped.thresholds.match_gate = 90
    await svc.from('app_config').update({ value: JSON.stringify(bumped) }).eq('key', 'today_focus_v1')
    try {
      const rows = await callA()
      expect(rows.some((r) => r.contact_id === cMkt)).toBe(false) // 85 < 90
      expect(rows.some((r) => r.score === 90)).toBe(true) // cInt(90) reste
    } finally {
      await svc.from('app_config').update({ value: original }).eq('key', 'today_focus_v1')
    }
  })

  it('L9 — ordre score DESC + p_limit borné', async () => {
    const rows = await callA(2)
    expect(rows.length).toBeLessThanOrEqual(2)
    const scores = rows.map((r) => r.score)
    expect([...scores].sort((a, b) => b - a)).toEqual(scores)
  })

  it('L10 — label : contact_name = « Prénom Nom » (jamais un UUID brut)', async () => {
    const rows = await callA()
    const r = rows.find((x) => x.contact_id === cInt)!
    expect(r.contact_name).toMatch(/^Focus Int-/)
    expect(r.contact_name).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i)
  })

  it('L11 — reasons : count + clés dérivés du jsonb (budget+zone match, type non)', async () => {
    const rows = await callA()
    const r = rows.find((x) => x.contact_id === cInt)!
    expect(r.reasons_match_count).toBe(2)
    expect((r.reason_keys ?? []).sort()).toEqual(['budget', 'zone'])
  })

  it('L12 — JWT sans agence : garde → [] (aucune fuite, aucune erreur)', async () => {
    const email = `no-agency-${setup.stamp}@megga-test.local`
    const { data: u, error: uErr } = await svc.auth.admin.createUser({
      email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: 'No Agency' },
    })
    if (uErr) throw new Error(`user: ${uErr.message}`)
    const client = createClient(URL, process.env.SUPABASE_TEST_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
    try {
      const { error: sErr } = await client.auth.signInWithPassword({ email, password: PASSWORD })
      expect(sErr).toBeNull()
      const { data, error } = await client.rpc('focus_top_matches', {})
      expect(error).toBeNull()
      expect(data ?? []).toEqual([])
    } finally {
      await svc.auth.admin.deleteUser(u.user!.id).catch(() => {})
    }
  })

  it('L13 — coexistence des 3 sources : un reminder + une transaction pour A ne polluent pas le RPC matches', async () => {
    const { data: rem } = await svc.from('reminders').insert({
      agency_id: setup.agencyAId, contact_id: cInt, type: 'custom', status: 'pending',
      trigger_at: new Date(Date.now() + 3_600_000).toISOString(), trigger_rule: 'manual',
    }).select('id').single()
    if (rem) reminderIds.push(rem.id)
    await svc.from('transactions').insert({
      agency_id: setup.agencyAId, property_id: propIds[0], stage: 'offer', assigned_to: setup.agentAId, contact_buyer_id: cInt,
    })
    const rows = await callA()
    // le RPC reste cantonné aux matches : cBig(2) + cInt(1) + cMkt(1) = 4.
    expect(rows).toHaveLength(4)
    expect(rows.every((r) => typeof r.score === 'number')).toBe(true)
  })
})
