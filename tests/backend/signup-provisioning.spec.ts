// Non-régression — chemin d'inscription (trigger on_auth_user_created).
//
// Le trigger qui appelle handle_new_user() n'était dans aucune migration : en local
// l'inscription ne créait ni profil ni agence, et en prod l'objet vivait hors du
// contrôle de version. Ces tests exercent une vraie inscription et cassent la CI si
// le trigger disparaît. Migration : 20260726140000_auth_user_created_trigger.

import { describe, it, expect, afterAll } from 'vitest'
import { serviceRoleClient } from './helpers/supabase'

const PW = 'Test-Password-123!'
const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('inscription — provisioning automatique', () => {
  const userIds: string[] = []

  // Inscrit un utilisateur SANS toucher à profiles : tout ce qui suit doit être
  // l'œuvre du trigger, sinon le test ne prouve rien.
  async function signUp(meta: Record<string, string>): Promise<string> {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const { data, error } = await svc.auth.admin.createUser({
      email: `signup-${stamp}@megga-test.local`,
      password: PW,
      email_confirm: true,
      user_metadata: meta,
    })
    if (error) throw new Error(`createUser: ${error.message}`)
    userIds.push(data.user!.id)
    return data.user!.id
  }

  afterAll(async () => {
    const svc = serviceRoleClient()
    for (const id of userIds) {
      const { data: prof } = await svc.from('profiles').select('agency_id').eq('id', id).maybeSingle()
      await svc.auth.admin.deleteUser(id).then(() => {}, () => {})
      if (prof?.agency_id) await svc.from('agencies').delete().eq('id', prof.agency_id).then(() => {}, () => {})
    }
  })

  it('crée le profil sans intervention (le trigger existe)', async () => {
    const id = await signUp({ full_name: 'Alice Trigger', role: 'agent' })
    const svc = serviceRoleClient()
    const { data: prof } = await svc.from('profiles').select('id, role').eq('id', id).maybeSingle()
    expect(prof, 'aucun profil créé : le trigger on_auth_user_created est absent').not.toBeNull()
    expect(prof?.id).toBe(id)
  })
})
