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
//   3. un DROP <même objet> IF EXISTS quelque part avant dans le fichier — pour une
//      FUNCTION, de la MÊME SIGNATURE (types d'arguments), ou sans liste d'arguments
//   (cf. `signature` plus bas : `drop function if exists f(a,b,c)` ne garde PAS un
//   `create function f(a,b,c,d)`, qui lève 42723 au second rejeu du jour)
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
/**
 * `ALTER TABLE … ADD COLUMN` SANS `IF NOT EXISTS`.
 *
 * ⚠ TROU MESURÉ le 14.08.2026 sur `20260815190000_contacts_language.sql`. Le contrôle
 * ci-dessus ne lit que les CREATE : une migration qui n'ajoute QUE des colonnes y passait
 * intacte, puis levait 42701 au second rejeu du jour, coupait l'étape (`set -e`) et
 * emportait les migrations suivantes AVEC les Edge Functions. C'est exactement l'incident
 * du 02.08.2026, par une autre porte.
 *
 * Le motif accepte les listes (`ADD COLUMN a …, ADD COLUMN b …`) en cherchant CHAQUE
 * occurrence, pas seulement la première de l'instruction.
 */
const ADD_COLUMN_RE = /\bADD\s+COLUMN\b(?!\s+IF\s+NOT\s+EXISTS)\s+("?[A-Za-z0-9_]+"?)/gi;

const DROP_RE = new RegExp(
  String.raw`\bDROP\s+(${KINDS})\s+IF\s+EXISTS\s+([A-Za-z0-9_."]+)`,
  'gi',
);

/**
 * La liste d'arguments qui suit un nom de fonction (texte entre les parenthèses),
 * ou null s'il n'y en a pas. `index` pointe juste après le nom capturé.
 */
function argumentsApres(sql, index) {
  let i = index;
  while (i < sql.length && /\s/.test(sql[i])) i++;
  if (sql[i] !== '(') return null;
  let profondeur = 0;
  for (let j = i; j < sql.length; j++) {
    if (sql[j] === '(') profondeur++;
    else if (sql[j] === ')' && --profondeur === 0) return sql.slice(i + 1, j);
  }
  return null;
}

const ALIAS_TYPES = new Map([
  ['int', 'integer'], ['int4', 'integer'], ['int8', 'bigint'], ['int2', 'smallint'],
  ['bool', 'boolean'], ['float8', 'double precision'], ['float4', 'real'],
  ['varchar', 'character varying'], ['timestamptz', 'timestamp with time zone'],
  ['timestamp', 'timestamp without time zone'], ['timetz', 'time with time zone'],
]);
const TYPES_A_PLUSIEURS_MOTS = /^(double precision|character varying|timestamp (with|without) time zone|time (with|without) time zone)\b/;
const MODES = new Set(['in', 'out', 'inout', 'variadic']);

/**
 * Signature d'identité d'une liste d'arguments : les TYPES, sans noms, sans
 * valeurs par défaut, sans les paramètres OUT — ce que DROP FUNCTION compare.
 */
function signature(liste) {
  const params = [];
  let profondeur = 0;
  let courant = '';
  for (const c of liste) {
    if (c === '(') profondeur++;
    if (c === ')') profondeur--;
    if (c === ',' && profondeur === 0) { params.push(courant); courant = ''; } else courant += c;
  }
  if (courant.trim()) params.push(courant);
  const types = [];
  for (const brut of params) {
    let p = brut.replace(/\s+(default\b|=).*$/is, '').trim().toLowerCase().replace(/\s+/g, ' ');
    let mots = p.split(' ');
    if (MODES.has(mots[0])) {
      if (mots[0] === 'out') continue;
      mots = mots.slice(1);
      p = mots.join(' ');
    }
    // Un nom précède le type, sauf si le paramètre EST un type de plusieurs mots.
    if (mots.length > 1 && !TYPES_A_PLUSIEURS_MOTS.test(p)) p = mots.slice(1).join(' ');
    p = p.replace(/^public\./, '').replace(/\(.*\)$/, '');
    types.push(ALIAS_TYPES.get(p) ?? p);
  }
  return types.join(',');
}

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
  // Fonctions : `nom(types)` par signature, ou `nom` seul pour un DROP sans liste
  // (Postgres supprime alors l'unique fonction de ce nom, quelle qu'elle soit).
  const droppedFns = new Set();
  for (const d of sql.matchAll(DROP_RE)) {
    const nom = normalize(d[2]);
    if (d[1].toUpperCase() !== 'FUNCTION') { dropped.add(nom); continue; }
    const liste = argumentsApres(sql, d.index + d[0].length);
    droppedFns.add(liste === null ? nom : `${nom}(${signature(liste)})`);
  }

  const faults = [];
  for (const c of sql.matchAll(CREATE_RE)) {
    const [, orReplace, kind, ifNotExists, name] = c;
    if (orReplace || ifNotExists) continue;
    if (kind.toUpperCase() === 'FUNCTION') {
      const nom = normalize(name);
      const liste = argumentsApres(sql, c.index + c[0].length);
      const sig = liste === null ? nom : `${nom}(${signature(liste)})`;
      if (droppedFns.has(nom) || droppedFns.has(sig)) continue;
      faults.push({ line: lineOf(sql, c.index), kind: 'FUNCTION', name: sig });
      continue;
    }
    if (dropped.has(normalize(name))) continue;
    faults.push({ line: lineOf(sql, c.index), kind: kind.toUpperCase(), name });
  }
  for (const a of sql.matchAll(ADD_COLUMN_RE)) {
    faults.push({ line: lineOf(sql, a.index), kind: 'ADD COLUMN', name: a[1] });
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
    const geste = kind === 'ADD COLUMN' ? `ALTER TABLE … ADD COLUMN ${name}` : `CREATE ${kind} ${name}`;
    console.error(`    ligne ${line} : ${geste}`);
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

// ── Unicité des versions ──────────────────────────────────────────────────
//
// Deux fichiers au MÊME horodatage 14 chiffres se comportent différemment selon
// le chemin d'application, et les deux issues sont mauvaises :
//   · sur une base fraîche (CI, `supabase start`), le second casse sur
//     `schema_migrations_pkey` — bruyant, donc bénin ;
//   · au rejeu du jour de deploy.yml, qui applique par l'API Management SANS
//     passer par le tracker, les DEUX s'exécutent dans l'ordre `sort` du nom.
//     Le suffixe alphabétiquement dernier gagne, en silence, avec un déploiement
//     vert : une policy durcie peut se faire remplacer par une version faible.
// Rien n'attrapait ce cas — d'où ce contrôle.
const byVersion = new Map();
for (const f of files) {
  const version = basename(f).slice(0, 14);
  if (!/^\d{14}$/.test(version)) continue;
  if (!byVersion.has(version)) byVersion.set(version, []);
  byVersion.get(version).push(basename(f));
}

const collisions = [...byVersion.entries()].filter(([, names]) => names.length > 1);
if (collisions.length) {
  console.error(`\n✗ ${collisions.length} version(s) de migration en double :`);
  for (const [version, names] of collisions) {
    console.error(`    ${version} → ${names.sort().join('  ET  ')}`);
  }
  console.error('\nAu rejeu du jour, les deux s\'appliquent et le nom qui trie en DERNIER gagne :');
  console.error('un correctif peut être écrasé par la version qu\'il remplaçait, sans rien casser.');
  console.error('Renommer l\'une des deux avec `date +%Y%m%d%H%M%S` (pas un horodatage rond).');
  console.error('\n⚠ Vérifier l\'unicité contre l\'UNION de la branche ET de origin/main :');
  console.error("   { git ls-tree -r --name-only origin/main -- supabase/migrations/;\\");
  console.error("     git ls-tree -r --name-only HEAD -- supabase/migrations/; } \\");
  console.error("   | grep -oE '[0-9]{14}' | sort | uniq -d");
  process.exit(1);
}

const checked = files.filter((f) => !GRANDFATHERED.has(basename(f))).length;
console.log(`✓ Migrations rejouables (${checked} vérifiées, ${GRANDFATHERED.size} historiques exclues).`);
console.log(`✓ Versions uniques (${byVersion.size} horodatages distincts).`);
