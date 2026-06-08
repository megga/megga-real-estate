// Cantons suisses — donnée de référence générique (26 cantons + libellés FR).
// Extrait de l'ancien hook marketplace useMarketFilters lors du retrait de la
// marketplace (2026-06-08) ; conservé car utilisé par l'onboarding agence et la
// préférence de localisation du CRM.

export const SWISS_CANTONS = [
  'GE', 'VD', 'VS', 'NE', 'FR', 'BE', 'JU', 'BS', 'BL', 'AG', 'SO', 'ZH', 'LU', 'ZG',
  'SZ', 'NW', 'OW', 'UR', 'GL', 'SH', 'TG', 'AR', 'AI', 'SG', 'GR', 'TI',
] as const

export const CANTON_LABELS: Record<string, string> = {
  GE: 'Genève', VD: 'Vaud', VS: 'Valais', NE: 'Neuchâtel', FR: 'Fribourg',
  BE: 'Berne', JU: 'Jura', BS: 'Bâle-Ville', BL: 'Bâle-Campagne', AG: 'Argovie',
  SO: 'Soleure', ZH: 'Zurich', LU: 'Lucerne', ZG: 'Zoug', SZ: 'Schwytz',
  NW: 'Nidwald', OW: 'Obwald', UR: 'Uri', GL: 'Glaris', SH: 'Schaffhouse',
  TG: 'Thurgovie', AR: 'Appenzell R.-E.', AI: 'Appenzell R.-I.', SG: 'Saint-Gall',
  GR: 'Grisons', TI: 'Tessin',
}
