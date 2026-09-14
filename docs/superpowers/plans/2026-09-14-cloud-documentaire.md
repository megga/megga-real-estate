# Documents — le cloud documentaire du CRM — plan maître

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan lot by lot. Ce fichier est le **maître** : contexte mesuré, décisions, modèle de données, lots, travail hors dépôt, portes. Les tâches à cocher vivront dans un fichier par lot, écrit au moment d'ouvrir le lot.
>
> Plan **autonome**, écrit pour être ouvert dans une session neuve. Mesures faites le **14 septembre 2026** sur `main` = `3ea78fea` (branche : `megga/cloudflare-storage-pricing-f0616a`).
>
> ⛔ **Ce plan ne construit PAS un « Drive ».** Un espace de fichiers générique serait un deuxième Google Drive que l'agent n'ouvrirait pas — le portail vendeur, retiré le 26.07.2026 après 0 ligne d'usage, est le précédent. Ici, **chaque fichier appartient à quelque chose que le CRM connaît déjà** (un bien, un deal, un contact, un dossier KYC, l'agence), et c'est le CRM qui sait quelles pièces manquent, qui doit les fournir, à qui elles ont été montrées, et quand elles doivent disparaître. Le stockage n'est que le sous-sol.

**Goal :** Donner au CRM un module « Documents » qui réunit, pour chaque bien et chaque deal, les pièces du dossier de vente (constituer, demander, recevoir, classer, partager, faire signer, conserver, purger), branché sur ce que le dépôt sait déjà faire (lien magique, e-signature, pièces jointes de la Messagerie, médias WhatsApp, extraction PDF, journal d'audit), avec un stockage qui reste en Europe.

**Architecture :** Un **registre** en Postgres (`documents`, existant, élargi) qui porte le rattachement, la catégorie, l'empreinte, la conservation et l'état de chaque pièce ; deux **coffres** derrière lui, choisis par ligne (`storage_backend`) — le bucket Supabase `documents` (privé, 100 Go inclus dans le plan Pro) pour démarrer, un bucket **Cloudflare R2 en juridiction `eu`** (privé, neuf) quand le volume ou les vidéos l'exigent ; **toute lecture passe par une edge function** qui vérifie l'agence et rend une URL signée de courte durée — jamais une URL publique, jamais un listage du bucket. Les check-lists, les demandes de pièces, les partages et leurs ouvertures sont des tables à part, reliées au registre. L'IA (DeepSeek pour le texte, Gemini pour la vision — jamais Claude) **propose** une catégorie ou une extraction ; l'agent **valide**.

**Tech Stack :** React 18 + TypeScript + Vite · TanStack Query · react-i18next (FR/DE/EN/IT) · Supabase (Postgres 17, RLS, Storage, pg_cron, Edge Functions Deno) · Cloudflare R2 (S3, `aws4fetch`, juridiction `eu`) · pdf-lib (déjà dans `audit-pdf-export`) · Gemini (vision PDF) · DeepSeek (texte) · Vitest + Playwright.

---

## §0 — À lire AVANT, par clé exacte

```bash
CLAUDE_FLOW_DISABLE_BRIDGE=1 npx ruflo@3.10.46 memory get -k "<clé>" -n megga
```

| Clé | Pourquoi |
|---|---|
| `megga/kyc-audit-retention` | `activity_events` append-only, rétention 10 ans LBA, lecture journalisée (`useLogKycRead`) : le modèle du journal documentaire. |
| `megga/signature-qes-planned` | Skribble / DocuSign : backend mergé, chaque agence connecte SON compte, `esign-finalize` ramène le PDF signé dans `documents`. Le lot 5 s'y branche, il ne le refait pas. |
| `megga/doc-generation` | V1 = descriptif d'annonce (contenu). Les phases 2/3 (plaquette PDF, gabarit pdf-lib) sont notées hors périmètre là-bas : c'est le lot 5 ici. |
| `megga/messagerie-architecture` | Le patron pop-up OAuth + Vault, à recopier pour Google Drive (lot 7), et `mail-attachment` (« Classer dans le dossier »). |
| `megga/face-publique-meggax` | Les six surfaces sans compte, Manrope, mono-thème, `MLK` / `RC` : la page de dépôt (lot 2) et la page de partage (lot 3) sont la 7ᵉ et la 8ᵉ. |
| `megga/gardes-vacuites` | Les formes de « garde verte pendant que l'écran est faux ». |
| `megga/dock-poussee`, `megga/bascule-theme` | Ce qu'une surface montée sous `CrmWorkspace` reçoit gratuitement, et ce qu'elle ne doit pas refaire. |

Fiches mémoire de session qui décident de gestes ici : `project_cloud_stockage_r2.md` (l'étude de prix du 14.09, le bucket `megga-sauvegardes` en ENAM, la règle « bucket privé `eu`, jamais `megga-market` »), `project_activity_events_emission_rules.md` (sévérité, `category`, `actor_kind`), `project_edge_functions_untyped_by_build.md`.

Calculateur de coût (Cloudflare R2, juridiction UE) : https://claude.ai/code/artifact/2b7041bd-f109-41f7-b3b3-a36f140db6c4 — 100 agences à 5 Go, USD 8.25 par mois ; le stockage n'est pas ce qui coûte.

---

## §1 — À la place de l'agent : ce qui vaut quelque chose

Ce que le module doit faire disparaître, dans l'ordre où Gregory le vit (à **confirmer avec lui** avant le lot 1 — §6.4) :

1. **Courir après les pièces.** Règlement de PPE, PV des trois dernières assemblées, décompte de charges, extrait du registre foncier, CECB, police d'assurance bâtiment, attestation de financement de l'acheteur. Chaque pièce a un fournisseur (vendeur, régie, notaire, banque, acheteur) et une date de validité.
2. **Savoir ce qui manque avant le notaire.** Aujourd'hui, ça se sait quand le notaire le demande.
3. **Renvoyer dix fois le même dossier** aux acheteurs, aux banques, au notaire — et ne jamais savoir qui l'a ouvert.
4. **Prouver, un an plus tard, ce qui a été montré à qui**, et retrouver la pièce d'identité d'un acheteur sans fouiller trois boîtes mail.
5. **Ne pas garder ce qu'on n'a plus le droit de garder** : les dossiers des candidats locataires non retenus, que le PFPDT demande de détruire une fois le logement attribué.

Chaque lot ci-dessous nomme lequel de ces cinq points il ferme, et lequel des 5 objectifs du Document Maître il sert (1 temps administratif · 2 risque LAB/KYC · 3 closing · 4 transparence client · 5 outil fragmenté). Un lot qui n'en sert aucun ne se construit pas.

---

## §2 — Ce que le dépôt a, et n'a pas (mesuré le 14.09.2026)

**Le socle existe et personne ne s'en sert.** En production : `documents` = **0 ligne**, `kyc_magic_link_uploads` = **0**, `signature_requests` = **0**, pour **11** dossiers KYC, **4** deals, **6** biens (sans aucune photo), **13** agences. Le bucket `documents` contient **4 objets (8.7 Mo)** — les pièces d'identité KYB de `useAgencyIdentity`, rangées par dossier et **absentes du registre** : quatre fichiers que la table `documents` ne connaît pas. Le module ne part donc pas de zéro, il part d'un socle jamais exercé — ce qui veut dire que **rien de ce qui suit n'a été éprouvé en production**, RLS comprise.

**La table `documents`** (baseline `:3796`, 21 colonnes) : `agency_id`, `property_id`, `transaction_id`, `kyc_case_id`, `contact_id`, `name`, `type`, `storage_path`, `size_bytes`, `status` ∈ `pending | available | signed | rejected`, `uploaded_by`, `issued_at`, `expires_at`, `document_category` ∈ `identity | domicile | financial | compliance | other`, `retention_until`, `sha256_hash`, `signature_request_id`, `signature_status`, `signed_at`. Quatre policies vivantes, toutes par agence (`documents_select`, « Agents can insert/update/delete agency documents ») — les deux policies « vendeur » qui fuyaient entre agences ont été retirées le 03.08.2026. ⚠ Le rattachement est là, mais **rien ne l'affiche** : `ContactDetailPager` ne contient pas le mot « documents », les fiches bien et deal non plus. Seuls `useKyc.ts` (pièces KYC), `mail-attachment` (classer une pièce jointe) et `MailAttachPopover` (joindre depuis le dossier) lisent ou écrivent la table.

**Le bucket `documents`** (`20260527000000`, `20260802140000`) : privé, **20 Mio** par fichier, MIME `pdf, jpeg, png, webp, doc, docx`, layout `{agency_id}/{document_id}.<ext>`, RLS sur `storage.objects` par premier segment. Il avait été créé pour une page « DocumentGenerator » (mandat, bon de visite, offre en `@react-pdf/renderer`) qui **n'existe plus** (0 occurrence dans `src/`, 0 dans `package.json`).

**Les trois buckets R2** (`r2_bucket_get`, 14.09.2026) sont tous en juridiction `default` : `megga-market` (WEUR, **public**, servi par `img.getmegga.com`, cible de `photo-processor` et de `property-photo-r2`), `megga-images` (WEUR, sans domaine, sans lecteur dans le dépôt), `megga-sauvegardes` (**ENAM**, créé le 23.08.2026, aucune référence dans le dépôt — fiche `project_cloud_stockage_r2.md`). ⚠ **`whatsapp-process` écrit les médias entrants dans `R2_BUCKET_NAME ?? R2_BUCKET ?? 'megga-market'`** (`:110`) sous la clé `wa/{agency}/{message}.{ext}` — si aucun des deux secrets n'est posé, une photo de pièce d'identité reçue par WhatsApp pour un dossier KYC (`kyc_magic_link_uploads.wa_message_id`) part dans le **bucket public**, à une clé non devinable mais non signée. À mesurer avant le lot 0 (§6.1), pas à supposer.

**Le quota de stockage existe et ne mord pas.** `agency_usage_quotas.storage_cap_mb` (`20260726001000`) ne sert qu'à une alerte super-admin, calculée sur `documents.size_bytes + kyc_magic_link_uploads.size_bytes` — donc **un fichier absent du registre est invisible au quota**. Aucune agence n'a de plafond (0 ligne). Les plans (`src/lib/plans.ts`) ne connaissent pas de feature « stockage ».

**Ce qui se réutilise tel quel** (fichier → rôle ici) :

| Quoi | Où | Rôle ici |
|---|---|---|
| `requireAgentAuth` | `_shared/require-agent-auth.ts` | garde de toutes les edges du module |
| jeton de lien magique | `_shared/magic-link-token.ts` (HMAC, `MEGGA_MAGIC_LINK_HMAC_SECRET`) | demandes de pièces (lot 2) et partages (lot 3) |
| plafonds d'un lien public | `_shared/magic-link-limits.ts` + trigger `enforce_kyc_magic_link_upload_caps` (`20260913160400`) | modèle du plafond par lien de dépôt : 20 pièces, 100 Mo, **miroir en base qui fait foi** |
| dépôt public | `magic-link-upload` (multipart, MIME, sha256, motifs de refus opaques) | modèle de `documents-request-upload` |
| face publique | `MLK` / `RC` tokens, Manrope, mono-thème, banc `/dev/public` | la page de dépôt et la page de partage |
| classer une pièce jointe | `mail-attachment` POST `file` (copie + ligne `documents` + sha256) | la Messagerie alimente le dossier — déjà écrit |
| joindre depuis le dossier | `useAgencyDocuments`, `MailAttachPopover` | le dossier alimente la Messagerie — déjà écrit |
| médias WhatsApp | `_shared/whatsapp-media.ts`, `whatsapp-process` | « Classer au dossier » depuis une conversation (lot 7) |
| e-signature | `sign-document`, `esign-webhook`, `_shared/esign-finalize.ts`, bucket `signed-documents` | « Faire signer » (lot 5) — le PDF signé revient déjà dans `documents` |
| extraction PDF | `extract-property-pdf` (Gemini, 10 Mo, quotas par agence) | classification et extraction (lot 4) |
| rédaction PII | `_shared/pii-redaction.ts` | avant tout appel IA sur un document |
| PDF + chaîne de hachage | `audit-pdf-export` (pdf-lib, SHA-256 chaîné) | filigrane (lot 3), export du dossier (lot 7) |
| partage par lien + réactions | `buyer-reception-create/get/react` | modèle du partage suivi (lot 3) |
| pipeline R2 | `photo-processor`, `property-photo-r2` (`aws4fetch`, broker agent-auth, clé dérivée serveur) | le coffre R2 (lot 6) |
| check-list | `kyc_checklist_items` (`label, category, is_required, is_completed, document_id`) | modèle de `dossier_items` (lot 2) |
| quota + alerte | `agency_usage_quotas.storage_cap_mb`, `admin-alerts` (`storage_mb: 'stockage'`) | devient un plafond dur (lot 0) |
| journal + timeline | `activity_events`, `useContactTimeline` (`entity_id = contact_id`) | chaque geste documentaire y apparaît si et seulement si on écrit l'événement |
| coquille + onglets | `CrmWorkspace`, `useTabScopedState`, `useTabLabel`, `EtatVide` | l'écran (lot 1) |
| namespace i18n | 13 namespaces (`admin … settings`) — **aucun `documents`** | à créer, 4 langues, dès le lot 1 |

**Ce qui n'existe pas et se construit** : tout le reste de ce plan.

---

## §3 — Décisions (tranchées ici, à ne pas rouvrir sans mesure)

**D1 — Pas d'arborescence libre : le rattachement EST le classement.** Un document appartient à un bien, un deal, un contact, un dossier KYC — ou à l'agence (modèles, mandats vierges, conditions générales). L'écran dérive les « dossiers » de ces rattachements ; il n'y a ni dossier créé à la main, ni déplacement de fichier. Un deal hérite des pièces de son bien et de ses contacts : la vue « dossier de vente » est une **jointure**, pas une copie. C'est ce qui rend les check-lists, les demandes et les partages possibles : le CRM sait de quoi parle chaque pièce.

**D2 — Un registre, deux coffres, une seule porte de lecture.** `documents` reste la seule table de vérité. Colonne `storage_backend` ∈ `('supabase','r2')` : le bucket Supabase `documents` pour tout ce qui tient dans 20 Mio (lots 0-5), R2 `eu` pour le volume (lot 6). ⛔ **Aucune surface ne lit un bucket directement** : l'edge `documents-access` vérifie l'agence (ou le jeton public), journalise, **déchiffre** (D16) et rend les **octets** — `Content-Disposition` posé, type servi par allowlist, jamais celui déclaré à la dépose — exactement comme `mail-attachment`. ⛔ **Pas d'URL signée vers l'objet, ni Supabase ni R2** : l'objet est chiffré, une URL ne livrerait que du chiffré, et elle laisserait une trace dans les journaux d'accès. L'arborescence, les tailles, les compteurs se lisent dans Postgres — lister un bucket est une opération de classe A chez R2 et une lenteur chez Supabase.

**D3 — Le coffre R2 est un bucket NEUF, privé, en juridiction `eu`.** Jamais `megga-market` (public, juridiction `default`, servi par `img.getmegga.com`). La juridiction se choisit à la création et ne se change plus ; l'accès passe par `https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com`, et un client S3 ne sert qu'une juridiction — donc un `AwsClient` dédié dans `_shared/r2-eu.ts`, jamais celui de `photo-processor`. Secrets : `R2_EU_BUCKET`, `R2_EU_ACCESS_KEY_ID`, `R2_EU_SECRET_ACCESS_KEY` (jeton API borné à ce bucket). Ni domaine custom, ni `r2.dev` : rien n'y est public. Coût mesuré : USD 0.015 par Go-mois, sortie gratuite, arrondi au Go et au million d'opérations supérieurs (calculateur en §0).

**D4 — Les catégories disent la CONSERVATION.** `document_category` s'élargit : `identity, domicile, financial, compliance` (existantes) + `property` (extrait RF, plans, CECB, PPE, assurances), `contract` (mandat, offre, acte, bail), `marketing` (plaquette, photos HD, vidéos), `correspondence` (pièce d'un mail ou d'un WhatsApp), `application` (dossier de candidature locataire), `other`. Chaque catégorie porte une durée par défaut dans `document_retention_rules(category, months, basis)` : `compliance`/`identity`/`financial` = 120 mois (LBA art. 7, déjà la règle du KYC), `contract` = 120 (CO art. 958f), `application` = **0 après attribution** (PFPDT), `marketing`/`property`/`correspondence` = fin du mandat + 12 mois **à confirmer par Gregory** (§6.4). `retention_until` se pose à la classification, jamais à la main sans motif journalisé.

**D5 — Purge en deux temps, jamais en un.** `deleted_at` (corbeille, 30 jours, restaurable par l'agent) puis suppression de l'objet par le cron `documents-retention-daily`. Une ligne dont `retention_until` est passée passe en corbeille avec `actor_kind='system'`, et l'agent voit « 3 pièces seront supprimées dans 30 jours ». Le KYC garde son régime : ses pièces suivent `kyc_cases`, pas ce cron. `delete-account` étend son étape de purge aux deux coffres.

**D6 — Le dépôt passe par une edge, pas par le navigateur vers le bucket.** `documents-ingest` (POST multipart ≤ 20 Mio) vérifie le MIME **par les octets** (magic bytes, comme `attachmentServing` de `mail-attachment`), calcule le sha256, refuse HTML/SVG/exécutables, déduplique par `(agency_id, sha256_hash)` (même fichier deux fois = un objet, deux lignes), écrit la ligne **avant** l'objet (une ligne sans objet se répare, un objet sans ligne est invisible au quota — c'est le défaut actuel des 4 fichiers KYB), chiffre (D16), puis écrit l'objet. Au-delà de 20 Mio (lot 6) : le client envoie **par parties** de 5 à 100 Mio **à l'edge**, qui chiffre chaque partie (IV par partie, `enc_version = 2`) et la pousse en `UploadPart` R2 ; `finalize` compose l'objet et prend le sha256 du clair **calculé par le client**, marqué `hash_source='client'`. ⛔ **Jamais de PUT présigné du navigateur vers le bucket** : le navigateur ne détient aucune clé (D16), donc ce qu'il enverrait directement serait en clair.

**D7 — Le quota devient un plafond dur, porté par le plan.** `PLANS` et `PLAN_LIMITS` gagnent `storage_gb` : **Starter 2, Pro 50, Entreprise 500** (proposition : 500 Go pleins coûtent USD 7.50 par mois chez R2 — §0). `agency_usage_quotas.storage_cap_mb` reste la surcharge super-admin. Un trigger `enforce_documents_storage_cap` (patron `enforce_kyc_magic_link_upload_caps`) refuse l'insertion qui dépasse, **en base**, donc aussi sous dépôts parallèles ; l'edge prévient avant, l'écran montre la jauge. Le calcul lit `documents.size_bytes where deleted_at is null` : la corbeille compte, l'objet est encore là.

**D8 — La check-list est un gabarit d'agence, instancié par bien.** `document_requirement_templates(agency_id NULL = défaut MEGGA, property_kind, label, category, provider ∈ vendeur|acheteur|régie|notaire|banque|agence, validity_months, position)` — semé pour `appartement_ppe`, `maison`, `immeuble`, `terrain`, `location` ; `dossier_items(property_id, transaction_id NULL, template_id, document_id, state ∈ manquant|demandé|reçu|validé|expiré|non_requis, due_at)`. Le gabarit MEGGA par défaut est **rédigé avec Gregory** (§6.4), pas inventé : les pièces, leur fournisseur, leur validité (le CECB vaut 10 ans ; un extrait RF de plus de trois mois est refusé par la plupart des notaires — à faire confirmer). L'agent coche, ou la pièce reçue coche pour lui.

**D9 — Demander une pièce = un lien magique, un fournisseur, une échéance.** `document_requests(agency_id, dossier_item_id[], contact_id, channel ∈ whatsapp|link|email, token_hash, expires_at, status, reminder_at)`. La page publique `/pieces/:token` (Manrope, `MLK`, sans compte) montre la liste demandée, accepte le dépôt (plafonds §2, miroir en base), confirme. ⛔ **Aucun envoi automatique au client** : l'agent copie le lien, l'envoie par WhatsApp via un modèle approuvé (§6.2) ou par la Messagerie depuis sa boîte — la règle human-in-the-loop de CLAUDE.md §5 ne bouge pas. Les rappels sont **proposés** dans « Aujourd'hui » (nextAction), jamais partis seuls.

**D10 — Partager = une sélection, un destinataire, une trace.** `document_shares(agency_id, transaction_id|property_id, document_ids[], recipient_contact_id, recipient_label, token_hash, expires_at, otp_required, watermark, revoked_at)` et `document_share_events(share_id, document_id, kind ∈ opened|downloaded, at, ip_hash, ua)`. Page publique `/dossier/:token` : liste, aperçu, téléchargement ; OTP à 6 chiffres par e-mail ou SMS **si l'agent l'exige** (banque, notaire) ; filigrane pdf-lib « Transmis à <nom> le <date> par <agence> » sur les PDF quand `watermark`. Chaque ouverture écrit un `activity_events` (`category='documents'`, `entity_type='contact'`) — donc apparaît sur la timeline du contact et, comme les réactions de la réception acheteur, alimente le pipeline (« a ouvert le dossier 3 fois »). ⚠ L'IP est **hachée avec le sel quotidien** existant, comme partout.

**D11 — L'IA propose, l'agent valide, et rien ne part sans rédaction PII.** À la dépose, `documents-classify` (Gemini, première page + métadonnées, après `pii-redaction`) propose `category`, `issued_at`, `expires_at`, et le `dossier_item` que la pièce satisfait ; la ligne reste `status='pending'` avec `ai_suggestion jsonb` jusqu'au clic de l'agent. Extraction structurée : `extract-property-pdf` existe, on l'appelle. Résumé (règlement PPE, PV d'AG, bail) : DeepSeek, affiché comme « estimation », avec la page source citée. Outil copilote **READ-tier** `search_documents(query)` : rend des lignes du registre (nom, catégorie, date, rattachement), **jamais le contenu** en bloc. ⛔ Aucune validation KYC par l'IA : une pièce d'identité classée par Gemini reste à valider par l'agent, comme aujourd'hui.

**D12 — Le journal porte le FAIT et le NOM, jamais le contenu.** `activity_events.category='documents'` (à ajouter au CHECK comme `messaging` l'a été le 15.08.2026), actions `document_uploaded | classified | viewed | downloaded | shared | share_opened | requested | received | signed | trashed | restored | purged`, `object_label` = le nom classé (« Extrait RF — Ch. des Fleurs 12 »), `entity_type/entity_id` = le rattachement, `actor_kind` ∈ `user|system|ai`. Ni extrait, ni champ extrait, ni adresse dans `metadata` : `activity_events` est lisible de toute l'agence, relue sans RLS par les outils IA et les exports (règle D11 amendée de la Messagerie, 13.09.2026). Sévérité `warn` pour `purged` et `share_opened` sans OTP, `info` sinon.

**D13 — Mobile v1 = lire, photographier, envoyer.** `ResponsiveRoute` exige un écran mobile : liste par dossier, aperçu, **dépôt par l'appareil photo** (l'agent photographie un document chez le vendeur — c'est le geste mobile qui a de la valeur), envoi d'un lien de demande. Check-lists, partages et corbeille restent bureau en v1.

**D14 — Les photos d'annonces ne sont PAS des documents.** Elles gardent leur pipeline (`property-photo-r2`, `megga-market`, trois variantes, `img.getmegga.com`) : publiques par nature, servies par le cache. Le registre `documents` ne les indexe pas. Une vidéo de bien, elle, est un document `marketing` (lot 6) tant qu'elle n'est pas publiée.

**D15 — Pas de versions.** Remplacer une pièce crée une ligne neuve et met l'ancienne en corbeille avec `replaced_by`. Un historique de versions est un Drive ; ici, la pièce valide est la seule qui compte, et la corbeille garde 30 jours de repentir.

**D16 — Chaque agence a sa clé : chiffrement d'enveloppe, côté serveur, dès le premier octet.** (Décision Julien, 14.09.2026 : « le cloud doit être chiffré pour chaque compte ».) Le bucket ne contient **jamais un octet en clair** :
- **Une clé de données (DEK) par objet**, AES-256-GCM, IV de 96 bits unique, générée par `documents-ingest` via `crypto.subtle` ; **AAD = `agency_id || document_id`**, ce qui lie le chiffré à sa ligne — un objet recopié sous une autre ligne, ou d'une autre agence, ne se déchiffre pas.
- **Une clé d'agence (KEK) qui enveloppe les DEK.** La KEK vit dans **Supabase Vault**, atteinte par quatre ponts `SECURITY DEFINER` à `search_path` vide, révoqués de `public`/`anon`/`authenticated`, accordés au seul `service_role` — `documents_key_store / _read / _rotate / _destroy`, copie conforme des `mail_secret_*`. La table `agency_document_keys(agency_id, vault_secret_id, version, created_at, rotated_at, destroyed_at)` n'est qu'un **pointeur**. La KEK naît à la première dépose de l'agence et n'est **jamais** rendue à un client, jamais écrite en colonne, jamais journalisée.
- **La ligne porte le nécessaire au déchiffrement, pas la clé** : `documents.dek_wrapped bytea`, `iv bytea`, `enc_version smallint`, `key_version int`. Tout ce qui écrit dans un coffre du registre passe par **`_shared/documents-crypto.ts`** — `documents-ingest`, `mail-attachment` (« Classer dans le dossier »), `esign-finalize` (le PDF signé), et le lot 6. Un chemin d'écriture qui contourne le module est un défaut, gardé par une spec qui balaie `supabase/functions/` à la recherche de `storage.from('documents')` hors du module.
- **L'unité est l'AGENCE, pas l'agent.** Les documents sont partagés entre les agents d'une même agence (RLS `agency_id = get_my_agency_id()`, D1) ; une clé par agent obligerait à partager des clés entre agents et briserait `documents_select`. « Compte » se lit donc « compte agence » — c'est le locataire du CRM.
- **Rotation sans relecture** : une nouvelle KEK ré-enveloppe les DEK (une mise à jour par ligne), les objets ne bougent pas. **Crypto-effacement** : la purge d'une agence (`delete-account`, résiliation) **détruit la KEK** avant de supprimer les objets — ce qu'une suppression de bucket aurait manqué devient illisible pour toujours, y compris une copie de sauvegarde.
- **Ce que D16 ne donne PAS, et qu'on ne prétend pas** : ce n'est pas du zéro-connaissance. Le `service_role` déchiffre, et il le faut — classification IA (lot 4), filigrane (lot 3), aperçu, restauration de corbeille, export. Un chiffrement dont **l'agence seule** tiendrait la clé reste hors plan (§9) : perte de clé = perte des documents, et plus aucune IA ni aucun filigrane. Ce que D16 donne : une fuite de bucket, un jeton R2 mal borné, un bucket rendu public par erreur (le cas WhatsApp de §2), une sauvegarde égarée ne livrent **rien de lisible**.
- **Coût** : `crypto.subtle` AES-GCM chiffre 20 Mio en quelques dizaines de millisecondes dans l'isolat Deno ; le plafond mémoire est celui de `mail-attachment` (l'objet entier résident : deux lectures simultanées de 20 Mio = 40 Mio). Le lot 6 chiffre par partie précisément pour ne pas monter une vidéo entière en mémoire.
- ⚠ **Rétroactif = migration.** Chiffrer un coffre déjà rempli est un chantier à part (relire, chiffrer, réécrire, vérifier). D16 est donc dans le **lot 0**, avant le premier document réel ; les 4 fichiers KYB orphelins (§2) sont chiffrés en entrant au registre.

---

## §4 — Architecture et flux

```
 agent (bureau / mobile)                  vendeur · acheteur · banque · notaire (sans compte)
   │ CrmWorkspace › Documents                 │ /pieces/:token (dépôt)   /dossier/:token (lecture)
   │ fiche bien · deal · contact · KYC        │ Manrope · MLK · mono-thème · plafonds miroir en base
   ▼                                          ▼
 ┌────────────────────── edge functions (requireAgentAuth | jeton HMAC) ──────────────────────┐
 │ documents-ingest    documents-access    documents-request    documents-share   documents-classify │
 │ (MIME octets,       (déchiffre, rend    (lien magique,       (sélection, OTP,  (Gemini › proposition,│
 │  sha256, dédup,      les octets,        plafonds, dépôt      filigrane,        DeepSeek › résumé,    │
 │  quota, CHIFFRE,     filigrane, journal) public)             journal)          après pii-redaction)  │
 │  journal)                                                                                          │
 │            tous via _shared/documents-crypto.ts — DEK par objet, KEK par agence dans Vault (D16)   │
 └───────────────┬───────────────────────────────┬──────────────────────────────────┬────────────────┘
                 ▼                               ▼                                  ▼
        Postgres — le registre           coffres                              activity_events
   documents (+ storage_backend,     Supabase `documents` (≤ 20 Mio)      category='documents'
   deleted_at, ai_suggestion…)       R2 `eu` privé (lot 6, presigned)     → timeline contact
   dossier_items · templates                                              → pipeline (ouvertures)
   document_requests · shares                                             → « Aujourd'hui » (rappels)
   share_events · retention_rules
                 │
                 ▼  pg_cron
   documents-retention-daily (retention_until → corbeille → purge objet)
   documents-share-expiry-hourly (révocation des liens échus)
```

Ce qui alimente le registre sans passer par l'écran : `mail-attachment` (« Classer dans le dossier », existant), `whatsapp-process` → « Classer au dossier » (lot 7), `esign-finalize` (PDF signé, existant), `magic-link-upload` (pièces KYC, existant — reste sur son bucket et sa table, mais **apparaît** dans le dossier du contact par jointure).

---

## §5 — Modèle de données (résumé ; SQL complet au lot 0)

| Table | Statut | Colonnes clés |
|---|---|---|
| `documents` | **élargie** | + `storage_backend`, `deleted_at`, `replaced_by`, `ai_suggestion jsonb`, `hash_source`, `mime_type`, `page_count`, **`dek_wrapped bytea`, `iv bytea`, `enc_version smallint`, `key_version int`** (D16) ; `document_category` CHECK élargi (D4) ; index `(agency_id, sha256_hash)`, `(agency_id, property_id) where deleted_at is null`, idem `transaction_id`, `contact_id` |
| `agency_document_keys` | neuve | `agency_id` (PK), `vault_secret_id`, `version`, `created_at`, `rotated_at`, `destroyed_at` — un **pointeur** vers Vault, jamais la clé ; ponts `documents_key_store / _read / _rotate / _destroy` (service-role seul) |
| `document_retention_rules` | neuve | `category`, `months`, `basis` (`upload`, `mandate_end`, `allocation`), `agency_id NULL` = défaut |
| `document_requirement_templates` | neuve | `agency_id NULL` = défaut MEGGA, `property_kind`, `label`, `category`, `provider`, `validity_months`, `position` |
| `dossier_items` | neuve | `property_id`, `transaction_id`, `template_id`, `document_id`, `state`, `due_at`, `completed_by`, `completed_at` |
| `document_requests` | neuve | `contact_id`, `dossier_item_ids uuid[]`, `token_hash`, `expires_at`, `status`, `channel`, `reminder_at`, `uploads_count`, `uploads_bytes` (plafonds, trigger) |
| `document_shares` | neuve | `document_ids uuid[]`, `recipient_contact_id`, `recipient_label`, `token_hash`, `expires_at`, `otp_required`, `otp_hash`, `watermark`, `revoked_at` |
| `document_share_events` | neuve | `share_id`, `document_id`, `kind`, `at`, `ip_hash`, `user_agent` |
| `agency_usage_quotas` | inchangée | `storage_cap_mb` devient une surcharge du plan (D7) |

RLS : tout par `agency_id = get_my_agency_id()` (patron `documents_select`), FORCE ROW LEVEL SECURITY ; les tables à jeton (`document_requests`, `document_shares`, `share_events`) sont **service-role seul** côté public — la page sans compte ne parle qu'aux edges, jamais à PostgREST (règle des liens KYC, `megga/whatsapp-index` « RLS des liens »). `agency_document_keys` est **service-role seul, sans exception** : ni l'agent, ni le super-admin ne lisent le pointeur. Le super-admin lit les compteurs, pas les fichiers. ⚠ `dek_wrapped` et `iv` sont lisibles de l'agence par `documents_select` — sans la KEK ils ne valent rien, et les masquer demanderait une vue ; on ne la crée pas sans motif mesuré.

---

## §6 — Hors dépôt : ce que Julien fait à la main (aucun agent ne peut le faire)

1. **Mesurer où vont les médias WhatsApp** : lire `R2_BUCKET_NAME` / `R2_BUCKET` dans les secrets Supabase. S'ils sont absents, les médias sont dans `megga-market` (public) : poser `R2_BUCKET_NAME` sur un bucket privé **avant** le lot 0, et décider du sort des objets `wa/` existants.
2. **WhatsApp** : soumettre à Meta un modèle « demande de pièces » (catégorie *utility*, 4 langues, un bouton lien) — sans lui, D9 n'a que la copie du lien.
3. **Cloudflare (lot 6)** : créer le bucket en juridiction `eu` (`wrangler r2 bucket create <nom> --jurisdiction eu`), un jeton API R2 **borné à ce bucket**, poser les trois secrets D3. Vérifier au passage `megga-sauvegardes` (ENAM, sans référence) — tâche déjà ouverte.
4. **Gregory (avant le lot 1)** : 20 minutes sur §1 ; la liste des pièces par type de bien (D8), leurs fournisseurs et validités ; les durées de conservation hors loi (D4) ; les quotas par plan (D7). Sans ces réponses, le gabarit par défaut est une invention.
5. **Google (lot 7)** : ajouter le scope `drive.file` (non sensible) au client OAuth existant, avec l'URI `https://app.getmegga.com/oauth/drive/callback`.

---

## §7 — Portes

### 7.1 Portes CI que le module doit franchir

`npm run build` · `npm run lint` · `npm run lint:deadcode` · `npm run test:unit` (dont `documents-crypto.spec.ts` : chiffrer/déchiffrer, IV jamais réutilisé, AAD d'une autre ligne ou d'une autre agence **refusé**, `enc_version` inconnu refusé ; et la spec qui balaie `supabase/functions/` : aucun `storage.from('documents')` hors de `_shared/documents-crypto.ts`) · `npm run test:backend` (RLS des 7 tables, trigger de quota, trigger de plafond par lien, **ponts `documents_key_*` révoqués de `anon`/`authenticated` et refusés au super-admin**) · `npm run lint:claude-md` (**le compte de jobs pg_cron passe de 54 à 56**, et les buckets Storage changent : les écrire le jour du merge, pas la veille) · la porte edge-auth (chaque edge neuve sous `requireAgentAuth` ou jeton HMAC) · `polices-domaines.spec.ts` (les deux pages publiques en Manrope) · `statut-clair.spec.ts` (encres d'état sur blanc) · `megga-x-crm-tokens.spec.ts` (aucun littéral de rayon ou d'espacement) · `stockage-inventaire.spec.ts` (toute clé navigateur par compte au registre) · parité i18n 4 langues du namespace `documents` · `redirects-guard.spec.ts` (`/pieces/*` et `/dossier/*` servis par l'app, pas par la vitrine).

### 7.2 Ce qu'aucune porte ne mesure — à faire À LA MAIN avant de dire « livré »

- Un PDF déposé apparaît aux **quatre** endroits qui le rattachent (bien, deal, contact, KYC) et une seule fois dans le quota.
- **Le bucket ne contient que du chiffré** : télécharger l'objet avec la clé service-role (Storage) ou `wrangler r2 object get` (R2) rend un fichier que `file` ne reconnaît pas comme PDF, dont les 4 premiers octets ne sont pas `%PDF`, et dont la taille vaut clair + 16 octets (l'étiquette GCM). Aucun `%PDF`, aucun `JFIF`, aucun `PK` dans un `strings` du bucket.
- `documents-access` avec le JWT de l'agence rend le PDF lisible ; avec le JWT d'une **autre** agence rend 4xx ; avec la ligne recopiée sous un autre `document_id` (AAD) rend une erreur de déchiffrement, pas un fichier.
- **Crypto-effacement** : détruire la KEK d'une agence de test (`documents_key_destroy`) — l'objet est encore dans le bucket, `documents-access` rend `key_destroyed`, et rien, service-role compris, ne le relit.
- Le bucket lui-même rend 4xx sans jeton.
- La page `/dossier/:token` d'un partage révoqué rend « lien invalide », et l'ouverture a été journalisée AVANT la révocation.
- La corbeille : supprimer, voir le compteur du quota inchangé, restaurer, voir la ligne revenir à ses quatre endroits ; attendre le cron (ou l'appeler) et voir l'objet disparaître du bucket.

### 7.3 Épreuve de bout en bout (à rejouer à chaque lot)

Un vrai bien, un vrai deal, un vrai contact acheteur, une vraie boîte mail : constituer la check-list → demander l'extrait RF au vendeur par lien → le déposer depuis un téléphone → le voir classé et la case cochée → le partager à l'acheteur avec OTP → ouvrir le lien depuis un autre appareil → voir l'ouverture sur la timeline et dans le pipeline → le faire signer → retrouver le PDF signé dans le dossier → passer `retention_until` dans le passé → le voir en corbeille → le voir purgé. ⚠ **Un banc vert ne prouve rien de cette liste** : `/dev/documents` rend des fixtures.

---

## §8 — Lots, ordre, et où l'on peut s'arrêter

| Lot | Contenu | Ferme (§1) | Sert (objectifs) | Livrable autonome ? |
|---|---|---|---|---|
| **0 — Socle** | migration (§5), **`_shared/documents-crypto.ts` + ponts Vault + `agency_document_keys` (D16, avant le premier objet)**, `documents-ingest`, `documents-access`, quota dur, catégories + rétention, corbeille, 2 crons, `category='documents'`, specs RLS et crypto, `delete-account` étendu (**détruit la KEK** puis les objets) | — | 2 · 5 | oui : les 4 fichiers KYB orphelins entrent au registre **chiffrés** ; `mail-attachment` et `esign-finalize` passent par le module crypto et le registre élargi |
| **1 — L'écran** | section « Documents » (groupe Portefeuille de la barre latérale), vue par dossier (bien · deal · contact · KYC · agence), glisser-déposer, aperçu PDF/image, recherche, filtres par catégorie, jauge de quota, corbeille ; onglet « Documents » dans les 4 fiches ; mobile (D13) ; i18n `documents` ; banc `/dev/documents` | 4 | 1 · 5 | oui : l'agent dépose, retrouve, classe |
| **2 — Le dossier de vente** | gabarits (D8), `dossier_items`, état par pièce, échéances de validité, demande par lien (D9), page `/pieces/:token`, plafonds miroir, rappels dans « Aujourd'hui » | 1 · 2 | 1 · 3 | oui : « il manque 3 pièces, 2 sont demandées, 1 expire dans 12 jours » |
| **3 — Le partage suivi** | `document_shares`, page `/dossier/:token`, OTP, filigrane, journal des ouvertures, timeline + pipeline, révocation, expiration | 3 · 4 | 3 · 4 | oui : c'est le différenciateur — savoir qui a ouvert quoi |
| **4 — L'IA** | `documents-classify` (proposition), extraction (`extract-property-pdf` branché), résumé DeepSeek cité, `search_documents` copilote, « pièces manquantes probables », rédaction PII | 1 · 4 | 1 · 2 | oui, mais chaque geste reste une proposition à valider |
| **5 — Générer et signer** | plaquette PDF (gabarit pdf-lib, `doc-generation` phase 2), fiche et PV de visite, « Faire signer » sur tout PDF via `sign-document`, retour dans le dossier | 3 | 3 | oui : le mandat part signé du CRM |
| **6 — R2 UE (volume)** | `_shared/r2-eu.ts`, `storage_backend='r2'`, envoi par parties **via l'edge, chiffrées partie par partie** (`enc_version = 2`, jamais de PUT présigné — D6/D16), vidéos et visites virtuelles, règle de cycle de vie → accès peu fréquent pour les dossiers clos (≥ 30 jours, relecture facturée), outil de migration Supabase → R2, purge dans les deux coffres | — | 5 | oui, **et seulement quand une agence dépasse 20 Mio par fichier ou 100 Go en tout** — avant, c'est un coût de complexité sans usage |
| **7 — L'écosystème** | import Google Drive (`drive.file`, pop-up OAuth du patron Messagerie), « Classer au dossier » depuis WhatsApp, export ZIP du dossier avec index horodaté et chaîne de hachage (pour le notaire), API de lecture pour le plan Entreprise (`apiAccess`) | 3 · 4 | 5 | oui, lot par lot |

**Ordre imposé : 0 → 1 → 2 → 3.** Après le lot 2, le module vaut son entrée dans la barre latérale ; après le lot 3, il vaut une ligne dans la vitrine. Les lots 4 à 7 sont indépendants entre eux et se planifient sur usage mesuré : **ne pas ouvrir le lot 6 tant que `max(size_bytes)` et `sum(size_bytes)` par agence ne l'exigent pas**, ne pas ouvrir le lot 4 tant qu'il n'y a pas 200 documents réels à classer.

Après **chaque** lot : `npm run build`, `npm run test:unit`, `npm run test:backend`, les portes de §7.1, l'épreuve §7.3, puis **mettre le cerveau à jour** (§10).

---

## §9 — Ce que ce plan ne fait PAS

- Pas d'**arborescence libre**, pas de « nouveau dossier », pas de déplacement (D1).
- Pas de **client de synchronisation** (dossier local, Finder/Explorateur) ni d'application native.
- Pas d'**édition en ligne** (Office, annotations) : on stocke, on montre, on fait signer.
- Pas de **versions** (D15).
- Pas de **chiffrement côté client** ni de **zéro-connaissance** : le chiffrement est en enveloppe, côté serveur, avec une clé par agence tenue dans Vault (D16). Un chiffrement dont l'agence **seule** tiendrait la clé se décide à part, avec son coût : perte de clé = perte des documents, plus d'IA, plus de filigrane, plus de restauration.
- Pas de chiffrement rétroactif des buckets **`kyc-magic-link`** et **`signed-documents`** dans ce plan : leurs lecteurs (OCR, rapport KYC, `esign-finalize`) lisent l'objet directement, et les pièces KYC suivent leur propre régime de conservation. Les y aligner est un lot à part, écrit quand ces buckets auront des objets (0 aujourd'hui dans `kyc-magic-link`, 0 dans `signed-documents`).
- Pas d'**antivirus** : allowlist MIME par les octets, taille, sha256. Un scan tiers (ClamAV dans un Worker) est une suite possible, non chiffrée ici.
- Pas de **portail vendeur** ni d'espace client persistant : les liens à jeton, avec expiration, sont la règle (§2, `megga/flow-portal-kyc` caduc).
- Pas de **partage inter-agences** (le réseau reste hors périmètre v1, CLAUDE.md §8).
- Pas d'**OCR intégral** de tout document : classification et extraction ciblée seulement (lot 4).
- Pas de **Claude / Anthropic** nulle part.
- Pas de **photos d'annonces** dans le registre (D14).

---

## §10 — Après livraison

1. Cerveau : ajouter dans `.claude-flow/knowledge/megga-memory.seed.json` les clés `megga/documents-architecture` (D1-D16 condensées, tables, edges, crons), `megga/documents-chiffrement` (DEK par objet, KEK par agence dans Vault, AAD, rotation, crypto-effacement, ce que ça ne donne pas), `megga/documents-face-publique` (les deux pages à jeton, plafonds miroir, OTP), `megga/documents-retention` (catégories → durées, corbeille, purge) ; puis `npm run ruflo:seed`.
2. `docs/system-map.md` : nouvelle section « Documents (dossier de vente) » ; corriger « Storage buckets » (§3) et le catalogue des edges (§5).
3. `docs/schema.md` : `documents` élargie (`:236` est déjà périmée — elle ignore `retention_until`, `sha256_hash` et les colonnes de signature), les 6 tables neuves.
4. `docs/pages.md` : `/dashboard/documents`, `/pieces/:token`, `/dossier/:token`, `/dev/documents`.
5. `CLAUDE.md` §3 (la face publique passe de six à **huit** surfaces sans compte), §7 (jobs pg_cron), §8 (état d'implémentation, secrets R2 `eu` au lot 6), puis `npm run lint:claude-md`.
6. `docs/CHANGELOG.md`.
