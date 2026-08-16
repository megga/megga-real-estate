# CLAUDE.md — MEGGA Real Estate

> Instructions persistantes pour ce projet. À lire avant **toute** intervention.

---

> 🚫 **MARKETPLACE SUPPRIMÉE (juin 2026).** La marketplace publique (acheteur grand public : Homepage, Recherche, Bien, Agence, Compte, Vendre, KYC public) **n'existe plus** et a été **supprimée du projet** (`archive-marketplace-v1/` effacé). Le produit MEGGA est désormais **uniquement le CRM agent**. Le besoin acheteur (découverte + « like » de biens) est couvert par le **catalogue de match** intégré au CRM (écran Matching), pas par une marketplace publique. **Ne plus créer de page marketplace.** Le DS **Property X** (`propertyx-*.jsx`) est **conservé uniquement** comme dépendance de l'**Auth** et de l'**Onboarding** du CRM — ne pas l'utiliser pour de nouvelles surfaces.

---

## 🎯 Contexte du projet

> 📱 **Travail mobile / tablette / responsive ?** Lis d'abord `HANDOFF_MOBILE_V1.md` — la stratégie a été actée (Option D · web only V1, app native iOS reportée à 2027).

**MEGGA Real Estate** — plateforme immobilière suisse, **CRM agent** uniquement :
- **CRM agent** (Aujourd'hui, Pipeline, Matching, Parcours, Contacts, Biens, Calendrier, Documents, KYC, Settings)
- Le **catalogue de match** (écran Matching) est le canal acheteur : l'agent envoie une sélection, l'acheteur « like » côté réception → remonte dans le CRM. (Remplace l'ancienne marketplace publique, supprimée.)

Les maquettes hi-fi vivent dans des fichiers `MEGGA *.html` à la racine, alimentés par des composants `.jsx` co-localisés.

> **Marketplace supprimée** (juin 2026) : le dossier `archive-marketplace-v1/` et toutes les pages publiques Property X (Homepage, Recherche, Bien, Agence, Compte, Vendre, KYC public) ont été **effacés**. Ne pas les recréer.

---

## 🧭 Direction artistique

> ⚠️ La marketplace publique étant supprimée, le projet est désormais **mono-direction : Sugar Pure (CRM)**. **Property X** ne subsiste que comme dépendance Auth/Onboarding — voir l'encart en tête de fichier. Ne pas créer de nouvelle surface Property X.

| Surface | Direction | Référence | Tokens |
|---|---|---|---|
| **CRM agent** (Aujourd'hui, Pipeline, Matching, Wizard, Documents…) | **Sugar Pure** | `MEGGA-DESIGN-SYSTEM.md` | `crm-tokens.jsx` |
| _Auth + Onboarding (legacy, conservé)_ | _Property X (dépendance figée)_ | — | `propertyx-tokens.jsx` + `propertyx-atoms.jsx` |

**Partagé** : logo `assets/megga-logo.svg` (wordmark MEGGA complet), `tabular-nums` sur les nombres, formatage CHF avec apostrophes (`'`), iconographie SVG stroke linéaire (zero emoji), voix éditoriale FR-CH.

---

## 🏠 Property X — dépendance Auth/Onboarding (legacy, figée)

> 🚫 **La marketplace publique est supprimée.** Property X ne subsiste **que** comme dépendance des écrans **Auth** (`MEGGA Auth.html`, `megga-auth-*.jsx`) et **Onboarding** du CRM. **Ne créer aucune nouvelle surface Property X.** Pour toute UI nouvelle → **Sugar Pure** (voir ci-dessous).

Si tu dois toucher Auth/Onboarding sans les refondre, consomme les fichiers existants tels quels :
- `propertyx-tokens.jsx` → `window.PX` (palette neutrals `neutral100→700`, typo Objectivity weight max 500, `ls -3 %`, radius pill 200px, ombres neutres), helpers `pxType(name)` / `pxFormatCHF(amount)`, CSS `PX_FONT_FACE_CSS` + `<PxFontFace />`.
- `propertyx-atoms.jsx` → atomes Px (`PxButton`, `PxBadge`, `PxInput`, `PxCircleButton`, `PxIcon`…). Signature : 100 % neutres (aucun accent), pills partout, bouton pill asymétrique à cercle inverse 28×28.
- Assets : `assets/megga-logo.svg`, `assets/megga-favicon.svg`, `assets/fonts/objectivity/*.woff2`.

Ne pas étendre ce DS, ne pas créer de nouvelles pages avec. Tout le reste du produit = CRM Sugar Pure.

---

## 🧭 Direction artistique du CRM : **Sugar Pure** (a.k.a. *Sugar immersive*)

**Toute** nouvelle interface, modal, panneau, écran ou composant du CRM **doit** suivre la grammaire **Sugar Pure**, sans exception.

### Référence canonique numéro 1
👉 **`MEGGA-DESIGN-SYSTEM.md`** — lire en intégralité avant de toucher au CRM.
👉 **Step 0 du wizard** (`crm-wizard-sugar-v2.jsx`, composant `SgGateCard`) — c'est l'incarnation de référence du style.

### Principes non-négociables
1. **Beaucoup d'air.** Hiérarchie par l'espace, pas par les bordures.
2. **Surfaces blanches pures** (`#FFFFFF`) sur fond gradient radial gris-bleu (`#C8D5E0` → `#EDEFF3`).
3. **Ombres douces uniquement** comme séparateur — **JAMAIS** de bordure 1px décorative sur les cards/modals/panels.
4. **Accent unique = NOIR PUR `#0B0C0E`.** Boutons CTA, sélection, ring actif, stepper actif. Aucune couleur ne joue le rôle d'accent UI.
5. **Titres en noir franc `#0B0C0E`.** Jamais de gris pour un titre.
6. **Coins arrondis généreux** : 28px modal, 22px panel, 18px card, 14px sous-card, 12px input, 999px pilule/cercle.
7. **Animation d'entrée** `sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both` sur les cards qui apparaissent.

### Palette Sugar Pure (light)
```
bgCanvas:    radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)
modalBg:     #FFFFFF
cardSubtle:  #F7F8FA
black/ink:   #0B0C0E   ← accent unique + titres
blackHover:  #1F2024
inkSoft:     #3A3D44   ← texte courant
muted:       #7A8088   ← labels, placeholders
ghost:       #B5BAC2   ← disabled
```

### Ombres signature
```
shadowSm:    0 4px 16px rgba(15,23,42,0.04)
shadow:      0 12px 40px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.03)
shadowLg:    0 24px 60px rgba(15,23,42,0.08), 0 4px 16px rgba(15,23,42,0.04)
shadowHov:   0 32px 70px rgba(15,23,42,0.10), 0 6px 20px rgba(15,23,42,0.05)
modalShadow: 0 40px 100px rgba(15,23,42,0.20), 0 8px 24px rgba(15,23,42,0.10)
```

### Couleurs **fonctionnelles** MEGGA (réservées aux données métier — pas à l'UI)
```
Mandat / Bleu :    #1E5BC6
Préparation :      #0891B2  (cyan)
Visites :          #0891B2  (cyan)
Offre :            #C45A00  (orange)
Compromis :        #059669  (vert)
Acte :             #0B0C0E  (noir)
```

Ces couleurs s'utilisent uniquement pour des **pastilles 8px** ou des **pilules de statut / type**. Les **pilules de statut ou de type** (ex. « Bon de visite », « Mandat », « Offre »…) sont **toujours à fond opaque plein de la couleur fonctionnelle + texte BLANC** (jamais de fond teinté clair ~12 % avec texte coloré). Réservé aux données métier — jamais en fond plein dans l'UI générale, jamais en accent de bouton.

### CTA Sugar — bouton noir
```
height: 44–46px, borderRadius: 999px, background: #0B0C0E
hover: background #1F2024 + translateY(-1px) + ombre lift
color: #FFFFFF, fontWeight: 700
```

### Sélection & états actifs
- Card sélectionnée : `boxShadow: "0 0 0 2px #0B0C0E inset, [shadow normal]"` + fond `cardSubtle`
- **Jamais** de fond bleu clair sur sélection.
- Radio/checkbox actifs : background `#0B0C0E`, ✓ blanc.

---

## 🚫 Interdictions absolues dans le CRM

| ❌ Interdit | ✅ À faire |
|---|---|
| Bordure 1px décorative sur card/modal/panel | Ombre douce |
| Couleur en accent UI (bleu vif, violet, vert…) | Noir `#0B0C0E` |
| Violet `#7A4FD8` | N'existe pas dans MEGGA |
| Dégradé coloré en fond | Blanc pur ou gradient radial gris Sugar |
| Fond bleu clair sur sélection | `cardSubtle` + ring noir 2px inset |
| Couleur agence en accent UI | Réservée aux aperçus de documents uniquement |
| Titre en gris | Toujours `#0B0C0E` |
| Glassmorphism agressif, gradients arc-en-ciel | Surfaces sobres + ombres |
| Emoji dans l'UI | Icônes SVG stroke linéaires (cf. `CRMIcon`) |
| `Inter`, `Roboto`, `Arial` | `Manrope` (cohérent site public) ou `ui-sans-serif` |
| Pilule de type redondante avec le titre | Supprimer |
| **Pilule de type (APPEL, KYC, VISITE…) dans un héro / une carte de RDV** | **Jamais — le type se lit déjà via l'icône, l'heure et le libellé. Ne plus en ajouter.** |
| Méta décorative inutile (#views, #usages) | Moins = mieux |
| **Même libellé/mot répété deux fois côte à côte** (ex. sous-texte « Optionnel » + pilule « Optionnel ») | **Jamais — un seul porteur de l'info (pilule OU texte, pas les deux)** |
| **Dot / point de couleur dans une pilule de statut** | **Jamais de dot — pilule pleine + texte seul** |
| **Point médian « · » comme séparateur dans un titre / compteur** (ex. « Deals en cours · 2 ») | **Jamais — écrire « 2 deals en cours » ou « Deals en cours (2) ». Pas de « · » décoratif dans les titres.** |
| Pilule de statut/type à fond teinté clair (~12 %) + texte coloré | **Fond opaque plein de la couleur + texte BLANC** |

---

## 🧱 Composants & utilitaires existants (réutiliser, ne pas réinventer)

### Tokens Property X (Auth/Onboarding uniquement — ne pas étendre)
- `propertyx-tokens.jsx` — `window.PX` (palette neutrals, font, type, space, gap, padding, radius, shadow, transitions), helper `pxType(name)`, formatter `pxFormatCHF(amount)`, CSS `PX_FONT_FACE_CSS` + composant `<PxFontFace />` pour injecter les @font-face Objectivity.
- `propertyx-atoms.jsx` — 10 atomes Px : `PxButton`, `PxCircleButton`, `PxBadge`, `PxInput`, `PxSelect`, `PxTextArea`, `PxCheckbox`, `PxRadio`, `PxToggle`, `PxAvatar`, `PxLink`, `PxLogo`, `PxImage`, `PxSectionLabel`, `PxList`, `PxListItem`, `PxIcon` (catalogue de ~50 icônes line-style).
- Assets : `assets/megga-logo.svg` (wordmark), `assets/megga-favicon.svg`, `assets/fonts/objectivity/*.woff2` (9 weights + italiques).

### Tokens CRM (Sugar Pure)
- `crm-tokens.jsx` — `CRM_TOKENS` (light/dark), `CRM_STAGES`, `CRM_DENSITY`, `crmFmtCHF`, `crmFmtNum`, `crmRelative`, `crmInitials`, `crmPalette(t, dark, tone)`.
- `window.WizardPalette` (a.k.a. `SP`) — palette Sugar v2 utilisée dans le wizard.

### Shell & primitives
- `crm-shell.jsx` — `CRMIcon`, `CRMSidebar`, drawer, AI bubble, cmd+K.
- `crm-screen-today-sugar.jsx` — `CrmTopNav`, `CrmIconRail`, `SugarFrame`, `SugarTeamChip`, `SugarTaskCard`, `CrmRoundIconBtn`, `SugarConnector`.

### Wizard Sugar v2
- `crm-wizard-sugar-v2.jsx` — shell + Step 0 + primitives (`SgGateCard`, `SgBlackPill`, `SgGhostPill`, `SgCircleBtn`, stepper 8 cercles).
- `crm-wizard-sugar-step1..8.jsx` — étapes individuelles. **Lire** `HANDOFF_WIZARD_SUGAR_V2.md` avant de toucher.

### Référence absolue de la grammaire
- `crm-wizard-sugar-v2.jsx` (Step 0)
- `crm-documents-new-modal.jsx` (modal 3 étapes Sugar pur)
- `crm-documents-sugar-studio.jsx` (studio 3 colonnes)

---

## ⚠️ Pièges connus (collisions de noms globaux)

Tous les fichiers `.jsx` Babel partagent le scope global. Les composants chargés en **dernier gagnent**. Pour éviter les collisions :
- Préfixer les composants spécifiques à un fichier (ex. `SgNumStepper` plutôt que `SgStepper` quand `SgStepper` existe déjà ailleurs).
- **Jamais** de `const styles = {...}` en haut d'un fichier — toujours nommer (ex. `const todayStyles = {...}`).
- L'ordre de chargement dans `MEGGA CRM.html` est significatif (cf. `HANDOFF_WIZARD_SUGAR_V2.md`).

---

## 📐 Process de design

### Pour le CRM (Sugar Pure)
1. **Lire** `MEGGA-DESIGN-SYSTEM.md` + le fichier de référence canonique le plus proche du composant à produire.
2. **Réutiliser** les primitives Sugar (`SgGateCard`, `SugarFrame`, `SgBlackPill`, etc.) avant d'en créer.
3. **Vérifier** : aucune bordure décorative, aucun accent coloré, titres en noir franc, ombres douces.
4. **Tweaks** : exposer mode clair/sombre, densité, et toute variation pertinente via `tweaks-panel.jsx`.
5. Pas d'écran "title" dans les prototypes — atterrir directement sur le contenu.

---

## 🇨🇭 Spécificités MEGGA

- **Marché suisse** : prix en CHF avec apostrophes (`crmFmtCHF` → `CHF 1'250'000`), cantons, LBA/LSFin.
- **KYC non-bloquant** dans le pipeline (depuis mai 2026) : le KYC/LBA est un *nice to have*, jamais un verrou. Un deal peut avancer à toutes les étapes (y compris "Intérêt confirmé", "Offre", "Signé") sans KYC validé. On l'affiche comme **rappel doux non-bloquant** (carte claire, libellé "à compléter / optionnel"), jamais comme une bannière "bloqué".
- **Modifier un contact au KYC vérifié = invalidation de la vérif.** Si un contact a un **KYC vérifié** (badge sceau bleu) et qu'on tente de **modifier son identité**, il faut **interrompre par une modale d'avertissement** : prévenir que la modification **invalide la vérification** et que **toute la procédure LBA devra être recommencée**. Actions : `Annuler` / `Modifier` (CTA rouge foncé opaque destructif `#8E1F3D` light · `#E0738C` dark, texte blanc, sans icône). Ne PAS proposer "Supprimer" dans cette modale (confusion). La modale est une bottom-card Sugar qui **épouse le bas au-dessus de la barre de nav flottante** (`margin-bottom: calc(94px + safe-area)`), jamais derrière. Réf. d'implémentation : `crm-contact-detail-mobile-v2.jsx` (`kycWarn`). **Conséquence à l'enregistrement** : dès que la modif est sauvegardée, le KYC repasse de `verified` → `pending` et le **bluecheck (badge sceau bleu) disparaît** (nom + bande KYC). Annuler l'édition conserve la vérif.
- **C2PA** sur les photos publiées.
- **MEGGA AI** présent partout — suggestions contextuelles, jamais d'action auto invisible.
- **Langue** : interface en français (CH).

---

*Dernière mise à jour : juin 2026.*
*Direction unique : CRM = **Sugar Pure** (`MEGGA-DESIGN-SYSTEM.md`). Property X = dépendance figée Auth/Onboarding. Marketplace publique supprimée.*
