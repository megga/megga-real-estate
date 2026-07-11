-- Durcissement RLS — fixes des failles remontées par les advisors Supabase (11 juil. 2026).
-- Idempotent (re-jouable, date-guard deploy.yml safe). 4 chantiers :
--
-- (a) ERROR rls_disabled_in_public : _ra_sweep_backup_20260709 (backup ad-hoc pris en prod
--     avant le fix sweep RealAdvisor #820/#821, jamais créé par migration) était lisible
--     par l'anon key via PostgREST. 0 PII (bookkeeping de sync) mais rien à exposer →
--     RLS deny-all + revoke. Non destructif ; le DROP éventuel se décidera à part.
--     NB : spatial_ref_sys (PostGIS) reste ERROR — non fixable, accepté (doc interne).
--
-- (b) support_tickets.anon_select_own_ticket avait qual `true` : N'IMPORTE QUEL porteur
--     de l'anon key lisait TOUS les tickets (email, sujet, description = PII). Aucun
--     consommateur anon dans l'app ni la vitrine → on supprime. L'INSERT anon (formulaire
--     support public) reste. Idem ticket_messages.anon_select_messages (toutes les
--     conversations support non-internes lisibles anon).
--
-- (c) visits : anon_select/update_visit_by_token avaient qual `manage_token IS NOT NULL`
--     — vrai pour TOUTES les visites → l'anon key lisait (buyer_name, buyer_email,
--     planning) et MODIFIAIT n'importe quelle visite. RLS ne peut pas exprimer « le
--     client connaît le token » → on remplace par des RPC SECURITY DEFINER scopées token
--     (manage_token uuid = capability non devinable), qui portent exactement les 4
--     opérations de la surface publique (/visit/:id/edit + feedback) : lire, replanifier,
--     annuler, déposer le feedback. Les policies barn-door sont supprimées.
--
-- (d) function_search_path_mutable × 9 : triggers sans search_path figé → SET search_path.

-- ── (a) Backup RealAdvisor : verrou deny-all ─────────────────────────────────
do $$
begin
  if to_regclass('public._ra_sweep_backup_20260709') is not null then
    execute 'alter table public._ra_sweep_backup_20260709 enable row level security';
    execute 'revoke all on table public._ra_sweep_backup_20260709 from anon, authenticated';
  end if;
end $$;

-- ── (b) Tickets support : plus aucune lecture anon ───────────────────────────
drop policy if exists "anon_select_own_ticket" on public.support_tickets;
drop policy if exists "anon_select_messages" on public.ticket_messages;

-- ── (c) Visites : RPC token-scopées, puis suppression des policies barn-door ──
-- Lecture : la forme JSON reproduit exactement PublicVisitData (useVisits.usePublicVisit).
create or replace function public.get_visit_by_token(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', v.id,
    'scheduled_at', v.scheduled_at,
    'status', v.status,
    'buyer_name', v.buyer_name,
    'buyer_email', v.buyer_email,
    'manage_token', v.manage_token,
    'property', case when p.id is null then null else jsonb_build_object(
      'title', p.title, 'address', p.address, 'city', p.city,
      'photos', coalesce(to_jsonb(p.photos), '[]'::jsonb)) end)
  from public.visits v
  left join public.properties p on p.id = v.property_id
  where p_token is not null and v.manage_token = p_token
$$;

-- Replanifier (même transition que l'ancien update direct : scheduled_at + planned).
create or replace function public.reschedule_visit_by_token(p_token uuid, p_new_at timestamptz)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if p_token is null or p_new_at is null then return false; end if;
  update public.visits set scheduled_at = p_new_at, status = 'planned'
   where manage_token = p_token
  returning id into v_id;
  return v_id is not null;
end $$;

-- Annuler.
create or replace function public.cancel_visit_by_token(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if p_token is null then return false; end if;
  update public.visits set status = 'cancelled'
   where manage_token = p_token
  returning id into v_id;
  return v_id is not null;
end $$;

-- Feedback post-visite (VisitFeedbackPage) : mêmes colonnes que l'ancien update direct.
create or replace function public.submit_visit_feedback_by_token(
  p_token uuid, p_rating integer, p_comment text, p_ai jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if p_token is null then return false; end if;
  update public.visits
     set rating = p_rating,
         feedback_buyer = nullif(coalesce(p_comment, ''), ''),
         ai_objections = coalesce(p_ai, '{}'::jsonb),
         status = 'done',
         completed_at = now(),
         feedback_sent = true
   where manage_token = p_token
  returning id into v_id;
  return v_id is not null;
end $$;

-- Grants : capability publique (la page est anonyme) — anon + authenticated, rien d'autre.
revoke all on function public.get_visit_by_token(uuid) from public;
revoke all on function public.reschedule_visit_by_token(uuid, timestamptz) from public;
revoke all on function public.cancel_visit_by_token(uuid) from public;
revoke all on function public.submit_visit_feedback_by_token(uuid, integer, text, jsonb) from public;
grant execute on function public.get_visit_by_token(uuid) to anon, authenticated;
grant execute on function public.reschedule_visit_by_token(uuid, timestamptz) to anon, authenticated;
grant execute on function public.cancel_visit_by_token(uuid) to anon, authenticated;
grant execute on function public.submit_visit_feedback_by_token(uuid, integer, text, jsonb) to anon, authenticated;

-- Les policies barn-door tombent APRÈS la mise en place des RPC (zéro fenêtre de casse).
drop policy if exists "anon_select_visit_by_token" on public.visits;
drop policy if exists "anon_update_visit_by_token" on public.visits;

-- ── (d) search_path figé sur les 9 fonctions trigger signalées ────────────────
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.ai_actions_queue_set_updated_at()',
    'public.ai_copilot_conv_touch_updated_at()',
    'public.esign_touch_updated_at()',
    'public.ra_price_status()',
    'public.tg_profiles_guard_role_agency()',
    'public.touch_transactions_updated_at()',
    'public.trg_knowledge_touch()',
    'public.update_email_token_timestamp()',
    'public._analytics_decomp(transaction_stage)'
  ] loop
    if to_regprocedure(fn) is not null then
      execute format('alter function %s set search_path = public', fn);
    end if;
  end loop;
end $$;
