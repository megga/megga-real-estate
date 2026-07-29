#!/usr/bin/env node
// Garde-fou roster monitoring : src/lib/edgeFunctionRoster.ts doit refléter
// EXACTEMENT les dossiers de supabase/functions/ (hors _shared).
//
// Pourquoi : le roster du monitoring super-admin (useAdminMonitoring) était
// maintenu à la main et dérivait (22 fonctions listées sur ~69 déployées,
// `totalEdgeFunctions` faux — constat élagage juil. 2026). Source unique = le
// source tree ; ce script régénère la constante et la CI bloque toute dérive.
//
// Usage :
//   node scripts/check-edge-roster.mjs          → check (exit 1 si dérive)
//   node scripts/check-edge-roster.mjs --write  → régénère le fichier
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const FUNCTIONS_DIR = 'supabase/functions';
const ROSTER_FILE = 'src/lib/edgeFunctionRoster.ts';

const dirs = readdirSync(FUNCTIONS_DIR)
  .filter((d) => d !== '_shared' && statSync(join(FUNCTIONS_DIR, d)).isDirectory())
  .sort();

const expected = `// GÉNÉRÉ par scripts/check-edge-roster.mjs — ne pas éditer à la main.
// Source de vérité : les dossiers de supabase/functions/ (hors _shared).
// Régénérer : node scripts/check-edge-roster.mjs --write (la CI bloque la dérive).
//
// NB : \`sync-service-key\` (déployée hors source-tree, volontairement — cf.
// mémoire service-key) n'apparaît pas ici : le roster reflète le REPO, pas le
// dashboard. Les fonctions retirées du repo mais encore déployées (zombies à
// supprimer au dashboard) n'y figurent pas non plus.

export const EDGE_FUNCTION_ROSTER = [
${dirs.map((d) => `  '${d}',`).join('\n')}
] as const
`;

// ── Second garde-fou : supabase/config.toml décrit-il TOUTES les fonctions ? ──
//
// Le fichier déclarait `verify_jwt = false` pour douze fonctions, ce qui laissait
// croire que les cinquante-quatre autres exigeaient un JWT. Aucune ne le fait :
// deploy.yml les déploie toutes avec `--no-verify-jwt` (allowlist JWT_PROTECTED
// volontairement vide — la plateforme rejette la clé service-role legacy quand
// verify_jwt = true, ce qui casserait tous les appels internes cron→fonction).
//
// Deux conséquences à cette demi-déclaration :
//   * on lisait le fichier comme une carte des accès, et il en donnait une fausse ;
//   * la pile LOCALE (`supabase start`), elle, applique le défaut `true` — donc un
//     test d'appel non authentifié était intercepté par la passerelle et ne
//     touchait jamais le code visé. Il passait sans rien prouver.
//
// Les blocs rédigés à la main sont préservés : ils portent la RAISON d'être
// publique de chaque fonction, ce qu'aucune génération ne saurait reconstituer.
// Le bloc généré ci-dessous ne fait que compléter, pour que le fichier ne mente
// plus par omission.

const CONFIG_FILE = 'supabase/config.toml';
const GEN_START = '# ── GÉNÉRÉ par scripts/check-edge-roster.mjs — début ──';
const GEN_END = '# ── GÉNÉRÉ par scripts/check-edge-roster.mjs — fin ──';

/** Sépare le fichier en (avant, bloc généré, après). Le bloc peut être absent. */
function splitConfig(text) {
  const i = text.indexOf(GEN_START);
  if (i === -1) return { head: text.replace(/\s*$/, '\n'), tail: '' };
  const j = text.indexOf(GEN_END, i);
  if (j === -1) throw new Error(`${CONFIG_FILE} : marqueur de fin du bloc généré introuvable.`);
  return { head: text.slice(0, i), tail: text.slice(j + GEN_END.length).replace(/^\n+/, '') };
}

function buildConfig(text) {
  const { head, tail } = splitConfig(text);
  // Ne comptent comme « documentées à la main » que les sections HORS bloc
  // généré : si quelqu'un rédige un bloc commenté pour une fonction, elle doit
  // sortir du généré, pas y être déclarée deux fois.
  const documented = new Set(
    [...`${head}\n${tail}`.matchAll(/^\[functions\.([a-z0-9-]+)\]/gm)].map((m) => m[1]),
  );
  const missing = dirs.filter((d) => !documented.has(d));

  const block = [
    GEN_START,
    '# Régénérer : node scripts/check-edge-roster.mjs --write',
    '#',
    '# Ces fonctions sont publiques comme toutes les autres (deploy.yml déploie en',
    "# --no-verify-jwt) ; leur garde d'accès est écrite DANS la fonction. Ce bloc",
    "# n'ajoute aucune permission : il aligne la pile locale sur la production et",
    '# empêche le fichier de laisser croire que ces fonctions exigent un JWT.',
    '#',
    "# Une fonction qui mérite une explication SORT d'ici : rédige son bloc plus",
    '# haut, avec la raison, et régénère.',
    ...missing.flatMap((d) => ['', `[functions.${d}]`, 'verify_jwt = false']),
    '',
    GEN_END,
  ].join('\n');

  return { expected: `${head}${block}\n${tail ? `\n${tail}` : ''}`, missing, documented };
}

const configText = existsSync(CONFIG_FILE) ? readFileSync(CONFIG_FILE, 'utf8') : '';
const config = buildConfig(configText);

if (process.argv.includes('--write')) {
  writeFileSync(ROSTER_FILE, expected);
  console.log(`✓ ${ROSTER_FILE} régénéré (${dirs.length} fonctions).`);
  writeFileSync(CONFIG_FILE, config.expected);
  console.log(
    `✓ ${CONFIG_FILE} régénéré (${config.documented.size} déclarées à la main, ${config.missing.length} générées).`,
  );
  process.exit(0);
}

let failed = false;

const actual = existsSync(ROSTER_FILE) ? readFileSync(ROSTER_FILE, 'utf8') : '';
if (actual === expected) {
  console.log(`✓ Roster edge functions en phase avec le tree (${dirs.length} fonctions).`);
} else {
  console.error('✗ Le roster monitoring a dérivé du source tree (supabase/functions/).');
  failed = true;
}

if (configText === config.expected) {
  console.log(`✓ ${CONFIG_FILE} déclare les ${dirs.length} fonctions du tree.`);
} else {
  const undeclared = dirs.filter((d) => !new RegExp(`^\\[functions\\.${d}\\]`, 'm').test(configText));
  console.error(`✗ ${CONFIG_FILE} a dérivé du source tree.`);
  if (undeclared.length) {
    console.error(`  Non déclarée(s) — la pile locale leur appliquera verify_jwt=true, pas la prod :`);
    for (const d of undeclared) console.error(`    · ${d}`);
  }
  failed = true;
}

if (!failed) process.exit(0);
console.error('  Régénère : node scripts/check-edge-roster.mjs --write');
process.exit(1);
