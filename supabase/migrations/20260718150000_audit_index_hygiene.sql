-- Audit DB du 18.07.2026 — P1 hygiène d'index.
-- 1) Doublons exacts : chaque paire = contrainte UNIQUE `*_key` (conservée) + copie
--    manuelle `idx_*` identique (supprimée). Vérifié en live : aucun des index
--    supprimés ici n'est porté par une contrainte (pg_constraint.conindid).
-- 2) Préfixes redondants : index mono-colonne couvert par un composite existant
--    dont il est le préfixe strict (même méthode btree, non partiel).
-- 3) FK chaudes : index sur les clés étrangères des tables qui grossiront
--    (jointures + chemins ON DELETE — cf. delete_contact qui SET NULL sur transactions).

-- 1) Doublons exacts ---------------------------------------------------------
drop index if exists public.idx_admin_feature_flags_key;      -- = admin_feature_flags_key_key
drop index if exists public.idx_agency_profiles_slug;         -- = agency_profiles_slug_key
drop index if exists public.idx_agent_profiles_slug;          -- = agent_profiles_slug_key
drop index if exists public.idx_calendar_sync_user_event;     -- = calendar_sync_user_id_google_event_id_key
drop index if exists public.idx_calendar_sync_user_visit;     -- = calendar_sync_user_id_visit_id_key
drop index if exists public.idx_gmail_tokens_user;            -- = gmail_tokens_user_id_key
drop index if exists public.idx_gcal_tokens_user;             -- = google_calendar_tokens_user_id_key
drop index if exists public.idx_kyc_magic_links_token;        -- = kyc_magic_links_token_key
drop index if exists public.idx_outlook_sync_user_event;      -- = outlook_calendar_sync_user_id_outlook_event_id_key
drop index if exists public.idx_outlook_sync_user_visit;      -- = outlook_calendar_sync_user_id_visit_id_key
drop index if exists public.idx_outlook_tokens_user;          -- = outlook_calendar_tokens_user_id_key
drop index if exists public.idx_outlook_mail_tokens_user;     -- = outlook_mail_tokens_user_id_key
drop index if exists public.idx_seller_portals_token;         -- = seller_portals_token_key
drop index if exists public.idx_subscriptions_agency;         -- = subscriptions_agency_id_key

-- 2) Préfixes redondants -----------------------------------------------------
drop index if exists public.idx_contacts_agency_id;             -- ⊂ idx_contacts_agency_created
drop index if exists public.idx_crm_offers_agency;              -- ⊂ idx_crm_offers_agency_created
drop index if exists public.idx_contact_scores_agency;          -- ⊂ idx_contact_scores_agency_overall
drop index if exists public.idx_property_scores_agency;         -- ⊂ idx_property_scores_agency_overall
drop index if exists public.idx_transactions_agency_id;         -- ⊂ idx_tx_agency_stage_updated
drop index if exists public.epc_agency_idx;                     -- ⊂ epc_agency_provider_uniq
drop index if exists public.idx_property_syndications_property; -- ⊂ property_syndications_property_id_portal_key
drop index if exists public.idx_support_tickets_status;         -- ⊂ idx_support_tickets_status_updated_at
drop index if exists public.idx_user_consents_user;             -- ⊂ user_consents_user_id_consent_type_version_key

-- 3) Index sur FK chaudes ----------------------------------------------------
create index if not exists idx_transactions_property on public.transactions (property_id);
create index if not exists idx_transactions_buyer on public.transactions (contact_buyer_id);
create index if not exists idx_transactions_seller on public.transactions (contact_seller_id);
create index if not exists idx_transactions_assigned on public.transactions (assigned_to);
create index if not exists idx_kyc_cases_transaction on public.kyc_cases (transaction_id);
create index if not exists idx_kyc_checklist_items_case on public.kyc_checklist_items (kyc_case_id);
create index if not exists idx_documents_contact on public.documents (contact_id);
create index if not exists idx_documents_signature_request on public.documents (signature_request_id);
create index if not exists idx_matches_client_search on public.matches (client_search_id);
create index if not exists idx_visits_transaction on public.visits (transaction_id);
create index if not exists idx_visits_agent on public.visits (agent_id);
create index if not exists idx_crm_offers_transaction on public.crm_offers (transaction_id);
create index if not exists idx_reminders_property on public.reminders (property_id);
create index if not exists idx_reminders_match on public.reminders (match_id);
create index if not exists idx_activity_events_actor on public.activity_events (actor_id);
create index if not exists idx_kyc_magic_links_contact on public.kyc_magic_links (contact_id);
create index if not exists idx_seller_leads_contact on public.seller_leads (contact_id);
create index if not exists idx_seller_leads_property on public.seller_leads (property_id);
