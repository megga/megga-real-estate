# CLAUDE.md — MEGGA Real Estate

> Instructions persistantes pour ce projet. À lire avant **toute** intervention.

---

> 🚫 **MARKETPLACE SUPPRIMÉE (juin 2026).** La marketplace publique (acheteur grand public : Homepage, Recherche, Bien, Agence, Compte, Vendre, KYC public) **n'existe plus** et a été **supprimée du projet** (`archive-marketplace-v1/` effacé). Le produit MEGGA est désormais **uniquement le CRM agent**. Le besoin acheteur (découverte + « like » de biens) est couvert par le **catalogue de match** intégré au CRM (écran Matching), pas par une marketplace publique. **Ne plus créer de page marketplace.** Le DS **Property X** (`propertyx-*.jsx`) est **conservé uniquement** comme dépendance de l'**Auth** et de l'**Onboarding** du CRM — ne pas l'utiliser pour de nouvelles surfaces.

---

## 🎯 Contexte du projet

> 📱 **Travail mobile / tablette / responsive ?** Lis d'abord `HANDOFF_RESPONSIVE_V3.md` (acté 25 juil. 2026) : **plus jamais de fork** — le responsive vit DANS `MEGGA CRM.html`, additif par paliers (≥ 1280 desktop intact · 768–1279 rail · < 768 bottom tabs + layouts pensés mobile). L'ancien fork mobile/tablette de juin est gelé dans `archive-responsive-v2/` — ne rien réactiver. Stratégie produit (Option D · web only V1, app native reportée 2027) : `HANDOFF_MOBILE_V1.md`, toujours valide.

**MEGGA Real Estate** — plateforme immobilière suisse, **CRM agent** uniquement :
- **CRM agent** (Aujourd'hui, Pipeline, Matching, Parcours, Contacts, Biens, Calendrier, Documents, KYC, Settings)
- Le **catalogue de match** (écran Matching) est le canal acheteur : l'agent envoie une sélection, l'acheteur « like » côté réception → remonte dans le CRM. (Remplace l'ancienne marketplace publique, supprimée.)

Les maquettes hi-fi vivent dans des fichiers `MEGGA *.html` à la racine, alimentés par des composants `.jsx` co-localisés.

> **Marketplace supprimée** (juin 2026) : le dossier `archive-marketplace-v1/` et toutes les pages publiques Property X (Homepage, Recherche, Bien, Agence, Compte, Vendre, KYC public) ont été **effacés**. Ne pas les recréer.

---

## 📌 Backlog acté — Réception acheteur (page de like) · À FAIRE PLUS TARD

> Acté juillet 2026. **Ne PAS construire sans demande explicite de l'utilisateur.** Le « like » acheteur est conservé ; il manque la surface côté acheteur.

**Quoi** : la page privée que l'agent transmet depuis le Matching, où l'acheteur (ex. Sophie) consulte la sélection de biens et réagit : **♥ liker · écarter (avec motif) · simplement consulter**. Chaque réaction remonte automatiquement dans le CRM (fiche contact + recalibrage du matching). C'est la moitié acheteur de la « boucle de match ».

**Ce que ce N'EST PAS** : une marketplace publique (interdit, cf. encart en tête). Page **privée, par contact**, alimentée par le Matching — pas de recherche globale, pas de compte public.

**Principes actés** :
- **Zéro email.** Transmission par lien privé (magic link, sans mot de passe) via WhatsApp/SMS. (Pas d'app native MEGGA — donc pas de notification push.)
- **Mobile-first** (l'acheteur ouvre sur son téléphone) · grammaire **Sugar Pure** (mono-direction, pas de Property X) · photos C2PA.
- Tracking consigné automatiquement : transmis → ouvert (durée) → liké / écarté. L'agent **voit** tout mais n'agit jamais « à la place » de l'acheteur.

**Plan (dans l'ordre, quand on s'y met)** :
1. **Choisir la stratégie de retour** côté fiche contact — canvas `Fiche contact — Boucle de match (exploration).html` (A Fil du dossier · B Signal au sommet · C Journal unifié · D Réception miroir — reco : B+A, combinables).
2. **Maquetter la page réception acheteur** (mobile) : en-tête agent/agence, sélection de biens (cards photo + prix CHF), fiche bien légère, geste like / écarter avec motif.
3. **Câbler la boucle dans le CRM** : retours dans la fiche contact (stratégie choisie à l'étape 1) + signal agent côté Today/Matching.
4. **Adapter la modale « Transmettre le dossier »** du Matching : afficher le canal réel (WhatsApp / SMS) au lieu du vague « notification envoyée ».

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

### Accent dataviz Dashboard (exception actée juillet 2026)
`#6F8CFF` périwinkle (dark : `#8CA3FF`, déclinaisons soft/ghost dans `analytics/analytics-fusion.jsx` → `AXF_ACCENTS`) = couleur **réservée aux graphiques du Dashboard** : courbe de trajectoire, treemap de composition, colonnes de sources, sparklines, pace bar. **Jamais en accent UI** — boutons, sélection, ring, titres restent noirs. Le Dashboard est désormais **mono-écran** (fusion Performance + Analyse, wireframe « A — Trajectoire dominante », pager 2 pages supprimé) — réf. `analytics/analytics-fusion.jsx` (`CRMScreenDashboardFusion`).
**Variantes actées (juil. 2026)** : héro « Double stat » (Réalisé/Reste + pace bar muette) · composition en **treemap vertical** cliquable · trajectoire **immersive + cône d'incertitude** (zéro grille, chips, survol fluide avec écart coloré vs objectif) · sources en **colonnes** relatives au meilleur canal · KPI « Aire » (sparkline en bandeau bas) · drill = **popover ancré** (clic dehors/Échap, scroll interne, « Ouvrir les N dossiers dans le Pipeline »). Changement de période = transitions **sur place** (aucun remount — count-up, flex-grow animé, fondu du graphe seul). Backlog (ne pas construire sans demande) : page basse « Rétrospective » (N-1, saisonnalité, encaissé) — wireframer d'abord.

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

### Modales & surfaces flottantes en MODE SOMBRE (règle actée, juillet 2026 · révisée juil. 2026)
- **Toujours OPAQUES.** Jamais `rgba(255,255,255,0.0X)` (translucide → « bento invisible » sur l'overlay). Les tokens `card`/`cardSub` translucides des palettes (VxSP_DARK, galSurfaces…) ne servent qu'aux cards posées SUR le fond de page, jamais aux modales/menus flottants. **Cette partie de la règle est absolue.**
- **La teinte suit le ton sombre actif — ne plus coder de gris neutre en dur.** Une surface flottante prend le **palier haut de l'échelle** via `crmStep("s4", …)`. En **Graphite** (défaut) c'est `#21242F` ; en **Noir pur** le littéral historique `#17181A` sert de repli. L'ancienne formulation « toujours gris NEUTRE, jamais gris-bleu » ne vaut plus que pour Noir pur.

### Échelle sombre — teinte **Graphite** (défaut produit, acté 29 juil. 2026)
Échelle **opaque** tenue entre `#12161C` et `#21242F`, 5 paliers d'écart de luminance constant (~1,04). Source unique : `CRM_GRAPHITE` dans `crm-tokens.jsx`.

| Palier | Valeur | Rôle |
|---|---|---|
| S0 | `#12161C` | canvas — `t.bg` / `sp.pageBg`, fond de toutes les pages et fiches |
| S1 | `#161A21` | cadre bento, rail d'icônes, top nav — `sp.frameBg` |
| S2 | `#1A1D26` | cards, colonnes kanban, lignes de liste — `sp.cardBg` |
| S3 | `#1D212A` | sous-cards, inputs, chips, hover de card — `sp.cardSubBg` |
| S4 | `#21242F` | **plafond** — modales, popovers, menus, palette de commandes — `sp.solidBg` |

**Règles de l'échelle :**
1. **Jamais de blanc translucide en REMPLISSAGE** — `rgba(255,255,255,α)` ne sert plus que de **filet** (α ≤ .06) ou de voile SUR l'accent. Au-delà de α .07 sur `#12161C` on dépasse le plafond et on lave la teinte.
2. **Les sous-surfaces d'une modale se CREUSENT** (`solidBgSub` = S3 < `solidBg` = S4). On ne monte jamais au-dessus du plafond ; la plage reste étanche.
3. **`muted` remonte à `#868A9C`** dans cette teinte — `#797D90` tombait à 4,45:1 sur S0 (sous AA).
4. **Comment consommer :** d'abord `sp.*` (`cardBg`, `cardSubBg`, `solidBg`…), qui suit tout seul. Pour un littéral local, `crmStep("s3", "<valeur historique>")` — deux signatures, `crmStep(step, fallback)` (lit la teinte active, aucune dépendance de scope) ou `crmStep(sp, step, fallback)`. **À n'utiliser que dans une branche déjà gardée par `dark ? … : …`.** Pour un objet de palette monté une fois, préférer un **getter** (`get card() { return crmStep("s2", "#17181A"); }`) afin que la teinte reste vivante.
5. **Teintes proposées à l'agent** : Graphite (défaut) et Noir pur, choisies dans **Réglages › Préférences › Apparence** (`CRM_DARK_TONES`, `window.__setMeggaDarkTone`). Marine et MEGGA AI sont retirés de l'offre mais restent résolvables pour les réglages déjà stockés.

> 📋 Audit d'origine et inventaire : `Audit — Teinte sombre Graphite.html`.

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
| **Animation au survol** (translateY / scale / lift d'ombre / transition sur `:hover`) | **Aucune animation de survol — états statiques.** Préférence utilisateur actée (juillet 2026). Au plus un changement de fond instantané, jamais de `transform`/`box-shadow` animé au hover. |
| **Texte explicatif / pédagogique dans l'UI** (sous-titre de modale qui explique le mécanisme, phrase de contexte sous un titre, « ce qui va se passer », rappel de la règle légale, « l'action est journalisée », récap de l'effet dans un bandeau de confirmation) | **Jamais — préférence utilisateur actée (juil. 2026), à retenir.** L'interface montre, elle n'explique pas. Un titre + le geste. Une modale de confirmation : titre-question + UNE ligne factuelle max (souvent aucune). Un bandeau de confirmation : « Compte supprimé — Nom », rien de plus. Pas de sous-texte pour justifier, rassurer ou documenter : le libellé du bouton suffit. En cas de doute : supprimer la phrase. |
| Emoji dans l'UI | Icônes SVG stroke linéaires (cf. `CRMIcon`) |
| `Inter`, `Roboto`, `Arial` | `Manrope` (cohérent site public) ou `ui-sans-serif` |
| Pilule de type redondante avec le titre | Supprimer |
| **Pilule de type (APPEL, KYC, VISITE…) dans un héro / une carte de RDV** | **Jamais — le type se lit déjà via l'icône, l'heure et le libellé. Ne plus en ajouter.** |
| Méta décorative inutile (#views, #usages) | Moins = mieux |
| **Même libellé/mot répété deux fois côte à côte** (ex. sous-texte « Optionnel » + pilule « Optionnel ») | **Jamais — un seul porteur de l'info (pilule OU texte, pas les deux)** |
| **Dot / point de couleur dans une pilule de statut** | **Jamais de dot — pilule pleine + texte seul** |
| **Point médian « · » comme séparateur dans un titre / compteur** (ex. « Deals en cours · 2 ») | **Jamais — écrire « 2 deals en cours » ou « Deals en cours (2) ». Pas de « · » décoratif dans les titres.** |
| Pilule de statut/type à fond teinté clair (~12 %) + texte coloré | **Fond opaque plein de la couleur + texte BLANC** |
| **Fond de page/écran gris ou dégradé propre à une fiche** (ex. `DdSP.bgGradient`, `CdSP.bgGradient`) | **Fond IDENTIQUE à Today / Pipeline : toujours `window.crmSugarPalette(t, dark, darkTone).pageBg`** |
| **Cadre bento avec bordure/ombre ad hoc** | **Reprendre `sp.frameBorder` + `sp.shadow` de `crmSugarPalette`, comme le pager Pipeline** |

> 🎨 **UNIFORMISATION DES FONDS (règle actée, à retenir).** Toute surface plein écran — **fiches détail** (deal, contact, bien, visite), pagers, écrans — doit poser son contenu sur **le même fond que les pages Today et Pipeline** : `sp.pageBg` issu de `window.crmSugarPalette(t, dark, darkTone)` (quasi-noir `t.bg` en sombre · `#EEF1F5` en clair). **Ne jamais** utiliser un dégradé/gris local propre à une palette de fiche (`DdSP.bgGradient`, `CdSP.bgGradient`, etc.) comme fond de page ou de pager. Le cadre « bento » reprend `sp.frameBorder` + `sp.shadow`. Les palettes de fiche (`Dd`, `Cd`) ne servent qu'aux **surfaces de cards** (`card`, `cardSubtle`) et au texte, pas au fond.

---

## 🧱 Composants & utilitaires existants (réutiliser, ne pas réinventer)

### Tokens Property X (Auth/Onboarding uniquement — ne pas étendre)
- `propertyx-tokens.jsx` — `window.PX` (palette neutrals, font, type, space, gap, padding, radius, shadow, transitions), helper `pxType(name)`, formatter `pxFormatCHF(amount)`, CSS `PX_FONT_FACE_CSS` + composant `<PxFontFace />` pour injecter les @font-face Objectivity.
- `propertyx-atoms.jsx` — 10 atomes Px : `PxButton`, `PxCircleButton`, `PxBadge`, `PxInput`, `PxSelect`, `PxTextArea`, `PxCheckbox`, `PxRadio`, `PxToggle`, `PxAvatar`, `PxLink`, `PxLogo`, `PxImage`, `PxSectionLabel`, `PxList`, `PxListItem`, `PxIcon` (catalogue de ~50 icônes line-style).
- Assets : `assets/megga-logo.svg` (wordmark), `assets/megga-favicon.svg`, `assets/fonts/objectivity/*.woff2` (9 weights + italiques).

### Tokens CRM (Sugar Pure)
- `crm-tokens.jsx` — `CRM_TOKENS` (light/graphite/noir), `CRM_GRAPHITE` (échelle S0→S4), `crmStep`, `CRM_DARK_TONES`, `crmDarkTone`, `CRM_STAGES`, `CRM_DENSITY`, `crmFmtCHF`, `crmFmtNum`, `crmRelative`, `crmInitials`, `crmSugarPalette(t, dark, tone)` (expose `sp.ramp` en Graphite).
- `window.SugarV2Palette` (a.k.a. `SP`) — palette Sugar v2 utilisée dans le wizard.

### Shell & primitives
- `crm-shell.jsx` — `CRMIcon`, `CRMSidebar`, drawer, AI bubble, cmd+K.
- `crm-screen-today-sugar.jsx` — `SugarTopNav`, `SugarIconRail`, `SugarFrame`, `SugarTeamChip`, `SugarTaskCard`, `SugarRoundIconBtn`, `SugarConnector`.

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
- **Modifier un contact au KYC vérifié = invalidation de la vérif.** Si un contact a un **KYC vérifié** (badge sceau bleu) et qu'on tente de **modifier son identité**, il faut **interrompre par une modale d'avertissement** : prévenir que la modification **invalide la vérification** et que **toute la procédure LBA devra être recommencée**. Actions : `Annuler` / `Modifier` (CTA rouge foncé opaque destructif `#8E1F3D` light · `#E0738C` dark, texte blanc, sans icône). Ne PAS proposer "Supprimer" dans cette modale (confusion). La modale est une bottom-card Sugar qui **épouse le bas au-dessus de la barre de nav flottante** (`margin-bottom: calc(94px + safe-area)`), jamais derrière. Réf. d'implémentation : `resp-contact-mobile.jsx` (`kycWarn` — fiche contact mobile Responsive V3 ; désormais aussi côté desktop dans `crm-screen-contact-detail-pager.jsx`). **Conséquence à l'enregistrement** : dès que la modif est sauvegardée, le KYC repasse de `verified` → `pending` et le **bluecheck (badge sceau bleu) disparaît** (nom + bande KYC). Annuler l'édition conserve la vérif.
- **Score IA = calculé par l'algo, JAMAIS un champ de la fiche contact.** Le score (lead score) et les % de match sont **calculés**, ils ne font pas partie des données saisies d'un contact. **Ne jamais** afficher un « Score IA » comme attribut/champ sur la fiche contact (ni carte « Contexte », ni ligne de méta). Je le ressors trop souvent — **à retenir : pas de Score IA sur la fiche.**
- **Données contact = minimales.** Un contact = **coordonnées** (civ., prénom, nom, date de naissance, nationalité, pays de résidence, adresse, e-mail, téléphone, langue, canal préféré) + **critères de recherche** (transaction, types, cantons/villes, budget, pièces/surface min, indispensables). **La date de naissance fait partie de l'identité** (ajout juillet 2026). **Ne pas inventer** de « note », « source », « contact depuis », citation, ni autre méta de remplissage. La fiche doit rester honnête sur ce peu de données — pas de bloc « Contexte » fabriqué.
- **Console MEGGA : pas de page « Clients finaux », ni « Support », ni « Conformité ».** « Clients finaux » supprimée en juillet 2026 (parcourir les leads, messages et dossiers KYC des clients d'une agence n'est pas l'affaire de la plateforme). « Support » l'a suivie (audit `Audit — Support (Console MEGGA).html`, option B) : un diagnostic rare n'est pas une destination. « Conformité », spécifiée mais jamais construite, est supprimée à son tour (audit `Audit — Conformité (Console MEGGA).html`, 30 juil. 2026) : **l'assujetti LBA est l'agence** (acquis dès l'inscription — c'est elle qui traite les noms), aucune obligation n'exige un écran côté plateforme (notaire et banque portent la charge finale), donc **aucune table KYC nominative cross-agences, jamais**. Redistribution actée : consentements nLPD (CGU, confidentialité, marketing — lecture seule) dans le **drawer Utilisateurs** ; santé du screening **ComplyAdvantage** (MEGGA appelle elle-même le fournisseur) en agrégé dans **Monitoring › Intégrations** ; plus d'alerte `kyc_screening_match` côté plateforme (retirée d'`ADMIN_ALERTS`) — une correspondance PEP se traite dans le CRM de l'agence. **Le rail est à 12 entrées.** Ce qui subsiste côté liens KYC : le **tunnel agrégé** en pied de Vue d'ensemble, dont la ligne ouvre la **modale de diagnostic** (`admin-kyc-diagnostic.jsx`, `AdmKycDiagnostic`) : **3 temps — motif obligatoire (agence + référence du signalement) → recherche exacte → étape atteinte + régénération remise à l'agence**. Plafond de 3 correspondances, aucune liste parcourable, aucun document ni jeton, consultation journalisée dans Sécurité, rien conservé à la fermeture. **Ne recréer aucune de ces trois pages.** 👉 Contrat backend complet (RPC, champs autorisés, journalisation, rétention, P0 côté agent) : **`HANDOFF_KYC_DIAGNOSTIC.md`** — à lire avant toute implémentation serveur.
- **Console MEGGA — architecture backend complète (31 juil. 2026)** : **`HANDOFF_CONSOLE_ADMIN_CLAUDE_CODE.md`** — contrat d'implémentation écran par écran (tables, vues, une RPC par geste, journalisation `admin_log` append-only + hash, webhooks Stripe/Immobilier.ch, seuils, rétention, lots 0→3). Sa **§2** liste les couplages avec le **nouvel onboarding (chantier Thomas sur Claude Code)** : création d'agence self-serve, grille de plans via Stripe/`plan_config` (plus jamais en dur), join requests, jalons d'activation, consentements — à synchroniser avec lui avant le Lot 1.
- **Diffusion (Console MEGGA) : la publication est AUTOMATIQUE.** Quand l'agent publie, l'annonce part vers Immobilier.ch — la plateforme ne valide **rien** en amont, il n'existe aucune file d'attente ni feu vert. L'écran **Diffusion** (`admin-diffusion.jsx`, ex-« Marketplace », entrée renommée) est un contrôle **a posteriori** : il constate, **retire avec motif** ou **demande une correction**, jamais il n'approuve. Deux régimes tirés du même tableau, bascule à **40 signaux** : ≤ 40 → file d'**annonces** groupée (refus du portail · signalé en ligne · parti sans réserve) ; > 40 → file de **causes** avec action en lot + action structurelle (« rendre le champ obligatoire » ferme la cause définitivement) et déplié par cause. Le clic ouvre le **poste de contrôle** plein cadre (contrôles passés après publication, L/R au clavier). **Hors périmètre de cet écran** : qualité éditoriale, justesse du prix, leads vendeurs, messages storefront (surface supprimée) et **C2PA** (retiré en juillet 2026 — ne pas le remettre sans demande). Référence de concepts : `Console - Diffusion (concepts).html` (A · B · C · D · E à 100 agences).
- **C2PA : HORS MVP (acté 31 juil. 2026).** Aucune signature de photo à implémenter ni à afficher nulle part (CRM, onboarding, console) pour le lancement — reporté post-MVP. Ne pas réintroduire sans demande.
- **Virtual staging IA : HORS MVP** (retiré du wizard depuis la V1 mobile, reconfirmé 31 juil. 2026 — version future). Le concept est gelé dans `crm-wizard-staging-concept (brouillon).jsx` ; les flags `virtualStagingUser/Agent` du wizard restent morts. Ne rien construire ni afficher sans demande.
- **Diffusion / publication (roadmap V1)** : au lancement, MEGGA ne pousse les annonces que vers **Immobilier.ch** — **portail unique en V1**. Les autres portails (Homegate, ImmoScout, Newhome, Flatfox…) viendront **plus tard** ; ne pas les présenter comme actifs au lancement. Un bien pleinement diffusé = `publishedTo: ["MEGGA", "Immobilier.ch"]`. La page **« À suivre »** de *Mes biens* (page basse du pager, remplace l'ancienne « Santé du portefeuille ») remonte les annonces publiques pas encore poussées sur Immobilier.ch.
- **« À suivre » (Mes biens) = volume-adaptatif.** La page doit tenir de **2 actions à 40+**. Ossature fixe : titre + **compteurs-filtres par nature** (Mandats · Diffusion · Brouillons · C2PA) + **zone focus** + **feed groupé scrollable**. Charge faible/modérée (≲ 6, peu d'urgences) → **héro éditorial** sur l'action n°1 + liste (piste C). Charge forte (> 6 ou ≥ 3 urgences) → **bandeau d'urgences** (top 2-3) + **file dense groupée** en 2 colonnes (compteurs + « voir les N autres »). Réf. d'implémentation : `follow-adaptive.jsx`. **Jamais** une petite grille centrée qui flotte dans le bento.
- **Console MEGGA — la console ne change pas les plans** (acté 31 juil. 2026) : la montée ou la descente de forfait est un geste de **l'agence** (self-service Stripe). L'écran Plans & abonnements **constate et alerte** (impayés, essais qui finissent, sièges saturés) — aucun bouton d'upgrade, aucune modale de changement de plan côté plateforme.
- **Console MEGGA — « Voir en tant que » retiré de la V1** (acté 31 juil. 2026) : emprunter la session d'un agent est le geste le plus sensible de la console (RLS, lecture seule réelle, bandeau, journalisation, durée bornée) pour un besoin rare que **Live + Monitoring + Sécurité** couvrent déjà. Le CTA du drawer Utilisateurs est « Réinitialiser le mot de passe ». `crm-view-as.jsx` reste dans le projet mais **dormant** — ne pas rebrancher sans demande.
- **Console MEGGA — 2FA reportée post-MVP** (acté 31 juil. 2026) : l'accès console au MVP = rôle `super_admin` vérifié serveur + cercle fermé de comptes + sessions journalisées dans Sécurité, **sans 2FA**. Ne pas présenter la 2FA comme prérequis du lancement. Idem **Satisfaction (NPS)** : l'entrée **reste au rail** avec son état « Bientôt disponible », l'écran sera construit après le MVP — ne pas la retirer, ne pas la construire sans demande.
- **MEGGA AI** présent partout — suggestions contextuelles, jamais d'action auto invisible.
- **Langue** : interface en français (CH).

---

- **Responsive V3 (acté 25 juil. 2026)** : un seul CRM responsive — voir `HANDOFF_RESPONSIVE_V3.md`. Le portage de `kycWarn` est fait (`resp-contact-mobile.jsx`) ; l'intégralité du fork de juin est archivée dans `archive-responsive-v2/`.

*Dernière mise à jour : juillet 2026.*
*Direction unique : CRM = **Sugar Pure** (`MEGGA-DESIGN-SYSTEM.md`). Property X = dépendance figée Auth/Onboarding. Marketplace publique supprimée.*
