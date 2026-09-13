-- 20260914080000_region_fonctions_appels_base.sql
--
-- La base appelle les Edge Functions dans SA région : chaque URL de fonction que pg_cron
-- ou une fonction SQL remet à pg_net porte `?forceFunctionRegion=eu-west-1`.
--
-- POURQUOI. Sans épingle, une fonction s'exécute dans la région Supabase la plus proche de
-- l'appelant — et la plus proche de la base irlandaise n'est pas toujours l'Irlande.
-- Mesuré le 13.09.2026 sur 24 h (`x_sb_edge_region` des journaux) : 3 937 appels de la
-- base exécutés en eu-west-1, 8 ailleurs — Francfort ×4, Zurich ×4, dont une
-- synchronisation de la Messagerie (`mail-sync`). L'Europe toujours, mais pas la région que
-- déclare le registre (docs/compliance/01-registre-activites-traitement.md, point ouvert
-- n°5 f). Le navigateur et les appels d'une fonction à l'autre sont épinglés dans le code
-- (src/lib/supabase.ts, supabase/functions/_shared/function-url.ts) ; ceci fait de même
-- pour la base.
--
-- MÉTHODE. 27 sites relevés en prod le 13.09.2026, tous de la même forme — le littéral
-- `/functions/v1/<nom>'` : 16 commandes pg_cron et 11 fonctions SQL. Ils sont réécrits EN
-- PLACE depuis leur définition VIVANTE (`cron.job.command`, `pg_get_functiondef`), jamais
-- recopiés d'un fichier — cf. 20260806164512 : le corps en service ne vient pas toujours
-- de la migration qu'on croit. Chaque fonction réécrite est relue et comparée à sa version
-- d'avant, épingle retirée : un écart autre que l'épingle lève, et tout est annulé.
--
-- Rejouable (deploy.yml rejoue les migrations du jour) : un site épinglé ne matche plus le
-- motif. Sans pg_cron (base de CI), seules les fonctions sont traitées.
-- Garde : tests/backend/region-fonctions-base.spec.ts — aucun appel sans épingle dans une
-- base migrée.

do $$
declare
  motif constant text := '(/functions/v1/[a-z0-9-]+)''';
  epingle constant text := '?forceFunctionRegion=eu-west-1';
  f record;
  j record;
  restants int;
begin
  if to_regclass('cron.job') is not null then
    for j in execute 'select jobid, command from cron.job where command ~ $1' using motif loop
      perform cron.alter_job(j.jobid, command := regexp_replace(j.command, motif, '\1' || epingle || '''', 'g'));
    end loop;
  end if;

  for f in
    select p.oid, pg_get_functiondef(p.oid) as def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    -- CASE, pas AND : pg_get_functiondef lève sur un agrégat, et l'ordre d'évaluation
    -- d'un AND n'est pas garanti.
    where n.nspname = 'public'
      and case when p.prokind in ('f', 'p') then pg_get_functiondef(p.oid) ~ motif else false end
  loop
    execute regexp_replace(f.def, motif, '\1' || epingle || '''', 'g');
    if replace(pg_get_functiondef(f.oid), epingle, '') is distinct from replace(f.def, epingle, '') then
      raise exception 'région des fonctions : % a changé au-delà de l''épingle', f.oid::regprocedure;
    end if;
  end loop;

  select count(*) into restants
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and case when p.prokind in ('f', 'p') then pg_get_functiondef(p.oid) ~ motif else false end;
  if restants > 0 then
    raise exception 'région des fonctions : % fonction(s) appellent encore sans épingle', restants;
  end if;
end $$;
