-- Index du chemin de lecture de la surface proactive « Suivis WhatsApp » du cockpit
-- (useAgencyFollowupSuggestions) : suivis en attente d'une agence, triés par urgence.
--
-- La requête (RLS wa_followups_agency_select ⇒ agency_id = get_my_agency_id()) est :
--   WHERE agency_id = X AND status = 'suggested'
--   ORDER BY due_at ASC NULLS LAST, created_at DESC
--   LIMIT 20
-- Les index existants (idx_wa_followups_agency_status (agency_id, status, created_at DESC)
-- et idx_wa_followups_contact) ne couvrent PAS le tri par due_at → tri en mémoire
-- (viole « jamais d'ORDER BY sans index couvrant », CLAUDE.md §7). Agence-scopé donc
-- petit aujourd'hui, mais additif à poser tant que la table est petite (pré-pilote).
--
-- L'index partiel mène par (agency_id, due_at, created_at DESC) sur les seules lignes
-- 'suggested' : le planner sert l'égalité agence + le tri complet sans Sort
-- (vérifié EXPLAIN sur prod : Index Scan, aucun nœud Sort). NULLS LAST est le défaut
-- btree pour un ASC → aligné avec la requête.
--
-- Additif, IF NOT EXISTS, 0 donnée touchée.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_wa_followups_agency_pending_due
  ON public.whatsapp_followup_suggestions (agency_id, due_at, created_at DESC)
  WHERE status = 'suggested';

COMMIT;
