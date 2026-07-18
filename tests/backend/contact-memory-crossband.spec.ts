// Couverture LIVE de la mémoire cross-canal (contact chaud + crm_summary).
// Épingle : (1) résoudre un contact pose hot_contact_* pour l'agent appelant ;
// (2) l'upsert CRM ne détruit PAS les colonnes du cron WhatsApp (et réciproquement) ;
// (3) isolation agence : l'agent B ne voit jamais le bloc du contact de A ;
// (4) get_contact_brief expose crm_summary ;
// (5) GARDE TENANT : distillCrmTurn sur un contact d'une AUTRE agence = no-op total
//     (aucune ligne créée/modifiée — la garde coupe AVANT tout fetch réseau, donc la
//     clé API bidon ne part jamais sur le réseau).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { type SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'
import { execGetContactBrief, type ActionCtx } from '../../supabase/functions/_shared/whatsapp-actions'
import { fetchHotContactBlock, upsertCrmSummary, distillCrmTurn } from '../../supabase/functions/_shared/contact-memory'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('mémoire cross-canal (live)', () => {
  let svc: SupabaseClient
  let setup: TwoAgenciesSetup
  let ctxA: ActionCtx
  let contactId = ''   // contact de l'agence A
  let contactBId = ''  // contact de l'agence B (pour la garde tenant)

  beforeAll(async () => {
    svc = serviceRoleClient()
    setup = await setupTwoAgencies()
    ctxA = { supabase: svc, profileId: setup.agentAId, agencyId: setup.agencyAId, lang: 'fr', via: 'web' }
    const { data: cA, error: eA } = await svc.from('contacts').insert({
      agency_id: setup.agencyAId, first_name: 'MEM', last_name: `X-${setup.stamp}`, type: 'buyer',
    }).select('id').single()
    if (eA) throw new Error(eA.message)
    contactId = cA.id as string
    const { data: cB, error: eB } = await svc.from('contacts').insert({
      agency_id: setup.agencyBId, first_name: 'MEMB', last_name: `Y-${setup.stamp}`, type: 'buyer',
    }).select('id').single()
    if (eB) throw new Error(eB.message)
    contactBId = cB.id as string
  })

  afterAll(async () => {
    await svc.from('whatsapp_conversation_insights').delete().in('contact_id', [contactId, contactBId].filter(Boolean))
    await svc.from('contacts').delete().in('id', [contactId, contactBId].filter(Boolean))
    await setup?.cleanup()
  })

  it('T1 — get_contact_brief pose le contact chaud de l’agent (fire-and-forget)', async () => {
    await execGetContactBrief(ctxA, { contact_id: contactId })
    await new Promise((r) => setTimeout(r, 800)) // le touch est fire-and-forget
    const { data } = await svc.from('agent_ai_profiles')
      .select('hot_contact_id').eq('agent_id', setup.agentAId).maybeSingle()
    expect(data?.hot_contact_id).toBe(contactId)
  })

  it('T2 — upsert CRM n’écrase pas les colonnes WhatsApp (ni l’inverse)', async () => {
    // simule le cron : pose un rolling_summary
    await svc.from('whatsapp_conversation_insights').upsert(
      { contact_id: contactId, agency_id: setup.agencyAId, rolling_summary: 'fil whatsapp' },
      { onConflict: 'contact_id' })
    await upsertCrmSummary(svc, setup.agencyAId, contactId, 'travail crm')
    // re-simule un tour de cron (upsert partiel côté whatsapp)
    await svc.from('whatsapp_conversation_insights').upsert(
      { contact_id: contactId, agency_id: setup.agencyAId, rolling_summary: 'fil whatsapp v2' },
      { onConflict: 'contact_id' })
    const { data } = await svc.from('whatsapp_conversation_insights')
      .select('rolling_summary, crm_summary').eq('contact_id', contactId).maybeSingle()
    expect(data?.rolling_summary).toBe('fil whatsapp v2')
    expect(data?.crm_summary).toBe('travail crm')   // survit aux upserts du cron
  })

  it('T3 — bloc contact chaud : présent pour A, VIDE pour l’agence B (isolation)', async () => {
    const hot = { hot_contact_id: contactId, hot_contact_at: new Date().toISOString() }
    const blockA = await fetchHotContactBlock(svc, setup.agencyAId, hot, 'fr')
    expect(blockA).toContain('MEM')
    expect(blockA).toContain('travail crm')
    const blockB = await fetchHotContactBlock(svc, setup.agencyBId, hot, 'fr')
    expect(blockB).toBe('') // contact hors agence B → rien
  })

  it('T4 — get_contact_brief expose crm_summary', async () => {
    const out = await execGetContactBrief(ctxA, { contact_id: contactId })
    expect(out).toContain('travail crm')
  })

  it('T5 — GARDE TENANT : distillCrmTurn sur un contact étranger = no-op total', async () => {
    // Ligne d'insight existante côté B (comme si LEUR cron avait tourné) — la cible du « vol ».
    await svc.from('whatsapp_conversation_insights').upsert(
      { contact_id: contactBId, agency_id: setup.agencyBId, rolling_summary: 'fil agence B' },
      { onConflict: 'contact_id' })
    // L'agence A tente de distiller sur le contact de B. Clé API BIDON : si la garde ne
    // coupait pas AVANT le fetch, l'appel réseau partirait (et échouerait) — la garde rend
    // le tout no-op sans réseau.
    await distillCrmTurn({
      supabase: svc, apiKey: 'sk-bidon-jamais-envoye',
      agencyId: setup.agencyAId, contactId: contactBId,
      userMessage: 'tentative cross-tenant', assistantText: 'x'.repeat(200), lang: 'fr',
    })
    const { data } = await svc.from('whatsapp_conversation_insights')
      .select('agency_id, rolling_summary, crm_summary').eq('contact_id', contactBId).maybeSingle()
    expect(data?.agency_id).toBe(setup.agencyBId)      // PAS volée (agency_id intact)
    expect(data?.rolling_summary).toBe('fil agence B') // contenu B intact
    expect(data?.crm_summary ?? null).toBeNull()       // aucun distillat écrit
  })
})
