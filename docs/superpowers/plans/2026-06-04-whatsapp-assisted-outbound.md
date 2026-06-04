# WhatsApp — Sortie assistée : MEGGA rédige les réponses & emails clients dans le style de l'agent (plan d'implémentation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans, tâche par tâche. Étapes en cases à cocher (`- [ ]`). **Session FRAÎCHE** : ce plan est autonome — tout le contexte d'archi nécessaire est ci-dessous, ne pas supposer de mémoire d'une session précédente.

**Goal:** Quand l'agent demande à MEGGA (sur WhatsApp) de répondre à un client ou de lui envoyer un email, MEGGA **rédige le brouillon** — au **ton appris de l'agent** (T1 `learned_style`) et en s'appuyant sur la **compréhension du fil** (`whatsapp_conversation_insights`) — montre le **brouillon COMPLET**, l'agent **valide/corrige**, puis MEGGA **envoie** (WhatsApp via Meta, email via Resend). Réutilise l'archi existante, n'invente rien.

**Architecture (réutilisation) :** tout existe déjà en pièces sur `main`. Ce plan les **câble** :
- Envoi WhatsApp→client : `send_client_message` / `send_listings` (Meta Cloud API), tier `confirm`, squelette `whatsapp_pending_actions` + `stashPending` (whatsapp-agent) + `executePending` (whatsapp-webhook).
- Style : `learned_style` (T1) façonne déjà les sorties du cerveau WhatsApp (même appel DeepSeek). `formatStyleBlock` dans `_shared/agent-style.ts`.
- Compréhension : `whatsapp_conversation_insights` (summary/intent/next_action/sentiment) — calculée par `whatsapp-process`, lue par `useConversationInsight`. **Pas encore** dans le contexte du cerveau.
- Email : `send-relance-email` (Resend, free-form `{to,subject,body,agentName,agentSignature?}`) ; `ai-copilot` a déjà une action `draft_email` (DeepSeek). `send_kyc_link` émaile déjà un client depuis WhatsApp via `magic-link-send-email`.

**Tech Stack :** Supabase Edge (Deno/TS), DeepSeek (`deepseek-chat`, JAMAIS Claude pour le drafting agent), Resend, Meta Cloud API. React 18 + react-i18next (4 langues) si UI. Pas de migration prévue (réutilise tables/fonctions existantes) → pas de date-gate, sauf si une tâche en introduit une (alors : datée du jour de merge).

---

## Avant de commencer — consulter le cerveau

```bash
npx ruflo memory search -q "whatsapp outbound send_client_message confirm pending_actions learned_style ai-copilot draft_email send-relance-email conversation insights" -n megga
npx ruflo memory get -k "megga/megga-ai-persona" -n megga          # « employée modèle » : messages client = la vitrine, TOUJOURS validés humain
npx ruflo memory get -k "megga/whatsapp-agent-copilot" -n megga    # 23 outils, tiers, confirm/undo
npx ruflo memory get -k "megga/megga-ai-agent-learning" -n megga   # T1 style ; tranches suivantes
npx ruflo memory get -k "megga/deploy-migrations-gate" -n megga
```
Re-consulter au début de chaque tâche. **Ne pas modifier le seed** avant la dernière tâche.

## Contraintes dures (non négociables)

- **DeepSeek uniquement** pour tout drafting agent-facing/client-facing (`deepseek-chat`). JAMAIS Claude/OpenAI. (NB : le `email-classifier` de la PR #356 viole cette règle en appelant Claude — NE PAS s'en inspirer ; rester DeepSeek.)
- **HUMAN-IN-THE-LOOP, socle légal :** tout envoi vers un CLIENT (WhatsApp ou email) reste **tier `confirm`** et ne peut JAMAIS passer en `auto`. `canLeaveConfirm()` (whatsapp-agent-router.ts) doit continuer de renvoyer `false` pour `send_client_message`, `send_listings`, et le nouveau `send_client_email`. MEGGA **propose**, l'agent **valide** — les messages client sont la vitrine de l'agence (cerveau `megga-ai-persona`).
- **Brouillon = WYSIWYG** : ce que l'agent valide est EXACTEMENT ce qui part (payload gelé au moment du `prepare`, comme `prepareSendListings`). Montrer le **texte complet**, pas un aperçu tronqué.
- **Style appris, additif** : le brouillon adopte le ton de l'agent via `formatStyleBlock(learned_style)` ; jamais d'écrasement du socle légal/persona. Si pas de style `active`, comportement actuel inchangé.
- **Persona** : FR/EN soigné, vouvoiement client, aucun identifiant brut, jamais prétendre une action non faite (garde anti-fabrication existante conservée).
- **Email** : envoi via Resend `noreply@megga.ch` (infra en place). L'envoi depuis le Gmail/Outlook **personnel** de l'agent est **hors périmètre** (bloqué dans la PR #356 non mergée — le noter, ne pas en dépendre).
- Migrations (si une tâche en ajoute) additives + idempotentes + **datées du jour de merge**. `npm run build` vert avant push. **Specs backend live en CI** (skipIf n'est pas un skip ; nettoyage `.then(()=>{},()=>{})`). i18n 4 langues.

## Périmètre

**FAIT (ce plan) :** (1) compréhension du fil injectée dans le contexte du cerveau pour des réponses contextuelles ; (2) revue du **brouillon complet** pour `send_client_message` (au lieu de l'aperçu 60 car.) ; (3) nouvel outil `send_client_email` (rédige + envoie un email client, validé) ; (4) `learned_style` unifié dans `ai-copilot` (les brouillons web adoptent aussi le ton appris) ; (5) specs live + i18n + cerveau + PR.

**PAS fait (tranches suivantes) :** envoi depuis le Gmail/Outlook personnel (PR #356) ; bouton « suggérer une réponse » dans le composer web `CdWhatsAppCard` ; génération d'annonces multi-versions (`draft_description` à recâbler) ; copilote de négociation. Notés, hors périmètre.

---

## Carte d'archi (anchors vérifiés — pour exécuter sans re-auditer)

- `supabase/functions/whatsapp-agent/index.ts` : cerveau DeepSeek. `formatStyleBlock` injecté (~l.91-93, append au system ~l.120). `stashPending()` (~l.316-376) prépare les actions `confirm` ; pour `send_client_message` il ne stocke qu'un **aperçu 60 car.** (~l.349-352) — à passer en brouillon complet.
- `supabase/functions/_shared/whatsapp-tools.ts` : définitions d'outils (dont `send_client_message` l.80-91, `send_listings` l.199-210, `send_kyc_link` l.275-278). Ajouter `send_client_email`.
- `supabase/functions/_shared/whatsapp-agent-router.ts` : tiers (l.21-51), `canLeaveConfirm()` (l.59-62 — garder `false` pour les envois client).
- `supabase/functions/_shared/whatsapp-actions.ts` : exécuteurs. `execGetContactBrief()` (~l.166-183, lit contacts/activity_events/client_searches — **PAS** les insights). `prepareSendListings()` (~l.654-703 — **le modèle WYSIWYG à cloner** : fetch data → compose texte complet → gèle le payload → prompt complet). `executeSendKycLink()` (~l.1111-1185 — modèle d'appel à une edge function d'email via service-role).
- `supabase/functions/whatsapp-webhook/index.ts` : `executePending()` (~l.570-644) exécute les actions `confirm` après « oui ». `send_client_message` exécuté inline (~l.577-607 : `provider.buildSendTextRequest` → Meta). `whatsapp_confirmation_log` écrit oui/non.
- `whatsapp_conversation_insights` (table, RLS agency) : `{ summary, intent, entities, commitments, sentiment, next_action:{type,label}, ... }` keyé `contact_id`. Hook `useConversationInsight(contactId)`.
- `supabase/functions/send-relance-email/index.ts` : envoi email free-form via Resend `{to,subject,body,agentName,agentSignature?,leadId?,agencyId?}`.
- `supabase/functions/ai-copilot/index.ts` : actions `draft_email`/`draft_description` (DeepSeek `deepseek-chat`) ; injecte `agent_ai_profiles.brief.system_addendum` (~l.271-297) mais **PAS** `learned_style`.
- `formatStyleBlock` : `supabase/functions/_shared/agent-style.ts`.

---

## Task 1 : Compréhension du fil dans le contexte du cerveau (réponses contextuelles)

> Pour rédiger une réponse pertinente, le cerveau doit connaître l'état du fil. Aujourd'hui `execGetContactBrief` ne lit pas `whatsapp_conversation_insights`. On l'enrichit (lecture seule).

**Files:** Modify `supabase/functions/_shared/whatsapp-actions.ts` (l'exécuteur `execGetContactBrief`) + `supabase/functions/_shared/whatsapp-tools.ts` (description de `get_contact_brief`)

- [ ] **Step 1 :** Lire `execGetContactBrief` en entier. Après le fetch contact/timeline/searches, AJOUTER un fetch de l'insight courant :
```ts
const { data: insight } = await ctx.supabase.from('whatsapp_conversation_insights')
  .select('summary, intent, sentiment, next_action, commitments, source_message_count, generated_at')
  .eq('contact_id', c.id).maybeSingle()
```
et l'inclure dans le JSON retourné, p.ex. `return JSON.stringify({ contact: c, recherches_actives: searches ?? [], timeline: timeline ?? [], comprehension: insight ?? null })`. (RLS : le worker tourne en service-role, donc lecture OK ; en CI/local l'absence de ligne → null, propre.)
- [ ] **Step 2 :** Mettre à jour la description de l'outil `get_contact_brief` dans `whatsapp-tools.ts` pour mentionner que le brief inclut la **compréhension de la dernière conversation** (résumé, intention, prochaine action suggérée) — pour que DeepSeek sache s'en servir quand l'agent demande « réponds à X » / « rédige une réponse pour X ».
- [ ] **Step 3 :** `deno check` les 2 fichiers. Commit `feat(whatsapp): get_contact_brief inclut la compréhension du fil (réponses contextuelles)`.

---

## Task 2 : Revue du brouillon COMPLET pour `send_client_message`

> Aujourd'hui l'agent ne voit qu'un aperçu de 60 car. avant de valider l'envoi d'un message client. On montre le **texte intégral** (WYSIWYG), comme `prepareSendListings`. Le corps est déjà rédigé au style appris par l'appel DeepSeek existant.

**Files:** Modify `supabase/functions/whatsapp-agent/index.ts` (`stashPending`), `supabase/functions/_shared/whatsapp-i18n.ts` (clé de prompt), i18n si nécessaire

- [ ] **Step 1 :** Dans `stashPending` (whatsapp-agent/index.ts), pour `tool === 'send_client_message'`, remplacer l'aperçu 60 car. par un prompt de confirmation contenant le **corps complet** + le destinataire (résolu : nom du contact). Mirror le style de `confirmSendListings` / le prompt complet de `prepareSendListings`. Conserver `storeArgs = args` (le `body` complet est déjà stocké). Le tier reste `confirm` (inchangé).
- [ ] **Step 2 :** Ajouter/ajuster la clé i18n du prompt de confirmation (un libellé type « Envoyer ce message à {nom} ? \n\n— \n{corps}\n— \nRéponds *oui* pour envoyer, ou dicte une correction. ») dans `whatsapp-i18n.ts`, 4 langues. (La correction « non, plutôt… » alimentera la T2 corrections plus tard — synergie.)
- [ ] **Step 3 :** `deno check`. Commit `feat(whatsapp): revue du brouillon complet avant envoi client (WYSIWYG)`.

---

## Task 3 : Nouvel outil `send_client_email` (rédige + envoie un email client, validé)

> La capacité manquante : l'agent dit « envoie un email à [client] pour … » → MEGGA rédige (style + compréhension) un sujet+corps, montre le brouillon complet, l'agent valide, MEGGA envoie via Resend. Tier `confirm` (jamais auto). Clone du pattern `prepareSendListings` (prepare WYSIWYG) + `executeSendKycLink` (appel edge email).

**Files:** Modify `whatsapp-tools.ts` (déf outil), `whatsapp-agent-router.ts` (tier), `whatsapp-actions.ts` (prepare + execute), `whatsapp-agent/index.ts` (router le prepare dans `stashPending`), `whatsapp-webhook/index.ts` (router l'exécution dans `executePending`)

- [ ] **Step 1 : Déf outil** dans `whatsapp-tools.ts` :
```ts
{ type: 'function', function: { name: 'send_client_email',
  description: "Rédige un EMAIL à un client (contact du CRM) et l'envoie APRÈS validation de l'agent. MEGGA rédige le brouillon (sujet + corps) au ton de l'agent et selon la conversation ; l'agent valide ou corrige avant l'envoi.",
  parameters: { type: 'object', properties: {
    contact_id: { type: 'string', description: 'ID du contact destinataire' },
    instruction: { type: 'string', description: "Ce que l'email doit dire (intention), en quelques mots" },
  }, required: ['contact_id', 'instruction'] } } }
```
- [ ] **Step 2 : Tier** dans `whatsapp-agent-router.ts` : `send_client_email: 'confirm'`. Vérifier que `canLeaveConfirm('send_client_email')` renvoie `false` (le socle légal : il n'est `=== 'update_pipeline'` que pour true ; donc déjà false — confirmer par un test à la Task 5).
- [ ] **Step 3 : prepare** `prepareSendClientEmail(ctx, args)` dans `whatsapp-actions.ts` (clone `prepareSendListings`) :
  1. Résoudre le contact (`contacts` : id, first_name, last_name, email) scoping agency ; si pas d'email → renvoyer une erreur claire (« ce contact n'a pas d'email »).
  2. Récupérer le contexte : `execGetContactBrief`-like (réutiliser la lecture insight de la Task 1) — résumé/intention/prochaine action + dernières interactions.
  3. Récupérer le style : `learned_style` de l'agent (`agent_ai_profiles.learned_style` pour `ctx.profileId`) → `formatStyleBlock`.
  4. **Sous-appel DeepSeek** (mirror du `fetch` DeepSeek de `learn-agent-style`/whatsapp-agent : `https://api.deepseek.com/v1/chat/completions`, `model:'deepseek-chat'`, `temperature:~0.3`, `response_format:{type:'json_object'}`, `AbortSignal.timeout`) avec un prompt : « Rédige un email immobilier suisse au client, vouvoiement, sobre et personnalisé selon la conversation ci-dessous et l'instruction de l'agent. <styleBlock>. Réponds en JSON strict {"subject":"…","body":"…"}. AUCUNE promesse non tenable, aucune donnée inventée. » + le contexte (compréhension + interactions) + l'instruction.
  5. Gérer l'échec DeepSeek (best-effort : renvoyer une erreur « je n'ai pas pu rédiger, reformule ? », ne rien stasher).
  6. Stasher `{ contact_id, to: email, subject, body }` et renvoyer un prompt de confirmation **WYSIWYG** : « Email à {nom} — Objet : {subject}\n\n{body}\n\nRéponds *oui* pour envoyer, ou dicte une correction. »
- [ ] **Step 4 : execute** dans `executePending` (whatsapp-webhook/index.ts), brancher `send_client_email` → appeler l'edge `send-relance-email` (mirror `executeSendKycLink`'s service-role fetch) avec `{ to, subject, body, agentName: <nom agent>, agencyId: agentLink.agency_id, leadId: contact_id }`. Sur succès → message de confirmation à l'agent ; sur échec → message d'échec honnête. Écrire `whatsapp_confirmation_log` (oui/non) comme les autres.
- [ ] **Step 5 : router le prepare** dans `stashPending` (whatsapp-agent/index.ts) : ajouter la branche `send_client_email` → appeler `prepareSendClientEmail`, stasher le payload + le prompt WYSIWYG (mirror la branche `send_listings`).
- [ ] **Step 6 :** `deno check` tous les fichiers touchés. i18n des nouveaux libellés (4 langues). Commit `feat(whatsapp): outil send_client_email — MEGGA rédige + envoie un email client (validé, style appris)`.

---

## Task 4 : `learned_style` unifié dans `ai-copilot` (brouillons web au ton de l'agent)

> Cohérence multi-canal : les brouillons du copilote web (`draft_email`/`draft_description`, utilisés par `DBRelanceSession`/`JulienSugarV2Page`) doivent aussi adopter le style appris, pas seulement le brief Day-0.

**Files:** Modify `supabase/functions/ai-copilot/index.ts`

- [ ] **Step 1 :** Après l'injection du `brief.system_addendum` (~l.271-297), AJOUTER la lecture de `learned_style` (même `agent_ai_profiles`, déjà fetché — réutiliser/élargir le select à `brief, learned_style`) et appender `formatStyleBlock(learned_style)` au `systemPrompt` (importer depuis `../_shared/agent-style.ts`). Vide si pas `active` → comportement inchangé.
- [ ] **Step 2 :** `deno check`. Commit `feat(copilot): ai-copilot adopte le style appris de l'agent (learned_style) dans ses brouillons`.

---

## Task 5 : Specs live + i18n + cerveau + PR

**Files:** Create `tests/backend/whatsapp-assisted-outbound.spec.ts`

- [ ] **Step 1 : Spec live** (mirror un spec backend existant, ex. `whatsapp-learning-style.spec.ts`). Couvrir (sans appeler DeepSeek — tester les invariants, pas le LLM) :
  1. **Socle légal** : `canLeaveConfirm('send_client_email')` === false ET `canLeaveConfirm('send_client_message')` === false (test pur sur le router — import direct, comme `whatsapp-agent-router.test.ts`).
  2. Si testable live : un agent vérifié peut stasher puis exécuter un `send_client_email` (mock du contexte) — sinon, couvrir le pur (le routeur + la présence de l'outil dans `WHATSAPP_TOOLS`). Garder DeepSeek hors du test (le drafting LLM n'est pas déterministe).
  Aussi un test pur (`whatsapp-agent-router.test.ts` ou un nouveau) : `send_client_email` est bien tier `confirm`.
- [ ] **Step 2 : Build & tests** `npm run build && npx vitest run` verts. `deno check` sur toutes les edge functions touchées.
- [ ] **Step 3 : Cerveau** : `megga/whatsapp-agent-copilot` (nouvel outil `send_client_email` → N+1 outils ; revue du brouillon complet ; compréhension dans get_contact_brief) ; `megga/megga-ai-agent-learning` (la sortie assistée exploite T1 style + compréhension) ; `megga/megga-ai-persona` (réponses & emails clients rédigés par MEGGA, TOUJOURS validés). Vérifier le compte d'outils réel dans le code. `npm run ruflo:seed`.
- [ ] **Step 4 : Commit + PR** vers `main`. (Pas de migration attendue → pas de date-gate ; si une tâche en a ajouté une, la dater du jour de merge.) NE PAS merger sans accord humain (CI verte). Le contrôleur ouvre la PR.

---

## Self-Review (vérifié contre les contraintes)

- ✅ Réutilise l'existant : envoi WhatsApp (`send_client_message`/Meta), email (`send-relance-email`/Resend), squelette confirm (`pending_actions`), style (`formatStyleBlock`), compréhension (`whatsapp_conversation_insights`). Aucune réinvention.
- ✅ Socle légal : tous les envois client restent `confirm` (jamais auto) — testé (Task 5).
- ✅ Brouillon WYSIWYG : texte complet validé = texte envoyé (gelé au prepare).
- ✅ Style appris appliqué (WhatsApp déjà ; email via formatStyleBlock dans le sous-appel ; web via Task 4). Compréhension du fil injectée (Task 1).
- ✅ DeepSeek-only (ne pas répliquer la violation Claude de #356) ; persona soigné, anti-fabrication conservée.
- ✅ Email via Resend `noreply@megga.ch` ; Gmail/Outlook perso hors périmètre (#356).
- ✅ Probablement zéro migration → pas de date-gate ; build vert ; specs live ; i18n 4 langues.

**Cohérence des noms :** `send_client_email` (outil) ↔ `prepareSendClientEmail`/exécution via `send-relance-email` ↔ tier `confirm` (`canLeaveConfirm` false) ↔ `get_contact_brief` enrichi (compréhension) ↔ `formatStyleBlock`/`learned_style` (style) ↔ `whatsapp_conversation_insights` (contexte).

---

## Exécution

Session FRAÎCHE, **subagent-driven** : un sous-agent par tâche + revue conformité-puis-qualité (comme les paliers précédents). Consulter le cerveau au début de chaque tâche. Ordre conseillé : Task 1 (contexte) → Task 2 (brouillon complet WhatsApp) → Task 3 (email client) → Task 4 (unif copilot) → Task 5 (specs/cerveau/PR). Attention de revue : (1) le socle légal — aucun envoi client ne quitte `confirm` ; (2) WYSIWYG — payload gelé au prepare ; (3) DeepSeek-only ; (4) dégradation propre si pas de style/compréhension. **Gros morceau** : possible de livrer en 2 PR (Tasks 1-2 « réponses WhatsApp », puis Tasks 3-5 « email + unif ») si on veut réduire la taille des revues.
