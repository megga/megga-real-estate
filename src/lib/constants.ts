export const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Appartement' },
  { value: 'house', label: 'Maison' },
  { value: 'villa', label: 'Villa' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'land', label: 'Terrain' },
] as const;

export const CANTONS = [
  'GE', 'VD', 'VS', 'NE', 'FR', 'BE', 'JU', 'BS', 'BL', 'AG', 'SO',
  'ZH', 'LU', 'ZG', 'SZ', 'NW', 'OW', 'UR', 'GL', 'SH', 'TG', 'AR',
  'AI', 'SG', 'GR', 'TI',
] as const;

export const ROOMS_OPTIONS = [
  { value: '1', label: '1 pièce' },
  { value: '2', label: '2 pièces' },
  { value: '3', label: '3 pièces' },
  { value: '4', label: '4 pièces' },
  { value: '5+', label: '5+ pièces' },
] as const;

export const BUDGET_OPTIONS_BUY = [
  { value: '500000', label: "Jusqu'à CHF 500'000" },
  { value: '750000', label: "Jusqu'à CHF 750'000" },
  { value: '1000000', label: "Jusqu'à CHF 1'000'000" },
  { value: '1500000', label: "Jusqu'à CHF 1'500'000" },
  { value: '2000000', label: "Jusqu'à CHF 2'000'000" },
  { value: '999999999', label: 'Sans limite' },
] as const;

export const BUDGET_OPTIONS_RENT = [
  { value: '1500', label: "Jusqu'à CHF 1'500/mois" },
  { value: '2000', label: "Jusqu'à CHF 2'000/mois" },
  { value: '2500', label: "Jusqu'à CHF 2'500/mois" },
  { value: '3000', label: "Jusqu'à CHF 3'000/mois" },
  { value: '5000', label: "Jusqu'à CHF 5'000/mois" },
  { value: '999999', label: 'Sans limite' },
] as const;
