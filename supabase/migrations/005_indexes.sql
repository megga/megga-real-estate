-- ============================================================
-- MEGGA Real Estate — Indexes
-- Migration 005: Performance indexes for common queries
-- ============================================================

-- ─── Multi-tenant indexes (agency_id) ──────────────────────
CREATE INDEX idx_profiles_agency ON profiles(agency_id);
CREATE INDEX idx_contacts_agency ON contacts(agency_id);
CREATE INDEX idx_properties_agency ON properties(agency_id);
CREATE INDEX idx_listings_agency ON listings(agency_id);
CREATE INDEX idx_transactions_agency ON transactions(agency_id);
CREATE INDEX idx_kyc_cases_agency ON kyc_cases(agency_id);
CREATE INDEX idx_documents_agency ON documents(agency_id);
CREATE INDEX idx_activity_events_agency ON activity_events(agency_id);

-- ─── Status/type filters ───────────────────────────────────
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_properties_type ON properties(type);
CREATE INDEX idx_properties_city ON properties(city);
CREATE INDEX idx_properties_canton ON properties(canton);
CREATE INDEX idx_properties_price ON properties(price);
CREATE INDEX idx_listings_published ON listings(published_at) WHERE published_at IS NOT NULL;
CREATE INDEX idx_transactions_stage ON transactions(stage);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_kyc_cases_status ON kyc_cases(status);
CREATE INDEX idx_contacts_type ON contacts(type);
CREATE INDEX idx_contacts_score ON contacts(score);

-- ─── Tags (GIN for array search) ───────────────────────────
CREATE INDEX idx_contacts_tags ON contacts USING GIN(tags);

-- ─── Foreign key lookups ───────────────────────────────────
CREATE INDEX idx_listings_property ON listings(property_id);
CREATE INDEX idx_transactions_property ON transactions(property_id);
CREATE INDEX idx_transactions_buyer ON transactions(contact_buyer_id);
CREATE INDEX idx_transactions_seller ON transactions(contact_seller_id);
CREATE INDEX idx_transactions_assigned ON transactions(assigned_to);
CREATE INDEX idx_kyc_cases_transaction ON kyc_cases(transaction_id);
CREATE INDEX idx_kyc_cases_contact ON kyc_cases(contact_id);
CREATE INDEX idx_kyc_items_case ON kyc_checklist_items(kyc_case_id);
CREATE INDEX idx_documents_kyc ON documents(kyc_case_id);
CREATE INDEX idx_documents_transaction ON documents(transaction_id);
CREATE INDEX idx_messages_thread ON messages(thread_id);
CREATE INDEX idx_favorites_user ON favorites(user_id);
CREATE INDEX idx_favorites_listing ON favorites(listing_id);

-- ─── Timeline/sorting ──────────────────────────────────────
CREATE INDEX idx_activity_events_created ON activity_events(created_at DESC);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_properties_created ON properties(created_at DESC);
CREATE INDEX idx_contacts_created ON contacts(created_at DESC);
