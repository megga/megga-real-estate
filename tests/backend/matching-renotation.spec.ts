// Matching · lot E1 — la renotation dans le moteur (edge matching-engine ; conception du 27.09.2026, §5.7).
//   R1  `match-contact` (les critères d'une recherche ont changé) renote les matchs à proposer de CHAQUE recherche
//       active du contact, avec ses critères du moment : l'ancienne note remplacée par celle du barème ; hors du
//       pré-filtre ou sous le seuil, `ignored` / `recherche_ajustee` ; un bien déjà proposé (`sent`), un ajout à la
//       main et une recherche close gardent leur note ; UNE ligne `matchs_reevalues`, avec son bilan, par recherche
//       dont un match a changé de note ou de statut — une recherche renotée sans changement n'écrit ni note ni ligne.
//   R2  `scan-all` (le scan de nuit) renote les matchs à proposer qu'une version antérieure du barème a notés, et ceux
//       sans version que le moteur a notés ; ni la version courante, ni un ajout à la main, ni une recherche close ;
//       une version antérieure qui garde sa note est tamponnée, sans ligne ; une ligne par recherche qui a changé.
//   R3  `scan-all` en renote au plus 2 000 par agence et par nuit ; le reste attend la nuit d'après.
//   R4  un second `match-contact` sur les mêmes critères n'écrit rien : aucune note — pas même celles des matchs que
//       le premier a fait naître, la création et la renotation notant pareil — et aucune ligne au journal.
// Une renotation en échec ne rend pas de 500 — le moteur la compte (`echecs`) et crée quand même : chaque cas exige
// `echecs: 0`, sans quoi elle ne se lirait qu'à des notes restées en place.
// Le moteur est appelé comme ses appelants de la base (le déclencheur des critères, le scan de nuit) : le secret de
// service en Bearer, l'agence dans le corps. Le local ne configure pas `app_config.supabase_url` : les déclencheurs n'y
// appellent pas le moteur, la spec le fait à leur place.
// Tourne contre `supabase start` (SUPABASE_TEST_*), jamais la prod. skipIf sans clés.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'
import { waitForEdgeWorker } from './helpers/edge'
import { calculateScoreV2, parseScoringConfig, type ScoringConfig } from '../../supabase/functions/_shared/matching-normalize.ts'
import { tranches } from '../../supabase/functions/_shared/matching-renotation.ts'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_JWT)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const ENDPOINT = `${URL}/functions/v1/matching-engine`
const SERVICE_JWT = process.env.SUPABASE_TEST_SERVICE_ROLE_JWT ?? ''
/** Les colonnes d'une annonce que le moteur note (`COLS_ANNONCE_NOTE`, matching-engine/index.ts). */
const COLS_ANNONCE_NOTE = 'id, price, current_price, type, canton, city, rooms, surface_m2, features, status, price_at_first_seen, transaction_type, quality_score, bedrooms, year_built, year_renovated'
const CRITERES = { transaction_type: 'buy', type: 'apartment', zones: ['Genève', 'GE'], budget_max: 1_600_000 }
/** Des raisons que le moteur a écrites : ses axes, en objets depuis la version 2. */
const RAISONS_MOTEUR = { budget: { match: true, score: 32, detail: 'Dans le budget' } }
/** Une note plantée, qu'aucun barème ne donne à ces biens : la voir changer, c'est voir la renotation. */
const NOTE_PLANTEE = 11

/** Le moteur, appelé comme par la base : le secret de service en Bearer, l'agence dans le corps. */
async function moteur(body: Record<string, unknown>) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SERVICE_JWT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json().catch(() => ({})) as Record<string, unknown> }
}

describe.skipIf(!HAS_KEYS)('matching · lot E1 — la renotation dans le moteur', () => {
  let s: TwoAgenciesSetup
  let svc: SupabaseClient
  /** Le barème que le moteur lit (`get_app_config`) : sa version est la « courante » de ces cas. */
  let cfg: ScoringConfig
  const contacts: string[] = []

  const mkContact = async (agencyId: string, nom: string) => {
    const { data, error } = await svc.from('contacts').insert({
      agency_id: agencyId, first_name: 'Renotation', last_name: `${nom} ${s.stamp}`, type: 'buyer', search_criteria: null,
    }).select('id').single()
    if (error) throw new Error(`contacts ${nom}: ${error.message}`)
    contacts.push(data.id as string)
    return data.id as string
  }
  /** Une recherche insérée à la main, pour en choisir les critères et l'état (le pont n'en crée que d'actives). */
  const mkRecherche = async (agencyId: string, contactId: string, criteria: Record<string, unknown>, isActive = true) => {
    const { data, error } = await svc.from('client_searches')
      .insert({ agency_id: agencyId, contact_id: contactId, criteria, is_active: isActive }).select('id').single()
    if (error) throw new Error(`client_searches: ${error.message}`)
    return data.id as string
  }
  /** Toutes les annonces de la spec portent ce préfixe : une seule suppression les emporte. */
  const annonce = (tag: string, prix: number, champs: Record<string, unknown> = {}) => ({
    source_id: `renot-${s.stamp}-${tag}`, source_portal: 'flatfox', title: `Renotation ${tag} ${s.stamp}`,
    city: 'Genève', canton: 'GE', type: 'apartment', transaction_type: 'buy', rooms: 4.5, surface_m2: 110,
    features: ['Balcon'], price: prix, current_price: prix, quality_score: 70, status: 'active', ...champs,
  })
  const mkAnnonce = async (tag: string, prix: number, champs: Record<string, unknown> = {}) => {
    const { data, error } = await svc.from('market_listings').insert(annonce(tag, prix, champs)).select('id').single()
    if (error) throw new Error(`market_listings ${tag}: ${error.message}`)
    return data.id as string
  }
  /** Un match à proposer noté par la version courante, sauf `champs`. */
  const mkMatch = async (
    agencyId: string, contactId: string, recherche: string, annonceId: string, champs: Record<string, unknown> = {},
  ) => {
    const { data, error } = await svc.from('matches').insert({
      agency_id: agencyId, contact_id: contactId, client_search_id: recherche, market_listing_id: annonceId,
      source: 'market', status: 'suggested', score: NOTE_PLANTEE, reasons: RAISONS_MOTEUR, score_version: cfg.version,
      ...champs,
    }).select('id').single()
    if (error) throw new Error(`matches: ${error.message}`)
    return data.id as string
  }
  const lire = async (id: string) =>
    (await svc.from('matches').select('status, score, reasons, score_version, reaction_motif').eq('id', id).single()).data as
      { status: string; score: number; reasons: unknown; score_version: number | null; reaction_motif: string | null }
  /** La note du barème, comme le moteur la calcule : l'annonce lue par ses colonnes. */
  const noteDe = async (annonceId: string, criteres: Record<string, unknown>) => {
    const { data, error } = await svc.from('market_listings').select(COLS_ANNONCE_NOTE).eq('id', annonceId).single()
    if (error) throw new Error(`market_listings: ${error.message}`)
    return calculateScoreV2(data as Record<string, unknown>, criteres, cfg)
  }
  const journal = async (contactId: string) =>
    ((await svc.from('activity_events').select('actor_kind, category, metadata')
      .eq('action', 'matchs_reevalues').eq('entity_id', contactId)).data ?? []) as
      { actor_kind: string; category: string; metadata: Record<string, unknown> }[]

  // Le démarrage à froid du worker se paie ici, une fois (`waitForEdgeWorker`, qui n'échoue jamais) : un 503 du runtime
  // local n'est pas un verdict du moteur.
  beforeAll(async () => {
    s = await setupTwoAgencies()
    svc = serviceRoleClient()
    const { data, error } = await svc.from('app_config').select('value').eq('key', 'matching_scoring_v2').maybeSingle()
    if (error) throw new Error(`app_config: ${error.message}`)
    cfg = parseScoringConfig((data as { value: string } | null)?.value ?? null)
    await waitForEdgeWorker(ENDPOINT)
  }, 120_000)

  afterAll(async () => {
    if (!svc) return
    // activity_events est append-only : jamais supprimé. Les matchs d'abord — la clé vers `market_listings` n'a pas de
    // cascade —, ceux que le moteur a créés pour ces contacts compris.
    if (contacts.length) await svc.from('matches').delete().in('contact_id', contacts)
    if (contacts.length) await svc.from('client_searches').delete().in('contact_id', contacts)
    await svc.from('market_listings').delete().like('source_id', `renot-${s.stamp}-%`)
    if (contacts.length) await svc.from('contacts').delete().in('id', contacts)
    await s.cleanup()
  })

  it('R1 — match-contact renote chaque recherche active du contact, avec ses critères du moment ; une ligne par recherche', async () => {
    const c = await mkContact(s.agencyAId, 'R1')
    const autre = { ...CRITERES, budget_max: 1_300_000 }
    const r1 = await mkRecherche(s.agencyAId, c, CRITERES)
    const r2 = await mkRecherche(s.agencyAId, c, autre)
    const r3 = await mkRecherche(s.agencyAId, c, CRITERES)
    const close = await mkRecherche(s.agencyAId, c, CRITERES, false)
    const aGarde = await mkAnnonce('r1-garde', 1_400_000)
    const garde = await mkMatch(s.agencyAId, c, r1, aGarde)
    const hors = await mkMatch(s.agencyAId, c, r1, await mkAnnonce('r1-hors', 1_700_000))
    const aSous = await mkAnnonce('r1-sous', 1_650_000, { type: 'house' })
    const sousLeSeuil = await mkMatch(s.agencyAId, c, r1, aSous)
    const aR2 = await mkAnnonce('r1-r2', 1_250_000)
    const deR2 = await mkMatch(s.agencyAId, c, r2, aR2)
    // r3, rien n'y change : son match porte déjà la note du barème.
    const aStable = await mkAnnonce('r1-stable', 1_500_000)
    const nStable = await noteDe(aStable, CRITERES)
    const stable = await mkMatch(s.agencyAId, c, r3, aStable, { score: nStable.total, reasons: nStable.reasons })
    const propose = await mkMatch(s.agencyAId, c, r1, await mkAnnonce('r1-propose', 1_700_000), {
      status: 'sent', sent_via: 'agent', sent_at: new Date().toISOString(), score: 80, score_version: cfg.version - 1,
    })
    const main = await mkMatch(s.agencyAId, c, r1, await mkAnnonce('r1-main', 1_720_000), {
      score: 70, score_version: null, reasons: { keys: ['budget'] },
    })
    const dansLaClose = await mkMatch(s.agencyAId, c, close, await mkAnnonce('r1-close', 1_400_000), { score_version: cfg.version - 1 })
    // Les critères de r1 changent : le déclencheur relancerait le moteur, que le local ne configure pas.
    const apres = { ...CRITERES, budget_max: 1_450_000 }
    const { error: uErr } = await svc.from('client_searches').update({ criteria: apres }).eq('id', r1)
    if (uErr) throw new Error(`client_searches: ${uErr.message}`)

    const { status, body } = await moteur({ mode: 'match-contact', contact_id: c, agency_id: s.agencyAId })
    expect(status, JSON.stringify(body)).toBe(200)
    // Trois matchs de r1 et celui de r2 : celui de r3 porte déjà sa note, il ne se réécrit pas.
    expect(body).toMatchObject({ reevalues: 4, ecartes: 2, echecs: 0, renotationSautee: false })

    const n = await noteDe(aGarde, apres)
    expect(await lire(garde)).toMatchObject({ status: 'suggested', score: n.total, reasons: n.reasons, score_version: cfg.version })
    // 1'700'000 dépasse 1'450'000 à 15 % près : hors du pré-filtre du moteur, il sort sans note.
    expect(await lire(hors)).toMatchObject({
      status: 'ignored', reaction_motif: 'recherche_ajustee', score: 0, score_version: cfg.version,
    })
    // Dans le pré-filtre (1'650'000 ≤ 1'667'500), mais une maison au prix du haut de la marge : sous le seuil.
    const nSous = await noteDe(aSous, apres)
    expect(nSous.total).toBeLessThan(cfg.threshold)
    expect(await lire(sousLeSeuil)).toMatchObject({
      status: 'ignored', reaction_motif: 'recherche_ajustee', score: nSous.total, score_version: cfg.version,
    })
    const n2 = await noteDe(aR2, autre)
    expect(await lire(deR2)).toMatchObject({ status: 'suggested', score: n2.total, reasons: n2.reasons, score_version: cfg.version })
    expect(await lire(stable)).toMatchObject({ status: 'suggested', score: nStable.total, score_version: cfg.version })
    expect(await lire(propose)).toMatchObject({ status: 'sent', score: 80, score_version: cfg.version - 1 })
    expect(await lire(main)).toMatchObject({ status: 'suggested', score: 70, score_version: null })
    expect(await lire(dansLaClose)).toMatchObject({ status: 'suggested', score: NOTE_PLANTEE, score_version: cfg.version - 1 })

    const lignes = await journal(c)
    expect(lignes).toHaveLength(2)
    expect(lignes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actor_kind: 'system', category: 'contact',
        metadata: expect.objectContaining({
          client_search_id: r1, mode: 'match-contact', reevalues: 3, ecartes: 2,
          match_ids_ecartes: expect.arrayContaining([hors, sousLeSeuil]), score_version: cfg.version,
        }),
      }),
      expect.objectContaining({ metadata: expect.objectContaining({ client_search_id: r2, reevalues: 1, ecartes: 0 }) }),
    ]))
    // r3 a été renotée, mais rien n'y a changé : ni note réécrite, ni ligne.
    expect(lignes.map((l) => l.metadata.client_search_id)).not.toContain(r3)
  }, 60_000)

  it('R2 — scan-all renote ce qu’une version antérieure a noté, sans version compris ; rien d’autre', async () => {
    const c = await mkContact(s.agencyAId, 'R2')
    const r = await mkRecherche(s.agencyAId, c, CRITERES)
    const aAncienne = await mkAnnonce('r2-ancienne', 1_500_000)
    const ancienne = await mkMatch(s.agencyAId, c, r, aAncienne, { score_version: cfg.version - 1 })
    const aSans = await mkAnnonce('r2-sans', 1_450_000)
    // Sans version, mais les axes du moteur dans ses raisons (en booléens, comme les décrit docs/schema.md) : c'est
    // le moteur d'avant les versions qui l'a noté.
    const sansVersion = await mkMatch(s.agencyAId, c, r, aSans, {
      score_version: null, reasons: { budget: true, zone: true, rooms: true, surface: false, features: [] },
    })
    const courante = await mkMatch(s.agencyAId, c, r, await mkAnnonce('r2-courante', 1_500_000))
    const main = await mkMatch(s.agencyAId, c, r, await mkAnnonce('r2-main', 1_550_000), {
      score: 70, score_version: null, reasons: { keys: ['zone'] },
    })
    const cClose = await mkContact(s.agencyAId, 'R2-close')
    const close = await mkRecherche(s.agencyAId, cClose, CRITERES, false)
    const dansLaClose = await mkMatch(s.agencyAId, cClose, close, await mkAnnonce('r2-close', 1_500_000), { score_version: cfg.version - 1 })
    // Une version antérieure qui avait déjà la note du barème : tamponnée, rien à journaliser.
    const cStable = await mkContact(s.agencyAId, 'R2-stable')
    const rStable = await mkRecherche(s.agencyAId, cStable, CRITERES)
    const aStable = await mkAnnonce('r2-stable', 1_500_000)
    const nStable = await noteDe(aStable, CRITERES)
    const stable = await mkMatch(s.agencyAId, cStable, rStable, aStable, {
      score: nStable.total, reasons: nStable.reasons, score_version: cfg.version - 1,
    })

    const { status, body } = await moteur({ mode: 'scan-all', agency_id: s.agencyAId })
    expect(status, JSON.stringify(body)).toBe(200)
    // R1 a laissé ses matchs à la version courante : seuls ceux-ci restaient à rattraper dans l'agence.
    expect(body).toMatchObject({ reevalues: 3, ecartes: 0, echecs: 0, renotationSautee: false })

    const nA = await noteDe(aAncienne, CRITERES)
    expect(await lire(ancienne)).toMatchObject({ status: 'suggested', score: nA.total, reasons: nA.reasons, score_version: cfg.version })
    const nS = await noteDe(aSans, CRITERES)
    expect(await lire(sansVersion)).toMatchObject({ status: 'suggested', score: nS.total, reasons: nS.reasons, score_version: cfg.version })
    expect(await lire(courante)).toMatchObject({ status: 'suggested', score: NOTE_PLANTEE, score_version: cfg.version })
    expect(await lire(main)).toMatchObject({ status: 'suggested', score: 70, score_version: null })
    expect(await lire(dansLaClose)).toMatchObject({ status: 'suggested', score: NOTE_PLANTEE, score_version: cfg.version - 1 })
    expect(await lire(stable)).toMatchObject({ status: 'suggested', score: nStable.total, score_version: cfg.version })

    expect(await journal(c)).toEqual([expect.objectContaining({
      actor_kind: 'system', category: 'contact',
      metadata: expect.objectContaining({ client_search_id: r, mode: 'scan-all', reevalues: 2, ecartes: 0, score_version: cfg.version }),
    })])
    expect(await journal(cClose)).toEqual([])
    expect(await journal(cStable)).toEqual([])
  }, 60_000)

  it('R3 — scan-all en renote au plus 2 000 par agence ; le 2 001ᵉ attend la nuit d’après', async () => {
    const c = await mkContact(s.agencyBId, 'R3')
    const r = await mkRecherche(s.agencyBId, c, CRITERES)
    // 2 001 annonces et leurs matchs à proposer, notés par une version antérieure. Les ids naissent ici : un envoi
    // groupé n'a pas à relire ce qu'il a écrit (`max_rows`).
    const ids = Array.from({ length: 2001 }, () => crypto.randomUUID())
    for (const lot of tranches(ids, 500)) {
      const { error } = await svc.from('market_listings').insert(lot.map((id) => ({ id, ...annonce(`r3-${id}`, 1_400_000) })))
      if (error) throw new Error(`market_listings: ${error.message}`)
    }
    for (const lot of tranches(ids, 500)) {
      const { error } = await svc.from('matches').insert(lot.map((id) => ({
        agency_id: s.agencyBId, contact_id: c, client_search_id: r, market_listing_id: id, source: 'market',
        status: 'suggested', score: NOTE_PLANTEE, reasons: RAISONS_MOTEUR, score_version: cfg.version - 1,
      })))
      if (error) throw new Error(`matches: ${error.message}`)
    }
    const restants = async () => (await svc.from('matches').select('id', { count: 'exact', head: true })
      .eq('contact_id', c).eq('score_version', cfg.version - 1)).count

    const nuit = await moteur({ mode: 'scan-all', agency_id: s.agencyBId })
    expect(nuit.status, JSON.stringify(nuit.body)).toBe(200)
    expect(nuit.body).toMatchObject({ reevalues: 2000, echecs: 0 })
    expect(await restants()).toBe(1)
    expect(await journal(c)).toEqual([expect.objectContaining({
      metadata: expect.objectContaining({ client_search_id: r, mode: 'scan-all', reevalues: 2000 }),
    })])

    const suivante = await moteur({ mode: 'scan-all', agency_id: s.agencyBId })
    expect(suivante.status, JSON.stringify(suivante.body)).toBe(200)
    expect(suivante.body).toMatchObject({ reevalues: 1, echecs: 0 })
    expect(await restants()).toBe(0)
  }, 180_000)

  it('R4 — un second match-contact sur les mêmes critères n’écrit rien : ni note, ni ligne au journal', async () => {
    const c = await mkContact(s.agencyAId, 'R4')
    const r = await mkRecherche(s.agencyAId, c, CRITERES)
    // Le premier passage a de quoi écrire : une note plantée, qu'il remplace et journalise ; une version antérieure
    // qui porte déjà la note du barème, qu'il tamponne sans ligne.
    const plantee = await mkMatch(s.agencyAId, c, r, await mkAnnonce('r4-plantee', 1_400_000))
    const aAncienne = await mkAnnonce('r4-ancienne', 1_500_000)
    const nAncienne = await noteDe(aAncienne, CRITERES)
    const ancienne = await mkMatch(s.agencyAId, c, r, aAncienne, {
      score: nAncienne.total, reasons: nAncienne.reasons, score_version: cfg.version - 1,
    })

    const premier = await moteur({ mode: 'match-contact', contact_id: c, agency_id: s.agencyAId })
    expect(premier.status, JSON.stringify(premier.body)).toBe(200)
    expect(premier.body).toMatchObject({ reevalues: 2, ecartes: 0, echecs: 0 })
    expect(await journal(c)).toHaveLength(1)
    const notes = [await lire(plantee), await lire(ancienne)]
    expect(notes.map((m) => m.score_version)).toEqual([cfg.version, cfg.version])

    // Rien n'a bougé : ses deux matchs, et ceux que le premier passage a fait naître, portent déjà leur note.
    // `reevalues` compte ce que l'écrivain a réellement réécrit (`matching_appliquer_notes` … `returning`).
    const second = await moteur({ mode: 'match-contact', contact_id: c, agency_id: s.agencyAId })
    expect(second.status, JSON.stringify(second.body)).toBe(200)
    expect(second.body).toMatchObject({ reevalues: 0, ecartes: 0, echecs: 0, renotationSautee: false })
    expect(await journal(c)).toHaveLength(1)
    expect([await lire(plantee), await lire(ancienne)]).toEqual(notes)
  }, 60_000)
})
