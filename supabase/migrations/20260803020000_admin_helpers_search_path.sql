-- Épingle le `search_path` des trois helpers console qui ne l'avaient pas
-- (advisor Supabase `function_search_path_mutable`, relevé à l'audit du 03.08.2026).
--
-- Aucune n'est SECURITY DEFINER — le risque réel est faible — mais la règle du chantier
-- (« chaque fonction a son search_path ») ne vaut que si elle n'a pas d'exceptions
-- silencieuses, et l'advisor criera à chaque revue tant qu'elles traînent.
--
-- Vérifié AVANT d'épingler (piège n° 5 du chantier : une référence non qualifiée vers
-- `extensions` ne casse qu'à l'EXÉCUTION, en 42883) : les trois corps ne référencent
-- que `pg_catalog` (jsonb_*, round) et rien d'autre — l'épinglage ne peut rien casser.
-- Coût accepté : un SET de config sur une fonction SQL empêche son inlining ;
-- `agency_mrr_rule` est appelée par agence affichée, soit ~10 lignes aujourd'hui.

alter function public.admin_error(p_code text, p_message_fr text, p_details jsonb)
  set search_path to 'public', 'pg_temp';

alter function public.admin_ok(p_data jsonb)
  set search_path to 'public', 'pg_temp';

alter function public.agency_mrr_rule(p_plan text, p_billing_period text, p_sub_status text, p_agency_status text, p_pricing jsonb)
  set search_path to 'public', 'pg_temp';
