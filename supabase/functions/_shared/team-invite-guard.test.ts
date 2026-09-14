/**
 * Les deux verrous de `send-team-invite` — sièges du plan et quota d'envoi — côté edge.
 *
 * Ce que ces tests verrouillent : un verdict ILLISIBLE refuse (c'est le défaut d'origine, une
 * RPC absente dont l'erreur était ignorée) ; l'interrupteur éteint ne bloque RIEN, quel que
 * soit le compte (décision du 13.09.2026) ; allumé, le plafond se franchit à `used >= cap` ;
 * et chaque motif de refus du quota garde son code stable. Chaque négatif a son témoin : un
 * module qui refuserait tout rougirait sur les cas « passe ».
 */
import { describe, it, expect, vi } from 'vitest'
import {
  isSeatLimitError,
  quotaRefusal,
  readSeatStatus,
  seatLimitRefusal,
  seatRefusal,
  takeTeamInviteQuota,
} from './team-invite-guard.ts'

type RpcReply = { data?: unknown; error?: { message: string } | null }

/** Faux client : seulement `rpc`, seule chose que le module touche. */
function fakeAdmin(replies: Record<string, RpcReply>) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = []
  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    calls.push({ fn, args })
    const reply = replies[fn]
    if (!reply) return { data: null, error: { message: `rpc inattendue : ${fn}` } }
    return { data: reply.data ?? null, error: reply.error ?? null }
  })
  return { admin: { rpc } as never, calls }
}

const etat = (enforced: boolean, plan: string, seat_cap: number, seats_used: number) =>
  ({ data: [{ enforced, plan, seat_cap, seats_used }] })

describe('readSeatStatus — l’état des sièges se lit en base, ou refuse', () => {
  it('rend l’état de la RPC, pour l’agence de l’appelant', async () => {
    const { admin, calls } = fakeAdmin({ team_seat_status: etat(false, 'starter', 1, 3) })
    expect(await readSeatStatus(admin, 'a-1')).toEqual({
      readable: true, enforced: false, plan: 'starter', seatCap: 1, seatsUsed: 3,
    })
    expect(calls).toEqual([{ fn: 'team_seat_status', args: { p_agency_id: 'a-1' } }])
  })

  it('⛔ une RPC en erreur est ILLISIBLE — le défaut d’origine comptait alors 0', async () => {
    const { admin } = fakeAdmin({ team_seat_status: { error: { message: 'function does not exist' } } })
    expect(await readSeatStatus(admin, 'a-1')).toEqual({ readable: false })
  })

  it('⛔ une réponse vide ou mal formée est illisible aussi', async () => {
    for (const data of [[], null, [{ enforced: 'true', plan: 'starter', seat_cap: 1, seats_used: 0 }],
      [{ enforced: true, plan: 'starter', seat_cap: '1', seats_used: 0 }],
      [{ enforced: true, plan: null, seat_cap: 1, seats_used: 0 }]]) {
      const { admin } = fakeAdmin({ team_seat_status: { data } })
      expect(await readSeatStatus(admin, 'a-1'), JSON.stringify(data)).toEqual({ readable: false })
    }
  })
})

describe('seatRefusal — interrupteur, plafond, et fermé par défaut', () => {
  it('⛔ état illisible : 503 seat_check_unavailable', () => {
    expect(seatRefusal({ readable: false })).toMatchObject({ status: 503, body: { error: 'seat_check_unavailable' } })
  })

  it('interrupteur ÉTEINT : aucune limite, même très au-delà du plafond', () => {
    expect(seatRefusal({ readable: true, enforced: false, plan: 'starter', seatCap: 1, seatsUsed: 12 })).toBeNull()
  })

  it('interrupteur ALLUMÉ : 403 plan_limit_reached dès que les sièges pris atteignent le plafond', () => {
    const refus = seatRefusal({ readable: true, enforced: true, plan: 'starter', seatCap: 1, seatsUsed: 1 })
    expect(refus).toEqual({
      status: 403,
      body: {
        error: 'plan_limit_reached', plan: 'starter', seatCap: 1, seatsUsed: 1,
        message: 'Votre plan Starter est limité à 1 membre, invitations en attente comprises.',
      },
    })
    // Pluriel, et un plan inconnu s'affiche tel quel plutôt que de disparaître.
    expect(seatRefusal({ readable: true, enforced: true, plan: 'entreprise', seatCap: 10, seatsUsed: 11 })?.body.message)
      .toBe('Votre plan Entreprise est limité à 10 membres, invitations en attente comprises.')
    expect(seatRefusal({ readable: true, enforced: true, plan: 'agency', seatCap: 1, seatsUsed: 1 })?.body.message)
      .toContain('Votre plan agency')
  })

  it('TÉMOIN — allumé, sous le plafond : l’invitation passe', () => {
    expect(seatRefusal({ readable: true, enforced: true, plan: 'starter', seatCap: 1, seatsUsed: 0 })).toBeNull()
    expect(seatRefusal({ readable: true, enforced: true, plan: 'entreprise', seatCap: 10, seatsUsed: 9 })).toBeNull()
  })

  it('le refus du TRIGGER à l’écriture porte le même code', () => {
    expect(isSeatLimitError({ message: 'plan_seat_limit' })).toBe(true)
    expect(seatLimitRefusal()).toMatchObject({ status: 403, body: { error: 'plan_limit_reached' } })
    // Témoins : une autre erreur d'écriture n'est pas un refus de sièges.
    expect(isSeatLimitError({ message: 'duplicate key value violates unique constraint' })).toBe(false)
    expect(isSeatLimitError({ message: 'plan_property_limit' })).toBe(false)
    expect(isSeatLimitError(null)).toBe(false)
    expect(isSeatLimitError(undefined)).toBe(false)
  })
})

describe('takeTeamInviteQuota + quotaRefusal — le quota d’envoi, toujours actif', () => {
  const caller = { agencyId: 'a-1', actorId: 'u-1' }

  it('prend la place pour l’agence de l’appelant, et laisse passer', async () => {
    const { admin, calls } = fakeAdmin({
      team_invite_quota_take: { data: [{ allowed: true, reason: 'ok', day_count: 3, day_cap: 20 }] },
    })
    const v = await takeTeamInviteQuota(admin, caller, 'invite@example.ch')
    expect(v).toEqual({ allowed: true, dayCount: 3, dayCap: 20 })
    expect(quotaRefusal(v)).toBeNull()
    expect(calls).toEqual([{
      fn: 'team_invite_quota_take',
      args: { p_agency_id: 'a-1', p_actor_id: 'u-1', p_recipient: 'invite@example.ch' },
    }])
  })

  it('⛔ plafond d’invitations atteint : 429 invite_daily_cap, avec le plafond', async () => {
    const { admin } = fakeAdmin({
      team_invite_quota_take: { data: [{ allowed: false, reason: 'invite_daily_cap', day_count: 20, day_cap: 20 }] },
    })
    const refus = quotaRefusal(await takeTeamInviteQuota(admin, caller, 'x@example.ch'))
    expect(refus?.status).toBe(429)
    expect(refus?.body).toMatchObject({ error: 'invite_daily_cap', dayCap: 20 })
    expect(refus?.body.message).toContain('20 par 24 heures')
  })

  it('⛔ plafond commun des e-mails de l’agence : les codes de guardOutboundEmail', async () => {
    for (const reason of ['hourly_cap', 'daily_cap'] as const) {
      const { admin } = fakeAdmin({
        team_invite_quota_take: { data: [{ allowed: false, reason, day_count: 2, day_cap: 20 }] },
      })
      const refus = quotaRefusal(await takeTeamInviteQuota(admin, caller, 'x@example.ch'))
      expect(refus).toMatchObject({ status: 429, body: { error: reason } })
    }
  })

  it('⛔ RPC en erreur, verdict absent, motif inconnu ou agence absente : 503, fermé', async () => {
    const pannes: RpcReply[] = [
      { error: { message: 'timeout' } },
      { data: [] },
      { data: [{ allowed: false, reason: 'motif_futur', day_count: 0, day_cap: 20 }] },
      { data: [{ allowed: false, reason: 'no_agency', day_count: 0, day_cap: 0 }] },
      // `allowed` doit valoir EXACTEMENT true : une chaîne ne laisse rien passer.
      { data: [{ allowed: 'true', reason: 'ok', day_count: 1, day_cap: 20 }] },
    ]
    for (const reponse of pannes) {
      const { admin } = fakeAdmin({ team_invite_quota_take: reponse })
      const refus = quotaRefusal(await takeTeamInviteQuota(admin, caller, 'x@example.ch'))
      expect(refus, JSON.stringify(reponse)).toMatchObject({ status: 503, body: { error: 'quota_unavailable' } })
    }
  })
})
