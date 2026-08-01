-- Étape 21 du plan Console MEGGA — le changelog « What's new » (§5.10).
-- Contrat : docs/handoff/console-admin/front/admin-communications.jsx.
--
-- §5.10 dit d'ÉTENDRE `admin_changelog`, pas de la refaire. Mesuré avant d'écrire :
-- la table existe (8 colonnes, 0 ligne), elle a ses deux policies, et AUCUNE RPC.
-- Ce fichier ajoute donc l'état `scheduled`, son cron, et les quatre gestes.
--
-- ── CE QUI N'EST PAS CONSTRUIT ICI ───────────────────────────────────────────────────
-- `platform_announcements` reste DORMANTE (Q10, §5.10) : sa RLS de ciblage et son trigger
-- d'audit existent, mais la console actée n'a pas d'UI d'annonces. Ne rien y construire,
-- ne pas la supprimer non plus.
--
-- ── DEUX DÉFAUTS DE L'EXISTANT, CORRIGÉS AU PASSAGE ──────────────────────────────────
--
-- 1. LES POLICIES TESTENT `profiles.role = 'super_admin'` EN DUR, pas `is_super_admin()`.
--    Le mur réel du dépôt, c'est « rôle ET e-mail allowlisté » (CLAUDE.md §8) : la forme en
--    dur rate la moitié allowlist. La brèche est étroite — `profiles.role` n'est pas
--    écrivable par le client (tg_profiles_guard_role_agency, et admin_set_user_role est la
--    seule porte) — mais c'est une divergence avec la règle que toute la console applique,
--    et elle n'a aucune raison de subsister sur la table qu'on est en train d'ouvrir.
--
-- 2. `published boolean DEFAULT TRUE`. Sur un journal de nouveautés, c'est le pire défaut
--    possible : une ligne insérée sans y penser est PUBLIÉE, donc visible de tous les
--    agents. Le nouveau statut arrive en `draft` par défaut, et une contrainte interdit
--    désormais aux deux colonnes de diverger.

-- ── 1. L'état de publication ─────────────────────────────────────────────────────────

alter table public.admin_changelog
  add column if not exists status        text        not null default 'draft',
  add column if not exists scheduled_for timestamptz,
  add column if not exists published_at  timestamptz;

-- Reprise des lignes existantes AVANT de poser les contraintes : `published` était la
-- seule vérité, il faut que `status` la reflète, sinon la contrainte d'accord échoue.
update public.admin_changelog
   set status = case when published then 'published' else 'draft' end,
       published_at = coalesce(published_at, case when published then created_at end)
 where status = 'draft' and published;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.admin_changelog'::regclass
                    and conname = 'admin_changelog_status_chk') then
    alter table public.admin_changelog
      add constraint admin_changelog_status_chk
      check (status in ('draft', 'scheduled', 'published'));
  end if;

  -- L'ACCORD entre les deux colonnes est une CONTRAINTE, pas une convention. `published`
  -- reste la vérité de la RLS et de la page Aujourd'hui ; `status` porte le workflow. Les
  -- laisser diverger, c'est publier sans publier — et la seule façon de garantir qu'ils ne
  -- divergent pas est d'interdire à la base de l'accepter.
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.admin_changelog'::regclass
                    and conname = 'admin_changelog_accord_chk') then
    alter table public.admin_changelog
      add constraint admin_changelog_accord_chk
      check ((status = 'published') = published);
  end if;

  -- Une entrée programmée sans date n'est pas programmée : elle est perdue.
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.admin_changelog'::regclass
                    and conname = 'admin_changelog_scheduled_chk') then
    alter table public.admin_changelog
      add constraint admin_changelog_scheduled_chk
      check (status <> 'scheduled' or scheduled_for is not null);
  end if;
end $$;

alter table public.admin_changelog alter column published set default false;

comment on column public.admin_changelog.status is
  'draft | scheduled | published (§5.10). `published` reste la vérité de la RLS et de la '
  'page Aujourd''hui ; ce statut porte le workflow. Une CONTRAINTE interdit aux deux de '
  'diverger — publier sans publier ne doit pas être représentable.';
comment on column public.admin_changelog.scheduled_for is
  'Date de publication automatique, posée par admin_changelog_schedule() et consommée par '
  'le cron `changelog-publish`. Obligatoire dès que status = scheduled.';

create index if not exists admin_changelog_a_publier_idx
  on public.admin_changelog (scheduled_for)
  where status = 'scheduled';

-- ── 2. Les policies, alignées sur le mur réel ────────────────────────────────────────

drop policy if exists admin_changelog_select on public.admin_changelog;
create policy admin_changelog_select on public.admin_changelog
  for select
  -- Les agents lisent les entrées PUBLIÉES (§5.10, page Aujourd'hui) ; le super-admin voit
  -- aussi les brouillons et les programmées, sinon il ne pourrait pas les relire.
  using (published = true or public.is_super_admin());

drop policy if exists admin_changelog_write on public.admin_changelog;
-- Aucune policy d'écriture : les quatre gestes ci-dessous sont SECURITY DEFINER. Une
-- policy d'écriture en plus, c'était une seconde porte à garder synchronisée avec elles.
revoke insert, update, delete, truncate on table public.admin_changelog from anon, authenticated;

-- ── 3. Les quatre gestes (§5.10) ─────────────────────────────────────────────────────
--
-- ⚠ POURQUOI UNE SEULE CLÉ D'IDEMPOTENCE, ET NON QUATRE. §10.2 l'impose « sur toute RPC
-- mutante ». `save` en prend une : sans elle, un double-clic sur « Créer » produit DEUX
-- entrées, et rien ne les distingue. Les trois transitions n'en ont pas besoin — elles
-- vérifient l'état de départ, donc republier une entrée déjà publiée ne fait rien. L'état
-- EST la clé, et il est plus juste qu'un jeton fourni par l'appelant : deux super-admins
-- qui publient la même entrée convergent au lieu de se doubler.

create or replace function public.admin_changelog_save(
  p_id              uuid,
  p_title           text,
  p_content         text,
  p_version         text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_id     uuid;
  v_statut text;
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;
  if coalesce(btrim(p_title), '') = '' then
    return public.admin_error('precondition_failed', 'Le titre est obligatoire.');
  end if;
  if coalesce(btrim(p_idempotency_key), '') = '' then
    return public.admin_error('precondition_failed', 'Clé d''idempotence manquante.');
  end if;

  if p_id is not null then
    -- Mise à jour : l'entité existe, on la verrouille avant de lire son état (§10.2).
    perform public.admin_lock_entity('changelog', p_id);
    select status into v_statut from public.admin_changelog where id = p_id;
    if v_statut is null then
      return public.admin_error('not_found', 'Cette nouveauté est introuvable.');
    end if;
    if v_statut = 'published' then
      -- Réécrire une nouveauté déjà lue par les agents, c'est réécrire l'histoire. La
      -- dépublier d'abord est un geste explicite, et il laisse une trace.
      return public.admin_error('precondition_failed',
        'Cette nouveauté est publiée : dépubliez-la avant de la modifier.');
    end if;
    update public.admin_changelog
       set title = p_title, content = coalesce(p_content, ''), version = p_version,
           updated_at = now()
     where id = p_id;
    v_id := p_id;
  else
    -- Création : c'est ICI que la clé d'idempotence compte, un double-clic produirait
    -- deux entrées que rien ne distinguerait ensuite.
    if not public.admin_receipt_try(p_idempotency_key, 'admin_changelog_save') then
      return public.admin_ok(jsonb_build_object('already_done', true));
    end if;
    insert into public.admin_changelog (title, content, version, status, published, author_id)
         values (p_title, coalesce(p_content, ''), p_version, 'draft', false, auth.uid())
      returning id into v_id;
    perform public.admin_receipt_seal(p_idempotency_key, jsonb_build_object('id', v_id));
  end if;

  perform public.admin_log_write(
    p_family => 'comm', p_action => 'changelog_saved', p_severity => 'info',
    p_entity_type => 'changelog', p_entity_id => v_id, p_entity_label => p_title,
    p_metadata => jsonb_build_array(
      jsonb_build_object('l', 'Mode', 'v', case when p_id is null then 'création' else 'modification' end)));

  return public.admin_ok(jsonb_build_object('id', v_id));
end;
$function$;

comment on function public.admin_changelog_save(uuid, text, text, text, text) is
  'Crée ou modifie une nouveauté (§5.10). Arrive toujours en `draft` : une entrée insérée '
  'sans y penser ne doit pas être visible de tous les agents — c''était le défaut du '
  'DEFAULT TRUE de `published`. Refuse de modifier une entrée PUBLIÉE : réécrire ce que les '
  'agents ont déjà lu, c''est réécrire l''histoire ; la dépublier d''abord est un geste '
  'explicite, et il laisse une trace.';

create or replace function public.admin_changelog_publish(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_statut text;
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;
  perform public.admin_lock_entity('changelog', p_id);
  select status into v_statut from public.admin_changelog where id = p_id;
  if v_statut is null then
    return public.admin_error('not_found', 'Cette nouveauté est introuvable.');
  end if;
  -- L'état EST la clé d'idempotence : republier ne refait rien, et n'est pas une erreur.
  if v_statut = 'published' then
    return public.admin_ok(jsonb_build_object('already_done', true));
  end if;

  update public.admin_changelog
     set status = 'published', published = true, published_at = now(),
         scheduled_for = null, updated_at = now()
   where id = p_id;

  perform public.admin_log_write(
    p_family => 'comm', p_action => 'changelog_published', p_severity => 'warn',
    p_entity_type => 'changelog', p_entity_id => p_id,
    p_entity_label => (select title from public.admin_changelog where id = p_id));

  return public.admin_ok(jsonb_build_object('published_at', now()));
end;
$function$;

comment on function public.admin_changelog_publish(uuid) is
  'Publie une nouveauté (§5.10), journalisée `comm` en `warn` : une publication est visible '
  'de TOUS les agents, ce n''est pas un geste anodin. Idempotent par l''ÉTAT plutôt que par '
  'un jeton — deux super-admins qui publient la même entrée convergent.';

create or replace function public.admin_changelog_schedule(p_id uuid, p_when timestamptz)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_statut text;
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;
  if p_when is null then
    return public.admin_error('precondition_failed', 'Indiquez la date de publication.');
  end if;
  if p_when <= now() then
    -- Programmer dans le passé, c'est publier — mais sans le dire. Le geste existe.
    return public.admin_error('precondition_failed',
      'Cette date est passée : publiez directement.');
  end if;

  perform public.admin_lock_entity('changelog', p_id);
  select status into v_statut from public.admin_changelog where id = p_id;
  if v_statut is null then
    return public.admin_error('not_found', 'Cette nouveauté est introuvable.');
  end if;
  if v_statut = 'published' then
    return public.admin_error('precondition_failed',
      'Cette nouveauté est déjà publiée.');
  end if;

  update public.admin_changelog
     set status = 'scheduled', published = false, scheduled_for = p_when, updated_at = now()
   where id = p_id;

  perform public.admin_log_write(
    p_family => 'comm', p_action => 'changelog_scheduled', p_severity => 'info',
    p_entity_type => 'changelog', p_entity_id => p_id,
    p_entity_label => (select title from public.admin_changelog where id = p_id),
    p_metadata => jsonb_build_array(
      jsonb_build_object('l', 'Publication', 'v', to_char(p_when at time zone 'Europe/Zurich', 'DD.MM.YYYY HH24:MI'))));

  return public.admin_ok(jsonb_build_object('scheduled_for', p_when));
end;
$function$;

comment on function public.admin_changelog_schedule(uuid, timestamptz) is
  'Programme une publication (§5.10). Refuse une date passée : programmer dans le passé, '
  'c''est publier sans le dire, et le geste de publication existe déjà. L''heure journalisée '
  'est celle de Zurich, comme le reste du registre.';

create or replace function public.admin_changelog_unpublish(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_statut text;
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;
  perform public.admin_lock_entity('changelog', p_id);
  select status into v_statut from public.admin_changelog where id = p_id;
  if v_statut is null then
    return public.admin_error('not_found', 'Cette nouveauté est introuvable.');
  end if;
  if v_statut <> 'published' then
    return public.admin_ok(jsonb_build_object('already_done', true));
  end if;

  update public.admin_changelog
     set status = 'draft', published = false, scheduled_for = null, updated_at = now()
   where id = p_id;

  -- `crit` : retirer une nouveauté que des agents ont pu lire est un geste qu'on doit
  -- pouvoir retrouver sans le chercher.
  perform public.admin_log_write(
    p_family => 'comm', p_action => 'changelog_unpublished', p_severity => 'crit',
    p_entity_type => 'changelog', p_entity_id => p_id,
    p_entity_label => (select title from public.admin_changelog where id = p_id));

  return public.admin_ok(jsonb_build_object('unpublished', true));
end;
$function$;

comment on function public.admin_changelog_unpublish(uuid) is
  'Dépublie une nouveauté (§5.10). Journalisée en `crit` : retirer ce que des agents ont pu '
  'lire est un geste qu''on doit retrouver sans le chercher. `published_at` est CONSERVÉE — '
  'elle dit que ça a été publié un jour, ce qu''une republication ne doit pas effacer.';

-- ⚠ AMENDEMENT : §5.10 liste QUATRE gestes (save/publish/schedule/unpublish) et pas de
-- suppression. Mais `useChangelog.ts` en expose une, branchée sur un DELETE direct que ce
-- fichier vient de fermer. Retirer une capacité qui marche n'était pas le sujet de l'étape :
-- la RPC ci-dessous remplace le DELETE nu par un geste gardé et journalisé, ce qui est
-- strictement mieux que le laisser passer par un GRANT.
create or replace function public.admin_changelog_delete(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_statut text; v_titre text;
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;
  perform public.admin_lock_entity('changelog', p_id);
  select status, title into v_statut, v_titre from public.admin_changelog where id = p_id;
  if v_statut is null then
    -- Déjà supprimée : ce n'est pas une erreur, c'est le double-clic qu'on absorbe.
    return public.admin_ok(jsonb_build_object('already_done', true));
  end if;
  if v_statut = 'published' then
    -- Même règle que la modification : ce que les agents ont pu lire ne s'efface pas d'un
    -- clic. Dépublier est un geste explicite, et il laisse une trace.
    return public.admin_error('precondition_failed',
      'Cette nouveauté est publiée : dépubliez-la avant de la supprimer.');
  end if;

  -- Le journal AVANT la suppression : après, le titre n'existe plus, et une ligne de
  -- registre qui ne dit pas ce qui a été supprimé ne sert à rien.
  perform public.admin_log_write(
    p_family => 'comm', p_action => 'changelog_deleted', p_severity => 'crit',
    p_entity_type => 'changelog', p_entity_id => p_id, p_entity_label => v_titre);

  delete from public.admin_changelog where id = p_id;
  return public.admin_ok(jsonb_build_object('deleted', true));
end;
$function$;

comment on function public.admin_changelog_delete(uuid) is
  'Supprime une nouveauté NON publiée. Hors de la liste de §5.10, mais useChangelog.ts '
  'exposait déjà une suppression par DELETE direct : ce geste la remplace, gardé et '
  'journalisé. Le journal est écrit AVANT la suppression — après, le titre n''existe plus, '
  'et une ligne de registre muette ne sert à rien.';

revoke all on function public.admin_changelog_delete(uuid) from public, anon;
grant execute on function public.admin_changelog_delete(uuid) to authenticated, service_role;

revoke all on function public.admin_changelog_save(uuid, text, text, text, text) from public, anon;
revoke all on function public.admin_changelog_publish(uuid) from public, anon;
revoke all on function public.admin_changelog_schedule(uuid, timestamptz) from public, anon;
revoke all on function public.admin_changelog_unpublish(uuid) from public, anon;
grant execute on function public.admin_changelog_save(uuid, text, text, text, text) to authenticated, service_role;
grant execute on function public.admin_changelog_publish(uuid) to authenticated, service_role;
grant execute on function public.admin_changelog_schedule(uuid, timestamptz) to authenticated, service_role;
grant execute on function public.admin_changelog_unpublish(uuid) to authenticated, service_role;

-- ── 4. Le cron de publication (§5.10) ────────────────────────────────────────────────

create or replace function public.changelog_publish_due()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_n integer;
begin
  -- Garde élargie à `session_user` : cette fonction tourne sous pg_cron, sans JWT.
  if not (public.is_super_admin() or public.is_service_role()
          or session_user in ('postgres', 'supabase_admin')) then
    raise exception 'forbidden: super_admin or service only' using errcode = '42501';
  end if;

  with dues as (
    update public.admin_changelog
       set status = 'published', published = true, published_at = now(),
           scheduled_for = null, updated_at = now()
     where status = 'scheduled' and scheduled_for <= now()
    returning id, title
  )
  select count(*)::integer into v_n from dues;

  return v_n;
end;
$function$;

comment on function public.changelog_publish_due() is
  'Publie les nouveautés dont l''heure est venue (§5.10). Volontairement SANS écriture dans '
  'admin_log : le registre trace les GESTES d''un acteur, et une publication programmée a '
  'déjà laissé sa trace au moment de la programmation — la répéter à l''échéance ferait '
  'apparaître un geste que personne n''a fait.';

revoke all on function public.changelog_publish_due() from public, anon, authenticated;
grant execute on function public.changelog_publish_due() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'changelog-publish', '*/10 * * * *',
      $sql$select public.changelog_publish_due();$sql$
    );
  end if;
end $$;
