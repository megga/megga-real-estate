# Registre des activités de traitement — MEGGA Real Estate

**Base légale :** Art. 12 nLPD (Loi fédérale sur la protection des données, révisée, en vigueur depuis le 1er septembre 2023) + Ordonnance sur la protection des données (OPDo).

**Responsable du traitement :**
- Raison sociale : `{{RAISON_SOCIALE}}` (ex. MEGGA SA)
- Adresse : `{{ADRESSE_COMPLETE}}`, Suisse
- Registre du commerce : `{{NUMERO_IDE}}` (format CHE-XXX.XXX.XXX)
- Représentant légal : `{{NOM_REPRESENTANT}}`
- Conseiller à la protection des données : voir document `04-designation-dpo.md`

**Date de création du registre :** `{{DATE_CREATION}}`
**Dernière mise à jour :** `{{DATE_MAJ}}`
**Responsable du registre :** `{{NOM_DPO_OU_RESPONSABLE}}`
**Version :** 1.0

---

## Instructions de mise à jour

- **Fréquence de revue :** au minimum semestrielle, et à chaque ajout/modification d'une activité de traitement.
- **Qui peut modifier :** le conseiller à la protection des données (DPO) ou, à défaut, la direction.
- **Conservation :** le registre doit être conservé pendant toute la durée de l'activité du responsable du traitement + 10 ans après la fin de la dernière activité enregistrée.
- **Accès :** disponible sur demande du PFPDT (Préposé Fédéral à la Protection des Données et à la Transparence) et des personnes concernées.

---

## Table des activités de traitement

| # | Activité | Catégorie de risque |
|---|---|---|
| 1 | Gestion des comptes utilisateurs (agents, admins) | Normal |
| 2 | CRM — contacts agents (acheteurs, vendeurs, prospects) | Normal |
| 3 | Marketplace publique — recherche et affichage de biens | Normal |
| 4 | Estimation vendeur (`/vendre`) et génération de leads | Normal |
| 5 | **Conformité LBA/KYC — screening PEP/Sanctions via Dilisense** | **Élevé** |
| 6 | **Scoring comportemental IA (buyer/seller intelligence)** | **Élevé** |
| 7 | Messagerie in-app (chat agents ↔ clients) | Normal |
| 8 | Génération de documents (mandats, bons de visite, offres) | Normal |
| 9 | Support client (tickets) | Normal |
| 10 | Analytics PostHog (avec consentement) | Normal |
| 11 | Synchronisation calendriers externes (Google, Outlook) | Normal |
| 12 | Copilote IA (assistance agent via DeepSeek) | Normal |
| 13 | **Onboarding agence — vérification d'identité du dirigeant (KYB)** | **Élevé** |

Les activités marquées **risque élevé** (#5, #6 et #13) font l'objet d'une **analyse d'impact (DPIA)** séparée (voir `02-dpia-scoring-ia-kyc.md`).

> ⚠ **L'activité #13 n'est pas couverte par la DPIA existante**, qui est antérieure (11.04.2026)
> au dispositif KYB (juillet–août 2026). Elle traite pourtant une pièce d'identité officielle
> et un contrôle du vivant. DPIA à étendre — voir « Points ouverts » en fin de registre.

---

## Activité n°1 — Gestion des comptes utilisateurs

| Champ | Valeur |
|---|---|
| **Finalité** | Création et gestion des comptes des agents immobiliers et administrateurs utilisant la plateforme MEGGA |
| **Base légale (art. 31 nLPD)** | Exécution du contrat de service (abonnement SaaS) |
| **Catégories de personnes concernées** | Agents immobiliers, employés d'agences partenaires, administrateurs |
| **Catégories de données** | Nom, prénom, email professionnel, téléphone, avatar, rôle (admin/manager/agent/assistant), langue préférée, canton, agence d'appartenance, mot de passe (haché bcrypt via Supabase Auth) |
| **Destinataires internes** | Équipe technique MEGGA (accès restreint via RLS Supabase) |
| **Sous-traitants** | Supabase (hébergement auth + DB) — eu-west-1 Ireland |
| **Transferts hors Suisse/UE** | Aucun |
| **Durée de conservation** | Tant que le compte est actif. À la suppression du compte via `delete-account`, anonymisation immédiate (colonne `deleted_at`). Les logs d'audit liés au compte sont anonymisés (`actor_id = 'deleted_user'`). |
| **Mesures de sécurité** | TLS 1.3, RLS PostgreSQL agency-scoped, authentification Supabase (JWT), 2FA (à activer), audit trail via `activity_events` |
| **Droits des personnes concernées** | Accès, rectification, effacement via page Paramètres > Sécurité > Zone dangereuse |

---

## Activité n°2 — CRM contacts agents

| Champ | Valeur |
|---|---|
| **Finalité** | Permettre aux agents immobiliers de gérer leur portefeuille de clients (acheteurs, vendeurs, bailleurs, locataires, prospects) dans le cadre de leurs activités de courtage |
| **Base légale (art. 31 nLPD)** | Intérêt légitime du responsable du traitement (exécution d'activités de courtage immobilier pour le compte de l'agent) — le responsable du traitement effectif pour les contacts CRM est **l'agence utilisatrice**, MEGGA agissant comme sous-traitant au sens de l'art. 9 nLPD. Un contrat de sous-traitance (DPA) doit être signé avec chaque agence. |
| **Catégories de personnes concernées** | Clients et prospects des agences utilisatrices (personnes physiques et morales) |
| **Catégories de données** | Identité (nom, prénom, nationalité), coordonnées (email, téléphone, adresse), critères de recherche immobilière, budget, tags, notes libres saisies par l'agent, scores comportementaux IA (voir activité #6), historique d'interactions |
| **Destinataires internes** | Agent propriétaire du contact + autres agents de la même agence selon les rôles configurés |
| **Sous-traitants** | Supabase (hébergement) — eu-west-1 Ireland |
| **Transferts hors Suisse/UE** | Aucun direct. Le copilote IA (activité #12) envoie un contexte CRM à **DeepSeek (Chine)** — ⚠ **base de transfert non établie**, voir activité #12 |
| **Durée de conservation** | Tant que la relation commerciale est active. Archivage 5 ans après dernier contact (délai de prescription contractuelle). Au-delà, suppression sauf si un dossier KYC lié est encore soumis à rétention LBA 10 ans. |
| **Mesures de sécurité** | RLS PostgreSQL (un agent ne voit que les contacts de son agence), audit trail sur chaque création/modification/suppression, chiffrement au repos (Supabase), chiffrement en transit (TLS 1.3) |
| **Droits des personnes concernées** | Les personnes concernées exercent leurs droits auprès de l'agence utilisatrice (responsable du traitement). MEGGA transmet les demandes reçues à l'agence concernée dans un délai de 5 jours ouvrables. |

---

## Activité n°3 — Marketplace publique

| Champ | Valeur |
|---|---|
| **Finalité** | Permettre aux visiteurs publics de rechercher des biens immobiliers à vendre ou louer en Suisse |
| **Base légale (art. 31 nLPD)** | Exécution d'un service demandé par l'utilisateur (recherche immobilière) + intérêt légitime (mise en relation acheteur/agent) |
| **Catégories de personnes concernées** | Visiteurs du site (acheteurs, locataires potentiels), agents propriétaires des annonces |
| **Catégories de données collectées côté visiteur** | Critères de recherche (zone, budget, type), favoris (localStorage), historique de consultation (avec consentement analytics), adresse IP (logs serveur) |
| **Catégories de données affichées** | Photos, description, prix, adresse approximative des biens ; nom et coordonnées publiques de l'agent listant |
| **Sous-traitants** | Supabase (DB) — eu-west-1 | Mapbox (cartographie) — États-Unis | Cloudflare Pages (CDN) — Suisse/international |
| **Transferts hors Suisse/UE** | Mapbox (US) — base : SCCs. Cloudflare peut router via des datacenters hors UE. |
| **Durée de conservation** | Favoris : localStorage tant que l'utilisateur ne les supprime pas. Logs serveur : 90 jours. Annonces : jusqu'à retrait par l'agent. |
| **Mesures de sécurité** | TLS, pas de collecte d'identité sans consentement, cookie banner conforme LPD avec opt-in analytics |
| **Droits des personnes concernées** | Pas de compte donc droit d'accès/effacement limité aux données côté serveur (logs IP) sur demande à `privacy@megga.ch` |

---

## Activité n°4 — Estimation vendeur et génération de leads

| Champ | Valeur |
|---|---|
| **Finalité** | Proposer aux propriétaires suisses une estimation instantanée de leur bien en échange de leurs coordonnées, transmises ensuite à une agence partenaire |
| **Base légale (art. 31 nLPD)** | Consentement explicite de la personne concernée (checkbox LPD obligatoire sur le formulaire) |
| **Catégories de personnes concernées** | Propriétaires immobiliers suisses souhaitant vendre |
| **Catégories de données** | Nom, prénom, email, téléphone, motivation de vente, caractéristiques du bien (adresse, type, pièces, surface, état, photos optionnelles) |
| **Sous-traitants** | Supabase (DB + Storage pour photos) — eu-west-1 | Resend (email de confirmation) — États-Unis |
| **Transferts hors Suisse/UE** | Resend (US) — base : SCCs |
| **Durée de conservation** | 24 mois à compter de la soumission si aucun contrat de mandat n'est signé. Si un mandat est signé, la conservation suit la durée du mandat + 5 ans. |
| **Mesures de sécurité** | Checkbox de consentement obligatoire, lien vers politique de confidentialité, transmission chiffrée, accès restreint aux agents autorisés |
| **Droits des personnes concernées** | Accès, rectification, effacement via `privacy@megga.ch` ou depuis le portail vendeur (`/portail`) |

---

## Activité n°5 — Conformité LBA/KYC (traitement à risque élevé)

| Champ | Valeur |
|---|---|
| **Finalité** | Satisfaire aux obligations de la Loi fédérale concernant la lutte contre le blanchiment d'argent (LBA, RS 955.0) et de l'ordonnance LBA, en vérifiant l'identité des parties à une transaction immobilière et en effectuant un screening PEP/Sanctions |
| **Base légale (art. 31 nLPD)** | Obligation légale (LBA art. 3 et suivants) |
| **Catégories de personnes concernées** | Clients (acheteurs, vendeurs) lors d'une transaction immobilière, bénéficiaires économiques effectifs pour les personnes morales (UBO) |
| **Catégories de données** | Identité complète, nationalité, date de naissance, adresse, documents d'identité (passeport, carte d'identité, permis de séjour), justificatifs de domicile, origine des fonds, documents financiers, **données sensibles** : statut PEP (Politically Exposed Person), hits sanctions internationales |
| **Catégories de données sensibles (art. 5 let. c nLPD)** | Oui — données relatives à des sanctions et PEP (traitées comme sensibles par assimilation au risque réputationnel et juridique) |
| **Profilage ou décision automatisée** | Oui — risk scoring automatique 0-100 basé sur 5 facteurs FATF (nationalité, PEP, montant, type PP/PM, complétude dossier). **Le score est une estimation IA, pas une décision** : la validation finale nécessite toujours l'intervention humaine d'un agent (human-in-the-loop, art. 21 nLPD) |
| **Sous-traitants** | Supabase (DB + Storage bucket `kyc-documents` agency-scoped) — eu-west-1 | **Dilisense** (API screening PEP/Sanctions) — Union Européenne |
| **Transferts hors Suisse/UE** | Aucun. Le screening est assuré par Dilisense (UE) et la revue humaine MLRO. L'analyse qualitative par Claude décrite jusqu'au 06.08.2026 **n'existe plus** : le fournisseur Anthropic a été retiré du dépôt, et le drapeau `KYC_AI_ANALYSIS_ENABLED` n'est plus référencé nulle part (vérifié le 06.08.2026). ⚠ Toute réintroduction d'une inférence sur les données KYC créerait un transfert et imposerait la mise à jour de ce registre. |
| **Durée de conservation** | **10 ans** à compter de la fin de la relation d'affaires (LBA art. 7 al. 3). Application technique : colonne `documents.retention_until` + trigger `trg_enforce_kyc_retention` qui bloque toute tentative de suppression anticipée. |
| **Mesures de sécurité spécifiques** | Storage bucket agency-scoped (un agent ne voit que les documents de sa propre agence), audit trail exhaustif de chaque action (création, modification, validation, screening, suppression) avec `actor_id` et `metadata` horodatés, rôles granulaires, chiffrement au repos, transfert TLS 1.3 |
| **DPIA** | **Obligatoire** — voir `02-dpia-scoring-ia-kyc.md` |
| **Droits des personnes concernées** | Droit d'accès et de rectification. **Droit d'effacement limité par l'obligation légale de conservation 10 ans LBA** (art. 6 nLPD ne prévaut pas sur une obligation légale). La personne concernée est informée de cette limitation dès la collecte. |

---

## Activité n°6 — Scoring comportemental IA (traitement à risque élevé)

| Champ | Valeur |
|---|---|
| **Finalité** | Assister l'agent immobilier dans la qualification de ses contacts (buyer/seller intelligence : score de sérieux, timing, probabilité d'achat, niveau d'engagement, niveau de tension pour les vendeurs) |
| **Base légale (art. 31 nLPD)** | Intérêt légitime du responsable du traitement (efficacité commerciale) |
| **Catégories de personnes concernées** | Contacts CRM (acheteurs, vendeurs, prospects) |
| **Catégories de données d'entrée** | Fréquence des interactions, temps de réponse, historique de visites, budget déclaré vs budget réel estimé, feedbacks post-visite, changements d'étape pipeline, nombre de biens consultés |
| **Données produites** | Scores 0-100 (sérieux, probabilité d'achat, engagement) ; catégories (`immediate`, `1-3_months`, `hot`, `warm`, `cold`, `dormant`, `calm`, `moderate`, `tense`, `critical`) |
| **Profilage ou décision automatisée (art. 21 nLPD)** | **Oui — profilage à risque élevé** au sens de l'art. 5 let. g nLPD. Cependant, le score n'entraîne **aucune décision automatisée produisant un effet juridique** : l'agent reste seul maître de ses actions commerciales. Le score est affiché avec le label explicite "estimation IA". |
| **Droit d'opposition** | La personne concernée peut demander le retrait du scoring IA sur son profil en écrivant à `privacy@megga.ch`. Le champ `ai_*` est alors remis à NULL dans la base. |
| **Sous-traitants** | Supabase (calcul via Edge Function `score-engine`) — eu-west-1 |
| **Transferts hors Suisse/UE** | Aucun (le scoring est calculé côté Supabase, pas envoyé à une API externe) |
| **Durée de conservation** | Liée à celle du contact parent (cf. activité #2) |
| **Mesures de sécurité** | Audit trail sur chaque calcul (`actor_id = 'ai'`), scores affichés en lecture seule, réversibilité (l'agent peut ignorer la suggestion) |
| **DPIA** | **Obligatoire** — voir `02-dpia-scoring-ia-kyc.md` |
| **Information transparente** | Mention "estimation IA" visible sur chaque score affiché dans l'interface agent |

---

## Activité n°7 — Messagerie in-app

| Champ | Valeur |
|---|---|
| **Finalité** | Permettre la communication entre l'agent, ses contacts CRM et le copilote MEGGA AI |
| **Base légale** | Exécution du contrat (service SaaS) + consentement de la personne concernée pour les messages client |
| **Catégories de données** | Contenu des messages, horodatage, statut de lecture, pièces jointes, identité des interlocuteurs |
| **Sous-traitants** | Supabase (DB + Realtime) — eu-west-1 | **DeepSeek** (copilote IA) — **Chine** (uniquement pour les conversations IA) |
| **Transferts hors Suisse/UE** | **DeepSeek (Chine)** — ⚠ **base de transfert non établie**. Les messages envoyés au copilote IA sont transmis à `api.deepseek.com`. La Chine ne bénéficie d'aucune décision d'adéquation, ni du Conseil fédéral (annexe 1 OPDo) ni de la Commission européenne. La politique de rétention et de réutilisation des prompts par le fournisseur n'est pas documentée à ce jour. |
| **Durée de conservation** | Tant que la conversation est active + 2 ans après le dernier message |
| **Mesures de sécurité** | RLS Supabase, audit trail via `activity_events` pour les conversations liées à un dossier KYC |

---

## Activité n°8 — Génération de documents

| Champ | Valeur |
|---|---|
| **Finalité** | Générer des documents transactionnels (mandats de vente, bons de visite, offres d'achat) à partir de templates |
| **Base légale** | Exécution du contrat entre l'agent et son client |
| **Catégories de données** | Identité des parties, caractéristiques du bien, montants, conditions |
| **Sous-traitants** | Supabase (DB + Storage) — eu-west-1 |
| **Transferts hors Suisse/UE** | Aucun |
| **Durée de conservation** | 10 ans à compter de la signature (délai légal de conservation des pièces comptables et commerciales, CO art. 958f) |
| **Mesures de sécurité** | Storage privé, RLS, audit trail |

---

## Activité n°9 — Support client

| Champ | Valeur |
|---|---|
| **Finalité** | Répondre aux demandes de support technique et commerciales |
| **Base légale** | Exécution du contrat de service |
| **Catégories de données** | Email, nom, contenu du ticket, pièces jointes, historique de conversation |
| **Sous-traitants** | Supabase (DB) | Resend (notifications email) — US | **DeepSeek** (suggestion IA de réponse) — **Chine** |
| **Transferts hors Suisse/UE** | Resend (US) — base : SCCs. **DeepSeek (Chine)** — ⚠ **base de transfert non établie**, voir activité #12 |
| **Durée de conservation** | 3 ans après clôture du ticket |
| **Mesures de sécurité** | Accès restreint aux super-admins, audit trail, AI reply en mode suggestion (human-in-the-loop) |

---

## Activité n°10 — Analytics PostHog

| Champ | Valeur |
|---|---|
| **Finalité** | Mesurer l'usage de la plateforme, détecter les frictions UX, prioriser les améliorations produit |
| **Base légale (art. 31 nLPD)** | **Consentement explicite** de l'utilisateur via cookie banner |
| **Catégories de données** | Parcours de navigation, clics, temps passé, résolution d'écran, navigateur, adresse IP tronquée |
| **Catégories de personnes concernées** | Visiteurs du site et utilisateurs connectés ayant consenti |
| **Sous-traitants** | PostHog EU (`eu.posthog.com`) |
| **Transferts hors Suisse/UE** | Aucun (instance EU uniquement) |
| **Durée de conservation** | 12 mois glissants |
| **Mesures de sécurité** | Session recording désactivé, IP tronquée, cookie banner bloque l'initialisation tant que le consentement n'est pas donné |
| **Droit de retrait du consentement** | Via le gestionnaire de cookies (lien dans le footer) ou en écrivant à `privacy@megga.ch` |

---

## Activité n°11 — Synchronisation calendriers externes

| Champ | Valeur |
|---|---|
| **Finalité** | Permettre à l'agent de synchroniser ses visites MEGGA avec Google Calendar ou Outlook |
| **Base légale** | Consentement explicite (OAuth flow) |
| **Catégories de données** | Titre de l'événement, date, durée, participants, lieu, tokens OAuth (access + refresh) |
| **Sous-traitants** | Google (Calendar API) — États-Unis | Microsoft (Graph API / Outlook) — États-Unis |
| **Transferts hors Suisse/UE** | Google + Microsoft (US) — base : DPF |
| **Durée de conservation** | Tant que la synchronisation est active. À la déconnexion, suppression immédiate des tokens et des entrées synchronisées. |
| **Mesures de sécurité** | Tokens chiffrés en DB, RLS, révocation possible depuis Paramètres > Applications |

---

## Activité n°12 — Copilote IA (assistance agent)

| Champ | Valeur |
|---|---|
| **Finalité** | Fournir à l'agent un assistant conversationnel pour résumer un client, rédiger une relance, proposer une prochaine action |
| **Base légale** | Exécution du contrat (fonctionnalité SaaS) |
| **Catégories de données** | Prompt de l'agent, contexte CRM injecté (résumé contact, pipeline), réponse générée |
| **Profilage ou décision automatisée** | Non — assistance uniquement, l'agent reste décideur |
| **Sous-traitants** | Supabase (Edge Function `ai-copilot`) — eu-west-1 | **DeepSeek** (`deepseek-chat`, appel direct `api.deepseek.com`) — **Chine** |
| **Transferts hors Suisse/UE** | ⚠ **DeepSeek (Chine) — base de transfert NON ÉTABLIE.** La Chine ne figure pas à l'annexe 1 OPDo (États à protection adéquate) et ne bénéficie d'aucune décision d'adéquation européenne. Un transfert vers un État sans adéquation exige l'une des garanties de l'art. 16 al. 2 nLPD (clauses types, règles d'entreprise contraignantes) ou une dérogation de l'art. 17. **Aucune n'est documentée à ce jour, et aucun DPA n'est signé avec ce fournisseur.** À arbitrer — voir « Points ouverts ». |
| **Durée de conservation** | Prompts et réponses : 30 jours côté Supabase (logs). **Côté DeepSeek : inconnue** — la politique de rétention du fournisseur n'a pas été établie contractuellement. |
| **Mesures de sécurité** | Audit trail complet (`actor_id = 'ai'`), system prompt verrouillé (interdit à l'IA de valider un KYC ou de contacter un client), mention "estimation IA" sur toute sortie |

---

## Activité n°13 — Onboarding agence : vérification d'identité du dirigeant (KYB)

> Activité ajoutée au registre le **06.08.2026**. Le dispositif KYB est entré en service en
> juillet–août 2026 ; le registre datait du 11.04.2026 et ne le décrivait pas. Les champs
> marqués **À DÉTERMINER** appellent un arbitrage de la direction et ne doivent pas être
> considérés comme conformes en l'état.

| Champ | Valeur |
|---|---|
| **Finalité** | Vérifier l'identité du dirigeant d'une agence candidate avant l'ouverture d'un compte, afin de satisfaire aux obligations de diligence et d'écarter les inscriptions frauduleuses |
| **Base légale (art. 31 nLPD)** | Exécution du contrat (conditions d'entrée en relation d'affaires) + intérêt légitime à prévenir la fraude. ⚠ **À faire valider** : le contrôle du vivant (selfie) peut relever de données biométriques au sens de l'art. 5 let. c ch. 4 nLPD, ce qui déplacerait la base légale vers le consentement explicite |
| **Catégories de personnes concernées** | Dirigeants et personnes proches des agences candidates (`agency_related_persons`) |
| **Catégories de données** | Nom, prénom, **date de naissance**, **nationalité**, **type et numéro de pièce d'identité**, **image de la pièce d'identité** (voie de secours), **selfie et contrôle du vivant** (voie Stripe), rôle déclaré, statut et horodatage de vérification |
| **Catégories de données sensibles (art. 5 let. c nLPD)** | ⚠ **Probablement oui** — le selfie avec détection du vivant traité aux fins d'identifier une personne physique constitue une donnée biométrique. **À faire trancher juridiquement.** |
| **Profilage ou décision automatisée** | Non. Le verdict de la pièce est posé par un relecteur humain (`admin_resolve_agency_id_document`) ; une vérification Stripe réussie ne valide pas le dossier seule (compliance-enabling, jamais replacing) |
| **Sous-traitants** | Supabase (DB + Storage) — eu-west-1 | **Stripe Identity** (document authentique + selfie) — États-Unis | **Google LLC — Gemini `gemini-2.5-flash-lite`** : lecture OCR de l'image de la pièce d'identité (`_shared/kyb-id-read.ts`) — États-Unis |
| **Transferts hors Suisse/UE** | Stripe (US) — base : SCCs + DPF. **Google/Gemini (US) — base : DPF**, mais ⚠ le DPA Google Workspace couvrait jusqu'ici un usage « virtual staging » de photos de biens ; **l'OCR d'une pièce d'identité officielle est un traitement d'une tout autre sensibilité et doit être re-qualifié contractuellement.** |
| **Durée de conservation** | **Image de la pièce : détruite dès que le relecteur a tranché** (verdict `match` ou `mismatch`). Un dossier resté sans verdict est purgé au bout de **90 jours** (échéance de sécurité, `kyb_identity_retention_days()`). Application technique : inventaire `kyb_identity_files()`, balayage quotidien `kyb-identity-purge` (05:20 UTC), journal append-only `agency_id_document_purges`. — **Données déclarées** (`date_of_birth`, `nationality`, `id_document_type`, `id_document_number`) : ⚠ durée **encore à déterminer**, voir point ouvert n°2. |
| **Mesures de sécurité** | Préfixe Storage cloisonné par 4 policies dédiées (`documents_kyb_identity_*`), lecture super-admin en SELECT seul, verdict append-only et daté, `id_document_number` en lecture restreinte par RLS |
| **DPIA** | ⚠ **Obligatoire et manquante** — la DPIA existante (`02-dpia-scoring-ia-kyc.md`, 11.04.2026) ne couvre ni le KYB, ni le contrôle du vivant, ni l'OCR de pièce d'identité |
| **Droits des personnes concernées** | Accès et rectification via le dirigeant de l'agence. **Effacement de l'image : opérant** — la pièce est détruite au verdict, et sa destruction est attestée par `agency_id_document_purges` (chemin, motif, date), journal sans FK ni cascade pour qu'il survive à la suppression de l'agence. ⚠ **Reste non opérant sur les données déclarées** : `agency_related_persons` n'est atteinte ni par `delete-account` ni par `admin-dsar-export` — voir point ouvert n°2. |

---

## Annexe A — Liste complète des sous-traitants

| Sous-traitant | Rôle | Localisation | Base du transfert | Contrat |
|---|---|---|---|---|
| Supabase | Hébergement DB, Auth, Storage, Edge Functions | Irlande (eu-west-1) | UE — décision d'adéquation | DPA signé |
| **DeepSeek** | API `deepseek-chat` — **toute l'inférence texte** (copilote, WhatsApp, mémoire contact, style agent, alertes) | **Chine** | ⚠ **AUCUNE — à établir** | ⚠ **Aucun DPA signé** |
| Dilisense | API screening PEP/Sanctions | Union Européenne | UE — décision d'adéquation | DPA signé |
| Stripe | Traitement des paiements d'abonnement | États-Unis | SCCs + DPF | DPA via Terms |
| Resend | Envoi d'emails transactionnels | États-Unis | SCCs | DPA via Terms |
| Google LLC | Google Calendar API, Gemini : virtual staging, extraction PDF, **et OCR des pièces d'identité KYB** | États-Unis | DPF | DPA via Workspace Terms — ⚠ **portée à re-qualifier** (l'OCR de pièce d'identité dépasse l'usage initialement documenté) |
| Stripe Identity | Vérification de pièce d'identité + contrôle du vivant (selfie) — activité #13 | États-Unis | SCCs + DPF | DPA via Terms |
| Microsoft | Outlook Calendar / Graph API | États-Unis | DPF | DPA via Services Agreement |
| Mapbox | Cartographie | États-Unis | SCCs | DPA signé |
| PostHog | Analytics | Union Européenne (`eu.posthog.com`) | UE — décision d'adéquation | DPA signé |
| Cloudflare | Hébergement Pages, CDN, DNS | Suisse / International | DPA signé |

**Action requise :** signer un contrat de sous-traitance (DPA) conforme à l'art. 9 nLPD avec chaque sous-traitant listé ci-dessus. Garder une copie dans un dossier compliance séparé.

---

## Annexe B — Mesures techniques et organisationnelles (art. 8 nLPD + OPDo)

### Techniques
- TLS 1.3 pour tous les transferts
- Chiffrement au repos (Supabase, chiffrement AES-256 transparent)
- Row Level Security PostgreSQL sur toutes les tables sensibles
- Storage buckets privés avec policies agency-scoped
- Hashing bcrypt pour les mots de passe (via Supabase Auth)
- Audit trail complet via table `activity_events`
- Triggers de rétention LBA 10 ans sur documents KYC
- Séparation des environnements (dev / prod)
- Sauvegardes automatiques Supabase (retention 7 jours plan Pro)

### Organisationnelles
- Rôles granulaires (agent / manager / admin / super_admin)
- Principe du moindre privilège
- Procédure de notification de violation en 72h (voir `03-runbook-violation-donnees.md`)
- DPO désigné (voir `04-designation-dpo.md`)
- Formation annuelle à la protection des données pour les employés
- Revue semestrielle du registre des traitements
- DPIA pour les traitements à risque élevé

---

## Points ouverts — relevés le 06.08.2026

Ces quatre points sont des écarts **constatés dans le code**, pas des hypothèses. Ils appellent
un arbitrage avant d'affirmer la conformité du dispositif à un client ou à un auditeur.

| # | Écart | Effet | Qui tranche |
|---|---|---|---|
| 1 | **DeepSeek (Chine) reçoit toute l'inférence texte sans base de transfert ni DPA** | Transfert vers un État sans décision d'adéquation. Concerne les activités #2, #7, #9, #12 | Direction + conseil juridique |
| 2 | ~~L'image de pièce d'identité KYB n'a ni rétention ni purge~~ → **RÉGLÉ le 06.08.2026** : purge au verdict, échéance de sécurité à 90 jours, destruction attestée. **Reste ouvert** : (a) la portée de la LBA sur l'onboarding d'agence — si elle imposait une conservation, c'est `kyb_identity_retention_days()` qui change, pas le dispositif ; (b) les données DÉCLARÉES (`agency_related_persons`) n'ont toujours ni durée ni chemin d'effacement | (a) conseil juridique · (b) direction puis technique |
| 3 | **Gemini lit les pièces d'identité sous un DPA qui visait le staging de photos** | Portée contractuelle dépassée pour un traitement bien plus sensible | Direction + Google Workspace |
| 4 | **La DPIA ne couvre pas le KYB ni le contrôle du vivant** | Traitement à risque élevé sans analyse d'impact, alors que la nLPD l'exige | Direction + conseil juridique |

**Non traité par cette révision** (audit du 06.08.2026, à porter séparément) : `admin-dsar-export`
et `delete-account` couvrent des ensembles de tables presque disjoints, et ni l'un ni l'autre
n'atteint `onboarding_calls`, `onboarding_hosts` ni `agency_related_persons` — les droits d'accès
et d'effacement ne portent donc pas sur le même périmètre de données.

---

## Avertissement

Ce registre est un **template à adapter**. Il doit être complété, validé par la direction et revu par un conseil juridique spécialisé en droit suisse de la protection des données avant d'être considéré comme conforme. Les informations sur les sous-traitants, les bases légales et les durées de conservation doivent refléter la configuration réelle de l'organisation.

**Dernière revue légale :** `{{DATE_REVUE_AVOCAT}}` par `{{NOM_CABINET_JURIDIQUE}}`
