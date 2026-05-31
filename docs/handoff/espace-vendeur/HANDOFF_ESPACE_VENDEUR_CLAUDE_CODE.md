# Handoff Claude Code — Espace Vendeur « Votre vente »

> **À lire avant tout** : `refs/CLAUDE.md` (règles persistantes du projet) et `refs/MEGGA-DESIGN-SYSTEM.md` (grammaire Sugar Pure complète : palette, ombres, rayons, animations).

> La maquette hi-fi vit dans `maquette/MEGGA Votre Vente.html` + les `.jsx` co-localisés listés plus bas.

---

## 🎯 Périmètre

**Espace particulier vendeur** — la page que voit un **propriétaire** qui a confié la vente de son bien à un agent MEGGA. Lien personnel (pas de login lourd au lancement). Direction artistique **Sugar Pure** (la même que le CRM agent : c'est un espace « confiance / suivi », blanc + noir, beaucoup d'air).

Une seule page, responsive, qui répond à **« où en est ma vente ? »** d'un coup d'œil et permet de **valider/refuser/contre-offrir** sans friction — l'agent reste copilote (rien ne part sans « transmettre à mon agent »).

### Livrables (composants de la maquette)

| # | Bloc | Composant maquette |
|---|---|---|
| 1 | **En-tête** — logo MEGGA + chip « Votre agent » (avatar initiales) + accès Paramètres | `SvHeader` |
| 2 | **Switcher multi-biens** — pills, si le vendeur a ≥ 2 annonces (sinon masqué) | `SvPropertySwitcher` |
| 3 | **Carte bien** — galerie photos (image principale + 3 vignettes) + infos + prix + **lightbox** | `SvPropertyCard` + `SvGalleryLightbox` |
| 4 | **Parcours de vente** — arc maître segmenté coloré + liste des 6 étapes + encart « Prochaine étape » + phrase contextuelle | `SvJourneyCard` |
| 5 | **3 jauges** (donuts) — Visites / Offres / Jours en ligne | `SvStatsRow` + `SvDonut` |
| 6 | **Carte Offres** — liste des offres reçues, statut (En attente / Contre-offre / Acceptée), CTA « Répondre à l'offre » | `SvOffersCard` + `SvOfferStatus` |
| 7 | **Timeline** « Dernières nouvelles » — événements colorés par type | `SvActivityCard` |
| 8 | **Carte agent** (colonne droite sticky) — avatar, nom, CTA WhatsApp + Appeler + Email | `SvAgentCard` |
| 9 | **Modal Offre** — Accepter / Contre-offrir / Refuser → contexte agent → confirmation | `seller-sugar-offer-modal.jsx` (`SvOfferModal`) |
| 10 | **Modal Paramètres** — notifications, dispo visites, langue/contact, dark mode | `seller-sugar-settings-modal.jsx` (`SvSettingsModal`) |

---

## 📐 Direction artistique — Sugar Pure (NON NÉGOCIABLE)

Voir `refs/MEGGA-DESIGN-SYSTEM.md`. TL;DR appliqué ici :

- Surfaces **blanches `#FFFFFF`** sur **gradient radial gris-bleu** (`bgGradient`).
- **AUCUNE bordure 1px décorative** — la séparation se fait à l'**ombre douce** (`shadowSm` / `shadow` / `shadowLg`).
- **Accent unique = NOIR PUR `#0B0C0E`** (CTA, sélection, ring actif). En dark mode il s'inverse en presque-blanc `#ECEDF3`.
- **Titres en noir franc**, jamais gris.
- Coins : **26px** carte principale, **24px** cartes, **18–16px** sous-cartes/encarts, **12px** inputs/vignettes, **999px** pills/cercles. Modal **28px**.
- Animation d'entrée `sgFadeUp .55s cubic-bezier(.2,.8,.2,1) both` (classe `.sg-enter`).
- **Manrope**, `tabular-nums` sur tous les nombres (classe `.sg-tnum`), **CHF avec apostrophes** (`sellerFmtCHF` → `CHF 1'250'000`).
- Iconographie **SVG stroke linéaire** (`SvIcon`, ~20 icônes) — **zéro emoji**.

### ⚠️ Couleur = data-viz uniquement
La chrome reste noir/blanc. **La couleur ne vit que dans la visualisation de données**, et un concept = une couleur, partout :

| Concept | Couleur (light) | Usage |
|---|---|---|
| Mandat / Jours | `#1E5BC6` (bleu) | jauge Jours, étape Mandat, événement mandat |
| Mise en ligne | `#0891B2` (cyan) | étape En ligne, événement publication |
| Visites | `#0E9F6E` (vert) | jauge Visites, étape Visites, événement visite |
| Offres | `#C45A00` (orange) | jauge Offres, étape Offres, statut « Contre-offre » |
| Négociation | `#A0521E` (terracotta) | étape Négociation |
| Signé / Succès | `#059669` (vert) | étape Signé, statut « Acceptée », état final |

C'est cette palette qui fait la cohérence chromatique de la page. Ne pas la disperser ailleurs dans la chrome.

---

## 🧱 Modèle de données

Pas de nouvelle entité côté CRM. La page consomme une **vue projetée** du `Bien` + `Deal` + `Offer` + `Agent` existants, exposée au vendeur via un lien personnel. Shape utilisée par la maquette (`PROPERTIES[]` dans le host `MEGGA Votre Vente.html`) :

```ts
type SellerProperty = {
  id: string;
  label: string;              // libellé court pour le switcher (ex. "Villa Cologny")
  title: string;              // titre annonce
  address: string; city: string; canton: string;
  attrs: string[];            // ex. ["4.5 pièces", "120 m²", "Appartement"]
  price: number;              // CHF
  mandate: string;            // "Mandat exclusif" | "Mandat simple"
  daysOnline: number;
  step: 0|1|2|3|4|5;          // index dans STEPS (parcours)
  stats: { visits: { value: number; sub: string } };
  offers: SellerOffer[];
  activity: { text: string; when: string }[];   // timeline (plus récent en premier)
  nextStep: string;           // phrase de réassurance (legacy — l'encart "Prochaine étape" du parcours le remplace désormais)
};

type SellerOffer = {
  amount: number;             // CHF
  status: 'pending' | 'counter' | 'accepted';
  date: string;               // affiché tel quel (ex. "28 mai 2026")
};
```

### Parcours (constantes host)

```js
STEPS = ["Mandat signé", "En ligne", "Visites", "Offres", "Négociation", "Signé"];
// STEP_SENTENCES[0..5] : phrase contextuelle affichée sous l'arc selon l'étape courante.
```

### Calcul de l'étape / des offres
La maquette permet de **forcer** l'étape et les offres via Tweaks (pour la démo). En prod, `current = property.step` et `offers = property.offers` directement — pas de surcharge.

---

## 🔌 Intégrations à brancher (prod)

| Action UI | À câbler |
|---|---|
| **CTA WhatsApp** | `agent.whatsapp` (`https://wa.me/<num>`) |
| **Appeler / Email** | `agent.phone` (`tel:`) / `agent.email` (`mailto:`) |
| **Répondre à l'offre** (modal) | `POST` décision vendeur `{ offerId, decision: 'accept'|'counter'|'refuse', counterAmount? }` → notifie l'agent. **Rien n'est définitif côté acheteur** : la décision est **transmise à l'agent** qui exécute. |
| **Paramètres** | `PATCH` préférences vendeur (notifications e-mail, créneaux de visite, langue, canal de contact). |
| **Galerie / lightbox** | Les photos viennent du `Bien` publié (mêmes assets C2PA que la marketplace). Dans la maquette ce sont des `image-slot` (drop manuel) ; en prod, alimenter `src` avec les URLs réelles. Le badge « +N » doit refléter le **vrai** nombre de photos (voir §Détails). |
| **Dark mode** | Préférence persistée côté vendeur (la maquette la garde en state local). |

---

## 🧩 Détails d'implémentation notables

### Arc de parcours (`SvJourneyCard`)
- **SVG demi-cercle** R=150, segments colorés par étape (`SELLER_STEP_COLORS`), nœuds = points ; nœud actif = anneau coloré + point central.
- **3 colonnes** dans la carte : arc (taille fixe) · liste des 6 étapes · encart « Prochaine étape » (nom de l'étape suivante + pilule de délai estimé `SELLER_NEXT[current]` + phrase). À la dernière étape, l'encart affiche l'état final « Vente finalisée » avec une coche.
- **Liaison interactive** : survoler une étape dans la liste surligne le nœud correspondant sur l'arc (halo + agrandissement), et inversement la ligne s'éclaire (`hovered` state).

### Lightbox galerie (`SvGalleryLightbox`)
- Overlay `position: fixed; z-index: 1000`, backdrop sombre flou.
- Image en grand (`object-fit: contain`), **compteur** « i / N », flèches **Précédente/Suivante**, **bande de miniatures**, **navigation clavier** (`Esc`, `←`, `→`).
- S'ouvre via le bouton **« Voir les photos »** (sur l'image principale) **ou** le badge « +N ».
- État vide propre si aucune photo (« Aucune photo pour le moment »).

### Badge « +N »
- Dans la maquette il est masqué tant qu'aucune photo n'est déposée (`image-slot:not([data-filled]) + .photo-more { display:none }`) et la valeur est **codée en dur (`+5`)**.
- **En prod** : afficher le **vrai** surplus (`photoCount - 4`) et masquer si `photoCount <= 4`.

### Avatar agent (`SvAvatarCircle`)
- Cercle dégradé bleu→cyan avec **initiales** en fallback (« GL ») ; accepte une vraie `photo` si disponible. Présent dans la carte agent **et** le mini du header.

### Formatage
- `sellerFmtCHF(n)` → `CHF 1'250'000` (apostrophe suisse). Tous les nombres en `tabular-nums`.

---

## 📱 Responsive (web only — cf. stratégie mobile V1)

Breakpoints via media queries `!important` sur classes (`.sv-page`, `.sv-twocol`, `.sv-propcard`, `.sv-arc`, `.sv-stats`, `.sv-journey`) dans `seller-sugar-tokens.jsx` (`SELLER_CSS`).

| Largeur | Comportement |
|---|---|
| **> 960px** | 2 colonnes : contenu à gauche, carte agent **sticky** à droite (380px). |
| **≤ 960px** (tablette) | La carte agent passe **sous** le contenu (`position: static`), padding page réduit. |
| **≤ 680px** (mobile) | Carte bien **empilée** (galerie au-dessus des infos), arc **redimensionné** (`width:100%; max-width:340`), jauges qui **s'enroulent**, ligne d'offre qui **wrap**, padding compact. |

> ⚠️ **Piège grid blowout** : sur les grilles qui passent en colonne unique, utiliser `grid-template-columns: minmax(0, 1fr)` (pas `1fr`) sinon un enfant `min-width:auto` déborde → scroll horizontal. Idem, toute ligne flex avec éléments rigides (montant + date `nowrap`) doit avoir `flex-wrap: wrap` pour l'étroit. Cible : `scrollWidth <= clientWidth` à 380px.

---

## ✅ Définition de Done

- [ ] Sugar Pure tenu pixel-près (blanc + noir `#0B0C0E`, ombres, radius, Manrope, `sgFadeUp`)
- [ ] Couleur **uniquement** en data-viz, un concept = une couleur (table ci-dessus) — chrome neutre
- [ ] Parcours : arc segmenté coloré + liste + encart « Prochaine étape » (+ état final « Vente finalisée »)
- [ ] Liaison interactive arc ↔ liste au survol
- [ ] 3 jauges donut (Visites vert / Offres orange / Jours bleu)
- [ ] Switcher multi-biens : tout le contenu suit le bien actif ; masqué si 1 seul bien
- [ ] Lightbox galerie (compteur, flèches, miniatures, clavier, état vide) ouverte par « Voir les photos » et « +N »
- [ ] Badge « +N » = vrai nombre de photos, masqué si ≤ 4
- [ ] Avatar agent initiales en fallback (header + carte)
- [ ] Modal Offre : Accepter / Contre-offrir / Refuser → **transmis à l'agent**, jamais d'action directe côté acheteur
- [ ] Modal Paramètres : notifications, créneaux visites, langue/contact, dark mode
- [ ] Dark mode aligné sur le CRM (`#0A0A0F`), suit toutes les tailles
- [ ] Responsive sans scroll horizontal à 380 / 800 / 1024px
- [ ] CHF avec apostrophes, `tabular-nums` partout

---

## 🐞 Note correctif inclus
La maquette livrée corrige un bug latent : la modal d'offre lisait `PROPERTY.price` (variable supprimée lors du passage au multi-biens) → remplacé par `prop.price` (bien actif).

---
*Espace vendeur MEGGA · Sugar Pure · mai 2026.*
