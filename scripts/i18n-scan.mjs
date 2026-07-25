#!/usr/bin/env node
// MEGGA — Scanner i18n : repère les chaînes FR codées en dur dans le CRM.
// -----------------------------------------------------------------------------
// But : CHIFFRER le chantier d'extraction et VÉRIFIER qu'une surface est propre
// (0 chaîne restante) après migration. Heuristique volontairement prudente —
// le garde-fou strict, c'est eslint-plugin-i18next ; ce script sert au reporting.
//
// Usage :
//   node scripts/i18n-scan.mjs                 # scanne les dossiers CRM actifs
//   node scripts/i18n-scan.mjs <glob-dir>...   # scanne des dossiers précis
//   node scripts/i18n-scan.mjs --json          # sortie JSON (machine)
//   node scripts/i18n-scan.mjs --list <dir>    # liste chaque chaîne trouvée
//
// Sortie : tableau par fichier (chaînes restantes) + total, code de sortie 0.
// (Le code de sortie n'échoue pas — c'est un rapport, pas un gate. Le gate
//  bloquant vit dans eslint + i18n-parity.)

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, extname } from 'node:path'

const ROOT = process.cwd()

// Dossiers du CRM agent encore en FR codé en dur (cf. plan i18n Phase 2).
const DEFAULT_DIRS = [
  'src/components/crm-sugar',
  'src/components/crm-sugar-v3',
  'src/components/crm-sugar-wizard',
  'src/pages/agent',
  'src/components/matching-atelier',
  'src/components/calendar',
  'src/components/seller-portal',
  'src/components/kyc-report',
  'src/components/ai-copilot',
  'src/components/chat',
  'src/components/contacts',
  'src/components/listings',
  'src/components/listing',
  'src/components/matching',
  'src/components/transactions',
]

const args = process.argv.slice(2)
const JSON_OUT = args.includes('--json')
const LIST = args.includes('--list')
const dirs = args.filter((a) => !a.startsWith('--'))
const TARGET_DIRS = dirs.length ? dirs : DEFAULT_DIRS

// Caractères qui trahissent du français (accents). On accepte aussi les mots
// sans accent via un dictionnaire court de mots-outils fréquents en UI FR.
const ACCENT = /[éèêëàâäùûüôöîïçœÉÈÊÀÂÙÔÎÇ]/
const FR_WORDS = /\b(le|la|les|un|une|des|du|de|au|aux|et|ou|pour|par|sur|sans|avec|dans|vos|vos|votre|votre|vous|aucun|aucune|tous|toutes|voir|tout|nouveau|nouvelle|ajouter|modifier|supprimer|enregistrer|annuler|rechercher|chargement|aujourd|relance|bien|biens|vendeur|acheteur|mandat|offre|visite|contact|contacts)\b/i

// Attributs JSX porteurs de texte visible.
const TEXT_ATTRS = /\b(placeholder|title|label|aria-label|alt|tooltip|heading|subtitle|message|description|emptyText|cta)\s*=\s*(["'])(.*?)\2/g

// Texte JSX entre balises : >Texte<  (capture grossière, ligne par ligne).
const JSX_TEXT = />\s*([^<>{}\n][^<>{}]*?)\s*</g

// Littéraux de chaîne génériques (pour les .ts de données / maps de labels).
const STRING_LIT = /(["'])((?:[^"'\\]|\\.){2,}?)\1/g

function looksLikeCopy(s) {
  if (!s) return false
  const t = s.trim()
  if (t.length < 2) return false
  // Doit contenir au moins une lettre.
  if (!/[a-zA-ZéèêëàâäùûüôöîïçœÉÈÀ]/.test(t)) return false
  // Rejette le bruit technique courant.
  if (/^[A-Z0-9_]+$/.test(t)) return false                 // CONSTANTES
  if (/^[a-z]+([A-Z][a-z]+)+$/.test(t)) return false        // camelCase identifiers
  if (/^(https?:|\/|\.\/|@\/|#|data:|mailto:)/.test(t)) return false
  if (/^[\w.-]+\.(tsx?|jsx?|json|css|svg|png|jpe?g|webp|woff2?)$/.test(t)) return false
  if (/^[#.][\w-]+$/.test(t)) return false                  // .class / #id
  if (/^\d[\d\s.,%px'rem-]*$/.test(t)) return false         // valeurs numériques/CSS
  if (/^[a-z-]+$/.test(t) && !ACCENT.test(t) && t.length < 14 && !t.includes(' ')) return false // token css/prop
  if (/(rgba?|hsla?)\(|^\s*#?[0-9a-fA-F]{3,8}\s*$/.test(t)) return false
  // Doit ressembler à du FR : accent OU mot-outil FR OU phrase avec espace + lettre minuscule de mot.
  return ACCENT.test(t) || FR_WORDS.test(t) || (/\s/.test(t) && /[a-zàâäéèêëîïôöùûü]/.test(t))
}

function scanFile(abs) {
  const src = readFileSync(abs, 'utf8')
  const lines = src.split('\n')
  const hits = []
  lines.forEach((line, i) => {
    // Ignore les lignes déjà internationalisées ou techniques.
    if (/\bt\(\s*['"]/.test(line)) return
    if (/^\s*(import|export\s+\*|\/\/|\*|\/\*)/.test(line)) return
    if (/className=|style=|\bkey=|\bid=|data-|aria-hidden|stroke|fill=|viewBox|d=|path/.test(line) && !TEXT_ATTRS.test(line)) {
      // continue : on peut encore avoir un attribut texte sur la même ligne
    }
    const found = new Set()
    let m
    TEXT_ATTRS.lastIndex = 0
    while ((m = TEXT_ATTRS.exec(line))) { if (looksLikeCopy(m[3])) found.add(m[3].trim()) }
    JSX_TEXT.lastIndex = 0
    while ((m = JSX_TEXT.exec(line))) { if (looksLikeCopy(m[1])) found.add(m[1].trim()) }
    // Littéraux : seulement si fort signal FR (accent ou mot-outil) pour limiter le bruit.
    STRING_LIT.lastIndex = 0
    while ((m = STRING_LIT.exec(line))) {
      const v = m[2]
      if ((ACCENT.test(v) || FR_WORDS.test(v)) && looksLikeCopy(v)) found.add(v.trim())
    }
    for (const s of found) hits.push({ line: i + 1, text: s })
  })
  return hits
}

function walk(dir) {
  const out = []
  let entries
  try { entries = readdirSync(join(ROOT, dir)) } catch { return out }
  for (const e of entries) {
    const rel = join(dir, e)
    const abs = join(ROOT, rel)
    const st = statSync(abs)
    if (st.isDirectory()) out.push(...walk(rel))
    else if (['.tsx', '.ts'].includes(extname(e)) && !e.endsWith('.d.ts') && !e.endsWith('.test.ts')) out.push(rel)
  }
  return out
}

const report = []
let total = 0
for (const d of TARGET_DIRS) {
  for (const f of walk(d)) {
    const hits = scanFile(join(ROOT, f))
    if (hits.length) { report.push({ file: f, count: hits.length, hits }); total += hits.length }
  }
}
report.sort((a, b) => b.count - a.count)

if (JSON_OUT) {
  console.log(JSON.stringify({ total, files: report.map(({ file, count, hits }) => ({ file, count, hits })) }, null, 2))
} else if (LIST) {
  for (const r of report) {
    console.log(`\n\x1b[1m${r.file}\x1b[0m (${r.count})`)
    for (const h of r.hits) console.log(`  ${String(h.line).padStart(4)}  ${h.text}`)
  }
  console.log(`\n${total} chaîne(s) FR codée(s) en dur · ${report.length} fichier(s)`)
} else {
  for (const r of report) console.log(`${String(r.count).padStart(5)}  ${r.file}`)
  console.log(`\n\x1b[1m${total}\x1b[0m chaîne(s) FR codée(s) en dur · \x1b[1m${report.length}\x1b[0m fichier(s) sur ${TARGET_DIRS.length} dossier(s)`)
}
