// Backend spec (live CI) — l'export DSAR rend les boîtes connectées de la personne : la
// connexion, jamais les clés. Contre `supabase start` (SUPABASE_TEST_*), jamais la prod.
//
// ⛔ LE DÉFAUT (13.09.2026). `delete-account` effaçait les boîtes (étape 5c) mais
// `admin-dsar-export` ne les rendait pas : on pouvait effacer ce qu'on n'avait jamais pu
// consulter. C'est le premier test de l'export DSAR (`grep dsar tests/backend` rendait 0).
//
// La boîte semée porte TOUT ce qui ne doit pas sortir — un secret Vault, un curseur, une
// configuration IMAP, un texte d'erreur — et la garde cherche leurs VALEURS dans la réponse
// brute, pas seulement leurs clés : une fuite sous un autre nom resterait sinon invisible.
//
// ⚠ Même montage d'opérateur que delete-account-journal.spec.ts : `setupTwoAgencies` n'est
// pas utilisé, l'opérateur super-admin vit sur le domaine de test allowlisté.
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : lire le COMPTE de tests, jamais le code de sortie.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { anonClient, serviceRoleClient } from './helpers/supabase'
import { waitForEdgeWorker } from './helpers/edge'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? ''
const FN = `${URL}/functions/v1/admin-dsar-export`
const PW = 'Test-Password-123!'
const DOM_ADMIN = '@megga-test.local'

describe.skipIf(!HAS_KEYS)('admin-dsar-export — les boîtes connectées, sans leurs clés', () => {
  const userIds: string[] = []
  let agencyId = ''
  let operateurJwt = ''
  let cibleId = ''
  let secretId = ''
  let boiteEmail = ''
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const CURSEUR = `curseur-${stamp}`
  const ERREUR = `erreur-${stamp}`
  const HOTE_IMAP = `imap-${stamp}.ex.ch`

  async function mkUser(prefix: string, role: string, agence: string | null) {
    const svc = serviceRoleClient()
    const email = `${prefix}-${stamp}${DOM_ADMIN}`
    const { data, error } = await svc.auth.admin.createUser({ email, password: PW, email_confirm: true, user_metadata: { full_name: prefix, role: 'agent' } })
    if (error) throw new Error(`createUser ${prefix}: ${error.message}`)
    const id = data.user!.id
    userIds.push(id)
    const { error: pErr } = await svc.from('profiles').upsert({ id, email, full_name: prefix, role, agency_id: agence }, { onConflict: 'id' })
    if (pErr) throw new Error(`profile ${prefix}: ${pErr.message}`)
    return { id, email }
  }

  beforeAll(async () => {
    const svc = serviceRoleClient()
    const { error: cfgErr } = await svc.from('app_config').upsert({ key: 'super_admin_test_domain', value: DOM_ADMIN }, { onConflict: 'key' })
    if (cfgErr) throw new Error(`app_config : ${cfgErr.message}`)
    const { data: ag, error: agErr } = await svc.from('agencies').insert({ name: `Agence DSAR ${stamp}`, slug: `agence-dsar-${stamp}` }).select('id').single()
    if (agErr) throw new Error(`agence : ${agErr.message}`)
    agencyId = ag.id as string

    const op = await mkUser('dsar-super', 'super_admin', null)
    const client = anonClient()
    const { data: sess, error: sErr } = await client.auth.signInWithPassword({ email: op.email, password: PW })
    if (sErr) throw new Error(`signin opérateur : ${sErr.message}`)
    operateurJwt = sess.session!.access_token

    cibleId = (await mkUser('dsar-cible', 'agent', agencyId)).id
    const store = await svc.rpc('mail_secret_store', {
      p_secret: JSON.stringify({ refresh_token: `rt-${stamp}`, access_token: 'at', expires_at: '2026-09-13T10:00:00.000Z' }),
      p_name: `mail:dsar:${stamp}`,
    })
    if (store.error || !store.data) throw new Error(`mail_secret_store : ${store.error?.message ?? 'aucun id'}`)
    secretId = store.data as string
    boiteEmail = `boite-dsar-${stamp}@a.test`
    const { error: bErr } = await svc.from('mail_accounts').insert({
      agency_id: agencyId, owner_id: cibleId, provider: 'gmail', email: boiteEmail, display_name: 'Boîte DSAR',
      visibility: 'agency', vault_secret_id: secretId, sync_cursor: { historyId: CURSEUR },
      imap_config: { host: HOTE_IMAP }, last_error: ERREUR,
    })
    if (bErr) throw new Error(`mail_accounts : ${bErr.message}`)
    await waitForEdgeWorker(FN)
  }, 120_000)

  afterAll(async () => {
    const svc = serviceRoleClient()
    if (secretId) await svc.rpc('mail_secret_delete', { p_id: secretId })
    for (const id of userIds) await svc.auth.admin.deleteUser(id).then(() => {}, () => {})
    if (agencyId) await svc.from('agencies').delete().eq('id', agencyId).then(() => {}, () => {})
  })

  it('rend la connexion de la boîte, et aucune de ses clés', async () => {
    const res = await fetch(FN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${operateurJwt}` },
      body: JSON.stringify({ user_id: cibleId }),
    })
    const texte = await res.text()
    expect(res.status, `admin-dsar-export : ${texte.slice(0, 400)}`).toBe(200)
    const corps = JSON.parse(texte) as { data: { mail_accounts: Record<string, unknown>[] }; notes: Record<string, string> }

    expect(corps.data.mail_accounts, 'la boîte de la personne manque à son export').toHaveLength(1)
    const b = corps.data.mail_accounts[0]!
    expect(Object.keys(b).sort()).toEqual(['agency_id', 'created_at', 'display_name', 'email', 'last_sync_at', 'provider', 'status', 'visibility'])
    expect(b).toMatchObject({ email: boiteEmail, provider: 'gmail', visibility: 'agency', display_name: 'Boîte DSAR' })

    // Les VALEURS, pas seulement les clés : aucune ne doit sortir, sous aucun nom.
    for (const [nom, valeur] of [['pointeur Vault', secretId], ['curseur', CURSEUR], ['config IMAP', HOTE_IMAP], ['texte d’erreur', ERREUR], ['jeton', `rt-${stamp}`]] as const) {
      expect(texte, `${nom} a fui dans l’export`).not.toContain(valeur)
    }
    expect(corps.notes.mail_accounts, 'la note de périmètre dit ce qui n’est pas exporté').toMatch(/Jamais les jetons/)

    // La trace, écrite AVANT la réponse, compte la section.
    const { data: trace } = await serviceRoleClient().from('activity_events').select('metadata')
      .eq('action', 'data_exported').eq('entity_id', cibleId).order('created_at', { ascending: false }).limit(1)
    expect((trace?.[0]?.metadata as { counts?: Record<string, number> } | undefined)?.counts?.mail_accounts).toBe(1)
  }, 90_000)
})
