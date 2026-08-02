#!/usr/bin/env node
// MEGGA — Couverture de traduction DE/IT : mesure ce que la parité NE VOIT PAS.
// -----------------------------------------------------------------------------
// `i18n-parity.mjs` vérifie la PRÉSENCE des clés. Une clé présente mais recopiée
// telle quelle depuis l'anglais passe son contrôle : au 02.08.2026, 59 % du DE
// était mot pour mot l'EN sans qu'aucun signal ne le dise.
//
// ⚠ POURQUOI ON COMPARE À L'EN, JAMAIS AU FR — c'est l'erreur qui a masqué le
// problème pendant des mois. L'avertissement « possiblement non traduite » de
// i18n-parity compare DE↔FR : il prouve seulement que la chaîne n'est pas du
// français, ce qu'un copier-coller de l'anglais satisfait parfaitement. Les
// locales DE/IT ont été amorcées depuis l'EN ; c'est donc à l'EN qu'il faut les
// confronter pour voir ce qui n'a jamais été traduit.
//
// Deux chiffres, parce qu'un seul mentirait :
//   - « = EN »       : identique à l'anglais (brut).
//   - « non traduit » : identique à l'anglais ET différent du français. Une
//     chaîne identique dans les trois langues est presque toujours un token
//     universel légitime (« Email », « Pro », « WhatsApp ») ; l'exclure évite
//     de gonfler la dette d'environ 560 fausses entrées.
//
// Usage :
//   node scripts/i18n-coverage.mjs             # rapport
//   node scripts/i18n-coverage.mjs --ci        # échoue si la dette AUGMENTE
//   node scripts/i18n-coverage.mjs --update    # fige la référence courante
//
// Le mode --ci est un CLIQUET, pas un seuil : la référence vaut l'état du jour,
// donc il est vert à l'installation et ne rougit que si une régression ajoute de
// l'anglais non traduit. Traduire fait baisser le compteur sans rien casser ;
// penser à `--update` après un lot pour verrouiller le gain.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const LOC = 'src/i18n/locales'
const BASELINE = 'scripts/_data/i18n-coverage.baseline.json'
const REF = 'fr'
const SOURCE = 'en'
const LANGS = ['de', 'it']

const args = process.argv.slice(2)
const CI = args.includes('--ci')
const UPDATE = args.includes('--update')

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

/** Compte, par langue et par namespace, les chaînes restées en anglais. */
function measure() {
  const out = {}
  for (const lang of LANGS) {
    out[lang] = {}
    for (const ns of namespaces) {
      const fr = flatten(load(REF, ns))
      const en = flatten(load(SOURCE, ns))
      const tgt = flatten(load(lang, ns))
      let total = 0, sameAsEn = 0, untranslated = 0
      for (const [k, enVal] of Object.entries(en)) {
        if (/^\[array:/.test(enVal)) continue   // les tableaux ne se comparent pas utilement
        total++
        if (tgt[k] !== enVal) continue
        sameAsEn++
        if (fr[k] !== enVal) untranslated++      // FR distinct ⇒ ce n'est pas un token universel
      }
      out[lang][ns.replace('.json', '')] = { total, sameAsEn, untranslated }
    }
  }
  return out
}

const now = measure()

if (UPDATE) {
  writeFileSync(join(ROOT, BASELINE), JSON.stringify(now, null, 2) + '\n')
  console.log(`\x1b[32m✓ Référence mise à jour\x1b[0m → ${BASELINE}`)
  process.exit(0)
}

let base = null
try { base = JSON.parse(readFileSync(join(ROOT, BASELINE), 'utf8')) } catch { /* première exécution */ }

const regressions = []

for (const lang of LANGS) {
  const rows = Object.entries(now[lang])
    .map(([ns, m]) => [ns, m])
    .filter(([, m]) => m.total > 0)
    .sort((a, b) => b[1].untranslated - a[1].untranslated)

  const tot = rows.reduce((s, [, m]) => s + m.total, 0)
  const unt = rows.reduce((s, [, m]) => s + m.untranslated, 0)
  const raw = rows.reduce((s, [, m]) => s + m.sameAsEn, 0)
  const pct = tot ? Math.round((100 * unt) / tot) : 0

  console.log(`\n\x1b[1m${lang.toUpperCase()}\x1b[0m  ${unt}/${tot} non traduit \x1b[1m${pct}%\x1b[0m  (${raw} identiques à l'EN, dont ${raw - unt} tokens universels)`)
  for (const [ns, m] of rows) {
    if (!m.untranslated) continue
    const p = Math.round((100 * m.untranslated) / m.total)
    const prev = base?.[lang]?.[ns]?.untranslated
    let delta = ''
    if (prev !== undefined && prev !== m.untranslated) {
      const d = m.untranslated - prev
      delta = d > 0 ? `  \x1b[31m+${d}\x1b[0m` : `  \x1b[32m${d}\x1b[0m`
      if (d > 0) regressions.push(`${lang}/${ns} : ${prev} → ${m.untranslated} (+${d})`)
    }
    console.log(`  ${ns.padEnd(12)} ${String(m.untranslated).padStart(4)}/${String(m.total).padStart(4)}  ${String(p).padStart(3)}%${delta}`)
  }
}

if (!base) {
  console.log(`\n\x1b[33m⚠ Aucune référence (${BASELINE}). Lancer \`npm run i18n:coverage:update\` pour la figer.\x1b[0m`)
  process.exit(0)
}

if (regressions.length) {
  console.error(`\n\x1b[31m✗ Régression de traduction : de l'anglais non traduit a été ajouté.\x1b[0m`)
  for (const r of regressions) console.error(`    - ${r}`)
  console.error(`\n  Traduire les clés ajoutées, ou \`npm run i18n:coverage:update\` si la hausse est assumée.`)
  if (CI) process.exit(1)
} else {
  console.log(`\n\x1b[32m✓ Aucune régression vs référence\x1b[0m`)
}
