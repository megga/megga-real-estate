// Banc de whatsapp_pending_notices : l'avis LPD (art. 19 nLPD) ne vise que les PROSPECTS
// (migrations 20260910192017 puis 20260910200728) — et la garde whatsapp_send_allowed, seconde
// ligne, le refuse à un numéro d'agent vérifié (20260910204544).
//
// Le 10.09.2026, le numéro d'un agent fraîchement apparié a reçu l'avis écrit pour les
// prospects : la branche agent du webhook insère ses entrants avec l'agence du lien, et la
// fonction ne distinguait rien. Deux clauses l'en écartent désormais, et chacune a son volet :
//   · le LIEN vérifié (20260910192017), pour ce que le webhook n'a pas marqué ;
//   · le marqueur `is_from_agent` posé à la réception (20260910200728), qui survit à une
//     déliaison — le lien délié (`verified = false`, `wa_number = NULL`) ne témoigne plus.
//
// Les entrants semés ont la forme des lignes du webhook (agence posée, contact NULL, même
// âge), et un témoin de MÊME forme doit, lui, rester dû : sans lui, l'absence d'un numéro ne
// prouverait rien. Client service_role, comme l'unique appelant réel (whatsapp-process) :
// l'appel éprouve au passage le GRANT EXECUTE que les migrations reposent.
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
  const seededPhones: string[] = []
  const linkIds: string[] = []

  /**
   * Entrant de la forme des lignes du webhook : agence posée, contact NULL, il y a 10 min.
   * Non marqué, la clé est OMISE : la ligne prend le défaut de la colonne, comme toute
   * insertion qui l'ignore — un défaut à true ferait disparaître le témoin prospect.
   */
  const seedInbound = async (phone: string, agencyId: string, isFromAgent = false): Promise<void> => {
    const at = new Date(Date.now() - 10 * 60_000).toISOString()
    const { error } = await svc.from('whatsapp_messages').insert({
      provider: 'meta', provider_message_id: `wamid.TEST.avis-lpd.${phone}.${seq++}`,
      direction: 'inbound', wa_from: phone, agency_id: agencyId, contact_id: null,
      body: 'bonjour', created_at: at, wa_timestamp: at,
      ...(isFromAgent ? { is_from_agent: true } : {}),
    })
    if (error) throw new Error(`seedInbound: ${error.message}`)
    seededPhones.push(phone)
  }

  const linkAgent = async (profileId: string, agencyId: string, phone: string): Promise<string> => {
    const { data, error } = await svc.from('whatsapp_agent_links')
      .insert({ profile_id: profileId, agency_id: agencyId, wa_number: phone, verified: true })
      .select('id').single()
    if (error) throw new Error(`lien agent: ${error.message}`)
    const id = (data as { id: string }).id
    linkIds.push(id)
    return id
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
  })

  afterAll(async () => {
    if (!setup) return
    if (seededPhones.length) await svc.from('whatsapp_messages').delete().in('wa_from', seededPhones)
    if (linkIds.length) await svc.from('whatsapp_agent_links').delete().in('id', linkIds)
    await setup.cleanup()
  })

  // Entrants NON marqués : lignes antérieures à la colonne, ou numéro d'agent entré par un
  // autre chemin que la branche agent. C'est la clause du lien qui doit les écarter — et la
  // garde d'envoi, seconde ligne, tient la même frontière (20260910204544).
  describe('un numéro d’agent vérifié : clause du lien et garde d’envoi', () => {
    let linkId = ''
    const agent = freshPhone()
    /** Le numéro de l'agent au format national : même personne pour normalize_phone. */
    const agentNational = '0' + agent.slice(-9)
    const prospect = freshPhone()

    beforeAll(async () => {
      linkId = await linkAgent(setup.agentAId, setup.agencyAId, agent)
      await seedInbound(agent, setup.agencyAId)          // agence courante du lien
      await seedInbound(agent, setup.agencyBId)          // resté sur l'agence d'avant le changement de lien
      await seedInbound(agentNational, setup.agencyAId)  // même numéro, autre format
      await seedInbound(prospect, setup.agencyAId)       // le témoin : même forme, sans lien
    })

    /** Verdict de la garde pour un avis LPD, comme whatsapp-process le demande (ni fiche ni profil). */
    const garde = async (phone: string) => {
      const { data, error } = await svc.rpc('whatsapp_send_allowed', {
        p_wa_phone: phone, p_purpose: 'lpd_notice', p_agency_id: setup.agencyAId,
      })
      if (error) throw new Error(`whatsapp_send_allowed: ${error.code} ${error.message}`)
      const rows = (data ?? []) as Array<{ allowed: boolean; reason: string; legal_basis: string | null; subject_kind: string | null }>
      expect(rows, 'la garde rend exactement une ligne').toHaveLength(1)
      return rows[0]
    }

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
      // Retirer la vérification remet les trois entrants non marqués dans le cas général. C'est
      // aussi ce qui prouve qu'ils étaient éligibles, et que seule la clause du lien les écartait
      // plus haut — pas un avis déjà enregistré ni une suppression.
      const { error } = await svc.from('whatsapp_agent_links').update({ verified: false }).eq('id', linkId)
      if (error) throw new Error(`lien non vérifié: ${error.message}`)
      try {
        const aviserA = await dus(setup.agencyAId)
        expect(aviserA).toContain(agent)
        expect(aviserA).toContain(agentNational)
        expect(await dus(setup.agencyBId)).toContain(agent)
        // La garde suit la même frontière : sans lien vérifié, le numéro en est un comme un autre.
        expect((await garde(agent)).allowed, 'la garde, sans lien vérifié').toBe(true)
      } finally {
        await svc.from('whatsapp_agent_links').update({ verified: true }).eq('id', linkId)
      }
    })

    it('la garde refuse lpd_notice au numéro d’un agent vérifié ; le prospect le reçoit', async () => {
      // Témoin d'abord : une garde qui refuserait tout passerait l'assertion suivante.
      expect(await garde(prospect), 'un prospect reçoit l’avis').toMatchObject({
        allowed: true, reason: 'ok', legal_basis: 'legal_obligation',
      })
      expect(await garde(agent)).toMatchObject({
        allowed: false, reason: 'notice_not_for_agent', subject_kind: 'profile',
      })
    })

    it('la garde refuse aussi quand l’agent a une FICHE : le sujet dérivé est alors « contact »', async () => {
      // Le cas réel du 10.09 : le seul agent vérifié avait aussi une fiche, et la garde le
      // dérivait 'contact' à son étape 2. Un refus limité aux profils l'aurait laissé passer.
      const { data: fiche, error } = await svc.from('contacts').insert({
        agency_id: setup.agencyAId, first_name: 'Agent', last_name: 'AussiFiche',
        email: `agent-fiche-${agent}@megga-test.local`, phone: agent, source: 'manual', type: 'lead',
      }).select('id').single()
      if (error) throw new Error(`fiche de l’agent: ${error.message}`)
      try {
        expect(await garde(agent)).toMatchObject({
          allowed: false, reason: 'notice_not_for_agent', subject_kind: 'contact',
        })
      } finally {
        await svc.from('contacts').delete().eq('id', (fiche as { id: string }).id)
      }
    })
  })

  // Entrants MARQUÉS, comme le webhook les écrit depuis 20260910200728.
  describe('le marqueur is_from_agent : une déliaison ne rouvre pas l’avis', () => {
    const agent = freshPhone()

    beforeAll(async () => {
      await linkAgent(setup.agentBId, setup.agencyBId, agent)
      await seedInbound(agent, setup.agencyBId, true)
    })

    it('après unlink_whatsapp_number, l’entrant reçu côté agent reste sans avis', async () => {
      expect(await dus(setup.agencyBId), 'avant la déliaison').not.toContain(agent)

      // La vraie RPC, appelée par l'agent lui-même : c'est elle qui ouvrait le trou. Depuis
      // 20260817143430 elle ne SUPPRIME pas la ligne, elle en efface le numéro et la
      // vérification — la clause du lien ne peut donc plus rien reconnaître.
      const { error } = await setup.clientB.rpc('unlink_whatsapp_number')
      if (error) throw new Error(`unlink_whatsapp_number: ${error.message}`)
      const { data: lien } = await svc.from('whatsapp_agent_links')
        .select('verified, wa_number').eq('profile_id', setup.agentBId).single()
      expect(lien, 'la déliaison doit avoir effacé numéro et vérification, sinon le test ne prouve rien')
        .toMatchObject({ verified: false, wa_number: null })

      expect(await dus(setup.agencyBId), 'le lien délié ne témoigne plus : seul le marqueur tient')
        .not.toContain(agent)
    })

    it('un message NON marqué du même numéro, après la déliaison, est dû : ce n’est plus un agent', async () => {
      // Ce que la branche client écrit une fois le lien supprimé. Il prouve aussi que le numéro
      // n'était écarté ni par un avis déjà enregistré, ni par une suppression. Le lien est
      // délié ici aussi, comme le fait la RPC, pour que ce test ne dépende pas du précédent.
      await svc.from('whatsapp_agent_links')
        .update({ verified: false, wa_number: null }).eq('profile_id', setup.agentBId)
      await seedInbound(agent, setup.agencyBId)
      expect(await dus(setup.agencyBId)).toContain(agent)
    })
  })
})
