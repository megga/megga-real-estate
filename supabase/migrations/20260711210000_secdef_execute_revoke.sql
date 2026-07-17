-- Hygiène EXECUTE des fonctions SECURITY DEFINER — follow-up de l'audit advisors
-- (WARN anon/authenticated_security_definer_function_executable, 11 juil. 2026).
--
-- Les défauts Supabase (ALTER DEFAULT PRIVILEGES) donnent EXECUTE à anon/authenticated
-- sur CHAQUE fonction créée. Résultat : des triggers, des helpers cron et des RPC
-- internes étaient appelables par n'importe quel porteur de l'anon key via PostgREST.
-- Audit call-site complet (src/, edge fns, vitrine, tests, pg_cron, policies) →
-- on ne révoque QUE ce qui n'a prouvé AUCUN appelant pour le rôle révoqué.
--
-- Ce qui reste VOLONTAIREMENT accessible :
--   anon  : get_popular_articles (/help public), get/reschedule/cancel_visit_by_token +
--           submit_visit_feedback_by_token (capability token, pages visite publiques).
--   authenticated : toutes les RPC appelées par le CRM (admin_*, analytics_*, team_*,
--           search_cities, match_candidate_listings, focus/config/whatsapp monitoring…)
--           et les helpers de policies RLS (get_my_agency_id, get_user_agency_id,
--           is_super_admin, get_user_role, wa_msg_is_foreign_agent_thread) — les quals
--           s'exécutent avec les droits de l'appelant, les révoquer casserait TOUT.
--   service_role : conservé partout (edge fns) ; pg_cron tourne en postgres (insensible).
--   st_estimatedextent : PostGIS (extension), hors périmètre comme spatial_ref_sys.
--
-- Idempotent : chaque cible est gardée par to_regprocedure (absente → skip, re-jouable).

do $$
declare
  fn text;
begin
  -- ── T. Fonctions TRIGGER (23) — jamais appelées via l'API : PostgreSQL ne vérifie
  --      EXECUTE qu'à la CRÉATION du trigger, pas au déclenchement. Revoke total.
  foreach fn in array array[
    'public.audit_crm_offer_event()',
    'public.audit_kyc_magic_link_transitions()',
    'public.auto_verify_kyc_dossier()',
    'public.backlink_whatsapp_on_contact()',
    'public.bump_contact_last_interaction()',
    'public.bump_contact_last_interaction_wa()',
    'public.capture_transaction_lifecycle()',
    'public.enforce_activity_events_immutability()',
    'public.enforce_kyc_cases_retention()',
    'public.enforce_kyc_magic_links_retention()',
    'public.guard_manual_kyc_verified()',
    'public.log_kyc_screening_decision()',
    'public.log_match_reaction()',
    'public.monitor_transaction_kyc_gate()',
    'public.notify_new_contact_message()',
    'public.notify_new_seller_lead()',
    'public.properties_audit_event()',
    'public.seed_kyc_lba_checks()',
    'public.set_match_response_at()',
    'public.set_property_published_at()',
    'public.set_visit_completed_at()',
    'public.sign_deal_on_offer_accept()',
    'public.update_marketplace_inquiries_updated_at()'
  ] loop
    if to_regprocedure(fn) is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', fn);
    end if;
  end loop;

  -- ── C. Helpers cron / service / ops (15) — appelés par pg_cron (postgres) ou par les
  --      edge fns (service_role, grant conservé). Aucun appel client.
  foreach fn in array array[
    'public.cleanup_orphan_property_drafts()',
    'public.mark_stale_kyc_dossiers()',
    'public.purge_expired_import_raw_text()',
    'public.unpublish_expired_mandates()',
    'public.purge_activity_events_retention()',
    'public.realadvisor_health_check()',
    'public.realadvisor_probe_collect()',
    'public.realadvisor_probe_fire(text, integer)',
    'public.realadvisor_probe_sweep(text, integer, integer, integer, numeric, boolean)',
    'public.realadvisor_revive_collect(integer)',
    'public.realadvisor_revive_fire(text, integer, integer, integer)',
    'public.realadvisor_probe_bookkeep(text[], text[], integer)',
    'public.realadvisor_sweep_enum(text, integer, integer, numeric, boolean)',
    'public.is_within_sla_window(uuid, timestamp with time zone)',
    'public.can_auto_send(uuid, text)'
  ] loop
    if to_regprocedure(fn) is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', fn);
      execute format('grant execute on function %s to service_role', fn); -- ceinture-bretelles edge fns
    end if;
  end loop;

  -- ── O. Orphelines (8) — zéro appelant dans src/, edge, vitrine, tests (surfaces
  --      marketplace/annuaire retirées au pivot ; check_email_exists = vecteur
  --      d'énumération d'emails jamais branché). Revoke anon + authenticated.
  foreach fn in array array[
    'public.check_email_exists(text)',
    'public.count_market_by_canton(text)',
    'public.count_market_by_type(text)',
    'public.get_cities_by_canton(text, text)',
    'public.get_market_map_points(text, text[], text, text, numeric, numeric, numeric, numeric, text[])',
    'public.get_price_hexagons(double precision, double precision, double precision, double precision, integer, text, text[], integer)',
    'public.estimate_property_price(text, text, text, integer)',
    'public.search_directory(text, text, text, text, text[], text[], boolean, text, integer, integer)'
  ] loop
    if to_regprocedure(fn) is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', fn);
    end if;
  end loop;

  -- ── A. RPC CRM authentifiées (8) — appelées uniquement avec un JWT utilisateur
  --      (onboarding post-signup, admin, fiches) : anon n'a rien à y faire.
  foreach fn in array array[
    'public.accept_followup_suggestion(uuid)',
    'public.create_agency_and_join(text, text, text, boolean)',
    'public.join_agency(uuid)',
    'public.search_agencies(text, integer)',
    'public.get_agency_activity_summary(uuid[], integer)',
    'public.get_agency_stats(uuid[])',
    'public.get_onboarding_milestones(uuid[])',
    'public.compute_agent_preferences(uuid)'
  ] loop
    if to_regprocedure(fn) is not null then
      execute format('revoke execute on function %s from public, anon', fn);
    end if;
  end loop;
end $$;
