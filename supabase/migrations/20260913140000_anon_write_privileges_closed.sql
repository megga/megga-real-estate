-- `anon` n'a plus aucun droit d'écriture sur les tables de `public`, sauf l'INSERT de
-- `seller_leads` — et les tables futures naissent fermées (audit du 13.09.2026, point S5).
--
-- ⛔ MESURÉ EN PRODUCTION LE 13.09.2026. `anon` détenait INSERT et DELETE sur 69 tables,
-- UPDATE sur 68, REFERENCES et TRIGGER sur 69 — dont `transactions`, `agencies`,
-- `profiles`, `properties`, `kyc_cases`, `whatsapp_messages`, `documents`, `reminders`.
-- Aucune migration ne les accordait : ce sont les droits par défaut de Supabase, posés à la
-- création de chaque table (`pg_default_acl` du rôle postgres sur `public` :
-- `anon=arwdDxtm`). La RLS était le SEUL verrou, et elle tenait — les 212 lectures
-- anonymes de `kyc_cases` envoyées par la CI ce jour-là ont toutes rendu `[]`. Mais une
-- policy trop large écrite demain suffirait ; retirer le GRANT met le verrou un cran plus
-- haut, là où aucune policy ne peut plus rien laisser passer.
--
-- CE QUI ÉCRIT RÉELLEMENT EN `anon`, relevé avant de révoquer :
--   · une seule policy d'écriture est ouverte à `anon` : `seller_leads_anon_insert`
--     (l'entonnoir public, qui force `assigned_agency_id`, `contact_id` et `property_id` à
--     NULL) — son INSERT est ré-accordé ci-dessous, et lui seul ;
--   · toutes les autres policies d'écriture sans clause `TO` dépendent d'une identité
--     (`auth.uid()`, `get_user_agency_id()`, `is_super_admin()`, `auth.role() =
--     'service_role'`), fausses pour `anon` ;
--   · les parcours publics à jeton (visites, réception acheteur, lien KYC, appel d'accueil)
--     passent par des fonctions SECURITY DEFINER ou des edge functions en service_role :
--     ils n'ont besoin d'AUCUN droit de table pour `anon` ;
--   · aucune page publique de l'app n'écrit directement par PostgREST (vérifié dans
--     `src/pages/public` et leurs hooks).
--
-- La lecture n'est PAS touchée ici : révoquer un SELECT transforme un `[]` silencieux en
-- erreur visible côté client, et ça se mesure table par table (cf. check-privilege-drift).
--
-- ET POUR `authenticated` : seuls TRUNCATE, REFERENCES, TRIGGER (et MAINTAIN en PG17)
-- sont retirés. TRUNCATE est la seule commande d'écriture qu'AUCUNE policy ne gouverne —
-- `email_delivery_events` y était encore ouverte ; les trois autres ne servent qu'au DDL.
-- INSERT/UPDATE/DELETE restent : c'est la RLS qui les borne, et le CRM en vit.
--
-- ⚠ LES TABLES DE POSTGIS (`spatial_ref_sys`, et les vues `geography_columns` /
-- `geometry_columns`) appartiennent à `supabase_admin` : `postgres` ne peut ni révoquer
-- leurs droits, ni modifier les droits par défaut de `supabase_admin`. Elles sont exclues
-- par propriétaire, pas par nom — et nommées dans la garde de production.
--
-- Gardes : `scripts/check-privilege-drift.mjs` (production, propriété étendue) et
-- `tests/backend/anon-write-privileges.spec.ts` (base fraîche, y compris une table créée
-- APRÈS cette migration).

do $$
declare
  r record;
  v_pg17 boolean := current_setting('server_version_num')::int >= 170000;
  v_maintain text := case when v_pg17 then ', maintain' else '' end;
begin
  for r in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind in ('r', 'p', 'v', 'm', 'f')
       -- Seules les relations que l'exécutant peut effectivement modifier : un REVOKE
       -- sur une table de supabase_admin ne ferait qu'un WARNING « no privileges could
       -- be revoked », sans rien changer.
       and pg_has_role(current_user, c.relowner, 'USAGE')
  loop
    execute format(
      'revoke insert, update, delete, truncate, references, trigger%s on table public.%I from anon',
      v_maintain, r.relname);
    execute format(
      'revoke truncate, references, trigger%s on table public.%I from authenticated',
      v_maintain, r.relname);
  end loop;
end $$;

-- L'entonnoir public, et lui seul.
grant insert on table public.seller_leads to anon;

-- Les tables FUTURES créées par postgres (les migrations) naissent fermées à l'écriture
-- anonyme. Sans ceci, la prochaine `create table` reposerait `anon=arwdDxtm` en silence.
do $$
declare
  v_maintain text := case when current_setting('server_version_num')::int >= 170000 then ', maintain' else '' end;
begin
  if pg_has_role(current_user, 'postgres', 'MEMBER') then
    execute format(
      'alter default privileges for role postgres in schema public revoke insert, update, delete, truncate, references, trigger%s on tables from anon',
      v_maintain);
    execute format(
      'alter default privileges for role postgres in schema public revoke truncate, references, trigger%s on tables from authenticated',
      v_maintain);
  end if;
end $$;
