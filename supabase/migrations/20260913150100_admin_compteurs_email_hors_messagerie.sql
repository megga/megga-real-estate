-- Les compteurs « e-mails » de la console super-admin cessent de compter la Messagerie
-- (13.09.2026).
--
-- ⛔ emails_sent_today (get_admin_monitoring_health), emails.sent_24h / sent_7d
-- (get_admin_integrations_health, carte « Emails (Resend) ») et la métrique
-- email_count_today (edge admin-monitoring) lisaient l'action `email_sent`. AUCUN envoi Resend
-- ne l'a jamais écrite — seul un seed de démo front l'a fait (retiré le 20.06.2026) ; en prod,
-- 0 ligne, et 3 589 relevés email_count_today depuis le 16.04, tous à 0. Ses seuls écrivains
-- sont désormais la Messagerie (_shared/mail/ingest.ts : copies des Envoyés, fenêtre initiale
-- de 90 jours ; mail-send) : du courrier d'agent, pas du Resend, et hors télémétrie plateforme
-- (D14). La première boîte connectée aurait fait compter 90 jours d'Envoyés sous l'étiquette
-- « Resend ».
--
-- Filtrer `category <> 'messaging'` vaudrait false (un zéro menteur) ; aucune liste d'actions
-- ne compte Resend (la moitié des envois n'écrit rien au journal, les autres sous dix noms).
-- Source Resend retenue : email_delivery_events (resend-webhook), celle de la règle 13
-- d'admin-alerts — même source, fenêtre de 7 jours ici contre 24 h pour l'alerte. Le volume
-- ENVOYÉ n'a pas de source en base : NULL = non mesuré, jamais 0. ⚠ Une carte à 0/0 ne
-- distingue toujours pas « aucun échec » de « webhook non branché » (INVENTAIRE_SOCLE).
--
-- Signatures inchangées : CREATE OR REPLACE, sans DROP (rejouable, types inchangés).

create or replace function public.get_admin_monitoring_health()
returns table (
  errors_last_24h bigint,
  emails_sent_today bigint,
  api_requests_today bigint,
  last_scraping_at timestamptz,
  db_size_mb numeric,
  storage_used_mb numeric,
  db_limit_mb numeric,
  storage_limit_mb numeric
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_limits jsonb;
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  select nullif(value, '')::jsonb into v_limits
  from public.app_config where key = 'admin_platform_limits';

  return query
  select
    (select count(*) from public.activity_events
      where action = 'edge_function_error'
        and created_at >= now() - interval '24 hours'),
    -- Non mesuré : aucun envoi Resend n'a de trace commune au journal. NULL, jamais 0.
    null::bigint,
    (select count(*) from public.activity_events
      where created_at >= date_trunc('day', now())),
    (select max(created_at) from public.activity_events where action = 'scraping_completed'),
    coalesce((select metric_value from public.platform_metrics
      where metric_type = 'db_size_mb'
      order by recorded_at desc limit 1), 0),
    coalesce((select metric_value from public.platform_metrics
      where metric_type = 'storage_used_mb'
      order by recorded_at desc limit 1), 0),
    coalesce((v_limits->>'db_limit_mb')::numeric, 8000),
    coalesce((v_limits->>'storage_limit_mb')::numeric, 100000);
end;
$$;

comment on function public.get_admin_monitoring_health() is
  'Santé plateforme (AdminMonitoringPage). emails_sent_today = NULL (non mesuré) depuis 20260913 : l''action lue jusque-là n''est écrite que par la Messagerie (courrier d''agent, D14), jamais par Resend. Garde super_admin/service_role.';

revoke all on function public.get_admin_monitoring_health() from public, anon;
grant execute on function public.get_admin_monitoring_health() to authenticated, service_role;

create or replace function public.get_admin_integrations_health()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_result jsonb;
  v_last_webhook timestamptz;
  v_stale_before timestamptz := now() - interval '48 hours';
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  select max(created_at) into v_last_webhook
  from public.activity_events
  where action in ('subscription_activated','subscription_changed','subscription_cancelled','payment_failed');

  select jsonb_build_object(
    'emails', jsonb_build_object(
      -- resend-webhook n'enregistre QUE des incidents (rebond, échec, plainte, retard) : même
      -- source que la règle 13 d'admin-alerts, bornée par email_delivery_events_occurred_idx.
      -- ⚠ Pas « non remis » : une plainte a été REMISE (puis marquée indésirable), un retard
      -- peut encore arriver. Le nom dit ce que la ligne compte.
      'delivery_incidents_7d', (select count(*) from public.email_delivery_events
                          where occurred_at >= now() - interval '7 days'),
      'errors_7d', (select count(*) from public.activity_events
                     where action = 'edge_function_error'
                       and created_at >= now() - interval '7 days'
                       and coalesce(metadata->>'function_name', '') like 'send-%')
    ),
    'stripe_webhook', jsonb_build_object(
      'last_event_at', v_last_webhook,
      'age_hours', case when v_last_webhook is null then null
                        else round(extract(epoch from (now() - v_last_webhook)) / 3600.0, 1) end,
      'events_7d', (select count(*) from public.activity_events
                    where action in ('subscription_activated','subscription_changed','subscription_cancelled','payment_failed')
                      and created_at >= now() - interval '7 days'),
      'payment_failed_7d', (select count(*) from public.activity_events
                    where action = 'payment_failed' and created_at >= now() - interval '7 days'),
      'active_subscriptions', (select count(*) from public.subscriptions where status = 'active')
    ),
    'calendar', jsonb_build_object(
      'google', (
        select jsonb_build_object(
          'connected', count(*),
          'stale', count(*) filter (where sync_enabled and last_sync_at is not null and last_sync_at < v_stale_before),
          'expired', count(*) filter (where token_expires_at < now())
        ) from public.google_calendar_tokens
      ),
      'outlook', (
        select jsonb_build_object(
          'connected', count(*),
          'stale', count(*) filter (where sync_enabled and last_sync_at is not null and last_sync_at < v_stale_before),
          'expired', count(*) filter (where token_expires_at < now())
        ) from public.outlook_calendar_tokens
      ),
      'stale_total',
        (select count(*) from public.google_calendar_tokens where sync_enabled and last_sync_at is not null and last_sync_at < v_stale_before)
      + (select count(*) from public.outlook_calendar_tokens where sync_enabled and last_sync_at is not null and last_sync_at < v_stale_before)
    )
  ) into v_result;

  return v_result;
end;
$$;

comment on function public.get_admin_integrations_health() is
  'Santé des intégrations : e-mails Resend = échecs de remise (email_delivery_events, resend-webhook, 7 j) + erreurs des fonctions send-% ; le volume envoyé n''a pas de source (20260913). Webhooks Stripe (âge du dernier événement), calendriers OAuth (connectés/stale>48h/expirés). Super-admin.';

revoke all on function public.get_admin_integrations_health() from public, anon;
grant execute on function public.get_admin_integrations_health() to authenticated, service_role;
