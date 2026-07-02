# HANDOFF — Mobile & Tablette V1

> **À lire en premier dans toute nouvelle discussion qui touche au mobile, à la tablette, ou au responsive du projet MEGGA.**
> Document de décision créé en mai 2026 après cadrage avec Gregory.

---

## 1. Décision actée : Option D · web only V1

Après étude de 4 stratégies (voir `MEGGA Strategie Mobile.html`), la voie retenue est :

> **100 % web pour la V1**, responsive desktop → tablette → mobile, **PWA installable** pour la présence "app-like". **L'app native iOS est reportée à T1 2027**, conditionnellement (≥ 200 agents actifs + retour terrain qui prouve que le web ne suffit pas).

### Pourquoi pas d'app native en V1
- Gregory n'est pas prêt pour le coût et la complexité d'une app native maintenant.
- Une seule codebase web pendant la phase d'apprentissage produit.
- SEO marketplace 100 % préservé.
- Pas de friction store / TestFlight pour itérer avec les premiers agents.
- L'option native reste ouverte — aucune porte fermée.

### Features terrain dégradées en web (V1)
| Feature | Solution web | Limite vs natif |
|---|---|---|
| Photo bien C2PA | `getUserMedia` + signature WebCrypto client | Pas de capteur 48 MP brut |
| Signature bon de visite | `<canvas>` + pointer events | Pas de stylet Apple Pencil pression |
| Scan ID KYC | SDK web Sumsub / Onfido / Veriff | Pas de NFC passeport — fallback OCR |
| Push notifs | Web Push API (iOS 16.4+ via PWA installée) | iOS demande l'installation, friction +1 |
| Appel agent | `tel:` link | Pas d'intégration journal d'appels OS |

---

## 2. Décisions techniques validées

| Sujet | Choix | Notes |
|---|---|---|
| **Auth / SSO** | **Supabase Auth** | Gratuit, magic link + 2FA, suffisant V1 |
| **Backend** | À construire (Claude Code) | Pas encore en place |
| **Hors-ligne V1** | Niveau (a) — cache lecture seule | Agenda du jour + visites prévues + contacts liés. Édition hors-ligne = V2. |
| **C2PA** | Cloudflare Images préserve les manifestes | Signature à faire **côté client au moment de la prise de vue** — à confirmer avec l'équipe technique où la signature actuelle se fait |
| **Pilote** | Genève + Lausanne, **FR seul** | DE + IT reportés à l'expansion Zurich / Bâle / Tessin |
| **Breakpoints CRM** | landscape 1024 → portrait 768 → mobile 375 | Tablette landscape d'abord (sweet spot des visites client) |

---

## 3. Ordre des maquettes à produire

**Track 1 (principal)** — CRM responsive :
1. **CRM tablette landscape (1024)** — Aujourd'hui, Pipeline, Fiche contact
2. CRM tablette portrait (768)
3. CRM mobile web lite (375)

**Track 2 (parallèle, plus léger)** — Marketplace responsive :
- Property X mobile-first — Homepage, Recherche, Fiche bien
- C'est essentiellement du CSS d'ajustement (Property X est déjà responsive par construction)
- Ne pas démarrer avant que track 1 ait au moins la tablette landscape

**Track 3 (T3 2026)** — PWA installable :
- Push Web (Web Push API)
- Install prompt iOS 16.4+
- Service Worker + IndexedDB read-only (agenda du jour)

---

## 4. Ce qui a été nettoyé du projet (mai 2026)

**21 fichiers archivés** dans `archive-crm-pre-sugar/` :

Pré-Sugar (anciens écrans avec accent bleu `#0041D9`) :
- `crm-screen-today.jsx`, `crm-screen-pipeline.jsx`, `crm-screens.jsx`
- `crm-pipeline-new-deal.jsx`, `crm-pipeline-deal-detail.jsx`

v1/v2 abandonnés :
- `crm-dashboard-cockpit v1.jsx`, `crm-dashboard-objectif v1.jsx`
- `crm-screen-matching-sugar-v1.jsx`, `crm-screen-matching-sugar-v2.jsx`

Exploratoires de variantes :
- `cockpit-variant-a/b/c.jsx`, `cockpit-variantes-shared.jsx`
- `objectif-variant-a/b/c.jsx`
- `variation-a/b/c.jsx`
- `Dashboard Cockpit - Variantes.html`, `Dashboard Objectif - Variantes.html`

**`MEGGA CRM.html` refondu** :
- Tous les `<script>` des fichiers archivés retirés.
- **Branche non-Sugar supprimée intégralement** — il n'y a plus qu'une seule route de rendu (Sugar).
- Tweak « Style global → Classique » retiré.
- Tweak « Wizard création bien → v1 origine » retiré.
- Nouveau composant `SugarPlaceholder` (Sugar-styled) pour les écrans encore à construire (Chat, Support, Automatisation, Biens-new). Plus aucun chemin de code n'aboutit au design bleu pré-Sugar.
- Écran par défaut : `today` (au lieu de `chat`).

**Fichiers qui ne sont PAS dans l'archive mais qui ont l'air pré-Sugar** (ne pas archiver — ils sont en fait Sugar malgré leur nom) :
- `crm-shell.jsx` — expose `CRMIcon` utilisé partout par Sugar
- `crm-search-immersive.jsx` — c'est `CRMSugarSearch`, la palette ⌘K Sugar
- `crm-relance-today-card.jsx`, `crm-relance-today-followups.jsx` — Sugar
- `crm-dashboard-cockpit.jsx`, `crm-dashboard-test-modal.jsx` — Sugar
- `crm-julien.jsx` — Sugar (expose `CRMScreenJulienSugar`)
- `crm-wizard-creer-bien.jsx`, `crm-wizard-creer-bien-steps.jsx` — Sugar palette `sp`

---

## 5. Anti-patterns à NE PAS reproduire en mobile

Tout ce qui est interdit dans `MEGGA-DESIGN-SYSTEM.md` (CRM Sugar Pure) reste valide en responsive :
- ❌ Pas de bordure 1px décorative sur cards/modals (ombres seules).
- ❌ Pas d'accent coloré UI — noir franc `#0B0C0E` uniquement.
- ❌ Pas de fond bleu clair sur sélection — `cardSubtle` + ring noir 2px inset.
- ❌ Titres jamais en gris — toujours `#0B0C0E`.
- ❌ Pas d'emoji dans l'UI.
- ❌ Pas d'app native dans la V1 (décision actée — voir section 1).

Spécifiquement mobile :
- ❌ Pas de re-skin "minceur" du desktop sur petit écran — repenser la hiérarchie.
- ❌ Pas de sidebar latérale en mobile — bottom tab bar OU drawer.
- ❌ Pas de hit-area < 44px (cible tactile minimale).
- ❌ Pas de hover-only interactions — toujours un état tap-friendly.

---

## 6. Documents de référence par ordre de lecture

1. `CLAUDE.md` — direction artistique globale + conventions
2. `HANDOFF_MOBILE_V1.md` — ce document (mobile)
3. `MEGGA Strategie Mobile.html` — stratégie détaillée (rendu visuel)
4. `MEGGA-DESIGN-SYSTEM.md` — Sugar Pure (CRM)
5. `docs/design-system-propertyx.md` (GitHub) — Property X (marketplace)
6. `CRM_ARCHITECTURE.md` — architecture CRM
7. `MEGGA CRM.html` — maquette CRM hi-fi de référence

---

*Mis à jour : mai 2026. Owner : Gregory Lyonnet.*
