// Lot 2 — cloisonnement entre agences : trois failles, trois verrous.
//
// Le point commun des trois : la fonction PROUVAIT que l'appelant est un agent
// connecté, puis interrogeait la base avec un client SERVICE-ROLE (RLS
// contournée) filtré sur le seul id venu du corps de la requête. Authentifier
// n'est pas autoriser. Et l'inscription publique auto-provisionne un profil +
// une agence : obtenir un JWT d'agent valide prend une minute, donc « il faut
// être connecté » ne protège rien.
//
// Chaque volet est doublé d'un TÉMOIN POSITIF (le flux légitime passe encore).
// Sans lui, on « corrigerait » une fuite en cassant la fonctionnalité, et la
// suite resterait verte.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_JWT)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'

async function tokenOf(client: TwoAgenciesSetup['clientA']): Promise<string> {
  const { data } = await client.auth.getSession()
  const t = data.session?.access_token
  if (!t) throw new Error('session attendue')
  return t
}

async function invoke(fn: string, jwt: string, body: unknown) {
  const res = await fetch(`${URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json().catch(() => ({})) as Record<string, unknown> }
}

describe.skipIf(!HAS_KEYS)('Lot 2 — cloisonnement inter-agences', () => {
  let setup: TwoAgenciesSetup
  const service = serviceRoleClient()
  let contactAId = ''
  let propAId = ''
  let visitAId = ''
  let searchAId = ''
  let inviteAId = ''

  beforeAll(async () => {
    setup = await setupTwoAgencies()

    const { data: contact, error: ec } = await service.from('contacts')
      .insert({
        agency_id: setup.agencyAId,
        first_name: 'Acheteur', last_name: `A ${setup.stamp}`,
        email: `acheteur-a-${setup.stamp}@megga-test.local`,
        type: 'buyer',
      })
      .select('id').single()
    if (ec) throw new Error(`contactA: ${ec.message}`)
    contactAId = contact.id

    const { data: prop, error: ep } = await service.from('properties')
      .insert({ agency_id: setup.agencyAId, title: `Bien A ${setup.stamp}`, status: 'active' })
      .select('id').single()
    if (ep) throw new Error(`propA: ${ep.message}`)
    propAId = prop.id

    const { data: visit, error: ev } = await service.from('visits')
      .insert({
        agency_id: setup.agencyAId, property_id: propAId, contact_id: contactAId,
        scheduled_at: new Date('2030-01-01T10:00:00Z').toISOString(),
        buyer_name: 'Acheteur A', buyer_email: `buyer-a-${setup.stamp}@megga-test.local`,
        buyer_phone: '+41 79 000 00 00',
      })
      .select('id').single()
    if (ev) throw new Error(`visitA: ${ev.message}`)
    visitAId = visit.id

    const { data: search, error: es } = await service.from('client_searches')
      .insert({
        agency_id: setup.agencyAId, contact_id: contactAId, is_active: true,
        label: `Recherche A ${setup.stamp}`,
        criteria: { transaction_type: 'buy', price_max: 2000000 },
      })
      .select('id').single()
    if (es) throw new Error(`searchA: ${es.message}`)
    searchAId = search.id

    // Invitation légitime de l'agence A, cible de la tentative de réécriture.
    const { data: invite, error: ei } = await service.from('team_invitations')
      .insert({
        agency_id: setup.agencyAId, email: `invite-${setup.stamp}@megga-test.local`,
        role: 'agent', invited_by: setup.agentAId,
      })
      .select('id').single()
    if (ei) throw new Error(`inviteA: ${ei.message}`)
    inviteAId = invite.id

    // Jeton Google bidon pour l'agent B : `getValidToken` renvoie l'access_token
    // tel quel tant que l'expiration est lointaine (aucun appel réseau). Sans
    // lui, `create_event` s'arrêterait sur « not connected » AVANT la lecture de
    // la visite — le test ne prouverait alors rien du cloisonnement.
    const { error: et } = await service.from('google_calendar_tokens').insert({
      user_id: setup.agentBId,
      access_token: 'fake-access-token-for-test',
      refresh_token: 'fake-refresh-token-for-test',
      token_expires_at: new Date('2030-01-01T00:00:00Z').toISOString(),
    })
    if (et) throw new Error(`tokensB: ${et.message}`)
  })

  afterAll(async () => {
    await service.from('google_calendar_tokens').delete().eq('user_id', setup.agentBId)
    await service.from('matches').delete().eq('contact_id', contactAId)
    if (inviteAId) await service.from('team_invitations').delete().eq('id', inviteAId)
    await service.from('team_invitations').delete().eq('agency_id', setup.agencyAId)
    if (searchAId) await service.from('client_searches').delete().eq('id', searchAId)
    if (visitAId) await service.from('visits').delete().eq('id', visitAId)
    if (propAId) await service.from('properties').delete().eq('id', propAId)
    if (contactAId) await service.from('contacts').delete().eq('id', contactAId)
    await setup?.cleanup()
  })

  // ── 1. team_invitations : le token d'invitation vaut attribution de rôle ──

  it("un agent simple ne peut PAS créer d'invitation, même dans sa propre agence", async () => {
    const { error } = await setup.clientA.from('team_invitations').insert({
      agency_id: setup.agencyAId,
      email: `escalade-${setup.stamp}@megga-test.local`,
      role: 'admin',
      invited_by: setup.agentAId,
    })
    expect(error, "l'insertion aurait dû être refusée par la RLS").toBeTruthy()
  })

  it("un agent simple ne peut PAS réécrire une invitation existante (rôle ni e-mail)", async () => {
    await setup.clientA.from('team_invitations')
      .update({ email: `moi-${setup.stamp}@megga-test.local`, role: 'admin' })
      .eq('id', inviteAId)

    // L'UPDATE d'une ligne invisible/interdite ne lève pas toujours une erreur
    // PostgREST : c'est l'ÉTAT en base qui fait foi, relu en service_role.
    const { data: after } = await service.from('team_invitations')
      .select('email, role').eq('id', inviteAId).single()
    expect(after?.role, 'le rôle de l’invitation a été réécrit').toBe('agent')
    expect(after?.email, 'l’e-mail de l’invitation a été réécrit').toContain('invite-')
  })

  it('TÉMOIN — un admin de la même agence peut toujours inviter', async () => {
    await service.from('profiles').update({ role: 'admin' }).eq('id', setup.agentAId)
    try {
      const { error } = await setup.clientA.from('team_invitations').insert({
        agency_id: setup.agencyAId,
        email: `legit-${setup.stamp}@megga-test.local`,
        role: 'agent',
        invited_by: setup.agentAId,
      })
      expect(error, `un admin doit pouvoir inviter — ${error?.message ?? ''}`).toBeNull()
    } finally {
      await service.from('profiles').update({ role: 'agent' }).eq('id', setup.agentAId)
    }
  })

  it("un manager ne peut PAS s'auto-promouvoir en invitant au rôle admin", async () => {
    // Le trou que laissait la première version du correctif : `is_agency_admin()`
    // vaut admin OU manager, donc un manager sautait `send-team-invite` (où vit
    // la garde de rang applicative) et écrivait en direct via PostgREST une
    // invitation `admin` à son propre e-mail. Le rang doit vivre DANS la policy.
    await service.from('profiles').update({ role: 'manager' }).eq('id', setup.agentAId)
    try {
      const { error: refus } = await setup.clientA.from('team_invitations').insert({
        agency_id: setup.agencyAId,
        email: `manager-escalade-${setup.stamp}@megga-test.local`,
        role: 'admin',
        invited_by: setup.agentAId,
      })
      expect(refus, 'un manager ne doit pas pouvoir inviter au rôle admin').toBeTruthy()

      // TÉMOIN : il peut toujours inviter à son propre niveau ou en dessous.
      const { error: permis } = await setup.clientA.from('team_invitations').insert({
        agency_id: setup.agencyAId,
        email: `manager-legit-${setup.stamp}@megga-test.local`,
        role: 'agent',
        invited_by: setup.agentAId,
      })
      expect(permis, `un manager doit pouvoir inviter un agent — ${permis?.message ?? ''}`).toBeNull()
    } finally {
      await service.from('profiles').update({ role: 'agent' }).eq('id', setup.agentAId)
    }
  })

  it("le rôle 'assistant' reste invitable (il est dans AGENT_ROLES)", async () => {
    await service.from('profiles').update({ role: 'admin' }).eq('id', setup.agentAId)
    try {
      const { error } = await setup.clientA.from('team_invitations').insert({
        agency_id: setup.agencyAId,
        email: `assistant-${setup.stamp}@megga-test.local`,
        role: 'assistant',
        invited_by: setup.agentAId,
      })
      expect(error, `'assistant' est un rôle légitime — ${error?.message ?? ''}`).toBeNull()
    } finally {
      await service.from('profiles').update({ role: 'agent' }).eq('id', setup.agentAId)
    }
  })

  // ── 2. matching-engine : match-contact acceptait un contact d'une autre agence ──

  it("matching-engine ignore un contact_id d'une autre agence", async () => {
    const jwtB = await tokenOf(setup.clientB)
    const { body } = await invoke('matching-engine', jwtB, {
      mode: 'match-contact', contact_id: contactAId, agency_id: setup.agencyBId,
    })

    expect(body.newMatches ?? 0, 'aucun match ne doit être créé').toBe(0)

    // Le vrai dégât n'était pas la lecture mais l'ÉCRITURE : les lignes créées
    // portaient l'agence de l'appelant sur le contact d'une autre, et l'index
    // unique (contact_id, market_listing_id) les rendait alors définitives —
    // l'agence propriétaire ne pouvait plus jamais créer les siennes.
    const { data: leaked } = await service.from('matches')
      .select('id').eq('contact_id', contactAId).eq('agency_id', setup.agencyBId)
    expect(leaked ?? [], "l'agence B a écrit des matches sur le contact de A").toHaveLength(0)
  })

  it("TÉMOIN — l'agence propriétaire déclenche toujours son propre matching", async () => {
    const jwtA = await tokenOf(setup.clientA)
    const { status, body } = await invoke('matching-engine', jwtA, {
      mode: 'match-contact', contact_id: contactAId, agency_id: setup.agencyAId,
    })
    expect(status, `attendu 200, reçu ${status} — ${JSON.stringify(body)}`).toBe(200)
    // La recherche de A est bien trouvée : le moteur ne répond PAS « aucune
    // recherche active ». Le nombre de matches dépend du corpus, on ne l'assert pas.
    expect(body.message ?? '', JSON.stringify(body)).not.toBe('No active searches')
  })

  // ── 3. calendriers : create_event / update_event lisaient n'importe quelle visite ──

  it("google-calendar-sync refuse une visite d'une autre agence", async () => {
    const jwtB = await tokenOf(setup.clientB)
    const { body } = await invoke('google-calendar-sync', jwtB, {
      action: 'create_event', visit_id: visitAId,
    })

    // « Visit not found » = la requête a bien été filtrée par agence. Un
    // « not connected » signifierait que le test s'arrête trop tôt et ne prouve
    // rien ; c'est pour l'éviter que le jeton bidon est semé.
    expect(String(body.error ?? ''), JSON.stringify(body)).toContain('Visit not found')

    // Et aucune écriture en retour sur la visite de la victime.
    const { data: visit } = await service.from('visits')
      .select('video_link').eq('id', visitAId).single()
    expect(visit?.video_link ?? null, 'video_link écrit sur la visite d’une autre agence').toBeNull()
  })

  it("outlook-calendar-sync refuse une visite d'une autre agence", async () => {
    const jwtB = await tokenOf(setup.clientB)
    const { body } = await invoke('outlook-calendar-sync', jwtB, {
      action: 'update_event', visit_id: visitAId,
    })
    // Outlook n'a pas de jeton semé pour B : on vérifie seulement qu'aucun
    // chemin ne renvoie les données de la visite de A.
    expect(JSON.stringify(body), 'des données de la visite de A ont fuité').not.toContain('Acheteur A')
  })
})
