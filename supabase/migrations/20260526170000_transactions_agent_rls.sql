-- CRITICAL FIX — transactions table had ONLY a super_admin SELECT policy.
-- Regular agents could not SELECT, INSERT, UPDATE, or DELETE their own
-- agency's transactions, which means the entire CRM pipeline + deal
-- creation flow was effectively broken in production for non-super-admins.
--
-- Discovered while wiring the silent-no-op fix on NewDealDrawer
-- (PR #434 — pipeline "Créer le deal" button). The button was about to
-- start firing real inserts which would all 42501 with insufficient
-- privilege.
--
-- Adds the standard agency-scoped policy set, mirroring `contacts`,
-- `properties`, `kyc_cases`, etc.

DROP POLICY IF EXISTS "transactions_select" ON public.transactions;
DROP POLICY IF EXISTS "transactions_insert" ON public.transactions;
DROP POLICY IF EXISTS "transactions_update" ON public.transactions;
DROP POLICY IF EXISTS "transactions_delete" ON public.transactions;

CREATE POLICY "transactions_select"
  ON public.transactions
  FOR SELECT
  TO authenticated
  USING (agency_id = public.get_user_agency_id());

CREATE POLICY "transactions_insert"
  ON public.transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (agency_id = public.get_user_agency_id());

CREATE POLICY "transactions_update"
  ON public.transactions
  FOR UPDATE
  TO authenticated
  USING (agency_id = public.get_user_agency_id())
  WITH CHECK (agency_id = public.get_user_agency_id());

CREATE POLICY "transactions_delete"
  ON public.transactions
  FOR DELETE
  TO authenticated
  USING (agency_id = public.get_user_agency_id());

-- Index to keep the policy predicate fast at scale (each query gets an
-- implicit `WHERE agency_id = …`).
CREATE INDEX IF NOT EXISTS idx_transactions_agency_id
  ON public.transactions (agency_id);
