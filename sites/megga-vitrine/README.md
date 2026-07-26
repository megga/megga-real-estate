# Vitrine MEGGA (megga.ch)

Site **vitrine SaaS B2B** de MEGGA CRM — landing marketing publique qui présente le
**Transaction OS immobilier compliance-first** et pousse vers le CRM (`app.megga.ch`).

> **Pivot juin 2026 — CRM-first.** megga.ch sert cette vitrine (et non plus la
> marketplace, supprimee du depot en juillet 2026 — recuperable via git).
> Déployé via `scripts/overlay-storefront.mjs` (`storefront = sites/megga-vitrine`).

## Base
Thème Webflow **CodeAI X** (scrape via studiobloom/reflow), **rebrandé** en MEGGA.
Tout est **auto-hébergé** : CSS (`css/`), JS (`js/`), images (`images/`) en local —
aucune dépendance CDN tierce.

## Worker
`_worker.js` = Basic Auth (gate pré-lancement) **uniquement**. Pas de proxy Supabase
(la vitrine n'interroge pas d'annonces ; le proxy marketplace vit dans le dossier en
sommeil). Les identifiants ne sont PAS recopiés ici — ils vivent en haut de
`_worker.js`, seule source de vérité : la version dupliquée dans ce README a annoncé
de faux identifiants pendant des semaines.

⚠ `login.html`, `signup.html` et `reset-password.html` sont **hors du gate**, avec
`css/`, `js/`, `images/` et `fonts/`. Ce n'est pas un oubli : le CRM n'a plus de page
de connexion et redirige ici (`VITRINE_LOGIN_URL` dans `src/App.tsx`), donc gater
`/login` ferme l'accès au CRM lui-même. `reset-password` doit rester libre parce que
ses liens arrivent par e-mail, chez des gens qui n'ont pas le mot de passe du gate.

## CTA → inscription et connexion
Les deux vivent **sur la vitrine** (inversion post-pivot), pas sur `app.megga.ch/auth`
dont toutes les routes redirigent ici :
- « Se connecter » → `login.html`
- « Créer un compte » → `signup.html`

Après authentification, `js/megga-auth.js` passe la session au CRM en fragment
(`app.megga.ch/auth/callback#access_token=…`) : les deux origines ne partagent pas de
`localStorage`, une redirection nue y arriverait déconnectée.

## Rebrand
Règles + mapping de copy : voir [`REBRAND-SPEC.md`](./REBRAND-SPEC.md).
Pages : `index.html` (sales/preview), `home-pages/` (V1/V2/V3), `about-pages/`,
`contact-pages/`, `blog-*`, `product-pages/` (pricing), `user-pages/` (sign-in/up), etc.
