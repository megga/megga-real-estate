-- ════════════════════════════════════════════════════════════════════════════
-- MEGGA — Cockpit « Aujourd'hui » : Focus radar v1 (tunables des 2 familles)
-- ════════════════════════════════════════════════════════════════════════════
-- Focus radar v1 ajoute deux familles de signal PASSIF (radar) au scoring client :
--   • seller-lead : nouveaux mandats vendeurs 'new' à réclamer (argent qui attend) ;
--   • kyc         : deal proche du closing dont le dossier KYC n'est pas vérifié
--                   (nudge NON-BLOQUANT, jamais un gate sur le pipeline).
-- Aucune nouvelle RPC : ces deux sources sont lues côté client (RLS) — seller_leads
-- via useSellerLeads('new'), KYC via le map déjà chargé par usePipelineSugar.
-- Ce fichier ne fait qu'enrichir le barème app_config.today_focus_v1 pour que les
-- nouveaux poids/seuils restent pilotables en DB (sinon parseFocusConfig retombe
-- défensivement sur FOCUS_DEFAULTS, donc cette migration est optionnelle au runtime).
-- Suite de 20260616120000_today_focus.sql + 20260616130000_today_focus_config_rpc.sql.
--
-- Le JSON ci-dessous est le MIROIR EXACT de FOCUS_DEFAULTS (focusScore.ts). On
-- réécrit la valeur entière (INSERT … ON CONFLICT DO UPDATE) comme la migration
-- d'origine : le RPC focus_top_matches COALESCE chaque clé qu'il lit, donc un
-- remplacement complet reste sûr. Idempotent.

INSERT INTO public.app_config (key, value)
VALUES (
  'today_focus_v1',
  '{"weights":{"reminder":0.45,"match":0.40,"deal":0.15,"kyc":0.42,"seller_lead":0.45},"thresholds":{"match_gate":70,"match_now":80,"match_next":70,"reminder_overdue_saturation_days":3,"deal_next_stage_prob":0.60,"kyc_expiry_window_days":14,"seller_lead_stale_saturation_days":14},"bonuses":{"match_internal":0.08,"match_quality":0.05,"reminder_kyc":0.15,"reminder_offer":0.10,"deal_tension_at_risk":0.20,"deal_tension_stalled":0.10,"kyc_max":0.12,"deal_value_ref":3000000,"seller_lead_motivation_immediate":0.15,"seller_lead_value_ref":3000000},"caps":{"now_total":3,"per_contact":2,"matches_returned":40},"version":1}'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
