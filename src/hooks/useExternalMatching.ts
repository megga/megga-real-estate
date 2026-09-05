
/**
 * Type partagé `ExternalListing` : le modèle de vue de la fiche d'annonce marché
 * autonome (`/dashboard/market/:id`).
 *
 * ⚠ CE N'EST PLUS UN CONTRAT DE DONNÉES, c'est une projection. La logique de
 * matching qui le produisait a été retirée le 18.05.2026 avec l'edge function
 * `external-matching` et la table de cache `external_listings` : plus rien ne
 * construisait cette forme, et la fiche qui la consomme rendait « introuvable » à
 * 100 % des visites. Elle est désormais projetée depuis `market_listings` par
 * `projeterAnnonce` (voir `useMarketListing`).
 *
 * ⚠ Le champ d'identité s'appelle `id` et NON plus `external_id`. L'ancien nom
 * portait l'identifiant d'un pipeline RealAdvisor mort ; il vaut aujourd'hui
 * `market_listings.id` (uuid) — la seule clé que le schéma rende non ambiguë
 * (`source_id` n'est unique que PAR PORTAIL, contrainte composite
 * `market_listings_portal_source_unique`, et les plages numériques de Flatfox et
 * de RealAdvisor se recouvrent).
 */
export interface ExternalListing {
  id: string
  title: string
  price: number
  address: string
  city: string
  canton: string
  rooms: number | null
  surface_m2: number | null
  type: string
  photo_url: string | null
  photos: string[]
  source_url: string
  source_portal: string
  source_agency: string | null
  source_logo_url: string | null
  // Niveau 2 — champs enrichis
  description: string | null
  property_type_detail: string | null
  construction_year: number | null
  renovation_year: number | null
  bathrooms: number | null
  land_surface: number | null
  parking: number | null
  price_per_m2: number | null
  lat: number | null
  lng: number | null
  postcode: string | null
  agency_phone: string | null
  visit_contact: string | null
}

