# Génération de documents — v1 (fondation) : descriptif d'annonce marketing (contenu rédigé, 2 variantes, sur WhatsApp)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (un sous-agent par tâche + les DEUX revues : conformité spec, puis qualité de code). Étapes en cases à cocher (`- [ ]`). Session FRAÎCHE : ce plan est autonome.

> ⚠️ **CADRAGE HONNÊTE — lire d'abord.** v1 livre le **CONTENU rédigé** d'une annonce immobilière (titre marketing + description bilingue FR/EN + grille de détails), ancré sur les **vraies données** du bien + la **voix de l'agence**, rendu à l'agent dans son **1:1 WhatsApp**. La **plaquette PDF mise en page** (couverture, galerie photos, gabarit pdf-lib), le **canal CRM web** (bouton sur la fiche bien) et le **visuel marketing** (Gemini) = **Phase 2/3, HORS périmètre**. v1 = un outil **read-tier** de plus : rien n'est envoyé au client, l'agent récupère le contenu et l'utilise. v1 est conçu pour que la plaquette PDF (Phase 2) ne soit qu'un assemblage de ce contenu + les photos.
>
> **Pourquoi le contenu d'abord :** les 6 biens du CRM n'ont aujourd'hui **aucune photo** (audit 4 juin 2026) → le PDF/galerie n'aurait rien à afficher. Le contenu (titre + description) est le **cœur IA/voix** et le plus chronophage pour l'agent. On le livre seul, proprement, puis le PDF se branche dessus.

**Goal :** dans son fil 1:1 MEGGA, l'agent demande « rédige l'annonce du <bien> ». MEGGA **résout le bien** dans les mandats de l'agence, puis rend : (1) un **titre marketing**, (2) une **description bilingue FR/EN**, (3) une **grille de détails** remplie depuis les vraies données — en **2 variantes** : **confidentielle** (sans coordonnées ni adresse exacte) ou **publique** (+ agence/agent). Si l'agent ne précise pas la variante, **MEGGA la demande**. Read-tier, rendu à l'agent, jamais envoyé au client.

**Architecture (réutilisation) :** 1 nouvel outil LECTURE `draft_listing_copy` + une consigne « annonce » dans le system prompt. **Partage du travail IA/code (anti-fabrication) :** la **grille est construite en CODE** (déterministe : colonnes + tags `features`) ; **DeepSeek ne rédige que le titre + la description bilingue** (le créatif, ancré + voix). Rédaction = clone du pattern `prepareSendClientEmail` (DeepSeek `json_object` + `formatStyleBlock`/`formatVoiceExamples` + try/catch honnête). Résolution du bien = nouvelle requête `properties` scopée agence (`search_listings` cible `market_listings`/Flatfox, PAS les mandats de l'agence). Never-throw + garde objet JSON (comme les lames groupe). **Aucune migration, aucun envoi nouveau, socle intact.**

**Tech Stack :** Supabase Edge (Deno/TS), DeepSeek (`deepseek-chat`, JAMAIS Claude). Réutilise la voix (`agent-style.ts`), le framework d'outils (`WHATSAPP_TOOLS` + tiers + `runTool`), le pattern DeepSeek de `prepareSendClientEmail`. Pas de migration → pas de date-gate.

---

## Avant de commencer — consulter le cerveau

```bash
npx ruflo memory search -q "whatsapp draft_listing_copy descriptif annonce marketing voix agence variante confidentielle publique properties features socle read-tier" -n megga
npx ruflo memory get -k "megga/whatsapp-agent-copilot" -n megga   # tiers read/auto/confirm ; runTool ; voix ; 26 outils
npx ruflo memory get -k "megga/megga-ai-persona" -n megga         # ton, à titre indicatif, pas d'ids bruts
npx ruflo memory get -k "megga/ai-guardrails" -n megga            # jamais d'envoi client sans validation ; pas de fabrication
```
Re-consulter au début de chaque tâche. **Ne pas modifier le seed** avant la dernière tâche.

## Contraintes dures (non négociables)

- **DeepSeek-only** (`deepseek-chat`). JAMAIS Claude/OpenAI.
- **Socle INTACT :** `draft_listing_copy` est **read-tier** (résultat rendu à l'agent dans son 1:1 ; l'agent utilise le contenu). On ne touche aucun tier `confirm`, aucun `canLeaveConfirm`, aucun envoi client.
- **Pas de fabrication :** titre/description/grille ancrés sur les **DONNÉES RÉELLES** du bien. Un champ absent → **« à compléter »** (FR) / **« to be confirmed »** (EN), JAMAIS inventé. La **grille est construite en CODE** (pas par DeepSeek) → zéro chiffre inventé. DeepSeek rédige le titre + la description **uniquement à partir des données fournies** (consigne stricte : n'évoque que des éléments présents ; pas de superlatif mensonger ; pas de donnée marché inventée).
- **Confidentialité :** la variante **confidentielle** masque l'**adresse exacte** (quartier/canton seulement) et n'inclut **aucune coordonnée ni identité** agence/agent. La **publique** ajoute le bloc agence (nom, tél, email, site) + l'agent. (Cohérent avec la sensibilité confidentialité déjà posée : `check_group_leak`.)
- **Variante demandée :** si l'agent ne précise pas `variant`, l'outil renvoie une **demande** (« confidentielle ou publique ? ») et le system prompt guide MEGGA à demander AVANT d'appeler — jamais deviner.
- **Voix de l'agence :** `formatStyleBlock` + `formatVoiceExamples` appliqués au ton (cadre « annonce de l'agence », pas message client).
- **Never-throw :** l'exécuteur read renvoie TOUJOURS une string (runTool n'a pas de try/catch) ; garde objet sur le parse JSON DeepSeek.
- **Pas de migration.** `npm run build` vert avant push. **Specs backend live en CI** (skipIf n'est pas un skip ; nettoyage `.then(()=>{},()=>{})`). Blocs agent-facing FR/EN.

## Périmètre

**FAIT (ce plan, v1) :** (1) `draft_listing_copy` (read) — résout un bien `properties` de l'agence, construit la grille en code, fait rédiger titre + description bilingue par DeepSeek (ancré + voix), assemble, 2 variantes (confidentielle/publique), demande la variante si absente ; (2) consigne system « annonce » ; (3) specs + cerveau + PR.

**PAS fait (Phase 2/3) :** la **plaquette PDF** mise en page (couverture/galerie/gabarit pdf-lib, réutilise `audit-pdf-export`/`kyc-report-pdf`) ; le **canal CRM web** (bouton « Générer la plaquette » sur la fiche bien, preview/édition) ; le **visuel marketing** (étendre `virtual-staging`/Gemini) ; la **persistance** dans la table `documents` ; l'**e-signature**. Notés, hors périmètre.

---

## Carte d'archi (anchors vérifiés — 4 juin 2026)

- `supabase/functions/_shared/whatsapp-tools.ts` : `WHATSAPP_TOOLS` (l.15 ; **26 outils**). Forme d'un outil read : `search_listings` (l.248). On y ajoute **1 déf**.
- `supabase/functions/_shared/whatsapp-agent-router.ts` : `TOOL_TIERS` (l.21-54), `toolTier()`. On classe `draft_listing_copy` en `read`.
- `supabase/functions/_shared/whatsapp-agent-router.test.ts` : assertions de tier (ajouter le nouvel outil).
- `supabase/functions/_shared/whatsapp-actions.ts` : `ActionCtx` (l.26), `type Args` (l.35), `s()` (l.36), `NO_AGENCY` + `hasAgency` (l.39-42). **Clone rédaction :** `prepareSendClientEmail` (l.~1197-1323 : récup contact scopé agence → `formatStyleBlock`/`formatVoiceExamples` → fetch DeepSeek `json_object` `temperature:0.3` `AbortSignal.timeout(15000)` → try/catch honnête). **Clone never-throw + garde objet JSON :** `execSummarizeGroupThread` / `execCheckGroupLeak` (fin de fichier). **Modèle résolution scopée agence :** `.from('properties').select(...).eq('agency_id', ctx.agencyId)` (déjà utilisé l.281, 504, 689).
- `supabase/functions/whatsapp-agent/index.ts` : `runTool` switch (cases + import) ; system prompt assemblé `…${styleBlock}${voiceBlock}${groupBlock}` (l.~139) → on appendra une consigne `listingBlock`.
- `supabase/functions/_shared/agent-style.ts` : `formatVoiceExamples` (l.13), `fetchClientVoiceSamples` (l.33), `formatStyleBlock` (l.62), `type LearnedStyle`.
- **Données réelles (`properties`, scopé `agency_id`, `deleted_at IS NULL`) :** `title, type, status, price, currency, transaction_type, rooms, bedrooms, bathrooms, surface_m2, address, city, canton, postal_code, year_built, floor, total_floors, charges_monthly, energy_class, energy_label, minergie_label, is_furnished, availability_date, deposit_months, mandate_type, features (jsonb = ARRAY de tags FR ex ["Balcon","Parking","Piscine","Vue lac"]), photos (text[])`. **Agence (variante publique) :** `agencies (name, logo_url, address, phone, email, website, city, canton)` ; agent via `profiles.full_name` (`ctx.profileId`).

---

## File Structure

**Modifier :**
- `supabase/functions/_shared/whatsapp-tools.ts` — déf `draft_listing_copy` (Task 1).
- `supabase/functions/_shared/whatsapp-agent-router.ts` — tier `read` (Task 1).
- `supabase/functions/_shared/whatsapp-agent-router.test.ts` — assertion tier (Task 1).
- `supabase/functions/_shared/whatsapp-actions.ts` — `execDraftListingCopy` (Task 2).
- `supabase/functions/whatsapp-agent/index.ts` — `runTool` case + import + consigne `listingBlock` (Task 2, 3).
- `tests/backend/whatsapp-listing-copy.spec.ts` — invariants (Task 4).

**Contrats (définis une fois) :**
```ts
// L'outil renvoie une string (réinjectée role:'tool'), comme tous les exécuteurs read.
// La grille est construite EN CODE ; DeepSeek ne rend que { titre, description_fr, description_en }.
// variant ∈ { 'confidential', 'public' } ; absent → demande (jamais deviner).
```

---

## Task 1 : Outil `draft_listing_copy` (déf + tier read)

> L'agent demande de rédiger l'annonce d'un de ses biens. Read-tier (rien envoyé). MEGGA demande la variante si absente.

**Files:** `whatsapp-tools.ts`, `whatsapp-agent-router.ts`, `whatsapp-agent-router.test.ts`

- [ ] **Step 1 — Déf outil** dans `WHATSAPP_TOOLS` (double quotes pour les descriptions, comme le fichier) :
```ts
{ type: 'function', function: { name: 'draft_listing_copy',
  description: "Rédige le CONTENU d'une annonce immobilière (titre marketing + description bilingue FR/EN + grille de détails) pour un bien des mandats de l'agence, à partir de ses VRAIES données. Deux variantes : 'confidential' (sans coordonnées ni adresse exacte) ou 'public' (avec l'agence + l'agent). Si la variante n'est pas précisée, DEMANDE-la avant d'appeler. Pour « rédige l'annonce du 3 pièces de Champel », « fais le descriptif du bien X ». NE l'envoie pas au client — c'est pour l'agent.",
  parameters: { type: 'object', properties: {
    query: { type: 'string', description: "Nom / adresse / référence du bien à mettre en annonce (cherché dans les mandats de l'agence)" },
    variant: { type: 'string', enum: ['confidential', 'public'], description: "confidential = sans coordonnées ni adresse exacte ; public = avec l'agence et l'agent. Demander à l'agent si non précisé." },
  }, required: ['query'] } } }
```
- [ ] **Step 2 — Tier** dans `TOOL_TIERS` : `draft_listing_copy: 'read',` (commentaire : rédige un brouillon agent-facing, rien d'envoyé).
- [ ] **Step 3 — Test router** : ajouter dans `whatsapp-agent-router.test.ts` (bloc `describe('toolTier')`) une assertion `toolTier('draft_listing_copy') === 'read'`.
- [ ] **Step 4 :** `deno check` les fichiers touchés. Commit `feat(docgen): outil draft_listing_copy (déf + tier read)`.

---

## Task 2 : Exécuteur `execDraftListingCopy` (résolution bien + grille en code + rédaction DeepSeek + variantes + voix)

**Files:** `whatsapp-actions.ts`, `whatsapp-agent/index.ts`

- [ ] **Step 1 — Exécuteur** `execDraftListingCopy(ctx, a): Promise<string>` à la fin de `whatsapp-actions.ts` :
  1. `const lang = ctx.lang ?? 'fr'`. **`if (!hasAgency(ctx)) return NO_AGENCY`** (ici on accède à la DB scopée agence — garde requise, contrairement aux lames groupe).
  2. `const query = s(a.query)` ; vide → demander quel bien.
  3. `const variant = a.variant === 'public' ? 'public' : a.variant === 'confidential' ? 'confidential' : null` ; **si `null` → return** « Tu veux la version confidentielle (sans coordonnées ni adresse exacte) ou publique (avec l'agence) ? » (FR/EN). Ne jamais deviner.
  4. **Résoudre le bien** : `.from('properties').select(<champs>).eq('agency_id', ctx.agencyId).is('deleted_at', null).or('title.ilike.%query%,address.ilike.%query%').limit(5)`. 0 → « Je ne trouve pas ce bien dans tes mandats. » ; ≥2 → lister (titre + ville) et demander de préciser ; 1 → continuer. (Échapper `%`/`,` de `query` ; borne longueur.)
  5. **Grille EN CODE (déterministe, anti-fabrication)** : construire un tableau `details: {label_fr, label_en, value}[]` depuis les colonnes (type, pièces/chambres, SDB, surface habitable, étage, année, charges, énergie, meublé, dispo, dépôt, prix+devise) et les **tags `features`** (présence → OUI : Piscine, Terrasse, Balcon, Parking/Garage, Ascenseur, Cave, Jardin, Vue/Vue lac → « Vue dégagée », Buanderie…). Champ absent ⇒ **omis** ou marqué « à compléter » selon ce que veut l'exemple — JAMAIS inventé. Référence = dérivée de l'`id` (ex. 8 premiers caractères en MAJ), pas de migration.
  6. **Variante** : `confidential` → titre/description sans adresse exacte (quartier/canton seulement), aucun bloc agence ; `public` → récupérer `agencies` (nom, tél, email, site, logo_url) + `profiles.full_name(ctx.profileId)` pour un **bloc contact** (construit en code).
  7. **Rédaction DeepSeek (titre + description bilingue uniquement)** : `apiKey` check (absent → message honnête). Clone `prepareSendClientEmail` : `formatStyleBlock` + `formatVoiceExamples` injectés, fetch `deepseek-chat` `response_format:{type:'json_object'}` `temperature:0.3` `max_tokens:900` `AbortSignal.timeout(15000)`. Prompt : « Tu rédiges le CONTENU d'une annonce immobilière suisse pour l'agence (pas un message à un client). À partir UNIQUEMENT des données fournies (n'invente RIEN ; n'évoque aucun élément absent ; pas de chiffre marché). Rends `{"titre":"…","description_fr":"…","description_en":"…"}`. Titre court et percutant (style « ATTIQUE D'EXCEPTION À LOUER À CHAMPEL »). Description élégante, sobre, suisse, 2-4 paragraphes. [variant=confidential → ne mentionne PAS l'adresse exacte, seulement le quartier]. » + les données du bien (et le quartier/canton).
  8. **Never-throw + garde objet JSON** : try/catch comme les lames groupe ; non-2xx / timeout / JSON non-objet → message honnête (« je n'ai pas réussi à rédiger l'annonce, réessaie »). Extraire `titre`/`description_fr`/`description_en` avec type-guards ; si titre+desc vides → message honnête.
  9. **Assembler (code)** la string finale FR/EN : `*<titre>*` + description FR + description EN + `*Détails*` (grille `- label : value`) + (public) `*Contact*` (agence + agent). Retour string.
- [ ] **Step 2 — Dispatch** : `case 'draft_listing_copy': return execDraftListingCopy(ctx, args)` dans `runTool` + import dans `whatsapp-agent/index.ts`.
- [ ] **Step 3 :** `deno check`. Commit `feat(docgen): exécuteur execDraftListingCopy (grille en code, rédaction DeepSeek ancrée + voix, 2 variantes)`.

---

## Task 3 : Consigne « annonce » dans le system prompt

> Guider MEGGA à demander la variante, à ne rien inventer, et à rappeler que c'est un contenu pour l'agent (pas un envoi client).

**Files:** `whatsapp-agent/index.ts`

- [ ] **Step 1 :** Après `${groupBlock}` dans le message système, appender une consigne `listingBlock` constante (FR/EN, toujours présente) :
```ts
const listingBlock = lang === 'en'
  ? `\n\nListing copy: when the agent asks you to write a property listing/ad (draft_listing_copy), ALWAYS ask whether they want the confidential version (no contact details, no exact address) or the public one (with the agency + agent) if they didn't say. Never invent data: only describe what the property record contains; a missing field is "to be confirmed", never made up; no market figures. You draft; the agent uses it. The confidential version never reveals the exact address.`
  : `\n\nDescriptif d'annonce : quand l'agent te demande de rédiger l'annonce d'un bien (draft_listing_copy), DEMANDE toujours s'il veut la version confidentielle (sans coordonnées, sans adresse exacte) ou publique (avec l'agence + l'agent) s'il ne l'a pas dit. N'invente jamais de donnée : décris seulement ce que contient la fiche du bien ; un champ manquant = « à compléter », jamais inventé ; aucun chiffre marché. Tu rédiges ; l'agent l'utilise. La version confidentielle ne révèle jamais l'adresse exacte.`
```
et `…${styleBlock}${voiceBlock}${groupBlock}${listingBlock}`.
- [ ] **Step 2 :** `deno check`. Vérifier : la consigne vient APRÈS le socle/persona/voix ; n'autorise aucun envoi ; rappelle la demande de variante + l'anti-fabrication. Commit `feat(docgen): consigne « descriptif d'annonce » (demande variante, anti-fabrication, jamais d'envoi)`.

---

## Task 4 : Specs + build + cerveau + PR

**Files:** Create `tests/backend/whatsapp-listing-copy.spec.ts`

- [ ] **Step 1 — Specs** (mirror `tests/backend/whatsapp-group-copilot.spec.ts`, imports purs, SANS skipIf). Couvrir, SANS appeler DeepSeek :
  1. **Tier read** : `toolTier('draft_listing_copy') === 'read'`.
  2. **Socle intact** : `canLeaveConfirm('send_client_message') === false` ET `canLeaveConfirm('send_client_email') === false`.
  3. **Présence outil** : `draft_listing_copy` dans `WHATSAPP_TOOLS`, `required` = `['query']`, et `variant` déclare l'enum `['confidential','public']`.
- [ ] **Step 2 — Build & tests** : `npm run build` vert ; `npx vitest run` vert ; `npx vitest run --config=vitest.backend.config.ts tests/backend/whatsapp-listing-copy.spec.ts` (collecte propre) ; `deno check` sur les 4 edge functions touchées.
- [ ] **Step 3 — Cerveau** :
  - `megga/whatsapp-agent-copilot` : +1 outil read `draft_listing_copy` (N+1, **vérifier le compte réel**) ; consigne « descriptif d'annonce » (demande variante, grille en code anti-fabrication, 2 variantes, jamais d'envoi).
  - Nouvelle entrée (ou note) `megga/doc-generation` : v1 FONDATION livrée — descriptif d'annonce marketing (contenu rédigé : titre + description bilingue + grille en code, ancré données `properties` + voix, 2 variantes confidentielle/publique, demande la variante), agent-facing/read-tier/1:1 ; Phase 2/3 = plaquette PDF (pdf-lib) + canal CRM web + visuel Gemini + persistance `documents` + e-sign, hors périmètre.
  Puis `npm run ruflo:seed` ; valider le JSON.
- [ ] **Step 4 — Commit + PR** vers `main`. Pas de migration → pas de date-gate. NE PAS merger sans accord humain (CI verte). Le contrôleur ouvre la PR.

---

## Self-Review (vérifié contre la spec/les contraintes)

- ✅ Fondation : v1 ajoute la génération du CONTENU d'annonce (titre + description bilingue + grille) ancré sur les vraies données + voix ; la plaquette PDF / le CRM web / le visuel = Phase 2/3, honnêtement gated.
- ✅ Socle INTACT : `draft_listing_copy` est read-tier, agent-facing ; rien envoyé ; `canLeaveConfirm` inchangé (testé).
- ✅ Pas de bluff : grille construite EN CODE (zéro chiffre inventé) ; DeepSeek rédige titre+description à partir des seules données ; champ absent = « à compléter ».
- ✅ Confidentialité : variante confidentielle masque l'adresse exacte + aucune coordonnée ; variante demandée si non précisée.
- ✅ DeepSeek-only ; voix appliquée ; never-throw + garde objet JSON ; pas de migration.

**Cohérence des noms :** `draft_listing_copy` (outil read) ↔ `execDraftListingCopy` (exécuteur) ↔ `listingBlock` (consigne system) ↔ `variant ∈ {confidential, public}` ↔ Phase 2 (plaquette PDF, CRM web, visuel).

---

## Exécution

Session FRAÎCHE, **subagent-driven** : un sous-agent par tâche + revue conformité-puis-qualité. Consulter le cerveau au début de chaque tâche. Mettre le cerveau à jour à la Task 4. Attention de revue : (1) read-tier confirmé (rien d'envoyé, socle intact) ; (2) grille EN CODE (pas de fabrication par DeepSeek) ; (3) variante confidentielle ne révèle jamais l'adresse exacte ni de coordonnées ; (4) DeepSeek-only ; (5) never-throw (garde objet JSON) ; (6) variante demandée si absente.
