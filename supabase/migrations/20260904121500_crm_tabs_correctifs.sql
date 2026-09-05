-- Trois correctifs sur la barre d'onglets, trouvés en revue adversariale le 04.09.2026.
--
-- ⚠ FICHIER NEUF plutôt qu'édition des trois migrations du matin : `deploy.yml` ne rejoue
-- que les migrations dont l'horodatage vaut >= TODAY. Corriger un fichier daté du jour
-- marcherait aujourd'hui et jamais plus — un correctif qui ne se rejoue pas est un
-- correctif qui n'existe pas pour toute base créée demain.
begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Le garde de révision était un « check-then-act » NON ATOMIQUE.
--
-- Le SELECT ne posait aucun verrou et l'UPDATE ne réaffirmait pas la révision : deux
-- appels concurrents lisaient tous deux `revision = 5`, passaient tous deux le test,
-- écrivaient tous deux, et la révision finissait à 6 au lieu de 7. Une des deux piles
-- était perdue EN SILENCE — c'est-à-dire précisément le défaut que le jeton existe pour
-- empêcher, et il ne se manifestait que sous la concurrence qu'il devait couvrir.
--
-- ⚠ Le remède est le `for update` : la seconde transaction ATTEND la première, puis relit
-- une révision déjà incrémentée et ressort en `stale`. La ceinture (`and revision = …`
-- dans l'UPDATE) est gardée en plus : elle ne coûte rien et rend la fonction correcte même
-- si quelqu'un retirait le verrou un jour.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.crm_tabs_save(
  p_tabs jsonb,
  p_active integer,
  p_revision bigint default null
)
returns jsonb
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_cur  public.crm_open_tabs%rowtype;
  v_n    integer;
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_tabs is null or jsonb_typeof(p_tabs) <> 'array' then
    raise exception 'crm_tabs_save: p_tabs doit etre un tableau jsonb'
      using errcode = '22023';
  end if;

  -- ⚠ `for update` : verrouille la ligne AVANT le test de révision.
  select * into v_cur from public.crm_open_tabs where user_id = v_uid for update;

  if not found then
    -- ⚠ Deux premières écritures concurrentes visent la même clé primaire : la perdante
    -- lève 23505. Sans ce rattrapage, la barre d'un agent qui ouvre deux fenêtres en même
    -- temps échouerait à sa toute première sauvegarde. On relit et on repart en `stale`.
    begin
      insert into public.crm_open_tabs (user_id, tabs, active_index, revision, updated_at)
      values (v_uid, p_tabs, greatest(coalesce(p_active, 0), 0), 1, now())
      returning * into v_cur;
      return jsonb_build_object(
        'tabs', v_cur.tabs, 'active_index', v_cur.active_index,
        'revision', v_cur.revision, 'stale', false);
    exception when unique_violation then
      select * into v_cur from public.crm_open_tabs where user_id = v_uid;
      return jsonb_build_object(
        'tabs', v_cur.tabs, 'active_index', v_cur.active_index,
        'revision', v_cur.revision, 'stale', true);
    end;
  end if;

  if p_revision is not null and p_revision <> v_cur.revision then
    return jsonb_build_object(
      'tabs', v_cur.tabs, 'active_index', v_cur.active_index,
      'revision', v_cur.revision, 'stale', true);
  end if;

  update public.crm_open_tabs
     set tabs = p_tabs,
         active_index = greatest(coalesce(p_active, 0), 0),
         revision = v_cur.revision + 1,
         updated_at = now()
   where user_id = v_uid
     -- Ceinture : la révision est réaffirmée dans le WHERE, pas seulement testée plus haut.
     and revision = v_cur.revision
  returning * into v_cur;

  get diagnostics v_n = row_count;
  if v_n = 0 then
    select * into v_cur from public.crm_open_tabs where user_id = v_uid;
    return jsonb_build_object(
      'tabs', v_cur.tabs, 'active_index', v_cur.active_index,
      'revision', v_cur.revision, 'stale', true);
  end if;

  return jsonb_build_object(
    'tabs', v_cur.tabs, 'active_index', v_cur.active_index,
    'revision', v_cur.revision, 'stale', false);
end;
$$;

revoke all on function public.crm_tabs_save(jsonb, integer, bigint) from public, anon;
grant execute on function public.crm_tabs_save(jsonb, integer, bigint) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Le CHECK valait 24, EXACTEMENT le plafond du client — donc il mordait.
--
-- Le commentaire d'origine affirmait que « le CHECK serveur est plus haut que ce que la
-- barre laisse ouvrir » : c'était faux, les deux valaient 24. Or `crmApplyCap` refuse de
-- trahir une épingle, et `crmDuplicateTab` n'applique aucun plafond : dupliquer une puce
-- sur une pile pleine produit 25 entrées, la contrainte rejette l'écriture entière, et le
-- client — qui avale ses erreurs d'écriture, à dessein — cesse de persister SANS RIEN DIRE.
--
-- 32 pour que le plafond CLIENT reste le seul qui morde, la contrainte n'étant plus qu'un
-- garde-fou contre un client fautif. C'est le rôle qu'elle était censée tenir.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.crm_open_tabs drop constraint if exists crm_open_tabs_taille;
alter table public.crm_open_tabs add constraint crm_open_tabs_taille
  check (jsonb_array_length(tabs) <= 32);

comment on constraint crm_open_tabs_taille on public.crm_open_tabs is
  'Garde-fou, PAS la regle : le plafond qui mord est celui du client (CRM_TABS_CAP = 24). '
  'Strictement plus haut, pour qu''un depassement transitoire (duplication sur pile pleine, '
  'pile entierement epinglee) n''annule pas l''ecriture en silence.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. « Aujourd'hui » était calculé en UTC, pas en heure suisse.
--
-- `current_setting('TimeZone')` vaut UTC en production, et aucun rôle ne pose de fuseau.
-- Une visite à 00 h 30 à Genève est donc datée de la VEILLE en UTC (22 h 30), et une visite
-- à 01 h 30 le 1er juillet compte pour le 30 juin : deux heures par nuit où le badge du
-- calendrier annonce le mauvais jour. Le dépôt convertit déjà explicitement ailleurs
-- (`contact_nba_v1.sql`), c'est cette forme qui est reprise.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.crm_tab_badges()
returns jsonb
language plpgsql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $$
declare
  v_agency uuid := public.get_user_agency_id();
  v_jour   date := (now() at time zone 'Europe/Zurich')::date;
  v_kyc    int := 0;
  v_kyc_u  int := 0;
  v_rappel int := 0;
  v_late   int := 0;
  v_visite int := 0;
  v_match  int := 0;
  v_deal   int := 0;
begin
  if v_agency is null then
    return '{}'::jsonb;
  end if;

  select count(*) filter (where dossier_status is distinct from 'verified'),
         count(*) filter (where risk_level = 'high'
                            and expires_at is not null
                            and expires_at <= now() + interval '7 days')
    into v_kyc, v_kyc_u
    from public.kyc_cases
   where agency_id = v_agency;

  -- ⚠ Le RETARD (`v_late`) reste comparé à `now()` — un instant, pas un jour : un rappel
  -- est en retard à la minute où son échéance passe, dans n'importe quel fuseau. Seule la
  -- borne de JOURNÉE CIVILE demande la conversion.
  select count(*) filter (where (trigger_at at time zone 'Europe/Zurich')::date <= v_jour),
         count(*) filter (where trigger_at <= now())
    into v_rappel, v_late
    from public.reminders
   where agency_id = v_agency
     and status in ('pending', 'triggered')
     and trigger_at is not null;

  select count(*)
    into v_visite
    from public.visits
   where agency_id = v_agency
     and scheduled_at is not null
     and (scheduled_at at time zone 'Europe/Zurich')::date = v_jour
     and coalesce(status, '') not in ('cancelled', 'done', 'no_show');

  select count(*)
    into v_match
    from public.matches
   where agency_id = v_agency
     and status = 'suggested'
     and score >= 80;

  select count(distinct t.id)
    into v_deal
    from public.transactions t
    join public.reminders r on r.transaction_id = t.id
   where t.agency_id = v_agency
     and t.archived_at is null
     and t.status <> 'completed'
     and r.status in ('pending', 'triggered')
     and r.trigger_at is not null
     and r.trigger_at <= now();

  return jsonb_strip_nulls(jsonb_build_object(
    'kyc',      case when v_kyc    > 0 then jsonb_build_object('n', v_kyc,    'urgent', v_kyc_u > 0) end,
    'calendar', case when (v_rappel + v_visite) > 0
                     then jsonb_build_object('n', v_rappel + v_visite, 'urgent', v_late > 0) end,
    'matching', case when v_match  > 0 then jsonb_build_object('n', v_match,  'urgent', false) end,
    'pipeline', case when v_deal   > 0 then jsonb_build_object('n', v_deal,   'urgent', true) end
  ));
end;
$$;

revoke all on function public.crm_tab_badges() from public, anon;
grant execute on function public.crm_tab_badges() to authenticated;

commit;
