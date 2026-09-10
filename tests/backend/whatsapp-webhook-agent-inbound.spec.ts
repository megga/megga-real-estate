// Banc de bout en bout de whatsapp-webhook : les trois entrées côté AGENT posent
// `is_from_agent` à la réception (migration 20260910200728), et une déliaison ne rouvre pas
// l'avis LPD écrit pour les prospects. L'appairage y laisse aussi sa trace d'audit
// (20260911000100) — les deux autres gestes, par RPC, sont dans whatsapp-agent-link-audit.spec.ts.
//
// ⛔ POURQUOI CE BANC APPELLE LE WEBHOOK AU LIEU DE RECOPIER SES ÉCRITURES. Les autres specs
// WhatsApp reproduisent l'upsert du webhook à la main : elles éprouvent la base, pas le code
// qui l'écrit. Or le marqueur ne vaut que s'il est posé par le webhook sur CHACUNE des entrées
// côté agent, et c'est précisément ce qu'une recopie ne peut pas prouver. Les payloads sont
// signés avec le META_APP_SECRET de test du runtime local (supabase/config.toml).
//
// Les trois chemins sont choisis pour n'appeler ni le cerveau IA ni un envoi réel :
// l'appairage, un bouton de confirmation PÉRIMÉ (réponse fixe, sans DeepSeek), et le bouton
// d'opt-out de Meta. Sans jeton Meta, les réponses échouent proprement (`sendOutboundGuarded`
// rend ok:false) : le banc ne lit que ce que le webhook a ÉCRIT. Les tests forment un
// scénario et s'enchaînent dans l'ordre du fichier, comme les messages d'un vrai appairage.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI (backend.yml exporte SUPABASE_TEST_*) : lire le nombre
// de tests exécutés, jamais le code de sortie.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createHmac, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { serviceRoleClient } from './helpers/supabase'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { waitForEdgeWorker } from './helpers/edge'
import { execSql } from './helpers/local-sql'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const WEBHOOK = `${process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'}/functions/v1/whatsapp-webhook`

/** Le secret de test du runtime local, relu à sa source : une seconde copie finirait par diverger. */
function metaAppSecret(): string {
  const toml = readFileSync(path.resolve(fileURLToPath(import.meta.url), '../../../supabase/config.toml'), 'utf-8')
  const secret = toml.match(/^\s*META_APP_SECRET\s*=\s*"([^"]+)"/m)?.[1]
  if (!secret) throw new Error('META_APP_SECRET absent de [edge_runtime.secrets] dans supabase/config.toml')
  return secret
}

let seq = 0
/** Numéro E.164 en chiffres seuls, dont les 9 derniers chiffres sont uniques par appel. */
const freshPhone = (): string =>
  '41' + String(Date.now() % 1_000_000).padStart(6, '0') + String(seq++ % 1000).padStart(3, '0')

interface Delivery { id: string; status: number; routed: string | undefined; text: string }
interface AvisDu { agency_id: string; wa_phone: string }

describe.skipIf(!HAS_KEYS)('whatsapp-webhook : les entrées côté agent sont marquées à la réception', () => {
  let setup: TwoAgenciesSetup
  let svc: ReturnType<typeof serviceRoleClient>
  let secret = ''
  const agent = freshPhone()
  /** Code d'appairage à 8 chiffres, la forme qu'attend extractPairingCode. */
  const code = String(10_000_000 + Math.floor(Math.random() * 90_000_000))

  /** POST signé, au format d'un webhook Meta Cloud API. */
  const deliver = async (message: Record<string, unknown>): Promise<Delivery> => {
    const id = `wamid.TEST.webhook-agent.${agent}.${seq++}`
    const raw = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{ id: 'WABA-TEST', changes: [{ field: 'messages', value: {
        messaging_product: 'whatsapp',
        metadata: { phone_number_id: 'PNID-TEST' },
        contacts: [{ wa_id: agent, profile: { name: 'Banc webhook' } }],
        messages: [{ from: agent, id, timestamp: String(Math.floor(Date.now() / 1000)), ...message }],
      } }] }],
    })
    const signature = 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex')
    const res = await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': signature },
      body: raw,
    })
    const text = await res.text()
    let routed: string | undefined
    try { routed = (JSON.parse(text) as { routed?: string }).routed } catch { /* corps non JSON : rendu dans `text` */ }
    return { id, status: res.status, routed, text }
  }

  /** La ligne que le webhook a écrite pour ce message. */
  const written = async (providerMessageId: string) => {
    const { data, error } = await svc.from('whatsapp_messages')
      .select('direction, agency_id, contact_id, is_from_agent, stop_handled_at')
      .eq('provider', 'meta').eq('provider_message_id', providerMessageId)
      .maybeSingle()
    if (error) throw new Error(`lecture de la ligne écrite: ${error.message}`)
    return data
  }

  beforeAll(async () => {
    secret = metaAppSecret()
    setup = await setupTwoAgencies()
    svc = serviceRoleClient()
    await waitForEdgeWorker(WEBHOOK)

    // Un appairage en attente, tel que generate_whatsapp_pairing_code le pose.
    const { error } = await svc.from('whatsapp_agent_links').insert({
      profile_id: setup.agentAId, agency_id: setup.agencyAId, verified: false,
      pairing_code: code, pairing_expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    })
    if (error) throw new Error(`appairage en attente: ${error.message}`)
  }, 120_000)

  afterAll(async () => {
    if (!setup) return
    await svc.from('whatsapp_messages').delete().eq('wa_from', agent)
    await svc.from('whatsapp_messages').delete().eq('wa_to', agent)
    // L'opt-out d'un agent écrit une déclaration dans un registre append-only : même geste de
    // nettoyage que tests/backend/whatsapp-consent-registry.spec.ts.
    try {
      execSql(`
        alter table public.whatsapp_consents disable trigger trg_wa_consents_immutable_delete;
        delete from public.whatsapp_consents where wa_phone = '${agent}';
        alter table public.whatsapp_consents enable trigger trg_wa_consents_immutable_delete;
      `)
    } catch { /* le nettoyage ne doit jamais masquer l'échec d'un test */ }
    await svc.from('whatsapp_agent_links').delete().eq('profile_id', setup.agentAId)
    await setup.cleanup()
  })

  it('appairage : le message du code est marqué, et le lien bascule', async () => {
    const r = await deliver({ type: 'text', text: { body: code } })
    expect(r.status, r.text).toBe(200)
    expect(r.routed, r.text).toBe('pairing')
    expect(await written(r.id)).toMatchObject({
      direction: 'inbound', agency_id: setup.agencyAId, contact_id: null, is_from_agent: true,
    })
    const { data: link } = await svc.from('whatsapp_agent_links')
      .select('id, verified, wa_number').eq('profile_id', setup.agentAId).single()
    expect(link, 'sans lien vérifié, les deux tests suivants ne passeraient pas par la branche agent')
      .toMatchObject({ verified: true, wa_number: agent })

    // La trace du changement de preuve (même forme que les RPC de 20260911000100). Acteur
    // 'system' : le webhook constate qu'un numéro a présenté un code, il n'authentifie
    // personne — l'agent se lit dans `metadata.profile_id`.
    const { data: traces, error: trErr } = await svc.from('activity_events')
      .select('actor_id, actor_kind, agency_id, category, severity, entity_type, entity_id, object_label, metadata')
      .eq('action', 'whatsapp_number_verified').eq('entity_id', (link as { id: string }).id)
    if (trErr) throw new Error(`lecture de la trace: ${trErr.message}`)
    expect(traces, 'une trace, et une seule : seul le gagnant du compare-and-swap journalise').toHaveLength(1)
    expect(traces![0]).toMatchObject({
      actor_id: null, actor_kind: 'system', agency_id: setup.agencyAId,
      category: 'settings', severity: 'info', entity_type: 'whatsapp_agent_link',
    })
    expect(traces![0].metadata).toEqual({ via: 'pairing', profile_id: setup.agentAId, phone_tail: agent.slice(-4) })
    expect(JSON.stringify(traces![0]), 'jamais le numéro complet : la table est append-only')
      .not.toContain(agent.slice(-9))
  }, 60_000)

  it('branche agent : un bouton de confirmation périmé est marqué', async () => {
    // `pa:<uuid>:yes` sans action en attente : resolveButtonDecision rend 'stale', le webhook
    // répond un texte fixe et s'arrête, sans appel au cerveau IA.
    const r = await deliver({
      type: 'interactive',
      interactive: { type: 'button_reply', button_reply: { id: `pa:${randomUUID()}:yes`, title: 'Oui' } },
    })
    expect(r.status, r.text).toBe(200)
    expect(r.routed, r.text).toBe('agent')
    expect(await written(r.id)).toMatchObject({ agency_id: setup.agencyAId, is_from_agent: true })
  }, 60_000)

  it('opt-out bouton d’un agent : marqué lui aussi', async () => {
    const r = await deliver({ type: 'button', button: { text: 'Stop promotions', payload: 'Stop promotions' } })
    expect(r.status, r.text).toBe(200)
    expect(r.routed, r.text).toBe('agent_meta_optout')
    const w = await written(r.id)
    expect(w).toMatchObject({ agency_id: setup.agencyAId, is_from_agent: true })
    expect(w?.stop_handled_at, 'la ligne est bien celle de la branche opt-out').not.toBeNull()
  }, 60_000)

  it('déliaison : les entrées reçues côté agent restent sans avis LPD', async () => {
    const { data: recus } = await svc.from('whatsapp_messages')
      .select('id').eq('wa_from', agent).eq('direction', 'inbound').eq('is_from_agent', true)
    expect(recus, 'les trois entrées marquées doivent exister, sinon l’absence d’avis ne prouve rien')
      .toHaveLength(3)

    // La RPC ne supprime pas la ligne (UPDATE depuis 20260817143430) : elle en efface le
    // numéro et la vérification, et c'est ce qui rendait la clause du lien aveugle.
    const { error } = await setup.clientA.rpc('unlink_whatsapp_number')
    if (error) throw new Error(`unlink_whatsapp_number: ${error.message}`)
    const { data: lien } = await svc.from('whatsapp_agent_links')
      .select('verified, wa_number').eq('profile_id', setup.agentAId).single()
    expect(lien, 'la déliaison doit avoir effacé numéro et vérification')
      .toMatchObject({ verified: false, wa_number: null })

    const PLAFOND = 1000
    const dus = async (): Promise<string[]> => {
      const { data, error: rpcErr } = await svc.rpc('whatsapp_pending_notices', { p_limit: PLAFOND })
      if (rpcErr) throw new Error(`whatsapp_pending_notices: ${rpcErr.code} ${rpcErr.message}`)
      const rows = (data ?? []) as AvisDu[]
      expect(rows.length, 'réponse pleine : l’absence d’un numéro ne prouverait rien').toBeLessThan(PLAFOND)
      return rows.filter((d) => d.agency_id === setup.agencyAId).map((d) => d.wa_phone)
    }
    expect(await dus(), 'le lien délié ne témoigne plus : seul le marqueur tient').not.toContain(agent)

    // Témoin : un entrant NON marqué du même numéro, comme la branche client l'écrit après la
    // déliaison, est dû. Le numéro n'était donc écarté ni par une suppression (l'opt-out d'un
    // profil n'en écrit pas) ni par un avis déjà enregistré — seulement par le marqueur.
    const at = new Date().toISOString()
    const { error: insErr } = await svc.from('whatsapp_messages').insert({
      provider: 'meta', provider_message_id: `wamid.TEST.webhook-agent.${agent}.client`,
      direction: 'inbound', wa_from: agent, agency_id: setup.agencyAId, body: 'bonjour',
      created_at: at, wa_timestamp: at,
    })
    if (insErr) throw new Error(`témoin non marqué: ${insErr.message}`)
    expect(await dus()).toContain(agent)
  }, 30_000)
})
