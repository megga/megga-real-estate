// KYC — la checklist LBA est posée par le SEUL trigger seed_kyc_lba_checks
// (migration 20260628130000) : jeu PP/PM détaillé, plus de doublon (l'insert
// frontend useCreateKycCase a été retiré). Un dossier inséré directement ne
// déclenche QUE le trigger → exactement le set attendu, sans label dupliqué.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('KYC checklist — source unique (trigger), pas de doublon', () => {
  let setup: TwoAgenciesSetup
  let contactId: string
  const caseIds: string[] = []

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()
    const { data: contact, error } = await service
      .from('contacts')
      .insert({
        agency_id: setup.agencyAId, first_name: 'CL', last_name: `Seed ${setup.stamp}`,
        entity_type: 'pp', type: 'buyer', source: 'manual',
      })
      .select('id')
      .single()
    if (error) throw new Error(`contact: ${error.message}`)
    contactId = contact!.id
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    for (const id of caseIds) await service.from('kyc_cases').delete().eq('id', id)
    await setup.cleanup()
  })

  async function seedCase(type: string): Promise<string> {
    const service = serviceRoleClient()
    const { data, error } = await service
      .from('kyc_cases')
      .insert({ agency_id: setup.agencyAId, contact_id: contactId, type, vigilance: 'standard' })
      .select('id')
      .single()
    if (error) throw new Error(`kyc_case (${type}): ${error.message}`)
    caseIds.push(data!.id)
    return data!.id
  }

  async function labels(caseId: string): Promise<string[]> {
    const { data } = await serviceRoleClient()
      .from('kyc_checklist_items')
      .select('label')
      .eq('kyc_case_id', caseId)
    return (data ?? []).map((r) => r.label as string)
  }

  it('personne physique (_pp) → 7 items, aucun label dupliqué', async () => {
    const ls = await labels(await seedCase('buyer_pp'))
    expect(ls).toHaveLength(7)
    expect(new Set(ls).size, `labels dupliqués: ${ls.join(' | ')}`).toBe(7)
    expect(ls).toContain("Pièce d'identité (passeport ou CI)")
    // l'ancien item générique du double-seed ne doit PLUS apparaître
    expect(ls).not.toContain("Pièce d'identité")
  })

  it('personne morale (_pm) → 9 items, aucun label dupliqué', async () => {
    const ls = await labels(await seedCase('buyer_pm'))
    expect(ls).toHaveLength(9)
    expect(new Set(ls).size, `labels dupliqués: ${ls.join(' | ')}`).toBe(9)
    expect(ls).toContain('Identification des ayants droit économiques (UBO)')
  })
})
