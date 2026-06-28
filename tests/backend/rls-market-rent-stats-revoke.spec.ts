// market_rent_stats (vue matérialisée, agrégats loyer/m² par zone — 0 PII) :
// SELECT révoqué pour `authenticated` (migration 20260628120000). Seul
// service_role la lit, via l'edge matching-engine. RLS impossible sur un matview
// → le contrôle d'accès se fait par les GRANTs.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('market_rent_stats — verrouillée au service_role', () => {
  let setup: TwoAgenciesSetup

  beforeAll(async () => { setup = await setupTwoAgencies() })
  afterAll(async () => { await setup.cleanup() })

  it('un agent authentifié NE PEUT PAS lire market_rent_stats (SELECT révoqué)', async () => {
    const { error } = await setup.clientA.from('market_rent_stats').select('*').limit(1)
    expect(
      error,
      'authenticated doit être refusé sur market_rent_stats (lecture service_role only)'
    ).not.toBeNull()
  })
})
