# Handoff — Espace Vendeur « Votre vente » · MEGGA

Pack prêt pour Claude Code / développeur. À ouvrir dans cet ordre :

## 📘 Lecture obligatoire (dans l'ordre)
1. **`HANDOFF_ESPACE_VENDEUR_CLAUDE_CODE.md`** ← ton point d'entrée (spec d'implémentation complète)
2. `refs/MEGGA-DESIGN-SYSTEM.md` ← grammaire visuelle **Sugar Pure** (palette, ombres, rayons, animations)
3. `refs/CLAUDE.md` ← règles persistantes du projet (les deux dialectes, le marché suisse, le rôle de l'IA)

## ⚠️ Nature des fichiers
Les fichiers de `maquette/` sont des **références de design réalisées en HTML/React (Babel in-browser)** — des prototypes hi-fi montrant le **rendu et le comportement voulus**, pas du code de production à copier tel quel. La tâche est de **recréer ces écrans dans l'environnement du codebase cible** (React/Next, Vue, etc.), en réutilisant ses patterns, son design system et ses libs. S'il n'existe pas encore d'environnement, choisir le framework le plus adapté et y porter les designs.

**Fidélité : hi-fi.** Couleurs, typo, espacements et interactions sont définitifs → reproduire au pixel près avec les outils du codebase.

## 📂 Contenu

```
handoff-espace-vendeur/
├── HANDOFF_ESPACE_VENDEUR_CLAUDE_CODE.md   ← spec d'implémentation (à lire en 1er)
├── README.md                               ← ce fichier
│
├── maquette/                               ← Maquette hi-fi à reproduire pixel-près
│   ├── MEGGA Votre Vente.html              ← HOST : données mock (PROPERTIES, AGENT, STEPS),
│   │                                          état, intégration des composants, panneau Tweaks
│   ├── seller-sugar-tokens.jsx             ← Palettes light/dark (SELLER_SP), sellerFmtCHF,
│   │                                          SELLER_CSS (animations + media queries responsive)
│   ├── seller-sugar-page.jsx               ← Tous les composants de la page :
│   │                                          SvHeader, SvPropertySwitcher, SvPropertyCard,
│   │                                          SvJourneyCard, SvStatsRow/SvDonut, SvOffersCard,
│   │                                          SvActivityCard, SvAgentCard, SvGalleryLightbox, SvIcon
│   ├── seller-sugar-offer-modal.jsx        ← SvOfferModal (Accepter / Contre-offrir / Refuser)
│   ├── seller-sugar-settings-modal.jsx     ← SvSettingsModal (notifs, visites, langue, dark mode)
│   ├── image-slot.js                       ← Web component <image-slot> (galerie droppable — démo)
│   ├── tweaks-panel.jsx                    ← Panneau Tweaks (démo only, non prod)
│   └── assets/
│       ├── megga-logo.svg                  ← wordmark MEGGA
│       └── megga-favicon.svg
│
└── refs/                                   ← Références transverses
    ├── MEGGA-DESIGN-SYSTEM.md              ← Sugar Pure (canon)
    └── CLAUDE.md                           ← règles persistantes projet
```

## 🚀 Quickstart

```bash
# Ouvre la maquette (serveur local recommandé pour les image-slot / fonts)
cd maquette
python3 -m http.server 8000
# puis http://localhost:8000/MEGGA%20Votre%20Vente.html
```

Navigation dans la maquette :
- **Switcher de biens** (en haut) : Rue du Rhône / Villa Cologny / Studio Eaux-Vives → tout le contenu suit le bien actif.
- **« Voir les photos »** (sur la photo principale) ou **« +N »** → ouvre la **lightbox** (←/→/Esc).
- **« Répondre à l'offre »** → modal de décision (transmise à l'agent).
- **Roue Paramètres** (header) → notifs, créneaux de visite, langue, **dark mode**.
- **Panneau Tweaks** (bas-droite, démo) : forcer l'étape du parcours et le nombre/statut des offres.

## 🎨 Direction artistique — NON NÉGOCIABLE

**Sugar Pure** : surfaces blanches sur gradient radial gris-bleu, **accent noir `#0B0C0E` uniquement**, **aucune bordure 1px décorative**, ombres douces, **Manrope**, CHF avec apostrophes, beaucoup d'air.

> **La couleur ne vit que dans la data-viz** (jauges, parcours, statuts d'offre, timeline), un concept = une couleur : Visites = vert `#0E9F6E`, Offres = orange `#C45A00`, Mise en ligne = cyan `#0891B2`, Mandat/Jours = bleu `#1E5BC6`, Signé = vert `#059669`. La chrome, elle, reste strictement noir/blanc.

Si tu doutes : `maquette/seller-sugar-page.jsx` → `SvJourneyCard` (arc + liste + encart « Prochaine étape ») = la référence canonique de la page.

## 🇨🇭 Spécificités MEGGA
- Marché suisse : **CHF avec apostrophes** (`sellerFmtCHF` → `CHF 1'250'000`), cantons.
- **L'agent reste copilote** : côté vendeur, aucune action n'est exécutée directement — toute décision (accepter/contre-offrir/refuser) est **transmise à l'agent**.
- **Web only** pour le V1 (cf. stratégie mobile) → responsive desktop / tablette / mobile, pas d'app native.
- Interface en **français (CH)**.

---
*Espace particulier vendeur · Sugar Pure · cadrage mai 2026.*
