-- Revue du Lot 3 — la garde pg_cron portait sur le mauvais objet.
--
-- LE DÉFAUT. `20260802010000` teste la présence du SCHÉMA (`pg_namespace.nspname = 'cron'`)
-- à trois endroits. La migration SŒUR du même lot, écrite la veille, documente ce prédicat
-- comme insuffisant et garde sur l'EXTENSION :
--
--     -- 20260801250000_activation_and_cron_runs.sql:168-171
--     -- « En base fraîche (CI) le schéma `cron` existe parfois SANS la table
--     --   job_run_details : la garde porte donc sur l'extension, pas sur le schéma »
--
-- Les deux ne peuvent pas être vrais en même temps, et c'est le plus permissif qui est
-- resté dans le geste. Si l'état décrit par la migration sœur se produit, la garde est
-- franchie puis `cron.job` lève 42P01 : `supabase start` échoue, donc TOUTE la suite
-- backend et l'E2E meurent avant le premier test. C'est exactement le mode de panne que le
-- commentaire du fichier d'origine revendique écarter — et le test « refuse proprement
-- quand pg_cron manque » verrait le 42P01 nu qu'il interdit.
--
-- Le prédicat de l'extension est le plus fort des deux : si `pg_cron` est installée, son
-- schéma ET ses tables existent. L'inverse n'est pas garanti. On s'aligne donc sur la
-- migration sœur, et on cesse de recopier le prédicat : le dépôt en portait deux
-- incompatibles (39 fichiers sur le schéma, 8 sur l'extension), ce qui est précisément ce
-- qui a permis à la divergence de passer inaperçue.
--
-- ⚠ Les corps sont recopiés à l'identique par ailleurs. Seule la garde change, et l'ordre
-- des contrôles est préservé au caractère près : tous les refus métier précèdent la
-- réservation de la clé d'idempotence, propriété que la porte statique du socle vérifie en
-- coupant le corps à la première occurrence du nom de la primitive de réservation.

-- ── Le prédicat, une seule fois ────────────────────────────────────────────────
create or replace function public.pg_cron_installe()
returns boolean
language sql
stable
set search_path to 'public', 'pg_temp'
as $$
  select exists (select 1 from pg_extension where extname = 'pg_cron');
$$;

comment on function public.pg_cron_installe() is
  'Vrai si l''extension pg_cron est installée. Garde à préférer à la présence du schéma `cron` : celui-ci peut exister sans ses tables sur une base fraîche (constat de 20260801250000), auquel cas la garde passe et l''accès lève 42P01.';

revoke all on function public.pg_cron_installe() from public, anon;
grant execute on function public.pg_cron_installe() to authenticated, service_role;

-- ── Le geste, garde corrigée ───────────────────────────────────────────────────
create or replace function public.admin_cron_run_now(
  p_jobname         text,
  p_idempotency_key text,
  p_confirm         boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_command  text;
  v_active   boolean;
  v_inert    boolean;
  v_quand    timestamptz;
  v_quand_s  text;
  v_adhoc    text;
  v_cron     text;
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;
  if coalesce(btrim(p_jobname), '') = '' then
    return public.admin_error('precondition_failed', 'Nom du cron manquant.');
  end if;
  if coalesce(btrim(p_idempotency_key), '') = '' then
    return public.admin_error('precondition_failed', 'Clé d''idempotence manquante.');
  end if;

  if not public.pg_cron_installe() then
    return public.admin_error('precondition_failed',
      'pg_cron n''est pas installé sur cette base : la relance n''est possible qu''en production.');
  end if;

  -- Verrou d'entité AVANT toute lecture d'état (§10.2, amendé : verrou d'entité puis
  -- verrou de chaîne — l'ordre inverse provoquait un interblocage 40P01).
  perform public.admin_lock_entity('cron_job', md5(p_jobname)::uuid);

  -- ⚠ TOUS LES CONTRÔLES PRÉCÈDENT LA RÉSERVATION DE LA CLÉ. Un `return admin_error`
  -- COMMITTE la transaction : si la clé était prise avant, un refus métier la
  -- consommerait, et le réessai — même corrigé — rendrait un faux « already_done » sans
  -- rien faire. Défaut réel du Lot 1 (#1049), surveillé par une porte STATIQUE qui coupe
  -- le corps à la première occurrence du nom de la primitive de réservation ; ce
  -- commentaire évite donc de l'écrire, sinon il ferait rougir une implémentation correcte.
  select j.command, j.active into v_command, v_active
    from cron.job j where j.jobname = p_jobname;

  if v_command is null then
    return public.admin_error('not_found', 'Ce cron n''existe pas.');
  end if;
  if not v_active then
    return public.admin_error('precondition_failed',
      'Ce cron est désactivé : le réactiver est un geste distinct.');
  end if;

  v_inert := public.admin_cron_job_is_inert(p_jobname);
  if not v_inert and not coalesce(p_confirm, false) then
    return public.admin_error('precondition_failed',
      'Ce cron peut envoyer des messages à des clients ou des agents : confirmez la relance.',
      jsonb_build_object('needs_confirm', true, 'jobname', p_jobname));
  end if;

  if not public.admin_receipt_try(p_idempotency_key, 'admin_cron_run_now') then
    return public.admin_ok(jsonb_build_object('already_done', true));
  end if;

  v_quand := date_trunc('minute', now()) + interval '2 minutes';
  v_quand_s := to_char(v_quand at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  v_adhoc   := 'adhoc-' || extract(epoch from v_quand)::bigint || '-' || p_jobname;
  v_cron := to_char(v_quand at time zone 'UTC', 'FMMI FMHH24 FMDD FMMM') || ' *';

  perform cron.schedule(v_adhoc, v_cron, v_command);
  perform public.admin_receipt_seal(p_idempotency_key,
    jsonb_build_object('scheduled_for', v_quand_s, 'adhoc', v_adhoc));

  perform public.admin_log_write(
    p_family => 'ops', p_action => 'cron_run_now', p_severity => 'warn',
    p_entity_type => 'cron_job', p_entity_label => p_jobname,
    p_metadata => jsonb_build_array(
      jsonb_build_object('l', 'Prochain passage',
                         'v', to_char(v_quand at time zone 'UTC', 'HH24:MI') || ' UTC'),
      jsonb_build_object('l', 'Envoi possible', 'v', case when v_inert then 'non' else 'OUI' end)),
    p_action_params => jsonb_build_object('jobname', p_jobname, 'adhoc', v_adhoc));

  return public.admin_ok(jsonb_build_object(
    'requested', true, 'scheduled_for', v_quand_s, 'jobname', p_jobname));
end;
$$;

revoke all on function public.admin_cron_run_now(text, text, boolean) from public, anon;
grant execute on function public.admin_cron_run_now(text, text, boolean) to authenticated, service_role;

-- ── Le balayeur, garde corrigée ────────────────────────────────────────────────
create or replace function public.admin_cron_adhoc_sweep()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_job    record;
  v_epoch  bigint;
  v_cible  text;
  v_statut text;
  v_fin    timestamptz;
  v_n      integer := 0;
begin
  if not public.pg_cron_installe() then
    return 0;   -- pg_cron absent (local/CI) : rien à balayer, et surtout rien à lever.
  end if;

  for v_job in select jobid, jobname from cron.job where jobname ~ '^adhoc-\d+-' loop
    v_epoch := split_part(v_job.jobname, '-', 2)::bigint;
    if to_timestamp(v_epoch) >= now() - interval '15 minutes' then
      continue;  -- pas encore consommé : le worker peut être occupé
    end if;

    v_cible := substring(v_job.jobname from '^adhoc-\d+-(.*)$');
    select d.status, d.end_time into v_statut, v_fin
      from cron.job_run_details d
     where d.jobid = v_job.jobid
     order by d.start_time desc limit 1;

    perform public.admin_log_write(
      p_family => 'ops', p_action => 'cron_run_now_result',
      p_severity => case when coalesce(v_statut, 'inconnu') = 'succeeded' then 'info' else 'warn' end,
      p_entity_type => 'cron_job', p_entity_label => coalesce(nullif(v_cible, ''), v_job.jobname),
      p_routine => true,
      p_metadata => jsonb_build_array(
        jsonb_build_object('l', 'Issue', 'v', coalesce(v_statut, 'aucune exécution')),
        jsonb_build_object('l', 'Terminé',
                           'v', coalesce(to_char(v_fin at time zone 'UTC', 'HH24:MI') || ' UTC', '—'))));

    perform cron.unschedule(v_job.jobname);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

revoke all on function public.admin_cron_adhoc_sweep() from public, anon, authenticated;
