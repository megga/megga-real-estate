# WhatsApp Phase 4C — Copilote conversationnel de l'agent — Design

> Date : 2026-06-02 · Statut : validé (discussion) — en attente de plan
> Base : catalogue `2026-06-02-whatsapp-agent-scenarios-catalog.md`
> Dépend de : Phase 4A (agent ↔ MEGGA), Phase 4B (qualification de lead), capture/transcription.
> IA = DeepSeek uniquement.

## 1. Objectif

Que l'agent parle à MEGGA sur WhatsApp **comme à un assistant humain** : il dicte ou
écrit, MEGGA **répond**, **se souvient du fil**, et **exécute** en s'appuyant sur les
modules CRM qui existent déjà. On ne réinvente pas le métier — on **branche** le copilote
dessus.

Aujourd'hui (Phase 4A) le copilote répond mais : (a) **oublie** chaque message (sans
contexte), (b) ne gère **pas la voix**, (c) n'a que **5 outils**. Phase 4C lève ces trois
limites.

**Canaux : texte ET voix, indifféremment.** Tout (mémoire, outils, réponses, confirmations)
s'applique aux deux. Le **texte fonctionne déjà** via 4A ; C1 lui ajoute la mémoire. La **voix**
n'est qu'une porte d'entrée de plus : C2 la transcrit en amont, puis elle passe par exactement
le même cerveau, la même mémoire et les mêmes outils. Un agent peut alterner voix/texte dans
un même fil sans rupture.

## 2. Les 3 piliers

### 2.1 Mémoire de conversation (l'enabler n°1)
Avant la boucle DeepSeek, charger les **N derniers échanges agent↔MEGGA** (`whatsapp_messages`
filtrés sur le numéro de l'agent, ~15 derniers / 24h) et les reconstruire en tours
`user`/`assistant`. → MEGGA peut poser une question, recevoir la réponse au message suivant,
enchaîner, corriger, désambiguïser. Les messages sont déjà tous stockés : c'est du branchement.

### 2.2 Voix sur le chemin agent
Dans `processAgentMessage` (webhook), si le message agent est un **vocal** : récupérer le
média (Meta→bytes) + transcrire (Deepgram, réutilise `whatsapp-media` + `whatsapp-transcribe`)
→ passer le **transcript** comme message au cerveau. L'agent dicte, MEGGA comprend.

### 2.3 Boîte à outils élargie (branchée sur l'existant)
Le `whatsapp-agent` gagne des outils qui appellent les modules déjà construits, chacun avec
son **niveau d'autonomie** (cf. §3).

## 3. Les outils (tier + module existant appelé)

🔵 **Lecture**
- `get_my_agenda` *(existe)* → `visits`
- `search_contacts` *(existe)* → `contacts`
- `get_contact_brief(contact)` → fiche + timeline + critères + statut KYC
- `list_followups` → leads à relancer (tag `à_compléter`, sans interaction récente)
- `get_matches(contact)` → `matches` / `client_searches`
- `get_listing(ref)` → `listings` / `market_listings`
- `get_estimate(criteria)` → logique `estimation`
- `get_daily_brief` → KPI dashboard + visites du jour + relances

🟢 **Auto** (écritures internes CRM, faible risque, confirmées en mots après coup)
- `create_contact`, `add_note` *(existent)*
- `qualify_lead` → réutilise la logique Phase 4B (contact + critères + `client_searches` + à compléter)
- `schedule_visit(contact, listing, datetime)` → `visits` (détecte les conflits)
- `create_reminder(contact, when, label)` → relance/tâche
- `update_pipeline(transaction, stage)` → `transactions`
- `record_offer(transaction, amount, conditions)` → `crm_offers`

🟡 **Confirme** (vers le client ou en lot → « oui » avant exécution)
- `send_client_message` *(existe, confirm)*
- `send_listings(contact, listing_ids)` → `send-property-email` / WhatsApp
- `send_relance(contact|lot)` → `send-relance-email`

🔴 **Jamais sans validation** (hors Phase 4C) : validation KYC/LAB, **signature (reportée)**,
mouvement d'argent. MEGGA peut *préparer*/*consulter*, jamais *valider* seul.

## 4. Garde-fous (inchangés, renforcés)
- Tier `confirm` = une seule action en attente à la fois (déjà en place, F2/F3).
- Anti-injection : le contenu cité/transféré d'un tiers est de la donnée, pas un ordre (déjà dans le prompt).
- Cloisonnement agence au niveau SQL sur chaque outil.
- Tout journalisé (`activity_events`, badge IA), audit immuable.
- MEGGA avoue (« je n'ai pas trouvé ») plutôt qu'inventer (déjà F9).

## 5. Architecture

- **`whatsapp-agent`** : (a) charge l'historique (nouvelle requête `whatsapp_messages` du
  numéro agent) et l'injecte dans `messages` ; (b) `WHATSAPP_TOOLS` + `runTool` + tiers
  (`whatsapp-agent-router`) étendus ; (c) exécuteurs dans `whatsapp-actions` (ou modules
  `_shared` dédiés), scopés agence au SQL.
- **`whatsapp-webhook` (`processAgentMessage`)** : transcrit les vocaux agent avant d'appeler
  le cerveau. Garde l'ACK rapide + tâche de fond (déjà en place).
- **Réutilisation** : `qualify_lead` = la logique 4B ; les outils read/write tapent les tables
  et fonctions existantes (pas de nouveau moteur).

## 6. Périmètre

**Dans :** mémoire de conversation, voix agent, outils 🔵/🟢/🟡 ci-dessus, désambiguïsation,
clarification multi-tours.

**Hors (plus tard) :** e-signature (Skribble/DocuSign), notifications proactives hors fenêtre
24h (templates Meta), OCR avancé des documents, alignement de l'`ai-copilot` web sur DeepSeek.

## 7. Tests
- **Purs (vitest)** : assemblage de l'historique (fenêtre, ordre, rôles) ; classification des
  tiers des nouveaux outils ; parsers d'arguments (dates de visite, montants d'offre).
- **Manuel/staging** : appairer un agent → dicter un vocal « cliente Sarah… » → MEGGA répond
  « ✅ J'ai créé Sarah, il me manque le tél » ; poser une question de suite (« et ajoute un
  parking ») → MEGGA enchaîne grâce à la mémoire ; « mes RDV demain ? » → liste.

## 8. Découpe (lots)
- **C1 — Mémoire de conversation.** Le plus gros gain UX, le plus petit changement. (Fondation.)
- **C2 — Voix agent.** Transcription dans `processAgentMessage`.
- **C3 — Outils lecture** (`get_contact_brief`, `list_followups`, `get_matches`, `get_listing`, `get_estimate`, `get_daily_brief`).
- **C4 — Outils auto** (`qualify_lead`, `schedule_visit`, `create_reminder`, `update_pipeline`, `record_offer`).
- **C5 — Outils confirme** (`send_listings`, `send_relance`).

## 9. Vérification (definition of done)
- L'agent dicte (voix/texte), MEGGA répond naturellement, **se souvient du tour précédent**, et exécute.
- Chaque action respecte son tier ; aucun envoi client sans « oui ».
- `npm run build` + unitaires verts ; `deno check` vert.
- Audit complet en timeline.
