-- Lecture du Live et tunnel KYC agrégé — étapes 11 et 13 du plan, spec §5.2, §5.5, §10.4.
--
-- POURQUOI DES FONCTIONS ET NON DES VUES. §4.3 nomme `v_kyc_funnel_30d`. Une vue ne peut
-- pas porter de garde : PostgreSQL n'applique pas de RLS aux vues, et une vue en
-- `security_invoker` hériterait de la RLS de `kyc_cases`, donc rendrait à chaque agent les
-- agrégats de SA propre agence — ce qui n'est ni le contrat ni ce que la console affiche.
-- Sans `security_invoker`, elle tourne en propriétaire et n'importe quel `authenticated`
-- lirait les agrégats de toute la plateforme. Les deux options fuient. Le patron du dépôt
-- (SECURITY DEFINER + garde) est le seul qui tienne, et il est appliqué ici. Écart de
-- nommage assumé, signalé plutôt que silencieux.
--
-- ZÉRO NOM. §5.5 et le principe 1 (§0) interdisent qu'un dossier KYC de client final
-- remonte à la plateforme. Le tunnel ne rend donc que des COMPTES : aucun identifiant de
-- contact, aucun nom d'agence, aucune colonne nominative. Un test le vérifie sur la
-- signature de retour, pas sur une relecture du code.

-- ── 1. Live paginé (§5.2, étape 11) ──────────────────────────────────────────────────

drop function if exists public.get_admin_live_feed(integer, integer, text, text, text);
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

  -- §10.4 : borner TOUTE liste. `greatest()` seul est un PLANCHER — c'est le piège relevé
  -- sur get_admin_kyc_magic_links, dont le `greatest(p_limit, 1)` n'impose aucun maximum et
  -- laisse un appelant demander la table entière. Il faut les deux bornes.
  v_limit  := least(greatest(coalesce(p_limit, 14), 1), 100);
  v_offset := greatest(coalesce(p_offset, 0), 0);
  v_search := nullif(btrim(coalesce(p_search, '')), '');
  -- §7 : requête ignorée sous 3 caractères, comme le diagnostic de lien KYC.
  if v_search is not null and length(v_search) < 3 then
    v_search := null;
  end if;

  return query
  with filtre as (
    select e.*
      from public.activity_events e
     where (p_category is null or e.category = p_category)
       and (p_action   is null or e.action   = p_action)
       and (v_search   is null
            or e.object_label ilike '%' || v_search || '%'
            or e.action       ilike '%' || v_search || '%')
  )
  select f.id, f.created_at, f.action, f.category, f.severity, f.entity_type, f.object_label,
         f.agency_id, a.name,
         f.actor_kind,
         coalesce(nullif(btrim(coalesce(p.full_name, '')), ''), p.email) as actor_label,
         count(*) over () as total_count
    from filtre f
    left join public.agencies a on a.id = f.agency_id
    left join public.profiles p on p.id = f.actor_id
   order by f.created_at desc, f.id desc
   limit v_limit offset v_offset;
end;
$function$;

comment on function public.get_admin_live_feed(integer, integer, text, text, text) is
  'Flux Live paginé côté serveur (§5.2). `total_count` par fenêtre glissante pour le compteur '
  'de l''écran. Limite bornée en HAUT autant qu''en bas : un greatest() seul est un plancher, '
  'et c''est ce qui laisse get_admin_kyc_magic_links rendre la table entière. Le tri est '
  '(created_at desc, id desc) : created_at seul n''est pas total, deux événements d''une même '
  'transaction le partagent et la pagination sauterait des lignes.';

revoke all on function public.get_admin_live_feed(integer, integer, text, text, text) from public, anon;
grant execute on function public.get_admin_live_feed(integer, integer, text, text, text) to authenticated, service_role;

-- Le tri de la pagination doit être servi par un index, sinon chaque page trie la table.
create index if not exists activity_events_live_feed_idx
  on public.activity_events (created_at desc, id desc);

-- ── 2. Tunnel KYC agrégé (§5.5, étape 13) ────────────────────────────────────────────

drop function if exists public.get_admin_kyc_funnel_30d();
create or replace function public.get_admin_kyc_funnel_30d()
returns table (
  window_days       integer,
  cases_opened      bigint,
  cases_validated   bigint,
  cases_pending     bigint,
  links_sent        bigint,
  links_opened      bigint,
  links_submitted   bigint,
  links_expired     bigint,
  median_hours_open numeric
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  return query
  select
    30,
    (select count(*) from public.kyc_cases k where k.created_at >= now() - interval '30 days'),
    -- L'enum kyc_status vaut pending|in_progress|review|validated|rejected. Il n'y a PAS
    -- de 'verified' : l'écrire lèverait 22P02. Mesuré avant d'écrire, pas après.
    (select count(*) from public.kyc_cases k
      where k.created_at >= now() - interval '30 days' and k.status = 'validated'),
    (select count(*) from public.kyc_cases k
      where k.created_at >= now() - interval '30 days'
        and k.status not in ('validated', 'rejected')),
    (select count(*) from public.kyc_magic_links l where l.created_at >= now() - interval '30 days'),
    (select count(*) from public.kyc_magic_links l
      where l.created_at >= now() - interval '30 days' and l.opened_at is not null),
    (select count(*) from public.kyc_magic_links l
      where l.created_at >= now() - interval '30 days' and l.status = 'submitted'),
    (select count(*) from public.kyc_magic_links l
      where l.created_at >= now() - interval '30 days' and l.status = 'expired'),
    -- ⚠ Le cast est OBLIGATOIRE, pas cosmétique. `extract(epoch …)` rend un `numeric`, mais
    -- `percentile_cont` n'accepte que `double precision` (ou un intervalle) : PostgreSQL
    -- convertit l'entrée et rend donc un `double precision`, là où cette colonne est
    -- déclarée `numeric`. Sans le cast, la fonction lève `42804 — structure of query does
    -- not match function result type` à CHAQUE appel.
    --
    -- Rien ne l'avait vu : aucune spec n'appelait cette fonction avant l'étape 10. Une
    -- migration qui s'applique prouve seulement que le corps est syntaxiquement valide —
    -- plpgsql ne vérifie les TYPES qu'à l'exécution.
    (select round((percentile_cont(0.5) within group (
              order by extract(epoch from (now() - k.created_at)) / 3600))::numeric, 1)
       from public.kyc_cases k
      where k.created_at >= now() - interval '30 days'
        and k.status not in ('validated', 'rejected'));
end;
$function$;

comment on function public.get_admin_kyc_funnel_30d() is
  'Tunnel KYC des 30 derniers jours, EN COMPTES SEULS. Aucune colonne nominative : ni '
  'contact, ni agence, ni identifiant de dossier — §5.5 et le principe 1 interdisent qu''un '
  'dossier de client final remonte à la plateforme. Une VUE n''aurait pas pu porter cette '
  'garde : PostgreSQL n''applique pas de RLS aux vues, et security_invoker aurait rendu à '
  'chaque agent les agrégats de sa propre agence. D''où une fonction, malgré le nom '
  '`v_kyc_funnel_30d` de §4.3.';

revoke all on function public.get_admin_kyc_funnel_30d() from public, anon;
grant execute on function public.get_admin_kyc_funnel_30d() to authenticated, service_role;
