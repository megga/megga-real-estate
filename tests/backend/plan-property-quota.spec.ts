// QUOTA DE BIENS ACTIFS PAR PLAN — tenu en base, inactif par défaut (20260913170100, S15).
//
// Trois preuves, chacune avec son témoin :
//   1. interrupteur ÉTEINT (l'état de production) : le 11ᵉ bien actif d'une agence Starter
//      passe — la migration ne change rien tant qu'un humain n'a pas décidé ;
//   2. interrupteur ALLUMÉ : le 11ᵉ est refusé (plan_property_limit), un brouillon passe, et
//      passer ce brouillon en actif est refusé aussi ;
//   3. un abonnement Pro actif lève le plafond.
// ⚠ L'interrupteur est GLOBAL (app_config) : allumé le moins longtemps possible, et remis à
// 'false' dans un finally — une autre spec qui créerait onze biens actifs pour une même agence
// pendant cette fenêtre serait refusée.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { serviceRoleClient } from './helpers/supabase'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const PLAFOND_STARTER = 10

describe.skipIf(!HAS_KEYS)('QUOTA DE BIENS — trigger enforce_plan_property_quota', () => {
  let setup: TwoAgenciesSetup
  const service = serviceRoleClient()

  const interrupteur = async (valeur: 'true' | 'false') => {
    const { error } = await service.from('app_config')
      .upsert({ key: 'plan_limits_enforced', value: valeur }, { onConflict: 'key' })
    if (error) throw new Error(`app_config plan_limits_enforced: ${error.message}`)
  }

  const bien = (titre: string, status: 'active' | 'draft' = 'active') => ({
    agency_id: setup.agencyAId, title: `${titre} ${setup.stamp}`,
    type: 'apartment', status, city: 'Genève', canton: 'GE',
  })

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    await interrupteur('false')
    // Dix biens actifs posés par le service : l'agence A est au plafond Starter.
    const lot = Array.from({ length: PLAFOND_STARTER }, (_, i) => bien(`Plafond ${i + 1}`))
    const { error } = await service.from('properties').insert(lot)
    if (error) throw new Error(`seed properties: ${error.message}`)
  })

  afterAll(async () => {
    await interrupteur('false')
    await service.from('subscriptions').delete().eq('agency_id', setup.agencyAId)
    await service.from('properties').delete().eq('agency_id', setup.agencyAId)
    await setup.cleanup()
  })

  it('ÉTEINT (état de production) : le 11ᵉ bien actif passe', async () => {
    const { data, error } = await setup.clientA.from('properties').insert(bien('Onzième éteint')).select('id').single()
    expect(error).toBeNull()
    await service.from('properties').delete().eq('id', data!.id)
  })

  it('ALLUMÉ : le 11ᵉ actif est refusé, un brouillon passe, l’activer est refusé', async () => {
    await interrupteur('true')
    try {
      const refus = await setup.clientA.from('properties').insert(bien('Onzième allumé'))
      expect(refus.error?.message).toBe('plan_property_limit')

      // Contrôle positif : le refus vise l'ACTIVATION, pas toute écriture.
      const brouillon = await setup.clientA.from('properties')
        .insert(bien('Brouillon', 'draft')).select('id').single()
      expect(brouillon.error).toBeNull()

      const activation = await setup.clientA.from('properties')
        .update({ status: 'active' }).eq('id', brouillon.data!.id)
      expect(activation.error?.message).toBe('plan_property_limit')

      // Le service (copilote, import) est soumis à la même règle.
      const parService = await service.from('properties').insert(bien('Onzième service'))
      expect(parService.error?.message).toBe('plan_property_limit')
    } finally {
      await interrupteur('false')
    }
  })

  it('ALLUMÉ + abonnement Pro actif : le plafond tombe', async () => {
    const { error: subErr } = await service.from('subscriptions').insert({
      agency_id: setup.agencyAId, stripe_customer_id: `cus_quota_${setup.stamp}`, plan: 'pro', status: 'active',
    })
    if (subErr) throw new Error(`seed subscriptions: ${subErr.message}`)
    await interrupteur('true')
    try {
      const { error } = await setup.clientA.from('properties').insert(bien('Onzième Pro'))
      expect(error).toBeNull()
    } finally {
      await interrupteur('false')
    }
  })
})
