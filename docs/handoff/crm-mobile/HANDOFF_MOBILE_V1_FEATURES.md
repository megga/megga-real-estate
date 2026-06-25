# HANDOFF — Mobile V1 · Priorité 4 (LIVRÉE)

> **Bilan post-Priorité 4 — mai 2026.** Toutes les surfaces transverses sont en place ; il ne reste que la couche PWA (Track 3, T3 2026).

---

## 1. État actuel

### ✅ Responsive V1 livrée — CRM (light + dark, Sugar Pure intégral)

| Résolution | Fichier HTML | Écrans |
|---|---|---|
| Tablette landscape 1024×768 | `MEGGA CRM Responsive - Tablette Landscape.html` | Aujourd'hui · Pipeline · Fiche contact |
| Tablette portrait 768×1024  | `MEGGA CRM Responsive - Tablette Portrait.html`  | Aujourd'hui · Pipeline · Matching · Calendrier · Fiche contact |
| Mobile 375×812              | `MEGGA CRM Responsive - Mobile.html`             | **25 écrans · Priorités 1, 2, 3 et 4 livrées** |

### État détaillé du mobile (`MEGGA CRM Responsive - Mobile.html`)

**Section 01 · Écrans de base** — 5 écrans
- Aujourd'hui · Pipeline · Matching · Calendrier · Fiche contact

**Section 02 · Features terrain** (Priorité 1) — 4 vues
- **Capture photo** : viseur clean (caméra noir, capture button 72 px, chip contexte, thumb) + review (grille 3×3 photos avec pièce détectée, CTA *Attacher au mandat*). Zéro badge C2PA visible — le scellement tourne en arrière-plan.
- **Quick add contact** : sheet vide (3 champs + Scan carte OCR + Importer carnet) + sheet rempli (note rapide optionnelle, CTA actif). AI tourne en arrière-plan, pas de suggestion intrusive.
- Note : `crm-mobile-signature.jsx` existe (porté mais retiré du showcase — jugé inutile par Gregory)

**Section 03 · Navigation** (Priorité 2) — 3 écrans
- **Liste contacts** : tabs audience scrollables avec compteur + filtres rapides scrollables + liste avatar/KYC dot/nom/contexte/pill + FAB « + » noir
- **Fiche bien** : hero 320 px (carousel placeholder, dots, badges *Mandat exclusif* + *18 photos*), prix gros, specs 2×2, tags, description, mandat (signature/expiration/commission), stats diffusion, sticky CTA *Planifier une visite*
- **Détail deal** : hero (pill stage + parties + valeur + proba), stage stepper 8 cercles, *Prochaine action* en focus noir, timeline activité, documents, parties, sticky CTA *Avancer*

**Section 04 · Drawer « Plus »** (Priorité 3) — 3 écrans
- **Parcours** : vue focus à la Linear My Issues, 5 dossiers en flat list, chaque card avec tâche en cours en focus noir + mini progress 4 phases (Mandat/Marché/Négo/Closing) + avatars équipe
- **Mes biens** : stats top (Diffusés/Vues/Visites) + filtres statut scrollables + liste verticale photo+badge+stats+jours listé
- **Documents** : filtres phase scrollables avec compteur + section *À traiter aujourd'hui* en focus noir (Créer/Relancer) + récents en liste

### Architecture commune

- **Status bar iOS** (50 px, Dynamic Island, icônes adaptatives signal/wifi/battery)
- **TopBar** minimaliste (titre + eyebrow + 1 action contextuelle + back optionnel)
- **Bottom tab bar** 5 onglets : Aujourd'hui · Pipeline · Matching · Contacts · Plus
- **Bottom sheet « Plus »** (iOS-style) : Parcours · Mes biens · Calendrier · Documents + Réglages · Mode sombre · Se déconnecter
- Frame 375×812 avec radius 38 px (iPhone-style)
- Tweaks exposés : Mode sombre + Section visible (Toutes/Base/Features/Nav/Drawer) + Focus écran sur les 14 vues
- Sugar Pure intégral, tap targets ≥ 44 px, tokens auto-flip light/dark via `tabPalette()`

### Fichiers JSX

```
crm-tablet-shared.jsx           ← TOKENS (TabSP, tabPalette, TabIcon, TabAvatar, TabPill, tabCHF, tabInitials)
crm-mobile-shell.jsx            ← MobShell, MobStatusBar, MobTopBar, MobBottomTabs, MobMoreSheet, MobCard, MobSectionHead, MobTabs, MobStatusPill

[Section 01]
crm-mobile-today.jsx            ← MobToday
crm-mobile-pipeline.jsx         ← MobPipeline
crm-mobile-matching.jsx         ← MobMatching
crm-mobile-calendar.jsx         ← MobCalendar
crm-mobile-contact.jsx          ← MobContactDetail

[Section 02 — Priorité 1]
crm-mobile-capture-c2pa.jsx     ← MobC2PA (state: aim | review)
crm-mobile-quickadd.jsx         ← MobQuickAdd (filled: false | true)
crm-mobile-signature.jsx        ← MobSigRotate, MobSigPad (existe mais hors showcase)

[Section 03 — Priorité 2]
crm-mobile-contacts.jsx         ← MobContacts
crm-mobile-bien.jsx             ← MobBien
crm-mobile-deal.jsx             ← MobDeal

[Section 04 — Priorité 3]
crm-mobile-parcours.jsx         ← MobParcours
crm-mobile-biens.jsx            ← MobBiens
crm-mobile-documents.jsx        ← MobDocuments
```

---

## 2. Roadmap mobile — état

### ✅ Priorité 1 — Features terrain (LIVRÉE)
Capture photo (viseur + review) + Quick add contact (vide + rempli). Signature canvas retirée du showcase à la demande de Gregory.

### ✅ Priorité 2 — Périmètre nav (LIVRÉE)
Liste contacts + Fiche bien + Détail deal.

### ✅ Priorité 3 — Écrans drawer « Plus » (LIVRÉE)
Parcours + Mes biens + Documents.

### ✅ Priorité 4 — Cross-cutting (LIVRÉE)

**4.1 MEGGA AI chat** — `crm-mobile-ai-chat.jsx`
- `MobAIChatIntro` : drawer plein écran, hero noir avec contexte (11 deals / 142 contacts / 6 mandats), 4 suggestions de prompts (relance / match / mandat / statut deal), conversations récentes.
- `MobAIChatConvo` : bulles user noir asymétriques + IA gris clair, cards-référence tap-to-open pour contacts cités, indicateur typing 3 dots, header statut *en ligne · réponse en cours*.
- Composer pill commun avec joindre + bouton micro noir pour dictée vocale.

**4.2 Notifications** — `crm-mobile-notifications.jsx`
- `MobNotifications` : TopBar back + CTA *Tout lu*, filtres scrollables (Toutes / Non lues / Deals / KYC / Agenda) avec compteur, liste groupée par jour (Aujourd'hui / Hier / Cette semaine).
- Chaque row : avatar acteur + sous-badge type d'event + titre + body 2 lignes clamped + dot bleu non lu.
- Décision actée : badge sur l'onglet Aujourd'hui + écran dédié accessible via tap badge.

**4.3 États systèmes** — `crm-mobile-states.jsx`
- `MobStateEmpty` : illustration neutre Sugar (halo + stack cards + spark accent — zéro emoji), titre, CTA primaire *Ajouter un contact* + secondaire *Importer du carnet*, card astuce.
- `MobStateLoading` : squelette Aujourd'hui avec shimmer 1.4s (TopBar + 2 stats + agenda focus en accent + 3 rows idle + parcours horizontal). Pas de spinner — la structure se dessine.
- `MobStateOffline` : banner noir Sugar sous TopBar avec WiFi-off + timestamp cache + bouton *Réessayer*. Stats + agenda du jour restent en lecture seule (pill verte EN CACHE). Pipeline/Matching/IA grisé avec card *Lock*. Conforme niveau (a) hors-ligne V1.

**4.4 Auth Supabase** — `crm-mobile-auth.jsx`
- `MobAuthSignin` : hero MEGGA (logo en card noire) + tagline, card form avec input email focused (ring noir 2px + caret), CTA *Recevoir le lien*, divider *ou*, Google SSO secondaire, switch marketplace, footer micro-légal CGU + Supabase Genève.
- `MobAuthVerify` : 6 cases digits (3 remplis, 4e en focus avec caret), compteur de renvoi 00:42 + bouton *Renvoyer* grisé, CTA disabled tant que 6 chiffres non saisis, card aide *fallback SMS*.

**4.5 Onboarding 3 écrans** — `crm-mobile-onboarding.jsx`
- `MobOnboardWelcome` (1/3) : hero composition Sugar réutilisant les cards réelles MEGGA (deal Marie + match IA noir rotation + badge KYC validé), titre *Ta journée d'agent, en un seul écran*, CTA *Commencer*.
- `MobOnboardPermissions` (2/3) : 4 perms en cards (Caméra activée vert / Notifs *Autoriser* noir actif / Localisation + Calendrier *Plus tard* ghost), card réassurance *Tes données restent en Suisse*.
- `MobOnboardProfile` (3/3) : avatar 64 avec pencil edit overlay, 4 lignes éditables (Agence / Rôle / Téléphone / Langues), bloc bio publique facultative, CTA *Entrer dans MEGGA*.
- Pattern dots indicator animé (largeur 22px pour actif), skip top-right cohérent.

### 🔜 Track 3 — PWA installable (T3 2026)
Push Web (Web Push API), install prompt iOS 16.4+, Service Worker + IndexedDB read-only (agenda du jour).

---

## 3. Direction artistique RAPPEL

**CRM = Sugar Pure**
- Fonds blancs purs (`#FFFFFF` light) / `#16161F` (dark)
- Page bg radial gradient gris-bleu (cf. `tabPalette().pageBg`)
- Accent **NOIR FRANC** `#0B0C0E` (light) — bascule en blanc cassé `#ECEDF3` (dark) via le token `accent`
- Aucune bordure décorative — ombres douces uniquement (`p.shadowSm`, `p.shadow`)
- Coins arrondis généreux : 18 (cards mobile), 14 (sous-cards), 999 (pills)
- Animation entrée Sugar : `sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both`
- Manrope · tabular-nums sur tous les chiffres · CHF avec apostrophes (`tabCHF()`)
- **Zero emoji** — toujours `<TabIcon />` (catalogue dans `crm-tablet-shared.jsx`)

**Anti-patterns à ne JAMAIS reproduire** (cf. `MEGGA-DESIGN-SYSTEM.md`)
- ❌ Bordure 1px décorative sur card / modal / sheet
- ❌ Couleur d'accent UI (bleu, violet, vert…)
- ❌ Titre en gris
- ❌ Fond coloré sur sélection
- ❌ Emoji
- ❌ Glassmorphism agressif
- ❌ Hit area < 44 px
- ❌ Trop de dots — `MobStatusPill` ne porte plus de dot interne (cleanup mai 2026)

---

## 4. Conventions techniques

### Tokens à consommer (ne pas réinventer)

```js
const p = tabPalette(dark);
p.card           // surface principale (blanche light / dark cardDk en dark)
p.cardSub        // gris clair pour sub-cards
p.ink            // texte primaire (noir light / blanc cassé dark)
p.soft           // texte body
p.muted          // labels, méta
p.ghost          // dividers translucides
p.divider        // 1px-equivalent
p.accent         // noir light / blanc dark — pour CTA, focus, selection
p.onAccent       // texte/icône sur accent (blanc light / noir dark)
p.onAccentSoft   // texte secondaire sur accent (auto-flip)
p.onAccentMuted  // texte discret sur accent
p.onAccentSurface// fond pour micro-bouton sur accent
p.onAccentBorder // bordure d'avatar sur accent
p.shadowSm       // ombre légère (cards)
p.shadow         // ombre principale
p.shadowLg       // sheet, modal
```

### Helpers

```js
tabCHF(1250000)  // "CHF 1'250'000"
tabInitials("Marie Bertrand")  // "MB"
<TabIcon name="phone" size={14} stroke={p.soft} sw={1.7} />
<TabAvatar name="Marie Bertrand" bg="#0041D9" size={32} border={p.card} />
<MobStatusPill label="KYC OK" tone="ok" />  // tones: ok | warn | danger | info | neutral
```

### Pièges connus

- **Tous les .jsx Babel partagent le scope global**. Préfixer les composants spécifiques à un fichier (ex. `MobCDKpi` plutôt que `Kpi`, `MobBiensRow` plutôt que `Row`).
- **Jamais `const styles = {...}`** au scope global — toujours nommer (`mobTodayStyles`, etc.).
- L'ordre de chargement dans le HTML est significatif (shared → shell → screens).
- En dark mode, l'accent se renverse — **toujours utiliser `p.onAccentSoft/Muted/Surface/Border`**, jamais hardcoded `rgba(255,255,255,…)`.
- **Filter rows scrollables horizontales** : toujours `flexShrink: 0` sur le `<div>` parent sinon il se fait écraser à la hauteur de son padding par le flex parent.

---

## 5. Décisions actées (rappel)

- **Auth** : Supabase Auth (magic link + 2FA)
- **Hors-ligne V1** : cache lecture seule (agenda du jour, contacts liés)
- **C2PA** : signature côté client au moment de la capture, **invisible dans l'UI** (tourne en background)
- **MEGGA AI** : tourne en background, jamais d'étape intrusive — seulement déclenchable depuis l'icône spark
- **Pilote** : Genève + Lausanne, FR seul
- **Pas d'app native en V1** — 100 % web responsive + PWA installable (Track 3, T3 2026)

---

## 6. Comment démarrer la prochaine session

1. Charger ce handoff + `CLAUDE.md` + `HANDOFF_MOBILE_V1.md` + `MEGGA-DESIGN-SYSTEM.md`
2. Vérifier que `MEGGA CRM Responsive - Mobile.html` charge sans erreur — 14 écrans rendus, Tweaks fonctionnels (Section visible + Focus + Mode sombre)
3. Démarrer par le **bloc Priorité 4** (cross-cutting)
4. Pour chaque nouvelle feature mobile : créer un nouveau `crm-mobile-<feature>.jsx` qui consomme les tokens et atomes existants, l'inclure dans `MEGGA CRM Responsive - Mobile.html` + ajouter une nouvelle Section dans le showcase si besoin

---

*Mis à jour : mai 2026 (après livraison Priorités 1, 2, 3 et 4). Owner : Gregory Lyonnet.*
