#!/usr/bin/env node
/**
 * Détecte la dérive des PRIVILÈGES entre le dépôt et la production.
 *
 * POURQUOI CE SCRIPT EXISTE, ET POURQUOI IL NE PEUT PAS ÊTRE UN TEST.
 *
 * `check-migration-drift.mjs` compare ce que les fichiers DÉCLARENT à ce que la
 * base CONTIENT — mais son en-tête exclut explicitement policies, triggers et
 * GRANT : « leur absence ne se lit pas dans un simple information_schema ».
 * Le trou est réel et a été mesuré le 1ᵉʳ août 2026 : `anon` détenait `SELECT`
 * sur `admin_changelog` EN PRODUCTION, et **aucune migration du dépôt ne
 * l'accordait**. Le privilège venait des droits par défaut de Supabase, posés à
 * la création de la table et jamais révoqués.
 *
 * Sa policy de lecture n'avait par ailleurs aucune clause `TO`, elle portait donc
 * sur `public` — `anon` compris — avec `published = true` en première branche,
 * vraie sans aucune identité. N'importe quel visiteur lisait le titre, le contenu
 * et l'`author_id` d'un super-admin de chaque nouveauté publiée.
 *
 * ⚠ CE QUE LA CI NE PEUT PAS FAIRE, et c'est tout l'intérêt d'un script séparé :
 * la suite backend tourne sur une base FRAÎCHE, construite depuis les migrations.
 * Elle ne reproduit donc PAS un privilège qui n'existe qu'en production — un test
 * de fuite y est vert avant comme après le correctif. Une dérive de production ne
 * se constate qu'en interrogeant la production. D'où ce script, branché sur le
 * même workflow planifié que la dérive de schéma.
 *
 * LA PROPRIÉTÉ VÉRIFIÉE, et pourquoi celle-là.
 *
 * On ne compare pas « déclaré vs présent » : les privilèges ne sont pas gérés
 * déclarativement dans ce dépôt (Supabase en accorde d'office à la création), si
 * bien que 79 tables sont lisibles par `anon` au sens du GRANT. Crier sur les 79
 * serait crier au loup, et « un garde-fou qui crie sans raison finit ignoré, donc
 * muet le jour où il a raison » — la leçon est déjà écrite dans le script voisin.
 *
 * On vérifie donc une propriété étroite et sans faux positif : **aucune table
 * INTERNE n'accorde le moindre droit à `anon`**. Interne = la console et son
 * socle, c'est-à-dire des tables qu'aucun visiteur non authentifié n'a de raison
 * de toucher, jamais. Le prédicat est structurel (`admin\_%` + une courte liste
 * nommée) plutôt qu'une liste d'exceptions : une table de console ajoutée demain
 * entre automatiquement dans le périmètre.
 *
 * ⚠ ON NE LIT PAS LES CLAUSES `USING`. Une policy « ouverte » n'est PAS une fuite
 * — c'est le `USING` qui tranche, et il faut le lire branche par branche : celle
 * d'`admin_changelog` était `published = true OR is_super_admin()`, donc elle
 * échappait à un grep sur `super_admin`. Analyser des expressions serait fragile
 * et bruyant. Retirer le GRANT est un cran plus haut : sans lui, aucune policy,
 * si permissive soit-elle, ne peut laisser passer `anon`.
 */
const PROJECT_REF = 'eayczugyrvmtqnnmvjod';

/**
 * Tables internes hors préfixe `admin_`. Cette liste ne remplace pas le prédicat,
 * elle l'étend — et elle n'a pas vocation à grandir : une table de console
 * nouvelle devrait s'appeler `admin_*`.
 *
 * `app_config` est la plus sensible du lot : elle porte `service_role_key`.
 */
const INTERNES_HORS_PREFIXE = [
  'app_config',
  'rpc_receipts',
  'outbox_jobs',
  'platform_metrics',
  'platform_announcements',
];

const SQL = `
  select c.relname as tbl,
         string_agg(distinct g.privilege_type, ',' order by g.privilege_type) as droits
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join information_schema.role_table_grants g
      on g.table_schema = 'public' and g.table_name = c.relname and g.grantee = 'anon'
   where n.nspname = 'public'
     and c.relkind = 'r'
     and (c.relname like 'admin\\_%' escape '\\'
          or c.relname in (${INTERNES_HORS_PREFIXE.map(t => `'${t}'`).join(', ')}))
   group by c.relname
   order by c.relname`;

/** Compte les tables du périmètre, pour se garder d'un prédicat qui ne matche plus rien. */
const SQL_PERIMETRE = `
  select count(*)::int as n
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and (c.relname like 'admin\\_%' escape '\\'
          or c.relname in (${INTERNES_HORS_PREFIXE.map(t => `'${t}'`).join(', ')}))`;

async function query(token, sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) throw new Error(`Management API ${res.status} : ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN manquant — ce contrôle interroge la base de production.');
  process.exit(2);
}

/**
 * ⚠ POURQUOI CE CONTRÔLE PATIENTE AVANT DE CRIER.
 *
 * Ce script tourne aussi sur `push: main`, quelques minutes après le merge — mais
 * `deploy.yml` enchaîne `npm ci`, `tsc -b`, `eslint` et `vite build` AVANT d'appliquer
 * les migrations, et il est sérialisé par `concurrency: deploy-<ref>` avec
 * `cancel-in-progress: false`. Un déploiement déjà en vol repousse donc le nôtre bien
 * au-delà des 180 s d'attente du workflow.
 *
 * Sans cette patience, la toute PREMIÈRE exécution de ce garde-fou aurait échoué — sur le
 * merge qui contient précisément la révocation qu'il réclame. Un contrôle qui rougit le
 * jour où il a tort apprend à être ignoré le jour où il a raison ; c'est la leçon déjà
 * écrite dans le script voisin, et elle vaut d'autant plus pour un contrôle NEUF, dont
 * personne n'a encore appris à faire confiance.
 *
 * On ne relâche pas l'assertion pour autant : une dérive réelle finit par être rapportée,
 * elle prend seulement quelques minutes de plus à l'être.
 */
const TENTATIVES = Number(process.env.PRIVILEGE_DRIFT_TRIES ?? 10);
const ATTENTE_MS = Number(process.env.PRIVILEGE_DRIFT_DELAY_MS ?? 60_000);

const [{ n: perimetre }] = await query(token, SQL_PERIMETRE);

// Garde anti-contrôle creux : sans elle, un prédicat qui cesserait de matcher
// (renommage massif, schéma déplacé) rendrait « aucune fuite » sur zéro table.
// C'est le motif du vert sans assertion, rencontré deux fois sur ce chantier.
if (perimetre < 10) {
  console.error(`✗ Périmètre suspect : ${perimetre} table(s) interne(s) trouvée(s), 10 attendues au moins.`);
  console.error('  Le prédicat ne reconnaît plus les tables de la console — le contrôle ne prouve plus rien.');
  process.exit(1);
}

console.log(`${perimetre} tables internes inspectées en production.`);

let fuites = await query(token, SQL);
for (let essai = 1; fuites.length > 0 && essai < TENTATIVES; essai++) {
  console.log(
    `  ${fuites.length} table(s) encore ouverte(s) à anon — ` +
    `un déploiement est peut-être en cours (essai ${essai}/${TENTATIVES - 1}, ` +
    `nouvelle mesure dans ${Math.round(ATTENTE_MS / 1000)} s).`,
  );
  await new Promise((r) => setTimeout(r, ATTENTE_MS));
  fuites = await query(token, SQL);
}

if (fuites.length === 0) {
  console.log('✓ Aucune dérive de privilèges : `anon` n\'a aucun droit sur les tables internes.');
  process.exit(0);
}

console.error(`\n✗ ${fuites.length} table(s) INTERNE(S) accordent des droits à \`anon\` en production :\n`);
for (const { tbl, droits } of fuites) {
  console.error(`  ${tbl.padEnd(28)} ${droits}`);
}
console.error(`
Ces droits ne viennent PAS d'une migration : Supabase les accorde d'office à la
création d'une table, et rien ne les a révoqués. La RLS est alors le SEUL verrou
— et elle suffit tant que sa clause \`USING\` dépend d'une identité. Mesuré le
01.08.2026 sur \`admin_changelog\` : sa policy n'avait pas de clause \`TO\` et sa
première branche était \`published = true\`, vraie sans identité. Tout visiteur
lisait les nouveautés publiées.

Correctif : une migration qui révoque, par exemple

    revoke all on table public.<table> from anon;

Retirer le GRANT est un cran au-dessus de corriger la policy : sans lui, aucune
policy, si permissive soit-elle, ne peut laisser passer \`anon\`.

⚠ Vérifier d'abord qu'aucune surface publique ne lit la table. Une lecture
bloquée par la RLS rend \`{ data: [], error: null }\` ; bloquée par le GRANT, elle
rend une ERREUR. Révoquer transforme donc un silence en erreur visible côté
client — c'est souhaitable, mais ça se constate avant, pas après.`);
process.exit(1);
