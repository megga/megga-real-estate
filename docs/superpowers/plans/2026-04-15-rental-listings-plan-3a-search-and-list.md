# Rental Listings — Plan 3a : SearchPage + LouerPage

**Goal :** Rendre la page `/louer` pleinement fonctionnelle en adaptant `SearchPage` au contexte location (label prix, titre, filtres Meublé/Dispo, retrait des éléments non pertinents) et en faisant de `LouerPage.tsx` un vrai wrapper plutôt qu'un redirect.

**Spec :** `docs/superpowers/specs/2026-04-15-rental-listings-design.md`
**Pré-requis :** plan-1 appliqué (migration + types + utils). plan-2 optionnel (biens rent en DB aident le test visuel mais pas nécessaire).
**Plan suivant :** `plan-3b-cards-and-i18n.md` (RegieContactCard + ListingCard/PreviewPanel/Page + i18n).

**Scope :** `SearchPage.tsx`, `LouerPage.tsx`, éventuellement le parseur de filtres pour `context`. Pas de modif des cards / preview panel / fiche détail (tout dans plan-3b).

**Note sur l'existant :** `useMarketListings` supporte déjà `context` (`useMarketListings.ts:9-10, 48`). `SearchPage` lit déjà `filters.context` à 3 endroits (lignes 126, 316, 380, 801). `LouerPage.tsx` fait actuellement un `<Navigate to="/search?context=rent" />` — on bascule vers un wrapper pour garder l'URL `/louer` propre côté SEO et bookmark.

---

## Tâche 7 — SearchPage : prop `context` + adaptations rent

**Fichier** : `src/pages/public/SearchPage.tsx` (signature ligne 55, filtres FilterPill ~360-420, section header ligne 801, bloc "Recommandé" / calculateur à identifier via grep `recommended` + `calculateur`, cards grid ~900+)

**Changement** : Ajouter une prop optionnelle `context?: 'buy' | 'rent'` à `SearchPage`. Quand fournie, elle **surcharge** la valeur venant de `parseFiltersFromParams` (la prop est la source de vérité quand présente, sinon fallback URL). Adapter 6 éléments selon `filters.context`, tous conditionnés par un ternaire simple :

1. **Titre header** (ligne 801) : déjà conditionné (`' à louer' : ' à vendre'`) — vérifier qu'il couvre aussi les cas "Maison/Villa à louer" (pas seulement "Appartement").
2. **Label du filtre prix** (FilterPill prix, ligne 377+) : `"Prix d'achat"` → `"Loyer mensuel"` en rent. Fonction `getPriceLabel()` déjà présente ligne 315-321 qui gère déjà le `/m` — la réutiliser pour le label du pill.
3. **Filtres additionnels rent** : ajouter 2 nouveaux pills après le pill prix, visibles uniquement si `context === 'rent'` : toggle `Meublé` (bool `filters.isFurnished`) et toggle `Disponible immédiatement` (bool `filters.availableNow` — applique un filtre serveur sur `availability_date <= today`).
4. **Filtres retirés en rent** : tri "Recommandé pour vous" (option `sort === 'recommended'`) et bouton calculateur accessibilité — cacher leur bouton d'entrée si `context === 'rent'`.
5. **Estimation mensualité hypothèque sur les cards** : le composant `ListingCardGrid` reçoit `context` — masquer le sous-texte `~CHF X/mois` quand rent (détail d'implémentation à gérer dans plan-3b côté card).
6. **Passer `filters.availableNow` + `filters.isFurnished` à `toServerFilters`** (ligne 48) pour qu'ils arrivent dans `useMarketListings` — ajouter ces champs côté hook (voir note ci-dessous).

**Exemple** :

```tsx
// Signature ligne 55
export default function SearchPage({ context }: { context?: 'buy' | 'rent' } = {}) {
  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState<Filters>(() => {
    const parsed = parseFiltersFromParams(searchParams)
    return context ? { ...parsed, context } : parsed
  })
  // ... existant

  // Exemple toggle Meublé (après le pill prix, ligne ~420)
  {filters.context === 'rent' && (
    <FilterPill label="Meublé" active={!!filters.isFurnished}
      onClick={() => updateFilter({ isFurnished: !filters.isFurnished })} />
  )}
}
```

**Hook** : `MarketFilters` dans `src/hooks/useMarketListings.ts:9-33` accepte déjà `context`. Ajouter `isFurnished?: boolean` et `availableNow?: boolean` dans l'interface, et dans `applyFilters` (ligne 46-76) :

```ts
if (filters.isFurnished) q = q.eq('is_furnished', true)
if (filters.availableNow) q = q.lte('availability_date', new Date().toISOString().slice(0, 10))
```

**Filter state** : ajouter `isFurnished: boolean` + `availableNow: boolean` au type `Filters` (fichier probablement `src/lib/searchFilters.ts` ou similaire — vérifier l'import ligne 44). Default `false` pour les deux. Les ajouter dans `parseFiltersFromParams` (lecture query param `furnished=1` + `available=1`) et `filtersToParams` (sérialisation).

**Commit** : `feat(search): add context prop + rental filters (isFurnished, availableNow)`

---

## Tâche 8 — LouerPage wrapper + routing propre

**Fichier** : `src/pages/public/LouerPage.tsx` (5 lignes à réécrire), `src/App.tsx` (lignes 21, 142-143 — aucune modif nécessaire mais vérifier)

**Changement** : Remplacer le `<Navigate>` par un wrapper qui instancie `<SearchPage context="rent" />`. L'URL reste `/louer` (pas de redirect vers `/search?context=rent`), ce qui est meilleur pour le SEO et les bookmarks utilisateurs. Par symétrie, envisager (**non bloquant pour ce plan**) de remplacer la route `/acheter` par un wrapper `AcheterPage` qui fait `<SearchPage context="buy" />` — mais ce n'est pas requis pour le spec : on se concentre sur `/louer`.

La route `/search` existe (`App.tsx:137`) et reste sans prop `context` (fallback sur query param). C'est le fallback compatible avec les liens existants type `/search?context=rent&minPrice=1500`.

**Exemple** :

```tsx
// src/pages/public/LouerPage.tsx — version finale (6 lignes)
import SearchPage from './SearchPage'

export default function LouerPage() {
  return <SearchPage context="rent" />
}
```

**Vérifications manuelles** :
- Naviguer sur `/louer` : URL reste `/louer` (pas de redirect), le titre passe à "Appartement à louer...", les filtres Meublé + Dispo apparaissent, le pill Prix dit "Loyer mensuel", le tri "Recommandé" est absent.
- Naviguer sur `/acheter` : comportement 100% identique à avant plan-3a (non-régression).
- Naviguer sur `/search?context=rent` : mêmes adaptations rent que `/louer` (le query param fonctionne toujours comme fallback).
- Ouvrir un bien vente depuis `/louer` : la fiche détail affiche toujours la même chose (plan-3b gère les adaptations rent côté fiche).

**Commit** : `feat(routing): LouerPage as SearchPage wrapper with context="rent"`

---

## Self-review checklist

- [ ] `npm run build` : 0 erreur TypeScript
- [ ] `npm run lint` : pas de nouvelle erreur
- [ ] Test manuel `/acheter` : comportement inchangé (non-régression, tous les filtres fonctionnent)
- [ ] Test manuel `/louer` : URL conservée, titre "à louer", pill prix "Loyer mensuel", filtres Meublé + Dispo présents, tri "Recommandé" absent
- [ ] Test query param `/search?context=rent&furnished=1` : filtre Meublé pré-coché, ne montre que les biens meublés
- [ ] `git diff main --stat` : 3-4 fichiers (`SearchPage.tsx`, `LouerPage.tsx`, `useMarketListings.ts`, éventuellement `searchFilters.ts`)

---

## Après ce plan

Pusher la branche, puis passer à `plan-3b-cards-and-i18n.md` qui ajoute le composant `RegieContactCard`, l'intègre dans les 3 vues bien (card, preview panel, fiche détail + sidebar), adapte les pins carte, et finalise les clés i18n `rental.*` dans les 4 langues.

À ce stade, la page `/louer` est **fonctionnelle mais incomplète visuellement** : les cards affichent encore `CHF 2'500` au lieu de `CHF 2'500/mois`, et le CTA fiche détail est encore "Planifier une visite" au lieu de "Contacter la régie". C'est le rôle de plan-3b.
