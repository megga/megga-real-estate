# CodeAI X — Webflow template scrape

Scrape brut du template Webflow CodeAI X (utilisé comme base pour megga.ai).

## Source
- Template : https://codeaixtemplate.webflow.io/
- Outil : [studiobloom/Reflow](https://github.com/studiobloom/reflow)
- Date : 26.05.2026

## Statut
- **Raw scrape**, non rebrandé
- Version rebrandée pour `megga.ai` : voir le dossier local `~/Desktop/site-clones/meggaai-static/` (déployée sur Cloudflare Pages, pas git-trackée)
- Ce dossier est ici pour conserver le template d'origine et son contexte pour de futures itérations

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
images/           — toutes les assets PNG/SVG/JPG
js/               — jQuery + Webflow IX2 runtime
cms_pages.json    — Webflow CMS dump
```

## Pourquoi ici plutôt qu'en repo séparé
Stashé dans `megga-real-estate` pour que les sessions Claude futures aient tout le contexte projet (CLAUDE.md, design system, history) au moment de toucher au template.

## Build impact
Le préfixe `_` du dossier `_templates/` est ignoré par Vite / la build de prod — aucun fichier de ce dossier ne se retrouve dans `dist/` ou sur Cloudflare Pages.
