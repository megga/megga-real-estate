#!/usr/bin/env node
// Garde-fou : toute edge function doit authentifier son appelant — AVANT d'agir, et
// l'e-mail qu'elle envoie doit avoir un périmètre de destinataires nommé.
//
// POURQUOI. `deploy.yml` déploie les 88 fonctions avec `--no-verify-jwt`
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
// ET LES CONTREFAÇONS DE GARDE (audit du 13.09.2026, point S8). Quatre fonctions
// s'authentifiaient par un `===` nu contre la clé de service, et `weekly-report`
// acceptait le rôle super_admin sans l'allowlist d'e-mail — avec la bénédiction de
// cette porte, qui les couvrait par des entrées BESPOKE et reconnaissait une garde
// partagée à la seule présence de son NOM (import ou commentaire compris). Deux passes
// lisent désormais toutes les sources edge avec `scripts/_shared/edge-secret-compare.mjs` :
// égalité brute ou par sous-chaîne sur un secret, helper local à temps constant, rôle
// sans allowlist. Leurs limites sont écrites dans ce module.
//
// ET L'ORDRE, ET LE PÉRIMÈTRE (audit du 13.09.2026, point S17). Une garde PRÉSENTE ne dit
// ni QUAND elle s'exécute ni CE QU'ELLE LAISSE PASSER : S1 (un relais e-mail ouvert derrière
// une garde bien présente) et S8 en sont nés. Trois passes lisent désormais le gestionnaire
// de chaque fonction avec `scripts/_shared/edge-guard-order.mjs` :
//   · ORDRE — dans le corps du gestionnaire (`serve(` / `Deno.serve(`), la première garde
//     reconnue doit précéder le premier EFFET : écriture de table, stockage, `auth.admin.*`,
//     RPC (toutes, sauf les lectures de `RPC_LECTURE`, dont la volatilité STABLE/IMMUTABLE
//     est vérifiée dans les migrations), envoi d'e-mail ou WhatsApp, invocation d'une autre
//     fonction. Les helpers — du fichier ou de `_shared/` — sont déroulés à l'appel : un
//     helper déclaré au-dessus du gestionnaire qui écrit ne compte que là où on l'appelle.
//     Pour une fonction publique par jeton ou un webhook, la garde EST la vérification du
//     jeton ou de la signature (marqueurs de `BESPOKE_GUARDS`). La garde doit en outre être
//     ATTEINTE depuis le gestionnaire, pas seulement appelée quelque part dans le fichier.
//   · CHARGEMENT — aucun effet au niveau module : il s'exécuterait avant toute requête.
//   · EXPÉDITEURS — l'inventaire des fonctions qui envoient un e-mail est calculé sur le code
//     (Resend lu sur l'URL, directement ou via `_shared/`, boîte de l'agent, GoTrue), jamais
//     tenu à la main. Chacune doit soit consulter `guardOutboundEmail` AVANT son premier
//     envoi, soit figurer dans `PERIMETRES_EXPEDITEURS`, qui nomme à qui elle écrit et
//     pourquoi. Une entrée pour une fonction qui n'existe plus, n'envoie plus, ou passe
//     désormais par la garde, rougit : une table périmée finit par couvrir un oubli.
//
// CE QUE CE SCRIPT NE MESURE TOUJOURS PAS.
//   · Le CLOISONNEMENT : `requireAgentAuth` prouve que l'appelant est un agent connecté et
//     rend un client service-role ; les requêtes qui suivent doivent encore être filtrées par
//     `agency_id`. Deux des onze failles du 02.08 (les synchronisations de calendrier)
//     avaient une garde et fuyaient quand même. Cette porte attrape l'oubli et le désordre,
//     pas l'IDOR.
//   · Le FLOT DE CONTRÔLE : l'ordre est celui du TEXTE. Une garde écrite dans une branche
//     compte pour la voisine, et une garde APPELÉE dont le verdict est ignoré ou décidé plus
//     loin passe. Les autres limites de la lecture sont écrites dans `edge-guard-order.mjs`.
//   · La VÉRITÉ d'un périmètre : la table nomme ce que le code fait, relu à la main le
//     13.09.2026 ; la porte vérifie qu'une entrée existe et reste d'actualité (fonction,
//     envoi, canal), pas que la phrase dit juste.
//   · Les appels sortants génériques (Stripe, agendas, IA) ne sont pas des effets ici.
//
// Usage :
//   node scripts/check-edge-auth.mjs     → exit 1 si une fonction n'a pas de garde, agit
//                                          avant elle, envoie sans périmètre nommé, ou si une
//                                          source compare un secret à la main

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { sansCommentaires } from './_shared/wa-outbound-purpose.mjs';
import {
  appelle,
  helpersLocauxDefinis,
  HELPERS_LOCAUX_TOLERES,
  trouverComparaisonsSecretes,
} from './_shared/edge-secret-compare.mjs';
import {
  CANAUX_NOMMES,
  canalNommePerime,
  creerAnalyse,
  lecturesRpcInvalides,
  lireModule,
  verdictExpediteurs,
  verdictOrdre,
  volatilitesSql,
} from './_shared/edge-guard-order.mjs';

const FUNCTIONS_DIR = 'supabase/functions';
const SHARED_DIR = join(FUNCTIONS_DIR, '_shared');
const MIGRATIONS_DIR = 'supabase/migrations';

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
 *
 * Depuis S17, la PREMIÈRE occurrence d'un marqueur dans le gestionnaire est aussi la
 * position de la garde pour la passe « ordre ». Un marqueur qui a la forme d'un
 * identifiant (`safeEqual`, `auth.getUser`) y est lu borné, pas en sous-chaîne.
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
  //
  // `accept-team-invite` est AUSSI publique par jeton (S17, 13.09.2026) : la page
  // d'invitation s'affiche avant toute connexion, et la fonction résout le jeton
  // d'invitation en base (`.eq('token', body.token)`) avant de lire le JWT. Le seul effet
  // de ce chemin — marquer `expired` une invitation dont la date est déjà passée — suit
  // cette résolution ; sans jeton valide, rien n'est écrit. La passe « ordre » l'avait vu
  // comme une écriture avant `auth.getUser` : c'était la garde qui n'était pas nommée.
  'accept-team-invite': [".eq('token', body.token)", 'auth.getUser'],
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
 *
 * Sans garde, elles n'ont pas d'ordre garde → effet : la passe « ordre » les saute, et
 * c'est leur justification écrite ci-dessous qui couvre leurs effets.
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

/**
 * RPC de LECTURE, les seules à ne pas compter comme un effet — toute autre `.rpc(` en est un,
 * nom dynamique compris. Chaque entrée est VÉRIFIÉE, pas crue :
 *   · sa dernière définition dans `supabase/migrations/` est STABLE ou IMMUTABLE — Postgres
 *     y refuse INSERT/UPDATE/DELETE, donc « elle ne fait que lire » est une propriété du
 *     schéma, pas une promesse ;
 *   · une source edge l'appelle encore — une exception sans appelant couvrirait le prochain.
 * N'y inscrire que ce qu'une passe a réellement besoin de lire avant une garde.
 */
const RPC_LECTURE = {
  get_onboarding_call_by_token:
    "onboarding-slots : le jeton de gestion d'un appel d'accueil EST la garde du chemin " +
    "public ; sa résolution précède donc, par construction, la garde agent de la branche d'à côté.",
};

// `CANAUX_NOMMES` — les primitives d'envoi dont l'URL ne se lit pas au site d'appel — vit
// dans le lecteur (`edge-guard-order.mjs`), à côté des motifs d'URL qu'il complète ; la porte
// vérifie plus bas que chacun existe encore et porte encore son appel d'envoi.

/**
 * PÉRIMÈTRE DES DESTINATAIRES de chaque expéditeur d'e-mail qui ne consulte PAS
 * `guardOutboundEmail` avant son premier envoi — table FERMÉE (S17, 13.09.2026).
 *
 * L'inventaire vient du CODE (`expeditionGestionnaire`) ; cette table n'en est que la
 * justification. Chaque entrée nomme les canaux atteints (`resend` : l'identité MEGGA,
 * signée DKIM getmegga.com ; `boite` : la boîte de l'agent ; `auth` : GoTrue) et À QUI la
 * fonction écrit — d'où vient l'adresse. Le motif S1 est une adresse prise dans le CORPS de
 * la requête : quand c'est le cas, l'entrée doit le dire en toutes lettres.
 *
 * Relu fonction par fonction le 13.09.2026.
 */
const PERIMETRES_EXPEDITEURS = {
  'admin-monitoring': {
    canaux: ['resend'],
    perimetre: "L'allowlist super-admin (RPC `super_admin_allowlist`, `_shared/admin-alerts.ts`) — alertes d'exploitation, dédoublonnées 24 h.",
  },
  'admin-user-lifecycle': {
    canaux: ['resend'],
    perimetre: "Le compte que vise un super-admin (`requireSuperAdmin`), à son e-mail d'AUTHENTIFICATION (`auth.admin.getUserById`) — lien de réinitialisation ; jamais un compte allowlisté.",
  },
  'agency-verification-notify': {
    canaux: ['resend'],
    perimetre: "Les dirigeants (admin, manager) de l'agence désignée par le secret de service, à défaut l'adresse de l'agence (`noticeRecipients`) — lus en base ; le corps ne porte que `agency_id`.",
  },
  'appointment-book': {
    canaux: ['resend'],
    perimetre: 'Le contact du dossier KYC que désigne le lien SIGNÉ (`verifyMagicLinkToken` → `kyc_magic_links.contact_id`) — adresse lue sur la fiche contact.',
  },
  'appointment-manage': {
    canaux: ['resend'],
    perimetre: "Le contact du rendez-vous que désigne le jeton SIGNÉ `appt` (`appointments.contact_id`) — adresse lue sur la fiche contact.",
  },
  'detect-new-device': {
    canaux: ['resend'],
    perimetre: "L'utilisateur authentifié lui-même (`auth.getUser`), à son e-mail d'authentification — alerte de connexion depuis un nouvel appareil.",
  },
  'magic-link-send-email': {
    canaux: ['resend'],
    perimetre: "Le contact du lien magique KYC (`kyc_magic_links.contact_id`), lien désigné par son id ; en appel d'agent, le lien doit appartenir à SON agence (garde inter-agences), en appel interne (secret de service : `magic-link-create`, ou l'action WhatsApp `executeSendKycLink`), l'appelant vient d'émettre ce lien pour un contact de SON agence.",
  },
  'mail-send': {
    canaux: ['boite'],
    perimetre: "LIBRE, par conception : c'est un client de messagerie. L'envoi part d'une boîte connectée (Gmail, Microsoft Graph) que l'appelant a le droit de voir (`loadVisibleAccount` : la sienne, ou une boîte que son propriétaire partage avec l'agence), sous l'identité de cette boîte et les quotas de son fournisseur — jamais l'identité ni la signature DKIM de MEGGA.",
  },
  'onboarding-call-book': {
    canaux: ['resend'],
    perimetre: "L'agent authentifié qui réserve (son profil), et la boîte d'équipe de l'hôte d'accueil MEGGA (`onboarding_hosts.calendar_email`, à défaut son profil).",
  },
  'onboarding-call-manage': {
    canaux: ['resend'],
    perimetre: "L'agent qui a réservé l'appel (`onboarding_calls.booked_by`) et la boîte de l'hôte ; appel désigné par son jeton de gestion (uuid) ou par un super-admin.",
  },
  'onboarding-call-reminder': {
    canaux: ['resend'],
    perimetre: "L'agent qui a réservé l'appel (`onboarding_calls.booked_by` → profil) — rappel J-1 lancé par pg_cron sous le secret de service.",
  },
  'send-reminder-email': {
    canaux: ['resend'],
    perimetre: 'Le contact d\'un rappel créé par `automation-engine` (`reminders.contact_id` → fiche contact), secret de service seul ; registre STOP consulté (`emailSendAllowed`).',
  },
  'send-team-invite': {
    canaux: ['resend'],
    perimetre: "⚠ LIBRE : l'adresse que saisit un admin ou un manager d'agence (`body.email`), dans un gabarit fixe. Seules bornes : le rôle, une invitation en attente par adresse, et un plafond de sièges qui lit `get_agency_member_count` — RPC absente des migrations actives ET de `src/types/database.ts` au 13.09.2026. Aucun quota d'envoi. Relevé S17, à resserrer.",
  },
  'send-visit-email': {
    canaux: ['resend'],
    perimetre: "L'acheteur (`visits.buyer_email`, à défaut son contact) ou l'agent de la visite — lus sur la ligne `visits` ; secret de service seul (pg_cron).",
  },
  'weekly-digest': {
    canaux: ['resend'],
    perimetre: 'Les agents inscrits (profils agent, manager, admin, non désabonnés) — digest hebdomadaire lancé par pg_cron.',
  },
  'weekly-report': {
    canaux: ['resend'],
    perimetre: "Les super-admins allowlistés, à leur e-mail d'AUTHENTIFICATION (`selectReportRecipients`) — même définition que la garde.",
  },
  'whatsapp-optin-invite': {
    canaux: ['resend'],
    perimetre: "Un contact de l'agence de l'appelant (`sendOptinInvite` filtre `contacts` par `agency_id` en SQL), à l'adresse de sa fiche.",
  },
  'whatsapp-webhook': {
    canaux: ['resend'],
    perimetre: "Le même envoi que `whatsapp-optin-invite` (`sendOptinInvite`), déclenché par l'exécuteur du copilote WhatsApp pour un contact de l'agence de l'agent identifié par son numéro.",
  },
};

/**
 * Exemptions TEMPORAIRES de la passe « ordre » : une fonction qui agit avant sa garde, dont
 * le correctif n'a pas pu être fait ici. Chaque entrée nomme ce qui s'exécute avant la
 * garde, si c'est exploitable, et son point d'audit. Vide au 13.09.2026 — les deux
 * constats de la première mesure étaient des gardes non nommées (voir `accept-team-invite`
 * et `RPC_LECTURE`). Une entrée dont la fonction ne viole plus rien, ou n'existe plus,
 * rougit.
 *
 * @type {Record<string, { avantGarde: string, exploitable: string, audit: string }>}
 */
const EXEMPTIONS_ORDRE_TEMPORAIRES = {};

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
/** Toutes les sources edge lues, par chemin : les passes S17 les relisent comme modules. */
const sources = new Map();
const lirePasse = (passe, file) => {
  let source;
  try {
    source = readFileSync(file, 'utf8');
  } catch {
    return;
  }
  lus[passe]++;
  sources.set(file.replace(/\\/g, '/'), source);
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

// ── Passes S17 : ordre, chargement, expéditeurs ───────────────────────────
const modules = new Map([...sources].map(([chemin, source]) => [chemin, lireModule(source, chemin)]));
const reglesAnalyse = {
  gardes: SHARED_GUARDS,
  rpcLecture: Object.keys(RPC_LECTURE),
  canauxNommes: CANAUX_NOMMES,
};
const analyse = creerAnalyse(modules, reglesAnalyse);
/** Nom de fonction → module de son index.ts. */
const fonctions = new Map(
  dirs.filter((d) => modules.has(`${FUNCTIONS_DIR}/${d}/index.ts`)).map((d) => [d, modules.get(`${FUNCTIONS_DIR}/${d}/index.ts`)]),
);

const ordreS17 = verdictOrdre({
  analyse,
  fonctions,
  marqueurs: BESPOKE_GUARDS,
  ouvertes: Object.keys(OPEN_BY_DESIGN),
  exemptions: EXEMPTIONS_ORDRE_TEMPORAIRES,
});
const expeditionS17 = verdictExpediteurs({ analyse, fonctions, perimetres: PERIMETRES_EXPEDITEURS });

// Au chargement : TOUS les modules, `_shared/` compris — un module partagé s'exécute à
// l'import, avant le gestionnaire de chaque fonction qui l'importe.
const effetsAuChargement = [...modules.values()].flatMap((mod) => analyse.effetsAuChargement(mod));

// RPC de lecture : volatilité relue dans les migrations, et au moins un appelant vivant.
const migrations = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => ({ fichier: f, sql: readFileSync(join(MIGRATIONS_DIR, f), 'utf8') }));
const lecturesInvalides = lecturesRpcInvalides(Object.keys(RPC_LECTURE), volatilitesSql(migrations), modules.values());
const canauxPerimes = CANAUX_NOMMES
  .map((c) => ({ c, raison: canalNommePerime(modules, c) }))
  .filter((x) => x.raison);

// Témoin S17 : le lecteur d'ordre doit voir une écriture posée avant la garde. Un lecteur
// muet rendrait ✓ sur les 86 gestionnaires — le même vert pour la mauvaise raison.
const TEMOIN_ORDRE = lireModule([
  'serve(async (req) => {',
  "  await admin.from('journal').insert({ vu: true })",
  '  const auth = await requireAgentAuth(req, cors)',
  '})',
].join('\n'), 'temoin/index.ts');
const lecteurOrdreVoit = creerAnalyse(new Map([[TEMOIN_ORDRE.chemin, TEMOIN_ORDRE]]), reglesAnalyse)
  .ordreGestionnaire(TEMOIN_ORDRE).effets.length === 1;

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

// ── Verdicts S17 ──────────────────────────────────────────────────────────
const via = (e) => (e.via?.length ? ` — via ${e.via.map((v) => `${v.nom}() l.${v.ligne}`).join(' → ')}` : '');
const ou = (e) => `${e.chemin}:${e.ligne}`;

if (!lecteurOrdreVoit) {
  failed = true;
  console.error(
    '\n✖ Passe « ordre » : le lecteur ne voit plus l\'écriture témoin posée avant requireAgentAuth.\n' +
    '  Un lecteur muet rendrait ✓ sur tous les gestionnaires : vérifier scripts/_shared/edge-guard-order.mjs.\n',
  );
}

if (ordreS17.illisibles.length) {
  failed = true;
  console.error(`\n✖ ${ordreS17.illisibles.length} gestionnaire(s) illisible(s) — ni un seul serve(…), ni une forme connue :\n`);
  for (const d of ordreS17.illisibles) console.error(`    supabase/functions/${d}/index.ts`);
  console.error(
    '\n  La passe « ordre » refuse de conclure sur ce qu\'elle n\'a pas lu. Écrire le gestionnaire\n' +
    '  en ligne (`serve(async (req) => { … })`) ou par le nom d\'une fonction du module.\n',
  );
}

if (ordreS17.violations.length) {
  failed = true;
  console.error(`\n✖ ${ordreS17.violations.length} gestionnaire(s) agissent AVANT leur première garde :\n`);
  for (const { dir, effets, garde } of ordreS17.violations) {
    console.error(`    supabase/functions/${dir}/index.ts — première garde : ${garde ? `${garde.type} (${ou(garde)})` : 'AUCUNE atteinte'}`);
    for (const e of effets) console.error(`      · [${e.type}] ${e.detail} — ${ou(e)}${via(e)}\n          ${e.texte}`);
  }
  console.error(
    '\n  Déployées --no-verify-jwt, ces lignes s\'exécutent pour N\'IMPORTE QUEL appelant. Remonter\n' +
    '  l\'appel de garde au-dessus du premier effet. Si l\'effet EST la vérification (jeton résolu\n' +
    '  en base, débit anti-force-brute), nommer cette garde dans BESPOKE_GUARDS, ou la lecture dans\n' +
    '  RPC_LECTURE (volatilité vérifiée) ; en dernier recours, une exemption TEMPORAIRE dans\n' +
    '  EXEMPTIONS_ORDRE_TEMPORAIRES, avec ce qui s\'exécute, si c\'est exploitable, et le point d\'audit.\n',
  );
}

if (ordreS17.gardesNonAtteintes.length) {
  failed = true;
  console.error(`\n✖ ${ordreS17.gardesNonAtteintes.length} gestionnaire(s) n'atteignent AUCUNE garde :\n`);
  for (const d of ordreS17.gardesNonAtteintes) console.error(`    supabase/functions/${d}/index.ts`);
  console.error(
    '\n  La garde est appelée quelque part dans le fichier, mais aucun chemin du gestionnaire\n' +
    '  n\'y mène — un helper jamais appelé ne garde rien.\n',
  );
}

if (ordreS17.exemptionsPerimees.length) {
  failed = true;
  console.error(`\n✖ ${ordreS17.exemptionsPerimees.length} exemption(s) d'ordre sont PÉRIMÉES :\n`);
  for (const d of ordreS17.exemptionsPerimees) console.error(`    ${d}`);
  console.error('\n  La fonction ne viole plus rien, ou n\'existe plus : retirer l\'entrée de EXEMPTIONS_ORDRE_TEMPORAIRES.\n');
}

if (effetsAuChargement.length) {
  failed = true;
  console.error(`\n✖ ${effetsAuChargement.length} effet(s) au CHARGEMENT d'un module, hors gestionnaire :\n`);
  for (const e of effetsAuChargement) console.error(`    [${e.type}] ${e.detail} — ${ou(e)}${via(e)}`);
  console.error('\n  Ce code s\'exécute au démarrage de la fonction, avant toute requête et toute garde.\n');
}

if (expeditionS17.sansPerimetre.length) {
  failed = true;
  console.error(`\n✖ ${expeditionS17.sansPerimetre.length} expéditeur(s) d'e-mail sans périmètre de destinataires :\n`);
  for (const { dir, canaux, premier } of expeditionS17.sansPerimetre) {
    console.error(`    supabase/functions/${dir}/index.ts — canal ${canaux.join(', ')}, premier envoi ${premier ? `${ou(premier)}${via(premier)}` : '?'}`);
  }
  console.error(
    '\n  C\'est la forme du relais ouvert S1 : un envoi dont rien ne borne le destinataire.\n' +
    '    · e-mail piloté par un agent → guardOutboundEmail AVANT le premier envoi\n' +
    '      (périmètre → registre STOP → quota, _shared/email-recipient.ts) ;\n' +
    '    · destinataire fixé par le serveur → une entrée dans PERIMETRES_EXPEDITEURS qui dit à qui\n' +
    '      la fonction écrit, et d\'où vient l\'adresse.\n',
  );
}

if (expeditionS17.superflus.length) {
  failed = true;
  console.error(`\n✖ ${expeditionS17.superflus.length} entrée(s) de PERIMETRES_EXPEDITEURS pour une fonction qui consulte guardOutboundEmail :\n`);
  for (const d of expeditionS17.superflus) console.error(`    ${d}`);
  console.error('\n  La garde de sortie juge désormais le destinataire : retirer l\'entrée.\n');
}

if (expeditionS17.perimes.length) {
  failed = true;
  console.error(`\n✖ ${expeditionS17.perimes.length} entrée(s) de PERIMETRES_EXPEDITEURS sont PÉRIMÉES :\n`);
  for (const { dir, raison } of expeditionS17.perimes) console.error(`    ${dir} — ${raison}`);
  console.error('\n  Une table périmée finit par couvrir le prochain expéditeur du même nom : retirer l\'entrée.\n');
}

if (expeditionS17.canauxChanges.length) {
  failed = true;
  console.error(`\n✖ ${expeditionS17.canauxChanges.length} expéditeur(s) n'envoient plus par le canal que leur périmètre décrit :\n`);
  for (const { dir, declares, atteints } of expeditionS17.canauxChanges) {
    console.error(`    ${dir} — déclaré ${declares.join(', ')}, atteint ${atteints.join(', ')}`);
  }
  console.error('\n  Relire le périmètre : changer de canal change qui signe l\'e-mail, et souvent à qui il part.\n');
}

if (lecturesInvalides.length) {
  failed = true;
  console.error(`\n✖ ${lecturesInvalides.length} exception(s) de RPC_LECTURE ne tiennent plus :\n`);
  for (const { nom, raison } of lecturesInvalides) console.error(`    ${nom} — ${raison}`);
  console.error('\n  Une RPC n\'est une lecture que si le schéma l\'interdit d\'écrire (STABLE ou IMMUTABLE).\n');
}

if (canauxPerimes.length) {
  failed = true;
  console.error(`\n✖ ${canauxPerimes.length} canal(aux) d'envoi nommé(s) ne sont plus ce que la porte croit :\n`);
  for (const { c, raison } of canauxPerimes) console.error(`    ${c.module} ${c.nom}() — ${raison}`);
  console.error(
    '\n  Mettre à jour CANAUX_NOMMES : un canal renommé que la porte ne suit plus rendrait ses\n' +
    '  expéditeurs invisibles à la passe « expéditeurs ».\n',
  );
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
console.log(
  `✓ Ordre garde → effet : ${ordreS17.lus} gestionnaire(s) lus, aucun effet avant leur ` +
  `première garde, aucun au chargement (${ordreS17.exemptees.length} exemption(s) temporaire(s), ` +
  `${Object.keys(RPC_LECTURE).length} RPC de lecture vérifiée(s)).`,
);
const parGarde = expeditionS17.expediteurs.filter((x) => x.parPerimetre).length;
console.log(
  `✓ Expéditeurs e-mail : ${expeditionS17.expediteurs.length} fonction(s) envoient — ${parGarde} par ` +
  `guardOutboundEmail, ${expeditionS17.expediteurs.length - parGarde} au périmètre nommé.`,
);
