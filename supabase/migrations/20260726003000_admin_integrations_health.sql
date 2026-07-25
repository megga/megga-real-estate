-- ⚠ RE-HORODATÉE le 26 juil. 2026 (stamp d'origine : 20260713170000).
-- `deploy.yml` n'applique QUE les migrations dont la date est >= aujourd'hui
-- (UTC) : celles de la PR #852, écrites les 13-14 juillet et mergées le 26,
-- sont passées sous le radar du déploiement — objets absents en prod alors que
-- la CI, elle, rejoue tout sur une base fraîche et restait verte. Re-datées
-- pour que le pipeline les applique. Idempotentes (le date-guard les rejouera
-- à chaque push de la journée).
-- =====================================================================
-- P7 — Santé des intégrations + MRR estimé (monitoring V2)
--
-- Aucune intégration critique (emails Resend, webhooks Stripe, calendriers
-- OAuth) ne doit casser en silence avant le lancement. 2 RPC gardées
-- is_super_admin() OR is_service_role() (42501) :
--   * get_admin_integrations_health() : agrège les signaux de santé.
--   * compute_platform_mrr_estimate() : MRR depuis subscriptions actives ×
--     app_config.plan_pricing (source serveur, seedée ici ; miroir de
--     lib/plans.ts — la règle de synchro est documentée au cerveau).
--
-- ⚠ Calendriers : un token_expires_at PASSÉ est NORMAL (flux de refresh
-- OAuth) — le vrai signal de panne est last_sync_at périmé. On expose les
-- deux mais on n'ALERTE que sur le stale (voir _shared/admin-alerts.ts).
-- =====================================================================

-- Prix des plans côté serveur (miroir lib/plans.ts). yearly = prix mensuel
-- en facturation annuelle (cohérent avec PLANS.price_yearly).
insert into public.app_config (key, value)
values ('plan_pricing',
  '{"starter":{"monthly":0,"yearly":0},"pro":{"monthly":89,"yearly":71},"entreprise":{"monthly":249,"yearly":199}}')
on conflict (key) do nothing;

-- ── MRR estimé (subscriptions actives × plan_pricing) ────────────────────────
create or replace function public.compute_platform_mrr_estimate()
returns numeric
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_pricing jsonb;
  v_mrr numeric;
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  select nullif(value, '')::jsonb into v_pricing from public.app_config where key = 'plan_pricing';
  if v_pricing is null then
    return 0;
  end if;

  select coalesce(sum(
    case when s.billing_period = 'yearly'
      then coalesce((v_pricing->s.plan->>'yearly')::numeric, 0)
      else coalesce((v_pricing->s.plan->>'monthly')::numeric, 0)
    end
  ), 0) into v_mrr
  from public.subscriptions s
  where s.status = 'active';

  return round(v_mrr, 2);
end;
$$;

comment on function public.compute_platform_mrr_estimate() is
  'MRR estimé = somme des subscriptions actives valorisées par app_config.plan_pricing. Historisé horaire dans platform_metrics (mrr_estimate) par admin-monitoring. Voir 20260713170000.';

-- ── Santé des intégrations (emails / webhooks Stripe / calendriers) ─────────
create or replace function public.get_admin_integrations_health()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
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
  from activity_events
  where action in ('subscription_activated','subscription_changed','subscription_cancelled','payment_failed');

  select jsonb_build_object(
    'emails', (
      select jsonb_build_object(
        'sent_24h', count(*) filter (where action = 'email_sent' and created_at >= now() - interval '24 hours'),
        'sent_7d',  count(*) filter (where action = 'email_sent' and created_at >= now() - interval '7 days'),
        'errors_7d', count(*) filter (where action = 'edge_function_error'
                       and created_at >= now() - interval '7 days'
                       and coalesce(metadata->>'function_name','') like 'send-%')
      )
      from activity_events
      where created_at >= now() - interval '7 days'
    ),
    'stripe_webhook', jsonb_build_object(
      'last_event_at', v_last_webhook,
      'age_hours', case when v_last_webhook is null then null
                        else round(extract(epoch from (now() - v_last_webhook)) / 3600.0, 1) end,
      'events_7d', (select count(*) from activity_events
                    where action in ('subscription_activated','subscription_changed','subscription_cancelled','payment_failed')
                      and created_at >= now() - interval '7 days'),
      'payment_failed_7d', (select count(*) from activity_events
                    where action = 'payment_failed' and created_at >= now() - interval '7 days'),
      'active_subscriptions', (select count(*) from subscriptions where status = 'active')
    ),
    'calendar', jsonb_build_object(
      'google', (
        select jsonb_build_object(
          'connected', count(*),
          'stale', count(*) filter (where sync_enabled and last_sync_at is not null and last_sync_at < v_stale_before),
          'expired', count(*) filter (where token_expires_at < now())
        ) from google_calendar_tokens
      ),
      'outlook', (
        select jsonb_build_object(
          'connected', count(*),
          'stale', count(*) filter (where sync_enabled and last_sync_at is not null and last_sync_at < v_stale_before),
          'expired', count(*) filter (where token_expires_at < now())
        ) from outlook_calendar_tokens
      ),
      'stale_total',
        (select count(*) from google_calendar_tokens where sync_enabled and last_sync_at is not null and last_sync_at < v_stale_before)
      + (select count(*) from outlook_calendar_tokens where sync_enabled and last_sync_at is not null and last_sync_at < v_stale_before)
    )
  ) into v_result;

  return v_result;
end;
$$;

comment on function public.get_admin_integrations_health() is
  'Santé des intégrations : emails Resend (envois/erreurs send-%), webhooks Stripe (âge du dernier événement), calendriers OAuth (connectés/stale>48h/expirés). ⚠ token_expires_at passé = normal (refresh) ; le signal de panne = last_sync_at stale. Super-admin. Voir 20260713170000.';

revoke all on function public.compute_platform_mrr_estimate() from public, anon;
revoke all on function public.get_admin_integrations_health() from public, anon;
grant execute on function public.compute_platform_mrr_estimate() to authenticated, service_role;
grant execute on function public.get_admin_integrations_health() to authenticated, service_role;
