// Matching · lot B, la boucle chez l'agent (migration 20260921140000_matching_boucle.sql).
//   B1  prix_propose posé par la base au passage à `sent` (nul pour un « prix sur demande ») ; la réponse
//       d'avant effacée, SA DATE COMPRISE : reproposé, un bien date sa nouvelle réponse.
//   B2  la relance d'une PROPOSITION se clôt quand plus aucun de ses biens n'est `sent` — repoussée depuis
//       « Aujourd'hui » (`snoozed`) comprise.
//   B3  une relance sans match_ids (un seul bien) se clôt sur son match_id.
//   B4  le journal d'un refus porte son motif ; un motif hors vocabulaire est refusé.
//   B5  un bien refusé pour le PRIX revient à proposer quand son prix baisse sous prix_propose
//       (annonce, puis mandat) ; un autre motif, une hausse ou un prix nul ne ramènent rien ; un prix qui
//       réapparaît après un prix nul, si.
//   B5b un mandat ACTIF : `trigger_matching_on_price_change` ne supprime que les matchs jamais proposés —
//       le bien revenu survit à la baisse suivante — ; la purge nocturne non plus.
//   B6  matching_appliquer_notes : service_role seul ; ne touche que les `suggested` de la recherche
//       et de l'agence visées, et ceux que le moteur en a écartés (`recherche_ajustee`) — retenus à nouveau, ils
//       reviennent à proposer, motif effacé ; jamais un match que l'agent a écarté (29.09.2026).
//   B7  l'edge matching-engine, mode rescore-search : renote par le vrai barème ET son pré-filtre, écarte,
//       ne touche pas un match ajouté à la main, fusionne la SEULE clé corrigée (ce qu'un collègue a changé
//       sur une autre reste), pose la fiche identique, prend les refus en compte — plus de 50 —, écrit au
//       journal ; la recherche d'une autre agence est introuvable.
//   B8  matching_ajuster_recherche : service_role seul ; une clé que la fiche n'écrit pas est refusée ; une
//       recherche d'une autre agence ne rend rien et n'écrit rien.
// Tourne contre `supabase start` (SUPABASE_TEST_*), jamais la prod. skipIf sans clés.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_JWT)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const CRITERES = { transaction_type: 'buy', type: 'apartment', zones: ['Genève', 'GE'], budget_max: 1_600_000 }

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

/** Un uuid qui ne désigne aucune ligne : du volume pour les refus d'une correction. */
const uuidFictif = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`

describe.skipIf(!HAS_KEYS)('matching · lot B — la boucle chez l’agent', () => {
  let s: TwoAgenciesSetup
  let svc: SupabaseClient
  const contacts: string[] = []
  const annonces: string[] = []
  const biens: string[] = []
  const matchs: string[] = []
  const relances: string[] = []

  const mkContact = async (agencyId: string, nom: string, criteres: Record<string, unknown> | null = null) => {
    const { data, error } = await svc.from('contacts').insert({
      agency_id: agencyId, first_name: 'Boucle', last_name: `${nom} ${s.stamp}`, type: 'buyer', search_criteria: criteres,
    }).select('id').single()
    if (error) throw new Error(`contacts ${nom}: ${error.message}`)
    contacts.push(data.id as string)
    return data.id as string
  }
  const mkAnnonce = async (tag: string, prix: number, champs: Record<string, unknown> = {}) => {
    const { data, error } = await svc.from('market_listings').insert({
      source_id: `boucle-${tag}-${s.stamp}`, source_portal: 'flatfox', title: `Boucle ${tag} ${s.stamp}`,
      city: 'Genève', canton: 'GE', type: 'apartment', transaction_type: 'buy', rooms: 4.5, surface_m2: 110,
      features: ['Balcon'], price: prix, current_price: prix, quality_score: 70, status: 'active', ...champs,
    }).select('id').single()
    if (error) throw new Error(`market_listings ${tag}: ${error.message}`)
    annonces.push(data.id as string)
    return data.id as string
  }
  // 'draft' par défaut : évite on_property_active (net.http_post) ; un match n'exige qu'une FK valide.
  const mkBien = async (tag: string, prix: number, status: 'draft' | 'active' = 'draft') => {
    const { data, error } = await svc.from('properties').insert({
      agency_id: s.agencyAId, title: `Boucle ${tag} ${s.stamp}`, type: 'apartment', status, transaction_type: 'buy', price: prix,
    }).select('id').single()
    if (error) throw new Error(`properties ${tag}: ${error.message}`)
    biens.push(data.id as string)
    return data.id as string
  }
  const mkMatch = async (contactId: string, cible: { annonce?: string; bien?: string }, champs: Record<string, unknown> = {}) => {
    const { data, error } = await svc.from('matches').insert({
      agency_id: s.agencyAId, contact_id: contactId, score: 80, status: 'suggested',
      source: cible.annonce ? 'market' : 'internal',
      market_listing_id: cible.annonce ?? null, property_id: cible.bien ?? null, ...champs,
    }).select('id').single()
    if (error) throw new Error(`matches: ${error.message}`)
    matchs.push(data.id as string)
    return data.id as string
  }
  const lireMatch = async (id: string) => {
    const { data } = await svc.from('matches').select('*').eq('id', id).maybeSingle()
    return data as Record<string, unknown> | null
  }
  const mkRelance = async (contactId: string, matchId: string, matchIds: string[] | null, status = 'pending') => {
    const { data, error } = await svc.from('reminders').insert({
      agency_id: s.agencyAId, contact_id: contactId, type: 'follow_up_sent_property', trigger_rule: 'manual',
      trigger_days: 3, trigger_at: new Date(Date.now() + 3 * 86_400_000).toISOString(), status, channel: 'task',
      match_id: matchId, match_ids: matchIds, message_template: 'Retour (spec boucle)',
    }).select('id').single()
    if (error) throw new Error(`reminders: ${error.message}`)
    relances.push(data.id as string)
    return data.id as string
  }
  const statutRelance = async (id: string) =>
    ((await svc.from('reminders').select('status').eq('id', id).single()).data as { status: string }).status
  const journal = async (action: string, contactId: string) =>
    ((await svc.from('activity_events').select('actor_kind, category, metadata').eq('action', action).eq('entity_id', contactId)).data ?? []) as
      { actor_kind: string; category: string; metadata: Record<string, unknown> }[]

  beforeAll(async () => {
    s = await setupTwoAgencies()
    svc = serviceRoleClient()
  })

  afterAll(async () => {
    if (!svc) return
    // activity_events est append-only : jamais supprimé.
    if (relances.length) await svc.from('reminders').delete().in('id', relances)
    if (matchs.length) await svc.from('matches').delete().in('id', matchs)
    if (contacts.length) await svc.from('client_searches').delete().in('contact_id', contacts)
    if (annonces.length) await svc.from('market_listings').delete().in('id', annonces)
    if (biens.length) await svc.from('properties').delete().in('id', biens)
    if (contacts.length) await svc.from('contacts').delete().in('id', contacts)
    await s.cleanup()
  })

  it('B1 — prix_propose au passage à `sent` (prix courant de l’annonce) ; la réponse d’avant effacée', async () => {
    const c = await mkContact(s.agencyAId, 'B1')
    const a = await mkAnnonce('b1', 1_400_000, { current_price: 1_350_000 })
    const m = await mkMatch(c, { annonce: a }, { reaction_motif: 'prix', reaction_note: 'avant', apprentissage_at: new Date().toISOString() })
    await svc.from('matches').update({ status: 'sent', sent_via: 'agent', sent_at: new Date().toISOString() }).eq('id', m)
    const apres = await lireMatch(m)
    expect(Number(apres!.prix_propose)).toBe(1_350_000)
    expect(apres!.reaction_motif).toBeNull()
    expect(apres!.reaction_note).toBeNull()
    expect(apres!.apprentissage_at).toBeNull()

    // « Prix sur demande » : aucun prix proposé, plutôt qu'un « proposé à CHF 0 ».
    const surDemande = await mkMatch(c, { annonce: await mkAnnonce('b1-0', 0) })
    await svc.from('matches').update({ status: 'sent', sent_via: 'agent', sent_at: new Date().toISOString() }).eq('id', surDemande)
    expect((await lireMatch(surDemande))!.prix_propose).toBeNull()
  })

  it('B1b — reproposé, un bien date sa NOUVELLE réponse : celle d’avant n’est plus la sienne', async () => {
    const c = await mkContact(s.agencyAId, 'B1b')
    const m = await mkMatch(c, { annonce: await mkAnnonce('b1b', 1_400_000) }, { status: 'sent', sent_via: 'agent' })
    await svc.from('matches').update({ status: 'rejected', reaction_motif: 'prix' }).eq('id', m)
    const premiere = (await lireMatch(m))!.response_at as string
    expect(premiere).not.toBeNull()
    // Revenu (par une baisse), puis reproposé : la réponse d'avant tombe avec son motif.
    await svc.from('matches').update({ status: 'suggested' }).eq('id', m)
    await svc.from('matches').update({ status: 'sent', sent_via: 'agent', sent_at: new Date().toISOString() }).eq('id', m)
    expect((await lireMatch(m))!.response_at).toBeNull()
    await svc.from('matches').update({ status: 'interested' }).eq('id', m)
    const seconde = (await lireMatch(m))!.response_at as string
    expect(Date.parse(seconde)).toBeGreaterThan(Date.parse(premiere))
  })

  it('B2 — une sélection : la relance tient tant qu’un bien attend, se clôt au dernier', async () => {
    const c = await mkContact(s.agencyAId, 'B2')
    const a1 = await mkAnnonce('b2a', 1_200_000)
    const a2 = await mkAnnonce('b2b', 1_250_000)
    const m1 = await mkMatch(c, { annonce: a1 }, { status: 'sent' })
    const m2 = await mkMatch(c, { annonce: a2 }, { status: 'sent' })
    const r = await mkRelance(c, m2, [m1, m2])
    await svc.from('matches').update({ status: 'interested' }).eq('id', m2)
    expect(await statutRelance(r), 'm1 attend encore').toBe('pending')
    await svc.from('matches').update({ status: 'rejected', reaction_motif: 'quartier' }).eq('id', m1)
    expect(await statutRelance(r)).toBe('done')
  })

  it('B2b — une relance repoussée depuis « Aujourd’hui » (`snoozed`) se clôt de même', async () => {
    const c = await mkContact(s.agencyAId, 'B2b')
    const m1 = await mkMatch(c, { annonce: await mkAnnonce('b2c', 1_200_000) }, { status: 'sent' })
    const m2 = await mkMatch(c, { annonce: await mkAnnonce('b2d', 1_250_000) }, { status: 'sent' })
    const r = await mkRelance(c, m2, [m1, m2], 'snoozed')
    await svc.from('matches').update({ status: 'interested' }).eq('id', m1)
    expect(await statutRelance(r), 'm2 attend encore').toBe('snoozed')
    await svc.from('matches').update({ status: 'rejected', reaction_motif: 'surface' }).eq('id', m2)
    expect(await statutRelance(r)).toBe('done')
  })

  it('B3 — une relance sans match_ids se clôt sur la réponse à son match_id', async () => {
    const c = await mkContact(s.agencyAId, 'B3')
    const m = await mkMatch(c, { annonce: await mkAnnonce('b3', 1_100_000) }, { status: 'sent' })
    const r = await mkRelance(c, m, null)
    await svc.from('matches').update({ status: 'rejected', reaction_motif: 'surface' }).eq('id', m)
    expect(await statutRelance(r)).toBe('done')
  })

  it('B4 — le journal d’un refus porte son motif ; un motif inconnu est refusé', async () => {
    const c = await mkContact(s.agencyAId, 'B4')
    const m = await mkMatch(c, { annonce: await mkAnnonce('b4', 1_000_000) }, { status: 'sent' })
    await svc.from('matches').update({ status: 'rejected', reaction_motif: 'prix' }).eq('id', m)
    expect((await journal('match_reaction', c)).some((e) => e.metadata.match_id === m && e.metadata.motif === 'prix')).toBe(true)
    const { error } = await svc.from('matches').update({ reaction_motif: 'trop cher' }).eq('id', m)
    expect(error?.code).toBe('23514')
  })

  it('B5 — refusé pour le prix : revient sur une BAISSE sous le prix proposé ; ni un autre motif, ni une hausse, ni un prix nul', async () => {
    const c = await mkContact(s.agencyAId, 'B5')
    const a = await mkAnnonce('b5', 1_500_000)
    const prix = await mkMatch(c, { annonce: a }, { status: 'rejected', reaction_motif: 'prix', prix_propose: 1_500_000 })
    const c2 = await mkContact(s.agencyAId, 'B5bis')
    const quartier = await mkMatch(c2, { annonce: a }, { status: 'rejected', reaction_motif: 'quartier', prix_propose: 1_500_000 })
    await svc.from('market_listings').update({ current_price: 1_550_000 }).eq('id', a)
    expect((await lireMatch(prix))!.status, 'une hausse ne ramène rien').toBe('rejected')
    await svc.from('market_listings').update({ current_price: 1_450_000 }).eq('id', a)
    const revenu = await lireMatch(prix)
    expect(revenu!.status).toBe('suggested')
    expect(revenu!.reaction_motif, 'le motif reste : c’est lui qui écrit le signal').toBe('prix')
    expect(Number(revenu!.prix_propose)).toBe(1_500_000)
    expect((await lireMatch(quartier))!.status).toBe('rejected')
    expect((await journal('match_retour_prix', c)).some((e) => e.metadata.match_id === prix)).toBe(true)

    const b = await mkBien('b5', 2_100_000)
    const c3 = await mkContact(s.agencyAId, 'B5ter')
    const mandat = await mkMatch(c3, { bien: b }, { status: 'rejected', reaction_motif: 'prix', prix_propose: 2_100_000 })
    await svc.from('properties').update({ price: 1_950_000 }).eq('id', b)
    expect((await lireMatch(mandat))!.status).toBe('suggested')

    // « Prix sur demande » : un prix nul n'est pas une baisse, ni sur une annonce, ni sur un mandat.
    const c4 = await mkContact(s.agencyAId, 'B5zero')
    const a0 = await mkAnnonce('b5-0', 1_500_000)
    const refuse0 = await mkMatch(c4, { annonce: a0 }, { status: 'rejected', reaction_motif: 'prix', prix_propose: 1_500_000 })
    await svc.from('market_listings').update({ current_price: 0, price: 0 }).eq('id', a0)
    expect((await lireMatch(refuse0))!.status).toBe('rejected')
    expect((await journal('match_retour_prix', c4))).toEqual([])
    const b0 = await mkBien('b5-0', 2_000_000)
    const mandat0 = await mkMatch(c4, { bien: b0 }, { status: 'rejected', reaction_motif: 'prix', prix_propose: 2_000_000 })
    await svc.from('properties').update({ price: 0 }).eq('id', b0)
    expect((await lireMatch(mandat0))!.status).toBe('rejected')
    // Un prix qui RÉAPPARAÎT sous le prix proposé : c'est une baisse pour l'acheteur, il revient.
    await svc.from('market_listings').update({ current_price: 1_400_000, price: 1_400_000 }).eq('id', a0)
    expect((await lireMatch(refuse0))!.status).toBe('suggested')
  })

  it('B5b — mandat ACTIF : le bien revenu survit à la baisse suivante ; la purge nocturne aussi', async () => {
    // `trigger_matching_on_price_change` ne supprime rien sans configuration pour rappeler le moteur, et le
    // local n'en a pas : on lui en donne une, INERTE (l'appel part vers un port fermé), le temps du test.
    const cles = ['supabase_url', 'service_role_key']
    const { data: avant } = await svc.from('app_config').select('key, value').in('key', cles)
    const precedentes = new Map(((avant ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value]))
    const { error: cfgErr } = await svc.from('app_config').upsert([
      { key: 'supabase_url', value: 'http://127.0.0.1:9' },
      { key: 'service_role_key', value: 'spec-boucle-inerte' },
    ], { onConflict: 'key' })
    if (cfgErr) throw new Error(`app_config: ${cfgErr.message}`)
    try {
      const b = await mkBien('b5b', 2_100_000, 'active')
      const c = await mkContact(s.agencyAId, 'B5b')
      const revenu = await mkMatch(c, { bien: b }, {
        status: 'rejected', reaction_motif: 'prix', prix_propose: 2_100_000, sent_via: 'agent', sent_at: new Date().toISOString(),
      })
      const c2 = await mkContact(s.agencyAId, 'B5b-jamais')
      const jamais = await mkMatch(c2, { bien: b })
      await svc.from('properties').update({ price: 1_950_000 }).eq('id', b)
      expect(await lireMatch(revenu)).toMatchObject({ status: 'suggested', reaction_motif: 'prix' })
      expect(await lireMatch(jamais), 'jamais proposé : supprimé, le moteur le recrée au nouveau prix').toBeNull()
      // La baisse SUIVANTE trouve le bien revenu `suggested` : il garde sa ligne et son historique.
      await svc.from('properties').update({ price: 1_900_000 }).eq('id', b)
      const apres = await lireMatch(revenu)
      expect(apres).toMatchObject({ status: 'suggested', reaction_motif: 'prix' })
      expect(Number(apres!.prix_propose)).toBe(2_100_000)
    } finally {
      for (const k of cles) {
        if (precedentes.has(k)) await svc.from('app_config').update({ value: precedentes.get(k) }).eq('key', k)
        else await svc.from('app_config').delete().eq('key', k)
      }
    }

    // La purge nocturne des annonces retirées : les matchs jamais proposés partent, un bien revenu reste.
    const a = await mkAnnonce('b5b-retiree', 1_500_000, { status: 'removed' })
    const c3 = await mkContact(s.agencyAId, 'B5b-purge')
    const c4 = await mkContact(s.agencyAId, 'B5b-garde')
    const nu = await mkMatch(c3, { annonce: a })
    const garde = await mkMatch(c4, { annonce: a }, {
      reaction_motif: 'prix', prix_propose: 1_600_000, sent_via: 'agent', sent_at: new Date().toISOString(),
    })
    const { error } = await svc.rpc('purge_stale_market_matches')
    expect(error).toBeNull()
    expect(await lireMatch(nu)).toBeNull()
    expect(await lireMatch(garde)).toMatchObject({ status: 'suggested', reaction_motif: 'prix' })
  })

  it('B6 — matching_appliquer_notes : refusée à un agent ; ne réécrit que les `suggested` de la recherche visée, et les écarts du moteur', async () => {
    const c = await mkContact(s.agencyAId, 'B6')
    const { data: rs, error: re } = await svc.from('client_searches')
      .insert({ agency_id: s.agencyAId, contact_id: c, criteria: CRITERES, is_active: false }).select('id').single()
    if (re) throw new Error(re.message)
    const recherche = rs.id as string
    const vise = await mkMatch(c, { annonce: await mkAnnonce('b6a', 1_000_000) }, { client_search_id: recherche })
    const repondu = await mkMatch(c, { annonce: await mkAnnonce('b6b', 1_000_000) }, { client_search_id: recherche, status: 'interested' })
    // Écartés par le moteur : l'un est retenu à nouveau (il revient), l'autre non (il reste écarté, à sa nouvelle note).
    const ecartMoteur = { client_search_id: recherche, status: 'ignored', reaction_motif: 'recherche_ajustee', score: 0 }
    const revenu = await mkMatch(c, { annonce: await mkAnnonce('b6c', 1_000_000) }, ecartMoteur)
    const resteEcarte = await mkMatch(c, { annonce: await mkAnnonce('b6d', 1_000_000) }, ecartMoteur)
    // Écartés par l'agent (« Écarter » : `ignored`, motif effacé ; en défense, un écart d'agent resté avec son motif
    // `prix`) : jamais réécrits, même par une note qui les garderait.
    const ecarteAgent = await mkMatch(c, { annonce: await mkAnnonce('b6e', 1_000_000) }, { client_search_id: recherche, status: 'ignored' })
    const ecarteAgentPrix = await mkMatch(c, { annonce: await mkAnnonce('b6f', 1_000_000) }, {
      client_search_id: recherche, status: 'ignored', reaction_motif: 'prix',
    })
    const notes = [
      { id: vise, score: 42, reasons: { budget: { match: false, score: 0, detail: 'x' } }, score_version: 4, ecarte: true },
      { id: repondu, score: 42, reasons: {}, score_version: 4, ecarte: true },
      { id: revenu, score: 91, reasons: {}, score_version: 4, ecarte: false },
      { id: resteEcarte, score: 30, reasons: {}, score_version: 4, ecarte: true },
      { id: ecarteAgent, score: 91, reasons: {}, score_version: 4, ecarte: false },
      { id: ecarteAgentPrix, score: 91, reasons: {}, score_version: 4, ecarte: false },
    ]
    const refus = await s.clientA.rpc('matching_appliquer_notes', { p_agency_id: s.agencyAId, p_client_search_id: recherche, p_notes: notes })
    expect(refus.error?.code).toBe('42501')
    const { data, error } = await svc.rpc('matching_appliquer_notes', { p_agency_id: s.agencyAId, p_client_search_id: recherche, p_notes: notes })
    expect(error).toBeNull()
    // `returning` ne promet pas d'ordre.
    const parId = (lignes: { id: string; status: string }[]) => [...lignes].sort((a, b) => a.id.localeCompare(b.id))
    expect(parId(data as { id: string; status: string }[])).toEqual(parId([
      { id: vise, status: 'ignored' }, { id: revenu, status: 'suggested' }, { id: resteEcarte, status: 'ignored' },
    ]))
    expect(await lireMatch(vise)).toMatchObject({ status: 'ignored', reaction_motif: 'recherche_ajustee', score: 42, score_version: 4 })
    expect(await lireMatch(repondu)).toMatchObject({ status: 'interested', score: 80 })
    expect(await lireMatch(revenu)).toMatchObject({ status: 'suggested', reaction_motif: null, score: 91, score_version: 4 })
    expect(await lireMatch(resteEcarte)).toMatchObject({ status: 'ignored', reaction_motif: 'recherche_ajustee', score: 30 })
    expect(await lireMatch(ecarteAgent)).toMatchObject({ status: 'ignored', reaction_motif: null, score: 80 })
    expect(await lireMatch(ecarteAgentPrix)).toMatchObject({ status: 'ignored', reaction_motif: 'prix', score: 80 })
    const autreAgence = await svc.rpc('matching_appliquer_notes', { p_agency_id: s.agencyBId, p_client_search_id: recherche, p_notes: notes })
    expect(autreAgence.data).toEqual([])
  })

  it('B7 — rescore-search : le barème et son pré-filtre, la seule clé, la fiche, les refus, le journal', async () => {
    const c = await mkContact(s.agencyAId, 'B7', CRITERES)
    const { data: rs } = await svc.from('client_searches').select('id').eq('contact_id', c).single()
    const recherche = (rs as { id: string }).id
    const ok = await mkMatch(c, { annonce: await mkAnnonce('b7ok', 1_500_000) }, { client_search_id: recherche, score_version: 4 })
    const hors = await mkMatch(c, { annonce: await mkAnnonce('b7hors', 1_700_000) }, { client_search_id: recherche, score_version: 4 })
    const main = await mkMatch(c, { annonce: await mkAnnonce('b7main', 1_720_000) }, { client_search_id: recherche, score: 70, score_version: null })
    const r1 = await mkMatch(c, { annonce: await mkAnnonce('b7r1', 1_480_000) }, { client_search_id: recherche, status: 'rejected', reaction_motif: 'prix', prix_propose: 1_480_000 })
    const r2 = await mkMatch(c, { annonce: await mkAnnonce('b7r2', 1_460_000) }, { client_search_id: recherche, status: 'rejected', reaction_motif: 'prix', prix_propose: 1_460_000 })
    // Un collègue a changé une AUTRE clé depuis que le fil a lu la recherche (la fiche, que le pont recopie) :
    // la correction ne doit pas la remettre. `surface_max` n'entre pas dans le barème, les notes ne bougent pas.
    const aujourdhui = { ...CRITERES, surface_max: 200 }
    await svc.from('contacts').update({ search_criteria: aujourdhui }).eq('id', c)
    const correction = { cle: 'budget_max', valeur: 1_450_000 }
    // Plus de 50 refus (le plafond d'avant) : deux réels, et des ids qui ne désignent rien.
    const refusIds = [r1, r2, ...Array.from({ length: 60 }, (_, i) => uuidFictif(i))]

    const jwtB = await tokenOf(s.clientB)
    const etranger = await invoke('matching-engine', jwtB, { mode: 'rescore-search', client_search_id: recherche, correction })
    expect(etranger.status).toBe(404)
    const jwtA = await tokenOf(s.clientA)
    const illisible = await invoke('matching-engine', jwtA, { mode: 'rescore-search', client_search_id: recherche, correction: { cle: 'budget_min', valeur: 1 } })
    expect(illisible.status).toBe(400)

    const { status, body } = await invoke('matching-engine', jwtA, {
      mode: 'rescore-search', client_search_id: recherche, correction, motif: 'prix', refus_ids: refusIds,
    })
    expect(status, JSON.stringify(body)).toBe(200)
    expect(body).toMatchObject({ reevalues: 2, ecartes: 1 })
    // Notes de calculateScoreV2 (budget, zone, type actifs) : 1'500'000 → 89. 1'700'000 dépasse 1'450'000 à
    // 15 % près : hors du pré-filtre du moteur (`match_candidate_listings`), il sort sans note.
    expect(await lireMatch(ok)).toMatchObject({ status: 'suggested', score: 89 })
    expect(await lireMatch(hors)).toMatchObject({ status: 'ignored', score: 0, reaction_motif: 'recherche_ajustee' })
    expect(await lireMatch(main)).toMatchObject({ status: 'suggested', score: 70 })
    const apres = { ...aujourdhui, budget_max: 1_450_000 }
    const { data: cs } = await svc.from('client_searches').select('criteria').eq('id', recherche).single()
    expect((cs as { criteria: Record<string, unknown> }).criteria).toEqual(apres)
    const { data: fiche } = await svc.from('contacts').select('search_criteria').eq('id', c).single()
    expect((fiche as { search_criteria: Record<string, unknown> }).search_criteria).toEqual(apres)
    expect((await lireMatch(r1))!.apprentissage_at).not.toBeNull()
    expect((await lireMatch(r2))!.apprentissage_at).not.toBeNull()
    expect(await journal('recherche_ajustee', c)).toEqual([expect.objectContaining({
      actor_kind: 'user', category: 'contact',
      metadata: expect.objectContaining({ motif: 'prix', cle: 'budget_max', reevalues: 2, ecartes: 1, apres }),
    })])
  })

  it('B8 — matching_ajuster_recherche : service_role seul, une clé de la fiche, l’agence de la recherche', async () => {
    const c = await mkContact(s.agencyAId, 'B8', CRITERES)
    const { data: rs } = await svc.from('client_searches').select('id').eq('contact_id', c).single()
    const recherche = (rs as { id: string }).id
    const args = {
      p_agency_id: s.agencyAId, p_client_search_id: recherche, p_acteur_id: null, p_cle: 'rooms_min', p_valeur: 4,
      p_motif: 'pieces', p_refus_ids: [], p_bilan: {},
    }
    expect((await s.clientA.rpc('matching_ajuster_recherche', args)).error?.code).toBe('42501')
    expect((await svc.rpc('matching_ajuster_recherche', { ...args, p_cle: 'budget_min' })).error?.code).toBe('22023')
    expect((await svc.rpc('matching_ajuster_recherche', { ...args, p_valeur: 0 })).error?.code).toBe('22023')
    expect((await svc.rpc('matching_ajuster_recherche', { ...args, p_valeur: null })).error?.code).toBe('22023')
    expect((await svc.rpc('matching_ajuster_recherche', { ...args, p_valeur: 'quatre' })).error?.code).toBe('22023')
    const etrangere = await svc.rpc('matching_ajuster_recherche', { ...args, p_agency_id: s.agencyBId })
    expect(etrangere.error).toBeNull()
    expect(etrangere.data).toBeNull()
    const { data: cs } = await svc.from('client_searches').select('criteria').eq('id', recherche).single()
    expect((cs as { criteria: Record<string, unknown> }).criteria).toEqual(CRITERES)
    // Sans clé : rien de posé, la renotation seule au journal.
    const seule = await svc.rpc('matching_ajuster_recherche', { ...args, p_cle: null, p_valeur: null })
    expect(seule.data).toEqual({ apres: CRITERES })
    expect(await journal('matchs_reevalues', c)).toEqual([expect.objectContaining({ actor_kind: 'system', category: 'contact' })])
  })
})
