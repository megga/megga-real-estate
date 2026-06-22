-- B2a — Migre les transactions aux stades LEGACY vers l'enum courant (TRANSACTION_STAGES).
--
-- Contexte : LEGACY_STAGE_MAP (lead->new_lead, qualified->to_qualify, closed->signed)
-- n'était appliquée qu'à la LECTURE, via le `default` de mapStage (sugarAdapters).
-- En base, les lignes restaient au stade legacy (ex. 'lead', hors enum), ce qui
-- fige stage_change/vélocité et l'instrumentation comportementale (le stade « réel »
-- n'est jamais un stade courant tant que l'agent ne drague pas la carte).
--
-- Idempotent : ne touche que les lignes encore au stade legacy ; re-exécution = no-op.
-- Le trigger trg_transaction_lifecycle émet un stage_change par ligne migrée
-- (attribution système par défaut) — trace honnête du changement.

UPDATE public.transactions SET stage = 'new_lead'   WHERE stage = 'lead';
UPDATE public.transactions SET stage = 'to_qualify'  WHERE stage = 'qualified';
UPDATE public.transactions SET stage = 'signed'      WHERE stage = 'closed';
