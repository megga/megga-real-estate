# WhatsApp — MEGGA couteau suisse en groupe, v1 (fondation) : comprendre un fil de groupe, rédiger un message sûr pour le groupe, détecter les fuites (plan d'implémentation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans, tâche par tâche. Étapes en cases à cocher (`- [ ]`). Session FRAÎCHE : ce plan est autonome.

> ⚠️ **CADRAGE HONNÊTE — lire d'abord.** Le « wow » final (MEGGA postant en direct DANS un groupe natif, devant le client) exige **(a) le groupe natif Cloud API**, gated sur **OBA + sortie du mode test Meta** (cerveau `whatsapp-groups-api` : « PHASE FUTURE »), et **(b)** une politique « 2 voies » d'auto-publication. **Ces deux choses = Phase 2, PAS ce plan.** Ce plan v1 livre la **fondation buildable MAINTENANT**, dans le canal 1:1 existant : MEGGA aide l'agent À PROPOS d'un groupe (il colle/transfère un fil), tout reste **agent-facing / mis en scène** (le socle n'est jamais touché). v1 est conçu pour que la Phase 2 ne soit qu'un changement de destinataire d'envoi.
>
> **Note GATE :** contrairement à la voix/corrections, les lames v1 (récap, détecteur de fuite) sont **read-tier, agent-facing, et n'utilisent PAS la voix apprise** → elles n'empilent rien sur une fondation non validée. Donc v1 est sûr à exécuter maintenant, indépendamment du check réel de la voix.

**Goal:** Donner à l'agent, dans son fil 1:1 MEGGA, un **couteau suisse de groupe** : (1) **résumer un fil de groupe** qu'il colle/transfère ; (2) **rédiger un message « sûr pour le groupe »** (dans sa voix, sans donnée d'une seule partie) qu'il postera lui-même ; (3) **détecter une fuite directionnelle** avant qu'il poste (« ça révèle le plafond de l'acheteur, le vendeur est dans ce groupe »). Les ressources existantes (recherche de biens `search_listings`, matching `get_matches`, fiches `get_contact_brief`) sont déjà là — v1 ajoute la **couche groupe** par-dessus.

**Architecture (réutilisation) :** 2 nouveaux outils LECTURE (`summarize_group_thread`, `check_group_leak`) + une consigne « audience groupe » dans le system prompt. Récap = réutilise le moteur `comprehend`/`buildThreadDigest` (`_shared/whatsapp-comprehend.ts`). Rédaction sûre = la voix/persona déjà injectées (PR #577) ; le brain rédige + auto-vérifie via `check_group_leak`. Fuite = un appel DeepSeek ciblé (brouillon + parties annoncées par l'agent). **Aucune migration, aucun envoi nouveau, socle intact** (tout revient à l'agent, qui poste à la main en v1).

**Tech Stack :** Supabase Edge (Deno/TS), DeepSeek (`deepseek-chat`, JAMAIS Claude). Réutilise PR #577 (voix), le moteur de compréhension, le framework d'outils (`WHATSAPP_TOOLS` + tiers + `runTool`). Pas de migration → pas de date-gate.

---

## Avant de commencer — consulter le cerveau

```bash
npx ruflo memory search -q "whatsapp groupe couteau suisse summarize_group_thread check_group_leak fuite directionnelle salle transaction OBA 2-voies socle" -n megga
npx ruflo memory get -k "megga/whatsapp-groups-api" -n megga    # GA oct 2025, OBA OU 100k, max 8, MEGGA en test mode = PHASE FUTURE
npx ruflo memory get -k "megga/megga-ai-persona" -n megga       # client = la vitrine ; vouvoiement ; à titre indicatif
npx ruflo memory get -k "megga/ai-guardrails" -n megga          # jamais de contact client sans validation ; jamais de contournement
npx ruflo memory get -k "megga/whatsapp-agent-copilot" -n megga # tiers read/auto/confirm ; runTool ; outils existants
```
Re-consulter au début de chaque tâche. **Ne pas modifier le seed** avant la dernière tâche.

## Contraintes dures (non négociables)

- **DeepSeek-only** (`deepseek-chat`). JAMAIS Claude/OpenAI.
- **Socle INTACT :** v1 n'envoie RIEN de nouveau. Les 2 nouveaux outils sont **read-tier** (résultat rendu à l'agent dans son 1:1 ; l'agent poste lui-même dans son groupe). On ne touche aucun tier `confirm`, aucun `canLeaveConfirm`. Le « MEGGA poste dans le groupe » = Phase 2.
- **Pas de fabrication / pas de bluff :** v1 ne fournit QUE du grounded ou de l'indicatif clairement étiqueté. Pas de « conseil marché chiffré » (aucun outil de données marché n'existe côté agent → ce serait inventé). Les biens viennent de `search_listings`/`get_matches` (réels) ; les explications process restent générales et « à titre indicatif (le notaire/la banque tranche) ».
- **Confidentialité directionnelle :** la lame fuite (`check_group_leak`) est défensive — elle ne peut que REFUSER/alerter, jamais divulguer. La rédaction « audience groupe » strippe toute donnée d'une seule partie (plafond acheteur, motivation, KYC).
- **Persona :** vouvoiement côté client, FR/EN soigné, voix de l'agent (déjà injectée), aucun identifiant brut.
- **Pas de migration.** `npm run build` vert avant push. **Specs backend live en CI** (skipIf n'est pas un skip ; nettoyage `.then(()=>{},()=>{})`). Blocs agent-facing FR/EN.

## Périmètre

**FAIT (ce plan, v1) :** (1) `summarize_group_thread` (read) — récap d'un fil collé/transféré ; (2) `check_group_leak` (read) — détecteur de fuite directionnelle sur un brouillon + parties ; (3) consigne « audience groupe » dans le system prompt (le brain rédige sûr + auto-vérifie via la lame fuite) ; (4) specs + cerveau + PR.

**PAS fait (Phase 2, gated OBA + sortie test) :** MEGGA poste EN DIRECT dans un groupe natif ; la politique « 2 voies » auto (public direct / sensible validé) ; les outils « conseil » grounded (données marché/prix, frais & process structurés) ; la salle de transaction orchestrée multi-1:1 (chaque partie en 1:1, agrégée). Notés, hors périmètre.

---

## Carte d'archi (anchors vérifiés)

- `supabase/functions/_shared/whatsapp-comprehend.ts` : `ConversationInsight` (l.6), `buildThreadDigest(messages)` (l.35), `parseInsight(content)` (l.70), `comprehend(messages, apiKey)` (l.100, appel DeepSeek JSON, `deepseek-chat`, lève si non-2xx). Le récap réutilise ce pattern.
- `supabase/functions/_shared/whatsapp-tools.ts` : `WHATSAPP_TOOLS` (l.15) ; forme d'un outil read (ex. `get_matches` l.111, `search_listings` l.248). On y ajoute 2 défs.
- `supabase/functions/_shared/whatsapp-agent-router.ts` : `TOOL_TIERS` (read/auto/confirm/slow_async), `toolTier()`. On y classe les 2 nouveaux outils en `read`.
- `supabase/functions/whatsapp-agent/index.ts` : la boucle d'outils ; tier `read` → exécution directe via `runTool` (switch ~l.290-310, ex. `case 'search_listings'` l.310). Le system prompt (l.121) finit par `…${styleBlock}${voiceBlock}` (PR #577) — on y appendra une consigne « audience groupe ». DeepSeek key = `Deno.env.get('DEEPSEEK_API_KEY')`.
- `supabase/functions/_shared/whatsapp-actions.ts` : exécuteurs `exec*` (read) + le pattern d'appel DeepSeek (clone `prepareSendClientEmail`/`comprehend` : fetch `api.deepseek.com`, `model:'deepseek-chat'`, `response_format:{type:'json_object'}`, `AbortSignal.timeout`). On y ajoute `execSummarizeGroupThread` + `execCheckGroupLeak`. `ActionCtx` (l.25), `s()` (l.35), `hasAgency` (l.37).

---

## File Structure

**Modifier :**
- `supabase/functions/_shared/whatsapp-tools.ts` — défs `summarize_group_thread` + `check_group_leak` (Task 1, 2).
- `supabase/functions/_shared/whatsapp-agent-router.ts` — tier `read` pour les 2 (Task 1, 2).
- `supabase/functions/_shared/whatsapp-agent-router.test.ts` — tier des 2 outils (Task 1, 2).
- `supabase/functions/_shared/whatsapp-actions.ts` — `execSummarizeGroupThread` + `execCheckGroupLeak` (Task 1, 2).
- `supabase/functions/whatsapp-agent/index.ts` — `runTool` cases + consigne « audience groupe » (Task 1, 2, 3).
- `tests/backend/whatsapp-group-copilot.spec.ts` — invariants (Task 4).

**Contrats (définis une fois) :**
```ts
// Aucun nouveau type partagé requis : les 2 outils renvoient une string (réinjectée role:'tool'),
// comme tous les exécuteurs read existants. La sortie de check_group_leak est un verdict humain
// (« ⚠️ fuite : … » / « ✅ rien de confidentiel détecté »), pas un JSON structuré exposé.
```

---

## Task 1 : Outil `summarize_group_thread` (récap d'un fil de groupe collé)

> L'agent colle/transfère un bout de fil de groupe et demande « résume ». MEGGA renvoie un digest privé : qui dit quoi, décisions, questions ouvertes, point bloquant. Read-tier (rien n'est envoyé).

**Files:** `whatsapp-tools.ts`, `whatsapp-agent-router.ts`, `whatsapp-actions.ts`, `whatsapp-agent/index.ts`

- [ ] **Step 1 — Déf outil** dans `WHATSAPP_TOOLS` (`whatsapp-tools.ts`) :
```ts
{ type: 'function', function: { name: 'summarize_group_thread',
  description: "Résume un fil de conversation de GROUPE que l'agent colle ou transfère (plusieurs intervenants). Rends un digest court : décisions, questions ouvertes, qui attend quoi, point bloquant. Pour « résume ce groupe », « où on en est dans ce fil ». NE poste rien — c'est pour l'agent.",
  parameters: { type: 'object', properties: {
    thread: { type: 'string', description: 'Le texte du fil de groupe collé/transféré par l\\'agent' },
  }, required: ['thread'] } } }
```
- [ ] **Step 2 — Tier** dans `TOOL_TIERS` (`whatsapp-agent-router.ts`) : `summarize_group_thread: 'read',` (avec un commentaire : lecture seule, rien d'envoyé, agent-facing).
- [ ] **Step 3 — Exécuteur** `execSummarizeGroupThread(ctx, a)` dans `whatsapp-actions.ts` (clone du pattern `comprehend`) :
  1. `const thread = s(a.thread)` ; si vide → `'Colle-moi le fil du groupe et je te le résume.'`.
  2. `const apiKey = Deno.env.get('DEEPSEEK_API_KEY')` ; si absent → message d'échec honnête (« je ne peux pas résumer là, réessaie »).
  3. Appel DeepSeek (clone `comprehend` l.100 : `fetch('https://api.deepseek.com/v1/chat/completions', { model:'deepseek-chat', response_format:{type:'json_object'}, max_tokens:600, temperature:0.2, signal:AbortSignal.timeout(15000) })`). Prompt : « Voici un fil de groupe (plusieurs intervenants). Résume en JSON {"resume":"2-3 phrases","decisions":["…"],"en_attente":["qui attend quoi"],"bloquant":"le point qui bloque ou null"}. Attribue les propos aux intervenants quand c'est clair. AUCUNE invention. » + le `thread` (borné à ~4000 car.).
  4. Gérer l'échec (non-2xx / timeout / JSON invalide) → message honnête, ne rien inventer.
  5. Formater le JSON en texte court lisible (FR/EN selon `ctx.lang`) et le renvoyer (string).
- [ ] **Step 4 — Dispatch** : `case 'summarize_group_thread': return execSummarizeGroupThread(ctx, args)` dans le `runTool` switch (`whatsapp-agent/index.ts`), + importer l'exécuteur.
- [ ] **Step 5 :** `deno check` les fichiers touchés. Commit `feat(group): outil summarize_group_thread (récap d'un fil de groupe, read)`.

---

## Task 2 : Outil `check_group_leak` (détecteur de fuite directionnelle)

> Avant que l'agent poste un message dans un groupe MIXTE (acheteur + vendeur), MEGGA vérifie que le brouillon ne révèle pas une donnée d'une partie à l'autre. Défensif : alerte, ne divulgue jamais. Read-tier.

**Files:** `whatsapp-tools.ts`, `whatsapp-agent-router.ts`, `whatsapp-actions.ts`, `whatsapp-agent/index.ts`

- [ ] **Step 1 — Déf outil** :
```ts
{ type: 'function', function: { name: 'check_group_leak',
  description: "Vérifie qu'un brouillon destiné à un GROUPE ne révèle pas une info confidentielle d'une partie à l'autre (ex : dévoiler le budget max de l'acheteur au vendeur). À utiliser avant de poster dans une salle de transaction. Renvoie une alerte si fuite, sinon un OK. NE poste rien.",
  parameters: { type: 'object', properties: {
    draft: { type: 'string', description: 'Le brouillon que l\\'agent veut poster dans le groupe' },
    parties: { type: 'string', description: 'Les parties présentes dans le groupe (ex : « acheteur Dupont, vendeur Martin, notaire »)' },
  }, required: ['draft', 'parties'] } } }
```
- [ ] **Step 2 — Tier** : `check_group_leak: 'read',` dans `TOOL_TIERS`.
- [ ] **Step 3 — Exécuteur** `execCheckGroupLeak(ctx, a)` dans `whatsapp-actions.ts` :
  1. `const draft = s(a.draft); const parties = s(a.parties)` ; si l'un manque → message demandant les deux.
  2. `apiKey` check (idem Task 1).
  3. Appel DeepSeek : « Tu es un garde-fou de confidentialité immobilière. Parties dans le groupe : <parties>. Brouillon que l'agent veut poster À TOUT LE GROUPE : <draft>. Y a-t-il une info qui ne devrait PAS être vue par une des parties (budget/plafond/plancher d'une partie, sa motivation/urgence, son KYC, une stratégie) ? Réponds en JSON {"fuite":true|false,"raison":"courte, sans répéter le secret en clair","reformulation":"version sûre sans la fuite, ou null"}. Dans le doute, fuite=true. » `response_format:{type:'json_object'}`, `temperature:0`.
  4. Échec → message honnête (« je n'ai pas pu vérifier, relis à la main avant de poster »).
  5. Formater : si `fuite` → « ⚠️ Attention : <raison>. Version sûre : <reformulation> » ; sinon « ✅ Rien de confidentiel détecté pour les parties indiquées. » (FR/EN). **Ne JAMAIS ré-imprimer le secret en clair** (la raison reste générique).
- [ ] **Step 4 — Dispatch** : `case 'check_group_leak': return execCheckGroupLeak(ctx, args)` + import.
- [ ] **Step 5 :** `deno check`. Commit `feat(group): outil check_group_leak (détecteur de fuite directionnelle, read)`.

---

## Task 3 : Consigne « audience groupe » dans le system prompt

> Quand l'agent demande un message « pour le groupe », le brain doit rédiger une version SÛRE (voix de l'agent — déjà injectée — sans donnée d'une seule partie), proposer de vérifier via `check_group_leak`, et router tout message à UNE seule partie vers le 1:1 (jamais dans le groupe partagé). Aucune nouvelle capacité d'envoi — le brain RÉDIGE, l'agent poste.

**Files:** `whatsapp-agent/index.ts`

- [ ] **Step 1 :** Après `${voiceBlock}` dans le message système (l.121), appender une consigne `groupBlock` constante (toujours présente — c'est une règle de comportement, pas conditionnée à des données) :
```ts
// Comportement GROUPE (v1) : le brain aide l'agent À PROPOS d'un groupe ; il ne poste jamais lui-même.
const groupBlock = lang === 'en'
  ? `\n\nGroup behavior: when the agent asks for a message "for the group", draft a GROUP-SAFE version in their voice — never include data belonging to only one party (a party's max budget/floor, motivation, KYC). Offer to run check_group_leak before they post. Anything meant for ONE party must go to that party's 1:1 thread, never the shared group. You draft; the agent posts. Market figures only if grounded by a tool; otherwise stay general and "à titre indicatif".`
  : `\n\nComportement groupe : quand l'agent demande un message « pour le groupe », rédige une version SÛRE dans sa voix — n'inclus jamais une donnée propre à une seule partie (plafond/plancher, motivation, KYC d'une partie). Propose de lancer check_group_leak avant qu'il poste. Tout message destiné à UNE partie va dans son fil 1:1, jamais dans le groupe partagé. Tu rédiges ; l'agent poste. Chiffres marché seulement si un outil les fournit ; sinon reste général et « à titre indicatif ».`
```
et `…${styleBlock}${voiceBlock}${groupBlock}`.
- [ ] **Step 2 :** `deno check`. Vérifier : la consigne vient APRÈS le socle/persona/voix ; elle n'autorise aucun envoi ; elle renvoie le privé vers le 1:1. Commit `feat(group): consigne « audience groupe » (rédaction sûre, jamais d'envoi, privé→1:1)`.

---

## Task 4 : Specs + build + cerveau + PR

**Files:** Create `tests/backend/whatsapp-group-copilot.spec.ts`

- [ ] **Step 1 — Specs** (mirror `tests/backend/whatsapp-assisted-outbound.spec.ts`, imports purs du router). Couvrir, SANS appeler DeepSeek :
  1. **Tier read** : `toolTier('summarize_group_thread') === 'read'` ET `toolTier('check_group_leak') === 'read'` (donc exécution directe, jamais le squelette confirm). Ajouter aussi ces 2 assertions dans `whatsapp-agent-router.test.ts`.
  2. **Socle intact** : `canLeaveConfirm('send_client_message') === false` ET `canLeaveConfirm('send_client_email') === false` (ce plan ne touche aucun envoi).
  3. **Présence outils** : `summarize_group_thread` et `check_group_leak` sont dans `WHATSAPP_TOOLS` avec leurs params requis (`thread` ; `draft`+`parties`).
- [ ] **Step 2 — Build & tests** : `npm run build` vert ; `npx vitest run` vert ; `npx vitest run --config=vitest.backend.config.ts tests/backend/whatsapp-group-copilot.spec.ts` (collecte propre). `deno check` sur les 4 edge functions touchées.
- [ ] **Step 3 — Cerveau** :
  - `megga/whatsapp-agent-copilot` : 2 nouveaux outils read `summarize_group_thread` + `check_group_leak` (N+2) ; consigne « audience groupe » (rédige sûr, jamais d'envoi, privé→1:1). Vérifier le compte d'outils réel.
  - `megga/whatsapp-groups-api` : v1 « couteau suisse groupe » FONDATION livrée (agent-facing, 1:1, read-tier) — récap d'un fil + détecteur de fuite + rédaction audience-groupe ; la Phase 2 (post natif + politique 2-voies + outils conseil grounded) reste gated OBA + sortie test.
  Puis `npm run ruflo:seed` ; valider le JSON.
- [ ] **Step 4 — Commit + PR** vers `main`. Pas de migration → pas de date-gate. NE PAS merger sans accord humain (CI verte). Le contrôleur ouvre la PR.

---

## Self-Review (vérifié contre la spec/les contraintes)

- ✅ Couteau suisse, fondation : v1 ajoute la COUCHE groupe (récap + rédaction sûre + détecteur de fuite) par-dessus les ressources existantes (recherche/matching/fiches). Le « wow » natif (post live) = Phase 2, honnêtement gated.
- ✅ Socle INTACT : les 2 outils sont read-tier, agent-facing ; rien n'est envoyé ; `canLeaveConfirm` inchangé (testé). L'agent poste lui-même.
- ✅ Pas de bluff : biens = `search_listings`/`get_matches` (réels) ; pas de chiffre marché inventé (outil données marché = Phase 2) ; process « à titre indicatif ».
- ✅ Confidentialité : `check_group_leak` est défensif (alerte/refuse, ne ré-imprime jamais le secret) ; la rédaction strippe la donnée mono-partie ; le privé va en 1:1.
- ✅ DeepSeek-only ; persona/voix (PR #577) appliquées par le brain ; pas de migration.
- ✅ GATE : v1 n'empile rien sur la voix non validée (récap/fuite n'utilisent pas la voix apprise) → sûr à exécuter maintenant. Phase 2 (natif) gated OBA + sortie test.

**Cohérence des noms :** `summarize_group_thread`/`check_group_leak` (outils read) ↔ `execSummarizeGroupThread`/`execCheckGroupLeak` (exécuteurs) ↔ `groupBlock` (consigne system) ↔ Phase 2 (post natif, 2-voies, conseil grounded).

---

## Exécution

Session FRAÎCHE, **subagent-driven** : un sous-agent par tâche + revue conformité-puis-qualité. Consulter le cerveau au début de chaque tâche. Mettre le cerveau à jour à la Task 4. Attention de revue : (1) read-tier confirmé (rien d'envoyé, socle intact) ; (2) `check_group_leak` ne ré-imprime jamais le secret en clair ; (3) pas de chiffre marché inventé (grounded ou « à titre indicatif ») ; (4) DeepSeek-only ; (5) la consigne groupe renvoie le privé vers le 1:1, n'autorise aucun envoi.
