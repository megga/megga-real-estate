// Fermeture des écritures client sur auth_events (migration 20260719150000).
//
// Le seul producteur du journal d'audit auth est l'edge function log-auth-event
// (service_role) ; le fallback INSERT direct de auditLog.ts a été retiré.
// Leçon « GRANT ALL à anon = footgun » : on teste l'ÉCRITURE anon, pas
// seulement la lecture — un grant hérité + absence de policy donne un chemin
// qui semble ouvert côté code mais échoue silencieusement en prod.
// Tourne en CI sur le Supabase local (migrations du repo) ET en live (skipIf clés).

import { describe, it, expect, afterAll } from 'vitest'
import { serviceRoleClient, anonClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('auth_events — écritures client fermées', () => {
  const stamp = `spec-auth-events-${Date.now()}`

  afterAll(async () => {
    await serviceRoleClient().from('auth_events').delete().like('detail', `${stamp}%`)
  })

  it('anon ne peut PAS insérer dans auth_events', async () => {
    const { error } = await anonClient().from('auth_events').insert({
      action: 'signup.failure',
      severity: 'warn',
      detail: `${stamp}-anon-insert`,
    })
    expect(error).toBeTruthy()

    const { data: leaked } = await serviceRoleClient()
      .from('auth_events').select('id').eq('detail', `${stamp}-anon-insert`)
    expect(leaked ?? []).toHaveLength(0)
  })

  it('anon ne peut PAS lire auth_events', async () => {
    const { data, error } = await anonClient().from('auth_events').select('id').limit(1)
    // Grant SELECT révoqué → permission denied ; on tolère aussi le cas
    // « policy filtre tout » (0 ligne) pour un live pas encore migré.
    if (!error) expect(data ?? []).toHaveLength(0)
    else expect(error).toBeTruthy()
  })

  it('service_role (chemin edge function) insère toujours', async () => {
    const svc = serviceRoleClient()
    const { error } = await svc.from('auth_events').insert({
      action: 'signup.failure',
      severity: 'warn',
      detail: `${stamp}-service-insert`,
    })
    expect(error).toBeNull()

    const { data } = await svc.from('auth_events')
      .select('id').eq('detail', `${stamp}-service-insert`)
    expect(data ?? []).toHaveLength(1)
  })
})
