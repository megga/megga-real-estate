/**
 * Mapping NPA suisse → canton (code 2 lettres)
 *
 * Couvre les principaux ranges du Service postal officiel.
 * Pour les NPA dans des zones d'overlap (ZH/SH/TG/SG/AR/AI en 8XXX/9XXX),
 * on retient le canton dominant. Précision estimée ~95% des cas.
 *
 * Utilisé par scrape-flatfox.mjs et tout autre scraper qui ne reçoit pas
 * le canton directement depuis l'API source.
 */

// Liste de ranges (zipMin, zipMax, canton) — précédence du premier match
const NPA_RANGES = [
  // Romandie
  [1000, 1099, 'VD'], // Lausanne et environs
  [1100, 1199, 'VD'], // Morges, Cossonay
  [1200, 1299, 'GE'], // Genève
  [1300, 1399, 'VD'], // Aubonne, Nyon nord
  [1400, 1499, 'VD'], // Yverdon
  [1500, 1599, 'VD'], // Moudon
  [1600, 1699, 'FR'], // Bulle, Châtel-St-Denis
  [1700, 1799, 'FR'], // Fribourg ville
  [1800, 1899, 'VD'], // Vevey, Aigle
  [1900, 1999, 'VS'], // Martigny, Sion
  [2000, 2099, 'NE'], // Neuchâtel
  [2100, 2399, 'NE'], // La Chaux-de-Fonds, Le Locle
  [2400, 2499, 'NE'], // Le Locle
  [2500, 2549, 'BE'], // Bienne (Berne romande)
  [2550, 2799, 'BE'], // Berne romande
  [2800, 2999, 'JU'], // Jura

  // Berne et Jura bernois
  [3000, 3199, 'BE'], // Berne ville et environs
  [3200, 3299, 'BE'], // Aarberg, Lyss
  [3300, 3399, 'BE'],
  [3400, 3499, 'BE'],
  [3500, 3599, 'BE'], // Konolfingen
  [3600, 3699, 'BE'], // Thoune
  [3700, 3799, 'BE'], // Spiez, Frutigen
  [3800, 3899, 'BE'], // Interlaken
  [3900, 3999, 'VS'], // Brigue, Naters

  // Bâle et nord
  [4000, 4099, 'BS'], // Bâle-Ville
  [4100, 4199, 'BL'], // Bâle-Campagne ouest
  [4200, 4299, 'BL'], // Aesch, Reinach
  [4300, 4399, 'AG'], // Zurzach
  [4400, 4499, 'BL'], // Liestal
  [4500, 4699, 'SO'], // Soleure
  [4700, 4899, 'BL'], // Sissach (overlap mais BL dominant)
  [4900, 4999, 'BL'],

  // Argovie
  [5000, 5499, 'AG'], // Aarau, Suhr
  [5500, 5999, 'AG'], // Brugg, Bremgarten

  // Suisse centrale
  [6000, 6099, 'LU'], // Lucerne
  [6100, 6299, 'LU'], // Sursee, Willisau
  [6300, 6399, 'ZG'], // Zoug
  [6400, 6499, 'SZ'], // Schwyz, Brunnen
  [6500, 6599, 'TI'], // Bellinzona
  [6600, 6699, 'TI'], // Locarno
  [6700, 6799, 'GR'], // Mesocco (Misox tessinois mais canton GR)
  [6800, 6899, 'TI'], // Mendrisio, Chiasso
  [6900, 6999, 'TI'], // Lugano

  // Grisons
  [7000, 7599, 'GR'], // Coire, Davos, St-Moritz
  [7600, 7899, 'GR'], // Engadine

  // Zurich et nord-est
  [8000, 8099, 'ZH'], // Zurich ville
  [8100, 8199, 'ZH'], // Adliswil, Wallisellen
  [8200, 8299, 'SH'], // Schaffhouse
  [8300, 8499, 'ZH'], // Wetzikon, Bülach (overlap TG faible)
  [8500, 8599, 'TG'], // Frauenfeld
  [8600, 8699, 'ZH'], // Dübendorf
  [8700, 8729, 'ZH'], // Küsnacht, Erlenbach
  [8730, 8799, 'TG'], // Uznach (overlap SG faible)
  [8800, 8899, 'ZH'], // Wädenswil, Horgen
  [8900, 8999, 'ZH'], // Affoltern

  // Suisse orientale
  [9000, 9099, 'SG'], // St-Gall ville
  [9100, 9199, 'AR'], // Herisau (Appenzell Rhodes ext)
  [9200, 9299, 'SG'], // Gossau
  [9300, 9399, 'SG'],
  [9400, 9499, 'SG'], // Rorschach
  [9500, 9599, 'SG'],
  [9600, 9699, 'SG'], // Wattwil
  [9700, 9799, 'AI'], // Appenzell Rhodes int
  [9800, 9899, 'GR'], // Maienfeld, Bad Ragaz
  [9900, 9999, 'SG'],
]

/**
 * Retourne le code canton 2 lettres pour un NPA suisse, ou null si non mappé.
 * @param {string|number} zipcode
 * @returns {string|null}
 */
export function npaToCanton(zipcode) {
  const z = parseInt(String(zipcode || '').trim(), 10)
  if (!z || z < 1000 || z > 9999) return null

  for (const [min, max, canton] of NPA_RANGES) {
    if (z >= min && z <= max) return canton
  }
  return null
}
