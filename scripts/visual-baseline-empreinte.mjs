#!/usr/bin/env node
/**
 * Écrit ou vérifie l'empreinte des écrans photographiés par la régression
 * visuelle. Le POURQUOI est dans `scripts/_shared/visual-baseline-empreinte.mjs`.
 *
 *   node scripts/visual-baseline-empreinte.mjs           → compare, sort 1 si écart
 *   node scripts/visual-baseline-empreinte.mjs --write   → écrit (régénération)
 *
 * ⚠ Le `--write` est appelé par `visual-baselines.yml` JUSTE AVANT le commit des
 * captures : l'empreinte et l'image doivent voyager ensemble, sinon la porte
 * reste rouge après une régénération réussie — et on apprend à la contourner.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { CHEMIN_EMPREINTES, empreintesCourantes } from './_shared/visual-baseline-empreinte.mjs'

const ecrire = process.argv.includes('--write')
const courantes = empreintesCourantes()

if (ecrire) {
  writeFileSync(CHEMIN_EMPREINTES, JSON.stringify(courantes, null, 2) + '\n')
  console.log(`✓ empreintes écrites — ${Object.entries(courantes).map(([k, v]) => `${k}=${v}`).join(' ')}`)
  process.exit(0)
}

if (!existsSync(CHEMIN_EMPREINTES)) {
  console.error(`⛔ ${CHEMIN_EMPREINTES} absent — les références ne sont rattachées à aucun écran.`)
  console.error('   Régénérer : /regenerate-visual-baselines en commentaire de PR.')
  process.exit(1)
}

const stockees = JSON.parse(readFileSync(CHEMIN_EMPREINTES, 'utf8'))
const ecarts = Object.entries(courantes).filter(([k, v]) => stockees[k] !== v)
const orphelines = Object.keys(stockees).filter((k) => !(k in courantes))

if (!ecarts.length && !orphelines.length) {
  console.log(`✓ Références à jour — ${Object.keys(courantes).length} écran(s).`)
  process.exit(0)
}

for (const [k, v] of ecarts) {
  console.error(`⛔ ${k} : l'écran a changé depuis la capture (${stockees[k] ?? 'absente'} → ${v}).`)
}
for (const k of orphelines) console.error(`⛔ ${k} : empreinte stockée sans écran correspondant.`)
console.error('\n   La référence ne décrit plus l’écran. Commenter /regenerate-visual-baselines sur la PR.')
process.exit(1)
