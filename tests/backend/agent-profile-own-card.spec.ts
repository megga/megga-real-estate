// La fiche de l'agent (agent_profiles) : créée par l'agent lui-même, partie avec son compte.
//
// Migration 20260914230000. Avant elle, rien ne créait de fiche (INSERT réservé au
// super-admin) : bio, langues, spécialités et liens ne s'enregistraient pas, et le score de
// profil plafonnait à 89 %. Et la FK `profile_id` était NO ACTION : une fiche, même posée à
// la main, aurait fait échouer la suppression du compte.
//
// Vérifié ici, contre une vraie base : la RPC crée UNE fiche pour l'appelant et seulement
// pour lui ; l'INSERT direct reste fermé ; un autre agent ne voit rien ; un anonyme ne peut
// pas appeler la RPC ; et la suppression du compte PASSE en emportant la fiche.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { anonClient, serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)("fiche de l'agent — créée par lui-même, partie avec son compte", () => {
  let setup: TwoAgenciesSetup

  beforeAll(async () => {
    setup = await setupTwoAgencies()
  })

  afterAll(async () => {
    await setup?.cleanup()
  })

  it("l'agent crée SA fiche par la RPC, et une seule", async () => {
    const { data: id1, error } = await setup.clientA.rpc('ensure_my_agent_profile')
    expect(error, `rpc: ${error?.message}`).toBeNull()
    expect(id1).toBeTruthy()

    const { data: id2 } = await setup.clientA.rpc('ensure_my_agent_profile')
    expect(id2, 'le second appel rend la même fiche').toBe(id1)

    const { data: rows, error: readErr } = await serviceRoleClient()
      .from('agent_profiles')
      .select('id, first_name, last_name, status, claim_token, claimed_at')
      .eq('profile_id', setup.agentAId)
    expect(readErr).toBeNull()
    expect(rows).toHaveLength(1)
    expect(rows![0]).toMatchObject({ id: id1, first_name: 'Agent', last_name: 'A', status: 'claimed', claim_token: null })
    expect(rows![0].claimed_at).toBeTruthy()
  })

  it("il enregistre sa bio, qu'un autre agent ne voit pas", async () => {
    const { error: upErr } = await setup.clientA
      .from('agent_profiles')
      .update({ bio: `Bio A ${setup.stamp}` })
      .eq('profile_id', setup.agentAId)
    expect(upErr, `update: ${upErr?.message}`).toBeNull()

    const { data: mine } = await setup.clientA
      .from('agent_profiles').select('bio').eq('profile_id', setup.agentAId).maybeSingle()
    expect(mine?.bio).toBe(`Bio A ${setup.stamp}`)

    const { data: seenByB } = await setup.clientB
      .from('agent_profiles').select('id').eq('profile_id', setup.agentAId)
    expect(seenByB).toEqual([])
  })

  it("l'INSERT direct reste fermé à l'agent : la RPC est la seule création", async () => {
    const { error } = await setup.clientB
      .from('agent_profiles')
      .insert({ profile_id: setup.agentBId, first_name: 'B', last_name: 'B', slug: `direct-${setup.stamp}` })
    expect(error, "un agent ne doit pas pouvoir poser une fiche à la main").not.toBeNull()
  })

  it('un anonyme ne peut pas appeler la RPC', async () => {
    const { data, error } = await anonClient().rpc('ensure_my_agent_profile')
    expect(error).not.toBeNull()
    expect(data).toBeNull()
  })

  it('le compte se supprime, et sa fiche part avec lui', async () => {
    const svc = serviceRoleClient()
    // Non-vacuité : la fiche existe bien avant la suppression.
    const { data: before } = await svc.from('agent_profiles').select('id').eq('profile_id', setup.agentAId)
    expect(before).toHaveLength(1)

    // C'est cet appel qu'une FK NO ACTION aurait fait échouer.
    const { error: delErr } = await svc.auth.admin.deleteUser(setup.agentAId)
    expect(delErr, `deleteUser: ${delErr?.message}`).toBeNull()

    const { data: after } = await svc.from('agent_profiles').select('id').eq('profile_id', setup.agentAId)
    expect(after).toEqual([])
  })
})
