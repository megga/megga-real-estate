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
// fige le 404 dans les QUATRE edges qui décident d'une visibilité : mail-actions,
// mail-send et mail-oauth par leur `account_id`, et mail-attachment — le seul qui
// rende des OCTETS — par le compte qu'il déduit de l'`attachment_id`. La version
// livrée annonçait « les trois edges qui prennent un account_id », ce qui excluait
// en silence le cas de plus grande valeur.
//
// ⛔ ET LA FIXTURE DÉCISIVE EST `boxAinB` : une boîte de l'AGENCE B dont le
// PROPRIÉTAIRE est l'agent A. C'est la seule forme qui distingue le prédicat
// CONJOINT (`agence == agence && (visibilité=='agency' || propriétaire==moi)`) de
// sa régression en DISJONCTION — celle que 58f250a8 a dû corriger, et qui rend un
// ex-employé lecteur à vie de son ancienne boîte. Une boîte de l'agence B possédée
// par l'agent B rend `false` sous les DEUX prédicats : le test restait vert pendant
// que tous les edges fuyaient.
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
  /** Agence B, propriétaire = agent A : la forme d'après-départ (voir l'en-tête). */
  let boxAinBId: string
  /** Pièce jointe portée par `boxAinBId` (agence B) et par `boxBId`. */
  let attInBId: string
  let attOfBId: string

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
    // `status` vaut 'active' par défaut (migration 20260904074500) : le contrôle 409
    // ne s'interpose donc pas.
    const mk = async (agencyId: string, ownerId: string, email: string, visibility: 'agency' | 'owner' = 'agency') => {
      const { data: row, error } = await service.from('mail_accounts')
        .insert({ agency_id: agencyId, owner_id: ownerId, provider: 'gmail', email, visibility })
        .select('id').single()
      if (error) throw new Error(`mail_accounts ${email}: ${error.message}`)
      return row.id as string
    }
    boxAId = await mk(s.agencyAId, s.agentAId, `a-${s.stamp}@a.test`)
    boxBId = await mk(s.agencyBId, s.agentBId, `b-${s.stamp}@b.test`)
    // ⚠ `visibility: 'owner'` en plus de l'agence étrangère : sous le prédicat correct
    // les DEUX moitiés refusent, sous la disjonction régressée `owner_id === moi` suffit
    // à ouvrir. C'est ce compte-là qui rend la conjonction porteuse.
    boxAinBId = await mk(s.agencyBId, s.agentAId, `ab-${s.stamp}@b.test`, 'owner')

    // Une pièce jointe réelle dans chacune des deux boîtes de l'agence B : sans ligne,
    // mail-attachment sort au premier `.eq('id', …)` et n'atteint JAMAIS le contrôle de
    // visibilité — c'est ce que faisait l'unique sonde sur l'UUID nul.
    const seedAttachment = async (accountId: string, agencyId: string, tag: string) => {
      const { data: th, error: eTh } = await service.from('mail_threads')
        .insert({ account_id: accountId, agency_id: agencyId, provider_thread_id: `t-${tag}-${s.stamp}`, subject: 'Mandat' })
        .select('id').single()
      if (eTh) throw new Error(`mail_threads ${tag}: ${eTh.message}`)
      const { data: m, error: eM } = await service.from('mail_messages').insert({
        thread_id: th.id, account_id: accountId, agency_id: agencyId,
        provider_message_id: `m-${tag}-${s.stamp}`, direction: 'inbound', sent_at: new Date().toISOString(),
        has_attachments: true,
      }).select('id').single()
      if (eM) throw new Error(`mail_messages ${tag}: ${eM.message}`)
      const { data: a, error: eA } = await service.from('mail_attachments').insert({
        message_id: m.id, account_id: accountId, agency_id: agencyId,
        provider_attachment_id: `att-${tag}-${s.stamp}`, filename: 'mandat.pdf', mime_type: 'application/pdf', size_bytes: 1024,
      }).select('id').single()
      if (eA) throw new Error(`mail_attachments ${tag}: ${eA.message}`)
      return a.id as string
    }
    attInBId = await seedAttachment(boxAinBId, s.agencyBId, 'ab')
    attOfBId = await seedAttachment(boxBId, s.agencyBId, 'b')
    await Promise.all(NAMES.map((n) => waitForEdgeWorker(FN(n))))
  }, 180_000)

  afterAll(async () => {
    const service = serviceRoleClient()
    // Les fils, messages et pièces partent en cascade avec les comptes.
    await service.from('mail_accounts').delete().in('id', [boxAId, boxBId, boxAinBId])
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

  // ⛔ L'ÉCHAPPATOIRE 503 A ÉTÉ RETIRÉE, ET C'EST TOUT L'INTÉRÊT DU TEST. `GOOGLE_CLIENT_ID`
  // n'était pas injecté dans le runtime local, donc `mail-oauth:56` court-circuitait en 503
  // à CHAQUE exécution : la construction de l'URL d'autorisation, le défi PKCE,
  // `randomToken` et l'insertion dans `mail_oauth_states` n'étaient exercés PAR RIEN — un
  // scope erroné ou un défi cassé serait passé au vert. Le secret est désormais posé en
  // valeur de test dans `[edge_runtime.secrets]` (supabase/config.toml) ; aucun appel n'est
  // fait vers Google, seule la CONSTRUCTION est éprouvée. Et la justification d'origine
  // était fausse par-dessus le marché : le 503 ne prouvait pas que la garde avait couru
  // avant la configuration, seulement que le clientId était vide — cet ordre-là est prouvé
  // par le test anonyme 401 ci-dessus.
  it('mail-oauth start : URL d autorisation, scope, PKCE et ligne mail_oauth_states', async () => {
    const r = await call('mail-oauth', { action: 'start', provider: 'gmail', origin: 'http://localhost:5173', visibility: 'agency' }, jwtA)
    expect(r.status, r.text.slice(0, 200)).toBe(200)
    const url = new globalThis.URL(String(r.json.url))
    expect(`${url.origin}${url.pathname}`).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('scope')).toContain('gmail.modify')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    // base64url de 32 octets = 43 caractères sans bourrage.
    expect(String(url.searchParams.get('code_challenge'))).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:5173/oauth/mail/callback')
    // Sans `access_type=offline` + `prompt=consent`, Google ne rend pas de refresh_token
    // à une seconde autorisation du même compte : la boîte se déconnecterait toute seule.
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('prompt')).toBe('consent')
    // randomToken(32) → 32 octets en hexadécimal = 64 caractères.
    const state = String(r.json.state)
    expect(state).toMatch(/^[0-9a-f]{64}$/)
    expect(url.searchParams.get('state')).toBe(state)

    // La ligne EXISTE et porte le verifier : sans elle, l'échange qui suit est perdu.
    const service = serviceRoleClient()
    const { data: row, error } = await service.from('mail_oauth_states')
      .select('code_verifier, redirect_uri, provider, visibility, user_id, agency_id, consumed_at')
      .eq('state', state).maybeSingle()
    if (error) throw new Error(`mail_oauth_states: ${error.message}`)
    expect(row, 'aucune ligne mail_oauth_states pour ce state').toBeTruthy()
    expect(String(row!.code_verifier)).toMatch(/^[0-9a-f]{96}$/) // randomToken(48)
    expect(row!.redirect_uri).toBe('http://localhost:5173/oauth/mail/callback')
    expect(row!.provider).toBe('gmail')
    expect(row!.visibility).toBe('agency')
    expect(row!.user_id).toBe(s.agentAId)
    expect(row!.agency_id).toBe(s.agencyAId)
    expect(row!.consumed_at).toBeNull()
    await service.from('mail_oauth_states').delete().eq('state', state)
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

  // ⛔ LE SEUL CAS QUI RENDE LA CONJONCTION PORTEUSE (voir l'en-tête). `boxAinB` est
  // possédée par l'APPELANT mais vit dans l'agence B : sous le prédicat correct les deux
  // moitiés refusent ; sous la disjonction régressée — celle que 58f250a8 a corrigée —
  // `owner_id === ctx.userId` ouvre tout, et `mail-oauth disconnect` SUPPRIMERAIT la
  // boîte d'une autre agence en répondant 200. C'est la forme d'après-départ :
  // `team_remove_member` laisse la ligne mail_accounts intacte, puis l'ex-membre est
  // rattaché ailleurs.
  it('une boîte d une AUTRE agence dont l appelant est propriétaire reste introuvable (404)', async () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ['mail-actions', { action: 'mark_read', account_id: boxAinBId, thread_id: 'x' }],
      ['mail-actions', { action: 'sync_now', account_id: boxAinBId }],
      ['mail-send', { account_id: boxAinBId, kind: 'new', to: [{ email: 'a@b.ch' }], subject: 's', body_text: 'b' }],
      ['mail-oauth', { action: 'disconnect', account_id: boxAinBId }],
      ['mail-oauth', { action: 'update', account_id: boxAinBId, display_name: 'volé' }],
      ['mail-sync', { account_id: boxAinBId }],
    ]
    for (const [name, body] of cases) {
      const r = await call(name, body, jwtA)
      expect(r.status, `${name} ${String(body.action ?? '')} : ${r.text.slice(0, 200)}`).toBe(404)
      expect(r.json.error, `${name} ${String(body.action ?? '')}`).toBe('not_found')
    }
    // Et la boîte est TOUJOURS là : un `disconnect` qui aurait passé la garde l'aurait
    // effacée, et les cinq assertions ci-dessus n'en sauraient rien.
    const service = serviceRoleClient()
    const { data } = await service.from('mail_accounts').select('id').eq('id', boxAinBId).maybeSingle()
    expect(data, 'la boîte de l agence B a été supprimée par l agent A').toBeTruthy()
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

  // ⛔ mail-attachment est le SEUL edge qui rende des octets de message, et il déduit le
  // compte de l'`attachment_id` : `accountVisibleTo` (index.ts) y est l'unique barrière
  // inter-locataires. La sonde sur l'UUID nul sortait au premier `.eq('id', …)` sans
  // JAMAIS l'atteindre — la garde pouvait être retirée, la suite restait verte. Ces deux
  // pièces EXISTENT, donc le refus vient bien du contrôle de visibilité.
  it('mail-attachment : les octets d une autre agence restent hors de portée (404), GET et classement', async () => {
    for (const [libelle, id] of [['agence B, propriétaire agent B', attOfBId], ['agence B, propriétaire APPELANT', attInBId]] as const) {
      const g = await fetch(`${FN('mail-attachment')}?id=${id}`, { headers: { Authorization: `Bearer ${jwtA}` } })
      const gText = await g.text()
      expect(g.status, `GET ${libelle} : ${gText.slice(0, 200)}`).toBe(404)
      expect(JSON.parse(gText).error, `GET ${libelle}`).toBe('not_found')
      const p = await call('mail-attachment', { action: 'file', attachment_id: id, contact_id: '00000000-0000-0000-0000-000000000001', document_type: 'mandat' }, jwtA)
      expect(p.status, `POST file ${libelle} : ${p.text.slice(0, 200)}`).toBe(404)
      expect(p.json.error, `POST file ${libelle}`).toBe('not_found')
    }
  })

  it('mail-send : sans destinataire → 400, sur une boîte que l appelant VOIT', async () => {
    // §7.2 du plan maître. La boîte est celle de l'agence A : la garde passe, le
    // statut est 'active', et le refus vient donc bien du contrôle de destinataire.
    const r = await call('mail-send', { account_id: boxAId, kind: 'new', subject: 's', body_text: 'b' }, jwtA)
    expect(r.status, r.text.slice(0, 200)).toBe(400)
    expect(r.json.error).toBe('recipient_required')
  })

  // ⛔ `expect(r.json.ok).toBe(true)` NE MESURAIT RIEN. Il passait quand les deux comptes
  // échouaient, quand ZÉRO compte était lu — c'est-à-dire dans la panne la plus dangereuse
  // du module, la file illisible qui rend `{ ok: true, synced: 0 }` avec pg_cron au vert —
  // et le contrôle du verrou passait même si le second balayage rendait 500, `skipped`
  // étant alors simplement absent d'un corps non analysable. On asserte donc la FORME, le
  // CONTENU, et l'état laissé en base.
  it('mail-sync : sans secret 401 ; avec la clé service, les comptes dus sont RÉELLEMENT traités et le verrou relâché', async () => {
    // Message propre à cette edge : sa garde est `isServiceSecret`, pas
    // `requireAgentAuth` — d'où `unauthorized` et non « Authentication required ».
    const anon = await call('mail-sync', {})
    expect(anon.status, anon.text.slice(0, 200)).toBe(401)
    expect(anon.json.error).toBe('unauthorized')

    const service = serviceRoleClient()
    const nos = [boxAId, boxBId, boxAinBId]
    // Date volontairement très ancienne : le balayage prend les 25 plus anciens dus, et
    // rien ne garantit qu'une autre spec n'a pas laissé de comptes en file.
    const { error: eDue } = await service.from('mail_accounts')
      .update({ next_sync_at: '2000-01-01T00:00:00Z', last_error: null, sync_failures: 0, status: 'active' })
      .in('id', nos)
    if (eDue) throw new Error(`mise en file: ${eDue.message}`)

    const r = await call('mail-sync', {}, SERVICE_JWT)
    expect(r.status, r.text.slice(0, 200)).toBe(200)
    expect(r.json.ok).toBe(true)
    const results = r.json.results as { account_id: string; error: string | null }[]
    expect(Array.isArray(results), `results absent : ${r.text.slice(0, 200)}`).toBe(true)
    // `synced` DOIT décrire `results` : c'est ce compte que pg_cron voit passer.
    expect(r.json.synced).toBe(results.length)
    for (const id of nos) {
      const ligne = results.find((x) => x.account_id === id)
      expect(ligne, `le compte ${id} était dû et n a pas été traité`).toBeTruthy()
      // Aucun de ces comptes n'a de secret Vault : la passe DOIT échouer, et le dire.
      expect(ligne!.error, `le compte ${id} n a pas rendu d erreur alors qu il n a aucun secret`).toBeTruthy()
    }

    // L'échec doit être ÉCRIT : sans `last_error`, une boîte morte est indiscernable
    // d'une boîte saine sans courrier neuf.
    const { data: apres, error: eApres } = await service.from('mail_accounts')
      .select('id, status, last_error, sync_failures').in('id', nos)
    if (eApres) throw new Error(`relecture: ${eApres.message}`)
    for (const id of nos) {
      const row = apres!.find((x) => x.id === id)!
      expect(row.last_error, `last_error non écrit pour ${id}`).toBeTruthy()
      expect(row.sync_failures, `sync_failures non incrémenté pour ${id}`).toBeGreaterThanOrEqual(1)
    }
    // ⛔ ET LA BOÎTE DE L'AGENCE B DONT LE PROPRIÉTAIRE EST AILLEURS EST DÉSARMÉE.
    // C'est le miroir écriture de `mail_account_visible` : sans lui, le balayage
    // continuait d'ingérer le courrier d'un agent parti dans son ANCIENNE agence, toutes
    // les deux minutes, indéfiniment. `disabled` la sort de `mail_accounts_due_idx`.
    const parti = apres!.find((x) => x.id === boxAinBId)!
    expect(parti.status, 'la boîte au propriétaire hors agence est restée dans le balayage').toBe('disabled')
    expect(String(parti.last_error)).toMatch(/owner_left_agency/)
    // Les deux boîtes saines, elles, échouent de façon TRANSITOIRE (secret absent) et
    // restent actives : un seul échec ne doit pas éteindre une boîte.
    for (const id of [boxAId, boxBId]) expect(apres!.find((x) => x.id === id)!.status, id).toBe('active')

    // Le verrou est pris puis relâché dans un `finally` : un second balayage doit
    // pouvoir le reprendre. S'il restait posé, la synchro s'arrêterait 180 s après
    // chaque tick sans une seule erreur.
    const again = await call('mail-sync', {}, SERVICE_JWT)
    expect(again.status, `second balayage : ${again.text.slice(0, 200)}`).toBe(200)
    expect(again.json.skipped, 'le verrou doit être relâché après un balayage').toBeUndefined()
    // Lu en base plutôt qu'inféré : `skipped` absent d'un corps illisible ne prouve rien.
    const { data: bail, error: eBail } = await service.from('mail_cron_locks')
      .select('locked_until').eq('job', 'mail-sync').maybeSingle()
    if (eBail) throw new Error(`mail_cron_locks: ${eBail.message}`)
    expect(bail, 'la ligne de bail mail-sync est absente').toBeTruthy()
    expect(new Date(String(bail!.locked_until)).getTime(), 'le bail est encore tenu après le balayage')
      .toBeLessThanOrEqual(Date.now())
  })
})
