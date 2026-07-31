# Handoff Claude Code — Onboarding Agent (Première connexion)

> **À lire avant tout** : `refs/CLAUDE.md`, `refs/HANDOFF_ONBOARDING_AGENT.md`, `refs/HANDOFF_ONBOARDING_LOT1.md`, `refs/MEGGA-DESIGN-SYSTEM.md`, `refs/HANDOFF_WIZARD_SUGAR_V2.md`.
>
> L'onboarding se déclenche **après le signup** (premier login). Le signin classique (utilisateur connu) bascule directement sur Aujourd'hui via le splash court `MEGGA Auth.html` (hors scope ici).
>
> Les maquettes hi-fi vivent dans `onboarding/`. Point d'entrée : `MEGGA Onboarding.html`.

---

## 🎯 Périmètre

5 étapes + splash bascule + écran final, direction **Sugar Pure** stricte.

| # | Livrable | Fichier maquette à reproduire |
|---|---|---|
| 0 | **Splash bascule Property X → Sugar** : 1.5s "Bienvenue Marie" en Objectivity sur fond blanc, transition CSS 1.1s vers gradient radial Sugar, bascule typo Manrope. | `onboarding/megga-onboarding-app.jsx` → `ObSplash` |
| 1 | **KYC info marketing** : hero shield 88px + h1 « Le premier CRM avec le KYC intégré. » + 3 features + skeleton carte d'identité. **Pas de collecte de pièces.** | `onboarding/megga-onboarding-app.jsx` → `ObStepKYC` |
| 2 | **Agence (pivot)** : autocomplete agence existante + demande à rejoindre / création inline + toggle Indépendant·e + **anti-doublon strict** | `onboarding/megga-onboarding-step-agence.jsx` |
| 3 | **Profil agence** : logo + cover (drag&drop), nom, adresse via Mapbox. Si agent a *rejoint* → état "rempli par l'admin". | `onboarding/megga-onboarding-step-profil-agence.jsx` |
| 4 | **Profil agent** : photo (C2PA en silence), prénom/nom, rôle, langues, mobile CH. | `onboarding/megga-onboarding-step-profil-agent.jsx` |
| 5 | **Forfait** : Découverte (gratuit) / Pro (CHF 49/mois · CHF 490/an), toggle mensuel/annuel. | `onboarding/megga-onboarding-step-forfait.jsx` |
| 6 | **Écran final** : fiche agent complète + CTA noir « Aller sur le CRM ». | `onboarding/megga-onboarding-app.jsx` → `ObFinal` |

---

## 📐 Direction artistique — Sugar Pure (NON NÉGOCIABLE)

Voir `refs/MEGGA-DESIGN-SYSTEM.md` pour la spec complète. Rappel essentiel :

- **Splash uniquement** = grammaire Property X (Objectivity, fond blanc, `letter-spacing: -3 %`)
- **Tout le reste** = Sugar Pure :
  - Fond `bgGradient` : `radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)` (light) / `#0E0E14` (dark)
  - Surfaces blanches pures `#FFFFFF` / `#16161F` (dark)
  - **AUCUNE bordure 1px décorative** sur card / modal / panel — séparation par ombres uniquement
  - Accent unique = **NOIR PUR `#0B0C0E`** (light) / `#ECEDF3` (dark) — boutons, sélection, ring actif
  - Titres en noir franc, jamais gris
  - Coins : 24-28px cards, 18-22px sous-cards, 12-14px inputs, 999px pill / cercle
  - Ombres `shadowSm` / `shadow` / `shadowLg`
  - Animation entrée : `obFadeUp .5s cubic-bezier(.2,.8,.2,1) both`
  - Manrope, `tabular-nums`, CHF avec apostrophes
- **Stepper** : compteur "X / 5" footer uniquement. **PAS** de cercles visibles en header (décision PO Lot 1).
- **Iconographie SVG line uniquement** via `ObIcon` — zéro emoji, zéro illustration décorative.
- **Voix éditoriale Linear-direct** : "Votre agence", "Vous", labels courts FR-CH.

**Si tu doutes** : ouvre `onboarding/megga-onboarding-step-agence.jsx` → autocomplete + demande envoyée + create + anti-doublon = pattern Sugar Pure de référence.

---

## 🧱 Modèle de données

### 1. Payload final de l'onboarding

À la fin du wizard, le shell émet un objet `OnboardingPayload` :

```ts
{
  // Étape 1 KYC info — purement marketing, rien à persister
  // Étape 2 Agence
  agency: {
    mode: 'joined' | 'created' | 'solo',          // joined = a rejoint existante, created = créée, solo = indépendant·e
    id: string | null,                            // si joined ou created (assigné serveur)
    name: string,
    city: string,
    canton: string,                               // 'VD', 'GE', 'VS', etc.
    solo: boolean,                                // si mode = 'solo' ou si create + toggle solo
    joinRequestStatus?: 'pending' | 'validated',  // si joined
  },

  // Étape 3 Profil agence (rempli uniquement si created OU solo)
  agencyProfile?: {
    logo: string | null,                          // URL du logo (upload signed S3)
    cover: string | null,                         // URL de la cover
    address: {
      street: string,
      city: string,
      postalCode: string,
      canton: string,
      lat: number,
      lng: number,
    },
  },

  // Étape 4 Profil agent — TOUJOURS rempli
  agentProfile: {
    firstName: string,                            // requis
    lastName: string,                             // requis
    avatar: string | null,                        // URL photo signée C2PA serveur, badge invisible côté agent
    role: 'courtier' | 'direction' | 'admin' | 'stagiaire',  // requis
    languages: Array<'fr' | 'en' | 'de' | 'it' | 'es' | 'pt'>,  // min 1
    phone: string,                                // format CH +41 XX XXX XX XX
  },

  // Étape 5 Forfait
  plan: 'free' | 'pro',
  billing: 'monthly' | 'yearly',                  // ignoré si plan = 'free'
}
```

### 2. Base agences (anti-doublon)

L'autocomplete consomme `OB_AGENCIES_DB` (cf. `onboarding/megga-onboarding-step-agence.jsx`) — **à remplacer côté prod** par un endpoint :

```
GET /api/agencies?q=<query>&limit=10
→ Array<{ id, name, city, canton, addressShort, logoUrl?, memberCount, isMEGGAVerified }>
```

**Règle anti-doublon** : si `query` matche exactement (case-insensitive, trim) le `name` d'une agence existante → côté UI, désactiver le CTA "Créer cette agence" et n'exposer que "Rejoindre {agence}". Côté serveur, `POST /api/agencies` doit **refuser** (`409 Conflict`) une création dont le nom matche déjà. Pas d'escape "Créer quand même".

### 3. Flux de demande à rejoindre

```
POST /api/agencies/:id/join-requests { fromAgentId }
→ 201 { id, status: 'pending', createdAt }
```

Le statut passe à `validated` quand un admin de l'agence approuve (hors scope onboarding). Côté UI maquette : 2.5s après envoi, on simule la validation auto pour démontrer le rendu. **En prod** : l'agent reste sur l'étape avec un état "Demande envoyée — l'admin recevra une notification" et **peut continuer l'onboarding sans attendre** (les étapes 3 et 4 deviennent lecture seule "rempli par l'admin").

### 4. Mapbox geocoding (étape 3)

Le pattern Mapbox est déjà câblé dans `refs/crm-wizard-sugar-v2.jsx` (cf. `SgAddressInput` ou recherche locale). Token : `window.MAPBOX_TOKEN` ou variable d'env serveur. Endpoint utilisé : Mapbox Places API `/geocoding/v5/mapbox.places/{query}.json?country=ch&types=address`.

### 5. Upload de fichiers (logo, cover, photo agent)

Signed URL S3 :
```
POST /api/uploads/sign { fileName, mimeType, kind: 'logo' | 'cover' | 'avatar' }
→ { uploadUrl, publicUrl, expiresAt }
```

Pour la **photo agent**, après upload, le serveur lance la signature **C2PA en silence**. **Aucune UI** ne montre l'état "en cours de signature" ou "signée" côté agent (cf. Sprint 3 — C2PA = invisible côté CRM agent).

---

## ⚙️ Logique métier à câbler

### Étape 1 — KYC info marketing

- **Pas de logique métier**, purement informatif.
- 3 features statiques (Natif, Conforme LBA, Déclenché par MEGGA AI).
- Carte d'identité skeleton = visuel décoratif, pas un input.
- CTA noir « Continuer » → étape 2. CTA ghost « Passer cette étape » accepté (skippable).

### Étape 2 — Agence (pivot)

Quatre sous-états :

1. **Search** (par défaut)
   - Input pill avec icône loupe, autocomplete live (debounce 200ms)
   - Dropdown résultats Sugar (max 6 lignes, fond `card`, ombre `shadow`, séparateurs `t.divider` 1px très clair — pas de bordure décorative)
   - Sous l'input, un lien discret « Je ne trouve pas mon agence — créer / je suis indépendant·e »

2. **Selected** (agence trouvée, en attente de demande)
   - Card preview avec logo, nom, ville, canton, badge "Vérifiée MEGGA" si `isMEGGAVerified`
   - Bouton noir « Envoyer ma demande »
   - Au clic : `POST /api/agencies/:id/join-requests` → état `Sent`

3. **Sent / Validated**
   - Halo pulse autour du cercle de statut (`obRingPulse` keyframe)
   - Sub-status : "Demande envoyée à l'admin" (pending) → "Demande validée ✓" (validated, après 2.5s en maquette)
   - CTA noir « Continuer » s'active

4. **Create** (depuis lien "créer / indépendant·e")
   - Segmented control "Agence (équipe) / Indépendant·e" en haut → adapte titres/labels/placeholder/CTA + flag `solo: true`
   - Formulaire inline : nom, ville (autocomplete CH simple), canton (select 26 cantons)
   - **Anti-doublon live** : si nom matche `OB_AGENCIES_DB` (côté UI, devient API en prod) → la card "Créer cette agence" se désactive, un encart Sugar apparaît : "« {nom} » existe déjà — Rejoindre cette agence ?"
   - CTA noir « Créer mon agence » (ou « Continuer en indépendant·e ») → `POST /api/agencies` → étape 3

### Étape 3 — Profil agence

**Si `mode === 'joined'`** :
- État "Rempli par l'admin · validé" : card grise avec récap logo/nom/adresse + label "Vous n'avez rien à faire ici"
- CTA noir « Continuer »

**Si `mode === 'created' | 'solo'`** :
- Upload logo (drag&drop, accepts `image/*`, max 5MB, preview circulaire 96×96)
- Upload cover (drag&drop, preview 16:9, optionnel)
- Input adresse avec Mapbox geocoding (suggestions live, sélection = remplit lat/lng + canton)
- **PAS d'IBAN** (décision PO — sera demandé plus tard à la première vente)

### Étape 4 — Profil agent (TOUJOURS rempli, bloquant minimum prénom + photo + rôle)

- Upload photo agent (drag&drop, preview circulaire 120×120) — serveur signe C2PA en silence, UI agent montre juste la photo
- Prénom, nom (deux inputs côte à côte)
- Rôle : 4 chips Courtier·ère / Direction / Admin / Stage LBA (radio Sugar : ring noir 2px inset sur l'actif)
- Langues : multi-chips FR / DE / IT / EN / ES / PT (toggle, min 1 requis)
- Mobile : input tel formaté `+41 XX XXX XX XX` (auto-format au focus blur)

### Étape 5 — Forfait

- 2 cards Découverte / Pro
- **Découverte** : gratuit, 5 mandats actifs max, 1 utilisateur, pas de KYC intégré
- **Pro** : CHF 49/mois ou CHF 490/an (économie de CHF 98), illimité, KYC intégré, MEGGA AI complet, publication multi-portails
- Toggle Mensuel / Annuel en haut → met à jour le prix affiché sur la card Pro avec animation tabular-nums
- Card sélectionnée = `boxShadow: "0 0 0 2px #0B0C0E inset, " + shadow` (pattern Sugar)
- CTA noir « Terminer » → écran final

### Écran final

Composant `ObFinal` :
- H1 « Bienvenue, Marie. »
- Sous-titre « Votre fiche est prête. MEGGA vous attend dans Aujourd'hui. »
- **Fiche agent centrale** (radius 24, shadow) : avatar 76×76, nom 22px, pill rôle + téléphone, divider, grille 2×3 (Agence / Forfait / Langues), footer "Membre depuis le {date}"
- CTA noir XL « Aller sur le CRM » → navigation vers `/aujourdhui`

### Validation et navigation

Le shell expose une fonction `canNext()` qui dépend de l'étape courante :
- Étape 0 (KYC) : toujours `true` (skippable)
- Étape 1 (Agence) : `agenceValidated === true` OU `agenceCreated !== null`
- Étape 2 (Profil agence) : `mode === 'joined'` OU (logo uploadé + adresse renseignée)
- Étape 3 (Profil agent) : prénom + nom + photo + rôle remplis
- Étape 4 (Forfait) : `plan` choisi

### Globaux exposés

```js
window.__onboardingComplete = (payload: OnboardingPayload) => void
// Appelé par le CTA « Aller sur le CRM » de l'écran final.
// En prod : POST /api/onboarding/complete, redirige vers /aujourdhui.
```

---

## 🚦 Tweaks panel (debug & démo)

Le panneau Tweaks expose les contrôles suivants (cf. `ObShell` dans `onboarding/megga-onboarding-app.jsx`) — **à conserver en dev/staging, à virer en prod** :

- Mode clair / sombre (palette `OB_DARK`)
- Toggle animation d'entrée + replay
- Reset agence
- Recommencer depuis le début
- Sauter à l'écran final
- Saut → Forfait Découverte / Pro mensuel / Pro annuel
- Saut → Profil agence (rejointe) / (admin) / Profil agent

---

## ✅ Critères d'acceptation

- [ ] **Sugar Pure pixel-près** : aucune bordure 1px décorative, aucun accent coloré, titres en noir franc, ombres douces uniquement
- [ ] **Splash bascule** Property X → Sugar fonctionnel (Objectivity → Manrope, fond blanc → gradient), replayable via Tweaks
- [ ] **5 étapes navigables** via footer global (stepper "X / 5" footer-only, pas de cercles en header)
- [ ] **Étape KYC** : 100 % marketing, **aucune collecte de pièce d'identité**
- [ ] **Étape Agence** : 4 sous-états (search → selected → sent/validated → create), anti-doublon strict, toggle Agence/Indépendant·e fonctionnel
- [ ] **Étape Profil agence** : adapte selon `mode === 'joined'` (lecture seule "rempli par admin") ou `created/solo` (formulaire complet avec Mapbox)
- [ ] **Étape Profil agent** : photo signée C2PA côté serveur en silence, **aucun badge C2PA visible**, formulaire complet avec mobile CH formaté
- [ ] **Étape Forfait** : 2 cards Découverte/Pro, toggle mensuel/annuel, sélection par ring noir 2px inset
- [ ] **Écran final** : fiche agent complète avec les vraies données saisies + CTA « Aller sur le CRM »
- [ ] **Mode sombre** fonctionnel sur toutes les étapes (palette `OB_DARK`)
- [ ] **Validation** : `canNext` étendu par étape, CTA noir disabled tant que pas valide
- [ ] **0 emoji, 0 illustration, 0 bordure 1px décorative**

---

## 🚫 À ne PAS faire

- ❌ **Ne réintroduis pas** de collecte de pièce d'identité à l'étape 1 — le KYC s'applique aux **acheteurs**, pas aux agents (décision PO).
- ❌ **Ne réintroduis pas** de badge / pilule / logo C2PA dans le CRM agent — pas même petit, pas même discret (cf. Sprint 3).
- ❌ **Ne réintroduis pas** de cercles de stepper en haut de page — Sugar Pure = moins d'éléments, compteur footer suffit (décision PO Lot 1).
- ❌ **N'autorise pas** de doublon d'agence — si match trouvé, désactive le CTA "Créer", pas d'escape "Créer quand même".
- ❌ **Ne demande pas l'IBAN** à l'étape Profil agence (demandé plus tard, à la première vente).
- ❌ **N'utilise pas** de couleur d'accent UI (bleu, vert, violet) — noir et neutrals uniquement.
- ❌ **Ne mets pas** d'écran de welcome supplémentaire après l'onboarding ("Premier jour" / questions de calibration / synthèse IA) — l'écran final atterrit directement sur Aujourd'hui. (Discussion en cours avec Grégory sur l'éventualité d'1 question légère dans Aujourd'hui plutôt qu'un wizard séparé.)
- ❌ **N'utilise pas** de fonts hors Manrope (Inter, Roboto, Arial interdits) — Manrope pour Sugar, Objectivity uniquement sur le splash.

---

## 📎 Référence visuelle canonique

Quand tu doutes sur du visuel, ouvre dans l'ordre :

1. `onboarding/megga-onboarding-step-agence.jsx` → autocomplete + states + anti-doublon = la référence canonique
2. `onboarding/megga-onboarding-app.jsx` → `ObSplash` + `ObStepKYC` + `ObFinal` + shell + footer
3. `refs/crm-wizard-sugar-v2.jsx` → SugarV2Palette + primitives Sg* (canon Sugar Pure)
4. `refs/MEGGA-DESIGN-SYSTEM.md` → grammaire complète

---

## 🔭 Hors périmètre — pour info

Ces points ne sont **pas** dans l'onboarding mais ont été discutés :

- **Équipe / inviter collègues** → skip V1, post-launch
- **Tour guidé** (spotlights sur les écrans CRM) → initialement prévu Lot 3, repoussé / à arbitrer
- **Premier mandat** dans l'onboarding → reporté (les agents importent leurs mandats depuis le CRM lui-même, pas pendant l'onboarding — décision implicite Lot 2)
- **Écran "Premier jour"** (welcome + 4 questions calibration + synthèse IA + Today seeded) → maquette existante (`MEGGA Premier Jour.html`) mais **discussion en cours avec Grégory** : trop long après l'onboarding. Pistes : tout supprimer et lander direct sur Aujourd'hui avec 1 question MEGGA AI inline ; ou Premier jour condensé 1 écran. **À trancher avant implémentation.**
- **Signin success splash** (utilisateur connu) → déjà câblé dans `MEGGA Auth.html` (hors scope onboarding wizard).

Bonne implémentation 🇨🇭
