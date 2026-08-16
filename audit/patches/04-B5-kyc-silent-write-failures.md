# Patch 04 — B5 : échecs silencieux sur écritures KYC/LBA (MOYEN, compliance)

**Fichier** : `src/components/crm-dossiers/kyc/KycDossierDetail.tsx`

## Problème
`handleMarkVerified` (l.240, `markCheck.mutate`) et `confirmMarkAll` (l.267, `markAll.mutate`) n'ont **aucun
`onError`**. Un échec RLS/réseau est **silencieux** → l'agent croit avoir validé un contrôle LBA (attestation art. 9)
alors que l'écriture a échoué. Les autres actions du fichier (`screen`/`createDecision`/`uploadDoc`) gèrent déjà
`onError` via `setActionMessage`.

## Correctif — surfacer l'erreur (aligné sur le pattern `setActionMessage` existant)

### (a) `handleMarkVerified` (l.237-241)

**AVANT** :
```ts
  const handleMarkVerified = (category: KycCheckCategory) => {
    const item = checksByCategory[category]
    if (!item) return
    markCheck.mutate({ checkId: item.id, is_completed: true, actorId: agentId })
  }
```
**APRÈS** :
```ts
  const handleMarkVerified = (category: KycCheckCategory) => {
    const item = checksByCategory[category]
    if (!item) return
    setActionMessage(null)
    markCheck.mutate(
      { checkId: item.id, is_completed: true, actorId: agentId },
      {
        // B5 : un échec d'écriture LBA ne doit JAMAIS être silencieux.
        onError: () => setActionMessage({ kind: 'err', text: t('dossier.detail.markCheckFailed') }),
      },
    )
  }
```

### (b) `confirmMarkAll` (l.265-268)

**AVANT** :
```ts
  const confirmMarkAll = () => {
    setConfirmOpen(false)
    markAll.mutate({ kycCaseId: dossierId, actorId: agentId })
  }
```
**APRÈS** :
```ts
  const confirmMarkAll = () => {
    setConfirmOpen(false)
    setActionMessage(null)
    markAll.mutate(
      { kycCaseId: dossierId, actorId: agentId },
      {
        onError: () => setActionMessage({ kind: 'err', text: t('dossier.detail.markAllFailed') }),
      },
    )
  }
```

### (c) Ajouter les 2 clés i18n (FR/DE/EN/IT — cf. skill i18n-sync)
Namespace du dossier KYC (aligner sur les clés `dossier.detail.*` existantes) :
```
dossier.detail.markCheckFailed = "Échec de l'enregistrement du contrôle. Réessayez."
dossier.detail.markAllFailed   = "Échec de la validation du dossier. Aucune modification enregistrée."
```

## Gate métier à confirmer (séparé de B5 — voir audit §4)
`canMarkAll` (l.244) ne vérifie que `screeningGuard.status==='ok'` (sanctions/PEP). **Vérifier côté serveur** que
`markAll` (RPC/hook) exige bien les **5 contrôles LBA** réellement complétés (id, adresse, fonds, sanctions, PEP) —
sinon une attestation art. 9 est possible sans les contrôles ID/adresse/fonds. Si le serveur ne l'impose pas,
ajouter la garde dans la RPC `markAll` (migration séparée).

## Test
- Forcer un échec `markCheck`/`markAll` (RLS) → message d'erreur visible, l'UI ne présente pas le contrôle comme validé.
- Vérifier la parité i18n des 2 nouvelles clés (`npm run i18n:parity`).
