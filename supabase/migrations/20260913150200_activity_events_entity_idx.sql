-- activity_events : un index par entité (13.09.2026).
--
-- La timeline d'un contact (useContactTimeline) et les deux outils IA qui la lisent
-- (get_contact_brief, prepare_meeting — _shared/contact-timeline.ts) filtrent sur
-- `entity_id`, et AUCUN des 8 index de la table ne le porte (mesuré en prod le 13.09.2026) :
-- chaque fiche parcourait la table. Ils font désormais DEUX lectures — les non-courriers par
-- `created_at`, les courriers par la date du courrier (`metadata->>sent_at`) — et la
-- synchronisation des boîtes va multiplier le volume (une ligne par courrier rattaché).
-- CLAUDE.md §7 : jamais d'ORDER BY sans index sur le WHERE au-delà de 5K lignes (6 518 le 13.09).
--
-- Pas CONCURRENTLY : la migration tourne dans une transaction, et la table est petite.
-- Rejouable : IF NOT EXISTS.
create index if not exists idx_activity_events_entity_created
  on public.activity_events (entity_id, created_at desc)
  where entity_id is not null;
