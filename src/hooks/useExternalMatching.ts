
export interface ExternalSearchCriteria {
  zone: string
  type: string
  budget_max: number
  budget_min?: number
  rooms_min?: number
}

export interface ExternalListing {
  external_id: string
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
