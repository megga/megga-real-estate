// Génère src/styles/megga-x.generated.css : la feuille la vitrine MEGGA (BRIX) scopée
// VERBATIM sous `.megga-x`, pour le design system MEGGA X.
//
// Règle n°1 (fidélité totale) : on ne change AUCUNE valeur. On se contente de :
//   - préfixer chaque sélecteur par `.megga-x` (cohabite avec Sugar) ;
//   - mapper :root / html / body → `.megga-x` (sinon les tokens + base seraient
//     perdus) ;
//   - laisser @font-face et @keyframes intacts ;
//   - réécrire les url('../fonts/…') → '/megga-x/fonts/…' (polices copiées dans
//     public/megga-x/fonts) ;
//   - réécrire ET COPIER les url('../images/…') → '/megga-x/images/…'. La règle
//     manquait, et six références pointaient dans le vide : `../images/` est
//     relatif à sites/megga-vitrine/css/, mais depuis src/styles/ il désigne
//     src/images/, qui n'existe pas. Le générateur copie ce qu'il réécrit —
//     sinon une image ajoutée demain repartirait pendante.
//
// Source : sites/megga-vitrine/css/styles.css (template la vitrine MEGGA).
// Lancer : node scripts/build-megga-x-css.mjs

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = resolve(root, 'sites/megga-vitrine/css/styles.css')
const OUT = resolve(root, 'src/styles/megga-x.generated.css')
const SCOPE = '.megga-x'
// :root → .megga-x (les tokens vivent sur le conteneur)
const ROOTLIKE = new Set([':root'])
// html/body/* globaux : retirés (page-level Webflow) — le canvas MEGGA X est
// défini à la main dans megga-x.css. Évite qu'un `body{background:#fff}` écrase
// le fond sombre du style guide.
const DROP = new Set(['html', 'body', 'html body'])

// Le badge « Made in Webflow » : ses règles voyagent avec la feuille alors que le
// badge lui-même n'est dans AUCUNE page du dépôt. Elles ne servent donc rien et
// nomment l'outil dans le CSS livré de app.megga.ch. Retirées par MOTIF (et non
// par sélecteur exact) parce que Webflow les écrit en plusieurs variantes
// (`.w-webflow-badge`, `.w-webflow-badge > img`, …).
const DROP_PATTERN = /w-webflow-badge/

// ⛔ LES BLOCS DE DÉGRADÉ DE LA VITRINE — même argument que le badge ci-dessus, et
// même mesure. `.colors-gradient-top` / `-bottom` (et sa variante `.gradient-card`)
// sont des blocs de PAGE MARKETING : vérifié le 16.08.2026, aucun composant du dépôt
// ne produit ces classes, et sur `/design-system/megga-x` — la seule route qui monte
// `.megga-x` — le navigateur ne demande aucune de leurs images.
//
// ⚠ ON RETIRE LA RÈGLE, PAS SEULEMENT LA COPIE. Ne pas copier l'image en laissant son
// `url()` dans la feuille fabriquerait un lien pendant : invisible tant que personne
// n'écrit la classe, un 404 le jour où quelqu'un l'écrit. Sans règle, la classe
// n'existe pas et la question ne se pose plus.
//
// Ce que ça évite de livrer : 3 PNG pour 757 Ko, recopiés dans `dist/` à chaque build.
const DROP_MARKETING = /colors-gradient-/

// Le fond décoratif de `blockquote`, seul. ⚠ ICI ON NE RETIRE PAS LA RÈGLE : ses
// treize autres déclarations sont de la typographie légitime, et `blockquote` est un
// sélecteur d'ÉLÉMENT — le supprimer déshabillerait toute citation écrite demain.
// Seul son `background-image` (76 Ko) part, avec le cadrage qui n'a plus d'objet.
const IMAGE_DECORATIVE_SEULE = /quote-bg-gradient/


const css = readFileSync(SRC, 'utf8')
const rootNode = postcss.parse(css)

function inKeyframes(rule) {
  let p = rule.parent
  while (p) {
    if (p.type === 'atrule' && /keyframes$/i.test(p.name)) return true
    p = p.parent
  }
  return false
}

const scopeSelectors = selectorParser((selectors) => {
  selectors.each((sel) => {
    const s = sel.toString().trim()
    if (ROOTLIKE.has(s)) {
      sel.removeAll()
      sel.append(selectorParser.className({ value: 'megga-x' }))
      return
    }
    // sinon : préfixe descendant ".megga-x <selecteur d'origine>"
    sel.prepend(selectorParser.combinator({ value: ' ' }))
    sel.prepend(selectorParser.className({ value: 'megga-x' }))
  })
})

let ruleCount = 0
let dropped = 0
rootNode.walkRules((rule) => {
  if (inKeyframes(rule)) return // ne pas toucher 0%/50%/to…
  if (rule.parent && rule.parent.type === 'atrule' && /font-face/i.test(rule.parent.name)) return
  if (DROP.has(rule.selector.trim()) || DROP_PATTERN.test(rule.selector)
      || DROP_MARKETING.test(rule.selector)) {
    rule.remove()
    dropped++
    return
  }
  rule.selector = scopeSelectors.processSync(rule.selector)
  ruleCount++
})

// Chemins de police : ../fonts/ → /megga-x/fonts/
let fontFixes = 0
rootNode.walkDecls((decl) => {
  if (decl.value.includes('../fonts/')) {
    decl.value = decl.value.replace(/\.\.\/fonts\//g, '/megga-x/fonts/')
    fontFixes++
  }
})

// ⛔ LA RÈGLE JUMELLE, QUI MANQUAIT — et son absence n'a pas produit un défaut,
// elle en a produit SIX. La feuille de la vitrine référence ses images en
// `url("../images/…")`, relatif à `sites/megga-vitrine/css/`. Transcrite dans
// `src/styles/`, la même chaîne désigne `src/images/`, qui n'existe pas : le
// navigateur demande, prend un 404, et n'affiche rien. Le symptôme est une
// ABSENCE, c'est pourquoi ça a survécu.
//
// ⚠ ET ON COPIE CE QU'ON RÉÉCRIT. Réécrire seul aurait corrigé les six d'AUJOURD'HUI
// en laissant la porte ouverte : une image ajoutée à la vitrine demain
// repartirait pendante. Copier depuis la source à chaque génération fait
// disparaître la CLASSE, pas l'instance — et une image introuvable À LA SOURCE
// arrête le générateur au lieu de produire une feuille qui a l'air correcte.
const IMG_SRC = resolve(root, 'sites/megga-vitrine/images')
const IMG_OUT = resolve(root, 'public/megga-x/images')
const imagesVues = new Set()
let imgFixes = 0
let decorRetire = 0
rootNode.walkDecls((decl) => {
  if (!decl.value.includes('../images/')) return
  if (IMAGE_DECORATIVE_SEULE.test(decl.value)) {
    // `background-position` / `background-size` deviennent des non-sens sans image :
    // ils ne s'appliquent qu'à elle, jamais à la couleur de fond qui reste.
    const regle = decl.parent
    decl.remove()
    regle.walkDecls(/^background-(position|size)$/, (d) => d.remove())
    decorRetire++
    return
  }
  for (const m of decl.value.matchAll(/\.\.\/images\/([^"')]+)/g)) imagesVues.add(m[1])
  decl.value = decl.value.replace(/\.\.\/images\//g, '/megga-x/images/')
  imgFixes++
})
mkdirSync(IMG_OUT, { recursive: true })
const manquantes = []
for (const nom of [...imagesVues].sort()) {
  const src = resolve(IMG_SRC, nom)
  if (!existsSync(src)) { manquantes.push(nom); continue }
  copyFileSync(src, resolve(IMG_OUT, nom))
}
if (manquantes.length) {
  console.error(`[megga-x] ⛔ ${manquantes.length} image(s) référencée(s) par la feuille et ABSENTE(S) de ${IMG_SRC} :`)
  for (const n of manquantes) console.error(`  ${n}`)
  process.exit(1)
}

const header = `/* ============================================================================
 * MEGGA X — feuille GÉNÉRÉE (ne pas éditer à la main).
 * Transcription VERBATIM de la vitrine MEGGA (sites/megga-vitrine/css/styles.css),
 * scopée sous .megga-x. Régénérer : node scripts/build-megga-x-css.mjs
 * Police Inter Tight chargée séparément (voir megga-x.css).
 * ========================================================================== */
`
writeFileSync(OUT, header + rootNode.toString(), 'utf8')
console.log(
  `[megga-x] ${ruleCount} règles scopées, ${dropped} règles html/body retirées, ${fontFixes} chemins de police + ${imgFixes} chemins d’image corrigés, ${decorRetire} fond décoratif retiré, ${imagesVues.size} image(s) copiée(s) → ${OUT}`,
)
