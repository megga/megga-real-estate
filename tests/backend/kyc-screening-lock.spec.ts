// Verrou anti-double-screening kyc_cases.screening_status.
// Vérifie que la réclamation atomique (UPDATE ... RETURNING) ne peut être acquise
// qu'une fois : le 2e claim immédiat retourne 0 ligne (verrou tenu).
// Vérifie aussi que l'état 'failed' est ré-réclamable (screening de rattrapage).
//
// Tourne contre un projet de TEST (SUPABASE_TEST_*), pas la prod.
// skipIf saute proprement si les clés de test ne sont pas fournies (local sans Docker).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('Verrou screening_status anti-double-screening', () => {
  let setup: TwoAgenciesSetup
  let kcId: string

  beforeAll(async () => {
    setup = await setupTwoAgencies()

    // Cas KYC frais : screening_status=NULL, screening_started_at=NULL
    const { data: kc, error: errKc } = await serviceRoleClient()
      .from('kyc_cases')
      .insert({ agency_id: setup.agencyAId, type: 'buyer_pp' })
      .select('id')
      .single()
    if (errKc) throw new Error(`kyc_case insert: ${errKc.message}`)
    kcId = kc.id
  })

  afterAll(async () => {
    if (kcId) await serviceRoleClient().from('kyc_cases').delete().eq('id', kcId)
    await setup.cleanup()
  })

  // Réplique EXACTEMENT la logique de claim du Task 4 (whatsapp-agent/index.ts)
  const claim = async () => {
    const staleIso = new Date(Date.now() - 120_000).toISOString()
    const { data } = await serviceRoleClient()
      .from('kyc_cases')
      .update({ screening_status: 'running', screening_started_at: new Date().toISOString() })
      .eq('id', kcId)
      .or(`screening_status.is.null,screening_status.eq.failed,screening_started_at.lt.${staleIso}`)
      .select('id')
      .maybeSingle()
    return data
  }

  it('le 2e claim immédiat est bloqué (0 ligne)', async () => {
    const first = await claim()
    expect(first?.id).toBe(kcId)  // 1er claim acquiert le verrou

    const second = await claim()
    expect(second).toBeNull()      // 2e claim immédiat : verrou tenu → 0 ligne
  })

  it("l'état 'failed' est ré-réclamable", async () => {
    // Passer la ligne en 'failed' pour simuler un screening précédent échoué
    const { error: errFail } = await serviceRoleClient()
      .from('kyc_cases')
      .update({ screening_status: 'failed', screening_started_at: new Date().toISOString() })
      .eq('id', kcId)
    if (errFail) throw new Error(`set failed: ${errFail.message}`)

    const reclaim = await claim()
    expect(reclaim?.id).toBe(kcId)  // Un cas 'failed' peut être ré-réclamé
  })
})
