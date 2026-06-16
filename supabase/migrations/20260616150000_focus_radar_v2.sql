-- ════════════════════════════════════════════════════════════════════════════
-- MEGGA — Cockpit « Aujourd'hui » : Focus radar v2 (lead-cooling tunables)
-- ════════════════════════════════════════════════════════════════════════════
-- Focus radar v2 ajoute une famille de signal PASSIF de FOND au scoring client :
--   • lead-cooling : un lead dormant / jamais recontacté (recency) à relancer.
-- Source 100% client (RLS) : useRelanceLeads (contacts.last_interaction_at > 14j
-- OU NULL, qualité hot/warm/cold). DÉDUPLIQUÉ (on ne surface que les contacts sans
-- autre signal plus fort) + CAPPÉ (cooling_returned) + tier 'next' jamais 'now'.
-- Aucune nouvelle RPC, aucun grant. Ce fichier n'enrichit que le barème
-- app_config.today_focus_v1 (poids lead_cooling, seuil de saturation de dormance,
-- cap cooling_returned) pour rester pilotable en DB — sinon parseFocusConfig
-- retombe défensivement sur FOCUS_DEFAULTS (donc migration optionnelle au runtime).
-- Suite de 20260616140000_focus_radar_v1.sql.
--
-- JSON = MIROIR EXACT de FOCUS_DEFAULTS (focusScore.ts). Réécriture complète
-- (INSERT … ON CONFLICT DO UPDATE) comme les migrations Focus précédentes : le RPC
-- focus_top_matches COALESCE chaque clé qu'il lit, donc un remplacement complet
-- reste sûr. Idempotent.

INSERT INTO public.app_config (key, value)
VALUES (
  'today_focus_v1',
  '{"weights":{"reminder":0.45,"match":0.40,"deal":0.15,"kyc":0.42,"seller_lead":0.45,"lead_cooling":0.25},"thresholds":{"match_gate":70,"match_now":80,"match_next":70,"reminder_overdue_saturation_days":3,"deal_next_stage_prob":0.60,"kyc_expiry_window_days":14,"seller_lead_stale_saturation_days":14,"lead_cooling_saturation_days":60},"bonuses":{"match_internal":0.08,"match_quality":0.05,"reminder_kyc":0.15,"reminder_offer":0.10,"deal_tension_at_risk":0.20,"deal_tension_stalled":0.10,"kyc_max":0.12,"deal_value_ref":3000000,"seller_lead_motivation_immediate":0.15,"seller_lead_value_ref":3000000},"caps":{"now_total":3,"per_contact":2,"matches_returned":40,"cooling_returned":3},"version":1}'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
