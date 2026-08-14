-- Réconciliation nocturne du CACHE de `contacts` avec le REGISTRE.
--
-- POURQUOI IL DÉRIVE, malgré une RPC unique en écriture. `record_whatsapp_consent` tient
-- les quatre colonnes à jour, mais deux chemins légitimes l'évitent :
--   · `suppress_contact_phone` bloque un numéro INCONNU du CRM — sans contact_id, il n'y a
--     rien à mettre à jour. Le jour où une fiche naît sur ce numéro, elle naît « joignable » ;
--   · la LEVÉE d'un blocage (`lifted_at`, geste super-admin) ne passe par aucune RPC.
-- Dans les deux cas la fiche AFFICHE le contraire de ce que la garde DÉCIDE, et c'est la
-- fiche que l'agent croit.
--
-- ⛔ Ce travail ne change JAMAIS une décision d'envoi : la garde lit le registre, pas le
-- cache. Il ne corrige que ce qui est montré.
begin;

create or replace function public.reconcile_wa_consent_cache()
returns integer
language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_n integer;
begin
  with reg as (
    -- La MÊME vérité que record_whatsapp_consent : la dernière déclaration décide de
    -- `wa_opt_in`, et chaque horodatage est le plus récent de SON sens — un opt-out ne
    -- s'efface pas, il se date.
    select c.contact_id,
           max(c.created_at) filter (where c.event = 'opt_in')  as opt_in_at,
           max(c.created_at) filter (where c.event = 'opt_out') as opt_out_at,
           (array_agg(c.event order by c.created_at desc, c.id desc))[1] = 'opt_in' as dernier_opt_in
      from public.whatsapp_consents c
     where c.contact_id is not null
     group by c.contact_id
  ),
  sup as (
    select s.contact_id
      from public.contact_suppressions s
     where s.contact_id is not null and s.lifted_at is null
       and s.channel in ('whatsapp','all')
     group by s.contact_id
  ),
  cible as (
    select ct.id,
           coalesce(r.dernier_opt_in, false)      as wa_opt_in,
           r.opt_in_at                            as wa_consent_at,
           r.opt_out_at                           as wa_opt_out_at,
           (s.contact_id is not null)             as wa_suppressed
      from public.contacts ct
      left join reg r on r.contact_id = ct.id
      left join sup s on s.contact_id = ct.id
     -- Les deux sens : les fiches que le registre concerne, ET celles dont le cache
     -- affirme quelque chose que le registre ne soutient plus (blocage levé, fiche
     -- recréée). Sans la seconde moitié, une levée resterait affichée comme un blocage.
     where r.contact_id is not null
        or s.contact_id is not null
        or ct.wa_opt_in
        or ct.wa_suppressed
        or ct.wa_consent_at is not null
        or ct.wa_opt_out_at is not null
  )
  update public.contacts ct
     set wa_opt_in      = t.wa_opt_in,
         wa_consent_at  = t.wa_consent_at,
         wa_opt_out_at  = t.wa_opt_out_at,
         wa_suppressed  = t.wa_suppressed
    from cible t
   where ct.id = t.id
     -- Le filtre de divergence n'est pas une optimisation : il fait que le NOMBRE DE
     -- LIGNES rendu EST la dérive. Sans lui, la fonction rendrait le même chiffre à
     -- chaque nuit, et une dérive réelle serait indiscernable du bruit.
     and (ct.wa_opt_in     is distinct from t.wa_opt_in
       or ct.wa_consent_at is distinct from t.wa_consent_at
       or ct.wa_opt_out_at is distinct from t.wa_opt_out_at
       or ct.wa_suppressed is distinct from t.wa_suppressed);

  get diagnostics v_n = row_count;

  -- Une réconciliation SILENCIEUSE cacherait ce qu'elle corrige. Zéro dérive n'écrit rien
  -- (le journal est append-only et conservé dix ans) ; une dérive se dit.
  if v_n > 0 then
    insert into public.activity_events
      (agency_id, actor_id, actor_kind, action, entity_type, category, severity, metadata)
    values (null, null, 'system', 'whatsapp_consent_cache_reconciled', 'contact',
            'messaging', 'warn', jsonb_build_object('rows', v_n));
  end if;

  return v_n;
end $$;

comment on function public.reconcile_wa_consent_cache() is
  'Recale contacts.wa_* sur whatsapp_consents + contact_suppressions. Rend le nombre de '
  'fiches qui DIVERGEAIENT — 0 en régime nominal. N''influence aucune décision d''envoi : '
  'la garde lit le registre, jamais le cache.';

revoke all on function public.reconcile_wa_consent_cache() from public, anon, authenticated;
grant execute on function public.reconcile_wa_consent_cache() to service_role;

-- 03:20 UTC : après la purge du `raw` (03:30 la précède d'un cran dans la nuit) et loin des
-- fenêtres de sync RealAdvisor. ⚠ Identifier le job par son JOBNAME, jamais par son jobid.
do $do$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule('whatsapp-consent-cache-reconcile')
      where exists (select 1 from cron.job where jobname = 'whatsapp-consent-cache-reconcile');
    perform cron.schedule(
      'whatsapp-consent-cache-reconcile', '20 3 * * *',
      $cron$ select public.reconcile_wa_consent_cache(); $cron$
    );
  else
    raise notice 'pg_cron absent (local/CI) — réconciliation non planifiée';
  end if;
end
$do$;

commit;
