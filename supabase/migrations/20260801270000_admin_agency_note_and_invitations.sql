-- Note interne d'agence et lecture des invitations — débloque l'étape 9 (vues), donc 10.
-- Spec §5.3 (fiche agence : « note »), §5.4 (« invité, jamais connecté »), §4.3.
--
-- ⚠ POURQUOI PAS UNE COLONNE `agencies.admin_note`, ALORS QUE C'ÉTAIT LA DEMANDE.
-- Mesuré avant d'écrire : `agencies_members_select` (policy sur le rôle `authenticated`,
-- prédicat `id = get_user_agency_id()`) donne à CHAQUE MEMBRE la lecture de toute sa ligne
-- d'agence, avec un GRANT SELECT au niveau TABLE. Une colonne y serait donc lue par
-- l'agence elle-même — or c'est une note INTERNE de la plateforme sur son client.
-- Et un REVOKE au niveau colonne ne la protégerait pas : c'est précisément le défaut déjà
-- mesuré sur les colonnes `agencies.verification_*` (invariant 9 du relais KYB), où
-- `has_column_privilege('authenticated', …, 'UPDATE')` reste `true` malgré le REVOKE,
-- parce qu'un privilège colonne ne retire pas un privilège accordé au niveau table.
-- D'où une table dédiée, comme l'était `admin_notes` avant sa suppression du 28.07.
--
-- CE QUI N'EST PAS ICI : le GESTE d'écriture de la note. Le Lot 1 est en lecture seule
-- (« aucun bouton d'action » — critère de sortie G1), et §5.3 range la note parmi les
-- gestes de fiche agence. La RPC d'écriture, journalisée famille `lifecycle`, appartient
-- au Lot 2. La table est posée maintenant pour que la vue de l'étape 9 puisse la lire.

-- ── 1. Note interne d'agence ─────────────────────────────────────────────────────────

create table if not exists public.admin_agency_notes (
  agency_id  uuid primary key references public.agencies(id) on delete cascade,
  note       text not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

comment on table public.admin_agency_notes is
  'Note INTERNE de la plateforme sur une agence cliente (§5.3). Table dédiée et non colonne '
  'de `agencies` : cette table-là est lisible par ses propres membres '
  '(agencies_members_select), et un REVOKE de colonne ne protège rien tant qu''un GRANT de '
  'table existe — défaut déjà mesuré sur agencies.verification_*. Une note par agence : '
  '§5.3 en parle au singulier, et la fiche n''affiche qu''un champ.';
comment on column public.admin_agency_notes.updated_by is
  'Auteur du dernier enregistrement. Sans clé étrangère : la suppression d''un compte '
  'super-admin ne doit ni effacer la note ni bloquer la suppression.';

alter table public.admin_agency_notes enable row level security;
revoke all on table public.admin_agency_notes from public, anon, authenticated, service_role;
grant select on table public.admin_agency_notes to authenticated, service_role;

drop policy if exists admin_agency_notes_select_super_admin on public.admin_agency_notes;
create policy admin_agency_notes_select_super_admin on public.admin_agency_notes
  for select to authenticated using (public.is_super_admin());

-- Aucune policy d'écriture, aucun GRANT d'écriture : la RPC du Lot 2 sera SECURITY DEFINER.

-- ── 2. Lecture des invitations (§5.3, §5.4) ──────────────────────────────────────────
--
-- `team_invitations` n'a AUCUNE policy super-admin — ses trois policies filtrent toutes sur
-- `agency_id = get_user_agency_id()`, et un super-admin a `agency_id` NULL. Il ne voit donc
-- rien en lecture directe, ce que §5.3 et §5.4 supposent pourtant acquis. Une RPC gardée
-- plutôt qu'une quatrième policy : c'est le patron du reste de la console, et ça garde la
-- table fermée par défaut au lieu d'y ajouter une porte.

drop function if exists public.get_admin_agency_invitations(uuid, integer);
create or replace function public.get_admin_agency_invitations(
  p_agency_id uuid default null,
  p_limit     integer default 50
)
returns table (
  id           uuid,
  agency_id    uuid,
  agency_name  text,
  email        text,
  role         text,
  status       text,
  created_at   timestamptz,
  expires_at   timestamptz,
  is_expired   boolean,
  invited_by   uuid
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  return query
  select t.id, t.agency_id, a.name, t.email, t.role::text, t.status::text,
         t.created_at, t.expires_at,
         -- L'écran distingue « invité, en attente » d'« invitation périmée » : la seconde
         -- se relance, la première s'attend. Calculé ici, jamais côté client, pour que les
         -- deux surfaces qui lisent cette RPC (fiche agence et registre Utilisateurs) ne
         -- puissent pas diverger sur la même ligne.
         (t.expires_at is not null and t.expires_at < now()),
         t.invited_by
    from public.team_invitations t
    left join public.agencies a on a.id = t.agency_id
   -- Seules les invitations EN ATTENTE : une invitation acceptée n'est plus une invitation,
   -- c'est un membre, et il apparaît déjà dans l'équipe.
   where t.status = 'pending'
     and (p_agency_id is null or t.agency_id = p_agency_id)
   order by t.created_at desc
   limit v_limit;
end;
$function$;

comment on function public.get_admin_agency_invitations(uuid, integer) is
  'Invitations en attente, pour la fiche agence (§5.3, argument fourni) comme pour le '
  'registre Utilisateurs (§5.4, argument NULL — l''état « invité, jamais connecté »). '
  'RPC et non policy : team_invitations n''a aucune policy super-admin, et un super-admin a '
  'agency_id NULL — il ne voit rien en lecture directe. Ne rend JAMAIS le `token` : c''est '
  'un secret de porteur, et rien à l''écran n''en a besoin. La régénération est un geste du '
  'Lot 2, pas une lecture.';

revoke all on function public.get_admin_agency_invitations(uuid, integer) from public, anon;
grant execute on function public.get_admin_agency_invitations(uuid, integer) to authenticated, service_role;
