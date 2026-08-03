-- Retire deux policies mortes de public.documents, vestiges du portail vendeur
-- (retiré le 26.07.2026 — cf. CLAUDE.md §8 « Portail vendeur : RETIRÉ »).
--
-- Origine : supabase/migrations/_archived/005_create_documents.sql, survivantes via le
-- schéma de base. Aucun appelant vivant : le portail vendeur n'existe plus, et aucun
-- chemin de code n'écrit contacts.user_id, seule clé qui armait la première.
--
-- Constat : docs/audits/2026-08-03-rls-isolation-multi-agence.md §5.
--
-- 1. « Sellers can read their documents » — le EXISTS n'est corrélé à AUCUNE colonne de
--    documents. Il ne demande pas « ce document appartient-il à ce vendeur ? » mais
--    « cet utilisateur est-il vendeur quelque part ? ». Vrai une fois, l'expression est
--    vraie pour CHAQUE ligne de la table, toutes agences confondues — pièces KYC,
--    contrats et mandats compris.
--
-- 2. « Sellers can insert documents » — WITH CHECK (uploaded_by = auth.uid()) sans aucune
--    contrainte sur agency_id : tout compte authentifié peut insérer une ligne dans
--    n'importe quelle agence en forgeant agency_id.
--
-- Couverture après retrait (inchangée pour les agents, correctement portée par agence) :
--   SELECT  documents_select                      agency_id = get_my_agency_id()
--   INSERT  « Agents can insert agency documents » agency_id ∈ agences de l'appelant
--   UPDATE  « Agents can update agency documents » idem
--   DELETE  « Agents can delete agency documents » idem
--
-- Vérifié avant retrait : le seul chemin d'écriture vivant (src/hooks/useKyc.ts) pose
-- agency_id explicitement, il satisfait donc la policy agent et ne dépend pas de celle-ci.

DROP POLICY IF EXISTS "Sellers can read their documents" ON public.documents;
DROP POLICY IF EXISTS "Sellers can insert documents" ON public.documents;
