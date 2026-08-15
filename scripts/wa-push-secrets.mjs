#!/usr/bin/env node
// Pousse les secrets Meta de `.env.meta` vers Supabase — en ignorant les vides.
//
// POURQUOI PAS `supabase secrets set --env-file .env.meta` DIRECTEMENT. Cette
// commande traite une ligne `CLE=` comme une valeur : elle ÉCRASE le secret
// existant par une chaîne vide. Un `WHATSAPP_VERIFY_TOKEN=` resté vide dans le
// fichier suffirait donc à faire échouer tous les handshakes du webhook, juste
// après l'avoir configuré. Ce script ne pousse QUE les clés effectivement
// remplies, et dit lesquelles il laisse tranquilles.
//
// Il ignore aussi tout ce que le fichier contient d'autre (META_WABA_ID, WA_PIN,
// commentaires) : seules les 4 clés réellement lues par les edge functions sont
// envoyées.
//
// Usage :
//   node scripts/wa-push-secrets.mjs           → pousse
//   node scripts/wa-push-secrets.mjs --dry-run → montre ce qui serait poussé
//
// Aucune valeur n'est jamais affichée, ni en succès ni en erreur.

import { readFileSync, writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PROJECT_REF = 'eayczugyrvmtqnnmvjod';
const ENV_FILE = '.env.meta';

/**
 * Les seules clés que les edge functions lisent réellement.
 *
 * Les `WA_TEMPLATE_*` ne sont à poser qu'une fois le template APPROVED par Meta :
 * tant qu'elles sont vides, `buildTemplateMessage()` rend null et le chemin
 * hors-fenêtre-24h reste inerte — ce qui vaut mieux qu'un envoi rejeté en 132001
 * parce qu'on a nommé un template encore en examen.
 */
const WANTED = [
  'META_APP_SECRET',
  'META_WHATSAPP_TOKEN',
  'META_PHONE_NUMBER_ID',
  'WHATSAPP_VERIFY_TOKEN',
  'WA_TEMPLATE_FOLLOWUP',
  'WA_TEMPLATE_AVAILABILITY',
  'WA_TEMPLATE_NEW_LISTINGS',
];

const dryRun = process.argv.includes('--dry-run');

let raw;
try {
  raw = readFileSync(ENV_FILE, 'utf8');
} catch {
  console.error(`✗ ${ENV_FILE} introuvable — lance ce script depuis la racine du worktree.`);
  process.exit(1);
}

// Parse minimal : KEY=VALUE, commentaires et lignes vides ignorés. La valeur peut
// contenir des '=' (les tokens Meta en contiennent), d'où le split sur le PREMIER.
const found = new Map();
for (const line of raw.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq < 1) continue;
  const key = t.slice(0, eq).trim();
  const value = t.slice(eq + 1).trim();
  if (WANTED.includes(key) && value.length > 0) found.set(key, value);
}

const missing = WANTED.filter((k) => !found.has(k));

console.log('À pousser :');
for (const k of found.keys()) console.log(`  \x1b[32m✓\x1b[0m ${k}`);
if (missing.length) {
  console.log('\nLaissés intacts côté Supabase (vides ou absents du fichier) :');
  for (const k of missing) console.log(`  \x1b[90m·\x1b[0m ${k}`);
}

if (found.size === 0) {
  console.error('\n✗ Rien à pousser — aucune clé remplie.');
  process.exit(1);
}

if (dryRun) {
  console.log('\n(--dry-run : rien n’a été envoyé)');
  process.exit(0);
}

// Fichier temporaire en 0600 plutôt que des valeurs en argv : un argument de
// ligne de commande est visible par tout processus via `ps`.
const dir = mkdtempSync(join(tmpdir(), 'wa-secrets-'));
const tmp = join(dir, 'push.env');
let code = 1;
try {
  writeFileSync(tmp, [...found].map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600 });
  console.log('\nEnvoi vers Supabase…');
  const args = ['secrets', 'set', '--project-ref', PROJECT_REF, '--env-file', tmp];

  // La CLI n'est pas une dépendance du projet et n'est pas forcément installée
  // globalement : on tente le binaire du PATH, puis on retombe sur npx, qui la
  // télécharge à la volée (~1 min la première fois).
  let r = spawnSync('supabase', args, { stdio: 'inherit' });
  if (r.error?.code === 'ENOENT') {
    console.log('(CLI absente du PATH — passage par npx, téléchargement possible)');
    r = spawnSync('npx', ['-y', 'supabase@2.114.0', ...args], { stdio: 'inherit' });
  }
  code = r.status ?? 1;
  if (r.error) console.error(`✗ ${r.error.message}`);
} finally {
  try { unlinkSync(tmp); } catch { /* déjà parti */ }
}

if (code === 0) {
  console.log('\n\x1b[32m✓ Secrets posés.\x1b[0m Vérifie avec : node scripts/wa-meta-check.mjs');
}
process.exit(code);
