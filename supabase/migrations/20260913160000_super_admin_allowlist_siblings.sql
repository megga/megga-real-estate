-- Le rôle super_admin ne suffit plus nulle part en base : trois policies et deux triggers de
-- rétention KYC exigent désormais `public.is_super_admin()` — rôle ET e-mail
-- d'authentification allowlisté (audit du 13.09.2026, point S8, volet SQL).
--
-- ⛔ CE QUI RESTAIT OUVERT. Les objets d'administration du schéma testent
-- `is_super_admin()`, qui joint `auth.users` et passe l'e-mail par
-- `super_admin_allowlist_match`. Cinq objets de production testaient
-- `profiles.role = 'super_admin'` SEUL — mesuré le 13.09.2026 par un balayage pg_policies /
-- pg_proc des littéraux 'super_admin' qui n'appellent ni is_super_admin() ni
-- super_admin_allowlist_match, et ce sont les cinq seuls :
--   · agent_ai_profiles_select_own (20260530190000) — lecture du profil IA de TOUT agent ;
--   · admin_feature_flags_write (baseline) — écriture des drapeaux de la plateforme, USING
--     et WITH CHECK ;
--   · admin_nps_select_admin (baseline) — lecture de toutes les réponses NPS ;
--   · enforce_kyc_cases_retention et enforce_kyc_magic_links_retention (baseline) — le
--     contournement du verrou de conservation LBA de dix ans (art. 7 al. 3), accordé sur
--     `v_user_role = 'super_admin'`. Leur jumeau `enforce_kyc_retention` (documents)
--     appelait déjà is_super_admin() : c'est lui qui avait raison.
--
-- POURQUOI LE RÔLE SEUL NE SUFFIT PAS. Le rôle est une colonne de `profiles` ; l'allowlist
-- lit l'e-mail d'AUTHENTIFICATION, que le titulaire ne choisit pas. Le rôle ne se modifie
-- plus par UPDATE client (20260627120000), mais l'INSERT d'un profil par un compte qui n'en
-- avait pas l'acceptait encore : prouvé en production dans une transaction annulée, un
-- profil auto-inséré en super_admin lisait par la première policy le profil IA d'un autre
-- agent. La migration suivante (20260913160100) ferme cet INSERT ; celle-ci retire aux cinq
-- objets la prémisse dont ils dépendaient — les deux verrous sont indépendants.
--
-- CE QUI NE CHANGE PAS : les rôles visés par chaque policy (public, public, authenticated),
-- la clause agent de la première (`agent_id = auth.uid()`) ; pour les deux triggers, la
-- SECURITY DEFINER, le search_path, le propriétaire et les droits d'exécution (CREATE OR
-- REPLACE les conserve), le message d'erreur et les deux écritures d'audit —
-- `attempted_by_role` continue de rapporter le RÔLE lu, pour qu'un titulaire non
-- allowlisté arrêté par le verrou se lise comme tel dans le journal.
--
-- ⚠ Évaluée pour `anon`, une policy `TO public` qui appelle is_super_admin() lèverait
-- « permission denied for function » (anon n'a pas EXECUTE) au lieu de filtrer. Sans effet
-- ici, mesuré le 13.09.2026 : anon n'a AUCUN privilège sur admin_feature_flags ni sur
-- admin_nps_responses (refus au niveau de la table, avant la RLS), et la troisième policy
-- ne vise qu'authenticated. Dix-sept policies `TO public` du schéma appellent déjà
-- is_super_admin() de la même façon.
--
-- Idempotente : DROP POLICY IF EXISTS avant chaque CREATE POLICY, CREATE OR REPLACE pour
-- les fonctions. Le bloc final VÉRIFIE l'invariant, et se contrôle lui-même.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. agent_ai_profiles — l'agent lit le sien, le super-admin allowlisté lit tout
-- ═══════════════════════════════════════════════════════════════════════════
drop policy if exists agent_ai_profiles_select_own on public.agent_ai_profiles;
create policy agent_ai_profiles_select_own
  on public.agent_ai_profiles
  for select
  to authenticated
  using (agent_id = auth.uid() or public.is_super_admin());

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. admin_feature_flags — seule la console écrit les drapeaux de la plateforme
-- ═══════════════════════════════════════════════════════════════════════════
drop policy if exists admin_feature_flags_write on public.admin_feature_flags;
create policy admin_feature_flags_write
  on public.admin_feature_flags
  for all
  to public
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. admin_nps_responses — lecture réservée à la console
-- ═══════════════════════════════════════════════════════════════════════════
drop policy if exists admin_nps_select_admin on public.admin_nps_responses;
create policy admin_nps_select_admin
  on public.admin_nps_responses
  for select
  to public
  using (public.is_super_admin());

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Rétention KYC des dossiers — le contournement suit is_super_admin()
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.enforce_kyc_cases_retention()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_user_role        text;
  v_retention_until  timestamptz;
  v_contournement    boolean;
begin
  -- Fin de la rétention : 10 ans depuis la création.
  v_retention_until := old.created_at + interval '10 years';

  -- Le rôle n'est plus lu que pour le journal (`attempted_by_role`). La décision de
  -- contourner appartient à is_super_admin() : rôle ET e-mail d'auth allowlisté.
  select role into v_user_role from profiles where id = auth.uid();
  v_contournement := coalesce(public.is_super_admin(), false);

  -- Encore dans la fenêtre de rétention, sans contournement autorisé → refuser.
  if v_retention_until > now() and not v_contournement then
    -- Trace de la tentative bloquée, pour l'audit FINMA.
    insert into activity_events
      (agency_id, actor_id, action, entity_type, entity_id,
       category, severity, object_label, metadata)
    values (
      old.agency_id,
      auth.uid(),
      'Tentative suppression dossier KYC bloquée',
      'kyc_case',
      old.id,
      'kyc',
      'critical',
      'Dossier ' || old.id::text,
      jsonb_build_object(
        'reason', 'retention_period_active',
        'retention_until', v_retention_until::text,
        'created_at', old.created_at::text,
        'lba_article', 'art. 7 al. 3 (conservation 10 ans)',
        'attempted_by_role', coalesce(v_user_role, 'unknown')
      )
    );

    raise exception 'Suppression du dossier KYC interdite avant le %. Article 7 al. 3 LBA — conservation obligatoire 10 ans.',
      to_char(v_retention_until, 'DD.MM.YYYY');
  end if;

  -- Contournement par un super-admin allowlisté : tracé à part (rare, audit séparé).
  if v_contournement and v_retention_until > now() then
    insert into activity_events
      (agency_id, actor_id, action, entity_type, entity_id,
       category, severity, object_label, metadata)
    values (
      old.agency_id,
      auth.uid(),
      'Suppression dossier KYC par super_admin (bypass rétention)',
      'kyc_case',
      old.id,
      'kyc',
      'warn',
      'Dossier ' || old.id::text,
      jsonb_build_object(
        'reason', 'super_admin_override',
        'retention_until', v_retention_until::text,
        'created_at', old.created_at::text,
        'dossier_status', old.dossier_status,
        'sanctions_status', old.sanctions_status,
        'pep_status', old.pep_status
      )
    );
  end if;

  return old;
end;
$$;

comment on function public.enforce_kyc_cases_retention() is
  'Trigger BEFORE DELETE kyc_cases. Refuse la suppression pendant 10 ans (LBA art. 7 al. 3). '
  'Miroir de enforce_kyc_retention sur documents. Contournement réservé à is_super_admin() — '
  'rôle ET e-mail d''authentification allowlisté (20260913160000, audit S8) — avec audit warn. '
  'Log critical sur tentative bloquée.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Rétention KYC des liens magiques — même règle
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.enforce_kyc_magic_links_retention()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_age_years      numeric;
  v_user_role      text;
  v_contournement  boolean;
begin
  v_age_years := extract(epoch from (now() - old.created_at)) / (365.25 * 24 * 3600);

  -- Le rôle n'est plus lu que pour mémoire ; is_super_admin() décide du contournement.
  select role::text into v_user_role from profiles where id = auth.uid();
  v_contournement := coalesce(public.is_super_admin(), false);

  if v_age_years < 10 and not v_contournement then
    insert into activity_events
      (agency_id, actor_id, action, entity_type, entity_id,
       category, severity, object_label, metadata)
    values (
      old.agency_id,
      auth.uid(),
      'Tentative suppression lien magique bloquée',
      'kyc_magic_link',
      old.id,
      'kyc',
      'critical',
      'Lien magique ' || old.id::text,
      jsonb_build_object(
        'reason', 'retention_period_active',
        'age_years', round(v_age_years, 2),
        'lba_article', 'art. 7 al. 3'
      )
    );
    raise exception 'Suppression du lien magique interdite avant 10 ans (LBA art. 7 al. 3).';
  end if;

  -- M2 fix : audit du contournement pour la traçabilité FINMA.
  if v_contournement and v_age_years < 10 then
    insert into activity_events
      (agency_id, actor_id, action, entity_type, entity_id,
       category, severity, object_label, metadata)
    values (
      old.agency_id,
      auth.uid(),
      'Suppression lien magique par super_admin (bypass rétention)',
      'kyc_magic_link',
      old.id,
      'kyc',
      'warn',
      'Lien magique ' || old.id::text,
      jsonb_build_object(
        'reason', 'super_admin_override',
        'age_years', round(v_age_years, 2),
        'created_at', old.created_at::text,
        'kyc_case_id', old.kyc_case_id,
        'status', old.status::text
      )
    );
  end if;

  return old;
end;
$$;

comment on function public.enforce_kyc_magic_links_retention() is
  'Trigger BEFORE DELETE kyc_magic_links. Refuse la suppression pendant 10 ans (LBA art. 7 '
  'al. 3). Contournement réservé à is_super_admin() — rôle ET e-mail d''authentification '
  'allowlisté (20260913160000, audit S8) — avec audit warn. Log critical sur tentative bloquée.';

-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION — l'invariant, et le contrôle qui l'empêche d'être creux
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare
  -- Même motif que le balayage qui a trouvé les cinq objets : un littéral 'super_admin'
  -- rapproché d'un rôle, dans un sens ou dans l'autre.
  v_motif_role constant text := 'role[^;]{0,40}''super_admin''|''super_admin''[^;]{0,40}role';
  v_fautifs    text;
  v_n          int;
begin
  -- 1. Les trois policies existent, appellent is_super_admin() sur chaque clause qu'elles
  --    portent, et ne comparent plus le rôle au littéral.
  select string_agg(t.tbl || '.' || t.pol, ', ')
    into v_fautifs
    from (values
      ('agent_ai_profiles', 'agent_ai_profiles_select_own', false),
      ('admin_feature_flags', 'admin_feature_flags_write', true),
      ('admin_nps_responses', 'admin_nps_select_admin', false)
    ) as t(tbl, pol, avec_check)
    left join pg_policies p
      on p.schemaname = 'public' and p.tablename = t.tbl and p.policyname = t.pol
   where p.policyname is null
      or coalesce(p.qual, '') not like '%is_super_admin()%'
      or (t.avec_check and coalesce(p.with_check, '') not like '%is_super_admin()%')
      or (coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '')) like '%''super_admin''%';
  if v_fautifs is not null then
    raise exception 'S8 : policy absente ou encore sur le rôle seul : %', v_fautifs;
  end if;

  -- 2. Les deux triggers de rétention : présents, SECURITY DEFINER, sur is_super_admin(),
  --    sans comparaison du rôle au littéral.
  select count(*), string_agg(p.proname, ', ') filter (
           where p.prosrc not like '%is_super_admin()%'
              or p.prosrc ~* v_motif_role
              or not p.prosecdef)
    into v_n, v_fautifs
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.proname in ('enforce_kyc_cases_retention', 'enforce_kyc_magic_links_retention');
  if v_n <> 2 then
    raise exception 'S8 : % trigger(s) de rétention KYC trouvé(s), 2 attendus', v_n;
  end if;
  if v_fautifs is not null then
    raise exception 'S8 : trigger de rétention encore sur le rôle seul : %', v_fautifs;
  end if;

  -- 3. CONTRÔLES POSITIFS — sans eux, un motif cassé rendrait les deux vérifications
  --    vertes sur rien. (a) Le motif reconnaît la forme d'avant, recopiée de la baseline.
  if not ('IF v_retention_until > NOW() AND COALESCE(v_user_role, '''') <> ''super_admin'' THEN' ~* v_motif_role) then
    raise exception 'contrôle positif : le motif ne reconnaît plus un contournement par rôle seul';
  end if;
  if not ('(profiles.role = ''super_admin''::text)' like '%''super_admin''%') then
    raise exception 'contrôle positif : le motif des policies ne reconnaît plus un rôle seul';
  end if;
  -- (b) La lecture du catalogue voit bien is_super_admin() là où il est : le jumeau des
  --     documents, qui l'appelait déjà.
  if not exists (
    select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public' and p.proname = 'enforce_kyc_retention'
       and p.prosrc like '%is_super_admin()%'
  ) then
    raise exception 'contrôle positif : enforce_kyc_retention n''est plus lu comme appelant is_super_admin()';
  end if;
end $$;
