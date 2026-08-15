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

-- ⛔ PAS de `set statement_timeout` sur cette fonction, et l'écrire serait un MENSONGE
-- CONFORTABLE. Postgres arme le minuteur UNE fois, au début de la commande cliente
-- (`enable_statement_timeout`) ; changer le GUC en cours d'exécution — clause SET d'une
-- fonction comprise — ne le ré-arme pas, et les requêtes SPI de plpgsql n'en arment aucun.
-- Une telle clause n'aurait donc borné rien du tout, tout en faisant chercher l'explication
-- au mauvais endroit le jour où le job traîne. Le budget réel reste celui du rôle appelant.
-- Ce qui borne VRAIMENT ici, c'est le `limit` ci-dessous — et il borne l'UPDATE, pas le
-- balayage : à très grande échelle, l'agrégation de `whatsapp_consents` reste le coût
-- dominant, et la fenêtrer demanderait un autre dessin (côté REGISTRE, jamais côté
-- `contacts` — les deux chemins de dérive documentés en tête ne touchent pas `contacts`).
create or replace function public.reconcile_wa_consent_cache()
returns integer
language plpgsql security definer set search_path to 'public','pg_temp' as $$
-- BORNE PAR NUIT. Le balayage portait sur `contacts` entier, sans plafond : à l'échelle,
-- l'unique symptôme aurait été un job en échec — et le cache aurait continué d'afficher le
-- faux. Le plafond porte sur les fiches QUI DIVERGENT, pas sur les candidates : une nuit ne
-- doit pas consommer sa borne en fiches déjà justes. Les corrigées quittent l'ensemble
-- divergent, donc les suivantes passent la nuit d'après — la file se vide, elle ne se fige pas.
declare
  c_max constant integer := 5000;
  v_n   integer;
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
     -- Le filtre de divergence, REMONTÉ ICI depuis l'UPDATE — c'est ce qui permet à `limit`
     -- de borner les fiches À CORRIGER. Il n'est pas une optimisation : il fait que le
     -- NOMBRE DE LIGNES rendu EST la dérive ; sans lui, la fonction rendrait le même chiffre
     -- chaque nuit et une dérive réelle serait indiscernable du bruit.
     --
     -- Il SUBSUME l'ancienne condition à deux sens (« fiches que le registre concerne, ET
     -- fiches dont le cache affirme ce que le registre ne soutient plus ») : une fiche sans
     -- registre ET au cache par défaut ne diverge pas, une fiche divergente a forcément
     -- l'un ou l'autre. Une levée de blocage reste donc bien rattrapée.
     where ct.wa_opt_in     is distinct from coalesce(r.dernier_opt_in, false)
        or ct.wa_consent_at is distinct from r.opt_in_at
        or ct.wa_opt_out_at is distinct from r.opt_out_at
        or ct.wa_suppressed is distinct from (s.contact_id is not null)
     -- Ordre TOTAL : sans lui, `limit` prélèverait un échantillon arbitraire et la même
     -- fiche pourrait être sautée nuit après nuit.
     order by ct.id
     limit c_max
  )
  update public.contacts ct
     set wa_opt_in      = t.wa_opt_in,
         wa_consent_at  = t.wa_consent_at,
         wa_opt_out_at  = t.wa_opt_out_at,
         wa_suppressed  = t.wa_suppressed
    from cible t
   where ct.id = t.id;

  get diagnostics v_n = row_count;

  -- Une réconciliation SILENCIEUSE cacherait ce qu'elle corrige. Zéro dérive n'écrit rien
  -- (le journal est append-only et conservé dix ans) ; une dérive se dit.
  --
  -- ⛔ `capped` est la moitié qui manquerait le plus : une nuit TRONQUÉE et une nuit à
  -- faible dérive rendent toutes deux un nombre, et sans ce drapeau elles seraient
  -- indiscernables — c'est-à-dire exactement le défaut qu'on ferme, déplacé d'un cran.
  -- Sur-signale volontairement au bord (dérive == plafond) : le sens sûr du doute.
  if v_n > 0 then
    insert into public.activity_events
      (agency_id, actor_id, actor_kind, action, entity_type, category, severity, metadata)
    values (null, null, 'system', 'whatsapp_consent_cache_reconciled', 'contact',
    -- ⛔ 'critical', PAS 'error' : le domaine d'`activity_events_severity_check` est
    -- {info, warn, critical} — c'est `auth_events` qui accepte 'error' (baseline:3383).
    -- Un 'error' ici lèverait 23514, et comme cette fonction n'a aucun bloc `exception`,
    -- l'échec annulerait la transaction ENTIÈRE : les 5000 fiches corrigées avec, plus
    -- l'événement lui-même. La nuit tronquée deviendrait une nuit INEXISTANTE, sans le
    -- moindre signal — pire que le silence qu'on ferme.
            'messaging', case when v_n >= c_max then 'critical' else 'warn' end,
            jsonb_build_object('rows', v_n, 'capped', v_n >= c_max, 'cap', c_max));
  end if;

  return v_n;
end $$;

comment on function public.reconcile_wa_consent_cache() is
  'Recale contacts.wa_* sur whatsapp_consents + contact_suppressions. Rend le nombre de '
  'fiches qui DIVERGEAIENT — 0 en régime nominal. Borné à 5000 fiches par exécution, avec '
  'un drapeau `capped` dans activity_events quand la borne est atteinte (severity error) : '
  'une nuit tronquée ne doit pas ressembler à une nuit calme. N''influence aucune décision '
  'd''envoi : la garde lit le registre, jamais le cache.';

revoke all on function public.reconcile_wa_consent_cache() from public, anon, authenticated;
grant execute on function public.reconcile_wa_consent_cache() to service_role;

-- 03:20 UTC, loin des fenêtres de sync RealAdvisor.
--
-- ⚠ La note précédente affirmait « après la purge du `raw` » : c'est FAUX dans les deux sens.
-- `whatsapp-purge-raw-daily` tourne à 03:30 (20260602110000), donc DIX MINUTES APRÈS —
-- l'ordre est sans conséquence ici (la réconciliation ne lit pas `raw`), mais une note fausse
-- se propage. Et `whatsapp-async-jobs-purge-daily` (20260603110200) est planifié à la MÊME
-- minute : deux travaux légers, concurrence acceptée, notée pour qui ajoutera le troisième.
-- ⚠ Identifier le job par son JOBNAME, jamais par son jobid.
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
