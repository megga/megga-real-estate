# Patch 05 — S13 : `join_agency` exige une invitation (ÉLEVÉ, multi-tenant)

**Type** : migration SQL. Nouveau fichier proposé `supabase/migrations/<ts>_join_agency_invite_gate.sql`.

## Problème
`join_agency(p_agency_id)` change `profiles.agency_id`/`role` avec pour seule garde `auth.uid() IS NOT NULL`
(aucun contrôle d'invitation). Le trigger `tg_profiles_guard_role_agency` est **contourné** (RPC `SECURITY DEFINER`
owner postgres → `current_user='postgres'`). Un flux d'invitation existe (`team_invitations` + `accept-team-invite`)
et doit être le **seul** chemin.

## Migration proposée
> ⚠️ Vérifier les libellés d'enum `team_invitation_status` (on suppose `'pending'`/`'accepted'`) avant apply.
```sql
create or replace function public.join_agency(p_agency_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select email into v_email from public.profiles where id = v_uid;

  -- ⬇️ NOUVEAU : n'autoriser que si une invitation valide existe pour cet email + cette agence
  if not exists (
    select 1
    from public.team_invitations ti
    where ti.agency_id = p_agency_id
      and lower(ti.email) = lower(v_email)
      and ti.status = 'pending'
      and (ti.expires_at is null or ti.expires_at > now())
  ) then
    raise exception 'no_valid_invitation' using errcode = '42501';
  end if;

  update public.profiles
     set agency_id = p_agency_id,
         role = case when role in ('agent','manager','admin','assistant') then role else 'agent' end
   where id = v_uid;

  -- Consommer l'invitation (idempotent)
  update public.team_invitations
     set status = 'accepted', claimed_at = now(), claimed_by = v_uid
   where agency_id = p_agency_id
     and lower(email) = lower(v_email)
     and status = 'pending';
end $$;

-- L'accès anonyme n'a aucun sens ici (auth.uid requis) : on nettoie les grants par défaut.
revoke execute on function public.join_agency(uuid) from anon, public;
grant  execute on function public.join_agency(uuid) to authenticated;
```

## Recommandation complémentaire
Le rôle attribué (`role` conservé si déjà élevé) devrait venir de **l'invitation** (`team_invitations.role`),
pas de l'état courant du profil, pour éviter qu'un utilisateur pré-positionné en `admin` rejoigne une agence en
`admin`. Idéalement, **déprécier `join_agency(agency_id)`** au profit du flux token `accept-team-invite`
(l'invitation est identifiée par son `token` uuid, non devinable) et ne garder qu'un seul chemin d'entrée.

## Test
- Utilisateur SANS invitation appelant `join_agency('<agence-cible>')` → exception `no_valid_invitation` (avant : rejoignait).
- Utilisateur AVEC invitation `pending` valide → rejoint + invitation passée à `accepted`.
- Étendre `tests/backend` (RLS/RPC) avec ces 2 cas + un cas invitation expirée.
