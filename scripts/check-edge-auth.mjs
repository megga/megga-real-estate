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
// ET LES CONTREFAÇONS DE GARDE (audit du 13.09.2026, point S8). Quatre fonctions
// s'authentifiaient par un `===` nu contre la clé de service, et `weekly-report`
// acceptait le rôle super_admin sans l'allowlist d'e-mail — avec la bénédiction de
// cette porte, qui les couvrait par des entrées BESPOKE et reconnaissait une garde
// partagée à la seule présence de son NOM (import ou commentaire compris). Deux passes
// lisent désormais toutes les sources edge avec `scripts/_shared/edge-secret-compare.mjs` :
// égalité brute ou par sous-chaîne sur un secret, helper local à temps constant, rôle
// sans allowlist. Leurs limites sont écrites dans ce module.
//
// Usage :
//   node scripts/check-edge-auth.mjs     → exit 1 si une fonction n'a pas de garde,
//                                          ou si une source compare un secret à la main

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { sansCommentaires } from './_shared/wa-outbound-purpose.mjs';
import {
  appelle,
  helpersLocauxDefinis,
  HELPERS_LOCAUX_TOLERES,
  trouverComparaisonsSecretes,
} from './_shared/edge-secret-compare.mjs';

const FUNCTIONS_DIR = 'supabase/functions';
const SHARED_DIR = join(FUNCTIONS_DIR, '_shared');

/**
 * En dessous, les passes « secret » n'ont rien lu d'utile : un arbre déplacé ou un
 * répertoire vide leur ferait imprimer ✓ sur zéro fichier. Mesuré le 13.09.2026 :
 * 88 index.ts + 116 modules _shared.
 */
const FICHIERS_LUS_MIN = 60;

/**
 * Gardes partagées. Leur contenu est éprouvé ailleurs
 * (tests/backend/edge-service-secret-guard.spec.ts et voisins) ; ici on exige
 * qu'elles soient APPELÉES, dans le code commentaires blanchis. Un import seul, ou
 * un nom cité dans une note, ne garde rien.
 */
const SHARED_GUARDS = [
  'requireAgentAuth',      // JWT vérifié + profil + agency_id
  'requireSuperAdmin',     // JWT vérifié + rôle super_admin + e-mail d'auth allowlisté
  'isServiceSecret',       // app_config.service_role_key OU clé de l'env, à temps constant
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
  'resend-webhook': ['verifySvixSignature'],    // signature Svix sur le corps BRUT + fenêtre anti-rejeu
  'idx-feed': ['idx_feed_token'],               // jeton de flux par agence, résolu en base
  // `whatsapp-agent`, `idx-syndicate` et `kyc-report-pdf` ONT QUITTÉ cette liste
  // le 05.08.2026 : ils comparaient le secret à la main avec un `safeEqual` local,
  // et ne reconnaissaient donc QUE la clé de l'env. Ils passent par
  // `isServiceSecret` (garde partagée), qui accepte aussi le secret d'`app_config`
  // rejoué par pg_cron. Les laisser ici aurait exigé un marqueur `safeEqual` qui
  // n'existe plus dans ces fichiers — une entrée qui ne protège plus rien.
  // Voir docs/audits/2026-08-04-blast-radius-service-role.md §4.3.
  'whatsapp-agent-async': ['safeEqual'],
  'whatsapp-process': ['safeEqual'],
  'whatsapp-morning-brief': ['safeEqual'],
  'learn-agent-style': ['safeEqual'],
  'weekly-digest': ['safeEqual'],
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
  // `weekly-report` et `automation-engine` ONT QUITTÉ cette liste le 13.09.2026
  // (audit S8) : leurs entrées couvraient un `===` nu contre la clé de service, et
  // pour la première un rôle super_admin accepté sans allowlist. Elles passent par
  // les gardes partagées (`requireSuperAdmin`, `isServiceSecret`).
  // Les sept `['safeEqual']` ci-dessus restent tant que leurs copies locales vivent ;
  // la passe « secret » les tolère NOMMÉMENT (HELPERS_LOCAUX_TOLERES) et rougit le
  // jour où l'une disparaît sans que son exemption suive.
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

  // Par APPEL, pas par présence du nom : `source.includes(g)` comptait un import
  // jamais appelé et une garde citée en commentaire (S8, 13.09.2026).
  const hasShared = SHARED_GUARDS.some((g) => appelle(source, g));
  const bespoke = BESPOKE_GUARDS[dir];
  const code = sansCommentaires(source);
  const hasBespoke = bespoke ? bespoke.every((marker) => code.includes(marker)) : false;
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

// ── Passes « secret » ─────────────────────────────────────────────────────
// A : chaque supabase/functions/<fn>/index.ts. B : tout supabase/functions/_shared/**,
// tests exclus — une contrefaçon de garde écrite dans un module partagé contamine
// toutes les fonctions qui l'importent.
function* modulesPartages(dir) {
  for (const e of readdirSync(dir).sort()) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) yield* modulesPartages(p);
    else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) yield p;
  }
}

const lus = { A: 0, B: 0 };
const comparaisons = [];
const lirePasse = (passe, file) => {
  let source;
  try {
    source = readFileSync(file, 'utf8');
  } catch {
    return;
  }
  lus[passe]++;
  for (const hit of trouverComparaisonsSecretes(source, { chemin: file })) {
    comparaisons.push({ file, ...hit });
  }
};
for (const dir of dirs) lirePasse('A', join(FUNCTIONS_DIR, dir, 'index.ts'));
for (const file of modulesPartages(SHARED_DIR)) lirePasse('B', file);

// Cliquet : une exemption dont le fichier ne définit plus le helper ne protège plus
// rien — elle couvrirait la prochaine réintroduction au même endroit.
const exemptionsPerimees = HELPERS_LOCAUX_TOLERES.filter(([file, nom]) => {
  try {
    return !helpersLocauxDefinis(readFileSync(file, 'utf8')).includes(nom);
  } catch {
    return true;
  }
});

// Témoin : le lecteur doit VOIR la faute d'origine (magic-link-send-email, avant S8). Un
// lecteur devenu muet rendrait ✓ sur tout l'arbre — le vert pour la mauvaise raison.
const TEMOIN = 'if (serviceRoleKey.length > 0 && authHeader === `Bearer ${serviceRoleKey}`) ok()';
const lecteurVoit = trouverComparaisonsSecretes(TEMOIN).some((h) => h.regle === 'egalite-brute');

let failed = false;

if (lus.A + lus.B < FICHIERS_LUS_MIN || lus.A === 0 || lus.B === 0 || !lecteurVoit) {
  failed = true;
  console.error(
    `\n✖ Passes « secret » : ${lus.A} index.ts + ${lus.B} module(s) _shared lus — ` +
    `${FICHIERS_LUS_MIN} fichiers au moins, et les deux passes non vides, sont attendus` +
    `${lecteurVoit ? '' : ' ; et le lecteur ne voit plus la faute témoin'}.\n` +
    '  Un balayage qui ne lit rien ne prouve rien : vérifier le chemin, le répertoire courant\n' +
    '  et scripts/_shared/edge-secret-compare.mjs.\n',
  );
}

if (comparaisons.length) {
  failed = true;
  console.error(`\n✖ ${comparaisons.length} comparaison(s) de secret ou de rôle écrite(s) à la main :\n`);
  for (const c of comparaisons) console.error(`    ${c.file}:${c.ligne} [${c.regle}] ${c.texte}`);
  console.error(
    '\n  Ni `===`, ni sous-chaîne, ni helper local à temps constant, ni rôle seul :\n' +
    '    · appel interne / pg_cron → isServiceSecret(admin, req)  (app_config OU env, temps constant)\n' +
    '    · console super-admin     → requireSuperAdmin(req, cors) (rôle ET e-mail allowlisté)\n' +
    '  Règles et limites : scripts/_shared/edge-secret-compare.mjs.\n',
  );
}

if (exemptionsPerimees.length) {
  failed = true;
  console.error(`\n✖ ${exemptionsPerimees.length} exemption(s) de helper local sont PÉRIMÉES :\n`);
  for (const [file, nom] of exemptionsPerimees) console.error(`    ${file} — ne définit plus ${nom}`);
  console.error(
    '\n  Retirer l\'entrée de HELPERS_LOCAUX_TOLERES (scripts/_shared/edge-secret-compare.mjs)\n' +
    '  et, si la fonction est passée par isServiceSecret, son entrée [\'safeEqual\'] de BESPOKE_GUARDS.\n',
  );
}

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
console.log(
  `✓ Comparaisons de secret : ${lus.A} index.ts + ${lus.B} module(s) _shared lus, aucune écrite ` +
  `à la main (${HELPERS_LOCAUX_TOLERES.length} helper(s) local(aux) toléré(s) nommément).`,
);
