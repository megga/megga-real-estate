// First backend integration test — verifies the local Supabase instance is
// reachable, via one anon client probe and one service_role probe.
// If this fails, the rest of the backend suite won't make sense — that's why
// it lives in its own file with a descriptive name.
//
// L'ancienne sonde anon lisait `market_listings` et exigeait `error === null`.
// La lecture anon de cette table a été fermée (migration 20260719110000 : la
// marketplace publique est désactivée depuis le pivot CRM-first). La sonde teste
// désormais que la fermeture est effective — ce qui prouve toujours que le serveur
// répond, à condition d'exiger l'erreur PRÉCISE de refus et pas n'importe laquelle
// (sinon une panne réseau ferait passer le test au vert).

import { describe, it, expect, beforeAll } from 'vitest'
import { anonClient, serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('backend smoke — local Supabase is reachable', () => {
  beforeAll(() => {
    // Visible reminder if the run is gated — easier than digging in skip logs.
    if (!HAS_KEYS) {
       
      console.log('[backend smoke] skipped: SUPABASE_TEST_*_KEY env vars not set. Run `supabase status` and fill .env.test.local.')
    }
  })


  it('anon client is refused on market_listings (lecture publique fermée)', async () => {
    const supabase = anonClient()
    const { error } = await supabase
      .from('market_listings')
      .select('id')
      .limit(1)

    // Le serveur doit répondre, et répondre un REFUS. On exige le code/message
    // exact : un `error` quelconque (DNS, connexion refusée, timeout) signifierait
    // que le backend est injoignable, ce que cette sonde est justement censée détecter.
    expect(error, 'anon ne doit plus lire market_listings').not.toBeNull()
    const code = error!.code ?? ''
    const msg = error!.message.toLowerCase()
    expect(
      code === '42501' || /permission|policy|denied|row.?level/i.test(msg),
      `refus RLS attendu, reçu code=${code} message=${error!.message}`
    ).toBe(true)
  })

  it('service-role client can query any table (bypasses RLS)', async () => {
    const supabase = serviceRoleClient()
    // service_role bypasses RLS, so SELECT on any table must succeed.
    // We pick market_listings because it's the largest, most-used table.
    const { error } = await supabase
      .from('market_listings')
      .select('id', { head: true, count: 'estimated' })

    expect(error, `query error: ${error?.message ?? 'none'}`).toBeNull()
  })
})
