-- Matching v2 (Direction A — durcir le moteur) : config de scoring + versioning.
--
-- Pourquoi : le moteur historique scorait avec des poids et un seuil 60 codés
-- en dur (matching-engine/index.ts). On externalise le barème dans app_config
-- (ajustable sans redéploiement) et on horodate la version du barème sur chaque
-- match, comme point d'accroche pour la future boucle d'apprentissage.
--
-- NB : cette migration DOIT précéder 20260614130100 (les RPC d'insertion
-- référencent matches.score_version).

ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS score_version integer;
COMMENT ON COLUMN public.matches.score_version IS
  'Version du barème de scoring ayant produit ce match (matching-engine v2+). Hook boucle d''apprentissage.';

-- Barème par défaut. Total des poids = 100. transaction_type reste le seul
-- filtre DUR (hors barème) ; le reste est continu et explicable.
INSERT INTO public.app_config (key, value)
VALUES (
  'matching_scoring_v2',
  '{"weights":{"price":32,"zone":24,"type":12,"rooms":12,"surface":10,"features":10},"threshold":55,"priceOverTolerance":0.15,"surfaceDeficitTolerance":0.20,"version":2}'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
