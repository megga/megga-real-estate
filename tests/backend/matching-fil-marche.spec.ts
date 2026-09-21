// Le fil de matchs, lot 2 : la RPC `matching_fil_marche()` (migration 20260921120000), une ligne
// « Marché » par acheteur. Cloisonnement par agence, ce qu'une ligne compte (report futur exclu, échu
// inclus, annonce `removed` exclue), les trois vignettes et leur ordre, le refus d'`anon`.
// Tourne contre `supabase start` (SUPABASE_TEST_*), jamais la prod. skipIf sans clés.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { anonClient, serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

interface LigneMarche { contact_id: string; nombre: number; meilleur_score: number; vignettes: string[] }

const IMG = 'https://example.test/fil'
const JOUR = 86_400_000

describe.skipIf(!HAS_KEYS)('matching_fil_marche — une ligne « Marché » par acheteur', () => {
  let s: TwoAgenciesSetup
  let svc: SupabaseClient
  /** Contacts et annonces semés : à supprimer AVANT les agences (FK NO ACTION). */
  const contacts: string[] = []
  const annonces: string[] = []
  let julie = ''
  let theo = ''
  let chezB = ''

  const mkAnnonce = async (tag: string, champs: { photos?: string[] | null; photos_cf?: unknown; status?: string } = {}) => {
    const { data, error } = await svc.from('market_listings').insert({
      source_id: `fil-marche-${tag}-${s.stamp}`, source_portal: 'flatfox', title: `Fil marché ${tag} ${s.stamp}`,
      city: 'Genève', canton: 'GE', type: 'apartment', transaction_type: 'buy',
      price: 1_200_000, current_price: 1_200_000, quality_score: 70,
      status: champs.status ?? 'active', photos: champs.photos ?? null, photos_cf: champs.photos_cf ?? null,
    }).select('id').single()
    if (error) throw new Error(`market_listings ${tag}: ${error.message}`)
    annonces.push(data.id as string)
    return data.id as string
  }

  const mkContact = async (agencyId: string, nom: string) => {
    const { data, error } = await svc.from('contacts').insert({
      agency_id: agencyId, first_name: 'Fil', last_name: `${nom} ${s.stamp}`,
      email: `fil-marche-${nom}-${s.stamp}@megga-test.local`, type: 'buyer',
    }).select('id').single()
    if (error) throw new Error(`contacts ${nom}: ${error.message}`)
    contacts.push(data.id as string)
    return data.id as string
  }

  const mkMatch = async (agencyId: string, contactId: string, annonceId: string, score: number,
    champs: { snoozed_until?: string; created_at?: string | null } = {}) => {
    const { error } = await svc.from('matches').insert({
      agency_id: agencyId, contact_id: contactId, market_listing_id: annonceId, source: 'market',
      status: 'suggested', score, ...champs,
    })
    if (error) throw new Error(`matches ${score}: ${error.message}`)
  }

  beforeAll(async () => {
    s = await setupTwoAgencies()
    svc = serviceRoleClient()
    julie = await mkContact(s.agencyAId, 'Julie')
    theo = await mkContact(s.agencyAId, 'Theo')
    chezB = await mkContact(s.agencyBId, 'ChezB')

    const futur = new Date(Date.now() + 7 * JOUR).toISOString()
    const echu = new Date(Date.now() - JOUR).toISOString()
    const A = s.agencyAId

    // Julie. Les deux meilleurs scores sont HORS de la ligne : reporté dans le futur (99) et annonce
    // retirée (98). Le report échu (96) y entre, sans photo : il ne prend pas de vignette.
    await mkMatch(A, julie, await mkAnnonce('reporte', { photos: [`${IMG}/reporte.jpg`] }), 99, { snoozed_until: futur })
    await mkMatch(A, julie, await mkAnnonce('retire', { photos: [`${IMG}/retire.jpg`], status: 'removed' }), 98)
    await mkMatch(A, julie, await mkAnnonce('echu'), 96, { snoozed_until: echu })
    await mkMatch(A, julie, await mkAnnonce('thumb', { photos_cf: [{ thumb: `${IMG}/thumb.jpg`, detail: `${IMG}/detail.jpg` }] }), 95)
    await mkMatch(A, julie, await mkAnnonce('vide', { photos: [''] }), 90)
    await mkMatch(A, julie, await mkAnnonce('chaine', { photos_cf: [`${IMG}/chaine.jpg`] }), 88)
    await mkMatch(A, julie, await mkAnnonce('photos', { photos: [`${IMG}/photos.jpg`] }), 85)
    await mkMatch(A, julie, await mkAnnonce('quatrieme', { photos: [`${IMG}/quatrieme.jpg`] }), 80)

    // Théo : même score, une date absente — elle passe APRÈS la date connue (`nulls last`).
    await mkMatch(A, theo, await mkAnnonce('sans-date', { photos: [`${IMG}/sans-date.jpg`] }), 90, { created_at: null })
    await mkMatch(A, theo, await mkAnnonce('avec-date', { photos: [`${IMG}/avec-date.jpg`] }), 90, { created_at: '2026-09-01T10:00:00Z' })

    await mkMatch(s.agencyBId, chezB, await mkAnnonce('chez-b', { photos: [`${IMG}/chez-b.jpg`] }), 100)
  }, 90_000)

  afterAll(async () => {
    if (!s) return
    if (contacts.length) await svc.from('matches').delete().in('contact_id', contacts)
    if (annonces.length) await svc.from('market_listings').delete().in('id', annonces)
    // ⚠ Sans ça, `cleanup()` échoue EN SILENCE sur la suppression des agences
    // (contacts_agency_id_fkey NO ACTION) et chaque passage laisse deux agences.
    if (contacts.length) await svc.from('contacts').delete().in('id', contacts)
    await s.cleanup()
  })

  const lignes = async (client: SupabaseClient): Promise<LigneMarche[]> => {
    const { data, error } = await client.rpc('matching_fil_marche')
    expect(error).toBeNull()
    return (data ?? []) as LigneMarche[]
  }

  it('chaque agence ne lit que ses acheteurs', async () => {
    const chezA = await lignes(s.clientA)
    expect(chezA.map((l) => l.contact_id).sort()).toEqual([julie, theo].sort())
    const deB = await lignes(s.clientB)
    expect(deB).toEqual([{ contact_id: chezB, nombre: 1, meilleur_score: 100, vignettes: [`${IMG}/chez-b.jpg`] }])
  })

  it('un report dans le futur et une annonce retirée sont hors de la ligne ; un report échu y entre', async () => {
    const l = (await lignes(s.clientA)).find((x) => x.contact_id === julie)
    // échu, thumb, vide, chaîne, photos, quatrième : six. Ni le 99 reporté, ni le 98 retiré.
    expect(l).toMatchObject({ nombre: 6, meilleur_score: 96 })
  })

  it('trois vignettes au plus, les premières NON vides dans l’ordre du score', async () => {
    const l = (await lignes(s.clientA)).find((x) => x.contact_id === julie)
    // Le 96 (sans photo) et le 90 (chaîne vide) ne prennent pas de place ; le 80 est le quatrième.
    expect(l?.vignettes).toEqual([`${IMG}/thumb.jpg`, `${IMG}/chaine.jpg`, `${IMG}/photos.jpg`])
  })

  it('à score égal, le plus récent d’abord, et une date absente en dernier', async () => {
    const l = (await lignes(s.clientA)).find((x) => x.contact_id === theo)
    expect(l?.vignettes).toEqual([`${IMG}/avec-date.jpg`, `${IMG}/sans-date.jpg`])
  })

  it('un anonyme ne l’appelle pas — c’est le REVOKE qui le dit', async () => {
    // ⚠ Le message, pas l'absence de lignes : sans le REVOKE, l'appel rendrait [] (aucune agence).
    const { error } = await anonClient().rpc('matching_fil_marche')
    expect(error?.message).toMatch(/permission denied/)
  })
})
