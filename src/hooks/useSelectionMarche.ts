/**
 * Les biens du MARCHÉ d'un acheteur, pour la sélection du fil de matchs (lot 2, conception §5 et §8).
 *
 * ⛔ CHARGÉS À L'OUVERTURE DE SA LIGNE, VINGT À LA FOIS — jamais les 1 612 matchs du marché au
 * navigateur (17.09.2026). Servis par `idx_matches_agency_focus (agency_id, contact_id, score desc)
 * where status = 'suggested'`. On lit `limite + 1` lignes : la dernière ne sert qu'à dire s'il en reste.
 *
 * ⚠ Mêmes règles que le résumé serveur (`matching_fil_marche`) : non reporté, annonce non `removed`.
 * Appliquées ici côté client aussi — le banc ne connaît ni `not`, ni `or`.
 *
 * ⚠ La vignette : `photos_cf` porte des URL en chaîne OU des objets `{thumb, …}`, sinon `photos`.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { refAnnonceMarche } from '@/hooks/useAtelierMatching'
import { CLE_FIL, lire, listeEquipements, nombreOuNull, versAcheteur, type LigneContact } from '@/hooks/useMatchingFil'
import type { SearchCriteria } from '@/types/contact'
import type { KycDossierStatus } from '@/types/kyc'
import type { FilBien, FilMatch, RaisonsMoteur } from '@/components/matching-fil/filModele'

/** Le pas de chargement d'une sélection (§5). */
export const PAS_SELECTION = 20

interface LigneMatchMarche {
  id: string; market_listing_id: string | null; client_search_id: string | null; score: number
  reasons: RaisonsMoteur | null; snoozed_until: string | null; created_at: string | null
}
interface LigneAnnonce {
  id: string; title: string | null; type: string | null; transaction_type: string | null
  price: number | string | null; current_price: number | string | null; rooms: number | string | null
  surface_m2: number | string | null; address: string | null; city: string | null; canton: string | null
  features: unknown; photos: string[] | null; photos_cf: unknown; status: string | null
  source_portal: string | null; source_id: string | null; source_url: string | null
}
interface DonneesSelection { matchs: FilMatch[]; aPlus: boolean; chargeLe: number }

const AUCUNE: DonneesSelection = { matchs: [], aPlus: false, chargeLe: 0 }

function photoAnnonce(cf: unknown, photos: string[] | null): string | null {
  const premier: unknown = Array.isArray(cf) ? cf[0] : undefined
  if (typeof premier === 'string' && premier) return premier
  if (premier && typeof premier === 'object') {
    const thumb = (premier as Record<string, unknown>).thumb
    if (typeof thumb === 'string' && thumb) return thumb
  }
  return photos?.find((p) => typeof p === 'string' && p !== '') ?? null
}

function versBienMarche(a: LigneAnnonce): FilBien {
  const ref = refAnnonceMarche(a.source_portal, a.source_id, a.id)
  return {
    // Une annonce sans titre (le portail n'en donne pas toujours) : une ligne sans nom ne se coche pas
    // en connaissance de cause, et la case comme « Écarter » se nomment d'après lui.
    id: a.id, titre: a.title?.trim() || a.address?.trim() || a.city?.trim() || ref,
    prix: nombreOuNull(a.current_price) ?? nombreOuNull(a.price),
    location: a.transaction_type === 'rent', type: a.type, pieces: nombreOuNull(a.rooms), surface: nombreOuNull(a.surface_m2),
    ville: a.city, canton: a.canton, adresse: a.address, equipements: listeEquipements(a.features),
    photo: photoAnnonce(a.photos_cf, a.photos),
    marche: { ref, sourceUrl: a.source_url },
  }
}

async function chargerSelection(agencyId: string, contactId: string, limite: number): Promise<DonneesSelection> {
  const debut = Date.now()
  const bruts = await lire<LigneMatchMarche>(
    supabase.from('matches')
      .select('id, market_listing_id, client_search_id, score, reasons, snoozed_until, created_at')
      .eq('agency_id', agencyId)
      .eq('contact_id', contactId)
      .eq('status', 'suggested')
      .not('market_listing_id', 'is', null)
      // Le départage de `matching_fil_marche` : les vignettes de la ligne sont les premiers biens ouverts.
      .order('score', { ascending: false })
      .order('created_at', { ascending: false, nullsFirst: false })
      .order('id')
      .range(0, limite),
  )
  const aPlus = bruts.length > limite
  const lignes = bruts.slice(0, limite).filter((m) =>
    m.market_listing_id != null && !(m.snoozed_until != null && Date.parse(m.snoozed_until) > debut))
  if (lignes.length === 0) return { matchs: [], aPlus, chargeLe: debut }
  const annonceIds = [...new Set(lignes.map((m) => m.market_listing_id as string))]
  const rechercheIds = [...new Set(lignes.map((m) => m.client_search_id).filter((id): id is string => id != null))]

  const [contacts, recherches, annonces, kyc] = await Promise.all([
    lire<LigneContact>(supabase.from('contacts').select('id, first_name, last_name, email, phone, search_criteria').in('id', [contactId])),
    rechercheIds.length > 0
      ? lire<{ id: string; criteria: SearchCriteria | null }>(supabase.from('client_searches').select('id, criteria').in('id', rechercheIds))
      : Promise.resolve([]),
    lire<LigneAnnonce>(
      supabase.from('market_listings')
        .select('id, title, type, transaction_type, price, current_price, rooms, surface_m2, address, city, canton, features, photos, photos_cf, status, source_portal, source_id, source_url')
        .in('id', annonceIds),
    ),
    lire<{ contact_id: string; dossier_status: KycDossierStatus | null }>(
      supabase.from('kyc_cases').select('contact_id, dossier_status')
        .in('contact_id', [contactId]).in('type', ['buyer_pp', 'buyer_pm']).order('created_at', { ascending: false }),
    ),
  ])

  const c = contacts.find((x) => x.id === contactId)
  if (!c) return { matchs: [], aPlus: false, chargeLe: debut }
  const acheteur = versAcheteur(c, kyc.find((k) => k.contact_id === contactId)?.dossier_status)
  const criteresParRecherche = new Map(recherches.map((r) => [r.id, r.criteria]))
  const annonceParId = new Map(annonces.map((a) => [a.id, a]))

  const matchs: FilMatch[] = []
  for (const m of lignes) {
    const a = annonceParId.get(m.market_listing_id as string)
    if (!a || a.status === 'removed') continue
    matchs.push({
      id: m.id, score: m.score, raisons: m.reasons, creeLe: m.created_at, reporteJusquau: m.snoozed_until,
      bien: versBienMarche(a),
      criteres: (m.client_search_id ? criteresParRecherche.get(m.client_search_id) : null) ?? c.search_criteria,
      acheteur,
    })
  }
  return { matchs, aPlus, chargeLe: debut }
}

const cleRequete = (agencyId: string | null, contactId: string | null, limite: number) =>
  [CLE_FIL, 'selection', agencyId, contactId, limite] as const

/** Les biens du marché d'un acheteur, `limite` à la fois ; `null` : aucune sélection ouverte. */
export function useSelectionMarche(contactId: string | null, limite: number) {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id ?? null
  const client = useQueryClient()
  const requete = useQuery({
    queryKey: cleRequete(agencyId, contactId, limite),
    queryFn: () => chargerSelection(agencyId as string, contactId as string, limite),
    enabled: agencyId != null && contactId != null,
    // « Voir 20 de plus » garde les vingt premiers à l'écran pendant que les suivants arrivent.
    // ⛔ MAIS SEULEMENT POUR LE MÊME ACHETEUR : `keepPreviousData` rendait la sélection de l'acheteur
    // QUITTÉ sous le nom du suivant, le temps de sa lecture — cochables et envoyables à la mauvaise
    // personne. Un autre acheteur n'a pas de données provisoires : il montre le squelette.
    placeholderData: (prec, requetePrec) => (requetePrec?.queryKey[3] === contactId ? prec : undefined),
  })
  // ⚠ Un « Voir 20 de plus » en échec : TanStack ne rend les données provisoires que TANT QUE la lecture
  // attend — l'échec les retire, et la liste disparaissait sous l'erreur. La page d'avant, de CE même
  // acheteur, est encore au cache (30 min) : elle reste à l'écran, l'erreur s'affiche dessous.
  const pagePrecedente = requete.isError && requete.data === undefined && contactId != null && limite > PAS_SELECTION
    ? client.getQueryData<DonneesSelection>(cleRequete(agencyId, contactId, limite - PAS_SELECTION))
    : undefined
  const donnees = requete.data ?? pagePrecedente ?? AUCUNE
  return {
    ...donnees,
    isLoading: contactId != null && (profile == null || requete.isLoading),
    /** La dernière lecture a échoué — avec ou sans liste encore à l'écran (`aDesDonnees`). */
    isError: requete.isError,
    /** Des biens de CET acheteur sont lisibles : lus, provisoires (« Voir plus » en route) ou la page d'avant un échec. */
    aDesDonnees: donnees !== AUCUNE,
    /** Données de la page précédente, affichées pendant que la suivante arrive : jamais une base de pré-cochage. */
    isPlaceholderData: requete.isPlaceholderData,
    isFetching: requete.isFetching,
    refetch: requete.refetch,
  }
}
