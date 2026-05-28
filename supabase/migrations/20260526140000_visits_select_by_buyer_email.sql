-- Allow authenticated buyers to SELECT their own visits.
--
-- Until now, `visits` was only readable by:
--   - agency members  (visits_select policy → agency_id = get_user_agency_id())
--   - anonymous users via manage_token  (anon_select_visit_by_token)
--
-- Buyers landing on /account/profile are authenticated via Supabase Auth
-- but have no row in `profiles` and therefore no agency. They were locked
-- out of their own visit history → src/components/account/profile/VisitsRow.tsx
-- silently returned [].
--
-- Email match uses lower() on both sides to tolerate inconsistent casing
-- (Mac autocapitalize, copy-paste from different sources). The pattern
-- mirrors `Buyers read their threads` on message_threads — same rationale:
-- a buyer is the resource owner when buyer_email matches their auth email.

DROP POLICY IF EXISTS "visits_select_by_buyer_email" ON public.visits;

CREATE POLICY "visits_select_by_buyer_email"
  ON public.visits
  FOR SELECT
  TO authenticated
  USING (
    buyer_email IS NOT NULL
    AND lower(buyer_email) = lower((auth.jwt() ->> 'email')::text)
  );

-- Functional index on lower(buyer_email) so the policy predicate doesn't
-- force a sequential scan whenever a buyer hits their visits list.
CREATE INDEX IF NOT EXISTS idx_visits_buyer_email_lower
  ON public.visits (lower(buyer_email))
  WHERE buyer_email IS NOT NULL;
