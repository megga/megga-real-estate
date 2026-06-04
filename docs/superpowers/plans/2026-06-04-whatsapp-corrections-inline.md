# WhatsApp — Corrections en ligne (Phase 2) : MEGGA ré-rédige le brouillon client quand l'agent corrige, au lieu de le jeter (plan d'implémentation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans, tâche par tâche. Étapes en cases à cocher (`- [ ]`). **Session FRAÎCHE** : ce plan est autonome — tout le contexte d'archi est ci-dessous.

> ⚠️ **GATE D'EXÉCUTION (cerveau megga-ai-agent-learning : « ne pas construire à l'aveugle ») :** ce plan empile une 3ᵉ couche d'apprentissage sur le mimétisme de voix (PR #577), qui n'a PAS encore tourné sur de vraies données. **Écrire le plan = OK maintenant. EXÉCUTER = seulement après un check réel** (texter MEGGA, faire rédiger + valider 2-3 vrais messages clients, vérifier que la voix se cale). Si la fondation tient → exécuter. Sinon → revoir avant d'empiler.

**Goal:** Quand l'agent, au lieu de répondre « oui »/« non » à un brouillon client en attente, **dicte une correction** (« non, plutôt mercredi », « dis-lui que c'est déjà vendu »), MEGGA **ré-rédige** le brouillon corrigé (au lieu de le jeter et de repartir de zéro), le re-soumet à validation, puis l'envoie au « oui ». La boucle d'apprentissage se ferme : le message corrigé validé alimente le corpus de voix (PR #577 / VM-6, déjà livré).

**Architecture (réutilisation totale — rien de neuf à réinventer) :** aujourd'hui, dans le webhook, un message qui n'est ni « oui » ni « non » pendant une action en attente tombe dans la branche **F18** (« je mets de côté » + le cerveau traite ça comme une nouvelle demande → le brouillon est **perdu**). On change CE point UNIQUEMENT pour les brouillons **client** (`send_client_message` / `send_client_email`) : le webhook **ré-engage le cerveau** (`callAgentBrain`) en lui passant le **brouillon d'origine** comme contexte de correction. Le cerveau décide « correction vs nouvelle demande » et, si c'est une correction, **ré-appelle le MÊME outil** avec le brouillon corrigé → `stashPending` normal (le **style/voix** s'appliquent déjà, PR #567/#577 ; la **persona/vouvoiement** aussi) → **re-confirmation**. Au « oui », `executePending` envoie + VM-6 persiste → le corpus de voix apprend. **Aucune nouvelle fonction de rédaction, aucune duplication de stash, aucun nouveau store, aucune migration.**

**Tech Stack :** Supabase Edge (Deno/TS), DeepSeek (`deepseek-chat`, JAMAIS Claude). Réutilise : la sortie assistée (PR #574), le mimétisme de voix (PR #577), le squelette confirm (`whatsapp_pending_actions` + `stashPending` + `executePending`). Pas de migration → pas de date-gate.

---

## Relation avec les autres plans

- **Remplace** la Phase 2 « enums » gelée (`docs/superpowers/plans/2026-06-04-whatsapp-agent-learning-corrections.md`) : on n'extrait PAS les corrections en paramètres distillés ; on ré-rédige par l'exemple et on laisse le corpus de voix (VM-6) apprendre passivement. Cette ancienne approche peut être retirée après cette livraison.
- **Construit sur** PR #574 (sortie assistée : `send_client_email`, brouillon WYSIWYG) et PR #577 (mimétisme de voix : la voix s'applique déjà aux brouillons ; VM-6 persiste les envois validés).

## Avant de commencer — consulter le cerveau

```bash
npx ruflo memory search -q "corrections inline confirm parseConfirmation F18 set aside callAgentBrain stashPending send_client_message send_client_email voix VM-6 apprentissage gate" -n megga
npx ruflo memory get -k "megga/megga-ai-agent-learning" -n megga   # la couche apprentissage + le GATE (ne pas empiler a l'aveugle)
npx ruflo memory get -k "megga/megga-ai-persona" -n megga          # client = la vitrine, vouvoiement, TOUJOURS valide
npx ruflo memory get -k "megga/ai-guardrails" -n megga             # jamais d'envoi client sans validation ; jamais de contournement
npx ruflo memory get -k "megga/whatsapp-agent-copilot" -n megga    # tiers, confirm, stashPending->executePending, VM-6 persistance
```
Re-consulter au début de chaque tâche. **Ne pas modifier le seed** avant la dernière tâche.

## Contraintes dures (non négociables)

- **DeepSeek-only** (la ré-rédaction passe par le MÊME chemin que le drafting existant — aucun nouvel appel modèle ajouté ici ; le cerveau ré-appelle l'outil).
- **Socle légal INTACT — c'est le point le plus sensible :** une correction ne raccourcit JAMAIS la validation. Le brouillon corrigé est **re-stashé en tier `confirm`** (même outil) et **re-soumis** ; rien ne part sans un « oui ». `canLeaveConfirm` reste `false` pour `send_client_message`/`send_client_email`. La note injectée au cerveau dit EXPLICITEMENT « il sera re-soumis à validation, jamais envoyé sans oui ». Une correction ne doit JAMAIS encoder un contournement de confirmation (cerveau `ai-guardrails`).
- **Périmètre des corrections = brouillons CLIENT uniquement** (`send_client_message`, `send_client_email`). Les autres tiers `confirm` (`update_pipeline`, `record_offer`, `open_kyc_case`, `send_listings`, `send_kyc_link`) gardent EXACTEMENT le comportement F18 actuel (set-aside). `send_listings` est exclu (sélection de biens formatée, pas de la prose à corriger en texte libre).
- **Dégradation propre :** si le cerveau juge que le message n'est PAS une correction (nouvelle demande), comportement actuel (il traite la demande). Si l'appel cerveau échoue, message d'échec honnête comme aujourd'hui. Sans `correctionContext`, le prompt du cerveau est **byte-identique** à aujourd'hui.
- **Persona** : la ré-rédaction passe par le cerveau → vouvoiement client, voix apprise, anti-fabrication, tout est déjà appliqué (PR #574/#577). Rien à re-câbler.
- **Pas de migration.** `npm run build` vert avant push. **Specs backend live en CI** (skipIf n'est pas un skip ; nettoyage `.then(()=>{},()=>{})`). Blocs agent-facing FR/EN.

## Périmètre

**FAIT (ce plan) :** (1) le cerveau `whatsapp-agent` accepte un `correctionContext` optionnel et, s'il est présent, reçoit une note l'invitant à ré-rédiger via le MÊME outil ; (2) `callAgentBrain` (webhook) propage `correctionContext` ; (3) la branche F18 du webhook, pour un brouillon client en attente, ré-engage le cerveau avec le brouillon d'origine (au lieu du set-aside) ; (4) un prédicat pur `isCorrectableDraft(tool)` + specs (socle + prédicat) ; (5) cerveau + PR.

**PAS fait (plus tard / YAGNI) :** capter explicitement le delta *(brouillon → correction)* dans un store dédié (le corpus de voix VM-6 capte déjà passivement le message corrigé envoyé — on ne sur-construit pas tant que le passif n'a pas montré ses limites) ; corrections sur `send_listings` ; observabilité `whatsapp_confirmation_log` outcome='corrected' (éviterait une migration de CHECK — hors périmètre).

---

## Carte d'archi (anchors vérifiés)

- `supabase/functions/whatsapp-webhook/index.ts` :
  - Gestion du pending (l. 336-379). Le pending est **lu** (336-340), puis **DELETE-gagnant-unique** (348-350), puis le `switch` sur `decision = parseConfirmation(userText)` (343) : `yes` (351-358) → `executePending` ; `no` (359-366) → annulé ; `!valid` (367-368) → expiré ; **`else` = F18 (369-374)** → `callAgentBrain` + préfixe `t(lang,'setAside')`. **`pendingAction` (avec `.tool` et `.args`) reste en scope dans le `else`** même après le DELETE — c'est de là qu'on tire le brouillon d'origine.
  - `callAgentBrain(agentLink, msg, messageText, lang)` (l. 426-...) : POST vers `…/functions/v1/whatsapp-agent` avec `{ profileId, waNumber, message, currentMessageId, inboundMedia }`, renvoie `{ reply, isError }`.
  - VM-6 (déjà livré) : `executePending` persiste le message client envoyé dans `whatsapp_messages` → corpus de voix.
- `supabase/functions/whatsapp-agent/index.ts` :
  - Parse du body (l. ~64-66) : `{ profileId, waNumber, message, currentMessageId, inboundMedia }`.
  - Message système (l. ~121) : template qui finit par `...Ne mélange pas les langues.${styleBlock}${voiceBlock}` (PR #577). C'est là qu'on appendra `${correctionNote}`.
  - Boucle d'outils + tier `confirm` (l. ~172-193) : un outil `confirm` (dont `send_client_message`/`send_client_email`) NON auto → `stashPending` → renvoie le prompt de confirmation. Donc si le cerveau ré-appelle l'outil, on retombe AUTOMATIQUEMENT sur stash + re-confirmation. `stashPending` (l. ~316-376) : garde F2 « busy » — sans pending existant (on l'a DELETE au webhook), pas de conflit.
- `supabase/functions/_shared/whatsapp-agent-router.ts` : `parseConfirmation` (yes/no/none, l. ~176-182), `isUndoCommand`, `toolTier`, `canLeaveConfirm` (l. ~60-62, `=== 'update_pipeline'`). On y ajoute le prédicat pur `isCorrectableDraft`.

---

## File Structure

**Modifier :**
- `supabase/functions/whatsapp-agent/index.ts` — accepter `correctionContext` + injecter `correctionNote` (Task 1).
- `supabase/functions/_shared/whatsapp-agent-router.ts` — `isCorrectableDraft(tool)` pur (Task 2).
- `supabase/functions/_shared/whatsapp-agent-router.test.ts` — tests de `isCorrectableDraft` (Task 2).
- `supabase/functions/whatsapp-webhook/index.ts` — `callAgentBrain` propage `correctionContext` + branche F18 ré-engage pour les brouillons client (Task 3).

**Créer :**
- `tests/backend/whatsapp-corrections-inline.spec.ts` — spec socle + prédicat (Task 4).

**Contrat (défini une fois) :**
```ts
type CorrectionContext = { tool: string; draft: string }  // l'outil + le texte du brouillon d'origine
```

---

## Task 1 : Le cerveau accepte `correctionContext` et ré-rédige via le même outil

**Files:** Modify `supabase/functions/whatsapp-agent/index.ts`

- [ ] **Step 1 : Élargir le parse du body.** Là où le body est destructuré (l. ~64-66, actuellement `{ profileId, waNumber = '', message, currentMessageId, inboundMedia }`), ajouter `correctionContext` :
```ts
  let body: { profileId?: string; waNumber?: string; message?: string; currentMessageId?: string; inboundMedia?: { mediaId: string; messageId: string } | null; correctionContext?: { tool: string; draft: string } | null }
  // ...le JSON.parse existant...
  const { profileId, waNumber = '', message, currentMessageId, inboundMedia, correctionContext } = body
```
(Adapter au type exact déjà présent — ajouter le champ optionnel `correctionContext` à l'interface inline ET à la destructuration, sans rien retirer.)

- [ ] **Step 2 : Calculer `correctionNote`** juste après le calcul de `voiceBlock` (PR #577, ~l. 97-106) :
```ts
  // Phase 2 — correction en ligne : si l'agent corrige un brouillon client en attente, le webhook
  // re-passe le brouillon d'origine ici. On invite le cerveau à RE-REDIGER via le MÊME outil
  // (re-soumis à validation — jamais envoyé sans « oui »). Vide sinon → prompt inchangé.
  const correctionNote = (correctionContext && (correctionContext.tool === 'send_client_message' || correctionContext.tool === 'send_client_email'))
    ? (lang === 'en'
        ? `\n\nYou had just proposed this client draft for validation (tool ${correctionContext.tool}): « ${String(correctionContext.draft).slice(0, 600)} ». If the agent's message is a CORRECTION of that draft, call the SAME tool (${correctionContext.tool}) again with the corrected draft — it will be re-submitted for validation, never sent without a « yes ». If it is an unrelated request, handle it normally.`
        : `\n\nTu venais de proposer ce brouillon client à validation (outil ${correctionContext.tool}) : « ${String(correctionContext.draft).slice(0, 600)} ». Si le message de l'agent est une CORRECTION de ce brouillon, ré-appelle le MÊME outil (${correctionContext.tool}) avec le brouillon corrigé — il sera re-soumis à validation, jamais envoyé sans « oui ». Si c'est une demande sans rapport, traite-la normalement.`)
    : ''
```

- [ ] **Step 3 : Appender `${correctionNote}`** au message système (l. ~121), juste après `${voiceBlock}` (donc après SYSTEM/persona/date/langue/style/voix — jamais avant) :
```ts
    { role: 'system', content: `${SYSTEM}\n\nDate/heure actuelles (Europe/Zurich) : ${nowZurich}. Convertis toute date relative en ISO 8601 avec le décalage de Genève (+02:00 en été, +01:00 en hiver).\n\nLangue : réponds TOUJOURS dans la langue du dernier message de l'agent (français ou anglais). Ne mélange pas les langues.${styleBlock}${voiceBlock}${correctionNote}` },
```

- [ ] **Step 4 : Vérifier** `deno check supabase/functions/whatsapp-agent/index.ts` → 0 erreur. Confirmer : sans `correctionContext`, `correctionNote=''` → prompt byte-identique ; la note dit explicitement « re-soumis à validation, jamais sans oui » (socle) ; elle ne s'active que pour les 2 outils client.

- [ ] **Step 5 : Commit**
```bash
git add supabase/functions/whatsapp-agent/index.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(corrections): le cerveau ré-rédige un brouillon client sur correction (re-soumis à validation)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2 : Prédicat pur `isCorrectableDraft` (TDD)

> Centralise « quels outils en attente acceptent une correction en ligne » — pour que le webhook et les tests partagent UNE source de vérité, et que le socle soit testable.

**Files:** Modify `supabase/functions/_shared/whatsapp-agent-router.ts` + `whatsapp-agent-router.test.ts`

- [ ] **Step 1 : Test (échoue)** — AJOUTER à `whatsapp-agent-router.test.ts` (élargir l'import en tête pour inclure `isCorrectableDraft`) :
```ts
describe('isCorrectableDraft — corrections en ligne (Phase 2, brouillons client seulement)', () => {
  it('vrai pour les brouillons client', () => {
    expect(isCorrectableDraft('send_client_message')).toBe(true)
    expect(isCorrectableDraft('send_client_email')).toBe(true)
  })
  it('faux pour tout le reste (autres confirm inclus — pas de correction en ligne)', () => {
    for (const t of ['send_listings', 'update_pipeline', 'record_offer', 'open_kyc_case', 'send_kyc_link', 'create_contact', 'inconnu']) {
      expect(isCorrectableDraft(t)).toBe(false)
    }
  })
})
```

- [ ] **Step 2 : Run → FAIL.** `npx vitest run supabase/functions/_shared/whatsapp-agent-router.test.ts`.

- [ ] **Step 3 : Implémenter** dans `whatsapp-agent-router.ts` (près de `canLeaveConfirm`) :
```ts
// Phase 2 — corrections en ligne : SEULS les brouillons CLIENT en prose (message/email) peuvent être
// corrigés en texte libre (« non, plutôt… ») → ré-rédigés + re-soumis à validation. Les autres tiers
// confirm (pipeline/offre/kyc/listings) gardent le comportement « set-aside ». Source unique partagée
// par le webhook (branche F18) et les tests. N'élargit JAMAIS le socle : la ré-rédaction reste confirm.
export function isCorrectableDraft(tool: string): boolean {
  return tool === 'send_client_message' || tool === 'send_client_email'
}
```

- [ ] **Step 4 : Run → PASS.** `npx vitest run supabase/functions/_shared/whatsapp-agent-router.test.ts`. Puis `deno check supabase/functions/_shared/whatsapp-agent-router.ts`.

- [ ] **Step 5 : Commit**
```bash
git add supabase/functions/_shared/whatsapp-agent-router.ts supabase/functions/_shared/whatsapp-agent-router.test.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(corrections): prédicat pur isCorrectableDraft (brouillons client seulement, TDD)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3 : Le webhook ré-engage le cerveau sur correction (branche F18)

**Files:** Modify `supabase/functions/whatsapp-webhook/index.ts`

- [ ] **Step 1 : Importer `isCorrectableDraft`.** Élargir l'import depuis `../_shared/whatsapp-agent-router.ts` (qui importe déjà `parseConfirmation`, `isPendingActionValid`, etc.) pour inclure `isCorrectableDraft`.

- [ ] **Step 2 : Étendre `callAgentBrain`** (l. ~426) avec un 5ᵉ paramètre optionnel et le propager dans le POST :
```ts
async function callAgentBrain(
  agentLink: { profile_id: string; agency_id: string | null },
  msg: { fromPhone: string; body: string | null; providerMessageId: string; mediaId: string | null; mediaType: string | null },
  messageText: string,
  lang: WaLang,
  correctionContext?: { tool: string; draft: string } | null,
): Promise<{ reply: string; isError: boolean }> {
```
Et dans le `body: JSON.stringify({ ... })` du fetch, ajouter `correctionContext: correctionContext ?? null,` (après `inboundMedia`). Rien d'autre ne change dans la fonction.

- [ ] **Step 3 : Brancher la F18 sur les brouillons client.** Dans le `else` (l. ~369-374), remplacer :
```ts
    } else {
      // F18 : message non lié alors qu'une action attendait → on l'écarte et on le DIT.
      const brain = await callAgentBrain(agentLink, msg, userText, lang)
      reply = `${t(lang, 'setAside')}\n\n${brain.reply}`
      replyIsError = brain.isError
    }
```
par :
```ts
    } else if (isCorrectableDraft(pendingAction.tool as string)) {
      // Phase 2 — correction en ligne : pour un brouillon CLIENT en attente, un message qui n'est ni
      // « oui » ni « non » est probablement une correction (« non, plutôt… »). On NE jette PAS le
      // brouillon : on ré-engage le cerveau en lui passant le brouillon d'origine. Il ré-rédige via le
      // MÊME outil (→ stashPending → RE-CONFIRMATION) si c'est une correction, sinon il traite la
      // demande normalement. Pas de préfixe « mis de côté » : on poursuit le brouillon. Socle intact
      // (le brouillon corrigé est re-soumis à validation, jamais envoyé sans « oui »).
      const a = pendingAction.args as Record<string, unknown>
      const draft = pendingAction.tool === 'send_client_email'
        ? `Objet : ${String(a.subject ?? '')}\n\n${String(a.body ?? '')}`
        : String(a.body ?? '')
      const brain = await callAgentBrain(agentLink, msg, userText, lang, { tool: pendingAction.tool as string, draft })
      reply = brain.reply
      replyIsError = brain.isError
    } else {
      // F18 : message non lié alors qu'une action (non-brouillon-client) attendait → on l'écarte et on le DIT.
      const brain = await callAgentBrain(agentLink, msg, userText, lang)
      reply = `${t(lang, 'setAside')}\n\n${brain.reply}`
      replyIsError = brain.isError
    }
```
> Note : le pending a déjà été DELETE (l. 348-350) avant ce point — donc quand le cerveau ré-appelle l'outil, `stashPending` ne voit pas d'attente existante (garde F2 « busy » non déclenchée) et stashe proprement le brouillon corrigé. Le brouillon d'origine vient de `pendingAction.args` (toujours en scope).

- [ ] **Step 4 : Vérifier** `deno check supabase/functions/whatsapp-webhook/index.ts` → 0 erreur. Relire : (a) les branches `yes`/`no`/`!valid` sont INCHANGÉES ; (b) seuls les brouillons client passent par le nouveau chemin (les autres tiers confirm gardent le set-aside) ; (c) aucune action n'est envoyée ici — on ne fait que ré-rédiger + re-stash via le cerveau (envoi seulement au prochain « oui » via `executePending`) ; (d) `correctionContext` propagé.

- [ ] **Step 5 : Commit**
```bash
git add supabase/functions/whatsapp-webhook/index.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(corrections): le webhook ré-engage le cerveau sur correction d'un brouillon client (F18)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4 : Spec live + build + cerveau + PR

**Files:** Create `tests/backend/whatsapp-corrections-inline.spec.ts`

- [ ] **Step 1 : Spec** — la quasi-totalité de Phase 2 est du comportement LLM (le cerveau décide « correction vs demande »), non déterministe → on teste les **invariants déterministes** (pas le LLM). Mirror `tests/backend/whatsapp-assisted-outbound.spec.ts` (imports purs du router). Couvrir, dans un `describe` SANS skipIf (toujours exécuté) :
```ts
import { describe, it, expect } from 'vitest'
import { isCorrectableDraft, canLeaveConfirm, toolTier } from '../../supabase/functions/_shared/whatsapp-agent-router'

describe('corrections en ligne — invariants socle (Phase 2)', () => {
  it('seuls les brouillons client sont corrigeables en ligne', () => {
    expect(isCorrectableDraft('send_client_message')).toBe(true)
    expect(isCorrectableDraft('send_client_email')).toBe(true)
    expect(isCorrectableDraft('send_listings')).toBe(false)
    expect(isCorrectableDraft('update_pipeline')).toBe(false)
  })
  it('SOCLE : une correction ne sort jamais du tier confirm (le brouillon corrigé est re-validé)', () => {
    // les outils corrigeables restent confirm + ne peuvent jamais passer en auto
    for (const t of ['send_client_message', 'send_client_email']) {
      expect(toolTier(t)).toBe('confirm')
      expect(canLeaveConfirm(t)).toBe(false)
    }
  })
})
```
> (La logique de ré-rédaction elle-même = comportement DeepSeek + flux stash/confirm existant, couvert par la conception WYSIWYG/socle + validation manuelle en staging, pas par un test unitaire. Citer en commentaire.)

- [ ] **Step 2 : Build & tests** — `npm run build` vert ; `npx vitest run` vert (dont les nouveaux tests de `isCorrectableDraft` dans `whatsapp-agent-router.test.ts`) ; `npx vitest run --config=vitest.backend.config.ts tests/backend/whatsapp-corrections-inline.spec.ts` (collecte propre, le `describe` socle passe sans clés). `deno check` sur les 3 edge functions touchées (`whatsapp-agent/index.ts`, `whatsapp-webhook/index.ts`, `_shared/whatsapp-agent-router.ts`).

- [ ] **Step 3 : Cerveau** :
- `megga/megga-ai-agent-learning` : **CORRECTIONS EN LIGNE (Phase 2) LIVRE** : quand l'agent corrige un brouillon client en attente (au lieu de oui/non), MEGGA ré-rédige via le MÊME outil (re-soumis à validation, socle intact) au lieu de jeter le brouillon ; la boucle se ferme car le message corrigé valide alimente le corpus de voix (VM-6). Approche PAR L'EXEMPLE (remplace la Phase 2 « enums » gelee). Detection « correction vs demande » deleguee au cerveau (note injectee), prédicat pur isCorrectableDraft (client only). Pas de store de delta (le passif VM-6 suffit en v1).
- `megga/whatsapp-agent-copilot` : la branche F18 du webhook ré-engage le cerveau avec le brouillon d'origine pour les brouillons client (`send_client_message`/`send_client_email`) ; `callAgentBrain` propage un `correctionContext`.
Puis `npm run ruflo:seed` ; valider le JSON.

- [ ] **Step 4 : Commit + PR** vers `main`. Pas de migration → pas de date-gate. NE PAS merger sans accord humain (CI verte d'abord). Le contrôleur ouvre la PR et confirme quand c'est vert.
```bash
git add tests/backend/whatsapp-corrections-inline.spec.ts .claude-flow/knowledge/megga-memory.seed.json
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "test(corrections): invariants socle Phase 2 ; cerveau corrections en ligne

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (vérifié contre la spec/les contraintes)

- ✅ Ferme la boucle : correction → ré-rédaction (même outil) → re-confirmation → envoi → corpus de voix (VM-6). PAR L'EXEMPLE, pas par enums.
- ✅ Socle légal INTACT : le brouillon corrigé est re-stashé en `confirm` et re-soumis ; `canLeaveConfirm` inchangé ; la note injectée dit « jamais sans oui » ; testé (Task 4). Aucune action envoyée dans la branche F18.
- ✅ Réutilisation totale : le cerveau ré-rédige via son outil existant → stashPending + voix + persona + confirm déjà câblés. Aucune nouvelle fonction de rédaction, aucune duplication de stash, aucun nouveau store, aucune migration.
- ✅ Périmètre serré : brouillons CLIENT uniquement (`isCorrectableDraft`) ; les autres tiers confirm gardent le set-aside.
- ✅ Dégradation propre : sans `correctionContext`, prompt byte-identique ; si le cerveau juge « pas une correction », comportement actuel ; échec cerveau → message honnête.
- ✅ DeepSeek-only ; pas de PII nouvelle (le brouillon d'origine est déjà dans le flux). i18n FR/EN (note + tout passe par le cerveau bilingue).
- ✅ GATE respecté : EXÉCUTER seulement après validation réelle de la fondation (voix PR #577).

**Cohérence des noms :** `correctionContext` (body + callAgentBrain) ↔ `correctionNote` (prompt cerveau) ↔ `isCorrectableDraft` (prédicat router + webhook + tests).

---

## Exécution

Session FRAÎCHE, **subagent-driven** : un sous-agent par tâche + revue conformité-puis-qualité. Consulter le cerveau au début de chaque tâche. Mettre le cerveau à jour à la Task 4. **Exécuter seulement après le check réel de la fondation (voix).** Attention de revue : (1) SOCLE — le brouillon corrigé repasse bien par stash→confirm, rien n'est envoyé dans F18 ; (2) périmètre — seuls `send_client_message`/`send_client_email` ; les autres tiers confirm inchangés ; (3) cold-start — sans `correctionContext`, prompt cerveau byte-identique ; (4) DeepSeek-only ; (5) la note injectée n'autorise jamais un envoi sans « oui ».
