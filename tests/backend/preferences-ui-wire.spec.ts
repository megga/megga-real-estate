// Regression — PreferencesSection wire to profiles.preferences.ui JSON.
// Mirror du pattern useNotifPreferences (profiles.preferences.notifications).
// Coexiste avec la sous-clé `notifications` sans l'écraser (read-modify-write).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('regression — profiles.preferences.ui wire', () => {
  let setup: TwoAgenciesSetup

  beforeAll(async () => {
    setup = await setupTwoAgencies()
  })

  afterAll(async () => {
    await setup.cleanup()
  })

  it('agent A writes preferences.ui and coexists with preferences.notifications', async () => {
    const svc = serviceRoleClient()

    // Seed notifications subkey via service role
    await svc.from('profiles').update({
      preferences: { notifications: { email: true, sms: false } },
    }).eq('id', setup.agentAId)

    // Agent A writes ui subkey via authed client (read-modify-write)
    const { data: cur } = await setup.clientA
      .from('profiles')
      .select('preferences')
      .eq('id', setup.agentAId)
      .single()
    const merged = {
      ...(cur?.preferences as Record<string, unknown> ?? {}),
      ui: { language: 'de', theme: 'dark', aiAssist: 'proactive' },
    }
    const { error: writeErr } = await setup.clientA
      .from('profiles')
      .update({ preferences: merged })
      .eq('id', setup.agentAId)
    expect(writeErr).toBeNull()

    // Verify both subkeys still present
    const { data } = await svc
      .from('profiles')
      .select('preferences')
      .eq('id', setup.agentAId)
      .single()
    const prefs = data?.preferences as { notifications?: { email: boolean }; ui?: { language: string } }
    expect(prefs?.notifications?.email).toBe(true)
    expect(prefs?.ui?.language).toBe('de')
  })

  it('agent B CANNOT update agent A preferences (RLS)', async () => {
    const { data: returned } = await setup.clientB
      .from('profiles')
      .update({ preferences: { ui: { language: 'leak' } } })
      .eq('id', setup.agentAId)
      .select('id')
    expect(returned, 'agent B leaked update to agent A profile').toEqual([])
  })
})
