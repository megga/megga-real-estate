#!/usr/bin/env node
/**
 * Défend le TYPAGE du client Supabase contre sa propre extinction.
 *
 * Pourquoi ce script existe. `src/types/database.ts` est auto-généré, et rien ne
 * surveillait sa fraîcheur — alors que le dépôt a DÉJÀ payé ce défaut : l'en-tête de
 * `check-migration-drift.mjs` raconte comment un `database.ts` figé a laissé TypeScript
 * valider le code contre un schéma qui n'existait plus, cassant quatre gestes du pipeline
 * agent pendant une semaine en juillet 2026. Ce contrôle-là compare migrations → base ;
 * personne ne comparait types → base.
 *
 * Mesuré le 01.08.2026 : 15 relations et 64 fonctions manquaient au fichier — tout le
 * socle de la console — et 16 sites dans 14 fichiers castaient le client pour compiler
 * malgré tout. Un cast ne masque pas seulement un objet absent : il éteint la
 * vérification pour TOUS les appels du fichier, et se recopie (« c'est le pattern du
 * repo »). Trois des justifications écrites étaient d'ailleurs FAUSSES — leur cible était
 * bien dans les types.
 *
 * ⚠ CE QUE CE SCRIPT NE FAIT PAS, ET POURQUOI. Il ne compare pas la liste des FONCTIONS
 * de la base à celle du fichier. Mesuré : 770 fonctions non-trigger en `public` contre 420
 * émises, et le générateur n'exclut ni les extensions (les `_postgis_*` sont dans le
 * fichier) ni les agrégats. Son filtre exact nous échappe, et une porte qui se trompe de
 * périmètre crie au loup — c'est la leçon déjà écrite dans le script voisin. On garde donc
 * des propriétés dont on peut prouver l'exactitude.
 *
 * ⚠ CONSÉQUENCE DIRECTE DE CE TROU, à connaître avant de s'y fier : une fonction créée
 * par une migration et absente du fichier est INVISIBLE ici. Elle ne se manifeste qu'au
 * premier `.rpc('son_nom')` (propriété 2), c'est-à-dire au moment où quelqu'un essaie de
 * la consommer — et la porte ressemble alors à l'obstacle, alors que c'est le fichier qui
 * est en retard. Le réflexe correct est de régénérer, jamais de caster.
 *
 * Usage :  node scripts/check-types-freshness.mjs            (statique seul, mode PR)
 *          SUPABASE_ACCESS_TOKEN=… … --prod                  (+ comparaison production)
 *
 * `--prod` EXIGE le jeton et sort en 2 s'il manque, comme les deux contrôles voisins.
 * Sans le drapeau, la comparaison est sautée et le verdict le dit explicitement.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const PROJECT_REF = 'eayczugyrvmtqnnmvjod';
const TYPES = 'src/types/database.ts';
const SRC = 'src';

// ─── Lecture du fichier de types ─────────────────────────────────────────────

/**
 * Noms de premier niveau sous `Tables: {` / `Views: {` / `Functions: {`.
 *
 * ⚠ L'ancrage `(?<![A-Za-z0-9_])` n'est pas décoratif : sans lui, une recherche naïve
 * matche À CHAQUE POSITION et rend des centaines de faux manquants (`ncy_activation`,
 * `gency_activation`…). Erreur commise pendant l'audit du 01.08 avant d'être corrigée —
 * elle produit un contrôle qui hurle sur un fichier parfaitement à jour.
 */
function clesDeSection(texte, entete) {
  const debut = texte.indexOf(entete);
  if (debut < 0) return null;
  const ouvrante = texte.indexOf('{', debut);
  let profondeur = 0;
  let i = ouvrante;
  for (; i < texte.length; i++) {
    if (texte[i] === '{') profondeur++;
    else if (texte[i] === '}' && --profondeur === 0) break;
  }
  const corps = texte.slice(ouvrante + 1, i);
  const cles = new Set();
  const motif = /(?<![A-Za-z0-9_])([A-Za-z_][A-Za-z0-9_]*)\s*:/y;
  let d = 0;
  for (let p = 0; p < corps.length; p++) {
    if (corps[p] === '{') d++;
    else if (corps[p] === '}') d--;
    else if (d === 0) {
      motif.lastIndex = p;
      const m = motif.exec(corps);
      if (m) { cles.add(m[1]); p = motif.lastIndex - 1; }
    }
  }
  return cles;
}

const types = readFileSync(TYPES, 'utf8');
const tablesFichier = clesDeSection(types, 'Tables: {');
const vuesFichier = clesDeSection(types, 'Views: {');
const fonctionsFichier = clesDeSection(types, 'Functions: {');

// Garde anti-contrôle creux : un parseur cassé rendrait « rien ne manque » sur zéro clé.
// C'est le motif du vert sans assertion, rencontré deux fois sur ce chantier.
for (const [nom, jeu, mini] of [['Tables', tablesFichier, 50], ['Views', vuesFichier, 1], ['Functions', fonctionsFichier, 200]]) {
  if (!jeu || jeu.size < mini) {
    console.error(`✗ Lecture de ${TYPES} suspecte : ${jeu ? jeu.size : 'aucune'} clé sous \`${nom}\`, ${mini} attendues au moins.`);
    console.error('  Le format du générateur a changé, ou le parseur est cassé — ce contrôle ne prouve plus rien.');
    process.exit(1);
  }
}
console.log(`${TYPES} : ${tablesFichier.size} tables, ${vuesFichier.size} vues, ${fonctionsFichier.size} fonctions.`);

// ─── Parcours de src/ ────────────────────────────────────────────────────────

function fichiersSource(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) fichiersSource(p, acc);
    else if (['.ts', '.tsx'].includes(extname(p))) acc.push(p);
  }
  return acc;
}
const sources = fichiersSource(SRC);

// ─── Propriété 1 : aucun contournement du client typé ────────────────────────

/**
 * Ce qui éteint la vérification EN MASSE, par ordre de nocivité.
 *
 * Les trois premiers motifs castent le client ou l'une de ses méthodes : tout le fichier
 * perd la vérification. Les deux derniers visent le DISPATCHER — une fonction qui relaie
 * vers `.rpc` en typant son NOM `string` ou ses ARGUMENTS `Record<string, unknown>`.
 * C'est la forme la plus insidieuse, et surtout celle réellement rencontrée ici
 * (`callRpc`, `rpcByToken`, le `rpc<T>` du cockpit) : elle éteint la vérification pour
 * tous ses appelants d'un coup, sans qu'aucun `as` n'apparaisse à leur ligne. La forme
 * saine indexe les arguments par le nom : `<N extends keyof PgFns>(fn: N, args: PgFns[N]['Args'])`.
 *
 * ⚠ Le balayage porte sur le fichier ENTIER, pas ligne à ligne : un cast coupé en deux
 * par le formateur traversait un test par ligne. Les motifs ne sont pas non plus ancrés
 * sur l'identifiant `supabase` — un `import { supabase as sb }` le contournait.
 *
 * ⚠ CE QU'ILS NE VOIENT TOUJOURS PAS, et il faut le dire plutôt que de le laisser croire :
 * `as any`, `@ts-ignore`, et un dispatcher dont le relais est séparé de sa signature par
 * plus de ~400 caractères. Le bon niveau serait une règle ESLint sur l'AST ; ceci couvre
 * les formes constatées au dépôt, pas la classe entière.
 */
const CONTOURNEMENTS = [
  [/\w+\s+as\s+unknown\s+as\s+SupabaseClient/g, 'client entier casté en `SupabaseClient`'],
  [/\w+\.rpc\s+as\s+unknown\s+as/g, '`.rpc` casté'],
  [/\w+\.from\s+as\s+unknown\s+as/g, '`.from` casté'],
  [/\(\s*(\w+)\s*:\s*string\b[^)]*\)[\s\S]{0,400}?\.rpc\(\s*\1\b/g,
    'dispatcher dont le NOM de RPC est typé `string`'],
  [/\((?:[^)]*,)?\s*(\w+)\s*:\s*Record<\s*string\s*,\s*unknown\s*>[^)]*\)[\s\S]{0,400}?\.rpc\([^)]*?\b\1\b/g,
    'dispatcher dont les ARGUMENTS sont typés `Record<string, unknown>`'],
];

/** `.rpc('nom')` littéral — le receveur importe peu, c'est le nom qu'on veut. */
const RPC = /\.rpc\(\s*['"]([a-z_][a-z0-9_]*)['"]/gi;

/** Numéro de ligne 1-indexé d'un index de caractère, pour un rapport cliquable. */
const ligneDe = (texte, index) => texte.slice(0, index).split('\n').length;

// Une seule lecture par fichier : les deux propriétés se calculent dans la même passe.
const contournements = [];
const manquantes = new Map();
for (const f of sources) {
  const texte = readFileSync(f, 'utf8');
  for (const [motif, quoi] of CONTOURNEMENTS) {
    for (const m of texte.matchAll(motif)) {
      contournements.push({ f, ligne: ligneDe(texte, m.index), quoi });
    }
  }
  for (const m of texte.matchAll(RPC)) {
    if (!fonctionsFichier.has(m[1])) {
      if (!manquantes.has(m[1])) manquantes.set(m[1], []);
      manquantes.get(m[1]).push(f);
    }
  }
}

// ─── Propriété 3 (prod, si jeton) : aucune table ni vue vivante absente ───────

/**
 * Tables et vues, dans les DEUX SENS.
 *
 * ⚠ La présence se teste sur l'UNION `Tables ∪ Views`, jamais section par section : le
 * jour où le générateur range une matview sous `Tables` (ou une table partitionnée sous
 * `Views`), un tri par sorte déclarerait « absente » une relation pourtant présente.
 * `pg_class` garantit déjà l'unicité de `relname` dans `public` ; la sorte ne sert donc
 * qu'à étiqueter le rapport.
 *
 * ⚠ ET LE SENS INVERSE COMPTE AUTANT — c'est même l'incident cité en tête de ce fichier.
 * Une relation SUPPRIMÉE en base mais survivante dans `database.ts` laisse
 * `supabase.from('<disparue>')` typechecker, et le geste casse en 42P01 à l'exécution.
 * Le contrôle voisin ne le voit pas non plus : il compare migrations → base.
 */
const SQL = `
  select c.relname as nom,
         case when c.relkind in ('r','p') then 'table' else 'vue' end as sorte
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r','p','v','m')
   order by 1`;

/**
 * Boucle de patience, reprise des deux contrôles voisins du même workflow.
 * `migration-drift.yml` part sur `push: main` pendant que `deploy.yml`, sérialisé,
 * applique encore les migrations : sans elle, tout merge qui SUPPRIME une relation et
 * régénère les types dans la même PR rougit à tort le temps du déploiement.
 */
const TENTATIVES = Number(process.env.TYPES_DRIFT_TRIES ?? 10);
const ATTENTE_MS = Number(process.env.TYPES_DRIFT_DELAY_MS ?? 60_000);

async function mesurerProd(token) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: SQL }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Management API ${res.status} : ${(await res.text()).slice(0, 200)}`);
  const vivantes = await res.json();
  if (vivantes.length < 50) {
    console.error(`✗ Périmètre suspect : ${vivantes.length} relation(s) en production, 50 attendues au moins.`);
    process.exit(1);
  }
  const dansLeFichier = new Set([...tablesFichier, ...vuesFichier]);
  const nomsVivants = new Set(vivantes.map(({ nom }) => nom));
  return {
    total: vivantes.length,
    absentes: vivantes.filter(({ nom }) => !dansLeFichier.has(nom)),
    fantomes: [...dansLeFichier].filter((nom) => !nomsVivants.has(nom)).sort(),
  };
}

// ⚠ `--prod` EXIGE le jeton et sort en 2 s'il manque, comme les deux contrôles voisins.
// Sans ce drapeau (mode PR, `unit-tests.yml`, aucun secret), la comparaison est sautée —
// et le verdict le DIT au lieu d'annoncer « aucune relation manquante » sans avoir
// regardé. C'était le « vert sans assertion » que ce script combat 90 lignes plus haut.
const PROD_REQUISE = process.argv.includes('--prod');
const token = process.env.SUPABASE_ACCESS_TOKEN;
let absentes = [];
let fantomes = [];
let prodComparee = false;

if (PROD_REQUISE && !token) {
  console.error('SUPABASE_ACCESS_TOKEN manquant — `--prod` interroge la base de production.');
  process.exit(2);
}

if (token) {
  let mesure = await mesurerProd(token);
  for (let essai = 1; (mesure.absentes.length || mesure.fantomes.length) && essai < TENTATIVES; essai++) {
    console.error(
      `… dérive de typage mesurée, un déploiement est peut-être en cours ` +
      `(essai ${essai}/${TENTATIVES - 1}, nouvelle mesure dans ${Math.round(ATTENTE_MS / 1000)} s).`,
    );
    await new Promise((r) => setTimeout(r, ATTENTE_MS));
    mesure = await mesurerProd(token);
  }
  ({ absentes, fantomes } = mesure);
  prodComparee = true;
  console.log(`${mesure.total} relations inspectées en production.`);
} else {
  console.log('SUPABASE_ACCESS_TOKEN absent — contrôles statiques seuls (la comparaison à la prod est SAUTÉE).');
}

// ─── Verdict ─────────────────────────────────────────────────────────────────

if (!contournements.length && !manquantes.size && !absentes.length && !fantomes.length) {
  // Le verdict n'énonce QUE ce qui a réellement été mesuré : annoncer « aucune relation
  // manquante » sans avoir interrogé la base est exactement le vert sans assertion.
  console.log(
    '✓ Typage Supabase : aucun client casté, aucun dispatcher non typé, aucune RPC appelée hors des types'
    + (prodComparee
      ? ', aucune relation manquante ni fantôme.'
      : '.\n  (Comparaison à la production NON faite — contrôles statiques seuls.)'),
  );
  process.exit(0);
}

if (contournements.length) {
  console.error(`\n✗ ${contournements.length} contournement(s) du client typé dans src/ :\n`);
  for (const { f, ligne, quoi } of contournements) console.error(`  ${f}:${ligne} — ${quoi}`);
  console.error(`
Un client casté éteint la vérification pour TOUT le fichier, pas seulement pour
l'appel qui pose problème — et il se recopie : trois des justifications trouvées
le 01.08 invoquaient un retard de \`database.ts\` que la base contredisait.

Correctifs, du plus au moins souhaitable :
  1. Régénérer les types si l'objet manque vraiment (voir plus bas).
  2. Rendre le dispatcher GÉNÉRIQUE sur le nom, pour que les arguments soient
     indexés par lui — sinon le nom est vérifié et les arguments ne le sont plus :

       type PgFns = Database['public']['Functions']
       async function callRpc<N extends keyof PgFns>(fn: N, args: PgFns[N]['Args']) {
         const { error } = await supabase.rpc(fn, args as never)   // cast confiné ICI
         if (error) throw new Error(error.message)
       }

     \`Parameters<typeof supabase.rpc>[0]\` seul NE SUFFIT PAS : il fixe le nom mais
     laisse \`args: Record<string, unknown>\`, et \`{ p_agency_TYPO: … }\` repasse.
  3. En dernier recours, caster l'ARGUMENT précis que le générateur ne sait pas
     exprimer (un paramètre sans DEFAULT est typé non-nullable), jamais le client,
     et dire pourquoi en commentaire.`);
}

if (manquantes.size) {
  console.error(`\n✗ ${manquantes.size} RPC appelée(s) depuis src/ mais absente(s) de ${TYPES} :\n`);
  for (const [nom, fichiers] of manquantes) console.error(`  ${nom.padEnd(38)} ${[...new Set(fichiers)].join(', ')}`);
}

if (absentes.length) {
  console.error(`\n✗ ${absentes.length} relation(s) vivante(s) en production, absente(s) de ${TYPES} :\n`);
  for (const { nom, sorte } of absentes) console.error(`  ${sorte.padEnd(6)} ${nom}`);
}

if (fantomes.length) {
  console.error(`\n✗ ${fantomes.length} relation(s) présente(s) dans ${TYPES} mais DISPARUE(S) de la production :\n`);
  for (const nom of fantomes) console.error(`  ${nom}`);
  console.error(`
C'est le sens qui a cassé la prod une semaine en juillet 2026 : le type survit,
\`supabase.from('…')\` typecheck, et l'appel casse en 42P01 à l'exécution.`);
}

console.error(`
Régénérer :  npx supabase gen types typescript --project-id ${PROJECT_REF} > /tmp/db.ts
⚠ Le fichier porte un en-tête \`/** */\` maison que le générateur n'émet pas : le
  remettre en tête après régénération.`);
process.exit(1);
