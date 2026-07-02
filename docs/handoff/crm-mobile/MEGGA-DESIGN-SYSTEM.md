# MEGGA CRM — Direction Artistique : **Sugar Pure**

> **Ce document est la référence absolue pour le CRM MEGGA.** Toute nouvelle interface, modal, composant ou vue du CRM doit suivre ces règles sans exception.
>
> Le style s'appelle **Sugar Pure** — il a été défini et affiné lors de la création du **Step 0 du wizard** (`crm-wizard-sugar-v2.jsx`, composant `SgGateCard`). C'est à partir de ce moment que la direction visuelle a trouvé sa cohérence. Depuis, tous les modals et panneaux du CRM qui suivent ce style donnent des résultats nettement supérieurs. **En cas de doute, le Step 0 du wizard est la référence canonique numéro 1.**

---

## 1. Nom du style : **Sugar Pure** (spécifique au CRM MEGGA)

Sugar Pure est le langage visuel du CRM MEGGA. Il se distingue du Sugar générique par une application rigoureuse et sans compromis :
- **Beaucoup d'air** — peu d'éléments, hiérarchie par l'espace
- **Surfaces blanches pures** sur fond clair
- **Ombres douces** comme seul séparateur — jamais de bordures décoratives
- **Accent unique = NOIR PUR** — pas de couleur comme accent UI
- **Typo noire franche** — jamais de gris pour les titres
- **Beaucoup d'air** — peu d'éléments, hiérarchie par l'espace
- **Surfaces blanches pures** sur fond clair
- **Ombres douces** comme seul séparateur — jamais de bordures décoratives
- **Accent unique = NOIR PUR** — pas de couleur comme accent UI
- **Typo noire franche** — jamais de gris pour les titres

---

## 2. Palette de tokens

### Light mode
```
bgCanvas:    radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)
modalBg:     #FFFFFF
cardSubtle:  #F7F8FA
black:       #0B0C0E   ← accent unique, boutons CTA, sélection
blackHover:  #1F2024
ink:         #0B0C0E   ← titres, h1, h2 — NOIR FRANC
inkSoft:     #3A3D44   ← texte courant
muted:       #7A8088   ← labels secondaires, placeholders
ghost:       #B5BAC2   ← désactivé
```

### Dark mode
```
modalBg:     #16161F
cardSubtle:  #1E1E2A
black:       #ECEDF3
ink:         #ECEDF3
inkSoft:     #B5B7C4
muted:       #797D90
ghost:       #3F4252
```

### Ombres signature Sugar
```
shadow:      0 12px 40px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.03)
shadowSm:    0 4px 16px rgba(15,23,42,0.04)
shadowLg:    0 24px 60px rgba(15,23,42,0.10), 0 4px 16px rgba(15,23,42,0.05)
shadowHov:   0 32px 70px rgba(15,23,42,0.12), 0 6px 20px rgba(15,23,42,0.05)
modalShadow: 0 40px 100px rgba(15,23,42,0.20), 0 8px 24px rgba(15,23,42,0.10)
```

---

## 3. Couleurs fonctionnelles MEGGA (phases & statuts)

Ces couleurs sont **réservées aux données métier** uniquement — jamais comme accent UI.

```
Mandat / Bleu :    #1E5BC6
Préparation :      #0891B2  (cyan)
Visites :          #0891B2  (cyan)
Offre :            #C45A00  (orange)
Compromis :        #059669  (vert)
Acte :             #0B0C0E  (noir)
```

### ❌ Couleurs interdites
- **Violet `#7A4FD8`** — absent de la charte MEGGA, ne jamais utiliser
- **Dégradés colorés** comme fond de modal ou card
- Couleur agence comme accent dans l'UI (réservé aux aperçus de documents)

---

## 4. Règles de surface

| Élément | Règle |
|---|---|
| Modal / Panel | Fond `#FFFFFF` (light) ou `#16161F` (dark) — **AUCUNE bordure** |
| Cards | Fond blanc pur, **ombres douces uniquement** comme séparateur |
| Cards imbriquées | Fond `cardSubtle` (#F7F8FA) |
| Coins | `borderRadius: 28px` (modal), `22px` (panel), `18px` (card), `14px` (sous-card), `12px` (input), `999px` (pill/bouton) |
| Bordures | **Interdites sur les surfaces** — utiliser les ombres. Acceptées uniquement pour les inputs et tables denses |
| Overlay modal | `rgba(15,23,42,0.38)` + `backdropFilter: blur(8px)` |

---

## 5. Règles typographiques

```
Titre modal :       24px, fontWeight 700, letterSpacing -0.6px
Titre card :        18–19px, fontWeight 700, letterSpacing -0.3px
Label section :     10.5–11px, fontWeight 800, letterSpacing .09em, UPPERCASE, color: muted
Corps :             13–13.5px, fontWeight 500, color: inkSoft
Meta / sous-titre : 11.5–12px, color: muted
```

**Règle absolue** : les titres sont toujours `ink` (`#0B0C0E`) — jamais de gris pour un titre.

---

## 6. Boutons

### CTA principal — "Bouton noir Sugar"
```
height: 44–46px
borderRadius: 999px
background: #0B0C0E → hover: #1F2024
color: #FFFFFF
fontWeight: 700
boxShadow: 0 6px 16px rgba(11,12,14,0.18) → hover: 0 12px 30px rgba(11,12,14,0.25)
transform: hover → translateY(-1px)
```

### Bouton ghost / secondaire
```
height: 44px
borderRadius: 999px
border: 0
background: transparent → hover: cardSubtle
color: inkSoft
```

### ❌ Jamais
- Bouton CTA avec couleur agence (bleu, vert…) dans l'UI
- Bouton avec bordure colorée
- Bouton avec dégradé

---

## 7. Sélection & états actifs

```
Card sélectionnée : boxShadow: "0 0 0 2px #0B0C0E inset, [shadow normal]"
Radio button :      cercle 22px, background #0B0C0E quand actif, ✓ blanc
Checkbox :          carré 18px borderRadius 6px, background #0B0C0E quand actif, ✓ blanc
Fond sélection :    cardSubtle (#F7F8FA) — JAMAIS bleu clair
```

---

## 8. Hover & animations

```
Cards :     transform: translateY(-3px), boxShadow → shadowHov, transition: .25s cubic-bezier(.2,.8,.2,1)
Boutons :   transform: translateY(-1px), boxShadow lift, transition: .18s ease
Retour :    translateX(-2px) sur hover
Close ×:    rotate(90deg) sur hover
Flèche → : translateX(4px) sur hover
```

---

## 9. Modales & wizards — structure obligatoire

```
┌─────────────────────────────────┐
│  [← retour]  [stepper 1●─2─3]  [×] │  ← header sans bordure, padding 22px
│  Titre 24px bold                    │  ← padding 6px 30px 20px
├─────────────────────────────────┤
│                                     │  ← body scrollable, padding 4px 26px
│  [contenu de l'étape]               │
│                                     │
├─────────────────────────────────┤
│  [Annuler/Retour]   [CTA noir →] │  ← footer sans bordure, padding 16–20px
└─────────────────────────────────┘
```

- Fond du modal : gradient radial Sugar (light) ou `#16161F` (dark)
- Cards intérieures : blanches pures avec ombres
- Stepper : cercles 24px connectés par barres 18px×2px
- Bouton close : rond 34px, rotation 90° au hover

---

## 10. Éléments de données (phases, statuts)

Les **pilules de statut** utilisent des fonds colorés très légers (opacité ~12%) avec la couleur de phase correspondante — jamais en fond plein coloré sauf dans les icônes d'action.

Les **indicateurs de phase** sont toujours des pastilles colorées 8px diameter.

---

## 11. Ce qui est interdit — résumé

| ❌ Interdit | ✅ Alternative |
|---|---|
| Fond bleu clair sur sélection | cardSubtle + ring noir 2px inset |
| Violet `#7A4FD8` | Bleu MEGGA `#1E5BC6` ou noir |
| Bordures décoratives sur cards/modals | Ombres douces |
| Dégradés colorés en fond | Blanc pur ou gradient radial gris Sugar |
| Couleur agence en accent UI | Noir `#0B0C0E` |
| `rgba(...)` transparent sur surface sombre | Surface solide dérivée du dark theme |
| Pilules de type redondantes avec le titre | Supprimer la pilule |
| Méta inutile (pages, utilisations) si déjà affiché | Moins = mieux |
| `Inter`, `Roboto`, `Arial` | Police système ou `ui-sans-serif` |
| Emoji dans l'UI | Icônes SVG linéaires stroke |

---

## 12. Fichiers de référence canoniques

| Fichier | Ce qu'il illustre |
|---|---|
| `crm-wizard-sugar-v2.jsx` | Step 0 — palette complète, SgGateCard, SgBlackPill, stepper |
| `crm-documents-new-modal.jsx` | Modal 3 étapes Sugar pur |
| `crm-documents-sugar-studio.jsx` | Studio 3 colonnes sur canvas Sugar |
| `crm-documents-template-editor.jsx` | Éditeur de template Sugar |
| `crm-documents-sugar-right.jsx` | Viewer PDF inline |
| `crm-documents-sugar-living.jsx` | Drag & drop entre phases |

---

*Dernière mise à jour : Mai 2026 — MEGGA Real Estate CRM*
