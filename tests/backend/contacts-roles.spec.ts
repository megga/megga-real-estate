/**
 * Le déclencheur de synchronisation des rôles, contre la vraie base (étape 3).
 *
 * ⛔ Ce que le banc ne peut PAS éprouver : un trigger. C'est ici que la règle vit.
 *
 * Même gabarit que `tests/backend/matching-explique.spec.ts` : deux agences réelles, un
 * client service-role, et `describe.skipIf` quand la base locale n'est pas là — la CI la
 * fournit, une machine de développement pas toujours.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_JWT)

describe.skipIf(!HAS_KEYS)('contacts · rôles multiples — le déclencheur', () => {
  let s: TwoAgenciesSetup
  let svc: SupabaseClient
  const crees: string[] = []

  beforeAll(async () => {
    s = await setupTwoAgencies()
    svc = serviceRoleClient()
  })

  afterAll(async () => {
    if (!svc) return
    if (crees.length) await svc.from('contacts').delete().in('id', crees)
    await s.cleanup()
  })

  /** Crée un contact et rend ce que la base a RETENU — c'est le déclencheur qui parle. */
  const creer = async (champs: Record<string, unknown>) => {
    const { data, error } = await svc.from('contacts')
      .insert({ agency_id: s.agencyAId, first_name: 'Test', last_name: `Rôles ${s.stamp}`, ...champs })
      .select('id, type, roles').single()
    if (error) throw new Error(error.message)
    crees.push((data as { id: string }).id)
    return data as { id: string; type: string; roles: string[] }
  }

  it('écrire `roles` recalcule `type`', async () => {
    expect(await creer({ roles: ['seller', 'lawyer'] })).toMatchObject({ type: 'seller', roles: ['seller', 'lawyer'] })
    expect(await creer({ roles: ['lawyer', 'buyer', 'seller'] })).toMatchObject({ type: 'both' })
    expect(await creer({ roles: ['private_banker'] })).toMatchObject({ type: 'lead', roles: ['private_banker'] })
  })

  it('écrire `type` seul AJOUTE son rôle, sans effacer les rôles de réseau', async () => {
    const { id } = await creer({ roles: ['lawyer'] })
    const { data, error } = await svc.from('contacts').update({ type: 'seller' }).eq('id', id).select('type, roles').single()
    if (error) throw new Error(error.message)
    expect(data).toMatchObject({ type: 'seller', roles: ['seller', 'lawyer'] })
  })

  it('un contact créé sans rien est un lead sans rôle (le chemin du copilote WhatsApp)', async () => {
    expect(await creer({ source: 'whatsapp_ai' })).toMatchObject({ type: 'lead', roles: [] })
  })

  it('`type = both` à l’écriture donne les deux rôles', async () => {
    expect(await creer({ type: 'both' })).toMatchObject({ type: 'both', roles: ['buyer', 'seller'] })
  })

  it('les rôles sont ordonnés et dédoublonnés', async () => {
    expect(await creer({ roles: ['lawyer', 'buyer', 'lawyer', 'tenant'] }))
      .toMatchObject({ roles: ['buyer', 'tenant', 'lawyer'] })
  })

  it('un rôle inconnu est REFUSÉ, jamais laissé tomber en silence', async () => {
    const { error } = await svc.from('contacts')
      .insert({ agency_id: s.agencyAId, first_name: 'Test', last_name: `Inconnu ${s.stamp}`, roles: ['plombier'] })
      .select('id').single()
    expect(error?.message ?? '').toMatch(/rôle de contact inconnu|contacts_roles_valides/)
  })

  it('les rôles gagnent quand les deux colonnes changent ensemble', async () => {
    expect(await creer({ type: 'seller', roles: ['tenant'] })).toMatchObject({ type: 'tenant', roles: ['tenant'] })
  })
})
