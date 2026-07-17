-- Durcissement RLS : ferme les écritures publiques (WITH CHECK true) inutilisées
-- + anti mass-assignment sur seller_leads. Advisor: rls_policy_always_true (9 → 2).
--
-- Vérifié avant application : SELECT verrouillé partout (0 fuite de lecture, déjà
-- traité en #844) ; tables 0 ligne (agent_reviews / marketplace_inquiries /
-- ticket_messages / support_tickets), 1 ligne gelée (coming_soon), donc aucun
-- writer actif → drop sans casse. seller_leads = seul formulaire vivant → durci,
-- pas droppé. Appliqué prod via MCP le 12 juil. 2026 (série #844/#845).

-- 1) Formulaires publics morts (0 ligne, 0 writer app, features désactivées)
DROP POLICY IF EXISTS "anyone_insert_reviews"                   ON public.agent_reviews;
DROP POLICY IF EXISTS "public_can_insert_marketplace_inquiries" ON public.marketplace_inquiries;
DROP POLICY IF EXISTS "anon_insert_messages"                    ON public.ticket_messages;
DROP POLICY IF EXISTS "anon_insert_tickets"                     ON public.support_tickets;
DROP POLICY IF EXISTS "anon_insert_email"                       ON public.coming_soon_subscribers;

-- 2) Visites : aucune création anonyme (confirmé) — seul l'agent connecté crée (visits_insert reste)
DROP POLICY IF EXISTS "anon_insert_visit"                       ON public.visits;

-- 3) seller_leads : formulaire d'estimation public CONSERVÉ, mais anti mass-assignment
--    (anon ne peut plus router vers une agence ni lier un contact/bien CRM existant)
DROP POLICY IF EXISTS "seller_leads_anon_insert"                ON public.seller_leads;
CREATE POLICY "seller_leads_anon_insert" ON public.seller_leads
  FOR INSERT TO anon
  WITH CHECK (assigned_agency_id IS NULL AND status = 'new'
              AND contact_id IS NULL AND property_id IS NULL);
