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

if (process.argv.includes('--write')) {
  writeFileSync(ROSTER_FILE, expected);
  console.log(`✓ ${ROSTER_FILE} régénéré (${dirs.length} fonctions).`);
  process.exit(0);
}

const actual = existsSync(ROSTER_FILE) ? readFileSync(ROSTER_FILE, 'utf8') : '';
if (actual === expected) {
  console.log(`✓ Roster edge functions en phase avec le tree (${dirs.length} fonctions).`);
  process.exit(0);
}
console.error('✗ Le roster monitoring a dérivé du source tree (supabase/functions/).');
console.error('  Régénère-le : node scripts/check-edge-roster.mjs --write');
process.exit(1);
