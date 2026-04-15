# Système de location simple — Design

**Date** : 2026-04-15
**Auteur** : Julien + Claude (brainstorming session)
**Statut** : Validé, prêt pour planification

---

## Contexte & objectif

MEGGA Real Estate est aujourd'hui un OS transactionnel orienté **vente** résidentielle. La page `/louer` existe dans la navbar mais le composant `LouerPage.tsx` est un placeholder vide (5 lignes).

L'objectif de ce design : permettre à un agent de **publier un bien à louer** depuis son CRM et de le rendre visible sur une page publique `/louer`, sans aucune logique transactionnelle côté MEGGA.

**Principe directeur** : MEGGA = vitrine + outil de saisie. Tout ce qui touche à la gestion locative (visites, dossiers, sélection, bail, encaissement, gérance) est de la responsabilité de la régie qui dispose de son propre système.

## Scope

### Inclus
- Création d'un bien à louer dans le CRM agent (formulaire existant adapté)
- Publication sur `/louer` (page publique réutilisant `SearchPage`)
- Affichage des coordonnées de la régie sur la fiche bien

### Hors scope (explicitement)
- Pipeline location dans le CRM agent
- Pipeline location, matching tenants ↔ biens, alertes locataires
- Formulaire de contact côté locataire (le candidat utilise les liens `tel:` / `mailto:` natifs)
- Planification de visite
- Dossier de location, upload de documents candidat
- Sélection / refus de candidat
- Génération de bail, état des lieux
- Portail régie tokenisé
- Scrape de locations RealAdvisor (schéma préparé, aucun script ajouté)
- Visites groupées
- Calculateur d'accessibilité locative (33% du revenu)

### Types de location couverts
- Résidentiel long terme **non meublé** (cas standard)
- Résidentiel long terme **meublé** (flag `is_furnished`)

### Types de location **non** couverts
- Colocation / chambre seule
- Parking / garage / cave
- Commercial (bureau, surface, dépôt)
- Court terme / vacances

## Approche retenue

**Approche 1 — Réutilisation maximale.** Un seul modèle `properties` avec un champ `offer_type`, mêmes pages et composants que `/acheter`, conditionnés sur le type d'offre. Justification : le scope est trop réduit pour justifier la moindre duplication. Chaque amélioration future de `/acheter` (carte 3D, filtres, etc.) bénéficiera automatiquement à `/louer`.

## Architecture & modèle de données

### Migration SQL

`supabase/migrations/20260415_001_rental_support.sql`

Ajouts sur `properties` :

```sql
ALTER TABLE properties
  ADD COLUMN offer_type TEXT NOT NULL DEFAULT 'sale'
    CHECK (offer_type IN ('sale', 'rent')),
  ADD COLUMN rent_monthly INTEGER,        -- loyer net mensuel CHF
  ADD COLUMN deposit_months SMALLINT,     -- 1, 2 ou 3
  ADD COLUMN is_furnished BOOLEAN DEFAULT false,
  ADD COLUMN external_regie JSONB;        -- {name, phone, email, website} optionnel

ALTER TABLE properties
  ADD CONSTRAINT properties_offer_price_check
    CHECK (
      (offer_type = 'sale' AND price IS NOT NULL) OR
      (offer_type = 'rent' AND rent_monthly IS NOT NULL)
    );

CREATE INDEX idx_properties_offer_type ON properties(offer_type) WHERE status = 'active';
```

Les colonnes `charges_monthly` et `availability_date` existent déjà sur `properties` — on les réutilise.

Mêmes ajouts symétriques sur `market_listings` (sans le CHECK, puisque les biens scrappés ont historiquement `price` mais on garde la flexibilité).

### Champs

| Champ | Type | Vente | Location |
|---|---|---|---|
| `offer_type` | TEXT | `'sale'` | `'rent'` |
| `price` | INTEGER | requis | null |
| `rent_monthly` | INTEGER | null | requis |
| `charges_monthly` | INTEGER | optionnel | optionnel |
| `deposit_months` | SMALLINT | null | défaut 3 |
| `is_furnished` | BOOLEAN | null | défaut false |
| `availability_date` | DATE | optionnel | **requis** |
| `external_regie` | JSONB | null | optionnel |

### Règle d'immutabilité

Une fois un bien créé avec un `offer_type` donné, le champ est **verrouillé** dans le formulaire. Changer le type d'un bien existant n'a pas de sens fonctionnel.

## Flow agent — création d'un bien à louer

Modification de `src/pages/agent/ListingFormPage.tsx`.

### Toggle Vente / Location

Ajout d'un toggle binaire en haut du formulaire (juste sous le bouton "Sauver brouillon") :

```
┌─────────────────────────────────┐
│  ◉ Vente        ○ Location      │
└─────────────────────────────────┘
```

- Défaut : `Vente` (rétro-compatibilité)
- Verrouillé après la première sauvegarde

### Section "Caractéristiques" — affichage conditionnel

| Champ | Vente | Location |
|---|---|---|
| Prix de vente | affiché (CHF 720'000) | masqué |
| Loyer mensuel | masqué | affiché (CHF 2'500/mois) |
| Charges mensuelles | optionnel | optionnel |
| Caution (mois de loyer) | masqué | pills `1` / `2` / `3` (défaut 3) |
| Meublé | masqué | toggle oui/non |
| Date de disponibilité | optionnel | **requis** |

### Validation Zod

Schémas conditionnels selon `offer_type` :
- `'sale'` → `price` requis (≥ 50000)
- `'rent'` → `rent_monthly` requis (≥ 100) et `availability_date` requis

### Sidebar preview

La card de preview temps réel affiche :
- Vente : `CHF 720'000`
- Location : `CHF 2'500/mois`
- Badge `Meublé` si applicable

## Flow public — page `/louer`

### Routing

- `/louer` → `<SearchPage offerType="rent" />`
- `/louer/:id` → `<ListingPage />` (le composant détecte `offer_type` du bien chargé)
- `/acheter` reste inchangé (équivaut à `<SearchPage offerType="sale" />`)

### Composant `LouerPage.tsx`

Devient un wrapper minimal :

```tsx
export default function LouerPage() {
  return <SearchPage offerType="rent" />;
}
```

### Modifications de `SearchPage`

`SearchPage` accepte une nouvelle prop `offerType: 'sale' | 'rent'` (défaut `'sale'`). Tout comportement conditionné est concentré à 5-6 endroits :

| Élément | Vente (`'sale'`) | Location (`'rent'`) |
|---|---|---|
| Titre header | "Appartement à vendre à {ville}" | "Appartement à louer à {ville}" |
| Filtre prix | "Prix d'achat" | "Loyer mensuel" |
| Filtres additionnels | — | toggle `Meublé`, toggle `Disponible immédiatement` |
| Filtres retirés | — | "Recommandé pour vous", calculateur accessibilité hypothécaire |
| Estimation mensualité hypothèque sur cards | affichée | masquée |
| CTA principal (preview panel + fiche détail) | "Planifier une visite" | "Contacter la régie" |
| Comparateur | actif | actif (peut comparer des locations aussi) |

### Hook `useMarketListings`

Ajouter `offerType?: 'sale' | 'rent'` à `MarketFilters`. Default `'sale'` pour rétro-compatibilité totale.

```ts
if (filters.offerType) {
  query = query.eq('offer_type', filters.offerType);
}
```

### Format des prix

Nouvelle fonction utilitaire dans `src/lib/utils.ts` :

```ts
export function formatRent(amount: number): string {
  return `${formatCHF(amount)}/mois`;
}
```

Adaptation de `formatPricePin(price, offerType)` :
- Vente : `2.5M`, `530K`
- Location : `2.5K/mois`, `530/mois`

## Contact régie

### Source des coordonnées

Par défaut, les coordonnées de la régie = celles de l'**agence** qui a publié le bien (table `agencies` : `name`, `phone`, `email`, `website`). Cas le plus fréquent : l'agence est elle-même une régie (Naef, Bernard Nicod, Régie de Fribourg).

### Override par bien

Si l'agence n'est PAS la régie qui gère le bien (cas où un courtier indépendant publie pour le compte d'une régie tierce), le champ optionnel `external_regie` JSONB sur `properties` permet de surcharger :

```json
{
  "name": "Régie Foncia Genève",
  "phone": "+41 22 555 00 00",
  "email": "location@foncia-ge.ch",
  "website": "https://foncia-ge.ch"
}
```

Logique d'affichage : `external_regie ?? agency`.

### Composant `RegieContactCard`

Nouveau composant `src/components/listing/RegieContactCard.tsx` (~80 lignes) :

```
┌──────────────────────────────────┐
│  Régie Foncia Genève              │
│                                   │
│  📞 +41 22 555 00 00              │
│  ✉  location@foncia-ge.ch         │
│  🌐 foncia-ge.ch                  │
│                                   │
│  [ Appeler ]  [ Écrire ]          │
└──────────────────────────────────┘
```

Boutons = liens natifs `tel:` et `mailto:`. **Aucune logique côté MEGGA, aucun lead capturé.**

Le composant est utilisé dans :
- `ListingPage` (fiche détail) — remplace `AgentCard` quand `offer_type === 'rent'`
- `ListingPreviewPanel` (modal) — idem
- `ListingCard` (mini-affichage agence en bas) — remplace nom agence par nom régie quand `external_regie` défini

## Fichiers touchés

| Catégorie | Fichier | Action |
|---|---|---|
| Migration | `supabase/migrations/20260415_001_rental_support.sql` | Nouveau |
| Types | `src/types/property.ts` | Ajout champs |
| Types | `src/types/listing.ts` | Ajout champs |
| Hook | `src/hooks/useMarketListings.ts` | Ajout `offerType` filtre |
| Util | `src/lib/utils.ts` | Ajout `formatRent`, modification `formatPricePin` |
| CRM | `src/pages/agent/ListingFormPage.tsx` | Toggle + champs conditionnels |
| Public | `src/pages/public/LouerPage.tsx` | Wrapper `<SearchPage offerType="rent" />` |
| Public | `src/pages/public/SearchPage.tsx` | Prop `offerType`, conditionnels |
| Public | `src/pages/public/ListingPage.tsx` | `RegieContactCard` conditionnel |
| Composant | `src/components/listing/ListingPreviewPanel.tsx` | `RegieContactCard` conditionnel |
| Composant | `src/components/listings/ListingCard.tsx` | `formatRent`, badge `Meublé` |
| Composant | `src/components/listing/RegieContactCard.tsx` | Nouveau composant |
| i18n | `src/i18n/locales/{fr,de,en,it}/common.json` | Clés `rental.*` |

**Total : 10 fichiers modifiés + 4 fichiers i18n + 1 nouveau composant + 1 migration.**

## Tests / vérifications de non-régression

- `/acheter` doit fonctionner exactement comme avant (les filtres existants envoient `offerType: 'sale'` par défaut).
- Les biens existants en DB ont `offer_type = 'sale'` (default de la migration), donc aucun ne disparaît.
- Le formulaire de création de bien existant continue à créer des biens à vendre par défaut.
- Build TypeScript zéro erreur après ajout des champs sur `Property`.

## Ce qui n'est PAS dans ce design (renvoyé à plus tard)

Si Gregory Lyonnet ou les premières agences pilotes demandent ces extensions, elles feront chacune l'objet d'un nouveau spec :
- Pipeline location dédié
- Formulaire candidat + dossier de location
- Matching locataires ↔ biens + alertes email
- Visites groupées
- Portail régie pour transmission de dossier
- Calculateur taux d'effort 33%
- Scrape de locations sur RealAdvisor
