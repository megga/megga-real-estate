# Backlog — Fonctionnalités à faire

> Fichier dédié pour ne pas encombrer CLAUDE.md. Déplacer une entrée vers `roadmap.md` quand elle passe en sprint actif. Dernière mise à jour : 2026-04-18.

---

## B — Copilote agent transversal (`ai-copilot-agent`)

**Statut** : décidé en principe (2026-04-18). À démarrer après les priorités roadmap en cours (acquisition agents).

### Pourquoi
Le copilote actuel (`ai-copilot`) est **orienté actions prédéfinies sur l'entité courante** (résume ce contact, rédige un email, analyse ce KYC). Il ne sait **pas** agréger plusieurs entités, répondre sans contexte de page, chaîner des actions, ni raisonner sur le portefeuille global.

Extension nécessaire pour passer de *« assistant ponctuel »* à *« assistant stratégique »* — pièce structurelle du positionnement **Compliance-First Transaction OS**.

### Cas d'usage cibles
- *« Contacts actifs avec score > 70 qui n'ont pas eu de contact depuis 14j »*
- *« KYC bloqués > 7j, groupés par risque »*
- *« Qui de mes contacts matche le listing X ? »*
- *« Priorités de la journée »*
- *« Prix médian 4p à Carouge vs 3 derniers mois »*
- *« Transactions bloquées en promesse »*

### Décisions de design à trancher avant sprint
1. **UX surface** :
   - A. Bulle flottante sticky (bottom-right, partout) ← reco
   - B. Sidebar dépliable
   - C. Page dédiée `/ai` + `Cmd+K`
   - D. Combo A + C
2. **Scope tools v1** (6 proposés) :
   - `query_contacts(filters)`
   - `query_pipeline(stage?)`
   - `query_kyc(filters)`
   - `match_contacts_to_listing(listing_id)`
   - `suggest_priorities_today()`
   - `get_market_stats(area, type)`
3. **Actions** : read-only v1 (deep-link) vs exécutables (confirmation modal). Reco : read-only.
4. **Modèle** : Claude Sonnet 4 (compliance LPD, DPA Anthropic EU) vs DeepSeek hybride. Reco : Sonnet 4 v1.

### Scope estimé — 10-12 jours
| Jour | Livrable |
|---|---|
| 1 | Spec finale 6 tools + schemas Zod/JSON + RPC manquantes |
| 2 | Migrations : RPC `SECURITY DEFINER` filtrées `agency_id = auth.jwt()` |
| 3 | Edge Function `ai-copilot-agent` (Claude Sonnet 4 tool-calling + streaming SSE) |
| 4 | Implémentation des 6 tools côté edge function |
| 5-6 | UI Chat widget (Radix Dialog flottant + markdown + cards d'action) |
| 7 | Hook `useAgentCopilot` (React Query streaming) |
| 8 | Cards d'action : contact/listing/kyc/transaction preview + deep-link |
| 9 | Audit trail `activity_events` (tool calls + réponses, `actor_id='ai'`) |
| 10 | i18n FR/DE/EN/IT (system prompt + UI strings) |
| 11 | Feature flag `ai_copilot_agent_beta` + access admin-only pilote |
| 12 | Tests E2E + polish + doc interne agents |

### Coûts estimés
- Claude Sonnet 4 : ~CHF 0.03/requête × 30 req/agent/jour × 22j × N agents
  - 10 agents : CHF 200/mois
  - 50 agents : CHF 1'000/mois
  - 200 agents : CHF 4'000/mois
- Alternative hybride DeepSeek (si data residency résolue) : ~16× moins cher, mais risque LPD à clarifier.

### Déclencheur de démarrage
≥ 5 agents payants actifs (pour tester avec vrai volume de données) **OU** besoin commercial de différenciation immédiate (cycle de vente MEGGA).

---

## C — Smart input marketplace (quick win)

**Statut** : spec arrêtée 2026-04-18. Prêt à démarrer.

### Principe
**Pas un chat.** Un parser intelligent branché sur la **barre de recherche existante** sur `/acheter` et `/louer`. L'user tape en langage naturel → IA extrait des filtres structurés → la FilterBar actuelle se remplit automatiquement → résultats.

### UX — barre unifiée bi-modale
Placement : **remplace l'input `[Ville, quartier, canton…]` existant** dans `SearchPage.tsx` (ligne ~361). Pas de nouvelle ligne au-dessus.

```
╭──────────────────────────────────────────────────────────────╮
│ 🔍  Ville, quartier, ou décris ce que tu cherches…        × │
╰──────────────────────────────────────────────────────────────╯
```

Heuristique côté client pour router sans appel IA inutile :
```ts
function routeSearch(input: string) {
  const wordCount = input.trim().split(/\s+/).length
  const hasNumbers = /\d/.test(input)
  const hasPriceKeyword = /\b(max|sous|moins|entre|chf|k|mio|m²)\b/i.test(input)

  if (wordCount <= 2 && !hasNumbers && !hasPriceKeyword) {
    return { mode: 'city' }  // comportement actuel, instant
  }
  return { mode: 'nlp' }      // appel parse-search-query
}
```

Icône dynamique : `🔍` gris en mode ville → `✨` accent en mode NLP détecté (feedback subtil).

Après submit NLP : chip « ✨ Compris : Villa · Genève · Piscine · < 3M × » apparaît sous la barre, les chips de la FilterBar se remplissent avec une micro-animation flash.

### Filtres mappés v1 (à valider)
| Filtre | Capturé depuis | Existe dans `MarketFilters` ? |
|---|---|---|
| `minPrice` / `maxPrice` | "< 2'500", "max 3M", "entre 800K et 1.5M" | ✅ |
| `minRooms` / `maxRooms` | "3-4 pièces", "grand appart" | ✅ |
| `minSurface` | "> 80m²" | ✅ |
| `types[]` | villa / appartement / loft / attique | ✅ |
| `canton` + `city` | "Genève", "Lausanne", "Valais" | ✅ |
| `features[]` | balcon, piscine, vue lac, garage, meublé, animaux OK | ⚠️ à ajouter dans FilterBar + RPC |

### Architecture
```
[barre unifiée existante]
  ↓ heuristique client
  ├─ mode 'city' → comportement actuel (zéro changement)
  └─ mode 'nlp'  → POST /functions/v1/parse-search-query
                    { query, context: 'rent'|'buy', lang }
                    ↓
                    ai-provider.ts → DeepSeek V3 (fallback Claude Haiku)
                    ↓ Zod validation
                    ↓
                    useMarketFilters.setAll(parsed)
                    ↓ re-fetch auto
```

### Coûts
DeepSeek V3, profil réel 450 tokens in / 150 out = **$0.000286/req** ≈ CHF 0.00026.

| Trafic | Requêtes/mois | DeepSeek | Avec cache 40% | + fallback Claude 3% |
|---|---|---|---|---|
| 500 MAU × 2 | 1'000 | CHF 0.26 | CHF 0.16 | CHF 0.35 |
| 5K MAU × 3 | 15'000 | CHF 3.90 | CHF 2.35 | CHF 4.80 |
| 20K MAU × 4 | 80'000 | CHF 21 | CHF 12 | CHF 26 |

### Données & compliance
Listings publics uniquement → pas de souci data residency LPD. Query user = texte libre non-PII (pas de nom, email, etc.). DeepSeek direct OK.

### Plan d'implémentation — 4 jours
| Jour | Livrable |
|---|---|
| 1 | Edge Function `parse-search-query` (Zod schema strict + system prompt FR/DE/EN/IT + cache SHA256) + 20 phrases-tests |
| 2 | Modif `SearchPage.tsx` input existant : heuristique client, icône dynamique, chip « Compris », wiring `useMarketFilters.setAll()` |
| 3 | Ajout support `features[]` dans `MarketFilters` + RPC `get_market_map_points` (p_features TEXT[]) |
| 4 | i18n FR/DE/EN/IT (placeholder + toast + chip) + feature flag `smart_search_enabled` + tests E2E |

### Follow-up v2 : `terrace` feature
**Drop de v1** (2026-04-18) : `market_listings.features` est JSONB avec des slugs FR inconsistants (`terrasse`, `terasse`, parfois absent) et il n'y a pas de colonne `has_terrace` dédiée. Pour v2 : soit ajouter `has_terrace BOOLEAN` (nécessite un backfill à partir du JSONB), soit utiliser `features @> '["terrasse"]'::jsonb` avec une normalisation des tokens DB.

### Décisions verrouillées (2026-04-18)
1. ✅ **v1 full** : features (balcon, piscine, vue lac, garage, meublé, animaux OK, ascenseur) incluses dès v1
2. ✅ **Bulle onboarding** au premier visit (dismiss persistant via localStorage)
3. ✅ **Mobile identique desktop**, avec ellipsis sur la chip « Compris » si trop longue

### Déclencheur go/no-go
- [ ] Mesurer taux de parse DeepSeek V3 sur 20 phrases-tests FR/DE/EN/IT → accept si ≥ 90%

---

## Follow-ups PR #150 (choropleth CHF/m²)

### 1. Fix Flatfox sync pour populer `price_per_m2`
Actuellement, seulement 15/33'782 listings rent avaient `price_per_m2` rempli — un backfill one-shot a été appliqué (23'215 lignes). Mais le sync Flatfox quotidien ne remplit pas cette colonne à l'insert.

**À faire** : patcher `supabase/functions/flatfox-sync/index.ts` pour calculer `price_per_m2 = ROUND(price / surface_m2, 2)` à chaque insert/update quand `price > 0 AND surface_m2 > 0`.

### 2. Anti-outlier filter sur RPC `get_price_hexagons`
Un hex observé à 2.14 CHF/m² avec 41 biens (probablement parkings/box classés en rent). Ajouter :
```sql
AND m.price_per_m2 BETWEEN 5 AND 150  -- rent
-- ou BETWEEN 2000 AND 50000 pour 'sale'
```
Paramétrer selon `p_transaction_type`.

---

## Scraper agences immobilier.ch

**Statut** : en cours d'exécution (2037 URLs, rate-limit 5s, ~2h45). Background PID `bp483pdjw`.

### À finaliser une fois le full scrape terminé
1. Valider sample complet + résumé (couverture cantons, fill-rates)
2. Déduplication par `name + postal_code`
3. Fuzzy-match avec `market_listings.agency_name` (normalisation lowercase + strip SA/AG/Sàrl)
4. Décision : enrichissement DB ou uniquement fichier local ?
