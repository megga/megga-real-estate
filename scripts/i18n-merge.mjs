#!/usr/bin/env node
// MEGGA — Fusion de clés i18n dans les 4 locales (outil de Phase 2, réutilisable).
// -----------------------------------------------------------------------------
// Lit un fichier JSON = tableau de { key, fr, en } où `key` = "namespace:chemin.pointé".
// Deep-merge NON destructif dans fr/en/de/it. Contrat v1 : FR=fr, EN=en,
// DE/IT = repli EN (graceful, aucune clé brute affichée). Idempotent.
//
// Usage : node scripts/i18n-merge.mjs <cles.json> [--dry]
//   --dry : n'écrit rien, rapporte seulement (collisions, compteurs).

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const LOC = join(ROOT, 'src/i18n/locales')

// Namespaces connus (= fichiers fr/*.json). Sert à résoudre une clé dont le
// séparateur ns est un POINT au lieu de deux-points (ex. agent qui renvoie
// "pipeline.board.x" au lieu de "pipeline:board.x") — sinon elle atterrirait à
// tort dans common.json. Robustesse anti-régression (incident vague Pipeline).
const KNOWN_NS = new Set(readdirSync(join(LOC, 'fr')).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', '')))

function resolveNs(key) {
  if (key.includes(':')) { const i = key.indexOf(':'); return [key.slice(0, i), key.slice(i + 1)] }
  const dot = key.indexOf('.')
  if (dot > 0) { const head = key.slice(0, dot); if (KNOWN_NS.has(head)) return [head, key.slice(dot + 1)] }
  return ['common', key]
}
const args = process.argv.slice(2)
const DRY = args.includes('--dry')
const file = args.find((a) => !a.startsWith('--'))
if (!file) { console.error('usage: node scripts/i18n-merge.mjs <cles.json> [--dry]'); process.exit(1) }

const ALL = JSON.parse(readFileSync(file, 'utf8'))
if (!Array.isArray(ALL)) { console.error('le fichier doit être un tableau de { key, fr, en }'); process.exit(1) }

function setPath(obj, path, value) {
  const parts = path.split('.')
  let o = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof o[parts[i]] !== 'object' || o[parts[i]] === null) o[parts[i]] = {}
    o = o[parts[i]]
  }
  const leaf = parts[parts.length - 1]
  const existed = leaf in o && typeof o[leaf] !== 'object'
  o[leaf] = value
  return existed
}

const byNs = {}
for (const e of ALL) {
  if (!e.key || e.fr == null || e.en == null) { console.error('entrée invalide:', JSON.stringify(e)); process.exit(1) }
  const [ns, path] = resolveNs(e.key)
  ;(byNs[ns] ||= []).push({ path, fr: e.fr, en: e.en })
}

const pick = { fr: (e) => e.fr, en: (e) => e.en, de: (e) => e.en, it: (e) => e.en }
const collisions = []
let written = 0

for (const ns of Object.keys(byNs)) {
  for (const lang of Object.keys(pick)) {
    const f = join(LOC, lang, `${ns}.json`)
    let data
    try { data = JSON.parse(readFileSync(f, 'utf8')) }
    catch { console.error(`introuvable/illisible: ${lang}/${ns}.json — namespace inconnu ?`); process.exit(1) }
    for (const e of byNs[ns]) {
      const existed = setPath(data, e.path, pick[lang](e))
      if (existed && lang === 'fr') collisions.push(`${ns}:${e.path}`)
    }
    if (!DRY) { writeFileSync(f, JSON.stringify(data, null, 2) + '\n'); written++ }
  }
}

console.log(`${ALL.length} clé(s) · namespaces : ${Object.keys(byNs).join(', ')}${DRY ? ' · DRY-RUN' : ` · ${written} fichier(s) écrit(s)`}`)
if (collisions.length) {
  console.log(`⚠ ${collisions.length} clé(s) FR déjà existante(s) (écrasées) :`)
  for (const c of [...new Set(collisions)]) console.log('   ' + c)
} else {
  console.log('Aucune collision avec des clés FR existantes.')
}
