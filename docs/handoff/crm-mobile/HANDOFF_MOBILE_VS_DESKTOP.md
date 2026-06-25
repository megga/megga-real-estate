# HANDOFF — Réconciliation Mobile ↔ Desktop (PC)

> **But du document.** La version **mobile** du CRM MEGGA est la **version finale, prête pour la prod**. La version **desktop (PC)** est **obsolète** sur plusieurs points : elle contient des features supprimées depuis, et il lui manque des features ajoutées côté mobile. Ce document liste **toutes les divergences à réconcilier** avant l'implémentation dans Claude Code, pour éviter les incohérences produit.

**Règle d'or pour toute implémentation :** en cas de conflit entre mobile et desktop, **le mobile fait foi**. Le desktop doit s'aligner.

**Dernière mise à jour :** juin 2026.

---

## 0. Méthode d'audit (à reproduire pour les écrans non encore couverts)

⚠️ **Vérifier le _flux rendu actif_, pas la simple présence de code.** Un composant peut rester dans un fichier sans être branché dans la séquence/le rendu (= code mort). Exemple réel : `MWStepOptions` (staging) existe encore dans `crm-mobile-wizard-final.jsx` mais **n'est plus dans la séquence d'étapes** → la feature est bien retirée côté mobile, le composant est juste du code mort.

Pour chaque écran : lire le **switch de rendu / la séquence d'étapes / les menus d'action réellement câblés**, pas seulement grep des mots-clés.

---

## 1. Légende des catégories

| Tag | Signification |
|---|---|
| 🔴 **RETIRER (PC)** | Feature supprimée côté mobile → à supprimer aussi côté desktop |
| 🟢 **AJOUTER (PC)** | Feature ajoutée côté mobile, absente du desktop → à porter sur desktop |
| 🟠 **ALIGNER (comportement)** | Feature présente des deux côtés mais le comportement diffère → aligner sur le mobile |
| ⚪ **NETTOYER (mobile)** | Code mort résiduel côté mobile, à supprimer pour la prod (cosmétique, non bloquant) |

---

## 2. DELTAS CONFIRMÉS (vérifiés sur le code courant)

### 2.1 Création de bien (wizard)

**Mobile (source de vérité) :** `crm-mobile-wizard-core.jsx` · `crm-mobile-wizard-steps.jsx` · `crm-mobile-wizard-final.jsx`
**Desktop (à aligner) :** `crm-wizard-sugar-step1..8.jsx` · `crm-staging-studio.jsx` · `crm-bien-vitrine-kit.jsx`

| Tag | Détail |
|---|---|
| 🔴 **RETIRER (PC)** | **Virtual staging IA — supprimé pour la V1.** La séquence mobile est : Start → Vendeur/Mandat → Adresse → Specs → Photos → Prix & description → Publier. **Plus d'étape « Options ».** Côté desktop, retirer : l'étape Options entière (`crm-wizard-sugar-step6.jsx` : Staging acheteur 49 CHF + Staging agent multi-styles 29 CHF), le **Staging Studio** (`crm-staging-studio.jsx`, modal « Nano Banana » ouvert depuis Photos), le **badge staging du récap** (`crm-wizard-sugar-step7.jsx`), et les badges **« Staging IA · C2PA »** sur les photos de la vitrine (`crm-bien-vitrine-kit.jsx`, prop `ai: true`). |
| 🔴 **RETIRER (PC)** | Les blocs payants **« Mise en avant »** (199 CHF) et **« Visite vidéo guidée »** (89 CHF) vivent dans la même étape Options desktop → disparaissent avec elle (non présents dans le flux mobile V1). *(À confirmer s'ils doivent revivre ailleurs.)* |
| ⚪ **NETTOYER (mobile)** | `MWStepOptions` + `MW_STAGE_STYLES` dans `crm-mobile-wizard-final.jsx` = code mort (non branché). À supprimer pour la propreté prod. |
| 🟠 **ALIGNER (PC)** | **Aperçu de publication** — le mobile affiche désormais l'aperçu de l'annonce dans une **carte Sugar épurée** (libellé « Aperçu de l'annonce »), **sans fausse fenêtre macOS** (pastilles rouge/jaune/vert + URL `megga.ch/annonce/…`) qui existait avant. Si le récap/aperçu du wizard desktop utilise un chrome navigateur, l'aligner sur cette carte propre. |

---

### 2.2 Mes biens (liste + fiche)

**Mobile :** `crm-biens-mobile.jsx`
**Desktop :** `crm-screen-biens-sugar.jsx`

| Tag | Détail |
|---|---|
| 🟢 **AJOUTER (PC)** | **Menu d'actions par bien (•••)** — présent en mobile, absent en desktop : `Dupliquer le bien`, `Changer le statut` (actif/réservé/brouillon), `Retirer de la diffusion`, `Supprimer le bien`. |
| 🟢 **AJOUTER (PC)** | **Suppression d'annonce avec confirmation** — flux complet en mobile (modale de confirmation + suppression + toast). Côté desktop, les boutons « Supprimer » (`crm-screen-biens-sugar.jsx` l.~326 et ~757) sont **morts** (`onClick` vide). → câbler une vraie modale de confirmation destructive (CTA rouge foncé opaque `#8E1F3D`). |
| 🟢 **AJOUTER (PC)** | **Actions globales de la liste** — en mobile : `Importer un bien` (input fichier) et `Trier les biens` (prix ↑/↓, surface, réf A–Z). Absent du desktop. |
| 🔴 **RETIRER (PC)** | **Soumissions vendeurs** — bandeau + bottom-sheet **retirés du mobile** (référençaient « MEGGA Vendre », marketplace supprimée). Le desktop a encore le **bandeau + drawer actifs** (`BnSubmissionsBanner` / `BnSubmissionsDrawer`, `crm-screen-biens-sugar.jsx` l.~125-167, ~899-987) → à retirer (ou re-sourcer sans la mention « MEGGA Vendre »). **À trancher** : suppression complète (cohérent marketplace supprimée) ou simple reformulation de la source. La donnée `CRM_SUBMISSIONS` reste utilisée par le desktop tant que le bloc existe. |

---

### 2.3 Pipeline

**Mobile :** `crm-pipeline-mobile.jsx`
**Desktop :** `crm-screen-pipeline-sugar.jsx`

| Tag | Détail |
|---|---|
| 🟠 **ALIGNER (comportement)** | **KYC NON-BLOQUANT.** Le desktop affiche encore un **« Verrou KYC bloquant — bannière en haut du pipeline »** (état obsolète). La règle actuelle (CLAUDE.md, depuis mai 2026) et le mobile : le KYC ne **bloque jamais** l'avancement d'un deal — c'est un rappel doux. → **Supprimer le verrou/la bannière de blocage** du pipeline desktop ; un deal doit pouvoir avancer à toutes les étapes sans KYC validé. |

---

### 2.4 Contacts / KYC

**Mobile :** `crm-contact-detail-mobile-v2.jsx` (logique `kycWarn`)
**Desktop :** `crm-screen-contact-detail-sugar.jsx`

| Tag | Détail |
|---|---|
| 🟢 **AJOUTER (PC)** | **Invalidation du KYC à l'édition d'un contact vérifié.** En mobile : modifier l'identité d'un contact au **KYC vérifié** (badge sceau bleu) déclenche une **modale d'avertissement** (« la modification invalide la vérification, toute la procédure LBA devra être recommencée ») — actions `Annuler` / `Modifier` (CTA destructif rouge foncé opaque, pas de « Supprimer »). À l'enregistrement : KYC `verified → pending` et le **bluecheck disparaît** (nom + bande KYC). Annuler conserve la vérif. **Le desktop n'a pas cette interruption** → à porter. |
| ✅ déjà OK | Le desktop a déjà la section **« Conformité KYC · LBA · non bloquant »** avec état vérifié (sceau vert). Pas de delta sur le caractère non-bloquant ici. |

---

## 3. AUTRES DELTAS / POINTS DE VIGILANCE (audit approfondi)

### 3.1 Settings / Paramètres — desktop INCOMPLET

**Mobile :** `crm-settings-mobile.jsx` + `crm-settings-mobile-sections.jsx` (1473 l, sections Profil / Agence / Notifications **construites en pleine fidélité**)
**Desktop :** `crm-screen-settings-sugar.jsx`

| Tag | Détail |
|---|---|
| 🟢 **AJOUTER / FINIR (PC)** | Le desktop n'a que la section **Profil** « full fidelity » ; les **sections 2-5 sont des PLACEHOLDERS** (`§PLACEHOLDER pour les autres sections (étapes 2-5)`). À construire en s'appuyant sur le mobile (Agence, Notifications, etc.). |
| 🟠 **DÉCISION DESIGN** | Le bandeau de navigation des Settings desktop est encore en **3 variations non tranchées (A / B / C)**. À figer une seule variation avant prod. |
| ⚠️ **SCOPE** | Le mobile expose **6 tuiles** ; le desktop liste **10 sections**. Aligner le périmètre des sections entre les deux. |

### 3.2 Analytics — surfaces différentes, chiffres à aligner

**Mobile :** `crm-analytics-mobile.jsx` (506 l — héros « commission projetée », carte trajectoire, KPI 2×2, drilldowns, sources des deals)
**Desktop :** `crm-screen-dashboard-sugar.jsx` = simple **wrapper** qui embarque `window.DashboardApp` (cockpit `crm-dashboard-*` : entonnoir, objectif, stratégie).

| Tag | Détail |
|---|---|
| 🟠 **ALIGNER** | Les deux existent et sont construits, mais ce sont **deux présentations différentes**. ⚠️ Vérifier la **cohérence des métriques** affichées (commission projetée, trajectoire vers objectif, sources) entre l'analytics mobile et le cockpit desktop — éviter deux jeux de chiffres divergents. |

### 3.3 Nouveau contact — desktop PLUS riche que mobile

**Mobile :** `crm-contact-new-mobile.jsx` (163 l — champ texte, select, type segmenté)
**Desktop :** `crm-screen-contacts-sugar-new.jsx` (619 l — **autocomplete d'adresse typeahead** + **sélecteur de cantons** popover)

| Tag | Détail |
|---|---|
| ⚠️ **DÉCISION** | Ici c'est le **desktop qui a plus** (aides de saisie adresse/canton). Mobile = source de vérité → **confirmer** : le mobile reste-t-il volontairement simplifié (V1), ou doit-il récupérer l'autocomplete adresse + le sélecteur de cantons ? |

### 3.4 Agenda / Calendrier — vérifier le time-blocking

**Mobile :** `crm-agenda-mobile.jsx` + `crm-agenda-mobile-timeblock.jsx` (grille time-blocking)
**Desktop :** `crm-calendar-sugar*.jsx` (jour / semaine / mois)

| Tag | Détail |
|---|---|
| ⚠️ **VÉRIFIER** | Le mobile a un mode **time-blocking** dédié. Vérifier qu'il existe un équivalent côté desktop (vues jour/semaine/mois présentes, mais time-blocking explicite à confirmer). |

### 3.5 Notifications — propager les nettoyages mobiles

**Mobile :** `crm-notif-mobile.jsx` (feuille) · **Desktop :** `crm-notifications.jsx` (popover + page complète)

| Tag | Détail |
|---|---|
| 🟠 **ALIGNER** | Nettoyages récents côté mobile à **répercuter sur desktop** pour cohérence : suppression de l'icône check du bouton **« Tout lire »** et des **chevrons `→`** sur les lignes prioritaires du digest. |

### 3.6 Écrans à parité apparente (pas de delta produit majeur repéré)

Comparaison de structure OK ; **vérification fine recommandée** mais aucune divergence évidente :

- **Matching** (`crm-matching-mobile.jsx` ↔ `crm-screen-matching-sugar.jsx`) : KYC rappel doux non-bloquant des deux côtés, score qualitatif, critères éditables inline, envoi dossier + planifier visite. ⚠️ Confirmer absence de reliquat bloquant desktop.
- **Deal detail** (`crm-deal-detail-mobile.jsx` ↔ `crm-screen-deal-detail-sugar.jsx`) : stepper 8 étapes, KYC chip, négociation offre/contre-offre, notes inline, modal document. ⚠️ Vérifier l'équivalent desktop du **focus « Traiter »** mobile, et que le KYC chip est non-bloquant.
- **Today / Aujourd'hui** (`crm-mobile-today.jsx` ↔ `crm-screen-today-sugar.jsx`) : **divergence de densité voulue** (mobile condensé : file de priorités + stats + agenda + relances IA ; desktop = cockpit liquid-glass + journey columns + focus mode). Pas de delta produit ; vérifier que les features clés (focus mode, relances IA) sont présentes des deux côtés.
- **Parcours** (`crm-parcours-mobile.jsx` ↔ `crm-screen-parcours-sugar.jsx`) : team bandeau, stepper 4 étapes, cartes dossier, drill-in. Parité structurelle.
- **Contacts liste** (`crm-contacts-list-mobile.jsx` ↔ `crm-screen-contacts-sugar.jsx`) : liste segmentée, ligne contact, fiche. Parité structurelle.

---

## 4. Rappels transverses (déjà actés, à respecter partout)

- **Marketplace publique supprimée** : aucune surface acheteur grand public. Le canal acheteur = écran **Matching** (catalogue de match).
- **Property X** = dépendance figée Auth/Onboarding uniquement. Pas de nouvelle surface PX.
- **KYC non-bloquant** partout dans le pipeline.
- **C2PA** sur les photos publiées reste valable — c'est le **virtual staging IA** qui est retiré, pas la provenance C2PA des vraies photos.

---

## 5. Ordre d'implémentation conseillé (desktop → aligné mobile)

**Cohérence produit (prioritaire) :**
1. **Pipeline** : retirer le verrou KYC bloquant (rapide, fort impact cohérence).
2. **Wizard créer bien** : retirer l'étape Options + Staging Studio + badges staging.
3. **Mes biens** : porter les actions (•••, importer, trier) + câbler la suppression avec confirmation ; trancher le sort des soumissions.
4. **Contact détail** : ajouter la modale d'invalidation KYC.

**Complétude / finition :**
5. **Settings desktop** : construire les sections placeholder (2-5), figer la variation de bandeau.
6. **Notifications desktop** : répercuter les nettoyages d'icônes du mobile.
7. **Analytics** : aligner les métriques mobile ↔ cockpit desktop.
8. **Nouveau contact** : décider du périmètre (mobile simplifié vs aides desktop).
9. **Agenda** : confirmer la parité time-blocking.

**À confirmer (décisions ouvertes) :**
- Soumissions vendeurs desktop : suppression totale ou reformulation ?
- Blocs « Mise en avant » / « Visite vidéo » du wizard : abandonnés en V1 ou replacés ?
- Code mort mobile (`MWStepOptions`) : nettoyer ou laisser ?
