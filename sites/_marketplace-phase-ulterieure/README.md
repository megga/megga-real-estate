# Marketplace Property X — mise en sommeil (phase ultérieure)

> **Statut : en sommeil depuis juin 2026.** Décision produit : recentrage **CRM-first**.
> megga.ch sert désormais la **vitrine SaaS** (`sites/megga-vitrine/`) qui pousse vers le CRM.

Ce dossier **n'est plus déployé publiquement**, mais **rien n'est supprimé** : c'est l'ancien
storefront statique Webflow Property X (ex-`sites/property-preview/`), conservé tel quel pour
une **phase ultérieure** (Sprint 7 de la roadmap : recherche conversationnelle, copilote
négociation, annonces multi-versions).

## Pourquoi en sommeil et pas supprimé

- La table **`market_listings`** (~34k biens Flatfox) **reste active** : elle nourrit le CRM en
  interne (matching acheteur↔bien, comparables d'estimation, stats de marché du copilote).
  La jeter affaiblirait le CRM.
- Le code marketplace (worker `/api/listings` `/api/agencies` `/api/seller-lead`
  `/api/contact-message`, scripts `megga-*.js`, formulaires branchés au CRM) est fonctionnel et
  testé — il sera réutilisé quand on rouvrira la marketplace publique.

## Comment la réactiver (réversible en 1 ligne)

Dans [`scripts/overlay-storefront.mjs`](../../scripts/overlay-storefront.mjs), repointer :

```js
const storefront = resolve(root, 'sites/_marketplace-phase-ulterieure'); // au lieu de sites/megga-vitrine
```

(ou router les deux sur des projets Cloudflare Pages distincts : megga.ch = vitrine,
annonces.megga.ch = ce dossier.)

## Ce qui reste branché au CRM même en sommeil

Les triggers `notify_new_seller_lead()` et `notify_new_contact_message()` (migrations
`20260531120000` / `20260531140000`) restent en base : si on réactive les formulaires, les
leads/messages retombent dans le CRM. Aucune migration à annuler.
