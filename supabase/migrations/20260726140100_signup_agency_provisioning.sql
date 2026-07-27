-- Chemin d'inscription : le fondateur dirige son agence.
--
-- La vitrine envoie role:'agent' dans raw_user_meta_data, handle_new_user() fige cette
-- valeur, et provision_solo_agency() ne touchait pas au rôle. Or is_agency_admin()
-- (20260726130200) exige admin ou manager : le dirigeant échouait donc à la garde qui
-- protège ses propres données de conformité, et le parcours KYB était bloqué avant
-- d'exister. create_agency_and_join fait l'inverse depuis la baseline : l'appelant
-- devient admin de l'agence qu'il crée. On aligne.
--
-- Idempotente : CREATE OR REPLACE.

-- ── Nom de l'agence : utiliser enfin ce que l'utilisateur a saisi ────────────
-- La vitrine range le nom d'agence dans raw_user_meta_data.agency_name depuis
-- toujours, et personne ne le lisait : l'agence portait le nom de la personne.
--
-- Repli en cascade obligatoire : uq_agencies_name_normalized est UNIQUE sur
-- lower(btrim(name)), donc deux « Régie Dupont » entrent en collision. Sans repli,
-- l'insert échoue, l'exception est avalée plus haut, et le second inscrit reste avec
-- agency_id NULL — c'est-à-dire un CRM entièrement muet, toutes les policies RLS
-- s'accrochant à agency_id. On préfère un nom approximatif à un compte inutilisable ;
-- le nom définitif est de toute façon saisi au wizard (agencies.legal_name).

create or replace function public.provision_solo_agency(p_user uuid, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_base  text := coalesce(nullif(btrim(p_display_name), ''), 'Mon agence');
  v_name  text;
  v_slug  text;
  v_id    uuid;
begin
  -- 3 tentatives : le nom voulu, puis suffixé, puis suffixé autrement. Une collision
  -- de nom ne doit jamais coûter son agence à l'utilisateur.
  for i in 1..3 loop
    v_name := case when i = 1 then v_base
                   else v_base || ' ' || substring(gen_random_uuid()::text, 1, 4) end;

    if exists (select 1 from agencies where lower(btrim(name)) = lower(btrim(v_name))) then
      continue;
    end if;

    v_slug := lower(regexp_replace(btrim(v_name), '\s+', '-', 'g'));
    if exists (select 1 from agencies where slug = v_slug) then
      v_slug := v_slug || '-' || substring(gen_random_uuid()::text, 1, 6);
    end if;

    begin
      insert into agencies (name, slug, solo, plan, status, created_by)
      values (v_name, v_slug, true, 'starter', 'active', p_user)
      returning id into v_id;
    exception when unique_violation then
      -- Course entre le SELECT et l'INSERT : on retente.
      v_id := null;
      continue;
    end;

    update profiles
       set agency_id = v_id,
           role = 'admin'
     where id = p_user and agency_id is null;

    return v_id;
  end loop;

  -- Les trois tentatives ont échoué : aucun nom n'a pu être attribué. C'est rare
  -- (collision en cascade), mais il faut le tracer pour retrouver l'utilisateur.
  raise warning 'provision_solo_agency: exhausted attempts for user % (base name: %)', p_user, v_base;

  return null;
end;
$$;

revoke all on function public.provision_solo_agency(uuid, text) from public, anon, authenticated;

comment on function public.provision_solo_agency(uuid, text) is
  'Interne : crée l''agence solo d''un inscrit et l''en fait l''admin. Appelée par handle_new_user uniquement. Aucun EXECUTE client.';

-- ── Agent invité : on provisionne quand même, accept-team-invite nettoiera ──
-- Version précédente : on sautait le provisioning quand une invitation valide
-- attendait cet e-mail, pour ne pas fabriquer une agence solo aussitôt orpheline.
-- Mais si l'invitation n'est JAMAIS réclamée, elle expire à 7 jours, ce trigger ne
-- repasse pas, et le compte restait à agency_id NULL pour toujours : CRM muet, sans
-- issue, puisque le wizard de rattrapage a été supprimé et que join_agency est
-- fermée (20260726140200). Décision produit : on provisionne SYSTÉMATIQUEMENT pour
-- les rôles agence, invitation en attente ou pas ; c'est accept-team-invite qui
-- supprime l'agence solo — devenue inutile — au moment où l'invité réclame pour de
-- bon, jamais avant, jamais si l'agence porte la moindre donnée (voir
-- supabase/functions/accept-team-invite/index.ts).
--
-- Nom d'agence : repli en cascade (uq_agencies_name_normalized = UNIQUE sur
-- lower(btrim(name))) quand le nom saisi n'existe pas. L'ordre : agency_name
-- (saisi à l'inscription), full_name, ou préfixe e-mail. Tout nom est approximatif —
-- le fondateur finalise au wizard agencies.legal_name (ou l'agence solo disparaît
-- avant, réclamée par l'invité).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_full_name   text := coalesce(new.raw_user_meta_data ->> 'full_name',
                                 new.raw_user_meta_data ->> 'name', '');
  v_agency_name text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'agency_name', '')), '');
  v_role        text := case
    when (new.raw_user_meta_data ->> 'role') in
         ('agent', 'manager', 'admin', 'assistant', 'seller', 'buyer', 'particulier')
      then new.raw_user_meta_data ->> 'role'
    else 'buyer'
  end;
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    coalesce(new.email, ''),
    v_full_name,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture', ''),
    v_role
  );

  if v_role in ('agent', 'manager', 'admin', 'assistant') then
    begin
      perform public.provision_solo_agency(
        new.id,
        coalesce(v_agency_name,
                 nullif(btrim(v_full_name), ''),
                 split_part(coalesce(new.email, ''), '@', 1))
      );
    exception when others then
      raise warning 'provision_solo_agency failed for %: %', new.id, sqlerrm;
    end;
  end if;

  return new;
end;
$$;

-- ── Backfill : fondateurs déjà provisionnés par l'ancienne version ───────────
--
-- provision_solo_agency() existe depuis le 20260718130000 (remove_onboarding_
-- provision_solo_agency) dans une version qui ne posait QUE agency_id, jamais
-- role. Tout compte fondateur inscrit entre cette date et ce déploiement a donc
-- déjà agency_id : le garde `where agency_id is null` de l'UPDATE ci-dessus ne
-- le concerne plus, son role reste 'agent'/'assistant' et il échoue toujours à
-- is_agency_admin(). On répare, réservé aux VRAIS fondateurs — agencies.created_by
-- = profiles.id — jamais à un agent simplement invité dans l'agence d'un autre :
-- ce serait une élévation de privilège silencieuse sur des données de
-- conformité. manager/admin/super_admin existants ne sont jamais retouchés (le
-- filtre ne cible que role in ('agent','assistant')).
--
-- Bloc DO anonyme, PAS de fonction persistante : cette réparation corrige un état
-- HÉRITÉ, borné dans le temps — ce n'est pas une règle permanente. Une fonction qui
-- reste dans le schéma serait rejouable indéfiniment (y compris par erreur, ou par
-- un futur appelant qui ignore ce contexte) et re-promouvrait admin un fondateur
-- qui aurait depuis légitimement repassé la main et redemandé le rôle agent —
-- rétrogradation silencieusement annulée à chaque rejeu. Un DO block ne laisse
-- aucun objet appelable après lui : la réparation ne peut plus jamais se redéclencher
-- après ce déploiement. Le prédicat reste purement déclaratif (pas de flag « déjà
-- fait »), donc idempotent par construction si ce fichier est rejoué le même jour :
-- un fondateur déjà promu sort du filtre role.
--
-- DROP défensif : si une exécution antérieure de CETTE migration, plus tôt le même
-- jour de déploiement, a déjà créé l'ancienne fonction persistante, le rejeu du
-- fichier doit la faire disparaître aussi — sinon elle survivrait, appelable, malgré
-- le fix. Aucun effet sur une base qui ne l'a jamais eue.
drop function if exists public.backfill_founder_admin_roles();

do $$
declare
  v_count integer;
begin
  update profiles p
     set role = 'admin'
    from agencies a
   where a.id = p.agency_id
     and a.created_by = p.id
     and p.role in ('agent', 'assistant');

  get diagnostics v_count = row_count;
  if v_count > 0 then
    raise notice 'backfill fondateurs admin : % profil(s) corrigé(s)', v_count;
  end if;
end $$;
