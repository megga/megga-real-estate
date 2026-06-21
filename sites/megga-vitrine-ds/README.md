# Design System — Vitrine MEGGA (`megga-vitrine-ds`)

Bundle **design-system** de la vitrine megga.ch, prêt pour **`/design-sync`** (Claude Design).

## Pourquoi ce dossier existe

La vitrine (`sites/megga-vitrine/`) est un **export Webflow statique** : des pages HTML
complètes + un seul `css/styles.css` généré. Ce n'est pas un codebase « tokens + composants
React », donc `/design-sync` ne sait pas en extraire un design system propre tel quel.

Ce dossier reconditionne la vitrine en **previews HTML autonomes** (une par composant /
groupe de tokens), chacune balisée `<!-- @dsCard group="…" -->`. Chaque preview lie le
**vrai** `css/styles.css` et la **vraie** police (Inter Tight) → rendu fidèle au pixel.

## Structure

```
megga-vitrine-ds/
  css/styles.css        ← copie du CSS réel de la vitrine (tokens + classes)
  fonts/*.woff          ← polices d'icônes réelles (Brix / fontello)
  images/               ← uniquement les images référencées par les previews
  components/
    foundations-colors.html          (Foundations)
    foundations-typography.html       (Foundations · Inter Tight, .display-1→10)
    foundations-radius-spacing.html   (Foundations)
    navbar.html · buttons.html · hero.html · feature-cards.html
    pricing.html · cta-band.html · footer.html · logos-strip.html  (Components)
```

## Synchroniser vers Claude Design

```bash
cd sites/megga-vitrine-ds
claude
/design-sync
```

`/design-sync` lit les previews, construit l'index de cartes à partir des marqueurs
`@dsCard`, et pousse vers ton projet Claude Design. Le design system « Vitrine MEGGA »
apparaît alors sous *Design systems* pour toute ton org.

## Tokens de marque (source : `css/styles.css` → `:root`)

| Token | Valeur |
|---|---|
| Police | **Inter Tight** (400/500/600/700/800) |
| Primaire | `#424bfb` indigo · `#00d95f` vert · `#1abcfe` cyan |
| Secondaire | bleu `#f4f8ff` (100) → `#002a79` (1000) |
| Neutres | `#030303` (100) → `#ffffff` (1000) |
| Radius | 6 · 8 · 12 · 16 · 20 · 24 · 32 · 200 px |
| Spacing | 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 56 · 64 · 72 · 80 · 90 px |

## Régénérer

Ce bundle est **dérivé** de `sites/megga-vitrine/`. Quand la vitrine change (rebrand,
nouvelles sections), recopier `css/styles.css` et ré-extraire les composants concernés,
puis relancer `/design-sync`.
