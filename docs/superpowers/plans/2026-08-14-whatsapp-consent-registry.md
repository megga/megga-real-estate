# WhatsApp — Registre de consentement, garde d'envoi unique et STOP

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (un sous-agent par tâche + les DEUX revues : conformité spec, puis qualité de code). Étapes en cases à cocher (`- [ ]`). Session FRAÎCHE : ce plan est autonome.

> ⚠️ **CADRAGE.** Ce plan ferme le trou n°1 du chantier outbound : **trois chemins sortants écrivent aujourd'hui à des clients sans aucune vérification de consentement**, et rien n'écoute les STOP que nos e-mails promettent déjà d'honorer. Il livre le registre (tables + RPC), la garde unique, l'interception du STOP, puis le câblage des 12 sites d'envoi. **7 lots (L0→L6)**, chacun livrable seul — la colonne « Protégé à la fin du lot » du §5 dit exactement ce qui l'est et ce qui ne l'est pas encore.

**Branche :** `claude/meta-verified-new-wallet-1e0b6e` (la reprendre, ne pas repartir de main). PR ouverte : [#1206](https://github.com/megga/megga-real-estate/pull/1206).

## Contexte — ce qui vient d'être livré le 14.08.2026, et qui change la donne

Le portefeuille Meta a été **recréé et vérifié** ce jour ; toute la chaîne WhatsApp est neuve et **fonctionne** (message entrant reçu, réponse du CRM envoyée et lue, vérifié en base) :

- **App** `1864617921183779` (publiée) · **WABA** `1816378669743304` · numéro **+41 22 567 00 75** `CONNECTED`/`CLOUD_API`
- **20 templates** déposés (5 × fr/de/en/it) ; plusieurs approuvés, dont `megga_kyc_documents_missing` en **UTILITY**
- **`contacts.language`** ajoutée (migration `20260814190000`) — elle réparait au passage `magic-link-send-email`, qui la sélectionnait sur une colonne inexistante et faisait échouer **tous** les liens magiques KYC sous le motif trompeur « contact has no email »
- La langue se **déduit** de `whatsapp_conversation_insights`, uniquement si la colonne est nulle

**⛔ Aucun `WA_TEMPLATE_*` n'est posé en secret, et il ne doit pas l'être avant L3.** Tout le chemin hors fenêtre 24 h est donc inerte (`buildTemplateMessage` rend `null`, repli gracieux). C'est ce plan qui lève le verrou — pas avant.

**Le WABA est mono-numéro, partagé entre toutes les agences.** Une seule plainte fait chuter le quality rating de **tous** les tenants. C'est ce qui justifie la sévérité de ce plan, et notamment la suppression **par numéro, globale au WABA**.

## Avant de commencer — consulter le cerveau

```bash
CLAUDE_FLOW_DISABLE_BRIDGE=1 npx ruflo@3.10.46 memory search -q "whatsapp consentement opt-in STOP garde envoi sortant registre suppression" -n megga
```

## Ordre de lecture

1. **§0** — sept affirmations FAUSSES de la première version, corrigées. À lire en premier : trois d'entre elles produisaient des protections creuses.
2. **§5** — l'ordre des lots et ce que chacun protège réellement.
3. **§6.2** — les 10 problèmes qui restent ouverts même après L6. À connaître avant de promettre quoi que ce soit.
4. Le reste (§1 SQL, §2 garde, §3 STOP, §4 câblage) au fil de l'implémentation.

## Lots — cases à cocher

- [ ] **L0** — `parseInbound` : `button`/`interactive` → `body`, bornage 6–15 chiffres. 1 fichier, 0 migration.
- [ ] **L1** — les 7 migrations du §1 + banc backend (forme des tables, 12 motifs de la RPC, EXPLAIN, `count(pg_proc)=2`). Rien en production.
- [ ] **L2** — le STOP : 3 points d'interception, `whatsapp-stop-keywords.ts`, accusé LPD 4 langues, `stop_handled_at`.
- [ ] **L3** — `whatsapp-outbound-guard.ts` + câblage des **5 chemins CLIENT** (sites 1–5).
- [ ] **L4** — câblage des **7 chemins AGENT** (sites 6–12) + `set_morning_brief_enabled`.
- [ ] **L5** — UI CRM : état du consentement sur la fiche contact, « Envoyer » grisé avec motif, geste « ne plus contacter ».
- [ ] **L6** — portes CI (4 règles du §5) + réconciliation nocturne cache↔registre.

---

# Registre de consentement WhatsApp MEGGA — plan d'implémentation FINAL

> Mesuré sur `claude/meta-verified-new-wallet-1e0b6e` le 14.08.2026. Toutes les ancres ci‑dessous ont été relues dans le dépôt ; celles de la conception initiale qui ne résistaient pas au grep sont corrigées en §0.

---

## 0. Ce qui était FAUX dans la conception initiale

Sept affirmations, corrigées ici plutôt que recopiées.

| Affirmation | Mesure |
|---|---|
| « Le kill‑switch n'est vérifié que dans le webhook ; **le brief et l'avis LPD y échappent** » | **FAUX.** `whatsapp-morning-brief/index.ts:176` et `whatsapp-process/index.ts:88` appellent tous deux `isWhatsAppEnabled`. Les deux fonctions qui l'ignorent réellement sont **`whatsapp-agent-async`** (`:49`) et **`kyc-report-pdf`** (`:110`) — jamais nommées. Un lot livré sur la foi de cette phrase laissait le kill‑switch percé exactement là où il l'est. |
| `whatsapp_followup_suggestions.status='pending'` | **FAUX.** Domaine réel (`20260630120000:18`) : `('suggested','accepted','dismissed')`. L'UPDATE de coupure des relances matchait **0 ligne, sans erreur** — la promesse « coupe les relances dans la même transaction » était creuse à 100 %. |
| « `pickTriageAgency` … `whatsapp-lead-triage.ts:101-104` » | Ligne **25**. `101` = `triageLeadName`. Le fond (null dès ≥2 agences vérifiées) est exact. |
| « `category:'contact'` … `whatsapp-webhook/index.ts:373` » | Ligne **379**. |
| « `whatsapp_consents` est vide par construction » | La table **n'existe pas** : aucune migration (`ls supabase/migrations | grep -i consent` → néant), seulement `docs/chantier-whatsapp-outbound.md`. Conséquence pratique : un `create table if not exists` serait un **no‑op silencieux** si une version divergente était créée entre‑temps ⇒ le banc doit asserter la **FORME**, pas l'existence. |
| « 15 sites d'envoi » | **12 sites, 13 appels** (§4). |
| « `kind` décrit le sujet » | **Faille structurelle.** `p_kind` était un *argument de l'appelant* : `kind:'phone'` désactivait tout le registre, et le site 5 (avis LPD, **seul envoi client sans humain**) l'utilisait déjà. Corrigé : **le sujet est DÉRIVÉ en SQL, jamais déclaré** (§2). |

Deux corrections du brief d'origine restent valides et sont conservées : `whatsapp-send` / `whatsapp-campaign-sender` n'existent pas (tout l'envoi client vit inline dans `executePending`) ; `delivery_status='queued'` n'existe pas (`whatsapp_messages.status` = échelle monotone `received<sent<delivered<read`, lue par `parseStatusUpdates` — **ne pas y ajouter de barreau**).

---

## 1. SQL FINAL

Sept fichiers, un seul ordre. **Les migrations doivent porter la date du jour du merge** (le date‑guard de `deploy.yml` ne rejoue que les fichiers datés du jour) — `20260814*` ci‑dessous est un gabarit à re‑dater.

### 1.1 `20260814210000_contact_suppressions.sql`

```sql
-- Suppression PAR NUMÉRO, GLOBALE au WABA. Le WABA est mono-numéro : Meta ne connaît
-- que le numéro, et une plainte fait chuter le quality rating de TOUS les tenants.
-- Un STOP posé chez l'agence A bloque le numéro pour l'agence B — assumé, seule lecture
-- honnête d'un expéditeur partagé.
--
-- Nommée `contact_suppressions` et NON `whatsapp_suppressions` : `send-relance-email`
-- (:67) promet déjà « répondez STOP » depuis noreply@megga.ch, sans reply_to et sans
-- aucune réception d'e-mail dans le dépôt. Le canal e-mail devra rentrer ici. Renommer
-- coûte zéro tant que la table est vide, et une réécriture des 12 appelants après.
begin;

create table if not exists public.contact_suppressions (
  id            uuid        primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  channel       text        not null check (channel in ('whatsapp','email','all')),
  wa_phone      text        not null check (wa_phone ~ '^[0-9]{6,15}$'),
  reason        text        not null check (reason in
                  ('stop_keyword','meta_block','agent_manual','bounce_hard')),
  source_ref    text        null,   -- whatsapp_messages.id du STOP
  contact_id    uuid        null,   -- SANS FK, cf. COMMENT
  agency_id     uuid        null,   -- agence CONSTATANTE, jamais un filtre de portée

  -- L'accusé de désinscription porte l'avis LPD (art. 19 nLPD). Il part UNE fois par
  -- suppression — pas « une fois par 24 h » : l'unicité de la ligne active EST le plafond.
  ack_sent_at   timestamptz null,

  -- ⛔ PAS de DELETE pour lever un blocage, et PAS de levée par un opt-in tiers.
  -- La levée par `click_to_wa`/`web_form_doubleoptin` est calculée PAR SUJET dans
  -- whatsapp_send_allowed : un opt-in obtenu par l'agence B ne doit pas effacer le STOP
  -- reçu chez l'agence A. Ici, seule une correction humaine explicite écrit lifted_*.
  lifted_at     timestamptz null,
  lifted_reason text        null check (lifted_reason is null
                  or lifted_reason in ('super_admin','saisie_erronee')),
  lifted_by     uuid        null,

  constraint contact_suppressions_lift_coherence check (
    (lifted_at is null and lifted_reason is null)
    or (lifted_at is not null and lifted_reason is not null))
);

comment on column public.contact_suppressions.contact_id is
  'uuid NU, sans FK ni cascade — DÉLIBÉRÉ. La policy contacts_delete (baseline:7546) '
  'autorise un agent authenticated à SUPPRIMER DUR un contact (contacts n''a pas de '
  'deleted_at) : une FK CASCADE ferait disparaître le blocage au moment exact où il sert.';

-- Unicité sur le numéro ACTIF par canal, via normalize_phone (= 9 derniers chiffres,
-- baseline:2306). POURQUOI pas l'égalité stricte : Meta livre `from` en E.164
-- ('41791112233') mais l'outbound dérive le numéro de contacts.phone, saisi en national
-- ('079 111 22 33') — aucun contrôle E.164 n'existe sur le chemin sortant. Comparer les
-- chaînes brutes laisserait passer 100 % des envois vers un numéro qui a dit STOP.
-- CAVEAT : 9 chiffres peuvent collisionner entre pays. Inerte au pilote CH ; à revoir à
-- l'ouverture FR/US. L'asymétrie tranche : un faux positif = un contact silencieux visible
-- dans le CRM ; un faux négatif = une plainte sur un WABA partagé par tous les tenants.
create unique index if not exists uq_contact_suppressions_active
  on public.contact_suppressions (public.normalize_phone(wa_phone), channel)
  where lifted_at is null;

create index if not exists idx_contact_suppressions_contact
  on public.contact_suppressions (contact_id) where contact_id is not null;

alter table public.contact_suppressions enable row level security;
revoke all on table public.contact_suppressions from anon, authenticated;
grant select on table public.contact_suppressions to authenticated;

-- L'agence VOIT le blocage de SES contacts — sinon l'UI ne peut pas expliquer pourquoi
-- « Envoyer » est grisé, et l'agent réessaie en boucle. Un numéro bloqué sans contact ni
-- agence reste invisible : ce n'est pas sa donnée.
drop policy if exists cs_select_agency on public.contact_suppressions;
create policy cs_select_agency on public.contact_suppressions
  for select to authenticated
  using (agency_id = (select public.get_my_agency_id())
      or exists (select 1 from public.contacts c
                 where c.id = contact_suppressions.contact_id
                   and c.agency_id = (select public.get_my_agency_id())));

drop policy if exists cs_select_super on public.contact_suppressions;
create policy cs_select_super on public.contact_suppressions
  for select to authenticated using ((select public.is_super_admin()));

commit;
```

### 1.2 `20260814211000_whatsapp_consents.sql`

```sql
-- Registre de consentement WhatsApp — APPEND-ONLY, preuve nLPD art. 6 al. 6.
-- Le sujet est POLYMORPHE : un contact démarché OU un agent apparié (brief, rapport KYC).
-- Une clé contact_id NOT NULL tuerait les 7 chemins agent-facing.
begin;

create table if not exists public.whatsapp_consents (
  id            uuid        primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  subject_kind  text        not null check (subject_kind in ('contact','profile')),
  contact_id    uuid        null,   -- SANS FK (même raison que contact_suppressions)
  profile_id    uuid        null,   -- SANS FK
  agency_id     uuid        null,

  wa_phone      text        not null check (wa_phone ~ '^[0-9]{6,15}$'),

  event         text        not null check (event in ('opt_in','opt_out')),
  source        text        not null,
  legal_basis   text        not null default 'consent'
    check (legal_basis in ('consent','contract','legitimate_interest','legal_obligation')),
  purpose       text        not null default 'service'
    check (purpose in ('service','utility','marketing')),

  -- La déclaration PORTE SA PORTÉE. Sans ça, « je ne veux plus le brief du matin »
  -- éteignait AUSSI le PDF KYC, les résultats async, les confirmations d'appairage et
  -- les réponses du copilote : l'étape sujet-profil ne filtrait sur aucune finalité.
  scope         text        not null default 'all' check (scope in ('all','daily_brief')),

  source_ref    text        null,   -- whatsapp_messages.id, jeton HMAC, id de campagne
  proof         jsonb       null,   -- texte AFFICHÉ, horodatage, libellé. JAMAIS IP ni UA.
  ip_hash       text        null,   -- précédent maison : user_consents.ip_hash (20260705170000:30)
  recorded_by   uuid        null,

  constraint wa_consents_subject_xor check (
    (subject_kind = 'contact' and contact_id is not null and profile_id is null)
    or (subject_kind = 'profile' and profile_id is not null and contact_id is null)),

  -- C'est ICI que « un inbound ne vaut JAMAIS opt-in » est verrouillé : 'wa_inbound'
  -- n'existe pas dans le domaine, et 'web_form' sans double opt-in non plus. Une règle
  -- absente d'un CHECK est une règle qu'un appelant finira par contourner.
  constraint wa_consents_event_source check (
    (event = 'opt_in'  and source in ('web_form_doubleoptin','click_to_wa','qr',
                                      'agent_manual','import_repermission','agent_pairing'))
    or (event = 'opt_out' and source in ('stop_keyword','meta_block','agent_manual',
                                         'brief_disabled'))),

  -- ⛔ Un agent ne peut pas FABRIQUER un opt-in marketing. Sans ce CHECK, toute la
  -- discipline de double opt-in tenait à un seul appel RPC de distance.
  constraint wa_consents_no_manual_marketing check (
    not (event = 'opt_in' and source = 'agent_manual' and purpose = 'marketing')),

  -- Un opt-in saisi à la main SANS trace de ce qui a été montré n'est pas une preuve.
  constraint wa_consents_manual_needs_proof check (
    not (event = 'opt_in' and source = 'agent_manual' and proof is null)),

  -- brief_disabled est par nature scopé ; l'inverse (un opt-out global écrit avec le
  -- scope du brief) n'aurait pas de sens non plus.
  constraint wa_consents_brief_scope check (
    (source = 'brief_disabled') = (scope = 'daily_brief'))
);

comment on table public.whatsapp_consents is
  'Registre append-only des déclarations de consentement WhatsApp. Conservation : durée de '
  'la relation + 10 ans (prescription). PII effaçable par redact_whatsapp_consent (DSAR '
  'art. 32 nLPD) : le numéro et la preuve partent, la ligne juridique (qui/quand/quoi/base) '
  'reste. La FENÊTRE 24 h Meta n''est PAS un consentement et n''a pas de ligne ici.';

create index if not exists idx_wa_consents_contact
  on public.whatsapp_consents (contact_id, created_at desc) where contact_id is not null;
create index if not exists idx_wa_consents_profile
  on public.whatsapp_consents (profile_id, created_at desc) where profile_id is not null;
-- Lecteur RÉEL : whatsapp_send_allowed lit le registre PAR NUMÉRO autant que par sujet
-- (fiche supprimée puis recréée, ou deux fiches pour la même personne). Sans ce chemin,
-- un opt-out survivait à la suppression du contact mais son EFFET non.
create index if not exists idx_wa_consents_phone
  on public.whatsapp_consents (public.normalize_phone(wa_phone), created_at desc);
create index if not exists idx_wa_consents_agency
  on public.whatsapp_consents (agency_id, created_at desc) where agency_id is not null;

-- ── Append-only RÉEL ────────────────────────────────────────────────────────
-- L'absence de policy ne protège QUE le chemin PostgREST authentifié : service_role,
-- toute fonction SECURITY DEFINER et l'owner la traversent. On copie le niveau
-- activity_events : trigger + révocation des GRANTs.
create or replace function public.enforce_whatsapp_consents_immutability()
returns trigger language plpgsql security definer
set search_path to 'public','pg_temp' as $$
begin
  if tg_op = 'UPDATE' then
    -- Unique échappatoire : le caviardage DSAR, porté par redact_whatsapp_consent.
    -- Sans elle, le trigger rendait l'effacement TECHNIQUEMENT impossible, y compris
    -- pour une PII posée par erreur — un registre indestructible n'est pas une vertu.
    if current_setting('megga.consent_redaction', true) = 'on'
       and new.wa_phone = '000000000' and new.proof is null and new.ip_hash is null
       and new.id = old.id and new.created_at = old.created_at
       and new.subject_kind = old.subject_kind and new.event = old.event
       and new.source = old.source and new.legal_basis = old.legal_basis
       and new.purpose = old.purpose and new.scope = old.scope
    then return new; end if;
  end if;
  raise exception 'whatsapp_consents est append-only (% refusé)', tg_op using errcode = '42501';
end $$;

drop trigger if exists trg_wa_consents_immutable_update on public.whatsapp_consents;
create trigger trg_wa_consents_immutable_update before update on public.whatsapp_consents
  for each row execute function public.enforce_whatsapp_consents_immutability();

drop trigger if exists trg_wa_consents_immutable_delete on public.whatsapp_consents;
create trigger trg_wa_consents_immutable_delete before delete on public.whatsapp_consents
  for each row execute function public.enforce_whatsapp_consents_immutability();

-- ⚠ Un trigger FOR EACH ROW ne voit PAS un TRUNCATE. Or `anon` détient TRUNCATE sur 75
-- tables de ce projet par héritage de DEFAULT PRIVILEGES : sans cette ligne, le registre
-- entier s'efface en une instruction.
drop trigger if exists trg_wa_consents_immutable_truncate on public.whatsapp_consents;
create trigger trg_wa_consents_immutable_truncate before truncate on public.whatsapp_consents
  for each statement execute function public.enforce_whatsapp_consents_immutability();

alter table public.whatsapp_consents enable row level security;
revoke all on table public.whatsapp_consents from anon, authenticated;
grant select on table public.whatsapp_consents to authenticated;

-- PAS de `force row level security`, contrairement à contacts et kyc_* :
-- record_whatsapp_consent est SECURITY DEFINER, propriété de postgres ; FORCE la
-- soumettrait à RLS et son INSERT tomberait faute de policy INSERT. Le verrou ici est le
-- TRIGGER (qui, lui, s'applique à postgres aussi), pas la RLS.
drop policy if exists wa_consents_select_agency on public.whatsapp_consents;
create policy wa_consents_select_agency on public.whatsapp_consents
  for select to authenticated using (agency_id = (select public.get_my_agency_id()));

drop policy if exists wa_consents_select_self on public.whatsapp_consents;
create policy wa_consents_select_self on public.whatsapp_consents
  for select to authenticated using (profile_id = auth.uid());

drop policy if exists wa_consents_select_super on public.whatsapp_consents;
create policy wa_consents_select_super on public.whatsapp_consents
  for select to authenticated using ((select public.is_super_admin()));

commit;
```

### 1.3 `20260814212000_contacts_wa_consent_cache.sql`

```sql
begin;
alter table public.contacts add column if not exists wa_opt_in      boolean not null default false;
alter table public.contacts add column if not exists wa_consent_at  timestamptz null;
alter table public.contacts add column if not exists wa_opt_out_at  timestamptz null;
-- Permet à l'UI d'expliquer le grisage SANS appel réseau. Sans lui, l'agent voit
-- « contactable », sélectionne en masse, et n'obtient qu'un refus opaque.
alter table public.contacts add column if not exists wa_suppressed  boolean not null default false;

create index if not exists idx_contacts_wa_contactable
  on public.contacts (agency_id)
  where wa_opt_in = true and wa_opt_out_at is null and wa_suppressed = false;

comment on column public.contacts.wa_opt_in is
  'CACHE DE LISTE — jamais source de vérité, JAMAIS lu par la garde d''envoi. Écrit '
  'uniquement par record_whatsapp_consent. Sert la sélection en masse et l''affichage ; '
  'la décision d''envoi lit le REGISTRE. Le chantier faisait l''inverse, de sorte qu''un '
  'import direct ou une RPC contournée faisait envoyer sur une donnée fausse.';
commit;
```

Deux colonnes du brief sont **supprimées du design** : `do_not_contact` (doublonnait `contact_suppressions` — deux états pour un fait ⇒ deux vérités) et `consent_source` + son second CHECK (piège **m3** : deux CHECK sur le même domaine, dont l'un échoue *dans* la RPC et tombe dans un `catch`).

### 1.4 `20260814213000_whatsapp_messages_inbound_normphone_index.sql`

```sql
-- La fenêtre 24 h de whatsapp_send_allowed filtre normalize_phone(wa_from) sur des lignes
-- contact_id IS NOT NULL. AUCUN index existant ne le couvre :
--   idx_wa_messages_agency_normphone (20260617091000:55) — agency-first ET partiel sur
--     contact_id IS NULL : il EXCLUT le cas nominal.
--   idx_wa_messages_inbound_created  (20260705200000:40) — pas d'ancre d'égalité.
--   idx_wa_messages_wafrom_created   (20260705100000:25) — sur wa_from BRUT, pas normalisé.
-- 20260705200000:27-32 explique pourquoi il n'avait PAS posé cet index (« aucune requête
-- ne filtre normalize_phone sur des lignes contact_id IS NOT NULL »). Cette migration-ci
-- invalide cette prémisse : elle pose l'index et le dit, sinon le prochain audit d'index
-- le supprimera comme poids mort.
begin;
create index if not exists idx_wa_messages_inbound_normphone
  on public.whatsapp_messages (public.normalize_phone(wa_from), created_at desc)
  where direction = 'inbound';
comment on index public.idx_wa_messages_inbound_normphone is
  'Consommateur : whatsapp_send_allowed (fenêtre 24 h + relation d''affaires 30 j). '
  'Chemin CHAUD du webhook : sans lui, seq scan par envoi → statement timeout Pro (3-8 s) '
  'dans un handler qui doit rendre 200 avant que Meta ne rejoue.';
commit;
```

### 1.5 `20260814214000_activity_events_category_messaging.sql`

```sql
-- Domaine vivant après 20260803214105:192-198 (9 valeurs). On AJOUTE, on ne tord pas :
-- un audit qui ment est pire qu'un audit absent.
do $$
begin
  alter table public.activity_events drop constraint if exists activity_events_category_check;
  alter table public.activity_events add constraint activity_events_category_check
    check (category = any (array['kyc','deal','contact','bien','doc','auth','settings',
                                 'ai','onboarding','messaging']));
end $$;
```

Les 6 événements WhatsApp existants **gardent** `category='contact'` : `activity_events` est append‑only, réécrire l'histoire est pire que l'incohérence.

### 1.6 `20260814215000_whatsapp_consent_rpcs.sql`

```sql
begin;

-- ⚠ DROP avant CREATE OR REPLACE : un changement de type de retour lève « cannot change
-- return type » (migration en échec → deploy.yml bloque la journée), et un changement de
-- signature crée une SURCHARGE, pas un remplacement → PGRST203 sur tous les appels.
drop function if exists public.whatsapp_send_allowed(text,text,uuid,uuid,uuid,text);
drop function if exists public.record_whatsapp_consent(text,text,text,text,uuid,uuid,uuid,text,text,text,jsonb,uuid,text);

-- ═══════════════════════════════════════════════════════════════════════════
-- LECTURE — autorisation d'envoi.
-- ⛔ Il n'y a PAS de paramètre `p_kind`. Le sujet est DÉRIVÉ. Un `kind` déclaré par
--    l'appelant était un laissez-passer : le site de l'avis LPD passait déjà `'phone'`,
--    et la porte CI (grep de symboles) ne regarde pas les arguments.
-- ═══════════════════════════════════════════════════════════════════════════
create function public.whatsapp_send_allowed(
  p_wa_phone   text,
  p_purpose    text default 'service',   -- service|utility|marketing|lpd_notice|opt_out_ack
  p_contact_id uuid default null,
  p_profile_id uuid default null,
  p_agency_id  uuid default null,        -- agence de l'APPELANT (visibilité du motif)
  p_scope      text default 'all'
)
returns table (allowed boolean, reason text, public_reason text,
               in_24h_window boolean, legal_basis text, subject_kind text)
language plpgsql stable security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_digits  text := regexp_replace(coalesce(p_wa_phone,''), '\D', '', 'g');
  v_norm    text;
  v_kind    text;
  v_contact uuid := p_contact_id;
  v_profile uuid := p_profile_id;
  v_agency  uuid;
  v_cnt     int;
  v_sup     public.contact_suppressions%rowtype;
  v_last    record;
  v_win     boolean := false;
  v_rel     boolean := false;
  v_vis     boolean;
begin
  -- 0. Garde de tenant. Un appelant AUTHENTIFIÉ ne peut interroger que ses sujets.
  --    ⚠ Elle ne suffit pas à fermer l'oracle : un agent peut créer un contact avec un
  --    numéro arbitraire dans SA propre agence (geste nominal du CRM) puis interroger.
  --    C'est pourquoi `public_reason` existe (cf. PR #1114) : le motif PRÉCIS n'est rendu
  --    qu'au service_role et au tenant qui voit déjà la ligne.
  if auth.uid() is not null then
    if p_contact_id is null or not exists (
      select 1 from public.contacts c
      where c.id = p_contact_id and c.agency_id = public.get_my_agency_id())
    then raise exception 'forbidden' using errcode = '42501'; end if;
  end if;

  -- 1. Numéro exploitable. Aucun contrôle E.164 n'existe sur le chemin sortant :
  --    « 022 345 67 89 » partait à Meta en « 0223456789 ». Borne HAUTE aussi : un JID de
  --    groupe ('120363…@g.us') donne 18 chiffres et ferait échouer l'insert → 500 → rejeu.
  if length(v_digits) < 6 or length(v_digits) > 15 then
    return query select false,'invalid_phone','invalid_phone',false,null::text,null::text; return;
  end if;
  v_norm := public.normalize_phone(v_digits);
  if v_norm is null or length(v_norm) < 9 then
    return query select false,'invalid_phone','invalid_phone',false,null::text,null::text; return;
  end if;

  -- 2. SUJET DÉRIVÉ (jamais déclaré).
  if v_profile is not null and exists (
       select 1 from public.whatsapp_agent_links l
       where l.profile_id = v_profile and l.verified
         and public.normalize_phone(l.wa_number) = v_norm) then
    v_kind := 'profile';
  elsif v_contact is not null then
    -- Cohérence numéro↔fiche↔agence. ⛔ On ne re-résout JAMAIS via
    -- resolve_contact_by_phone : cette RPC est GLOBALE par conception (20260617091000:38,
    -- « SANS agence, pour le test d'unicité globale ») ; s'en servir ici lierait un envoi
    -- de l'agence A au contact de l'agence B, avec un audit au mauvais agency_id.
    select c.agency_id into v_agency from public.contacts c
     where c.id = v_contact and public.normalize_phone(c.phone) = v_norm
       and (p_agency_id is null or c.agency_id = p_agency_id);
    if v_agency is null then
      return query select false,'subject_mismatch','not_contactable',false,null::text,null::text; return;
    end if;
    v_kind := 'contact';
  else
    select count(*) into v_cnt from public.contacts c
     where c.phone is not null and public.normalize_phone(c.phone) = v_norm;
    if v_cnt = 1 then
      select c.id, c.agency_id into v_contact, v_agency from public.contacts c
       where c.phone is not null and public.normalize_phone(c.phone) = v_norm;
      v_kind := 'contact';
    elsif v_cnt = 0 and exists (select 1 from public.whatsapp_agent_links l
                                where l.verified and public.normalize_phone(l.wa_number) = v_norm) then
      select l.profile_id into v_profile from public.whatsapp_agent_links l
       where l.verified and public.normalize_phone(l.wa_number) = v_norm limit 1;
      v_kind := 'profile';
    else
      v_kind := 'phone';   -- inconnu OU ambigu (≥2 fiches) → registre lu PAR NUMÉRO
    end if;
  end if;

  -- 3. SUPPRESSION par numéro — AVANT tout consentement, toujours. Le numéro est ce que
  --    Meta connaît ; le consentement est ce que MEGGA croit. Sur un WABA mono-numéro, un
  --    opt-in valide en base ne rachète pas un STOP reçu ailleurs.
  select * into v_sup from public.contact_suppressions s
   where public.normalize_phone(s.wa_phone) = v_norm
     and s.channel in ('whatsapp','all') and s.lifted_at is null
   order by s.created_at desc limit 1;

  if found then
    -- Levée PAR SUJET, calculée : un opt-in PERSONNEL postérieur, pour CE sujet seulement.
    -- La ligne de suppression reste active pour tous les autres. C'est ce qui empêche
    -- l'opt-in obtenu par l'agence B d'effacer le STOP reçu chez l'agence A.
    if not exists (
      select 1 from public.whatsapp_consents c
      where c.event = 'opt_in'
        and c.source in ('click_to_wa','web_form_doubleoptin')
        and c.created_at > v_sup.created_at
        and ((v_kind = 'contact' and c.contact_id = v_contact)
          or (v_kind = 'profile' and c.profile_id = v_profile)))
    then
      -- Accusé de désinscription : UNE fois par suppression (l'unicité de la ligne active
      -- EST le plafond). Il porte l'avis LPD — c'est le seul message que cette personne
      -- recevra jamais si son PREMIER message est « stop ».
      if p_purpose = 'opt_out_ack' then
        if v_sup.ack_sent_at is null then
          return query select true,'ok_opt_out_ack','ok_opt_out_ack',false,
                              'legal_obligation'::text, v_kind; return;
        end if;
        return query select false,'ack_already_sent','ack_already_sent',false,null::text,v_kind; return;
      end if;
      v_vis := (v_sup.agency_id is not null and v_sup.agency_id = p_agency_id)
            or exists (select 1 from public.contacts c
                       where c.id = v_sup.contact_id and c.agency_id = p_agency_id);
      return query select false,'phone_suppressed',
        case when v_vis then 'phone_suppressed' else 'not_contactable' end,
        false,null::text,v_kind; return;
    end if;
  end if;

  if p_purpose = 'opt_out_ack' then
    return query select false,'ack_without_suppression','ack_without_suppression',
                        false,null::text,v_kind; return;
  end if;

  -- 4. Fenêtre 24 h + relation d'affaires 30 j. FAITS CALCULÉS, jamais des états stockés
  --    — donc infalsifiables. BORNÉS (48 h / 30 j) et SCOPÉS AU TENANT pour un contact :
  --    sans le scope, l'agence A « répondait » à un message que la personne avait écrit à
  --    l'agence B — du démarchage à froid habillé en réponse.
  select
    bool_or(coalesce(m.wa_timestamp, m.created_at) > now() - interval '24 hours'),
    bool_or(true)
    into v_win, v_rel
  from public.whatsapp_messages m
  where m.direction = 'inbound'
    and public.normalize_phone(m.wa_from) = v_norm
    and m.created_at > now() - interval '30 days'
    and (v_kind <> 'contact' or m.agency_id = v_agency or m.contact_id = v_contact);
  v_win := coalesce(v_win,false); v_rel := coalesce(v_rel,false);

  -- 5. Obligation d'information (art. 19 nLPD) : UN message par numéro, jamais du
  --    démarchage. Passe outre un opt-out DÉCLARATIF ('agent_manual' : la personne n'a
  --    rien demandé, l'agent a coché) mais JAMAIS une suppression active (étape 3) —
  --    dans ce cas l'accusé a déjà porté l'avis.
  if p_purpose = 'lpd_notice' then
    return query select true,'ok','ok',v_win,'legal_obligation'::text,v_kind; return;
  end if;

  -- 6. Sujet AGENT : utilisateur du service, base contractuelle. Jamais de marketing.
  if v_kind = 'profile' then
    if not exists (select 1 from public.whatsapp_agent_links l
                   where l.profile_id = v_profile and l.verified
                     and public.normalize_phone(l.wa_number) = v_norm) then
      return query select false,'agent_link_unverified','agent_link_unverified',
                          v_win,null::text,v_kind; return;
    end if;
    if p_purpose = 'marketing' then
      return query select false,'marketing_requires_consent','marketing_requires_consent',
                          v_win,'contract'::text,v_kind; return;
    end if;
    -- Filtré sur le SCOPE : un opt-out 'brief_disabled' (scope daily_brief) ne coupe que
    -- le brief, pas le PDF KYC ni le copilote.
    if exists (
      select 1 from public.whatsapp_consents c
      where c.profile_id = v_profile and c.event = 'opt_out'
        and c.scope in ('all', p_scope)
        and c.created_at > coalesce((select max(c2.created_at) from public.whatsapp_consents c2
                                     where c2.profile_id = v_profile and c2.event = 'opt_in'
                                       and c2.scope in ('all', p_scope)), '-infinity'))
    then return query select false,'opted_out','opted_out',v_win,'contract'::text,v_kind; return; end if;
    return query select true,'ok','ok',v_win,'contract'::text,v_kind; return;
  end if;

  -- 7. Sujet CONTACT ou NUMÉRO. Lookup par SUJET **ET** par NUMÉRO : un opt-out survit à
  --    la suppression puis recréation de la fiche (uuid neuf) et couvre les doublons de
  --    fiche. C'est le lecteur de idx_wa_consents_phone.
  select c.event, c.source, c.legal_basis into v_last
  from public.whatsapp_consents c
  where ((v_contact is not null and c.contact_id = v_contact)
         or public.normalize_phone(c.wa_phone) = v_norm)
    and c.scope in ('all', p_scope)
  order by c.created_at desc, c.id desc limit 1;

  if not found then
    -- RÈGLE DE SERVICE : le consentement est requis pour INITIER ou pour du MARKETING,
    -- pas pour RÉPONDRE. Sans elle, brancher la garde refuserait 100 % des envois agent
    -- au jour 1 (aucun contact n'a d'opt-in) — une garde qui ferme tout se fait débrancher.
    if p_purpose = 'service' and v_win then
      return query select true,'ok_service_window','ok_service_window',true,
                          'legitimate_interest'::text,v_kind; return;
    end if;
    -- Template UTILITY hors fenêtre : admis sur relation d'affaires existante (<30 j),
    -- ce qui garde vivant le repli template de send_client_message. Sinon, refus.
    if p_purpose = 'utility' and v_rel then
      return query select true,'ok_business_relationship','ok_business_relationship',
                          v_win,'legitimate_interest'::text,v_kind; return;
    end if;
    return query select false,'no_opt_in',
      case when auth.uid() is null then 'no_opt_in' else 'not_contactable' end,
      v_win,null::text,v_kind; return;
  end if;

  if v_last.event = 'opt_out' then
    return query select false,
      case when v_last.source in ('stop_keyword','meta_block') then 'do_not_contact'
           else 'opted_out' end,
      'not_contactable', v_win, v_last.legal_basis, v_kind; return;
  end if;

  -- Mapping base légale ↔ finalité : le chantier laissait passer un broadcast MARKETING
  -- sur 'legitimate_interest'.
  if p_purpose = 'marketing' and v_last.legal_basis <> 'consent' then
    return query select false,'marketing_requires_consent','marketing_requires_consent',
                        v_win, v_last.legal_basis, v_kind; return;
  end if;

  return query select true,'ok','ok',v_win,v_last.legal_basis,v_kind;
end $$;

revoke all on function public.whatsapp_send_allowed(text,text,uuid,uuid,uuid,text) from public, anon;
grant execute on function public.whatsapp_send_allowed(text,text,uuid,uuid,uuid,text)
  to authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- ÉCRITURE
-- ═══════════════════════════════════════════════════════════════════════════
create function public.record_whatsapp_consent(
  p_kind        text,
  p_wa_phone    text,
  p_event       text,
  p_source      text,
  p_contact_id  uuid  default null,
  p_profile_id  uuid  default null,
  p_agency_id   uuid  default null,
  p_legal_basis text  default 'consent',
  p_purpose     text  default 'service',
  p_source_ref  text  default null,
  p_proof       jsonb default null,
  p_recorded_by uuid  default null,
  p_scope       text  default 'all'
) returns uuid
language plpgsql security definer set search_path to 'public','pg_temp'
as $$
declare
  v_phone  text := regexp_replace(coalesce(p_wa_phone,''), '\D', '', 'g');
  v_agency uuid := p_agency_id;
  v_proof  jsonb := p_proof;
  v_id     uuid;
begin
  -- Allow-list de l'appelant AUTHENTIFIÉ : 2 gestes seulement, chacun sur son périmètre.
  -- 'brief_disabled' EST dans la liste — le toggle du brief vit sur une colonne que
  -- l'agent bascule depuis le CRM, donc en `authenticated` : l'interdire rendait
  -- set_morning_brief_enabled impossible (42501 systématique).
  if auth.uid() is not null then
    if p_source = 'agent_manual' then
      if p_kind <> 'contact' or p_contact_id is null or not exists (
        select 1 from public.contacts c
        where c.id = p_contact_id and c.agency_id = public.get_my_agency_id())
      then raise exception 'forbidden' using errcode = '42501'; end if;
      v_agency := public.get_my_agency_id();
      -- La preuve est CONSTRUITE côté serveur, jamais fournie par le client.
      v_proof := jsonb_build_object('recorded_by', auth.uid(), 'at', now(),
                                    'ui_ref', coalesce(p_source_ref,'crm_contact_detail'));
    elsif p_source = 'brief_disabled' then
      if p_kind <> 'profile' or p_profile_id is distinct from auth.uid() or p_scope <> 'daily_brief'
      then raise exception 'forbidden' using errcode = '42501'; end if;
    else
      raise exception 'source_reserved_to_service' using errcode = '42501';
    end if;
    p_recorded_by := auth.uid();
  end if;

  if length(v_phone) < 6 or length(v_phone) > 15 then
    raise exception 'invalid_phone' using errcode = '22023'; end if;
  if v_agency is null and p_kind = 'contact' and p_contact_id is not null then
    select c.agency_id into v_agency from public.contacts c where c.id = p_contact_id; end if;

  -- La PREUVE d'abord, l'EFFET ensuite : elle est écrite même quand l'effet est refusé.
  insert into public.whatsapp_consents (subject_kind, contact_id, profile_id, agency_id,
    wa_phone, event, source, legal_basis, purpose, scope, source_ref, proof, recorded_by)
  values (p_kind, p_contact_id, p_profile_id, v_agency, v_phone, p_event, p_source,
    p_legal_basis, p_purpose, p_scope, p_source_ref, v_proof, p_recorded_by)
  returning id into v_id;

  -- TOUT opt-out sur un sujet CONTACT écrit une suppression, quelle qu'en soit la source.
  -- Sans ça, un « ne pas contacter » saisi à la main ne survivait pas au cycle
  -- supprimer/recréer la fiche (documenté 20260617091000:69-73). Et c'est ce qui donne
  -- enfin un ÉCRIVAIN à reason='agent_manual'.
  -- ⛔ JAMAIS pour un sujet PROFILE : suspendre le numéro d'un agent éteindrait le copilote.
  if p_event = 'opt_out' and p_kind = 'contact' then
    insert into public.contact_suppressions (channel, wa_phone, reason, source_ref,
                                             contact_id, agency_id)
    values (case when p_source in ('stop_keyword','meta_block') then 'all' else 'whatsapp' end,
            v_phone,
            case when p_source in ('stop_keyword','meta_block') then p_source else 'agent_manual' end,
            p_source_ref, p_contact_id, v_agency)
    on conflict do nothing;
  end if;

  -- Coupe les automatismes en cours dans la MÊME transaction. Domaines RELUS :
  --   whatsapp_followup_suggestions.status ∈ (suggested|accepted|dismissed)  [20260630120000:18]
  --   reminders.status ∈ (pending|triggered|done|cancelled|snoozed)          [baseline:4653]
  --   reminders.channel ∈ (email|whatsapp|task|notification)                 [baseline:4652]
  -- Le chantier écrivait status='pending' sur les suggestions : 0 ligne touchée, aucune
  -- erreur, promesse creuse à 100 %.
  if p_event = 'opt_out' and p_contact_id is not null then
    update public.whatsapp_followup_suggestions
       set status = 'dismissed', updated_at = now()
     where contact_id = p_contact_id and status = 'suggested';
    update public.reminders
       set status = 'cancelled'
     where contact_id = p_contact_id and channel = 'whatsapp'
       and status in ('pending','snoozed');
    -- Une action stashée AVANT le STOP resterait proposée à l'agent après.
    delete from public.whatsapp_pending_actions
     where tool in ('send_client_message','send_template','send_listings')
       and args->>'contact_id' = p_contact_id::text;
  end if;

  if p_kind = 'contact' and p_contact_id is not null then
    update public.contacts set
      wa_opt_in     = (p_event = 'opt_in'),
      wa_consent_at = case when p_event = 'opt_in'  then now() else wa_consent_at end,
      -- ⚠ un horodatage d'opt-out ne s'EFFACE pas, il se DATE. La version `else null`
      -- faisait réapparaître un contact ayant dit STOP comme « contactable » dans l'index
      -- partiel et dans toute liste bâtie dessus.
      wa_opt_out_at = case when p_event = 'opt_out' then now() else wa_opt_out_at end,
      wa_suppressed = exists (select 1 from public.contact_suppressions s
                              where s.contact_id = p_contact_id
                                and s.channel in ('whatsapp','all') and s.lifted_at is null)
    where id = p_contact_id;
  end if;

  return v_id;
end $$;

revoke all on function public.record_whatsapp_consent(text,text,text,text,uuid,uuid,uuid,text,text,text,jsonb,uuid,text) from public, anon;
grant execute on function public.record_whatsapp_consent(text,text,text,text,uuid,uuid,uuid,text,text,text,jsonb,uuid,text)
  to authenticated, service_role;

-- STOP d'un numéro INCONNU du CRM : pas de sujet ⇒ pas de ligne de consentement (il n'y
-- a personne à qui attribuer la déclaration). La preuve est le message lui-même, conservé
-- (whatsapp_messages.body n'est jamais purgé — 20260602110000:44-51 ne vide que `raw`).
create or replace function public.suppress_contact_phone(
  p_wa_phone text, p_channel text, p_reason text,
  p_source_ref text default null, p_agency_id uuid default null)
returns uuid language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_phone text := regexp_replace(coalesce(p_wa_phone,''), '\D','','g'); v_id uuid;
begin
  if auth.uid() is not null then raise exception 'forbidden' using errcode='42501'; end if;
  if length(v_phone) < 6 or length(v_phone) > 15 then
    raise exception 'invalid_phone' using errcode='22023'; end if;
  insert into public.contact_suppressions (channel, wa_phone, reason, source_ref, agency_id)
  values (p_channel, v_phone, p_reason, p_source_ref, p_agency_id)
  on conflict do nothing returning id into v_id;
  return v_id;
end $$;
revoke all on function public.suppress_contact_phone(text,text,text,text,uuid) from public, anon, authenticated;

create or replace function public.mark_suppression_ack_sent(p_wa_phone text)
returns void language sql security definer set search_path to 'public','pg_temp' as $$
  update public.contact_suppressions set ack_sent_at = now()
   where public.normalize_phone(wa_phone) = public.normalize_phone(p_wa_phone)
     and channel in ('whatsapp','all') and lifted_at is null and ack_sent_at is null;
$$;
revoke all on function public.mark_suppression_ack_sent(text) from public, anon, authenticated;

-- Toggle du brief : colonne ET ligne de registre dans UNE transaction. Deux écritures
-- séparées divergeaient — un 'brief_disabled' orphelin aurait bloqué le brief plus tard
-- avec `opted_out`, sans qu'aucune UI ne l'explique.
create or replace function public.set_morning_brief_enabled(p_enabled boolean)
returns void language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_num text;
begin
  select l.wa_number into v_num from public.whatsapp_agent_links l
   where l.profile_id = auth.uid() and l.verified limit 1;
  if v_num is null then raise exception 'no_verified_link' using errcode='42501'; end if;
  update public.whatsapp_agent_links set morning_brief_enabled = p_enabled
   where profile_id = auth.uid();
  perform public.record_whatsapp_consent(
    'profile', v_num,
    case when p_enabled then 'opt_in' else 'opt_out' end,
    case when p_enabled then 'agent_pairing' else 'brief_disabled' end,
    null, auth.uid(), null, 'contract', 'service', 'crm_settings', null, auth.uid(),
    'daily_brief');
end $$;
revoke all on function public.set_morning_brief_enabled(boolean) from public, anon;
grant execute on function public.set_morning_brief_enabled(boolean) to authenticated;
```

> ⚠ `set_morning_brief_enabled` écrit `agent_pairing` en opt_in : le CHECK `wa_consents_brief_scope` exige `scope='daily_brief'` **ssi** `source='brief_disabled'`. Il faut donc que la réactivation porte `scope='all'`. À l'implémentation : passer `'all'` sur la branche `p_enabled=true` (et ajuster la RPC de lecture, qui filtre déjà sur `scope in ('all', p_scope)`). Le banc L1 doit couvrir désactiver → réactiver → désactiver.

### 1.7 `20260814216000_whatsapp_pending_notices_respect_suppressions.sql`

```sql
-- Sans ça, MEGGA répond au STOP par l'avis LPD dans l'heure (cron chaque minute).
-- On n'exclut QUE stop_keyword/meta_block : un opt-out 'agent_manual' est une décision
-- de l'AGENT, pas de la personne — l'obligation d'information (art. 19 nLPD) subsiste.
create or replace function public.whatsapp_pending_notices(p_limit int default 10)
returns table(agency_id uuid, wa_phone text)
language sql security definer set search_path to 'public','pg_temp' as $$
  select distinct m.agency_id, m.wa_from
  from public.whatsapp_messages m
  where m.direction = 'inbound'
    and m.agency_id is not null
    and m.created_at > now() - interval '24 hours'
    and not exists (select 1 from public.whatsapp_notices n
                    where n.agency_id = m.agency_id and n.wa_phone = m.wa_from)
    and not exists (select 1 from public.contact_suppressions s
                    where public.normalize_phone(s.wa_phone) = public.normalize_phone(m.wa_from)
                      and s.channel in ('whatsapp','all') and s.lifted_at is null
                      and s.reason in ('stop_keyword','meta_block'))
  limit greatest(p_limit, 1);
$$;
revoke all on function public.whatsapp_pending_notices(int) from public, anon, authenticated;
```

---

## 2. LA GARDE

### 2.1 Où elle vit

`supabase/functions/_shared/whatsapp-outbound-guard.ts`.

Elle **ne peut pas** vivre dans `MetaProvider` : `buildSendTextRequest` (`whatsapp-gateway.ts:239`) ne reçoit qu'un `toPhone` en chiffres nus, ni `contactId` ni `agencyId`. Elle **ne peut pas** vivre dans `sendWithRetry` seul : 4 `fetch` bruts l'évitent (`whatsapp-webhook:244`, `:695`, `:1027`, `:1071`, plus `whatsapp-morning-brief:292`), dont **deux chemins CLIENT**. Elle **remplace** donc l'ensemble build + exécution, et devient le seul endroit du dépôt qui appelle `provider.build*Request` hors de la gateway.

### 2.2 Signature finale

```ts
export type OutboundPurpose =
  | 'service' | 'utility' | 'marketing' | 'lpd_notice' | 'opt_out_ack'

/** Motif PRÉCIS — journalisé, jamais affiché tel quel à un agent. */
export type GuardReason =
  | 'invalid_phone' | 'subject_mismatch' | 'phone_suppressed'
  | 'ack_without_suppression' | 'ack_already_sent' | 'agent_link_unverified'
  | 'do_not_contact' | 'opted_out' | 'no_opt_in' | 'marketing_requires_consent'
  | 'window_closed' | 'kill_switch'

/** Motif EXPOSABLE — ce que le site d'appel a le droit de montrer. */
export type PublicReason = GuardReason | 'not_contactable'

export type OutboundPayload =
  | { type: 'text';     body: string }
  | { type: 'image';    url: string; caption?: string }
  | { type: 'document'; mediaId: string; filename: string; caption?: string }
  | { type: 'template'; key: WaTemplateKey; message: TemplateMessage }

export interface SendOutboundArgs {
  admin:    SupabaseClient
  provider: WhatsAppProvider
  config:   SendConfig
  to:       string                  // brut ; normalisé DANS la garde
  purpose:  OutboundPurpose         // ⚠ littéral de chaîne obligatoire (porte CI)
  payload:  OutboundPayload
  /** Sujet DÉCLARÉ à titre d'indice. La RPC le VÉRIFIE et peut le contredire. */
  contactId?: string | null
  profileId?: string | null
  agencyId?:  string | null         // agence de l'APPELANT — pilote la visibilité du motif
  scope?:     'all' | 'daily_brief'
  sentByProfileId?: string | null
  isAutomated?: boolean             // parité colonne whatsapp_messages.is_automated
  retry?: boolean
  /** Défaut TRUE pour tout payload non-template. Fail-closed. */
  requireWindow?: boolean
  /** Appelé sur `window_closed` avant de rendre le refus (repli template HITL). */
  onWindowClosed?: () => Promise<boolean>
}

export type SendOutboundResult =
  | { ok: true;  providerMessageId: string | null; inWindow: boolean }
  | { ok: false; blocked: true;  reason: GuardReason; publicReason: PublicReason
                 inWindow: boolean; fallbackOffered: boolean }
  | { ok: false; blocked: false; error: string; inWindow: boolean }

export async function sendOutboundGuarded(a: SendOutboundArgs): Promise<SendOutboundResult>
```

Trois décisions portées par cette signature :

- **`kind` a disparu.** Le sujet est dérivé en SQL. `contactId`/`profileId` sont des *indices vérifiés*, pas des déclarations.
- **Le résultat est un TRIPLET.** Aujourd'hui `sendWhatsAppText` rend `{ok:false,error}` pour tout, et l'alerte d'échec (`whatsapp-webhook:805`) préviendrait l'agent d'un « échec de livraison » pour un refus de consentement — un mensonge.
- **`optOutAck` n'est plus un booléen TS.** Il est devenu `purpose:'opt_out_ack'`, arbitré **en SQL** (cf. `contact_suppressions.ack_sent_at`). Un argument TS libre était contournable par n'importe lequel des 12 sites d'envoi.

### 2.3 Ordre des vérifications

1. **Normalisation** `to.replace(/\D/g,'')`, longueur **6 ≤ n ≤ 15** → sinon `invalid_phone`. **Aucun appel réseau.** La borne haute est ce qui empêche un JID de groupe (`120363…@g.us` → 18 chiffres) de faire échouer l'insert, donc de rendre 500, donc de déclencher une tempête de rejeux Meta.
2. **Kill-switch** `app_config.whatsapp_enabled` (`isWhatsAppEnabled`). Gain réel : `whatsapp-agent-async` et `kyc-report-pdf` — les deux seules fonctions qui ne le vérifient pas.
3. **`whatsapp_send_allowed(...)`**, dont l'ordre interne est : sujet dérivé → **suppression par numéro** → fenêtre + relation → `lpd_notice` → branche de sujet. La suppression passe **avant le consentement, toujours**.
4. **Routage 24 h** : `payload.type !== 'template' && !inWindow && requireWindow` → `window_closed`. La marge de 15 min vit **ici**, pas dans la RPC (donc testable séparément). `requireWindow` **vaut true par défaut** pour tout payload non-template : un défaut qui échoue OUVERT sur une garde de conformité est le mauvais sens.
   → **avant de rendre le refus**, la garde appelle `onWindowClosed()` s'il est fourni, et renseigne `fallbackOffered`. Sans ce crochet, refuser avant le POST rendrait `offerTemplateFallback` (`whatsapp-webhook:1077`) **du code mort** : c'est le `!sres.ok` du 131047 qui le déclenche aujourd'hui, et l'agent recevrait un refus sec à la place de la proposition de template.
5. **Build** via `provider.build*Request` — dernier point du dépôt à le faire.
6. **Exécution** via `sendWithRetry` — supprime les 5 `fetch` bruts.
7. **Persistance** `whatsapp_messages` (upsert `onConflict:'provider,provider_message_id'`), à l'identique de l'existant. Sur `purpose:'opt_out_ack'` réussi → `mark_suppression_ack_sent(to)`.

> ⚠ La garde **ne pose PAS** de ligne `queued` avant le POST : `whatsapp_messages_status_check` (`20260628150000:17`) n'a pas ce barreau, et l'échelle est lue par le filtre d'UPDATE de `parseStatusUpdates`. L'idempotence pré‑POST est un chantier distinct — ne pas le glisser dans le lot conformité.

### 2.4 Ce qu'elle rend et ce qu'elle journalise

| Événement | `action` | `category` | `severity` | `actor_kind` |
|---|---|---|---|---|
| refus | `whatsapp_send_blocked` | `messaging` | `warn` | `system` (`actor_id` NULL) |
| échec Meta | `whatsapp_send_failed` | `messaging` | `warn` | `system` |
| envoi | rien — l'événement métier reste au site d'appel (`whatsapp_ai_send_client_message`, …) | | | |

`metadata` : `{ reason, subject_kind, purpose, payload_type, in_window, phone_tail: to.slice(-4) }`. **Jamais le numéro complet** — `activity_events` est append‑only et conservé dix ans ; y recopier un numéro créerait une seconde rétention hors registre.

⚠ Le test qui accompagne ça n'est **pas** « ça ne jette pas » : c'est `count(*) > 0` après un refus. Le code actuel avale ses violations de contrainte dans un `catch` (`whatsapp-webhook:379`), ce qui rend l'audit silencieusement inexistant. Un test « ne jette pas » reproduirait le bug.

---

## 3. LE STOP

### 3.1 Trois points d'interception, pas un

**Point A — bouton Meta, AVANT la bifurcation agent/client.**
`supabase/functions/whatsapp-webhook/index.ts`, **après la ligne 105** (`const msg = provider.parseInbound(payload)`, bloc `if (!msg)` compris) et **avant la ligne 120** (`// ── 2bis. Résolution d'expéditeur AGENT`).

Ne déclenche **que** sur un opt‑out de type *bouton* (`message.button` / `message.interactive`), jamais sur du texte libre. C'est ce qui résout la contradiction entre les deux exigences : `stop` appartient déjà au jeu `NO` de `parseConfirmation` (`whatsapp-agent-router.ts:339` : `['non','no','n','annule','annuler','stop','cancel','laisse','laisse tomber']`) — un agent qui refuse une action en tapant « stop » ne doit pas se désinscrire. Mais Meta exige que l'opt‑out de ses propres templates marketing soit honoré, **y compris pour un agent**.

- numéro **apparié vérifié** → `record_whatsapp_consent(kind:'profile', event:'opt_out', source:'meta_block', scope:'daily_brief')` + `morning_brief_enabled=false`. **Jamais** de suppression par numéro : elle éteindrait le copilote de l'agent.
- sinon → chemin client (Point B).

**Point B — texte, dans la branche CLIENT.**
`whatsapp-webhook/index.ts`, **entre la ligne 272** (fin du `try` de `resolve_contact_by_phone`, ouvert :266) **et la ligne 282** (`isTriageEligible`).

Trois contraintes d'ordre, chacune ancrée :
- **APRÈS la branche agent (`:120-250`)** — non négociable (cf. `parseConfirmation`).
- **APRÈS `resolve_contact_by_phone`** — pour disposer du `contact_id` quand il existe, et écrire une vraie ligne de consentement plutôt qu'une suppression anonyme.
- **AVANT `ensureLeadForInboundPhone` (`:282`)** — créer une fiche « Prospect 1234 » pour quelqu'un qui demande qu'on le laisse tranquille est exactement le geste à éviter, et c'est ce qui lui donne un `agency_id`, donc son entrée dans `whatsapp_pending_notices`, donc **une réponse automatique à son STOP**.

**Point C — note vocale / image, dans le cron.**
`supabase/functions/whatsapp-process/index.ts`, Phase 1, **entre la ligne 140** (dernière écriture de `patch.transcript`) **et la ligne 145** (`update(patch)`).

Sans lui, « arrêtez de m'écrire » dit **à l'oral** n'est jamais détecté : `parseInbound` rend `body: text?.body ?? mediaObj?.caption ?? null` (`whatsapp-gateway.ts:196`) — pour `audio`/`voice` il n'y a pas de `caption`, donc `body = null`, donc `isStopRequest(null) === false`. Or la note vocale est un canal majoritaire côté client, et la transcription Deepgram n'arrive qu'ici, une minute plus tard. Même trou pour un STOP écrit dans une image/PDF (rangé dans `transcript` par Gemini, `:135-140`).

Idempotence : ajouter `stop_handled_at timestamptz` sur `whatsapp_messages` et l'écrire dans le même `patch` — sinon le cron rejoue à chaque tick. Phase 1 (`:111`) précède Phase 3 (`:231`) dans le **même** tick, donc la suppression écrite ici exclut le numéro de l'avis LPD du tick courant.

### 3.2 Séquence de la branche STOP (Points B et C)

L'insert idempotent est extrait en helper local `insertInboundOnce()` pour ne pas dupliquer le bloc `:336-355`.

```
1. bornage : digits = to.replace(/\D/g,''); if (len<6 || len>15) → pas de STOP, flux normal
2. insertInboundOnce(...)  → { id } | null                  [Point B seulement]
3. si null → return 200 { routed: 'client_duplicate_stop' }  // gate d'idempotence Meta
4. try {
     contact connu   → record_whatsapp_consent(kind:'contact', event:'opt_out',
                          source:'stop_keyword', source_ref:<whatsapp_messages.id>)
     contact inconnu → suppress_contact_phone(phone,'all','stop_keyword',<id>,agencyId)
   } catch (e) { console.warn(...) }   // ⛔ le webhook ne rend JAMAIS 500 sur une erreur
                                       //    métier (même règle que resolveTriageAgencyId :285)
5. ── ACK 200 IMMÉDIAT ──
6. EdgeRuntime.waitUntil(async () => {
     sendOutboundGuarded({ purpose:'opt_out_ack', payload:{type:'text', body:ACK[lang]} })
     upsert whatsapp_notices(agency_id, wa_phone)   // l'ACK a porté l'avis LPD
     markRead(provider, msg.providerMessageId, false)
   })
```

L'effet de bord est **derrière** le gate d'idempotence : un rejeu Meta ne renvoie pas deux accusés. Le motif copié est celui de la branche agent (`:135-154`, `routed:'agent_duplicate'`), verrouillé par `tests/backend/whatsapp-inbound-idempotency.spec.ts`. L'ACK part en `waitUntil` — la branche agent le fait déjà pour cette raison exacte (`:161-166` : « si on attend avant de répondre 200, Meta considère l'event en échec et REJOUE »).

### 3.3 Détection — `supabase/functions/_shared/whatsapp-stop-keywords.ts`

Détecteur **indépendant de la langue** : ne jamais passer par `detectLang`, qui ne connaît que `fr`/`en` (`whatsapp-i18n.ts:11-26`) alors que le corpus client est en 4 langues (`whatsapp-templates.ts:104-204`). La liste qui matche **renseigne** la langue de l'accusé.

```ts
/** trim + minuscules + accents retirés + ponctuation/emoji → espace. Sans le retrait
 *  d'accents, « arrêt » et « arret » divergent. Parité avec parseConfirmation. */
export function normalizeForStop(raw: string | null | undefined): string {
  return (raw ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Régime 1 : le message EST le mot-clé. Sans ambiguïté possible. */
const EXACT: Record<StopLang, string[]> = {
  xx: ['stop', 'stopp', 'stop promotions', 'stop all', 'unsubscribe',
       'opt out', 'optout', 'cancel', 'end', 'quit', 'remove me'],
  fr: ['arret', 'arrete', 'arretez', 'desabonnement', 'desabonner', 'me desabonner',
       'desinscription', 'desinscrire', 'me desinscrire'],
  de: ['abmelden', 'abmeldung', 'abbestellen', 'keine werbung', 'stopp werbung', 'loschen'],
  it: ['cancellami', 'disiscrivimi', 'annulla iscrizione', 'cancella iscrizione', 'basta'],
  en: [],
}

/** Régime 2 : le message CONTIENT la demande. Borné en longueur (voir isStopRequest). */
const PHRASES: Record<StopLang, string[]> = {
  fr: ['ne plus me contacter', 'ne me contactez plus', 'ne m ecrivez plus',
       'plus de messages', 'je ne veux plus recevoir', 'supprimez mes donnees',
       'retirez moi de votre liste'],
  de: ['nicht mehr kontaktieren', 'keine nachrichten mehr', 'keine weiteren nachrichten',
       'loschen sie meine daten', 'von der liste nehmen'],
  en: ['do not contact me', 'dont contact me', 'stop messaging me', 'stop sending me',
       'take me off', 'remove me from your list', 'delete my data'],
  it: ['non contattarmi piu', 'non voglio piu ricevere', 'non inviatemi piu',
       'toglietemi dalla lista', 'cancellate i miei dati'],
  xx: [],
}

/** Rend la LANGUE détectée (pour l'accusé), ou null si ce n'est pas un STOP. */
export function detectStopRequest(raw: string | null | undefined): StopLang | null {
  const s = normalizeForStop(raw)
  if (!s) return null
  for (const [lang, words] of Object.entries(EXACT)) if (words.includes(s)) return lang as StopLang
  // Borne 160 caractères : au-delà, « stop messaging me » est probablement CITÉ, pas
  // demandé. Asymétrie assumée — un faux positif coûte un contact silencieux, visible
  // dans le CRM et réactivable par l'agent ; un faux négatif coûte une plainte Meta sur
  // un WABA partagé par TOUS les tenants.
  if (s.length > 160) return null
  for (const [lang, ps] of Object.entries(PHRASES)) if (ps.some((p) => s.includes(p))) return lang as StopLang
  return null
}
```

**Le bouton d'opt-out de Meta est aujourd'hui INVISIBLE**, et c'est le chemin que Meta met en avant. `parseInbound` ne lit que `message.text.body` ou `mediaObj.caption` ; `button` et `interactive` ne sont ni dans `META_TYPE_TO_MEDIA` ni porteurs de `caption` ⇒ `body = null`. Correctif dans `whatsapp-gateway.ts:196` :

```ts
const button = message.button as { text?: string; payload?: string } | undefined
const interactive = message.interactive as {
  button_reply?: { id?: string; title?: string }
  list_reply?:   { id?: string; title?: string }
} | undefined
// …
body: text?.body
  ?? mediaObj?.caption
  ?? button?.text ?? button?.payload      // payload SEULEMENT si text absent :
  ?? interactive?.button_reply?.title     // ne pas injecter d'identifiants techniques
  ?? interactive?.list_reply?.title       // dans le corpus de voix
  ?? null,
```

Effet de bord réparé au passage : ces messages échouaient aussi `isTriageEligible` (body vide) et restaient orphelins.

> ⚠ **Rectification de l'argumentaire.** La conception justifiait ce correctif par `agent_daily_brief`, « approuvé en MARKETING par Meta » (constat réel, `whatsapp-templates.ts:157`). Mais ce template **n'est envoyé nulle part** : `whatsapp-morning-brief:291` envoie du **texte libre** via `buildSendTextRequest`. L'argument tient pour `followup` et `new_listings`, pas pour le brief.

### 3.4 Ce que le STOP écrit

| Cas | Écriture |
|---|---|
| contact connu | `whatsapp_consents(subject_kind='contact', event='opt_out', source='stop_keyword', legal_basis='consent', source_ref=<whatsapp_messages.id>)` → qui insère en cascade `contact_suppressions(channel='all', reason='stop_keyword')`, écarte les suggestions `suggested`, annule les `reminders` WhatsApp, supprime l'action stashée et met le cache `contacts` à jour — **dans la même transaction** |
| numéro inconnu, agence indéterminable | `contact_suppressions(channel='all', reason='stop_keyword', agency_id=NULL, contact_id=NULL)` seul. Pas de ligne de consentement : sans sujet, il n'y a pas de déclaration à attribuer |
| bouton Meta, numéro client | idem, `source='meta_block'` |
| bouton Meta, numéro **agent** | `whatsapp_consents(subject_kind='profile', source='meta_block', scope='daily_brief')` + `morning_brief_enabled=false`. **Aucune** suppression |

`pickTriageAgency` (`whatsapp-lead-triage.ts:25`) renvoie délibérément `null` dès qu'il y a ≥ 2 agences vérifiées : `agency_id` **doit** être nullable dans `contact_suppressions`, et un NULL vaut « toutes agences » à la lecture — ce que la RPC réalise en ne filtrant **jamais** sur l'agence à l'étape 3.

### 3.5 L'accusé de désinscription porte l'avis LPD

C'est le **seul message** que recevra jamais une personne dont le premier message est « stop ». Il ne peut donc pas se réduire à « c'est noté ». Texte à écrire dans les **4 langues** (`_shared/whatsapp-stop-ack.ts`), contenu minimal :
qui traite (raison sociale de l'agence constatante, ou « MEGGA » si `agency_id` est NULL), quelles données (numéro + contenu des messages), pourquoi (relation immobilière), durée, comment exercer ses droits (adresse e‑mail + lien vers la politique), et la confirmation du retrait. Une fois par suppression (`contact_suppressions.ack_sent_at`), jamais deux.

### 3.6 Pourquoi un inbound ne vaut JAMAIS opt-in

Ce sont **deux objets différents**. L'inbound ouvre la **fenêtre de service** ; il ne produit pas de **consentement**. La fenêtre est un fait calculé (`max(wa_timestamp) > now()-24h`), révocable par le temps seul, que Meta accorde sans rien demander. Le consentement est une **déclaration** de la personne, datée, motivée, révocable par elle.

1. **nLPD art. 6 al. 6 / art. 31** : le consentement suppose une information préalable adéquate. « bonjour c'est pour l'appartement de la rue X » ne porte aucune information sur ce que la personne recevra ensuite, de qui, ni pour combien de temps. Un `proof` construit à partir d'un inbound serait une preuve de rien.
2. **Le STOP deviendrait auto-annulant.** Le chantier n'implémentait B3 que par `IF v_dnc AND p_source NOT IN (...)` : un opt-out d'une autre source était **réactivé par un simple inbound**. Ici la faille n'existe pas — `wa_inbound` est absent du CHECK `wa_consents_event_source`. La règle est **structurelle**, pas conditionnelle.
3. **Le WABA est partagé.** Un inbound-vaut-opt-in transforme chaque prospect qui écrit une fois en cible de template marketing pour toutes les agences.
4. **C'est inutile.** `ok_service_window` couvre déjà le cas légitime. Écrire un opt-in pour ça n'ajoute aucune capacité — seulement une fausse preuve.

Corollaire : **le seul chemin d'opt-in par WhatsApp est `click_to_wa`**, où la personne clique un lien `wa.me?text=<jeton HMAC signé>` reçu sur un canal *déjà consenti* (Resend). On ne démarche jamais sur WhatsApp pour obtenir le consentement WhatsApp. `MEGGA_MAGIC_LINK_HMAC_SECRET` est configuré (mesuré 03.08.2026) — le socle de signature existe.

---

## 4. LE CÂBLAGE — 12 sites, 13 appels

Vérifié par grep sur `buildSend*Request` / `sendWithRetry` / `graph.facebook.com`.

### Chemins CLIENT (5) — priorité absolue, ils écrivent aujourd'hui sans aucune garde

| # | Fichier:ligne | Ce que c'est | Ce que la garde reçoit |
|---|---|---|---|
| 1 | `whatsapp-webhook/index.ts:1025` (fetch brut `:1027`) | `send_template` — **seul envoi hors fenêtre 24 h**, le plus sensible | `purpose:'utility'` (`'marketing'` pour `new_listings`), `contactId` `:1011`, `agencyId: agentLink.agency_id`, phone relu depuis `contacts.phone` `:1015` |
| 2 | `whatsapp-webhook/index.ts:1069` (fetch brut `:1071`) | `send_client_message` — texte libre | `purpose:'service'`, `requireWindow` par défaut, `onWindowClosed: () => offerTemplateFallback(...)` (préserve `:1077`) |
| 3 | `whatsapp-webhook/index.ts:1141` (via `sendWhatsAppText` `:673`) | `send_listings`, texte | `purpose:'service'`. ⚠ `contactId` peut valoir `null` (`String(...) || null`, `:1139`) et le `phone` est **figé au stash** (`whatsapp-actions.ts`), pas relu. **Corriger la SOURCE** : rendre `contact_id` obligatoire au stash et relire `contacts.phone` à l'exécution. Sans `contactId`, la RPC dérive le sujet par numéro et refuse `no_opt_in` si ≥2 fiches — **fail closed** |
| 4 | `whatsapp-webhook/index.ts:1179` (via `sendWhatsAppImage` `:690`) | `send_listings`, jusqu'à 5 photos | **Garde par GESTE, pas par message** : appeler AVANT la boucle `:1173-1196`, sinon 6 déclenchements pour un seul « oui » |
| 5 | `whatsapp-process/index.ts:246-247` | Avis LPD — **seul envoi client sans humain**, cron chaque minute | `purpose:'lpd_notice'`. Exiger un `contactId` le tuerait : `whatsapp_pending_notices` ne rend que `(agency_id, wa_phone)`. C'est le seul site autorisé à ce `purpose` (porte CI §5/L6) |

### Chemins AGENT (7 sites, 8 appels)

| # | Fichier:ligne | Ce que c'est |
|---|---|---|
| 6 | `whatsapp-webhook/index.ts:243` (fetch brut `:244`) | Confirmation d'appairage. `profileId` connu — le lien vient de passer `verified=true` `:225-231`, donc la RPC le voit |
| 7 | `whatsapp-webhook/index.ts:506` (via `sendWhatsAppText`) | Confirmation d'annulation (`/annuler`) |
| 8 | `whatsapp-webhook/index.ts:586` (via `sendWhatsAppText`) | Réponse du copilote DeepSeek |
| 9 | `whatsapp-webhook/index.ts:805` (via `sendWhatsAppText`) | Alerte d'échec de livraison. ⚠ **Piège de classification** : ce site connaît un `contact_id` CLIENT (`row.contact_id`, `:752`) alors qu'il écrit à un AGENT (`waNumber`, `:783-790`). Passer `profileId`, **jamais** `contactId`. Le critère est le numéro destinataire |
| 10 | `whatsapp-morning-brief/index.ts:291` (fetch brut `:292`) | Brief quotidien, cron. `profileId: link.profile_id`, `scope:'daily_brief'` |
| 11 | `whatsapp-agent-async/index.ts:49-50` (helper `sendToAgent`, appelé `:112` et `:124`) | Résultat KYC async + échec terminal. **Ignore le kill-switch aujourd'hui** |
| 12 | `kyc-report-pdf/index.ts:110-117` | PDF du rapport KYC. **Ignore le kill-switch.** ⚠ Point d'entrée le plus faible du dépôt : `to_phone` est un **paramètre libre du corps** (`:41-47`), gardé par le seul `isServiceSecret` (`:39`) — rien ne vérifie qu'il désigne un agent de `agency_id`. La garde le ferme : le sujet dérivé exige un `whatsapp_agent_links` **vérifié** sur ce numéro, sinon `agent_link_unverified` |

Non-messages, hors périmètre : `markRead` (`:832`), `uploadMetaMediaDocument` / `fetchMetaMedia` (`_shared/whatsapp-media.ts:39,77`), `debug_token` (`_shared/whatsapp-token.ts:34`).

---

## 5. ORDRE DES ÉTAPES — ce qui est protégé, et ce qui ne l'est pas encore

| Lot | Contenu | **Protégé à la fin du lot** | **Toujours ouvert** |
|---|---|---|---|
| **L0** | `parseInbound` : `button`/`interactive` → `body` ; bornage 6–15 chiffres partout. 1 fichier, 0 migration | Le bouton d'opt-out Meta cesse d'être invisible ; les messages boutons cessent d'être orphelins | Rien n'agit encore sur ce signal |
| **L1** | Les 7 migrations §1 + banc backend (forme des tables, 12 motifs de la RPC, EXPLAIN sur la fenêtre, `drop function` → `count(pg_proc)=2`) | **Rien en production.** C'est la porte, pas le mur — aucun appelant | Les 12 sites envoient toujours sans garde |
| **L2** | Le STOP : 3 points d'interception, `whatsapp-stop-keywords.ts`, accusé LPD 4 langues, `stop_handled_at`, `whatsapp_pending_notices` durcie | Le refus de la personne est **enregistré, opposable, et coupe les automatismes** : suggestions, rappels WhatsApp, action stashée, avis LPD. La preuve existe | **Les 12 sites d'envoi ne consultent toujours rien** : un agent peut écrire à quelqu'un qui a dit STOP la seconde d'avant |
| **L3** | `whatsapp-outbound-guard.ts` + câblage des **5 chemins CLIENT** (sites 1–5) + `prepareSendListings` (contact_id obligatoire, phone relu) | Les 5 envois vers un client sont gardés. L'avis LPD respecte le STOP. Le repli template HITL survit via `onWindowClosed` | Les 7 chemins agent ; le kill-switch reste percé sur `whatsapp-agent-async` et `kyc-report-pdf` |
| **L4** | Câblage des **7 chemins AGENT** (sites 6–12) + `set_morning_brief_enabled` (remplace l'UPDATE PostgREST direct) | Canal agent gardé ; `kyc-report-pdf` cesse d'accepter un `to_phone` arbitraire ; kill-switch réellement global ; le toggle du brief ne coupe **que** le brief | L'UI ne dit toujours rien à l'agent |
| **L5** | UI CRM : badge d'état sur la fiche contact (lit `wa_suppressed`/`wa_opt_out_at`), bouton « Envoyer » grisé avec **motif exposable**, geste « ne plus contacter » (`record_whatsapp_consent` source `agent_manual`), journal de consentement | L'agent comprend un refus au lieu de réessayer en boucle | Le canal e-mail |
| **L6** | Portes CI + réconciliation nocturne cache↔registre | Un 13ᵉ site d'envoi ne peut plus naître sans garde | — |

**Portes CI de L6** (le grep de symboles ne suffit pas — les trois trous les plus graves passaient par le bon symbole avec un mauvais argument) :
1. Aucun `buildSend(Text|Image|Document|Template)Request` hors `_shared/whatsapp-gateway.ts` et `_shared/whatsapp-outbound-guard.ts`.
2. Tout `sendOutboundGuarded(` porte `purpose:` en **littéral de chaîne** — jamais une variable.
3. `purpose: 'lpd_notice'` autorisé **uniquement** dans `whatsapp-process/index.ts` ; `purpose: 'opt_out_ack'` **uniquement** dans la branche STOP du webhook et de `whatsapp-process`.
4. Test unitaire : un numéro appartenant à un contact opté-out est refusé même appelé avec `purpose:'lpd_notice'` **et** une suppression `stop_keyword` active.

---

## 6. CE QU'IL NE FAUT PAS FAIRE — et ce qui reste ouvert

### 6.1 Ne pas faire

- **Ne pas ajouter `queued` à `whatsapp_messages.status`.** L'échelle est monotone et lue par le filtre d'UPDATE de `parseStatusUpdates`. L'idempotence pré-POST est un autre chantier.
- **Ne pas poser de FK sur `contact_id`.** `contacts_delete` (baseline:7546) autorise le DELETE dur à tout `authenticated`, et `delete_contact` est un outil WhatsApp exposé à l'agent. Une CASCADE ferait disparaître la preuve au moment où elle sert ; un SET NULL la rendrait anonyme.
- **Ne jamais faire confiance à un `kind`/sujet déclaré par l'appelant.** C'est la faille qui rendait l'avis LPD — seul envoi client sans humain — exempt de tout le registre.
- **Ne pas re-résoudre le contact dans la garde via `resolve_contact_by_phone`.** Elle est **globale** par conception (`20260617091000:38`) : en `service_role`, elle lierait l'envoi de l'agence A au contact de l'agence B, avec un audit au mauvais `agency_id`. Corriger la source (le stash), pas le symptôme.
- **Ne jamais `DELETE` une suppression**, et ne jamais la lever globalement. La levée est **par sujet**, calculée dans la RPC, à partir d'un opt-in personnel `click_to_wa`/`web_form_doubleoptin`.
- **Ne jamais écrire d'opt-in depuis un inbound**, ni ajouter `wa_inbound` au CHECK. La règle doit rester structurelle.
- **Ne pas stocker IP ni user-agent en clair dans `proof`.** `user_consents.ip_hash` (`20260705170000:30`) est le précédent maison.
- **Ne pas recopier le numéro complet dans `activity_events`** (append-only, 10 ans → seconde rétention hors registre). `phone_tail` seulement.
- **Ne pas mettre `force row level security` sur `whatsapp_consents`** : la RPC d'écriture est SECURITY DEFINER owned by `postgres` et n'a pas de policy INSERT. Le verrou est le trigger.
- **Ne pas écrire un test « la RPC ne jette pas ».** Un UPDATE qui matche 0 ligne ne lève rien — c'est exactement comme ça que la coupure des relances était creuse. Asserter des **compteurs**.
- **Ne pas laisser le webhook rendre 500 sur une erreur métier.** Un STOP dans un groupe WhatsApp suffit à déclencher une tempête de rejeux Meta.
- **Ne pas utiliser `create or replace function` sans `drop function if exists` de la signature exacte** : changement de type de retour = migration en échec (deploy bloqué la journée) ; ajout de paramètre = surcharge = PGRST203 sur tous les appels.
- **Ne pas dater les migrations d'un autre jour que le merge** (date-guard `deploy.yml`).
- **Ne pas exposer le motif précis à un agent.** `phone_suppressed` dit à l'agence B qu'un numéro a écrit STOP à l'agence A — l'oracle exact que la policy RLS cache. Utiliser `publicReason`.

### 6.2 Problèmes bloquants qui restent ouverts après L6

1. **La note vocale a une latence d'un tick.** Le STOP oral n'est vu qu'au passage suivant de `whatsapp-process` (cron 1 min + budget 90 s). Un envoi lancé entre-temps part. Et si l'avis LPD est parti au tick d'avant, il est parti. Irréductible sans transcription synchrone dans le webhook — ce qui retarderait l'ACK Meta. **À dire à l'utilisateur, pas à masquer.**
2. **TOCTOU consentement↔POST.** Un opt-out arrivé entre le check et le POST n'annule pas le message en vol. Le verrouiller demanderait un `FOR UPDATE` sur `contacts` à chaque envoi. Fenêtre de l'ordre de la seconde ; le STOP coupe le message *suivant*. **À écrire dans le test, pas à corriger.**
3. **Le canal e-mail n'est PAS gardé.** Six expéditeurs Resend (`send-relance-email`, `send-reminder-email`, `send-property-email`, `send-visit-email`, `send-email`, `weekly-digest`) ne lisent aucun registre et n'émettent aucun `List-Unsubscribe`. Pire : `send-relance-email:67` promet « Si vous ne souhaitez plus recevoir de messages, répondez avec « STOP » » depuis `noreply@megga.ch`, **sans `reply_to`** et sans aucune réception d'e-mail dans le dépôt — une promesse qui ne peut structurellement pas être tenue. `contact_suppressions.channel` est prêt ; le câblage ne l'est pas. Une personne qui écrit STOP sur WhatsApp continue de recevoir des relances par e-mail.
4. **Aucun chemin d'opt-in n'est construit.** `click_to_wa` (lien signé HMAC envoyé par Resend) n'est dans aucun de ces lots. Conséquence au jour 1 : `purpose:'marketing'` = **0 envoi possible** (aucune ligne `legal_basis='consent'` n'existe), et `utility` ne passe que sur relation d'affaires < 30 j. C'est le geste suivant à planifier, sinon la garde sera perçue comme cassée.
5. **`normalize_phone` = 9 derniers chiffres.** Collision possible entre pays. Inerte au pilote CH ; bloquant à l'ouverture FR/US, où il faudra une clé E.164 complète — donc une normalisation du chemin sortant, qui n'existe pas aujourd'hui.
6. **`whatsapp_messages.body` n'est jamais purgé.** `whatsapp-purge-raw-daily` (`20260602110000:44-51`) ne vide que `raw`. Le message de la personne qui a dit STOP reste indéfiniment. `redact_whatsapp_consent` couvre le registre, pas le fil.
7. **Le brief agent part en texte libre**, donc dépend de la fenêtre 24 h avec l'agent. Avec `requireWindow` par défaut, un brief hors fenêtre sera désormais refusé `window_closed` **avant** le POST au lieu d'échouer en 131047 après. Le résultat est identique pour l'agent (pas de brief) mais devient **visible dans `activity_events`** — c'est un gain d'observabilité, pas une régression, mais il faut s'attendre à voir apparaître ces refus.
8. **`agent_daily_brief` est approuvé MARKETING mais jamais envoyé.** À décider : soit le brancher (et alors il exige un opt-in marketing pour un message destiné à l'agent lui-même, ce qui est absurde et plaide pour l'appel `IN_APPEAL` vers UTILITY), soit le retirer du registre de templates.
9. **`set_morning_brief_enabled` et le CHECK `wa_consents_brief_scope`** : la branche de réactivation doit écrire `scope='all'` (sinon le CHECK la rejette). Point à couvrir explicitement au banc L1 — c'est le genre d'incohérence qui ne se voit qu'au troisième aller-retour du toggle.
