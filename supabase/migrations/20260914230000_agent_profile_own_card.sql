-- La fiche de l'agent (agent_profiles) : l'agent la crée lui-même.
--
-- CONSTAT (14.09.2026, production, lecture seule). `agent_profiles` compte 0 ligne. La table
-- ne porte plus que la fiche de l'agent connecté (bio, langues, spécialités, site, LinkedIn —
-- Réglages ▸ Profil) : l'annuaire public est fermé depuis 20260719100000, et ses 2 062 fiches
-- moissonnées sont parties avec 20260720180000. Or rien ne crée de fiche : l'INSERT est
-- réservé au super-admin (`admin_insert_agent_profiles`), et aucun écran, aucune fonction ni
-- aucun trigger ne le fait. Conséquences :
--   · les 5 champs de la fiche ne s'enregistrent pas (erreur sur ordinateur, bio perdue sans
--     message sur mobile) ;
--   · le score de profil (9 champs, dont la bio) plafonne à 89 % ;
--   · le jalon Intercom `profile_completed`, qui attend 100 %, ne part jamais.
--
-- CE QUE FAIT CETTE MIGRATION.
--   1. Une fiche par agent : UNIQUE (profile_id). Les lignes sans compte (profile_id NULL)
--      restent permises par la contrainte, et la purge du 20.07 n'en a laissé aucune.
--   2. La fiche part avec le compte : la FK `profile_id` passe de NO ACTION à ON DELETE
--      CASCADE. En NO ACTION, une fiche aurait BLOQUÉ l'étape 11 de delete-account
--      (deleteUser → cascade sur profiles) : le compte serait devenu indestructible. Le piège
--      existait déjà — le message d'erreur des Réglages demandait à un administrateur de créer
--      la fiche à la main.
--   3. `ensure_my_agent_profile()` : l'agent connecté crée SA fiche, et seulement la sienne
--      (auth.uid(), aucun argument). SECURITY DEFINER parce que la policy d'INSERT reste
--      réservée au super-admin : la seule écriture ouverte à l'agent est celle-ci, et elle ne
--      pose que des valeurs fixées ici. Idempotente : rend la fiche existante si elle existe.
--
-- Valeurs posées à la création : prénom et nom tirés de `profiles.full_name` (le client les
-- réécrit à l'enregistrement qui suit) ; `slug` dérivé de l'uid, donc unique ; statut
-- 'claimed' + claimed_at (la fiche appartient à un compte dès sa naissance) ; `claim_token`
-- NULL — c'est un secret de revendication de l'ancien annuaire, sans objet pour une fiche que
-- son propriétaire crée lui-même (20260719100000 le dit dormant et pré-divulgué).
--
-- Rejouable : deploy.yml ré-applique toute migration datée du jour.

begin;

-- 1. Une fiche par agent.
alter table public.agent_profiles
  drop constraint if exists agent_profiles_profile_id_key;
alter table public.agent_profiles
  add constraint agent_profiles_profile_id_key unique (profile_id);

-- 2. La fiche part avec le compte.
alter table public.agent_profiles
  drop constraint if exists agent_profiles_profile_id_fkey;
alter table public.agent_profiles
  add constraint agent_profiles_profile_id_fkey
  foreign key (profile_id) references public.profiles(id) on delete cascade;

-- 3. L'agent crée sa fiche.
create or replace function public.ensure_my_agent_profile()
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_nom text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select id into v_id from public.agent_profiles where profile_id = v_uid;
  if v_id is not null then
    return v_id;
  end if;

  select btrim(coalesce(full_name, '')) into v_nom
  from public.profiles
  where id = v_uid and deleted_at is null;
  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  insert into public.agent_profiles (profile_id, first_name, last_name, slug, status, claimed_at, claim_token)
  values (
    v_uid,
    split_part(v_nom, ' ', 1),
    btrim(substr(v_nom, length(split_part(v_nom, ' ', 1)) + 1)),
    'agent-' || replace(v_uid::text, '-', ''),
    'claimed',
    now(),
    null
  )
  -- Deux enregistrements simultanés : le second ne crée rien et relit la fiche du premier.
  on conflict (profile_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.agent_profiles where profile_id = v_uid;
  end if;
  return v_id;
end;
$$;

comment on function public.ensure_my_agent_profile() is
  'Crée (ou rend) la fiche agent_profiles de l''agent connecté — Réglages ▸ Profil : bio, langues, spécialités, liens. Seule écriture de création ouverte à un agent ; l''INSERT direct reste réservé au super-admin.';

revoke all on function public.ensure_my_agent_profile() from public;
revoke all on function public.ensure_my_agent_profile() from anon;
grant execute on function public.ensure_my_agent_profile() to authenticated;

commit;
