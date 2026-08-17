#!/usr/bin/env node
// Garde-fou dépendances orphelines : échoue si une entrée de `dependencies`
// n'est importée nulle part et n'est nommée par aucune configuration.
//
// POURQUOI une porte de plus. C'est un angle mort RÉEL, pas théorique : `fuse.js`
// est resté déclaré en `dependencies` du 20 juillet au 17 août 2026, son dernier
// import étant parti avec la SPA d'aide. Rien ne l'a vu — `tsc` ne compile que ce
// qui est atteignable, ESLint ne lit pas `package.json`, et `lint:deadcode`
// raisonne sur les EXPORTS du dépôt, jamais sur ce qu'il installe. Une dépendance
// orpheline coûte peu au bundle (elle n'y entre pas) mais beaucoup à la lecture :
// elle fait croire qu'un moteur de recherche existe, et un plan archivé la
// décrivait encore comme vivante un mois après sa mort.
//
// PÉRIMÈTRE : `dependencies` seules. Les `devDependencies` sont légitimement
// invoquées par leur NOM depuis la CI ou en ligne de commande (playwright,
// vitest, ts-prune…) ; les inclure exigerait une liste d'exceptions qui se
// périmerait plus vite qu'elle ne protège.
//
// USAGE RECONNU, deux formes — une dépendance peut servir sans être importée :
//   1. un spécificateur d'import / require / import() dans les sources ;
//   2. son nom, en toutes lettres, dans une configuration racine — c'est ainsi
//      que PostCSS charge `autoprefixer`, cité comme simple clé d'objet.
//
// Usage : node scripts/check-orphan-deps.mjs   (exit 1 si orpheline)
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RACINES = ['src', 'scripts', 'supabase/functions', 'tests', 'sites'];
const CONFIGS = [
  'vite.config.ts', 'tailwind.config.ts', 'postcss.config.js', 'eslint.config.js',
  'index.html', 'vitest.config.ts', 'vitest.backend.config.ts', 'playwright.config.ts',
];
const EXT = /\.(ts|tsx|js|jsx|mjs|cjs|html)$/;
const IGNORE_DIR = new Set(['node_modules', 'dist', '.git']);

function fichiers(racine, acc = []) {
  if (!existsSync(racine)) return acc;
  for (const nom of readdirSync(racine)) {
    if (IGNORE_DIR.has(nom)) continue;
    const chemin = join(racine, nom);
    if (statSync(chemin).isDirectory()) fichiers(chemin, acc);
    else if (EXT.test(nom)) acc.push(chemin);
  }
  return acc;
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const deps = Object.keys(pkg.dependencies ?? {});

const sources = RACINES.flatMap(r => fichiers(r)).map(f => readFileSync(f, 'utf8'));
const configs = CONFIGS.filter(existsSync).map(f => readFileSync(f, 'utf8'));

// Paquets réellement importés, ramenés à leur nom de paquet (@scope/nom ou nom).
const importes = new Set();
const SPEC = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*['"]([^'"]+)['"]/g;
for (const code of [...sources, ...configs]) {
  for (const [, spec] of code.matchAll(SPEC)) {
    if (spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('@/')) continue;
    const parts = spec.split('/');
    importes.add(spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]);
  }
}

// Sans ce plancher, une regex cassée ou un dossier déplacé rendraient l'ensemble
// vide — et la porte passerait au vert en déclarant TOUT orphelin, ou rien.
if (importes.size < 20) {
  console.error(`✗ relevé creux : ${importes.size} paquet(s) importé(s) détecté(s) — l'analyse ne lit plus les sources.`);
  process.exit(1);
}

const nommeEnConfig = dep => configs.some(c => new RegExp(`(^|[^\\w@/-])${dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\w/-]|$)`).test(c));

const orphelines = deps.filter(d => !importes.has(d) && !nommeEnConfig(d));

if (orphelines.length === 0) {
  console.log(`✓ Aucune dépendance orpheline — ${deps.length} entrée(s) de \`dependencies\`, toutes importées ou nommées en configuration.`);
  process.exit(0);
}
console.error(`\x1b[31m✗ ${orphelines.length} dépendance(s) installée(s) que rien n'importe :\x1b[0m\n`);
for (const d of orphelines) console.error(`  ${d}  (${pkg.dependencies[d]})`);
console.error(
  "\nRetirer avec `npm uninstall <paquet>`. Si elle sert sans être importée (chargée\n" +
    'par une configuration, effet de bord), la citer dans le fichier de configuration\n' +
    "concerné plutôt que d'exempter ici : la porte suit alors la vérité du dépôt.",
);
process.exit(1);
