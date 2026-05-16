# RED_TEAM_SPRINT_3.md

> Phase 1 du Sprint 3 — Import Lead IA + Publication multi-portails + C2PA en arrière-plan.
> Document écrit avant toute ligne de code. Lecture critique du handoff (`HANDOFF_SPRINT_3_CLAUDE_CODE.md`), des maquettes (`crm-import-lead-modal.jsx`, `crm-publish-modal.jsx`), des refs Sprint 1+2, du design system Sugar Pure, et du `CLAUDE.md` projet.
> Posture : adversarial. On cherche ce qui casse en prod, pas ce qui rassure en démo.
>
> ⚠️ **Édition v2** : la **section G** (en bas) a été ajoutée après audit du code existant (`src/`, `supabase/migrations/`, `supabase/functions/`). Elle **révise plusieurs issues** des sections A–F (notamment D2 invalidé, B3 confirmé, B5 amplifié) et ajoute 11 issues qu'on ne pouvait pas voir sans regarder le repo. **À lire en complément** — pas en remplacement.

**Légende** : `CRITIQUE` = bloque le ship ou expose à un risque légal/sécu matériel · `IMPORTANT` = livrable peut sortir mais dégâts produit/UX/data réels · `NICE-TO-HAVE` = polish ou anticipation.

**TL;DR — 6 sujets bloquants à valider avec Grégory avant code** :
1. Dédup contact avant création (KYC, doublons) — **B3**
2. Conformité nLPD cross-border pour l'appel LLM — **A3**
3. Récap « provenance certifiée pour chaque photo publiée » potentiellement mensonger — **C2**
4. Dépublication absente du scope alors qu'elle est obligatoire dès qu'un bien se vend — **B5**
5. Filtrage des données ultra-sensibles (AVS, IBAN) dans le rawText avant stockage — **A1**
6. Durabilité de la publication différée (queue serveur, pas `setTimeout` client) — **F4**

---

## A. Sécurité & conformité

* **[CRITIQUE] A1 — Données ultra-sensibles non filtrées dans le rawText**
  Si un agent colle un email contenant un N° AVS (`756.XXXX.XXXX.XX`), un IBAN (`CH...`), ou pire un mot de passe, ces données partent vers le LLM **et** sont stockées en base (rawText + détail audit). Aucun filtre serveur n'est spécifié. nLPD art. 5 (minimisation) + LBA risque opérationnel.
  *Recommandation* : pipeline de redaction côté Edge Function `extract-lead` AVANT appel LLM : regex AVS / IBAN / cartes / patterns `password[\s:=]+\S+`. Remplacer par `[redacted-{type}]`. Logger le nombre de redactions dans un AuditEvent séparé (`severity: 'warn'` si > 0). Effort : **0.5 j**.

* **[IMPORTANT] A2 — Rétention rawText à 90j non implémentée**
  Le handoff dit « ne stocke pas le rawText plus de 90 jours » mais ne précise ni le mécanisme (trigger, pg_cron, TTL) ni la coexistence avec l'AuditEvent immuable (10 ans LBA art. 7). Conflit : si le `detail` de l'AuditEvent contient le rawText tronqué 80c, il survit 10 ans — donc le détail doit déjà être anonyme.
  *Recommandation* : (a) `AuditEvent.detail` = uniquement metadata non-PII (source, longueur, confidence, # redactions) ; (b) `Contact.imported_raw_text` colonne séparée avec job pg_cron quotidien qui passe à `[purgé]` après 90 j ; (c) documenter dans `docs/privacy.md`. Effort : **0.5 j**.

* **[CRITIQUE] A3 — Appel LLM = transfert transfrontalier de donnée personnelle**
  Anthropic et OpenAI sont aux US. nLPD art. 16–17 : transfert hors CH/UE seulement si (i) pays adéquat, (ii) garanties contractuelles (DPA + SCC), ou (iii) consentement explicite du prospect. Le prospect qui envoie un email à l'agent **n'a pas consenti** à ce que son message passe par un LLM US. Le DPA Anthropic couvre-t-il ce use case précis ?
  *Recommandation* : (1) confirmer avec legal MEGGA que le DPA Anthropic existant couvre la sous-traitance d'extraction PII de tiers non-clients (probable mais à vérifier) ; (2) ajouter mention obligatoire dans la politique de confidentialité publique MEGGA : « lors d'un échange avec un agent, votre message peut être traité par une IA hébergée hors CH (USA) pour qualification, sans rétention chez le fournisseur » ; (3) plan B = bascule vers Mistral hébergé Scaleway (FR) si le DPA US devient bloquant. Effort : **0.5 j legal review + 0 prod si DPA OK**.

* **[IMPORTANT] A4 — Hallucination email/téléphone**
  Un LLM peut inventer un email « plausible » (`sophie.marchand@gmail.com` au lieu de l'adresse réelle qui n'était pas dans le texte). Risque : envoi de relance à un tiers innocent = spam + atteinte à la réputation + plainte nLPD.
  *Recommandation* : double-pass server. Étape 1 = extraction LLM. Étape 2 = pour chaque `email` / `phone` extrait, vérifier qu'il apparaît verbatim (regex case-insensitive) dans `rawText`. Si non → forcer `null` + AuditEvent `severity: 'warn'` « champ rejeté car non présent dans la source ». UI affiche « Non détecté » comme prévu dans la maquette. Effort : **1h**.

* **[IMPORTANT] A5 — Flood / DoS via formulaire public ou abuse côté agent**
  Le handoff évoque « formulaire web » comme source (Étape 1 textarea). S'il y a un endpoint public alimentant cette voie, un attaquant peut flooder. Même côté agent : LLM = coût. Un agent (ou un compte compromis) pourrait coller 10 000 leads = facture cloud.
  *Recommandation* : (a) public form (si existant) → Turnstile + rate-limit 10/h/IP ; (b) endpoint agent → rate-limit 100/jour/agent + truncate input à 8 KB ; (c) garde-fou coût : si `extract-lead` dépasse N appels/h pour un agent, AuditEvent `severity: 'critical'` + notification admin. Effort : **0.5 j**.

---

## B. Métier & friction agent

* **[IMPORTANT] B1 — Correction de l'intention après création**
  Si l'IA classe `seller` un acheteur, le Contact est créé avec `type='seller'` et un Deal `stage='to-qualify'` orienté vendeur. Aucun chemin documenté pour corriger sans repasser par le wizard. Friction réelle : agent doit créer un nouveau Contact ou éditer via SQL.
  *Recommandation* : ajouter sur la fiche Contact (Sprint 1) une action « Reclassifier » via le crayon header en mode édition globale (pattern déjà câblé Sprint 2 bien-detail). Si Deal lié existe, modal confirmation « Faut-il aussi mettre à jour le pipeline ? ». AuditEvent obligatoire (changement de typage). Effort : **1 j**.

* **[IMPORTANT] B2 — Toggle « créer aussi un deal » ON par défaut = pipeline pollué**
  50 imports/semaine × ON par défaut = 50 nouveaux deals `new-lead`. 6 semaines plus tard : 300 deals zombies. Le pipeline Sprint 1 perd son signal (les vrais deals chauds noyés).
  *Recommandation* : (a) default OFF si `intent === 'seller'` (un vendeur n'a pas toujours un deal qualifié) OU si `confidence < 0.6` ; (b) job pg_cron quotidien : archive auto les deals `new-lead` sans activité depuis 30 j, avec notification agent groupée ; (c) compteur visible dans le header pipeline « 8 deals dormants à trier ». Effort : **1 j** (logique conditionnelle + cron + UI).

* **[CRITIQUE] B3 — Dédup contact avant création (collision email)**
  Le spec ne mentionne pas la dédup. Si Marie Bertrand est déjà dans le CRM et que l'agent colle un email d'elle, on crée un doublon. Conséquences : (1) KYC fait deux fois sur la même personne (coût + confusion) ; (2) historique cassé ; (3) deux deals possibles. Pour un CRM compliance-first, c'est inacceptable.
  *Recommandation* : avant `POST /api/contacts`, fuzzy match scope agence sur `(email exact)` puis `(phone exact)` puis `(firstName + lastName)` Levenshtein ≤ 2. Si match → modal intermédiaire « Contact existant détecté · Marie Bertrand · KYC ✓ · importé par Julien il y a 3 j » avec 3 actions : (a) Mettre à jour ce contact (merge intelligent), (b) Créer quand même (homonyme), (c) Annuler. Toutes loggées en audit. Effort : **1 j**.

* **[IMPORTANT] B4 — Échec de push portail : retry + visibilité**
  Si Homegate est down au moment du push, le spec est silencieux. L'agent voit « publié » mais 3/4 portails seulement → embarrassant pour le vendeur.
  *Recommandation* : (1) queue avec retry exponentiel (1m, 5m, 15m, 1h, 6h, 24h max) ; (2) UI fiche Bien — pastille par portail avec statut (`live` / `queued` / `retrying` / `failed`). Pas un badge décoratif mais un statut métier (autorisé par Sugar Pure) ; (3) après 24h échec → notification persistante + bouton « Relancer maintenant » ; (4) la publication globale n'est pas all-or-nothing : si MEGGA + ImmoScout passent et Homegate échoue, on confirme à l'agent un succès partiel transparent. Effort : **1.5 j** (queue Edge Function + UI states).

* **[CRITIQUE] B5 — Dépublication absente du scope = livrable cassé en prod**
  Le handoff exclut explicitement la dépublication. Or un bien vendu/loué DOIT être retiré des portails — sinon visite-fantôme, contact-fantôme, ridicule commercial. Sans dépublication, Sprint 3 livre une moitié de fonctionnalité.
  *Recommandation* : intégrer la dépublication minimale dans Sprint 3 (incrément faible : la queue de B4 supporte déjà `kind: 'unpublish'`). UI : (1) bouton « Retirer de la diffusion » sur fiche Bien quand `publications[]` non-vide ; (2) déclenchement auto sur `bien.status → sold | rented`, avec toast confirmation noire. Sinon : engager formellement un Sprint 3.5 < 2 semaines après Sprint 3, sinon Grégory en bavera dès la 1ère vente. Effort : **1 j** si couplé à B4.

---

## C. Design / direction artistique

* **[IMPORTANT] C1 — « 0 badge C2PA » vs alerte d'incident tenable**
  La règle est juste, mais le mot « C2PA » dans une alerte `warn` (« N photo(s) n'ont pas pu être signées ») ne parlera à aucun agent — c'est jargon technique. Risque : alerte ignorée → photos sans signature publiées → audit fail. De plus, l'alerte `warn` colorée (`#F59E0B`) ne « ré-introduit pas un badge C2PA » au sens strict, mais elle introduit une couleur dans la chrome — limite Sugar Pure (le DS autorise warn uniquement en pastille ≤ 8px ou pilule discrète, pas en card pleine couleur).
  *Recommandation* : (a) reformuler en termes métier : « X photo(s) sans certification d'authenticité — re-uploader pour une diffusion fiable » (zéro jargon) ; (b) bloquer le push MEGGA Marketplace (strict) tant que non résolu — la fiche Bien affiche un statut neutre « Publication MEGGA en attente · 2 photos à re-signer » sans couleur warn pleine ; (c) tolérer pour Homegate/ImmoScout/Newhome (déjà documenté). Effort : **0.5 j** (UX writing + logique conditionnelle).

* **[CRITIQUE] C2 — « Provenance certifiée pour chaque photo publiée » potentiellement mensonger**
  Le récap noir final affirme « provenance certifiée pour chaque photo publiée ». Si on publie sur Homegate/ImmoScout/Newhome avec une photo dont la signature C2PA a échoué (cas toléré par C1), cette phrase est fausse → Art. 3 lit. b LCD (concurrence déloyale, mention trompeuse de certification). Risque réputation + plainte concurrent.
  *Recommandation* : rendre la ligne conditionnelle. Si `signedPhotos === publishedPhotos` → texte actuel. Sinon → « Provenance certifiée pour X / Y photos publiées — détails dans le journal d'audit ». Si `X === 0` → ligne supprimée. Aucun changement visuel quand tout est OK, dégradation honnête sinon. Effort : **1h**.

* **[NICE-TO-HAVE] C3 — Placeholder « IDX bientôt » qui vieillit**
  Si IDX ne se concrétise pas en 6 mois, le badge « Bientôt » signale un roadmap qui dérape — mauvais signal pour les agents qui voient la chrome au quotidien.
  *Recommandation* : (a) ajouter un hint date « Été 2026 » à côté du « Bientôt » pour cadrer l'attente ; (b) feature flag serveur : si `idx_partnership_active !== true` au 2026-12-31, masquer la card complètement. Effort : **0.5h**.

---

## D. Techniques

* **[IMPORTANT] D1 — État du modal Import Lead perdu au refresh**
  Agent colle un email de 2 KB → analyse en cours → fermeture accidentelle d'onglet → tout perdu. UX inacceptable pour un outil qu'on utilise sous pression.
  *Recommandation* : persister `{ step, text, extracted, editMode }` dans `sessionStorage` (clé `il_modal_state`). Effacer à `created || onClose`. Ne **pas** utiliser `localStorage` (rawText = donnée sensible — interdit par `CLAUDE.md` règles absolues). Effort : **1h**.

* **[IMPORTANT] D2 — `window.__openImportLead` & friends en prod**
  Les globals fonctionnent en maquette mais cassent en SSR, en navigation React Router stricte, et en TypeScript strict (typage perdu). Le handoff lui-même indique « à remplacer en prod par un store global ». Si ce n'est pas fait au moment de l'implémentation, ça finira en dette technique permanente.
  *Recommandation* : décision dès le code Sprint 3 → Zustand store `useImportLeadModal()` + URL search param `?modal=import-lead` (deep-linkable, bouton retour navigateur OK, partageable). Migrer en même temps les globals Sprint 2 (`__bdBienId`, `__ddDealId`, `__vdVisitId`) pour cohérence. Effort : **0.5 j**.

* **[IMPORTANT] D3 — Non-déterminisme LLM = tests unitaires impossibles**
  `ilExtract` (maquette) est déterministe et testable. En prod c'est un appel LLM = sortie variable. On ne peut pas écrire `expect(extract("...")).toEqual({...})` sur l'API réelle. Sans stratégie, zéro confiance dans la régression.
  *Recommandation* : architecture en 2 couches.
  (1) **Pure functions** unit-testées : redaction (A1), validation verbatim (A4), dedup matcher (B3), formatteurs CHF, calcul `nextAction` à partir de `{intent, urgency}`.
  (2) **Eval harness LLM** : fixture de 30 prompts annotés (golden answers) → métrique « % de champs corrects par appel ». Tournée hebdo en CI nightly, seuil minimum 85% champs identité + 70% champs critères. Tests CI normaux = mock LLM endpoint, jamais d'appel réel. Effort : **1 j**.

* **[IMPORTANT] D4 — `publications[]` en array JSONB sur Bien — schéma à plat dès le départ**
  Stocker l'historique publication dans un array JSONB grossit indéfiniment (republications fréquentes pour prix réduit) et empêche les requêtes monitoring type « tous les échecs Homegate des 7 derniers jours ».
  *Recommandation* : table dédiée `publications` (FK `bien_id`), colonnes telles que dans le handoff (portal, status, pushed_at, etc.), index `(portal, status)` + `(bien_id, status)`. Sur le Bien, exposer `publications` comme un hook React Query qui charge le sous-array. Décision **à prendre au début** de l'implémentation, pas après (migration douloureuse plus tard). Effort : **0.5 j** (migration + endpoints).

---

## E. Hors scope mais à anticiper

* **[NICE-TO-HAVE] E1 — Cmd+K : « Importer un lead » et « Publier ce bien »**
  Pattern de power-user natif. Si la palette a déjà un registre (cf. `CRM_ARCHITECTURE.md` §7 « Cmd+K »), ajouter 2 entrées est cosmétique.
  *Recommandation* : ajouter à la registry palette. « Publier ce bien » uniquement contextuel (visible quand un bien est focus / dans le breadcrumb). Effort : **2h si palette extensible, 1 j si refacto nécessaire**.

* **[IMPORTANT] E2 — WhatsApp/SMS/voice Sprint 4 — préparer les rails maintenant**
  Si Sprint 3 fige le modèle de données Contact sans champ `source`, Sprint 4 demandera une migration. Anticiper coûte 30 min, refaire après coûte 2 jours.
  *Recommandation* : (a) ajouter dès Sprint 3 sur `Contact` (ou table de liaison `contact_sources`) le champ `source: 'paste' | 'webhook-whatsapp' | 'webhook-sms' | 'voice-transcribed' | 'manual'` ; (b) scaffold endpoint `POST /api/leads/webhook/:provider` qui accepte un JSON normalisé `{from, to, body, mediaUrls, lang}` → produit un `rawText` → réutilise pipeline `extract-lead`. Pas d'intégration provider en Sprint 3, juste le pipe. Effort : **0.5 j**.

* **[NICE-TO-HAVE] E3 — Table estimations : ne rien préparer maintenant**
  Tentation de spéculer un schéma « au cas où Sprint 4 ». Anti-pattern. Quand la fonctionnalité arrivera, elle aura sa propre forme (probablement table `estimations(id, bien_id?, contact_id?, comparables[], confidence, ...)`).
  *Recommandation* : ne rien créer. Note dans `docs/roadmap.md` pour ne pas oublier l'argument métier (« Grégory · trop compliqué phase lancement, à reprendre quand on aura une source de comparables suisse »). Effort : **0**.

---

## F. Issues supplémentaires repérées (hors bullets prompt)

* **[NICE-TO-HAVE] F1 — Audit event : split system vs agent**
  Le projet utilise déjà `actor_id = 'ai'` (cf. `CLAUDE.md` projet). Le handoff Sprint 3 dit « 1 AuditEvent par lead importé avec `actor: agentId` ». Or l'extraction est faite par l'IA — l'agent ne fait que valider. Une seule event écrase la traçabilité IA.
  *Recommandation* : émettre 2 events : (1) `{actor: 'ai', action: 'Extraction lead exécutée', detail: 'source=paste, length=480, confidence=0.78'}`, (2) `{actor: agentId, action: 'Lead validé & créé', detail: 'contactId=..., dealCreated=true', parent_event_id: <event 1>}`. Conforme à la posture « IA = assistance, jamais autonome » du Document Maître. Effort : **0.5h**.

* **[IMPORTANT] F2 — Dédup à l'échelle agence, pas par agent**
  Extension de B3 : si l'agence a 3 agents, ils partagent les contacts. Un lead importé par Julien et déjà connu de Marie doit déclencher la dédup. Sinon double-KYC, double-relance.
  *Recommandation* : scope du fuzzy match = `agency_id` courant, pas `agent_id`. Modal dédup affiche « Marie a déjà importé ce contact il y a 3 j · KYC en cours » — utile politiquement (collision visible, pas furtive). Effort : **+0.5 j sur B3**.

* **[NICE-TO-HAVE] F3 — Stepper Sugar Pure : largeur sur viewports étroits**
  Le stepper du modal Publication a 3 étapes avec labels + 2 connecteurs de 76 px + cercles + crayon mode édition côté droit pour Import Lead. Sur un laptop 1280 × 720 avec sidebar 220 px, le header peut overflow.
  *Recommandation* : tester explicitement à 1280 × 720. Plan B : masquer les labels du stepper en dessous de `1024px` (cercles + numéros seuls), ou raccourcir « Confirmation » → « Publier ». Effort : **0.5h**.

* **[CRITIQUE] F4 — Publication différée : durabilité du déclenchement**
  Si `schedule: 'scheduled'` repose sur un `setTimeout` côté client, fermer l'onglet annule la publication. C'est une promesse silencieusement non tenue — destruction de confiance dès la 1ère occurrence.
  *Recommandation* : déclenchement côté serveur uniquement. Réutiliser `pg_cron` (déjà actif pour flatfox-sync). Nouveau job `publish-scheduled-listings` toutes les 5 minutes : scan `publications WHERE status='queued' AND scheduledAt <= now()` → enqueue dans la queue de push (B4). Pas de `setTimeout` côté client, même comme « optimisation ». Effort : **0.5 j**.

* **[IMPORTANT] F5 — Confidence faible silencieuse**
  Le handoff dit « n'expose pas `confidence: 0.62` dans l'UI ». OK pour le nombre brut. Mais si `confidence < 0.5`, l'extraction est très probablement bancale — l'agent ne le sait pas et crée un contact douteux.
  *Recommandation* : seuil interne (non exposé numériquement). Si `confidence < 0.5` → bandeau Sugar discret (cardSubtle, pas de couleur warn) au-dessus des champs extraits : « Message court ou ambigu — vérifier l'extraction » + auto-active le mode édition. Sugar-conforme : neutre, pas de jargon « confidence ». Effort : **1h**.

* **[IMPORTANT] F6 — Accessibilité : contraste `muted` sur cardSubtle**
  Les labels uppercase 10.5 px en `muted #7A8088` sur fond `cardSubtle #F7F8FA` sont sous le seuil WCAG 2.1 AA pour du texte < 18 px non-gras (4.5:1 requis). À vérifier au mesureur, mais à l'œil c'est limite.
  *Recommandation* : (a) bumper les labels à 11.5 px en gras 700 (déjà appliqué partiellement), OU (b) noircir `muted` à `#5E6470` (impact global Sugar Pure — à arbitrer). Mesurer avec axe-core ou Lighthouse a11y avant arbitrage. Effort : **1h** (mesure + ajustement choisi).

---

## Synthèse pour Grégory — ce qui doit être tranché avant code

| # | Sujet | Décision attendue |
|---|---|---|
| B3 / F2 | Dédup contact à la création | OK pour modal de fusion ? Scope agence confirmé ? |
| A3 | Cross-border LLM | Le DPA Anthropic couvre-t-il l'extraction PII de tiers ? Plan B Mistral FR si non ? |
| C2 | Mention « provenance certifiée » | Accepter la formulation conditionnelle proposée ? |
| B5 | Dépublication | Inclure dans Sprint 3 (+ 1 j) ou Sprint 3.5 < 2 sem ? |
| A1 | Redaction PII serveur | Liste des patterns à scrubber : AVS, IBAN, cartes, password — autres à ajouter (n° passeport, NPA + nom rue combiné…) ? |
| F4 | Scheduled publish via pg_cron | Confirmé ? (alternative `setTimeout` rejetée) |
| B2 | Default toggle « créer un deal » | OK pour OFF par défaut si seller ou confidence basse ? |
| D2 | Migration `window.__*` → Zustand | Faire en même temps que Sprint 3 (recommandé) ou plus tard ? |
| C3 | IDX placeholder | Date affichée + masquage auto post-2026-12-31 OK ? |

Une fois ces 9 points tranchés, l'implémentation peut commencer sereinement. Les 17 autres issues sont des consignes d'implémentation que je couvrirai naturellement en codant.

---

## G. Confrontation au code existant (édition v2)

Section ajoutée après audit du repo. La spec parle de patterns « en prod » qui parfois n'existent pas, et tait des contraintes réelles (contraintes SQL, FK, fonctions absentes) qui changent l'effort ou la faisabilité.

### G.1 — Révisions des issues précédentes

* **D2 INVALIDÉ — `window.__*` n'existent pas dans le repo**
  Grep `window.__` sur `src/` : **zéro occurrence**. Les patterns `__bdBienId`, `__ddDealId`, `__vdVisitId`, `__kycOpenForContactId` annoncés dans les handoffs Sprint 1/2 sont des **artefacts de maquette** jamais portés en prod. Le repo utilise React Router v6 + query params (cf. [`CommandPalette.tsx:116`](src/components/layout/CommandPalette.tsx)). L'enjeu n'est pas « migrer », c'est « ne pas introduire ».
  *Conséquence* : implémenter Import Lead via un Context React + URL search param `?modal=import-lead&text=...` dès le départ. Ne pas écrire `window.__openImportLead` même en dev.

* **B3 CONFIRMÉ — Aucune dédup contact en place**
  [`useContacts.ts:98`](src/hooks/useContacts.ts) `useCreateContact()` fait un `supabase.from('contacts').insert(...)` direct sans pré-vérification d'email/phone. La faille n'est pas hypothétique — elle existe déjà sur tous les chemins de création de contact actuels. Sprint 3 ne crée pas le problème, il l'amplifie en automatisant l'import.
  *Conséquence* : la dédup proposée (RPC `find_duplicate_contact(email, phone, first_name, last_name)`) devrait être appelée par **tous** les call sites de `useCreateContact`, pas seulement Import Lead — sinon on patche une fuite parmi cinq.

* **B5 AMPLIFIÉ — Aucune infra publication existante, c'est greenfield**
  Aucune table `publications` / `listing_publications`, aucune colonne `published_to[]` sur `listings`. La seule ingestion existante (Flatfox) est un **PULL** quotidien via `pg_cron` ([20260415_004_flatfox_sync_cron.sql](supabase/migrations/20260415_004_flatfox_sync_cron.sql)) — l'architecture inverse de ce que demande Sprint 3. Aucun adapteur Homegate/ImmoScout/Newhome n'existe. Aller dépublier sans push n'est pas un raccourci ; tout le pipeline est à construire.
  *Conséquence* : Sprint 3 publication = **~2 j minimum** infra (migration + Edge Function + 1 adapteur réel + scaffolds) avant la moindre UI fonctionnelle. La maquette donne l'impression d'un wrapper, c'est en fait un greenfield backend.

* **A1 + A4 RENFORCÉS — Aucun pattern de redaction PII / validation verbatim n'existe**
  [`_shared/ai-provider.ts:1`](supabase/functions/_shared/ai-provider.ts) `callClaude()` envoie le payload **brut** vers l'API. Pas de scrubber regex, pas de double-pass. Toutes les Edge Functions IA actuelles (`ai-copilot`, `extract-property-pdf`, etc.) héritent du même angle mort. Sprint 3 doit construire ce socle dans `_shared/` ET le rétrofiler sur les Edge Functions existantes (sinon faille silencieuse partout).
  *Conséquence* : élargir l'effort A1 à **1 j** (création `_shared/pii-redaction.ts` + rétrofitting sur 3 Edge Functions IA existantes pour cohérence).

* **E1 PRÉCISÉ — Cmd+K palette hardcodée, pas de registry**
  [`CommandPalette.tsx:21-38`](src/components/layout/CommandPalette.tsx) : `pageItems` et `actionItems` en arrays littéraux. Pour ajouter « Importer un lead » et « Publier ce bien », deux options :
  - **Hardcodé** : 5 minutes, dette technique faible (la palette n'a que ~15 items)
  - **Refactor registry** : `useCommandActions()` hook contributable par page, ~0.5 j
  *Recommandation* : hardcodé pour Sprint 3, refactor quand on dépassera 25 actions.

### G.2 — Nouvelles issues révélées par le code

* **[CRITIQUE] G1 — Contrainte CHECK `type` sur `contacts` rejette `'tenant'`**
  [migration 003_create_contacts.sql:14](supabase/migrations/003_create_contacts.sql) : `CHECK (type IN ('buyer', 'seller', 'both', 'lead'))`. Or l'extraction Sprint 3 retourne `intent: 'buyer' | 'seller' | 'tenant'`. Premier import de locataire → **PostgreSQL error 23514** → l'agent voit un crash, pas un contact. Le type TS [`contact.ts:9`](src/types/contact.ts) déclare déjà `'tenant'|'landlord'|'investor'` — mais la BDD n'a jamais été migrée.
  *Recommandation* : migration `20260516_001_contact_type_extension.sql` qui DROP/RECREATE la contrainte avec `('buyer', 'seller', 'both', 'lead', 'tenant', 'landlord', 'investor')`. **Bloque l'implémentation** tant que pas faite. Effort : **30 min**.

* **[IMPORTANT] G2 — `activity_events.actor_id` viole sa FK pour les events IA**
  [`002_core_tables.sql:218`](supabase/migrations/002_core_tables.sql) : `actor_id UUID REFERENCES profiles(id)`. Or [`ai-copilot/index.ts:46`](supabase/functions/ai-copilot/index.ts) insère `actor_id: 'ai'` (string, pas UUID) — passe uniquement parce que service_role bypasse les FK. Dette latente : si on durcit RLS un jour, tout casse. Sprint 3 amplifie (1 event IA d'extraction + 1 event agent de validation par lead importé).
  *Recommandation* : option A — créer un profile synthétique `0000…ai` (UUID dédié) ; option B — `ALTER TABLE activity_events DROP CONSTRAINT activity_events_actor_id_fkey` + ajouter colonne `actor_kind text NOT NULL DEFAULT 'user'` (`user|ai|system`). Préférer B (plus expressif). Effort : **0.5 j** (migration + refactor des 4 call sites).

* **[CRITIQUE] G3 — C2PA en base = `boolean` seul, pas de manifest ID stocké**
  [migration 20260330_004_c2pa_shield.sql](supabase/migrations/20260330_004_c2pa_shield.sql) : `c2pa_verified BOOLEAN` + `c2pa_verified_at`. Pas de `c2pa_manifest_id`, pas de mapping photo→manifest. Le handoff Sprint 3 dit : *« à la publication, re-vérifier que toutes les photos sélectionnées portent un manifest valide »*. **Impossible avec le schéma actuel** : on a un boolean global, pas un manifest par photo. La règle « MEGGA strict tolère uniquement des photos signées » est non-vérifiable.
  *Recommandation* : trancher avec Grégory. Option A (placebo) — accepter que C2PA = boolean global, et le récap noir final dit « provenance certifiée » selon `properties.c2pa_verified`. Option B (sérieux) — migration ajoutant `properties.photo_manifests JSONB` (`{photoUrl: manifestId}`), et enrichir [`c2pa-sign/index.ts:193`](supabase/functions/c2pa-sign/index.ts) pour le peupler. **C2 (récap noir mensonger) dépend de cette décision.** Effort : 0 si A, **1 j** si B.

* **[IMPORTANT] G4 — `c2pa-sign` a 4 niveaux de fallback : ambiguïté « MEGGA strict »**
  [`c2pa-sign/index.ts`](supabase/functions/c2pa-sign/index.ts) cascade Numbers Protocol → Trufo → wasm → SHA-256 EXIF. Le handoff Sprint 3 dit « MEGGA strict exige manifest valide ». Quel niveau = « valide » ? Numbers (officiel C2PA) ou SHA-256 (placebo MEGGA Shield) ?
  *Recommandation* : exposer le niveau atteint en base (`properties.c2pa_provider TEXT`, `'numbers'|'trufo'|'wasm'|'shield-fallback'`) et définir « strict » = `provider !== 'shield-fallback'`. Sinon on appelle « provenance certifiée » un SHA-256, ce qui ne tient pas une audition C2PA Coalition. Effort : **2h** colonne + logique.

* **[IMPORTANT] G5 — Décalage type TS Contact ↔ schéma SQL (champs enrichis fantômes)**
  [`contact.ts:9-39`](src/types/contact.ts) déclare `whatsapp_phone`, `language`, `ai_seriousness_score`, `budget_announced`, `search_zones`, `search_criteria`, etc. La table SQL n'a aucune de ces colonnes. Sprint 3 va vouloir poser `budget` et `zone` extraits par l'IA → si on les map sur `Contact.budget_announced` (TS), l'insert SQL ignore silencieusement OU produit une erreur Supabase Postgrest.
  *Recommandation* : audit avant code → soit migration `20260516_002_contact_enriched_fields.sql` (colonnes SQL réelles), soit standardiser sur `form_data JSONB` (la table l'a déjà). Recommandé : colonnes typées pour les champs requêtables (`budget_announced`, `language`), JSONB pour le reste. Effort : **0.5 j** migration + ajustement [`useCreateContact`](src/hooks/useContacts.ts).

* **[CRITIQUE] G6 — Pas d'Edge Function `extract-lead`, partir de zéro**
  Liste des Edge Functions IA : `ai-copilot`, `ai-search`, `extract-property-pdf`, `extract-property-url`, `parse-search-query`, `photo-labeler`. **Aucune ne fait d'extraction de lead depuis texte libre.** Sprint 3 doit la créer. Pattern à suivre : `_shared/ai-provider.ts:callClaude()` + logging `ai_usage_logs` + RLS service_role.
  *Recommandation* : `supabase/functions/extract-lead/index.ts` qui (1) appelle `_shared/pii-redaction.ts` (à créer, cf A1), (2) appelle `callClaude` avec le prompt système du handoff, (3) double-pass verbatim verification (A4), (4) log à `ai_usage_logs` + `activity_events`. Doit aussi gérer le timeout (8s comme DeepSeek) et le fallback (Haiku si Sonnet timeout). Effort : **1 j**.

* **[IMPORTANT] G7 — `useSellerLeads` est le pattern voisin à étudier**
  [`useSellerLeads.ts:65-100`](src/hooks/useSellerLeads.ts) `useAcceptSellerLead()` fait déjà un workflow proche (anonyme website → Contact + Property + audit). Sprint 3 Import Lead a une structure quasi-identique (texte brut → Contact + Deal + audit). Ignorer ce pattern = réinventer la roue + risque d'incohérence.
  *Recommandation* : lire `useSellerLeads.ts` avant de coder `useImportLead`. Réutiliser la structure (mutation React Query, sequence atomique, AuditEvent à la fin). Si possible, factoriser une `useLeadConversion(source, payload)` partagée. Effort de lecture : **30 min**. Effort de factorisation si pertinent : **+1h**.

* **[IMPORTANT] G8 — `C2PaBadge` est déjà rendu côté CRM agent (à confirmer)**
  [`src/components/listing/C2PaBadge.tsx`](src/components/listing/C2PaBadge.tsx) est importé par [`ListingPreviewPanel.tsx:29`](src/components/listing/ListingPreviewPanel.tsx) à la ligne 1190. Si ce panel est utilisé sur les pages agent CRM (probablement, c'est un composant « preview »), le badge s'affiche aujourd'hui. Le cleanup Sprint 3 doit le retirer **sur les surfaces agent uniquement**, le conserver sur les surfaces marketplace publique.
  *Recommandation* : auditer les call sites de `ListingPreviewPanel`. Si partagé agent/public, ajouter prop `surface: 'agent' | 'public'` qui conditionne le `<C2PaBadge>`. Si dupliqué, retirer du composant agent. Effort : **2h** audit + ajustement.

* **[NICE-TO-HAVE] G9 — `seller_portals` ≠ portail de publication marchand**
  [migration 20260322_002_seller_portals.sql](supabase/migrations/20260322_002_seller_portals.sql) crée une table `seller_portals` (portail vendeur tokenisé, lecture seule de son bien). **N'a rien à voir avec Homegate/ImmoScout/Newhome.** Risque cognitif : un dév pressé pourrait confondre les deux tables au naming + croire que l'infra existe.
  *Recommandation* : la nouvelle table pour Sprint 3 ne doit **pas** s'appeler `portals` ni `publications` (collision sémantique). Préférer `listing_distributions` ou `listing_pushes`. Effort : **0**, juste un choix de nommage à graver.

* **[IMPORTANT] G10 — `ai_usage_logs` existe déjà : socle pour A5 (rate limit / coût)**
  Edge Function `ai-billing-monitor` + table `ai_usage_logs` (logged via `_shared/ai-provider.ts`) suivent déjà tokens entrants/sortants + coût. Sprint 3 hérite gratuitement de la visibilité coût.
  *Recommandation* : le garde-fou A5 (« si > N appels/h pour un agent → severity critical ») peut se brancher sur cette table via une vue matérialisée `ai_usage_per_agent_hourly`. Pas besoin de pipeline parallèle. Effort A5 réduit : **2h** au lieu de 0.5j.

* **[IMPORTANT] G11 — `activity_events.metadata` est `JSONB` libre — sans schéma**
  [`002_core_tables.sql:223`](supabase/migrations/002_core_tables.sql) : `metadata JSONB DEFAULT '{}'`. Pas de validation, pas de discriminator. Aujourd'hui chaque Edge Function pose ce qu'elle veut → impossible de requêter sereinement (« tous les events IA dont la confidence < 0.5 »).
  *Recommandation* : définir un mini-schéma versionné dans `_shared/audit-schemas.ts` (typebox ou Zod) que chaque Edge Function applique. Pour Sprint 3 : `LeadImportEventMeta = { source, length, redaction_count, confidence, extraction_id, ... }`. Validation côté insert. Effort : **0.5 j** (rétrofit utile pour tout futur dashboard analytique).

### G.3 — Effort total révisé

Estimation grossière post-audit, par axe :

| Axe | Spec naïve | Réel post-audit |
|---|---|---|
| Migration schéma (G1, G2, G5, G3 si B) | 0 (« déjà là ») | **1.5 j** |
| Edge Function `extract-lead` + PII layer | 1 j | **2 j** (A1 socle partagé inclus) |
| Dédup contact (B3) — couvrir tous call sites | 1 j | **1.5 j** |
| Publication portails (greenfield) | 1.5 j | **3 j** (table + Edge dispatcher + 1 adapteur réel + scaffolds + queue retry B4) |
| Dépublication (B5) | 1 j | **1 j** (couplé) |
| Modal Import Lead UI Sugar Pure | 1.5 j | **1.5 j** (maquette directe) |
| Modal Publication UI Sugar Pure | 2 j | **2 j** (maquette directe) |
| C2PA cleanup (G8) | 0.5 j | **0.5 j** |
| Audit refactor (G2, G11) | 0 | **0.5 j** |
| **Total** | ~8.5 j | **~13.5 j** |

Soit ~60 % de plus que ce que la spec suggère, principalement à cause de l'infra publication qui est greenfield et des décalages SQL ↔ TS.

---
*Édité après lecture du code · à challenger ligne par ligne. Si une issue paraît creuse ou over-engineered, je préfère l'apprendre maintenant.*
