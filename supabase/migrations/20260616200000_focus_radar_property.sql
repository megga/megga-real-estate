-- ════════════════════════════════════════════════════════════════════════════
-- MEGGA — Cockpit « Aujourd'hui » : Focus radar v4 (bien à pousser, tunable)
-- ════════════════════════════════════════════════════════════════════════════
-- Focus radar v4 ajoute UNE famille de signal PASSIF (portfolio) au scoring client :
--   • property-push : bien INTERNE le mieux placé pour être travaillé aujourd'hui,
--                     à partir du SCORE DE BIEN backend (property_scores.overall_score,
--                     cf calculate_property_scores + cron property-score-nightly).
-- Source 100% client (RLS d'agence DÉJÀ posée sur property_scores) : useFocusProperties
-- lit overall_score/score_label/sous-scores joints à properties — aucune RPC, aucun
-- grant. Signal de FOND, CAPPÉ (property_returned), JAMAIS « now » (pas une obligation
-- datée) ; geste honnête tiré du levier le plus faible. DÉTERMINISTE, 0 LLM.
--
-- Ce fichier n'enrichit que le barème app_config.today_focus_v1 (poids property_push,
-- cap property_returned) pour rester pilotable en DB — sinon parseFocusConfig retombe
-- défensivement sur FOCUS_DEFAULTS (focusScore.ts), donc migration optionnelle au
-- runtime. Suite de 20260616160000_focus_radar_v3.sql.
--
-- JSON = MIROIR EXACT de FOCUS_DEFAULTS (focusScore.ts). Réécriture complète
-- (INSERT … ON CONFLICT DO UPDATE) comme les migrations Focus précédentes : le RPC
-- focus_top_matches COALESCE chaque clé qu'il lit, donc un remplacement complet
-- reste sûr (les clés property_push/property_returned ne sont lues que côté client).
-- Idempotent.

INSERT INTO public.app_config (key, value)
VALUES (
  'today_focus_v1',
  '{"weights":{"reminder":0.45,"match":0.40,"deal":0.15,"kyc":0.42,"seller_lead":0.45,"lead_cooling":0.25,"offer_expiring":0.45,"visit":0.40,"property_push":0.30},"thresholds":{"match_gate":70,"match_now":80,"match_next":70,"reminder_overdue_saturation_days":3,"deal_next_stage_prob":0.60,"kyc_expiry_window_days":14,"seller_lead_stale_saturation_days":14,"lead_cooling_saturation_days":60,"offer_expiring_window_days":7,"offer_expiring_now_days":2,"visit_debrief_saturation_days":5},"bonuses":{"match_internal":0.08,"match_quality":0.05,"reminder_kyc":0.15,"reminder_offer":0.10,"deal_tension_at_risk":0.20,"deal_tension_stalled":0.10,"kyc_max":0.12,"deal_value_ref":3000000,"seller_lead_motivation_immediate":0.15,"seller_lead_value_ref":3000000},"caps":{"now_total":3,"per_contact":2,"matches_returned":40,"cooling_returned":3,"offer_expiring_returned":5,"visit_returned":3,"property_returned":3},"version":1}'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
