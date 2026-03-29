import type { PropertyType, PropertyStatus } from '@/lib/constants'
import type { FloorPlanHotspot, PhotoTag } from './floorPlan'

export interface Property {
  id: string
  agency_id: string
  title: string
  description: string
  type: PropertyType
  status: PropertyStatus
  price: number
  currency: string
  rooms: number
  bedrooms: number
  bathrooms: number
  surface_m2: number
  floor?: number
  total_floors?: number
  year_built?: number
  charges_monthly?: number
  mandate_type?: string
  condition?: string
  availability_date?: string
  address: string
  city: string
  canton: string
  postal_code: string
  lat: number
  lng: number
  photos: string[]
  video_url?: string
  features: string[]
  floor_plan_url?: string | null
  floor_plan_hotspots?: FloorPlanHotspot[]
  photo_tags?: PhotoTag[]
  created_by: string
  created_at: string
  published_at: string | null
  updated_at?: string
}

export interface Listing {
  id: string
  property_id: string
  agency_id: string
  title: string
  description_ai: string | null
  price_display: string
  is_featured: boolean
  is_hot: boolean
  views_count: number
  favorites_count: number
  published_at: string
  expires_at: string | null
  property?: Property
  agency?: {
    name: string
    logo_url: string | null
  }
}

export interface ListingFilters {
  type?: PropertyType
  minPrice?: number
  maxPrice?: number
  minRooms?: number
  maxRooms?: number
  city?: string
  canton?: string
  query?: string
}
