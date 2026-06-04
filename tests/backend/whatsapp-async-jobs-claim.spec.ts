// File de jobs async WhatsApp (whatsapp_async_jobs) — deux invariants critiques :
//   1. Dédup à l'enqueue : un 2e job pending identique (profile_id, tool, contact_id) est
//      rejeté par l'index partiel uq_whatsapp_async_dedup avec le code Postgres 23505.
//   2. Claim atomique : claim_whatsapp_async_jobs() réclame le job et le passe à
//      'processing' ; un 2e appel immédiat ne retourne pas le même job (SKIP LOCKED).
//
// profile_id : on utilise setup.agentAId (un vrai UUID de profil créé par le helper)
// car c'est plus sûr qu'un UUID libre, même si la colonne n'a pas de FK.
// contact_id : UUID déterministe dérivé du stamp — nul besoin de FK (contact_id NULL OK).
//
// Tourne contre un projet de TEST (SUPABASE_TEST_*). skipIf saute proprement
// si les clés ne sont pas dispo (local sans Docker) → 0 failures.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(
  process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY
)

describe.skipIf(!HAS_KEYS)('whatsapp_async_jobs — dédup enqueue + claim atomique', () => {
  let setup: TwoAgenciesSetup
  let jobId: string

  // contact_id dérivé du stamp (formaté comme UUID v4-ish, unique par run)
  let contactId: string

  const TOOL = 'run_kyc_screening' as const
  const WA_PHONE = '41790000099'

  beforeAll(async () => {
    setup = await setupTwoAgencies()

    // Dérive un contact_id stable et unique pour ce run à partir du stamp.
    // Le stamp est du style "1717400000000-123456" → on extrait les 12 derniers chiffres.
    const digits = setup.stamp.replace(/\D/g, '').slice(-12).padStart(12, '0')
    contactId = `00000000-0000-4000-a000-${digits}`

    // Seed du job initial dans beforeAll : les deux tests en dépendent.
    const svc = serviceRoleClient()
    const { data, error } = await svc
      .from('whatsapp_async_jobs')
      .insert({
        profile_id: setup.agentAId,
        agency_id: setup.agencyAId,
        wa_agent_phone: WA_PHONE,
        tool: TOOL,
        contact_id: contactId,
        lang: 'fr',
      })
      .select('id')
      .single()

    if (error) throw new Error(`seed job: ${error.message}`)
    jobId = data.id
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    // Nettoie tous les jobs liés à ce run (pending, processing, done, failed)
    await svc
      .from('whatsapp_async_jobs')
      .delete()
      .eq('profile_id', setup.agentAId)
      .eq('contact_id', contactId)
    await setup.cleanup()
  })

  it('un 2e job pending identique (profile_id, tool, contact_id) est refusé — code 23505', async () => {
    // Le job est déjà pending (inséré dans beforeAll). Tenter un doublon → violation index.
    const svc = serviceRoleClient()
    const { error } = await svc
      .from('whatsapp_async_jobs')
      .insert({
        profile_id: setup.agentAId,
        agency_id: setup.agencyAId,
        wa_agent_phone: WA_PHONE,
        tool: TOOL,
        contact_id: contactId,
        lang: 'fr',
      })
      .select('id')
      .single()

    expect(error).not.toBeNull()
    expect(error?.code).toBe('23505')
  })

  it('claim_whatsapp_async_jobs réclame le job puis ne le re-réclame pas (processing)', async () => {
    const svc = serviceRoleClient()

    // 1er claim : le job pending doit apparaître dans les résultats
    const { data: claimed, error: ce } = await svc.rpc('claim_whatsapp_async_jobs', { p_batch: 5 })
    expect(ce).toBeNull()

    const claimedList = (claimed ?? []) as Array<{ id: string; contact_id: string; status: string }>
    const ourJob = claimedList.find(j => j.id === jobId)
    expect(ourJob).toBeDefined()
    expect(ourJob?.status).toBe('processing')

    // 2e claim immédiat : SKIP LOCKED empêche de re-réclamer un job processing frais
    const { data: again, error: ae } = await svc.rpc('claim_whatsapp_async_jobs', { p_batch: 5 })
    expect(ae).toBeNull()

    const againList = (again ?? []) as Array<{ id: string }>
    // assertion directe (vs un booléen) → message d'échec lisible si le job est re-réclamé
    expect(againList.some(j => j.id === jobId)).toBe(false)
  })
})
