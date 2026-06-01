# Site vitrine — MEGGA CRM

Base du **site vitrine** (site marketing public) de **MEGGA CRM**, le produit immobilier.

Scrape brut du template Webflow **CodeAI X**, conservé ici pour servir de point de départ au rebrand vers la vitrine MEGGA.

## Pourquoi dans ce repo
Le site vitrine présente le CRM : il a besoin de tout le contexte produit (positionnement, design system, objectifs du Document Maître). Le garder dans `megga-real-estate` permet aux sessions Claude d'avoir ce contexte au moment de construire/rebrander la vitrine.

## Source
- Template : https://codeaixtemplate.webflow.io/
- Outil : [studiobloom/Reflow](https://github.com/studiobloom/reflow)
- Date du scrape : 26.05.2026

## Statut
- **Raw scrape**, non rebrandé — sert de matière première pour la vitrine MEGGA CRM
- Rebrand à faire : copy MEGGA, logo, couleurs/typo du design system, liens, suppression résidus Webflow/CodeAI

## Structure (29 pages, 462 fichiers, 25 MB)
```
home-pages/       — V1, V2, V3 homes
about-pages/      — about variants
blog-pages/       — blog index variants
blog-posts/       — article templates
blog-categories/  — category templates
careers/          — careers + job single
coming-soon-pages/
contact-pages/
product-pages/    — pricing + product detail (Webflow Commerce)
integration/      — integrations index + single
user-pages/       — sign-in/sign-up
template-pages/   — changelog, licenses, style-guide
images/           — assets PNG/SVG/JPG
js/               — jQuery + Webflow IX2 runtime
cms_pages.json    — Webflow CMS dump
```

## Build impact
Le préfixe `_` du dossier `_site-vitrine/` est ignoré par Vite / la build de prod — aucun fichier ne se retrouve dans `dist/` ou sur Cloudflare Pages. À retirer le jour où la vitrine est rebrandée et prête à déployer.
