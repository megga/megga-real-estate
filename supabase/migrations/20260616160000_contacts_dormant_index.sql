-- ════════════════════════════════════════════════════════════════════════════
-- MEGGA — Index partiel « contacts dormants » (§7 : ORDER BY sans index couvrant)
-- ════════════════════════════════════════════════════════════════════════════
-- Sert la requête de src/hooks/useRelanceLeads.ts (consommée par RelancesTile,
-- RelanceSession et useFocusQueue / Focus radar v2, toutes dédupliquées en
-- 1 round-trip React Query) :
--
--   SELECT id, first_name, last_name, email, last_interaction_at, score
--   FROM contacts
--   WHERE (last_interaction_at < $cutoff OR last_interaction_at IS NULL)
--     AND type IN ('buyer','seller','tenant','landlord')
--     -- + RLS contacts_select injectée par Postgres (voir plus bas)
--   ORDER BY last_interaction_at ASC NULLS FIRST
--   LIMIT 50;
--
-- §7 du CLAUDE.md interdit un ORDER BY sans index partiel couvrant le WHERE :
-- aucun index existant ne porte last_interaction_at (seulement idx_contacts_type,
-- idx_contacts_agency_id, idx_contacts_agency_created…), donc PostgreSQL trie en
-- mémoire toute la partition. Inoffensif aujourd'hui (contacts = saisie humaine,
-- ~dizaines de lignes/agence, seq scan sub-ms) ; se dégrade quand les agences
-- grossissent. Cet index supprime le tri et permet un parcours ordonné + arrêt
-- précoce sur LIMIT 50.
--
-- ── Pourquoi PAS de préfixe (agency_id, …) ───────────────────────────────────
-- La policy RLS appliquée au SELECT est :
--   contacts_select : USING (agency_id = get_my_agency_id() OR user_id = auth.uid())
-- C'est un OR, pas une égalité simple. get_my_agency_id() est STABLE → la branche
-- agency_id seule serait sargable, mais le OR avec user_id = auth.uid() empêche le
-- planner d'épingler agency_id à UNE valeur. Un index composite
-- (agency_id, last_interaction_at NULLS FIRST) ne peut donc PAS fournir à la fois
-- le confinement par agence ET l'ordre en un seul parcours : il faudrait un
-- BitmapOr (branche agency_id via le préfixe + branche user_id via
-- idx_contacts_user_id) suivi d'un Sort bloquant, ce qui perd l'arrêt précoce sur
-- LIMIT. Pour un top-50 ordonné, l'index mono-colonne sur last_interaction_at est
-- le meilleur plan disponible compte tenu de la forme de la policy : parcours
-- ordonné, RLS + fenêtre de dormance appliquées en filtre, stop à 50.
-- (Mesure live impossible depuis cet environnement : pas de psql / CLI Supabase /
-- DATABASE_URL, et une connexion service_role contournerait la RLS donc son plan
-- ne refléterait pas la requête authentifiée réelle. Décision tranchée sur la DDL
-- de la policy, qui est l'entrée faisant autorité.)
--
-- NULLS FIRST aligne l'index sur le ORDER BY (ascending:true, nullsFirst:true du
-- hook) : les contacts jamais engagés (last_interaction_at IS NULL) sortent en
-- tête, exactement comme la session de relance les attaque (plus froids d'abord).
-- Prédicat partiel = copie exacte du .in('type', …) du hook (mêmes 4 valeurs, même
-- ordre) → implication de prédicat triviale (clauses identiques), index réellement
-- matché malgré le piège §7 « IN ne matche pas un index partiel » (qui ne vise que
-- les IN plus larges que le prédicat de l'index, pas un IN identique).
-- ════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_contacts_dormant
  ON public.contacts (last_interaction_at ASC NULLS FIRST)
  WHERE type IN ('buyer', 'seller', 'tenant', 'landlord');

-- Donne au planner les stats de sélectivité du nouvel index partiel (sans quoi il
-- peut tarder à le préférer). Coût négligeable sur une table de cette taille.
ANALYZE public.contacts;

-- ── Note d'évolution ─────────────────────────────────────────────────────────
-- Si un jour la policy contacts_select perd le OR pour devenir une égalité pure
-- (agency_id = get_my_agency_id()), agency_id redeviendra épinglable : reconsidérer
-- alors un composite (agency_id, last_interaction_at ASC NULLS FIRST) WHERE type IN (…)
-- pour confiner ET ordonner en un seul parcours à très grande échelle.
