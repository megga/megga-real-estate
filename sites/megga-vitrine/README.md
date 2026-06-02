# Vitrine MEGGA (megga.ch)

Site **vitrine SaaS B2B** de MEGGA CRM — landing marketing publique qui présente le
**Transaction OS immobilier compliance-first** et pousse vers le CRM (`app.megga.ch`).

> **Pivot juin 2026 — CRM-first.** megga.ch sert cette vitrine (et non plus la
> marketplace, mise en sommeil dans `sites/_marketplace-phase-ulterieure/`).
> Déployé via `scripts/overlay-storefront.mjs` (`storefront = sites/megga-vitrine`).

## Base
Thème Webflow **CodeAI X** (scrape via studiobloom/reflow), **rebrandé** en MEGGA.
Tout est **auto-hébergé** : CSS (`css/`), JS (`js/`), images (`images/`) en local —
aucune dépendance CDN tierce.

## Worker
`_worker.js` = Basic Auth `ai`/`ai` (gate pré-lancement) **uniquement**. Pas de proxy
Supabase (la vitrine n'interroge pas d'annonces ; le proxy marketplace vit dans le
dossier en sommeil).

## CTA → CRM
- « Se connecter » → `https://app.megga.ch/auth/login`
- « Créer un compte » → `https://app.megga.ch/auth/signup`

## Rebrand
Règles + mapping de copy : voir [`REBRAND-SPEC.md`](./REBRAND-SPEC.md).
Pages : `index.html` (sales/preview), `home-pages/` (V1/V2/V3), `about-pages/`,
`contact-pages/`, `blog-*`, `product-pages/` (pricing), `user-pages/` (sign-in/up), etc.
