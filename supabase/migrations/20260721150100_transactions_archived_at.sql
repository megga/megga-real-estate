-- Pipeline v2 (Sugar Pure) : « Archiver » un deal le sort du board sans le perdre
-- (action rapide de carte, undo par toast). Colonne dédiée plutôt qu'un statut :
-- `status='cancelled'` est déjà surchargé (dérivation risque « stalled » du board,
-- compteurs Today) et `completed` = deal gagné. NULL = visible au pipeline.
-- Pas d'index : le board charge les transactions de l'agence puis filtre côté
-- client (pas de WHERE archived_at en DB).

BEGIN;

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS archived_at timestamptz;

COMMENT ON COLUMN public.transactions.archived_at IS
  'Deal rangé hors pipeline (kanban/liste/timeline). NULL = visible ; undo = remise à NULL.';

COMMIT;
