/**
 * UNE annonce de marché, lue par sa clé primaire — pour la fiche autonome
 * `/dashboard/market/:id`.
 *
 * ⛔ POURQUOI CE HOOK EXISTE À CÔTÉ DE `useMarketListingDetail`. Ce dernier ne lit
 * que les colonnes SUPPLÉMENTAIRES (`DETAIL_COLS`) : il enrichit une annonce que la
 * grille de recherche a déjà en main. La fiche autonome, elle, n'a rien — on y
 * arrive par une URL, sans grille derrière. Il lui faut donc les DEUX jeux de
 * colonnes en une lecture.
 *
 * ⚠ ET IL RÉUTILISE LES DEUX MAPPERS PLUTÔT QUE D'EN ÉCRIRE UN TROISIÈME.
 * `mapListingRow` encode quatre décisions mesurées qu'un mapper neuf reperdrait
 * silencieusement : les photos R2 (`photos_cf`) prioritaires sur `photos`, le prix
 * effectif `current_price ?? price`, le filtre de plausibilité sur les champs des
 * portails (années à trois chiffres, étages à 99), et le logo d'agence pris sur la
 * fiche `agency_profiles` à défaut de la colonne. Les recopier serait les périmer.
 *
 * ⚠ Lecture par PK : le coût est constant et sans rapport avec les 257 943 lignes
 * de `market_listings` (mesuré en production le 05.09.2026 ; ce commentaire annonçait
 * ~208 000, chiffre déjà dépassé le jour où il a été écrit). C'est ce qui autorise `description` ici alors que la grille
 * se l'interdit (CLAUDE.md §7).
 */

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import {
  mapListingDetailRow, mapListingRow,
  type MrhBien, type MrhBienDetail,
} from '@/components/matching-recherche/types'
import type { ExternalListing } from '@/hooks/useExternalMatching'

/**
 * Une annonce de marché complète : ce que porte la carte, plus ce que porte la fiche,
 * plus la RUE seule.
 *
 * ⚠ `rue` n'est pas une redondance de `addr`. `mapListingRow` compose déjà
 * `addr = "rue, NPA ville"` (types.ts:209-211) — c'est ce qu'il faut pour une carte de
 * grille, mais la fiche affiche l'adresse en trois morceaux et rajoutait NPA et ville
 * par-dessus : « Chemin du Lac 4, 1180 Rolle, 1180, Rolle ». Vu à l'écran le 05.09.2026.
 */
export type MarketListing = MrhBien & MrhBienDetail & { rue: string }

/**
 * Les deux jeux de colonnes en une seule lecture.
 *
 * ⚠ Recopiés de `useMatchingRecherche` plutôt qu'importés : les deux constantes y
 * sont privées, et les exporter ferait croire qu'elles sont un contrat partagé
 * alors qu'elles décrivent le besoin de DEUX écrans distincts. Si l'une bouge,
 * c'est ici qu'il faut regarder — d'où ce commentaire.
 */
const COLS =
  'id,title,address,city,postal_code,canton,type,transaction_type,price,current_price,' +
  'price_at_first_seen,price_per_m2,rooms,bedrooms,bathrooms,surface_m2,features,photos,photos_cf,' +
  'status,source_portal,source_url,source_id,agency_name,agency_phone,agency_logo_url,lat,lng,' +
  'year_built,days_on_market,land_surface,' +
  'agency_profile:agency_profiles(logo_url),' +
  'description,floor,parking_count,year_renovated,usable_surface,charges_monthly,' +
  'is_furnished,availability_date,visit_contact_name,agency_reference'

/**
 * Forme d'un uuid — la clé de `market_listings` en est un.
 *
 * ⚠ Le contrôle n'est pas du zèle : un `.eq('id', '0')` sur une colonne `uuid` part
 * en **400 PostgREST**, pas en « zéro ligne ». Sans cette garde, une URL fantaisiste
 * produit une ERREUR là où « introuvable » est la bonne réponse — et le test e2e
 * paramétrique vise justement cette route avec `'0'`.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** `true` si le segment d'URL peut être une clé d'annonce. */
export function estIdAnnonce(id: string | undefined): boolean {
  return !!id && UUID_RE.test(id)
}

/**
 * L'annonce, ou `null` si elle n'existe plus (retirée du portail entre deux visites).
 *
 * ⚠ `null` et « en cours de chargement » sont DEUX états, et l'appelant doit les
 * distinguer : brancher l'attente sur `!data` ferait afficher « introuvable » à
 * chaque ouverture, le temps de l'aller-retour.
 */
export function useMarketListing(id: string | undefined) {
  const { user } = useAuth()
  const valide = estIdAnnonce(id)
  return useQuery<MarketListing | null>({
    queryKey: ['market-listing', id],
    // ⚠ Gaté sur la session ET sur la forme : `market_listings` est lisible par
    // tout utilisateur authentifié, mais `anon` n'a pas SELECT — une requête sans
    // session rendrait zéro ligne, donc « introuvable », sans dire pourquoi.
    enabled: !!user && valide,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('market_listings')
        .select(COLS)
        .eq('id', id as string)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      const row = data as unknown as Record<string, unknown>
      return {
        ...mapListingRow(row),
        ...mapListingDetailRow(row),
        rue: typeof row.address === 'string' ? row.address : '',
      }
    },
  })
}


/**
 * Projection `market_listings` → le modèle de vue de la fiche.
 *
 * Sept renommages, et deux décisions qui ne sont pas des renommages :
 *
 * ⚠ **LE PRIX DÉPEND DE LA TRANSACTION**, et il faut lire le bien MAPPÉ, pas la ligne.
 * `ExternalListing.price` est un nombre unique, hérité d'un type qui ne connaissait
 * que la vente. Ici on lit `MrhBien`, où `mapListingRow` (types.ts:220-221) a DÉJÀ
 * réparti `current_price ?? price` entre `price` (vente) et `rent` (location).
 *
 * ⛔ NE PAS « CORRIGER » EN LISANT LA COLONNE `rent` DE LA TABLE : elle est vide.
 * Mesuré le 05.09.2026 sur les 36 770 locations actives — `rent` renseigné : **0**,
 * montant présent dans `price`/`current_price` : 34 493. La colonne existe et ne sert
 * pas ; c'est le mapper qui porte la règle, et c'est une raison de plus de le
 * réutiliser plutôt que d'écrire une troisième lecture.
 *
 * ⚠ **`photo_url` EST LA PREMIÈRE PHOTO**, pas une colonne. La fiche l'utilise pour
 * son ouverture ; `photos` est déjà trié par `mapListingRow`, qui met les URLs R2
 * (`photos_cf`) devant.
 *
 * ⛔ Et `visit_contact` reçoit le NOM du contact de visite, pas son téléphone :
 * `agency_phone` porte déjà le numéro, et la fiche affiche les deux séparément.
 */
export function projeterAnnonce(a: MarketListing): ExternalListing {
  const enLocation = a.transaction === 'location'
  return {
    id: a.id,
    title: a.title,
    price: (enLocation ? a.rent : a.price) ?? 0,
    address: a.rue,
    city: a.city ?? '',
    canton: a.canton ?? '',
    rooms: a.rooms,
    surface_m2: a.area,
    type: a.type,
    photo_url: a.photos[0] ?? null,
    photos: a.photos,
    source_url: a.source_url ?? '',
    source_portal: a.source_portal ?? '',
    source_agency: a.agency,
    source_logo_url: a.agency_logo_url,
    description: a.description,
    property_type_detail: null,
    construction_year: a.year,
    renovation_year: a.year_renovated,
    bathrooms: a.baths,
    land_surface: a.land_surface,
    parking: a.parking_count,
    price_per_m2: a.price_per_m2,
    lat: a.lat,
    lng: a.lng,
    postcode: a.postal_code,
    agency_phone: a.agency_phone,
    visit_contact: a.visit_contact_name,
  }
}
