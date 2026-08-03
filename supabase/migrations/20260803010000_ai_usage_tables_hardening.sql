-- Durcissement des deux tables d'instrumentation IA (audit console du 03.08.2026).
--
-- CE QUI A ÉTÉ MESURÉ EN PRODUCTION, et pourquoi on corrige les deux tables ensemble :
-- `ai_usage_logs` ET `ai_balance_snapshots` portaient encore les droits PAR DÉFAUT de
-- Supabase — `anon` et `authenticated` y détenaient TOUT (SELECT/INSERT/UPDATE/DELETE/
-- TRUNCATE/REFERENCES/TRIGGER), jamais révoqués depuis la création. C'est le même
-- footgun que celui fermé sur six tables internes par 20260801410000 ; ces deux-là
-- avaient échappé au balayage parce que le prédicat de `check-privilege-drift.mjs`
-- (`admin_%` + liste courte) ne les couvrait pas. Elles y entrent dans la même PR.
--
-- La RLS bloquait `anon` en pratique (aucune policy ne le laissait passer) : ce n'était
-- pas une fuite, c'était un verrou UNIQUE là où le dépôt en veut deux. Révoquer
-- transforme aussi un silence en erreur visible (une lecture bloquée par la RLS rend
-- `[]`, bloquée par le GRANT elle rend une ERREUR) — même argument que 20260801410000.
--
-- Audience réelle, mesurée au dépôt : les deux tables ne sont lues côté client QUE par
-- la console (`useAIBilling.ts`, écran Monitoring, super-admin) ; toutes les écritures
-- viennent des Edge Functions en service_role. `authenticated` n'a donc besoin que de
-- SELECT ; service_role garde tout (⚠ `rolbypassrls` ne contourne que la RLS, pas les
-- GRANT — le révoquer casserait les edges et les seeds de test).

revoke all on table public.ai_usage_logs from anon;
revoke all on table public.ai_balance_snapshots from anon;

revoke insert, update, delete, truncate, references, trigger
  on table public.ai_usage_logs from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.ai_balance_snapshots from authenticated;

-- Les policies testaient `profiles.role = 'super_admin'` EN DUR — la moitié du mur réel.
-- `is_super_admin()` exige le rôle ET l'e-mail allowlisté : c'est la règle que toute la
-- console applique, et le même défaut a déjà été corrigé sur `admin_changelog` à
-- l'étape 21 (« elles rataient la moitié allowlist du mur réel du dépôt »). La brèche
-- est étroite (`profiles.role` n'est pas écrivable par le client) mais la divergence
-- finit toujours par mordre le jour où l'allowlist retire un compte au rôle conservé.

drop policy if exists super_admin_read_ai_usage on public.ai_usage_logs;
create policy super_admin_read_ai_usage on public.ai_usage_logs
  for select using (public.is_super_admin());

drop policy if exists super_admin_read_ai_balance on public.ai_balance_snapshots;
create policy super_admin_read_ai_balance on public.ai_balance_snapshots
  for select using (public.is_super_admin());
