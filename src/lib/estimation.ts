import type { Canton } from './constants'

// --- Types ---

export interface EstimationParams {
  canton: Canton
  propertyType: 'apartment' | 'house' | 'villa' | 'commercial' | 'land'
  surface: number
  condition: 'neuf' | 'renove' | 'bon_etat' | 'a_renover' | 'a_restaurer'
  rooms?: string
  yearBuilt?: number
}

export interface EstimationResult {
  low: number
  mid: number
  high: number
  pricePerM2: number
  comparablesCount: number
}

// --- Prix au m² par canton et type de bien (CHF) ---
// Sources approximatives : marché suisse 2024-2025

type PriceRange = { min: number; max: number }
type PropertyPrices = Record<EstimationParams['propertyType'], PriceRange>

// Tiers de cantons par niveau de prix
const TIER_1: PropertyPrices = { // GE, ZH, ZG
  apartment: { min: 12000, max: 15000 },
  house: { min: 10000, max: 13000 },
  villa: { min: 11000, max: 14000 },
  commercial: { min: 8000, max: 11000 },
  land: { min: 3000, max: 5000 },
}

const TIER_2: PropertyPrices = { // VD, BS, BL, SZ, NW
  apartment: { min: 8500, max: 11500 },
  house: { min: 7500, max: 10500 },
  villa: { min: 9000, max: 12000 },
  commercial: { min: 6500, max: 9500 },
  land: { min: 2500, max: 4000 },
}

const TIER_3: PropertyPrices = { // LU, AG, SG, TI, BE, SO, TG, FR, NE
  apartment: { min: 6000, max: 8500 },
  house: { min: 5500, max: 7500 },
  villa: { min: 6500, max: 9000 },
  commercial: { min: 4500, max: 7000 },
  land: { min: 1800, max: 3000 },
}

const TIER_4: PropertyPrices = { // VS, JU, OW, UR, GL, SH, AR, AI, GR
  apartment: { min: 4500, max: 7000 },
  house: { min: 4000, max: 6500 },
  villa: { min: 5000, max: 7500 },
  commercial: { min: 3500, max: 5500 },
  land: { min: 1200, max: 2500 },
}

const CANTON_TIER: Record<Canton, PropertyPrices> = {
  GE: TIER_1,
  ZH: TIER_1,
  ZG: TIER_1,
  VD: TIER_2,
  BS: TIER_2,
  BL: TIER_2,
  SZ: TIER_2,
  NW: TIER_2,
  LU: TIER_3,
  AG: TIER_3,
  SG: TIER_3,
  TI: TIER_3,
  BE: TIER_3,
  SO: TIER_3,
  TG: TIER_3,
  FR: TIER_3,
  NE: TIER_3,
  VS: TIER_4,
  JU: TIER_4,
  OW: TIER_4,
  UR: TIER_4,
  GL: TIER_4,
  SH: TIER_4,
  AR: TIER_4,
  AI: TIER_4,
  GR: TIER_4,
}

// --- Multiplicateurs ---

const CONDITION_MULTIPLIER: Record<EstimationParams['condition'], number> = {
  neuf: 1.15,
  renove: 1.05,
  bon_etat: 1.00,
  a_renover: 0.85,
  a_restaurer: 0.70,
}

function getAgeAdjustment(yearBuilt?: number): number {
  if (!yearBuilt) return 1.0
  const age = new Date().getFullYear() - yearBuilt
  if (age <= 30) return 1.0
  // -0.5% par décennie au-delà de 30 ans, plafonné à -5%
  const decades = Math.floor((age - 30) / 10)
  return Math.max(0.95, 1.0 - decades * 0.005)
}

function getRoomsAdjustment(rooms?: string, surface?: number): number {
  if (!rooms || !surface) return 1.0
  const roomsNum = parseFloat(rooms)
  if (isNaN(roomsNum)) return 1.0
  // Ratio m² par pièce — plus le ratio est élevé, plus le bien est spacieux (premium)
  const ratio = surface / roomsNum
  if (ratio > 35) return 1.04 // Très spacieux
  if (ratio > 28) return 1.02 // Spacieux
  if (ratio < 18) return 0.97 // Compact
  return 1.0
}

// Pseudo-random déterministe pour le nombre de comparables
function seedRandom(canton: string, type: string): number {
  let hash = 0
  const str = canton + type
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

// --- Fonction principale ---

export function calculateEstimation(params: EstimationParams): EstimationResult {
  const { canton, propertyType, surface, condition, rooms, yearBuilt } = params

  const prices = CANTON_TIER[canton]
  const range = prices[propertyType]

  // Prix de base au m² (moyenne de la fourchette)
  const basePricePerM2 = (range.min + range.max) / 2

  // Appliquer les multiplicateurs
  const conditionMult = CONDITION_MULTIPLIER[condition]
  const ageMult = getAgeAdjustment(yearBuilt)
  const roomsMult = getRoomsAdjustment(rooms, surface)

  const adjustedPricePerM2 = basePricePerM2 * conditionMult * ageMult * roomsMult

  // Calculer les estimations
  const mid = Math.round(adjustedPricePerM2 * surface)
  const low = Math.round(mid * 0.92)
  const high = Math.round(mid * 1.08)

  // Nombre de comparables pseudo-aléatoire (15-80)
  const seed = seedRandom(canton, propertyType)
  const comparablesCount = 15 + (seed % 66)

  return {
    low,
    mid,
    high,
    pricePerM2: Math.round(adjustedPricePerM2),
    comparablesCount,
  }
}
