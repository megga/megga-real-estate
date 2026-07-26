## 6. BASE DE DONNÉES (SCHÉMA SIMPLIFIÉ MVP)

### Tables principales

```sql
-- Agences
agencies (
  id, name, slug, logo_url, address, postal_code, city, canton, country,
  phone, email, website, plan, created_at,
  -- Identité légale
  legal_name,                    -- raison sociale : doit matcher le registre au caractère près
  trade_name,                    -- nom commercial ; cible du rapprochement flou avec le domaine e-mail
  legal_form_id,                 -- FK legal_forms (ex-legal_form texte libre)
  legal_form,                    -- HÉRITÉ : saisie non appariée au référentiel, vidée dès que la FK est posée
  business_registration_number,  -- ex-`ide` : IDE/UID en CH, SIREN en FR, générique multi-pays
  tva, founded_year, about_short,
  -- Vérification d'identité (KYB)
  verification_status,           -- 'pending' | 'auto_validated' | 'manual_review' | 'rejected'
  verification_score,            -- numeric(4,3) 0..1 — cache calculé depuis agency_verification_checks
  verified_at
)

-- Utilisateurs (agents + admins)
profiles (id, agency_id, email, full_name, avatar_url, role, phone, created_at)
  -- roles: 'admin' | 'manager' | 'agent' | 'assistant'

-- ─── Vérification d'identité des agences (KYB) ──────────────────────────────
-- Détail et raisonnement : docs/agency-kyb-verification.md
-- KYB (la personne morale existe-t-elle au registre) ≠ KYC (quel humain peut
-- l'engager). Les comptes agents relèvent de la confiance déléguée : le dirigeant
-- vérifié répond de ses employés, pas de KYB complet par agent.

-- Référentiel des formes juridiques (CH/FR/LI). `category` pilote le parcours :
-- sole_proprietorship = pas d'UBO tiers ; foundation_or_trust = diligence renforcée.
legal_forms (id, code, country, category, label_fr, label_de, label_en, label_it, sort_order)
  -- category: 'corporation' | 'partnership' | 'sole_proprietorship' | 'foundation_or_trust'
legal_form_aliases (id, legal_form_id, alias)
  -- alias STOCKÉ NORMALISÉ (normalize_legal_form_text) : les registres renvoient la
  -- forme dans la langue d'inscription (Zefix → « Aktiengesellschaft » pour une SA)

-- Identité de CONFORMITÉ, distincte de profiles : un ayant droit économique passif
-- n'a aucune raison d'avoir un compte CRM (d'où profile_id nullable).
agency_related_persons (
  id, agency_id, profile_id, first_name, last_name, date_of_birth, nationality,
  id_document_type, id_document_number, created_at, updated_at
)
-- Rôles séparés de la personne : dans une petite SA le fondateur est souvent
-- signataire ET actionnaire majoritaire — les fusionner dupliquerait son identité.
agency_person_roles (
  id, related_person_id, role, signature_power, ownership_pct,
  pep_self_declared, source, valid_from, valid_to, created_at
)
  -- role: 'signatory' | 'ubo'  (seuil de déclaration UBO = 25 %, norme FATF)
  -- signature_power: 'individual' | 'joint' (rôle signatory uniquement)
  -- source: 'registry_officer_listing' | 'declared' | 'poa_document'

-- Catalogue + pondération VERSIONNÉE + journal des exécutions. Le poids n'est PAS
-- porté par la ligne de check (il dépend du type, pas de l'occurrence → 3NF) :
-- l'audit rejoint la config en vigueur à checked_at, donc retoucher une pondération
-- ne rend jamais un score passé inexplicable.
verification_check_types (code, scope, label_fr, created_at)
  -- scope: 'agency' | 'person'
verification_check_config (id, check_type, weight, is_veto, valid_from, valid_to)
  -- is_veto = échec bloquant HORS score, jamais compensé par un bon score ailleurs
agency_verification_checks (id, agency_id, check_type, source, result, raw_response, checked_at)
agency_person_verification_checks (id, related_person_id, check_type, source, result, raw_response, checked_at)
  -- result: 'match' | 'partial' | 'mismatch' | 'unavailable' | 'pending_manual_review'
  -- 'unavailable' est EXCLU du dénominateur du score : un pays sans VIES n'est pas
  --   pénalisé, il est seulement moins confirmé (c'est ce qui rend le modèle transposable)
  -- raw_response jsonb = pièce d'audit LBA, PAS une source pour la logique applicative

-- Contacts (acheteurs + vendeurs + investisseurs + locataires + bailleurs)
contacts (
  id, agency_id,
  -- Identité
  first_name, last_name, email, phone, whatsapp_phone, language, nationality,
  -- Classification
  type,          -- 'buyer' | 'seller' | 'investor' | 'tenant' | 'landlord' | 'both' | 'lead'
  source,        -- 'website' | 'referral' | 'portal' | 'walk_in' | 'social' | 'cold_call' | 'other'
  score,         -- 'hot' | 'warm' | 'cold'
  -- Budget
  budget_announced, budget_estimated_ai,
  -- Recherche
  search_zones,  -- text[] (cantons ou quartiers)
  search_criteria, -- jsonb (type, pièces min/max, surface min/max, features...)
  -- Scoring IA (buyer/seller intelligence)
  ai_seriousness_score,    -- 0-100, estimé par IA
  ai_purchase_probability, -- 0-100
  ai_timing,               -- 'immediate' | '1-3_months' | '3-6_months' | '6-12_months' | 'long_term'
  ai_engagement_level,     -- 'very_high' | 'high' | 'medium' | 'low' | 'dormant'
  -- Seller-specific
  ai_tension_level,        -- 'calm' | 'moderate' | 'tense' | 'critical' (vendeurs)
  ai_price_reduction_probability, -- 0-100 (vendeurs)
  -- Meta
  tags, notes, avatar_url,
  last_interaction_at,     -- Date de la dernière interaction (calculé)
  created_at, updated_at
)

-- Biens immobiliers
properties (
  id, agency_id,
  title, description, type, status, price, currency,
  rooms, bedrooms, bathrooms, surface_m2,
  floor, has_outdoor, has_parking, charges_monthly, year_built, condition,
  address, city, canton, postal_code, lat, lng,
  photos, features,
  -- Analyse marché IA
  ai_price_per_m2, ai_comparable_properties, ai_stagnation_risk, ai_suggested_price,
  -- Meta
  availability_date, created_by, created_at, published_at, updated_at
)
  -- type: 'apartment' | 'house' | 'villa' | 'commercial' | 'land'
  -- status: 'draft' | 'active' | 'reserved' | 'sold' | 'off_market' | 'archived'
  -- condition: 'new' | 'renovated' | 'good' | 'to_renovate'

-- Listings (annonces publiées)
listings (id, property_id, agency_id, title, description_ai, price_display, is_featured, is_hot, views_count, favorites_count, published_at, expires_at)

-- Recherches clients (sauvegardes)
client_searches (
  id, agency_id, contact_id,
  label,            -- "Recherche 4p Eaux-Vives"
  criteria,         -- jsonb : type, budget_min, budget_max, rooms_min, rooms_max, surface_min, zones[], features[]
  is_active,        -- true = surveillance continue activée
  last_matched_at,  -- Dernière fois que le matching a trouvé des résultats
  created_at, updated_at
)

-- Matching acheteurs ↔ biens
matches (
  id, agency_id,
  contact_id, property_id, client_search_id,
  score,            -- 0-100 score de compatibilité
  reasons,          -- jsonb : { budget: true, zone: true, rooms: true, surface: false, features: ['parking'] }
  status,           -- 'suggested' | 'sent' | 'visit_planned' | 'interested' | 'rejected' | 'ignored'
  sent_via,         -- 'email' | 'whatsapp' | 'both' | null
  sent_at, response_at,
  created_at
)

-- Transactions / Deals (pipeline enrichi)
transactions (
  id, agency_id, property_id, contact_buyer_id, contact_seller_id, assigned_to,
  stage, status,
  price_offered, price_final, mandate_type,
  notes, archived_at, created_at, updated_at
)
  -- stage (pipeline enrichi Gregory) :
  --   'new_lead' | 'to_qualify' | 'active_search' | 'visit_planned' | 'visit_done' |
  --   'interest_confirmed' | 'offer' | 'negotiation' | 'reserved' |
  --   'financing' | 'notary' | 'signed' | 'closed' | 'lost' | 'to_recontact'
  -- status: 'active' | 'on_hold' | 'cancelled' | 'completed'
  --   (Pipeline v2 : « gagné » = completed — le deal sort du board actif)
  -- archived_at (Pipeline v2, migration 20260721150100) : deal rangé hors board
  --   (action « Archiver », undo = NULL). NULL = visible au pipeline.

-- Relances et reminders automatiques
reminders (
  id, agency_id,
  contact_id, property_id, transaction_id, match_id,
  type,             -- 'follow_up_sent_property' | 'post_visit_feedback' | 'dormant_lead' | 'missing_document' | 'price_change' | 'custom' | 'deal_stagnant' | 'match_ignored'
  kind,             -- Pipeline v2 (migration 20260721150000) : nature UI de la prochaine action
                    --   'call' | 'visit' | 'kyc' | 'match' | 'offer' | 'note' (NULL = dérivée de type côté front)
  trigger_rule,     -- 'days_after_event' | 'no_response' | 'inactivity' | 'manual'
  trigger_days,     -- Nombre de jours avant déclenchement
  status,           -- 'pending' | 'triggered' | 'done' | 'cancelled' | 'snoozed'
  trigger_at,       -- Date prévue de déclenchement
  completed_at,
  message_template, -- Template du message de relance (optionnel)
  channel,          -- 'email' | 'whatsapp' | 'task' | 'notification'
  created_at
)

-- Règles d'automatisation (configurées par l'agent)
automation_rules (
  id, agency_id,
  name,             -- "Relance J+3 après envoi bien"
  trigger_event,    -- 'property_sent' | 'visit_completed' | 'lead_inactive' | 'document_missing' | 'new_match'
  action,           -- 'create_reminder' | 'send_email' | 'send_whatsapp' | 'create_task' | 'notify_agent'
  delay_days,       -- Délai avant exécution
  template_id,      -- Référence au template de message
  is_active,
  created_at
)

-- Templates de messages (relances, confirmations, etc.)
message_templates (
  id, agency_id,
  name,             -- "Relance acheteur après envoi"
  category,         -- 'follow_up' | 'visit_confirmation' | 'property_presentation' | 'post_visit' | 'objection_response' | 'offer_follow_up' | 'thank_you' | 'seller_update'
  channel,          -- 'email' | 'whatsapp' | 'both'
  subject,          -- Sujet email (si applicable)
  body,             -- Corps du message avec variables {{contact.first_name}}, {{property.address}}, etc.
  is_ai_generated,  -- true si généré par IA
  created_at
)

-- Visites
visits (
  id, agency_id,
  property_id, contact_id, transaction_id,
  scheduled_at, completed_at,
  status,           -- 'planned' | 'confirmed' | 'done' | 'cancelled' | 'no_show'
  feedback_buyer,   -- Feedback acheteur (texte libre ou structuré)
  feedback_agent,   -- Notes agent post-visite
  ai_objections,    -- jsonb : objections détectées par IA dans le feedback
  rating,           -- 1-5 étoile (optionnel)
  created_at
)

-- Dossiers KYC
kyc_cases (id, agency_id, transaction_id, contact_id, type, risk_level, status, completion_pct, validated_by, validated_at, created_at)
  -- type: 'buyer_pp' | 'buyer_pm' | 'seller_pp' | 'seller_pm'
  -- risk_level: 'low' | 'medium' | 'high' | 'unassessed'
  -- status: 'pending' | 'in_progress' | 'review' | 'validated' | 'rejected'

-- Checklist items KYC
kyc_checklist_items (id, kyc_case_id, label, category, is_required, is_completed, document_id, notes, completed_at, completed_by)

-- Documents
documents (id, agency_id, kyc_case_id, transaction_id, contact_id, property_id, name, type, storage_path, size_bytes, uploaded_by, status, created_at)
  -- status: 'pending' | 'validated' | 'rejected'
  -- type: 'mandate' | 'visit_voucher' | 'property_sheet' | 'offer' | 'kyc' | 'contract' | 'other'

-- Messages (email + WhatsApp unifiés)
messages (id, thread_id, sender_id, sender_type, channel, content, read_at, created_at)
  -- channel: 'internal' | 'email' | 'whatsapp'
message_threads (id, agency_id, property_id, contact_id, channel, participants, last_message_at)

-- Favoris
favorites (id, user_id, listing_id, created_at)

-- Audit trail
activity_events (id, agency_id, actor_id, action, entity_type, entity_id, metadata, created_at)

-- Embeddings pour recherche IA
listing_embeddings (id, listing_id, embedding vector(1536), content_text, updated_at)

-- Actions du jour (générées par IA, rafraîchies quotidiennement)
daily_actions (
  id, agency_id, agent_id,
  priority,         -- 'urgent' | 'high' | 'medium' | 'low'
  category,         -- 'follow_up' | 'match_found' | 'visit_confirm' | 'document_missing' | 'deal_at_risk' | 'suggestion'
  title, description,
  entity_type, entity_id, -- Lien vers le contact/deal/bien concerné
  action_type,      -- 'call' | 'email' | 'whatsapp' | 'send_property' | 'plan_visit' | 'review_document' | 'adjust_price'
  is_completed,
  generated_at, completed_at
)
```

### Row Level Security (RLS)

```
CRITIQUE : Chaque table DOIT avoir des policies RLS activées.
- Les agents ne voient que les données de leur agence (agency_id = auth.jwt() -> agency_id)
- Les vendeurs (portail) ne voient que leurs propres transactions
- Les acheteurs (public) ne voient que les listings publiés (status = 'active')
- Les relances et matchs sont filtrés par agency_id

Helpers canoniques (SECURITY DEFINER) : get_my_agency_id(), is_super_admin(),
is_agency_admin() [admin|manager].

EXCEPTION — tables KYB : le filtrage par agence NE SUFFIT PAS. Elles portent la PII
des dirigeants et actionnaires (date de naissance, n° de pièce d'identité), donc
lecture ET écriture restreintes à is_agency_admin() + is_super_admin() : un agent
simple n'a aucune raison de lire l'identité de l'actionnaire de son agence.
- agency_related_persons / agency_person_roles : dirigeants de l'agence + super-admin
- agency_verification_checks / agency_person_verification_checks : LECTURE seule côté
  client (suivi de dossier) ; aucune policy d'écriture → seul le service_role écrit,
  depuis l'edge function de vérification. Un client ne doit jamais pouvoir se
  déclarer « match ».
- verification_check_config : AUCUN accès client, même en lecture — exposer les poids
  inviterait à optimiser sa saisie pour franchir le seuil d'auto-validation.
- legal_forms / legal_form_aliases / verification_check_types : `using (true)` assumé
  (données de référence, aucune PII) ; écriture sans policy → migrations seulement.
```

---
