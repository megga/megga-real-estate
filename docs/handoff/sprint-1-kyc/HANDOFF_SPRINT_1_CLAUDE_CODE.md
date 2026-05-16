# Handoff Claude Code — Sprint 1 : Conformité KYC + Fiche contact + Audit nLPD

> **À lire avant tout** : `CLAUDE.md`, `CRM_ARCHITECTURE.md`, `MEGGA-DESIGN-SYSTEM.md` de ce projet de maquettes.
> Les maquettes hi-fi de référence sont dans ce projet, fichier `MEGGA CRM.html` + les `.jsx` listés ci-dessous.

---

## 🎯 Ce qu'on a déjà construit en maquette (à porter dans le vrai CRM)

J'ai conçu et validé **4 livrables Sprint 1** en HTML/JSX hi-fi, en direction artistique **Sugar Pure** (cf. `MEGGA-DESIGN-SYSTEM.md`).

Ton job : reproduire ces écrans dans le vrai codebase, en respectant pixel-près la grammaire visuelle Sugar Pure (surfaces blanches, accent noir `#0B0C0E`, ombres douces, **aucune bordure décorative**, beaucoup d'air, titres en noir franc).

### Périmètre

| # | Livrable | Fichier maquette à lire |
|---|---|---|
| 1 | **Écran KYC** — liste de dossiers + vue détail avec 5 contrôles LBA (Identité / Adresse / PEP / Sanctions / Source des fonds) | `crm-screen-kyc-sugar.jsx` + `crm-kyc-data.jsx` |
| 2 | **Wizard "Nouveau dossier KYC"** — 3 étapes Sugar (Démarrer / Contact / Vigilance) | `crm-kyc-wizard.jsx` |
| 3 | **Fiche détail Contact** — hero + bannière KYC bloquante + timeline + critères + biens proposés + deals + docs | `crm-screen-contact-detail-sugar.jsx` |
| 4 | **Journal d'audit nLPD** — timeline immuable filtrable + exports | `crm-screen-audit-sugar.jsx` + `crm-kyc-data.jsx` (section AUDIT_EVENTS) |
| 5 | **Verrou pipeline** — bannière noire au-dessus du pipeline qui compte les deals bloqués par KYC | dans `crm-screen-pipeline-sugar.jsx` (composant `SugarPipelineKycLock`) |

---

## 📐 Direction artistique — Sugar Pure (NON NÉGOCIABLE)

Voir `MEGGA-DESIGN-SYSTEM.md` pour la spec complète. Rappel des règles que **toute** ma maquette respecte et que tu dois respecter :

- **Surfaces blanches pures** `#FFFFFF` sur fond gradient radial gris-bleu (`#C8D5E0` → `#EDEFF3`)
- **AUCUNE bordure 1px décorative** sur cards/modals/panels — séparateur uniquement par ombre douce
- **Accent unique = NOIR PUR `#0B0C0E`** (boutons CTA, sélection active, ring noir 2px inset, stepper actif). Aucune couleur ne joue le rôle d'accent UI.
- **Titres en noir franc `#0B0C0E`**, jamais de gris
- **Coins arrondis généreux** : 28px modal, 22px card, 18px sous-card, 14px inputs imbriqués, 999px pilule/cercle
- **Ombres signature** :
  - `shadowSm: 0 4px 16px rgba(15,23,42,0.04)`
  - `shadow:   0 12px 40px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.03)`
  - `shadowLg: 0 24px 60px rgba(15,23,42,0.08), 0 4px 16px rgba(15,23,42,0.04)`
- **Animation d'entrée** : `sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both` sur les cards qui apparaissent
- **Bouton CTA noir** : `height 44-46px, borderRadius 999px, background #0B0C0E, color #fff, fontWeight 700`, hover → `#1F2024` + `translateY(-1px)` + ombre lift
- **Sélection card** : `boxShadow: "0 0 0 2px #0B0C0E inset"` + fond `cardSubtle`. JAMAIS de fond bleu clair.
- **Typo** : `Manrope`. `tabular-nums` sur tous les nombres. Pas d'emoji dans l'UI — icônes SVG stroke linéaires uniquement.
- **CHF avec apostrophes** : `CHF 1'250'000` (formatter dans la maquette : `crmFmtCHF`)

Si tu doutes : ouvre `crm-wizard-sugar-v2.jsx` (Step 0 = `SgGateCard`) — c'est l'incarnation canonique du style.

---

## 🧱 Modèle de données à implémenter

### `KYCDossier` (nouvelle entité)

```ts
{
  id: string,
  contactId: string,
  agentId: string,
  status: 'none' | 'pending' | 'verified' | 'stale' | 'failed',
  riskLevel: 'low' | 'medium' | 'high',
  vigilance: 'standard' | 'renforced',     // LBA art. 3-4 vs art. 6
  createdAt: ISO,
  verifiedAt: ISO | null,
  expiresAt: ISO | null,                    // +12 mois après verifiedAt
  checks: {
    id:        KycCheck,   // Pièce d'identité
    address:   KycCheck,   // Justificatif domicile < 3 mois
    pep:       KycCheck,   // Screening Personne Exposée Politiquement
    sanctions: KycCheck,   // OFAC / SECO / ONU / UE
    funds:     KycCheck,   // Source des fonds (> CHF 100k)
  },
  documents: KycDocument[],
}

type KycCheck = {
  status: 'pending' | 'verified' | 'failed' | 'na',
  at: ISO | null,
  by: string | null,        // agentId ou 'system'
  note: string | null,
}
```

### `AuditEvent` (nouvelle entité — journal immuable)

```ts
{
  id: string,
  at: ISO,
  actor: string,            // agentId ou 'system'
  category: 'kyc' | 'deal' | 'contact' | 'bien' | 'doc' | 'auth' | 'settings' | 'ai',
  severity: 'info' | 'warn' | 'critical',
  action: string,           // ex. "Étape changée", "Verrou KYC déclenché"
  object: { kind, id, label },
  detail: string,
  ip: string | null,
}
```

Les data mocks dans `crm-kyc-data.jsx` donnent des exemples concrets de chaque cas (regarde notamment : verrou KYC déclenché, screening sanctions auto, signature électronique, tentative auth échouée).

---

## ⚙️ Logique métier à câbler

### 1. KYC bloquant — verrou pipeline
**Architecture §5.5** : un deal **ne peut pas** passer en `interest-confirmed` si son contact n'a pas un KYC `verified`.

Implémenter :
- Calcul live des "deals bloqués" = ceux dont `stage ∈ ['visit-done', 'interest-confirmed', 'offer', 'signed']` ET `kycByContactId(contactId).status !== 'verified'`
- Bannière noire en haut du pipeline (`SugarPipelineKycLock` dans la maquette) qui compte ces deals et liste les 3 premiers noms
- **Décision design importante** : le verrou est **INDICATIF, pas BLOQUANT au drag**. Un agent peut moralement faire avancer un deal sans KYC validé (cas réels : confiance, urgence) — mais il voit clairement qu'il prend une dérogation. C'est conforme à la culture suisse "discrétion + traçabilité". Tout passage forcé doit être loggé dans `AuditEvent` avec severity `warn` ou `critical`.

### 2. Marquage de check
- Clic "Marquer vérifié" sur un check → mutation : `{ status: 'verified', at: now, by: currentAgentId, note: previousNote ?? 'Vérifié manuellement par l'agent.' }`
- Si **tous** les checks du dossier sont `verified` ou `na` → auto-update `dossier.status = 'verified'`, `verifiedAt = now`, `expiresAt = now + 12mois`
- Chaque marquage génère un `AuditEvent` `{ category: 'kyc', action: 'Contrôle validé', severity: 'info' }`

### 3. Deep-link contact → KYC
- Sur la fiche contact, le bouton "Ouvrir" de la KYC card (et la bannière "Pipeline bloqué") doit ouvrir **directement le dossier de ce contact**, pas la liste générale
- Si le contact n'a pas de dossier (status 'none' ou inexistant) → ouvrir le **wizard KYC pré-rempli à l'étape Vigilance** avec ce contact déjà sélectionné

### 4. Audit log nLPD
- Tous les évènements doivent être **immuables** (append-only DB, ou signature cryptographique légère)
- Conservation **10 ans** (nLPD art. 12, LBA art. 7)
- Filtres demandés : par date (7j/30j/90j/Tout), par catégorie (8), par sévérité (info/warn/critical), recherche plein texte
- Export CSV + **PDF horodaté** (signé pour preuve juridique)

### 5. Wizard KYC — 3 étapes
- Step 1 "Démarrer" : 3 portes — `existing` (recommandé) / `import` (PDF Persona/ComplyAdvantage) / `magic` (lien de demande au contact)
- Step 2 "Contact" : picker des contacts du CRM, contacts ayant déjà un dossier en cours sont **grisés et non-cliquables**
- Step 3 "Vigilance" : 2 cartes — Standard (LBA art. 3-4, `low risk`) ou Renforcée (LBA art. 6, `medium risk`)
- Pour les sources `import` et `magic` : flow réel à concevoir (l'import PDF doit appeler un OCR/parser, le magic link doit envoyer un email + créer une page publique sécurisée pour upload des pièces côté contact)

---

## ✅ Critères d'acceptation

- [ ] Toutes les couleurs respectent Sugar Pure (vérifier au inspecteur : `#0B0C0E` pour l'accent, aucune bordure 1px décorative, fond gradient)
- [ ] Typographie Manrope, `tabular-nums` partout sur les nombres, CHF avec apostrophes
- [ ] Animation `sgFadeUp` sur l'entrée des cards de détail
- [ ] KYC : passage status `none → pending → verified` fonctionne, expires auto-calculé à +12 mois
- [ ] Verrou pipeline : la bannière noire apparaît/disparaît automatiquement selon l'état réel des dossiers
- [ ] Deep-link fiche contact → KYC ouvre le bon dossier, pas la liste générale
- [ ] Wizard : le contact pré-sélectionné depuis la fiche atterrit bien sur l'étape Vigilance (pas Step 1)
- [ ] Audit log : tous les évènements générés par les opérations CRM (création contact, étape changée, KYC validé, doc signé) apparaissent dans le journal
- [ ] Export PDF de l'audit log est signé (timestamp + hash chain)
- [ ] Mobile : tous les écrans doivent au minimum **scroller proprement** sur 375px (responsive complet en phase 2)

---

## 🚫 À ne PAS faire

- ❌ Ne recopie PAS littéralement les data mocks de `crm-kyc-data.jsx` en production — ce sont des exemples pour le design, les données réelles viendront de l'API.
- ❌ Ne mets PAS de bordure 1px décorative sur les cards (j'ai été strict là-dessus, c'est l'erreur n°1 qui cassera Sugar Pure).
- ❌ Ne mets PAS de bleu / violet / vert comme accent UI — uniquement comme micro-pastille de statut (≤ 7×7px).
- ❌ Ne bloque PAS techniquement le drag du deal vers `interest-confirmed` — laisse l'agent passer outre avec un avertissement et un log audit (cf. règle métier ci-dessus).
- ❌ N'utilise PAS Inter, Roboto, Arial — uniquement Manrope.

---

## 📎 Référence visuelle canonique

Quand tu doutes sur du visuel, ouvre dans l'ordre :

1. `crm-wizard-sugar-v2.jsx` → Step 0 (composant `SgGateCard`) — c'est **le** standard Sugar Pure
2. `crm-screen-kyc-sugar.jsx` → fonction `KycDossierDetail` — pour les checks et la piste d'audit
3. `crm-screen-contact-detail-sugar.jsx` → fonction `CdHero` + `CdKycBanner` — pour la bannière verrou
4. `crm-screen-audit-sugar.jsx` → fonction `AudEventRow` — pour le journal

Bonne implémentation 🇨🇭
