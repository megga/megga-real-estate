// Curated Swiss geo entities for the Localisation autocomplete on the V3
// storefront. Two scopes:
//   1. cantons → filter market_listings.canton = 'XX' (1 lookup, ~2ms)
//   2. cities  → filter market_listings.city IN (...variants) (~500ms)
//
// `variants` for each city is the union of casing/postal-sector forms that
// actually appear in the database. Built once from a SQL aggregate against
// market_listings (see migrations/notes) so the storefront covers the real
// inventory rather than just the canonical capitalization.

window.CH_CANTONS = [
  { code: 'ZH', name: 'Zurich' },
  { code: 'BE', name: 'Berne' },
  { code: 'LU', name: 'Lucerne' },
  { code: 'UR', name: 'Uri' },
  { code: 'SZ', name: 'Schwytz' },
  { code: 'OW', name: 'Obwald' },
  { code: 'NW', name: 'Nidwald' },
  { code: 'GL', name: 'Glaris' },
  { code: 'ZG', name: 'Zoug' },
  { code: 'FR', name: 'Fribourg' },
  { code: 'SO', name: 'Soleure' },
  { code: 'BS', name: 'Bâle-Ville' },
  { code: 'BL', name: 'Bâle-Campagne' },
  { code: 'SH', name: 'Schaffhouse' },
  { code: 'AR', name: 'Appenzell Rhodes-Extérieures' },
  { code: 'AI', name: 'Appenzell Rhodes-Intérieures' },
  { code: 'SG', name: 'Saint-Gall' },
  { code: 'GR', name: 'Grisons' },
  { code: 'AG', name: 'Argovie' },
  { code: 'TG', name: 'Thurgovie' },
  { code: 'TI', name: 'Tessin' },
  { code: 'VD', name: 'Vaud' },
  { code: 'VS', name: 'Valais' },
  { code: 'NE', name: 'Neuchâtel' },
  { code: 'GE', name: 'Genève' },
  { code: 'JU', name: 'Jura' },
];

window.CH_CITIES = [
  { name: 'Genève',            canton: 'GE', variants: ['Genève', 'genève'] },
  { name: 'Carouge',           canton: 'GE', variants: ['Carouge'] },
  { name: 'Meyrin',            canton: 'GE', variants: ['Meyrin', 'MEYRIN'] },
  { name: 'Vernier',           canton: 'GE', variants: ['Vernier', 'vernier', 'VERNIER'] },
  { name: 'Lancy',             canton: 'GE', variants: ['Lancy'] },
  { name: 'Lausanne',          canton: 'VD', variants: ['Lausanne', 'lausanne', 'LAUSANNE', 'Lausanne 25'] },
  { name: 'Montreux',          canton: 'VD', variants: ['Montreux'] },
  { name: 'Nyon',              canton: 'VD', variants: ['Nyon', 'NYON', 'Nyon 1'] },
  { name: 'Morges',            canton: 'VD', variants: ['Morges'] },
  { name: 'Vevey',             canton: 'VD', variants: ['Vevey', 'vevey', 'VEVEY'] },
  { name: 'Yverdon-les-Bains', canton: 'VD', variants: ['Yverdon-les-Bains', 'Yverdon-les-bains'] },
  { name: 'Renens',            canton: 'VD', variants: ['Renens', 'renens'] },
  { name: 'Zürich',            canton: 'ZH', variants: ['Zürich', 'zürich', 'ZÜRICH'] },
  { name: 'Winterthur',        canton: 'ZH', variants: ['Winterthur', 'winterthur', 'WINTERTHUR', 'Winterthur 8405'] },
  { name: 'Uster',             canton: 'ZH', variants: ['Uster', 'uster', 'Uster 1'] },
  { name: 'Dübendorf',         canton: 'ZH', variants: ['Dübendorf', 'dübendorf'] },
  { name: 'Bern',              canton: 'BE', variants: ['Bern', 'bern', 'BErn', 'BERN'] },
  { name: 'Biel/Bienne',       canton: 'BE', variants: ['Biel/Bienne'] },
  { name: 'Thun',              canton: 'BE', variants: ['Thun'] },
  { name: 'Köniz',             canton: 'BE', variants: ['Köniz'] },
  { name: 'Basel',             canton: 'BS', variants: ['Basel', 'basel'] },
  { name: 'Riehen',            canton: 'BS', variants: ['Riehen'] },
  { name: 'Lugano',            canton: 'TI', variants: ['Lugano', 'lugano', 'LUGANO'] },
  { name: 'Bellinzona',        canton: 'TI', variants: ['Bellinzona', 'bellinzona'] },
  { name: 'Locarno',           canton: 'TI', variants: ['Locarno', 'locarno'] },
  { name: 'Chiasso',           canton: 'TI', variants: ['Chiasso', 'CHIASSO', 'Chiasso 1'] },
  { name: 'Luzern',            canton: 'LU', variants: ['Luzern', 'luzern'] },
  { name: 'St. Gallen',        canton: 'SG', variants: ['St. Gallen', 'st. Gallen', 'st. gallen'] },
  { name: 'Rapperswil-Jona',   canton: 'SG', variants: ['Rapperswil-Jona'] },
  { name: 'Fribourg',          canton: 'FR', variants: ['Fribourg', 'FRIBOURG'] },
  { name: 'Bulle',             canton: 'FR', variants: ['Bulle', 'bulle', 'BULLE'] },
  { name: 'Neuchâtel',         canton: 'NE', variants: ['Neuchâtel'] },
  { name: 'La Chaux-de-Fonds', canton: 'NE', variants: ['La Chaux-de-Fonds'] },
  { name: 'Sion',              canton: 'VS', variants: ['Sion'] },
  { name: 'Sierre',            canton: 'VS', variants: ['Sierre'] },
  { name: 'Martigny',          canton: 'VS', variants: ['Martigny'] },
  { name: 'Monthey',           canton: 'VS', variants: ['Monthey'] },
  { name: 'Zug',               canton: 'ZG', variants: ['Zug', 'ZUG'] },
  { name: 'Aarau',             canton: 'AG', variants: ['Aarau', 'aarau'] },
  { name: 'Baden',             canton: 'AG', variants: ['Baden'] },
  { name: 'Wettingen',         canton: 'AG', variants: ['Wettingen', 'wettingen'] },
  { name: 'Schaffhausen',      canton: 'SH', variants: ['Schaffhausen', 'schaffhausen'] },
  { name: 'Chur',              canton: 'GR', variants: ['Chur', 'chur', 'CHur'] },
  { name: 'Davos',             canton: 'GR', variants: ['Davos'] },
  { name: 'Frauenfeld',        canton: 'TG', variants: ['Frauenfeld'] },
  { name: 'Kreuzlingen',       canton: 'TG', variants: ['Kreuzlingen', 'kreuzlingen'] },
  { name: 'Solothurn',         canton: 'SO', variants: ['Solothurn', 'solothurn', 'SOLOTHURN'] },
  { name: 'Olten',             canton: 'SO', variants: ['Olten', 'olten'] },
  { name: 'Schwyz',            canton: 'SZ', variants: ['Schwyz'] },
  { name: 'Delémont',          canton: 'JU', variants: ['Delémont'] },
  { name: 'Liestal',           canton: 'BL', variants: ['Liestal'] },
  { name: 'Herisau',           canton: 'AR', variants: ['Herisau'] },
  { name: 'Stans',             canton: 'NW', variants: ['Stans'] },
  { name: 'Sarnen',            canton: 'OW', variants: ['Sarnen'] },
  { name: 'Altdorf',           canton: 'UR', variants: ['Altdorf'] },
  { name: 'Glarus',            canton: 'GL', variants: ['Glarus'] },
  { name: 'Appenzell',         canton: 'AI', variants: ['Appenzell'] },
];

// Curated Swiss agglomerations — the natural search scope for a real-estate
// user looking in "Lausanne" who'd happily take a rental in Pully or Renens.
// Each agglomeration's `cities` list is the exact DB-spelling values found
// in market_listings.city (compiled from a 2026-05-28 query). The storefront
// passes them as city=in.(...) to the partial index — same fast path as the
// city-variant lookup.
//
// Six agglomerations cover ~80% of the rental marketplace volume. Adding
// more is cheap (just extend this array); harder is keeping the city lists
// in sync as Flatfox spelling drifts — a quarterly review is reasonable.
window.CH_AGGLOMERATIONS = [
  { slug: 'lausanne',  name: 'Lausanne et environs',  canton: 'VD',
    cities: ['Lausanne', 'lausanne', 'LAUSANNE', 'Lausanne 25', 'Lausanne Centre',
             'Crissier', 'Le Mont-sur-Lausanne', 'Le Mont-Sur-Lausanne',
             'Pully', 'Bussigny', 'Bussigny-près-Lausanne', 'Bussigny-Lausanne',
             'Chavannes-près-Renens', 'Chavannes-Renens',
             'Renens', 'renens', 'Prilly',
             'Belmont-sur-Lausanne', 'Ecublens', 'Epalinges',
             'Cheseaux-sur-Lausanne', 'Cheseaux-Lausanne', 'CHESEAUX-SUR-LAUSANNE',
             'Romanel-sur-Lausanne', 'Romanel-s-Lausanne',
             'Lutry', 'Jouxtens-Mézery', 'Paudex'] },
  { slug: 'geneve',    name: 'Grand Genève',          canton: 'GE',
    cities: ['Genève', 'genève', 'Genf',
             'Meyrin', 'MEYRIN', 'Vernier', 'vernier', 'VERNIER',
             'Petit-Lancy', 'Grand-Lancy', 'Lancy',
             'Plan-les-Ouates', 'Versoix', 'Thônex',
             'Carouge', 'Chambésy', 'Bellevue', 'Chêne-Bourg',
             'Onex', 'Chêne-Bougeries', 'Genthod', 'Cologny',
             'Collonge-Bellerive', 'Bernex', 'Vésenaz',
             'Choulex', 'Hermance', 'Anières', 'Confignon', 'Puplinge'] },
  { slug: 'zurich',    name: 'Région zurichoise',     canton: 'ZH',
    cities: ['Zürich', 'zürich', 'ZÜRICH', 'Zurich',
             'Dübendorf', 'dübendorf', 'Dietikon', 'Schlieren',
             'Kloten', 'Wallisellen', 'Uster', 'uster', 'Uster 1',
             'Adliswil', 'Bülach', 'Thalwil', 'Volketswil',
             'Opfikon', 'Zollikon', 'Bassersdorf', 'Meilen',
             'Zumikon', 'Rüschlikon', 'Kilchberg', 'Erlenbach',
             'Winterthur', 'winterthur', 'WINTERTHUR', 'Winterthur 8405'] },
  { slug: 'berne',     name: 'Région bernoise',       canton: 'BE',
    cities: ['Bern', 'bern', 'BErn', 'BERN',
             'Ittigen', 'Liebefeld', 'Wabern', 'Belp', 'Köniz',
             'Münsingen', 'Zollikofen', 'Münchenbuchsee',
             'Bolligen', 'Worb', 'Muri bei Bern'] },
  { slug: 'bale',      name: 'Région bâloise',        canton: 'BS',
    cities: ['Basel', 'basel',
             'Allschwil', 'Pratteln', 'Muttenz', 'Binningen',
             'Münchenstein', 'Riehen', 'Birsfelden', 'Reinach',
             'Bottmingen', 'Liestal'] },
  { slug: 'lugano',    name: 'Région luganaise',      canton: 'TI',
    cities: ['Lugano', 'lugano', 'LUGANO',
             'Paradiso', 'Massagno', 'Pregassona',
             'Caslano', 'Manno', 'Agno',
             'Cadempino', 'Vezia', 'Lamone'] },
];

// Helper: find a city by canonical name (used by megga-properties.js to look
// up variants when the URL only has ?ville=Lausanne).
window.CH_FIND_CITY = function (name) {
  if (!name) return null;
  var lc = String(name).toLowerCase();
  for (var i = 0; i < window.CH_CITIES.length; i++) {
    if (window.CH_CITIES[i].name.toLowerCase() === lc) return window.CH_CITIES[i];
  }
  return null;
};

window.CH_FIND_AGGLO = function (slug) {
  if (!slug) return null;
  var s = String(slug).toLowerCase();
  for (var i = 0; i < window.CH_AGGLOMERATIONS.length; i++) {
    if (window.CH_AGGLOMERATIONS[i].slug === s) return window.CH_AGGLOMERATIONS[i];
  }
  return null;
};

window.CH_FIND_CANTON = function (codeOrName) {
  if (!codeOrName) return null;
  var s = String(codeOrName).toLowerCase();
  for (var i = 0; i < window.CH_CANTONS.length; i++) {
    var c = window.CH_CANTONS[i];
    if (c.code.toLowerCase() === s || c.name.toLowerCase() === s) return c;
  }
  return null;
};
