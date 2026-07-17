-- Index du chemin chaud (suite du P2 perf whatsapp_messages, cf. 20260705100000).
--
-- Les DEUX RPC lancées CHAQUE MINUTE par le cron whatsapp-process
-- (job whatsapp-process-minute, schedule '* * * * *', actif) :
--   • whatsapp_stale_insight_contacts  (20260602100000)
--   • whatsapp_pending_notices         (20260602110000)
-- balaient whatsapp_messages par :
--   direction = 'inbound' AND agency_id IS NOT NULL AND created_at > <borne 7j / 24h>
-- SANS ancre d'égalité sur agency_id/contact_id (elles agrègent TOUTES les agences).
--
-- Aucun index existant ne mène par created_at EN PORTANT direction='inbound' :
-- idx_whatsapp_messages_contact_created (contact_id, created_at) et
-- idx_whatsapp_messages_agency_created (agency_id, created_at) satisfont leur WHERE
-- partiel via les IS NOT NULL mais n'ont pas d'ancre d'égalité et ne filtrent pas
-- direction → le planner balaie toute la table puis filtre direction + fenêtre,
-- TOUTES LES MINUTES. À l'échelle actuelle (petite table) c'est gratuit ; au volume
-- pilote (100k+ lignes) c'est un seq scan par minute — viole la règle « jamais de
-- filtre chaud / ORDER BY sans index couvrant le WHERE » (CLAUDE.md §7).
--
-- Un SEUL index partiel amortit les deux RPC : leur WHERE implique toutes deux
-- direction='inbound' AND agency_id IS NOT NULL (vérifié EXPLAIN sur prod : Index Scan
-- retenu, prédicat partiel absorbé, created_at en Index Cond), et chacune borne
-- created_at. C'est le complément exact de idx_wa_messages_unmapped_inbound
-- (… WHERE direction='inbound' AND agency_id IS NULL) : ensemble ils partitionnent
-- l'entrant mappé / non-mappé.
--
-- Pourquoi PAS de nouvel index fonctionnel normalize_phone (3e item de la carte P2) :
-- ce serait du poids mort. Le SEUL consommateur SQL de normalize_phone(wa_from) sur
-- whatsapp_messages est le back-link des orphelins (contact_id IS NULL), déjà servi par
-- idx_wa_messages_agency_normphone (20260617091000). Aucune requête ne filtre
-- normalize_phone sur des lignes contact_id IS NOT NULL, et un query builder Supabase JS
-- ne peut pas appeler normalize_phone dans un .eq/.filter → un index fonctionnel plus
-- large ne serait jamais choisi par le planner (write-amplification pure).
--
-- Additif, IF NOT EXISTS, 0 donnée touchée. Posé pré-pilote pendant que la table est
-- petite (pose immédiate ; CONCURRENTLY inutile — même choix que 20260705100000).

BEGIN;

CREATE INDEX IF NOT EXISTS idx_wa_messages_inbound_created
  ON public.whatsapp_messages (created_at DESC)
  WHERE direction = 'inbound' AND agency_id IS NOT NULL;

COMMIT;
