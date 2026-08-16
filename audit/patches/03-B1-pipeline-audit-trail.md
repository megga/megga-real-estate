# Patch 03 — B1 : piste d'audit pipeline faussée (ÉLEVÉ, compliance)

**Fichier** : `src/pages/agent/PipelinePage.tsx`

## Problème
`handleDrop` (l.147-157) appelle `applyDrop` puis émet **inconditionnellement** `logAudit.mutate('Étape changée')`.
Si la mutation de stade échoue (`onError` → toast + overlay reverté), l'`activity_event` trace quand même un
déplacement **qui n'a pas eu lieu** → piste d'audit LBA inexacte. Correctif : n'émettre l'audit qu'en **succès** de
la mutation.

## Correctif

### (a) `applyDrop` accepte un callback d'audit, émis en `onSuccess`

**AVANT** (l.108-134) :
```ts
  const applyDrop = (dealId: string, targetStage: StageId) => {
    // Optimistic overlay
    setPendingStage(prev => {
      const next = new Map(prev)
      next.set(dealId, targetStage)
      return next
    })
    // Mutation Supabase (transactions.stage ; l'event 'stage_change' est émis par le trigger DB trg_transaction_lifecycle)
    updateStage.mutate(
      { id: dealId, stage: stageIdToTransactionStage(targetStage) },
      {
        onError: () => {
          toast.error(t('board.toast.moveFailedTitle'), {
            description: t('board.toast.moveFailedDescription'),
          })
        },
        onSettled: () => {
          setPendingStage(prev => {
            if (!prev.has(dealId)) return prev
            const next = new Map(prev)
            next.delete(dealId)
            return next
          })
        },
      },
    )
  }
```

**APRÈS** :
```ts
  const applyDrop = (dealId: string, targetStage: StageId, onAudit?: () => void) => {
    // Optimistic overlay
    setPendingStage(prev => {
      const next = new Map(prev)
      next.set(dealId, targetStage)
      return next
    })
    // Mutation Supabase (transactions.stage ; l'event 'stage_change' est émis par le trigger DB trg_transaction_lifecycle)
    updateStage.mutate(
      { id: dealId, stage: stageIdToTransactionStage(targetStage) },
      {
        // B1 : audit émis SEULEMENT si la mutation réussit — sinon on tracerait
        // un déplacement annulé (piste d'audit LBA inexacte).
        onSuccess: () => { onAudit?.() },
        onError: () => {
          toast.error(t('board.toast.moveFailedTitle'), {
            description: t('board.toast.moveFailedDescription'),
          })
        },
        onSettled: () => {
          setPendingStage(prev => {
            if (!prev.has(dealId)) return prev
            const next = new Map(prev)
            next.delete(dealId)
            return next
          })
        },
      },
    )
  }
```

### (b) `handleDrop` passe l'audit en callback au lieu de le lancer en aveugle

**AVANT** (l.146-158) :
```ts
    const contact = contactsById.get(deal.contactId)
    applyDrop(deal.id, targetStage)
    // AuditEvent normal : Étape changée (info)
    logAudit.mutate({
      category: 'deal',
      severity: 'info',
      action: 'Étape changée',
      entityType: 'deal',
      entityId: deal.id,
      objectLabel: contact ? `${contact.firstName} ${contact.lastName}` : deal.id,
      metadata: { from: deal.stage, to: targetStage },
    })
    handleDragEnd()
```

**APRÈS** :
```ts
    const contact = contactsById.get(deal.contactId)
    const fromStage = deal.stage
    applyDrop(deal.id, targetStage, () => {
      // AuditEvent émis uniquement après succès de la mutation (cf. B1).
      logAudit.mutate({
        category: 'deal',
        severity: 'info',
        action: 'Étape changée',
        entityType: 'deal',
        entityId: deal.id,
        objectLabel: contact ? `${contact.firstName} ${contact.lastName}` : deal.id,
        metadata: { from: fromStage, to: targetStage },
      })
    })
    handleDragEnd()
```

## À décider (double-log)
Le commentaire l.115 indique que le trigger DB `trg_transaction_lifecycle` émet déjà un event `stage_change`.
Si cet event est équivalent (visible dans la timeline de conformité), le `logAudit` **client est redondant**
(double entrée par déplacement). Deux options pour Julien :
1. **Garder** le log client (ce patch) — utile si le trigger n'émet pas de libellé user-facing.
2. **Supprimer** entièrement le `logAudit` client et se reposer sur le trigger (source serveur, non contournable) —
   plus propre pour la compliance. À confirmer en inspectant ce que `trg_transaction_lifecycle` insère dans
   `activity_events`.

## Test
- Simuler un échec `updateStage` (RLS/réseau) → aucun `activity_event` « Étape changée » créé (avant : créé).
- Drag réussi → exactement 1 audit (vérifier l'absence de doublon avec le trigger).
- e2e `agent-pipeline-drag.spec.ts` : étendre pour asserter l'audit sur succès et son absence sur échec.
