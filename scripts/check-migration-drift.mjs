#!/usr/bin/env node
/**
 * Détecte la DÉRIVE entre les migrations du dépôt et le schéma de production.
 *
 * Pourquoi ce script existe. `deploy.yml` n'applique que les migrations dont le
 * préfixe de date vaut `>= TODAY` — utile pour ne pas rejouer l'historique, mais
 * une migration mergée APRÈS sa propre date passe sous le seuil et n'est PLUS
 * JAMAIS rattrapée. Le dépôt le sait et le documente (« c'est la discipline
 * humaine qui tient, pas la CI ») ; l'étape d'alerte existante se contente de
 * signaler les fichiers sautés lors du push, ce qui ne dit rien de l'état réel
 * de la base et ne survit pas au push suivant.
 *
 * Le 28 juillet 2026, deux migrations du 21 juillet manquaient en production
 * depuis une semaine : `reminders.kind` et `transactions.archived_at`. Quatre
 * gestes du pipeline agent en étaient cassés (prochaines actions, premier suivi,
 * planification de visite, archivage). Rien ne l'avait signalé, parce que
 * `src/types/database.ts` était figé à un état antérieur : TypeScript validait
 * le code contre un schéma qui n'existait plus.
 *
 * Ce script ne fait donc PAS confiance au registre `schema_migrations` — il est
 * incomplet, plusieurs migrations ayant été appliquées via l'éditeur SQL sans y
 * être tracées (cf. le commentaire de `deploy.yml`). Il compare ce que les
 * fichiers DÉCLARENT à ce que la base CONTIENT.
 *
 * Usage : SUPABASE_ACCESS_TOKEN=… node scripts/check-migration-drift.mjs
 *         exit 1 si un objet déclaré manque en base.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PROJECT_REF = 'eayczugyrvmtqnnmvjod';
const DIR = 'supabase/migrations';

/**
 * Objets suivis. On s'arrête à ce qui est à la fois déclaratif et interrogeable
 * simplement : tables, colonnes, fonctions, index, vues matérialisées. Les
 * policies RLS, triggers et GRANT ne sont PAS couverts — leur absence ne se
 * lit pas dans un simple `information_schema`, et un faux positif sur eux
 * décrédibiliserait tout le contrôle.
 */
const PATTERNS = [
  ['table', /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?(\w+)"?/gi],
  ['function', /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?"?(\w+)"?/gi],
  // L'index capture aussi sa table cible : une table supprimée emporte ses index,
  // et sans ce lien le contrôle réclamerait des index d'objets disparus.
  ['index', /create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?"?(\w+)"?\s+on\s+(?:public\.)?"?(\w+)"?/gi],
  ['matview', /create\s+materialized\s+view\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?(\w+)"?/gi],
];

const DROPS = [
  // ⚠ `drop table if exists a, b, c` sur plusieurs lignes est la forme utilisée
  // par les migrations de nettoyage : ne capturer que le premier nom laissait
  // passer toutes les tables suivantes. Traité à part, ci-dessous.
  ['function', /drop\s+function\s+(?:if\s+exists\s+)?(?:public\.)?"?(\w+)"?/gi],
  ['index', /drop\s+index\s+(?:concurrently\s+)?(?:if\s+exists\s+)?(?:public\.)?"?(\w+)"?/gi],
  ['matview', /drop\s+materialized\s+view\s+(?:if\s+exists\s+)?(?:public\.)?"?(\w+)"?/gi],
];

/** Retire les commentaires : un exemple en commentaire n'est pas une déclaration. */
const strip = (sql) => sql.replace(/^\s*--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

function scanMigrations() {
  const files = readdirSync(DIR).filter(f => f.endsWith('.sql')).sort();
  const expected = new Map();   // "kind:name" -> fichier qui l'a créé en dernier
  const indexTable = new Map(); // index -> table portante
  const droppedTables = new Set();

  for (const file of files) {
    const sql = strip(readFileSync(join(DIR, file), 'utf-8'));

    for (const [kind, re] of PATTERNS) {
      for (const m of sql.matchAll(re)) {
        expected.set(`${kind}:${m[1]}`, file);
        if (kind === 'index' && m[2]) indexTable.set(m[1], m[2]);
      }
    }
    // ALTER TABLE … ADD COLUMN : la table est capturée séparément de la colonne
    // pour éviter qu'un long bloc ne rattache une colonne à la mauvaise table.
    for (const stmt of sql.split(';')) {
      const t = stmt.match(/alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?"?(\w+)"?/i);
      if (!t) continue;
      for (const c of stmt.matchAll(/add\s+column\s+(?:if\s+not\s+exists\s+)?"?(\w+)"?/gi)) {
        expected.set(`column:${t[1]}.${c[1]}`, file);
      }
      for (const c of stmt.matchAll(/drop\s+column\s+(?:if\s+exists\s+)?"?(\w+)"?/gi)) {
        expected.delete(`column:${t[1]}.${c[1]}`);
      }
    }

    // Les DROP viennent APRÈS, dans l'ordre des fichiers : un objet supprimé
    // plus tard n'est plus attendu. Sans ça, le contrôle crie sur les
    // suppressions volontaires — c'est ce qui rend ce genre d'audit inutile.
    for (const [kind, re] of DROPS) {
      for (const m of sql.matchAll(re)) expected.delete(`${kind}:${m[1]}`);
    }
    // `drop table` accepte une LISTE : on lit le statement entier jusqu'au `;`.
    for (const m of sql.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?([\s\S]*?);/gi)) {
      for (const n of m[1].matchAll(/(?:public\.)?"?(\w+)"?/g)) {
        if (['cascade', 'restrict', 'if', 'exists', 'public'].includes(n[1].toLowerCase())) continue;
        expected.delete(`table:${n[1]}`);
        droppedTables.add(n[1]);
      }
    }
  }

  // Une table supprimée emporte ses colonnes ET ses index.
  for (const key of [...expected.keys()]) {
    if (key.startsWith('column:') && droppedTables.has(key.slice(7).split('.')[0])) expected.delete(key);
    if (key.startsWith('index:') && droppedTables.has(indexTable.get(key.slice(6)))) expected.delete(key);
  }
  return expected;
}

async function fetchSchema(token) {
  const sql = `select 'table:'||table_name as k from information_schema.tables where table_schema='public'
    union all select 'column:'||table_name||'.'||column_name from information_schema.columns where table_schema='public'
    union all select 'function:'||p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
    union all select 'index:'||indexname from pg_indexes where schemaname='public'
    union all select 'matview:'||matviewname from pg_matviews where schemaname='public'`;
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) throw new Error(`Management API ${res.status} : ${(await res.text()).slice(0, 200)}`);
  return new Set((await res.json()).map(r => r.k));
}

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN manquant — ce contrôle interroge la base de production.');
  process.exit(2);
}

const expected = scanMigrations();
const present = await fetchSchema(token);
// Une colonne dont la TABLE est absente de la production n'est pas une dérive :
// la table a été supprimée hors migration (éditeur SQL), et réclamer sa colonne
// enverrait chercher un objet qui n'a plus de porteur.
const missing = [...expected.entries()].filter(([key]) => {
  if (present.has(key)) return false;
  if (key.startsWith('column:') && !present.has(`table:${key.slice(7).split('.')[0]}`)) return false;
  return true;
});

console.log(`${expected.size} objets déclarés par ${readdirSync(DIR).filter(f => f.endsWith('.sql')).length} migrations.`);

if (missing.length === 0) {
  console.log('✓ Aucune dérive : tout ce que le dépôt déclare existe en base.');
  process.exit(0);
}

console.error(`\n✗ ${missing.length} objet(s) déclaré(s) par une migration mais ABSENT(S) de la production :\n`);
for (const [key, file] of missing) {
  const [kind, name] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
  console.error(`  ${kind.padEnd(9)} ${name.padEnd(48)} ← ${file}`);
}
console.error(`
Cause la plus probable : le date-guard de deploy.yml. Il n'applique que les
migrations dont le préfixe de date vaut >= le jour du déploiement, donc toute
migration mergée après sa propre date est sautée DÉFINITIVEMENT.

Correctif : appliquer les fichiers ci-dessus à la main (MCP apply_migration ou
l'éditeur SQL), après les avoir relus. Ils sont censés être idempotents.`);
process.exit(1);
