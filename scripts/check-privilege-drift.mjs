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
  // Instrumentation IA — lues côté client par la SEULE console (useAIBilling.ts,
  // Monitoring), écrites par les edges en service_role. Mesuré le 03.08.2026 : `anon`
  // y détenait encore les droits par défaut, révoqués par 20260803010000. Elles
  // précèdent la convention `admin_*`, d'où leur place dans la liste.
  'ai_usage_logs',
  'ai_balance_snapshots',
];

/**
 * Tables adossées à un jeton de capacité. Elles ne sont pas « internes » au sens
 * de la console — ce sont des tables métier — mais elles vérifient la même
 * propriété, et pour une raison plus étroite : leur accès public légitime passe
 * TOUJOURS par une fonction SECURITY DEFINER (les quatre `*_visit_by_token`) ou
 * par une edge function en `service_role` (magic-link-*, buyer-reception-*). Ces
 * deux chemins s'exécutent sous une autre identité que `anon` et n'ont donc
 * besoin d'AUCUN droit de table pour `anon`.
 *
 * Le jour où l'audit du 2 août 2026 les a mesurées, `anon` y détenait pourtant
 * les sept droits par défaut de Supabase, `TRUNCATE` compris — et `TRUNCATE`
 * n'est PAS soumis au RLS. Aucune policy, si stricte soit-elle, ne peut rattraper
 * ce grant-là ; seule sa révocation le peut. D'où leur entrée ici : le garde-fou
 * empêche la récidive, qui viendrait sinon en silence des droits par défaut
 * reposés à la prochaine recréation de table.
 */
const TABLES_A_CAPACITE = [
  'visits',
  'kyc_magic_links',
  'kyc_magic_link_uploads',
  'buyer_reception_links',
];

const SURVEILLEES = [...INTERNES_HORS_PREFIXE, ...TABLES_A_CAPACITE];

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
          or c.relname in (${SURVEILLEES.map(t => `'${t}'`).join(', ')}))
   group by c.relname
   order by c.relname`;

/** Compte les tables du périmètre, pour se garder d'un prédicat qui ne matche plus rien. */
const SQL_PERIMETRE = `
  select count(*)::int as n
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and (c.relname like 'admin\\_%' escape '\\'
          or c.relname in (${SURVEILLEES.map(t => `'${t}'`).join(', ')}))`;

/**
 * SECONDE PROPRIÉTÉ (20260913140000, audit du 13.09.2026, point S5) : `anon` n'a AUCUN
 * droit d'écriture sur une table de `public`, sauf l'INSERT de `seller_leads` (l'entonnoir
 * public, dont la policy force l'agence à NULL). Elle est exacte depuis cette migration :
 * aucun faux positif, donc aucune raison de la restreindre à une liste.
 *
 * ⚠ Les tables de PostGIS appartiennent à `supabase_admin` : `postgres` ne peut ni révoquer
 * leurs droits ni changer les droits par défaut de ce rôle. Elles sont exclues PAR
 * PROPRIÉTAIRE — `spatial_ref_sys` (référentiel de projections, aucune donnée client) garde
 * donc des droits qu'on ne peut pas retirer d'ici.
 */
const ECRITURE_ANON_PERMISE = [['seller_leads', 'INSERT']];

const SQL_ECRITURES = `
  select c.relname as tbl,
         string_agg(p.priv, ',' order by p.priv) as droits
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join (values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) as p(priv)
   where n.nspname = 'public'
     and c.relkind in ('r', 'p')
     and pg_get_userbyid(c.relowner) <> 'supabase_admin'
     and has_table_privilege('anon', c.oid, p.priv)
     and not ((c.relname, p.priv) in (${ECRITURE_ANON_PERMISE.map(([t, d]) => `('${t}', '${d}')`).join(', ')}))
   group by c.relname
   order by c.relname`;

/** Contrôle positif : l'entonnoir public doit rester ouvert, sinon on a fermé trop. */
const SQL_ENTONNOIR = `select has_table_privilege('anon', 'public.seller_leads', 'INSERT') as ouvert`;

/**
 * S12 — les colonnes SECRÈTES des jetons d'agenda (20260913160600).
 *
 * Aucun rôle client ne doit lire ni écrire `access_token` / `refresh_token` des
 * deux tables de jetons, ni écrire dans ces tables : le jeton de rafraîchissement
 * Google/Microsoft y vit des mois, et une écriture suffisait à brancher l'agenda
 * d'un agent sur le compte d'un tiers. ⚠ Mesuré PAR COLONNE : un grant de table
 * couvre toutes les colonnes, donc c'est `has_column_privilege` qui fait foi.
 */
const TABLES_JETONS = ['google_calendar_tokens', 'outlook_calendar_tokens'];
const SQL_JETONS = `
  select r.rl || ' ' || t.tb || '.' || c.col || ' ' || p.pv as fuite
    from (values ${TABLES_JETONS.map((t) => `('${t}')`).join(', ')}) as t(tb)
    cross join (values ('refresh_token'), ('access_token')) as c(col)
    cross join (values ('anon'), ('authenticated')) as r(rl)
    cross join (values ('SELECT'), ('INSERT'), ('UPDATE')) as p(pv)
   where has_column_privilege(r.rl, 'public.' || t.tb, c.col, p.pv)
  union all
  select r.rl || ' ' || t.tb || ' ' || p.pv
    from (values ${TABLES_JETONS.map((t) => `('${t}')`).join(', ')}) as t(tb)
    cross join (values ('anon'), ('authenticated')) as r(rl)
    cross join (values ('INSERT'), ('UPDATE'), ('DELETE')) as p(pv)
   where has_table_privilege(r.rl, 'public.' || t.tb, p.pv)
   order by 1`;

/** Contrôle positif : l'agent lit toujours l'ÉTAT de sa connexion — sinon on a fermé trop. */
const SQL_JETONS_ETAT = `
  select bool_and(has_column_privilege('authenticated', 'public.' || v.tb, v.col, 'SELECT')) as lisible
    from (values ('google_calendar_tokens', 'user_id'), ('google_calendar_tokens', 'google_email'),
                 ('outlook_calendar_tokens', 'user_id'), ('outlook_calendar_tokens', 'outlook_email')) as v(tb, col)`;

/**
 * S13 — la facturation et le calibrage des agents restent au serveur (20260913170000).
 *
 * Un membre d'agence ne lit ni `agencies.stripe_customer_id` ni les colonnes financières
 * de `subscriptions` (identifiants Stripe, prix, MRR, dernière facture), et aucun rôle
 * client n'appelle `compute_agent_preferences` (le calibrage « Premier jour » de
 * n'importe quel agent). ⚠ Mesuré PAR COLONNE, comme les jetons : un grant de table
 * réaccorde tout.
 */
const COLONNES_FACTURATION = [
  ['agencies', 'stripe_customer_id'],
  ['subscriptions', 'stripe_customer_id'], ['subscriptions', 'stripe_subscription_id'],
  ['subscriptions', 'stripe_price_id'], ['subscriptions', 'price'], ['subscriptions', 'mrr_chf'],
  ['subscriptions', 'last_invoice_status'], ['subscriptions', 'last_stripe_event_at'],
];
const SQL_FACTURATION = `
  select 'authenticated ' || v.tb || '.' || v.col || ' SELECT' as fuite
    from (values ${COLONNES_FACTURATION.map(([tb, col]) => `('${tb}', '${col}')`).join(', ')}) as v(tb, col)
   where has_column_privilege('authenticated', 'public.' || v.tb, v.col, 'SELECT')
  union all
  select r.rl || ' compute_agent_preferences EXECUTE'
    from (values ('anon'), ('authenticated')) as r(rl)
   where has_function_privilege(r.rl, 'public.compute_agent_preferences(uuid)', 'EXECUTE')
   order by 1`;

/** Contrôle positif : les écrans lisent toujours le plan, la vérification et la période. */
const SQL_FACTURATION_ETAT = `
  select bool_and(has_column_privilege('authenticated', 'public.' || v.tb, v.col, 'SELECT')) as lisible
    from (values ('agencies', 'plan'), ('agencies', 'verification_status'),
                 ('agencies', 'identity_submitted_at'), ('subscriptions', 'status'),
                 ('subscriptions', 'current_period_end')) as v(tb, col)`;

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
  console.error(`✗ Périmètre suspect : ${perimetre} table(s) surveillée(s) trouvée(s), 10 attendues au moins.`);
  console.error('  Le prédicat ne reconnaît plus les tables surveillées — le contrôle ne prouve plus rien.');
  process.exit(1);
}

// Le seuil ci-dessus ne voit QUE la masse : il reste vert si une table nommée
// disparaît, noyée dans la trentaine de `admin_*`. Or c'est précisément une table
// nommée qu'on tient à surveiller — la renommer sans toucher à cette liste la
// ferait sortir du périmètre en silence, et le contrôle continuerait d'afficher
// « aucune fuite » sur une table qu'il ne regarde plus.
const presentes = new Set(
  (await query(token, `
     select c.relname as tbl
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and c.relname in (${SURVEILLEES.map(t => `'${t}'`).join(', ')})`)).map(r => r.tbl),
);
const disparues = SURVEILLEES.filter(t => !presentes.has(t));
if (disparues.length > 0) {
  console.error(`✗ Table(s) surveillée(s) introuvable(s) en production : ${disparues.join(', ')}.`);
  console.error('  Renommée, déplacée ou supprimée — mettre à jour la liste, sinon elle sort du périmètre sans bruit.');
  process.exit(1);
}

console.log(`${perimetre} tables surveillées inspectées en production.`);

let fuites = await query(token, SQL);
let ecritures = await query(token, SQL_ECRITURES);
// Dans la boucle d'attente, comme les deux autres : mesurée sur le commit de merge
// AVANT que deploy.yml n'applique la migration, elle rougirait à chaque livraison.
let jetons = await query(token, SQL_JETONS);
let facturation = await query(token, SQL_FACTURATION);
for (let essai = 1; (fuites.length > 0 || ecritures.length > 0 || jetons.length > 0 || facturation.length > 0) && essai < TENTATIVES; essai++) {
  console.log(
    `  ${fuites.length} table(s) interne(s), ${ecritures.length} table(s) en écriture et ${jetons.length} droit(s) sur les jetons d'agenda encore ouverts — ` +
    `un déploiement est peut-être en cours (essai ${essai}/${TENTATIVES - 1}, ` +
    `nouvelle mesure dans ${Math.round(ATTENTE_MS / 1000)} s).`,
  );
  await new Promise((r) => setTimeout(r, ATTENTE_MS));
  fuites = await query(token, SQL);
  ecritures = await query(token, SQL_ECRITURES);
  jetons = await query(token, SQL_JETONS);
  facturation = await query(token, SQL_FACTURATION);
}

const [{ ouvert: entonnoirOuvert }] = await query(token, SQL_ENTONNOIR);
if (!entonnoirOuvert) {
  console.error('✗ `anon` a perdu l\'INSERT de `seller_leads` : l\'entonnoir public est fermé.');
  console.error('  La révocation de 20260913140000 a été rejouée sans son re-GRANT, ou une migration l\'a retiré.');
  process.exit(1);
}

const [{ lisible: etatLisible }] = await query(token, SQL_JETONS_ETAT);
if (!etatLisible) {
  console.error('✗ `authenticated` ne lit plus l\'état de sa connexion d\'agenda (user_id, *_email).');
  console.error('  Le grant de colonnes de 20260913160600 a disparu : l\'écran Intégrations croit l\'agenda déconnecté.');
  process.exit(1);
}

const [{ lisible: facturationLisible }] = await query(token, SQL_FACTURATION_ETAT);
if (!facturationLisible) {
  console.error('✗ `authenticated` ne lit plus une colonne d\'écran d\'agencies / subscriptions (plan, vérification, période).');
  console.error('  Le grant de colonnes de 20260913170000 a été amputé : Réglages et l\'onboarding KYB tomberaient en 42501.');
  process.exit(1);
}

if (facturation.length > 0) {
  console.error(`\n✗ ${facturation.length} lecture(s) de facturation ou de calibrage ouverte(s) à un rôle client en production :\n`);
  for (const { fuite } of facturation) console.error(`  ${fuite}`);
  console.error(`
Depuis 20260913170000, un membre ne lit ni les identifiants Stripe ni les montants, et
aucun rôle client n'appelle compute_agent_preferences. Un grant de TABLE réaccorde
toutes les colonnes — c'est le suspect habituel. Correctif : rejouer la migration
(revoke select on table … from authenticated, puis grant des colonnes non secrètes).`);
  process.exit(1);
}

if (jetons.length > 0) {
  console.error(`\n✗ ${jetons.length} droit(s) de rôle client sur les jetons d'agenda en production :\n`);
  for (const { fuite } of jetons) console.error(`  ${fuite}`);
  console.error(`
Depuis 20260913160600, ni anon ni authenticated ne lisent ou n'écrivent
access_token / refresh_token, ni n'écrivent dans ces tables : seul le service_role
(les edges d'agenda) y touche. Un grant de TABLE réaccorde toutes les colonnes —
c'est le suspect habituel. Correctif :

    revoke all on table public.<table> from anon, authenticated;
    grant select (id, user_id, <provider>_email, sync_enabled, last_sync_at)
      on public.<table> to authenticated;`);
  process.exit(1);
}

if (ecritures.length > 0) {
  console.error(`\n✗ ${ecritures.length} table(s) de public accordent un droit d'ÉCRITURE à \`anon\` en production :\n`);
  for (const { tbl, droits } of ecritures) {
    console.error(`  ${tbl.padEnd(28)} ${droits}`);
  }
  console.error(`
Depuis 20260913140000, \`anon\` n'écrit nulle part dans public, sauf l'INSERT de
seller_leads, et les droits par défaut du rôle postgres naissent fermés. Une ligne
ci-dessus veut dire qu'une table a été créée par un AUTRE rôle (droits par défaut non
resserrés), ou qu'une migration a ré-accordé l'écriture. Si c'est voulu, l'ajouter à
ECRITURE_ANON_PERMISE avec sa raison ; sinon :

    revoke insert, update, delete, truncate on table public.<table> from anon;`);
  if (fuites.length === 0) process.exit(1);
}

if (fuites.length === 0) {
  console.log('✓ Aucune dérive de privilèges : `anon` n\'a aucun droit sur les tables internes,');
  console.log('  et aucun droit d\'écriture sur public hors l\'INSERT de seller_leads.');
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
