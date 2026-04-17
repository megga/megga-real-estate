# Plan d'implémentation — Intégration DeepSeek V3

**Date :** 2026-04-17
**Branche :** `claude/deepseek-megga-integration-Yx0n6`
**Spec source :** [docs/superpowers/specs/2026-04-16-deepseek-integration-design.md](../specs/2026-04-16-deepseek-integration-design.md)

---

## Contexte

MEGGA utilise aujourd'hui Claude Sonnet/Haiku pour toutes ses features IA, y compris côté public (marketplace `/acheter`, `/louer`, centre d'aide `/aide`). Les volumes publics sont élevés mais les tâches restent standards (recherche conversationnelle, FAQ, traductions d'annonces). DeepSeek V3 offre une qualité suffisante à ~4–10x moins cher.

**Objectif :** migrer uniquement les features publiques vers DeepSeek V3, garder Claude pour le côté agent (compliance, copilote, KYC, matching). Ajouter la traduction automatique des 33K+ annonces Flatfox (FR → DE/EN/IT). Exposer un widget de monitoring coûts + solde DeepSeek dans le Super-Admin.

**Économie cible :** ~$125/mois (~92 % de réduction sur ces 3 features).

**Stratégie traduction (mise à jour 2026-04-17) :** pour éviter de traduire inutilement 33K biens dont 80 % ne sont jamais consultés, on adopte une approche **lazy + cache par hash + templates pour les titres** — détails §6 et §7. Budget traduction réel estimé : **< $1/mois** au lieu de ~$5 one-shot + ~$3/mois au sync.

---

## Étape 1 — Migration Supabase (schéma)

**Fichier :** `supabase/migrations/20260417_001_deepseek_integration.sql` (nouveau)

Conventions existantes : `YYYYMMDD_NNN_slug.sql` (cf. `20260416_002_platform_metrics_cron.sql`).

- Créer `ai_usage_logs` (provider, tokens, coût, was_fallback) + 2 index + RLS super_admin.
- Créer `ai_balance_snapshots` (provider, balances USD) + index + RLS super_admin.
- Créer `translation_cache (content_hash TEXT, lang TEXT, translated_text TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (content_hash, lang))` — RLS : lecture publique (anon), insert service_role uniquement.

SQL `ai_usage_logs` + `ai_balance_snapshots` repris du spec §4. Les colonnes multilingues `title_de/en/it`/`description_de/en/it` sur `market_listings` **ne sont plus créées** — remplacées par le cache hash + templates (cf. §6/§7).

---

## Étape 2 — Helper partagé `_shared/ai-provider.ts`

**Fichier :** `supabase/functions/_shared/ai-provider.ts` (nouveau — pas de dossier `_shared/` aujourd'hui, à créer).

Exporte 3 fonctions :
- `callClaude(messages, systemPrompt, { model: 'sonnet'|'haiku', ... })`
- `callDeepSeek(messages, systemPrompt, options)` → POST `https://api.deepseek.com/v1/chat/completions`, body OpenAI-compatible
- `callPublicAI(messages, systemPrompt, options)` : DeepSeek avec timeout 8s + fallback Claude Haiku 4.5 en cas de 5xx / network / timeout

Après chaque appel :
1. Calcule `estimated_cost_usd` via table `PRICING` hardcodée (cf. spec §6.3).
2. INSERT fire-and-forget dans `ai_usage_logs` (non bloquant — ne pas `await` la promise, l'UX ne doit pas dépendre du log).
3. Si fallback déclenché → INSERT aussi dans `activity_events` avec `action='ai_fallback'`, `actor_id='ai'`.

Retourne `AIResponse { text, provider, input_tokens, output_tokens, estimated_cost_usd, was_fallback }`.

**Secret Supabase à créer :** `DEEPSEEK_API_KEY` (via dashboard, pas dans le code).

---

## Étape 3 — Edge Function `ai-billing-monitor`

**Fichier :** `supabase/functions/ai-billing-monitor/index.ts` (nouveau).

- Auth : accepte service_role (pour pg_cron) ou super_admin (appel manuel).
- `GET https://api.deepseek.com/user/balance` avec `Bearer DEEPSEEK_API_KEY`.
- Parse `balance_infos[0]` (USD).
- INSERT row dans `ai_balance_snapshots`.

**pg_cron :** nouveau fichier `supabase/migrations/20260417_002_ai_billing_cron.sql` — copier le pattern de `20260416_002_platform_metrics_cron.sql` (unschedule IF EXISTS, puis `cron.schedule('ai-billing-hourly', '30 * * * *', ...)` pour éviter collision avec `platform-metrics-hourly` à `:15`).

Ajouter `'ai-billing-monitor'` à `EDGE_FUNCTION_NAMES` dans [src/hooks/useAdminMonitoring.ts:36](../../../src/hooks/useAdminMonitoring.ts) pour qu'il apparaisse dans le monitoring générique.

---

## Étape 4 — Migration `ai-search` (public → DeepSeek)

**Fichier :** [supabase/functions/ai-search/index.ts](../../../supabase/functions/ai-search/index.ts)

- Ligne 168 : remplacer le `fetch('https://api.anthropic.com/v1/messages', ...)` par `await callPublicAI(messages, systemPrompt, { maxTokens: 1024 })`.
- Conserver le system prompt lignes 139–149 (règles anti-discrimination, prix, 10 tours max).
- Ligne 186 : remplacer `claudeData.content?.[0]?.text` par `result.text`.
- Ajouter `provider: result.provider` et `was_fallback: result.was_fallback` dans la réponse JSON pour debug.

---

## Étape 5 — Migration `support-chatbot` (public → DeepSeek)

**Fichier :** [supabase/functions/support-chatbot/index.ts](../../../supabase/functions/support-chatbot/index.ts)

- Ligne 92 : remplacer l'appel Claude Haiku par `await callPublicAI(messages, systemPrompt, { maxTokens: 500 })`.
- Conserver le parsing `SUGGESTED:[...]` / `ESCALATE:true` (lignes 122–134).
- Ajouter garde-fou défensif : si les tags manquent, retourner `suggestedArticles: []` et `shouldEscalate: false` (pas de crash).
- System prompt (lignes 26–59) inchangé — DeepSeek gère bien le FR/DE/EN/IT.

---

## Étape 6 — Titres multilingues par template (no-AI)

**Fichier :** `src/lib/listingTitle.ts` (nouveau) — fonction pure.

```ts
generateListingTitle(listing: { property_type, rooms, city, transaction_type }, lang: 'fr' | 'de' | 'en' | 'it'): string
```

- Mapping `property_type` → libellé dans chaque langue (`apartment` → `Appartement` / `Wohnung` / `Apartment` / `Appartamento`, idem pour `house`, `villa`, `commercial`, `office`, `parking`, `storage`, `land`).
- Mapping `transaction_type` → `à louer` / `zu vermieten` / `for rent` / `in affitto` (idem `à vendre`).
- Format : `{type} {rooms} pièces à {city} — {transaction}` (adapté à chaque langue).
- Les noms de ville gardent la graphie canton (Geneva/Genf/Genève/Ginevra → mapping explicite pour les 26 villes majeures ; sinon, garder tel quel).

Aucun appel IA. Remplace totalement la traduction des `title`. Couverture 100 % immédiate, zéro coût.

**Avantages :** précis (pas d'hallucination), instantané, pas de cache à gérer, identique qualité que les titres originaux Flatfox qui suivent déjà ce pattern.

---

## Étape 7 — Descriptions : traduction lazy + cache par hash

### 7.1 Edge Function `translate-on-demand`

**Fichier :** `supabase/functions/translate-on-demand/index.ts` (nouveau).

Signature : `POST { content: string, target_lang: 'de' | 'en' | 'it' }` → `{ translated: string, cached: boolean }`.

Logique :
1. Calcule `content_hash = sha256(content)` côté EF (module `node:crypto` / Deno std `crypto`).
2. `SELECT translated_text FROM translation_cache WHERE content_hash=$1 AND lang=$2` — si hit, retourne direct (`cached: true`).
3. Sinon, appelle `callDeepSeek` avec prompt simple : *"Translate this Swiss French real estate description to {target_lang}. Keep technical terms (m², CHF, canton names) intact. Return only the translated text, no preamble."*
4. `INSERT INTO translation_cache (content_hash, lang, translated_text)` (ON CONFLICT DO NOTHING — deux requêtes concurrentes possibles).
5. Retourne `{ translated, cached: false }`.

RLS `translation_cache` : SELECT public anon (pour que le frontend puisse checker le cache sans aller-retour EF sur les hits), INSERT service_role (via l'EF uniquement).

### 7.2 Déclenchement côté frontend (lazy)

**Fichier :** [src/pages/marketplace/ListingDetailPage.tsx](../../../src/pages/marketplace/ListingDetailPage.tsx) (ou équivalent — le composant qui affiche la description complète).

- Si `i18n.language === 'fr'` → affiche `description` directement (aucun appel).
- Sinon : nouveau hook `useTranslatedDescription(description, lang)` basé sur React Query :
  - `queryKey: ['translation', sha256(description).slice(0,12), lang]`
  - `queryFn` : appelle l'EF `translate-on-demand`.
  - `staleTime: Infinity` (la traduction ne change pas).
  - Affiche skeleton pendant le chargement, fallback FR silencieux en cas d'erreur.

**Pas de traduction côté liste `/acheter`, `/louer`** : les cartes affichent un extrait court (~150 chars) — peu critique en non-FR, fallback FR acceptable. Seule la page détail déclenche la traduction complète.

### 7.3 Pas de backfill

Plus de backfill one-shot : le cache se construit organiquement au fil des consultations. Les biens jamais vus ne coûtent jamais rien.

**Budget attendu :** ~200 consultations/jour en langues non-FR × 500 tokens × DeepSeek pricing = **~$0.50/mois**. Avec dédup par hash (boilerplate agences), probablement moins.

---

## Étape 8 — Widgets Super-Admin `/admin/monitoring`

**Fichier :** [src/pages/admin/AdminMonitoringPage.tsx](../../../src/pages/admin/AdminMonitoringPage.tsx)

- Ajouter section "IA" après les widgets existants (grid `grid-cols-2 md:grid-cols-4 gap-4`) :
  - DeepSeek — Solde USD (dernier snapshot)
  - DeepSeek — Tokens ce mois
  - Claude — Coût estimé ce mois
  - Claude — Tokens ce mois
- Graphique Recharts Stacked Area 30 jours (tokens/jour par provider).
- Badge rouge si solde DeepSeek < $20.

**Nouveau hook :** `src/hooks/useAIBilling.ts` — suit le pattern de [src/hooks/useAdminMonitoring.ts](../../../src/hooks/useAdminMonitoring.ts) :
- `useDeepSeekBalance()`
- `useAIUsageSummary(period)`
- `useAIUsageTimeseries(days)`

RLS permet les SELECTs super_admin directs depuis le client.

---

## Étape 9 — Lecture multilingue côté marketplace

**Fichier :** [src/hooks/useMarketListings.ts](../../../src/hooks/useMarketListings.ts)

Pas de changement de SELECT (aucune colonne multilingue ajoutée). Le hook reste inchangé côté DB.

**Modification `transformToCardData`** (lignes 140/150) :
- Injecter `i18n.language` via paramètre du hook.
- Titre : remplacer `row.title` par `generateListingTitle(row, lang)` (fonction pure de l'étape 6). Fallback `row.title` si `property_type` manquant.
- Description (extrait court pour la carte) : **pas de traduction** — affiche `row.description` tel quel (fallback FR acceptable en preview ; la traduction complète se fait sur la page détail).

**Page détail bien** : appeler `useTranslatedDescription(description, lang)` (cf. §7.2) pour le texte complet. Titre = `generateListingTitle`.

Pas de coût IA au chargement des listes, traduction uniquement à l'ouverture d'une fiche non-FR.

---

## Fichiers critiques à modifier

| Fichier | Action |
|---|---|
| `supabase/migrations/20260417_001_deepseek_integration.sql` | créer |
| `supabase/migrations/20260417_002_ai_billing_cron.sql` | créer |
| `supabase/functions/_shared/ai-provider.ts` | créer (nouveau dossier `_shared/`) |
| `supabase/functions/ai-billing-monitor/index.ts` | créer |
| `supabase/functions/translate-on-demand/index.ts` | créer (lazy + cache hash) |
| `supabase/functions/ai-search/index.ts` | migrer appel Claude → `callPublicAI` |
| `supabase/functions/support-chatbot/index.ts` | migrer appel Claude → `callPublicAI` |
| `supabase/functions/flatfox-sync/index.ts` | **inchangé** (pas de traduction au sync) |
| `src/lib/listingTitle.ts` | créer (template titres multilingues) |
| `src/hooks/useTranslatedDescription.ts` | créer (React Query + EF on-demand) |
| `src/pages/admin/AdminMonitoringPage.tsx` | ajouter section IA + graphique |
| `src/hooks/useAIBilling.ts` | créer |
| `src/hooks/useAdminMonitoring.ts` | ajouter `'ai-billing-monitor'` + `'translate-on-demand'` à `EDGE_FUNCTION_NAMES` l.36 |
| `src/hooks/useMarketListings.ts` | `transformToCardData` utilise `generateListingTitle` |
| Page détail bien (marketplace) | appeler `useTranslatedDescription` si lang ≠ fr |

Pas de nouveau package npm — DeepSeek utilise `fetch` natif.

---

## Vérification (end-to-end)

1. **Migration DB** — appliquer, vérifier `\d ai_usage_logs` + colonnes multilingues + RLS super_admin.
2. **Helper isolé** — EF test avec `supabase functions invoke`, vérifier log dans `ai_usage_logs`, forcer un fallback (bad API key temporairement) et vérifier `activity_events.action='ai_fallback'`.
3. **`ai-search`** — depuis `/acheter`, poser une question ; vérifier réponse DeepSeek + `provider: 'deepseek'` dans la réponse.
4. **`support-chatbot`** — ouvrir `/aide`, tester FR/DE/EN/IT, vérifier escalade et articles suggérés.
5. **Titres templates** — tester `generateListingTitle` sur 10 biens variés (apt/maison/parking, toutes langues) ; vérifier cohérence avec les titres FR Flatfox originaux.
6. **Traduction lazy** — ouvrir une fiche en DE : 1er chargement déclenche l'EF (`cached: false`), rechargement en DE → `cached: true` (instantané, pas d'appel DeepSeek). Vérifier row dans `translation_cache`. Deuxième visiteur sur même fiche → hit cache direct.
7. **Lecture multilingue carte** — changer la langue sur `/louer`, vérifier que les titres basculent (template) ; descriptions extraits restent FR (comportement voulu).
8. **Monitoring** — `/admin/monitoring` : widgets peuplés, graphique 30j, badge solde. Forcer `ai-billing-monitor` via curl pour avoir un snapshot immédiat.
9. **Tests unitaires** — `_shared/ai-provider.ts` (pricing calc, fallback logic mocké) + `listingTitle.ts` (snapshot tests pour les 4 langues × 8 types de bien).

## Rollback

- Changer `callPublicAI` → `callClaude` dans `ai-search`/`support-chatbot` (helper en place).
- Désactiver la traduction lazy : le hook `useTranslatedDescription` retourne la description FR en fallback. Supprimer l'EF `translate-on-demand` n'a aucun impact sur le reste.
- Titres : si `generateListingTitle` bug, revenir à `row.title` (revert 1 ligne dans `transformToCardData`).
- Table `translation_cache` : peut être `TRUNCATE` sans dommage (sera reconstruite au fil des visites).
