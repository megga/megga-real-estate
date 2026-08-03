-- subscriptions : l'agent passe en LECTURE SEULE sur l'abonnement de son agence.
--
-- Constat : docs/audits/2026-08-03-rls-isolation-multi-agence.md §6.
--
-- LE DÉFAUT : `agents_own_agency` était `FOR ALL` avec un `USING` mais SANS
-- `WITH CHECK`. Contrairement à l'intuition, cela ne donne pas « lecture seule » :
-- en `FOR ALL` comme en `UPDATE`, PostgreSQL RÉUTILISE le `USING` comme contrôle
-- d'insertion et de mise à jour quand `WITH CHECK` est absent. Tout membre d'une
-- agence pouvait donc créer, modifier et supprimer la ligne d'abonnement de son
-- agence : `plan`, `status`, `mrr_chf`, `stripe_subscription_id`.
--
-- Portée : auto-attribution d'un plan supérieur, et pollution de
-- compute_platform_mrr_estimate(), qui alimente le MRR de la console admin.
--
-- La table compte 0 ligne aujourd'hui — elle se remplira au premier abonnement
-- Stripe. Le correctif est donc gratuit maintenant, et coûteux plus tard.
--
-- POURQUOI LA LECTURE SEULE NE CASSE RIEN — vérifié avant écriture :
-- toutes les écritures viennent de `stripe-webhook`, via `supabaseAdmin`
-- (service_role, hors RLS), plus la RPC `admin_set_agency_plan` (SECURITY DEFINER).
-- Côté navigateur, `useSubscription.ts` ne fait qu'un `select` : ses mutations
-- (`stripe-checkout`, `stripe-portal`) passent par des Edge Functions, jamais par
-- la table. Aucun chemin agent n'écrit ici.
--
-- INSERT / UPDATE / DELETE agents : volontairement SANS policy. La ligne
-- d'abonnement est le miroir local de l'état Stripe ; elle n'a qu'une source de
-- vérité légitime, le webhook. Une écriture agent ne pourrait que la désynchroniser.

DROP POLICY IF EXISTS "agents_own_agency" ON public.subscriptions;

-- Lecture : l'agence voit son propre abonnement (BillingSection du CRM).
-- `get_my_agency_id()` remplace le sous-select inline d'origine : même résultat,
-- mais STABLE + SECURITY DEFINER, cohérent avec le reste du schéma.
-- Le rôle passe de `public` à `authenticated` : `anon` n'a jamais eu de raison
-- d'être évalué ici (auth.uid() nul ⇒ expression nulle ⇒ faux), autant le dire.
DROP POLICY IF EXISTS "subscriptions_agents_select" ON public.subscriptions;
CREATE POLICY "subscriptions_agents_select"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (agency_id = get_my_agency_id());

-- Inchangée et conservée : super_admin_read_all_subscriptions (SELECT, is_super_admin()).
