// Contrats HTTP des cinq edges de la Messagerie contre le runtime edge LOCAL.
//
// ⚠ ON ASSERTE LE CORPS DES REFUS, PAS SEULEMENT LE STATUT. La passerelle locale
// répond elle aussi 401, avec un autre message : un test qui ne regarde que le
// code prouverait qu'un gestionnaire jamais atteint refuse bien. Même raison que
// tests/backend/edge-service-secret-guard.spec.ts, qui l'écrit en tête.
//
// ⛔ 404 ET JAMAIS 403 POUR UN COMPTE D'UNE AUTRE AGENCE. `loadVisibleAccount`
// (_shared/mail/guard.ts) rend `null` aussi bien pour un id inexistant que pour
// un id appartenant à un tiers, et les cinq edges le traduisent en `not_found`.
// Un 403 dirait « cet id existe, mais pas pour vous » : un oracle d'existence
// inter-agences, exactement ce que la garde est là pour ne pas offrir. Ce fichier
// fige donc le 404, dans les trois edges qui prennent un `account_id`.
//
// Ordre des refus, tel que le code le pose — un test qui l'ignore mesure autre
// chose que ce qu'il annonce :
//   mail-oauth start    provider (400) → origine (400) → clientId (503)
//   mail-send           auth (401) → compte visible (404) → statut (409) → destinataire (400)
//   mail-sync           account_id présent ? auth agent : secret de service (401)
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'
import { waitForEdgeWorker } from './helpers/edge'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'

// ⚠ `||` et non `??` : en CI la variable peut être exportée VIDE, et `??` ne
// retomberait pas. Même repli que agency-verification-run.spec.ts:115.
// Le JWT legacy est ce que le runtime edge injecte sous SUPABASE_SERVICE_ROLE_KEY ;
// une clé `sb_secret_…` est un credential valide mais AUTRE, et rendrait 401.
const SERVICE_JWT = process.env.SUPABASE_TEST_SERVICE_ROLE_JWT || process.env.SUPABASE_TEST_SERVICE_ROLE_KEY || ''

const FN = (name: string) => `${URL}/functions/v1/${name}`
const NAMES = ['mail-oauth', 'mail-sync', 'mail-actions', 'mail-send', 'mail-attachment']

/** Edges dont la garde est `requireAgentAuth` — leur refus anonyme dit « Authentication required ». */
const AGENT_EDGES = ['mail-oauth', 'mail-actions', 'mail-send']

describe.skipIf(!HAS_KEYS)('Messagerie — contrats HTTP des edges', () => {
  let s: TwoAgenciesSetup
  let jwtA: string
  let boxAId: string
  let boxBId: string

  const call = async (name: string, body: unknown, jwt?: string, method = 'POST') => {
    const res = await fetch(FN(name), {
      method,
      headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
      body: method === 'GET' ? undefined : JSON.stringify(body),
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
    // Deux boîtes : l'une INVISIBLE à l'agent A (autre agence) pour éprouver le 404,
    // l'autre VISIBLE (la sienne) pour atteindre les contrôles qui viennent APRÈS
    // la garde. Sans la seconde, « mail-send sans destinataire » rendrait 404 sur le
    // compte et passerait pour la bonne raison sans jamais toucher le bon code.
    // `status` vaut 'active' par défaut (migration 20260903120000) : le contrôle 409
    // ne s'interpose donc pas.
    const mk = async (agencyId: string, ownerId: string, email: string) => {
      const { data: row, error } = await service.from('mail_accounts')
        .insert({ agency_id: agencyId, owner_id: ownerId, provider: 'gmail', email, visibility: 'agency' })
        .select('id').single()
      if (error) throw new Error(`mail_accounts ${email}: ${error.message}`)
      return row.id as string
    }
    boxAId = await mk(s.agencyAId, s.agentAId, `a-${s.stamp}@a.test`)
    boxBId = await mk(s.agencyBId, s.agentBId, `b-${s.stamp}@b.test`)
    await Promise.all(NAMES.map((n) => waitForEdgeWorker(FN(n))))
  }, 180_000)

  afterAll(async () => {
    const service = serviceRoleClient()
    await service.from('mail_accounts').delete().in('id', [boxAId, boxBId])
    await s.cleanup()
  })

  it('sans jeton : chaque edge agent refuse AVANT toute configuration', async () => {
    for (const n of AGENT_EDGES) {
      const r = await call(n, { action: 'start' })
      expect(r.status, `${n} : ${r.text.slice(0, 200)}`).toBe(401)
      expect(String(r.json.error), n).toMatch(/Authentication required/i)
    }
    // mail-attachment garde AVANT de trancher GET/POST : la sonde GET refuse pareil.
    const g = await call('mail-attachment', null, undefined, 'GET')
    expect(g.status).toBe(401)
    expect(String(g.json.error)).toMatch(/Authentication required/i)
  })

  it('mail-oauth start : URL Google + state, ou 503 lisible si le client n est pas configuré en local', async () => {
    const r = await call('mail-oauth', { action: 'start', provider: 'gmail', origin: 'http://localhost:5173' }, jwtA)
    // GOOGLE_CLIENT_ID n'est pas injecté dans le runtime local : les deux issues
    // sont des contrats, et c'est le 503 qui prouve que la garde a bien couru
    // AVANT la lecture de configuration (règle 4 du lot).
    if (r.status === 503) {
      expect(r.json.error).toBe('provider_not_configured')
      expect(r.json.provider).toBe('gmail')
      return
    }
    expect(r.status, r.text.slice(0, 200)).toBe(200)
    expect(String(r.json.url)).toContain('https://accounts.google.com/o/oauth2/v2/auth?')
    expect(String(r.json.url)).toContain('gmail.modify')
    // randomToken(32) → 32 octets en hexadécimal = 64 caractères.
    expect(String(r.json.state)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('mail-oauth : origine hors liste → 400 invalid_origin ; state inconnu → 403 invalid_state', async () => {
    // `evil.example` n'est pas dans MAIL_OAUTH_ORIGINS : le refus tombe AVANT la
    // lecture du client, donc ce cas ne dépend pas de la configuration locale.
    const bad = await call('mail-oauth', { action: 'start', provider: 'gmail', origin: 'https://evil.example' }, jwtA)
    expect(bad.status, bad.text.slice(0, 200)).toBe(400)
    expect(bad.json.error).toBe('invalid_origin')
    // 64 caractères hexadécimaux : la FORME est valide, la ligne n'existe pas.
    // Un state mal formé rendrait le même 403 sans jamais interroger la base — on
    // veut ici le refus qui vient de la LECTURE, pas de la validation de syntaxe.
    const ex = await call('mail-oauth', { action: 'exchange', code: 'x', state: 'a'.repeat(64) }, jwtA)
    expect(ex.status, ex.text.slice(0, 200)).toBe(403)
    expect(ex.json.error).toBe('invalid_state')
  })

  it('mail-actions / mail-send / mail-oauth disconnect : un compte d une autre agence est introuvable (404), jamais 403', async () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ['mail-actions', { action: 'mark_read', account_id: boxBId, thread_id: 'x' }],
      ['mail-send', { account_id: boxBId, kind: 'new', to: [{ email: 'a@b.ch' }], subject: 's', body_text: 'b' }],
      ['mail-oauth', { action: 'disconnect', account_id: boxBId }],
    ]
    for (const [name, body] of cases) {
      const r = await call(name, body, jwtA)
      expect(r.status, `${name} : ${r.text.slice(0, 200)}`).toBe(404)
      expect(r.json.error, name).toBe('not_found')
    }
  })

  it('mail-attachment : GET inconnu → 404 ; POST sans action → 400', async () => {
    const g = await fetch(`${FN('mail-attachment')}?id=00000000-0000-0000-0000-000000000000`, {
      headers: { Authorization: `Bearer ${jwtA}` },
    })
    expect(g.status).toBe(404)
    const p = await call('mail-attachment', { action: 'nope' }, jwtA)
    expect(p.status, p.text.slice(0, 200)).toBe(400)
    expect(p.json.error).toBe('unknown_action')
  })

  it('mail-send : sans destinataire → 400, sur une boîte que l appelant VOIT', async () => {
    // §7.2 du plan maître. La boîte est celle de l'agence A : la garde passe, le
    // statut est 'active', et le refus vient donc bien du contrôle de destinataire.
    const r = await call('mail-send', { account_id: boxAId, kind: 'new', subject: 's', body_text: 'b' }, jwtA)
    expect(r.status, r.text.slice(0, 200)).toBe(400)
    expect(r.json.error).toBe('recipient_required')
  })

  it('mail-sync : sans secret 401 ; avec la clé service, balayage OK et verrou relâché', async () => {
    // Message propre à cette edge : sa garde est `isServiceSecret`, pas
    // `requireAgentAuth` — d'où `unauthorized` et non « Authentication required ».
    const anon = await call('mail-sync', {})
    expect(anon.status, anon.text.slice(0, 200)).toBe(401)
    expect(anon.json.error).toBe('unauthorized')

    const r = await call('mail-sync', {}, SERVICE_JWT)
    expect(r.status, r.text.slice(0, 200)).toBe(200)
    expect(r.json.ok).toBe(true)
    // Le verrou est pris puis relâché dans un `finally` : un second balayage doit
    // pouvoir le reprendre. S'il rendait `skipped: 'locked'`, le bail resterait posé
    // 180 s après chaque tick et la synchro s'arrêterait sans une seule erreur.
    const again = await call('mail-sync', {}, SERVICE_JWT)
    expect(again.json.skipped, 'le verrou doit être relâché après un balayage').toBeUndefined()
  })
})
