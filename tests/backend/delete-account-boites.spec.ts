// Backend spec (live CI) — delete-account déconnecte les boîtes du compte : le secret Vault
// est EFFACÉ, pas seulement orphelin. Contre `supabase start` (SUPABASE_TEST_*), jamais la prod.
//
// ⛔ LE DÉFAUT (mesuré le 13.09.2026). La seule chose qui touchait les boîtes était la
// cascade de l'étape 11 : mail_accounts.owner_id → profiles ON DELETE CASCADE emporte la
// boîte, ses fils et ses messages. Mais Vault n'est la cible d'aucune clé étrangère : le
// jeton de rafraîchissement SURVIVAIT au compte, non révoqué, et la ligne qui le désignait
// disparaissait avec lui. Sur l'ancien code ce spec rougit sur `mail_secret_read` : la ligne
// est partie (cascade), le secret est toujours là.
//
// ⚠ Boîte OUTLOOK à dessein : Microsoft n'a pas d'endpoint de révocation, donc aucun appel
// ne sort de la CI. Le chemin Google (révocation, `400 invalid_token` toléré) est éprouvé par
// supabase/functions/_shared/mail/disconnect.test.ts et oauth.test.ts, avec un faux fetch.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : lire le COMPTE de tests, jamais le code de sortie.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'
import { waitForEdgeWorker } from './helpers/edge'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? ''
const FN = `${URL}/functions/v1/delete-account`

describe.skipIf(!HAS_KEYS)('delete-account — la boîte part avec son secret, pas seulement avec sa ligne', () => {
  let s: TwoAgenciesSetup
  let jwtA = ''
  let secretId = ''
  let boiteId = ''
  let filId = ''

  beforeAll(async () => {
    s = await setupTwoAgencies()
    const { data } = await s.clientA.auth.getSession()
    jwtA = data.session!.access_token
    const svc = serviceRoleClient()

    const store = await svc.rpc('mail_secret_store', {
      p_secret: JSON.stringify({ refresh_token: `rt-${s.stamp}`, access_token: 'at', expires_at: '2026-09-13T10:00:00.000Z' }),
      p_name: `mail:delete-account:${s.stamp}`,
    })
    if (store.error || !store.data) throw new Error(`mail_secret_store : ${store.error?.message ?? 'aucun id'}`)
    secretId = store.data as string

    const { data: boite, error: eBoite } = await svc.from('mail_accounts').insert({
      agency_id: s.agencyAId, owner_id: s.agentAId, provider: 'outlook',
      email: `boite-${s.stamp}@a.test`, visibility: 'agency', vault_secret_id: secretId,
    }).select('id').single()
    if (eBoite) throw new Error(`mail_accounts : ${eBoite.message}`)
    boiteId = boite.id as string

    const { data: fil, error: eFil } = await svc.from('mail_threads').insert({
      account_id: boiteId, agency_id: s.agencyAId, provider_thread_id: `t-${s.stamp}`, subject: 'Visite samedi',
    }).select('id').single()
    if (eFil) throw new Error(`mail_threads : ${eFil.message}`)
    filId = fil.id as string

    // Non-vacuité : le secret est LISIBLE avant — sinon « illisible après » ne prouverait rien.
    const avant = await svc.rpc('mail_secret_read', { p_id: secretId })
    expect(avant.error).toBeNull()
    expect(JSON.parse(String(avant.data)).refresh_token).toBe(`rt-${s.stamp}`)
    await waitForEdgeWorker(FN)
  }, 120_000)

  afterAll(async () => {
    // Filet si le test échoue avant l'effacement : ne pas laisser de jeton de test en Vault.
    if (secretId) await serviceRoleClient().rpc('mail_secret_delete', { p_id: secretId })
    await s?.cleanup()
  })

  it('supprime le compte, efface le secret, et emporte la boîte et ses fils', async () => {
    const res = await fetch(FN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${jwtA}` },
      body: '{}',
    })
    const texte = await res.text()
    expect(res.status, `delete-account : ${texte.slice(0, 400)}`).toBe(200)

    const svc = serviceRoleClient()
    const lu = await svc.rpc('mail_secret_read', { p_id: secretId })
    expect(lu.error).toBeNull()
    expect(lu.data, 'le jeton de la boîte a survécu au compte, dans Vault').toBeNull()

    const { data: boites } = await svc.from('mail_accounts').select('id').eq('id', boiteId)
    expect(boites, 'la boîte ne survit pas au compte').toEqual([])
    const { data: fils } = await svc.from('mail_threads').select('id').eq('id', filId)
    expect(fils, 'les fils partent avec la boîte (D15)').toEqual([])
    const { data: profil } = await svc.from('profiles').select('id').eq('id', s.agentAId).maybeSingle()
    expect(profil, 'le compte est bien supprimé').toBeNull()
  }, 90_000)
})
