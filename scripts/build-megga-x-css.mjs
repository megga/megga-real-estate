// Génère src/styles/megga-x.generated.css : la feuille la vitrine MEGGA (BRIX) scopée
// VERBATIM sous `.megga-x`, pour le design system MEGGA X.
//
// Règle n°1 (fidélité totale) : on ne change AUCUNE valeur. On se contente de :
//   - préfixer chaque sélecteur par `.megga-x` (cohabite avec Sugar) ;
//   - mapper :root / html / body → `.megga-x` (sinon les tokens + base seraient
//     perdus) ;
//   - laisser @font-face et @keyframes intacts ;
//   - réécrire les url('../fonts/…') → '/megga-x/fonts/…' (polices copiées dans
//     public/megga-x/fonts).
//
// Source : sites/megga-vitrine/css/styles.css (template la vitrine MEGGA).
// Lancer : node scripts/build-megga-x-css.mjs

import { readFileSync, writeFileSync } from 'node:fs'
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
  if (DROP.has(rule.selector.trim())) {
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

const header = `/* ============================================================================
 * MEGGA X — feuille GÉNÉRÉE (ne pas éditer à la main).
 * Transcription VERBATIM de la vitrine MEGGA (sites/megga-vitrine/css/styles.css),
 * scopée sous .megga-x. Régénérer : node scripts/build-megga-x-css.mjs
 * Police Inter Tight chargée séparément (voir megga-x.css).
 * ========================================================================== */
`
writeFileSync(OUT, header + rootNode.toString(), 'utf8')
console.log(
  `[megga-x] ${ruleCount} règles scopées, ${dropped} règles html/body retirées, ${fontFixes} chemins de police corrigés → ${OUT}`,
)
