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

-- ─── Messagerie CRM (boîte mail intégrée) ───────────────────────────────────
-- ⚠ ÉTAT AU 04.09.2026 : livré sur la branche claude/crm-messaging-lot1-backend-79297b
-- (PR #1274, OUVERTE), donc PAS EN PRODUCTION. Vérifié le 04.09.2026 par requête
-- directe sur eayczugyrvmtqnnmvjod : 0 table mail_%, 0 fonction mail_%, 0 job cron
-- mail%. Ce bloc décrit les MIGRATIONS, pas encore la base.
-- Source : 20260904074500_mail_module.sql (socle) + 20260904074600_mail_sync_failures.sql
-- Décisions D1-D16 : docs/superpowers/plans/2026-09-03-messagerie-crm.md
--
-- ⛔ AUCUN JETON EN COLONNE. Les identifiants OAuth/IMAP vivent dans Supabase
-- Vault ; mail_accounts.vault_secret_id n'est qu'un pointeur, et seuls les ponts
-- mail_secret_store / _read / _update / _delete (SECURITY DEFINER, search_path
-- vide, exécution révoquée sauf service_role) savent le déréférencer.

-- Boîtes connectées. Une ligne = un compte fournisseur d'un agent.
mail_accounts (
  id, agency_id, owner_id,
  provider,          -- 'gmail' | 'outlook' | 'imap'
  email, display_name,
  visibility,        -- 'owner' (défaut) | 'agency' — qui voit la boîte DANS l'agence
  status,            -- 'active' | 'reauth_required' | 'error' | 'disabled'
  vault_secret_id,   -- pointeur Vault ; jamais le secret lui-même
  sync_cursor,       -- jsonb : historyId Gmail / deltaLink Graph
  next_sync_at, last_sync_at, last_error,
  sync_failures,     -- échecs consécutifs (20260904074600) ; remis à 0 par une passe
                     --   réussie, au 5e _shared/mail/sync.ts bascule status='error'
  imap_config,       -- jsonb : hôte, port, utilisateur — JAMAIS le mot de passe
  created_at, updated_at
)
  -- unique (agency_id, provider, lower(email)) : reconnecter une boîte partagée
  --   ne la vole pas à son propriétaire
  -- index partiel (next_sync_at) WHERE status = 'active' : file du balayage cron

-- États OAuth code+PKCE, côté serveur (D1). Le flux ne passe PAS par GoTrue.
mail_oauth_states (
  state,             -- clé primaire (opaque, à usage unique)
  user_id, agency_id, provider, code_verifier, login_hint, visibility, redirect_uri,
  created_at,
  expires_at,        -- défaut now() + 10 minutes
  consumed_at
)
  -- purgés par la commande du cron (expires_at < now() - 1 jour) : un parcours
  --   abandonné n'est jamais estampillé, la table croîtrait sans fin

-- Libellés, par agence (D12) — pas par boîte : un fil se range pareil pour tous.
mail_labels (id, agency_id, name, color, position, is_default, created_at, updated_at)
  -- color : CHECK ^#[0-9a-fA-F]{6}$ | name : CHECK 1..40 caractères après trim
  -- unique (agency_id, lower(name))

-- Fils. Portent l'état d'affichage ET les agrégats de liste (pas de vue calculée).
mail_threads (
  id, account_id, agency_id,
  provider_thread_id,
  subject, snippet,
  participants,      -- jsonb [{name,email}] hors adresse de la boîte
  from_name, from_email,
  last_message_at, last_inbound_at, last_outbound_at,
  message_count, has_attachments,
  is_read, is_starred, is_archived, is_trashed,
  label_id,          -- FK mail_labels ON DELETE SET NULL
  contact_id,        -- FK contacts ON DELETE SET NULL — rattachement D11
  search_text,       -- GENERATED ALWAYS … STORED : lower(from_name+from_email+subject+snippet)
  created_at, updated_at
)
  -- unique (account_id, provider_thread_id)
  -- ⚠ IL N'Y A PAS DE COLONNE « dossier » : les dossiers SONT des requêtes (D8),
  --   dérivées de is_archived / is_starred / is_trashed / last_inbound_at /
  --   last_outbound_at par mail_list_threads(p_folder in 'in'|'arch'|'star'|'sent')
  -- REPLICA IDENTITY FULL + table publiée dans supabase_realtime : sans elle
  --   l'ancienne ligne d'un DELETE ne porte que la PK, donc pas d'agency_id, et
  --   le filtre serveur du lot 2 jetterait l'événement

-- Messages. Corps stockés tels quels ; le HTML est assaini à l'affichage.
mail_messages (
  id, thread_id, account_id, agency_id,
  provider_message_id, rfc822_message_id, in_reply_to,
  direction,         -- 'inbound' | 'outbound'
  from_name, from_email, "to", cc, bcc, reply_to,   -- "to"/cc/bcc : jsonb [{name,email}]
  subject, snippet,
  body_text, body_html, body_truncated,             -- HTML plafonné à 512 Kio
  sent_at, is_read, has_attachments,
  provider_labels,   -- text[] : libellés du fournisseur, distincts de mail_labels
  contact_id, created_at
)
  -- unique (account_id, provider_message_id) : l'idempotence de l'ingestion
  -- index (thread_id, sent_at) et (account_id, rfc822_message_id) partiel
  -- pas d'updated_at, pas de policy d'écriture : seule l'ingestion service-role écrit

-- Pièces jointes : MÉTADONNÉES SEULEMENT (D9). Les octets restent chez le
-- fournisseur et transitent par l'edge mail-attachment ; document_id n'est posé
-- que si l'agent enregistre la pièce dans le CRM.
mail_attachments (
  id, message_id, account_id, agency_id,
  provider_attachment_id, filename, mime_type, size_bytes,
  is_inline, content_id,
  document_id,       -- FK documents ON DELETE SET NULL
  created_at
)

-- Brouillons LOCAUX (D7) : jamais poussés chez le fournisseur.
mail_drafts (
  id, account_id, agency_id, author_id,
  kind,              -- 'new' | 'reply' | 'forward'
  thread_id, in_reply_to_message_id,
  "to", cc, subject, body_text,
  attachments,       -- jsonb [{name,size,storage_path}] : pièces déjà déposées
  created_at, updated_at
)

-- Alias appris (D11) : « cette adresse est ce contact », mémorisé une fois.
mail_contact_aliases (id, agency_id, email, contact_id, learned_by, created_at)
  -- CHECK email = lower(email) : l'index unique reste simple, donc ciblable par
  --   un upsert PostgREST (onConflict ne sait pas viser un index d'expression)
  -- unique (agency_id, email)

-- Verrou du balayage (patron whatsapp_cron_locks). Semé avec la ligne 'mail-sync'.
mail_cron_locks (job, locked_until)
  -- cron 'mail-sync-2min' (*/2 * * * *) → edge mail-sync

-- RPC de lecture (SECURITY INVOKER : la RLS filtre, les totaux sont calculés sur
-- ce que l'appelant a le droit de voir) : mail_list_threads, mail_unread_counts,
-- mail_folder_counts, mail_search_contacts.
-- mail_match_contact_by_emails(agency_id, emails[]) est la seule SECURITY DEFINER
-- de lecture : appelée par l'ingestion service-role, qui n'a pas d'auth.uid() —
-- l'agence vient du compte, jamais du réseau.

-- Audit trail
activity_events (id, agency_id, actor_id, action, entity_type, entity_id, metadata, created_at)
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

EXCEPTION — tables mail_* (messagerie CRM ; PAS EN PRODUCTION au 04.09.2026, cf. le
groupe correspondant ci-dessus) : le filtrage par agence ne suffit pas non plus, mais
pour la raison INVERSE du KYB — une boîte peut être privée à l'intérieur de son agence.
Tout passe par mail_account_visible(account_id), SECURITY DEFINER pour que les policies
des tables filles lisent mail_accounts sans dépendre de la policy de mail_accounts (pas
de récursion) :
    agency_id = get_my_agency_id() ET (visibility = 'agency' OU owner_id = auth.uid())
⛔ LE « ET » N'EST PAS UN DOUBLON de visibility — ne pas le retirer. visibility dit qui
  voit la boîte DANS l'agence, jamais de quelle agence est le LECTEUR. Sans lui, la
  branche owner_id survit au départ : team_remove_member ne fait qu'un `update profiles
  set agency_id = null, role = 'buyer'` (20260627120000:286), donc la ligne profiles
  SURVIT, `owner_id … on delete cascade` ne se déclenche jamais, et un ex-membre passé
  chez un concurrent continuerait de lire les fils, les corps et les pièces de son
  ancienne agence — y compris ce que le balayage ingère APRÈS son départ.
- mail_accounts : SELECT accordé COLONNE PAR COLONNE, jamais sur la table — un SELECT de
  table exposerait vault_secret_id, sync_cursor et imap_config. Aucune écriture client :
  connexion, synchronisation et gestes passent par les edge functions (service_role).
- mail_threads / mail_messages / mail_attachments : SELECT seul via mail_account_visible.
  Unique écriture client : UPDATE (label_id) sur mail_threads — et son WITH CHECK
  revalide que le libellé est de l'agence, la clé étrangère vers mail_labels étant
  aveugle à l'agence (sinon un PATCH sur son propre fil y collerait le libellé d'une
  autre agence, qui gouvernerait dès lors le champ).
- mail_labels / mail_drafts / mail_contact_aliases : CRUD client. mail_drafts est
  restreinte à son auteur (author_id = auth.uid()) ; mail_contact_aliases vérifie EN PLUS
  que le contact visé est de l'agence — sans quoi l'ingestion (service-role, donc hors
  RLS) recopierait un contact étranger sur mail_threads.contact_id, et le fil se lirait
  « rattaché » tout en restant vide.
- mail_oauth_states / mail_cron_locks : RLS activée, AUCUNE policy → service_role seul.
- Les privilèges par défaut du projet accordent trop à anon : le socle fait un
  REVOKE ALL … FROM anon, authenticated sur les neuf tables AVANT d'accorder le strict.
```

---
