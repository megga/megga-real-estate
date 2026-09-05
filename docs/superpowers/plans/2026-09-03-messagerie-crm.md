# Messagerie CRM (boîte mail intégrée) — plan maître

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Plan **autonome**, écrit pour être ouvert dans une session neuve. Il ne suppose
> aucune conversation antérieure. Mesures faites le **3 septembre 2026** sur
> `main` = `b196153f` (branche de travail : `claude/real-estate-crm-messaging-5ef3e3`).
>
> Ce fichier est le **maître** : contexte, décisions, architecture, modèle de
> données, travail hors dépôt, portes CI. Les tâches vivent dans trois lots,
> à exécuter **dans l'ordre** :
>
> | Lot | Fichier | Livre |
> |---|---|---|
> | 1 | [2026-09-03-messagerie-crm-lot1-backend.md](2026-09-03-messagerie-crm-lot1-backend.md) | tables, Vault, OAuth (Google + Microsoft), synchronisation, envoi, actions, pièces jointes |
> | 2 | [2026-09-03-messagerie-crm-lot2-front.md](2026-09-03-messagerie-crm-lot2-front.md) | l'écran de la maquette en MEGGA X, la pop-up OAuth, les 7 modales, i18n, gardes |
> | 3 | [2026-09-03-messagerie-crm-lot3-imap.md](2026-09-03-messagerie-crm-lot3-imap.md) | IMAP/SMTP (Infomaniak, Bluewin, autre boîte) derrière un spike qui prouve la faisabilité |
>
> Chaque lot commence par « ce qu'il faut avoir lu ». Un lot livré = build vert,
> tests verts, portes CI vertes, **et** la fonctionnalité éprouvée de bout en bout
> sur une vraie boîte (§7.4).

**Goal:** Donner au CRM une boîte mail intégrée (lire, classer, répondre, transférer, composer, rattacher au contact, classer une pièce au dossier) branchée sur les boîtes réelles des agents (Google Workspace, Outlook/M365, puis IMAP), en reproduisant au pixel la maquette Claude Design « Messagerie » transposée en MEGGA X.

**Architecture:** Un module `mail_*` en base (comptes, fils, messages, pièces, libellés) alimenté par une synchronisation incrémentale par fournisseur (Gmail API `history`, Microsoft Graph `delta`), pilotée par pg_cron et par des déclenchements à la demande ; les jetons vivent dans Supabase Vault derrière des ponts `SECURITY DEFINER` service-role ; l'écran React lit par PostgREST/RPC sous RLS et agit par quatre edge functions (`mail-oauth`, `mail-sync`, `mail-actions`, `mail-send`) plus un proxy de pièces jointes (`mail-attachment`). L'autorisation OAuth s'ouvre dans une **pop-up** dont le retour est relayé à la fenêtre d'origine par `postMessage`.

**Tech Stack:** React 18 + TypeScript + Vite · TanStack Query · react-i18next (FR/DE/EN/IT) · Supabase (Postgres 17 en local et en CI — `supabase/config.toml` `major_version = 17`, mesuré le 03.09.2026 ; RLS, Vault, Realtime, pg_cron, Edge Functions Deno) · Gmail API v1 · Microsoft Graph v1.0 · DOMPurify (rendu HTML des mails) · Vitest + Playwright.

---

## §0 — À lire AVANT, par clé exacte

La recherche sémantique du cerveau ne remonte pas ces fiches sur une phrase
générique. Les interroger **par clé** :

```bash
CLAUDE_FLOW_DISABLE_BRIDGE=1 npx ruflo@3.10.46 memory get -k "<clé>" -n megga
```

| Clé | Pourquoi |
|---|---|
| `megga/calendar-google` | La seule liaison OAuth existante : GoTrue `linkIdentity`, jetons en clair, `google_calendar_tokens` = 0 ligne. Ce plan **ne recopie pas** ce patron (§3 D1, D2). |
| `megga/auth-google-oauth-client` | Le client OAuth vivant (`833483825712-…`), l'URI `api.megga.ch/auth/v1/callback`, et le fait que Google ne réaffiche plus un secret. |
| `megga/email-channel-guard` | Le registre de suppression, `email_send_allowed`, et **pourquoi aucune réception d'e-mail n'existe** dans le dépôt. |
| `megga/email-coquille-megga-x` | La coquille unique des e-mails transactionnels et sa porte `lint:email-shell`. Les mails de la Messagerie ne passent PAS par elle (§3 D10). |
| `megga/gardes-vacuites` | 38 formes de « garde verte pendant que l'écran est faux ». |
| `megga/da-meggax-crm` | La direction MEGGA X sur le CRM et l'arbitrage actif/donnée. |

Fiches mémoire de session (dans `~/.claude/projects/-Users-megga-Desktop-megga-real-estate/memory/`) qui décident de gestes ici : `project_activity_events_emission_rules.md` (sévérité, `category`, `actor_kind`), `project_onboarding_calendar_service_account.md` (⛔ `vitest.config.ts` liste EN DUR les specs de `_shared` ; ⛔ `deno check` refuse `Uint8Array` comme `BufferSource`), `project_edge_functions_untyped_by_build.md` (`tsc -b` ne couvre que `src/`), `project_ci_only_defects_lot3.md` (surcharge SQL = PGRST203).

Maquette source : `~/Downloads/Client mail .zip` → `design_handoff_messagerie/README.md` (538 lignes, la spécification pixel) et `Messagerie - reference.html` (2 350 lignes, le prototype). **Dézipper dans le scratchpad, pas dans le dépôt** — le HTML n'est pas du code de production (README §« À propos des fichiers »).

---

## §1 — La maquette, et sa transposition

L'écran est celui d'un ERP dentaire ; le README l'annonce « transposable tel quel ». Dictionnaire de transposition, à appliquer partout (libellés, fixtures, i18n) :

| Maquette (dentaire) | Ici (immobilier) |
|---|---|
| patient / dossier patient | contact / fiche contact |
| labo | notaire |
| assurance | banque |
| cabinet | agence |
| « Documents du cabinet » | « Documents de l'agence » |
| « Classer au dossier du patient » | « Rattacher à la fiche contact » |
| « Rapprocher le numéro » (WhatsApp) | « Rapprocher l'adresse » (e-mail) |
| Libellés `À traiter · Assurances · Labo · Patients · RDV en ligne · Fournisseurs` | `À traiter · Banques · Notaires · Clients · Visites · Fournisseurs` |
| « La conservation légale de dix ans s'applique au dossier, pas à la boîte. » | identique : la LBA porte sur le DOSSIER (`documents`, `kyc_cases`), la boîte est une copie effaçable |

**Fidélité : haute.** Dimensions, rayons, espacements, états de survol et interactions sont définitifs (README §« Fidélité »). Seuls les **tokens** changent, selon la table « Report vers MEGGA X » du README, complétée par ce que le dépôt impose :

| Rôle (maquette) | Variable maquette | Dans le dépôt |
|---|---|---|
| fond du bento | `--side` | `sp.pageBg` |
| carte / surface | `--card` / `--elev` | `sp.cardBg` / `sp.cardSubBg` (⚠ sous-surface **creusée** en sombre) |
| survol | `--hover` / `--hover2` | `crmVoileEncre(dark, 0.04)` / `crmVoileEncre(dark, 0.06)` |
| bordures | `--bord` / `--bord2` / `--bord3` | `sp.cardBorder` / `sp.frameBorder` / `sp.solidBorder` |
| encre | `--ink` / `--txt2` / `--txt3` / `--txt4` / `--mut` / `--dim` | `sp.ink` / `sp.ink` / `sp.sub` / `sp.sub` / `sp.soft` / `crmVoileEncre(dark, 0.25)` |
| accent | `--accent` | `sp.accent` (aplat) + `sp.accentInk` (encre dessus, via `encreSur`) |
| succès / info / alerte / erreur | `--bdg*` | `MXC_SYSTEM.green300` / `blue300` / `yellow400` / `red400`, **toujours sous encre sombre** (`encreSur`) |
| étoile suivie `#f0a03c` | littéral | `MXC_SYSTEM.yellow400` (`#efc42c`) |
| police Poppins | — | `var(--crm-font)` (Inter Tight) — jamais un nom de police en dur |
| tailles 10 · 10.5 · 11 · 11.5 · 12 · 12.5 · 13 · 13.5 · 14 · 16 · 17 · 19 px | littéraux | barreaux `--crm-text-*` les plus proches : 11→`xs`, 12→`sm`, 13→`md`, 14→`lg`, 16→`2xl`, 18→`3xl`, 20→`4xl`. Les demi-pas (10.5, 11.5, 12.5, 13.5) prennent le barreau inférieur ; **aucun littéral de taille dans un composant** (CLAUDE.md §3 point 3) |
| rayons 11 · 12 · 13 · 14 · 16 · 18 · 20 · 24 · 26 · 28 · 999 | littéraux | `--crm-radius-lg` (12) · `xl` (16) · `4xl` (20) · `6xl` (24) · `pill`. 26/28 → `6xl` ; 11/13/14 → `lg` ; 18 → `xl` |
| espacements 2…30 | littéraux | `--crm-space-2xs` (4) … `7xl` (24) ; 26/28/30 → `7xl` ; 2 → `2xs` |
| ombres | aucune | `sp.shadow` (= `MXC_CARD_SHADOW` en clair, `none` en sombre — CLAUDE.md §3) |
| icônes SVG inline | — | `MEIcon` (`src/components/propertyx/MEIcon.tsx`) ; glyphes absents (`paperclip`, `star`, `archive`, `inbox`, `reply`, `forward`) à ajouter dans `MEIconName` avec leur chemin, pas en SVG inline dans les composants |

⚠ Les trois **densités** de la maquette (296 / 260 / 236 px) ne sont PAS reprises : le CRM n'a pas d'attribut de densité, et le seul précédent de rail est à 296 px (`CalendarApp.tsx:470`, unique occurrence du littéral dans `src/`). Une seule largeur : 296.

⚠ La maquette a une **entrée de sidebar** ; le CRM n'a pas de sidebar de pages mais une barre d'onglets (`CrmTopNav`, `src/components/crm/CrmShell.tsx:142-150`) et un rail d'outils (`CrmIconRail`). L'entrée devient un **onglet `Messagerie`** (lot 2, T2.1). La seconde entrée « WhatsApp » de la maquette n'est pas créée (§3 D13).

---

## §2 — Ce que le dépôt a, et n'a pas (mesuré le 03.09.2026)

**Il n'y a AUCUNE réception d'e-mail dans le dépôt.** Ni Resend inbound, ni MX applicatif, ni parseur. `_shared/email-guard.ts:7-12` le dit en toutes lettres. Les 16 sites `api.resend.com` sont tous des **envois transactionnels** depuis `noreply@megga.ch`, sans `reply_to`.

**Il n'y a AUCUN écran de conversation.** `src/App.tsx` ne route ni `/messages`, ni `/chat`, ni `/whatsapp`. Aucun composant ne lit `whatsapp_messages` (seules les edge functions y écrivent et lisent). La mention « Chat » de `docs/system-map.md` est périmée.

**Ça a existé, et ça a été supprimé.** `gmail_tokens`, `outlook_mail_tokens` (avec une colonne `scopes`) et `email_messages_cache` (provider gmail|outlook, `external_thread_id`, `contact_id`, `ai_classification`…) ont été créées, jamais branchées à une UI ni à une edge function, et purgées comme tables mortes le 18.07.2026 (`20260718152000_audit_p2_drop_dead_tables.sql:42,49`). `messages` / `message_threads` (le système « Messages » maison) pareil (`:10,58`). ⚠ `docs/schema.md:226-229` les documente encore : **périmé**. Vestige vivant : `profiles.email_signature` (baseline `:4466`), dont le commentaire cite `gmail-sync / outlook-mail-sync`, deux fonctions jamais écrites.

**Ce qui se réutilise tel quel** (fichier → rôle) :

| Quoi | Où | Rôle ici |
|---|---|---|
| `requireAgentAuth` | `supabase/functions/_shared/require-agent-auth.ts` | garde de TOUTES les edges du module (JWT + profil + `agency_id`) |
| `isServiceSecret` | `_shared/require-service-secret.ts` | garde du cron (`mail-sync`) |
| ponts Vault | `20260607183000_esign_signature_backend.sql:25-55` | modèle des `mail_secret_*` (§5) |
| `esign_provider_connections` | même migration `:75-121` | modèle de `mail_accounts` (métadonnées lisibles, secret dans Vault, écriture service-role) |
| patron cron | `20260803214110_onboarding_call_reminder_cron.sql:18-45` | `mail-sync-2min` (un `net.http_post` par tick, jamais par ligne) |
| verrou de cron | `20260705130000_whatsapp_cron_locks.sql` | `mail_cron_locks` (bail atomique par `UPDATE … WHERE locked_until < now()`) |
| `activity_events` | `project_activity_events_emission_rules.md` | `category='messaging'` existe depuis `20260815214000` ; `actor_kind='system'` ⇒ `actor_id` NUL |
| timeline contact | `src/hooks/useContactTimeline.ts` | lit `activity_events` par `entity_id = contact_id` : un mail rattaché y apparaît **si et seulement si** on écrit l'événement |
| `documents` + bucket `documents` | `20260527000000`, `20260802140000` (MIME) | cible de « Classer dans le dossier » ; layout `{agency_id}/{document_id}.<ext>` ; MIME autorisés : pdf, jpeg, png, webp, doc, docx ; 20 Mio |
| recherche de contacts | `_shared/whatsapp-actions.ts:131-153` | patron tokenisé et scoppé agence pour « Rapprocher » |
| bento + rail 296 px | `src/components/crm/calendar/CalendarApp.tsx:456-505` | le squelette exact de l'écran (lot 2, T2.1) |
| modale canonique | `src/components/crm/contacts-pager/WhatsAppConnectModal.tsx:70-101` | portail + voile `crmVoileAssombrissant` + `useFocusTrap` |
| menu flottant | `src/components/crm/notifications/CrmNotificationsPopover.tsx:124-143` | modèle du menu contextuel (ancré `position: fixed`, `sp.solidBg`) |
| pager « 1–12 sur 48 » | `src/components/admin/kit/adminKit.tsx:598-623` + `src/hooks/useClientPagination.ts` | à porter en prenant `sp` en prop |
| état vide | `src/components/crm/EtatVide.tsx` | « Aucun message ne correspond. » |
| namespace i18n `messages` | `src/i18n/locales/{fr,de,en,it}/messages.json` | **enregistré et sans consommateur** (`useTranslation('messages')` = 0 hit) : c'est le nôtre |
| `common:nav.messages` | 4 langues | existe (« Messages ») — on ajoute `nav.messagerie` |
| Realtime | `src/hooks/useAgentNotifications.ts:149-158` | patron `postgres_changes` + `useId()` |
| logos | `IntegrationsSection.tsx` (`GoogleG`, `MsLogo`, `WhatsAppLogo`) | réutiliser, ne pas redessiner |

**Ce qui n'existe pas et se construit** : tout le reste de ce plan.

---

## §3 — Décisions (tranchées ici, à ne pas rouvrir sans mesure)

**D1 — Un vrai client OAuth, en pop-up, hors GoTrue.** Le calendrier obtient ses jetons comme effet de bord de `supabase.auth.linkIdentity` (redirection pleine page, `state` géré par GoTrue). Ce patron **ne convient pas** ici : (a) élargir les scopes du fournisseur Google de Supabase mettrait un scope Gmail **restreint** sur l'écran de consentement de CHAQUE connexion ; (b) la maquette et Julien veulent une **pop-up** dont la fenêtre principale reste ouverte. On écrit donc le flux code + PKCE : `mail-oauth` `start` rend l'URL d'autorisation et mémorise `state` + `code_verifier` **côté serveur** (`mail_oauth_states`, TTL 10 min, lié à `auth.uid()`) ; la pop-up revient sur `/oauth/mail/callback`, qui **poste `{code, state}` à `window.opener`** et se ferme ; l'opener (qui a la session) appelle `mail-oauth` `exchange`. Repli sans opener (pop-up bloquée) : la page fait l'échange elle-même et navigue vers la Messagerie. Le navigateur ne voit jamais ni le `code_verifier` ni un jeton.

**D2 — Les jetons vivent dans Vault, jamais dans une colonne.** Les tables du calendrier stockent `refresh_token` en clair ET leur policy SELECT le laisse lire par le navigateur. On recopie le patron e-sign : `mail_secret_store / read / update / delete`, `SECURITY DEFINER`, `search_path = ''`, révoqués de `anon`/`authenticated`, accordés à `service_role`. `mail_accounts.vault_secret_id` n'est qu'un pointeur.

**D3 — On RÉUTILISE les clients OAuth existants, pas de nouveau client.** Google : le client `833483825712-vh715spjupqcl86qffv3hvffsaqk0g8e` (compte hello@megga.ai, projet `tribal-dispatch-504619-c1`), en lui ajoutant une URI de redirection ; secrets `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, déjà posés. Microsoft : `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` — **absents du projet** (CLAUDE.md §8) : les poser débloque en même temps le calendrier Outlook, à condition que le fournisseur Azure de Supabase pointe sur la même inscription (§6). Les scopes sont demandés par requête d'autorisation, pas par client : la connexion « Se connecter avec Google » reste propre (scopes non sensibles seulement ⇒ aucun avertissement).

**D4 — Scopes.** Google : `https://www.googleapis.com/auth/gmail.modify` + `openid email` (`gmail.modify` = lecture, écriture des libellés, envoi ; il exclut seulement la suppression définitive). ⛔ C'est un scope **RESTREINT** (au-dessus de « sensible ») : tant que l'app n'est pas vérifiée pour lui, Google affiche l'écran « application non validée » à la connexion d'une boîte Gmail et plafonne à **100 utilisateurs** ; la vérification exige, en plus du dossier déjà engagé pour Calendar, une **évaluation de sécurité CASA Tier 2** annuelle par un laboratoire agréé (coût à chiffrer avant de dépasser le pilote — §6.4). Microsoft : `offline_access User.Read Mail.ReadWrite Mail.Send` (permissions déléguées, sans validation d'éditeur pour un usage multi-tenant courant).

**D5 — Deux fournisseurs d'abord (Gmail API, Microsoft Graph), IMAP après un spike.** Gmail et Graph sont du HTTPS pur, compatibles edge sans réserve. IMAP/SMTP exige des sockets TCP/TLS sortants : le runtime edge de Supabase les supporte (`Deno.connectTls`, documenté « native support for TCP connections »), **mais bloque les ports 25 et 587** (docs « Limits ») — donc SMTP en **465 implicite TLS** seulement, STARTTLS impossible. Le lot 3 commence par un spike déployé (`mail-imap-probe`) et ne continue que s'il passe ; sinon la voie de repli documentée est un Cloudflare Worker (`cloudflare:sockets`), hors de ce plan.

**D6 — Infomaniak et Bluewin n'ont pas d'OAuth mail public.** La maquette leur montre l'étape « Autorisation du compte ». Ni Infomaniak Mail ni Bluewin n'exposent d'API OAuth de lecture de boîte ; leur seule voie est IMAP/SMTP avec mot de passe (ou mot de passe d'application). **Écart assumé** : ces deux lignes de l'assistant ouvrent directement l'étape IMAP, pré-remplie (`mail.infomaniak.com:993` / `mail.infomaniak.com:465`, `imap.bluewin.ch:993` / `smtpauths.bluewin.ch:465`), avec le visuel de l'étape IMAP de la maquette. L'étape OAuth reste réservée à Google et Microsoft. Affirmer le contraire à l'écran serait un mensonge d'interface.

**D7 — Modèle : fil (`mail_threads`) + messages (`mail_messages`) + pièces (`mail_attachments`).** Le fil porte l'état d'affichage (`is_read`, `is_starred`, `is_archived`, `is_trashed`, `label_id`, `contact_id`) et les agrégats de liste (`last_message_at`, `snippet`, `participants`, `has_attachments`, `message_count`, `last_inbound_at`, `last_outbound_at`). Un seul libellé par fil, comme la maquette (`label: keyof LABELS`). Les **brouillons** sont locaux (`mail_drafts`), jamais synchronisés vers le fournisseur : un brouillon est un état d'écran, pas un message.

**D8 — Dossiers = requêtes, pas colonnes.** `in` = `NOT is_archived AND NOT is_trashed AND last_inbound_at IS NOT NULL` ; `arch` = `is_archived AND NOT is_trashed` ; `star` = `is_starred AND NOT is_trashed` ; `sent` = `last_outbound_at IS NOT NULL AND NOT is_trashed` ; `draft` = `mail_drafts`. Une RPC unique `mail_list_threads(...)` rend la page ET le total (`count(*) over ()`), 12 lignes par page. Recherche : `ilike` sur une colonne générée `search_text` (expéditeurs + objet + extrait), bornée par l'index `(account_id, last_message_at desc)` — quelques milliers de fils par boîte, pas de `pg_trgm` nécessaire (à revoir si une boîte dépasse 20 000 fils).

**D9 — Corps : texte ET HTML, HTML assaini côté client dans une iframe `sandbox`.** On stocke `body_text` (partie `text/plain`, sinon HTML→texte) et `body_html` (tel que reçu, plafonné à 512 Kio, `body_truncated=true` au-delà). Le rendu passe par DOMPurify (dépendance à ajouter : `dompurify` + `@types/dompurify`) dans une `<iframe sandbox srcdoc>` portant une `<meta http-equiv="Content-Security-Policy">` qui **bloque les images distantes** par défaut (traqueurs) — bouton « Afficher les images ». Les paragraphes de la maquette (`13px / 1.75`) habillent la version texte ; l'HTML prend la même typographie via une feuille injectée dans le `srcdoc`.

**D10 — L'envoi part de la boîte de l'agent, jamais de Resend.** Un mail envoyé par Resend ne serait pas dans le fil de l'agent, ni dans ses « Envoyés », ni aligné DKIM sur son domaine. `mail-send` construit un MIME RFC 5322 (`multipart/alternative` texte + HTML, pièces en base64, `In-Reply-To` / `References` sur réponse, signature `profiles.email_signature` en pied) : Gmail `users.messages.send` (`raw` base64url + `threadId`) ; Graph `createReply` / `createForward` / `POST /me/messages` + `send`. La coquille `_shared/email-shell.ts` et `lint:email-shell` ne sont **pas** concernés : un mail d'agent n'est pas un e-mail transactionnel MEGGA (aucun `<!DOCTYPE` : on envoie des paragraphes). Le registre de suppression (`email_send_allowed`) n'est **pas** consulté : une réponse 1:1 de l'agent à quelqu'un qui lui a écrit est de nature transactionnelle (même règle que `ok_transactional`).

**D11 — Rattachement au contact, automatique puis manuel.** À l'ingestion, chaque adresse externe du fil est cherchée dans `contacts` et dans `mail_contact_aliases` (adresses apprises) ; un match unique pose `mail_threads.contact_id`. ⚠ **La recherche passe par une RPC `mail_match_contact_by_emails`, pas par un filtre PostgREST** : l'index est `btree (agency_id, lower(email)) WHERE email IS NOT NULL` — une EXPRESSION. Un `.in('email', …)` ne peut pas s'en servir (mesuré le 03.09.2026 : EXPLAIN retombe sur `idx_contacts_agency_created` + filtre) **et compare en respectant la casse**, donc `Jean.Dupont@ex.ch` ne rattacherait jamais un `jean.dupont@ex.ch` entrant — en silence, sans erreur, le fil restant « Adresse non rattachée ». Rien ne normalise `contacts.email` à l'écriture (`src/hooks/useContacts.ts:126`). Le bandeau « Adresse non rattachée » et la modale « Rapprocher l'adresse » (maquette §7) écrivent `contact_id` **et** apprennent l'alias. ⛔ **`contacts.email` est NULLABLE** — corrigé le 03.09.2026 : la base dit `is_nullable = 'YES'`, et **3 des 15 contacts vivants ont `email IS NULL`**. La conséquence n'est pas théorique : dans un `bool_and` de jetons, `lower(c.email) like '%tok%'` rend NULL (pas FALSE) sur ces lignes, et `bool_and` **ignore les NULL** — le ET de jetons dégénère en OU dès qu'un seul jeton correspond, précisément sur les contacts SANS adresse, c'est-à-dire ceux qu'on cherche pour leur en attacher une. Toute comparaison sur `contacts.email` prend donc un `coalesce(…, '')`. Ce qui reste vrai de la règle : on n'écrase jamais l'adresse de la fiche, on apprend un alias. Chaque message rattaché écrit un `activity_events` (`category='messaging'`, `entity_type='contact'`, `entity_id=contact_id`, `action='email_received' | 'email_sent'`, `object_label=objet`, `actor_kind='system'` + `actor_id NULL` en réception, `'user'` + `auth.uid()` en envoi) : c'est ce qui le fait apparaître sur la timeline.

**D12 — Libellés par agence, six semés à la première boîte.** `mail_labels(agency_id, name, color, position)` ; les six de §1, couleurs = barreaux `MXC_SYSTEM` (rouge, bleu, jaune, vert, accent, neutre). Le créateur de libellé de la maquette (teinte + luminosité + hex) écrit une couleur libre ; l'encre de la pastille se calcule par `encreSur()` — jamais `#fff` en dur (garde `contacts-contraste.spec.ts` étendue en `messagerie-contraste.spec.ts`).

**D13 — WhatsApp n'est pas une boîte de cet écran.** Le README l'annonce « vue sœur… module distinct si le périmètre ne la demande pas » ; il n'existe aucun fil WhatsApp dans le CRM (§2). La ligne « WhatsApp Business » de l'assistant « Ajouter une boîte » **navigue** vers `/dashboard/settings?tab=integrations` (carte d'appairage existante). Pas d'entrée « WhatsApp » dans la nav, pas de boîte `wa` dans le sélecteur, pas de modales §7-§9 en version numéro de téléphone.

**D14 — Visibilité d'une boîte : `owner` ou `agency`.** La maquette distingue « boîte générale du cabinet » et « Dr Müller · personnelle ». `mail_accounts.visibility` ∈ `('owner','agency')`, choisie à la connexion (case « Partager avec l'agence », décochée par défaut). RLS : `owner` ⇒ `owner_id = auth.uid()` ; `agency` ⇒ `agency_id = get_my_agency_id()`. Le super-admin ne lit **pas** les messages (aucune policy `is_super_admin()` sur `mail_messages`) : les mails d'une agence ne sont pas de la télémétrie plateforme.

**D15 — Rétention.** Déconnecter une boîte **supprime** ses fils, messages et pièces (`ON DELETE CASCADE`) et le secret Vault ; les documents classés au dossier survivent dans `documents` avec leur propre `retention_until`. Les `activity_events` `messaging` de sévérité `info` rejoignent le seau « 3 ans » de `purge_activity_events_retention()` (aujourd'hui non listés ⇒ conservés sans borne, ce qui n'est pas une décision).

**D16 — Périmètre v1 = bureau.** `ResponsiveRoute` exige un composant mobile : v1 monte un écran mobile minimal (liste des fils + lecture, sans composer), lot 2 T2.13. Le compose, les modales et l'assistant restent bureau.

---

## §4 — Architecture et flux

```
                    ┌──────────────────────────────────────────────────────────┐
  navigateur        │  MessagerieApp (bento 296px | 1fr)                        │
  app.megga.ch      │  rail · liste · lecture · 7 modales · pop-up OAuth        │
                    └───────┬──────────────┬──────────────┬─────────────┬──────┘
                            │PostgREST+RLS │ invoke       │ invoke      │ fetch(blob)
                            ▼              ▼              ▼             ▼
                    mail_threads     mail-oauth      mail-actions   mail-attachment
                    mail_messages    start/exchange  read/star/     stream · file→documents
                    mail_labels      disconnect      archive/trash/
                    mail_drafts           │          label/link/     mail-send
                    (RPC mail_list_       │          sync_now        new/reply/forward
                     threads, unread)     ▼              │               │
                                     Vault (mail_secret_*) ◄─────────────┘
                                          ▲
  pg_cron */2 ─► mail-sync ──────────────┘   Gmail API (history)  ·  Graph (delta)  ·  [IMAP lot 3]
                 lock · budget 60 s · 25 comptes/tick · ingest → activity_events → Realtime
```

**Flux « Ajouter une boîte » (Google / Microsoft)** — la pop-up que Julien demande :
1. L'assistant (étape « OAuth ») appelle `mail-oauth` `{action:'start', provider, origin: location.origin, login_hint, visibility}` → `{url, state}`. ⚠ **`origin` est OBLIGATOIRE** (corrigé le 03.09.2026 : sans lui l'edge rend `400 invalid_origin`) et doit être l'une des `MAIL_OAUTH_ORIGINS` — `https://app.megga.ch`, `http://localhost:5173`, `http://localhost:5174` — la même liste que les URI de redirection à déclarer en §6.
2. `window.open(url, 'megga-mail-oauth', 'popup,width=520,height=680')`. L'opener écoute `message` (origine = `window.location.origin`, `data.type === 'megga:mail-oauth'`, `data.state === state`).
3. Le fournisseur redirige la pop-up sur `https://app.megga.ch/oauth/mail/callback?code=…&state=…`. La page `MailOAuthCallbackPage` : si `window.opener` existe → `postMessage({type, code, state, error})` puis `window.close()` ; sinon (pop-up bloquée, l'URL a été ouverte dans l'onglet) → elle appelle `exchange` elle-même et navigue vers `/dashboard/messagerie?account=<id>`.
4. L'opener appelle `mail-oauth` `{action:'exchange', code, state}` → l'edge vérifie l'état (propriétaire, non consommé, < 10 min), échange le code (PKCE), lit l'identité (`gmail/v1/users/me/profile` · `graph/v1.0/me`), écrit le secret dans Vault, upsert `mail_accounts`, sème les libellés si l'agence n'en a pas, lance la **première synchronisation en arrière-plan** (`EdgeRuntime.waitUntil`, budget 45 s), rend `{account}`.
5. L'assistant passe à l'étape « Boîte connectée » (Synchronisation « 90 derniers jours », Dossiers « Réception, Envoyés » — ⚠ pas « Brouillons » : D7 — Classement « Actif ») ; « Ouvrir la boîte » sélectionne le compte.

**Flux de synchronisation** : `mail-sync` est appelé (a) par pg_cron toutes les 2 min sans corps, (b) par `mail-actions` `sync_now` avec `{account_id}`. Il prend le bail `mail_cron_locks('mail-sync')` (TTL 180 s), choisit jusqu'à 25 comptes `status='active' AND next_sync_at <= now()` par `next_sync_at`, et pour chacun : `getValidAccessToken` (rafraîchit si < 5 min, met à jour Vault, MS peut renvoyer un nouveau refresh token) → `provider.sync(account, cursor, budget)` → `ingest` par message → curseur avancé → `next_sync_at = now() + 2 min`. Première synchro = **90 jours** (`newer_than:90d` / `receivedDateTime ge`) par pages de **50** (`GMAIL_PAGE_SIZE` / `GRAPH_PAGE_SIZE`), reprise par `sync_cursor.initialPageToken` (Gmail) ou `sync_cursor.inboxDelta` / `sentDelta` (Graph) d'un tick à l'autre. ⚠ Corrigé le 04.09.2026 : ce paragraphe annonçait « pages de 100 » et un champ `sync_cursor.page_token` qui n'a jamais existé — or la taille de page décide du nombre d'allers-retours `messages.get` qui tiennent dans les 20 s de budget par compte, c'est un chiffre de capacité qu'on dimensionne contre. ⚠ Côté Graph, le `$filter` de 90 jours PLAFONNE l'import initial à **5 000 messages par dossier** (« Applying `$filter` in a delta query returns only up to 5,000 messages », delta-query-messages, relu le 04.09.2026) : plafond assumé, à DIRE dans le lot 2 (« les 5 000 messages les plus récents ») plutôt qu'à laisser croire à un import complet. Un échec 401/invalid_grant ⇒ `status='reauth_required'`, journalisé, **jamais silencieux** (leçon `host-freebusy`). Budget CPU edge : 2 s par requête — le parsing MIME reste léger (pas de `base64` de pièces en ingestion : métadonnées seulement, D9).

**Flux d'actions** : optimiste côté client (mutation TanStack sur `['mail','threads']`), puis `mail-actions` → fournisseur (`messages.modify` labels `UNREAD`/`STARRED`/`INBOX`/`TRASH` · Graph `PATCH isRead`/`flag` · `POST /move` vers `archive`/`inbox`/`deleteditems`) → mise à jour locale. Un échec fournisseur rétablit l'état et remonte un toast. L'inverse (geste fait dans Gmail) arrive par la synchro suivante (`labelsAdded/labelsRemoved` · `isRead`/`parentFolderId` du delta).

**Flux pièce jointe** : la liste ne charge que les métadonnées. « Voir en grand » et « Télécharger » passent par `mail-attachment` (`GET ?id=`) qui **télécharge la pièce en mémoire** avec le jeton du compte, puis la rend (jamais d'URL publique), plafond **25 Mio**. ⚠ Ce n'est pas un flux — corrigé le 03.09.2026 : les deux adaptateurs matérialisent l'objet entier (`new Uint8Array(await res.arrayBuffer())` côté Graph, décodage base64 complet côté Gmail). Le `/$value` de Graph se prêterait à un vrai pipe ; le JSON-base64 de Gmail non. « Classer dans le dossier » (`POST {action:'file', attachment_id, contact_id, document_type, name}`) télécharge, vérifie le MIME contre l'allowlist du bucket, calcule le SHA-256, dépose dans `documents/{agency_id}/{document_id}.<ext>` et insère la ligne `documents` (`contact_id`, `document_category`, `uploaded_by`), puis écrit `mail_attachments.document_id`.

---

## §5 — Modèle de données (résumé ; SQL complet en lot 1, T1.1)

| Table | Clés et colonnes décisives | RLS |
|---|---|---|
| `mail_accounts` | `id`, `agency_id`, `owner_id`, `provider` ∈ `gmail\|outlook\|imap`, `email` (unique par `(agency_id, provider, lower(email))`), `display_name`, `visibility` ∈ `owner\|agency`, `status` ∈ `active\|reauth_required\|error\|disabled`, `vault_secret_id`, `sync_cursor jsonb`, `next_sync_at`, `last_sync_at`, `last_error`, `imap_config jsonb` (hôtes/ports, jamais le mot de passe) | SELECT membres selon `visibility` ; UPDATE limité à `display_name`, `visibility` et la bascule `status` `active ⇄ disabled` par le propriétaire, via l'edge `mail-oauth` action `update` (⚠ par l'EDGE et non par une RPC : `authenticated` n'a aucun grant d'UPDATE sur cette table. La pause n'existait dans aucun chemin de code jusqu'au 04.09.2026 — arrêter une boîte passait par `disconnect`, qui révoque le jeton et emporte fils, messages et pièces en cascade. Les trois autres états sont des VERDICTS du système et rendent 409 : ils se réparent par une réautorisation) ; INSERT/DELETE service-role |
| `mail_oauth_states` | `state` (PK, 64 hex), `user_id`, `agency_id`, `provider`, `code_verifier`, `login_hint`, `visibility`, `expires_at`, `consumed_at` | aucune policy (service-role seul) |
| `mail_labels` | `id`, `agency_id`, `name`, `color` (hex), `position`, `is_default` | membres de l'agence : SELECT/INSERT/UPDATE/DELETE |
| `mail_threads` | `id`, `account_id`, `agency_id`, `provider_thread_id` (unique par compte), `subject`, `snippet`, `participants jsonb` (`[{name,email}]`), `from_name`, `from_email`, `last_message_at`, `last_inbound_at`, `last_outbound_at`, `message_count`, `has_attachments`, `is_read`, `is_starred`, `is_archived`, `is_trashed`, `label_id`, `contact_id`, `search_text` (générée) | SELECT/UPDATE via la visibilité du compte (fonction `mail_account_visible(account_id)`) |
| `mail_messages` | `id`, `thread_id`, `account_id`, `agency_id`, `provider_message_id` (unique par compte), `rfc822_message_id`, `in_reply_to`, `direction` ∈ `inbound\|outbound`, `from_name`, `from_email`, `to jsonb`, `cc jsonb`, `bcc jsonb`, `reply_to`, `subject`, `snippet`, `body_text`, `body_html`, `body_truncated`, `sent_at`, `is_read`, `has_attachments`, `provider_labels text[]`, `contact_id` | SELECT via la visibilité du compte ; aucune écriture client |
| `mail_attachments` | `id`, `message_id`, `account_id`, `agency_id`, `provider_attachment_id`, `filename`, `mime_type`, `size_bytes`, `is_inline`, `content_id`, `document_id` (→ `documents`) | SELECT via visibilité |
| `mail_drafts` | `id`, `account_id`, `agency_id`, `author_id`, `kind` ∈ `new\|reply\|forward`, `thread_id`, `in_reply_to_message_id`, `to jsonb`, `cc jsonb`, `subject`, `body_text`, `attachments jsonb`, `updated_at` | auteur seul (SELECT/INSERT/UPDATE/DELETE `author_id = auth.uid()`) |
| `mail_contact_aliases` | `agency_id`, `email` (unique par `(agency_id, lower(email))`), `contact_id`, `learned_by`, `created_at` | membres : SELECT/INSERT/DELETE |
| `mail_cron_locks` | `job` PK, `locked_until` | aucune policy (service-role) |

Fonctions : `mail_secret_store/read/update/delete` (Vault, service-role) · `mail_account_visible(uuid)` (`STABLE`, `SECURITY DEFINER`, lit `mail_accounts` — sert les policies des tables filles sans récursion) · `mail_list_threads(p_account_id, p_folder, p_label_id, p_q, p_unread_only, p_att_only, p_page, p_per_page)` → `SETOF (thread_row…, total bigint)` · `mail_unread_counts()` → `(account_id, unread bigint)` pour le sélecteur de boîte · `mail_folder_counts(p_account_id)` → `(inbox_unread, archived, drafts, label_counts jsonb)` pour le rail · `mail_search_contacts(p_q)` → 10 contacts (patron tokenisé, agence de l'appelant).

Realtime : `alter publication supabase_realtime add table public.mail_threads` (filtre client `agency_id=eq.<id>`, la RLS s'applique aux changements diffusés).

Index décisifs : `mail_threads (account_id, last_message_at desc) where not is_trashed` · `mail_threads (account_id) where not is_read and not is_archived and not is_trashed` (compteur) · `mail_messages (thread_id, sent_at)` · `mail_messages (account_id, provider_message_id)` unique · `mail_attachments (message_id)` · `mail_contact_aliases (agency_id, lower(email))` unique.

---

## §6 — Hors dépôt : ce que Julien fait à la main (aucun agent ne peut le faire)

1. **Google Cloud Console** (compte **hello@megga.ai**, projet « My First Project » `tribal-dispatch-504619-c1`, client OAuth `833483825712-vh715spjupqcl86qffv3hvffsaqk0g8e`) :
   - Credentials → ce client → **Authorized redirect URIs** : ajouter `https://app.megga.ch/oauth/mail/callback` et `http://localhost:5173/oauth/mail/callback`. **Ne pas** ajouter de domaine `supabase.co` (cf. `megga/auth-google-oauth-client`).
   - APIs & Services → **Enable** « Gmail API ».
   - Data Access → **Add or remove scopes** → cocher `https://www.googleapis.com/auth/gmail.modify` (⚠ marqué RESTRICTED). Sauvegarder. Sans cette déclaration, la demande passe quand même mais l'écran « non validée » s'affiche et le plafond 100 utilisateurs s'applique — acceptable pour le pilote (Gregory + l'équipe).
   - Plus tard, pour lever le plafond : soumettre la vérification data access avec `gmail.modify` (justification : « lire, classer et répondre aux e-mails clients depuis le CRM ; `gmail.readonly` ne permet ni de marquer lu ni d'archiver ; `gmail.send` seul ne lit pas ») + vidéo + **CASA Tier 2** par un laboratoire agréé (liste Google « CASA assessors » ; devis à demander, ordre de grandeur de quelques centaines à quelques milliers de dollars par an selon le niveau et le prestataire — à vérifier, aucune valeur ici n'est mesurée).
2. **Azure (Entra ID)** — `portal.azure.com` → App registrations → **New registration** « MEGGA » : *Accounts in any organizational directory and personal Microsoft accounts* ; Redirect URIs (Web) : `https://api.megga.ch/auth/v1/callback` (pour le fournisseur Azure de Supabase, si on veut que le calendrier partage l'inscription), `https://app.megga.ch/oauth/mail/callback`, `http://localhost:5173/oauth/mail/callback` ; Certificates & secrets → **New client secret** (24 mois) — copier la VALEUR immédiatement ; API permissions → Microsoft Graph, *Delegated* : `Mail.ReadWrite`, `Mail.Send`, `User.Read`, `offline_access` (+ `Calendars.ReadWrite` si le calendrier partage). Puis Supabase → Authentication → Providers → Azure : mettre le même Client ID / Secret (sinon le calendrier Outlook ne rafraîchira jamais ses jetons).
3. **Secrets Supabase** (Project Settings → Edge Functions → Secrets) : `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` (absents aujourd'hui). `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` sont posés (16.08.2026). Vérifier un couple sans rien déployer : `curl -s -X POST https://oauth2.googleapis.com/token -d grant_type=refresh_token -d refresh_token=faux -d client_id=… -d client_secret=…` → `invalid_grant` = couple valide, `invalid_client` = secret faux (méthode CLAUDE.md §8).
4. **Logos** : déposer `public/mail/infomaniak.png` et `public/mail/swisscom.png` (les SVG/PNG du zip ne sont PAS fournis dans l'archive ; le code prévoit un monogramme de repli « ik » / « bw » tant que les fichiers manquent — pas de 200-qui-ment : le composant teste `naturalWidth` et bascule sur le monogramme).
5. **Une vraie boîte de test** Google Workspace (hello@megga.ai convient) et une boîte Outlook.com ou M365 pour l'épreuve de bout en bout (§7.4). ⚠ Ne jamais brancher la boîte d'un client pendant le développement.

---

## §7 — Portes

### 7.1 Portes CI que le module doit franchir (aucune n'est couverte par `npm run lint` seul)

| Porte | Commande | Ce qu'elle exige de nous |
|---|---|---|
| Roster des edges | `npm run lint:roster` (`--write` pour régénérer `src/lib/edgeFunctionRoster.ts`) | chaque nouvelle fonction déclarée dans `supabase/config.toml` (`[functions.<nom>] verify_jwt = false`) |
| Garde d'auth | `npm run lint:edge-auth` | un symbole de `SHARED_GUARDS` (`requireAgentAuth` ou `isServiceSecret`) présent dans chaque `index.ts` |
| Idempotence des migrations | `npm run lint:migrations` | `IF NOT EXISTS`, `DROP POLICY IF EXISTS` avant `CREATE POLICY`, blocs `DO $$` |
| Fraîcheur des types | `npm run lint:types-freshness` | régénérer `src/types/database.ts` après la migration : `npx supabase gen types typescript --project-id eayczugyrvmtqnnmvjod > src/types/database.ts` (⚠ contre la base où la migration est appliquée ; en local `--local`) ; **jamais de cast** du client |
| i18n en dur | `npm run lint:i18n` | zéro chaîne française en dur dans `src/components/crm/**` et `src/pages/agent/**` |
| Parité des langues | `npm run i18n:parity:ci` | toute clé FR présente en EN, DE, IT |
| Prose | `npm run lint:prose` | aucun tiret cadratin dans `locales/` |
| Coquille e-mail | `npm run lint:email-shell` | aucun `<!DOCTYPE` dans nos edges (on n'en écrit pas) |
| Code mort | `npm run lint:deadcode` | pas d'export sans lecteur |
| Sévérité audit | `tests/unit/activity-events-severity.spec.ts` | `severity` ∈ `info\|warn\|critical` dans les migrations |
| Voile de modale | `tests/unit/voile-modale.spec.ts` | `crmVoileAssombrissant`, jamais `crmVoileEncre`, sous une modale |
| Couleurs | `tests/unit/couleur-barreaux.spec.ts`, `graphite-scale.spec.ts` | pas de quasi-noir hors des 4 barreaux ; pas de Graphite |
| Polices | `tests/unit/polices-domaines.spec.ts`, `megga-x-crm-tokens.spec.ts` | `var(--crm-font)` uniquement |
| Grammaire | `tests/unit/megga-x-grammar.spec.ts` | ajouter `src/components/crm/messagerie` à `ZONES` (T2.12) |
| Interpolation morte | `tests/unit/interpolation-morte.spec.ts` | pas de `${…}` dans une chaîne à quotes simples |
| Specs `_shared` | `vitest.config.ts` `include` | ⛔ **ajouter chaque `_shared/mail/*.test.ts` à la liste en dur**, sinon il ne tourne nulle part (compteur de tests avant/après) |

### 7.2 Tests à écrire (résumé ; le code est dans les lots)

- **Unitaires** (`vitest run`) : MIME (construction, décodage RFC 2047, base64url, HTML→texte), adaptateur Gmail (payload → message normalisé ; `history` → opérations), adaptateur Graph (delta → opérations ; message → normalisé), ingestion (rattachement contact, dérivation des drapeaux de fil), rafraîchissement de jeton (tampon 5 min, rotation MS), dossiers→requête, format de date de liste (`08:29` / `Hier` / `23.08`), pop-up OAuth (validation de l'origine et du `state`), sanitisation HTML (scripts et `<img src=http>` retirés par défaut), `messagerie-contraste.spec.ts`.
- **Backend** (`vitest run --config=vitest.backend.config.ts`, base locale) : RLS deux agences (`owner` vs `agency`, isolation inter-agences, `mail_messages` invisibles au super-admin), ponts Vault refusés à `authenticated`, `mail_list_threads` (dossiers, libellé, recherche, pagination, total), `mail_unread_counts`, edges : `mail-oauth start` (URL, scopes, PKCE S256, ligne d'état), `exchange` avec `state` étranger → 403 (l'état est prouvé inconnu, pas caché), `mail-actions` sur un compte étranger → **404**, `mail-send` sans destinataire → 400, `mail-attachment` étranger → **404**, `mail-sync` sans secret → 401. ⚠ **404 et non 403 pour un compte étranger** (corrigé le 03.09.2026) : un 403 confirmerait que la ligne existe — c'est un oracle d'existence inter-agences. `loadVisibleAccount` rend `null`, l'edge répond `not_found`.
- **E2E** : `/dev/messagerie` (banc avec fixtures, 3 états) en régression visuelle ; parcours agent connecté sur la vraie route (liste vide → état vide).

### 7.3 Ce qu'aucune porte ne mesure — à faire À LA MAIN avant de dire « livré »

Cf. `megga/gardes-vacuites` : un banc vert n'est pas une fonctionnalité. Le lot 1 se prouve par une **vraie** boîte synchronisée ; le lot 2 par un aller-retour réel (recevoir dans Gmail → voir dans le CRM en < 2 min → répondre depuis le CRM → la réponse est dans le fil Gmail, avec `In-Reply-To`).

### 7.4 Épreuve de bout en bout (à rejouer à chaque lot)

> ⛔ **JAMAIS JOUÉE AU 05.09.2026, ni au lot 1 ni au lot 2 — et pas faute de code.**
> Les deux lots sont écrits, le socle est en production (9 tables, 11 fonctions,
> `mail-sync-2min` actif) et l'écran est sur la PR #1276 ; mais `mail_accounts` compte
> **0 ligne**, parce que les trois prérequis du §6 manquent : l'URI de redirection absente
> du client OAuth Google (⇒ `redirect_uri_mismatch`, le consentement ne s'affiche même
> pas), l'API Gmail non activée avec `gmail.modify` non déclaré, et les deux secrets
> Microsoft absents (⇒ `503 provider_not_configured`). Aucun agent ne peut les poser.
>
> ⚠ **Le mode d'emploi littéral** — commandes, requêtes SQL point par point, contrôles de
> déconnexion — est écrit dans le plan du lot 2, sous la case décochée de la tâche 2.15.
> C'est là qu'il faut aller le jour où les trois prérequis sont posés, pas ici.

1. Ajouter une boîte Google via la pop-up ⇒ ligne `mail_accounts` `status='active'`, `vault_secret_id` non nul, `google_calendar_tokens` **inchangé** (0 ligne : on ne touche pas le calendrier).
2. Attendre ≤ 2 min ⇒ fils des 90 derniers jours présents ; `last_sync_at` renseigné ; aucun `last_error`.
3. S'envoyer un mail depuis une autre adresse ⇒ apparaît en < 2 min, non lu, pastille du rail incrémentée (Realtime).
4. Ouvrir ⇒ lu dans le CRM ET dans Gmail (`UNREAD` retiré). Étoile ⇒ `STARRED` dans Gmail. Archiver ⇒ quitte la réception des deux côtés.
5. Répondre ⇒ le message est dans le fil Gmail, en-tête `In-Reply-To` = `Message-ID` d'origine ; carte « moi → … » dans le CRM ; `activity_events` `email_sent` sur le contact rattaché.
6. Pièce jointe : « Voir en grand » ⇒ flux binaire correct (`content-type` de la pièce, pas `text/html`) ; « Classer dans le dossier » ⇒ ligne `documents` avec `contact_id`, objet dans le bucket, `sha256_hash` posé.
7. Rapprocher l'adresse ⇒ `contact_id` posé, alias appris, bandeau disparu ; le mail suivant de la même adresse est rattaché seul.
8. Déconnecter ⇒ 0 ligne `mail_threads` pour ce compte, secret Vault supprimé, document classé **toujours là**.
9. Rejouer 1-5 avec une boîte Outlook.

---

## §8 — Lots, ordre, et où l'on peut s'arrêter

| Lot | Contenu | Livrable autonome ? |
|---|---|---|
| **1** | migration + Vault + adaptateurs Gmail/Graph + 5 edges + cron + RPC + specs backend | oui : une boîte se connecte (via un appel d'edge sans UI) et se synchronise ; la table se remplit |
| **2** | l'écran de la maquette (rail, liste, lecture, 7 modales, pop-up OAuth, assistant), hooks, i18n, gardes, réglages, timeline, mobile minimal | oui : l'agent lit, répond, classe, connecte Google et Outlook |
| **3** | spike TCP/TLS, client IMAP minimal, SMTP 465, adaptateur `imap`, `connect_imap`, présélections Infomaniak/Bluewin, câblage de l'étape IMAP | oui, ou **abandon documenté** si le spike échoue |

Après **chaque** lot : `npm run build`, `npm run test:unit`, `npm run test:backend`, les portes de §7.1, l'épreuve §7.4, puis **mettre le cerveau à jour** (§10).

---

## §9 — Ce que ce plan ne fait PAS

- Pas de boîte **WhatsApp** dans cet écran (D13), pas de QR de liaison, pas de « Rapprocher le numéro ».
- Pas de **push** fournisseur (Gmail `users.watch` + Pub/Sub, abonnements Graph) : le polling à 2 min suffit au pilote ; à revoir si la latence devient un reproche mesuré.
- Pas de synchronisation des **libellés Gmail** vers `mail_labels` ni l'inverse : nos libellés sont un classement CRM.
- Pas de **brouillons fournisseur** (Gmail Drafts non importés).
- Pas d'**IA** (classification, réponse suggérée) : `email_messages_cache` en avait les colonnes et n'a jamais servi ; on ne les recrée pas sans usage. Une suite naturelle : « réponse suggérée » par DeepSeek (jamais Claude), après rédaction PII, human-in-the-loop.
- Pas de **densités** d'affichage (une seule largeur de rail).
- Pas de **multi-libellés** par fil.
- Pas de **règles de tri automatiques**.
- Pas de composer sur **mobile** (v1 lecture seule).
- Pas d'**images inline (`cid:`)** dans le corps rendu : la CSP de l'iframe les laisse passer mais rien ne les résout ; les pièces inline restent listées. À faire : réécrire `cid:` vers le flux `mail-attachment`.
- Pas de **création de fiche contact pré-remplie** depuis un mail : « Créer la fiche » (modale Rapprocher) ouvre la liste des contacts, sans pré-remplissage.
- Pas de segment « Accès » dans « Classer dans le dossier » : `documents` n'a pas de colonne d'accès, le rendre serait un réglage sans effet.
- Pas de **CASA** : la vérification Google est un dossier hors dépôt (§6.1).

---

## §10 — Après livraison

> ✅ **Fait le 05.09.2026** (clôture du lot 2, tâche 2.15). Deux écarts au plan, tous deux
> assumés : le cerveau reçoit **quatre** clés et non trois — `megga/messagerie-ecran` a été
> ouverte plutôt que d'étirer `-architecture`, l'écran ayant ses propres pièges (grammaire
> tokenisée, frontière des polices, banc à fixtures) qui n'ont rien à voir avec le schéma ;
> et le point 3 (`docs/schema.md`) était **déjà fait** au lot 1, ce que le §6ter de la carte
> prétendait faussement rester dû. ⚠ Deux chiffres se sont périmés en silence pendant ce
> chantier, sous la tolérance de `lint:claude-md` — **52** jobs pg_cron (et non 51) et
> **131** hooks (et non 119) : corrigés à la main, registre compris. Une tolérance large
> protège d'un faux rouge à chaque sonde ajoutée ; elle ne remplace pas la main de celui
> qui merge.

1. Cerveau : ajouter dans `.claude-flow/knowledge/megga-memory.seed.json` les clés `megga/messagerie-architecture` (D1-D16 condensées, tables, edges, curseurs), `megga/messagerie-oauth-popup` (le flux `postMessage`, l'URI de redirection, le repli sans opener), `megga/messagerie-portes` (les pièges rencontrés : port 587, vitest allowlist, scopes restreints) ; puis `npm run ruflo:seed`.
2. `docs/system-map.md` : nouvelle section « Messagerie (e-mail) » ; corriger la ligne 359 (« aucune réception d'e-mail » devient faux) ; retirer la mention « Chat ».
3. `docs/schema.md` : retirer `messages`/`message_threads` (:226-229), ajouter les tables `mail_*`.
4. `docs/pages.md` : `/dashboard/messagerie`, `/oauth/mail/callback`, `/dev/messagerie`.
5. `CLAUDE.md` §8 : la liste des secrets (Microsoft posés), l'état d'implémentation (Messagerie), `npm run lint:claude-md`.
6. `docs/CHANGELOG.md`.
