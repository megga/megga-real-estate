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
 * CLAUDE_FLOW_DISABLE_BRIDGE=1 — obligatoire pour PERSISTER (juin 2026, ruflo 3.10.40) :
 * sans lui, le bridge AgentDB intercepte les écritures vers un wrapper sql.js WASM
 * qui ne flush sur disque qu'au close()… que le CLI ruflo n'appelle jamais
 * (process.exit(0) dès la fin de la commande, fix #1641). Résultat : « Entries: 143 »
 * annoncé, zéro ligne écrite, et seuls les vecteurs orphelins atterrissent dans
 * ruvector.db. Le flag (échappatoire upstream #2120) force le chemin sql.js legacy
 * qui exporte le fichier après CHAQUE write. La LECTURE (search/list) marche avec
 * ou sans le flag : les deux chemins relisent .swarm/memory.db depuis le disque.
 *
 * NB : le « Vectors: 0 » affiché par `memory import` est un compteur codé en dur
 * dans le handler upstream — il ne dit RIEN de l'état réel. D'où la sonde de
 * rappel ci-dessous : elle interroge la mémoire après import et échoue bruyamment
 * si la recherche ne retourne rien (plus jamais de seed "réussi" dans le vide).
 *
 * Usage:  npm run ruflo:seed   (or: node scripts/ruflo-seed-memory.mjs)
 * To extend the brain: edit the seed JSON (keep it in sync with docs/system-map.md), re-run.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const seed = resolve(root, '.claude-flow/knowledge/megga-memory.seed.json');
const db = resolve(root, '.swarm/memory.db');

const env = { ...process.env, CLAUDE_FLOW_DISABLE_BRIDGE: '1' };
const run = (args) =>
  execFileSync('npx', ['--yes', 'ruflo@latest', ...args], { cwd: root, env, stdio: 'inherit' });
const capture = (args) =>
  execFileSync('npx', ['--yes', 'ruflo@latest', ...args], { cwd: root, env, encoding: 'utf-8' });

if (!existsSync(seed)) {
  console.error(`[ruflo-seed] missing seed file: ${seed}`);
  process.exit(1);
}

try {
  if (!existsSync(db)) {
    console.log('[ruflo-seed] memory DB absent — initializing (local WASM SQLite + ONNX embeddings)…');
    run(['memory', 'init']);
  }
  console.log('[ruflo-seed] importing MEGGA system knowledge into ruflo memory…');
  run(['memory', 'import', '-i', seed]);

  // Sonde de rappel : la seule preuve que le seed a fonctionné est qu'une
  // recherche retourne des entrées megga/*. (Ignore le « Vectors: 0 » du CLI.)
  console.log('[ruflo-seed] verifying recall (search probe)…');
  const probe = capture(['memory', 'search', '-q', 'pipeline flatfox', '-n', 'megga', '-l', '3']);
  if (!probe.includes('megga/')) {
    console.error('[ruflo-seed] FAILED: import reported success but the search probe found nothing.');
    console.error('[ruflo-seed] probe output was:\n' + probe);
    process.exit(1);
  }
  console.log('[ruflo-seed] recall OK. Try: npx ruflo memory search -q "matching gestes triage" -n megga');
} catch (err) {
  console.error('[ruflo-seed] failed:', err?.message ?? err);
  process.exit(1);
}
