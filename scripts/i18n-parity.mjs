#!/usr/bin/env node
// MEGGA — Parité des traductions : FR est la référence, EN doit la couvrir.
// -----------------------------------------------------------------------------
// Compare chaque namespace fr/<ns>.json à en/ (et de/, it/), signale :
//   - clés présentes en FR mais MANQUANTES dans une autre langue   (bloquant)
//   - clés ORPHELINES (présentes ailleurs, absentes de FR)         (bloquant)
//   - valeurs IDENTIQUES à FR dans EN (souvent = non traduit)      (avertissement)
//
// Usage :
//   node scripts/i18n-parity.mjs            # strict sur EN, DE et IT
//   node scripts/i18n-parity.mjs --ci       # exit 1 si dérive (gate CI)
//
// DE et IT sont STRICTS depuis le 20.07.2026. Ils étaient « informatifs tant que
// leur retraduction n'est pas planifiée » — et cette tolérance a coûté cher : le
// gate est resté VERT pendant que 224 clés manquaient dans chaque langue, dont
// les 174 du module Matching (tout `pager.*` / `recherche.*` / `atelier.*`) et
// `errorBoundary.*`, si bien que l'écran d'erreur global affichait la clé brute.
// Un gate qui ne couvre pas une langue livrée ne protège pas cette langue.
//
// ⚠ Conséquence assumée : toute clé ajoutée en FR doit l'être dans les 3 langues,
// sinon la CI casse. C'est le prix de la non-régression — ne pas re-assouplir
// sans retirer la langue du bundle (src/i18n/index.ts).

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const LOC = 'src/i18n/locales'
const REF = 'fr'
const args = process.argv.slice(2)
const CI = args.includes('--ci')
// `--all` reste accepté sans effet : c'est désormais le comportement par défaut.
const STRICT_LANGS = ['en', 'de', 'it']
const INFO_LANGS = []

function load(lang, ns) {
  try { return JSON.parse(readFileSync(join(ROOT, LOC, lang, ns), 'utf8')) }
  catch { return null }
}

// Aplati un objet imbriqué en chemins pointés → valeur (string).
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out)
    else out[key] = Array.isArray(v) ? `[array:${v.length}]` : String(v)
  }
  return out
}

const namespaces = readdirSync(join(ROOT, LOC, REF)).filter((f) => f.endsWith('.json'))

let missingTotal = 0
let orphanTotal = 0
let untranslatedTotal = 0
const lines = []

for (const ns of namespaces) {
  const ref = flatten(load(REF, ns))
  const refKeys = Object.keys(ref)

  for (const lang of [...STRICT_LANGS, ...INFO_LANGS]) {
    const strict = STRICT_LANGS.includes(lang)
    const target = flatten(load(lang, ns))
    const tgtKeys = new Set(Object.keys(target))

    const missing = refKeys.filter((k) => !tgtKeys.has(k))
    const orphan = Object.keys(target).filter((k) => !(k in ref))
    const untranslated = refKeys.filter((k) => k in target && target[k] === ref[k] && !/^\[array:/.test(ref[k]))

    if (missing.length || orphan.length || (strict && untranslated.length)) {
      lines.push(`\n\x1b[1m${ns}\x1b[0m  ${REF} → ${lang}${strict ? '' : '  (informatif)'}`)
      if (missing.length) {
        lines.push(`  \x1b[31m✗ ${missing.length} clé(s) manquante(s)\x1b[0m`)
        for (const k of missing.slice(0, 30)) lines.push(`      - ${k}`)
        if (missing.length > 30) lines.push(`      … +${missing.length - 30}`)
        if (strict) missingTotal += missing.length
      }
      if (orphan.length) {
        lines.push(`  \x1b[33m⚠ ${orphan.length} clé(s) orpheline(s) (absente(s) de ${REF})\x1b[0m`)
        for (const k of orphan.slice(0, 15)) lines.push(`      - ${k}`)
        if (orphan.length > 15) lines.push(`      … +${orphan.length - 15}`)
        if (strict) orphanTotal += orphan.length
      }
      if (strict && untranslated.length) {
        lines.push(`  \x1b[2m· ${untranslated.length} valeur(s) identique(s) au FR (peut-être non traduite(s))\x1b[0m`)
        if (strict) untranslatedTotal += untranslated.length
      }
    }
  }
}

if (lines.length) console.log(lines.join('\n'))
else console.log('\x1b[32m✓ Parité OK\x1b[0m')

console.log(`\n──\nFR↔${STRICT_LANGS.join('/')} : ${missingTotal} manquante(s), ${orphanTotal} orpheline(s), ${untranslatedTotal} possiblement non traduite(s)`)

if (CI && (missingTotal > 0 || orphanTotal > 0)) {
  console.error('\n\x1b[31mÉchec parité i18n (gate CI) : corriger les clés manquantes/orphelines FR↔EN.\x1b[0m')
  process.exit(1)
}
