#!/usr/bin/env node
// Garde-fou code mort : échoue si un EXPORT n'est importé nulle part.
// Détecte les exports morts *à l'intérieur* des fichiers vivants (angle mort de
// l'analyse de portée). Baseline nettoyée juil. 2026 (PR #848) — voir
// docs sur megga/dead-exports-prune.
//
// Les lignes « (used in module) » = export superflu mais symbole vivant → ignorées.
// L'allowlist ci-dessous = gardes INTENTIONNELS que ts-prune ne peut pas voir
// (re-exports barrel consommés en lazy, kits UI conservés, API/compliance).
//
// Usage : node scripts/check-dead-exports.mjs   (exit 1 si nouveau code mort)
import { execSync } from 'node:child_process';

// Fichiers entièrement exemptés (barrel/kits conservés volontairement).
const ALLOW_FILES = new Set([
  'src/components/megga-x/index.ts',        // barrel re-exporté, consommé par MeggaXStyleGuidePage (lazy) — invisible pour ts-prune
]);

// Symboles précis exemptés : `chemin:symbole`.
const ALLOW_SYMBOLS = new Set([
  'src/components/propertyx/PxWhatsAppButton.tsx:default', // composant du cœur Px (buildWaMeUrl, lui, est utilisé)
  'src/components/crm-sugar/SugarShell.tsx:SugarIconRailProps', // re-export type (faux positif ts-prune)
  // lib API / compliance conservée (surface API + données réglementaires) :
  'src/lib/posthog.ts:identifyUser', 'src/lib/posthog.ts:trackEvent', 'src/lib/posthog.ts:resetPostHog',
  'src/lib/sentry.ts:identifySentryUser', 'src/lib/sentry.ts:clearSentryUser',
  'src/lib/constants.ts:Canton', 'src/lib/constants.ts:KycStatus', 'src/lib/constants.ts:KycType',
  'src/lib/constants.ts:FATF_HIGH_RISK_COUNTRIES', 'src/lib/constants.ts:FATF_INCREASED_MONITORING',
  'src/lib/utils.ts:formatSurface',          // formatteur m² testé (tests/unit/utils.spec.ts)
  // Sortie du générateur Supabase, pas du code écrit à la main : les versions
  // récentes émettent `Constants` (valeurs des enums Postgres) que rien
  // n'importe encore. Le retirer reviendrait à éditer un fichier auto-généré,
  // donc à recommencer à chaque régénération.
  'src/types/database.ts:Constants',
]);

let raw = '';
try {
  raw = execSync('npx ts-prune -p tsconfig.app.json', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
} catch (e) {
  raw = (e.stdout || '') + (e.stderr || '');
}

const offenders = [];
for (const line of raw.split('\n')) {
  if (!line.trim() || line.includes('(used in module)')) continue;
  const m = line.match(/^(.+?):(\d+)\s+-\s+(.+)$/);
  if (!m) continue;
  const [, file, , symbol] = m;
  if (ALLOW_FILES.has(file)) continue;
  if (ALLOW_SYMBOLS.has(`${file}:${symbol}`)) continue;
  offenders.push(`${file} - ${symbol}`);
}

if (offenders.length === 0) {
  console.log('✓ Aucun export mort (baseline propre).');
  process.exit(0);
}
console.error(`✗ ${offenders.length} export(s) mort(s) détecté(s) — retire-les ou justifie-les dans scripts/check-dead-exports.mjs :`);
for (const o of offenders) console.error('  ' + o);
process.exit(1);
