# Rental Listings — Plan 3b : RegieContactCard + cards + i18n

**Goal :** Finaliser l'affichage public des biens à louer : nouveau composant `RegieContactCard` (substitut à `AgentCard` en rent), intégration dans `ListingPage` / `ListingPreviewPanel` / `ListingSidebar`, adaptation `ListingCard` (format loyer + badge Meublé), pins carte via `formatPricePin` partagé, et clés i18n `rental.*` dans les 4 langues.

**Spec :** `docs/superpowers/specs/2026-04-15-rental-listings-design.md`
**Pré-requis :** plan-3a appliqué (SearchPage affiche les biens rent correctement).
**Plan suivant :** aucun — dernier plan du feature.

**Scope :** 1 nouveau composant, 4 composants modifiés, 4 fichiers i18n. Pas de nouvelle logique serveur ni de nouvelle migration.

**Rappel clé spec** : `external_regie ?? agency`. Par défaut les coordonnées affichées sont celles de l'agence qui a publié. `external_regie` (JSONB ajouté en plan-1) permet l'override par bien.

---

## Tâche 9 — Nouveau composant `RegieContactCard`

**Fichier** : `src/components/listing/RegieContactCard.tsx` (nouveau, ~80 lignes)

**Changement** : Créer un composant présentationnel qui affiche les coordonnées de la régie : nom, téléphone (`tel:`), email (`mailto:`), website (`target="_blank" rel="noopener"`). Props : `regie: { name, phone, email, website? }`. Deux boutons ghost : "Appeler" (lien `tel:`) et "Écrire" (lien `mailto:`). **Aucune logique côté MEGGA, aucun lead capturé, aucun state, aucun appel Supabase.** C'est du pur HTML sémantique avec styling `bg-theme-card` + `border-theme-border`.

Ajouter aussi une fonction utilitaire `resolveRegieContact(listing, agency)` dans `src/lib/utils.ts` qui retourne `listing.external_regie ?? { name: agency.name, phone: agency.phone, email: agency.email, website: agency.website }` — centralise la logique `external_regie ?? agency` pour les 3 points d'intégration de la tâche 10.

**Exemple** :

```tsx
interface RegieContactCardProps {
  regie: { name: string; phone: string; email: string; website?: string }
  className?: string
}
export default function RegieContactCard({ regie, className }: RegieContactCardProps) {
  return (
    <div className={cn('rounded-xl border border-theme-border p-5', className)}>
      <p className="text-base font-semibold text-theme-primary">{regie.name}</p>
      <div className="mt-3 space-y-1.5 text-sm text-theme-secondary">
        <a href={`tel:${regie.phone}`} className="block hover:text-theme-primary">{regie.phone}</a>
        <a href={`mailto:${regie.email}`} className="block hover:text-theme-primary">{regie.email}</a>
        {regie.website && <a href={regie.website} target="_blank" rel="noopener noreferrer" className="block hover:text-theme-primary">{regie.website.replace(/^https?:\/\//, '')}</a>}
      </div>
      <div className="flex gap-2 mt-4">
        <a href={`tel:${regie.phone}`} className="flex-1 h-10 rounded-lg border border-theme-border text-sm text-center leading-10 text-theme-secondary hover:text-theme-primary hover:border-theme-active">Appeler</a>
        <a href={`mailto:${regie.email}`} className="flex-1 h-10 rounded-lg border border-theme-border text-sm text-center leading-10 text-theme-secondary hover:text-theme-primary hover:border-theme-active">Écrire</a>
      </div>
    </div>
  )
}
```

**Commit** : `feat(listing): add RegieContactCard + resolveRegieContact helper`

---

## Tâche 10 — Intégration RegieContactCard + adaptations cards/pins

**Fichiers** :
- `src/components/listings/ListingCard.tsx` (ligne 4 imports, ligne 180 prix)
- `src/components/listing/ListingPreviewPanel.tsx` (ligne 28 AgentCard import, ligne 946 prix, ligne 1210 CTA "Planifier une visite")
- `src/components/listing/ListingSidebar.tsx` (lignes 1-104 sidebar détail)
- `src/pages/public/ListingPage.tsx` (où `AgentCard` est rendu en sidebar)
- `src/components/map/MapView.tsx` (ligne 87 `formatPricePin` local à supprimer, lignes 807 + 853 appels)

**Changement** :

1. **ListingCard** : importer `formatRent` de `@/lib/utils`. Condition `listing.transaction_type === 'rent'` : afficher `formatRent(price)` au lieu de `formatCHF(price)`. Ajouter un badge `Meublé` (style `text-xs text-theme-muted`) dans la ligne features si `listing.is_furnished`. Masquer l'affichage prix/m² en rent (le ratio n'a pas de sens pour un loyer). Masquer l'estimation mensualité hypothèque en rent.
2. **ListingPreviewPanel** : même logique prix ligne 946. CTA ligne 1210-1223 : si rent, remplacer les 2 boutons ("Planifier une visite" + "Contacter l'agent") + `RequestVisitModal` par un seul bouton ghost "Contacter la régie" qui scroll vers le bloc `RegieContactCard` rendu plus bas à la place d'`AgentCard` (ligne 28 import). Masquer le bloc `monthlyCost` (lignes 244-267) en rent (charges OK, hypothèque KO).
3. **ListingSidebar** : ajouter prop `transactionType: 'buy' | 'rent'` + optionnel `regie` override. Ligne 41 : afficher `formatRent(listing.price)` si rent. Ligne 86-93 (calculateur) : masquer en rent. Ligne 96-100 (bloc AgentCard) : si rent, rendre `<RegieContactCard regie={resolveRegieContact(listing, listing.agent /* = agency */)}>` à la place.
4. **ListingPage** : transmettre `transaction_type` + `external_regie` à `ListingSidebar` et `ListingPreviewPanel`. Adapter aussi le CTA mobile sticky bar si présente.
5. **MapView** : supprimer la fonction locale `formatPricePin` (ligne 87) et importer celle de `@/lib/utils` (créée en plan-1). Aux 2 appels (lignes 807, 853) passer `listing.context` ou `listing.transaction_type` en 2e argument. Pour les clusters (ligne 807), prendre le `context` du point min-price du cluster (par défaut `'buy'` si hétérogène — cas improbable puisque `/louer` et `/acheter` sont distincts).

**Exemple** :

```tsx
// ListingCard.tsx — prix conditionnel
import { cn, formatCHF, formatRent, formatSurface } from '@/lib/utils'
const isRent = listing.transaction_type === 'rent'
<span className="text-xl font-bold">
  {isRent ? formatRent(listing.price) : formatCHF(listing.price)}
</span>
{listing.is_furnished && <span className="text-xs text-theme-muted ml-2">· Meublé</span>}

// ListingSidebar.tsx — CTA + régie conditionnels
{isRent ? (
  <RegieContactCard regie={resolveRegieContact(listing, listing.agent)} />
) : (
  <AgentCard variant="default" agent={listing.agent} />
)}
```

**Vérifications manuelles** :
- Card liste `/louer` : prix `CHF 2'500/mois`, badge `Meublé` si applicable, pas de prix/m², pas d'estim. hypothèque.
- Preview panel (clic sur pin/card) : prix mois, CTA unique "Contacter la régie", `RegieContactCard` rendu à la place d'`AgentCard`, bloc monthlyCost absent.
- Fiche `/listing/:id` d'un bien rent : sidebar affiche loyer/mois + régie (coordonnées agence par défaut, override si `external_regie` rempli), pas de calculateur accessibilité.
- Fiche `/listing/:id` d'un bien vente : comportement 100% inchangé (non-régression critique).
- Pin carte `/louer` : `2.5K/mois`, `530/mois`.
- Pin carte `/acheter` : `2.5M`, `530K` (format inchangé).

**Commit** : `feat(listing): rent-aware cards, preview panel, sidebar + regie contact`

---

## Tâche 11 — i18n `rental.*` dans 4 langues

**Fichier** : `src/i18n/locales/{fr,de,en,it}/common.json`

**Changement** : Ajouter un namespace `rental` avec les clés utilisées aux tâches 7, 9, 10. Les labels du formulaire agent (plan-2) restent en FR hardcodé (convention projet, dashboard agent non-i18n prioritaire). Seuls les textes visibles côté public sont traduits.

**Clés à ajouter** (dans chaque fichier common.json) :

```
rental.title.apartment     — "Appartement à louer à {{city}}" / DE / EN / IT
rental.title.house         — "Maison à louer à {{city}}"
rental.title.villa         — "Villa à louer à {{city}}"
rental.priceLabel          — "Loyer mensuel" / "Monatliche Miete" / "Monthly rent" / "Affitto mensile"
rental.filterFurnished     — "Meublé" / "Möbliert" / "Furnished" / "Arredato"
rental.filterAvailableNow  — "Disponible immédiatement" / "Sofort verfügbar" / "Available now" / "Disponibile subito"
rental.badgeFurnished      — "Meublé" (idem 4 langues, court)
rental.depositMonths       — "Caution : {{count}} mois" (avec pluralization 4 langues)
rental.availableOn         — "Disponible le {{date}}" / "Verfügbar ab {{date}}" / "Available from {{date}}" / "Disponibile dal {{date}}"
rental.contactRegie        — "Contacter la régie" / "Verwaltung kontaktieren" / "Contact agency" / "Contatta l'agenzia"
rental.regieCta.call       — "Appeler" / "Anrufen" / "Call" / "Chiama"
rental.regieCta.email      — "Écrire" / "Schreiben" / "Email" / "Scrivi"
rental.suffix.perMonth     — "/mois" / "/Monat" / "/month" / "/mese"
```

**Convention** : utiliser `useTranslation('common')` (namespace déjà chargé partout). Les endroits à migrer :
- `SearchPage` ligne 801 (titre) — remplacer le ternaire hardcodé par `t('rental.title.' + type, { city })` / `t('listings.title.' + type, { city })`.
- `ListingSidebar` ligne 41 (loyer) — le suffixe `/mois` vient du helper `formatRent()` qui reste en FR. Plan-3b ne touche pas à `formatRent` (tâche déjà couverte dans plan-1) — le `/mois` est français dans toutes les versions. Accepter cette dette (le montant CHF est lingua franca en Suisse, le suffixe FR est OK).
- `ListingCard` / `ListingPreviewPanel` : labels "Meublé" et "Contacter la régie" passent par `t('rental.badgeFurnished')` / `t('rental.contactRegie')`.
- `RegieContactCard` : boutons "Appeler" / "Écrire" passent par `t('rental.regieCta.call')` / `t('rental.regieCta.email')`.

**Exemple** (`src/i18n/locales/fr/common.json`) :

```json
{
  "rental": {
    "title": { "apartment": "Appartement à louer à {{city}}", "house": "Maison à louer à {{city}}", "villa": "Villa à louer à {{city}}" },
    "priceLabel": "Loyer mensuel",
    "filterFurnished": "Meublé",
    "filterAvailableNow": "Disponible immédiatement",
    "contactRegie": "Contacter la régie",
    "regieCta": { "call": "Appeler", "email": "Écrire" }
  }
}
```

Répéter pour `de/common.json`, `en/common.json`, `it/common.json` avec les traductions correspondantes. Vérifier avec l'extension VSCode i18n-ally ou le skill `i18n-sync` que les 4 langues ont exactement les mêmes clés.

**Commit** : `i18n: add rental.* keys in fr/de/en/it common.json`

---

## Self-review checklist

- [ ] `npm run build` : 0 erreur TypeScript
- [ ] `npm run lint` : 0 nouvelle erreur
- [ ] Test manuel `/louer` bout en bout : card → preview → fiche détail → appel téléphone via `tel:`
- [ ] Test changement de langue FR → DE → EN → IT : les labels rent sont bien traduits
- [ ] Test bien avec `external_regie` en DB : la sidebar affiche bien la régie externe, pas l'agence
- [ ] Test bien rent sans `external_regie` : la sidebar affiche les coordonnées de l'agence
- [ ] Non-régression `/acheter` + fiche vente : aucun changement visuel
- [ ] Pins carte : `/louer` → `2.5K/mois`, `/acheter` → `2.5M`
- [ ] `git diff main --stat` : ~8-10 fichiers (4 composants + 1 nouveau + 1 MapView + 4 i18n)

---

## Après ce plan

Le feature rental listings est **complet côté spec**. Pusher, puis :
1. Demander à Julien de créer 2-3 biens test en rent via le formulaire agent (plan-2).
2. Vérifier la visibilité sur `/louer` et le flux `tel:` / `mailto:`.
3. Étendre le scraping RealAdvisor pour les locations (hors scope, nouveau spec si demandé).

Rien d'autre à faire pour le MVP rental. Les extensions listées en fin de spec (pipeline location, candidat, matching tenants, visites groupées, portail régie) feront chacune l'objet d'un nouveau spec dédié si le marché le demande.
