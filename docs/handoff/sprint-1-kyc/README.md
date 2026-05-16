# Handoff — Sprint 1 CRM MEGGA : Conformité KYC + LBA + nLPD (pack consolidé)

> 📦 Pack de transfert vers Claude Code, **version consolidée** intégrant les enrichissements KYC postérieurs à la spec Sprint 1 initiale.
> Drope ce dossier tel quel dans le repo CRM (ex : `docs/handoff/sprint-1-kyc/`), puis ouvre Claude Code à la racine du repo.

---

## ⚠️ À LIRE EN PREMIER (instruction pour Claude Code)

**Ne tente pas de fetcher d'URL `api.anthropic.com/v1/design/...`** — ce n'est pas un endpoint public. Tout est dans ce dossier local, lis-le directement.

Les fichiers `.jsx` sont des **maquettes hi-fi React/Babel inline** — ce sont des **références de design**, pas du code prod. Ton job : **recréer ces écrans dans le vrai codebase CRM** (avec son framework, son routing, sa DB, ses patterns), en respectant **pixel-près** la direction artistique **Sugar Pure**.

### Ordre de lecture obligatoire

1. **`README.md`** (ce fichier) — vue d'ensemble + arbitrages
2. **`KYC_ENRICHISSEMENTS.md`** — ce qui a été ajouté **après** la spec Sprint 1 initiale (à lire avant tout code KYC)
3. **`HANDOFF_SPRINT_1_CLAUDE_CODE.md`** — spec maître du Sprint 1 (modèle de données, logique métier, critères d'acceptation)
4. **`CLAUDE.md`** — règles globales du projet (section *🧭 Direction artistique du CRM : Sugar Pure*)
5. **`MEGGA-DESIGN-SYSTEM.md`** — spec Sugar Pure détaillée
6. **`CRM_ARCHITECTURE.md`** — vision produit (lire **§5.5** sur le KYC bloquant)
7. **`crm-wizard-sugar-v2.jsx`** → composant `SgGateCard` (Step 0) — référence visuelle canonique Sugar Pure

---

## Fidélité

**Hi-fi.** Couleurs, typo, espacements, ombres, animations, copy : tout est définitif et validé. Reproduire visuellement à l'identique, adapter techniquement.

---

## Périmètre consolidé — 6 livrables

| # | Surface | Fichier(s) maquette | Sortie attendue |
|---|---|---|---|
| 1 | **Écran KYC** (liste + détail 5 contrôles LBA) | `crm-screen-kyc-sugar.jsx` + `crm-kyc-data.jsx` | Routes `/crm/kyc` + `/crm/kyc/:dossierId` |
| 2 | **Wizard KYC** (3 étapes : Démarrer / Contact / Vigilance) | `crm-kyc-wizard.jsx` | Modal ou `/crm/kyc/new` |
| 3 | **Fiche détail Contact** (hero + bannière verrou + timeline + critères + biens + deals + docs) | `crm-screen-contact-detail-sugar.jsx` | `/crm/contacts/:id` |
| 4 | **Journal d'audit nLPD** (timeline immuable filtrable + exports CSV/PDF signé) | `crm-screen-audit-sugar.jsx` + section `AUDIT_EVENTS` dans `crm-kyc-data.jsx` | `/crm/audit` |
| 5 | **Verrou pipeline** (bannière noire `SugarPipelineKycLock` + garde-fou drag) | `crm-screen-pipeline-sugar.jsx` | À intégrer dans le pipeline existant |
| 6 | **🆕 Card KYC enrichie sur la fiche contact compacte** (stepper 6 étapes + 3 KPIs) | composant `CtKyc` dans `crm-screen-contacts-sugar.jsx` | À intégrer dans la liste contacts |

Le livrable **#6 est l'enrichissement clé** posé après la spec initiale — voir `KYC_ENRICHISSEMENTS.md`.

---

## Arbitrages — points où les maquettes se contredisent

### 1. Modèle KYC : 5 contrôles LBA vs 6 étapes affichées

- **Backend / données** : reste sur le modèle **5 contrôles** (`id / address / pep / sanctions / funds`) défini dans `crm-kyc-data.jsx` → `KYC_CHECK_LABELS`. C'est le modèle juridiquement aligné LBA art. 3-7.
- **UI fiche contact compacte** (`CtKyc`) : affiche un **stepper visuel à 6 étapes** *Identité → Béné. → Fonds → Screening → Risque → Validation*. C'est une **vue résumée**, pas une 1:1 avec les checks data.
- **Mapping UI → checks data** (à respecter dans le port) :
  | Stepper UI | Check(s) data |
  |---|---|
  | Identité | `id` |
  | Béné. (Bénéficiaire effectif) | `id` (sous-section) — pas de check dédié en data, dérivé du dossier |
  | Fonds | `funds` |
  | Screening | `pep` + `sanctions` (combinés) |
  | Risque | `dossier.riskLevel` calculé |
  | Validation | `dossier.status === 'verified'` |

→ Ne JAMAIS recréer 6 colonnes en DB. Le stepper UI est une projection.

### 2. Verrou pipeline : indicatif OU bloquant au drag ?

Les maquettes contiennent **les deux comportements** :
- `SugarPipelineKycLock` (bannière noire en haut) = **indicatif**, compte les deals concernés
- Dans `handleDrop` de `crm-screen-pipeline-sugar.jsx` : si `targetStage ∈ ['interest-confirmed', 'offer', 'signed']` et KYC ≠ verified → le drop est **annulé** et une toast jaune apparaît 3s

**Décision pour le port** : implémenter les deux comme dans la maquette — bannière persistante + garde au drag avec toast. **MAIS** : ajouter un bouton "Passer outre (motif requis)" dans la toast qui demande une justification écrite, log un `AuditEvent` `category:'deal'` + `severity:'warn'` + `detail` contenant le motif, et autorise le passage. Ça réconcilie la culture "discrétion + traçabilité" suisse du HANDOFF spec avec la garde technique de la maquette.

### 3. Couleur CTA dans `CtKyc`

Le code maquette utilise `background: "#0041D9"` (bleu) pour le bouton CTA. **C'est une erreur** — c'est l'ancien token Property X de la marketplace v1. **À corriger au port** : utiliser `#0B0C0E` (accent unique Sugar Pure CRM). Vérifier aussi tous les autres `#0041D9` éventuels dans `crm-screen-contacts-sugar.jsx` et les remplacer.

---

## Modèle de données consolidé

### `KYCDossier` (entité serveur, modèle LBA à 5 contrôles)
Voir `HANDOFF_SPRINT_1_CLAUDE_CODE.md` § *Modèle de données*.

### `Contact.kyc` (champ embarqué, vue résumée pour l'UI)
```ts
contact.kyc = {
  status: 'none' | 'pending' | 'verified' | 'stale' | 'failed',
  riskLevel: 'low' | 'medium' | 'high',
  expiresAt?: ISO,

  // 🆕 Champs ajoutés par l'enrichissement CtKyc — facultatifs côté API,
  // calculables depuis le KYCDossier complet ou stockés en cache lecture
  activeStep?: 0..6,            // position UI dans le stepper 6 étapes
  riskScore?: number,            // 0-100 (numérique)
  docsDone?: 0..6,
  lastScreenedAt?: 'DD.MM.YY',
}
```

→ Le **stepper, riskScore et docsDone sont des projections UI**. Ils peuvent être calculés à la volée côté frontend depuis le `KYCDossier` complet, ou exposés par l'API comme champs dérivés sur `Contact`.

### `AuditEvent` (journal immuable, append-only, 10 ans)
Voir `HANDOFF_SPRINT_1_CLAUDE_CODE.md` § *Modèle de données*.

---

## Direction artistique — Sugar Pure (non négociable)

Résumé (détails dans `MEGGA-DESIGN-SYSTEM.md` + `CLAUDE.md`) :

- **Surfaces blanches pures** `#FFFFFF` sur fond gradient `radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)`
- **Aucune bordure 1px décorative** — séparateur par ombre douce
- **Accent unique = NOIR PUR `#0B0C0E`** (CTA, sélection, ring 2px inset). Aucune couleur ne joue le rôle d'accent UI.
- **Titres en noir franc `#0B0C0E`**, jamais de gris
- **Rayons** : 28px modal, 22px card, 18px sous-card, 14px input, 999px pilule
- **Ombres signature** :
  - `shadowSm : 0 4px 16px rgba(15,23,42,0.04)`
  - `shadow   : 0 12px 40px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.03)`
  - `shadowLg : 0 24px 60px rgba(15,23,42,0.08), 0 4px 16px rgba(15,23,42,0.04)`
- **Animation entrée cards** : `sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both`
- **Typo** : Manrope, `tabular-nums` partout, **CHF avec apostrophes** (`CHF 1'250'000`)
- **Iconographie** : SVG stroke linéaire uniquement. Zero emoji.

---

## Helpers / API d'accès aux données KYC (à reproduire côté repo)

Dans `crm-kyc-data.jsx` la maquette expose ces helpers globaux que tout le reste consomme :

```js
window.KYC_DOSSIERS          // Array<KYCDossier>
window.KYC_CHECK_LABELS      // { id, address, pep, sanctions, funds } → { title, sub }
window.KYC_RISK_LABELS       // { low, medium, high } → { label, tone }
window.KYC_STATUS_LABELS     // { none, pending, verified, failed, stale } → { label, tone }

window.kycByContactId(cid)   // → KYCDossier | null
window.kycCompletionPct(d)   // → 0..100 (pourcentage de checks verified+na)
window.kycCountByStatus(s)   // → number

window.AUDIT_EVENTS          // Array<AuditEvent>
window.AUDIT_CATEGORIES      // ['kyc','deal','contact','bien','doc','auth','settings','ai']
window.auditFilterByDate(arr, days)
```

Dans le vrai backend, ce sont des endpoints REST/GraphQL équivalents — mais l'agencement (un service `kyc.byContactId`, un service `audit.filterByDate`, etc.) reste pertinent.

### Deep-link contact → KYC
Convention de la maquette :
```js
window.__kycOpenForContactId = contact.id;
navigate('/crm/kyc');
```
À l'arrivée sur l'écran KYC, lire cette variable :
- Si un dossier existe pour ce contact (status ≠ `'none'`) → ouvrir le dossier
- Sinon → ouvrir le **wizard pré-rempli à l'étape Vigilance** (pas l'étape 1)

Dans le vrai codebase, utiliser un query param d'URL (`?openContactId=c-001`) plutôt qu'une variable globale.

---

## Critères d'acceptation consolidés

Liste complète dans `HANDOFF_SPRINT_1_CLAUDE_CODE.md`. Ajouts liés à l'enrichissement :

- [ ] Card `CtKyc` sur la fiche contact compacte affiche le stepper 6 étapes + les 3 KPIs (Risque/Pièces/Dernier screening)
- [ ] La couleur CTA de `CtKyc` est `#0B0C0E` (NOIR Sugar Pure), **pas** `#0041D9`
- [ ] Le statut `stale` est traité comme un cas distinct dans tous les écrans (CTA "Relancer le screening", couleur orange, hint "à re-screener après 12 mois")
- [ ] Le verrou pipeline a une toast "Passer outre (motif requis)" qui demande une justification et log un `AuditEvent` `severity:'warn'`
- [ ] Le deep-link contact → KYC utilise un query param d'URL, pas une variable globale
- [ ] Les helpers `kycByContactId`, `kycCompletionPct`, `kycCountByStatus` existent côté backend (ou équivalent service)
- [ ] Au moins **un test E2E** par flow : (a) création dossier via wizard, (b) marquage 5 contrôles → status `verified` + `expiresAt = +12 mois`, (c) drag deal bloqué + passage outre avec motif, (d) export PDF audit signé

---

## Fichiers du pack

### Documentation
| Fichier | Rôle |
|---|---|
| `README.md` | Vue d'ensemble + arbitrages (ce fichier) |
| `KYC_ENRICHISSEMENTS.md` | **Diff post-Sprint 1** — à lire en complément du HANDOFF |
| `HANDOFF_SPRINT_1_CLAUDE_CODE.md` | Spec maître du Sprint 1 |
| `CLAUDE.md` | Règles globales projet MEGGA |
| `MEGGA-DESIGN-SYSTEM.md` | Spec Sugar Pure complète |
| `CRM_ARCHITECTURE.md` | Vision produit (§5.5 = KYC bloquant) |

### Maquettes Sprint 1
| Fichier | Contient |
|---|---|
| `crm-screen-kyc-sugar.jsx` | Écran KYC (liste + détail 5 contrôles) |
| `crm-kyc-wizard.jsx` | Wizard 3 étapes |
| `crm-screen-contact-detail-sugar.jsx` | Fiche contact détaillée + bannière `CdKycBanner` + sidebar `CdKycCard` |
| `crm-screen-audit-sugar.jsx` | Journal audit nLPD |
| `crm-screen-pipeline-sugar.jsx` | Pipeline + `SugarPipelineKycLock` + garde-fou drag |
| `crm-kyc-data.jsx` | Mocks `KYC_DOSSIERS` + `AUDIT_EVENTS` + helpers |

### Maquettes enrichies (post-Sprint 1)
| Fichier | Contient |
|---|---|
| `crm-screen-contacts-sugar.jsx` | 🆕 Composant `CtKyc` (stepper 6 étapes + 3 KPIs + mode non-bloquant) |
| `crm-data.jsx` | Structure canonique `Contact.kyc` (champ embarqué) |
| `crm-screens.jsx` | Composant `CRMKYCBadge` (badge de statut réutilisable) |

### Références visuelles & utilitaires
| Fichier | Rôle |
|---|---|
| `crm-wizard-sugar-v2.jsx` | **Référence canonique** Sugar Pure (Step 0 = `SgGateCard`) |
| `crm-tokens.jsx` | Tokens Sugar (`CRM_TOKENS`, `crmFmtCHF`, palettes, `CRM_STAGES`) |
| `crm-shell.jsx` | Shell CRM (`CRMIcon` = catalogue d'icônes line SVG) |

---

## Anti-patterns (à ne PAS faire)

- ❌ Recopier littéralement les data mocks de `crm-kyc-data.jsx` / `crm-data.jsx` en prod
- ❌ Créer 6 colonnes de checks en DB pour matcher le stepper UI — le modèle reste à 5
- ❌ Bordure 1px décorative sur card/modal/panel (erreur n°1 qui casse Sugar Pure)
- ❌ Couleur d'accent UI autre que `#0B0C0E` (ni bleu `#0041D9`, ni violet, ni vert)
- ❌ Bloquer techniquement le drag pipeline **sans** offrir l'option "Passer outre + motif"
- ❌ Inter, Roboto, Arial — Manrope uniquement
- ❌ Emoji dans l'UI — SVG stroke uniquement

---

## Plan d'attaque suggéré

1. **Lire les 4 .md + KYC_ENRICHISSEMENTS.md** avant toute ligne de code
2. **Ouvrir `crm-wizard-sugar-v2.jsx`** dans un viewer JSX pour calibrer l'œil sur Sugar Pure (`SgGateCard`)
3. **Migrations DB** : tables `kyc_dossier`, `kyc_check`, `kyc_document`, `audit_event` (append-only, conservation 10 ans)
4. **Backend** : endpoints CRUD KYC + endpoint append-only audit + hook auto-`AuditEvent` sur les mutations existantes (contact créé, deal étape changée, doc signé)
5. **Frontend** dans cet ordre :
   - (a) Écran KYC liste + détail
   - (b) Wizard KYC
   - (c) Bannière `SugarPipelineKycLock` + garde-fou drag (avec "Passer outre + motif")
   - (d) Card `CtKyc` enrichie sur la liste contacts
   - (e) Fiche contact détaillée + bannière `CdKycBanner`
   - (f) Journal audit
6. **Tests** : 4 tests E2E listés dans les critères d'acceptation
7. **Vérifs Sugar Pure** : inspecteur sur 5 écrans choisis au hasard, valider qu'aucune bordure 1px et aucun `#0041D9` ne subsistent

Bonne implémentation 🇨🇭
