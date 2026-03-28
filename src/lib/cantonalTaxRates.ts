// ─── Taux d'impôt foncier par canton suisse ─────────────────────────────────
// Source : Administration fédérale des contributions (ESTV), état au 1er janvier 2024
// https://www.estv2.admin.ch/stp/ds/d-liegenschaftssteuer-fr.pdf
//
// Taux en pour mille (‰) de la valeur fiscale estimée.
// La valeur fiscale est généralement 60-80% de la valeur vénale (prix marché).
// On utilise 70% comme facteur de conversion par défaut.

export interface CantonTaxInfo {
  canton: string
  name: string
  nameDe: string
  hasPropertyTax: boolean
  /** Taux en pour mille (‰) de la valeur fiscale. null si pas d'impôt foncier */
  ratePerMille: number | null
  /** 'cantonal' = taux fixe cantonal, 'communal' = varie par commune, 'none' = pas d'impôt */
  level: 'cantonal' | 'communal' | 'none'
  /** Notes explicatives */
  notes: string
  /** Label énergétique supporté dans ce canton (Minergie, CECB, etc.) */
  energyLabelSystem: 'CECB' | 'Minergie' | 'both' | 'none'
}

// Facteur de conversion prix marché → valeur fiscale estimée (70%)
export const FISCAL_VALUE_FACTOR = 0.70

// Sources croisées :
// - ESTV 2024 : https://www.estv2.admin.ch/stp/ds/d-liegenschaftssteuer-fr.pdf
// - immoverkauf24 : https://immoverkauf24.ch/immobilienverkauf/immobilienverkauf-a-z/liegenschaftssteuer/
// - Crowdhouse : https://crowdhouse.com/ch/blog/immobiliensteuern-schweiz/
// - HEV Schweiz : https://www.hev-schweiz.ch/eigentum/steuern-abgaben/liegenschaftssteuer
//
// Classification :
// - 7 cantons SANS impôt foncier : ZH, SZ, GL, ZG, SO, BL, AG
// - 6 cantons avec impôt MINIMAL (Minimalsteuer) : AR, BS, LU, NW, OW, SH
//   → S'applique uniquement si > impôt revenu/fortune. On affiche le taux quand même.
// - 13 cantons avec impôt foncier standard : AI, BE, FR, GE, GR, JU, NE, SG, TG, TI, UR, VD, VS

export const CANTONAL_TAX_RATES: Record<string, CantonTaxInfo> = {
  ZH: {
    canton: 'ZH', name: 'Zürich', nameDe: 'Zürich',
    hasPropertyTax: false, ratePerMille: null, level: 'none',
    notes: 'Pas d\'impôt foncier. Imposition via la fortune.',
    energyLabelSystem: 'both',
  },
  BE: {
    canton: 'BE', name: 'Berne', nameDe: 'Bern',
    hasPropertyTax: true, ratePerMille: 1.5, level: 'communal',
    notes: 'Facultatif, fixé par les communes. Taux max. 1.5‰.',
    energyLabelSystem: 'both',
  },
  LU: {
    canton: 'LU', name: 'Lucerne', nameDe: 'Luzern',
    hasPropertyTax: true, ratePerMille: 0.5, level: 'cantonal',
    notes: 'Impôt minimal (Minimalsteuer) de 0.5‰. S\'applique si > impôt revenu/fortune.',
    energyLabelSystem: 'CECB',
  },
  UR: {
    canton: 'UR', name: 'Uri', nameDe: 'Uri',
    hasPropertyTax: true, ratePerMille: 1.0, level: 'communal',
    notes: 'Impôt minimal (Minimalsteuer). Taux communal variable.',
    energyLabelSystem: 'CECB',
  },
  SZ: {
    canton: 'SZ', name: 'Schwyz', nameDe: 'Schwyz',
    hasPropertyTax: false, ratePerMille: null, level: 'none',
    notes: 'Pas d\'impôt foncier.',
    energyLabelSystem: 'CECB',
  },
  OW: {
    canton: 'OW', name: 'Obwald', nameDe: 'Obwalden',
    hasPropertyTax: true, ratePerMille: 0.5, level: 'communal',
    notes: 'Impôt minimal (Minimalsteuer). S\'applique si > impôt revenu/fortune.',
    energyLabelSystem: 'CECB',
  },
  NW: {
    canton: 'NW', name: 'Nidwald', nameDe: 'Nidwalden',
    hasPropertyTax: true, ratePerMille: 0.5, level: 'communal',
    notes: 'Impôt minimal (Minimalsteuer). Taux faible.',
    energyLabelSystem: 'CECB',
  },
  GL: {
    canton: 'GL', name: 'Glaris', nameDe: 'Glarus',
    hasPropertyTax: false, ratePerMille: null, level: 'none',
    notes: 'Pas d\'impôt foncier.',
    energyLabelSystem: 'CECB',
  },
  ZG: {
    canton: 'ZG', name: 'Zoug', nameDe: 'Zug',
    hasPropertyTax: false, ratePerMille: null, level: 'none',
    notes: 'Pas d\'impôt foncier. Canton fiscalement très attractif.',
    energyLabelSystem: 'both',
  },
  FR: {
    canton: 'FR', name: 'Fribourg', nameDe: 'Freiburg',
    hasPropertyTax: true, ratePerMille: 3.0, level: 'communal',
    notes: 'Facultatif, fixé par les communes. Taux max. 3.0‰.',
    energyLabelSystem: 'both',
  },
  SO: {
    canton: 'SO', name: 'Soleure', nameDe: 'Solothurn',
    hasPropertyTax: false, ratePerMille: null, level: 'none',
    notes: 'Pas d\'impôt foncier.',
    energyLabelSystem: 'CECB',
  },
  BS: {
    canton: 'BS', name: 'Bâle-Ville', nameDe: 'Basel-Stadt',
    hasPropertyTax: true, ratePerMille: 0.8, level: 'cantonal',
    notes: 'Impôt minimal (Minimalsteuer). Taux cantonal 0.8‰.',
    energyLabelSystem: 'both',
  },
  BL: {
    canton: 'BL', name: 'Bâle-Campagne', nameDe: 'Basel-Landschaft',
    hasPropertyTax: false, ratePerMille: null, level: 'none',
    notes: 'Pas d\'impôt foncier.',
    energyLabelSystem: 'CECB',
  },
  SH: {
    canton: 'SH', name: 'Schaffhouse', nameDe: 'Schaffhausen',
    hasPropertyTax: true, ratePerMille: 0.8, level: 'communal',
    notes: 'Impôt minimal (Minimalsteuer). Taux communal variable.',
    energyLabelSystem: 'CECB',
  },
  AR: {
    canton: 'AR', name: 'Appenzell Rh.-Ext.', nameDe: 'Appenzell Ausserrhoden',
    hasPropertyTax: true, ratePerMille: 0.8, level: 'communal',
    notes: 'Impôt minimal (Minimalsteuer). Taux communal variable.',
    energyLabelSystem: 'CECB',
  },
  AI: {
    canton: 'AI', name: 'Appenzell Rh.-Int.', nameDe: 'Appenzell Innerrhoden',
    hasPropertyTax: true, ratePerMille: 1.0, level: 'communal',
    notes: 'Facultatif pour les communes. Taux max. 1.0‰.',
    energyLabelSystem: 'CECB',
  },
  SG: {
    canton: 'SG', name: 'Saint-Gall', nameDe: 'St. Gallen',
    hasPropertyTax: true, ratePerMille: 0.5, level: 'cantonal',
    notes: 'Obligatoire. Taux cantonal 0.2-0.8‰ selon commune.',
    energyLabelSystem: 'CECB',
  },
  GR: {
    canton: 'GR', name: 'Grisons', nameDe: 'Graubünden',
    hasPropertyTax: true, ratePerMille: 1.5, level: 'communal',
    notes: 'Facultatif, fixé par les communes. Taux max. 2.0‰.',
    energyLabelSystem: 'CECB',
  },
  AG: {
    canton: 'AG', name: 'Argovie', nameDe: 'Aargau',
    hasPropertyTax: false, ratePerMille: null, level: 'none',
    notes: 'Pas d\'impôt foncier.',
    energyLabelSystem: 'CECB',
  },
  TG: {
    canton: 'TG', name: 'Thurgovie', nameDe: 'Thurgau',
    hasPropertyTax: true, ratePerMille: 0.5, level: 'cantonal',
    notes: 'Obligatoire. Taux cantonal fixe de 0.5‰.',
    energyLabelSystem: 'CECB',
  },
  TI: {
    canton: 'TI', name: 'Tessin', nameDe: 'Ticino',
    hasPropertyTax: true, ratePerMille: 2.0, level: 'cantonal',
    notes: 'Taux cantonal 2.0‰ + option communale 1.0‰.',
    energyLabelSystem: 'both',
  },
  VD: {
    canton: 'VD', name: 'Vaud', nameDe: 'Waadt',
    hasPropertyTax: true, ratePerMille: 1.0, level: 'cantonal',
    notes: 'Taux cantonal 1.0‰. Communes peuvent ajouter max. 1.5‰.',
    energyLabelSystem: 'both',
  },
  VS: {
    canton: 'VS', name: 'Valais', nameDe: 'Wallis',
    hasPropertyTax: true, ratePerMille: 1.0, level: 'communal',
    notes: 'Obligatoire. Taux communal 0.8-1.25‰.',
    energyLabelSystem: 'both',
  },
  NE: {
    canton: 'NE', name: 'Neuchâtel', nameDe: 'Neuenburg',
    hasPropertyTax: true, ratePerMille: 2.4, level: 'cantonal',
    notes: 'Taux cantonal 2.4‰. Communes peuvent ajouter max. 1.6‰.',
    energyLabelSystem: 'CECB',
  },
  GE: {
    canton: 'GE', name: 'Genève', nameDe: 'Genf',
    hasPropertyTax: true, ratePerMille: 1.0, level: 'cantonal',
    notes: 'Taux cantonal 1.0-2.0‰. Centimes additionnels communaux possibles.',
    energyLabelSystem: 'both',
  },
  JU: {
    canton: 'JU', name: 'Jura', nameDe: 'Jura',
    hasPropertyTax: true, ratePerMille: 1.0, level: 'cantonal',
    notes: 'Taux cantonal 0.5-1.5‰ selon commune.',
    energyLabelSystem: 'CECB',
  },
}

/**
 * Calcule l'impôt foncier annuel estimé
 * @param price Prix du bien (valeur marché)
 * @param canton Abréviation du canton (ex: "GE", "VD")
 * @returns Montant estimé en CHF/an, ou null si pas d'impôt foncier
 */
export function estimatePropertyTax(price: number, canton: string): number | null {
  const info = CANTONAL_TAX_RATES[canton.toUpperCase()]
  if (!info || !info.hasPropertyTax || !info.ratePerMille) return null
  const fiscalValue = price * FISCAL_VALUE_FACTOR
  return Math.round(fiscalValue * info.ratePerMille / 1000)
}

/**
 * Calcule le coût mensuel total estimé (hypothèque + charges + impôt foncier)
 * Basé sur les règles bancaires suisses :
 * - Taux hypothécaire imputé : 5%
 * - Amortissement : 1%
 * - Entretien : 1%
 * - Total charges annuelles : 7% de l'hypothèque
 */
export function estimateMonthlyCost(
  price: number,
  canton: string,
  chargesMonthly: number = 0,
  downPaymentPct: number = 0.20
): {
  mortgage: number
  monthlyMortgageCost: number
  monthlyCharges: number
  monthlyPropertyTax: number
  totalMonthly: number
} {
  const downPayment = price * downPaymentPct
  const mortgage = price - downPayment
  const annualMortgageCost = mortgage * 0.07 // 5% imputed + 1% amort + 1% maintenance
  const monthlyMortgageCost = Math.round(annualMortgageCost / 12)
  const propertyTax = estimatePropertyTax(price, canton) || 0
  const monthlyPropertyTax = Math.round(propertyTax / 12)

  return {
    mortgage,
    monthlyMortgageCost,
    monthlyCharges: Math.round(chargesMonthly),
    monthlyPropertyTax,
    totalMonthly: monthlyMortgageCost + Math.round(chargesMonthly) + monthlyPropertyTax,
  }
}

/**
 * Labels pour les classes énergétiques CECB
 */
export const ENERGY_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const
export type EnergyLabel = typeof ENERGY_LABELS[number]

export const ENERGY_LABEL_COLORS: Record<EnergyLabel, string> = {
  A: 'bg-green-600',
  B: 'bg-green-500',
  C: 'bg-lime-500',
  D: 'bg-yellow-400',
  E: 'bg-orange-400',
  F: 'bg-orange-600',
  G: 'bg-red-600',
}

export const MINERGIE_LABELS = ['Minergie', 'Minergie-P', 'Minergie-A', 'Minergie-ECO'] as const
export type MinergieLabel = typeof MINERGIE_LABELS[number]
