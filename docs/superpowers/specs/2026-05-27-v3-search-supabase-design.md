# Recherche V3 branchée Supabase — Design

> Date : 2026-05-27
> Statut : validé (brainstorming) — en attente de plan d'implémentation
> Périmètre : site statique `sites/property-preview` (Home V3 + page Properties)

## 1. Objectif

Rendre la barre de recherche de la Home V3 fonctionnelle : interroger les vrais
biens dans Supabase (`market_listings`) et afficher les résultats sur la page
Properties, sans réintroduire React. Ajouter un champ ville avec autocomplete.

## 2. Contexte / contraintes data (live, 2026-05-27)

- `transaction_type = rent` : **~59 000** biens actifs (Flatfox). `buy` : ~12. `sale` : 0.
  → **Phase 1 = location.** « Acheter » reste dans l'UI mais renvoie le petit set
  `buy` avec un état vide propre ; activation réelle plus tard.
- Villes réelles présentes (Zürich, Lausanne, Genève, Basel, Bern, Lugano…) sur 26
  cantons ; quelques doublons orthographiques (« Zürich » / « Zurich ») à garder à
  l'esprit pour le mapping de la liste.
- Colonnes utiles : `id, title, rent, price, current_price, address, city, canton,
  postal_code, rooms, bedrooms, bathrooms, surface_m2, photos, photos_cf, source_url,
  transaction_type, status, quality_score, created_at`.
- Clé anon publique (RLS) déjà utilisée par l'app — réutilisable côté navigateur.

## 3. Architecture

Site statique + appels **PostgREST** (`/rest/v1/market_listings`) via `fetch` et la
clé anon publique. Pas de librairie supplémentaire à charger, pas de build.

Flux :
1. **Home** : à « Rechercher », on construit
   `company-pages/properties.html?transaction=louer&ville=<ville>&type=<type>` et on
   redirige (aucune requête sur la home).
2. **Page Properties** : au chargement, lit les paramètres d'URL, interroge Supabase,
   rend les vrais biens dans la grille de cartes existante.

## 4. Composants (fichiers, responsabilités isolées)

- `js/ch-cities.js` — liste statique des villes/communes suisses `[{ name, canton }]`
  pour l'autocomplete (source de la 1ère rangée du dropdown Localisation).
- `js/megga-supabase.js` — `BASE_URL`, `ANON_KEY`, et `fetchListings(filters)` :
  construit la requête PostgREST et renvoie les lignes.
- `js/megga-search.js` — Home : autocomplete ville + lecture des dropdowns +
  redirection vers la page Properties avec les paramètres.
- `js/megga-properties.js` — page Properties : parse params → `fetchListings` →
  rendu des cartes (clone du template existant) + états chargement / vide / erreur +
  bouton « Charger plus ».
- **Migration Supabase** : index sur `market_listings(city)` (partiel
  `WHERE transaction_type='rent' AND status='active'`) pour un filtre ville rapide.

## 5. Spéc requête (perf)

`fetchListings` (location par défaut) :
- `transaction_type = eq.rent`, `status = eq.active`, `quality_score = gte.50`
- filtre ville : `city = ilike.<ville>%` (s'appuie sur le nouvel index)
- filtre type : `type = eq.<type>` quand fourni
- `order = created_at.desc`, `limit = 24`, pagination via `Range`/`offset`
- `select` minimal (cf. colonnes §2) — **jamais `count: exact`**, pas de `description`
- « Acheter » : même requête avec `transaction_type = eq.buy`.

Respecte les règles perf du projet (index partiel existant `idx_ml_rent_active_created`,
`.eq` plutôt que `.in`, colonnes légères).

## 6. Rendu & UI

- Cartes : photo (`photos[0]` / `photos_cf`), titre, ville + NPA, pièces, surface,
  loyer `CHF 1'850` (apostrophe suisse), badge « À louer ».
- Clic sur une carte → **fiche V3** `/property/<slug>.html?id=<id>` (rendre cette
  fiche dynamique = **phase 2**, hors de ce spec).
- États : skeleton/chargement, vide (« Aucun bien pour ces critères »), erreur.
- Champ ville : input texte en 1ère rangée du dropdown Localisation + suggestions
  filtrées depuis `ch-cities.js`.

## 7. Format & i18n

- `CHF 1'850` (apostrophe suisse), `120 m²`, dates DD.MM.YYYY.
- Textes FR (cohérent avec la Home déjà traduite).

## 8. Phasage

- **Phase 1 (ce spec)** : recherche location → page Properties dynamique + autocomplete
  ville + index DB.
- **Phase 2 (plus tard)** : fiche bien V3 dynamique (`?id=`), activation « Acheter »,
  filtres avancés (pièces, prix), hreflang/SEO des résultats.

## 9. Vérification

- Serveur statique local + données réelles : recherche → Properties affiche de vrais
  biens ; états vide/erreur ; autocomplete ; format CHF.
- Contrôle perf : la requête ville reste rapide (index en place).
