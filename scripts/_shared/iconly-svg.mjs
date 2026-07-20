/**
 * Normalisation des SVG exportés depuis Iconly Pro (style Light) vers des
 * composants React thémables.
 *
 * Utilisé par scripts/iconly-ingest.mjs
 *
 * Deux contraintes dictent tout ce fichier :
 *
 * 1. Le style Light est *stroke-based* (`color_attribute: stroke` côté API).
 *    Les couleurs figées de l'export doivent devenir `currentColor`, sinon les
 *    tokens de thème et le dark mode ne prennent pas. `none` est préservé tel
 *    quel : c'est une valeur sémantique, pas une couleur.
 *
 * 2. Le `viewBox` est repris VERBATIM. Le recalculer ou le normaliser décale la
 *    géométrie et casse l'alignement optique avec lucide-react.
 */

import { createHash } from 'node:crypto'

// ─── Extraction ────────────────────────────────────────────────────────────

/** Isole la balise <svg> racine : ses attributs bruts et son contenu interne. */
export function parseSvg(raw) {
  const open = raw.match(/<svg\b([^>]*)>/i)
  if (!open) throw new Error('aucune balise <svg> trouvée')
  const attrs = open[1]
  const start = open.index + open[0].length
  const end = raw.lastIndexOf('</svg>')
  if (end === -1) throw new Error('balise </svg> fermante manquante')
  return { attrs, inner: raw.slice(start, end) }
}

/** Lit un attribut de la balise racine (guillemets simples ou doubles). */
export function readAttr(attrs, name) {
  const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'))
  return m ? m[1] : null
}

// ─── Normalisation des couleurs ────────────────────────────────────────────

// `none` et `currentColor` sont déjà corrects ; tout le reste est une couleur
// figée à neutraliser. On couvre hex, rgb()/rgba(), hsl() et mots-clés CSS.
const KEEP = /^(none|currentcolor|transparent|inherit)$/i

function themeColors(s) {
  return s.replace(/\b(fill|stroke)\s*=\s*["']([^"']*)["']/gi, (full, attr, value) =>
    KEEP.test(value.trim()) ? full : `${attr}="currentColor"`,
  )
}

// Un `style="fill:#000"` inline échappe au remplacement d'attributs ci-dessus,
// et il gagnerait de toute façon en cascade contre `currentColor`. On ne peut
// pas le laisser tel quel non plus : en JSX `style` attend un objet, pas une
// chaîne. On fait donc remonter fill/stroke en attributs — équivalent au rendu,
// et l'inline l'emporte sur l'attribut existant comme le ferait la cascade.
const TAG = /<([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g

function hoistPaintStyles(s) {
  return s.replace(TAG, (full, tag, attrs, selfClose) => {
    const style = attrs.match(/\bstyle\s*=\s*["']([^"']*)["']/i)
    if (!style) return full

    const paint = {}
    const rest = []
    for (const decl of style[1].split(';')) {
      if (!decl.trim()) continue
      const [prop, ...v] = decl.split(':')
      const key = prop.trim().toLowerCase()
      const value = v.join(':').trim()
      if (key === 'fill' || key === 'stroke') paint[key] = KEEP.test(value) ? value : 'currentColor'
      else rest.push(decl.trim())
    }

    // Une déclaration non-peinture (opacity, transform…) ne peut pas être
    // hissée sans perdre son sens : on préfère un échec visible.
    if (rest.length) {
      throw new Error(`style inline non convertible sur <${tag}> : ${rest.join('; ')}`)
    }

    let out = attrs.replace(/\s*\bstyle\s*=\s*["'][^"']*["']/i, '')
    for (const [key, value] of Object.entries(paint)) {
      const existing = new RegExp(`\\s*\\b${key}\\s*=\\s*["'][^"']*["']`, 'i')
      out = out.replace(existing, '') // l'inline prime sur l'attribut
      out += ` ${key}="${value}"`
    }
    return `<${tag}${out}${selfClose}>`
  })
}

// ─── Nettoyage ─────────────────────────────────────────────────────────────

// Iconly répète `stroke-width` et `stroke-linecap` sur CHAQUE tracé. Laissés en
// place, ils écrasent les valeurs de la racine : la prop `strokeWidth` du
// composant serait sans effet, et un `stroke-linecap` imposé à la racine
// changerait le dessin des icônes qui ne le précisent pas. On les fait donc
// remonter — un attribut de peinture SVG s'hérite, le rendu est identique.
const HOISTABLE = ['stroke-width', 'stroke-linecap', 'stroke-linejoin']

function hoistUniformPaint(s) {
  const hoisted = {}
  let body = s

  for (const attr of HOISTABLE) {
    const re = new RegExp(`\\s${attr}\\s*=\\s*["']([^"']*)["']`, 'gi')
    const values = [...body.matchAll(re)].map((m) => m[1].trim())
    if (!values.length) continue

    // Valeurs divergentes : chaque élément garde la sienne, rien à hisser.
    if (new Set(values).size > 1) continue

    hoisted[attr] = values[0]
    body = body.replace(re, '')
  }

  return { body, hoisted }
}

// React accepte les attributs SVG en tiret, mais le reste du dépôt est en JSX
// camelCase — on aligne pour que les composants générés se lisent comme du code
// écrit à la main.
const CAMEL = /\s([a-z]+(?:-[a-z]+)+)\s*=\s*(["'][^"']*["'])/gi

function toCamelAttrs(s) {
  return s.replace(CAMEL, (full, name, value) => {
    // `data-*` et `aria-*` gardent leur forme en tiret, c'est la convention JSX.
    if (/^(data|aria)-/i.test(name)) return full
    const camel = name.replace(/-([a-z])/gi, (_, c) => c.toUpperCase())
    return ` ${camel}=${value}`
  })
}

function stripNoise(s) {
  return s
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<desc\b[^>]*>[\s\S]*?<\/desc>/gi, '')
    .replace(/\s+xmlns(:\w+)?\s*=\s*["'][^"']*["']/gi, '') // valide sur la racine seule
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// ─── API publique ──────────────────────────────────────────────────────────

/**
 * Transforme un SVG Iconly brut en fragment prêt à injecter dans un composant.
 * Retourne le viewBox d'origine, le contenu interne normalisé, et une empreinte
 * de contenu servant à dédupliquer (le catalogue Iconly réutilise massivement
 * les mêmes noms : ~50 icônes distinctes s'appellent toutes « Home »).
 */
export function normalizeIcon(raw) {
  const { attrs, inner } = parseSvg(raw)

  const viewBox = readAttr(attrs, 'viewBox')
  if (!viewBox) throw new Error('viewBox absent — géométrie non reconstructible')

  const themed = themeColors(hoistPaintStyles(inner))
  const { body: hoistedBody, hoisted } = hoistUniformPaint(themed)
  const body = stripNoise(toCamelAttrs(hoistedBody))
  if (!body) throw new Error('SVG vide après nettoyage')

  // Les valeurs hissées deviennent les défauts de la racine ; à défaut, celles
  // portées par le <svg> d'origine. Rien n'est inventé : si la source ne dit
  // rien, le composant ne force rien.
  const width = hoisted['stroke-width'] ?? readAttr(attrs, 'stroke-width')

  return {
    viewBox,
    body,
    strokeWidth: width ? Number(width) : null,
    linecap: hoisted['stroke-linecap'] ?? readAttr(attrs, 'stroke-linecap'),
    linejoin: hoisted['stroke-linejoin'] ?? readAttr(attrs, 'stroke-linejoin'),
    hash: createHash('sha1').update(`${viewBox}|${body}`).digest('hex').slice(0, 12),
  }
}

/**
 * Dérive un identifiant de composant PascalCase depuis un nom de fichier Iconly.
 *
 * L'export en lot nomme les fichiers `Iconly-<Nom>-<horodatage ms>.svg` :
 * l'horodatage désambiguïse les homonymes (« Building office » sort 8 fois) mais
 * n'a aucun sens comme identifiant. On le retire — les vrais doublons de nom
 * sont ensuite départagés par le suffixe incrémental de l'ingestion.
 *
 * Les noms d'export contiennent aussi espaces, tirets et suffixes numériques
 * légitimes (« Home Search 2.svg ») ; un préfixe est ajouté si le résultat
 * commence par un chiffre, qui serait un identifiant JS invalide.
 */
export function toComponentName(fileName) {
  const base = fileName
    .replace(/\.svg$/i, '')
    .replace(/^Iconly[-_\s]+/i, '')
    .replace(/[-_\s]+\d{13}$/, '') // horodatage ms de l'export en lot
  const pascal = base
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')
  return /^[0-9]/.test(pascal) ? `Icon${pascal}` : pascal
}
