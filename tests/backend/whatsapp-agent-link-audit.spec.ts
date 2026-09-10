// Banc de la piste d'audit des liens WhatsApp d'agent : chaque changement d'état de PREUVE
// laisse une ligne `activity_events` (migration 20260911000100).
//
// Le 10.09.2026, le copilote ne répondait plus à Julien : son lien avait été vidé le 17.08 par
// `unlink_whatsapp_number`, et personne ne pouvait dire par qui ni quand. Ce banc prouve que les
// deux RPC écrivent désormais leur trace — et SEULEMENT quand une preuve change : un code faux,
// une vérification abandonnée ou un lien déjà vide ne doivent rien écrire, sans quoi le journal
// mentirait dans l'autre sens. Le troisième geste, l'appairage, vit dans le webhook : il est
// éprouvé par whatsapp-webhook-agent-inbound.spec.ts, qui appelle le vrai webhook.
//
// ⛔ CLIENT AUTHENTIFIÉ, JAMAIS execSql. Les deux RPC lisent `auth.uid()` ; execSql tourne en
// `postgres`, sans JWT, et elles y rendraient `not_authenticated` sans rien éprouver. Le code
// OTP vient de la vraie `start_whatsapp_number_verification`, appelée en service_role comme le
// fait la fonction edge : recopier son hachage figerait un détail d'implémentation.
//
// Les tests forment un scénario et s'enchaînent dans l'ordre du fichier.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI (backend.yml exporte SUPABASE_TEST_*) : lire le nombre
// de tests exécutés, jamais le code de sortie.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient } from './helpers/supabase'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

let seq = 0
/** Numéro E.164 en chiffres seuls, dont les 9 derniers chiffres (normalize_phone) sont uniques. */
const freshPhone = (): string =>
  '41' + String(Date.now() % 1_000_000).padStart(6, '0') + String(seq++ % 1000).padStart(3, '0')

interface LinkEvent {
  action: string
  actor_id: string | null
  actor_kind: string
  agency_id: string | null
  category: string | null
  severity: string | null
  entity_type: string
  entity_id: string | null
  object_label: string | null
  metadata: Record<string, unknown> | null
}

interface Verdict { ok: boolean; reason: string }

describe.skipIf(!HAS_KEYS)('lien WhatsApp d’agent : chaque changement de preuve est journalisé', () => {
  let setup: TwoAgenciesSetup
  let svc: ReturnType<typeof serviceRoleClient>

  /** Traces de lien d'un agent. Relues en service_role : ce banc éprouve l'écriture, pas la RLS. */
  const linkEvents = async (profileId: string, action?: string): Promise<LinkEvent[]> => {
    let q = svc.from('activity_events')
      .select('action, actor_id, actor_kind, agency_id, category, severity, entity_type, entity_id, object_label, metadata, created_at')
      .eq('entity_type', 'whatsapp_agent_link')
      .eq('metadata->>profile_id', profileId)
      .order('created_at', { ascending: true })
    if (action) q = q.eq('action', action)
    const { data, error } = await q
    if (error) throw new Error(`lecture des traces: ${error.message}`)
    return (data ?? []) as LinkEvent[]
  }

  /** Le lien de l'agent, relu en service_role (les colonnes OTP sont hors de portée du client). */
  const linkOf = async (profileId: string) => {
    const { data, error } = await svc.from('whatsapp_agent_links')
      .select('id, agency_id, verified, wa_number, pending_number').eq('profile_id', profileId).single()
    if (error) throw new Error(`lecture du lien: ${error.message}`)
    return data as { id: string; agency_id: string | null; verified: boolean; wa_number: string | null; pending_number: string | null }
  }

  /** Arme une vérification par code avec la vraie RPC — le code revient en clair au service. */
  const startOtp = async (profileId: string, phone: string): Promise<string> => {
    const { data, error } = await svc.rpc('start_whatsapp_number_verification', {
      p_profile_id: profileId, p_number: phone,
    })
    if (error) throw new Error(`start_whatsapp_number_verification: ${error.message}`)
    const row = ((data ?? []) as Array<Verdict & { code: string | null }>)[0]
    expect(row, 'le code doit être armé, sinon la suite n’éprouve rien').toMatchObject({ ok: true, reason: 'ok' })
    return row.code as string
  }

  const confirm = async (client: SupabaseClient, code: string): Promise<Verdict> => {
    const { data, error } = await client.rpc('confirm_whatsapp_number_verification', { p_code: code })
    if (error) throw new Error(`confirm_whatsapp_number_verification: ${error.message}`)
    const rows = (data ?? []) as Verdict[]
    expect(rows, 'la RPC rend exactement un verdict').toHaveLength(1)
    return rows[0]
  }

  const unlink = async (client: SupabaseClient): Promise<void> => {
    const { error } = await client.rpc('unlink_whatsapp_number')
    if (error) throw new Error(`unlink_whatsapp_number: ${error.message}`)
  }

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    svc = serviceRoleClient()
  })

  afterAll(async () => {
    if (!setup) return
    // Les traces restent : activity_events est append-only, et la suppression des comptes les
    // détache de leur acteur et de leur agence sans les effacer (activity-events-actor-detach).
    await svc.from('whatsapp_agent_links').delete().in('profile_id', [setup.agentAId, setup.agentBId])
    await setup.cleanup()
  })

  describe('confirmation par code', () => {
    const numero = freshPhone()
    let code = ''

    it('un code faux ne laisse aucune trace : aucune preuve n’a changé', async () => {
      code = await startOtp(setup.agentAId, numero)
      const faux = code === '000000' ? '111111' : '000000'
      expect(await confirm(setup.clientA, faux)).toEqual({ ok: false, reason: 'wrong_code' })
      expect(await linkEvents(setup.agentAId)).toEqual([])
    })

    it('le bon code laisse UNE trace « otp », attribuée à l’agent, sans son numéro', async () => {
      expect(await confirm(setup.clientA, code)).toEqual({ ok: true, reason: 'ok' })
      const lien = await linkOf(setup.agentAId)
      expect(lien, 'le lien doit être vérifié, sinon la trace ne témoignerait de rien')
        .toMatchObject({ verified: true, wa_number: numero })

      const traces = await linkEvents(setup.agentAId, 'whatsapp_number_verified')
      expect(traces, 'une trace, et une seule').toHaveLength(1)
      expect(traces[0]).toMatchObject({
        actor_id: setup.agentAId, actor_kind: 'user',
        // L'agence du LIEN : start_… vient de la poser depuis le profil.
        agency_id: setup.agencyAId,
        category: 'settings', severity: 'info',
        entity_type: 'whatsapp_agent_link', entity_id: lien.id,
      })
      // `toEqual` et non `toMatchObject` : une clé de plus serait une fuite possible.
      expect(traces[0].metadata).toEqual({ via: 'otp', profile_id: setup.agentAId, phone_tail: numero.slice(-4) })
      // Nulle part dans la ligne, pas même dans un libellé : la table est append-only.
      expect(JSON.stringify(traces[0])).not.toContain(numero.slice(-9))
    })
  })

  describe('déliaison', () => {
    it('délier un lien vérifié laisse UNE trace, attribuée à l’agent', async () => {
      const avant = await linkOf(setup.agentAId)
      expect(avant.verified, 'le scénario suppose le lien vérifié au test précédent').toBe(true)
      const numero = avant.wa_number as string

      await unlink(setup.clientA)
      expect(await linkOf(setup.agentAId), 'la déliaison doit avoir effacé numéro et vérification')
        .toMatchObject({ id: avant.id, verified: false, wa_number: null })

      const traces = await linkEvents(setup.agentAId, 'whatsapp_number_unlinked')
      expect(traces, 'une trace, et une seule').toHaveLength(1)
      expect(traces[0]).toMatchObject({
        actor_id: setup.agentAId, actor_kind: 'user', agency_id: setup.agencyAId,
        category: 'settings', severity: 'info',
        // Même entité que la vérification : la ligne survit à la déliaison, son id suit le lien.
        entity_type: 'whatsapp_agent_link', entity_id: avant.id,
      })
      expect(traces[0].metadata).toEqual({ profile_id: setup.agentAId, phone_tail: numero.slice(-4) })
      expect(JSON.stringify(traces[0])).not.toContain(numero.slice(-9))
    })

    it('délier une seconde fois un lien déjà vide n’écrit rien', async () => {
      await unlink(setup.clientA)
      expect(await linkEvents(setup.agentAId, 'whatsapp_number_unlinked')).toHaveLength(1)
    })

    it('abandonner par la déliaison une vérification EN COURS n’écrit rien', async () => {
      await startOtp(setup.agentBId, freshPhone())
      expect((await linkOf(setup.agentBId)).pending_number, 'une vérification doit être en cours').not.toBeNull()

      await unlink(setup.clientB)
      // Témoin : la déliaison a bien porté sur la ligne — le code en vol est abandonné.
      expect(await linkOf(setup.agentBId)).toMatchObject({ verified: false, pending_number: null })
      expect(await linkEvents(setup.agentBId), 'aucune preuve n’existait, aucune n’a été retirée').toEqual([])
    })
  })

  describe('remplacement d’un numéro vérifié', () => {
    it('confirmer un AUTRE numéro sur un lien vérifié nomme celui qu’il remplace', async () => {
      // L'écran ne propose pas ce chemin, l'API le permet : start_… préserve `verified` sur
      // conflit, et la confirmation remplace alors le numéro prouvé sans passer par la déliaison.
      // Le lien est posé vérifié en service_role — une fixture, pas un geste journalisé.
      const ancien = freshPhone()
      const nouveau = freshPhone()
      const { error } = await svc.from('whatsapp_agent_links')
        .update({ verified: true, wa_number: ancien, verified_at: new Date().toISOString() })
        .eq('profile_id', setup.agentBId)
      if (error) throw new Error(`lien vérifié: ${error.message}`)

      const code = await startOtp(setup.agentBId, nouveau)
      expect(await confirm(setup.clientB, code)).toEqual({ ok: true, reason: 'ok' })
      expect(await linkOf(setup.agentBId)).toMatchObject({ verified: true, wa_number: nouveau })

      const traces = await linkEvents(setup.agentBId, 'whatsapp_number_verified')
      expect(traces, 'une trace pour le seul geste journalisé').toHaveLength(1)
      expect(traces[0].metadata).toEqual({
        via: 'otp', profile_id: setup.agentBId,
        phone_tail: nouveau.slice(-4), replaced_phone_tail: ancien.slice(-4),
      })
    })
  })
})
