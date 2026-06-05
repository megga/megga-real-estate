# WhatsApp — Préparation de rendez-vous (outil `prepare_meeting`, v1)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (un sous-agent par tâche + les DEUX revues : conformité spec, puis qualité de code). Étapes en cases à cocher (`- [ ]`). Session FRAÎCHE : ce plan est autonome.

> ⚠️ **CADRAGE.** v1 ajoute UN outil **read-tier** `prepare_meeting` : pour un contact, MEGGA rend une **synthèse de préparation de RDV** — fiche + où on en est + biens pertinents + RDV/visite à venir + **3 points à aborder**. C'est de l'**agrégation** de briques existantes (`get_contact_brief`, `get_matches`, table `visits`) + une petite couche DeepSeek pour les points. **Rien n'est envoyé** (agent-facing). Pas de migration.

**Goal :** dans son fil 1:1 MEGGA, l'agent demande « prépare mon RDV avec Dupont ». MEGGA rend un **brief de préparation** : qui c'est, l'heure/le bien du RDV s'il y en a un, où en est le dossier (dernière conversation comprise, dernières actions), les biens qui correspondent, et **3 points concrets à aborder** — le tout **ancré sur les vraies données**, jamais inventé.

**Architecture (réutilisation) :** 1 nouvel outil LECTURE `prepare_meeting` + une ligne de capacité dans le system prompt. L'exécuteur **réutilise les mêmes requêtes** que `execGetContactBrief` (fiche + recherches actives + timeline + compréhension), `execGetMatches` (biens correspondants) et `execGetDailyBrief` (lecture de la table `visits`), puis un appel **DeepSeek** (clone du pattern `prepareSendClientEmail` / `execSummarizeGroupThread`) génère `{brief, points[3]}`. **Aucune migration, aucun envoi, socle intact.**

**Tech Stack :** Supabase Edge (Deno/TS), DeepSeek (`deepseek-chat`, JAMAIS Claude). Réutilise le framework d'outils (`WHATSAPP_TOOLS` + tiers + `runTool`) et le pattern DeepSeek `json_object` + never-throw. Pas de migration → pas de date-gate.

---

## Avant de commencer — consulter le cerveau

```bash
npx ruflo memory search -q "whatsapp prepare_meeting preparation rendez-vous brief contact matches visite points a aborder read-tier" -n megga
npx ruflo memory get -k "megga/whatsapp-agent-copilot" -n megga   # tiers read/auto/confirm ; runTool ; 27 outils
npx ruflo memory get -k "megga/ai-guardrails" -n megga            # pas de fabrication ; rien d'envoye au client sans validation
```
Re-consulter au début de chaque tâche. **Ne pas modifier le seed** avant la dernière tâche.

## Contraintes dures (non négociables)

- **DeepSeek-only** (`deepseek-chat`). JAMAIS Claude/OpenAI.
- **Socle INTACT :** `prepare_meeting` est **read-tier**, agent-facing (résultat rendu à l'agent dans son 1:1). Aucun envoi, aucun tier `confirm` touché, `canLeaveConfirm` inchangé.
- **Pas de fabrication :** la fiche/les biens/la visite viennent des **vraies tables** (scopées `agency_id`). Les **3 points à aborder** sont générés par DeepSeek **uniquement à partir du contexte fourni** (n'invente RIEN ; si peu de données, points génériques mais pertinents — confirmer les critères, planifier la suite). Aucun chiffre marché inventé.
- **Never-throw :** l'exécuteur read renvoie TOUJOURS une string (runTool n'a pas de try/catch) ; garde objet sur le parse JSON DeepSeek ; message honnête sur chaque chemin d'échec.
- **hasAgency requise** (accès DB scopé `agency_id`).
- **Persona/voix :** ton de MEGGA avec l'agent (tutoiement, sobre) ; pas d'identifiants bruts ; pas d'emojis en série.
- **Pas de migration.** `npm run build` vert avant push. **Specs backend live en CI** (skipIf n'est pas un skip ; nettoyage `.then(()=>{},()=>{})`). Blocs agent-facing FR/EN.

## Périmètre

**FAIT (v1) :** outil `prepare_meeting` (read) — agrège fiche + recherches + timeline + compréhension + biens correspondants + visite à venir, fait générer le brief + 3 points par DeepSeek, formate et rend à l'agent ; ligne de capacité system prompt ; specs + cerveau + PR.

**PAS fait (plus tard) :** la variante « prépare TOUS mes RDV de demain » (multi-RDV agenda-driven — MEGGA peut déjà enchaîner `get_my_agenda` puis `prepare_meeting` par contact) ; l'enrichissement KYC/pipeline poussé ; l'envoi du brief où que ce soit. Notés, hors périmètre.

---

## Carte d'archi (anchors vérifiés — 5 juin 2026)

- `supabase/functions/_shared/whatsapp-tools.ts` : `WHATSAPP_TOOLS` (l.15 ; **27 outils**). Forme d'un outil read contact (ex. `get_contact_brief` l.95, `get_matches` l.111). On y ajoute **1 déf**.
- `supabase/functions/_shared/whatsapp-agent-router.ts` : `TOOL_TIERS` (les outils contact read y sont). On classe `prepare_meeting` en `read`.
- `supabase/functions/_shared/whatsapp-agent-router.test.ts` : assertions de tier — y ajouter `prepare_meeting`.
- `supabase/functions/_shared/whatsapp-actions.ts` :
  - `ActionCtx` (l.26), `s()` (l.36), `hasAgency`/`NO_AGENCY` (l.39-42).
  - **Sources à réutiliser (mêmes requêtes/scopes) :** `execGetContactBrief` (l.167-187 : `contacts` select first_name/last_name/phone/email/type/score/tags/notes/search_criteria/last_interaction_at ; `activity_events` timeline 5 dernières ; `client_searches` actives ; `whatsapp_conversation_insights` summary/intent/sentiment/next_action/commitments). `execGetMatches` (l.204-215 : table `matches` select score/status/market_listing_id/property_id, top 5). `execGetDailyBrief` (l.218-231 : lecture `visits` select scheduled_at/status/buyer_name/contact_id, scopée `agency_id`+`agent_id`).
  - **Clone DeepSeek + never-throw + garde objet JSON :** `prepareSendClientEmail` (fetch `deepseek-chat` `json_object` `temperature:0.3` `AbortSignal.timeout(15000)` + try/catch honnête) et `execSummarizeGroupThread`/`execCheckGroupLeak` (garde `if (!j || typeof j !== 'object' || Array.isArray(j)) return failMsg`).
  - **Table `visits`** (colonnes utiles) : `id, agency_id, property_id, contact_id, scheduled_at, status, visit_type, duration_minutes, agent_id, buyer_name`. **Table `matches`** : `score, status, market_listing_id, property_id, contact_id, agency_id`. Titres/prix des biens : `properties` (`title, price, currency, city`) et/ou `market_listings` (`title, price, city`) selon l'id rempli.
- `supabase/functions/whatsapp-agent/index.ts` : `runTool` switch (cases + import) ; system prompt (liste des capacités l.36 + règles). On ajoute le `case` + l'import + une **mention de capacité** courte.

---

## File Structure

**Modifier :**
- `supabase/functions/_shared/whatsapp-tools.ts` — déf `prepare_meeting` (Task 1).
- `supabase/functions/_shared/whatsapp-agent-router.ts` — tier `read` (Task 1).
- `supabase/functions/_shared/whatsapp-agent-router.test.ts` — assertion tier (Task 1).
- `supabase/functions/_shared/whatsapp-actions.ts` — `execPrepareMeeting` (Task 2).
- `supabase/functions/whatsapp-agent/index.ts` — `runTool` case + import + mention capacité (Task 2).
- `tests/backend/whatsapp-prepare-meeting.spec.ts` — invariants (Task 3).

**Contrat :** l'outil renvoie une string (réinjectée role:'tool'), comme les autres exécuteurs read. DeepSeek ne rend que `{brief, points}` ; le reste (fiche, biens, visite) est assemblé EN CODE depuis les vraies données.

---

## Task 1 : Outil `prepare_meeting` (déf + tier read)

**Files:** `whatsapp-tools.ts`, `whatsapp-agent-router.ts`, `whatsapp-agent-router.test.ts`

- [ ] **Step 1 — Déf outil** dans `WHATSAPP_TOOLS` (double quotes pour la description) :
```ts
{ type: 'function', function: { name: 'prepare_meeting',
  description: "Prépare un rendez-vous / une visite avec un contact : rend une synthèse (qui c'est, où en est le dossier, biens qui correspondent, RDV à venir) + 3 points concrets à aborder. Pour « prépare mon RDV avec Dupont », « brief de visite pour Mme Vaucher ». NE poste rien — c'est pour l'agent. contact_id via search_contacts ; si l'agent ne donne qu'une heure, retrouve d'abord le contact via get_my_agenda.",
  parameters: { type: 'object', properties: {
    contact_id: { type: 'string', description: 'ID du contact concerné par le RDV (via search_contacts)' },
  }, required: ['contact_id'] } } }
```
- [ ] **Step 2 — Tier** dans `TOOL_TIERS` : `prepare_meeting: 'read',` (commentaire : agrégation lecture seule, rien d'envoyé, agent-facing).
- [ ] **Step 3 — Test router** : assertion `toolTier('prepare_meeting') === 'read'` dans le bloc `describe('toolTier')` de `whatsapp-agent-router.test.ts`.
- [ ] **Step 4 :** `deno check`. Commit `feat(meeting): outil prepare_meeting (déf + tier read)`.

---

## Task 2 : Exécuteur `execPrepareMeeting` (agrégation + DeepSeek points) + dispatch + capacité

**Files:** `whatsapp-actions.ts`, `whatsapp-agent/index.ts`

- [ ] **Step 1 — Exécuteur** `execPrepareMeeting(ctx, a): Promise<string>` à la fin de `whatsapp-actions.ts` :
  1. `const lang = ctx.lang ?? 'fr'`. `if (!hasAgency(ctx)) return NO_AGENCY`. `const contactId = s(a.contact_id)` ; vide → demander quel contact.
  2. **Contact** (mêmes champs que `execGetContactBrief`) scopé `agency_id` ; introuvable → message honnête.
  3. **Compréhension** (`whatsapp_conversation_insights` : summary, intent, sentiment, next_action, commitments) + **timeline** (5 dernières `activity_events`) + **recherches actives** (`client_searches`) — comme `execGetContactBrief`.
  4. **Biens correspondants** (`matches` top 5) ; enrichir en best-effort les titres/prix depuis `properties` (par `property_id`) et/ou `market_listings` (par `market_listing_id`). Champ absent → omis, jamais inventé.
  5. **Visite à venir** : `visits` où `contact_id`+`agent_id`+`agency_id`, `scheduled_at >= now()`, `status` non annulé, `order scheduled_at asc limit 1` → heure + `property_id` (→ titre du bien) + `visit_type`.
  6. **DeepSeek** (clone `prepareSendClientEmail`) : `json_object`, `temperature:0.3`, `max_tokens:500`, `AbortSignal.timeout(15000)`. Prompt : « Voici le contexte d'un RDV immobilier (fiche client, compréhension de la dernière conversation, dossier, biens en attente, visite prévue). Rends `{"brief":"2-3 phrases de contexte","points":["…","…","…"]}`. Les 3 points = sujets CONCRETS à aborder, ancrés UNIQUEMENT sur les données fournies (où en est le dossier, biens à montrer, engagements pris, prochaine action). N'invente RIEN ; si peu de données, propose des points pertinents et génériques (confirmer les critères, planifier la suite). » + le contexte assemblé (borné).
  7. **Never-throw + garde objet JSON** : non-2xx / timeout / JSON non-objet → message honnête ; type-guards sur `brief` (string) et `points` (array de strings, garder max 3). Si DeepSeek échoue, **dégrader proprement** : rendre quand même la partie factuelle (fiche + biens + visite) avec une note « (points à aborder indisponibles) » — l'agrégation factuelle ne dépend pas de DeepSeek.
  8. **Assembler EN CODE** la string FR/EN : `*RDV — <Prénom Nom>* (<type>, <score>)` ; ligne RDV (date/heure + bien + type) si visite ; `*Où on en est*` (résumé/intention + dernière action) ; `*Biens pertinents*` (titres + prix) ; `*À aborder*` (1. 2. 3.). Dates au format suisse `DD.MM.YYYY HH:mm` (Europe/Zurich). Retour string.
- [ ] **Step 2 — Dispatch** : `case 'prepare_meeting': return execPrepareMeeting(ctx, args)` dans `runTool` + import.
- [ ] **Step 3 — Capacité system prompt** : ajouter une courte mention dans la liste des capacités (l.36 de `whatsapp-agent/index.ts`) : « …préparer un rendez-vous (synthèse + points à aborder)… ». Ne rien autoriser de plus (read).
- [ ] **Step 4 :** `deno check`. Commit `feat(meeting): exécuteur execPrepareMeeting (agrégation fiche+biens+visite + 3 points DeepSeek, read)`.

---

## Task 3 : Specs + build + cerveau + PR

**Files:** Create `tests/backend/whatsapp-prepare-meeting.spec.ts`

- [ ] **Step 1 — Specs** (mirror `tests/backend/whatsapp-group-copilot.spec.ts`, imports purs, SANS skipIf) :
  1. **Tier read** : `toolTier('prepare_meeting') === 'read'`.
  2. **Socle intact** : `canLeaveConfirm('send_client_message') === false` ET `canLeaveConfirm('send_client_email') === false`.
  3. **Présence outil** : `prepare_meeting` dans `WHATSAPP_TOOLS` avec `required` = `['contact_id']`.
- [ ] **Step 2 — Build & tests** : `npm run build` vert ; `npx vitest run` vert ; `npx vitest run --config=vitest.backend.config.ts tests/backend/whatsapp-prepare-meeting.spec.ts` ; `deno check` sur les 4 edge functions touchées.
- [ ] **Step 3 — Cerveau** : `megga/whatsapp-agent-copilot` : +1 outil read `prepare_meeting` (compter le réel → N+1, attendu 28) ; mention « préparation de RDV (agrège fiche+biens+visite + 3 points DeepSeek, read, agent-facing) ». Puis `npm run ruflo:seed` ; valider le JSON.
- [ ] **Step 4 — Commit + PR** vers `main`. Pas de migration → pas de date-gate. NE PAS merger sans accord humain (CI verte). Le contrôleur ouvre la PR.

---

## Self-Review (vérifié contre la spec/les contraintes)

- ✅ Agrégation des briques existantes (`get_contact_brief`/`get_matches`/`visits`) + petite couche DeepSeek → peu d'effort, gros ressenti.
- ✅ Socle INTACT : read-tier, agent-facing, rien d'envoyé, `canLeaveConfirm` inchangé (testé).
- ✅ Pas de fabrication : fiche/biens/visite = vraies tables ; les 3 points ancrés sur le contexte fourni (« n'invente RIEN ») ; dégradation propre si DeepSeek échoue (partie factuelle rendue quand même).
- ✅ DeepSeek-only ; never-throw + garde objet JSON ; pas de migration.

**Cohérence des noms :** `prepare_meeting` (outil read) ↔ `execPrepareMeeting` (exécuteur) ↔ mention capacité system prompt.

---

## Exécution

Session FRAÎCHE, **subagent-driven** : un sous-agent par tâche + revue conformité-puis-qualité. Consulter le cerveau au début de chaque tâche. Mettre le cerveau à jour à la Task 3. Attention de revue : (1) read-tier confirmé (rien d'envoyé, socle intact) ; (2) pas de fabrication (factuel des vraies tables ; points ancrés ; dégradation propre) ; (3) never-throw (garde objet JSON) ; (4) DeepSeek-only ; (5) tout scopé `agency_id`.
