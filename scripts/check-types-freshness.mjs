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
 * Usage :  node scripts/check-types-freshness.mjs
 *          SUPABASE_ACCESS_TOKEN=… node scripts/check-types-freshness.mjs   (+ contrôle prod)
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
 * Le cast du CLIENT (et non d'un résultat) est ce qui éteint la vérification en masse.
 * Les trois formes rencontrées au dépôt, plus le dispatcher typé `string` — ce dernier
 * est le plus insidieux : il éteint la vérification pour tous ses appelants d'un coup,
 * sans qu'aucun `as` n'apparaisse à leur ligne.
 */
const CONTOURNEMENTS = [
  [/supabase\s+as\s+unknown\s+as\s+SupabaseClient/, 'client entier casté en `SupabaseClient`'],
  [/supabase\.rpc\s+as\s+unknown\s+as/, '`supabase.rpc` casté'],
  [/supabase\.from\s+as\s+unknown\s+as/, '`supabase.from` casté'],
];

const contournements = [];
for (const f of sources) {
  const lignes = readFileSync(f, 'utf8').split('\n');
  lignes.forEach((ligne, i) => {
    for (const [motif, quoi] of CONTOURNEMENTS) {
      if (motif.test(ligne)) contournements.push({ f, ligne: i + 1, quoi });
    }
  });
}

// ─── Propriété 2 : toute RPC appelée existe dans les types ───────────────────

/**
 * `.rpc('nom')` — le receveur importe peu (`supabase`, `db`, un alias…), c'est le nom
 * littéral qu'on veut. Un nom absent des types force un cast : c'est la cause, pas le
 * symptôme. ⚠ Les appels à nom VARIABLE (`rpc(fn, …)`) échappent à ce contrôle ; c'est
 * pourquoi la propriété 1 traque aussi les dispatchers typés `string`.
 */
const RPC = /\.rpc\(\s*['"]([a-z_][a-z0-9_]*)['"]/gi;
const manquantes = new Map();
for (const f of sources) {
  const texte = readFileSync(f, 'utf8');
  for (const m of texte.matchAll(RPC)) {
    if (!fonctionsFichier.has(m[1])) {
      if (!manquantes.has(m[1])) manquantes.set(m[1], []);
      manquantes.get(m[1]).push(f);
    }
  }
}

// ─── Propriété 3 (prod, si jeton) : aucune table ni vue vivante absente ───────

/**
 * Tables et vues seulement : mesuré le 01.08, la base rend 97 tables et 4 vues, et le
 * fichier généré en porte exactement 97 et 4. Correspondance 1:1 vérifiée, donc gardable
 * sans faux positif — contrairement aux fonctions (voir l'en-tête).
 */
const SQL = `
  select c.relname as nom,
         case when c.relkind in ('r','p') then 'table' else 'vue' end as sorte
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r','p','v','m')
   order by 1`;

const token = process.env.SUPABASE_ACCESS_TOKEN;
let absentes = [];
if (token) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: SQL }),
  });
  if (!res.ok) throw new Error(`Management API ${res.status} : ${(await res.text()).slice(0, 200)}`);
  const vivantes = await res.json();
  if (vivantes.length < 50) {
    console.error(`✗ Périmètre suspect : ${vivantes.length} relation(s) en production, 50 attendues au moins.`);
    process.exit(1);
  }
  absentes = vivantes.filter(({ nom, sorte }) => !(sorte === 'table' ? tablesFichier : vuesFichier).has(nom));
  console.log(`${vivantes.length} relations inspectées en production.`);
} else {
  console.log('SUPABASE_ACCESS_TOKEN absent — contrôles statiques seuls (la comparaison à la prod est sautée).');
}

// ─── Verdict ─────────────────────────────────────────────────────────────────

if (!contournements.length && !manquantes.size && !absentes.length) {
  console.log('✓ Typage Supabase intact : aucun client casté, aucune RPC appelée hors des types, aucune relation manquante.');
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
  2. Typer un dispatcher par \`Parameters<typeof supabase.rpc>[0]\`, jamais \`string\`.
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

console.error(`
Régénérer :  npx supabase gen types typescript --project-id ${PROJECT_REF} > /tmp/db.ts
⚠ Le fichier porte un en-tête \`/** */\` maison que le générateur n'émet pas : le
  remettre en tête après régénération.`);
process.exit(1);
