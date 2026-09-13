/**
 * `guardOutboundEmail` — la garde de sortie des e-mails pilotés par un agent.
 *
 * Ce que ces tests verrouillent : l'ORDRE des trois questions (périmètre, suppression,
 * quota), le fait qu'une garde indisponible REFUSE, et que la place de quota n'est prise
 * que si les deux premières ont dit oui. Une inversion périmètre/suppression rouvrirait
 * l'oracle « cette adresse s'est-elle désinscrite ? » à tout jeton d'agent.
 */
import { describe, it, expect, vi } from 'vitest'
import { guardOutboundEmail, takeEmailQuota } from './email-recipient.ts'

type RpcReply = { data?: unknown; error?: { message: string } | null }

/** Faux client : seulement `rpc`, seule chose que la garde touche. */
function fakeAdmin(replies: Record<string, RpcReply | (() => RpcReply)>) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = []
  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    calls.push({ fn, args })
    const r = replies[fn]
    const reply = typeof r === 'function' ? r() : r
    if (!reply) return { data: null, error: { message: `rpc inattendue : ${fn}` } }
    return { data: reply.data ?? null, error: reply.error ?? null }
  })
  return { admin: { rpc } as never, calls }
}

const caller = { agencyId: 'a-1', actorId: 'u-1' }
const intent = { to: 'Marie@Example.ch', purpose: 'relance' as const, sender: 'send-email' as const }
const cors = { 'Access-Control-Allow-Origin': '*' }

const SCOPE_OK = { data: 'contact' }
const SCOPE_NONE = { data: null }
const SUPPRESSION_OK = { data: [{ allowed: true, reason: 'ok' }] }
const SUPPRESSION_STOP = { data: [{ allowed: false, reason: 'unsubscribed' }] }
const QUOTA_OK = { data: [{ allowed: true, reason: 'ok', hour_count: 1, day_count: 1 }] }
const QUOTA_HOUR = { data: [{ allowed: false, reason: 'hourly_cap', hour_count: 60, day_count: 61 }] }

describe('guardOutboundEmail — les trois questions, dans cet ordre', () => {
  it('laisse partir un contact connu, non désinscrit, sous quota — et prend la place', async () => {
    const { admin, calls } = fakeAdmin({
      email_recipient_scope: SCOPE_OK, email_send_allowed: SUPPRESSION_OK, email_send_quota_take: QUOTA_OK,
    })
    const res = await guardOutboundEmail(admin, caller, intent, cors)
    expect(res).toBeNull()
    expect(calls.map((c) => c.fn)).toEqual(['email_recipient_scope', 'email_send_allowed', 'email_send_quota_take'])
    // Le périmètre est jugé sur l'AGENCE DE L'APPELANT, jamais sur un identifiant du corps.
    expect(calls[0].args).toEqual({ p_agency_id: 'a-1', p_email: 'Marie@Example.ch' })
    expect(calls[2].args).toMatchObject({ p_agency_id: 'a-1', p_actor_id: 'u-1', p_sender: 'send-email', p_purpose: 'relance' })
  })

  it('refuse (403) un destinataire inconnu de l’agence, SANS interroger la suppression ni le quota', async () => {
    const { admin, calls } = fakeAdmin({
      email_recipient_scope: SCOPE_NONE, email_send_allowed: SUPPRESSION_OK, email_send_quota_take: QUOTA_OK,
    })
    const res = await guardOutboundEmail(admin, caller, intent, cors)
    expect(res?.status).toBe(403)
    expect(await res!.json()).toMatchObject({ error: 'recipient_out_of_scope' })
    // ⛔ Un seul appel : un périmètre refusé ne doit RIEN révéler du registre de suppression.
    expect(calls.map((c) => c.fn)).toEqual(['email_recipient_scope'])
  })

  it('refuse (403) quand la RPC de périmètre est en erreur — fermé, pas ouvert', async () => {
    const { admin, calls } = fakeAdmin({
      email_recipient_scope: { error: { message: 'connexion perdue' } },
      email_send_allowed: SUPPRESSION_OK, email_send_quota_take: QUOTA_OK,
    })
    const res = await guardOutboundEmail(admin, caller, intent, cors)
    expect(res?.status).toBe(403)
    expect(calls).toHaveLength(1)
  })

  it('refuse (409, blocked) une personne désinscrite, avec la forme de réponse historique', async () => {
    const { admin, calls } = fakeAdmin({
      email_recipient_scope: SCOPE_OK, email_send_allowed: SUPPRESSION_STOP, email_send_quota_take: QUOTA_OK,
    })
    const res = await guardOutboundEmail(admin, caller, intent, cors)
    expect(res?.status).toBe(409)
    expect(await res!.json()).toEqual({ error: 'unsubscribed', blocked: true })
    // La place de quota n'est pas prise pour un envoi qui ne part pas.
    expect(calls.map((c) => c.fn)).not.toContain('email_send_quota_take')
  })

  it('refuse (429) au plafond horaire', async () => {
    const { admin } = fakeAdmin({
      email_recipient_scope: SCOPE_OK, email_send_allowed: SUPPRESSION_OK, email_send_quota_take: QUOTA_HOUR,
    })
    const res = await guardOutboundEmail(admin, caller, intent, cors)
    expect(res?.status).toBe(429)
    expect(await res!.json()).toMatchObject({ error: 'hourly_cap' })
  })

  it('refuse (503) quand le quota est indisponible — jamais un envoi sans compteur', async () => {
    const { admin } = fakeAdmin({
      email_recipient_scope: SCOPE_OK, email_send_allowed: SUPPRESSION_OK,
      email_send_quota_take: { error: { message: 'timeout' } },
    })
    const res = await guardOutboundEmail(admin, caller, intent, cors)
    expect(res?.status).toBe(503)
    expect(await res!.json()).toMatchObject({ error: 'quota_unavailable' })
  })
})

describe('takeEmailQuota — lecture du verdict', () => {
  it('rend les compteurs quand la place est prise', async () => {
    const { admin } = fakeAdmin({ email_send_quota_take: QUOTA_OK })
    expect(await takeEmailQuota(admin, caller, intent)).toEqual({ allowed: true, hour: 1, day: 1 })
  })

  it('range un motif inconnu sous quota_unavailable plutôt que de le laisser passer', async () => {
    const { admin } = fakeAdmin({
      email_send_quota_take: { data: [{ allowed: false, reason: 'motif_futur', hour_count: 0, day_count: 0 }] },
    })
    expect(await takeEmailQuota(admin, caller, intent)).toEqual({ allowed: false, reason: 'quota_unavailable' })
  })

  it('refuse fermé sur un verdict absent', async () => {
    const { admin } = fakeAdmin({ email_send_quota_take: { data: [] } })
    expect(await takeEmailQuota(admin, caller, intent)).toEqual({ allowed: false, reason: 'quota_unavailable' })
  })
})
