// Backend test (live CI) — Contact NBA v1 : RPC contact_next_action (coeur) +
// get_contact_next_action (wrapper JWT) + trigger touch_transactions_updated_at
// (migration 20260710200000_contact_nba_v1.sql).
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : tourne contre un Supabase local seedé.
// Couvre la spec §9.2 (N1-N22) : priorité absolue, gates/exclusions matches,
// dormance (never/dated, 7 types), débrief + fenêtre 21 j, deal stagnant + proxy
// vivant (trigger touch), offre via transaction_id + fenêtre, kyc_note jamais
// l'action, isolation agence ET par-contact, permissions (coeur service-role only,
// wrapper happy-path ≡ coeur), tunable live.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? ''

interface Nba {
  action: string
  reason_key: string
  params: Record<string, unknown>
  due_at: string | null
  kyc_note: Record<string, unknown> | null
  version: number
}

const DAY = 86_400_000
const iso = (deltaMs: number): string => new Date(Date.now() + deltaMs).toISOString()

describe.skipIf(!HAS_KEYS)('contact_next_action — NBA v1 (live + isolation)', () => {
  let setup: TwoAgenciesSetup
  let svc: SupabaseClient
  let propId = ''
  const contactIds: string[] = []
  let nbaCfgBefore: { had: boolean; value: string } = { had: false, value: '' }

  const core = async (contact: string, agency: string): Promise<Nba | null> => {
    const { data, error } = await svc.rpc('contact_next_action', { p_contact: contact, p_agency: agency })
    if (error) throw new Error(`core: ${error.message}`)
    return data as Nba | null
  }

  const mkContact = async (opts: {
    type?: string | null
    lastInteraction?: string | null
  } = {}): Promise<string> => {
    const { data, error } = await svc.from('contacts').insert({
      agency_id: setup.agencyAId,
      first_name: 'NBA', last_name: `QA-${contactIds.length}-${setup.stamp}`,
      type: opts.type === undefined ? 'buyer' : opts.type,
      last_interaction_at: opts.lastInteraction === undefined ? null : opts.lastInteraction,
    }).select('id').single()
    if (error) throw new Error(`contact: ${error.message}`)
    contactIds.push(data.id)
    return data.id
  }

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    svc = serviceRoleClient()

    // sauvegarde du tunable (restauré en afterAll)
    const { data: cfg } = await svc.from('app_config').select('value').eq('key', 'contact_nba_v1').maybeSingle()
    nbaCfgBefore = cfg ? { had: true, value: cfg.value as string } : { had: false, value: '' }

    // bien support (visites NOT NULL property_id + matches internal)
    const { data: prop, error: pErr } = await svc.from('properties').insert({
      agency_id: setup.agencyAId, title: `NBA QA bien ${setup.stamp}`,
      type: 'apartment', status: 'draft', price: 900_000, rooms: 4, surface_m2: 100,
      city: 'Genève', canton: 'GE', photos: ['https://example.test/p.jpg'],
    }).select('id').single()
    if (pErr) throw new Error(`property: ${pErr.message}`)
    propId = prop.id
  }, 60_000)

  afterAll(async () => {
    if (!svc) return
    if (contactIds.length) {
      await svc.from('matches').delete().in('contact_id', contactIds)
      await svc.from('reminders').delete().in('contact_id', contactIds)
      await svc.from('visits').delete().in('contact_id', contactIds)
      await svc.from('kyc_cases').delete().in('contact_id', contactIds)
      const { data: txs } = await svc.from('transactions').select('id').in('contact_buyer_id', contactIds)
      const txIds = (txs ?? []).map((t: { id: string }) => t.id)
      if (txIds.length) await svc.from('crm_offers').delete().in('transaction_id', txIds)
      await svc.from('transactions').delete().in('contact_buyer_id', contactIds)
      await svc.from('contacts').delete().in('id', contactIds)
    }
    if (propId) await svc.from('properties').delete().eq('id', propId)
    if (nbaCfgBefore.had) await svc.from('app_config').update({ value: nbaCfgBefore.value }).eq('key', 'contact_nba_v1')
    await setup.cleanup()
  }, 60_000)

  // N4 — jamais recontacté → relance/never_contacted
  it('N4: contact jamais recontacté → relance / never_contacted', async () => {
    const c = await mkContact({ lastInteraction: null })
    const nba = await core(c, setup.agencyAId)
    expect(nba?.action).toBe('relance')
    expect(nba?.reason_key).toBe('never_contacted')
  })

  // N5 — dormance datée → relance/dormant
  it('N5: dormance 30 j → relance / dormant (days_dormant ≥ 14)', async () => {
    const c = await mkContact({ lastInteraction: iso(-30 * DAY) })
    const nba = await core(c, setup.agencyAId)
    expect(nba?.action).toBe('relance')
    expect(nba?.reason_key).toBe('dormant')
    expect(Number(nba?.params.days_dormant)).toBeGreaterThanOrEqual(14)
  })

  // N6 — rien → aucune
  it('N6: contact frais sans signal → aucune / none', async () => {
    const c = await mkContact({ lastInteraction: iso(-1 * DAY) })
    const nba = await core(c, setup.agencyAId)
    expect(nba?.action).toBe('aucune')
    expect(nba?.reason_key).toBe('none')
    expect(nba?.kyc_note).toBeNull()
  })

  // N22 — type investor couvert (whitelist 7 types)
  it('N22: contact investor jamais recontacté → relance', async () => {
    const c = await mkContact({ type: 'investor', lastInteraction: null })
    const nba = await core(c, setup.agencyAId)
    expect(nba?.action).toBe('relance')
  })

  // N1 + N21 — priorité absolue rappel > match ; départage plus ancien
  it('N1/N21: rappel échu prime sur matches ; le plus ancien trigger_at gagne', async () => {
    const c = await mkContact({ lastInteraction: iso(-1 * DAY) })
    const { error: mErr } = await svc.from('matches').insert({
      agency_id: setup.agencyAId, contact_id: c, score: 90, source: 'internal',
      status: 'suggested', property_id: propId,
      reasons: { budget: { match: true } },
    })
    if (mErr) throw new Error(`match: ${mErr.message}`)
    const mkRem = async (delta: number, type: string) => {
      const { error } = await svc.from('reminders').insert({
        agency_id: setup.agencyAId, contact_id: c, type, trigger_rule: 'nba_qa',
        status: 'triggered', trigger_at: iso(delta),
      })
      if (error) throw new Error(`reminder: ${error.message}`)
    }
    await mkRem(-2 * DAY, 'dormant_lead')      // le plus ancien → doit gagner
    await mkRem(-1 * DAY, 'missing_document')
    const nba = await core(c, setup.agencyAId)
    expect(nba?.action).toBe('rappel')
    expect(nba?.reason_key).toBe('reminder_overdue')
    expect(nba?.params.reminder_type).toBe('dormant_lead')
    expect(Number(nba?.params.days_overdue)).toBeGreaterThanOrEqual(2)
  })

  // N2/N3 — gates matches : sous le gate / response_at / snooze futur → exclus
  it('N2/N3: matches sous gate, répondus ou snoozés → pas match_a_envoyer', async () => {
    const c = await mkContact({ lastInteraction: iso(-1 * DAY) })
    const mk = async (over: Record<string, unknown>) => {
      const { error } = await svc.from('matches').insert({
        agency_id: setup.agencyAId, contact_id: c, source: 'internal',
        status: 'suggested', property_id: propId, reasons: {},
        ...over,
      })
      if (error) throw new Error(`match: ${error.message}`)
    }
    // ⚠ uq_matches_contact_property : UN SEUL match (contact, bien) à la fois →
    // on teste les 3 exclusions séquentiellement (delete entre chaque).
    await mk({ score: 60 })                                        // sous le gate 70
    const nba1 = await core(c, setup.agencyAId)
    expect(nba1?.action).toBe('aucune')
    await svc.from('matches').delete().eq('contact_id', c)
    await mk({ score: 90, response_at: iso(-1 * DAY) })            // répondu → exclu
    const nba2 = await core(c, setup.agencyAId)
    expect(nba2?.action).toBe('aucune')
    await svc.from('matches').delete().eq('contact_id', c)
    await mk({ score: 85, snoozed_until: iso(+2 * DAY) })          // snoozé (futur) → exclu
    const nba3 = await core(c, setup.agencyAId)
    expect(nba3?.action).toBe('aucune')
  })

  // R5 positif
  it('R5: match ≥ gate ouvert → match_a_envoyer avec count/best_score', async () => {
    const c = await mkContact({ lastInteraction: iso(-1 * DAY) })
    const { error } = await svc.from('matches').insert({
      agency_id: setup.agencyAId, contact_id: c, score: 88, source: 'internal',
      status: 'suggested', property_id: propId, reasons: {},
    })
    if (error) throw new Error(`match: ${error.message}`)
    const nba = await core(c, setup.agencyAId)
    expect(nba?.action).toBe('match_a_envoyer')
    expect(Number(nba?.params.count)).toBe(1)
    expect(Number(nba?.params.best_score)).toBe(88)
  })

  // N12 + N16 + N17 — visites
  it('N12: visite aujourd\'hui prime sur deal stagnant', async () => {
    const c = await mkContact({ lastInteraction: iso(-1 * DAY) })
    const { error: tErr } = await svc.from('transactions').insert({
      agency_id: setup.agencyAId, contact_buyer_id: c, property_id: propId,
      stage: 'offer', status: 'active', updated_at: iso(-30 * DAY),
    })
    if (tErr) throw new Error(`tx: ${tErr.message}`)
    const { error: vErr } = await svc.from('visits').insert({
      agency_id: setup.agencyAId, contact_id: c, property_id: propId,
      scheduled_at: iso(5 * 60_000), status: 'planned',
    })
    if (vErr) throw new Error(`visit: ${vErr.message}`)
    const nba = await core(c, setup.agencyAId)
    expect(nba?.action).toBe('visite_preparer')
    expect(nba?.reason_key).toBe('visit_today')
  })

  it('N16/N17: débrief dans la fenêtre 21 j, exclu au-delà', async () => {
    const cIn = await mkContact({ lastInteraction: iso(-1 * DAY) })
    const { error: v1 } = await svc.from('visits').insert({
      agency_id: setup.agencyAId, contact_id: cIn, property_id: propId,
      scheduled_at: iso(-3 * DAY), status: 'done', rapport: null, feedback_agent: null,
    })
    if (v1) throw new Error(`visit-in: ${v1.message}`)
    const nbaIn = await core(cIn, setup.agencyAId)
    expect(nbaIn?.action).toBe('visite_debrief')

    const cOut = await mkContact({ lastInteraction: iso(-1 * DAY) })
    const { error: v2 } = await svc.from('visits').insert({
      agency_id: setup.agencyAId, contact_id: cOut, property_id: propId,
      scheduled_at: iso(-30 * DAY), status: 'done', rapport: null, feedback_agent: null,
    })
    if (v2) throw new Error(`visit-out: ${v2.message}`)
    const nbaOut = await core(cOut, setup.agencyAId)
    expect(nbaOut?.action).toBe('aucune')
  })

  // N14 + N15 — deal stagnant + proxy vivant (trigger touch)
  it('N14/N15: deal immobile > 14 j → deal_stagnant ; bougé (UPDATE stage) → plus stagnant', async () => {
    const c = await mkContact({ lastInteraction: iso(-1 * DAY) })
    const { data: tx, error: tErr } = await svc.from('transactions').insert({
      agency_id: setup.agencyAId, contact_buyer_id: c, property_id: propId,
      stage: 'qualified', status: 'active', updated_at: iso(-30 * DAY),
    }).select('id').single()
    if (tErr) throw new Error(`tx: ${tErr.message}`)
    const nba1 = await core(c, setup.agencyAId)
    expect(nba1?.action).toBe('deal_stagnant')
    expect(Number(nba1?.params.days_stalled)).toBeGreaterThanOrEqual(14)
    // UPDATE → trigger touch_transactions_updated_at rafraîchit updated_at
    const { error: uErr } = await svc.from('transactions').update({ stage: 'visit_planned' }).eq('id', tx.id)
    if (uErr) throw new Error(`tx update: ${uErr.message}`)
    const nba2 = await core(c, setup.agencyAId)
    expect(nba2?.action).not.toBe('deal_stagnant')
  })

  // N13 + N20 — offre via transaction_id + fenêtre
  it('N13/N20: offre pending J+2 → offre_expirante ; J+30 → non', async () => {
    const c = await mkContact({ lastInteraction: iso(-1 * DAY) })
    const { data: tx, error: tErr } = await svc.from('transactions').insert({
      agency_id: setup.agencyAId, contact_buyer_id: c, property_id: propId,
      stage: 'offer', status: 'active',
    }).select('id').single()
    if (tErr) throw new Error(`tx: ${tErr.message}`)
    const mkOffer = async (expiresAt: string) => {
      const { data, error } = await svc.from('crm_offers').insert({
        agency_id: setup.agencyAId, transaction_id: tx.id, status: 'pending',
        kind: 'offer', from_party: 'buyer', by_label: 'NBA QA', amount: 850_000,
        expires_at: expiresAt,
      }).select('id').single()
      if (error) throw new Error(`offer: ${error.message}`)
      return data.id
    }
    const far = await mkOffer(iso(30 * DAY))
    const nbaFar = await core(c, setup.agencyAId)
    expect(nbaFar?.action).not.toBe('offre_expirante')   // N20 (le deal frais → pas stagnant non plus)
    await mkOffer(iso(2 * DAY))
    const nbaNear = await core(c, setup.agencyAId)
    expect(nbaNear?.action).toBe('offre_expirante')       // N13
    expect(Number(nbaNear?.params.amount)).toBe(850_000)
    await svc.from('crm_offers').delete().in('id', [far])
  })

  // N10 — kyc_note jamais l'action
  it('N10: KYC ouvert sur deal closing-proximate → kyc_note remplie, action ≠ kyc', async () => {
    const c = await mkContact({ lastInteraction: iso(-1 * DAY) })
    const { error: tErr } = await svc.from('transactions').insert({
      agency_id: setup.agencyAId, contact_buyer_id: c, property_id: propId,
      stage: 'offer', status: 'active',
    })
    if (tErr) throw new Error(`tx: ${tErr.message}`)
    const { error: kErr } = await svc.from('kyc_cases').insert({
      agency_id: setup.agencyAId, contact_id: c, type: 'buyer_pp', status: 'pending',
    })
    if (kErr) throw new Error(`kyc: ${kErr.message}`)
    const nba = await core(c, setup.agencyAId)
    expect(nba?.kyc_note).not.toBeNull()
    expect((nba?.kyc_note as Record<string, unknown>).status).toBe('pending')
    expect(['rappel', 'offre_expirante', 'visite_preparer', 'visite_debrief',
      'deal_stagnant', 'match_a_envoyer', 'relance', 'aucune']).toContain(nba?.action)
  })

  // N7 + N18 — isolations
  it('N7: coeur avec la mauvaise agence → null (pas de fuite d\'existence)', async () => {
    const c = await mkContact({})
    const nba = await core(c, setup.agencyBId)
    expect(nba).toBeNull()
  })

  it('N18: signaux d\'un AUTRE contact de la même agence → aucune pour p_contact', async () => {
    const cSignal = await mkContact({ lastInteraction: iso(-1 * DAY) })
    const cQuiet = await mkContact({ lastInteraction: iso(-1 * DAY) })
    const { error } = await svc.from('reminders').insert({
      agency_id: setup.agencyAId, contact_id: cSignal, type: 'dormant_lead',
      trigger_rule: 'nba_qa', status: 'triggered', trigger_at: iso(-1 * DAY),
    })
    if (error) throw new Error(`reminder: ${error.message}`)
    const nba = await core(cQuiet, setup.agencyAId)
    expect(nba?.action).toBe('aucune')
  })

  // N9 + N19 + N8 — permissions & dual-mode
  it('N9: authenticated ne peut PAS appeler le coeur (permission denied)', async () => {
    const c = await mkContact({})
    const { error } = await setup.clientA.rpc('contact_next_action', {
      p_contact: c, p_agency: setup.agencyAId,
    })
    expect(error).toBeTruthy()
  })

  it('N19: wrapper happy-path ≡ coeur (deux portes, une logique)', async () => {
    const c = await mkContact({ lastInteraction: null })
    const viaCore = await core(c, setup.agencyAId)
    const { data: viaWrapper, error } = await setup.clientA.rpc('get_contact_next_action', { p_contact: c })
    expect(error).toBeNull()
    const w = viaWrapper as Nba | null
    expect(w?.action).toBe(viaCore?.action)
    expect(w?.reason_key).toBe(viaCore?.reason_key)
  })

  it('N8: wrapper avec JWT sans agence → null', async () => {
    const email = `nba-orphan-${setup.stamp}@megga-test.local`
    const { data: u, error: uErr } = await svc.auth.admin.createUser({
      email, password: 'Test-Password-123!', email_confirm: true,
    })
    if (uErr) throw new Error(`orphan user: ${uErr.message}`)
    const orphan = createClient(URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error: sErr } = await orphan.auth.signInWithPassword({ email, password: 'Test-Password-123!' })
    if (sErr) throw new Error(`orphan signin: ${sErr.message}`)
    const c = await mkContact({})
    const { data, error } = await orphan.rpc('get_contact_next_action', { p_contact: c })
    expect(error).toBeNull()
    expect(data).toBeNull()
    await svc.auth.admin.deleteUser(u.user.id)
  })

  // N11 — tunable live
  it('N11: dormant_days abaissé à 3 via app_config → dormance 5 j détectée', async () => {
    const c = await mkContact({ lastInteraction: iso(-5 * DAY) })
    const before = await core(c, setup.agencyAId)
    expect(before?.action).toBe('aucune')   // 5 j < défaut 14
    await svc.from('app_config').upsert(
      { key: 'contact_nba_v1', value: '{"dormant_days":3,"version":1}' },
      { onConflict: 'key' },
    )
    const after = await core(c, setup.agencyAId)
    expect(after?.action).toBe('relance')
    expect(after?.reason_key).toBe('dormant')
    // restauration immédiate (les autres tests dépendent du défaut 14)
    if (nbaCfgBefore.had) await svc.from('app_config').update({ value: nbaCfgBefore.value }).eq('key', 'contact_nba_v1')
    else await svc.from('app_config').update({ value: '{"dormant_days":14,"offer_window_days":7,"deal_stall_days":14,"visit_debrief_window_days":21,"version":1}' }).eq('key', 'contact_nba_v1')
  })
})
