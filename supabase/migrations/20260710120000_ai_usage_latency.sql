-- =====================================================================
-- ai_usage_logs : latence par appel IA (coût + latence = pilotage complet)
--
-- Constat (audit WhatsApp) : les plus gros consommateurs DeepSeek —
-- whatsapp-agent et sa boucle d'outils, _shared/whatsapp-actions (6 sites),
-- whatsapp-comprehend, ai-copilot, learn-agent-style, weekly-digest —
-- appelaient api.deepseek.com EN DIRECT sans passer par _shared/ai-provider.ts,
-- donc n'écrivaient AUCUNE ligne dans ai_usage_logs : le plus gros poste de
-- coût IA était totalement aveugle. Ils sont désormais instrumentés
-- (logDeepSeekUsageWith, fire-and-forget) et journalisent coût + latence.
--
-- Cette migration ajoute la seule colonne manquante : latency_ms. Les colonnes
-- agency_id / module existent déjà (20260705172000).
--
-- NULLABLE : l'historique et les rares appels sans mesure restent NULL. Aucun
-- backfill (la latence passée est irrécupérable). RLS inchangée (lecture
-- super_admin ; INSERT par service-role qui contourne la RLS).
-- =====================================================================

alter table public.ai_usage_logs
  add column if not exists latency_ms integer;

comment on column public.ai_usage_logs.latency_ms is
  'Latence de l''appel IA (aller-retour fetch + parse) en millisecondes. NULL = non mesuré / historique.';
