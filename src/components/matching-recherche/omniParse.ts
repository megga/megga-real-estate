// Matching · Recherche — parseur d'omnibox. Transforme le TEXTE LIBRE d'un agent
// en jetons TYPÉS, routés au bon étage :
//   - canton / ville→canton / type / budget  → filtre DUR poussé EN SQL (RPC)
//   - pièces / surface / texte résiduel       → filtre client sur le sous-ensemble
//
// Sans ce parseur, « Zurich en vente » ou « 4 pièces sous 1.5M » devenaient un
// simple jeton texte comparé au titre/adresse d'un top-60 NATIONAL borné → ~0 résultat.
// Ici « Zurich » → canton ZH poussé en SQL, « sous 1.5M » → budgetMax, etc.
//
// Le `type` réel de market_listings pour la VENTE RealAdvisor n'a que 5 valeurs
// (apartment/house/land/commercial/parking) : les sous-types (attique, villa,
// chalet…) mappent vers l'enum + un jeton texte d'affinage.

export type OmniField = 'canton' | 'type' | 'budgetMax' | 'budgetMin' | 'rooms' | 'surface' | 'text'
export interface OmniToken {
  field: OmniField
  value: string | number
  label: string
}

/** minuscule + sans accents + tirets→espaces + espaces normalisés */
export function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // supprime les diacritiques combinants
    .toLowerCase()
    .replace(/[-–]/g, ' ') // tirets (- et –) → espace
    .replace(/\s+/g, ' ')
    .trim()
}

const titleCase = (s: string): string => s.replace(/\b[a-zà-ÿ]/g, (c) => c.toUpperCase())

// ── Cantons : code 2 lettres → libellé FR affiché ──
const CANTON_LABEL: Record<string, string> = {
  GE: 'Genève', VD: 'Vaud', VS: 'Valais', NE: 'Neuchâtel', FR: 'Fribourg', JU: 'Jura',
  BE: 'Berne', SO: 'Soleure', BS: 'Bâle-Ville', BL: 'Bâle-Campagne', AG: 'Argovie',
  LU: 'Lucerne', ZH: 'Zurich', ZG: 'Zoug', SZ: 'Schwytz', SH: 'Schaffhouse', TG: 'Thurgovie',
  TI: 'Tessin', GR: 'Grisons', SG: 'Saint-Gall', AR: 'Appenzell RE', AI: 'Appenzell RI',
  GL: 'Glaris', NW: 'Nidwald', OW: 'Obwald', UR: 'Uri',
}

// alias normalisé (nom FR/DE/IT) → code. Les CODES 2 lettres sont reconnus à part,
// UNIQUEMENT en MAJUSCULES sur le texte brut (CODE_RE) — évite « ne »/« so »
// minuscules = mots courants.
const CANTON_NAME_TO_CODE: Record<string, string> = {}
const CODE_RE = new RegExp('\\b(' + Object.keys(CANTON_LABEL).join('|') + ')\\b', 'g')
;(() => {
  const add = (code: string, names: string[]) => names.forEach((n) => { CANTON_NAME_TO_CODE[norm(n)] = code })
  add('GE', ['Genève', 'Geneve', 'Geneva', 'Genf', 'Ginevra'])
  add('VD', ['Vaud', 'Waadt'])
  add('VS', ['Valais', 'Wallis', 'Vallese'])
  add('NE', ['Neuchâtel', 'Neuenburg'])
  add('FR', ['Fribourg', 'Freiburg', 'Friburgo'])
  add('JU', ['Jura'])
  add('BE', ['Berne', 'Bern', 'Berna'])
  add('SO', ['Soleure', 'Solothurn', 'Soletta'])
  add('BS', ['Bâle-Ville', 'Basel-Stadt', 'Bâle', 'Basel', 'Basilea'])
  add('BL', ['Bâle-Campagne', 'Basel-Landschaft', 'Baselland'])
  add('AG', ['Argovie', 'Aargau', 'Argovia'])
  add('LU', ['Lucerne', 'Luzern', 'Lucerna'])
  add('ZH', ['Zurich', 'Zürich', 'Zurigo'])
  add('ZG', ['Zoug', 'Zug', 'Zugo'])
  add('SZ', ['Schwytz', 'Schwyz', 'Svitto'])
  add('SH', ['Schaffhouse', 'Schaffhausen', 'Sciaffusa'])
  add('TG', ['Thurgovie', 'Thurgau', 'Turgovia'])
  add('TI', ['Tessin', 'Ticino'])
  add('GR', ['Grisons', 'Graubünden', 'Grigioni'])
  add('SG', ['Saint-Gall', 'St. Gallen', 'St-Gall', 'Sankt Gallen', 'San Gallo'])
  add('AR', ['Appenzell Rhodes-Extérieures', 'Appenzell Ausserrhoden'])
  add('AI', ['Appenzell Rhodes-Intérieures', 'Appenzell Innerrhoden'])
  add('GL', ['Glaris', 'Glarus', 'Glarona'])
  add('NW', ['Nidwald', 'Nidwalden'])
  add('OW', ['Obwald', 'Obwalden'])
  add('UR', ['Uri'])
})()

// ── Villes majeures (non-cantons) → code canton (scoping SQL + affinage texte) ──
const CITY_TO_CANTON: Record<string, string> = {}
;(() => {
  const add = (code: string, cities: string[]) => cities.forEach((c) => { CITY_TO_CANTON[norm(c)] = code })
  add('VD', ['Lausanne', 'Nyon', 'Montreux', 'Vevey', 'Morges', 'Renens', 'Yverdon-les-Bains', 'Yverdon', 'Pully', 'Gland', 'Rolle', 'Aigle', 'Payerne', 'Prilly', 'Ecublens', 'Lutry', 'Coppet'])
  add('GE', ['Carouge', 'Meyrin', 'Vernier', 'Lancy', 'Onex', 'Thônex', 'Versoix', 'Plan-les-Ouates', 'Chêne-Bougeries', 'Cologny', 'Grand-Saconnex'])
  add('VS', ['Sion', 'Sierre', 'Martigny', 'Monthey', 'Brigue', 'Brig', 'Verbier', 'Crans-Montana', 'Viège', 'Visp', 'Zermatt', 'Saxon', 'Conthey', 'Nendaz', 'Fully'])
  add('FR', ['Bulle', 'Villars-sur-Glâne', 'Estavayer', 'Morat', 'Murten', 'Romont', 'Marly'])
  add('NE', ['La Chaux-de-Fonds', 'Le Locle', 'Peseux', 'Boudry', 'Colombier'])
  add('BE', ['Bienne', 'Biel', 'Thoune', 'Thun', 'Köniz', 'Ostermundigen', 'Interlaken', 'Gstaad', 'Burgdorf', 'Steffisburg', 'Moutier'])
  add('ZH', ['Winterthour', 'Winterthur', 'Uster', 'Dübendorf', 'Dietikon', 'Wetzikon', 'Kloten', 'Horgen', 'Thalwil', 'Meilen', 'Wädenswil'])
  add('TI', ['Lugano', 'Locarno', 'Bellinzone', 'Bellinzona', 'Mendrisio', 'Chiasso', 'Ascona', 'Paradiso', 'Massagno', 'Minusio'])
  add('LU', ['Emmen', 'Kriens', 'Horw', 'Ebikon'])
  add('SG', ['Rapperswil', 'Wil', 'Gossau', 'Uzwil'])
  add('AG', ['Aarau', 'Baden', 'Wettingen', 'Aarburg', 'Wohlen'])
  add('GR', ['Coire', 'Chur', 'Davos', 'Saint-Moritz', 'St. Moritz', 'Arosa'])
  add('ZG', ['Baar', 'Cham', 'Zoug'])
  add('SZ', ['Freienbach', 'Pfäffikon', 'Einsiedeln'])
  add('SH', ['Neuhausen'])
})()

// ── Types : mot agent → { enum réel, libellé, affinage texte pour les sous-types } ──
interface TypeHit { enum: string; label: string; refine?: string }
const TYPE_ALIASES: Record<string, TypeHit> = {}
;(() => {
  const canon = (enumV: string, label: string, aliases: string[]) => aliases.forEach((a) => { TYPE_ALIASES[norm(a)] = { enum: enumV, label } })
  const sub = (enumV: string, label: string, aliases: string[]) => aliases.forEach((a) => { TYPE_ALIASES[norm(a)] = { enum: enumV, label, refine: norm(a) } })
  canon('apartment', 'Appartement', ['appartement', 'appartements', 'appart', 'apparts', 'appt', 'appts', 'flat', 'ppe'])
  sub('apartment', 'Appartement', ['attique', 'penthouse', 'duplex', 'triplex', 'studio', 'loft', 'combles', 'rez-jardin'])
  canon('house', 'Maison', ['maison', 'maisons', 'house', 'individuelle', 'einfamilienhaus'])
  sub('house', 'Maison', ['villa', 'villas', 'chalet', 'chalets', 'propriete', 'ferme', 'mitoyenne', 'rustico'])
  canon('land', 'Terrain', ['terrain', 'terrains', 'parcelle', 'parcelles', 'land', 'bauland'])
  canon('commercial', 'Commercial', ['commercial', 'commerce', 'bureau', 'bureaux', 'local', 'locaux', 'immeuble', 'rendement', 'industriel', 'depot', 'atelier', 'arcade'])
  canon('parking', 'Parking', ['parking', 'parkings', 'place de parc', 'stationnement'])
})()

const AMT_LABEL = (n: number): string => (n >= 1e6 ? String(Math.round(n / 1e5) / 10).replace('.', ',') + 'M' : Math.round(n / 1e3) + 'k')

/** parse un montant depuis une chaîne (déjà normalisée idéalement) :
 *  « 1.5m »→1500000, « 800k »→800000, « 1'200'000 »/« 1 200 000 »→1200000. */
export function parseAmount(raw: string): number | null {
  const s = norm(raw).replace(/chf|francs?|fr\b/g, '').trim()
  const suf = s.match(/^([\d]+(?:[.,]\d+)?)\s*(mios?|millions?|m|milliers?|mille|k)$/)
  if (suf) {
    const n = parseFloat(suf[1].replace(',', '.'))
    if (Number.isNaN(n)) return null
    return Math.round(n * (/^m/.test(suf[2]) ? 1e6 : 1e3))
  }
  const digits = s.replace(/[’'.\s]/g, '')
  if (/^\d{4,}$/.test(digits)) return parseInt(digits, 10)
  return null
}

// fragments de nombre pour les regex budget (sur chaîne normalisée)
const NUM = "(\\d+(?:[.,]\\d+)?\\s*(?:mios?|millions?|m|milliers?|mille|k)|(?:chf\\s*)?\\d{1,3}(?:[’'\\s.]\\d{3})+|\\d{4,})"

/**
 * Parse une saisie libre en jetons typés. Extrait budget (fourchette / plafond /
 * plancher), surface, pièces, puis reconnaît cantons / villes / types mot à mot ;
 * le reste devient un jeton texte (rue, référence, mot-clé, feature).
 */
export function parseQuery(raw: string): OmniToken[] {
  const out: OmniToken[] = []
  const has = (f: OmniField, v: string | number) => out.some((o) => o.field === f && String(o.value) === String(v))
  const push = (t: OmniToken) => { if (!has(t.field, t.value)) out.push(t) }
  if (!raw.trim()) return out

  // 0) Codes canton en MAJUSCULES ("GE","VD"…) sur le brut (sensible à la casse), puis retirés.
  const work = raw.replace(CODE_RE, (m) => { push({ field: 'canton', value: m, label: CANTON_LABEL[m] ?? m }); return ' ' })
  let s = norm(work)
  if (!s) return out

  // 1) Fourchette budget : « entre X et Y », « de X à Y », « X - Y »
  const rangeRe = new RegExp(`(?:entre|de)\\s+${NUM}\\s+(?:et|a|jusqu.?a)\\s+${NUM}`, 'i')
  const rg = s.match(rangeRe)
  if (rg) {
    const lo = parseAmount(rg[1]); const hi = parseAmount(rg[2])
    if (lo && hi) {
      push({ field: 'budgetMin', value: Math.min(lo, hi), label: '≥ ' + AMT_LABEL(Math.min(lo, hi)) })
      push({ field: 'budgetMax', value: Math.max(lo, hi), label: '≤ ' + AMT_LABEL(Math.max(lo, hi)) })
      s = s.replace(rg[0], ' ')
    }
  }
  // 2) Plafond : « sous / max / moins de / jusqu'à / <= X »
  const maxRe = new RegExp(`(?:sous|moins de|max\\.?|maximum|jusqu.?a|budget|<=?|≤)\\s*${NUM}`, 'i')
  const mx = s.match(maxRe)
  if (mx) { const n = parseAmount(mx[1]); if (n) { push({ field: 'budgetMax', value: n, label: '≤ ' + AMT_LABEL(n) }); s = s.replace(mx[0], ' ') } }
  // 3) Plancher : « dès / à partir de / min / plus de / >= X »
  const minRe = new RegExp(`(?:des|a partir de|min\\.?|minimum|plus de|>=?|≥)\\s*${NUM}`, 'i')
  const mn = s.match(minRe)
  if (mn) { const n = parseAmount(mn[1]); if (n) { push({ field: 'budgetMin', value: n, label: '≥ ' + AMT_LABEL(n) }); s = s.replace(mn[0], ' ') } }

  // 4) Surface : « N m2 / m² »
  const sf = s.match(/(\d{2,4})\s*(?:m2|m²|metres? carr)/i)
  if (sf) { const n = parseInt(sf[1], 10); if (n >= 10 && n <= 5000) { push({ field: 'surface', value: n, label: '≥ ' + n + ' m²' }); s = s.replace(sf[0], ' ') } }

  // 5) Pièces : « N pièces / N.5 p / Npce »
  const rm = s.match(/(\d{1,2}(?:[.,]5)?)\s*(?:pieces?|pces?|pce|p\b)/i)
  if (rm) { const n = parseFloat(rm[1].replace(',', '.')); if (n >= 1 && n <= 20) { push({ field: 'rooms', value: n, label: n + ' pièces' }); s = s.replace(rm[0], ' ') } }

  // 6) Budget « nu » restant (nombre avec M/k, sans opérateur) → plafond par défaut
  if (!out.some((o) => o.field === 'budgetMax' || o.field === 'budgetMin')) {
    const bare = s.match(/(?:chf\s*)?\d+(?:[.,]\d+)?\s*(?:mios?|millions?|m|k)\b/i)
    if (bare) { const n = parseAmount(bare[0]); if (n && n >= 10000) { push({ field: 'budgetMax', value: n, label: '≤ ' + AMT_LABEL(n) }); s = s.replace(bare[0], ' ') } }
  }

  // 7) Mots restants : canton (nom) → ville → type ; reste → texte
  const normWords = s.split(/[\s,]+/).filter(Boolean)
  const residual: string[] = []
  for (let k = 0; k < normWords.length; k++) {
    // essaie la plus longue expression (jusqu'à 4 mots) pour les lieux composés
    let matched = false
    for (let len = Math.min(4, normWords.length - k); len >= 1; len--) {
      const phrase = normWords.slice(k, k + len).join(' ')
      const cantonCode = CANTON_NAME_TO_CODE[phrase]
      if (cantonCode) { push({ field: 'canton', value: cantonCode, label: CANTON_LABEL[cantonCode] ?? cantonCode }); k += len - 1; matched = true; break }
      const cityCode = CITY_TO_CANTON[phrase]
      if (cityCode) {
        push({ field: 'canton', value: cityCode, label: CANTON_LABEL[cityCode] ?? cityCode })
        push({ field: 'text', value: phrase, label: titleCase(phrase) })
        k += len - 1; matched = true; break
      }
    }
    if (matched) continue
    const w = normWords[k]
    const ty = TYPE_ALIASES[w]
    if (ty) {
      push({ field: 'type', value: ty.enum, label: ty.label })
      if (ty.refine) push({ field: 'text', value: ty.refine, label: titleCase(ty.refine) })
      continue
    }
    residual.push(w)
  }

  const rest = residual.join(' ').trim()
  if (rest.length >= 2) push({ field: 'text', value: rest, label: titleCase(rest) })
  return out
}
