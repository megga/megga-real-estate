// INVITATIONS D'ÉQUIPE — plafond de sièges (limite de plan, INACTIF par défaut) et quota
// d'envoi (garde-fou anti-abus, ACTIF). Migration 20260914090100, edge `send-team-invite`.
//
// ⛔ LE DÉFAUT D'ORIGINE (13.09.2026) : la limite de sièges appelait une RPC absente de la
// production et ignorait l'erreur — elle ne bloquait jamais —, et rien ne bornait l'envoi.
// Aucune spec n'appelait la fonction au-delà de « sans Authorization → 401 ».
//
// Contre le runtime edge et la base LOCAUX (jamais la production). Chaque refus a son témoin
// positif : sans lui, un verrou qui refuserait tout passerait pour un verrou qui marche.
//   1. QUOTA (actif, interrupteur éteint) : plafond réglé à 2 le temps du test — deux
//      invitations passent, la troisième rend 429 invite_daily_cap sans rien écrire, un renvoi
//      aussi (jeton intact) ; l'agence voisine invite toujours : le quota est PAR agence.
//   2. SIÈGES, interrupteur ÉTEINT (l'état de production) : une agence Starter déjà au-delà
//      de son siège invite quand même — la décision du 13.09.2026 tient.
//   3. SIÈGES, interrupteur ALLUMÉ : 403 plan_limit_reached par l'edge, sans prendre de place
//      de quota ; le trigger refuse l'écriture directe (PostgREST) et la réanimation d'une
//      invitation annulée ; annuler reste permis ; un abonnement Entreprise lève le plafond.
//   4. Les deux RPC sont fermées aux rôles API, et répondent au service.
//
// ⚠ Deux réglages GLOBAUX sont touchés (app_config) : l'interrupteur des limites de plan,
// allumé le moins longtemps possible, et le plafond d'invitations. Tous deux sont remis dans
// un finally ET dans l'afterAll — une autre spec qui inviterait pendant la fenêtre serait
// refusée.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { serviceRoleClient, anonClient } from './helpers/supabase'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { waitForEdgeWorker } from './helpers/edge'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const ENDPOINT = `${URL}/functions/v1/send-team-invite`
const DENIED = '42501'
/** Le plafond que pose la migration — et celui qu'on remet si la clé manquait avant le test. */
const PLAFOND_MIGRATION = '20'

type Reponse = { status: number; body: Record<string, unknown> }

async function jetonDe(client: TwoAgenciesSetup['clientA']): Promise<string> {
  const { data } = await client.auth.getSession()
  const jeton = data.session?.access_token
  if (!jeton) throw new Error('session attendue')
  return jeton
}

async function appeler(jwt: string, corps: Record<string, unknown>): Promise<Reponse> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  })
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> }
}

describe.skipIf(!HAS_KEYS)('INVITATIONS — sièges (inactifs par défaut) et quota d’envoi (actif)', () => {
  let setup: TwoAgenciesSetup
  const service = serviceRoleClient()
  let jwtA = ''
  let jwtB = ''
  let plafondAvant: string | null = null

  const reglage = async (key: string, value: string) => {
    const { error } = await service.from('app_config').upsert({ key, value }, { onConflict: 'key' })
    if (error) throw new Error(`app_config ${key}: ${error.message}`)
  }
  const interrupteur = (valeur: 'true' | 'false') => reglage('plan_limits_enforced', valeur)
  const remettrePlafond = () => reglage('team_invite_daily_cap', plafondAvant ?? PLAFOND_MIGRATION)
  const adresse = (etiquette: string) => `${etiquette}-${setup.stamp}@megga-test.local`
  const inviter = (jwt: string, email: string) => appeler(jwt, { action: 'invite', email, role: 'agent' })

  /** Les envois d'invitation journalisés pour une agence — le compteur du quota. */
  const envoisJournalises = async (agencyId: string): Promise<number> => {
    const { data, error } = await service.from('email_send_log')
      .select('id').eq('agency_id', agencyId).eq('sender', 'send-team-invite')
    if (error) throw new Error(`email_send_log: ${error.message}`)
    return (data ?? []).length
  }
  const invitationsDe = async (agencyId: string) => {
    const { data, error } = await service.from('team_invitations')
      .select('id, email, status, token').eq('agency_id', agencyId)
    if (error) throw new Error(`team_invitations: ${error.message}`)
    return data ?? []
  }

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    // Seuls un admin ou un manager invitent : A et B dirigent chacun leur agence.
    const { error } = await service.from('profiles')
      .update({ role: 'admin' }).in('id', [setup.agentAId, setup.agentBId])
    if (error) throw new Error(`profiles admin: ${error.message}`)
    const { data: cfg } = await service.from('app_config')
      .select('value').eq('key', 'team_invite_daily_cap').maybeSingle()
    plafondAvant = (cfg?.value as string | undefined) ?? null
    await interrupteur('false')
    jwtA = await jetonDe(setup.clientA)
    jwtB = await jetonDe(setup.clientB)
    await waitForEdgeWorker(ENDPOINT)
  }, 90_000)

  afterAll(async () => {
    await interrupteur('false')
    await remettrePlafond()
    if (!setup) return
    await service.from('subscriptions').delete().eq('agency_id', setup.agencyAId)
    await service.from('team_invitations').delete().in('agency_id', [setup.agencyAId, setup.agencyBId])
    await service.from('email_send_log').delete().in('agency_id', [setup.agencyAId, setup.agencyBId])
    await setup.cleanup()
  })

  // ── 1. Quota d'envoi — actif, interrupteur éteint ─────────────────────────────

  it('QUOTA : au-delà du plafond, 429 invite_daily_cap — et le refus n’écrit rien', async () => {
    await reglage('team_invite_daily_cap', '2')
    try {
      for (const n of [1, 2]) {
        const ok = await inviter(jwtB, adresse(`quota-${n}`))
        expect(ok.status, JSON.stringify(ok.body)).toBe(200)
      }
      expect(await envoisJournalises(setup.agencyBId)).toBe(2)

      const refus = await inviter(jwtB, adresse('quota-3'))
      expect(refus.status, JSON.stringify(refus.body)).toBe(429)
      expect(refus.body).toMatchObject({ error: 'invite_daily_cap', dayCap: 2 })
      // Ni invitation, ni ligne de journal pour l'envoi refusé.
      expect((await invitationsDe(setup.agencyBId)).map((i) => i.email).sort())
        .toEqual([adresse('quota-1'), adresse('quota-2')].sort())
      expect(await envoisJournalises(setup.agencyBId)).toBe(2)

      // Un renvoi repart vers la même adresse : il compte, et il est refusé aussi — sans
      // toucher au jeton déjà envoyé.
      const [avant] = (await invitationsDe(setup.agencyBId)).filter((i) => i.email === adresse('quota-1'))
      const renvoi = await appeler(jwtB, { action: 'resend', invitationId: avant.id })
      expect(renvoi.status, JSON.stringify(renvoi.body)).toBe(429)
      const [apres] = (await invitationsDe(setup.agencyBId)).filter((i) => i.id === avant.id)
      expect(apres.token).toBe(avant.token)

      // TÉMOIN : le quota est PAR agence — l'agence A, vierge, invite toujours.
      const voisine = await inviter(jwtA, adresse('voisine'))
      expect(voisine.status, JSON.stringify(voisine.body)).toBe(200)
    } finally {
      await remettrePlafond()
    }
  })

  it('TÉMOIN — sous le plafond, un renvoi passe, fait tourner le jeton et prend sa place', async () => {
    const [avant] = (await invitationsDe(setup.agencyBId)).filter((i) => i.email === adresse('quota-1'))
    const envois = await envoisJournalises(setup.agencyBId)
    const renvoi = await appeler(jwtB, { action: 'resend', invitationId: avant.id })
    expect(renvoi.status, JSON.stringify(renvoi.body)).toBe(200)
    const [apres] = (await invitationsDe(setup.agencyBId)).filter((i) => i.id === avant.id)
    expect(apres.token).not.toBe(avant.token)
    expect(await envoisJournalises(setup.agencyBId)).toBe(envois + 1)
  })

  // ── 2. Sièges, interrupteur ÉTEINT — l'état de production ─────────────────────

  it('SIÈGES ÉTEINTS : une agence Starter déjà au-delà de son siège invite quand même', async () => {
    await interrupteur('false')
    const { data: etat, error } = await service.rpc('team_seat_status', { p_agency_id: setup.agencyAId })
    expect(error).toBeNull()
    // Starter, un siège, deux pris : l'admin A et l'invitation « voisine ».
    expect(etat?.[0]).toMatchObject({ enforced: false, plan: 'starter', seat_cap: 1, seats_used: 2 })

    const r = await inviter(jwtA, adresse('eteint'))
    expect(r.status, JSON.stringify(r.body)).toBe(200)
    // L'écriture directe d'un dirigeant passe aussi : le trigger est inerte.
    const direct = await setup.clientA.from('team_invitations').insert({
      agency_id: setup.agencyAId, email: adresse('direct-eteint'), role: 'agent', invited_by: setup.agentAId,
    })
    expect(direct.error, direct.error?.message).toBeNull()
  })

  // ── 3. Sièges, interrupteur ALLUMÉ ────────────────────────────────────────────

  it('SIÈGES ALLUMÉS : 403 plan_limit_reached, et le trigger tient la table', async () => {
    await interrupteur('true')
    try {
      const envois = await envoisJournalises(setup.agencyAId)
      const r = await inviter(jwtA, adresse('allume'))
      expect(r.status, JSON.stringify(r.body)).toBe(403)
      expect(r.body).toMatchObject({ error: 'plan_limit_reached', plan: 'starter', seatCap: 1 })
      // Refusé AVANT le quota : aucune place prise pour une invitation qui ne part pas.
      expect(await envoisJournalises(setup.agencyAId)).toBe(envois)
      expect((await invitationsDe(setup.agencyAId)).map((i) => i.email)).not.toContain(adresse('allume'))

      // Le trigger : l'écriture directe d'un dirigeant (PostgREST) est refusée elle aussi…
      const direct = await setup.clientA.from('team_invitations').insert({
        agency_id: setup.agencyAId, email: adresse('direct-allume'), role: 'agent', invited_by: setup.agentAId,
      })
      expect(direct.error?.message).toBe('plan_seat_limit')

      // … comme la réanimation d'une invitation annulée, qui reprendrait un siège.
      const { data: annulee, error: seedErr } = await service.from('team_invitations').insert({
        agency_id: setup.agencyAId, email: adresse('annulee'), role: 'agent',
        invited_by: setup.agentAId, status: 'cancelled',
      }).select('id').single()
      if (seedErr) throw new Error(`seed annulee: ${seedErr.message}`)
      const reanimation = await setup.clientA.from('team_invitations')
        .update({ status: 'pending' }).eq('id', annulee.id)
      expect(reanimation.error?.message).toBe('plan_seat_limit')
      const [relue] = (await invitationsDe(setup.agencyAId)).filter((i) => i.id === annulee.id)
      expect(relue.status).toBe('cancelled')

      // TÉMOIN : libérer un siège n'est jamais refusé.
      const annulation = await appeler(jwtA, {
        action: 'cancel',
        invitationId: (await invitationsDe(setup.agencyAId)).find((i) => i.email === adresse('eteint'))!.id,
      })
      expect(annulation.status, JSON.stringify(annulation.body)).toBe(200)
    } finally {
      await interrupteur('false')
    }
  })

  it('SIÈGES ALLUMÉS + abonnement Entreprise : dix sièges, l’invitation passe', async () => {
    const { error: subErr } = await service.from('subscriptions').insert({
      agency_id: setup.agencyAId, stripe_customer_id: `cus_sieges_${setup.stamp}`,
      plan: 'entreprise', status: 'active',
    })
    if (subErr) throw new Error(`seed subscriptions: ${subErr.message}`)
    await interrupteur('true')
    try {
      const { data: etat } = await service.rpc('team_seat_status', { p_agency_id: setup.agencyAId })
      expect(etat?.[0]).toMatchObject({ enforced: true, plan: 'entreprise', seat_cap: 10 })

      const r = await inviter(jwtA, adresse('entreprise'))
      expect(r.status, JSON.stringify(r.body)).toBe(200)
      // Le trigger lit le même plan : l'écriture directe passe aussi.
      const direct = await setup.clientA.from('team_invitations').insert({
        agency_id: setup.agencyAId, email: adresse('direct-entreprise'), role: 'agent', invited_by: setup.agentAId,
      })
      expect(direct.error, direct.error?.message).toBeNull()
    } finally {
      await interrupteur('false')
      await service.from('subscriptions').delete().eq('agency_id', setup.agencyAId)
    }
  })

  // ── 4. Les RPC de l'edge ne sont pas des oracles ──────────────────────────────

  it('team_seat_status et team_invite_quota_take : fermées aux rôles API, ouvertes au service', async () => {
    const siegesAgent = await setup.clientB.rpc('team_seat_status', { p_agency_id: setup.agencyAId })
    expect(siegesAgent.error?.code).toBe(DENIED)
    const siegesAnon = await anonClient().rpc('team_seat_status', { p_agency_id: setup.agencyAId })
    expect(siegesAnon.error?.code).toBe(DENIED)
    const quotaAgent = await setup.clientB.rpc('team_invite_quota_take', {
      p_agency_id: setup.agencyBId, p_actor_id: setup.agentBId, p_recipient: adresse('oracle'),
    })
    expect(quotaAgent.error?.code).toBe(DENIED)

    // TÉMOIN : le service lit l'état — sans quoi l'edge refuserait tout, fermée.
    const { data, error } = await service.rpc('team_seat_status', { p_agency_id: setup.agencyBId })
    expect(error).toBeNull()
    expect(data?.[0]).toMatchObject({ plan: 'starter', seat_cap: 1 })
  })
})
