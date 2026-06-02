# KYC par WhatsApp — Assist optionnel (design)

> **Statut :** ✅ **Phase 1 livrée** (branche `claude/beautiful-almeida-0a395a`). Plan exécuté : [../plans/2026-06-02-whatsapp-kyc-assist.md](../plans/2026-06-02-whatsapp-kyc-assist.md). Phase 2 (collecte directe client) différée (gated mode test Meta).
> **Pré-requis déjà livrés :** `read_document` (Gemini Vision, `_shared/vision.ts`), copilote WhatsApp C1→C5, moteur KYC existant.

## Règle d'or (non négociable)

**Le KYC dans MEGGA est un ASSIST OPTIONNEL. Il ne bloque JAMAIS aucune action de workflow** (pipeline, envoi, dossier, signature). En Suisse, **le notaire** effectue et finalise la transaction (et le KYC légalement contraignant). MEGGA = compliance-**enabling** (collecte, lecture, pré-screen), jamais compliance-replacing ni gating. Réf. brain `megga/kyc-non-blocking`.

MEGGA **prépare** (crée le dossier, lit/joint les pièces, lance le screening). L'**humain (MLRO) valide** via la checklist existante. Aucune auto-validation : le trigger `guard_manual_kyc_verified` l'empêche au niveau DB et on n'y touche pas.

## But

Permettre à l'agent, depuis WhatsApp, d'**ouvrir et faire avancer un dossier KYC** sans quitter sa conversation — en réutilisant `read_document` et le moteur KYC existant. Sert les objectifs 1 (réduire l'admin) et 2 (réduire le risque LAB/KYC).

## Le moteur KYC existant (réutilisé tel quel)

- **`kyc_cases`** : INSERT → trigger `seed_kyc_lba_checks` crée 5 `kyc_checklist_items` (pièce d'identité, justificatif domicile, screening PEP, listes sanctions, source des fonds [requise si `vigilance='renforced'` ou montant > 100k]).
- **Vérification** : trigger `auto_verify_kyc_dossier` (sur tick d'un checklist item) → passe `dossier_status` à `verified` SEULEMENT si les 6 conditions LBA art. 7 sont réunies (tous les checks requis cochés + PEP/sanctions screenés et non `pending` + matches résolus en `false_positive`). Sinon `pending` ou `failed`.
- **Anti-falsification** : `guard_manual_kyc_verified` RAISE si on tente de forcer `verified` hors du trigger. **Doit rester.**
- **Screening** : edge `kyc-screening` (POST `{kyc_case_id, entity_type}`) → Dilisense (`checkIndividual`/`checkEntity`, fuzzy), écrit `pep_status`/`sanctions_status`/`*_details`/`risk_score`/`risk_level`/`ai_analysis`, idempotent 60 s. Nom/nationalité dérivés server-side du contact (jamais du body). **Aucun changement.**
- **Stockage pièces** : table `documents` (agent-side, FK `kyc_case_id`, rétention 10 ans auto) + `kyc_magic_link_uploads` (client-side magic link, **possède déjà `ocr_fields` jsonb + `ocr_provider`='gemini' + `ocr_completed_at`**). Buckets privés `documents` / `kyc-documents` / `kyc-magic-link`.
- **Wizard** : `KycWizardModal` (source → contact → vigilance) → `useCreateKycDossier`. Magic link client : `/kyc/:token`, edge `magic-link-upload`. Helper `kyc_by_contact_id()`.
- RLS agence + rétention 10 ans : s'appliquent automatiquement.

## Architecture proposée

MEGGA n'ajoute qu'une **fine couche WhatsApp** par-dessus ce moteur. Trois nouveaux outils copilote (composables, derrière l'infra `whatsapp-actions`/`whatsapp-tools`/`toolTier`) :

1. **`open_kyc_case`** (tier 🟡 *confirm*) — « ouvre un KYC pour Dubois ». Résout le contact via `search_contacts`, déduit le type (`buyer_pp/pm` / `seller_pp/pm`) depuis `contacts.type`+`entity_type`, `vigilance` par défaut `standard` (l'agent peut dire « renforcée »). INSERT `kyc_cases` → les 5 checks se sèment seuls. Confirme : « J'ouvre un dossier KYC pour Jean Dubois (vigilance standard). Tu confirmes ? ».
2. **`attach_kyc_document`** (auto, déclenché quand l'agent **transfère une pièce** pendant un contexte KYC) — bytes via `whatsapp-media` → `read_document` avec **prompt KYC-spécifique** (extraction structurée) → upload stocké + lié au `kyc_case` + au `kyc_checklist_item` correspondant (`document_id`). **NE coche PAS `is_completed`** (réservé au MLRO). Restitue à l'agent ce qui a été lu (« CNI d'Enora Vaucher, n° …, expire 08/2028 — jointe au dossier »).
3. **`run_kyc_screening`** (tier 🟢 *auto* — read-only externe, aucun contact client, réversible) — appelle l'edge `kyc-screening` pour le dossier → renvoie le résultat en clair (« Screening : pas de PEP, pas de sanction, risque faible »).

**Notification « prêt à valider »** : quand le screening est posé et le dossier passe à `pending`, MEGGA envoie à l'agent « Le dossier KYC de Dubois est prêt à valider dans le CRM. » (réutilise `activity_events` + un outbound WhatsApp à l'agent).

**Prompt KYC pour `read_document`** (nouveau constant, pas de nouveau provider) :
- Pièce d'identité : `{type, nom, prénom, n° document, date de naissance, nationalité, date d'expiration}`.
- Justificatif de fonds : `{montant, devise, date, institution, nature}`.
- Justificatif de domicile : `{nom, adresse, date}`.
Stocké en `ocr_fields` jsonb. Champs **proposés**, jamais traités comme vérité (validation humaine).

## Données — réutiliser, pas recréer

Pour les pièces reçues par WhatsApp : **réutiliser `kyc_magic_link_uploads`** (elle a déjà la bonne forme : `ocr_fields`, `ocr_provider`, `storage_path`, `sha256_hash`, FK `document_id`) en relâchant `magic_link_id` en nullable et en ajoutant `source` (`'magic_link'` | `'whatsapp'`), `kyc_case_id` (FK direct) et `wa_message_id`. → 1 migration légère, zéro nouvelle table. (Alternative : table `kyc_wa_uploads` dédiée — moins DRY.)

## Périmètre / phasage

- **Phase 1 — agent-facing (cible immédiate, aucune dépendance Meta).** L'agent ouvre le KYC, **transfère lui-même** les pièces qu'il a reçues (le client les lui a envoyées par email/WhatsApp), lance le screening, est notifié « prêt à valider ». Tout passe par sa conversation agent↔MEGGA (déjà appairée). Pas d'envoi client → pas de template Meta requis.
- **Phase 2 — collecte directe auprès du CLIENT par WhatsApp (différée).** MEGGA demande au client d'envoyer ses pièces directement. **Gated** par la sortie du mode test Meta + templates approuvés (même contrainte que groupes/envois — réf. `megga/whatsapp-groups-api`). Le **magic link `/kyc/:token` existant couvre déjà** l'auto-collecte client ; WhatsApp est un canal en plus, pour plus tard.

## Réutilise vs nouveau (récap)

**Réutilisé sans changement :** `kyc_cases` + tous ses triggers, `auto_verify_kyc_dossier`, `guard_manual_kyc_verified`, `monitor_transaction_kyc_gate`, edge `kyc-screening`, `read_document`/`vision.ts`, `whatsapp-media`, `documents` + rétention, RLS, `requireAgentAuth`, l'infra outils `whatsapp-actions`/`toolTier`/`stashPending`/`executePending`.

**Nouveau :** 3 outils (`open_kyc_case`/`attach_kyc_document`/`run_kyc_screening`) + leurs exécuteurs, le prompt KYC d'extraction, 1 migration légère sur `kyc_magic_link_uploads` (source/kyc_case_id/wa_message_id + magic_link_id nullable), la notif « prêt à valider », et le câblage média image/document → KYC quand un contexte KYC est actif.

## Questions à trancher (conversation fraîche, avec Gregory)

1. **Phasage** : Phase 1 (agent-facing) d'abord, Phase 2 (collecte client WhatsApp) après la sortie du mode test Meta ? *(reco : oui)*
2. **Checklist** : quand MEGGA joint une pièce lue, on **laisse l'item `is_completed` au MLRO** (assist pur) ou on coche auto si la pièce est présente ? *(reco : laisser au MLRO — assist, pas remplacement)*
3. **Stockage** : réutiliser `kyc_magic_link_uploads` (recommandé) ou table dédiée `kyc_wa_uploads` ?
4. **`run_kyc_screening`** : tier auto (reco) ou confirm ?
5. **Déclencheur de `attach_kyc_document`** : automatique dès qu'une image/PDF arrive quand un KYC est « ouvert » pour ce contact, ou seulement si l'agent le dit explicitement (« c'est la pièce d'identité de Dubois ») ? *(reco : explicite, pour éviter de joindre une capture sans rapport)*

## Tests + compliance

Tests purs (vitest) pour : le prompt/extraction (parsing `ocr_fields`), `toolTier` des 3 outils, la résolution contact→type KYC. Backend RLS spec sur `kyc_cases`/`kyc_magic_link_uploads`. Audit `activity_events` (actor_kind='ai', actor_id NULL — réf. `megga/kyc-non-blocking` + le fix audit). Vérifier : aucun nouveau chemin ne peut mettre `dossier_status='verified'`.

---

*Spec rédigée le 2 juin 2026, grounded sur la cartographie live du moteur KYC. Prochaine étape : `writing-plans` (découpe P0 sécurité → migration → outils → câblage → tests) dans une conversation fraîche.*
