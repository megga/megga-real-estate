-- Accepter une invitation d'équipe ne détruit plus l'agence que l'on quitte (audit du
-- 13.09.2026, point S9).
--
-- ⛔ CE QUE FAISAIT `accept-team-invite`. L'inscription d'un agent provisionne toujours une
-- agence SOLO (handle_new_user → provision_solo_agency), invité compris. À la réclamation,
-- l'edge SUPPRIMAIT cette agence sur trois conditions : `solo`, créée par l'invité, plus aucun
-- membre. Elle ne regardait jamais ce que l'agence CONTENAIT. Or 49 des 67 clés étrangères
-- vers `agencies` sont en ON DELETE CASCADE (mesuré en production le 13.09.2026, toutes à une
-- seule colonne : 49 CASCADE, 7 NO ACTION, 11 SET NULL). Rejoué en transaction annulée sur les
-- quatre agences solo réelles qui ont un créateur : trois partaient en entier — dont deux
-- avec leur dossier KYB (dirigeant vérifié, raison sociale, n° IDE), qu'aucune règle de
-- rétention ne protège. Deals sans contact, rappels, modèles, boîtes mail, abonnement :
-- partis aussi. Les biens, contacts et dossiers KYC ne tenaient que par ACCIDENT — un
-- trigger d'audit qui réécrit dans `activity_events` une ligne pointant l'agence en cours de
-- suppression (23503), et le NO ACTION de `contacts`. Personne ne l'avait voulu.
--
-- Et le vecteur hostile n'exige aucun plan payant : tout inscrit est admin de son agence
-- solo, `team_invitations_insert` n'a pas de prédicat de plan, donc n'importe qui peut
-- fabriquer un vrai lien d'invitation pour l'e-mail d'une cible.
--
-- LA RÈGLE, tenue ICI et nulle part ailleurs : une agence n'est libérée que VIERGE —
--   · solo, et créée par la personne qui part ;
--   · la ligne elle-même telle que provision_solo_agency l'a posée : plan `starter`, statut
--     `active`, et toute autre colonne NULL ou à sa valeur par défaut (comparaison en jsonb :
--     une colonne ajoutée demain, non nulle, garde l'agence au lieu de passer inaperçue) ;
--   · ZÉRO ligne dans CHAQUE table qui la référence, quelle que soit l'action de la clé
--     (CASCADE, NO ACTION ou SET NULL). La liste est lue dans `pg_constraint` AU MOMENT DE
--     L'APPEL, jamais recopiée ici : une table créée demain ne peut pas rouvrir la faille en
--     silence. Deux exceptions nommées : `agency_activation` (dérivée, recalculée par le
--     cron) et `activity_events` en SET NULL (le journal survit à l'agence, et le trigger
--     d'immuabilité autorise ce détachement). `profiles` est lue à part, pour que la
--     simulation ignore la personne qui s'apprête à partir ;
--   · ZÉRO ligne dans les trois tables SANS clé étrangère qui disent qu'une agence a eu des
--     prospects (`whatsapp_consents`, `contact_suppressions`, `whatsapp_optin_invites`).
--     `admin_log` et `agency_id_document_purges` n'y sont PAS : elles existent pour survivre
--     à l'agence, les lire la garderait pour toujours.
-- Sinon l'agence est GARDÉE telle quelle, avec un événement `solo_agency_retained` qui nomme
-- ce qui la retient. La garder n'est pas un état nouveau : c'est ce qui arrivait déjà chaque
-- fois que la suppression échouait. Une ligne morte de trop vaut mieux qu'un dossier perdu.
--
-- `p_dry_run` rend le verdict SANS rien toucher : l'edge le lit AVANT de déplacer le profil,
-- pour qu'une personne ne quitte une agence qui porte des données que sur confirmation
-- explicite (409 `prior_agency_holds_data` sinon).
--
-- ⚠ LE PROPRIÉTAIRE DOIT FRANCHIR LA RLS, et la fonction le vérifie au lieu de le supposer :
-- sans BYPASSRLS, un EXISTS sur une table protégée (`agent_time_off` est en FORCE RLS)
-- rendrait faux en silence, et la fonction supprimerait une agence pleine. `postgres` a
-- BYPASSRLS en production (mesuré le 13.09.2026). Si le propriétaire change un jour, la
-- fonction lève au lieu de décider : fermée par défaut.
--
-- ⚠ SERVICE SEUL, deux fois : les droits (seul `service_role` exécute) ET la garde du corps
-- (`is_service_role()`, patron des fonctions de service du dépôt). Et `DELETE` sur
-- `agencies` est retiré à `anon` et `authenticated` : aucune policy ne l'ouvre, mais le GRANT
-- était le seul verrou restant sous la RLS. `service_role` le garde (nettoyage des specs).
--
-- ⚠ HORODATAGE : `deploy.yml` n'applique que les migrations dont le préfixe vaut `>=` le jour
-- UTC du MERGE. Mergée plus tard que le 13.09.2026, celle-ci serait sautée SANS BRUIT, et
-- l'edge garderait alors TOUTE agence quittée (RPC absente ⇒ rien n'est supprimé) : sûr, mais
-- la décision produit du 27.07.2026 — pas d'agence solo morte — s'éteindrait. La renommer au
-- jour du merge, puis vérifier en production :
--   select to_regprocedure('public.release_empty_solo_agency(uuid,uuid,boolean)') is not null;
--
-- Rejouable : CREATE OR REPLACE, REVOKE/GRANT idempotents, bloc DO d'assertion.

create or replace function public.release_empty_solo_agency(
  p_agency_id    uuid,
  p_former_owner uuid,
  p_dry_run      boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
-- Chemin VIDE : chaque objet est qualifié, et `pg_temp` ne peut rien intercepter.
set search_path to ''
as $$
declare
  -- NULL passé explicitement vaut simulation : sur une entrée ambiguë, on ne supprime rien.
  v_dry      boolean := p_dry_run is distinct from false;
  v_agency   public.agencies%rowtype;
  v_fk       record;
  v_col      name;
  v_hit      boolean;
  v_label    text;
  v_blocking text[] := '{}';
begin
  if not public.is_service_role() then
    raise exception 'release_empty_solo_agency : réservée au rôle de service'
      using errcode = '42501';
  end if;

  -- Sans BYPASSRLS, les EXISTS ci-dessous mentiraient par omission (voir l'en-tête).
  if not exists (
    select 1 from pg_catalog.pg_roles r
     where r.rolname = current_user and (r.rolbypassrls or r.rolsuper)
  ) then
    raise exception 'release_empty_solo_agency : le propriétaire % ne franchit pas la RLS, aucune décision possible', current_user
      using errcode = '42501';
  end if;

  -- FOR UPDATE hors simulation : il entre en conflit avec le FOR KEY SHARE que prend toute
  -- insertion concurrente d'une ligne fille — la course « je vérifie, puis je supprime » est
  -- fermée. Fonction VOLATILE : chaque appel lit un instantané frais.
  if v_dry then
    select * into v_agency from public.agencies where id = p_agency_id;
  else
    select * into v_agency from public.agencies where id = p_agency_id for update;
  end if;
  if not found then
    return pg_catalog.jsonb_build_object(
      'released', false, 'releasable', false, 'reason', 'not_found',
      'blocking', '[]'::jsonb, 'dry_run', v_dry);
  end if;

  -- Seulement l'agence solo que CETTE personne a créée. `p_former_owner` NULL ne désigne
  -- personne — sans ce test, une agence solo sans créateur passerait l'égalité.
  if p_former_owner is null
     or v_agency.solo is distinct from true
     or v_agency.created_by is distinct from p_former_owner then
    return pg_catalog.jsonb_build_object(
      'released', false, 'releasable', false, 'reason', 'not_owned_solo',
      'blocking', '[]'::jsonb, 'dry_run', v_dry);
  end if;

  -- La ligne elle-même : telle que provision_solo_agency la pose. Toute autre valeur (client
  -- Stripe, raison sociale, IDE, logo, identité soumise…) est une donnée.
  if v_agency.plan is distinct from 'starter' or v_agency.status is distinct from 'active' then
    v_blocking := pg_catalog.array_append(v_blocking, 'agencies.plan_status');
  end if;
  if pg_catalog.jsonb_strip_nulls(
       pg_catalog.to_jsonb(v_agency)
         - array['id', 'name', 'slug', 'solo', 'plan', 'status', 'created_by', 'created_at'])
     is distinct from
     '{"billing":"monthly","monthly_target":0,"quarterly_target":0,"yearly_target":0,"verification_status":"pending","verification_sweep_attempts":0}'::jsonb
  then
    v_blocking := pg_catalog.array_append(v_blocking, 'agencies.columns');
  end if;

  -- Toute table qui référence agencies, lue MAINTENANT.
  for v_fk in
    select c.conrelid, c.conkey, c.confdeltype, n.nspname, cl.relname
      from pg_catalog.pg_constraint c
      join pg_catalog.pg_class cl on cl.oid = c.conrelid
      join pg_catalog.pg_namespace n on n.oid = cl.relnamespace
     where c.contype = 'f'
       and c.confrelid = 'public.agencies'::regclass
     order by n.nspname, cl.relname, c.conname
  loop
    continue when v_fk.conrelid = pg_catalog.to_regclass('public.agency_activation');
    continue when v_fk.conrelid = pg_catalog.to_regclass('public.activity_events')
              and v_fk.confdeltype = 'n';
    continue when v_fk.conrelid = pg_catalog.to_regclass('public.profiles');

    v_label := case when v_fk.nspname = 'public' then v_fk.relname::text
                    else v_fk.nspname || '.' || v_fk.relname end;

    -- Une clé composite ne se sonde pas colonne par colonne : elle RETIENT, fermée par défaut.
    if pg_catalog.cardinality(v_fk.conkey) <> 1 then
      v_label := v_label || ':composite_fk';
    else
      select a.attname into v_col
        from pg_catalog.pg_attribute a
       where a.attrelid = v_fk.conrelid and a.attnum = v_fk.conkey[1];
      execute pg_catalog.format('select exists (select 1 from %I.%I where %I = $1)',
                                v_fk.nspname, v_fk.relname, v_col)
         into v_hit using p_agency_id;
      if not v_hit then
        continue;
      end if;
    end if;

    if not (v_label = any (v_blocking)) then
      v_blocking := pg_catalog.array_append(v_blocking, v_label);
    end if;
  end loop;

  -- Les membres. En simulation, la personne qui s'apprête à partir n'en est pas un ; en
  -- libération réelle, elle doit DÉJÀ être partie — sinon l'agence reste, au lieu d'un 23503.
  if exists (
    select 1 from public.profiles p
     where p.agency_id = p_agency_id
       and (not v_dry or p.id is distinct from p_former_owner)
  ) then
    v_blocking := pg_catalog.array_append(v_blocking, 'profiles');
  end if;

  -- Les prospects, dans les tables sans clé étrangère (voir l'en-tête).
  foreach v_label in array array['whatsapp_consents', 'contact_suppressions', 'whatsapp_optin_invites']
  loop
    if pg_catalog.to_regclass('public.' || v_label) is not null then
      execute pg_catalog.format('select exists (select 1 from public.%I where agency_id = $1)', v_label)
         into v_hit using p_agency_id;
      if v_hit then
        v_blocking := pg_catalog.array_append(v_blocking, v_label);
      end if;
    end if;
  end loop;

  if v_dry then
    return pg_catalog.jsonb_build_object(
      'released', false,
      'releasable', pg_catalog.cardinality(v_blocking) = 0,
      'reason', case when pg_catalog.cardinality(v_blocking) = 0 then null else 'holds_data' end,
      'blocking', pg_catalog.to_jsonb(v_blocking),
      'dry_run', true);
  end if;

  if pg_catalog.cardinality(v_blocking) > 0 then
    -- Rangé DANS l'agence gardée : c'est là que le support la cherchera.
    insert into public.activity_events
      (agency_id, actor_id, actor_kind, action, entity_type, entity_id, category, severity, metadata)
    values
      (p_agency_id, p_former_owner, 'user', 'solo_agency_retained', 'agency', p_agency_id,
       'settings', 'warn', pg_catalog.jsonb_build_object('blocking', pg_catalog.to_jsonb(v_blocking)));
    return pg_catalog.jsonb_build_object(
      'released', false, 'releasable', false, 'reason', 'holds_data',
      'blocking', pg_catalog.to_jsonb(v_blocking), 'dry_run', false);
  end if;

  delete from public.agencies where id = p_agency_id;

  -- agency_id NULL : l'agence n'existe plus. L'id reste dans entity_id.
  insert into public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id, category, severity, metadata)
  values
    (null, p_former_owner, 'user', 'solo_agency_released', 'agency', p_agency_id,
     'settings', 'info', pg_catalog.jsonb_build_object('agency_name', v_agency.name));
  return pg_catalog.jsonb_build_object(
    'released', true, 'releasable', true, 'reason', null,
    'blocking', '[]'::jsonb, 'dry_run', false);
end
$$;

comment on function public.release_empty_solo_agency(uuid, uuid, boolean) is
  'Libère (supprime) l''agence solo quittée par p_former_owner SEULEMENT si elle est vierge : '
  'ligne telle que provisionnée, zéro ligne dans toute table qui la référence (lue dans '
  'pg_constraint à l''appel) et dans les tables de prospects sans FK. Sinon la garde et journalise '
  'solo_agency_retained. p_dry_run : verdict sans effet. service_role seul (20260913160200, S9).';

alter function public.release_empty_solo_agency(uuid, uuid, boolean) owner to postgres;
revoke all on function public.release_empty_solo_agency(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.release_empty_solo_agency(uuid, uuid, boolean) to service_role;

-- Aucune policy n'ouvre la suppression d'une agence ; le GRANT était le dernier verrou sous
-- la RLS. Le seul chemin est désormais la fonction ci-dessus, en service_role.
revoke delete on table public.agencies from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- ASSERTION — la migration échoue plutôt que de laisser un état faux.
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare
  v_fn constant text := 'public.release_empty_solo_agency(uuid, uuid, boolean)';
begin
  if has_function_privilege('anon', v_fn, 'EXECUTE')
     or has_function_privilege('authenticated', v_fn, 'EXECUTE') then
    raise exception 'S9 : release_empty_solo_agency est exécutable hors du rôle de service';
  end if;
  if has_table_privilege('anon', 'public.agencies', 'DELETE')
     or has_table_privilege('authenticated', 'public.agencies', 'DELETE') then
    raise exception 'S9 : anon ou authenticated peut encore supprimer une agence';
  end if;

  -- Contrôles POSITIFS : la même mesure sait dire oui. Sans eux, un has_*_privilege qui
  -- rendrait toujours faux (rôle renommé, signature mal écrite) ferait passer ce bloc à vide.
  if not has_function_privilege('service_role', v_fn, 'EXECUTE') then
    raise exception 'S9 : service_role ne peut pas exécuter release_empty_solo_agency — l''edge garderait toute agence';
  end if;
  if not has_table_privilege('service_role', 'public.agencies', 'DELETE') then
    raise exception 'S9 : service_role a perdu DELETE sur agencies — le révoquer était hors périmètre';
  end if;
  if not has_table_privilege('authenticated', 'public.agencies', 'UPDATE') then
    raise exception 'S9 : authenticated a perdu UPDATE sur agencies — Réglages › Agence ne s''enregistrerait plus';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_proc p
     where p.oid = v_fn::regprocedure
       and p.prosecdef
       and exists (select 1 from pg_catalog.unnest(p.proconfig) c where c like 'search_path=%')
  ) then
    raise exception 'S9 : release_empty_solo_agency doit être SECURITY DEFINER à search_path figé';
  end if;
end
$$;
