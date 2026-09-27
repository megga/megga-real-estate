// Matching · lot C (migration 20260922160000_matching_explique.sql).
//   E1  `properties.off_market` : faux par défaut ; un mandat ACTIF qui bascule voit supprimés les matchs jamais
//       proposés des acheteurs qui DEMANDENT l'off-market (le moteur les recrée) — ni ceux qui ont une histoire, ni
//       ceux des autres acheteurs, dont la note ne bouge pas ; un brouillon qui bascule, ou qui est publié
//       off-market d'une seule écriture (`on_property_active` lance déjà le moteur), rien.
//   E2  `match_candidate_listings` rend chambres et années.
//   E3  l'edge matching-engine, mode `prospects` : recherche close depuis plus de 90 jours, ou deal perdu ; ni une
//       recherche fermée il y a 20 jours sans deal perdu, ni un acheteur déjà sur le bien (match, ou deal sur CE
//       bien), ni une autre agence.
//   E4  mode `reactiver-prospect` : d'un bloc, le match naît `suggested` avec la note du moteur, la recherche rouvre,
//       UNE ligne au journal ; un second appel est refusé (409) ; une autre agence ne trouve rien (404), ni une
//       recherche de l'agence qui désigne le contact d'une autre (404 à l'edge, NULL à la RPC elle-même).
//   E5  un mandat qui n'est pas en service est introuvable (404) : le moteur ne note que les mandats actifs.
// Tourne contre `supabase start` (SUPABASE_TEST_*), jamais la prod. skipIf sans clés.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_JWT)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const JOUR = 86_400_000
const CRITERES = { transaction_type: 'buy', type: 'apartment', zones: ['Genève', 'GE'], budget_max: 2_500_000, rooms_min: 5 }

async function tokenOf(client: TwoAgenciesSetup['clientA']): Promise<string> {
  const { data } = await client.auth.getSession()
  const t = data.session?.access_token
  if (!t) throw new Error('session attendue')
  return t
}

async function invoke(jwt: string, body: unknown) {
  const res = await fetch(`${URL}/functions/v1/matching-engine`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json().catch(() => ({})) as Record<string, unknown> }
}

describe.skipIf(!HAS_KEYS)('matching · lot C — expliqué et inversé', () => {
  let s: TwoAgenciesSetup
  let svc: SupabaseClient
  const contacts: string[] = []
  const biens: string[] = []
  const deals: string[] = []
  const annonces: string[] = []

  const mkContact = async (agencyId: string, nom: string) => {
    const { data, error } = await svc.from('contacts').insert({
      agency_id: agencyId, first_name: 'Explique', last_name: `${nom} ${s.stamp}`, type: 'buyer', search_criteria: null,
    }).select('id').single()
    if (error) throw new Error(`contacts ${nom}: ${error.message}`)
    contacts.push(data.id as string)
    return data.id as string
  }
  /** Une recherche insérée à la main, pour en choisir les critères, l'état et la date (le pont n'en crée que d'actives). */
  const mkRecherche = async (agencyId: string, contactId: string, champs: {
    criteria?: Record<string, unknown>; is_active?: boolean; joursDepuis?: number
  } = {}) => {
    const { data, error } = await svc.from('client_searches').insert({
      agency_id: agencyId, contact_id: contactId, criteria: champs.criteria ?? CRITERES, is_active: champs.is_active ?? true,
      updated_at: new Date(Date.now() - (champs.joursDepuis ?? 0) * JOUR).toISOString(),
    }).select('id').single()
    if (error) throw new Error(`client_searches: ${error.message}`)
    return data.id as string
  }
  /** Une recherche CLOSE, datée : ce que lit le mode `prospects`. */
  const mkRechercheClose = (agencyId: string, contactId: string, joursDepuis: number) =>
    mkRecherche(agencyId, contactId, { is_active: false, joursDepuis })
  // 'draft' par défaut. Un mandat 'active' déclenche `on_property_active`, qui ne fait rien sans
  // `app_config.supabase_url` (le local et la CI n'en ont pas) ; `prospects` et `reactiver-prospect` ne trouvent
  // qu'un mandat actif, comme le moteur.
  const mkBien = async (agencyId: string, tag: string, status: 'draft' | 'active' = 'draft') => {
    const { data, error } = await svc.from('properties').insert({
      agency_id: agencyId, title: `Explique ${tag} ${s.stamp}`, type: 'apartment', status, transaction_type: 'buy',
      price: 2_350_000, rooms: 5.5, surface_m2: 168, city: 'Genève', canton: 'GE',
    }).select('id').single()
    if (error) throw new Error(`properties ${tag}: ${error.message}`)
    biens.push(data.id as string)
    return data.id as string
  }
  /** Un deal perdu de l'agence A, écrit à l'instant : dans la fenêtre des 24 mois. */
  const mkDealPerdu = async (champs: { contact_buyer_id: string; property_id?: string }) => {
    const { data, error } = await svc.from('transactions').insert({ agency_id: s.agencyAId, stage: 'lost', ...champs }).select('id').single()
    if (error) throw new Error(`transactions: ${error.message}`)
    deals.push(data.id as string)
    return data.id as string
  }

  beforeAll(async () => {
    s = await setupTwoAgencies()
    svc = serviceRoleClient()
  })

  afterAll(async () => {
    if (!svc) return
    // activity_events est append-only : jamais supprimé.
    if (contacts.length) await svc.from('matches').delete().in('contact_id', contacts)
    if (annonces.length) await svc.from('market_listings').delete().in('id', annonces)
    if (deals.length) await svc.from('transactions').delete().in('id', deals)
    if (contacts.length) await svc.from('client_searches').delete().in('contact_id', contacts)
    if (biens.length) await svc.from('properties').delete().in('id', biens)
    if (contacts.length) await svc.from('contacts').delete().in('id', contacts)
    await s.cleanup()
  })

  it('E1 — off_market : faux par défaut ; la bascule d’un mandat actif renote les acheteurs qui le demandent, eux seuls', async () => {
    const brouillon = await mkBien(s.agencyAId, 'e1-brouillon')
    const { data: lu } = await svc.from('properties').select('off_market').eq('id', brouillon).single()
    expect((lu as { off_market: boolean }).off_market).toBe(false)

    // Le trigger ne supprime rien sans configuration pour rappeler le moteur, et le local n'en a pas : on lui en
    // donne une, INERTE (l'appel part vers un port fermé), le temps du test — comme B5b du lot B.
    const cles = ['supabase_url', 'service_role_key']
    const { data: avant } = await svc.from('app_config').select('key, value').in('key', cles)
    const precedentes = new Map(((avant ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value]))
    await svc.from('app_config').upsert([
      { key: 'supabase_url', value: 'http://127.0.0.1:9' },
      { key: 'service_role_key', value: 'spec-explique-inerte' },
    ], { onConflict: 'key' })
    try {
      const actif = await mkBien(s.agencyAId, 'e1-actif', 'active')
      const publie = await mkBien(s.agencyAId, 'e1-publie')
      // c1 et c2 demandent l'off-market ; pour c3 l'axe est inactif, sa note ne dépend pas de l'interrupteur.
      const offMarket = { ...CRITERES, off_market_only: true }
      const c1 = await mkContact(s.agencyAId, 'E1-jamais')
      const r1 = await mkRecherche(s.agencyAId, c1, { criteria: offMarket })
      const c2 = await mkContact(s.agencyAId, 'E1-propose')
      const r2 = await mkRecherche(s.agencyAId, c2, { criteria: offMarket })
      const c3 = await mkContact(s.agencyAId, 'E1-public')
      const r3 = await mkRecherche(s.agencyAId, c3)
      const ins = async (contactId: string, bienId: string, rechercheId: string, champs: Record<string, unknown> = {}) => {
        const { data, error } = await svc.from('matches').insert({
          agency_id: s.agencyAId, contact_id: contactId, property_id: bienId, client_search_id: rechercheId, score: 80,
          status: 'suggested', source: 'internal', ...champs,
        }).select('id').single()
        if (error) throw new Error(`matches: ${error.message}`)
        return data.id as string
      }
      const maj = async (bienId: string, champs: Record<string, unknown>) => {
        const { error } = await svc.from('properties').update(champs).eq('id', bienId)
        if (error) throw new Error(`properties: ${error.message}`)
      }
      const jamais = await ins(c1, actif, r1)
      const propose = await ins(c2, actif, r2, { status: 'sent', sent_via: 'agent', sent_at: new Date().toISOString() })
      const autreAcheteur = await ins(c3, actif, r3)
      const surBrouillon = await ins(c1, brouillon, r1)
      const surPublie = await ins(c1, publie, r1)
      await maj(actif, { off_market: true })
      await maj(brouillon, { off_market: true })
      await maj(publie, { status: 'active', off_market: true })
      const existe = async (id: string) => ((await svc.from('matches').select('id').eq('id', id)).data ?? []).length === 1
      expect(await existe(jamais), 'jamais proposé, recherche off-market : supprimé, le moteur le recrée').toBe(false)
      expect(await existe(propose), 'proposé : il a une histoire, il reste').toBe(true)
      expect(await existe(autreAcheteur), 'une recherche sans off-market : sa note ne bouge pas, il reste').toBe(true)
      expect(await existe(surBrouillon), 'un brouillon n’est pas noté : rien ne bouge').toBe(true)
      expect(await existe(surPublie), 'publié off-market d’un coup : on_property_active lance le moteur, pas ce trigger').toBe(true)
    } finally {
      for (const k of cles) {
        if (precedentes.has(k)) await svc.from('app_config').update({ value: precedentes.get(k) }).eq('key', k)
        else await svc.from('app_config').delete().eq('key', k)
      }
    }
  })

  it('E2 — match_candidate_listings rend chambres et années', async () => {
    // Une ville UNIQUE au passage : le pré-filtre ne rend que l'annonce semée, quoi que porte la table.
    const ville = `Explique-${s.stamp}`
    const { data: a, error: aErr } = await svc.from('market_listings').insert({
      source_id: `explique-e2-${s.stamp}`, source_portal: 'flatfox', title: `Explique E2 ${s.stamp}`,
      city: ville, canton: 'GE', type: 'apartment', transaction_type: 'buy', quality_score: 70, status: 'active',
      price: 1_000_000, current_price: 1_000_000, bedrooms: 3, year_built: 2020, year_renovated: null,
    }).select('id').single()
    if (aErr) throw new Error(`market_listings: ${aErr.message}`)
    annonces.push(a.id as string)
    const { data, error } = await svc.rpc('match_candidate_listings', { p_tx: 'buy', p_city: ville, p_limit: 5 })
    expect(error).toBeNull()
    expect(data).toEqual([expect.objectContaining({ id: a.id, bedrooms: 3, year_built: 2020, year_renovated: null })])
  })

  it('E3 — prospects : recherche close depuis 90 jours, ou deal perdu ; ni récente sans deal, ni déjà sur le bien', async () => {
    const bien = await mkBien(s.agencyAId, 'e3', 'active')
    const ancien = await mkContact(s.agencyAId, 'E3-ancien')
    await mkRechercheClose(s.agencyAId, ancien, 120)
    const recent = await mkContact(s.agencyAId, 'E3-recent')
    await mkRechercheClose(s.agencyAId, recent, 20)
    const perdu = await mkContact(s.agencyAId, 'E3-perdu')
    await mkRechercheClose(s.agencyAId, perdu, 20)
    await mkDealPerdu({ contact_buyer_id: perdu })
    const deja = await mkContact(s.agencyAId, 'E3-deja')
    await mkRechercheClose(s.agencyAId, deja, 200)
    await svc.from('matches').insert({ agency_id: s.agencyAId, contact_id: deja, property_id: bien, score: 70, status: 'ignored', source: 'internal' })
    // Un deal perdu SUR CE BIEN : c'est ce bien-là qui n'a pas convenu, même close depuis 120 jours sa recherche
    // n'en fait pas un ancien prospect.
    const perduIci = await mkContact(s.agencyAId, 'E3-perdu-ici')
    await mkRechercheClose(s.agencyAId, perduIci, 120)
    await mkDealPerdu({ contact_buyer_id: perduIci, property_id: bien })

    const { status, body } = await invoke(await tokenOf(s.clientA), { mode: 'prospects', property_id: bien })
    expect(status, JSON.stringify(body)).toBe(200)
    const prospects = body.prospects as { contact_id: string; origine: string; score: number }[]
    expect(prospects.map((p) => p.contact_id).sort()).toEqual([ancien, perdu].sort())
    expect(prospects.find((p) => p.contact_id === perdu)?.origine).toBe('deal_perdu')
    expect(prospects.find((p) => p.contact_id === ancien)?.origine).toBe('recherche_close')
    for (const p of prospects) expect(p.score).toBeGreaterThanOrEqual(55)

    const etranger = await invoke(await tokenOf(s.clientB), { mode: 'prospects', property_id: bien })
    expect(etranger.status).toBe(404)
  })

  it('E4 — reactiver-prospect : d’un bloc, le match naît, la recherche rouvre, UNE ligne au journal ; puis 409', async () => {
    const bien = await mkBien(s.agencyAId, 'e4', 'active')
    const c = await mkContact(s.agencyAId, 'E4')
    const recherche = await mkRechercheClose(s.agencyAId, c, 120)
    const etranger = await invoke(await tokenOf(s.clientB), { mode: 'reactiver-prospect', property_id: bien, client_search_id: recherche })
    expect(etranger.status).toBe(404)

    const jwt = await tokenOf(s.clientA)
    const { status, body } = await invoke(jwt, { mode: 'reactiver-prospect', property_id: bien, client_search_id: recherche, origine: 'recherche_close' })
    expect(status, JSON.stringify(body)).toBe(200)
    const { data: m } = await svc.from('matches').select('id, status, source, score, client_search_id, score_version').eq('id', body.match_id as string).single()
    expect(m).toMatchObject({ status: 'suggested', source: 'internal', client_search_id: recherche, score: body.score })
    expect((m as { score_version: number | null }).score_version).not.toBeNull()
    const { data: cs } = await svc.from('client_searches').select('is_active').eq('id', recherche).single()
    expect((cs as { is_active: boolean }).is_active).toBe(true)
    const { data: j } = await svc.from('activity_events').select('actor_kind, actor_id, category, metadata').eq('action', 'prospect_reactive').eq('entity_id', c)
    expect(j ?? []).toHaveLength(1)
    expect(j![0]).toMatchObject({
      actor_kind: 'user', actor_id: s.agentAId, category: 'contact',
      metadata: { client_search_id: recherche, property_id: bien, market_listing_id: null, match_id: body.match_id, origine: 'recherche_close' },
    })

    const encore = await invoke(jwt, { mode: 'reactiver-prospect', property_id: bien, client_search_id: recherche })
    expect(encore.status).toBe(409)

    // Défense en profondeur : une recherche de l'agence qui désigne le contact d'une AUTRE agence. L'edge la refuse,
    // et la RPC, appelée sans elle, ne crée rien non plus.
    const autre = await mkContact(s.agencyBId, 'E4-autre-agence')
    const piege = await mkRechercheClose(s.agencyAId, autre, 120)
    const croise = await invoke(jwt, { mode: 'reactiver-prospect', property_id: bien, client_search_id: piege })
    expect(croise.status, JSON.stringify(croise.body)).toBe(404)
    const { data: rien, error: rErr } = await svc.rpc('matching_reactiver_prospect', {
      p_agency_id: s.agencyAId, p_acteur_id: s.agentAId, p_client_search_id: piege, p_property_id: bien,
      p_market_listing_id: null, p_score: 80, p_reasons: {}, p_score_version: 4, p_origine: 'recherche_close',
    })
    expect(rErr).toBeNull()
    expect(rien).toBeNull()
    expect((await svc.from('matches').select('id').eq('contact_id', autre)).data ?? []).toHaveLength(0)
  })

  it('E5 — un mandat qui n’est pas en service est introuvable : le moteur ne note que les mandats actifs', async () => {
    const brouillon = await mkBien(s.agencyAId, 'e5')
    const jwt = await tokenOf(s.clientA)
    const lecture = await invoke(jwt, { mode: 'prospects', property_id: brouillon })
    expect(lecture.status, JSON.stringify(lecture.body)).toBe(404)

    const c = await mkContact(s.agencyAId, 'E5')
    const recherche = await mkRechercheClose(s.agencyAId, c, 120)
    const geste = await invoke(jwt, { mode: 'reactiver-prospect', property_id: brouillon, client_search_id: recherche })
    expect(geste).toMatchObject({ status: 404, body: { error: 'bien_not_found' } })
    expect((await svc.from('matches').select('id').eq('contact_id', c)).data ?? []).toHaveLength(0)
  })
})
