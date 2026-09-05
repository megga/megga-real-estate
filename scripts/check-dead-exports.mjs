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
  'src/components/crm/CrmShell.tsx:CrmIconRailProps', // re-export type (faux positif ts-prune)
  // Faux positif : le symbole EST importé (src/lib/geoLanguage.ts:29) et lu
  // (ligne 101), sur un chemin joignable depuis main.tsx. Preuve : retirer le
  // mot-clé `export` fait échouer tsc en TS2614. ts-prune ne compte pas l'usage
  // — const évalué au chargement du module, sans usage interne au fichier.
  'src/i18n/index.ts:hasExplicitLanguage',
  // Même angle mort, même fichier, ajouté le 03.08.2026 : `switchLanguage` EST importé
  // et appelé par src/components/crm-mobile/more/MobileMoreScreen.tsx:9 et
  // src/components/crm-identity/IdentityShell.tsx:67, tous deux joignables depuis
  // main.tsx. Preuve : retirer le mot-clé `export` fait échouer tsc. C'est LA fonction
  // qui charge le bundle de langue AVANT de basculer i18next — la retirer ramènerait le
  // détour par le français et le double `languageChanged` corrigés le même jour.
  'src/i18n/index.ts:switchLanguage',
  // ⚠ L'exemption de `PageAujourdhui` a vécu ici du 03.08 jusqu'à cette fusion. Elle
  // gardait l'ancien cockpit le temps que le concept H reprenne son câblage Supabase.
  // La condition de levée est remplie (Lot 3 : « retire l'ancien cockpit »), le fichier
  // n'existe plus, et une exemption qui désigne un chemin mort ne protège plus rien —
  // elle survit juste assez longtemps pour couvrir un homonyme un jour.
  // lib API / compliance conservée (surface API + données réglementaires) :
  'src/lib/posthog.ts:identifyUser', 'src/lib/posthog.ts:trackEvent', 'src/lib/posthog.ts:resetPostHog',
  'src/lib/sentry.ts:identifySentryUser', 'src/lib/sentry.ts:clearSentryUser',
  'src/lib/constants.ts:Canton', 'src/lib/constants.ts:KycStatus', 'src/lib/constants.ts:KycType',
  'src/lib/constants.ts:FATF_HIGH_RISK_COUNTRIES', 'src/lib/constants.ts:FATF_INCREASED_MONITORING',
  'src/lib/utils.ts:formatSurface',          // formatteur m² testé (tests/unit/utils.spec.ts)
  // ── Messagerie CRM, lot 2 T2.2 : la bibliothèque PURE précède ses écrans ────
  // ⚠ Même angle mort que `formatSurface` : `ts-prune` tourne sur
  // `tsconfig.app.json`, dont l'`include` est `["src"]` — un module que seules
  // les specs lisent lui paraît mort. Ces six-là ONT un lecteur
  // (`tests/unit/mail-format.spec.ts`, `mail-sanitize.spec.ts`), et ils en
  // auront un second dans l'écran : `format` en T2.5 (la ligne de liste),
  // `sanitize` en T2.6 (le corps du message).
  // ⛔ À RETIRER quand ces tâches livrent : une exemption qui survit à son motif
  // couvre le fichier entier pour toujours.
  'src/lib/mail/format.ts:mailDateLabel', 'src/lib/mail/format.ts:initialsOf',
  'src/lib/mail/format.ts:displayAddress', 'src/lib/mail/format.ts:fileSizeLabel',
  'src/lib/mail/sanitize.ts:sanitizeMailHtml', 'src/lib/mail/sanitize.ts:buildBodySrcdoc',
  // ⚠ `oauthPopup` est SORTI de cette liste le 04.09.2026, comme annoncé :
  // `useMailOAuthPopup` (T2.3) lit ses deux exports. Une exemption qui survit à
  // son motif couvre le fichier pour toujours.
  //
  // ── Messagerie CRM, lot 2 T2.3 : les hooks précèdent l'écran qui les monte ──
  // Le lot livre la couche de DONNÉES avant les trois zones du bento, exprès :
  // T2.4-T2.11 les consomment, tâche par tâche. Chaque entrée nomme la sienne, et
  // s'en va avec elle.
  // ⚠ TROIS ENTRÉES SONT PARTIES AVEC T2.4, comme annoncé : `useMailLabels`,
  // `useMailRealtime` et `useMailFolderCounts` sont lus par `MessagerieApp` (le rail).
  // Une exemption qui survit à son motif couvre le fichier pour toujours.
  'src/hooks/useMailThreads.ts:useMailThreads',               // T2.5 — la liste
  'src/hooks/useMailActions.ts:useMailActions',               // T2.5 — gestes optimistes
  'src/hooks/useMailThread.ts:useMailThread',                 // T2.6 — le fil ouvert
  'src/hooks/useMailDrafts.ts:useMailDrafts',                 // T2.7 — « Nouveau message »
  'src/hooks/useMailSend.ts:useMailSend',                     // T2.7 — l'envoi
  'src/hooks/useMailOAuthPopup.ts:useMailOAuthPopup',         // T2.9 — assistant « Ajouter une boîte »
  'src/hooks/useMailAttachmentBlob.ts:useMailAttachmentBlob', // T2.11 — aperçu de pièce
  // ── T2.4 : la coquille des SEPT modales précède la première d'entre elles ───
  // Le plan la place ici parce qu'elle fixe le contrat (portail, voile, piège de
  // focus, z-index 300) avant qu'aucune modale ne l'ait choisi de son côté. Sa
  // première consommatrice est « Nouveau message ».
  'src/components/crm/messagerie/MailModalShell.tsx:MailModalShell',  // T2.7
  'src/components/crm/messagerie/MailModalShell.tsx:MailCloseButton', // T2.7
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

// ─── SECONDE PASSE : l'angle mort de ts-prune ────────────────────────────────
//
// ⛔ `ts-prune` COMPTE TOUS LES EXPORTS D'UN MODULE ATTEINT PAR `import()`
// COMME VIVANTS. Il voit l'import dynamique du MODULE et ne sait pas résoudre
// quel MEMBRE est lu (`.then((m) => ({ default: m.X }))`). Prouvé par expérience
// contrôlée le 15 août 2026 : un export nommé `ExportManifestementMort` ajouté à
// une page passait la porte au VERT, et sept exports provablement morts
// d'`AuthBentoPage` vivaient là depuis des mois sous un « baseline propre ».
//
// ⚠ ET C'EST L'ANGLE MORT QUI COMPTE LE PLUS ICI : toute l'architecture de
// routes passe par `lazy(() => import(…))`. Mesuré, 78 modules ne sont atteints
// QUE dynamiquement — c'est-à-dire que la porte était aveugle là où le code mort
// s'accumule, pas dans un recoin.
//
// ── CE QUE CETTE PASSE FAIT, ET SURTOUT CE QU'ELLE NE FAIT PAS ───────────────
// Elle n'essaie PAS de refaire l'analyse de ts-prune. Elle ne regarde que les
// modules atteints EXCLUSIVEMENT par `import()` : un module aussi importé
// statiquement — même une seule fois, même en relatif — est déjà couvert.
// Restreindre le périmètre est ce qui la rend juste ; trois versions plus larges
// ont SUR-signalé, ce qui est la pire façon de casser une porte.
import { readdirSync, existsSync } from 'node:fs';
import { readFileSync as lire } from 'node:fs';
import { join, dirname, resolve as resoudreChemin } from 'node:path';

const RACINE = resoudreChemin(process.cwd());
const SRC = join(RACINE, 'src');

function parcourir(d, out = []) {
  if (!existsSync(d)) return out;
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '_archived') continue;
    const p = join(d, e.name);
    e.isDirectory() ? parcourir(p, out) : /\.tsx?$/.test(e.name) && out.push(p);
  }
  return out;
}

/** Résout un spécifieur (alias `@/` ou relatif) vers un fichier réel. */
function resoudreModule(spec, depuis) {
  const base = spec.startsWith('@/') ? join(SRC, spec.slice(2)) : resoudreChemin(dirname(depuis), spec);
  for (const c of [base + '.tsx', base + '.ts', join(base, 'index.tsx'), join(base, 'index.ts')]) {
    if (existsSync(c)) return c;
  }
  return null;
}

// ⚠ `tests/` EST BALAYÉ, et son absence était un défaut : douze helpers
// d'`AdminKybReviewPage` n'y sont importés que par une spec, et une passe qui
// ne lit que `src/` les donnait tous pour morts.
const fichiers = [...parcourir(SRC), ...parcourir(join(RACINE, 'tests'))];
const statiques = new Set();
const dynamiques = new Map();

for (const f of fichiers) {
  const code = lire(f, 'utf8');
  for (const m of code.matchAll(/(?:^|[\s;])(?:import|export)\s[^;]*?from\s*['"]([^'"]+)['"]/g)) {
    const r = resoudreModule(m[1], f);
    if (r) statiques.add(r);
  }
  for (const m of code.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const r = resoudreModule(m[1], f);
    if (r) statiques.add(r);
  }
  for (const m of code.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const r = resoudreModule(m[1], f);
    if (!r) continue;
    // ⚠ UNE FENÊTRE APRÈS L'APPEL, jamais un groupe optionnel paresseux : celui
    // que j'avais écrit s'arrêtait à la première `)` — celle de `(m)` — et
    // rendait donc le membre RÉELLEMENT lu pour un mort.
    const suite = code.slice(m.index + m[0].length, m.index + m[0].length + 300);
    const noms = [...suite.matchAll(/\b\w+\.([A-Za-z_]\w*)/g)].map((x) => x[1]);
    const s = dynamiques.get(r) ?? new Set();
    (noms.length ? noms : ['default']).forEach((n) => s.add(n));
    dynamiques.set(r, s);
  }
}

let exclusifs = 0;
for (const [f, lus] of [...dynamiques].sort((a, b) => a[0].localeCompare(b[0]))) {
  if (statiques.has(f)) continue;
  exclusifs++;
  const chemin = f.slice(RACINE.length + 1);
  if (ALLOW_FILES.has(chemin)) continue;
  for (const m of lire(f, 'utf8').matchAll(/^export\s+(?:async\s+)?(?:function|const|class)\s+(\w+)/gm)) {
    if (lus.has(m[1])) continue;
    if (ALLOW_SYMBOLS.has(`${chemin}:${m[1]}`)) continue;
    offenders.push(`${chemin} - ${m[1]} (chargé en lazy : ce membre n'est lu à AUCUN site d'import)`);
  }
}

// Sans ce plancher, un `src/` déplacé rendrait « rien à analyser » et la passe
// passerait au vert sur un dépôt qu'elle ne lit plus.
if (exclusifs < 10) {
  console.error(`✗ passe lazy : seulement ${exclusifs} module(s) exclusivement dynamique(s) — l'analyse ne mesure plus rien.`);
  process.exit(1);
}

if (offenders.length === 0) {
  console.log(`✓ Aucun export mort (baseline propre — dont ${exclusifs} modules chargés en lazy, invisibles pour ts-prune).`);
  process.exit(0);
}
console.error(`✗ ${offenders.length} export(s) mort(s) détecté(s) — retire-les ou justifie-les dans scripts/check-dead-exports.mjs :`);
for (const o of offenders) console.error('  ' + o);
process.exit(1);
