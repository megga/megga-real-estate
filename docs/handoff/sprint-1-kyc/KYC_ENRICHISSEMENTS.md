# KYC — Enrichissements post-Sprint 1

> Ce document liste ce qui a été **ajouté ou modifié** après la rédaction de `HANDOFF_SPRINT_1_CLAUDE_CODE.md`.
> En cas de conflit avec la spec d'origine, **ce document fait foi**.

---

## 1. Nouveau composant : `CtKyc` (card KYC enrichie pour la liste contacts)

📍 Fichier : `crm-screen-contacts-sugar.jsx`, lignes ~590-720
📍 Différent de : `CdKycCard` (qui vit dans la *fiche contact détaillée*, `crm-screen-contact-detail-sugar.jsx`)

### Différence clé
`CtKyc` vit dans la **vue compacte** de la liste contacts (bento à droite à côté des Critères). C'est une **vue résumée** plus dense en infos que `CdKycCard`.

### Structure visuelle
```
┌─────────────────────────────────────────────────────────┐
│ [icône] Conformité KYC / LBA       [pill statut]        │
│         hint contextuel sur le statut                   │
│                                                          │
│  ●━━━●━━━●━━━●━━━●━━━●                                  │
│  Identité Béné. Fonds Screen Risque Validation         │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│  │ RISQUE   │ │ PIÈCES   │ │ DERNIER  │                │
│  │ 14/Faible│ │ 6/6      │ │ 12.04.26 │                │
│  └──────────┘ └──────────┘ └──────────┘                │
│                                                          │
│  [    CTA contextuel (noir)    ]                       │
└─────────────────────────────────────────────────────────┘
```

### Stepper 6 étapes (UI uniquement — ne crée pas 6 colonnes en DB)

| Position | Label UI | Mappe sur (côté data) |
|---|---|---|
| 0 | Identité | `dossier.checks.id` |
| 1 | Béné. (Bénéficiaire effectif) | sous-section de `id` (LBA art. 4) |
| 2 | Fonds | `dossier.checks.funds` |
| 3 | Screening | `dossier.checks.pep` **+** `dossier.checks.sanctions` (combinés) |
| 4 | Risque | calculé depuis `dossier.riskLevel` |
| 5 | Validation | `dossier.status === 'verified'` |

**Inférence par défaut** depuis `status` quand `activeStep` n'est pas fourni :
```js
const stepByStatus = {
  none:     0,   // rien démarré
  pending:  3,   // screening en cours
  stale:    5,   // tout fait mais à re-screener
  verified: 6,   // tout fait
};
```

### Les 3 KPIs

| KPI | Source | Format |
|---|---|---|
| **Risque** | `contact.kyc.riskScore` (0-100) + `riskLevel` | score numérique + label "Faible/Modéré/Élevé" |
| **Pièces** | `contact.kyc.docsDone` / 6 | `X / 6` |
| **Dernier screening** | `contact.kyc.lastScreenedAt` | `DD.MM.YY` |

**Couleur du score de risque** :
- `< 25` → vert `#0E9F6E`
- `25-59` → orange `#F59E0B`
- `≥ 60` → rouge `#E53935`

### Statut `stale` (nouveau cas)

Le Sprint 1 originel parlait de 5 statuts (`none / pending / verified / failed / na`). L'enrichissement traite `stale` (= dossier vérifié mais expiré ou à re-screener) comme **un cas UI à part entière** :

- Couleur header : orange `#F59E0B`
- Label statut : "À re-screener"
- Hint : "Sanctions/PEP à rafraîchir — recommandé après 12 mois ou changement de situation"
- CTA : "Relancer le screening"

→ Côté DB, `stale` doit être une valeur possible de `KYCDossier.status` au même titre que les autres.

### Doctrine "non-bloquant" (citation du code)

```
// Mode non-bloquant : affiche l'état du dossier sans jamais empêcher d'action.
```

Hint affiché quand status = `none` :
> *"Vous pouvez continuer à travailler ce dossier — pensez à le compléter avant la signature."*

Cette doctrine **prime** sur le wording "verrou bloquant" du HANDOFF_SPRINT_1 — le KYC est un guide, pas une barrière, sauf au moment du passage en stage sensible du pipeline (cf. point 3).

### ⚠️ Bug à corriger au port

```jsx
background: status === "verified" ? "transparent" : "#0041D9",
```
Le CTA utilise `#0041D9` (bleu Property X de la marketplace). **À remplacer** par `#0B0C0E` (noir accent Sugar Pure).

---

## 2. Champs ajoutés sur `Contact.kyc`

La structure canonique côté `crm-data.jsx` reste minimaliste :
```js
kyc: { status, riskLevel, expiresAt? }
```

Mais `CtKyc` consomme aussi ces champs facultatifs :
```ts
contact.kyc = {
  ...,
  activeStep?: 0..6,
  riskScore?: number,
  docsDone?: 0..6,
  lastScreenedAt?: 'DD.MM.YY',
}
```

**Recommandation backend** : exposer ces champs **dérivés** sur l'API `GET /contacts/:id` (calculés à la volée depuis le `KYCDossier` complet). Pas besoin de les stocker en colonne — c'est de la projection.

---

## 3. Verrou pipeline : indicatif **+** garde-fou drag

Le `HANDOFF_SPRINT_1_CLAUDE_CODE.md` disait : *"INDICATIF, pas BLOQUANT au drag"*.
La maquette `crm-screen-pipeline-sugar.jsx` implémente en fait **les deux** :

```js
// Garde-fou KYC : interest-confirmed, offer, signed
const kycRequired = ["interest-confirmed", "offer", "signed"].includes(targetStage);
if (kycRequired && contact?.kyc?.status !== "verified") {
  setKycBlockStage(targetStage);
  setTimeout(() => setKycBlockStage(null), 3000);
  handleDragEnd(); return;  // ← annule le drop
}
```

+ une **toast jaune** flottante 3s : *"KYC requis pour passer en « X ». Vérifiez le contact d'abord."*

### Décision pour le port

Implémenter **les deux** comportements de la maquette, **et ajouter** un bouton "Passer outre (motif requis)" dans la toast :

1. La toast d'avertissement apparaît
2. Bouton "Passer outre" → modal qui demande une justification écrite (textarea, min 20 caractères)
3. Sur validation :
   - Le drop est autorisé, le deal passe à `targetStage`
   - Un `AuditEvent` est créé avec :
     - `category: 'deal'`
     - `severity: 'warn'` (ou `'critical'` si stage = `signed`)
     - `action: 'Passage outre verrou KYC'`
     - `detail: motif saisi par l'agent`
     - `object: { kind: 'deal', id: deal.id, label: ... }`

Ça réconcilie la culture suisse "discrétion + traçabilité" avec la garde technique de la maquette.

---

## 4. Statuts KYC consolidés (5 valeurs)

```ts
type KycStatus =
  | 'none'      // pas de dossier ouvert
  | 'pending'   // dossier ouvert, vérifications en cours
  | 'verified'  // tous les checks OK, dossier validé
  | 'stale'     // dossier vérifié mais à re-screener (>12 mois ou changement)
  | 'failed'    // un check a échoué (sanctions, PEP confirmé sans accord agent)
```

Le statut `failed` doit toujours déclencher un `AuditEvent` `severity: 'critical'`.
Le statut `stale` doit déclencher un `AuditEvent` `severity: 'warn'` à chaque détection.

---

## 5. Helpers exposés (à reproduire côté backend/service)

```js
// dans crm-kyc-data.jsx, exposés sur window
window.kycByContactId(cid)     // → KYCDossier | null
window.kycCompletionPct(d)     // → 0..100 (% de checks verified+na)
window.kycCountByStatus(s)     // → number (compteur)
```

Côté repo réel, traduire en :
- `kycService.byContactId(cid)`
- `kycService.completionPct(dossier)` — utile pour la bannière, la sidebar, et la card `CtKyc`
- `kycService.countByStatus(status)` — utile pour les KPI dashboards

---

## 6. Deep-link `__kycOpenForContactId`

La maquette utilise une variable globale `window.__kycOpenForContactId` pour passer le contexte d'un écran à l'autre. **À remplacer côté repo** par un query param d'URL :

```
/crm/kyc?openContactId=c-001
```

Comportement à l'arrivée :
- Si un dossier existe pour `c-001` (status ≠ `'none'`) → ouvrir le dossier
- Sinon → ouvrir le **wizard pré-rempli directement à l'étape Vigilance** (skipper Step 1 "Démarrer")

---

## 7. AuditEvents à générer automatiquement

Sur tous les évènements suivants, créer un `AuditEvent` :

| Trigger | category | severity | action |
|---|---|---|---|
| Création dossier KYC | `kyc` | `info` | "Dossier KYC ouvert" |
| Check marqué `verified` | `kyc` | `info` | "Contrôle validé" (avec label du check) |
| Check marqué `failed` | `kyc` | `critical` | "Contrôle échoué" |
| Tous checks `verified`/`na` → dossier devient `verified` | `kyc` | `info` | "Dossier KYC validé" |
| Dossier passe `stale` (12 mois) | `kyc` | `warn` | "Dossier KYC à re-vérifier" |
| Screening sanctions automatique (cron) | `kyc` | `info` ou `critical` selon résultat | "Screening sanctions automatique" |
| Passage outre verrou pipeline | `deal` | `warn` (ou `critical` si stage=signed) | "Passage outre verrou KYC" |
| Contact créé | `contact` | `info` | "Contact créé" |
| Deal étape changée | `deal` | `info` | "Étape changée" |
| Document signé (DocuSign / signature interne) | `doc` | `info` | "Document signé" |
| Auth échouée (3 tentatives) | `auth` | `warn` | "Tentative d'authentification échouée" |
| Settings modifiés | `settings` | `info` | "Paramètres modifiés" |

Exemples concrets dans `crm-kyc-data.jsx` → `AUDIT_EVENTS`.

---

## TL;DR

Si tu lis ce doc et que tu ne dois retenir que 5 choses :

1. **`CtKyc` = nouvelle card** sur la liste contacts (stepper 6 étapes + 3 KPIs + non-bloquant)
2. **6 étapes UI ≠ 5 checks DB** — c'est une projection visuelle, pas un changement de modèle
3. **CTA bleu `#0041D9` à corriger en `#0B0C0E`** au port
4. **Verrou pipeline = bannière + drag-guard + "Passer outre + motif"** (logger en audit)
5. **Statut `stale`** est un cas UI à part entière (couleur orange, CTA "Relancer le screening")
