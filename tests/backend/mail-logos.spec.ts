// Contrat HTTP de l'edge `mail-logos` (logos des expéditeurs, 14.09.2026) contre le
// runtime edge LOCAL — jamais la production.
//
// ⚠ AUCUN DE CES CAS NE SORT SUR LE RÉSEAU, et c'est voulu : un test qui résoudrait le
// logo d'un vrai site dépendrait de ce site. Ce qui s'éprouve ici est ce que le code
// décide AVANT toute requête sortante — la garde, la visibilité de la boîte, le filtre
// « domaines réellement reçus », la messagerie de particuliers (rangée « rien » sans
// requête), et la lecture du cache. La résolution elle-même est éprouvée hors réseau par
// `supabase/functions/_shared/mail/logos.test.ts`.
//
// ⛔ 404 ET JAMAIS 403 pour une boîte d'une autre agence — même règle que les autres
// edges de la Messagerie (voir l'en-tête de mail-edges.spec.ts), et même fixture
// décisive : une boîte de l'agence B dont l'agent A est propriétaire.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'
import { waitForEdgeWorker } from './helpers/edge'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const FN = `${URL}/functions/v1/mail-logos`

describe.skipIf(!HAS_KEYS)('Messagerie — edge mail-logos', () => {
  let s: TwoAgenciesSetup
  let jwtA: string
  let boxAId: string
  let boxBId: string
  let boxAinBId: string
  const cache = () => `cache-${s.stamp}.test`
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64')

  const call = async (body: unknown, jwt?: string) => {
    const res = await fetch(FN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    let json: Record<string, unknown> = {}
    try { json = JSON.parse(text) as Record<string, unknown> } catch { json = { raw: text } }
    return { status: res.status, json, text }
  }

  beforeAll(async () => {
    s = await setupTwoAgencies()
    const { data } = await s.clientA.auth.getSession()
    jwtA = data.session!.access_token
    const service = serviceRoleClient()
    const mk = async (agencyId: string, ownerId: string, email: string, visibility: 'agency' | 'owner' = 'agency') => {
      const { data: row, error } = await service.from('mail_accounts')
        .insert({ agency_id: agencyId, owner_id: ownerId, provider: 'gmail', email, visibility }).select('id').single()
      if (error) throw new Error(`mail_accounts ${email}: ${error.message}`)
      return row.id as string
    }
    boxAId = await mk(s.agencyAId, s.agentAId, `logos-a-${s.stamp}@a.test`)
    boxBId = await mk(s.agencyBId, s.agentBId, `logos-b-${s.stamp}@b.test`)
    boxAinBId = await mk(s.agencyBId, s.agentAId, `logos-ab-${s.stamp}@b.test`, 'owner')

    // Ce que la boîte A a REÇU : une particulière chez Gmail, et une société dont le logo
    // est déjà en cache.
    const recu = async (from: string, tag: string) => {
      const { error } = await service.from('mail_threads').insert({
        account_id: boxAId, agency_id: s.agencyAId, provider_thread_id: `t-logo-${tag}-${s.stamp}`,
        subject: tag, from_name: tag, from_email: from, last_message_at: new Date().toISOString(),
      })
      if (error) throw new Error(`mail_threads ${tag}: ${error.message}`)
    }
    await recu('zoe.particuliere@gmail.com', 'gmail')
    await recu(`credit@${cache()}`, 'cache')
    const { error: eCache } = await service.from('mail_sender_logos').insert({
      account_id: boxAId, domain: cache(), status: 'found', source: 'bimi', mime: 'image/svg+xml', data: svg,
    })
    if (eCache) throw new Error(`mail_sender_logos: ${eCache.message}`)
    await waitForEdgeWorker(FN)
  }, 180_000)

  afterAll(async () => {
    // Fils et logos partent en cascade avec les boîtes.
    await serviceRoleClient().from('mail_accounts').delete().in('id', [boxAId, boxBId, boxAinBId])
    await s.cleanup()
  })

  it('sans jeton : refusé par la garde de l agent (401), avant toute lecture', async () => {
    const r = await call({ account_id: boxAId, domains: ['gmail.com'] })
    expect(r.status, r.text.slice(0, 200)).toBe(401)
    expect(String(r.json.error)).toMatch(/Authentication required/i)
  })

  it('une boîte d une autre agence est introuvable (404) — même celle dont l appelant est propriétaire', async () => {
    for (const id of [boxBId, boxAinBId]) {
      const r = await call({ account_id: id, domains: ['gmail.com'] }, jwtA)
      expect(r.status, r.text.slice(0, 200)).toBe(404)
      expect(r.json.error).toBe('not_found')
    }
  })

  it('un identifiant qui n a pas la forme d un UUID → 400', async () => {
    const r = await call({ account_id: 'pas-un-uuid', domains: ['gmail.com'] }, jwtA)
    expect(r.status).toBe(400)
    expect(r.json.error).toBe('invalid_account')
  })

  it('un domaine que la boîte n a jamais reçu n est pas résolu : ce n est pas un lecteur d URL', async () => {
    const jamais = `jamais-${s.stamp}.test`
    const r = await call({ account_id: boxAId, domains: [jamais] }, jwtA)
    expect(r.status).toBe(200)
    expect(r.json.logos).toEqual({})
    const { data } = await serviceRoleClient().from('mail_sender_logos').select('domain').eq('domain', jamais)
    expect(data ?? []).toEqual([])
  })

  it('une messagerie de particuliers reçue : « rien », rangé en cache — sans aucune requête sortante', async () => {
    const r = await call({ account_id: boxAId, domains: ['gmail.com'] }, jwtA)
    expect(r.status, r.text.slice(0, 200)).toBe(200)
    expect(r.json.logos).toEqual({ 'gmail.com': null })
    const { data } = await serviceRoleClient().from('mail_sender_logos')
      .select('status, data').eq('account_id', boxAId).eq('domain', 'gmail.com').single()
    expect(data).toEqual({ status: 'none', data: null })
  })

  it('un logo frais en cache est servi tel quel, sans être recherché', async () => {
    const r = await call({ account_id: boxAId, domains: [cache()] }, jwtA)
    expect(r.status, r.text.slice(0, 200)).toBe(200)
    expect(r.json.logos).toEqual({ [cache()]: { mime: 'image/svg+xml', data: svg, source: 'bimi' } })
  })
})
