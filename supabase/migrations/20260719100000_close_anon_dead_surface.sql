-- Ferme les surfaces anon mortes : pont de privilège contact_messages + annuaire.
--
-- Suite de l'audit déclenché par `contacts_anon_onboarding_insert` (migration
-- 20260719090000). Balayage de TOUTES les policies de pg_policies exposées à anon
-- (roles={anon}, plus roles={public} qui vise le pseudo-rôle PUBLIC donc anon
-- inclus), recoupé avec les appelants réels dans src/, supabase/functions/,
-- sites/ et scripts/, puis vérifié en live avec SET LOCAL ROLE anon.
--
-- Résultat honnête : AUCUNE autre policy ne reproduit le bug `contacts`. Ce défaut
-- exige une colonne de tenant qu'on oublie de contraindre ; or les tables encore
-- ouvertes à anon n'ont pas de tenant du tout, et `seller_leads` — la seule qui en
-- ait un — le force déjà à NULL. Ce qui suit est donc UN correctif (contact_messages)
-- et UNE passe de ménage (annuaire), pas un audit de sécurité critique.
--
-- Rappel : le baseline pose `GRANT ALL ON TABLE public.<t> TO anon` sur chaque
-- table (et sur les futures via ALTER DEFAULT PRIVILEGES). La RLS est donc le
-- SEUL verrou face à la clé anon, publique par conception. Les REVOKE ci-dessous
-- sont de la défense en profondeur : le verrou reste la policy.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. contact_messages — franchissement de privilège vers le journal d'audit
-- ─────────────────────────────────────────────────────────────────────────────
-- La policy ne contraignait que `consent_privacy` et `status`, deux champs 100 %
-- contrôlés par l'appelant, qui re-vérifiaient des CHECK déjà posés au DDL. Elle
-- ne prouvait donc rien. La table n'a pas d'agency_id (boîte unique plateforme),
-- il n'y a pas d'écriture cross-agence possible — le problème est ailleurs :
--
-- `trg_notify_new_contact_message` (AFTER INSERT) exécute notify_new_contact_message(),
-- SECURITY DEFINER, qui écrit dans `activity_events` — table où anon n'a AUCUNE
-- policy INSERT. Le trigger sert donc de pont : anon obtient une écriture indirecte
-- dans le journal d'audit, avec du texte qu'il contrôle (name jusqu'à 120 car.,
-- subject jusqu'à 200 car., plus email/name en metadata jsonb).
--
-- Vérifié en live (transaction annulée, SET LOCAL ROLE anon) :
--   · INSERT direct dans activity_events   → REFUSÉ (42501)
--   · INSERT d'un contact_message valide   → ACCEPTÉ
--   · lignes activity_events créées        → +1, portant le texte de la sonde
--
-- Aggravant : activity_events est immuable (rétention LBA 10 ans), le bruit injecté
-- n'est pas purgeable par les voies normales.
--
-- Aucun appelant vivant : la table est à 0 ligne, la route React /contact est
-- devenue MarketplaceDisabledRedirect, et le seul écrivain jamais écrit vit dans
-- sites/_marketplace-phase-ulterieure/ (dormant, non déployé — l'overlay pointe
-- sur sites/megga-vitrine, dont le contact.html est un formulaire Webflow inerte
-- en method="get" sans handler). Le back-office (AdminModerationInbox) ne fait que
-- SELECT/UPDATE, couvert par contact_messages_super_admin_all.
DROP POLICY IF EXISTS contact_messages_anon_insert ON public.contact_messages;
REVOKE ALL ON TABLE public.contact_messages FROM anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Annuaire (agency_profiles / agent_profiles) — exposition de données
-- ─────────────────────────────────────────────────────────────────────────────
-- Policies `public_read_*` (USING (true), rôle PUBLIC) héritées de la feature
-- « annuaire » (migration archivée 20260405_001_agent_directory), retirée avec la
-- marketplace au pivot CRM-first. Mesuré en live sous SET LOCAL ROLE anon :
--   · agency_profiles : 5 847 lignes, dont 5 847 claim_token, 3 935 e-mails, 1 922 tél.
--   · agent_profiles  : 2 062 lignes, dont 2 062 claim_token, 1 637 e-mails,   185 tél.
--
-- Les 2 062 agent_profiles ont TOUS profile_id IS NULL : des agents tiers moissonnés,
-- pas des utilisateurs MEGGA — donc des données personnelles de personnes physiques
-- non clientes, servies par une API publique.
--
-- Les claim_token sont des secrets de capacité générés par MEGGA (gen_random_uuid),
-- aujourd'hui DORMANTS : aucune policy, aucune fonction SQL et aucun code ne les
-- consomme (les policies d'écriture autorisent via auth.uid(), pas via le token).
-- Les lire ne donne donc aucun pouvoir en l'état — mais ils sont tous pré-divulgués,
-- ce qui piégerait quiconque implémenterait un jour le flux de revendication de la
-- façon évidente. L'écriture, elle, était déjà fermée (UPDATE/DELETE anon = 0 ligne).

-- agency_profiles : AUCUN lecteur applicatif (seul flatfox-sync écrit, en service_role,
-- qui contourne la RLS). Fermeture complète.
DROP POLICY IF EXISTS public_read_agency_profiles ON public.agency_profiles;
REVOKE ALL ON TABLE public.agency_profiles FROM anon;

-- agent_profiles : un lecteur AUTHENTIFIÉ existe — useAgentProfileSugar lit la fiche
-- de l'agent connecté via la jointure `agent_profiles!profile_id` (page Réglages).
-- Comme `public_read_agent_profiles` vise le rôle PUBLIC, cette lecture authentifiée
-- en dépend : la supprimer sèchement casserait la page. On REMPLACE par une policy
-- scopée au lieu de retirer. (`authenticated` a bien EXECUTE sur is_super_admin(),
-- contrairement à anon — vérifié via has_function_privilege.)
DROP POLICY IF EXISTS public_read_agent_profiles ON public.agent_profiles;
CREATE POLICY agent_profiles_select_own ON public.agent_profiles
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR is_super_admin());
REVOKE ALL ON TABLE public.agent_profiles FROM anon;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- CONSERVÉ VOLONTAIREMENT — ne pas « corriger » à la prochaine passe
-- ─────────────────────────────────────────────────────────────────────────────
-- · seller_leads.seller_leads_anon_insert — CORRECTEMENT écrite : le WITH CHECK force
--   assigned_agency_id IS NULL, donc pas de ciblage d'agence. Vérifié en live : un
--   INSERT anon visant une agence est refusé (42501). Patron de référence.
-- · article_feedback / article_views — le Help Center est PUBLIC (routes /help placées
--   avant le premier ProtectedRoute) et ArticleFeedback.tsx insère en anon au montage.
--   Fermer casserait la prod. Pas de tenant, pas de lecture sensible.
-- · translation_cache — 2 lignes, aucun contenu client.
-- · Les autres policies roles={public} (super_admin, get_user_agency_id(), auth.uid())
--   sont fermées à anon de fait : ces fonctions renvoient NULL pour anon, et anon n'a
--   même pas EXECUTE sur is_super_admin() (revokes #844/#845).
--
-- DIFFÉRÉ à une PR dédiée (ne PAS ajouter ici) :
-- · market_listings / market_price_history — la lecture anon est morte depuis le pivot,
--   mais tests/backend/smoke.spec.ts:28 asserte `expect(error).toBeNull()` sur un SELECT
--   anon de market_listings, et ces specs tournent LIVE en CI. Un DROP POLICY seul reste
--   vert (RLS ⇒ 200 + []) ; c'est le REVOKE qui donne 42501 et rougit la suite. À faire
--   avec l'adaptation du smoke test dans la MÊME PR.
-- · notify_new_contact_message() — tronquer/neutraliser name et subject avant de les
--   concaténer dans object_label, pour qu'aucun texte non authentifié ne puisse plus
--   atterrir dans un journal immuable 10 ans. Le pont est fermé côté anon par la §1,
--   ceci est la défense en profondeur.
-- · Rotation des claim_token existants (pré-divulgués) : écriture sur 7 909 lignes,
--   à faire par script service_role si l'annuaire est un jour réactivé — et alors
--   exclure la colonne de toute lecture publique.
--
-- DONNÉES : aucune ligne touchée — uniquement des policies et des privilèges.
