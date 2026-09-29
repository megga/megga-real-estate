// Matching · lot D1 — `matching_actions_du_jour` et `today_absence` (migration …_matching_surfaces.sql).
//   A1  les quatre sortes, dans l'ordre : retours dus, baisses (la plus forte d'abord), nouveaux mandats, marché.
//   A2  cinq au plus par défaut, vingt au plus demandé ; `total` compte tout, avant la coupe.
//   A3  un retour ne compte que ses biens encore sans réponse ; une relance dont aucun bien n'attend, ou pas encore
//       échue, ne fait pas de retour.
//   A4  le cloisonnement : rien d'une autre agence ; un appelant anonyme est refusé.
//   A5  le marché nomme UNE annonce, compte au-delà ; un bien déjà proposé n'y est pas (sa baisse est l'action 2).
//   A6  ni prix nul, ni revenu reporté, ni annonce retirée, ni mandat vendu, ni mandat ancien.
//   T1  `today_absence` : une relance de proposition dit son type et ses biens encore sans réponse.
// Tourne contre `supabase start` (SUPABASE_TEST_*), jamais la prod. skipIf sans clés.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { anonClient, serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const JOUR = 86_400_000
const ilYA = (jours: number) => new Date(Date.now() - jours * JOUR).toISOString()
const dansJours = (jours: number) => new Date(Date.now() + jours * JOUR).toISOString()

interface Action {
  genre: string; contact_id: string | null; prenom: string | null; match_id: string | null; property_id: string | null
  market_listing_id: string | null; statut: string | null; titre: string | null; ville: string | null; nombre: number | null
  nouveaux: number | null; baisses: number | null; montant: number | string | null; total: number
}

describe.skipIf(!HAS_KEYS)('matching · lot D1 — les actions du jour', () => {
  let s: TwoAgenciesSetup
  let svc: SupabaseClient
  const contacts: string[] = []
  const annonces: string[] = []
  const biens: string[] = []
  const matchs: string[] = []
  const relances: string[] = []

  const mkContact = async (agencyId: string, prenom: string) => {
    const { data, error } = await svc.from('contacts').insert({
      agency_id: agencyId, first_name: prenom, last_name: `D1 ${s.stamp}`, type: 'buyer',
    }).select('id').single()
    if (error) throw new Error(`contacts ${prenom}: ${error.message}`)
    contacts.push(data.id as string)
    return data.id as string
  }
  /**
   * ⚠ Les champs de la pige se posent À L'INSERTION : `trg_ra_price_status` remet `first_seen_at`,
   * `price_at_first_seen` et `price_reduced_at` à leur valeur d'avant sur tout UPDATE. Par défaut une annonce est
   * VIEILLE (vue il y a 60 jours, jamais baissée) : elle ne fait aucun signal « marché » sans qu'on le demande.
   */
  const mkAnnonce = async (tag: string, champs: Record<string, unknown> = {}) => {
    const prix = (champs.current_price ?? champs.price ?? 1_200_000) as number
    const { data, error } = await svc.from('market_listings').insert({
      source_id: `d1-${tag}-${s.stamp}`, source_portal: 'flatfox', title: `D1 ${tag} ${s.stamp}`,
      city: 'Genève', canton: 'GE', type: 'apartment', transaction_type: 'buy', quality_score: 70, status: 'active',
      price: prix, current_price: prix, price_at_first_seen: prix, first_seen_at: ilYA(60), ...champs,
    }).select('id').single()
    if (error) throw new Error(`market_listings ${tag}: ${error.message}`)
    annonces.push(data.id as string)
    return data.id as string
  }
  const mkBien = async (tag: string, champs: Record<string, unknown>) => {
    const { data, error } = await svc.from('properties').insert({
      agency_id: s.agencyAId, title: `D1 ${tag} ${s.stamp}`, type: 'apartment', transaction_type: 'buy', price: 1_500_000, ...champs,
    }).select('id').single()
    if (error) throw new Error(`properties ${tag}: ${error.message}`)
    biens.push(data.id as string)
    return data.id as string
  }
  const mkMatch = async (agencyId: string, contactId: string, cible: { annonce?: string; bien?: string }, champs: Record<string, unknown> = {}) => {
    const { data, error } = await svc.from('matches').insert({
      agency_id: agencyId, contact_id: contactId, score: 80, status: 'suggested',
      source: cible.annonce ? 'market' : 'internal', market_listing_id: cible.annonce ?? null, property_id: cible.bien ?? null, ...champs,
    }).select('id').single()
    if (error) throw new Error(`matches: ${error.message}`)
    matchs.push(data.id as string)
    return data.id as string
  }
  const mkRelance = async (agencyId: string, contactId: string, ids: string[], triggerAt: string) => {
    const { data, error } = await svc.from('reminders').insert({
      agency_id: agencyId, contact_id: contactId, type: 'follow_up_sent_property', trigger_rule: 'manual', trigger_days: 3,
      trigger_at: triggerAt, status: 'pending', channel: 'task', match_id: ids[0], match_ids: ids.length > 1 ? ids : null,
      message_template: 'Retour (spec D1)',
    }).select('id').single()
    if (error) throw new Error(`reminders: ${error.message}`)
    relances.push(data.id as string)
    return data.id as string
  }
  const actions = async (client: SupabaseClient, limite?: number): Promise<Action[]> => {
    const { data, error } = limite == null
      ? await client.rpc('matching_actions_du_jour')
      : await client.rpc('matching_actions_du_jour', { p_limite: limite })
    if (error) throw new Error(error.message)
    return (data ?? []) as Action[]
  }

  let julie = '', clara = '', theo = '', antoine = '', emma = '', anastasia = '', bob = '', leurre = '', chezB = ''
  let mandatNeuf = '', mTheo = '', mAntoine = '', annonceBob = ''

  beforeAll(async () => {
    s = await setupTwoAgencies()
    svc = serviceRoleClient()
    const A = s.agencyAId
    julie = await mkContact(A, 'Julie')
    clara = await mkContact(A, 'Clara')
    theo = await mkContact(A, 'Théo')
    antoine = await mkContact(A, 'Antoine')
    emma = await mkContact(A, 'Emma')
    anastasia = await mkContact(A, 'Anastasia')
    bob = await mkContact(A, 'Bob')
    leurre = await mkContact(A, 'Leurre')

    // A1/A3 — Julie : deux biens proposés sans réponse, sous une relance échue ; sa seconde relance échue ne couvre
    // qu'un refus. Clara : une relance échue dont le seul bien a sa réponse. Le leurre : une relance à venir.
    // ⚠ La réponse de Clara est DATÉE : `set_match_response_at` ne date qu'en UPDATE, et sans `response_at` aucune
    // réaction n'entre dans « Pendant ton absence » — la dernière assertion de T1 porterait sur une liste vide.
    const j1 = await mkMatch(A, julie, { annonce: await mkAnnonce('j1') }, { status: 'sent', sent_at: ilYA(5), prix_propose: 1_200_000 })
    const j2 = await mkMatch(A, julie, { annonce: await mkAnnonce('j2') }, { status: 'sent', sent_at: ilYA(5), prix_propose: 1_200_000 })
    const j3 = await mkMatch(A, julie, { annonce: await mkAnnonce('j3') }, { status: 'rejected', sent_at: ilYA(9), reaction_motif: 'quartier' })
    await mkRelance(A, julie, [j1, j2], ilYA(1))
    await mkRelance(A, julie, [j3], ilYA(3))
    const c1 = await mkMatch(A, clara, { annonce: await mkAnnonce('c1') }, { status: 'interested', sent_at: ilYA(6), response_at: ilYA(1) })
    await mkRelance(A, clara, [c1], ilYA(2))
    const l1 = await mkMatch(A, leurre, { annonce: await mkAnnonce('l1') }, { status: 'sent', sent_at: ilYA(1), prix_propose: 1_200_000 })
    await mkRelance(A, leurre, [l1], dansJours(2))

    // A1/A6 — les baisses : Théo (proposé à 1'500'000, l'annonce est à 1'400'000) et Antoine (refusé pour le prix à
    // 1'700'000, revenu à 1'400'000) ; la plus forte d'abord. Leurres : un prix nul, un revenu reporté, une annonce retirée,
    // un mandat vendu.
    mTheo = await mkMatch(A, theo, { annonce: await mkAnnonce('theo', { price: 1_400_000 }) }, { status: 'sent', sent_at: ilYA(4), prix_propose: 1_500_000 })
    // Sur le marché aussi, l'annonce d'Antoine est en baisse : elle ne doit pas s'y annoncer une seconde fois (A5).
    mAntoine = await mkMatch(A, antoine, { annonce: await mkAnnonce('antoine', { price: 1_400_000, price_at_first_seen: 1_700_000, price_reduced_at: ilYA(1) }) }, { status: 'suggested', sent_at: ilYA(10), reaction_motif: 'prix', prix_propose: 1_700_000 })
    await mkMatch(A, leurre, { annonce: await mkAnnonce('prix-nul', { price: 0 }) }, { status: 'sent', sent_at: ilYA(4), prix_propose: 1_500_000 })
    await mkMatch(A, leurre, { annonce: await mkAnnonce('reporte', { price: 1_000_000 }) }, { status: 'suggested', reaction_motif: 'prix', prix_propose: 1_500_000, snoozed_until: dansJours(3) })
    await mkMatch(A, leurre, { annonce: await mkAnnonce('retiree', { price: 1_000_000, status: 'removed' }) }, { status: 'sent', sent_at: ilYA(4), prix_propose: 1_500_000 })
    await mkMatch(A, leurre, { bien: await mkBien('vendu', { status: 'sold', price: 1_000_000 }) }, { status: 'sent', sent_at: ilYA(4), prix_propose: 1_500_000 })

    // A1/A6 — un nouveau mandat (mis en service il y a 2 jours) où Emma est compatible ; un mandat ancien (40 jours).
    mandatNeuf = await mkBien('neuf', { status: 'active', published_at: ilYA(2) })
    await mkMatch(A, emma, { bien: mandatNeuf })
    const ancien = await mkBien('ancien', { status: 'active', published_at: ilYA(40), mandate_signed_at: ilYA(45) })
    await mkMatch(A, emma, { bien: ancien })

    // A5 — le marché : Anastasia, une annonce nouvelle et une en baisse ; Bob, une seule, nommée, et une vieille qui ne
    // compte pas. Le bien revenu d'Antoine, déjà proposé, n'y est pas.
    await mkMatch(A, anastasia, { annonce: await mkAnnonce('ana-nouveau', { first_seen_at: ilYA(1) }) })
    await mkMatch(A, anastasia, { annonce: await mkAnnonce('ana-baisse', {
      price: 1_300_000, price_at_first_seen: 1_500_000, price_reduced_at: ilYA(2), first_seen_at: ilYA(30),
    }) })
    annonceBob = await mkAnnonce('bob', { first_seen_at: ilYA(1.5), city: 'Carouge' })
    await mkMatch(A, bob, { annonce: annonceBob })
    await mkMatch(A, bob, { annonce: await mkAnnonce('bob-vieille', { first_seen_at: ilYA(20) }) })

    // A4 — chez B, un retour dû.
    chezB = await mkContact(s.agencyBId, 'ChezB')
    const b1 = await mkMatch(s.agencyBId, chezB, { annonce: await mkAnnonce('b1') }, { status: 'sent', sent_at: ilYA(5) })
    await mkRelance(s.agencyBId, chezB, [b1], ilYA(1))
  })

  afterAll(async () => {
    if (!svc) return
    // activity_events est append-only : jamais supprimé.
    if (relances.length) await svc.from('reminders').delete().in('id', relances)
    if (matchs.length) await svc.from('matches').delete().in('id', matchs)
    if (annonces.length) await svc.from('market_listings').delete().in('id', annonces)
    if (biens.length) await svc.from('properties').delete().in('id', biens)
    if (contacts.length) await svc.from('contacts').delete().in('id', contacts)
    await s.cleanup()
  })

  it('A1 — les quatre sortes, dans l’ordre', async () => {
    const a = await actions(s.clientA, 20)
    expect(a.map((x) => [x.genre, x.contact_id ?? x.property_id])).toEqual([
      ['retour', julie], ['prix', antoine], ['prix', theo], ['mandat', mandatNeuf], ['marche', anastasia], ['marche', bob],
    ])
  })

  it('A2 — cinq au plus par défaut, vingt au plus demandé ; `total` compte tout', async () => {
    expect(await actions(s.clientA)).toHaveLength(5)
    const cinq = await actions(s.clientA, 5)
    expect(cinq).toHaveLength(5)
    expect(cinq.every((x) => x.total === 6)).toBe(true)
    expect(await actions(s.clientA, 1000)).toHaveLength(6)
    expect(await actions(s.clientA, 0)).toHaveLength(1)
  })

  it('A3 — un retour ne compte que ses biens sans réponse', async () => {
    const a = await actions(s.clientA, 20)
    expect(a.filter((x) => x.genre === 'retour')).toEqual([expect.objectContaining({ contact_id: julie, prenom: 'Julie', nombre: 2 })])
    expect(a.some((x) => x.genre === 'retour' && (x.contact_id === clara || x.contact_id === leurre))).toBe(false)
  })

  it('A4 — rien d’une autre agence ; un appelant anonyme est refusé', async () => {
    expect((await actions(s.clientA, 20)).some((x) => x.contact_id === chezB)).toBe(false)
    expect((await actions(s.clientB, 20)).map((x) => [x.genre, x.contact_id])).toEqual([['retour', chezB]])
    const { error } = await anonClient().rpc('matching_actions_du_jour')
    expect(error).not.toBeNull()
  })

  it('A5 — le marché nomme une annonce, compte au-delà ; un bien déjà proposé n’y est pas', async () => {
    const a = await actions(s.clientA, 20)
    expect(a.find((x) => x.genre === 'marche' && x.contact_id === anastasia))
      .toMatchObject({ nombre: 2, nouveaux: 1, baisses: 1, titre: null, market_listing_id: null })
    expect(a.find((x) => x.genre === 'marche' && x.contact_id === bob))
      .toMatchObject({ nombre: 1, nouveaux: 1, baisses: 0, market_listing_id: annonceBob, ville: 'Carouge' })
    expect(a.some((x) => x.genre === 'marche' && x.contact_id === antoine)).toBe(false)
  })

  it('A6 — ni prix nul, ni revenu reporté, ni annonce retirée, ni mandat vendu, ni mandat ancien', async () => {
    const a = await actions(s.clientA, 20)
    const prix = a.filter((x) => x.genre === 'prix')
    expect(prix.map((x) => x.match_id)).toEqual([mAntoine, mTheo])
    expect(prix.map((x) => [x.statut, Number(x.montant)])).toEqual([['suggested', 300_000], ['sent', 100_000]])
    expect(a.filter((x) => x.genre === 'mandat').map((x) => [x.property_id, x.nombre])).toEqual([[mandatNeuf, 1]])
  })

  it('T1 — today_absence : la relance de proposition dit son type et ses biens sans réponse', async () => {
    const { data, error } = await s.clientA.rpc('today_absence', { p_fallback_hours: 72 })
    expect(error).toBeNull()
    const signaux = (data as { signals: { kind: string; contact_id: string | null; reminder_type: string | null; nb_biens: number | null }[] }).signals
    const deJulie = signaux.filter((x) => x.kind === 'reminder' && x.contact_id === julie)
    expect(deJulie.map((x) => x.nb_biens).sort()).toEqual([0, 2])
    expect(deJulie.every((x) => x.reminder_type === 'follow_up_sent_property')).toBe(true)
    // Une réaction consignée n'a ni type de rappel ni biens. Celle de Clara existe : sans elle, `every` rendrait vrai sur rien.
    const reactions = signaux.filter((x) => x.kind !== 'reminder')
    expect(reactions.some((x) => x.contact_id === clara)).toBe(true)
    expect(reactions.every((x) => x.reminder_type == null && x.nb_biens == null)).toBe(true)
  })
})
