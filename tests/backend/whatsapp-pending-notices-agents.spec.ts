// Banc de whatsapp_pending_notices : l'avis LPD (art. 19 nLPD) ne vise que les PROSPECTS
// (migration 20260910192017).
//
// Le 10.09.2026, le numéro d'un agent fraîchement apparié a reçu l'avis écrit pour les
// prospects : la branche agent du webhook insère ses entrants avec l'agence du lien, et la
// fonction ne distinguait rien. Les entrants semés ici ont la forme exacte de ceux du webhook
// (agence posée, contact NULL, même âge), et la seule différence entre les numéros est le lien
// vérifié. C'est ce qui rend le témoin positif probant : si le prospect disparaissait lui
// aussi, l'absence de l'agent ne prouverait rien.
//
// Client service_role, comme l'unique appelant réel (whatsapp-process) : l'appel éprouve au
// passage le GRANT EXECUTE que la migration repose.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI (backend.yml exporte SUPABASE_TEST_*) : lire le nombre
// de tests exécutés, jamais le code de sortie.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { serviceRoleClient } from './helpers/supabase'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

/**
 * Numéro E.164 en chiffres seuls, la forme que Meta envoie et que l'appairage stocke. Les
 * 9 derniers chiffres (ce que retient normalize_phone) sont uniques par appel : la base de
 * CI est partagée entre specs.
 */
let seq = 0
const freshPhone = (): string =>
  '41' + String(Date.now() % 1_000_000).padStart(6, '0') + String(seq++ % 1000).padStart(3, '0')

interface AvisDu { agency_id: string; wa_phone: string }

describe.skipIf(!HAS_KEYS)('whatsapp_pending_notices : l’avis LPD ne vise que les prospects', () => {
  let setup: TwoAgenciesSetup
  let svc: ReturnType<typeof serviceRoleClient>
  let linkId = ''

  const agent = freshPhone()
  /** Le numéro de l'agent au format national : même personne pour normalize_phone. */
  const agentNational = '0' + agent.slice(-9)
  const prospect = freshPhone()

  /** Entrant de la forme exacte de la branche agent du webhook : agence posée, contact NULL. */
  const seedInbound = async (phone: string, agencyId: string): Promise<void> => {
    const at = new Date(Date.now() - 10 * 60_000).toISOString()
    const { error } = await svc.from('whatsapp_messages').insert({
      provider: 'meta', provider_message_id: `wamid.TEST.avis-lpd.${phone}.${seq++}`,
      direction: 'inbound', wa_from: phone, agency_id: agencyId, contact_id: null,
      body: 'bonjour', created_at: at, wa_timestamp: at,
    })
    if (error) throw new Error(`seedInbound: ${error.message}`)
  }

  /**
   * Numéros à qui l'avis est dû pour une agence du banc. La fonction agrège TOUTES les
   * agences, sans ordre : une réponse pleine a pu couper nos lignes, et l'absence d'un
   * numéro n'y prouverait rien. Le plafond effectif est `max_rows` de PostgREST
   * (supabase/config.toml), qui tronque aussi les RPC, en silence.
   */
  const PLAFOND = 1000
  const dus = async (agencyId: string): Promise<string[]> => {
    const { data, error } = await svc.rpc('whatsapp_pending_notices', { p_limit: PLAFOND })
    if (error) throw new Error(`whatsapp_pending_notices: ${error.code} ${error.message}`)
    const rows = (data ?? []) as AvisDu[]
    expect(rows.length, 'réponse pleine : l’absence d’un numéro ne prouverait rien').toBeLessThan(PLAFOND)
    return rows.filter((r) => r.agency_id === agencyId).map((r) => r.wa_phone)
  }

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    svc = serviceRoleClient()

    const { data, error } = await svc.from('whatsapp_agent_links')
      .insert({ profile_id: setup.agentAId, agency_id: setup.agencyAId, wa_number: agent, verified: true })
      .select('id').single()
    if (error) throw new Error(`lien agent: ${error.message}`)
    linkId = (data as { id: string }).id

    await seedInbound(agent, setup.agencyAId)          // la branche agent, agence courante du lien
    await seedInbound(agent, setup.agencyBId)          // resté sur l'agence d'avant le changement de lien
    await seedInbound(agentNational, setup.agencyAId)  // même numéro, autre format
    await seedInbound(prospect, setup.agencyAId)       // le témoin : même forme, sans lien
  })

  afterAll(async () => {
    if (!setup) return
    await svc.from('whatsapp_messages').delete().in('wa_from', [agent, agentNational, prospect])
    if (linkId) await svc.from('whatsapp_agent_links').delete().eq('id', linkId)
    await setup.cleanup()
  })

  it('l’entrant d’un agent vérifié ne réclame aucun avis ; celui d’un prospect, si', async () => {
    const aviser = await dus(setup.agencyAId)
    // Témoin d'abord : une fonction qui ne rendrait plus rien passerait l'assertion suivante.
    expect(aviser, 'le prospect doit recevoir l’avis').toContain(prospect)
    expect(aviser, 'un agent est un utilisateur du service, pas un prospect').not.toContain(agent)
  })

  it('le lien a changé d’agence : l’entrant resté sur l’ancienne ne réclame pas d’avis non plus', async () => {
    // Le cas du 10.09 : le lien était passé de megga-ge-3 à megga-agence. L'exclusion porte
    // sur le NUMÉRO, pas sur le couple (agence, numéro) qui est la clé de whatsapp_notices.
    expect(await dus(setup.agencyBId)).not.toContain(agent)
  })

  it('le numéro est reconnu sous un autre format : normalize_phone, pas l’égalité brute', async () => {
    expect(await dus(setup.agencyAId)).not.toContain(agentNational)
  })

  it('seul un lien VÉRIFIÉ exclut : pendant un appairage, le numéro écrit comme n’importe qui', async () => {
    // Retirer la vérification remet les trois entrants de l'agent dans le cas général. C'est
    // aussi ce qui prouve qu'ils étaient éligibles, et que seule la clause du lien les écartait
    // plus haut — pas un avis déjà enregistré ni une suppression.
    const { error } = await svc.from('whatsapp_agent_links').update({ verified: false }).eq('id', linkId)
    if (error) throw new Error(`lien non vérifié: ${error.message}`)
    try {
      const aviserA = await dus(setup.agencyAId)
      expect(aviserA).toContain(agent)
      expect(aviserA).toContain(agentNational)
      expect(await dus(setup.agencyBId)).toContain(agent)
    } finally {
      await svc.from('whatsapp_agent_links').update({ verified: true }).eq('id', linkId)
    }
  })
})
