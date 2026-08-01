# Dossier KYB de test en production — procédure d'exécution

> **Statut (01.08.2026) : rédigée, JAMAIS exécutée.**
> Projet Supabase `eayczugyrvmtqnnmvjod` (eu-west-1).
>
> Contexte : l'audit du 01.08.2026 a établi que l'infrastructure d'onboarding/KYB est
> déployée et structurellement complète en production — tables, RLS, RPC, triggers,
> policies Storage, edge functions, pg_cron — mais qu'elle **n'a jamais été exercée** :
> 0 soumission réelle, 0 dossier en revue. Une vérification de présence n'est pas une
> preuve de fonctionnement. Ce document est la procédure qui transforme « rien n'indique
> que c'est cassé » en « ça marche ».
>
> Voisins : [agency-kyb-handoff.md](agency-kyb-handoff.md) (état du chantier, dettes
> ouvertes) et [agency-kyb-verification.md](agency-kyb-verification.md) (décisions de
> conception du schéma et du moteur).

Chaque affirmation est sourcée : *(migration)* pour ce qui est lu dans
`supabase/migrations/`, *(à confirmer)* pour ce qui reste à valider au premier passage.

---

## 1. Accès requis

Un seul des deux suffit :

- l'outil Supabase MCP autorisé (`execute_sql` au minimum) ;
- ou `SUPABASE_SERVICE_ROLE_KEY` en variable d'environnement, avec `psql` ou le client JS.

Pour la voie MCP, les entrées vont dans `.claude/settings.local.json` (fichier local,
ignoré par git) et **ne sont lues qu'au démarrage d'une session** — les ajouter à chaud
ne débloque rien. Le nom du serveur MCP change de forme d'une session à l'autre
(`mcp__Supabase__*`, puis `mcp__<uuid>__*`) : lister les deux graphies, et ajouter la
troisième si elle apparaît.

Portée à accorder — délibérément restreinte, sans `apply_migration`,
`deploy_edge_function` ni `pause_project` :

```
execute_sql · list_tables · list_migrations · list_edge_functions · get_logs · get_advisors
```

### Ce qu'il ne faut pas faire

**Ne jamais créer le compte de test par `signUp` avec la clé anon.** La clé est publique
et le parcours aboutirait peut-être, mais supprimer une ligne `auth.users` exige
`service_role` : le compte, l'agence auto-provisionnée et le dossier resteraient en
production **définitivement**, et une agence portant `identity_submitted_at` remonte dans
la file de revue admin et les surfaces LAB/KYC. On polluerait le module que l'on cherche
à valider.

---

## 2. Phase 0 — Préflight en lecture seule

**À faire en premier, et à rapporter même si l'on renonce au reste.** Aucune écriture, et
cette phase à elle seule répond à la question la plus coûteuse.

### 2.1 Le déclencheur de vérification est-il seulement câblé ?

```sql
select key,
       case when value is null or value = '' then 'VIDE ⚠' else 'renseignée' end as etat
  from public.app_config
 where key in ('supabase_url', 'service_role_key');
```

`submit_agency_identity()` ne déclenche `agency-verification-run` que si ces deux clés
sont renseignées *(migration `20260729151400`)*. Si l'une manque, l'enchaînement est le
suivant, et il est **entièrement silencieux** :

1. `submit_agency_identity()` pose bien `identity_submitted_at` et journalise, mais le
   bloc `net.http_post` est sauté sans lever d'erreur.
2. Le filet horaire `sweep_pending_agency_verifications()` lit **les deux mêmes clés** et
   sort immédiatement (`return`) — donc sans même incrémenter
   `verification_sweep_attempts`.
3. Le dossier reste `verification_status = 'pending'` **indéfiniment**. Il ne bascule
   jamais en `manual_review`, n'apparaît donc jamais dans la file de revue. Un client
   aurait déposé son dossier et personne ne le verrait.

Indice rassurant qui ne vaut pas preuve : plusieurs crons actifs (`whatsapp-process`, la
famille `realadvisor-*`) lisent ces mêmes clés et fonctionnent *(à confirmer)*.

### 2.2 Compteurs de départ

```sql
select 'agencies' t, count(*) n from public.agencies
union all select 'soumises', count(*) from public.agencies where identity_submitted_at is not null
union all select 'pending', count(*) from public.agencies where verification_status = 'pending'
union all select 'manual_review', count(*) from public.agencies where verification_status = 'manual_review'
union all select 'auto_validated', count(*) from public.agencies where verification_status = 'auto_validated'
union all select 'personnes', count(*) from public.agency_related_persons
union all select 'checks', count(*) from public.agency_verification_checks
union all select 'runs', count(*) from public.agency_verification_runs
union all select 'legal_forms', count(*) from public.legal_forms;
```

Les relever : ils servent de référence au nettoyage final.

### 2.3 Le filet horaire tourne-t-il, et sans erreur ?

```sql
select jobname, schedule, active from cron.job
 where jobname = 'agency-verification-sweep-hourly';

select status, return_message, start_time
  from cron.job_run_details
 where jobid = (select jobid from cron.job where jobname = 'agency-verification-sweep-hourly')
 order by start_time desc limit 5;
```

Planifié à `25 * * * *` *(migration)*.

### 2.4 Dossiers déjà en souffrance

```sql
select id, legal_name, country, identity_submitted_at,
       verification_status, verification_sweep_attempts
  from public.agencies
 where identity_submitted_at is not null
   and verification_status = 'pending'
 order by identity_submitted_at;
```

---

## 3. Phase 1 — Fixtures

Tout est préfixé `ZZTEST-`, repérable et supprimable sans ambiguïté.

Le parcours réel part d'une inscription qui auto-provisionne l'agence
*(migration `20260729150500`)*. On court-circuite cette partie : elle est déjà couverte
par `tests/backend/onboarding-agency-rpc.spec.ts`, et la rejouer en prod supposerait de
passer par l'Auth, donc par une adresse e-mail relevable.

```sql
begin;

-- 1. Utilisateur d'authentification (à confirmer : colonnes exactes attendues par le
--    trigger de création de profil).
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-4000-8000-00000000f001',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated',
        'zztest-kyb@megga.invalid',
        crypt('never-used-no-login', gen_salt('bf')),
        now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb);

-- 2. Agence. legal_name / country préexistent au chantier ; legal_form_id,
--    business_registration_number et verification_status viennent de 20260729150100.
insert into public.agencies (id, name, legal_name, country, legal_form_id,
                             business_registration_number)
values ('00000000-0000-4000-8000-00000000a001',
        'ZZTEST-KYB',
        'ZZTEST-KYB Immobilier SA',
        'CH',
        (select id from public.legal_forms where code = 'CH_SA'),
        'CHE-000.000.000');

-- 3. Profil dirigeant. is_agency_admin() exige role in ('admin','manager') et
--    get_my_agency_id() lit profiles.agency_id (schéma baseline).
insert into public.profiles (id, agency_id, role, email, first_name, last_name)
values ('00000000-0000-4000-8000-00000000f001',
        '00000000-0000-4000-8000-00000000a001',
        'admin', 'zztest-kyb@megga.invalid', 'ZZTEST', 'Signataire');

-- 4. Signataire actif — sans lui la complétude refuse (migration 20260729150800).
insert into public.agency_related_persons (id, agency_id, profile_id,
                                           first_name, last_name, nationality)
values ('00000000-0000-4000-8000-00000000p001',
        '00000000-0000-4000-8000-00000000a001',
        '00000000-0000-4000-8000-00000000f001',
        'ZZTEST', 'Signataire', 'CH');

insert into public.agency_person_roles (related_person_id, role, valid_to)
values ('00000000-0000-4000-8000-00000000p001', 'signatory', null);

commit;
```

Les colonnes exactes de `profiles` et `agencies` sont à ajuster au premier passage : les
migrations du chantier KYB ne décrivent que les colonnes **ajoutées**, le schéma de base
vit dans `00000000000000_baseline_remote_schema.sql` *(à confirmer)*.

---

## 4. Phase 2 — Soumission sous contexte authentifié

`submit_agency_identity()` est `security definer` mais s'appuie sur `auth.uid()` : elle
doit être appelée sous une identité, jamais en `postgres`. On fabrique le contexte JWT
plutôt qu'une vraie session.

```sql
begin;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-00000000f001","role":"authenticated"}';

select public.submit_agency_identity('00000000-0000-4000-8000-00000000p001');

commit;
```

Ce que l'appel traverse réellement *(migration)* : la garde `is_agency_admin()`, la
résolution `get_my_agency_id()`, le contrôle de complétude en quatre points (raison
sociale → forme juridique → pays → signataire actif), le verrou `FOR UPDATE` sur la ligne
`agencies`, la pose d'`identity_submitted_at`, l'écriture dans `activity_events`
(`category = 'kyc'`), la pose du check `id_document` en `pending_manual_review` pour le
signataire, puis le `net.http_post` vers `agency-verification-run`.

Ce qu'il ne traverse pas : le navigateur, le gate `useIdentityGate`, le wizard, l'upload
Storage et l'émission du jeton par l'Auth.

⚠ Passer l'argument `p_related_person_id` : sans lui aucun check personne n'est posé, et
l'on ne teste qu'une moitié du chemin.

---

## 5. Phase 3 — Observation

Laisser 30 à 60 secondes — `net.http_post` est fire-and-forget.

```sql
-- Verdict
select id, legal_name, country, identity_submitted_at, verification_status,
       verification_score, verified_at, verification_sweep_attempts
  from public.agencies
 where id = '00000000-0000-4000-8000-00000000a001';

-- Checks entreprise : c'est ici que se lit la santé réelle des connecteurs
select check_type, source, result, score, details, created_at
  from public.agency_verification_checks
 where agency_id = '00000000-0000-4000-8000-00000000a001'
 order by created_at;

-- Checks personne
select check_type, source, result, created_at
  from public.agency_person_verification_checks
 where related_person_id = '00000000-0000-4000-8000-00000000p001';

-- Trace du run
select * from public.agency_verification_runs
 where agency_id = '00000000-0000-4000-8000-00000000a001';

-- Journal
select action, category, severity, actor_kind, metadata, created_at
  from public.activity_events
 where agency_id = '00000000-0000-4000-8000-00000000a001'
 order by created_at;

-- Livraison HTTP effective
select id, url, status_code, error_msg, created
  from net._http_response
 order by created desc limit 5;
```

Croiser avec les logs de l'edge function `agency-verification-run` sur la même fenêtre, et
vérifier que le dossier remonte dans la file de revue admin *(à confirmer — RPC de
pagination dans `20260729160000`)*.

### Lecture attendue

`verification_status` doit avoir quitté `pending`. Pour une agence suisse, l'issue normale
est **`manual_review`, pas `auto_validated`** — et ce n'est pas un échec :

| Check | Attendu | Cause |
|---|---|---|
| `registry_lookup` | `partial` au mieux | LINDAS ne renvoie pas le statut actif/radié |
| `address_geocode` | `unavailable` | `MAPBOX_TOKEN` absent des secrets Supabase, −1.5 pts |
| `vat_lookup` | `unavailable` | `UID_REGISTER_API_*` non configurées, connecteur non écrit |
| `id_document` | `pending_manual_review` | posé par la RPC, revue humaine par conception |

Un dossier suisse ne peut donc pas s'auto-valider en l'état. Ce qui prouve la chaîne,
c'est `manual_review` accompagné de lignes de check nommées et d'un score calculé — pas un
feu vert.

Si le statut reste `pending` au-delà de quelques minutes : retour au §2.1, c'est le
symptôme exact d'une `app_config` incomplète.

---

## 6. Phase 4 — Nettoyage

**Obligatoire.** Ordre imposé par les clés étrangères.

```sql
begin;

delete from public.agency_person_verification_checks
 where related_person_id = '00000000-0000-4000-8000-00000000p001';
delete from public.agency_person_roles
 where related_person_id = '00000000-0000-4000-8000-00000000p001';
delete from public.agency_related_persons
 where agency_id = '00000000-0000-4000-8000-00000000a001';
delete from public.agency_verification_checks
 where agency_id = '00000000-0000-4000-8000-00000000a001';
delete from public.agency_verification_runs
 where agency_id = '00000000-0000-4000-8000-00000000a001';
delete from public.activity_events
 where agency_id = '00000000-0000-4000-8000-00000000a001';
delete from public.profiles
 where id = '00000000-0000-4000-8000-00000000f001';
delete from public.agencies
 where id = '00000000-0000-4000-8000-00000000a001';
delete from auth.users
 where id = '00000000-0000-4000-8000-00000000f001';

commit;
```

Rejouer ensuite la requête du §2.2 et comparer aux compteurs de départ : tout doit être
revenu à l'identique.

La phase 2 ne dépose aucun document, le bucket `kyb-identity` n'est donc pas concerné. Si
le test est étendu à l'upload, ajouter la suppression de l'objet Storage sous le préfixe
de l'agence.

---

## 7. Ce que cette procédure ne prouve pas

Elle valide la **chaîne serveur** : RPC, RLS, triggers, moteur de vérification,
connecteurs externes, journalisation, file de revue.

Elle ne valide pas le **parcours client réel** : inscription par l'Auth, gate d'identité,
wizard, upload de la pièce d'identité, réception de la notification par e-mail. Pour
ceux-là, il faut dérouler l'interface sur `app.megga.ch` avec une adresse relevable — ou
pointer le harnais `npm run test:e2e:kyb` (`playwright.kyb.config.ts`) sur la prod, ce qui
suppose la clé `service_role`.

Les deux approches sont complémentaires. La chaîne serveur est celle qui échoue en
silence : c'est donc celle à tester en premier.
