-- Écran Sécurité en lecture — étape 14 du plan, spec §5.9, §7, §10.4, §10.5.
-- Contrat : docs/handoff/console-admin/front/admin-security.jsx.
--
-- CE QUI N'EST PAS CONSTRUIT ICI, ET POURQUOI :
--
-- · SEC_CHAIN (sealed / last / head / checked). L'objet n'est lu que par `SecExportModal`,
--   qui n'est instancié nulle part, n'est pas exporté sur `window` et ne reçoit aucun
--   déclencheur — le seul export du fichier est AdminSecuritySection. Trois de ses quatre
--   valeurs seraient donc calculées pour personne. Elles appartiennent au geste
--   `admin_log_export` du Lot 2, pas à une étape de lecture.
-- · L'enrichissement d'anomalie de session (« 187 entrées depuis cette IP », « IP jamais
--   vue »). `metadata` est FIGÉ dans le hash à l'insert : ce calcul appartient au GESTE,
--   pas à sa lecture. Il faudra amender 20260801220000, qui pose aujourd'hui `info` en dur.
--   Tant que ce n'est pas fait, aucune ligne `crit` de famille `session` ne peut exister.
-- · Le libellé français de `action`. Doublement muré : le commentaire de colonne interdit le
--   français en base, et `lint:prose` interdit le tiret cadratin dans `src/i18n/locales/**`
--   alors que les libellés de la maquette en contiennent. Sortie retenue : rendre la CLÉ et
--   `action_params`, et laisser l'interpolation au client.
--
-- DEUX CORRECTIFS À `get_admin_live_feed` (étape 11), que la revue de contrat a trouvés :
--   1. `count(*) over ()` : interdit noir sur blanc par 20260729160000, mesures à l'appui —
--      il rend l'index de tri inutilisable. Remplacé par une sous-requête scalaire.
--   2. La recherche interpolait la saisie BRUTE dans un `ilike` : un `%` ou un `_` tapés
--      changeaient la sémantique, et l'étape était pourtant libellée « recherche
--      normalisée » sans aucun unaccent. Corrigé aux deux endroits.

-- `unaccent` vit dans `public` en production, mais une base fraîche de CI ne l'a pas.
create extension if not exists unaccent with schema public;

-- ── 1. Fenêtre de temps (§10.5) ──────────────────────────────────────────────────────

drop function if exists public.admin_security_window(text);
create or replace function public.admin_security_window(p_window text default 'today')
returns timestamptz
language sql
stable
parallel safe
set search_path to 'public', 'pg_temp'
as $function$
  select case p_window
           -- Une fenêtre glissante n'a besoin d'aucun fuseau.
           when 'rolling_24h' then now() - interval '24 hours'
           -- §10.5 : « aujourd'hui » et « ce mois » se calculent en Europe/Zurich CÔTÉ
           -- SERVEUR. Mesuré : la borne de Zurich vaut 2026-07-30 22:00Z quand
           -- date_trunc('day', now()) vaut 2026-07-31 00:00Z — deux heures d'écart, donc
           -- deux listes différentes.
           when 'today' then date_trunc('day',   now() at time zone 'Europe/Zurich') at time zone 'Europe/Zurich'
           when 'month' then date_trunc('month', now() at time zone 'Europe/Zurich') at time zone 'Europe/Zurich'
         end
$function$;

comment on function public.admin_security_window(text) is
  'Borne BASSE d''une fenêtre d''affichage, en Europe/Zurich (§10.5). Pas de borne haute : '
  'un now() en borne haute exclurait une ligne écrite pendant la requête. Rend NULL sur une '
  'valeur inconnue — l''appelant lève, plutôt qu''un repli silencieux sur toute la table.';

-- Sans garde ne veut pas dire ouverte à tous. Une fonction créée sans rien révoquer est
-- exécutable par PUBLIC, donc par `anon` — et le balayage de gardes ne la verrait pas : il
-- ne filtre que les SECURITY DEFINER. Celle-ci ne divulgue rien (elle ne lit aucune table),
-- mais laisser une entrée publique par inadvertance est le patron du footgun du dépôt.
revoke all on function public.admin_security_window(text) from public, anon;
grant execute on function public.admin_security_window(text) to authenticated, service_role;

-- ── 2. Composition de l'entité ───────────────────────────────────────────────────────

drop function if exists public.admin_security_entity(text, text, text);
create or replace function public.admin_security_entity(
  p_entity_type text, p_entity_label text, p_agency_name text
)
returns text
language sql
immutable
parallel safe
set search_path to 'public', 'pg_temp'
as $function$
  select array_to_string(array_remove(array[
    nullif(btrim(case p_entity_type
      when 'contact'       then 'Contact'
      when 'admin_console' then 'Console'
      when 'session'       then 'Session'
      when 'agency'        then 'Agence'
      when 'profile'       then 'Compte'
      when 'kyc_link'      then 'Lien'
      when 'cron'          then 'Cron'
      when 'subscription'  then 'Abonnement'
      when 'platform'      then 'Plateforme'
      -- Un type inconnu est rendu TEL QUEL : il doit rester visible à l'écran plutôt
      -- que d'être absorbé en silence.
      else p_entity_type
    end), ''),
    nullif(btrim(coalesce(p_entity_label, '')), ''),
    nullif(btrim(coalesce(p_agency_name, '')), '')
  ], null), ' · ')
$function$;

comment on function public.admin_security_entity(text, text, text) is
  'Compose la colonne « entité » de l''écran : 2 ou 3 segments joints par « · ». IMMUTABLE '
  'sans rien lire — si un référentiel de libellés était introduit un jour, il faudrait la '
  'passer STABLE, sous peine de rejouer le mensonge de volatilité de public.slugify(). '
  'La chaîne CHERCHÉE et la chaîne AFFICHÉE doivent rester la même : ne pas dupliquer '
  'cette composition dans les appelants.';

revoke all on function public.admin_security_entity(text, text, text) from public, anon;
grant execute on function public.admin_security_entity(text, text, text) to authenticated, service_role;

-- ── 3. Le journal (liste principale) ─────────────────────────────────────────────────

drop function if exists public.get_admin_security_journal(text, text, text, integer, integer);
create or replace function public.get_admin_security_journal(
  p_window text default 'today',
  p_filter text default 'all',
  p_search text default null,
  p_limit  integer default 20,
  p_offset integer default 0
)
returns table (
  id            uuid,
  ts            text,
  sev           text,
  fam           text,
  action        text,
  action_params jsonb,
  entity        text,
  actor         text,
  meta          jsonb,
  total_count   bigint
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_from   timestamptz;
  v_limit  integer;
  v_offset integer;
  v_sev    text;
  v_fam    text;
  v_search text;
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  v_from := public.admin_security_window(p_window);
  if v_from is null then
    raise exception 'fenetre inconnue: %', p_window using errcode = '22023';
  end if;

  v_limit  := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset := greatest(coalesce(p_offset, 0), 0);

  -- Le filtre unique de l'écran porte indifféremment une sévérité ou une famille : les deux
  -- vocabulaires sont disjoints par construction, ce qui rend la résolution non ambiguë.
  if coalesce(p_filter, 'all') <> 'all' then
    select code into v_sev from public.admin_log_severity where code = p_filter;
    if v_sev is null then
      select code into v_fam from public.admin_log_family where code = p_filter;
      if v_fam is null then
        raise exception 'filtre inconnu: %', p_filter using errcode = '22023';
      end if;
    end if;
  end if;

  -- Jokers neutralisés : un « % » tapé par l'agent ne doit pas changer la sémantique.
  v_search := nullif(btrim(replace(replace(coalesce(p_search, ''), '%', ''), '_', '')), '');
  if v_search is not null and length(v_search) < 3 then
    v_search := null;   -- §7 : ignorée sous 3 caractères, jamais rejetée
  end if;

  return query
  select l.id,
         to_char(l.ts at time zone 'Europe/Zurich', 'HH24:MI:SS'),
         l.severity,
         l.family,
         l.action,
         l.action_params,
         public.admin_security_entity(l.entity_type, l.entity_label, a.name),
         l.actor_label,
         -- [{l,v}] → [[l,v]] : l'écran parcourt des paires ordonnées. WITH ORDINALITY +
         -- ORDER BY, sans quoi jsonb_agg a un ordre non spécifié et afficherait la
         -- conséquence avant le fait. NULL sur tableau vide : `[]` est truthy en JS et
         -- ouvrirait un bloc muet.
         case when jsonb_array_length(l.metadata) = 0 then null
              else (select jsonb_agg(jsonb_build_array(e ->> 'l', e ->> 'v') order by ord)
                      from jsonb_array_elements(l.metadata) with ordinality t(e, ord))
         end,
         (select count(*) from public.admin_log c
           left join public.agencies ca on ca.id = c.agency_id
           where not c.routine
             and c.ts >= v_from
             and (v_sev is null or c.severity = v_sev)
             and (v_fam is null or c.family   = v_fam)
             and (v_search is null
                  or public.unaccent(lower(coalesce(c.actor_label, '')))  like '%' || public.unaccent(lower(v_search)) || '%'
                  or public.unaccent(lower(coalesce(c.entity_label, ''))) like '%' || public.unaccent(lower(v_search)) || '%'
                  or public.unaccent(lower(coalesce(ca.name, '')))        like '%' || public.unaccent(lower(v_search)) || '%'))
    from public.admin_log l
    left join public.agencies a on a.id = l.agency_id
   -- `not routine` en LITTÉRAL : un prédicat paramétré n'utiliserait pas l'index partiel.
   where not l.routine
     and l.ts >= v_from
     and (v_sev is null or l.severity = v_sev)
     and (v_fam is null or l.family   = v_fam)
     and (v_search is null
          or public.unaccent(lower(coalesce(l.actor_label, '')))  like '%' || public.unaccent(lower(v_search)) || '%'
          or public.unaccent(lower(coalesce(l.entity_label, ''))) like '%' || public.unaccent(lower(v_search)) || '%'
          or public.unaccent(lower(coalesce(a.name, '')))         like '%' || public.unaccent(lower(v_search)) || '%')
   -- ts desc seul n'est pas un ordre total : seq départage, sinon OFFSET saute des lignes.
   order by l.ts desc, l.seq desc
   limit v_limit offset v_offset;
end;
$function$;

comment on function public.get_admin_security_journal(text, text, text, integer, integer) is
  'Liste principale de l''écran Sécurité : les événements NON routine. Rend la clé d''action '
  'et ses paramètres, jamais un libellé français — le commentaire de colonne d''admin_log '
  'l''interdit et l''i18n interpole côté client. La recherche porte sur l''acteur, l''entité '
  'et l''agence, jamais sur l''action : la base stocke `deploy_rollback`, chercher '
  '« déploiement » ne rendrait jamais rien. Le placeholder de l''écran dit d''ailleurs vrai.';

revoke all on function public.get_admin_security_journal(text, text, text, integer, integer) from public, anon;
grant execute on function public.get_admin_security_journal(text, text, text, integer, integer) to authenticated, service_role;

-- ── 4. Le pied replié (routine) ──────────────────────────────────────────────────────

drop function if exists public.get_admin_security_routine(text, integer);
create or replace function public.get_admin_security_routine(
  p_window text default 'today',
  p_limit  integer default 5
)
returns table (
  id            uuid,
  ts            text,
  action        text,
  action_params jsonb,
  entity        text,
  actor         text,
  routine_total bigint
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_from  timestamptz;
  v_limit integer;
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  v_from := public.admin_security_window(p_window);
  if v_from is null then
    raise exception 'fenetre inconnue: %', p_window using errcode = '22023';
  end if;
  v_limit := least(greatest(coalesce(p_limit, 5), 1), 20);

  return query
  select l.id,
         to_char(l.ts at time zone 'Europe/Zurich', 'HH24:MI:SS'),
         l.action, l.action_params,
         public.admin_security_entity(l.entity_type, l.entity_label, a.name),
         l.actor_label,
         (select count(*) from public.admin_log c where c.routine and c.ts >= v_from)
    from public.admin_log l
    left join public.agencies a on a.id = l.agency_id
   -- Littéral, pour le second index partiel.
   where l.routine
     and l.ts >= v_from
   order by l.ts desc, l.seq desc
   limit v_limit;
end;
$function$;

comment on function public.get_admin_security_routine(text, integer) is
  'Pied replié de l''écran : les événements de routine. Fonction SÉPARÉE de la liste '
  'principale, et non un paramètre `p_routine` — un prédicat d''index partiel doit être un '
  'LITTÉRAL, un paramètre ferait abandonner l''index. `routine_total` alimente le « N autres, '
  'non listées, scellées dans la chaîne » du pied.';

revoke all on function public.get_admin_security_routine(text, integer) from public, anon;
grant execute on function public.get_admin_security_routine(text, integer) to authenticated, service_role;

-- ── 5. Compteurs de tête et de puces ─────────────────────────────────────────────────

drop function if exists public.get_admin_security_counters(text);
create or replace function public.get_admin_security_counters(p_window text default 'today')
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_from timestamptz;
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  v_from := public.admin_security_window(p_window);
  if v_from is null then
    raise exception 'fenetre inconnue: %', p_window using errcode = '22023';
  end if;

  -- ARBITRAGE ASSUMÉ : les compteurs portent sur la liste PRINCIPALE (`not routine`), pas
  -- sur la fenêtre entière. La maquette affiche « Tout 340 » = 8 + 332, donc routine
  -- comprise — mais cliquer une puce filtre une liste qui, elle, exclut la routine :
  -- « Abonnements · 1 » ouvrirait « Aucun événement pour ce filtre ». Un compteur qui
  -- promet une ligne que la liste ne peut pas montrer est pire qu'un compteur plus petit.
  -- Le total de routine est rendu à part, pour le pied.
  return jsonb_build_object(
    'window',        p_window,
    'from',          v_from,
    'total',         (select count(*) from public.admin_log where not routine and ts >= v_from),
    'routine_total', (select count(*) from public.admin_log where routine     and ts >= v_from),
    'by_severity',   coalesce((select jsonb_object_agg(severity, n) from (
                        select severity, count(*) as n from public.admin_log
                         where not routine and ts >= v_from group by severity) s), '{}'::jsonb),
    'by_family',     coalesce((select jsonb_object_agg(family, n) from (
                        select family, count(*) as n from public.admin_log
                         where not routine and ts >= v_from group by family) f), '{}'::jsonb)
  );
end;
$function$;

comment on function public.get_admin_security_counters(text) is
  'KPI de tête et compteurs de puces, sur la liste PRINCIPALE (non routine) — un compteur '
  'qui promet une ligne que la liste ne peut pas montrer est pire qu''un compteur plus petit. '
  'La famille `impers` n''existe pas dans le référentiel : le roster de puces en compte 6, '
  'pas 7. « Voir en tant que » est retiré de la V1.';

revoke all on function public.get_admin_security_counters(text) from public, anon;
grant execute on function public.get_admin_security_counters(text) to authenticated, service_role;

-- ── 6. Correctifs de get_admin_live_feed (étape 11) ──────────────────────────────────
--
-- Deux défauts trouvés par la revue de contrat de l'étape 14, dans ce que l'étape 11 avait
-- livré deux jours plus tôt :
--   1. `count(*) over ()` — interdit explicitement par 20260729160000, mesures à l'appui :
--      il rend l'index de tri inutilisable. Sous-requête scalaire à la place.
--   2. La saisie était interpolée BRUTE dans un `ilike`, sans neutraliser `%` ni `_`, et
--      sans unaccent alors que la recherche est dite « normalisée ».

create or replace function public.get_admin_live_feed(
  p_limit    integer default 14,
  p_offset   integer default 0,
  p_category text default null,
  p_action   text default null,
  p_search   text default null
)
returns table (
  id           uuid,
  ts           timestamptz,
  action       text,
  category     text,
  severity     text,
  entity_type  text,
  object_label text,
  agency_id    uuid,
  agency_name  text,
  actor_kind   text,
  actor_label  text,
  total_count  bigint
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_limit  integer;
  v_offset integer;
  v_search text;
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  v_limit  := least(greatest(coalesce(p_limit, 14), 1), 100);
  v_offset := greatest(coalesce(p_offset, 0), 0);
  v_search := nullif(btrim(replace(replace(coalesce(p_search, ''), '%', ''), '_', '')), '');
  if v_search is not null and length(v_search) < 3 then
    v_search := null;
  end if;

  return query
  select e.id, e.created_at, e.action, e.category, e.severity, e.entity_type, e.object_label,
         e.agency_id, a.name, e.actor_kind,
         coalesce(nullif(btrim(coalesce(p.full_name, '')), ''), p.email),
         (select count(*) from public.activity_events c
           where (p_category is null or c.category = p_category)
             and (p_action   is null or c.action   = p_action)
             and (v_search   is null
                  or public.unaccent(lower(coalesce(c.object_label, ''))) like '%' || public.unaccent(lower(v_search)) || '%'
                  or public.unaccent(lower(c.action))                     like '%' || public.unaccent(lower(v_search)) || '%'))
    from public.activity_events e
    left join public.agencies a on a.id = e.agency_id
    left join public.profiles p on p.id = e.actor_id
   where (p_category is null or e.category = p_category)
     and (p_action   is null or e.action   = p_action)
     and (v_search   is null
          or public.unaccent(lower(coalesce(e.object_label, ''))) like '%' || public.unaccent(lower(v_search)) || '%'
          or public.unaccent(lower(e.action))                     like '%' || public.unaccent(lower(v_search)) || '%')
   order by e.created_at desc, e.id desc
   limit v_limit offset v_offset;
end;
$function$;
