-- =====================================================================
-- SÉCURITÉ — crm_offers : UPDATE sans WITH CHECK (intégrité multi-tenant)
--
-- Trou (vérifié en prod via pg_policy) :
--   "crm_offers agents update" : FOR UPDATE,
--     USING (agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid()))
--     WITH CHECK = NULL
--   → un agent peut modifier une offre de SON agence (USING passe) et, faute de
--     WITH CHECK, réécrire son agency_id vers une AUTRE agence — exfiltration
--     sortante de l'offre (contre-offre, montant, conditions) hors de l'agence.
--   La table transactions a déjà le bon patron (USING + WITH CHECK identiques) ;
--   crm_offers en était l'exception.
--
-- Fix : recréer la policy UPDATE avec un WITH CHECK identique au USING — la ligne
-- APRÈS mise à jour doit toujours appartenir à l'agence de l'agent. Le agency_id
-- devient ainsi non-déplaçable par un rôle bas-privilège.
--
-- Pas de régression : les écritures applicatives (accept/reject/counter via
-- useOffers) ne touchent pas agency_id → WITH CHECK satisfait ; les edge
-- functions écrivent en service_role (bypass RLS) ; anon n'a jamais matché le
-- USING (auth.uid() NULL → sous-requête vide). Couvert par
-- tests/backend/rls-isolation-crm-offers.spec.ts.
-- =====================================================================

DROP POLICY IF EXISTS "crm_offers agents update" ON public.crm_offers;
CREATE POLICY "crm_offers agents update" ON public.crm_offers
  FOR UPDATE
  USING (
    agency_id IN (SELECT p.agency_id FROM public.profiles p WHERE p.id = auth.uid())
  )
  WITH CHECK (
    agency_id IN (SELECT p.agency_id FROM public.profiles p WHERE p.id = auth.uid())
  );
