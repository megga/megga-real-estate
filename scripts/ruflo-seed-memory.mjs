#!/usr/bin/env node
/**
 * Seed ruflo's memory with MEGGA system knowledge.
 *
 * Why: the container is ephemeral, so ruflo's memory DB (.swarm/memory.db) is
 * wiped between sessions. The DURABLE knowledge lives in two committed files:
 *   - docs/system-map.md                          (human-readable map of the rouages)
 *   - .claude-flow/knowledge/megga-memory.seed.json (machine-readable seed)
 * This script re-loads the seed into ruflo's local memory so semantic recall
 * works again. 100% local (WASM SQLite + local ONNX embeddings) — no API, no tokens.
 *
 * CLAUDE_FLOW_DISABLE_BRIDGE=1 — obligatoire pour PERSISTER (juin 2026, ruflo 3.10.x) :
 * sans lui, le bridge AgentDB intercepte les écritures vers un wrapper sql.js WASM
 * qui ne flush sur disque qu'au close()… que le CLI ruflo n'appelle jamais
 * (process.exit(0) dès la fin de la commande, fix #1641). Résultat : « Entries: 143 »
 * annoncé, zéro ligne écrite, et seuls les vecteurs orphelins atterrissent dans
 * ruvector.db. Le flag (échappatoire upstream #2120) force le chemin sql.js legacy
 * qui exporte le fichier après CHAQUE write. La LECTURE (search/list) marche avec
 * ou sans le flag : les deux chemins relisent .swarm/memory.db depuis le disque.
 *
 * VERSION ÉPINGLÉE : on n'utilise PAS ruflo@latest. Le fix de persistance ci-dessus
 * dépend du comportement actuel du bridge ; une montée de version peut le re-casser
 * silencieusement. On épingle une version connue-bonne et on bumpe consciemment.
 *
 * NB : le « Vectors: 0 » affiché par `memory import` est un compteur codé en dur
 * dans le handler upstream — il ne dit RIEN de l'état réel. D'où les sondes
 * ci-dessous : (1) COMPTAGE (seed.entries.length == nb importé, détecte un import
 * partiel) puis (2) RAPPEL multi-domaines. Plus jamais de seed "réussi" dans le vide.
 *
 * Usage:  npm run ruflo:seed   (or: node scripts/ruflo-seed-memory.mjs)
 * To extend the brain: edit the seed JSON (keep it in sync with docs/system-map.md), re-run.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Version connue-bonne (search ~250ms, persistance OK avec le flag). Bumper consciemment.
const RUFLO = 'ruflo@3.10.46';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const seed = resolve(root, '.claude-flow/knowledge/megga-memory.seed.json');
const db = resolve(root, '.swarm/memory.db');

const env = { ...process.env, CLAUDE_FLOW_DISABLE_BRIDGE: '1' };

// WINDOWS : `npx` n'est pas lançable par execFile — le binaire résolvable est `npx.cmd`,
// et execFile ne passe par aucun shell (→ « spawnSync npx ENOENT », juste APRÈS la ligne
// « seed validé » : ça se lit comme un avertissement sans rapport, pas comme un échec).
// Les deux échappatoires évidentes sont pires que le mal :
//   - shell:true → Node concatène les arguments SANS les échapper (DEP0190) : « pipeline
//     flatfox » arrive en DEUX argv, donc les sondes de rappel interrogeraient autre chose
//     que ce qu'on croit, et un chemin de seed contenant une espace casserait l'import ;
//   - 'npx.cmd' seul → EINVAL depuis le correctif de la CVE-2024-27980, Node refusant de
//     spawner un .cmd/.bat sans shell.
// On lance donc le script JS de npx avec le node courant : aucun shell, arguments préservés
// mot pour mot, même code que `npx`. Repli sur `npx` hors Windows, où c'est un vrai binaire.
const npxCli = [
  resolve(dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js'), // Windows
  resolve(dirname(process.execPath), '../lib/node_modules/npm/bin/npx-cli.js'), // POSIX
].find(existsSync);
if (!npxCli && process.platform === 'win32') {
  console.error(`[ruflo-seed] npx introuvable près de ${process.execPath} — npm n'est pas installé avec ce node.`);
  process.exit(1);
}
const [launcher, launchPrefix] = npxCli ? [process.execPath, [npxCli]] : ['npx', []];
const ruflo = (args, opts) =>
  execFileSync(launcher, [...launchPrefix, '--yes', RUFLO, ...args], { cwd: root, env, ...opts });
const run = (args) => ruflo(args, { stdio: 'inherit' });
const capture = (args) => ruflo(args, { encoding: 'utf-8' });

if (!existsSync(seed)) {
  console.error(`[ruflo-seed] missing seed file: ${seed}`);
  process.exit(1);
}

// Validation du seed AVANT import : attrape un JSON cassé / mal formé / clé dupliquée
// / tags en tableau (qui casse un parseur split(',')) avant de polluer la base.
let expectedCount;
try {
  const data = JSON.parse(readFileSync(seed, 'utf-8'));
  if (!data || !Array.isArray(data.entries)) throw new Error('le seed doit contenir un tableau "entries"');
  const keys = new Set();
  data.entries.forEach((e, i) => {
    if (!e || typeof e.key !== 'string' || !e.key) throw new Error(`entrée #${i} : "key" manquante`);
    if (typeof e.value !== 'string' || !e.value) throw new Error(`entrée ${e.key} : "value" manquante`);
    if (e.tags !== undefined && typeof e.tags !== 'string')
      throw new Error(`entrée ${e.key} : "tags" doit être une chaîne CSV, pas un ${Array.isArray(e.tags) ? 'tableau' : typeof e.tags}`);
    if (keys.has(e.key)) throw new Error(`clé dupliquée : ${e.key}`);
    keys.add(e.key);
  });
  expectedCount = data.entries.length;
  console.log(`[ruflo-seed] seed validé : ${expectedCount} entrées, clés uniques, tags CSV.`);
} catch (err) {
  console.error('[ruflo-seed] seed INVALIDE :', err?.message ?? err);
  process.exit(1);
}

try {
  if (!existsSync(db)) {
    console.log('[ruflo-seed] memory DB absent — initializing (local WASM SQLite + ONNX embeddings)…');
    run(['memory', 'init']);
  }
  console.log('[ruflo-seed] importing MEGGA system knowledge into ruflo memory…');
  run(['memory', 'import', '-i', seed]);

  // Sonde 1 — COMPTAGE : détecte un import partiel (ex 50/144 passait l'ancienne
  // sonde mono-requête). `memory list` affiche « Showing N of TOTAL entries ».
  const list = capture(['memory', 'list', '-n', 'megga']);
  const matched = list.match(/of\s+(\d+)\s+entries/);
  const actualCount = matched ? Number(matched[1]) : NaN;
  if (!Number.isFinite(actualCount)) {
    console.error('[ruflo-seed] FAILED : impossible de lire le nombre d’entrées importées.\n' + list);
    process.exit(1);
  }
  if (actualCount !== expectedCount) {
    console.error(`[ruflo-seed] FAILED : import partiel — ${actualCount} entrées en base vs ${expectedCount} attendues.`);
    process.exit(1);
  }
  console.log(`[ruflo-seed] comptage OK : ${actualCount}/${expectedCount} entrées importées.`);

  // Sonde 2 — RAPPEL multi-domaines : prouve que la recherche marche sur plusieurs
  // domaines, pas juste flatfox (ignore le « Vectors: 0 » du CLI).
  console.log('[ruflo-seed] verifying recall (multi-domain search probe)…');
  for (const q of ['pipeline flatfox', 'kyc compliance', 'agent whatsapp']) {
    const out = capture(['memory', 'search', '-q', q, '-n', 'megga', '-l', '3']);
    if (!out.includes('megga/')) {
      console.error(`[ruflo-seed] FAILED : la sonde « ${q} » n'a rien retourné.\n` + out);
      process.exit(1);
    }
  }
  console.log('[ruflo-seed] recall OK (3 domaines). Try: npx ruflo memory search -q "matching gestes triage" -n megga');
} catch (err) {
  console.error('[ruflo-seed] failed:', err?.message ?? err);
  process.exit(1);
}
