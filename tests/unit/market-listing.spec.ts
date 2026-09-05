/**
 * La fiche d'annonce marché autonome — la logique PURE de sa réparation.
 *
 * ⚠ Ne teste que `estIdAnnonce` et `projeterAnnonce` : le hook lui-même part sur le
 * réseau et se prouve à l'écran, pas ici. Prétendre le couvrir ferait une suite verte
 * qui ne mesure pas ce qu'elle annonce.
 */

import { describe, it, expect } from 'vitest'
import { estIdAnnonce, projeterAnnonce, type MarketListing } from '@/hooks/useMarketListing'

/** Une annonce mappée, dans la forme que `mapListingRow` produit réellement. */
function annonce(extra: Partial<MarketListing> = {}): MarketListing {
  return {
    id: '00432e97-f3d2-4d11-9c1f-dd882343ee8e',
    title: 'Appartement traversant de 3.5 pièces',
    addr: 'Chemin du Lac 4, 1180 Rolle', rue: 'Chemin du Lac 4',
    type: 'apartment', typeLabel: 'Appartement',
    transaction: 'vente',
    price: 1_600_000, rent: null, price_original: null, price_per_m2: 12_800,
    rooms: 3.5, beds: 2, baths: 1, area: 125, year: 2025, land_surface: null,
    canton: 'VD', city: 'Rolle', postal_code: '1180', lat: 46.45, lng: 6.33,
    features: [], status: 'active', source: 'market',
    source_portal: 'realadvisor', source_url: 'https://exemple.ch/a', ref: '187502',
    agency: 'Bernard Nicod', agency_phone: '021 000 00 00',
    agency_logo_url: 'https://exemple.ch/logo.png',
    days_on_market: 12, postedAt: 'il y a 12 j', postedRank: 12,
    photos: ['https://cdn/1.jpg', 'https://cdn/2.jpg'],
    description: 'Belle vue', floor: 3, parking_count: 1, year_renovated: 2020,
    usable_surface: 118, charges_monthly: 250, is_furnished: false,
    availability_date: '2026-10-01', visit_contact_name: 'Mme Dupont',
    agency_reference: 'BN-42',
    ...extra,
  }
}

describe('estIdAnnonce — la garde de forme', () => {
  it('accepte un uuid', () => {
    expect(estIdAnnonce('00432e97-f3d2-4d11-9c1f-dd882343ee8e')).toBe(true)
  })

  it('⛔ refuse ce qui n’est pas un uuid — sinon PostgREST rend 400, pas « introuvable »', () => {
    // Le test e2e paramétrique vise justement cette route avec `'0'`. Un
    // `.eq('id', '0')` sur une colonne `uuid` part en 400 : la garde transforme une
    // ERREUR en la bonne réponse, « annonce introuvable ».
    expect(estIdAnnonce('0')).toBe(false)
    expect(estIdAnnonce('187502')).toBe(false)
    expect(estIdAnnonce(undefined)).toBe(false)
    expect(estIdAnnonce('')).toBe(false)
  })
})

describe('projeterAnnonce — market_listings vers le modèle de vue', () => {
  it('porte l’uuid en identité, jamais la référence de portail', () => {
    // `source_id` (ici `ref`) n'est unique que PAR PORTAIL : la contrainte de la table
    // est composite, et les plages numériques de Flatfox et RealAdvisor se recouvrent.
    const p = projeterAnnonce(annonce())
    expect(p.id).toBe('00432e97-f3d2-4d11-9c1f-dd882343ee8e')
  })

  it('en VENTE, le montant vient de `price`', () => {
    expect(projeterAnnonce(annonce()).price).toBe(1_600_000)
  })

  it('⛔ en LOCATION, le montant vient de `rent` — que le MAPPER a rempli', () => {
    // Mesuré le 05.09.2026 : la COLONNE `rent` est vide sur les 36 770 locations
    // actives ; c'est `mapListingRow` qui y range `current_price ?? price`. Lire la
    // colonne brute afficherait « CHF 0 » sur toutes les locations.
    const p = projeterAnnonce(annonce({ transaction: 'location', price: null, rent: 2_450 }))
    expect(p.price).toBe(2_450)
  })

  it('⚠ retombe sur 0 quand les deux sont vides — 2 277 annonces sont dans ce cas', () => {
    const p = projeterAnnonce(annonce({ transaction: 'location', price: null, rent: null }))
    expect(p.price).toBe(0)
  })

  it('`photo_url` est la PREMIÈRE photo, pas une colonne', () => {
    expect(projeterAnnonce(annonce()).photo_url).toBe('https://cdn/1.jpg')
    expect(projeterAnnonce(annonce({ photos: [] })).photo_url).toBeNull()
  })

  it("⛔ l'adresse est la RUE SEULE — la fiche recompose NPA et ville elle-même", () => {
    // `mapListingRow` compose `addr = \"rue, NPA ville\"` pour les cartes de grille.
    // Projeter `addr` dans `address` donnait « Chemin du Lac 4, 1180 Rolle, 1180, Rolle ».
    const p = projeterAnnonce(annonce())
    expect(p.address).toBe('Chemin du Lac 4')
    expect(p.postcode).toBe('1180')
    expect(p.city).toBe('Rolle')
  })

  it('applique les sept renommages de colonnes', () => {
    const p = projeterAnnonce(annonce())
    expect(p.postcode).toBe('1180')            // ← postal_code
    expect(p.source_agency).toBe('Bernard Nicod')     // ← agency_name
    expect(p.source_logo_url).toBe('https://exemple.ch/logo.png') // ← agency_logo_url
    expect(p.construction_year).toBe(2025)     // ← year_built
    expect(p.renovation_year).toBe(2020)       // ← year_renovated
    expect(p.parking).toBe(1)                  // ← parking_count
    expect(p.visit_contact).toBe('Mme Dupont') // ← visit_contact_name
  })

  it('⚠ `visit_contact` porte le NOM, et le téléphone reste à part', () => {
    // La fiche affiche les deux séparément : y mettre le numéro le dupliquerait.
    const p = projeterAnnonce(annonce())
    expect(p.visit_contact).toBe('Mme Dupont')
    expect(p.agency_phone).toBe('021 000 00 00')
  })

  it('ne laisse aucun champ texte à `undefined` — la fiche les rend tels quels', () => {
    const p = projeterAnnonce(annonce({ city: null, canton: null, source_url: null, source_portal: null }))
    expect(p.city).toBe('')
    expect(p.canton).toBe('')
    expect(p.source_url).toBe('')
    expect(p.source_portal).toBe('')
  })
})
