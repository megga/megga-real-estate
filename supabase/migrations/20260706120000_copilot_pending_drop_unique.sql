-- Corrige un schéma DÉJÀ DÉPLOYÉ : la table copilot_pending_actions (créée par
-- 20260706100000, mergée en prod via #808) posait UNIQUE(user_id). Le passage à
-- « 1 carte IMMUABLE par action » (INSERT au lieu d'upsert — cf. revue : évite qu'une 2e
-- préparation/onglet écrase la charge d'une carte déjà affichée, ce qui ferait publier un
-- bien différent de l'aperçu validé) exige de RETIRER cette contrainte : sinon une 2e
-- carte du même agent dans la fenêtre TTL (15 min) viole l'unicité et casse la préparation.
--
-- Éditer le CREATE TABLE IF NOT EXISTS d'origine ne suffit PAS : sur une base où la table
-- existe déjà (prod), le statement est un no-op → la contrainte SURVIT. Il FAUT cet ALTER.
-- Idempotent (DROP / CREATE IF [NOT] EXISTS). Vérifier par l'OBJET (pg_constraint /
-- pg_indexes), pas par schema_migrations (non tracé par le déploiement).

BEGIN;

ALTER TABLE public.copilot_pending_actions DROP CONSTRAINT IF EXISTS copilot_pending_actions_user_id_key;
CREATE INDEX IF NOT EXISTS idx_copilot_pending_user ON public.copilot_pending_actions (user_id);
CREATE INDEX IF NOT EXISTS idx_copilot_pending_expires ON public.copilot_pending_actions (expires_at);

COMMIT;
