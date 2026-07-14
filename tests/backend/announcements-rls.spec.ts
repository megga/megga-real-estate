// Annonces in-app — RLS de ciblage (migration 20260713200000)
//
// Matrice de visibilité vérifiée depuis 2 agents (agence A = starter,
// agence B = pro) :
//  1. Annonce universelle publiée → vue par A et B.
//  2. Annonce ciblée plan 'pro' → vue par B, PAS par A.
//  3. Annonce ciblée agence B → vue par B, PAS par A.
//  4. Annonce NON publiée → invisible pour tous.
//  5. Annonce hors fenêtre (ends_at passé) → invisible.
//  6. Écriture : un agent (non super-admin) ne peut PAS insérer d'annonce.
//  7. Dismissal : self-only (l'agent A ne voit pas le dismissal de B).
//
// Runs live in CI (SUPABASE_TEST_* keys present). Skips locally without keys.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('platform_announcements — RLS de ciblage', () => {
  let setup: TwoAgenciesSetup
  const ids: Record<string, string> = {}

  const seedAnnouncement = async (key: string, patch: Record<string, unknown>) => {
    const service = serviceRoleClient()
    const { data, error } = await service.from('platform_announcements')
      .insert({ title: `${key}-${setup.stamp}`, body: 'x', ...patch })
      .select('id').single()
    if (error) throw new Error(`seed ${key}: ${error.message}`)
    ids[key] = data.id
  }

  const seesIt = async (client: TwoAgenciesSetup['clientA'], key: string) => {
    const { data } = await client.from('platform_announcements').select('id').eq('id', ids[key])
    return (data ?? []).length > 0
  }

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()
    // Agence A = starter, agence B = pro (ciblage plan).
    await service.from('agencies').update({ plan: 'starter' }).eq('id', setup.agencyAId)
    await service.from('agencies').update({ plan: 'pro' }).eq('id', setup.agencyBId)

    await seedAnnouncement('universal', { published: true })
    await seedAnnouncement('planPro', { published: true, audience_plans: ['pro'] })
    await seedAnnouncement('agencyB', { published: true, audience_agencies: [setup.agencyBId] })
    await seedAnnouncement('draft', { published: false })
    await seedAnnouncement('expired', {
      published: true,
      starts_at: new Date(Date.now() - 2 * 864e5).toISOString(),
      ends_at: new Date(Date.now() - 864e5).toISOString(),
    })
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    for (const id of Object.values(ids)) {
      await service.from('platform_announcements').delete().eq('id', id).then(() => {}, () => {})
    }
    await setup.cleanup()
  })

  it('annonce universelle publiée : vue par A et B', async () => {
    expect(await seesIt(setup.clientA, 'universal')).toBe(true)
    expect(await seesIt(setup.clientB, 'universal')).toBe(true)
  })

  it('ciblage plan pro : vue par B (pro), pas par A (starter)', async () => {
    expect(await seesIt(setup.clientB, 'planPro')).toBe(true)
    expect(await seesIt(setup.clientA, 'planPro')).toBe(false)
  })

  it('ciblage agence B : vue par B, pas par A', async () => {
    expect(await seesIt(setup.clientB, 'agencyB')).toBe(true)
    expect(await seesIt(setup.clientA, 'agencyB')).toBe(false)
  })

  it('brouillon (non publié) : invisible pour tous', async () => {
    expect(await seesIt(setup.clientA, 'draft')).toBe(false)
    expect(await seesIt(setup.clientB, 'draft')).toBe(false)
  })

  it('hors fenêtre (ends_at passé) : invisible', async () => {
    expect(await seesIt(setup.clientA, 'expired')).toBe(false)
    expect(await seesIt(setup.clientB, 'expired')).toBe(false)
  })

  it('un agent ne peut pas insérer d\'annonce (write super-admin only)', async () => {
    const { error } = await setup.clientB.from('platform_announcements')
      .insert({ title: `hack-${setup.stamp}`, body: 'x', published: true })
    expect(error, 'insert refusé attendu').not.toBeNull()
  })

  it('dismissal self-only : A ne voit pas le dismissal de B', async () => {
    const { error: dErr } = await setup.clientB.from('platform_announcement_dismissals')
      .insert({ announcement_id: ids.universal, user_id: setup.agentBId })
    expect(dErr, 'B dismisse pour lui-même').toBeNull()

    // A ne voit aucune ligne de dismissal (la sienne serait 0).
    const { data: aSees } = await setup.clientA.from('platform_announcement_dismissals')
      .select('announcement_id').eq('announcement_id', ids.universal)
    expect((aSees ?? []).length).toBe(0)

    // B ne peut pas insérer un dismissal au nom de A (with_check user_id=auth.uid()).
    const { error: spoof } = await setup.clientB.from('platform_announcement_dismissals')
      .insert({ announcement_id: ids.planPro, user_id: setup.agentAId })
    expect(spoof, 'usurpation user_id refusée').not.toBeNull()
  })
})
