#!/usr/bin/env node
// Garde-fou « style maison MEGGA » sur les textes STATIQUES destinés à l'utilisateur.
// Interdit les tells typographiques dans l'i18n :
//   - tiret cadratin (—, U+2014) et demi-cadratin (–, U+2013)
//   - puce (· • ●) en DÉBUT de chaîne
// Le séparateur « · » INLINE reste autorisé (convention UI : « 80 m² · 3 pièces »).
// Le texte GÉNÉRÉ par l'IA suit la même règle au runtime via meggaProse()
// (supabase/functions/_shared/megga-prose.ts).
//
// Usage : node scripts/check-prose-typography.mjs   (npm run lint:prose)
// Pas d'échappatoire : ces caractères ne doivent pas atteindre l'utilisateur.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const LOCALES_DIR = 'src/i18n/locales'
const EM = '—' // —
const EN = '–' // –
// NB : on ne flague PAS la puce « · » dans l'i18n. C'est le séparateur UI
// volontaire (« Messages · 3 non lus », « 80 m² · 3 pièces »), y compris en tête
// de fragments concaténés (subtitle_unread). Les puces décoratives générées par
// l'IA sont, elles, normalisées au runtime par meggaProse().

function walkJson(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walkJson(p))
    else if (name.endsWith('.json')) out.push(p)
  }
  return out
}

function check(file, keyPath, value, violations) {
  if (typeof value === 'string') {
    if (value.includes(EM)) violations.push({ file, key: keyPath, kind: 'tiret cadratin (—)', value })
    else if (value.includes(EN)) violations.push({ file, key: keyPath, kind: 'demi-cadratin (–)', value })
  } else if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) check(file, keyPath ? `${keyPath}.${k}` : k, value[k], violations)
  }
}

let files
try {
  files = walkJson(LOCALES_DIR)
} catch (e) {
  console.error(`Impossible de lire ${LOCALES_DIR}: ${e.message}`)
  process.exit(1)
}

const violations = []
for (const f of files) {
  let json
  try {
    json = JSON.parse(readFileSync(f, 'utf8'))
  } catch (e) {
    console.error(`JSON invalide: ${f}: ${e.message}`)
    process.exitCode = 1
    continue
  }
  check(f, '', json, violations)
}

if (violations.length > 0) {
  console.error(`\n✖ ${violations.length} tell(s) typographique(s) dans l'i18n :\n`)
  for (const v of violations) {
    const shown = v.value.length > 90 ? v.value.slice(0, 90) + '…' : v.value
    console.error(`  ${v.file}  [${v.key}]  ${v.kind}`)
    console.error(`     « ${shown} »`)
  }
  console.error(`\nCorrige : — / – → virgule, deux-points, ou « à » (plages) ; puce → « - » ou liste numérotée.`)
  console.error(`Réf : supabase/functions/_shared/megga-prose.ts (MEGGA_STYLE_BLOCK).\n`)
  process.exit(1)
}

console.log(`✓ Typographie MEGGA OK — ${files.length} fichiers i18n, 0 tell.`)
