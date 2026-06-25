# Handoff — MEGGA CRM (application mobile, version finale)

> **Objectif n°1 : recréer fidèlement la maquette.** Le rendu, les couleurs, la typo, les espacements, les arrondis, les ombres, les animations et les micro-interactions de ces maquettes sont **la cible exacte** à atteindre dans le codebase de production. En cas de doute, **la maquette fait foi**. Ne pas « réinterpréter » le design.

---

## 1. Vue d'ensemble

Ce pack contient la **version mobile finale, prête pour la prod**, du **CRM agent MEGGA** — plateforme immobilière suisse. Le produit est **uniquement le CRM agent** (il n'y a plus de marketplace publique). Le canal acheteur passe par l'écran **Matching** (catalogue de match envoyé par l'agent).

Écrans couverts : Aujourd'hui · Pipeline · Matching (+ réglages, nouvelle recherche) · Agenda (+ time-blocking) · Mes biens (liste + fiche) · Créer un bien (wizard 7 étapes) · Contacts (liste, fiche, création) · KYC/LBA · Parcours · Analytics · Paramètres · Notifications · Détail affaire (deal) · Session de relance.

---

## 2. À propos des fichiers de ce bundle

⚠️ **Ce sont des références de design, pas du code de production à copier tel quel.**

Les fichiers `.html` + `.jsx` sont des **prototypes haute-fidélité** rendus dans le navigateur via **Babel standalone** (transpilation à la volée). Caractéristiques à connaître :

- **React 18 UMD + Babel in-browser**, pas de build.
- **Scope global partagé** : tous les `.jsx` s'exécutent dans le même scope ; les composants sont exposés sur `window.*`. *(C'est une contrainte du prototype, pas un patron de prod — voir §11.)*
- Les données sont **mockées** dans les fichiers `*-data.jsx` (`window.CRM_BIENS`, `window.CRM_CONTACTS`, etc.).

**La tâche** : **recréer ces écrans dans l'environnement du codebase cible** (React/Next, etc.) en utilisant ses patterns établis (composants, design tokens, state management, data layer). Si aucun environnement n'existe encore, choisir le framework adapté (React + TypeScript recommandé) et y implémenter les designs. **On ne livre pas le HTML/Babel tel quel.**

### Comment visualiser la maquette
Ouvrir **`MEGGA Responsive - App Mobile.html`** dans un navigateur : un lanceur latéral permet de naviguer vers chaque écran, avec bascule **clair / sombre**. (`MEGGA Responsive - Mes Biens Mobile.html` et `MEGGA Responsive - Créer un bien Mobile.html` rendent ces deux surfaces en isolé, clair + sombre côte à côte.)

---

## 3. Fidélité : **HAUTE (hi-fi)**

Maquettes pixel-perfect : couleurs, typographie, espacements et interactions sont **définitifs**. Le développeur doit **reproduire l'UI au pixel** avec les librairies/patterns du codebase, pas approximer.

---

## 4. Direction artistique : **Sugar Pure** (non négociable)

Lire **`MEGGA-DESIGN-SYSTEM.md`** (référence canonique) et **`CLAUDE.md`** (règles persistantes). Résumé opérationnel :

**Principes**
1. Beaucoup d'air — hiérarchie par l'espace, pas par les bordures.
2. Surfaces **blanches pures** (`#FFFFFF`) sur fond gradient radial gris-bleu.
3. **Jamais de bordure 1px décorative** sur card/modal/panel → séparation par **ombre douce** uniquement.
4. **Accent unique = NOIR PUR `#0B0C0E`** (CTA, sélection, états actifs). Aucune couleur ne joue le rôle d'accent UI.
5. **Titres en noir franc `#0B0C0E`**, jamais gris.
6. Arrondis généreux : 28 modal · 22 panel · 18 card · 14 sous-card · 12 input · 999 pilule.
7. Animation d'entrée `sgFadeUp/mwFadeUp .45–.5s cubic-bezier(.2,.8,.2,1) both`.

**Palette (clair)**
```
bgCanvas    radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)
modalBg     #FFFFFF      cardSubtle  #F7F8FA
black/ink   #0B0C0E  (accent unique + titres)     blackHover #1F2024
inkSoft     #3A3D44      muted #7A8088      ghost #B5BAC2
```
**Palette (sombre)** — tokens dans `crm-tokens.jsx` (`MT_DARK`) : card `#17181A`, cardSubtle `#1F2023`, ink `#ECEDF3`, accent `#F2F2F6`.

**Ombres signature**
```
shadowSm  0 4px 16px rgba(15,23,42,.04)
shadow    0 12px 40px rgba(15,23,42,.06), 0 2px 8px rgba(15,23,42,.03)
shadowLg  0 24px 60px rgba(15,23,42,.08), 0 4px 16px rgba(15,23,42,.04)
modal     0 40px 100px rgba(15,23,42,.20), 0 8px 24px rgba(15,23,42,.10)
```

**CTA noir** : hauteur 44–46, radius 999, fond `#0B0C0E`, texte blanc 700 ; hover `#1F2024` + translateY(-1px) + ombre.

**Sélection / actif** : `boxShadow: 0 0 0 2px #0B0C0E inset` + fond `cardSubtle`. **Jamais** de fond bleu clair.

**Couleurs fonctionnelles métier** (réservées aux données, jamais en accent UI) — pilules **à fond plein opaque + texte BLANC** :
```
Mandat/Vente #1E5BC6 · Préparation/Visites #0891B2 · Offre #C45A00 · Compromis #059669 · Acte #0B0C0E
```

**Typo** : **Manrope** (400–800), via Google Fonts. Nombres en `tabular-nums`. **Iconographie** : SVG **stroke linéaire** (composant `MEIcon`/`MIcon`), **zéro emoji**.

---

## 5. Navigation

- **Barre d'onglets flottante (pilule)** en bas, 5 destinations : **Aujourd'hui · Pipeline · Matching · Agenda · Plus**. Onglet actif = pilule noire, label qui s'étend (animation flex-grow).
- Les autres surfaces (Contacts, Mes biens, Parcours, KYC, Analytics, Paramètres, Créer un bien) se rejoignent depuis **« Plus »**.
- Écrans secondaires (création, détails) : header avec bouton **retour** rond, pas de tab bar.
- Cibles tactiles **≥ 44 px**.

---

## 6. Inventaire des écrans

> Pour chaque écran, le **détail pixel** se lit dans le `.jsx` indiqué. Tous sont theme-aware (clair/sombre).

| Écran | Fichier(s) | But & éléments clés |
|---|---|---|
| **Aujourd'hui** | `crm-mobile-today.jsx` | Cockpit condensé : file de priorités (carte photo héros), stats Pipeline + Objectif, agenda du jour, relances IA (bloc accent immersif). |
| **Pipeline** | `crm-pipeline-mobile.jsx` | 6 phases (couleurs fonctionnelles), cartes affaires par phase, « +N autres », mini-jauge de probabilité, onglets d'étape (scroll horizontal). **KYC NON-bloquant.** |
| **Détail affaire** | `crm-deal-detail-mobile.jsx` | Stepper 8 étapes, anneau de probabilité, hero photo, prochaine action (carte noire), parties (acheteur/bien), négociation offre/contre-offre, activité, docs + notes, focus « Traiter ». |
| **Matching** | `crm-matching-mobile.jsx` (+ `-settings-`, `-newsearch-`) | Catalogue de match : carte acheteur (liste) ↔ focus (critères éditables inline), jauge de match monochrome, verdict qualitatif, KYC rappel doux non-bloquant, badge « verified » (sceau). |
| **Agenda** | `crm-agenda-mobile.jsx` (+ `-timeblock`) | Sélecteur de semaine (strip), hero prochain RDV, timeline horaire, feuille de détail, création d'événement, mode **time-blocking**. |
| **Mes biens** | `crm-biens-mobile.jsx` | Liste catalogue ↔ fiche bien (4 onglets : Aperçu / Performance / Demandes / Historique). Recherche, filtres, menu ••• (dupliquer, changer statut, retirer, **supprimer avec confirmation**), actions globales (importer, trier), galerie plein écran. |
| **Fiche bien (vitrine)** | `crm-bien-vitrine-mobile.jsx`, `crm-bien-vitrine-kit.jsx` | Aperçu public du bien : galerie, specs, diffusion, vendeur. Photos **C2PA** (le **virtual staging IA est retiré en V1**). |
| **Créer un bien (wizard)** | `crm-mobile-wizard-core/steps/final.jsx` | 7 étapes : Démarrer → Vendeur/Mandat → Adresse → Caractéristiques → Photos → Prix & description → **Publication** (aperçu d'annonce en carte Sugar) → succès. Footer d'action fixe, stepper de progression. **Pas d'étape « Options »/staging.** |
| **Contacts** | `crm-contacts-list-mobile.jsx`, `crm-contact-detail-mobile-v2.jsx`, `crm-contact-new-mobile.jsx` | Liste segmentée → fiche (critères acheteur / stats vendeur, matchs, activité, deals liés, KYC) ; création de contact. **Édition d'un contact KYC vérifié → modale d'invalidation** (voir §9). |
| **KYC / LBA** | `crm-kyc-mobile.jsx` | Liste dossiers → détail (Synthèse / Contrôles / Documents / Audit), ajout de pièce, signalement de risque. **Non bloquant.** |
| **Parcours** | `crm-parcours-mobile.jsx` | Bandeau équipe (filtre agent), stepper 4 étapes, cartes dossier, drill-in workflow. |
| **Analytics** | `crm-analytics-mobile.jsx` | Héros commission projetée, carte trajectoire (mini area chart + objectif), KPI 2×2, drilldowns (bottom-sheets), sources des deals, segmented période. |
| **Paramètres** | `crm-settings-mobile.jsx` (+ `-sections`) | Hub hero + tuiles → sections (Profil, Agence, Notifications…), anneau de complétude, feuille photo de profil. |
| **Notifications** | `crm-notif-mobile.jsx` | Feuille (depuis « Plus » → cloche) : digest « L'essentiel » (priorités), liste groupée (Aujourd'hui/Hier/Plus tôt), « Tout lire ». |
| **Session de relance** | `crm-relance-session-mobile.jsx` | Boucle séquentielle « une relance à la fois ». |

---

## 7. Interactions & comportements transverses

- **Bottom-sheets** (détails, filtres, drilldowns) : carte arrondie qui **épouse le bas au-dessus de la barre de nav flottante** (`margin-bottom: calc(94px + safe-area)`), poignée en haut, overlay sombre, animation `translateY(100%) → 0` en `.3s cubic-bezier(.2,.8,.2,1)`.
- **Menus d'action** (`crm-action-menu.jsx`, `window.SgActionMenu`) : feuilles d'options (icône + libellé), action destructive en rouge.
- **Toasts** : pilule noire (clair) / claire (sombre), centrée, auto-dismiss ~2,2 s.
- **Mode clair/sombre** : persité (`localStorage`), tous les écrans sont theme-aware.
- **Animations d'entrée** : `sgFadeUp` / `mwFadeUp` (opacity+translateY) gating-friendly ; respecter `prefers-reduced-motion`.
- **Confirmations destructives** : CTA rouge foncé opaque `#8E1F3D` (clair) / `#E0738C` (sombre), texte blanc.

---

## 8. État & données

- Données mockées dans `crm-data.jsx`, `crm-biens-data.jsx`, `crm-kyc-data.jsx`, `crm-parcours-data.jsx`, `crm-sprint2-data.jsx`, `crm-dashboard-relance-data.jsx`, `analytics/analytics-tokens.jsx`.
- En prod : remplacer par la **data layer** réelle (API). Conserver les **mêmes formes d'objet** (ex. un bien : `id, title, addr, canton, transaction, price/rent, area, rooms, beds, baths, status, ownerContactId, stats, mandat, publishedTo, photoCount`).
- État local par écran : sélection, filtres, recherche, onglet actif, ouverture de sheets, mode clair/sombre.

---

## 9. Spécificités suisses (à respecter)

- **CHF avec apostrophes** : `CHF 1'250'000` (helper `crmFmtCHF`). Nombres `tabular-nums`.
- **Cantons** suisses ; cadre **LBA / LSFin**.
- **KYC NON-bloquant** dans le pipeline : un deal avance à toutes les étapes sans KYC validé. Affichage en **rappel doux**, jamais en bannière « bloqué ».
- **Invalidation KYC** : modifier l'identité d'un contact au **KYC vérifié** (badge sceau bleu) déclenche une **modale d'avertissement** (la modif invalide la vérif, la procédure LBA doit être recommencée) — actions `Annuler` / `Modifier` (destructif). À l'enregistrement : `verified → pending`, le **bluecheck disparaît**. Réf. `crm-contact-detail-mobile-v2.jsx` (`kycWarn`).
- **C2PA** sur les photos publiées (provenance). ⚠️ Le **virtual staging IA** est **retiré pour la V1** — C2PA reste, le staging non.
- **MEGGA AI** présent partout : suggestions contextuelles, **jamais d'action automatique invisible**.
- **Langue** : interface en **français (CH)**.

---

## 10. Réconciliation Mobile ↔ Desktop (PC)

Voir **`HANDOFF_MOBILE_VS_DESKTOP.md`**. La version mobile (ce pack) est la **source de vérité**. Le desktop est obsolète sur plusieurs points (staging à retirer, verrou KYC bloquant à supprimer, actions « Mes biens » à porter, modale d'invalidation KYC à ajouter, soumissions à trancher, Settings desktop à finir). À traiter lors de l'implémentation desktop.

---

## 11. Notes d'implémentation (prototype → prod)

- **Ne pas reproduire le scope global** : en prod, vrais modules/imports, composants isolés, pas de `window.*`. *(Dans le prototype, les fichiers partageant le scope Babel imposent des préfixes uniques — ex. `Bm*` pour Mes biens — pour éviter les collisions ; cette contrainte disparaît avec de vrais modules.)*
- Remplacer les `<style>` inline et les objets de style par le système de styles du codebase (CSS modules / styled / Tailwind…), en **conservant exactement les valeurs** (couleurs, radius, ombres, tailles).
- Extraire les **tokens** (§4) en variables/thème ; brancher clair/sombre sur le thème de l'app.
- Icônes : porter `MEIcon` vers la librairie d'icônes du codebase **en gardant le tracé linéaire** et l'absence d'emoji.
- Accessibilité : cibles ≥ 44 px, `aria-label` sur les boutons-icônes, respect `prefers-reduced-motion`.

---

## 12. Critères d'acceptation (fidélité)

- [ ] Chaque écran correspond **au pixel** à la maquette (clair **et** sombre).
- [ ] Palette Sugar Pure exacte ; **aucune bordure décorative**, accent **noir uniquement**, titres noir franc.
- [ ] Arrondis, ombres, espacements conformes au §4.
- [ ] Bottom-sheets qui épousent le bas au-dessus de la nav flottante.
- [ ] CHF formaté avec apostrophes, `tabular-nums`.
- [ ] KYC non-bloquant + modale d'invalidation à l'édition d'un contact vérifié.
- [ ] Pas de virtual staging IA (V1) ; C2PA conservé.
- [ ] Animations d'entrée + `prefers-reduced-motion`.
- [ ] Zéro emoji ; icônes stroke linéaires.

---

## 13. Fichiers du bundle

**Toutes les pages mobiles du projet sont incluses** (23 HTML). Point d'entrée recommandé : **`MEGGA Responsive - App Mobile.html`** (app complète navigable, clair/sombre). Chaque écran existe aussi en **page isolée** (clair + sombre côte à côte) :

- App agrégée : `MEGGA Responsive - App Mobile.html`, `MEGGA CRM Mobile - Plein écran.html`
- Aujourd'hui : `MEGGA Responsive - Aujourdhui Mobile.html`
- Pipeline : `MEGGA Responsive - Pipeline Mobile.html`
- Matching : `MEGGA Responsive - Matching Mobile.html`
- Agenda : `MEGGA Responsive - Agenda Mobile.html`, `… - Agenda Mobile - Time-blocking.html`
- Mes biens : `MEGGA Responsive - Mes Biens Mobile.html`, fiche : `… - Fiche Bien Mobile.html`
- Créer un bien : `MEGGA Responsive - Créer un bien Mobile.html`
- Contacts : `… - Contacts Mobile.html`, fiche v2 : `… - Contact Mobile v2.html`, fiche v1 (legacy) : `… - Contact Mobile.html`
- KYC : `… - KYC Mobile.html`
- Parcours : `… - Parcours Mobile.html`
- Analytics : `… - Analytics Mobile.html`
- Paramètres : `… - Paramètres Mobile.html`
- Plus / hub : `… - Plus Mobile.html`
- Détail affaire : `… - Détail deal Mobile.html`
- Synthèse IA (mandat) : `MEGGA Synthese IA - Mobile.html`
- Onboarding device : `MEGGA Mobile - QR Code.html`
- Wireframes (réf. lo-fi) : `MEGGA Wireframes - Fiche Contact Mobile.html`, `… - Notifications Mobile.html`

> Note : `Contact Mobile.html` (v1) et les **Wireframes** sont des références **legacy / lo-fi** ; la cible hi-fi est la v2 et les écrans de l'app. `Plein écran` = même app sans le chrome du lanceur.

- **Écrans `.jsx`** : voir l'inventaire §6 (38 fichiers, tous inclus).
- **Socle** : `ios-frame.jsx` (bezel device), `crm-meicon.jsx` (icônes), `crm-tokens.jsx` (tokens clair/sombre), `crm-action-menu.jsx`, `crm-bien-vitrine-kit.jsx`, `crm-mobile-today.jsx` (primitives partagées).
- **Données mockées** : `crm-*-data.jsx`, `analytics/analytics-tokens.jsx`.
- **Assets** : `assets/whatsapp.svg` (le logo MEGGA est dessiné en SVG inline ; police Manrope via Google Fonts).
- **Docs** : `MEGGA-DESIGN-SYSTEM.md`, `CLAUDE.md`, `HANDOFF_MOBILE_VS_DESKTOP.md`, `HANDOFF_MOBILE_V1.md`, `HANDOFF_MOBILE_V1_FEATURES.md`.
