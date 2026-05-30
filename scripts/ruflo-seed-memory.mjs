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

const run = (args) =>
  execFileSync('npx', ['--yes', 'ruflo@latest', ...args], { cwd: root, stdio: 'inherit' });

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
  console.log('[ruflo-seed] done. Recall test: npx ruflo memory search -q "pipeline flatfox" -n megga');
} catch (err) {
  console.error('[ruflo-seed] failed:', err?.message ?? err);
  process.exit(1);
}
