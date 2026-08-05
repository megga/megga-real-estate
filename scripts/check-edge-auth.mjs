#!/usr/bin/env node
// Garde-fou : toute edge function doit authentifier son appelant.
//
// POURQUOI. `deploy.yml` déploie les 68 fonctions avec `--no-verify-jwt`
// (allowlist `JWT_PROTECTED` volontairement vide : la plateforme rejette la clé
// service-role legacy quand verify_jwt=true). Autrement dit, la passerelle
// Supabase ne vérifie AUCUNE signature : chaque fonction répond seule de
// l'identité de son appelant, et une fonction sans garde est un endpoint public.
//
// L'audit du 02.08.2026 a trouvé onze fonctions exploitables. Trois l'étaient
// simplement parce que personne n'avait écrit de garde et que rien ne le
// signalait : `check-edge-roster.mjs` vérifie que `config.toml` DÉCLARE les
// fonctions, pas qu'elles s'authentifient. C'est ce trou-là que ce script ferme.
//
// CE QUE CE SCRIPT NE FAIT PAS. Il vérifie qu'une garde EXISTE, pas qu'elle
// AUTORISE correctement. `requireAgentAuth` prouve que l'appelant est un agent
// connecté et rend un client service-role : les requêtes qui suivent doivent
// encore être cloisonnées par `agency_id`. Deux des onze failles (les
// synchronisations de calendrier) avaient une garde et fuyaient quand même.
// Cette porte attrape l'oubli total, pas l'IDOR.
//
// Usage :
//   node scripts/check-edge-auth.mjs     → exit 1 si une fonction n'a pas de garde

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FUNCTIONS_DIR = 'supabase/functions';

/**
 * Gardes partagées. La présence d'un de ces symboles suffit : leur contenu est
 * éprouvé ailleurs (tests/backend/edge-service-secret-guard.spec.ts et voisins).
 */
const SHARED_GUARDS = [
  'requireAgentAuth',      // JWT vérifié + profil + agency_id
  'requireSuperAdmin',     // + rôle super_admin + allowlist e-mail
  'isServiceSecret',       // secret partagé, comparaison à temps constant
  'verifyMagicLinkToken',  // HMAC d'un lien public (échoue fermé si le secret manque)
];

/**
 * Gardes SUR MESURE, légitimes mais propres à une fonction. On exige la présence
 * du symbole EXACT qui porte le contrôle : si quelqu'un le retire au détour d'un
 * remaniement, la porte crie. Ne rien mettre ici sans avoir lu le code.
 */
const BESPOKE_GUARDS = {
  'whatsapp-webhook': ['verifyHmac'],           // X-Hub-Signature-256 sur le corps BRUT
  'stripe-webhook': ['constructEventAsync'],    // signature Stripe + tolérance d'horodatage
  'esign-webhook': ['timingSafeEqual'],         // jeton de rappel (64 hex) dans l'URL
  'idx-feed': ['idx_feed_token'],               // jeton de flux par agence, résolu en base
  'whatsapp-agent': ['safeEqual'],
  'whatsapp-agent-async': ['safeEqual'],
  'whatsapp-process': ['safeEqual'],
  'whatsapp-morning-brief': ['safeEqual'],
  'learn-agent-style': ['safeEqual'],
  'weekly-digest': ['safeEqual'],
  'idx-syndicate': ['safeEqual'],
  'kyc-report-pdf': ['safeEqual'],
  'agency-verification-run': ['safeEqual'],
  'agency-verification-notify': ['safeEqual'],
  // Vérification réelle du JWT par GoTrue (la signature EST contrôlée), suivie
  // d'un contrôle de rôle ou de propriétaire propre à la fonction.
  'accept-team-invite': ['auth.getUser'],
  'send-team-invite': ['auth.getUser'],
  'detect-new-device': ['auth.getUser'],
  'revoke-device-session': ['auth.getUser'],
  'delete-account': ['auth.getUser'],
  'extract-lead': ['auth.getUser'],
  'stripe-checkout': ['auth.getUser'],
  'stripe-portal': ['auth.getUser'],
  'google-calendar-sync': ['auth.getUser'],
  'outlook-calendar-sync': ['auth.getUser'],
  'virtual-staging': ['auth.getUser'],
  'audit-pdf-export': ['auth.getUser'],
  'weekly-report': ['auth.getUser'],
  'automation-engine': ['requireAgentAuth'],
};

/**
 * Fonctions PUBLIQUES PAR CONCEPTION. Toute entrée doit porter sa raison : c'est
 * la seule chose qui empêche cette liste de devenir le tapis sous lequel on
 * glisse les oublis. Une fonction qui gagne une garde doit SORTIR d'ici (le
 * script le signale, sinon la liste pourrit).
 */
const OPEN_BY_DESIGN = {
  'c2pa-verify':
    "Vérifier une preuve d'authenticité derrière un mur n'aurait pas de sens. " +
    'Lecture seule, aucun client Supabase, aucune table touchée, SSRF bornée par ' +
    '_shared/safe-fetch.ts. Décision documentée dans supabase/config.toml.',
  'log-auth-event':
    "Appelée depuis l'écran de connexion, donc AVANT toute session — fermer la " +
    "fonction casserait la journalisation des échecs de connexion, qui est " +
    'précisément son objet. Écrit dans auth_events. La limitation de débit ' +
    'annoncée ici comme « à traiter » EST FAITE (log_auth_event_limited, ' +
    'migration 20260804101347 : 60/min et 600/h par ip_hash) — cf. ' +
    'docs/audits/2026-08-03-signatures-webhooks.md §4.1. Reste assumé : sans ' +
    'session, un événement demeure forgeable ; le débit est ce qui borne le ' +
    'dommage, et aucune logique de verrouillage de compte ne lit cette table.',
};

const dirs = readdirSync(FUNCTIONS_DIR)
  .filter((d) => d !== '_shared' && statSync(join(FUNCTIONS_DIR, d)).isDirectory())
  .sort();

const missing = [];
const staleAllowlist = [];
const missingBespoke = [];

for (const dir of dirs) {
  const file = join(FUNCTIONS_DIR, dir, 'index.ts');
  let source;
  try {
    source = readFileSync(file, 'utf8');
  } catch {
    continue; // pas d'index.ts : ce n'est pas une fonction déployable
  }

  const hasShared = SHARED_GUARDS.some((g) => source.includes(g));
  const bespoke = BESPOKE_GUARDS[dir];
  const hasBespoke = bespoke ? bespoke.every((marker) => source.includes(marker)) : false;
  const guarded = hasShared || hasBespoke;

  if (dir in OPEN_BY_DESIGN) {
    // Une fonction déclarée ouverte qui s'est dotée d'une garde ne doit plus
    // figurer ici : sinon la liste finit par couvrir des fonctions protégées et
    // ne veut plus rien dire.
    if (guarded) staleAllowlist.push(dir);
    continue;
  }

  if (bespoke && !hasBespoke && !hasShared) {
    missingBespoke.push({ dir, expected: bespoke });
    continue;
  }

  if (!guarded) missing.push(dir);
}

let failed = false;

if (missing.length) {
  failed = true;
  console.error(
    `\n✖ ${missing.length} edge function(s) sans aucune garde d'authentification :\n`,
  );
  for (const d of missing) console.error(`    supabase/functions/${d}/index.ts`);
  console.error(
    '\n  Ces fonctions sont déployées --no-verify-jwt : sans garde, elles sont\n' +
    "  joignables par n'importe qui sur Internet.\n\n" +
    '  Poser une garde de supabase/functions/_shared/ :\n' +
    '    · appelant agent        → requireAgentAuth\n' +
    '    · console super-admin   → requireSuperAdmin\n' +
    '    · pg_cron / interne     → isServiceSecret\n' +
    '    · porteur de lien public → verifyMagicLinkToken\n\n' +
    "  Si la fonction est publique À DESSEIN, l'ajouter à OPEN_BY_DESIGN dans ce\n" +
    '  script AVEC sa justification écrite.\n',
  );
}

if (missingBespoke.length) {
  failed = true;
  console.error(`\n✖ ${missingBespoke.length} garde sur mesure a DISPARU :\n`);
  for (const { dir, expected } of missingBespoke) {
    console.error(`    supabase/functions/${dir}/index.ts — attendu : ${expected.join(', ')}`);
  }
  console.error(
    '\n  Cette fonction portait un contrôle propre à elle. Soit il a été retiré\n' +
    '  (régression de sécurité), soit il a été renommé — dans ce cas, mettre à\n' +
    '  jour BESPOKE_GUARDS dans ce script.\n',
  );
}

if (staleAllowlist.length) {
  failed = true;
  console.error(
    `\n✖ ${staleAllowlist.length} fonction(s) listée(s) « publiques par conception » ont maintenant une garde :\n`,
  );
  for (const d of staleAllowlist) console.error(`    ${d}`);
  console.error('\n  Les retirer de OPEN_BY_DESIGN — une allowlist périmée finit par couvrir des oublis.\n');
}

if (failed) process.exit(1);

const open = Object.keys(OPEN_BY_DESIGN).length;
console.log(
  `✓ Gardes edge : ${dirs.length - open} fonction(s) authentifient leur appelant, ` +
  `${open} ouverte(s) par conception et justifiée(s).`,
);
