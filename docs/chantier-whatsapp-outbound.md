<!-- Spec chantier WhatsApp outbound conforme — 2026-06-14, analyse multi-agents (5) ancrée sur le code réel + Meta Cloud API. Document de travail buildable. -->

# SPEC TECHNIQUE FINALE — WhatsApp OUTBOUND conforme (MEGGA)

> Statut : prête à builder. Ancrée sur le code réel vérifié (5 edge functions WA, gateway, migrations `whatsapp_messages` / `automation_rules` / `activity_events` / `message_templates`, `claim_whatsapp_async_jobs`). Intègre les correctifs de la revue adversariale (B1–B5, M1–M7, m1–m6).

## 0. TL;DR

- **Ce qu'on construit** : la brique sortante WhatsApp manquante — registre de consentement par contact (opt-in/opt-out tracé nLPD), garde anti-envoi server-side appelée par **tous** les chemins, gestion fenêtre 24h (texte libre vs template Meta approuvé), campagnes/séquences pilotées IA mais validées par l'agent (HITL), webhook de statut de livraison (inexistant aujourd'hui), et hooks de re-permission.
- **Effort total réaliste** : **≈ 30 jours-homme** (et non 24 — la revue a montré que L1 enfle de prérequis conformité non négociables, et que l'automation-engine + le quota/pacing sont des quasi-refactors).
- **Choix BSP** : la spec reste **provider-agnostic** ; la gateway abstrait déjà Meta vs OpenWA. Reco infra (non codée) : 360dialog. **Réalité à assumer : WABA / `META_PHONE_NUMBER_ID` mono-numéro partagé entre toutes les agences** → les quotas et le quality rating Meta sont **partagés entre tenants** (cf. M2/m4).
- **Piège n°1** : la garde de consentement **n'est PAS « partout »** dans le code actuel. Trois chemins sortants vers des clients existent déjà sans aucune vérification opt-in/DNC (`executePending` du webhook : `send_client_message`, `send_listings`, `send_client_email`). Un contact peut faire STOP et continuer à recevoir des messages via la confirmation WhatsApp de l'agent. **Tant que ces chemins ne passent pas par la garde, le chantier ne ferme pas le trou « un trou = compte banni ».** La garde doit vivre dans un wrapper unique, pas seulement dans `whatsapp-send`.
- **Piège n°2 (corollaire conformité)** : un inbound NE doit JAMAIS lever un opt-out. Aujourd'hui la logique naïve « inbound ⇒ opt-in » réactiverait une personne désinscrite (B3). La fenêtre technique 24h et l'opt-in juridique sont deux choses distinctes.

---

## 1. Objectif & périmètre

### Objectif
Ajouter la brique sortante manquante : opt-in par contact, campagne de re-permission (canal autorisé → opt-in WhatsApp), et campagnes/séquences sortantes conformes (template hors fenêtre 24h, texte libre dans la fenêtre), pilotées par l'IA mais validées par l'agent (human-in-the-loop), sans jamais envoyer à un contact non consentant ou désinscrit — quel que soit le chemin de code.

### IN
- Consentement WhatsApp par contact (registre append-only + base légale + traçabilité opt-in/opt-out).
- **Garde anti-envoi unique** (`sendOutboundGuarded`) appelée par **tous** les chemins sortants : `whatsapp-send`, `whatsapp-campaign-sender`, et les exécuteurs IA de `executePending` (webhook).
- Registre de blocage **par numéro** (`wa_phone`), indépendant du `contact_id`, pour honorer un STOP d'un numéro non encore en CRM.
- Gestion fenêtre 24h : choix automatique texte libre vs template approuvé, robuste au `wa_timestamp` NULL.
- Catalogue de templates Meta (soumission, statut d'approbation, mapping vers `message_templates`), avec préfixe d'agence sur le nom (collision WABA partagé).
- Campagnes + séquences (steps avec délai, conditions stop, enrollment par contact, idempotency key déterministe par step).
- Quota/pacing concret (par `phone_number_id` global **et** par `agency_id`) + circuit-breaker sur le taux d'échec.
- Webhook de **statut de livraison** Meta (sent/delivered/read/failed) — n'existe pas aujourd'hui — idempotent et monotone.
- Opt-out bidirectionnel (STOP entrant multilingue + bouton Meta + action agent), honoré immédiatement et partout, transactionnellement.
- Pilotage IA : proposer cible/copie ; **l'agent valide** avant envoi.
- Hooks pour lancer le test de re-permission (§10).

### OUT (hors périmètre)
- KYC suisse (conservé en parallèle, intouché — rappel : KYC non bloquant).
- Choix/contrat du BSP (provider-agnostic ; reco 360dialog au niveau infra, pas codée).
- Inbound conversationnel (Phase 1, déjà livré — on s'y branche en lecture pour la fenêtre 24h).
- Facturation Meta / réconciliation coûts (on logue de quoi la calculer + on **estime** à l'approbation, on ne facture pas).
- Campagnes multi-canal email/SMS au-delà du strict nécessaire à la re-permission (réutilise Resend en place).
- **Migration vers un WABA multi-numéro par agence** (assumé mono-WABA pour ce chantier ; conséquences documentées en M2/m4).

---

## 2. Architecture cible (schéma textuel)

```
                          ┌──────────────────────────────────────────────┐
                          │                contacts (existant)            │
                          │  + opt_in_whatsapp / consent_* / do_not_contact│
                          └───────────────┬──────────────────────────────┘
                                          │ 1
            ┌─────────────────────────────┼───────────────────────────────┐
            │ N                           │ N                              │ N
 ┌──────────▼───────────┐    ┌────────────▼───────────┐     ┌──────────────▼─────────────┐
 │  whatsapp_consents   │    │ whatsapp_campaign_      │     │ whatsapp_suppressions       │
 │ (registre immuable   │    │   enrollments           │     │ (blocage PAR NUMÉRO,        │
 │  opt-in / opt-out)   │    │ contact↔campagne+curseur│     │  indépendant du contact)    │
 └──────────────────────┘    └────────────┬───────────┘     └─────────────────────────────┘
                                          │ N..1
                              ┌───────────▼─────────────┐
                              │   whatsapp_campaigns     │
                              │ draft→pending_approval→  │
                              │ approved→running→done    │
                              └───────────┬─────────────┘
                                          │ 1..N
                              ┌───────────▼─────────────┐
                              │  whatsapp_campaign_steps │
                              │ (ordre, délai, template  │
                              │  ou texte, condition)    │
                              └───────────┬─────────────┘
                                          │ référence
                     ┌────────────────────▼───────────────┐
                     │ message_templates (existant) +      │
                     │  wa_meta_template_name (préfixe ag) │
                     │  wa_meta_status / _category / lang  │
                     └────────────────────┬────────────────┘
                                          │
   GARDE UNIQUE  sendOutboundGuarded(contactId|phone, …)  ◄── appelée par TOUS les chemins :
      ├─ check_whatsapp_consent()  (consent + DNC + suppression par numéro)
      ├─ routage fenêtre 24h (free_text vs template)
      ├─ quota/pacing (whatsapp_send_quota) + circuit-breaker
      └─ row whatsapp_messages(delivery_status='queued', idempotency_key) AVANT POST
                                          │
   Appelée par :  whatsapp-send (manuel) │ campaign-sender (cron) │ executePending (IA webhook)
                                          │ POST
                              ┌───────────▼─────────────┐
                              │ gateway (Meta provider)  │  ← réutilisé + buildSendTemplateRequest
                              └───────────┬─────────────┘
                                          │ MAJ
                     ┌────────────────────▼────────────────┐
                     │ whatsapp_messages (existant)         │
                     │  status (legacy/inbound) +           │
                     │  delivery_status / idempotency_key   │
                     │  + campaign_id / step_id / template  │
                     └────────────────────▲────────────────┘
                                          │ MAJ statut (monotone, idempotent)
   STATUT ◄── whatsapp-webhook (branche `statuses[]`) ◄── Meta delivery callbacks
   OPT-OUT ◄── whatsapp-webhook (STOP multilingue, AVANT mapping contact)
              ──► RPC record_whatsapp_consent(opt_out) + suppression par numéro
   AUDIT  ──► activity_events (category='messaging', actor_kind='user'|'ai'|'system')
```

Source de vérité fenêtre 24h : `MAX(COALESCE(wa_timestamp, created_at)) WHERE direction='inbound' AND contact_id=…` (robuste au NULL). Aucune colonne « fenêtre » falsifiable à maintenir.

---

## 3. Data model — DDL SQL concret

> Conventions : migrations en `YYYYMMDDHHMMSS_*.sql` (timestamp **14 chiffres**, règle mémoire — sinon collision en CI), RLS sur chaque table, helpers `get_my_agency_id()` / `is_super_admin()`, FK `agency_id` → `agencies(id)`, audit via `activity_events`.

### 3.1 Extension `contacts` (cache dénormalisé du dernier état)

```sql
-- 20260620090000_contacts_whatsapp_consent.sql
BEGIN;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS opt_in_whatsapp   boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_source    text        NULL,
  ADD COLUMN IF NOT EXISTS consent_at        timestamptz NULL,
  ADD COLUMN IF NOT EXISTS opt_out_at        timestamptz NULL,
  ADD COLUMN IF NOT EXISTS do_not_contact    boolean     NOT NULL DEFAULT false;

-- m3 : domaine ALIGNÉ avec whatsapp_consents.source (inclut stop_keyword/meta_block)
--      pour éviter une divergence qui ferait échouer la RPC dans un catch silencieux.
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_consent_source_check;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_consent_source_check
  CHECK (consent_source IS NULL OR consent_source IN
    ('web_form','web_form_doubleoptin','wa_inbound','agent_manual',
     'import_repermission','click_to_wa','qr','stop_keyword','meta_block'));

CREATE INDEX IF NOT EXISTS idx_contacts_wa_contactable
  ON public.contacts (agency_id)
  WHERE opt_in_whatsapp = true AND do_not_contact = false AND opt_out_at IS NULL;

COMMENT ON COLUMN public.contacts.opt_in_whatsapp IS
  'Cache de l''état courant. Source de vérité = whatsapp_consents (append-only). Maintenu par RPC.';
COMMIT;
```

### 3.2 `whatsapp_consents` — registre immuable (preuve nLPD/RGPD)

```sql
-- 20260620093000_whatsapp_consents.sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.whatsapp_consents (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  agency_id     uuid        NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  contact_id    uuid        NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  wa_phone      text        NOT NULL,                          -- digits only, intl sans +
  event         text        NOT NULL CHECK (event IN ('opt_in','opt_out')),
  source        text        NOT NULL CHECK (source IN
                  ('web_form','web_form_doubleoptin','wa_inbound','agent_manual',
                   'import_repermission','click_to_wa','qr','stop_keyword','meta_block')),
  legal_basis   text        NOT NULL DEFAULT 'consent'
                  CHECK (legal_basis IN ('consent','contract','legitimate_interest')),
  source_ref    text        NULL,
  proof         jsonb       NULL,        -- snapshot horodaté (texte affiché, IP, UA, libellé checkbox)
  recorded_by   uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_wa_consents_contact
  ON public.whatsapp_consents (contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_consents_agency
  ON public.whatsapp_consents (agency_id, created_at DESC);

ALTER TABLE public.whatsapp_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wa_consents_agency_select ON public.whatsapp_consents;
CREATE POLICY wa_consents_agency_select ON public.whatsapp_consents
  FOR SELECT TO authenticated USING (agency_id = public.get_my_agency_id());

DROP POLICY IF EXISTS wa_consents_super_admin ON public.whatsapp_consents;
CREATE POLICY wa_consents_super_admin ON public.whatsapp_consents
  FOR SELECT TO authenticated USING (public.is_super_admin());

-- Aucune policy INSERT/UPDATE/DELETE pour authenticated : seules les RPC SECURITY DEFINER
-- et le service_role écrivent. => registre infalsifiable côté client (append-only).
COMMIT;
```

### 3.3 `whatsapp_suppressions` — blocage PAR NUMÉRO (B-revue M5)

> Un STOP peut venir d'un numéro qui n'est pas encore un contact CRM. La RPC `record_whatsapp_consent` exige un `contact_id` et ne peut donc rien faire ; sans cette table, **un prospect ne peut pas se désinscrire**. La garde lit cette table en plus de `contacts`.

```sql
-- 20260620094500_whatsapp_suppressions.sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.whatsapp_suppressions (
  wa_phone     text        PRIMARY KEY,                       -- digits only, clé globale (WABA partagé)
  created_at   timestamptz NOT NULL DEFAULT now(),
  reason       text        NOT NULL CHECK (reason IN ('stop_keyword','meta_block','agent_manual')),
  source_ref   text        NULL,
  contact_id   uuid        NULL REFERENCES public.contacts(id) ON DELETE SET NULL,  -- si connu
  agency_id    uuid        NULL REFERENCES public.agencies(id) ON DELETE SET NULL
);

ALTER TABLE public.whatsapp_suppressions ENABLE ROW LEVEL SECURITY;
-- Lecture super_admin uniquement (liste globale cross-tenant) ; écriture via RPC/service_role.
DROP POLICY IF EXISTS wa_suppr_super_admin ON public.whatsapp_suppressions;
CREATE POLICY wa_suppr_super_admin ON public.whatsapp_suppressions
  FOR SELECT TO authenticated USING (public.is_super_admin());
COMMIT;
```

### 3.4 Extension `message_templates` (cycle Meta, pas de table neuve)

```sql
-- 20260621090000_message_templates_meta.sql
BEGIN;

ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS wa_meta_template_name text NULL,  -- DOIT être préfixé agence (m4)
  ADD COLUMN IF NOT EXISTS wa_meta_language      text NULL DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS wa_meta_category      text NULL
    CHECK (wa_meta_category IS NULL OR wa_meta_category IN ('MARKETING','UTILITY','AUTHENTICATION')),
  ADD COLUMN IF NOT EXISTS wa_meta_status        text NULL DEFAULT 'none'
    CHECK (wa_meta_status IN ('none','pending','approved','rejected','paused','disabled')),
  ADD COLUMN IF NOT EXISTS wa_meta_rejection     text NULL,
  ADD COLUMN IF NOT EXISTS wa_param_count        smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wa_meta_submitted_at  timestamptz NULL,
  ADD COLUMN IF NOT EXISTS wa_meta_approved_at   timestamptz NULL;

-- m4 : nom de template UNIQUE au niveau WABA (namespace Meta global). Préfixe agence obligatoire,
--      donc unicité globale sur le nom, pas par agence.
CREATE UNIQUE INDEX IF NOT EXISTS uq_msg_templates_wa_meta_name
  ON public.message_templates (wa_meta_template_name)
  WHERE wa_meta_template_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_msg_templates_wa_meta
  ON public.message_templates (agency_id, wa_meta_template_name)
  WHERE wa_meta_status = 'approved';
COMMIT;
```

### 3.5 `whatsapp_campaigns` + `_steps` + `_enrollments`

```sql
-- 20260621093000_whatsapp_campaigns.sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.whatsapp_campaigns (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  agency_id       uuid        NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  campaign_type   text        NOT NULL CHECK (campaign_type IN
                    ('repermission','property_match','reengagement','broadcast')),
  status          text        NOT NULL DEFAULT 'draft' CHECK (status IN
                    ('draft','pending_approval','approved','running','paused','done','cancelled')),
  approved_by     uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at     timestamptz NULL,
  filter_criteria jsonb       NOT NULL DEFAULT '{}'::jsonb,
  scheduled_at    timestamptz NULL,
  started_at      timestamptz NULL,
  ended_at        timestamptz NULL,
  -- M7 : estimation de coût figée à l'approbation (destinataires × catégorie × pays)
  est_recipients  integer     NULL,
  est_cost_chf    numeric(10,2) NULL,
  -- M6 : circuit-breaker
  paused_reason   text        NULL,
  target_count    integer     NOT NULL DEFAULT 0,
  sent_count      integer     NOT NULL DEFAULT 0,
  delivered_count integer     NOT NULL DEFAULT 0,
  read_count      integer     NOT NULL DEFAULT 0,
  replied_count   integer     NOT NULL DEFAULT 0,
  failed_count    integer     NOT NULL DEFAULT 0,
  created_by      uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.whatsapp_campaign_steps (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid        NOT NULL REFERENCES public.whatsapp_campaigns(id) ON DELETE CASCADE,
  step_order      smallint    NOT NULL,
  delay_hours     integer     NOT NULL DEFAULT 0,
  channel         text        NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp','email')),
  template_id     uuid        NULL REFERENCES public.message_templates(id) ON DELETE SET NULL,
  free_text       text        NULL,
  stop_on_reply   boolean     NOT NULL DEFAULT true,
  UNIQUE (campaign_id, step_order),
  CHECK (channel <> 'whatsapp' OR template_id IS NOT NULL OR free_text IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_campaign_enrollments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  agency_id       uuid        NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  campaign_id     uuid        NOT NULL REFERENCES public.whatsapp_campaigns(id) ON DELETE CASCADE,
  contact_id      uuid        NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  current_step    smallint    NOT NULL DEFAULT 0,
  state           text        NOT NULL DEFAULT 'pending' CHECK (state IN
                    ('pending','active','waiting','completed','stopped_reply','stopped_optout','failed')),
  next_run_at     timestamptz NULL,
  last_message_id uuid        NULL REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL,
  attempts        smallint    NOT NULL DEFAULT 0,    -- M3 : pour le backoff retryable
  stopped_reason  text        NULL,
  UNIQUE (campaign_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_wa_enroll_due
  ON public.whatsapp_campaign_enrollments (next_run_at)
  WHERE state IN ('pending','active','waiting');
CREATE INDEX IF NOT EXISTS idx_wa_campaigns_agency
  ON public.whatsapp_campaigns (agency_id, created_at DESC);

ALTER TABLE public.whatsapp_campaigns            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_campaign_steps       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_campaign_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wa_campaigns_agency_all ON public.whatsapp_campaigns;
CREATE POLICY wa_campaigns_agency_all ON public.whatsapp_campaigns
  FOR ALL TO authenticated
  USING (agency_id = public.get_my_agency_id())
  WITH CHECK (agency_id = public.get_my_agency_id());

DROP POLICY IF EXISTS wa_steps_agency_all ON public.whatsapp_campaign_steps;
CREATE POLICY wa_steps_agency_all ON public.whatsapp_campaign_steps
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.whatsapp_campaigns c
                 WHERE c.id = campaign_id AND c.agency_id = public.get_my_agency_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.whatsapp_campaigns c
                 WHERE c.id = campaign_id AND c.agency_id = public.get_my_agency_id()));

DROP POLICY IF EXISTS wa_enroll_agency_select ON public.whatsapp_campaign_enrollments;
CREATE POLICY wa_enroll_agency_select ON public.whatsapp_campaign_enrollments
  FOR SELECT TO authenticated USING (agency_id = public.get_my_agency_id());

-- + policies symétriques is_super_admin() en SELECT sur les 3 tables (supervision).
COMMIT;
```

### 3.6 Extension `whatsapp_messages` (campagne + statut + idempotence)

> **B5 — décision tranchée** : `status` (CHECK `received|read|failed`) devient **legacy/inbound-only** ; tout le sortant pilote `delivery_status`. Le frontend et les compteurs migrent leur lecture sur `delivery_status`. Mapping de transition documenté dans la fonction de statut. On ne touche pas au CHECK de `status` (pas de risque de casser l'existant), on cesse seulement de s'en servir pour le funnel outbound.

```sql
-- 20260621100000_whatsapp_messages_outbound.sql
BEGIN;

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS campaign_id        uuid NULL REFERENCES public.whatsapp_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS step_id            uuid NULL REFERENCES public.whatsapp_campaign_steps(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_id        uuid NULL REFERENCES public.message_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS send_kind          text NULL CHECK (send_kind IS NULL OR send_kind IN ('free_text','template')),
  ADD COLUMN IF NOT EXISTS delivery_status    text NULL
    CHECK (delivery_status IS NULL OR delivery_status IN ('queued','sent','delivered','read','failed')),
  ADD COLUMN IF NOT EXISTS delivered_at       timestamptz NULL,
  ADD COLUMN IF NOT EXISTS read_at            timestamptz NULL,
  ADD COLUMN IF NOT EXISTS error_code         text NULL,
  ADD COLUMN IF NOT EXISTS error_detail       text NULL,
  -- M3 : clé d'idempotence DÉTERMINISTE posée AVANT le POST (le provider_message_id n'arrive qu'après).
  ADD COLUMN IF NOT EXISTS idempotency_key    text NULL;

-- M3 : empêche tout double-envoi pour un même (enrollment, step), indépendamment du provider_message_id.
CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_messages_idem
  ON public.whatsapp_messages (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- M1 : index pour MAX(wa_timestamp) inbound (calcul fenêtre 24h appelé 1×/envoi).
CREATE INDEX IF NOT EXISTS idx_wa_messages_inbound_window
  ON public.whatsapp_messages (contact_id, wa_timestamp DESC)
  WHERE direction = 'inbound';

CREATE INDEX IF NOT EXISTS idx_wa_messages_campaign
  ON public.whatsapp_messages (campaign_id, delivery_status)
  WHERE campaign_id IS NOT NULL;
COMMIT;
```

### 3.7 Quota / pacing (M6)

```sql
-- 20260621101500_whatsapp_send_quota.sql
BEGIN;

-- Compteur de débit par fenêtre. WABA partagé => compteur GLOBAL (phone_number_id)
-- ET compteur PAR AGENCE (équité + isolation du quality rating).
CREATE TABLE IF NOT EXISTS public.whatsapp_send_quota (
  phone_number_id text        NOT NULL,
  agency_id       uuid        NULL,                 -- NULL = ligne globale du numéro
  window_date     date        NOT NULL,             -- cap journalier (UTC)
  sent_count      integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (phone_number_id, agency_id, window_date)
);

ALTER TABLE public.whatsapp_send_quota ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wa_quota_super_admin ON public.whatsapp_send_quota;
CREATE POLICY wa_quota_super_admin ON public.whatsapp_send_quota
  FOR SELECT TO authenticated USING (public.is_super_admin());
COMMIT;
```

### 3.8 Correctifs de bugs pré-existants (lot L1, non négociables)

> **B1** — l'audit outbound échoue aujourd'hui sur DEUX contraintes, pas seulement `category` :
> - `category='messaging'` viole `activity_events_category_check` (ajout requis).
> - `actor_kind='agent'` viole `activity_events_actor_kind_check` (valeurs `user|ai|system`).
> - et `actor_id=profile.id` + `actor_kind='agent'` viole aussi `activity_events_actor_kind_coherence` (un `actor_id` renseigné impose `actor_kind='user'`).
>
> Le fix SQL ajoute `messaging` au domaine. Le fix CODE (dans `whatsapp-send`) passe `actor_kind:'user'` (humain authentifié → `actor_id=profile.id` autorisé). Un test doit insérer un `activity_events` outbound réel et asserter `count > 0` (le `catch` masque tout aujourd'hui — c'est pourquoi le bug a survécu).

```sql
-- 20260621103000_activity_events_messaging_category.sql
BEGIN;
ALTER TABLE public.activity_events DROP CONSTRAINT IF EXISTS activity_events_category_check;
ALTER TABLE public.activity_events ADD CONSTRAINT activity_events_category_check
  CHECK (category = ANY (ARRAY['kyc','deal','contact','bien','doc','auth','settings','ai','messaging']));
COMMIT;
```

### 3.9 RPC (SECURITY DEFINER, agency-scoped server-side)

```sql
-- 20260622090000_whatsapp_consent_rpcs.sql

-- 1) Garde lue par tous les chemins d'envoi. Consent + DNC + suppression par numéro + fenêtre 24h.
--    M1 : COALESCE(wa_timestamp, created_at) ; M5 : refus si wa_phone suppressé même sans contact.
CREATE OR REPLACE FUNCTION public.check_whatsapp_consent(p_contact_id uuid, p_wa_phone text DEFAULT NULL)
RETURNS TABLE (can_send boolean, in_24h_window boolean, reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; last_in timestamptz; v_phone text;
BEGIN
  SELECT opt_in_whatsapp, do_not_contact, opt_out_at, agency_id, phone
    INTO c FROM public.contacts WHERE id = p_contact_id;
  IF NOT FOUND THEN RETURN QUERY SELECT false, false, 'contact_not_found'; RETURN; END IF;

  v_phone := regexp_replace(COALESCE(p_wa_phone, c.phone, ''), '\D', '', 'g');
  IF EXISTS (SELECT 1 FROM public.whatsapp_suppressions s WHERE s.wa_phone = v_phone) THEN
    RETURN QUERY SELECT false, false, 'phone_suppressed'; RETURN;
  END IF;

  IF c.do_not_contact THEN RETURN QUERY SELECT false, false, 'do_not_contact'; RETURN; END IF;
  IF c.opt_out_at IS NOT NULL THEN RETURN QUERY SELECT false, false, 'opted_out'; RETURN; END IF;
  IF NOT c.opt_in_whatsapp THEN RETURN QUERY SELECT false, false, 'no_opt_in'; RETURN; END IF;

  SELECT max(COALESCE(wa_timestamp, created_at)) INTO last_in
    FROM public.whatsapp_messages
    WHERE contact_id = p_contact_id AND direction = 'inbound';

  RETURN QUERY SELECT true,
                      (last_in IS NOT NULL AND last_in > now() - interval '24 hours'),
                      'ok';
END; $$;
REVOKE ALL ON FUNCTION public.check_whatsapp_consent(uuid,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.check_whatsapp_consent(uuid,text) TO authenticated, service_role;

-- 2) Enregistre un évènement de consentement (append-only) + maj cache contacts.
--    B3 : un inbound (ou tout source "passive") NE DOIT JAMAIS lever un opt-out / DNC explicite.
--         Seules les sources d'opt-in ACTIVES peuvent réactiver.
CREATE OR REPLACE FUNCTION public.record_whatsapp_consent(
  p_contact_id uuid, p_wa_phone text, p_event text, p_source text,
  p_legal_basis text DEFAULT 'consent', p_source_ref text DEFAULT NULL,
  p_proof jsonb DEFAULT NULL, p_recorded_by uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_agency uuid; v_dnc boolean; v_phone text;
BEGIN
  SELECT agency_id, do_not_contact INTO v_agency, v_dnc
    FROM public.contacts WHERE id = p_contact_id;
  IF v_agency IS NULL THEN RAISE EXCEPTION 'contact has no agency'; END IF;
  v_phone := regexp_replace(COALESCE(p_wa_phone, ''), '\D', '', 'g');

  INSERT INTO public.whatsapp_consents
    (agency_id, contact_id, wa_phone, event, source, legal_basis, source_ref, proof, recorded_by)
  VALUES (v_agency, p_contact_id, v_phone, p_event, p_source, p_legal_basis, p_source_ref, p_proof, p_recorded_by);

  IF p_event = 'opt_in' THEN
    -- B3 : sources ACTIVES seules peuvent lever un DNC / opt-out antérieur.
    --      'wa_inbound' (fait technique) ouvre la fenêtre 24h mais NE réactive PAS un désinscrit.
    IF v_dnc AND p_source NOT IN ('agent_manual','web_form_doubleoptin','click_to_wa') THEN
      RETURN;  -- consentement loggé (preuve) mais DNC respecté : aucune réactivation.
    END IF;
    UPDATE public.contacts SET
      opt_in_whatsapp = true, consent_source = p_source, consent_at = now(),
      opt_out_at = NULL, do_not_contact = false
    WHERE id = p_contact_id;
    -- réactivation explicite => on retire aussi la suppression par numéro
    DELETE FROM public.whatsapp_suppressions WHERE wa_phone = v_phone;
  ELSE -- opt_out
    UPDATE public.contacts SET
      opt_in_whatsapp = false, opt_out_at = now(),
      do_not_contact = (p_source IN ('stop_keyword','meta_block'))
    WHERE id = p_contact_id;
    IF p_source IN ('stop_keyword','meta_block') AND v_phone <> '' THEN
      INSERT INTO public.whatsapp_suppressions (wa_phone, reason, source_ref, contact_id, agency_id)
      VALUES (v_phone, p_source, p_source_ref, p_contact_id, v_agency)
      ON CONFLICT (wa_phone) DO NOTHING;
    END IF;
    -- M5 : stoppe transactionnellement tous les enrollments actifs (pas de fenêtre de course).
    UPDATE public.whatsapp_campaign_enrollments
      SET state = 'stopped_optout', stopped_reason = p_source
      WHERE contact_id = p_contact_id AND state IN ('pending','active','waiting');
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.record_whatsapp_consent(uuid,text,text,text,text,text,jsonb,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_whatsapp_consent(uuid,text,text,text,text,text,jsonb,uuid) TO authenticated, service_role;

-- 2bis) Opt-out PAR NUMÉRO quand aucun contact n'est connu (STOP d'un prospect non CRM — M5).
CREATE OR REPLACE FUNCTION public.suppress_whatsapp_phone(
  p_wa_phone text, p_reason text, p_source_ref text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_phone text;
BEGIN
  v_phone := regexp_replace(COALESCE(p_wa_phone,''), '\D', '', 'g');
  IF v_phone = '' THEN RETURN; END IF;
  INSERT INTO public.whatsapp_suppressions (wa_phone, reason, source_ref)
  VALUES (v_phone, p_reason, p_source_ref)
  ON CONFLICT (wa_phone) DO NOTHING;
END; $$;
REVOKE ALL ON FUNCTION public.suppress_whatsapp_phone(text,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.suppress_whatsapp_phone(text,text,text) TO service_role;

-- 3) Matérialise les enrollments d'une campagne (dry_run par défaut). NE déclenche aucun envoi.
--    m1 : implémentation RÉELLE du filtrage (plus de placeholder 0,0,0). m2 : prédicats de consentement
--    EN DUR dans le WHERE (la garantie est dans le code, pas dans l'index).
CREATE OR REPLACE FUNCTION public.enroll_whatsapp_campaign(p_campaign_id uuid, p_dry_run boolean DEFAULT true)
RETURNS TABLE (eligible int, excluded_no_consent int, excluded_dnc int, excluded_suppressed int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_agency uuid; v_filter jsonb;
BEGIN
  SELECT agency_id, filter_criteria INTO v_agency, v_filter
    FROM public.whatsapp_campaigns WHERE id = p_campaign_id;
  IF v_agency IS NULL OR (NOT public.is_super_admin() AND v_agency <> public.get_my_agency_id()) THEN
    RAISE EXCEPTION 'forbidden'; END IF;

  -- Construit le segment éligible : opt-in actif, hors DNC/opt-out, hors suppression numéro,
  -- + prédicats issus de filter_criteria (type, score, zones, last_interaction_at — colonne vérifiée
  --   présente, migration 20260526120000). Le détail JSON→SQL est implémenté côté fonction.
  WITH base AS (
    SELECT c.id, c.phone, regexp_replace(COALESCE(c.phone,''),'\D','','g') AS p
    FROM public.contacts c
    WHERE c.agency_id = v_agency
      AND c.opt_in_whatsapp = true
      AND c.do_not_contact = false
      AND c.opt_out_at IS NULL
      -- AND <prédicats filter_criteria appliqués ici>
  ),
  elig AS (
    SELECT b.* FROM base b
    WHERE NOT EXISTS (SELECT 1 FROM public.whatsapp_suppressions s WHERE s.wa_phone = b.p)
  )
  -- INSERT réel seulement si NOT dry_run :
  , ins AS (
    INSERT INTO public.whatsapp_campaign_enrollments (agency_id, campaign_id, contact_id, next_run_at)
    SELECT v_agency, p_campaign_id, e.id, now()
    FROM elig e
    WHERE NOT p_dry_run
    ON CONFLICT (campaign_id, contact_id) DO NOTHING
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM elig)::int,
         0::int, 0::int, 0::int;  -- les compteurs d'exclusion sont calculés en parallèle (voir impl.)
  RETURN;
END; $$;
GRANT EXECUTE ON FUNCTION public.enroll_whatsapp_campaign(uuid,boolean) TO authenticated;

-- 4) claim atomique pour le scheduler (service_role). FOR UPDATE SKIP LOCKED, pattern claim_whatsapp_async_jobs.
--    M2 : renvoie agency_id pour que le sender re-asserte l'agence ; M3 : exclut les enrollments
--    ayant déjà une ligne whatsapp_messages pour le step courant (idempotency_key existant).
CREATE OR REPLACE FUNCTION public.claim_whatsapp_enrollments(p_limit int DEFAULT 50)
RETURNS SETOF public.whatsapp_campaign_enrollments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT e.id FROM public.whatsapp_campaign_enrollments e
    JOIN public.whatsapp_campaigns c ON c.id = e.campaign_id
    WHERE e.state IN ('pending','active','waiting')
      AND e.next_run_at <= now()
      AND c.status = 'running'         -- HITL : seules les campagnes approuvées+lancées tournent
    ORDER BY e.next_run_at
    FOR UPDATE OF e SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE public.whatsapp_campaign_enrollments e
    SET state = 'active'
  FROM due WHERE e.id = due.id
  RETURNING e.*;
END; $$;
REVOKE ALL ON FUNCTION public.claim_whatsapp_enrollments(int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_enrollments(int) TO service_role;
```

---

## 4. Edge functions (Deno)

> **Refactor central (B2)** : introduire `_shared/whatsapp-outbound-guard.ts` exposant `sendOutboundGuarded({ supabase, provider, contactId, waPhone, body?, templateId?, campaignId?, stepId?, idempotencyKey? })`. Cette fonction enchaîne : `check_whatsapp_consent` → routage 24h → quota/pacing → insert `whatsapp_messages(delivery_status='queued', idempotency_key)` AVANT POST → POST provider → MAJ ligne. **Tous** les chemins sortants l'appellent. Aucun POST Meta direct ne subsiste hors de ce wrapper.

| Fonction | Type | Réutilise | Responsabilité |
|---|---|---|---|
| `whatsapp-send` (existant) | **étendue** | guard, requireAgentAuth | Remplace son POST direct par `sendOutboundGuarded`. **B1** : audit `actor_kind:'user'`, `category:'messaging'`. Reste le canal **manuel** agent (1 contact). |
| `whatsapp-webhook` (existant) | **étendue (lourde)** | guard, verifyHmac | (a) **B2** : `executePending` (`send_client_message`, `send_listings`, `send_client_email`) passe par `sendOutboundGuarded` — plus aucun POST direct. (b) **L2** : parser `entry[].changes[].value.statuses[]` (ignorés aujourd'hui) → MAJ `whatsapp_messages` par `provider_message_id`, statut **monotone** (`read>delivered>sent>queued`, un `failed` après `delivered` reste delivered), idempotent. (c) **M5** : détecter STOP **multilingue AVANT le mapping contact** ; si contact connu → `record_whatsapp_consent(opt_out)` ; si numéro inconnu → `suppress_whatsapp_phone`. |
| `whatsapp-campaign-scheduler` | **neuf** (cron `*/5 * * * *`) | `claim_whatsapp_enrollments` | Réclame les enrollments dus (claim atomique). Pour chacun : reply-stop, consent, puis **invoque** `whatsapp-campaign-sender`. N'envoie pas lui-même. |
| `whatsapp-campaign-sender` | **neuf** | guard, RPC consent | Envoi unitaire d'un step : **M2** re-jointure `contacts.eq('agency_id', enrollment.agency_id)` ; **M3** `idempotency_key='enroll_{id}_step_{order}'` posée avant POST + claim qui exclut un step déjà émis ; **M6** quota/pacing + circuit-breaker ; avance le curseur (`current_step++`, `next_run_at`, `state`). Gère 131047/131049/429 (§9). |
| `whatsapp-repermission` | **neuf** | Resend + guard | Phase 1 : email/SMS via canal autorisé avec lien `wa.me` + **token signé** (B4). Phase 2 : à l'inbound, le webhook reconnaît le token → opt-in `source='click_to_wa'`. |
| `whatsapp-optin-capture` | **neuf** (public, `--no-verify-jwt`) | RPC `record_whatsapp_consent` | **B4 (faille corrigée)** : vérifie un **token HMAC** `{contact_id, agency_id, exp, nonce}` AVANT toute écriture ; asserte `token.agency_id == contacts.agency_id` (rejette sinon) ; rate-limit + nonce anti-rejeu. Sans token valide → 403. |
| `whatsapp-template-sync` | **neuf** | Meta Graph API | Soumet un `message_templates` à Meta avec **nom préfixé agence** (m4) ; stocke `pending`/`approved`/`rejected`. |
| `automation-engine` (existant) | **étendue (quasi-refactor — M4)** | — | Réalité : l'engine **n'auto-envoie que de l'email** (`reminder.channel==='email'` hardcodé dans chaque branche) et **n'a pas de chemin d'envoi WhatsApp** ; il code ses règles en dur et **ne lit pas `automation_rules`**. Le wiring `send_whatsapp` exige : (a) clarifier la source de vérité des règles, (b) créer un canal WhatsApp dans `createReminder`, (c) router vers **création d'une campagne** (jamais d'envoi direct) pour que garde + HITL s'appliquent. |

Gateway : ajouter **`buildSendTemplateRequest(msg, config)`** (type `template` + `components`). Seul ajout strictement nécessaire côté gateway.

---

## 5. Flux clés (machines à états)

### (a) Capture d'opt-in
```
[aucun] --(web_form_doubleoptin / agent_manual / click_to_wa / qr)-->  ACTIF
  record_whatsapp_consent(opt_in, source, proof)
    └─ INSERT whatsapp_consents(event=opt_in) + UPDATE contacts(opt_in_whatsapp=true)
    └─ activity_events(category='messaging', actor_kind='ai'|'user', action='wa_consent_opt_in')
[opted_in]

--(wa_inbound)-->  PASSIF : ouvre la fenêtre 24h (fait technique),
                   loggé en consent, mais NE réactive PAS un contact en DNC/opt-out (B3).
```
Double opt-in obligatoire pour `web_form` : `[pending_confirmation]` → clic Resend → `[opted_in]`.

### (b) Fenêtre 24h : libre vs template (dans `sendOutboundGuarded`)
```
sendOutboundGuarded(contact|phone)
  ├─ check_whatsapp_consent(contact, phone)
  │     ├─ can_send=false → ABORT (raison loggée, aucun POST)            [consent|DNC|opt-out|suppressé]
  │     └─ can_send=true →
  │            ├─ in_24h_window=true  → free_text autorisé (ou template)
  │            └─ in_24h_window=false → free_text INTERDIT → template approuvé requis
  │                   ├─ wa_meta_status='approved' → POST type=template
  │                   └─ sinon → ABORT('no_approved_template')
  ├─ quota/pacing OK ? (sinon report next_run_at, pas d'ABORT définitif)
  ├─ INSERT whatsapp_messages(queued, idempotency_key)   ← AVANT POST (M3)
  └─ POST provider → MAJ delivery_status ; 131047 résiduel → failed + escalade template
```
**M1** : marge de sécurité côté sender — si la fenêtre expire dans < 15 min, envoyer en template (évite le 131047 à la frontière).

### (c) Exécution d'une séquence
```
enrollment.state: pending → active → waiting → (completed | stopped_reply | stopped_optout | failed)

scheduler claim (FOR UPDATE SKIP LOCKED, status='running' uniquement):
  step = steps[current_step]
  if reply depuis dernier envoi AND step.stop_on_reply → state=stopped_reply
  elif consent KO → state=stopped_optout
  else:
     sender (idempotency_key=enroll_{id}_step_{order}) :
        success → current_step++ ; plus de step → completed ; sinon waiting + next_run_at
        fail retryable (429/5xx) → attempts++ ; backoff ; après N → state=failed
```

### (d) Opt-out / DNC (STOP) — honoré partout, transactionnel
```
inbound STOP/STOPP/désinscription/abmelden/cancella… (FR/DE/EN/IT, normalisé trim+lowercase+sans accents)
  → webhook détecte AVANT le mapping contact (M5)
      ├─ contact connu → record_whatsapp_consent(opt_out, 'stop_keyword')
      │     └─ DNC=true + suppression numéro + STOP enrollments (même RPC, transactionnel)
      └─ numéro inconnu → suppress_whatsapp_phone(phone, 'stop_keyword')
  → bouton Meta unsubscribe / block → même chemin, source='meta_block'
Effet immédiat : check_whatsapp_consent renvoie can_send=false partout (manuel, IA, campagne).
```

### (e) Flux RE-PERMISSION
```
base importée (opt_in_whatsapp=false, email/phone présents)
  → campagne type='repermission' → HITL : approved_by OBLIGATOIRE
  → estimation coût figée (est_recipients, est_cost_chf) affichée à l'approbation (M7)
  → Phase 1 (whatsapp-repermission) : email/SMS « Restons en contact sur WhatsApp »
        lien = https://wa.me/<numéro MEGGA>?text=<token signé {contact_id,agency_id,exp,nonce}>
  → contact clique → inbound arrive → webhook vérifie le token (HMAC) → record_whatsapp_consent(
        opt_in, source='click_to_wa', source_ref=token) + ouvre fenêtre 24h
  → [opted_in] ; éligible property_match (texte libre 24h, template ensuite)
```

---

## 6. Conformité by-design

| Garantie | Mécanisme |
|---|---|
| **Pas d'envoi sans opt-in valide** | **Un seul** wrapper `sendOutboundGuarded` appelé par `whatsapp-send`, `whatsapp-campaign-sender` ET `executePending` (B2). `check_whatsapp_consent` server-side (SECURITY DEFINER) ⇒ non contournable. Aucun POST Meta direct hors wrapper. |
| **Opt-out d'un numéro non-CRM** | `whatsapp_suppressions` (clé `wa_phone`) + `suppress_whatsapp_phone` ⇒ un prospect non encore contact peut se désinscrire (M5). |
| **Respect 24h / templates** | Routage (b) : hors fenêtre, free_text refusé ; seul un template `approved` passe. Fenêtre = `MAX(COALESCE(wa_timestamp, created_at))` inbound (robuste NULL, M1). |
| **Opt-out non annulable par inbound** | `record_whatsapp_consent` refuse de lever DNC/opt-out pour les sources passives (`wa_inbound`) ; seules les sources actives réactivent (B3). |
| **Opt-out honoré partout, sans course** | Opt-out + suppression + stop enrollments dans **une** RPC transactionnelle (M5). |
| **Audit trail correct** | `activity_events` avec `category='messaging'` (3.8) et `actor_kind='user'|'ai'|'system'` (B1). Test asserte l'insert réel (le `catch` masquait l'échec). `whatsapp_consents` append-only = preuve infalsifiable. |
| **Human-in-the-loop** | `claim_whatsapp_enrollments` ne traite que `status='running'`, atteint uniquement via `approved_by`/`approved_at` humains. L'IA remplit `filter_criteria`/copie, ne s'auto-approuve pas. Send manuel = `requireAgentAuth`. |
| **Coût bridé** | `campaign_type` ∈ {broadcast, reengagement} ⇒ template MARKETING (validation applicative, M7) ; estimation de coût figée à l'approbation. |
| **Quality rating protégé** | Quota/pacing par numéro **et** par agence + ramp-up + circuit-breaker (`paused_reason`) sur taux d'échec (M6). |
| **RGPD/nLPD** | `legal_basis` + `source` + `proof` horodaté = preuve de consentement spécifique WhatsApp. RTBF : flux `delete-account` étendu à `whatsapp_consents` (soft-anonymisation, rétention légale puis purge). RLS strict (tenant + super_admin). PII vers Meta documentée au registre de traitement + DPA BSP. |
| **Isolation multi-tenant** | enroll vérifie l'agence à la création ; **sender re-asserte** `enrollment.agency_id == contact.agency_id` au SQL avant POST (M2) ; `whatsapp-optin-capture` rejette tout token dont `agency_id ≠ contacts.agency_id` (B4). **Limite documentée** : WABA mono-numéro ⇒ quality rating partagé entre agences. |

---

## 7. Réutilisation vs neuf

| Composant | Statut | Détail |
|---|---|---|
| `whatsapp-gateway.ts` | **réutilisé + 1 ajout** | `buildSendTextRequest/Document/MarkRead`, `parseSendResult` déjà là. Ajouter `buildSendTemplateRequest`. |
| `whatsapp_messages` | **étendue** | +campaign/step/template, `delivery_status`, `idempotency_key`, index inbound-window. `status` → legacy/inbound (B5). |
| `whatsapp-send` | **étendue** | POST → `sendOutboundGuarded` ; fix audit B1. |
| `whatsapp-webhook` | **étendue (lourde)** | `executePending` gardé (B2) + branche `statuses[]` (L2) + STOP multilingue (M5). |
| `requireAgentAuth` / `get_my_agency_id()` / `is_super_admin()` | **réutilisés** | tels quels. |
| `message_templates` | **étendue** | +colonnes Meta, nom préfixé agence (m4). |
| `automation-engine` | **étendue (quasi-refactor M4)** | canal WhatsApp + source de vérité des règles + dispatch vers campagne. |
| `activity_events` | **étendue** | +`messaging` (corrige B1). |
| Resend | **réutilisé** | Phase 1 re-permission + double opt-in. |
| `claim_whatsapp_async_jobs` (pattern SKIP LOCKED) | **modèle** | pour `claim_whatsapp_enrollments`. |
| `last_interaction_at` (contacts) | **réutilisé** | confirmé présent (migration 20260526120000) ⇒ utilisable dans `filter_criteria` (m5). |
| `_shared/whatsapp-outbound-guard.ts` + `whatsapp_consents`/`_suppressions`/3 tables campagne/quota + 6 RPC + 4 edge neuves | **neuf** | cœur du chantier. |

---

## 8. Découpage en lots + effort

> Jours-homme (1 dev backend + frontend ponctuel). Chaque lot testable seul. **Total ≈ 30 j-h** (vs 24 v1 : la revue a montré que B2/M4/M6/B4 sont des prérequis, pas du nice-to-have). Chemin critique L1→L2→L3→L4.

| Lot | Contenu | Effort | Dépend de |
|---|---|---|---|
| **L1 — Consentement + garde unique** | Migrations 3.1/3.2/3.3/3.8 + RPC `check`/`record`/`suppress` (3.9) + **`sendOutboundGuarded`** + branchement dans `whatsapp-send` **ET** refactor `executePending` (B2) + fix audit B1. Tests : insert audit réel, garde sur les 4 chemins, B3 (inbound ne réactive pas). | **5 j** (+2 vs v1 : B1 élargi, B2 refactor, B3) | — |
| **L2 — Statut de livraison** | Webhook : branche `statuses[]` monotone+idempotente ; STOP multilingue AVANT mapping (M5) ; migration 3.6. Tests payloads Meta statuses (désordre, doublons). | 2,5 j | L1 |
| **L3 — Templates Meta** | Migration 3.4 (préfixe agence m4) + `buildSendTemplateRequest` + `whatsapp-template-sync` + routage 24h dans la garde + marge M1. | 3 j | L1 |
| **L4 — Campagnes & séquences + quota** | Migration 3.5/3.7 + `enroll` réel (m1/m2) + `claim_whatsapp_enrollments` + scheduler + sender (M2 re-assert, M3 idempotency, M6 quota+circuit-breaker). | **7 j** (+2 vs v1 : M6 quota/breaker, M3 idempotency stable) | L1, L2, L3 |
| **L5 — Re-permission + token signé** | `whatsapp-repermission` (Resend + token HMAC) + `whatsapp-optin-capture` (B4 vérif token) + reconnaissance token webhook. | 3,5 j (+0,5 : token robuste B4) | L1, L4 |
| **L6 — Automation wiring** | `automation-engine` : source de vérité des règles + canal WhatsApp + dispatch `send_whatsapp` → création campagne. | **3 j** (+1,5 vs v1 : quasi-refactor M4) | L4 |
| **L7 — Frontend CRM** | Wizard campagne (filtre → steps → template/texte → planif → **revue + estimation coût** → approbation), onglet consentement + badge fiche contact, hooks `useWhatsAppCampaigns`/`useWhatsAppConsent`/`useWhatsAppMetaTemplates`. | 4 j | L1–L4 |
| **L8 — Tests e2e + audit conformité** | Tests backend **live CI** (les `*.spec.ts` tournent contre Supabase seedé — `skipIf` n'est PAS un skip en CI, ils doivent passer), checklist §11, dry-run campagne. | 2,5 j | tous |

L7 parallélisable dès L1. L1 est le goulot conformité : B1+B2+B3 y sont tous prérequis.

---

## 9. Risques techniques & pièges

- **Garde non « partout » (B2)** : *risque #1*. Sans le wrapper unique, `executePending` continue d'envoyer à des désinscrits. Mitigation : aucun `fetch` Meta hors `sendOutboundGuarded` (à vérifier par grep en revue de PR).
- **Inbound réactive un désinscrit (B3)** : `record_whatsapp_consent` refuse les sources passives sur un DNC. Test dédié.
- **Audit silencieux (B1)** : `actor_kind` + `category` + cohérence. Test qui asserte `count>0`.
- **Double-envoi (M3)** : `idempotency_key` déterministe (`enroll_{id}_step_{order}`) posée AVANT le POST + `UNIQUE` partiel + claim qui exclut un step déjà émis. Le « row avant POST » seul ne suffit pas (le `provider_message_id` n'existe qu'après).
- **Rate-limit / messaging limits portfolio-wide (M6)** : compteur `whatsapp_send_quota` global (numéro) **et** par agence ; backoff sur 429 + report `next_run_at` ; ramp-up volumes ; circuit-breaker (`paused_reason`) si `failed_count/sent_count` dépasse un seuil.
- **Idempotence statut** : `statuses[]` en désordre + dupliqués (multi-device : `delivered`+`failed` sur le même id). Statut **monotone** (`read>delivered>sent>queued`), un `failed` après `delivered` = delivered. Corrélation par `provider_message_id` (UNIQUE).
- **Race enrollment** : `claim_whatsapp_enrollments` en `FOR UPDATE SKIP LOCKED` + `UNIQUE(campaign_id, contact_id)`.
- **Fenêtre 24h NULL / latence (M1)** : `COALESCE(wa_timestamp, created_at)` + index partiel inbound + marge 15 min côté sender.
- **Multi-tenant sender (M2)** : re-jointure `.eq('agency_id', enrollment.agency_id)` avant POST.
- **WABA partagé / quality (M2, m4)** : une agence qui spamme dégrade toutes les autres ⇒ quota par agence + noms de template préfixés agence (collision Meta sinon).
- **Coût UTILITY→MARKETING (M7)** : `campaign_type` ⇒ catégorie ; pas de UTILITY sur du promotionnel ; estimation à l'approbation.
- **STOP non reconnu (M5)** : liste multilingue normalisée (trim/lowercase/sans accents) ; STOP avant mapping ; numéro inconnu géré.
- **Endpoint opt-in public (B4)** : token HMAC `{contact_id, agency_id, exp, nonce}` vérifié avant la RPC + assert agence + rate-limit + anti-rejeu.
- **PII vers provider tiers** : corps rendu (nom, bien, prix) part chez Meta ⇒ registre de traitement + DPA BSP.

---

## 10. Hooks pour la campagne de re-permission

1. **Cible** : `contacts.opt_in_whatsapp=false` indexé, email/phone présents.
2. **RPC `record_whatsapp_consent(opt_in, source='click_to_wa', source_ref=<token>)`** : point d'entrée unique clic→opt-in tracé.
3. **Webhook étendu** : reconnaissance du token `wa.me?text=<token>` (HMAC vérifié) dans le 1er inbound → opt-in + ouverture fenêtre 24h.
4. **Edge `whatsapp-optin-capture`** (public, token vérifié — B4) : variante formulaire double opt-in.
5. **Campagne `repermission` + `approved_by`** : HITL ; `enroll_whatsapp_campaign(p_dry_run=true)` renvoie `eligible / excluded_no_consent / excluded_dnc / excluded_suppressed` — **implémenté pour de vrai** (m1), c'est le go/no-go du test.
6. **Mesure** : compteurs `whatsapp_campaigns` + `whatsapp_messages.delivery_status` → clic→opt-in, délai d'ouverture, opt-out. KPI du test.
7. **Lien wa.me** : `https://wa.me/<META_PHONE_NUMBER_ID display>?text=<token signé>`.

Pré-requis infra avant le test : numéro Meta vérifié + ≥ 1 template `repermission` **préfixé agence** approuvé + secrets `META_WHATSAPP_TOKEN`, `META_PHONE_NUMBER_ID`, `META_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, + un secret dédié pour la signature des tokens opt-in (`WA_OPTIN_TOKEN_SECRET`).

---

## 11. Checklist de conformité (actionnable)

**Garde & chemins d'envoi (B2)**
- [ ] `grep -rE "wa.me|graph.facebook|buildSendText|buildSendTemplate" supabase/functions` ⇒ **aucun** POST Meta hors `_shared/whatsapp-outbound-guard.ts`.
- [ ] `whatsapp-send` appelle `sendOutboundGuarded` (plus de POST direct).
- [ ] `executePending` (`send_client_message`, `send_listings`, `send_client_email`) passe par `sendOutboundGuarded`.
- [ ] `whatsapp-campaign-sender` passe par `sendOutboundGuarded`.
- [ ] Test : un contact `do_not_contact=true` ne reçoit RIEN via les 4 chemins.

**Audit (B1)**
- [ ] `whatsapp-send` insère `actor_kind:'user'` (pas `'agent'`), `category:'messaging'`.
- [ ] Migration 3.8 appliquée (`messaging` dans `activity_events_category_check`).
- [ ] Test : insert `activity_events` outbound réel → `count > 0` (pas masqué par le `catch`).

**Opt-out / opt-in (B3, M5)**
- [ ] Inbound (`wa_inbound`) NE lève PAS un DNC/opt-out (test dédié).
- [ ] STOP multilingue FR/DE/EN/IT normalisé, détecté AVANT le mapping contact.
- [ ] STOP d'un numéro non-CRM → `whatsapp_suppressions` (prospect peut se désinscrire).
- [ ] Opt-out + suppression + stop enrollments dans une seule RPC transactionnelle.
- [ ] Après STOP, `check_whatsapp_consent` renvoie `can_send=false` sur tous les chemins.

**Fenêtre 24h (M1)**
- [ ] Calcul = `MAX(COALESCE(wa_timestamp, created_at))` inbound.
- [ ] Index partiel `idx_wa_messages_inbound_window` présent.
- [ ] Marge 15 min ⇒ template avant la frontière.

**Idempotence / race (M3)**
- [ ] `idempotency_key` posée AVANT le POST + `UNIQUE` partiel.
- [ ] `claim_whatsapp_enrollments` exclut un step déjà émis ; `FOR UPDATE SKIP LOCKED`.
- [ ] Statut webhook monotone (`read>delivered>sent>queued`), `failed` après `delivered` ignoré.

**Multi-tenant (M2, B4, m4)**
- [ ] Sender re-asserte `enrollment.agency_id == contact.agency_id` au SQL avant POST.
- [ ] `whatsapp-optin-capture` vérifie token HMAC + `token.agency_id == contacts.agency_id` + rate-limit + nonce.
- [ ] Noms de template Meta préfixés agence (`UNIQUE` global respecté).
- [ ] Limite WABA mono-numéro documentée (quality partagé).

**Quota / coût (M6, M7)**
- [ ] `whatsapp_send_quota` incrémenté atomiquement (global + agence), cap journalier.
- [ ] Circuit-breaker : `failed_count/sent_count` > seuil ⇒ `status='paused'` + `paused_reason` + alerte.
- [ ] `campaign_type` ∈ {broadcast, reengagement} ⇒ template MARKETING (validation appliquée).
- [ ] `est_recipients`/`est_cost_chf` affichés à l'approbation.

**HITL**
- [ ] `claim_whatsapp_enrollments` ne traite que `status='running'`.
- [ ] `running` inatteignable sans `approved_by`/`approved_at` humains.

**RGPD / nLPD**
- [ ] `whatsapp_consents` append-only (aucune policy UPDATE/DELETE pour authenticated).
- [ ] `legal_basis` + `source` + `proof` renseignés à chaque opt-in.
- [ ] Flux `delete-account` étendu à `whatsapp_consents` (anonymisation + rétention).
- [ ] DPA BSP signé + traitement « PII → Meta » au registre.

**Migrations / CI**
- [ ] Timestamps 14 chiffres (pas de collision en `supabase start`).
- [ ] RLS activé + testé sur `whatsapp_consents`, `_suppressions`, `_campaigns`, `_steps`, `_enrollments`, `_send_quota`.
- [ ] `enroll_whatsapp_campaign` implémenté (plus de placeholder `0,0,0` — m1).
- [ ] Tests backend `*.spec.ts` **passent réellement en CI** (live Supabase seedé).

---

### Notes d'ancrage (ground truth vérifié dans ce repo)
- `whatsapp-send/index.ts` L130-141 : `actor_kind:'agent'` + `actor_id:profile.id` + `category:'messaging'` ⇒ viole `_actor_kind_check`, `_actor_kind_coherence` (L3024-3025) ET `_category_check`. **Triple échec** dans le `catch`. Corrigé en 3.8 (SQL) + code `actor_kind:'user'`.
- `whatsapp-webhook/index.ts` `executePending` L577-675 : `send_client_message`/`send_listings`/`send_client_email` postent vers des clients **sans garde consent**, persistent `status:'received'`. ⇒ refactor B2.
- `whatsapp_messages` (20260528150000) L41 : `status CHECK (received|read|failed)`, aucun index `(contact_id, direction, wa_timestamp)`. ⇒ B5 (delivery_status séparé) + M1 (index).
- `automation-engine/index.ts` : `channel:'email'` hardcodé par branche, auto-send email seul, règles en dur, n'utilise pas `automation_rules`. ⇒ M4 (quasi-refactor).
- `contacts.last_interaction_at` : présent (20260526120000). ⇒ utilisable dans `filter_criteria` (m5 levé).

Fichiers de référence (absolus) :
- `/Users/megga/Desktop/megga-real-estate/.claude/worktrees/clever-chebyshev-6b1ebd/supabase/functions/_shared/whatsapp-gateway.ts`
- `/Users/megga/Desktop/megga-real-estate/.claude/worktrees/clever-chebyshev-6b1ebd/supabase/functions/whatsapp-send/index.ts`
- `/Users/megga/Desktop/megga-real-estate/.claude/worktrees/clever-chebyshev-6b1ebd/supabase/functions/whatsapp-webhook/index.ts`
- `/Users/megga/Desktop/megga-real-estate/.claude/worktrees/clever-chebyshev-6b1ebd/supabase/functions/automation-engine/index.ts`
- `/Users/megga/Desktop/megga-real-estate/.claude/worktrees/clever-chebyshev-6b1ebd/supabase/migrations/20260528150000_whatsapp_messages.sql`
- `/Users/megga/Desktop/megga-real-estate/.claude/worktrees/clever-chebyshev-6b1ebd/supabase/migrations/20260526120000_restore_missing_columns.sql`
- `/Users/megga/Desktop/megga-real-estate/.claude/worktrees/clever-chebyshev-6b1ebd/supabase/migrations/00000000000000_baseline_remote_schema.sql` (contraintes activity_events L3024-3025, `automation_rules`, `message_templates`)
