#!/usr/bin/env node
// Garde-fou : toute migration doit être REJOUABLE sans erreur.
//
// Pourquoi : `deploy.yml` ne rejoue pas « les nouvelles migrations », il rejoue
// toute migration dont l'horodatage est >= TODAY (UTC) :
//     stamp="${base%%_*}" ; if [ "$stamp" -ge "$TODAY" ]; then …
// Une migration mergée le jour de sa propre date est donc ré-appliquée à CHAQUE
// push de la journée. Si elle n'est pas idempotente, le 2e passage échoue et
// BLOQUE le déploiement des edge functions pour toute la journée — avec une
// signature trompeuse : c'est la PR suivante, souvent sans rapport, qui « casse »
// le déploiement. C'est arrivé le 19 juil. 2026 (#889 → détecté sur #893,
// corrigé par #894 : « policy agent_profiles_select_own already exists », 42710).
//
// Règle : un CREATE est accepté s'il est gardé par AU MOINS UN de ces moyens —
//   1. CREATE … IF NOT EXISTS
//   2. CREATE OR REPLACE (FUNCTION, VIEW, TRIGGER…)
//   3. un DROP <même objet> IF EXISTS quelque part avant dans le fichier
//   4. être à l'intérieur d'un bloc dollar-quoté ($$ … $$ / DO $$ … $$),
//      où l'idempotence se gère en PL/pgSQL (EXCEPTION WHEN duplicate_object…)
//
// Usage :
//   node scripts/check-migration-idempotence.mjs            → check (exit 1 si faute)
//   node scripts/check-migration-idempotence.mjs <fichier…> → check ciblé
import { readdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const DIR = 'supabase/migrations';

// Exceptions HISTORIQUES, figées. Leur horodatage est dans le passé, donc le
// date-guard de deploy.yml ne les rejouera JAMAIS (stamp >= TODAY est faux pour
// toujours). Les corriger serait du bruit sans bénéfice ; les rejouer à la main
// n'est pas un scénario supporté. Cette liste ne doit pas grandir : une NOUVELLE
// migration doit être rejouable, point.
const GRANDFATHERED = new Set([
  '00000000000000_baseline_remote_schema.sql', // dump de schéma initial
  '20260526130000_restore_missing_tables.sql',
  '20260618210000_market_rent_stats.sql',
]);

const KINDS = 'POLICY|INDEX|TABLE|TRIGGER|TYPE|VIEW|SCHEMA|EXTENSION|SEQUENCE|FUNCTION|MATERIALIZED VIEW';
const CREATE_RE = new RegExp(
  String.raw`\bCREATE\s+(OR\s+REPLACE\s+)?(?:UNIQUE\s+)?(${KINDS})\b(\s+IF\s+NOT\s+EXISTS)?\s+([A-Za-z0-9_."]+)`,
  'gi',
);
const DROP_RE = new RegExp(
  String.raw`\bDROP\s+(?:${KINDS})\s+IF\s+EXISTS\s+([A-Za-z0-9_."]+)`,
  'gi',
);

/** Remplace par des espaces (pour préserver les offsets) les commentaires et les
 *  corps dollar-quotés — un CREATE dans un corps de fonction n'est pas exécuté au
 *  niveau du fichier, et un bloc DO gère son idempotence lui-même. */
function blankNonExecutable(sql) {
  const out = sql.split('');
  const blank = (from, to) => {
    for (let i = from; i < to && i < out.length; i++) if (out[i] !== '\n') out[i] = ' ';
  };
  // Corps dollar-quotés : $$ … $$ ou $tag$ … $tag$
  const dollar = /\$([A-Za-z0-9_]*)\$/g;
  let m;
  while ((m = dollar.exec(sql)) !== null) {
    const close = sql.indexOf(m[0], m.index + m[0].length);
    if (close === -1) break;
    blank(m.index, close + m[0].length);
    dollar.lastIndex = close + m[0].length;
  }
  const blanked = out.join('');
  // Commentaires (après le blanking dollar : un -- dans un corps est déjà neutralisé)
  return blanked
    .replace(/\/\*[\s\S]*?\*\//g, (s) => s.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((l) => l.replace(/--.*$/, (s) => ' '.repeat(s.length)))
    .join('\n');
}

const normalize = (name) => name.replace(/"/g, '').toLowerCase();
const lineOf = (sql, index) => sql.slice(0, index).split('\n').length;

function checkFile(path) {
  const raw = readFileSync(path, 'utf8');
  const sql = blankNonExecutable(raw);

  const dropped = new Set();
  for (const d of sql.matchAll(DROP_RE)) dropped.add(normalize(d[1]));

  const faults = [];
  for (const c of sql.matchAll(CREATE_RE)) {
    const [, orReplace, kind, ifNotExists, name] = c;
    if (orReplace || ifNotExists) continue;
    if (dropped.has(normalize(name))) continue;
    faults.push({ line: lineOf(sql, c.index), kind: kind.toUpperCase(), name });
  }
  return faults;
}

const args = process.argv.slice(2);
const files = args.length
  ? args
  : readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort().map((f) => join(DIR, f));

let failed = 0;
for (const f of files) {
  if (GRANDFATHERED.has(basename(f))) continue;
  const faults = checkFile(f);
  if (!faults.length) continue;
  failed += faults.length;
  console.error(`\n✗ ${f} — non rejouable :`);
  for (const { line, kind, name } of faults) {
    console.error(`    ligne ${line} : CREATE ${kind} ${name}`);
  }
}

if (failed) {
  console.error(`\n${failed} instruction(s) casseraient au rejeu du déploiement.`);
  console.error('Garde chacune par UN de ces moyens :');
  console.error('  • CREATE … IF NOT EXISTS');
  console.error('  • CREATE OR REPLACE (function, vue, trigger)');
  console.error('  • un DROP <objet> IF EXISTS avant le CREATE  ← idiome du repo');
  console.error('\nPourquoi : deploy.yml rejoue toute migration dont le stamp est >= TODAY (UTC),');
  console.error('donc une migration mergée le jour de sa date est ré-appliquée à chaque push.');
  process.exit(1);
}

const checked = files.filter((f) => !GRANDFATHERED.has(basename(f))).length;
console.log(`✓ Migrations rejouables (${checked} vérifiées, ${GRANDFATHERED.size} historiques exclues).`);
