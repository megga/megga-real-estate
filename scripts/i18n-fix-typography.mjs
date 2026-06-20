#!/usr/bin/env node
// Autofix compagnon de `lint:prose` (check-prose-typography.mjs).
// Normalise les SEULS caractères interdits (tiret cadratin —, demi-cadratin –)
// dans les valeurs i18n, vers le style maison MEGGA — exactement comme
// meggaProse() (supabase/functions/_shared/megga-prose.ts) au runtime sur la
// prose IA :
//   tiret au milieu d'une phrase  → virgule       « Closing proche — KYC » → « Closing proche, KYC »
//   tiret en début de fragment    → « - »          « — {{criteria}} »      → « - {{criteria}} »
//
// Deux cas propres à l'i18n statique :
//   placeholder encadré « — X — »  → « X »         « — Aucun — »            → « Aucun »
//   plage (interpolations/chiffres) → trait d'union « {{a}} – {{b}} »        → « {{a}} - {{b}} »
//
// Garde-fou : on NE TOUCHE JAMAIS au séparateur « · » (puce U+00B7), volontaire
// en interface y compris en tête de fragment concaténé (« · en attente »), ni
// aux lignes vides, à l'ordre des clés ou au formatage. Traitement LIGNE PAR
// LIGNE : seules les lignes contenant — ou – sont réécrites, le reste est
// recopié à l'octet près. Idempotent.
//
// Usage : node scripts/i18n-fix-typography.mjs [--dry]   (npm run i18n:prose:fix)

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const LOCALES_DIR = 'src/i18n/locales'
const DRY = process.argv.includes('--dry')

// Normalise le CONTENU d'une valeur (chaîne déjà extraite, mono-ligne).
function normalize(s) {
  let out = s
  // 1. Placeholder encadré « — X — » (états vides, options « aucun ») → « X ».
  out = out.replace(/^\s*[—–]\s+(.*?)\s+[—–]\s*$/u, '$1')
  // 2. Plage entre deux interpolations ou deux nombres → trait d'union (suisse),
  //    AVANT la règle générale (sinon « — » deviendrait une virgule).
  out = out.replace(/(\}\})\s*[—–]\s*(\{\{)/g, '$1 - $2')
  out = out.replace(/(\d)\s*[—–]\s*(\d)/g, '$1-$2')
  // 3. Tiret en début de fragment → « - » (séparateur de tête, ex. « — {{criteria}} »).
  //    (On ne traite PAS « · » : c'est un séparateur d'interface volontaire.)
  out = out.replace(/^([ \t]*)[—–][ \t]+/u, '$1- ')
  // 4. Tiret cadratin/demi-cadratin au milieu (espacé ou collé) → virgule (meggaProse).
  out = out.replace(/\s+[—–]\s+/g, ', ')
  out = out.replace(/[—–]/g, ', ')
  // 5. Hygiène (miroir meggaProse). On ne touche qu'à la virgule : la ponctuation
  //    haute française (; : ! ?) garde son espace insécable éventuel.
  out = out.replace(/ +,/g, ',')
  out = out.replace(/,\s*\./g, '.')
  out = out.replace(/(,\s*){2,}/g, ', ')
  out = out.replace(/(?<=\S)[ \t]{2,}/g, ' ')
  out = out.replace(/[ \t]+$/g, '')
  return out
}

// Réécrit une ligne JSON en ne normalisant que la valeur chaîne. Les clés ne
// contiennent jamais de tiret long, mais on isole tout de même la valeur pour
// ne pas risquer d'y toucher.
function fixLine(line) {
  if (!line.includes('—') && !line.includes('–')) return line
  // `  "clé": "valeur"[,]`
  let m = line.match(/^(\s*"(?:[^"\\]|\\.)*":\s*)"((?:[^"\\]|\\.)*)"(,?\s*)$/)
  if (m) return m[1] + '"' + normalize(m[2]) + '"' + m[3]
  // élément de tableau / chaîne nue : `  "valeur"[,]`
  m = line.match(/^(\s*)"((?:[^"\\]|\\.)*)"(,?\s*)$/)
  if (m) return m[1] + '"' + normalize(m[2]) + '"' + m[3]
  return line
}

function walkJson(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walkJson(p))
    else if (name.endsWith('.json')) out.push(p)
  }
  return out
}

const files = walkJson(LOCALES_DIR)
let changed = 0
for (const f of files) {
  const before = readFileSync(f, 'utf8')
  const after = before.split('\n').map(fixLine).join('\n')
  if (after !== before) {
    JSON.parse(after) // garde-fou : ne jamais écrire un JSON cassé
    changed++
    if (!DRY) writeFileSync(f, after)
    console.log(`${DRY ? '(dry) ' : ''}✎ ${f}`)
  }
}
console.log(`\n${DRY ? 'À corriger' : 'Corrigé'} : ${changed}/${files.length} fichier(s).`)
